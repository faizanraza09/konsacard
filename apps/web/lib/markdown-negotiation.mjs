// Markdown content negotiation for the homepage (https://acceptmarkdown.com).
//
// A request with `Accept: text/markdown` gets a Markdown rendition of the page
// at the SAME URL, with `Content-Type: text/markdown` and `Vary: Accept`.
// `Accept: text/html` (and `*/*`, and no Accept at all) keeps getting HTML.
// Pure functions so they can be unit-tested without a Workers runtime.

const SITE_URL = "https://konsacard.pk";

/**
 * Quality value the Accept header assigns to `type`, using the most specific
 * matching range (exact type, then the type wildcard, then the full wildcard).
 * Returns { q, explicit, index }.
 */
function matchQuality(ranges, type) {
  const [major] = type.split("/");
  let best = { q: 0, specificity: -1, index: Infinity };
  ranges.forEach((r, index) => {
    let specificity = -1;
    if (r.type === type) specificity = 2;
    else if (r.type === `${major}/*`) specificity = 1;
    else if (r.type === "*/*") specificity = 0;
    if (specificity > best.specificity) best = { q: r.q, specificity, index };
  });
  return { q: best.q, explicit: best.specificity === 2, index: best.index };
}

function parseAccept(header) {
  return String(header || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [type, ...params] = part.split(";").map((s) => s.trim());
      let q = 1;
      for (const p of params) {
        const m = /^q\s*=\s*([0-9.]+)$/i.exec(p);
        if (m) {
          const n = Number(m[1]);
          if (Number.isFinite(n)) q = Math.min(1, Math.max(0, n));
        }
      }
      return { type: type.toLowerCase(), q };
    });
}

/**
 * True when the client prefers Markdown over HTML. Markdown must be acceptable
 * (q > 0) and strictly preferred; on an exact tie it wins only when the client
 * names it explicitly and lists it before text/html. Plain browsers send
 * text/html plus a full wildcard, so they always get HTML.
 */
export function prefersMarkdown(acceptHeader) {
  const ranges = parseAccept(acceptHeader);
  if (!ranges.length) return false;
  const md = matchQuality(ranges, "text/markdown");
  if (md.q <= 0) return false;
  const html = matchQuality(ranges, "text/html");
  if (md.q !== html.q) return md.q > html.q;
  return md.explicit && html.explicit && md.index < html.index;
}

/** Append `Accept` to Vary on any Response, keeping everything else intact. */
export function withVaryAccept(res) {
  const headers = new Headers(res.headers);
  const existing = headers.get("Vary");
  if (!existing) headers.set("Vary", "Accept");
  else if (!/(^|,)\s*(accept|\*)\s*(,|$)/i.test(existing)) headers.set("Vary", `${existing}, Accept`);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

export function markdownResponse(markdown) {
  return new Response(markdown, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      Vary: "Accept",
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function pkr(value) {
  return Number.isFinite(value) ? `PKR ${Math.round(value).toLocaleString("en-PK")}` : "n/a";
}

const KEY_PAGES = `## Key pages

- [About KonsaCard](${SITE_URL}/about/): who runs the site and why it exists
- [Methodology](${SITE_URL}/methodology/): data sources and how the Fit Score is computed
- [How discount caps work](${SITE_URL}/how-discount-caps-work/)
- [How card tiers affect discounts](${SITE_URL}/how-card-tiers-affect-discounts/)
- [Contact](${SITE_URL}/contact/): report a wrong offer or suggest a missing restaurant or card
- [Privacy Policy](${SITE_URL}/privacy-policy/)
- [Terms](${SITE_URL}/terms/)
- [Sitemap](${SITE_URL}/sitemap.xml): every bank, restaurant and content page
- [llms.txt](${SITE_URL}/llms.txt): site summary and when to use it, for AI agents`;

/**
 * Markdown rendition of the homepage. `ranked` is the precomputed ranking for
 * the chosen scope (may be empty if the data couldn't be loaded, in which case
 * the static sections still make the body useful).
 */
export function buildHomepageMarkdown({ ranked = [], scopeLabel = "Pakistan", orderValue } = {}) {
  const lines = [
    "# KonsaCard: restaurant discount cards in Pakistan",
    "",
    "> Independent comparison tool that ranks Pakistani credit cards, debit cards and wallets by the restaurant discounts they actually give you, based on the restaurants you eat at, your city and the cards you already own. Not sponsored by any bank.",
    "",
    "KonsaCard covers 21 Pakistani banks and 1,250+ restaurants across Karachi, Lahore and Islamabad. The interactive tool at https://konsacard.pk/ computes a Fit Score from each card's discount rate, monthly cap, minimum spend, weekday and weekend rules, and tier requirements. Confirm current terms with the bank before applying.",
    "",
  ];

  if (ranked.length) {
    lines.push(
      `## Top restaurant discount cards in ${scopeLabel}`,
      "",
      `Ranked by estimated saving per outing at a typical ${pkr(orderValue)} bill.`,
      ""
    );
    ranked.forEach((c, i) => {
      const url = `${SITE_URL}/banks/${c.bankSlug}/${c.cardSlug}/`;
      const parts = [`est. ${pkr(c.avgExpectedSaving)} saving per outing`];
      if (Number.isFinite(c.coverage)) parts.push(`covers ${(c.coverage * 100).toFixed(0)}% of restaurants`);
      if (Number.isFinite(c.averageDiscount)) parts.push(`${c.averageDiscount.toFixed(0)}% headline discount`);
      if (Number.isFinite(c.medianCap)) parts.push(`cap ${pkr(c.medianCap)}`);
      lines.push(`${i + 1}. [${c.bank}: ${c.card}](${url}) (${parts.join("; ")})`);
    });
    lines.push("");
  }

  lines.push(
    "## How to use it",
    "",
    "1. Open https://konsacard.pk/ and pick a city (Karachi, Lahore, Islamabad or all).",
    "2. Add the restaurants you eat at and set a typical bill size.",
    "3. Optionally mark the cards you already own.",
    "4. Read the ranked cards and open a card page for requirements, fees and per-restaurant deals.",
    "",
    KEY_PAGES,
    ""
  );
  return lines.join("\n");
}
