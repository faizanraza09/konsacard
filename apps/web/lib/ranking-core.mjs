// Shared ranking core — single source of truth for the homepage "best cards"
// algorithm. Imported in two places:
//
//   - apps/web/assets/algorithms.js  (browser)
//     Wraps the core to add per-user post-processing (eligibility filter,
//     annual-fee penalty, qualification delta) using state.* + the
//     requirements dataset that's only available browser-side.
//
//   - apps/web/functions/_middleware.js  (Cloudflare Pages Function / SSR)
//     Uses the core's output directly. The Worker has no salary/owned-card
//     input from the user, so it can't apply the post-processing stages;
//     the base score is what crawlers see.
//
// Design constraints
// ──────────────────
// 1. Pure function. No globals, no DOM, no fetch.
// 2. All inputs explicit: offers array, restaurants-enrichment object,
//    and a flat `settings` object holding every filter the browser exposes
//    via state.*. Sets/Arrays both accepted for multi-select filters.
// 3. Output is a list of card aggregates in the exact shape the browser's
//    rendering code already expects, EXCEPT for fields that depend on
//    eligibility data (added by the browser wrapper after calling core):
//      requirementStatus, qualificationConfidence, qualificationDelta,
//      feePenalty, and the FINAL adjusted `score`.
//    Core exposes `baseScore` so the wrapper can adjust it, and an unfiltered
//    list (no eligibility filtering) so the wrapper can decide.
//
// What the core DOES
// ──────────────────
//  1. Scope offers to selected city (or all)
//  2. Apply restaurant + cuisine narrowing if set
//  3. Build per-(card, venue, day) best-saving map using getOfferSavingValue
//  4. Roll up to per-card aggregates (avgExpectedSaving, coverage, avgDayFit,
//     averageDiscount, medianCap, saturationBill, topMatches)
//  5. Compute baseScore from blended E = avgSaving * (0.35 + 0.65*√coverage),
//     normalized by P95(E), then R = 0.75*Ns + 0.25*coverage, score = 20+80*R
//  6. Apply pure-data narrowing filters: banks / cardTypes / cards
//  7. Sort by baseScore (tiebreak: coverageAdjustedSaving, then coverage)
//
// What the core does NOT do (browser wrapper handles these)
// ──────────────────────────────────────────────────────────
//  - evaluateEligibility (depends on state.requirements)
//  - qualificationDelta (depends on state.useEligibility + salary/balance)
//  - feePenalty (depends on requirements.annualFeePkr + state.outingsPerWeek)
//  - eligibility-based filter (when useEligibility is on)

const DAY_SHORT_DEFAULT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

/** Money saved on a single offer at this order value, capped per offer.
 * Mirrors the legacy app.js function 1:1 so SSR + browser produce identical
 * per-offer savings. */
