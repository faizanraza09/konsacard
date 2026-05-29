import type {
  AlgorithmState,
  CardRecommendation,
  NextCardResult,
  WalletResult,
} from "@/types";
import {
  computeNextCardRecommendations as rawNextCard,
  computeRecommendations as rawRecommendations,
  computeWalletRecommendations as rawWallet,
} from "./algorithms";
import { computeRestaurantDeals as rawRestaurantDeals, type RestaurantDeal } from "./restaurants";

// ---------------------------------------------------------------------------
// Result cache for the heavy recommendation/wallet/deal computations.
//
// The compute functions are deterministic for a given set of algorithm inputs,
// but they were being re-run on every tab mount (the per-screen `useMemo` is
// thrown away on unmount) and on every unrelated state change (the screens key
// their memo on the whole store object, so toggling "compare" or a loading flag
// invalidated it). On an old phone these recomputes are the dominant cost when
// switching cities/filters and moving between tabs.
//
// This module wraps each compute function in a tiny module-level LRU keyed by a
// signature of ONLY the inputs that actually change the result. Because it lives
// at module scope (not in a component), the cache survives tab unmount/remount,
// so revisiting a tab — or a city/scope you've already seen — is instant.
// ---------------------------------------------------------------------------

// Stable per-object ids so the loaded dataset + requirements contribute to the
// cache key without serialising ~21 MB. Offers load once per session, so these
// ids are effectively constant, but keying on identity keeps us correct if the
// data is ever replaced (e.g. summary path -> raw path).
const objIds = new WeakMap<object, number>();
let nextObjId = 1;
function objId(o: object | null | undefined): number {
  if (!o) return 0;
  let id = objIds.get(o);
  if (id === undefined) {
    id = nextObjId++;
    objIds.set(o, id);
  }
  return id;
}

function setSig(s: Set<unknown>): string {
  // Sets here are small (days, selected filters, owned cards); sort so the key
  // is order-independent.
  return Array.from(s, String).sort().join(",");
}

function num(n: number | null): string {
  return n === null ? "_" : String(n);
}

// Inputs shared by every computation: the dataset + the common filter scope.
function baseKey(s: AlgorithmState): string {
  return [
    objId(s.data),
    objId(s.requirements),
    s.selectedCity,
    setSig(s.selectedDays),
    setSig(s.selectedRestaurants),
    setSig(s.selectedBanks),
    setSig(s.selectedCardTypes),
    setSig(s.selectedCards),
    setSig(s.selectedCuisines),
    s.orderValue,
    s.useEligibility ? 1 : 0,
    num(s.monthlySalary),
    num(s.accountBalance),
    s.outingsPerWeek,
  ].join("|");
}

const recommendationsKey = baseKey;
const restaurantDealsKey = baseKey;

function nextCardKey(s: AlgorithmState): string {
  return `${baseKey(s)}#own:${setSig(s.ownedCards)}`;
}

function walletKey(s: AlgorithmState): string {
  return [
    baseKey(s),
    `own:${setSig(s.ownedCards)}`,
    `k:${s.walletSize}`,
    `bo:${s.walletBuildOnOwned ? 1 : 0}`,
    `mf:${num(s.walletMaxFee)}`,
    `nsb:${s.walletNoSameBank ? 1 : 0}`,
    `mt:${s.walletMixedTypes ? 1 : 0}`,
    `obj:${s.walletObjective}`,
    `inc:${setSig(s.walletMustInclude)}`,
  ].join("|");
}

interface Lru<R> {
  get(key: string): R | undefined;
  set(key: string, value: R): void;
}

function makeLru<R>(capacity: number): Lru<R> {
  const map = new Map<string, R>();
  return {
    get(key) {
      const v = map.get(key);
      if (v !== undefined) {
        // Bump to most-recently-used.
        map.delete(key);
        map.set(key, v);
      }
      return v;
    },
    set(key, value) {
      if (map.has(key)) map.delete(key);
      map.set(key, value);
      if (map.size > capacity) {
        const oldest = map.keys().next().value;
        if (oldest !== undefined) map.delete(oldest);
      }
    },
  };
}

export interface Cached<R> {
  (state: AlgorithmState): R;
  /** Build the cache key for `state` — use as a `useMemo` dependency so the
   * memo only recomputes when an input that affects the result changes. */
  key(state: AlgorithmState): string;
  /** Return the cached result for `state` without computing, or undefined on a
   * miss. Lets callers defer the expensive first compute past an animation. */
  peek(state: AlgorithmState): R | undefined;
}

function makeCached<R>(
  fn: (state: AlgorithmState) => R,
  keyOf: (state: AlgorithmState) => string,
  capacity: number
): Cached<R> {
  const lru = makeLru<R>(capacity);
  const wrapped = ((state: AlgorithmState): R => {
    const k = keyOf(state);
    const hit = lru.get(k);
    if (hit !== undefined) return hit;
    const result = fn(state);
    lru.set(k, result);
    return result;
  }) as Cached<R>;
  wrapped.key = keyOf;
  wrapped.peek = (state) => lru.get(keyOf(state));
  return wrapped;
}

export const cachedRecommendations: Cached<CardRecommendation[]> = makeCached(
  rawRecommendations,
  recommendationsKey,
  16
);

export const cachedNextCardRecommendations: Cached<NextCardResult> = makeCached(
  rawNextCard,
  nextCardKey,
  12
);

// Wallet optimisation is the heaviest call and its inputs change less often;
// a smaller cache is plenty and keeps memory down.
export const cachedWalletRecommendations: Cached<WalletResult> = makeCached(
  rawWallet,
  walletKey,
  8
);

// Restaurant deals nest a recommendations pass. Inject the *cached* recommender
// so that if the same scope was already computed for the Cards tab, the nested
// pass is a cache hit instead of a full recompute.
export const cachedRestaurantDeals: Cached<RestaurantDeal[]> = makeCached(
  (state) => rawRestaurantDeals(state, cachedRecommendations),
  restaurantDealsKey,
  12
);
