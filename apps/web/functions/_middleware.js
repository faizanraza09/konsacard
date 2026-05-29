// Pages Function: server-side render the homepage's ranked-cards content
// into the static index.html shell so that crawlers and LLMs that don't
// execute JavaScript see real card data, not just the SPA shell.
//
// Why this exists
// ───────────────
// The interactive app at / is JS-rendered: state.js loads offers.json, then
// app.js + algorithms.js compute and display rankings client-side. Most LLM
// crawlers don't execute JS, so without SSR they'd see only the static
// shell — fine for nav + a static <noscript> block but useless for queries
// like "best card for Karachi restaurant discounts". This function fills
// that gap.
//
// What it injects
// ───────────────
// 1. A <noscript> block holding the top-N ranked cards for the request's
//    (city, bill) parameters. Hidden from JS-enabled browsers (browsers
//    strip <noscript> when scripting is on), visible to non-JS crawlers.
// 2. A <script type="application/ld+json"> ItemList schema with the same
//    ranking. Read by LLMs and rich-result search engines regardless of
//    rendering capability.
//
// The interactive JS app is unchanged — it ignores the SSR <noscript> and
// renders into the existing UI shell as before.
//
// Caching
// ───────
// Each (city, bill) tuple is deterministic given the current offers.json.
// We cache the response on the Cloudflare edge by URL for 5 minutes, which
// keeps things fresh through daily-refresh commits (the URL doesn't change
// but the underlying offers.json does after a deploy).

const SSR_MARKER = "<!-- SSR_RANKINGS_INJECT_HERE -->";
const SCHEMA_MARKER = "<!-- SSR_SCHEMA_INJECT_HERE -->";
const SITE_URL = "https://konsacard.pk";
const DEFAULT_BILL = 10000;

const ALLOWED_CITY_KEYS = new Set(["all", "karachi", "lahore", "islamabad"]);

function pickCityKey(raw) {
  const key = String(raw || "all").toLowerCase().trim();
  return ALLOWED_CITY_KEYS.has(key) ? key : "all";
}

