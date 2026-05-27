import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  OffersBundle,
  OffersIndex,
  RequirementMapping,
  RequirementRecord,
  RequirementsPack,
  RestaurantEnrichment,
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

const CACHE_KEY_OFFERS = "konsacard-cache-offers-v1";
const CACHE_KEY_REQS = "konsacard-cache-reqs-v1";

type CachedOffers = { generatedAt: string; bundle: OffersBundle };

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
 * Fetches the offers index, then in parallel the city files + restaurants
 * enrichment, and merges into a single bundle. Falls back to a cached copy if
 * the network call fails. Refreshes the cache when the index's generatedAt is
 * newer than the cached one.
 */
export async function loadOffers(): Promise<OffersBundle> {
  const indexUrl = `${dataOrigin()}/data/offers-index.json`;
  let index: OffersIndex | null = null;

  try {
    index = await fetchJson<OffersIndex>(indexUrl);
  } catch (err) {
    // Network failure: try cache. If no cache either, rethrow.
    const cached = await readCache<CachedOffers>(CACHE_KEY_OFFERS);
    if (cached) return cached.bundle;
    throw err;
  }

  const cached = await readCache<CachedOffers>(CACHE_KEY_OFFERS);
  if (cached && cached.generatedAt === index.generatedAt) {
    return cached.bundle;
  }

  const cityFetches = index.cities.map(async (city) => {
    const rel = index!.cityFiles[city];
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
        console.warn(`[offers] failed to load ${index!.restaurantsFile}:`, err);
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

  await writeCache<CachedOffers>(CACHE_KEY_OFFERS, {
    generatedAt: index.generatedAt,
    bundle,
  });
  return bundle;
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
