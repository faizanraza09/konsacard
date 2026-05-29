// Pages Function: server-side personalized card ranking.
//
// POST /api/rank with a JSON settings body → the same ranked card list the
// browser (assets/algorithms.js) and the mobile app (src/lib/algorithms.ts)
// compute, but produced at the edge from the full offers dataset. This lets
// the mobile app (or any client) get an exact, personalized ranking — including
// custom bill, day/bank/cuisine filters, and eligibility input — without
// shipping or parsing the ~21 MB raw offers bundle on-device.
//
// The pure compute (computeRanking + applyEligibility) lives in
// lib/eligibility-core.mjs:rankCards, imported by both this Function and the
// parity test, so the online path and the mobile offline fallback agree.
//
// Dataset caching
// ───────────────
// Parsing ~21 MB of offers + the requirements files on every request would be
// wasteful. The parsed dataset (merged offers + restaurant enrichment) and the
// requirements pack are memoized in module-global variables keyed by the
// dataset version (offers-index.json's summaryVersion, falling back to
// generatedAt). offers-index.json is served max-age=0, so the version token is
// always current; a warm isolate reuses the parse until the version changes
// (i.e. until a new deploy), at which point the cache is rebuilt once.

import { rankCards } from "../../lib/eligibility-core.mjs";
import { buildRequirementsPack } from "../../lib/eligibility-core.mjs";

const ALLOWED_CITY_KEYS = new Set(["all", "karachi", "lahore", "islamabad"]);
const DEFAULT_ORDER_VALUE = 10000;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
};

// ── Module-global dataset cache (per warm isolate) ──
// Keyed on the dataset version so a redeploy invalidates it automatically.
let cachedDatasetVersion = null;
let cachedDataset = null; // { offers, restaurantsEnrichment }
let cachedRequirements = null; // requirements pack
let inflight = null; // de-dupe concurrent cold-start loads

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS_HEADERS, ...extraHeaders },
  });
}

function asArray(v) {
  if (Array.isArray(v)) return v;
  if (v == null) return [];
  return [];
}

