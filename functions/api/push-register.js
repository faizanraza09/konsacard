// POST /api/push-register
//   { token: "ExponentPushToken[...]", favorites: ["California Pizza", ...], deviceId: "uuid" }
// Stores the device's push token + favorited restaurants list in KV so the
// nightly diff worker can fan out new-offer notifications.
//
// KV binding: PUSH_TOKENS (configure in wrangler.toml / Pages settings).
// Key format: tok:<deviceId>  →  JSON { token, favorites, updatedAt }
export const onRequestPost = async ({ request, env }) => {
  if (!env.PUSH_TOKENS) {
    return new Response(JSON.stringify({ error: "KV PUSH_TOKENS not bound" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const { token, favorites, deviceId } = body || {};
  if (typeof token !== "string" || !token.startsWith("ExponentPushToken")) {
    return json({ error: "Invalid Expo push token" }, 400);
  }
  if (!Array.isArray(favorites)) {
    return json({ error: "favorites must be an array" }, 400);
  }
  if (typeof deviceId !== "string" || deviceId.length < 8 || deviceId.length > 128) {
    return json({ error: "deviceId required (UUID-ish)" }, 400);
  }
  const safeFavs = favorites.filter((s) => typeof s === "string").slice(0, 200);
  const value = JSON.stringify({
    token,
    favorites: safeFavs,
    updatedAt: Date.now(),
  });
  await env.PUSH_TOKENS.put(`tok:${deviceId}`, value, { expirationTtl: 60 * 60 * 24 * 90 });
  return json({ ok: true });
};

export const onRequestDelete = async ({ request, env }) => {
  if (!env.PUSH_TOKENS) {
    return json({ error: "KV PUSH_TOKENS not bound" }, 500);
  }
  const url = new URL(request.url);
  const deviceId = url.searchParams.get("deviceId");
  if (!deviceId) return json({ error: "deviceId required" }, 400);
  await env.PUSH_TOKENS.delete(`tok:${deviceId}`);
  return json({ ok: true });
};

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
