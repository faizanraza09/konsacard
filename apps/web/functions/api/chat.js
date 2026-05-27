// DeepSeek V4 Flash via OpenAI-compatible API.
// Frontend already speaks OpenAI message shape (tool_calls / tool_call_id),
// so the worker is now a thin proxy: prepend the system prompt, attach the
// tool catalog, forward to DeepSeek, stream SSE back unchanged.
const DEEPSEEK_MODEL = "deepseek-chat"; // V4 Flash non-thinking — strong tool calling, cheap.
const DEEPSEEK_BASE = "https://api.deepseek.com/v1";

/* ── Rate limiting (token-budgeted) ── */
const HOURLY_TOKEN_BUDGET = 60_000;
const DAILY_TOKEN_BUDGET  = 200_000;
const MIN_TOKENS_PER_TURN = 800;

async function checkRateLimit(kv, ip, tokensThisCall) {
  if (!kv || !ip) return null;

  const now      = Date.now();
  const hourKey  = `rlt:h:${ip}:${Math.floor(now / 3_600_000)}`;
  const dayKey   = `rlt:d:${ip}:${Math.floor(now / 86_400_000)}`;

  const [hourlyRaw, dailyRaw] = await Promise.all([kv.get(hourKey), kv.get(dayKey)]);
  const hourly = Number(hourlyRaw) || 0;
  const daily  = Number(dailyRaw)  || 0;

  if (hourly >= HOURLY_TOKEN_BUDGET) {
    return { limited: true, retryAfter: 3600 - (Math.floor(now / 1000) % 3600), reason: "hourly" };
  }
  if (daily >= DAILY_TOKEN_BUDGET) {
    return { limited: true, retryAfter: 86400 - (Math.floor(now / 1000) % 86400), reason: "daily" };
  }

  const charge = Math.max(MIN_TOKENS_PER_TURN, Math.round(tokensThisCall || 0));
  Promise.all([
    kv.put(hourKey, String(hourly + charge), { expirationTtl: 7_200 }),
    kv.put(dayKey,  String(daily  + charge), { expirationTtl: 90_000 }),
  ]).catch(() => {});

  return {
    limited: false,
    remainingHourly: Math.max(0, HOURLY_TOKEN_BUDGET - hourly - charge),
    remainingDaily:  Math.max(0, DAILY_TOKEN_BUDGET  - daily  - charge),
  };
}

/* ── Token estimation for logging ── */
function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil((text.length / 4) * 1.2);
}

function estimateMessageTokens(messages) {
  let total = 0;
  for (const msg of messages) {
    if (msg.content) total += estimateTokens(msg.content);
    if (msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        total += estimateTokens(tc.function?.name || "");
        total += estimateTokens(tc.function?.arguments || "");
      }
    }
  }
  return total;
}

