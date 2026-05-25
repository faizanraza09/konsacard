// Cron-style HTTP handler (call from Cloudflare Workers Cron Triggers via a tiny
// Worker, or hit manually). Diffs the latest offers.json against the previous
// snapshot stored in KV; for each restaurant with new offers, fans out a push
// to all device tokens that favorited that restaurant.
//
// KV bindings:
//   PUSH_TOKENS    (per-device tokens + favorites list)
//   PUSH_SNAPSHOTS (last seen "${city}|||${restaurant}" → "bank||card" list)
//
// Authentication: set CRON_SECRET env var; caller must send ?key=<secret>.
export const onRequestGet = async ({ request, env }) => {
  if (!env.PUSH_TOKENS || !env.PUSH_SNAPSHOTS) {
    return json({ error: "KV bindings missing" }, 500);
  }
  const url = new URL(request.url);
  if (env.CRON_SECRET && url.searchParams.get("key") !== env.CRON_SECRET) {
    return json({ error: "Unauthorized" }, 401);
  }

  const indexUrl = `${url.origin}/data/offers-index.json`;
  const idx = await fetch(indexUrl).then((r) => r.json());

  const offers = [];
  for (const city of idx.cities) {
    const rel = idx.cityFiles[city];
    if (!rel) continue;
    const url2 = `${url.origin}${rel.replace(/^\.\//, "/")}`;
    try {
      const f = await fetch(url2).then((r) => r.json());
      offers.push(...(f.offers || []));
    } catch (e) {
      console.warn("cron: failed to load", url2, e);
    }
  }

  // Current snapshot: restaurant → sorted "bank||card" list
  const current = new Map();
  offers.forEach((o) => {
    const key = `${o.city}|||${o.restaurant}`;
    if (!current.has(key)) current.set(key, new Set());
    current.get(key).add(`${o.bank}||${o.card}`);
  });

  // Previous
  const newByRestaurant = new Map(); // restaurant → string[] of newly-added "bank||card"
  for (const [rk, set] of current.entries()) {
    const prevRaw = await env.PUSH_SNAPSHOTS.get(`snap:${rk}`);
    const prev = new Set(prevRaw ? JSON.parse(prevRaw) : []);
    const newOnes = Array.from(set).filter((k) => !prev.has(k));
    if (newOnes.length > 0) {
      const [, restaurant] = rk.split("|||");
      newByRestaurant.set(restaurant, newOnes);
    }
    // write new snapshot regardless
    await env.PUSH_SNAPSHOTS.put(`snap:${rk}`, JSON.stringify(Array.from(set)));
  }

  if (newByRestaurant.size === 0) {
    return json({ ok: true, newRestaurants: 0, sent: 0 });
  }

  // Iterate device tokens via KV list
  const messages = [];
  let cursor;
  do {
    const page = await env.PUSH_TOKENS.list({ prefix: "tok:", cursor });
    cursor = page.cursor;
    for (const k of page.keys) {
      const raw = await env.PUSH_TOKENS.get(k.name);
      if (!raw) continue;
      const { token, favorites } = JSON.parse(raw);
      const hits = (favorites || []).filter((r) => newByRestaurant.has(r));
      if (hits.length === 0) continue;
      const name = hits[0];
      const more = hits.length > 1 ? ` + ${hits.length - 1} more` : "";
      const newCount = (newByRestaurant.get(name) || []).length;
      messages.push({
        to: token,
        title: "New deals at your favourite",
        body: `${newCount} new offer${newCount === 1 ? "" : "s"} at ${name}${more}.`,
        data: { kind: "new-offers", restaurants: hits },
      });
    }
    if (!page.list_complete) cursor = page.cursor;
    else cursor = undefined;
  } while (cursor);

  // Send to Expo Push API in batches of 100
  const sent = [];
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(batch),
    });
    sent.push(await res.json());
  }

  return json({ ok: true, newRestaurants: newByRestaurant.size, sent: messages.length, expoResponses: sent });
};

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
