// Abuse + spend guard for /api/chat. Pure functions (the KV handle is passed
// in) so the limits can be unit-tested without a Workers runtime.
//
// Failure policy: if the KV namespace is missing or errors, the guard FAILS
// CLOSED. The old limiter silently skipped itself when RATE_LIMITS was unbound,
// which left the endpoint (and the DeepSeek bill) completely unprotected.
//
// KV is not atomic, so concurrent requests can overshoot a counter slightly.
// Spend is reserved *before* the upstream call to keep that overshoot to a few
// requests' worth, which is why the monthly cap sits well under real exposure.

export const LIMITS = {
  // Per-IP request counts.
  perMinute: 6,
  perHour: 30,
  perDay: 80,
  // Per-IP estimated tokens (input + half of max output, same as before).
  tokensPerHour: 30_000,
  tokensPerDay: 80_000,
  // Global spend caps in USD. Chat is switched off for everyone when hit.
  monthlyBudgetUsd: 1.0,
  dailyBudgetUsd: 0.1,
  // Request shape.
  maxBodyBytes: 100_000,
  maxMessages: 24,
  maxSystemPromptChars: 16_000,
  maxOutputTokens: 1_600,
  minOutputTokens: 256,
  minTokensPerTurn: 800,
};

// Conservative upper-bound prices in USD per 1M tokens. Raise these if
// DeepSeek raises its rates; the cap then trips earlier, never later.
export const PRICE_PER_M_TOKENS = { input: 0.3, output: 1.2 };

const ALLOWED_ROLES = new Set(["user", "assistant", "tool"]);
const ALLOWED_HOSTS = new Set([
  "konsacard.pk",
  "www.konsacard.pk",
  "dev.konsacard.pk",
  "card-match-pk.pages.dev",
  "localhost",
  "127.0.0.1",
]);

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

/** Cost in micro-USD (integer). $1/M tokens == 1 micro-USD per token. */
export function estimateCostMicros(inputTokens, outputTokens) {
  return Math.ceil(
    Math.max(0, inputTokens) * PRICE_PER_M_TOKENS.input +
      Math.max(0, outputTokens) * PRICE_PER_M_TOKENS.output
  );
}

