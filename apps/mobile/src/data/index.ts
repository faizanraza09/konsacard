import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  AlgorithmState,
  CardRecommendation,
  OffersBundle,
  OffersIndex,
  RequirementMapping,
  RequirementRecord,
  RequirementsPack,
  RestaurantEnrichment,
  SummaryBundle,
} from "@/types";
import { buildDealCardKey } from "@/lib/format";
import { buildEstimatesByTier } from "@/lib/eligibility";

// Web app lives at https://konsacard.pk. The data files are served from the
// same origin and CORS-permitted. Override in dev via EXPO_PUBLIC_DATA_ORIGIN.
const DEFAULT_ORIGIN = "https://konsacard.pk";
function dataOrigin(): string {
  const env = (process.env.EXPO_PUBLIC_DATA_ORIGIN || "").replace(/\/$/, "");
  return env || DEFAULT_ORIGIN;
}

const CACHE_KEY_REQS = "konsacard-cache-reqs-v1";
const CACHE_KEY_SUMMARY = "konsacard-cache-summary-v1";

// Server ranking API. ON by default; set EXPO_PUBLIC_USE_RANK_API=0/false/off to
// force the local summary/raw path. When on, the Cards-list ranking is fetched
// from POST {origin}/api/rank so the phone never parses the ~21 MB raw bundle
// while online; on any failure the caller falls back to the local compute.
export function rankApiEnabled(): boolean {
  const raw = (process.env.EXPO_PUBLIC_USE_RANK_API || "").trim().toLowerCase();
  if (!raw) return true; // default ON when unset
  return !(raw === "0" || raw === "false" || raw === "off" || raw === "no");
}

const RANK_API_TIMEOUT_MS = 8000;

interface RankApiOptions {
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
}

/**
 * Fetches a fully-scored, eligibility-baked, pre-sorted card ranking from the
 * server. Serializes only the algorithm settings (Sets → arrays); never sends
 * the raw `data`, `requirements`, or wallet fields. Aborts after
 * RANK_API_TIMEOUT_MS and throws on timeout/non-2xx so callers can fall back to
 * the local raw compute (this thrown error is also the offline signal — we
 * don't ship a separate native NetInfo dep).
 */
