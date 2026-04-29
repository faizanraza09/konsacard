const GEMINI_MODEL = "gemini-2.5-flash-lite";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/* ── Rate limiting ── */
const RATE_LIMIT_HOURLY = 5;
const RATE_LIMIT_DAILY  = 10;

async function checkRateLimit(kv, ip, shouldCount) {
  if (!kv || !ip) return null; // no KV binding → skip (local dev without KV)

  const now       = Date.now();
  const hourKey   = `rl:h:${ip}:${Math.floor(now / 3_600_000)}`;
  const dayKey    = `rl:d:${ip}:${Math.floor(now / 86_400_000)}`;

  const [hourlyRaw, dailyRaw] = await Promise.all([
    kv.get(hourKey),
    kv.get(dayKey),
  ]);

  const hourly = Number(hourlyRaw) || 0;
  const daily  = Number(dailyRaw)  || 0;

  if (hourly >= RATE_LIMIT_HOURLY) {
    const secondsUntilNextHour = 3600 - (Math.floor(now / 1000) % 3600);
    return { limited: true, retryAfter: secondsUntilNextHour, reason: "hourly" };
  }
  if (daily >= RATE_LIMIT_DAILY) {
    const secondsUntilNextDay = 86400 - (Math.floor(now / 1000) % 86400);
    return { limited: true, retryAfter: secondsUntilNextDay, reason: "daily" };
  }

  // Only count against the limit on the first call of each user turn —
  // tool-continuation calls and the final streaming call are not counted.
  if (shouldCount) {
    const hourTtl = 7_200;  // 2h so the key outlives the window boundary
    const dayTtl  = 90_000; // ~25h
    Promise.all([
      kv.put(hourKey, String(hourly + 1), { expirationTtl: hourTtl }),
      kv.put(dayKey,  String(daily  + 1), { expirationTtl: dayTtl  }),
    ]).catch(() => {}); // non-fatal if KV write fails
  }

  return { limited: false };
}

/* ── Token estimation for logging ── */
function estimateTokens(text) {
  if (!text) return 0;
  // Rough approximation: 1 token ≈ 4 characters
  // Add 20% overhead for subword tokenization
  return Math.ceil((text.length / 4) * 1.2);
}

function estimateMessageTokens(messages) {
  let total = 0;
  for (const msg of messages) {
    // Handle Gemini format (parts)
    if (msg.parts) {
      for (const p of msg.parts) {
        if (p.text) total += estimateTokens(p.text);
        if (p.functionCall) {
          total += estimateTokens(p.functionCall.name);
          total += estimateTokens(JSON.stringify(p.functionCall.args || {}));
        }
      }
    }
    // Handle OpenAI format (content)
    else if (msg.content) {
      total += estimateTokens(msg.content);
      if (msg.tool_calls) {
        for (const tc of msg.tool_calls) {
          total += estimateTokens(tc.function?.name || "");
          total += estimateTokens(tc.function?.arguments || "");
        }
      }
    }
  }
  return total;
}