function parseBill(raw) {
  const n = Number.parseInt(String(raw || ""), 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_BILL;
  return Math.min(50000, Math.max(1000, n));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatCurrency(value) {
  if (!Number.isFinite(value)) return "—";
  return `PKR ${Math.round(value).toLocaleString("en-PK")}`;
}

function cityLabel(cityKey) {
  switch (cityKey) {
    case "karachi":
      return "Karachi";
    case "lahore":
      return "Lahore";
    case "islamabad":
      return "Islamabad";
    default:
      return "Pakistan";
  }
}

function buildRankingHtml({ ranked, cityKey, orderValue }) {
  if (!ranked.length) return "";
  const heading = cityKey === "all"
    ? `Top restaurant discount cards in Pakistan (typical ${formatCurrency(orderValue)} bill)`
    : `Top restaurant discount cards in ${cityLabel(cityKey)} (typical ${formatCurrency(orderValue)} bill)`;
  const items = ranked
    .map((c, i) => {
      const url = `/banks/${c.bankSlug}/${c.cardSlug}/`;
      const coveragePct = (c.coverage * 100).toFixed(0);
      const saving = formatCurrency(c.avgExpectedSaving);
      const discount = Number.isFinite(c.averageDiscount)
        ? `${c.averageDiscount.toFixed(0)}% headline`
        : "";
      const cap = Number.isFinite(c.medianCap) ? `cap ${formatCurrency(c.medianCap)}` : "";
      const extras = [discount, cap].filter(Boolean).join(" · ");
      return `      <li>
        <a href="${url}"><strong>${escapeHtml(c.bank)}</strong> — ${escapeHtml(c.card)}</a>
        <div>Est. ${saving} saving per outing · covers ${coveragePct}% of restaurants${extras ? " · " + escapeHtml(extras) : ""}</div>
      </li>`;
    })
    .join("\n");
  return `
    <noscript>
      <h2>${escapeHtml(heading)}</h2>
      <p>
        Ranked by KonsaCard's comparison algorithm against ${ranked[0].totalVenueCount}
        partner restaurants${cityKey !== "all" ? ` in ${cityLabel(cityKey)}` : ""}.
        Open the interactive tool with JavaScript enabled to refine the ranking for
        your specific bill, owned cards, dining habits, and bank preferences.
      </p>
      <ol>
${items}
      </ol>
    </noscript>`;
}

function buildItemListSchema({ ranked, cityKey, orderValue, requestUrl }) {
  if (!ranked.length) return "";
  const scope = cityKey === "all" ? "Pakistan" : cityLabel(cityKey);
  const schema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Top restaurant discount cards in ${scope}`,
    description: `Top ${ranked.length} cards by estimated per-outing saving at a typical ${formatCurrency(orderValue)} bill. Ranked across active dining offers from ${ranked[0].totalVenueCount} restaurants${cityKey !== "all" ? ` in ${scope}` : ""}.`,
    url: requestUrl,
    numberOfItems: ranked.length,
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    itemListElement: ranked.map((c, i) => {
      const cardType = (c.cardCategory || "").toLowerCase() === "credit"
        ? "CreditCard"
        : "PaymentCard";
      return {
        "@type": "ListItem",
        position: i + 1,
        url: `${SITE_URL}/banks/${c.bankSlug}/${c.cardSlug}/`,
        item: {
          "@type": cardType,
          name: c.card,
          url: `${SITE_URL}/banks/${c.bankSlug}/${c.cardSlug}/`,
          issuer: {
            "@type": "Organization",
            name: c.bank,
            url: `${SITE_URL}/banks/${c.bankSlug}/`,
          },
        },
      };
    }),
  };
  return `\n    <script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n    </script>`;
}

async function fetchAsset(env, url, path) {
  // Pages Functions get an ASSETS binding by default. ASSETS.fetch needs a
  // Request whose URL points at the static asset path. Origin doesn't matter
  // (the binding ignores it) but we reuse the inbound URL for safety.
  const target = new URL(path, url);
  const res = await env.ASSETS.fetch(new Request(target.toString()));
  if (!res.ok) {
    throw new Error(`ASSETS.fetch ${path} → ${res.status}`);
  }
  return res;
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  // Only intercept the bare homepage. Bank/restaurant pages have their own
  // generated static HTML and shouldn't pass through this function.
  if (url.pathname !== "/" && url.pathname !== "") {
    return next();
  }

  // Non-GET (HEAD, OPTIONS, etc.) → just serve the static asset.
  if (request.method !== "GET") {
    return next();
  }

  try {
    const cityKey = pickCityKey(url.searchParams.get("city"));

    // The precomputed summary holds rankings at the DEFAULT bill only. For a
    // custom ?bill= we can't render a correct ranking, so fall back to the
    // static page (crawlers hit the bare "/" with no bill).
    const requestedBill = url.searchParams.get("bill");
    if (requestedBill && parseBill(requestedBill) !== DEFAULT_BILL) {
      return next();
    }

    // Load the precomputed ranking summary + the static index.html in parallel.
    // summary.scopes[city] is the same per-scope ranking the browser renders
    // (both built from the shared ranking-core), so SSR matches the live page —
    // and it's tiny, unlike the multi-MB offers.json the old path fetched (which
    // the production deploy strips anyway, leaving SSR broken).
    const [summaryRes, htmlRes] = await Promise.all([
      fetchAsset(env, url, "/data/summary.json"),
      fetchAsset(env, url, "/index.html"),
    ]);

    const summary = await summaryRes.json();
    const baseHtml = await htmlRes.text();
    const orderValue = Number.isFinite(summary.orderValue) ? summary.orderValue : DEFAULT_BILL;
    const ranked = (summary.scopes?.[cityKey] || []).slice(0, 10);

    const ssrHtml = buildRankingHtml({ ranked, cityKey, orderValue });
    const schemaHtml = buildItemListSchema({
      ranked,
      cityKey,
      orderValue,
      requestUrl: url.toString(),
    });

    let mutated = baseHtml;
    if (mutated.includes(SSR_MARKER)) {
      mutated = mutated.replace(SSR_MARKER, ssrHtml);
    }
    if (mutated.includes(SCHEMA_MARKER)) {
      mutated = mutated.replace(SCHEMA_MARKER, schemaHtml);
    }

    return new Response(mutated, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        // Short edge cache so daily-refresh commits propagate quickly. Cache
        // varies on URL (including query string) so each (city, bill) combo
        // gets its own cached entry.
        "cache-control": "public, max-age=300, s-maxage=300",
      },
    });
  } catch (err) {
    // Graceful fallback: if anything goes wrong, serve the unmodified
    // static index.html. The JS app still works for users; we just miss
    // SSR for this request.
    console.error("[ssr-index] fallback to static:", err && err.message);
    return next();
  }
}
