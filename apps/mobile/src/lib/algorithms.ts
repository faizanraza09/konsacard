import {
  AlgorithmState,
  CardRecommendation,
  EligibilityStatus,
  NextCardRecommendation,
  NextCardResult,
  Offer,
  VenueMatch,
  WalletPick,
  WalletResult,
  WalletShape,
} from "@/types";
import { computeQualificationConfidence, evaluateEligibility } from "./eligibility";
import {
  average,
  buildCardKey,
  formatCurrency,
  median,
  normalizeCityValue,
} from "./format";
import { getOfferDiscountPct, getOfferSavingValue } from "./savings";

/** Saving-window view: the algorithm's native unit is per-outing; the UI lets
 * the user reframe the hero saving as /outing | /month | /year. Mirrors web's
 * `state.savingWindow` ("outing" | "month" | "yr"). */
export type SavingWindow = "outing" | "month" | "yr";

/**
 * Score → human tier. The score floor is 20 (baseScore = 20 + 80·R), so the
 * effective range is 20–100. Thresholds mirror apps/web/assets/app.js `fitTier`
 * (calibration #7: 84/72/56). We avoid "poor"/"bad" — the consumer tone is
 * encouraging.
 */
export function fitTier(score: number): string {
  const s = Number(score) || 0;
  if (s >= 84) return "Excellent fit";
  if (s >= 72) return "Strong fit";
  if (s >= 56) return "Decent fit";
  return "Weak fit";
}

/**
 * Multiplier from `/outing` (the algorithm's native unit) into the chosen
 * saving-window view. Mirrors web's `savingWindowMultiplier()`:
 *   month → outingsPerWeek × 52 / 12
 *   year  → outingsPerWeek × 52
 *   outing → 1
 */
export function savingWindowMultiplier(window: SavingWindow, outingsPerWeek: number): number {
  const op = outingsPerWeek || 1;
  if (window === "month") return (op * 52) / 12;
  if (window === "yr") return op * 52;
  return 1;
}

/** Suffix for the saving-window view. Mirrors web's `savingWindowSuffix()`. */
export function savingWindowSuffix(window: SavingWindow): string {
  return window === "yr" ? "/year" : window === "month" ? "/month" : "/outing";
}

/**
 * Convert a card's annual fee into a score penalty, capped at 25 points.
 *
 *   yearlyValue  = avgExpectedSaving × outingsPerYear × coverage  (PKR)
 *   waiverFactor = 0.5 if waiver rule documented, else 1.0
 *   effectiveFee = annualFeePkr × waiverFactor
 *   penalty      = min(25, 25 × effectiveFee / max(yearlyValue, 1))
 *
 * Null/zero fee returns 0. Used by the Cards-tab default score.
 */
export function computeFeePenalty(
  item: Pick<CardRecommendation, "requirementStatus" | "avgExpectedSaving" | "coverage">,
  outingsPerYear: number
): number {
  const status = item.requirementStatus;
  const fee = status?.annualFeePkr;

  // Calibration #2 (May 2026): missing-fee soft penalty. Cards without a
  // verified requirements record were being silently advantaged over
  // disclosed peers. 3 points is small enough not to dominate, big enough
  // to level the field.
  if (fee === null || fee === undefined) {
    if (!status?.hasRequirementRecord) return 3;
    if (status?.annualFeeWaiverRule) return 0;
    return 3;
  }
  if (fee <= 0) return 0;

  const waiver = !!status?.annualFeeWaiverRule;
  const effective = fee * (waiver ? 0.5 : 1.0);
  // Calibration #1: drop the × coverage multiplier — see the matching
  // change in apps/web/assets/algorithms.js for the rationale.
  const yearlyValue = (item.avgExpectedSaving || 0) * outingsPerYear;
  const ratio = effective / Math.max(yearlyValue, 1);
  return Math.min(25, 25 * Math.min(1, ratio));
}

function cityMatches(state: Pick<AlgorithmState, "selectedCity">, city: string): boolean {
  const sel = normalizeCityValue(state.selectedCity);
  return sel === "all" || sel === normalizeCityValue(city);
}

function getEffectiveSelectedDays(state: AlgorithmState): Set<number> {
  if (state.selectedDays.size > 0) return state.selectedDays;
  const len = state.data?.dayNames.length ?? 7;
  const all = new Set<number>();
  for (let i = 0; i < len; i++) all.add(i);
  return all;
}

interface CardSavingsEntry {
  bank: string;
  card: string;
  cardCategory: string | null;
  venues: Map<string, Map<number, number>>;
}

function precomputeCardSavingsByVenueDay(
  scopeOffers: Offer[],
  selectedDays: Set<number>,
  orderValue: number
): Map<string, CardSavingsEntry> {
  const out = new Map<string, CardSavingsEntry>();
  scopeOffers.forEach((offer) => {
    const saving = getOfferSavingValue(offer, orderValue);
    if (!Number.isFinite(saving as number) || (saving as number) <= 0) return;
    const cardKey = buildCardKey(offer.bank, offer.card);
    const venueKey = `${offer.city} || ${offer.restaurant}`;
    let venueMap = out.get(cardKey);
    if (!venueMap) {
      venueMap = {
        bank: offer.bank,
        card: offer.card,
        cardCategory: offer.cardCategory || null,
        venues: new Map(),
      };
      out.set(cardKey, venueMap);
    }
    if (!venueMap.cardCategory && offer.cardCategory) venueMap.cardCategory = offer.cardCategory;
    let dayMap = venueMap.venues.get(venueKey);
    if (!dayMap) {
      dayMap = new Map();
      venueMap.venues.set(venueKey, dayMap);
    }
    selectedDays.forEach((day) => {
      if (!offer.days.includes(day)) return;
      const prev = dayMap!.get(day) || 0;
      if ((saving as number) > prev) dayMap!.set(day, saving as number);
    });
  });
  return out;
}