export function getOfferSavingValue(offer, orderValue) {
  const discountType = offer.discountType || "percentage";
  const discountPct = getOfferDiscountPct(offer);
  const fixedDiscountPkr = Number.isFinite(offer.fixedDiscountPkr) ? offer.fixedDiscountPkr : null;
  const capPkr = Number.isFinite(offer.capPkr) ? offer.capPkr : null;

  switch (discountType) {
    case "fixed":
      if (fixedDiscountPkr !== null && fixedDiscountPkr > 0) {
        return Math.min(fixedDiscountPkr, orderValue);
      }
      return null;
    case "up_to":
      if (Number.isFinite(discountPct) && discountPct > 0) {
        const effectivePct = discountPct * 0.6;
        const pctSaving = (orderValue * effectivePct) / 100;
        return Math.min(pctSaving, capPkr ?? Number.POSITIVE_INFINITY);
      }
      return null;
    case "bogo":
      if (Number.isFinite(discountPct) && discountPct > 0) {
        const effectivePct = discountPct * 0.3;
        const pctSaving = (orderValue * effectivePct) / 100;
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

/** Extract a percentage off the offer's structured field or its text labels. */
export function getOfferDiscountPct(offer) {
  if (Number.isFinite(offer.discountPct)) return Number(offer.discountPct);
  const text = `${offer.discountLabel || ""} ${offer.offerTitle || ""}`;
  const matches = text.match(/(\d+(?:\.\d+)?)\s*%/g) || [];
  if (!matches.length) return null;
  return Math.max(...matches.map((m) => Number.parseFloat(m)));
}

function asSet(v) {
  if (!v) return new Set();
  if (v instanceof Set) return v;
  if (Array.isArray(v)) return new Set(v);
  return new Set();
}

function normalizeCityKey(raw) {
  if (!raw) return "all";
  const k = String(raw).trim().toLowerCase();
  return k || "all";
}

function cityMatchesScope(offerCity, cityKey) {
  if (!cityKey || cityKey === "all") return true;
  return String(offerCity || "").toLowerCase() === cityKey;
}

function mean(values) {
  if (!values.length) return 0;
  let s = 0;
  for (const v of values) s += v;
  return s / values.length;
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// ── Fee penalty (data-driven, not user-input) ──
// Annual fee comes from the requirements dataset (which both browser and
// Worker can load). outingsPerWeek is the only user input — defaults to 1.
// Eligibility/qualification is a SEPARATE concern (needs salary input) and
// stays in the browser wrapper; the fee penalty is independent and runs in
// both places.

function normalizeDealCardFragment(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function buildDealCardKey(bank, card) {
  return `${normalizeDealCardFragment(bank)} || ${normalizeDealCardFragment(card)}`;
}

function normalizeRequirementNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Look up the annual fee and waiver rule for a (bank, card) in the
 * requirements dataset. Returns null fee if no requirement record exists.
 * @param {string} bank
 * @param {string} card
 * @param {{ byCardId?: Map<string, any>, mappingByDealKey?: Map<string, any> } | null | undefined} requirements
 */
function lookupAnnualFee(bank, card, requirements) {
  const empty = { annualFeePkr: null, annualFeeWaiverRule: null, hasRequirementRecord: false };
  if (!requirements?.mappingByDealKey || !requirements?.byCardId) return empty;
  const mapping = requirements.mappingByDealKey.get(buildDealCardKey(bank, card));
  if (!mapping?.matched || !mapping.requirement_card_id) return empty;
  const record = requirements.byCardId.get(mapping.requirement_card_id);
  if (!record) return empty;
  const reqs = record.requirements || {};
  return {
    annualFeePkr: normalizeRequirementNumber(reqs.annual_fee_pkr),
    annualFeeWaiverRule: reqs.annual_fee_waiver_rule || null,
    hasRequirementRecord: true,
  };
}

/**
 * Penalty in points (0..25) deducted from baseScore. Mirrors the legacy
 * computeFeePenalty in app.js — same calibration constants so SSR and
 * browser produce identical penalties.
 */
function computeFeePenaltyForCard({ avgExpectedSaving, feeData, outingsPerYear }) {
  const fee = feeData.annualFeePkr;
  // Missing fee data → small soft penalty (3 pts) so cards without a
  // verified requirement record don't get a free pass over disclosed peers.
  // Exception: documented waiver rule means we partially trust the missing
  // value as "Conditional" and skip the penalty.
  if (fee === null || fee === undefined) {
    if (!feeData.hasRequirementRecord) return 3;
    if (feeData.annualFeeWaiverRule) return 0;
    return 3;
  }
  if (fee <= 0) return 0;
  const waiver = !!feeData.annualFeeWaiverRule;
  const effective = fee * (waiver ? 0.5 : 1.0);
  // Yearly value matches the "Annual saving" the card detail modal shows
  // (avgExpectedSaving × outingsPerYear). Ratio = fee / yearly value;
  // capped at 25 points so it never single-handedly buries a great card.
  const yearlyValue = (avgExpectedSaving || 0) * outingsPerYear;
  const ratio = effective / Math.max(yearlyValue, 1);
  return Math.min(25, 25 * Math.min(1, ratio));
}

/**
 * @param {Object} args
 * @param {Array<Object>} args.offers - state.data.offers
 * @param {Object} [args.restaurantsEnrichment] - state.data.restaurants (name -> {servesCuisine: [...]})
 * @param {{byCardId: Map, mappingByDealKey: Map} | null} [args.requirements] - requirements dataset for fee penalty lookup. If absent, feePenalty defaults to 0.
 * @param {Object} args.settings - {
 *     city: string ("all" | "karachi" | "lahore" | "islamabad" | …),
 *     orderValue: number,
 *     outingsPerWeek?: number (defaults to 1),
 *     selectedDays: Set<number> | number[]  (empty = all 7 days),
 *     selectedRestaurants: Set<string> | string[],
 *     selectedBanks: Set<string> | string[],
 *     selectedCardTypes: Set<string> | string[],
 *     selectedCards: Set<string> | string[],
 *     selectedCuisines: Set<string> | string[],
 *     daysShort?: string[] (override the default Sun..Sat short labels)
 *   }
 * @returns {{
 *   aggregates: Array<{
 *     bank: string, card: string, cardCategory: string|null,
 *     baseScore: number, feePenalty: number, score: number,
 *     avgExpectedSaving: number, coverage: number,
 *     avgDayFit: number, coveredVenueCount: number, totalVenueCount: number,
 *     averageDiscount: number|null, medianCap: number|null,
 *     saturationBill: number|null, topMatches: Array, coverageAdjustedSaving: number,
 *     bankSlug: string, cardSlug: string
 *   }>,
 *   totalVenueCount: number,
 *   scoringVenueCount: number,
 * }}
 */
export function computeRanking({ offers, restaurantsEnrichment, requirements, settings }) {
  const cityKey = normalizeCityKey(settings?.city);
  const orderValue = Number.isFinite(settings?.orderValue) ? settings.orderValue : 10000;
  const selectedRestaurants = asSet(settings?.selectedRestaurants);
  const selectedBanks = asSet(settings?.selectedBanks);
  const selectedCardTypes = asSet(settings?.selectedCardTypes);
  const selectedCards = asSet(settings?.selectedCards);
  const selectedCuisines = asSet(settings?.selectedCuisines);
  const selectedDaysSet = asSet(settings?.selectedDays);
  const daysShort = settings?.daysShort || DAY_SHORT_DEFAULT;
  const enrichmentLookup = restaurantsEnrichment || {};

  if (!Array.isArray(offers) || offers.length === 0) {
    return { aggregates: [], totalVenueCount: 0, scoringVenueCount: 0 };
  }

  // Build the venue universe scoped to the current city.
  const allCityVenues = new Set();
  for (const offer of offers) {
    if (!cityMatchesScope(offer.city, cityKey)) continue;
    allCityVenues.add(`${offer.city} || ${offer.restaurant}`);
  }
  const totalVenueCount = allCityVenues.size;
  if (totalVenueCount === 0) {
    return { aggregates: [], totalVenueCount: 0, scoringVenueCount: 0 };
  }

  // Scoring venues: user-selected if any, otherwise all city venues.
  // Bank/card-type/card filters DON'T narrow this — they're applied to the
  // final card list, not the scoring base, otherwise filtering to one bank
  // would make that bank's coverage look like 100%.
  const scoringVenues = new Map();
  if (selectedRestaurants.size > 0) {
    for (const name of selectedRestaurants) {
      const match = offers.find((o) => o.restaurant === name && cityMatchesScope(o.city, cityKey));
      if (match) {
        scoringVenues.set(`${match.city} || ${name}`, { city: match.city, restaurant: name });
      }
    }
  } else {
    for (const key of allCityVenues) {
      const [city, restaurant] = key.split(" || ");
      scoringVenues.set(key, { city, restaurant });
    }
  }
  const scoringVenueCount = scoringVenues.size || 1;

  // Filter offers down to the scoring scope.
  const hasCuisineFilter = selectedCuisines.size > 0;
  const scoringOffers = offers.filter((offer) => {
    if (!cityMatchesScope(offer.city, cityKey)) return false;
    if (selectedRestaurants.size > 0 && !selectedRestaurants.has(offer.restaurant)) return false;
    if (hasCuisineFilter) {
      const enr = enrichmentLookup[offer.restaurant];
      const cuisines = enr?.servesCuisine || [];
      if (!cuisines.some((c) => selectedCuisines.has(c))) return false;
    }
    return true;
  });

  // Effective day window — if the user hasn't restricted days, all 7 days
  // are eligible.
  const totalSelectedDays = selectedDaysSet.size === 0 ? 7 : selectedDaysSet.size;
  const dayList = selectedDaysSet.size === 0 ? ALL_DAYS : Array.from(selectedDaysSet);

  // Per-card → per-venue → per-day best saving.
  const cardMap = new Map();
  for (const offer of scoringOffers) {
    const saving = getOfferSavingValue(offer, orderValue);
    if (!Number.isFinite(saving) || saving <= 0) continue;

    const venueKey = `${offer.city} || ${offer.restaurant}`;
    const cardKey = `${offer.bank} || ${offer.card}`;

    let record = cardMap.get(cardKey);
    if (!record) {
      record = {
        bank: offer.bank,
        card: offer.card,
        cardCategory: offer.cardCategory || null,
        venueDailyBest: new Map(),
      };
      cardMap.set(cardKey, record);
    }
    if (!record.cardCategory && offer.cardCategory) record.cardCategory = offer.cardCategory;

    let dayMap = record.venueDailyBest.get(venueKey);
    if (!dayMap) {
      dayMap = new Map();
      record.venueDailyBest.set(venueKey, dayMap);
    }

    const offerDays = Array.isArray(offer.days) ? offer.days : [];
    for (const day of dayList) {
      if (!offerDays.includes(day)) continue;
      const current = dayMap.get(day);
      const candidate = {
        city: offer.city,
        restaurant: offer.restaurant,
        saving,
        discountPct: getOfferDiscountPct(offer),
        discountLabel: offer.discountLabel,
        offerTitle: offer.offerTitle,
        offerDescription: offer.offerDescription,
        orderTypes: offer.orderTypes || [],
        daysLabel: offer.daysLabel,
        capPkr: offer.capPkr,
        fixedDiscountPkr: offer.fixedDiscountPkr ?? null,
      };
      if (!current || candidate.saving > current.saving) {
        dayMap.set(day, candidate);
      }
    }
  }

  // Roll up per-card.
  const aggregates = [];
  for (const record of cardMap.values()) {
    const venueSummaries = [];
    for (const [venueKey, dayMap] of record.venueDailyBest) {
      if (!dayMap.size) continue;
      const bestByDay = Array.from(dayMap.entries()).sort((a, b) => a[0] - b[0]);
      const totalExpectedSaving = bestByDay.reduce((sum, [, m]) => sum + m.saving, 0);
      const coveredDayCount = bestByDay.length;
      const expectedSaving = totalExpectedSaving / totalSelectedDays;
      const dayFit = coveredDayCount / totalSelectedDays;
      const strongestMatch = bestByDay.reduce(
        (best, [, m]) => (!best || m.saving > best.saving ? m : best),
        null,
      );
      const averageDiscount = mean(
        bestByDay.map(([, m]) => m.discountPct).filter((v) => Number.isFinite(v)),
      );
      const caps = bestByDay
        .map(([, m]) => m.capPkr)
        .filter((v) => Number.isFinite(v) && v > 0);

      venueSummaries.push({
        venueKey,
        city: strongestMatch.city,
        restaurant: strongestMatch.restaurant,
        rawSaving: strongestMatch.saving,
        expectedSaving,
        dayFit,
        coveredDayCount,
        discountPct: averageDiscount,
        discountLabel: strongestMatch.discountLabel,
        offerTitle: strongestMatch.offerTitle,
        offerDescription: strongestMatch.offerDescription,
        orderTypes: strongestMatch.orderTypes,
        daysLabel:
          coveredDayCount === totalSelectedDays
            ? "Matches all your chosen days"
            : bestByDay.map(([day]) => daysShort[day]).join(", "),
        capPkr: caps.length ? Math.max(...caps) : null,
        fixedDiscountPkr: strongestMatch.fixedDiscountPkr,
      });
    }

    const matches = venueSummaries;
    const coveredVenueCount = matches.length;
    if (coveredVenueCount === 0) continue;

    const coverage = coveredVenueCount / scoringVenueCount;
    const totalExpectedSaving = matches.reduce((sum, m) => sum + m.expectedSaving, 0);
    const totalDayFit = matches.reduce((sum, m) => sum + m.dayFit, 0);
    const avgExpectedSaving = totalExpectedSaving / coveredVenueCount;
    const avgDayFit = totalDayFit / coveredVenueCount;
    const averageDiscount = mean(
      matches.map((m) => m.discountPct).filter((v) => Number.isFinite(v)),
    );
    const caps = matches.map((m) => m.capPkr).filter((v) => Number.isFinite(v) && v > 0);
    const medianCap = caps.length ? median(caps) : null;
    const saturations = matches
      .map((m) => {
        const cap = Number(m.capPkr);
        const pct = Number(m.discountPct);
        // A cap of 0 (or non-finite) means "no real cap" in the data, not a
        // PKR 0 saturation point — skip it so we never render "bills ≤ PKR 0".
        if (!Number.isFinite(cap) || cap <= 0 || !Number.isFinite(pct) || pct <= 0) return null;
        return cap / (pct / 100);
      })
      .filter((v) => v !== null && Number.isFinite(v));
    const saturationBill = saturations.length ? median(saturations) : null;
    const topMatches = [...matches].sort((a, b) => b.expectedSaving - a.expectedSaving).slice(0, 3);

    aggregates.push({
      bank: record.bank,
      card: record.card,
      cardCategory: record.cardCategory,
      baseScore: 0, // filled in below
      avgExpectedSaving,
      coverage,
      coverageAdjustedSaving: avgExpectedSaving * coverage,
      avgDayFit,
      coveredVenueCount,
      totalVenueCount: scoringVenues.size,
      averageDiscount,
      medianCap,
      saturationBill,
      topMatches,
      bankSlug: slugify(record.bank),
      cardSlug: slugify(record.card),
    });
  }

  // Savings-strength index with coverage folded into the saving signal
  // (leaning toward the realistic "random restaurant" model: a card you can
  // only use at a handful of venues shouldn't read as a high per-outing
  // saving). The base score then blends normalized savings strength and
  // normalized breadth 50/50, so covering many restaurants is weighed as
  // heavily as saving a lot at the few you cover.
  const eValues = [];
  const covValues = [];
  for (const item of aggregates) {
    const E = item.avgExpectedSaving * (0.3 + 0.7 * item.coverage);
    item._E = E;
    eValues.push(E);
    covValues.push(item.coverage);
  }
  eValues.sort((a, b) => a - b);
  covValues.sort((a, b) => a - b);
  const p95 = eValues.length
    ? eValues[Math.max(0, Math.ceil(0.95 * eValues.length) - 1)]
    : 1;
  const p95Safe = Math.max(p95, 1);
  const p95Cov = covValues.length
    ? covValues[Math.max(0, Math.ceil(0.95 * covValues.length) - 1)]
    : 1e-6;
  const p95CovSafe = Math.max(p95Cov, 1e-6);

  for (const item of aggregates) {
    const Ns = Math.min(1, item._E / p95Safe);
    const Ncov = Math.min(1, item.coverage / p95CovSafe);
    const R = 0.5 * Ns + 0.5 * Ncov;
    item.baseScore = Math.max(0, Math.min(100, 20 + 80 * R));
    delete item._E;
  }

  // Fee penalty (data-driven). Looks up annualFeePkr from the requirements
  // dataset if provided. Yearly value uses outingsPerWeek with default 1
  // (matches the app's default for a user who hasn't touched the slider).
  // If no requirements data is passed, feePenalty is 0 for every card.
  const outingsPerWeek = Number.isFinite(settings?.outingsPerWeek)
    ? settings.outingsPerWeek
    : 1;
  const outingsPerYear = Math.max(1, outingsPerWeek) * 52;
  for (const item of aggregates) {
    const feeData = lookupAnnualFee(item.bank, item.card, requirements);
    item.feePenalty = requirements
      ? computeFeePenaltyForCard({
          avgExpectedSaving: item.avgExpectedSaving,
          feeData,
          outingsPerYear,
        })
      : 0;
    item.annualFeePkr = feeData.annualFeePkr;
    // SSR-friendly final score: baseScore - feePenalty. The browser wrapper
    // overrides item.score after adding qualificationDelta on top.
    item.score = Math.max(0, Math.min(100, item.baseScore - item.feePenalty));
  }

  // Pure-data narrowing filters (applied AFTER scoring so the score reflects
  // the city-wide picture, not just the filter slice).
  let visible = aggregates;
  if (selectedBanks.size > 0 || selectedCardTypes.size > 0 || selectedCards.size > 0) {
    visible = aggregates.filter((item) => {
      if (selectedBanks.size > 0 && !selectedBanks.has(item.bank)) return false;
      if (selectedCardTypes.size > 0 && !selectedCardTypes.has(item.cardCategory)) return false;
      if (selectedCards.size > 0 && !selectedCards.has(item.card)) return false;
      return true;
    });
  }

  // Sort by the fee-adjusted score (item.score). Browser callers will
  // re-sort after applying qualificationDelta; SSR uses this order directly.
  visible.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.coverageAdjustedSaving !== a.coverageAdjustedSaving)
      return b.coverageAdjustedSaving - a.coverageAdjustedSaving;
    return b.coverage - a.coverage;
  });

  return {
    aggregates: visible,
    totalVenueCount,
    scoringVenueCount,
  };
}

/** Match the slug function used by generate_seo_pages.py so SSR/browser links
 * line up with the static bank/card URLs. */
export function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
