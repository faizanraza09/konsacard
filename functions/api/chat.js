const GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_BASE  = "https://api.groq.com/openai/v1";

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
    if (msg.content) total += estimateTokens(msg.content);
    if (msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        total += estimateTokens(tc.function.name);
        total += estimateTokens(tc.function.arguments);
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
  const key = (context.env.GROQ_KEY || "").trim();
  if (!key) {
    return Response.json({ error: "Chat service is not configured." }, { status: 503 });
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { messages, systemPrompt, stream = true, maxTokens } = body;
  if (!Array.isArray(messages) || !messages.length) {
    return Response.json({ error: "Missing messages." }, { status: 400 });
  }
  const resolvedMaxTokens = Number.isFinite(Number(maxTokens))
    ? Math.max(256, Math.min(2048, Number(maxTokens)))
    : 1200;

  // Token estimation logging
  const systemPromptTokens = estimateTokens(systemPrompt);
  const messagesTokens = estimateMessageTokens(messages);
  const toolDefinitionsTokens = estimateTokens(JSON.stringify(TOOLS));
  const inputTokensEstimate = systemPromptTokens + messagesTokens + toolDefinitionsTokens + 50; // 50 for overhead
  
  console.log(`[CHAT] Query started | User query: "${messages[messages.length - 1]?.content?.slice(0, 60)}..." | Input tokens (est): ${inputTokensEstimate} | Max output: ${resolvedMaxTokens}`);

  const fullMessages = [
    ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
    ...messages,
  ];

  const startTime = Date.now();
  const groqResp = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: fullMessages,
      tools: TOOLS,
      tool_choice: "auto",
      temperature: 0.35,
      max_tokens: resolvedMaxTokens,
      stream,
    }),
  });

  if (!groqResp.ok) {
    let errMsg = `Groq error ${groqResp.status}`;
    try {
      const errBody = await groqResp.json();
      errMsg = errBody?.error?.message || errMsg;
    } catch { /* ignore */ }
    console.error(`[CHAT] Error: ${errMsg}`);
    return Response.json({ error: errMsg }, { status: groqResp.status });
  }

  if (stream) {
    // For streaming responses, wrap the body to capture and log completion
    const originalBody = groqResp.body;
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
            
            // Extract content from SSE format
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6);
                if (data && data !== "[DONE]") {
                  try {
                    const json = JSON.parse(data);
                    const content = json?.choices?.[0]?.delta?.content;
                    if (content) outputTokens.push(content);
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

  const responseBody = await groqResp.json();
  const outputText = responseBody?.choices?.[0]?.message?.content || "";
  const outputTokensEstimate = estimateTokens(outputText);
  const totalTokens = inputTokensEstimate + outputTokensEstimate;
  
  console.log(`[CHAT] Query completed (non-streaming) | Total tokens (est): ${totalTokens} (input: ${inputTokensEstimate}, output: ${outputTokensEstimate}) | Time: ${Date.now() - startTime}ms`);
  
  return Response.json({
    ...responseBody,
    _tokenEstimate: { input: inputTokensEstimate, output: outputTokensEstimate, total: totalTokens },
  });
}