function marginalForCard(
  cardEntry: CardSavingsEntry,
  currentBest: Map<string, Map<number, number>>
) {
  let delta = 0;
  let boosted = 0;
  let unlocked = 0;
  let coveredByCandidate = 0;
  cardEntry.venues.forEach((dayMap, venueKey) => {
    let venueImproves = false;
    let venueWasUncovered = true;
    const cur = currentBest.get(venueKey);
    if (cur) {
      for (const v of cur.values()) {
        if (v > 0) {
          venueWasUncovered = false;
          break;
        }
      }
    }
    dayMap.forEach((s, day) => {
      const curVal = cur ? cur.get(day) || 0 : 0;
      if (s > curVal) {
        delta += s - curVal;
        venueImproves = true;
      }
    });
    if (venueImproves) {
      coveredByCandidate += 1;
      if (venueWasUncovered) unlocked += 1;
      else boosted += 1;
    }
  });
  return { delta, boostedVenues: boosted, newVenues: unlocked, coveredVenues: coveredByCandidate };
}

function applyCardToCurrentBest(
  cardEntry: CardSavingsEntry,
  currentBest: Map<string, Map<number, number>>
) {
  cardEntry.venues.forEach((dayMap, venueKey) => {
    let cur = currentBest.get(venueKey);
    if (!cur) {
      cur = new Map();
      currentBest.set(venueKey, cur);
    }
    dayMap.forEach((s, day) => {
      if (s > (cur!.get(day) || 0)) cur!.set(day, s);
    });
  });
}

function summarizeWallet(
  currentBest: Map<string, Map<number, number>>,
  totalSelectedDays: number,
  venueCount: number
) {
  let totalDailyBest = 0;
  let coveredVenues = 0;
  currentBest.forEach((dayMap) => {
    let any = false;
    dayMap.forEach((s) => {
      if (s > 0) {
        totalDailyBest += s;
        any = true;
      }
    });
    if (any) coveredVenues += 1;
  });
  const perOutingTotal =
    coveredVenues > 0 ? totalDailyBest / (coveredVenues * Math.max(1, totalSelectedDays)) : 0;
  const coverage = venueCount > 0 ? coveredVenues / venueCount : 0;
  return { perOutingTotal, coverage, coveredVenues };
}

