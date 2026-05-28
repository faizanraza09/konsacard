// Server-side ranking core used by the Pages Function at functions/index.js.
//
// Produces a top-N list of cards for the given filter settings, using the
// same offer-saving math as the browser app in assets/algorithms.js but a
// simplified scoring function (no eligibility input, no fee penalty, no
// qualification delta). That's deliberate: SSR runs without per-user inputs
// like salary or owned cards, so a "good cards for typical user" list is
// what we can honestly produce. The interactive app on the client computes
// the full Fit Score for the actual user once it hydrates.
//
// Inputs are read off a parsed-query-string settings object so this stays a
// pure function — no fetch, no globals — and the Pages Function takes care
// of I/O.

/**
 * Money saved on a single offer at this order value. Mirrors
 * getOfferSavingValue in assets/algorithms.js so SSR uses the same math.
 * @param {Record<string, unknown>} offer
 * @param {number} orderValue
 */
export function getOfferSavingValue(offer, orderValue) {
  const discountType = /** @type {string} */ (offer.discountType) || "percentage";
  const discountPct = getOfferDiscountPct(offer);
  const fixedRaw = /** @type {number|null} */ (offer.fixedDiscountPkr);
  const fixedDiscountPkr = Number.isFinite(fixedRaw) ? Number(fixedRaw) : null;
  const capRaw = /** @type {number|null} */ (offer.capPkr);
  const capPkr = Number.isFinite(capRaw) ? Number(capRaw) : null;

  switch (discountType) {
    case "fixed":
      if (fixedDiscountPkr !== null && fixedDiscountPkr > 0) {
        return Math.min(fixedDiscountPkr, orderValue);
      }
      return null;
    case "up_to":
      if (Number.isFinite(discountPct) && discountPct > 0) {
        const pctSaving = (orderValue * discountPct * 0.6) / 100;
        return Math.min(pctSaving, capPkr ?? Number.POSITIVE_INFINITY);
      }
      return null;
    case "bogo":
      if (Number.isFinite(discountPct) && discountPct > 0) {
        const pctSaving = (orderValue * discountPct * 0.3) / 100;
        return Math.min(pctSaving, capPkr ?? Number.POSITIVE_INFINITY);
      }
      return null;
    case "percentage":
    default:
      if (Number.isFinite(discountPct) && discountPct > 0) {
        return Math.min(
          (orderValue * discountPct) / 100,
          fixedDiscountPkr ?? capPkr ?? Number.POSITIVE_INFINITY,
        );
      }
      if (fixedDiscountPkr !== null && fixedDiscountPkr > 0) {
        return Math.min(fixedDiscountPkr, orderValue);
      }
      return null;
  }
}

/**
 * @param {Record<string, unknown>} offer
 */
export function getOfferDiscountPct(offer) {
  const direct = /** @type {number} */ (offer.discountPct);
  if (Number.isFinite(direct)) return Number(direct);
  const text = `${offer.discountLabel || ""} ${offer.offerTitle || ""}`;
  const matches = text.match(/(\d+(?:\.\d+)?)\s*%/g) || [];
  if (!matches.length) return null;
  return Math.max(...matches.map((m) => Number.parseFloat(m)));
}

const CITY_ALIASES = {
  all: null,
  karachi: "Karachi",
  lahore: "Lahore",
  islamabad: "Islamabad",
};

/**
 * Normalize a city query string (case-insensitive, mapped to canonical name).
 * Returns null if the user wants "all" cities (no filter).
 * @param {string | null | undefined} cityRaw
 */
export function normalizeCity(cityRaw) {
  if (!cityRaw) return null;
  const key = String(cityRaw).trim().toLowerCase();
  if (key in CITY_ALIASES) return CITY_ALIASES[key];
  // Fall back to title-cased input so unexpected values still filter sensibly
  return key.charAt(0).toUpperCase() + key.slice(1);
}

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

/**
 * Compute the top-N cards for the given settings.
 *
 * @param {Object} args
 * @param {Array<Record<string, unknown>>} args.offers — offers.json's offers array
 * @param {string | null} args.city — canonical city name, or null for all cities
 * @param {number} args.orderValue — typical bill in PKR
 * @param {number[]} [args.days] — eligible days of the week (0=Sun..6=Sat)
 * @param {number} [args.limit] — how many cards to return (default 10)
 * @returns {{
 *   city: string | null,
 *   orderValue: number,
 *   ranked: Array<{
 *     bank: string,
 *     card: string,
 *     cardCategory: string | null,
 *     score: number,
 *     avgExpectedSaving: number,
 *     coverage: number,
 *     coveredVenueCount: number,
 *     totalVenueCount: number,
 *     averageDiscount: number | null,
 *     medianCap: number | null,
 *     bankSlug: string,
 *     cardSlug: string,
 *   }>,
 * }}
 */