/* ── Tool catalog (OpenAI shape — DeepSeek accepts it directly) ── */
const TOOLS = [
  {
    type: "function",
    function: {
      name: "search_offers",
      description: "Search and filter the full offers database. Use for: all deals at a restaurant, all offers from a bank, day-of-week deals, offers above a discount threshold, or any combination of filters. Supports pagination via offset.",
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
          limit:            { type: "number", description: "Max results per page (default 20, max 30)." },
          offset:           { type: "number", description: "Skip this many rows before returning. Use with has_more=true to paginate." },
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
          limit:       { type: "number", description: "Max results (default 10, max 20)." },
          offset:      { type: "number", description: "Skip this many cards before returning." },
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
          bank:   { type: "string", description: "Bank name (partial match ok). Omit for all banks." },
          city:   { type: "string", description: "City filter (optional)." },
          limit:  { type: "number", description: "Max banks returned (default 8)." },
          offset: { type: "number", description: "Skip this many banks before returning." },
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
          limit:      { type: "number", description: "Max results (default 15, max 30)." },
          offset:     { type: "number", description: "Skip this many rows before returning." },
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
      description: "Get eligibility requirements and annual fee details for specific cards or the current top recommendations. If the user has shared salary/balance via save_user_profile, eligibility verdicts will reflect them.",
      parameters: {
        type: "object",
        properties: {
          cards: { type: "array", items: { type: "object", properties: { bank: { type: "string" }, card: { type: "string" } } }, description: "Array of {bank, card} pairs. Omit to fetch requirements for top ranked cards." },
          limit: { type: "number", description: "If cards are omitted, max top cards to return (default 5)." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "summarize_offers",
      description: "Aggregate roll-up of the offers database — counts and top distributions, not row-level data. Use for overview/landscape questions: 'how many deals in Karachi?', 'which restaurants have the most offers?', 'how is discount % distributed?'.",
      parameters: {
        type: "object",
        properties: {
          city:       { type: "string", description: "City filter (optional)." },
          card_types: { type: "array",  items: { type: "string" }, description: "debit, credit, other (optional)." },
          banks:      { type: "array",  items: { type: "string" }, description: "Filter to specific banks (optional)." },
          group_by:   { type: "string", description: "Optional top-N grouping: restaurant, bank, card, day, discount_bucket." },
          top_n:      { type: "number", description: "When group_by is set, return top N groups (default 10, max 25)." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_user_context",
      description: "Read the user's current state in the konsacard app: selected city, active UI filters (banks, card types, days, restaurants), cards they own, favorited restaurants, bill size, monthly salary / account balance (if shared). Call this when the user says 'best card for me' or 'show me deals at my favorite places' so recommendations match their actual situation.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "save_user_profile",
      description: "Persist user-supplied profile facts so eligibility and savings are computed against the user's actual situation. Call this when the user mentions their monthly salary, account balance, typical bill size, or how often they eat out. Do NOT call this if the user only mentioned hypothetical numbers ('what if I earn 50k') — only call when they're stating their own facts.",
      parameters: {
        type: "object",
        properties: {
          monthly_salary_pkr:  { type: "number", description: "User's monthly net salary in PKR." },
          account_balance_pkr: { type: "number", description: "User's typical bank balance in PKR." },
          typical_bill_pkr:    { type: "number", description: "User's typical restaurant bill size in PKR." },
          outings_per_week:    { type: "number", description: "How many times the user eats out per week." },
        },
      },
    },
  },
];

export async function onRequestPost(context) {
  // Accept either common env var name so the user doesn't have to think about it.
  const key = (context.env.DEEPSEEK_API_KEY || context.env.DEEPSEEK_KEY || "").trim();
  if (!key) {
    return Response.json({ error: "Chat service is not configured." }, { status: 503 });
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const inputMessages = body.messages || [];
  const { systemPrompt, stream = true, maxTokens, phase } = body;
  if (!Array.isArray(inputMessages) || !inputMessages.length) {
    return Response.json({ error: "Missing messages." }, { status: 400 });
  }

  const resolvedMaxTokens = Number.isFinite(Number(maxTokens))
    ? Math.max(256, Math.min(8192, Number(maxTokens)))
    : 2000;

  // Token estimation
  const systemPromptTokens = estimateTokens(systemPrompt);
  const messagesTokens = estimateMessageTokens(inputMessages);
  const toolDefinitionsTokens = estimateTokens(JSON.stringify(TOOLS));
  const inputTokensEstimate = systemPromptTokens + messagesTokens + toolDefinitionsTokens + 50;

  // Token-budgeted rate limit
  const ip = context.request.headers.get("CF-Connecting-IP") || "";
  const tokenCharge = inputTokensEstimate + Math.floor(resolvedMaxTokens / 2);
  const rl = await checkRateLimit(context.env.RATE_LIMITS, ip, tokenCharge);
  if (rl?.limited) {
    console.log(`[CHAT] Rate limited | IP: ${ip} | reason: ${rl.reason} | charge: ${tokenCharge}`);
    return Response.json(
      { error: "Token budget reached for this window.", reason: rl.reason },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  // Tool turns get colder temperature (more deterministic routing); final answer
  // gets a touch more warmth. Same model, different sampling.
  const resolvedPhase = phase || (stream ? "final" : "tool");
  const temperature = resolvedPhase === "tool" ? 0.1 : 0.5;

  const userQuery = (inputMessages[inputMessages.length - 1]?.content || "").slice(0, 60);
  console.log(`[CHAT] Query | phase: ${resolvedPhase} | temp: ${temperature} | query: "${userQuery}..." | inTokens: ${inputTokensEstimate} | maxOut: ${resolvedMaxTokens}`);

  // Build OpenAI-format messages: prepend system prompt, leave the rest as-is.
  // The frontend already sends role/content/tool_calls/tool_call_id in OpenAI shape.
  const messages = systemPrompt
    ? [{ role: "system", content: systemPrompt }, ...inputMessages]
    : inputMessages;

  const startTime = Date.now();
  const upstream = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages,
      tools: TOOLS,
      tool_choice: "auto",
      temperature,
      max_tokens: resolvedMaxTokens,
      top_p: 0.95,
      stream,
    }),
  });

  if (!upstream.ok) {
    let errMsg = `AI service error ${upstream.status}`;
    try {
      const errBody = await upstream.json();
      errMsg = errBody?.error?.message || errBody?.message || errMsg;
    } catch { /* ignore */ }
    console.error(`[CHAT] Error: ${errMsg}`);
    return Response.json({ error: errMsg }, { status: upstream.status });
  }

  if (stream) {
    // Pass through the SSE stream unmodified — DeepSeek emits OpenAI-format
    // SSE which the frontend already knows how to parse.
    const reader = upstream.body.getReader();
    const outputChunks = [];

    const newStream = new ReadableStream({
      async start(controller) {
        try {
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              const totalOutput = outputChunks.join("").length;
              const outputTokensEstimate = estimateTokens(totalOutput);
              console.log(`[CHAT] Done | tokens in/out: ${inputTokensEstimate}/${outputTokensEstimate} | ${Date.now() - startTime}ms`);
              controller.close();
              break;
            }

            const text = decoder.decode(value, { stream: true });
            buffer += text;

            // Scrape content for token logging — don't modify the stream.
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6).trim();
              if (!data || data === "[DONE]") continue;
              try {
                const json = JSON.parse(data);
                const c = json?.choices?.[0]?.delta?.content;
                if (c) outputChunks.push(c);
              } catch { /* ignore */ }
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
        "X-Rate-Hourly-Remaining": String(rl?.remainingHourly ?? ""),
        "X-Rate-Daily-Remaining":  String(rl?.remainingDaily ?? ""),
      },
    });
  }

  const responseData = await upstream.json();
  const outputText = responseData?.choices?.[0]?.message?.content || "";
  const outputTokensEstimate = estimateTokens(outputText);

  console.log(`[CHAT] Done (non-stream) | tokens in/out: ${inputTokensEstimate}/${outputTokensEstimate} | ${Date.now() - startTime}ms`);

  // Pass through the OpenAI-shape response unchanged — frontend already
  // reads choices[0].message.tool_calls / .content. We intentionally omit
  // any vendor/model identifier so the client never sees who's upstream.
  return Response.json(responseData);
}