export function computeRecommendations(state: AlgorithmState): CardRecommendation[] {
  if (!state.data) return [];
  const offers = state.data.offers;

  const allCityVenues = new Set<string>();
  offers.forEach((offer) => {
    if (!cityMatches(state, offer.city)) return;
    allCityVenues.add(`${offer.city} || ${offer.restaurant}`);
  });
  const totalVenueCount = allCityVenues.size;
  if (!totalVenueCount) return [];

  const scoringVenues = new Map<string, { city: string; restaurant: string }>();
  if (state.selectedRestaurants.size > 0) {
    state.selectedRestaurants.forEach((name) => {
      const found = offers.find((o) => o.restaurant === name && cityMatches(state, o.city));
      if (found)
        scoringVenues.set(`${found.city} || ${name}`, { city: found.city, restaurant: name });
    });
  } else {
    allCityVenues.forEach((key) => {
      const [city, restaurant] = key.split(" || ");
      scoringVenues.set(key, { city, restaurant });
    });
  }
  const scoringVenueCount = scoringVenues.size || 1;

  const hasCuisineFilter = state.selectedCuisines.size > 0;
  const enrichment = state.data.restaurantsEnrichment || {};
  const scoringOffers = offers.filter((offer) => {
    if (!cityMatches(state, offer.city)) return false;
    if (state.selectedRestaurants.size > 0 && !state.selectedRestaurants.has(offer.restaurant)) return false;
    if (hasCuisineFilter) {
      const cuisines = enrichment[offer.restaurant]?.servesCuisine || [];
      if (!cuisines.some((c) => state.selectedCuisines.has(c))) return false;
    }
    return true;
  });

  const selectedDays = getEffectiveSelectedDays(state);
  const totalSelectedDays = selectedDays.size;
  const cardMap = new Map<
    string,
    {
      bank: string;
      card: string;
      cardCategory: string | null;
      venueDailyBest: Map<string, Map<number, VenueMatch & { saving: number }>>;
    }
  >();

  scoringOffers.forEach((offer) => {
    const offerSaving = getOfferSavingValue(offer, state.orderValue);
    if (!Number.isFinite(offerSaving as number) || (offerSaving as number) <= 0) return;

    const venueKey = `${offer.city} || ${offer.restaurant}`;
    const cardKey = `${offer.bank} || ${offer.card}`;
    if (!cardMap.has(cardKey)) {
      cardMap.set(cardKey, {
        bank: offer.bank,
        card: offer.card,
        cardCategory: offer.cardCategory || null,
        venueDailyBest: new Map(),
      });
    }
    const cardRecord = cardMap.get(cardKey)!;
    if (!cardRecord.cardCategory && offer.cardCategory) cardRecord.cardCategory = offer.cardCategory;
    if (!cardRecord.venueDailyBest.has(venueKey)) cardRecord.venueDailyBest.set(venueKey, new Map());
    const dayMap = cardRecord.venueDailyBest.get(venueKey)!;
    selectedDays.forEach((day) => {
      if (!offer.days.includes(day)) return;
      const candidate = {
        venueKey,
        city: offer.city,
        restaurant: offer.restaurant,
        saving: offerSaving as number,
        expectedSaving: 0,
        discountPct: getOfferDiscountPct(offer),
        discountLabel: offer.discountLabel,
        offerTitle: offer.offerTitle,
        offerDescription: offer.offerDescription,
        orderTypes: offer.orderTypes || [],
        daysLabel: offer.daysLabel,
        capPkr: offer.capPkr,
        fixedDiscountPkr: offer.fixedDiscountPkr ?? null,
      };
      const current = dayMap.get(day);
      if (!current || candidate.saving > current.saving) dayMap.set(day, candidate);
    });
  });

  const aggregates: CardRecommendation[] = Array.from(cardMap.values()).map((cardRecord) => {
    const venueSummaries: VenueMatch[] = [];
    cardRecord.venueDailyBest.forEach((dayMap, venueKey) => {
      if (!dayMap.size) return;
      const entries = Array.from(dayMap.entries()).sort((a, b) => a[0] - b[0]);
      const totalExpectedSaving = entries.reduce((sum, [, m]) => sum + m.saving, 0);
      const coveredDayCount = entries.length;
      const expectedSaving = totalExpectedSaving / totalSelectedDays;
      const dayFit = coveredDayCount / totalSelectedDays;
      const strongestMatch = entries.reduce<(VenueMatch & { saving: number }) | null>(
        (best, [, m]) => (!best || m.saving > best.saving ? m : best),
        null
      )!;
      const averageDiscount = average(
        entries.map(([, m]) => m.discountPct as number).filter((v) => Number.isFinite(v))
      );
      const caps = entries.map(([, m]) => m.capPkr as number).filter((v) => Number.isFinite(v));
      venueSummaries.push({
        venueKey,
        city: strongestMatch.city,
        restaurant: strongestMatch.restaurant,
        rawSaving: strongestMatch.saving,
        expectedSaving,
        dayFit,
        coveredDayCount,
        discountPct: averageDiscount as number | null,
        discountLabel: strongestMatch.discountLabel,
        offerTitle: strongestMatch.offerTitle,
        offerDescription: strongestMatch.offerDescription,
        orderTypes: strongestMatch.orderTypes,
        daysLabel:
          coveredDayCount === totalSelectedDays
            ? "Matches all your chosen days"
            : entries.map(([day]) => ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][day]).join(", "),
        capPkr: caps.length ? Math.max(...caps) : null,
        fixedDiscountPkr: strongestMatch.fixedDiscountPkr,
      });
    });

    const coveredVenueCount = venueSummaries.length;
    const coverage = coveredVenueCount / scoringVenueCount;
    const totalExpectedSaving = venueSummaries.reduce((s, m) => s + m.expectedSaving, 0);
    const totalDayFit = venueSummaries.reduce((s, m) => s + (m.dayFit ?? 0), 0);
    const avgExpectedSaving = coveredVenueCount > 0 ? totalExpectedSaving / coveredVenueCount : 0;
    const avgDayFit = coveredVenueCount > 0 ? totalDayFit / coveredVenueCount : 0;
    const averageDiscount = average(
      venueSummaries.map((m) => m.discountPct as number).filter((v) => Number.isFinite(v))
    );
    const caps = venueSummaries.map((m) => m.capPkr as number).filter((v) => Number.isFinite(v));
    const medianCap = caps.length ? median(caps) : null;
    // Saturation bill: where the cap kicks in (cap / (pct/100)). Below this bill
    // size the user gets the headline %; above it the saving plateaus at cap.
    const saturations = venueSummaries
      .map((m) => {
        const cap = m.capPkr as number;
        const pct = m.discountPct as number;
        if (!Number.isFinite(cap) || !Number.isFinite(pct) || pct <= 0) return null;
        return cap / (pct / 100);
      })
      .filter((v): v is number => v !== null && Number.isFinite(v));
    const saturationBill = saturations.length ? median(saturations) : null;
    const topMatches = [...venueSummaries].sort((a, b) => b.expectedSaving - a.expectedSaving).slice(0, 3);

    return {
      bank: cardRecord.bank,
      card: cardRecord.card,
      cardCategory: (cardRecord.cardCategory || null) as CardRecommendation["cardCategory"],
      score: 0,
      avgExpectedSaving,
      coverage,
      avgDayFit,
      coveredVenueCount,
      totalVenueCount: scoringVenues.size,
      averageDiscount: averageDiscount as number | null,
      medianCap,
      saturationBill,
      topMatches,
      requirementStatus: evaluateEligibility(state, cardRecord.bank, cardRecord.card),
    };
  });

  const hasEligibilityInput = state.monthlySalary !== null || state.accountBalance !== null;

  aggregates.forEach((item) => {
    item.coverageAdjustedSaving = item.avgExpectedSaving * item.coverage;
    item.E = item.avgExpectedSaving * (0.35 + 0.65 * Math.sqrt(item.coverage));
  });

  const eSorted = aggregates.map((i) => i.E as number).sort((a, b) => a - b);
  const p95E =
    eSorted.length > 0 ? eSorted[Math.max(0, Math.ceil(0.95 * eSorted.length) - 1)] : 1;
  const p95ESafe = Math.max(p95E, 1);

  // Annual-fee penalty. Effective fee = annualFeePkr × (0.5 if waiver rule
  // present, else 1.0). Cards with null annualFeePkr get no penalty (we treat
  // absent data as unknown). Penalty caps at 25 points.
  const outingsPerYear = (state.outingsPerWeek || 1) * 52;
  aggregates.forEach((item) => {
    const Ns = Math.min(1, (item.E as number) / p95ESafe);
    // Calibration #6: drop avgDayFit from R — already inside expectedSaving.
    const R = 0.75 * Ns + 0.25 * item.coverage;
    item.baseScore = 20 + 80 * R;
    item.qualificationConfidence = computeQualificationConfidence(state, item.requirementStatus);
    // Calibration #3: halve qualDelta from ±15 to ±7.5 so eligibility
    // nudges the ranking instead of dominating it.
    item.qualificationDelta =
      state.useEligibility && hasEligibilityInput
        ? 15 * (item.qualificationConfidence - 0.5)
        : 0;
    const feePenalty = computeFeePenalty(item, outingsPerYear);
    (item as CardRecommendation & { feePenalty: number }).feePenalty = feePenalty;
    item.score = Math.max(
      0,
      Math.min(100, (item.baseScore as number) + item.qualificationDelta - feePenalty)
    );
  });

  let visible = aggregates.filter((item) => {
    if (state.selectedBanks.size > 0 && !state.selectedBanks.has(item.bank)) return false;
    if (state.selectedCardTypes.size > 0 && !state.selectedCardTypes.has(item.cardCategory as string)) return false;
    if (state.selectedCards.size > 0 && !state.selectedCards.has(item.card)) return false;
    return true;
  });

  if (state.useEligibility && hasEligibilityInput) {
    visible = visible.filter((item) => item.requirementStatus.status !== "ineligible");
  }

  return visible.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if ((b.coverageAdjustedSaving as number) !== (a.coverageAdjustedSaving as number))
      return (b.coverageAdjustedSaving as number) - (a.coverageAdjustedSaving as number);
    return b.coverage - a.coverage;
  });
}