export function monthKey(now) {
  const d = new Date(now);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function secondsToNextMonth(now) {
  const d = new Date(now);
  const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
  return Math.max(1, Math.ceil((next - now) / 1000));
}

function secondsToBucketEnd(now, size) {
  return Math.max(1, Math.ceil((size - (now % size)) / 1000));
}

/** Browsers always send Origin on a cross-site POST. Native apps send none. */
export function originAllowed(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return true;
  let host;
  try {
    host = new URL(origin).hostname;
  } catch {
    return false;
  }
  return ALLOWED_HOSTS.has(host) || host.endsWith(".card-match-pk.pages.dev");
}

export function clampMaxTokens(raw, fallback = 1_000) {
  const n = Number(raw);
  const v = Number.isFinite(n) ? n : fallback;
  return Math.max(LIMITS.minOutputTokens, Math.min(LIMITS.maxOutputTokens, Math.round(v)));
}

/** Returns an error descriptor, or null when the body is acceptable. */
export function validateChatBody(body) {
  if (!body || typeof body !== "object") {
    return { status: 400, code: "invalid_body", error: "Invalid request body." };
  }
  const { messages, systemPrompt } = body;
  if (!Array.isArray(messages) || !messages.length) {
    return { status: 400, code: "missing_messages", error: "Missing messages." };
  }
  if (messages.length > LIMITS.maxMessages) {
    return { status: 400, code: "too_many_messages", error: "Conversation is too long." };
  }
  if (systemPrompt != null && (typeof systemPrompt !== "string" || systemPrompt.length > LIMITS.maxSystemPromptChars)) {
    return { status: 400, code: "invalid_system_prompt", error: "Invalid request body." };
  }
  for (const m of messages) {
    if (!m || typeof m !== "object" || !ALLOWED_ROLES.has(m.role)) {
      return { status: 400, code: "invalid_role", error: "Invalid request body." };
    }
  }
  return null;
}

async function incrementAll(kv, writes) {
  await Promise.all(writes.map(([key, value, ttl]) => kv.put(key, String(value), { expirationTtl: ttl })));
}

/**
 * Check every limit, then reserve this call's usage.
 *
 * @returns {Promise<{ok: true, remaining: object} | {ok: false, status: number, code: string, reason: string, error: string, hint: string, retryAfter: number}>}
 */
export async function guardChatRequest({ kv, ip, now = Date.now(), tokens, costMicros }) {
  if (!kv) return unavailable("unconfigured");

  const who = ip || "unknown";
  const m = Math.floor(now / MINUTE);
  const h = Math.floor(now / HOUR);
  const d = Math.floor(now / DAY);
  const mo = monthKey(now);

  const keys = {
    reqMin: `rl:rm:${who}:${m}`,
    reqHour: `rl:rh:${who}:${h}`,
    reqDay: `rl:rd:${who}:${d}`,
    tokHour: `rl:th:${who}:${h}`,
    tokDay: `rl:td:${who}:${d}`,
    spendDay: `spend:d:${d}`,
    spendMonth: `spend:m:${mo}`,
  };

  let v;
  try {
    const names = Object.keys(keys);
    const raw = await Promise.all(names.map((n) => kv.get(keys[n])));
    v = Object.fromEntries(names.map((n, i) => [n, Number(raw[i]) || 0]));
  } catch {
    return unavailable("kv_error");
  }

  const monthCap = Math.round(LIMITS.monthlyBudgetUsd * 1e6);
  const dayCap = Math.round(LIMITS.dailyBudgetUsd * 1e6);

  if (v.spendMonth + costMicros > monthCap) {
    return budget("monthly", secondsToNextMonth(now));
  }
  if (v.spendDay + costMicros > dayCap) {
    return budget("daily", secondsToBucketEnd(now, DAY));
  }
  if (v.reqMin >= LIMITS.perMinute) return limited("minute", secondsToBucketEnd(now, MINUTE));
  if (v.reqHour >= LIMITS.perHour || v.tokHour >= LIMITS.tokensPerHour) {
    return limited("hourly", secondsToBucketEnd(now, HOUR));
  }
  if (v.reqDay >= LIMITS.perDay || v.tokDay >= LIMITS.tokensPerDay) {
    return limited("daily", secondsToBucketEnd(now, DAY));
  }

  const charge = Math.max(LIMITS.minTokensPerTurn, Math.round(tokens || 0));
  try {
    await incrementAll(kv, [
      [keys.reqMin, v.reqMin + 1, 120],
      [keys.reqHour, v.reqHour + 1, 7_200],
      [keys.reqDay, v.reqDay + 1, 90_000],
      [keys.tokHour, v.tokHour + charge, 7_200],
      [keys.tokDay, v.tokDay + charge, 90_000],
      [keys.spendDay, v.spendDay + costMicros, 90_000],
      [keys.spendMonth, v.spendMonth + costMicros, 3_000_000],
    ]);
  } catch {
    return unavailable("kv_error");
  }

  return {
    ok: true,
    remaining: {
      requestsPerMinute: Math.max(0, LIMITS.perMinute - v.reqMin - 1),
      requestsPerDay: Math.max(0, LIMITS.perDay - v.reqDay - 1),
      tokensPerHour: Math.max(0, LIMITS.tokensPerHour - v.tokHour - charge),
      tokensPerDay: Math.max(0, LIMITS.tokensPerDay - v.tokDay - charge),
      monthlyBudgetMicros: Math.max(0, monthCap - v.spendMonth - costMicros),
    },
  };
}

function limited(reason, retryAfter) {
  return {
    ok: false,
    status: 429,
    code: "rate_limited",
    reason,
    error: "Token budget reached for this window.",
    hint: `Retry after ${retryAfter} seconds.`,
    retryAfter,
  };
}

function budget(scope, retryAfter) {
  return {
    ok: false,
    status: 503,
    code: "budget_exhausted",
    reason: "budget",
    scope,
    error: "Chat is paused: the usage budget has been reached.",
    hint: scope === "monthly" ? "Chat resumes at the start of next month (UTC)." : "Chat resumes tomorrow (UTC).",
    retryAfter,
  };
}

function unavailable(why) {
  return {
    ok: false,
    status: 503,
    code: "chat_unavailable",
    reason: why,
    error: "Chat service is temporarily unavailable.",
    hint: "Try again later.",
    retryAfter: 300,
  };
}
