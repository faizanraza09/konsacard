import { AlgorithmState, CardRecommendation, Offer, RestaurantEnrichment } from "@/types";
import { computeRecommendations } from "./algorithms";
import { normalizeCityValue } from "./format";
import { getOfferDiscountPct, getOfferSavingValue } from "./savings";

export interface RestaurantDeal {
  restaurant: string;
  city: string;
  bestSaving: number;
  bestCard: string;
  bestBank: string;
  bestDiscountPct: number | null;
  bestDiscountLabel?: string;
  daysLabel?: string;
  offerCount: number;
}

function cityMatches(state: AlgorithmState, city: string) {
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

export function computeRestaurantDeals(
  state: AlgorithmState,
  // The set of "valid" cards is just the recommendations for the same scope.
  // Callers inject the cached recommender (see computeCache) so this nested
  // pass reuses the Cards-tab result instead of recomputing from scratch.
  recommend: (s: AlgorithmState) => CardRecommendation[] = computeRecommendations
): RestaurantDeal[] {
  if (!state.data) return [];
  const validKeys = new Set(
    recommend(state).map((r) => `${r.bank} || ${r.card}`)
  );
  const effectiveDays = getEffectiveSelectedDays(state);
  const cuisineFilter = state.selectedCuisines;
  const hasCuisineFilter = cuisineFilter && cuisineFilter.size > 0;
  const enrichment: Record<string, RestaurantEnrichment> =
    state.data.restaurantsEnrichment || {};

  const best = new Map<
    string,
    {
      restaurant: string;
      city: string;
      saving: number;
      bestCard: string;
      bestBank: string;
      discountPct: number;
      discountLabel?: string;
      daysLabel?: string;
      offerCount: number;
    }
  >();

  state.data.offers.forEach((offer: Offer) => {
    if (!cityMatches(state, offer.city)) return;
    if (!validKeys.has(`${offer.bank} || ${offer.card}`)) return;
    if (state.selectedRestaurants.size > 0 && !state.selectedRestaurants.has(offer.restaurant)) return;
    if (!offer.days.some((d) => effectiveDays.has(d))) return;
    if (hasCuisineFilter) {
      const cuisines = enrichment[offer.restaurant]?.servesCuisine || [];
      if (!cuisines.some((c) => cuisineFilter.has(c))) return;
    }
    const saving = getOfferSavingValue(offer, state.orderValue);
    if (!Number.isFinite(saving as number) || (saving as number) <= 0) return;

    const rk = `${offer.city}|||${offer.restaurant}`;
    const cur = best.get(rk);
    const candidate = {
      restaurant: offer.restaurant,
      city: offer.city,
      saving: saving as number,
      bestCard: offer.card,
      bestBank: offer.bank,
      discountPct: getOfferDiscountPct(offer) || 0,
      discountLabel: offer.discountLabel,
      daysLabel: offer.daysLabel,
      offerCount: (cur?.offerCount || 0) + 1,
    };
    if (!cur || candidate.saving > cur.saving) {
      best.set(rk, candidate);
    } else {
      cur.offerCount = candidate.offerCount;
    }
  });

  return Array.from(best.values())
    .sort((a, b) => b.saving - a.saving)
    .map((d) => ({
      restaurant: d.restaurant,
      city: d.city,
      bestSaving: d.saving,
      bestCard: d.bestCard,
      bestBank: d.bestBank,
      bestDiscountPct: d.discountPct || null,
      bestDiscountLabel: d.discountLabel,
      daysLabel: d.daysLabel,
      offerCount: d.offerCount,
    }));
}