export function computeNextCardRecommendations(state: AlgorithmState): NextCardResult {
  if (!state.data) {
    return { ranked: [], stats: { ownedCount: 0, venuesInScope: 0, totalCandidates: 0 } };
  }
  const ownedKeys = state.ownedCards;
  const selectedDays = getEffectiveSelectedDays(state);
  const totalSelectedDays = selectedDays.size || 1;

  const scopeKey = (offer: Offer) => `${offer.city} || ${offer.restaurant}`;
  const scopeOffers = state.data.offers.filter((offer) => {
    if (!cityMatches(state, offer.city)) return false;
    if (state.selectedRestaurants.size > 0 && !state.selectedRestaurants.has(offer.restaurant))
      return false;
    return true;
  });

  const venuesInScope = new Set<string>();
  state.data.offers.forEach((offer) => {
    if (!cityMatches(state, offer.city)) return;
    if (state.selectedRestaurants.size > 0 && !state.selectedRestaurants.has(offer.restaurant))
      return;
    venuesInScope.add(scopeKey(offer));
  });
  const venueCount = venuesInScope.size;

  const currentBest = new Map<string, Map<number, number>>();
  if (ownedKeys.size > 0) {
    scopeOffers.forEach((offer) => {
      const cardKey = buildCardKey(offer.bank, offer.card);
      if (!ownedKeys.has(cardKey)) return;
      const saving = getOfferSavingValue(offer, state.orderValue);
      if (!Number.isFinite(saving as number) || (saving as number) <= 0) return;
      const venueKey = scopeKey(offer);
      let dayMap = currentBest.get(venueKey);
      if (!dayMap) {
        dayMap = new Map();
        currentBest.set(venueKey, dayMap);
      }
      selectedDays.forEach((day) => {
        if (!offer.days.includes(day)) return;
        const prev = dayMap!.get(day) || 0;
        if ((saving as number) > prev) dayMap!.set(day, saving as number);
      });
    });
  }

  type NextCardCell = {
    candidateBest: number;
    currentBest: number;
    discountPct: number | null;
    discountLabel?: string;
    offerTitle?: string;
    orderTypes?: string[];
    capPkr: number | null;
    fixedDiscountPkr: number | null;
    city: string;
    restaurant: string;
  };
  type CardRecord = {
    bank: string;
    card: string;
    cardCategory: string | null;
    venueDayCells: Map<string, Map<number, NextCardCell>>;
  };

  const cardMap = new Map<string, CardRecord>();
  scopeOffers.forEach((offer) => {
    const cardKey = buildCardKey(offer.bank, offer.card);
    if (ownedKeys.has(cardKey)) return;
    const saving = getOfferSavingValue(offer, state.orderValue);
    if (!Number.isFinite(saving as number) || (saving as number) <= 0) return;
    const venueKey = scopeKey(offer);
    let record = cardMap.get(cardKey);
    if (!record) {
      record = {
        bank: offer.bank,
        card: offer.card,
        cardCategory: offer.cardCategory || null,
        venueDayCells: new Map(),
      };
      cardMap.set(cardKey, record);
    }
    if (!record.cardCategory && offer.cardCategory) record.cardCategory = offer.cardCategory;
    let venueMap = record.venueDayCells.get(venueKey);
    if (!venueMap) {
      venueMap = new Map();
      record.venueDayCells.set(venueKey, venueMap);
    }
    selectedDays.forEach((day) => {
      if (!offer.days.includes(day)) return;
      const cell = venueMap!.get(day);
      if (!cell || (saving as number) > cell.candidateBest) {
        const currentBestVal = currentBest.get(venueKey)?.get(day) || 0;
        venueMap!.set(day, {
          candidateBest: saving as number,
          currentBest: currentBestVal,
          discountPct: getOfferDiscountPct(offer),
          discountLabel: offer.discountLabel,
          offerTitle: offer.offerTitle,
          orderTypes: offer.orderTypes || [],
          capPkr: offer.capPkr ?? null,
          fixedDiscountPkr: offer.fixedDiscountPkr ?? null,
          city: offer.city,
          restaurant: offer.restaurant,
        });
      }
    });
  });

  const aggregates: NextCardRecommendation[] = Array.from(cardMap.values()).map((record) => {
    let newVenues = 0;
    let boostedVenues = 0;
    let totalDeltaSaving = 0;
    let coveredVenues = 0;
    const venueSummaries: VenueMatch[] = [];

    record.venueDayCells.forEach((dayMap, venueKey) => {
      let venueDeltaSum = 0;
      let venueAnyDelta = false;
      const venueOwnedAny =
        currentBest.has(venueKey) &&
        Array.from(currentBest.get(venueKey)!.values()).some((v) => v > 0);
      let bestCellRef: NextCardCell | null = null;
      dayMap.forEach((cell) => {
        const delta = Math.max(0, cell.candidateBest - cell.currentBest);
        if (delta > 0) {
          venueDeltaSum += delta;
          venueAnyDelta = true;
        }
        if (!bestCellRef || cell.candidateBest > bestCellRef.candidateBest) bestCellRef = cell;
      });
      if (!venueAnyDelta) return;
      coveredVenues += 1;
      totalDeltaSaving += venueDeltaSum;
      if (venueOwnedAny) boostedVenues += 1;
      else newVenues += 1;
      const c = bestCellRef!;
      venueSummaries.push({
        venueKey,
        city: c.city,
        restaurant: c.restaurant,
        expectedSaving: venueDeltaSum / totalSelectedDays,
        perOutingDelta: venueDeltaSum / totalSelectedDays,
        candidatePctLabel: c.discountLabel,
        candidatePct: c.discountPct,
        discountPct: c.discountPct,
        offerTitle: c.offerTitle,
        orderTypes: c.orderTypes as VenueMatch["orderTypes"],
        wasUncovered: !venueOwnedAny,
      });
    });

    const avgDeltaPerOuting =
      coveredVenues > 0 ? totalDeltaSaving / (coveredVenues * totalSelectedDays) : 0;
    const coverageDelta = venueCount > 0 ? coveredVenues / venueCount : 0;
    const outingsPerYear = (state.outingsPerWeek || 1) * 52;
    const hitRate = coverageDelta;
    const yearlyDelta = outingsPerYear * hitRate * avgDeltaPerOuting;
    const topVenueWins = [...venueSummaries]
      .sort((a, b) => (b.perOutingDelta ?? 0) - (a.perOutingDelta ?? 0))
      .slice(0, 3);

    return {
      bank: record.bank,
      card: record.card,
      cardCategory: record.cardCategory as NextCardRecommendation["cardCategory"],
      newVenues,
      boostedVenues,
      coveredVenues,
      venueCount,
      avgDeltaPerOuting,
      coverageDelta,
      yearlyDelta,
      totalDeltaSaving,
      topVenueWins,
      requirementStatus: evaluateEligibility(state, record.bank, record.card),
      score: 0,
    };
  });

  const hasEligibilityInput = state.monthlySalary !== null || state.accountBalance !== null;

  aggregates.forEach((item) => {
    item.E = item.avgDeltaPerOuting * (0.35 + 0.65 * Math.sqrt(item.coverageDelta));
  });
  const eSorted = aggregates.map((i) => i.E as number).sort((a, b) => a - b);
  const p95E = eSorted.length > 0 ? eSorted[Math.max(0, Math.ceil(0.95 * eSorted.length) - 1)] : 1;
  const p95Safe = Math.max(p95E, 1);
  aggregates.forEach((item) => {
    const Ns = Math.min(1, (item.E as number) / p95Safe);
    const R =
      0.65 * Ns +
      0.25 * item.coverageDelta +
      0.1 * Math.min(1, item.newVenues / Math.max(1, venueCount * 0.1));
    item.baseScore = 20 + 80 * R;
    item.qualificationConfidence = computeQualificationConfidence(state, item.requirementStatus);
    item.qualificationDelta =
      state.useEligibility && hasEligibilityInput ? 30 * (item.qualificationConfidence - 0.5) : 0;
    item.score = Math.max(0, Math.min(100, (item.baseScore as number) + item.qualificationDelta));
  });

  let visible = aggregates.filter((item) => item.coveredVenues > 0);
  visible = visible.filter((item) => {
    if (state.selectedBanks.size > 0 && !state.selectedBanks.has(item.bank)) return false;
    if (
      state.selectedCardTypes.size > 0 &&
      !state.selectedCardTypes.has(item.cardCategory as string)
    )
      return false;
    return true;
  });
  if (state.useEligibility && hasEligibilityInput) {
    visible = visible.filter((item) => item.requirementStatus.status !== "ineligible");
  }

  visible.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.yearlyDelta !== a.yearlyDelta) return b.yearlyDelta - a.yearlyDelta;
    return b.avgDeltaPerOuting - a.avgDeltaPerOuting;
  });

  // Wallet stats: what the user already covers
  let walletTotalDailyBest = 0;
  let walletCoveredVenues = 0;
  currentBest.forEach((dayMap) => {
    let any = false;
    dayMap.forEach((s) => {
      if (s > 0) {
        walletTotalDailyBest += s;
        any = true;
      }
    });
    if (any) walletCoveredVenues += 1;
  });
  const walletPerOuting =
    walletCoveredVenues > 0 ? walletTotalDailyBest / (walletCoveredVenues * totalSelectedDays) : 0;
  const walletCoverage = venueCount > 0 ? walletCoveredVenues / venueCount : 0;
  const walletYearly = walletPerOuting * (state.outingsPerWeek || 1) * 52 * walletCoverage;
  let walletAnnualFee = 0;
  let walletFeeUnknown = false;
  ownedKeys.forEach((ck) => {
    const [bank, card] = ck.split(" || ");
    const status = evaluateEligibility(state, bank, card);
    const fee = status?.annualFeePkr;
    if (fee === null || fee === undefined) walletFeeUnknown = true;
    else if (Number.isFinite(fee)) walletAnnualFee += fee;
  });

  return {
    ranked: visible,
    stats: {
      ownedCount: ownedKeys.size,
      venuesInScope: venueCount,
      totalCandidates: aggregates.length,
      wallet: {
        perOuting: walletPerOuting,
        coverage: walletCoverage,
        coveredVenues: walletCoveredVenues,
        venueCount,
        yearly: walletYearly,
        annualFee: walletAnnualFee,
        feeUnknown: walletFeeUnknown,
      },
    },
  };
}