function clampNumber(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function pickCityKey(raw) {
  const key = String(raw || "all").toLowerCase().trim();
  return ALLOWED_CITY_KEYS.has(key) ? key : "all";
}

// Nullable positive number (salary/balance): null when absent/invalid.
function sanitizeNullableNumber(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function parseSettings(body) {
  const b = body && typeof body === "object" ? body : {};
  return {
    city: pickCityKey(b.city),
    orderValue: clampNumber(b.orderValue, 1000, 50000, DEFAULT_ORDER_VALUE),
    outingsPerWeek: clampNumber(b.outingsPerWeek, 1, Number.MAX_SAFE_INTEGER, 1),
    selectedDays: asArray(b.selectedDays),
    selectedRestaurants: asArray(b.selectedRestaurants),
    selectedBanks: asArray(b.selectedBanks),
    selectedCardTypes: asArray(b.selectedCardTypes),
    selectedCards: asArray(b.selectedCards),
    selectedCuisines: asArray(b.selectedCuisines),
    monthlySalary: sanitizeNullableNumber(b.monthlySalary),
    accountBalance: sanitizeNullableNumber(b.accountBalance),
    useEligibility: !!b.useEligibility,
    limit: Math.round(clampNumber(b.limit, 1, MAX_LIMIT, DEFAULT_LIMIT)),
    offset: Math.round(clampNumber(b.offset, 0, Number.MAX_SAFE_INTEGER, 0)),
  };
}

// Reuse _middleware's ASSETS.fetch pattern: build a Request at the static asset
// path (origin is ignored by the binding) and read it.
async function fetchAssetJson(env, baseUrl, path) {
  const target = new URL(path, baseUrl);
  const res = await env.ASSETS.fetch(new Request(target.toString()));
  if (!res.ok) throw new Error(`ASSETS.fetch ${path} → ${res.status}`);
  return res.json();
}

// Strip a ?v=<hash> cache-bust suffix and resolve to an absolute asset path.
function assetPath(rel) {
  const clean = String(rel).split("?")[0];
  return clean.startsWith("/") ? clean : clean.replace(/^\.\//, "/");
}

// Load + parse the dataset and requirements once per dataset version. Concurrent
// cold-start requests share a single in-flight load.
async function loadDataset(env, baseUrl) {
  const index = await fetchAssetJson(env, baseUrl, "/data/offers-index.json");
  const version = index.summaryVersion || index.generatedAt || "unknown";

  if (cachedDatasetVersion === version && cachedDataset && cachedRequirements) {
    return { dataset: cachedDataset, requirements: cachedRequirements, version };
  }
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const cities = Array.isArray(index.cities) ? index.cities : [];
      const cityFetches = cities.map((city) => {
        const rel = index.cityFiles?.[city];
        if (!rel) return Promise.resolve({ offers: [] });
        return fetchAssetJson(env, baseUrl, assetPath(rel)).catch(() => ({ offers: [] }));
      });

      const restaurantsFetch = index.restaurantsFile
        ? fetchAssetJson(env, baseUrl, assetPath(index.restaurantsFile)).catch(() => ({ restaurants: {} }))
        : Promise.resolve({ restaurants: {} });

      // Inferred cuisines fill gaps Peekaboo doesn't cover; best-effort.
      const inferredFetch = fetchAssetJson(env, baseUrl, "/data/inferred_cuisines.json").catch(
        () => ({ restaurants: {} }),
      );

      // Requirements (for fee penalty + eligibility); best-effort.
      const reqFetch = Promise.all([
        fetchAssetJson(env, baseUrl, "/data/card-requirements/normalized/card_requirements.json").catch(() => null),
        fetchAssetJson(env, baseUrl, "/data/card-requirements/normalized/deal_requirement_card_map.json").catch(() => null),
      ]);

      const [cityResults, restaurantsResult, inferredResult, [reqRecords, reqMappings]] = await Promise.all([
        Promise.all(cityFetches),
        restaurantsFetch,
        inferredFetch,
        reqFetch,
      ]);

      const offers = cityResults.flatMap((r) => r.offers || []);

      // Peekaboo wins; inferred cuisines only fill gaps (mirrors mobile loadOffers).
      const restaurantsEnrichment = { ...(restaurantsResult.restaurants || {}) };
      for (const [name, cuisines] of Object.entries(inferredResult.restaurants || {})) {
        if (!Array.isArray(cuisines) || cuisines.length === 0) continue;
        if (!restaurantsEnrichment[name]) restaurantsEnrichment[name] = { servesCuisine: cuisines };
      }

      const requirements = reqRecords ? buildRequirementsPack(reqRecords, reqMappings) : null;

      cachedDataset = { offers, restaurantsEnrichment };
      cachedRequirements = requirements;
      cachedDatasetVersion = version;
      return { dataset: cachedDataset, requirements: cachedRequirements, version };
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed. Use POST." }, 405, { allow: "POST, OPTIONS" });
  }

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body." }, 400);
    }

    const settings = parseSettings(body);
    const { dataset, requirements } = await loadDataset(env, request.url);

    const { recs, totalVenueCount, scoringVenueCount } = rankCards({
      offers: dataset.offers,
      restaurantsEnrichment: dataset.restaurantsEnrichment,
      requirements,
      settings,
    });

    const total = recs.length;
    const start = Math.min(settings.offset, total);
    const page = recs.slice(start, start + settings.limit);

    return jsonResponse(
      { recs: page, totalVenueCount, scoringVenueCount, total },
      200,
      // Short edge cache so daily-refresh deploys propagate quickly. Cloudflare
      // keys the edge cache by URL + method + body for POST when configured;
      // we keep it simple and rely on per-isolate dataset reuse for warm speed.
      { "cache-control": "public, max-age=300, s-maxage=300" },
    );
  } catch (err) {
    console.error("[api/rank] error:", err && err.message);
    return jsonResponse({ error: "Failed to compute ranking." }, 500);
  }
}