export async function rankViaApi(
  state: AlgorithmState,
  opts: RankApiOptions = {}
): Promise<CardRecommendation[]> {
  const payload = {
    city: state.selectedCity,
    orderValue: state.orderValue,
    selectedDays: Array.from(state.selectedDays),
    selectedRestaurants: Array.from(state.selectedRestaurants),
    selectedBanks: Array.from(state.selectedBanks),
    selectedCardTypes: Array.from(state.selectedCardTypes),
    selectedCards: Array.from(state.selectedCards),
    selectedCuisines: Array.from(state.selectedCuisines),
    monthlySalary: state.monthlySalary,
    accountBalance: state.accountBalance,
    useEligibility: state.useEligibility,
    outingsPerWeek: state.outingsPerWeek,
    ...(opts.limit !== undefined ? { limit: opts.limit } : {}),
    ...(opts.offset !== undefined ? { offset: opts.offset } : {}),
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RANK_API_TIMEOUT_MS);
  // Honor a caller-provided signal (e.g. scope changed) in addition to timeout.
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort();
    else opts.signal.addEventListener("abort", () => controller.abort());
  }
  try {
    const res = await fetch(`${dataOrigin()}/api/rank`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} from /api/rank`);
    const json = (await res.json()) as { recs?: CardRecommendation[] };
    return Array.isArray(json.recs) ? json.recs : [];
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return (await res.json()) as T;
}

function resolveUrl(rel: string): string {
  if (/^https?:\/\//i.test(rel)) return rel;
  const path = rel.replace(/^\.\//, "/").replace(/^\//, "/");
  return `${dataOrigin()}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * LAZY raw-offers path. Fetches the offers index, then in parallel the city
 * files + restaurants enrichment, and merges into a single bundle.
 *
 * This bundle is ~21 MB parsed and is NOT written to AsyncStorage (the old
 * `CACHE_KEY_OFFERS` write is gone — see #5). It is held in memory for the
 * session only and re-fetched on next launch (raw is ~640 KB brotli, cheap).
 * The cold-start path uses `loadSummary()` instead; this only runs when a
 * screen actually needs per-offer data (filters, detail, wallet, swipe, chat).
 */
export async function loadOffers(): Promise<OffersBundle> {
  const indexUrl = `${dataOrigin()}/data/offers-index.json`;
  const index = await fetchJson<OffersIndex>(indexUrl);

  const cityFetches = index.cities.map(async (city) => {
    const rel = index.cityFiles[city];
    if (!rel) return { offers: [] as OffersBundle["offers"] };
    try {
      return await fetchJson<{ offers: OffersBundle["offers"] }>(resolveUrl(rel));
    } catch (err) {
      console.warn(`[offers] failed to load ${rel}:`, err);
      return { offers: [] as OffersBundle["offers"] };
    }
  });

  const restaurantsFetch = index.restaurantsFile
    ? fetchJson<{ restaurants: Record<string, RestaurantEnrichment> }>(
        resolveUrl(index.restaurantsFile)
      ).catch((err) => {
        console.warn(`[offers] failed to load ${index.restaurantsFile}:`, err);
        return { restaurants: {} };
      })
    : Promise.resolve({ restaurants: {} as Record<string, RestaurantEnrichment> });

  // Inferred cuisines: LLM-tagged taxonomy for restaurants Peekaboo doesn't
  // cover (NBP/Easypaisa long-tail). Best-effort: silently skipped if absent.
  // Peekaboo wins on conflicts since it's the authoritative source.
  const inferredFetch = fetchJson<{ restaurants: Record<string, string[]> }>(
    `${dataOrigin()}/data/inferred_cuisines.json`
  ).catch(() => ({ restaurants: {} as Record<string, string[]> }));

  const [cityResults, restaurantsResult, inferredResult] = await Promise.all([
    Promise.all(cityFetches),
    restaurantsFetch,
    inferredFetch,
  ]);
  const offers = cityResults.flatMap((r) => r.offers || []);
  const restaurantsEnrichment: Record<string, RestaurantEnrichment> = {
    ...(restaurantsResult.restaurants || {}),
  };
  for (const [name, cuisines] of Object.entries(inferredResult.restaurants || {})) {
    if (!Array.isArray(cuisines) || cuisines.length === 0) continue;
    if (!restaurantsEnrichment[name]) {
      restaurantsEnrichment[name] = { servesCuisine: cuisines };
    }
  }

  const bundle: OffersBundle = {
    generatedAt: index.generatedAt,
    dayNames: index.dayNames,
    offers,
    restaurantsEnrichment,
    stats: index.stats,
  };

  // NOTE: intentionally NOT cached to AsyncStorage — the parsed bundle is
  // ~21 MB and the brotli download is cheap. See #5.
  return bundle;
}

/**
 * Cold-start data path. Fetches `offers-index.json`; if it advertises a
 * `summaryFile` + `summaryVersion`, fetches the small precomputed summary and
 * merges in the index meta needed to render the Cards tab + city tabs. The
 * summary is cached in AsyncStorage (small) and used as a fallback on network
 * failure.
 *
 * Returns null when the index has no summary (caller should fall back to
 * `loadOffers`). Throws only when the index can't be fetched AND there is no
 * cached summary to fall back to.
 */
export async function loadSummary(): Promise<SummaryBundle | null> {
  const indexUrl = `${dataOrigin()}/data/offers-index.json`;
  let index: OffersIndex;
  try {
    index = await fetchJson<OffersIndex>(indexUrl);
  } catch (err) {
    const cached = await readCache<SummaryBundle>(CACHE_KEY_SUMMARY);
    if (cached) return cached;
    throw err;
  }

  if (!index.summaryFile || !index.summaryVersion) {
    // No summary advertised — caller falls back to raw offers.
    return null;
  }

  const summaryPath = index.summaryFile.replace(/^\./, "");
  const summaryUrl = `${dataOrigin()}${summaryPath}?v=${index.summaryVersion}`;

  let raw: {
    splitFormat: string;
    orderValue: number;
    scopes: SummaryBundle["scopes"];
    restaurantDeals: SummaryBundle["restaurantDeals"];
    facets: SummaryBundle["facets"];
  };
  try {
    raw = await fetchJson<typeof raw>(summaryUrl);
  } catch (err) {
    const cached = await readCache<SummaryBundle>(CACHE_KEY_SUMMARY);
    if (cached) return cached;
    throw err;
  }

  const summary: SummaryBundle = {
    splitFormat: raw.splitFormat,
    orderValue: raw.orderValue,
    scopes: raw.scopes,
    restaurantDeals: raw.restaurantDeals,
    facets: raw.facets,
    generatedAt: index.generatedAt,
    dayNames: index.dayNames,
    cities: index.cities,
    restaurantsByCity: index.restaurantsByCity,
    stats: index.stats,
  };

  await writeCache<SummaryBundle>(CACHE_KEY_SUMMARY, summary);
  return summary;
}

/**
 * Loads the normalized card-requirements files plus the deal-side mapping and
 * builds the in-memory pack used by evaluateEligibility.
 */
export async function loadRequirements(): Promise<RequirementsPack> {
  const reqUrl = `${dataOrigin()}/data/card-requirements/normalized/card_requirements.json`;
  const mapUrl = `${dataOrigin()}/data/card-requirements/normalized/deal_requirement_card_map.json`;

  try {
    const [records, mappings] = await Promise.all([
      fetchJson<RequirementRecord[]>(reqUrl),
      fetchJson<RequirementMapping[] | { mappings: RequirementMapping[] }>(mapUrl),
    ]);

    const byCardId = new Map<string, RequirementRecord>();
    records.forEach((r) => byCardId.set(r.card_id, r));

    // The mapping JSON stores deal_bank_name + deal_card_name rather than a
    // pre-built key. Match the web's loader: compute the key the same way.
    const list = Array.isArray(mappings) ? mappings : mappings.mappings;
    const mappingByDealKey = new Map<string, RequirementMapping>();
    list.forEach((m) => {
      const row = m as unknown as {
        deal_bank_name?: string;
        deal_card_name?: string;
        matched?: boolean;
        requirement_card_id?: string;
      };
      if (!row.deal_bank_name || !row.deal_card_name) return;
      const key = buildDealCardKey(row.deal_bank_name, row.deal_card_name);
      mappingByDealKey.set(key, {
        deal_card_key: key,
        matched: !!row.matched,
        requirement_card_id: row.requirement_card_id ?? null,
      });
    });

    const estimatesByTier = buildEstimatesByTier(records);
    const pack: RequirementsPack = {
      available: true,
      byCardId,
      mappingByDealKey,
      estimatesByTier,
    };

    await writeCache(CACHE_KEY_REQS, { records, mappings: list });
    return pack;
  } catch (err) {
    const cached = await readCache<{
      records: RequirementRecord[];
      mappings: RequirementMapping[];
    }>(CACHE_KEY_REQS);
    if (cached) {
      const byCardId = new Map<string, RequirementRecord>();
      cached.records.forEach((r) => byCardId.set(r.card_id, r));
      const mappingByDealKey = new Map<string, RequirementMapping>();
      cached.mappings.forEach((m) => {
        if (m.deal_card_key) mappingByDealKey.set(m.deal_card_key, m);
      });
      return {
        available: true,
        byCardId,
        mappingByDealKey,
        estimatesByTier: buildEstimatesByTier(cached.records),
      };
    }
    console.warn("[requirements] load failed and no cache:", err);
    return {
      available: false,
      byCardId: new Map(),
      mappingByDealKey: new Map(),
      estimatesByTier: new Map(),
    };
  }
}

async function readCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeCache<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Cache write is best-effort; ignore.
  }
}

export function lookupCardKey(bank: string, card: string): string {
  return `${bank} || ${card}`;
}

export { buildDealCardKey };