export function computeWalletRecommendations(state: AlgorithmState): WalletResult {
  if (!state.data) return { ranked: [], stats: { venueCount: 0, candidateCount: 0, warnings: [] } };

  const K = Math.max(2, Math.min(4, Number(state.walletSize) || 2));
  const selectedDays = getEffectiveSelectedDays(state);
  const totalSelectedDays = selectedDays.size || 1;
  const buildOnOwned = !!state.walletBuildOnOwned && state.ownedCards.size > 0;
  const objective = state.walletObjective || "savings";
  const noSameBank = !!state.walletNoSameBank;
  const requireMixedTypes = !!state.walletMixedTypes;
  const maxFee =
    Number.isFinite(state.walletMaxFee as number) && (state.walletMaxFee as number) >= 0
      ? (state.walletMaxFee as number)
      : null;
  const outingsPerYear = (state.outingsPerWeek || 1) * 52;
  const warnings: string[] = [];

  const scopeOffers = state.data.offers.filter((offer) => {
    if (!cityMatches(state, offer.city)) return false;
    if (state.selectedRestaurants.size > 0 && !state.selectedRestaurants.has(offer.restaurant)) return false;
    return true;
  });
  const venuesInScope = new Set<string>();
  scopeOffers.forEach((o) => venuesInScope.add(`${o.city} || ${o.restaurant}`));
  const venueCount = venuesInScope.size;
  if (!venueCount) {
    return { ranked: [], stats: { venueCount: 0, candidateCount: 0, warnings } };
  }

  const cardIndex = precomputeCardSavingsByVenueDay(scopeOffers, selectedDays, state.orderValue);
  const hasEligibilityInput = state.monthlySalary !== null || state.accountBalance !== null;
  const eligibilityCache = new Map<string, EligibilityStatus>();
  cardIndex.forEach((entry, key) => {
    eligibilityCache.set(key, evaluateEligibility(state, entry.bank, entry.card));
  });

  const feeFor = (cardKey: string) => {
    const f = eligibilityCache.get(cardKey)?.annualFeePkr;
    return Number.isFinite(f as number) ? (f as number) : null;
  };

  const isCandidate = (cardKey: string, entry: CardSavingsEntry) => {
    if (state.selectedBanks.size > 0 && !state.selectedBanks.has(entry.bank)) return false;
    if (state.selectedCardTypes.size > 0 && !state.selectedCardTypes.has(entry.cardCategory as string)) return false;
    if (state.useEligibility && hasEligibilityInput) {
      if (eligibilityCache.get(cardKey)?.status === "ineligible") return false;
    }
    return true;
  };

  const buildInitialCurrentBest = () => {
    const cb = new Map<string, Map<number, number>>();
    if (!buildOnOwned) return cb;
    state.ownedCards.forEach((ck) => {
      const entry = cardIndex.get(ck);
      if (entry) applyCardToCurrentBest(entry, cb);
    });
    return cb;
  };
  const ownedExclusion = buildOnOwned ? state.ownedCards : new Set<string>();

  const scoreCandidate = (
    marginal: ReturnType<typeof marginalForCard>,
    cardKey: string
  ): number => {
    if (marginal.delta <= 0) return -Infinity;
    if (objective === "coverage") return marginal.coveredVenues;
    if (objective === "roi") {
      const perOutingAtCoveredVenue =
        marginal.delta / Math.max(1, marginal.coveredVenues * totalSelectedDays);
      const hitRate = marginal.coveredVenues / Math.max(1, venueCount);
      const yearlyValue = perOutingAtCoveredVenue * hitRate * outingsPerYear;
      const fee = feeFor(cardKey) || 0;
      return yearlyValue - fee;
    }
    return marginal.delta;
  };

  const passesMixedTypeConstraint = (
    entry: CardSavingsEntry,
    slotsLeft: number,
    missingMandatory: string[]
  ) => {
    if (!requireMixedTypes || missingMandatory.length === 0) return true;
    const freeSlots = slotsLeft - missingMandatory.length;
    if (freeSlots <= 0) return missingMandatory.includes(entry.cardCategory || "other");
    return true;
  };

  const computeMissingMandatory = (categoriesPicked: Set<string>) => {
    if (!requireMixedTypes) return [];
    const need: string[] = [];
    if (!categoriesPicked.has("debit")) need.push("debit");
    if (!categoriesPicked.has("credit")) need.push("credit");
    return need;
  };

  const greedyRun = (forcedFirstKey: string | null): WalletShape | null => {
    const currentBest = buildInitialCurrentBest();
    const pickedKeys = new Set<string>();
    const banksUsed = new Set<string>();
    const categoriesPicked = new Set<string>();
    const picks: WalletPick[] = [];
    let runningFee = 0;

    const recordPick = (
      cardKey: string,
      entry: CardSavingsEntry,
      marginal: ReturnType<typeof marginalForCard>,
      pinned: boolean
    ) => {
      pickedKeys.add(cardKey);
      banksUsed.add(entry.bank);
      categoriesPicked.add(entry.cardCategory || "other");
      const fee = feeFor(cardKey);
      if (Number.isFinite(fee as number)) runningFee += fee as number;
      applyCardToCurrentBest(entry, currentBest);
      picks.push({
        cardKey,
        bank: entry.bank,
        card: entry.card,
        cardCategory: entry.cardCategory as WalletPick["cardCategory"],
        marginalDelta: marginal.delta,
        boostedVenues: marginal.boostedVenues,
        newVenues: marginal.newVenues,
        coveredByCard: marginal.coveredVenues,
        requirementStatus: eligibilityCache.get(cardKey)!,
        pinned,
      });
    };

    const mustList = Array.from(state.walletMustInclude).filter((ck) => !ownedExclusion.has(ck));
    for (const ck of mustList) {
      if (picks.length >= K) break;
      const entry = cardIndex.get(ck);
      if (!entry) continue;
      const m = marginalForCard(entry, currentBest);
      recordPick(ck, entry, m, true);
    }

    if (forcedFirstKey && picks.length < K) {
      if (!pickedKeys.has(forcedFirstKey)) {
        const entry = cardIndex.get(forcedFirstKey);
        if (!entry || ownedExclusion.has(forcedFirstKey) || !isCandidate(forcedFirstKey, entry)) return null;
        const missing = computeMissingMandatory(categoriesPicked);
        if (!passesMixedTypeConstraint(entry, K - picks.length, missing)) return null;
        if (noSameBank && banksUsed.has(entry.bank)) return null;
        const fee = feeFor(forcedFirstKey) || 0;
        if (maxFee !== null && runningFee + fee > maxFee) return null;
        const m = marginalForCard(entry, currentBest);
        if (m.delta <= 0) return null;
        recordPick(forcedFirstKey, entry, m, false);
      }
    }

    while (picks.length < K) {
      const slotsLeft = K - picks.length;
      const missing = computeMissingMandatory(categoriesPicked);
      let bestKey: string | null = null;
      let bestEntry: CardSavingsEntry | null = null;
      let bestMarg: ReturnType<typeof marginalForCard> | null = null;
      let bestScore = -Infinity;
      cardIndex.forEach((entry, key) => {
        if (pickedKeys.has(key)) return;
        if (ownedExclusion.has(key)) return;
        if (!isCandidate(key, entry)) return;
        if (noSameBank && banksUsed.has(entry.bank)) return;
        if (!passesMixedTypeConstraint(entry, slotsLeft, missing)) return;
        const fee = feeFor(key) || 0;
        if (maxFee !== null && runningFee + fee > maxFee) return;
        const m = marginalForCard(entry, currentBest);
        const sc = scoreCandidate(m, key);
        if (sc <= 0) return;
        if (sc > bestScore) {
          bestScore = sc;
          bestKey = key;
          bestEntry = entry;
          bestMarg = m;
        }
      });
      if (!bestKey || !bestEntry || !bestMarg) break;
      recordPick(bestKey, bestEntry, bestMarg, false);
    }
    if (picks.length === 0) return null;

    const summary = summarizeWallet(currentBest, totalSelectedDays, venueCount);
    let totalAnnualFee = 0;
    let feeUnknown = false;
    picks.forEach((p) => {
      const fee = p.requirementStatus?.annualFeePkr;
      if (fee === null || fee === undefined) feeUnknown = true;
      else if (Number.isFinite(fee)) totalAnnualFee += fee;
    });
    const feeBudgetBreached = maxFee !== null && totalAnnualFee > maxFee;
    const mixedTypeSatisfied =
      !requireMixedTypes || (categoriesPicked.has("debit") && categoriesPicked.has("credit"));

    return {
      picks,
      perOutingTotal: summary.perOutingTotal,
      coverage: summary.coverage,
      coveredVenues: summary.coveredVenues,
      venueCount,
      totalAnnualFee,
      feeUnknown,
      feeBudgetBreached,
      mixedTypeSatisfied,
      walletKey: picks.map((p) => p.cardKey).sort().join(" | "),
    };
  };

  if (state.walletMustInclude.size > K) {
    warnings.push(
      `Pinned ${state.walletMustInclude.size} cards but wallet size is ${K}. Only the first ${K} are used. Increase wallet size to include all.`
    );
  }
  if (requireMixedTypes && K < 2) {
    warnings.push(`Mixed-type rule needs wallet size of at least 2.`);
  }

  const seedCurrentBest = buildInitialCurrentBest();
  state.walletMustInclude.forEach((ck) => {
    if (ownedExclusion.has(ck)) return;
    const entry = cardIndex.get(ck);
    if (entry) applyCardToCurrentBest(entry, seedCurrentBest);
  });
  const pinnedKeys = new Set(Array.from(state.walletMustInclude).filter((k) => !ownedExclusion.has(k)));
  const firstPickRanked: { key: string; score: number }[] = [];
  cardIndex.forEach((entry, key) => {
    if (ownedExclusion.has(key) || pinnedKeys.has(key)) return;
    if (!isCandidate(key, entry)) return;
    if (noSameBank) {
      const pinnedBanks = new Set<string>();
      pinnedKeys.forEach((pk) => {
        const e = cardIndex.get(pk);
        if (e) pinnedBanks.add(e.bank);
      });
      if (buildOnOwned)
        state.ownedCards.forEach((ok) => {
          const e = cardIndex.get(ok);
          if (e) pinnedBanks.add(e.bank);
        });
      if (pinnedBanks.has(entry.bank)) return;
    }
    const m = marginalForCard(entry, seedCurrentBest);
    const sc = scoreCandidate(m, key);
    if (sc > 0) firstPickRanked.push({ key, score: sc });
  });
  firstPickRanked.sort((a, b) => b.score - a.score);

  const MAX_WALLETS = 10;
  const MAX_ALT_SEEDS = 30;
  const seenKeys = new Set<string>();
  const wallets: WalletShape[] = [];
  const optimal = greedyRun(null);
  if (optimal) {
    wallets.push(optimal);
    seenKeys.add(optimal.walletKey);
  }
  for (
    let i = 1;
    i < Math.min(firstPickRanked.length, MAX_ALT_SEEDS) && wallets.length < MAX_WALLETS;
    i++
  ) {
    const alt = greedyRun(firstPickRanked[i].key);
    if (alt && !seenKeys.has(alt.walletKey)) {
      wallets.push(alt);
      seenKeys.add(alt.walletKey);
    }
  }

  const refE = wallets.length
    ? wallets[0].perOutingTotal * (0.35 + 0.65 * Math.sqrt(wallets[0].coverage))
    : 1;
  wallets.forEach((w) => {
    const e = w.perOutingTotal * (0.35 + 0.65 * Math.sqrt(w.coverage));
    w.score = Math.max(0, Math.min(100, refE > 0 ? (e / refE) * 100 : 100));
  });

  if (wallets.length > 0) {
    const w = wallets[0];
    if (w.feeBudgetBreached) {
      const over = w.totalAnnualFee - (maxFee || 0);
      warnings.push(
        `Wallet exceeds your fee budget by ${formatCurrency(over)}/year (driven by pinned cards). Unpin or raise the cap.`
      );
    }
    if (requireMixedTypes && !w.mixedTypeSatisfied) {
      warnings.push(
        `Could not include both a debit and a credit card given the other constraints. Try relaxing bank or card-type filters, or raise the fee budget.`
      );
    }
    if (w.picks.length < K) {
      warnings.push(`Only ${w.picks.length} of ${K} cards could be picked under current constraints.`);
    }
  } else if (state.walletMustInclude.size === 0) {
    warnings.push(
      "No wallet possible under current constraints. Try relaxing filters, raising the fee budget, or turning off diversity rules."
    );
  }

  return {
    ranked: wallets,
    stats: {
      K,
      venueCount,
      candidateCount: firstPickRanked.length,
      anchorCount: buildOnOwned ? state.ownedCards.size : 0,
      buildOnOwned,
      objective,
      noSameBank,
      requireMixedTypes,
      maxFee,
      mustIncludeCount: state.walletMustInclude.size,
      warnings,
    },
  };
}