export function computeRanking({ offers, city, orderValue, days, limit }) {
  const targetCity = normalizeCity(city);
  const selectedDays = days && days.length ? days : ALL_DAYS;
  const totalSelectedDays = selectedDays.length;
  const cap = Math.max(1, Math.min(50, limit ?? 10));

  // Step 1: scope offers to the city.
  const scopedOffers = offers.filter((offer) => {
    if (!targetCity) return true;
    return offer.city === targetCity;
  });
  if (scopedOffers.length === 0) {
    return { city: targetCity, orderValue, ranked: [] };
  }

  // Step 2: total venue set in this scope (denominator for coverage).
  const venueSet = new Set();
  for (const offer of scopedOffers) {
    venueSet.add(`${offer.city} || ${offer.restaurant}`);
  }
  const totalVenueCount = venueSet.size;
  if (totalVenueCount === 0) {
    return { city: targetCity, orderValue, ranked: [] };
  }

  // Step 3: per-card aggregation. For each card, track the best saving per
  // (venue, day) so we don't double-count multiple offers at the same place.
  /** @type {Map<string, {bank: string, card: string, cardCategory: string | null, venueDailyBest: Map<string, Map<number, number>>}>} */
  const cardMap = new Map();

  for (const offer of scopedOffers) {
    const saving = getOfferSavingValue(offer, orderValue);
    if (!Number.isFinite(saving) || saving <= 0) continue;

    const venueKey = `${offer.city} || ${offer.restaurant}`;
    const cardKey = `${offer.bank} || ${offer.card}`;
    let record = cardMap.get(cardKey);
    if (!record) {
      record = {
        bank: offer.bank,
        card: offer.card,
        cardCategory: /** @type {string|null} */ (offer.cardCategory) || null,
        venueDailyBest: new Map(),
      };
      cardMap.set(cardKey, record);
    }

    let dayMap = record.venueDailyBest.get(venueKey);
    if (!dayMap) {
      dayMap = new Map();
      record.venueDailyBest.set(venueKey, dayMap);
    }
    const offerDays = /** @type {number[]} */ (offer.days) || [];
    for (const d of selectedDays) {
      if (!offerDays.includes(d)) continue;
      const current = dayMap.get(d);
      if (current === undefined || saving > current) {
        dayMap.set(d, saving);
      }
    }
  }

  // Step 4: roll up each card to expected-saving + coverage + score.
  const aggregates = [];
  for (const record of cardMap.values()) {
    let coveredVenueCount = 0;
    let totalExpectedSaving = 0;
    const discountPcts = [];
    const caps = [];

    for (const [, dayMap] of record.venueDailyBest) {
      if (!dayMap.size) continue;
      coveredVenueCount += 1;
      let venueTotal = 0;
      for (const saving of dayMap.values()) {
        venueTotal += saving;
      }
      totalExpectedSaving += venueTotal / totalSelectedDays;
    }

    if (coveredVenueCount === 0) continue;

    // Use the original offer rows for this card to extract discount % + cap
    // signals (cosmetic — used in the SSR copy, not in scoring).
    for (const offer of scopedOffers) {
      if (offer.bank !== record.bank || offer.card !== record.card) continue;
      const pct = getOfferDiscountPct(offer);
      if (Number.isFinite(pct)) discountPcts.push(pct);
      const capRaw = /** @type {number} */ (offer.capPkr);
      if (Number.isFinite(capRaw)) caps.push(Number(capRaw));
    }

    const avgExpectedSaving = totalExpectedSaving / coveredVenueCount;
    const coverage = coveredVenueCount / totalVenueCount;
    const E = avgExpectedSaving * (0.35 + 0.65 * Math.sqrt(coverage));
    aggregates.push({
      bank: record.bank,
      card: record.card,
      cardCategory: record.cardCategory,
      avgExpectedSaving,
      coverage,
      coveredVenueCount,
      totalVenueCount,
      averageDiscount: discountPcts.length ? mean(discountPcts) : null,
      medianCap: caps.length ? median(caps) : null,
      E,
      score: 0,
    });
  }

  // Step 5: normalize E by P95 (robust to outliers) and finalize score.
  const eSorted = aggregates.map((a) => a.E).sort((a, b) => a - b);
  const p95 = eSorted.length
    ? eSorted[Math.max(0, Math.ceil(0.95 * eSorted.length) - 1)]
    : 1;
  const p95Safe = Math.max(p95, 1);

  for (const a of aggregates) {
    const Ns = Math.min(1, a.E / p95Safe);
    const R = 0.75 * Ns + 0.25 * a.coverage;
    a.score = Math.max(0, Math.min(100, 20 + 80 * R));
  }

  aggregates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.coverage !== a.coverage) return b.coverage - a.coverage;
    return b.avgExpectedSaving - a.avgExpectedSaving;
  });

  const ranked = aggregates.slice(0, cap).map((a) => ({
    bank: a.bank,
    card: a.card,
    cardCategory: a.cardCategory,
    score: a.score,
    avgExpectedSaving: a.avgExpectedSaving,
    coverage: a.coverage,
    coveredVenueCount: a.coveredVenueCount,
    totalVenueCount: a.totalVenueCount,
    averageDiscount: a.averageDiscount,
    medianCap: a.medianCap,
    bankSlug: slugify(a.bank),
    cardSlug: slugify(a.card),
  }));

  return { city: targetCity, orderValue, ranked };
}

/** @param {number[]} values */
function mean(values) {
  if (!values.length) return 0;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

/** @param {number[]} values */
function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Match the slug function used by generate_seo_pages.py so SSR links match
 * the static bank/card URLs.
 * @param {string} value
 */
export function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