const TOOLS = [
  {
    type: "function",
    function: {
      name: "search_offers",
      description: "Search and filter the full offers database. Use for: all deals at a restaurant, all offers from a bank, day-of-week deals, offers above a discount threshold, or any combination of filters.",
      parameters: {
        type: "object",
        properties: {
          restaurants:      { type: "array",  items: { type: "string" }, description: "Restaurant name(s) — fuzzy match ok." },
          banks:            { type: "array",  items: { type: "string" }, description: "Bank name(s) — partial match ok." },
          cards:            { type: "array",  items: { type: "string" }, description: "Card name(s) — partial match ok." },
          card_types:       { type: "array",  items: { type: "string" }, description: "debit, credit, or other." },
          city:             { type: "string", description: "karachi, lahore, islamabad, or all." },
          days:             { type: "array",  items: { type: "number" }, description: "0=Mon 1=Tue 2=Wed 3=Thu 4=Fri 5=Sat 6=Sun." },
          min_discount_pct: { type: "number", description: "Minimum discount %." },
          sort_by:          { type: "string", description: "discount (default), cap, restaurant, bank." },
          limit:            { type: "number", description: "Max results (default 50)." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "rank_cards",
      description: "Get cards ranked by estimated savings and coverage. Use for: best card overall, best card for specific restaurants, best card for specific days.",
      parameters: {
        type: "object",
        properties: {
          city:        { type: "string", description: "karachi, lahore, islamabad, or all." },
          bill_size:   { type: "number", description: "Typical bill in PKR." },
          card_types:  { type: "array",  items: { type: "string" }, description: "debit, credit, other." },
          restaurants: { type: "array",  items: { type: "string" }, description: "Only rank cards covering ALL of these (AND logic)." },
          days:        { type: "array",  items: { type: "number" }, description: "0=Mon...6=Sun." },
          limit:       { type: "number", description: "Max results (default 15)." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_bank_cards",
      description: "Get all cards and deal stats for one bank or all banks.",
      parameters: {
        type: "object",
        properties: {
          bank: { type: "string", description: "Bank name (partial match ok). Omit for all banks." },
          city: { type: "string", description: "City filter (optional)." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_restaurant_rankings",
      description: "Get restaurants ranked by max discount, deal count, or bank coverage.",
      parameters: {
        type: "object",
        properties: {
          city:       { type: "string", description: "City filter (optional)." },
          card_types: { type: "array",  items: { type: "string" }, description: "Card type filter (optional)." },
          sort_by:    { type: "string", description: "max_discount (default), deal_count, bank_count." },
          limit:      { type: "number", description: "Max results (default 20)." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "compare_cards",
      description: "Head-to-head comparison of 2-4 specific cards.",
      parameters: {
        type: "object",
        properties: {
          cards:     { type: "array", items: { type: "object", properties: { bank: { type: "string" }, card: { type: "string" } } }, description: "Array of {bank, card} pairs." },
          bill_size: { type: "number", description: "Bill size in PKR." },
          city:      { type: "string", description: "City filter (optional)." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_card_requirements",
      description: "Get eligibility requirements and annual fee details for specific cards or the current top recommendations.",
      parameters: {
        type: "object",
        properties: {
          cards: {
            type: "array",
            items: { type: "object", properties: { bank: { type: "string" }, card: { type: "string" } } },
            description: "Array of {bank, card} pairs. Omit to fetch requirements for top ranked cards.",
          },
          limit: { type: "number", description: "If cards are omitted, max top cards to return (default 5)." },
        },
      },
    },
  },
];

export async function onRequestPost(context) {
  const key = (context.env.GEMINI_KEY || "").trim();
  if (!key) {
    return Response.json({ error: "Chat service is not configured." }, { status: 503 });
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  // Rate limiting — check every call, but only count first call of each user turn
  // (one user message triggers up to 4 tool rounds + 1 streaming call)
  const ip = context.request.headers.get("CF-Connecting-IP") || "";
  const rl = await checkRateLimit(context.env.RATE_LIMITS, ip, !!body.firstCall);
  if (rl?.limited) {
    console.log(`[CHAT] Rate limited | IP: ${ip} | reason: ${rl.reason}`);
    return Response.json(
      { error: "Too many requests.", reason: rl.reason },
      {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfter) },
      }
    );
  }

  // Accept both OpenAI-style (messages) and Gemini-style (contents) formats
  const inputMessages = body.messages || body.contents || [];
  const { systemPrompt, stream = true, maxTokens } = body;
  if (!Array.isArray(inputMessages) || !inputMessages.length) {
    return Response.json({ error: "Missing messages or contents." }, { status: 400 });
  }

  const resolvedMaxTokens = Number.isFinite(Number(maxTokens))
    ? Math.max(256, Math.min(8192, Number(maxTokens)))
    : 2000;

  // Token estimation logging
  const systemPromptTokens = estimateTokens(systemPrompt);
  const messagesTokens = estimateMessageTokens(inputMessages);
  const toolDefinitionsTokens = estimateTokens(JSON.stringify(TOOLS));
  const inputTokensEstimate = systemPromptTokens + messagesTokens + toolDefinitionsTokens + 50;
  
  const userQuery = (inputMessages[inputMessages.length - 1]?.content ||
                     inputMessages[inputMessages.length - 1]?.parts?.[0]?.text || "").slice(0, 60);
  console.log(`[CHAT] Query started | User query: "${userQuery}..." | Input tokens (est): ${inputTokensEstimate} | Max output: ${resolvedMaxTokens}`);

  // Convert OpenAI-style messages to Gemini format if needed
  const contents = inputMessages.map((msg) => {
    if (msg.parts) return msg; // Already Gemini format
    
    // Convert OpenAI format to Gemini format
    const parts = [];
    
    // Handle tool results (from user with tool_call_id)
    if (msg.tool_call_id) {
      // This is a tool result response
      try {
        const resultData = typeof msg.content === "string" ? JSON.parse(msg.content) : msg.content;
        parts.push({
          functionResponse: {
            name: msg.name || "unknown",
            response: resultData,
          },
        });
      } catch (e) {
        // If can't parse as JSON, send as text
        parts.push({
          functionResponse: {
            name: msg.name || "unknown",
            response: { text: msg.content || "" },
          },
        });
      }
    }
    // Handle regular text messages
    else if (msg.content) {
      parts.push({ text: msg.content });
    }
    
    // Handle assistant tool calls (convert to function call format)
    if (msg.tool_calls && msg.tool_calls.length > 0) {
      for (const tc of msg.tool_calls) {
        const args = typeof tc.function.arguments === "string" 
          ? JSON.parse(tc.function.arguments)
          : tc.function.arguments;
        parts.push({
          functionCall: {
            name: tc.function.name,
            args,
          },
        });
      }
    }
    
    return {
      role: msg.role === "assistant" ? "model" : "user",
      parts: parts.length > 0 ? parts : [{ text: "" }],
    };
  });

  const endpoint = stream
    ? `${GEMINI_BASE}/${GEMINI_MODEL}:streamGenerateContent?alt=sse&key=${key}`
    : `${GEMINI_BASE}/${GEMINI_MODEL}:generateContent?key=${key}`;

  const startTime = Date.now();
  const geminiResp = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...(systemPrompt && { system_instruction: { parts: [{ text: systemPrompt }] } }),
      ...(TOOLS?.length && { tools: [{ function_declarations: TOOLS.map(t => t.function) }] }),
      contents,
      generationConfig: {
        temperature: 0.35,
        maxOutputTokens: resolvedMaxTokens,
        topP: 0.95,
      },
    }),
  });

  if (!geminiResp.ok) {
    let errMsg = `Gemini error ${geminiResp.status}`;
    try {
      const errBody = await geminiResp.json();
      errMsg = errBody?.error?.message || errMsg;
    } catch { /* ignore */ }
    console.error(`[CHAT] Error: ${errMsg}`);
    return Response.json({ error: errMsg }, { status: geminiResp.status });
  }

  if (stream) {
    // For streaming responses, wrap the body to capture and log completion
    const originalBody = geminiResp.body;
    const reader = originalBody.getReader();
    const outputTokens = [];
    
    const newStream = new ReadableStream({
      async start(controller) {
        try {
          const decoder = new TextDecoder();
          let buffer = "";
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              // Estimate output tokens from streamed content
              const totalOutput = outputTokens.join("").length;
              const outputTokensEstimate = estimateTokens(totalOutput);
              const totalTokens = inputTokensEstimate + outputTokensEstimate;
              console.log(`[CHAT] Query completed | Total tokens (est): ${totalTokens} (input: ${inputTokensEstimate}, output: ${outputTokensEstimate}) | Time: ${Date.now() - startTime}ms`);
              controller.close();
              break;
            }
            
            const text = decoder.decode(value, { stream: true });
            buffer += text;
            
            // Extract content from Gemini's SSE format
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6);
                if (data) {
                  try {
                    const json = JSON.parse(data);
                    const candidates = json?.candidates || [];
                    for (const candidate of candidates) {
                      if (candidate.content?.parts) {
                        for (const part of candidate.content.parts) {
                          if (part.text) outputTokens.push(part.text);
                        }
                      }
                    }
                  } catch { /* ignore */ }
                }
              }
            }
            
            controller.enqueue(value);
          }
        } catch (err) {
          console.error(`[CHAT] Stream error: ${err.message}`);
          controller.error(err);
        }
      },
    });

    return new Response(newStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
        "X-Token-Estimate": JSON.stringify({ input: inputTokensEstimate, output: "streaming", total: "unknown" }),
      },
    });
  }

  const responseData = await geminiResp.json();
  let outputText = "";
  if (responseData?.candidates?.[0]?.content?.parts) {
    outputText = responseData.candidates[0].content.parts
      .map((p) => p.text || "")
      .join("");
  }
  
  const outputTokensEstimate = estimateTokens(outputText);
  const totalTokens = inputTokensEstimate + outputTokensEstimate;
  
  console.log(`[CHAT] Query completed (non-streaming) | Total tokens (est): ${totalTokens} (input: ${inputTokensEstimate}, output: ${outputTokensEstimate}) | Time: ${Date.now() - startTime}ms`);
  
  return Response.json({
    ...responseData,
    _tokenEstimate: { input: inputTokensEstimate, output: outputTokensEstimate, total: totalTokens },
  });
}