export function computeWalletRestaurantCoverage(state: AlgorithmState) {
  if (!state.data || state.ownedCards.size === 0) return [];
  const effectiveDays = getEffectiveSelectedDays(state);
  const ownedKeys = state.ownedCards;
  const best = new Map<
    string,
    {
      restaurant: string;
      city: string;
      saving: number;
      discountLabel: string;
      discountPct: number;
      daysLabel?: string;
      bestCard: string;
      bestBank: string;
    }
  >();

  state.data.offers.forEach((offer) => {
    if (!cityMatches(state, offer.city)) return;
    if (state.selectedRestaurants.size > 0 && !state.selectedRestaurants.has(offer.restaurant)) return;
    const cardKey = buildCardKey(offer.bank, offer.card);
    if (!ownedKeys.has(cardKey)) return;
    if (!offer.days.some((d) => effectiveDays.has(d))) return;

    const saving = getOfferSavingValue(offer, state.orderValue);
    if (!Number.isFinite(saving as number) || (saving as number) <= 0) return;
    const rk = `${offer.city}|||${offer.restaurant}`;
    const cur = best.get(rk);
    if (!cur || (saving as number) > cur.saving) {
      best.set(rk, {
        restaurant: offer.restaurant,
        city: offer.city,
        saving: saving as number,
        discountLabel: offer.discountLabel,
        discountPct: getOfferDiscountPct(offer) || 0,
        daysLabel: offer.daysLabel,
        bestCard: offer.card,
        bestBank: offer.bank,
      });
    }
  });
  return [...best.values()].sort((a, b) => b.saving - a.saving);
}
