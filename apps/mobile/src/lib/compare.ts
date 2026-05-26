import { AlgorithmState, Offer } from "@/types";
import { DAY_SHORT, normalizeCityValue } from "./format";
import { getOfferSavingValue } from "./savings";

// Mirror of web's `getCompareRestaurantRows` + `getExclusiveRestaurantCounts`
// (apps/web/assets/app.js). Reimplemented here rather than imported because
// the mobile algorithms are isolated from the web's global `state` object.

export interface CompareRestaurantEntry {
  saving: number;
  discountLabel?: string;
  offerTitle?: string;
  capPkr: number | null;
  daysLabel: string;
}

export interface CompareRestaurantRow {
  venueKey: string;
  city: string;
  restaurant: string;
  entries: (CompareRestaurantEntry | null)[];
  strongestSaving: number;
}

function cityMatches(state: AlgorithmState, city: string) {
  const sel = normalizeCityValue(state.selectedCity);
  return sel === "all" || sel === normalizeCityValue(city);
}

function cardTypeMatches(state: AlgorithmState, cat?: string | null): boolean {
  if (state.selectedCardTypes.size === 0) return true;
  return cat ? state.selectedCardTypes.has(cat) : false;
}

function effectiveDays(state: AlgorithmState): Set<number> {
  if (state.selectedDays.size > 0) return state.selectedDays;
  const len = state.data?.dayNames.length ?? 7;
  const all = new Set<number>();
  for (let i = 0; i < len; i++) all.add(i);
  return all;
}

export function getCompareRestaurantRows(
  state: AlgorithmState,
  compareKeys: string[]
): CompareRestaurantRow[] {
  if (!state.data || compareKeys.length !== 2) return [];
  const days = effectiveDays(state);
  const keySet = new Set(compareKeys);
  const byVenue = new Map<
    string,
    {
      venueKey: string;
      city: string;
      restaurant: string;
      byCard: Map<string, Map<number, CompareRestaurantEntry & { _raw: Offer }>>;
    }
  >();

  state.data.offers.forEach((offer) => {
    if (!cityMatches(state, offer.city)) return;
    if (!cardTypeMatches(state, offer.cardCategory)) return;
    if (
      state.selectedRestaurants.size > 0 &&
      !state.selectedRestaurants.has(offer.restaurant)
    ) {
      return;
    }
    const cardKey = `${offer.bank} || ${offer.card}`;
    if (!keySet.has(cardKey)) return;

    const saving = getOfferSavingValue(offer, state.orderValue);
    if (!Number.isFinite(saving as number) || (saving as number) <= 0) return;

    const venueKey = `${offer.city}|||${offer.restaurant}`;
    if (!byVenue.has(venueKey)) {
      byVenue.set(venueKey, {
        venueKey,
        city: offer.city,
        restaurant: offer.restaurant,
        byCard: new Map(compareKeys.map((k) => [k, new Map()])),
      });
    }
    const bucket = byVenue.get(venueKey)!.byCard.get(cardKey)!;
    days.forEach((day) => {
      if (!offer.days.includes(day)) return;
      const current = bucket.get(day);
      const candidate = {
        saving: saving as number,
        discountLabel: offer.discountLabel,
        offerTitle: offer.offerTitle,
        capPkr: offer.capPkr ?? null,
        daysLabel: "",
        _raw: offer,
      };
      if (!current || candidate.saving > current.saving) bucket.set(day, candidate);
    });
  });

  const summarize = (
    dayMap: Map<number, CompareRestaurantEntry & { _raw: Offer }> | undefined
  ): CompareRestaurantEntry | null => {
    if (!dayMap || dayMap.size === 0) return null;
    const entries = Array.from(dayMap.entries()).sort((a, b) => a[0] - b[0]);
    const strongest = entries.reduce(
      (best, [, entry]) => (!best || entry.saving > best.saving ? entry : best),
      null as (CompareRestaurantEntry & { _raw: Offer }) | null
    );
    if (!strongest) return null;
    const daysLabel =
      entries.length === days.size
        ? "All chosen days"
        : entries.map(([day]) => DAY_SHORT[day]).join(", ");
    return {
      saving: strongest.saving,
      discountLabel: strongest.discountLabel,
      offerTitle: strongest.offerTitle,
      capPkr: strongest.capPkr,
      daysLabel,
    };
  };

  return Array.from(byVenue.values())
    .map((venue) => {
      const entries = compareKeys.map((k) => summarize(venue.byCard.get(k)));
      if (entries.every((e) => !e)) return null;
      const strongestSaving = Math.max(...entries.map((e) => e?.saving ?? 0));
      return {
        venueKey: venue.venueKey,
        city: venue.city,
        restaurant: venue.restaurant,
        entries,
        strongestSaving,
      };
    })
    .filter((row): row is CompareRestaurantRow => row !== null)
    .sort((a, b) => {
      const aShared = a.entries.every(Boolean) ? 1 : 0;
      const bShared = b.entries.every(Boolean) ? 1 : 0;
      if (bShared !== aShared) return bShared - aShared;
      if (b.strongestSaving !== a.strongestSaving) return b.strongestSaving - a.strongestSaving;
      return a.restaurant.localeCompare(b.restaurant);
    });
}

export function getExclusiveRestaurantCounts(
  state: AlgorithmState,
  key1: string,
  key2: string
): [number, number] {
  if (!state.data) return [0, 0];
  const [b1, c1] = key1.split(" || ");
  const [b2, c2] = key2.split(" || ");
  const venuesFor = (bank: string, card: string) => {
    const set = new Set<string>();
    state.data!.offers.forEach((o) => {
      if (o.bank === bank && o.card === card && cityMatches(state, o.city)) {
        set.add(o.restaurant);
      }
    });
    return set;
  };
  const r1 = venuesFor(b1, c1);
  const r2 = venuesFor(b2, c2);
  let only1 = 0;
  let only2 = 0;
  r1.forEach((r) => {
    if (!r2.has(r)) only1++;
  });
  r2.forEach((r) => {
    if (!r1.has(r)) only2++;
  });
  return [only1, only2];
}

export type CompareDirection = "high" | "low" | "none";

export function compareRowWinner(
  vals: (number | null | undefined)[],
  direction: CompareDirection
): -1 | 0 | 1 {
  if (direction === "none") return -1;
  const [a, b] = vals;
  if (!Number.isFinite(a as number) || !Number.isFinite(b as number)) return -1;
  if (a === b) return -1;
  if (direction === "low") return (a as number) < (b as number) ? 0 : 1;
  return (a as number) > (b as number) ? 0 : 1;
}
