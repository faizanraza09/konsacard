// @ts-check
/**
 * Data layer shape tests.
 *
 * These would have caught the May 2026 cuisine-UI regression: the merge
 * scripts dropped the `restaurants` enrichment from offers.json, so the
 * split script never wrote `restaurantsFile` into offers-index.json,
 * and the frontend's cuisine section silently stayed `display:none`.
 *
 * Pattern: anything that loads from /data/ at runtime should have its
 * shape asserted here. If a future refactor changes the data layout
 * the UI consumes, these tests fail loudly instead of silently breaking
 * a feature.
 */
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const DATA_DIR = path.resolve(__dirname, '..', 'data');

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf-8'));
}

test.describe('offers-index.json shape', () => {
  /** @type {Record<string, any>} */
  let index;
  test.beforeAll(() => { index = readJson('offers-index.json'); });

  test('has the required top-level keys', () => {
    for (const k of ['generatedAt', 'dayNames', 'cities', 'restaurantsByCity', 'stats', 'cityFiles', 'splitFormat']) {
      expect(index, `missing required key "${k}" in offers-index.json`).toHaveProperty(k);
    }
  });

  test('dayNames is exactly Mon..Sun in order', () => {
    expect(index.dayNames).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
  });

  test('cityFiles points at files that actually exist on disk', () => {
    for (const [city, urlPath] of Object.entries(index.cityFiles)) {
      // Strip the ?v=<hash> cache-bust suffix before resolving to a local path.
      const rel = String(urlPath).split('?')[0].replace(/^\.\/data\//, '');
      const full = path.join(DATA_DIR, rel);
      expect(fs.existsSync(full), `cityFiles["${city}"] points at "${urlPath}" but ${full} does not exist on disk`).toBe(true);
    }
  });

  test('stats counts are positive integers', () => {
    for (const k of ['offers', 'cards', 'banks', 'restaurants']) {
      expect(index.stats[k], `stats.${k} must be a positive integer`).toBeGreaterThan(0);
    }
  });

  test('IF /data/offers-restaurants.json exists on disk, index references it via restaurantsFile', () => {
    // This is the regression-specific assertion: enrichment file on disk
    // but no restaurantsFile in index = silent cuisine-UI breakage.
    const enrichmentPath = path.join(DATA_DIR, 'offers-restaurants.json');
    if (!fs.existsSync(enrichmentPath)) {
      test.skip(true, 'no enrichment file on disk — nothing to reference');
      return;
    }
    expect(
      index.restaurantsFile,
      'offers-restaurants.json exists on disk but offers-index.json has no restaurantsFile — the cuisine section in the UI will silently stay hidden because the loader has no path to fetch enrichment from.'
    ).toBeTruthy();
    // Allow the ?v=<hash> cache-bust suffix the precompute stamps on.
    expect(index.restaurantsFile).toMatch(/offers-restaurants\.json(\?v=[a-f0-9]+)?$/);
  });
});

test.describe('offers-restaurants.json shape (when present)', () => {
  /** @type {string} */
  const enrichmentPath = path.join(DATA_DIR, 'offers-restaurants.json');

  test('has restaurants map + at least one entry with cuisines', () => {
    if (!fs.existsSync(enrichmentPath)) {
      test.skip(true, 'no enrichment file on disk');
      return;
    }
    const enr = readJson('offers-restaurants.json');
    expect(enr).toHaveProperty('restaurants');
    expect(typeof enr.restaurants, 'restaurants must be a name→record map').toBe('object');
    const entries = Object.entries(enr.restaurants);
    expect(entries.length, 'restaurants map is empty').toBeGreaterThan(50);
    const withCuisines = entries.filter(([, v]) => Array.isArray(/** @type {any} */ (v)?.servesCuisine) && /** @type {any} */ (v).servesCuisine.length > 0);
    expect(withCuisines.length, 'no restaurant has any servesCuisine — cuisine UI will load but show nothing').toBeGreaterThan(20);
  });
});

test.describe('inferred_cuisines.json shape (when present)', () => {
  const inferredPath = path.join(DATA_DIR, 'inferred_cuisines.json');

  test('has restaurants map keyed by names that exist in offers.json', () => {
    if (!fs.existsSync(inferredPath)) {
      test.skip(true, 'inferred_cuisines.json not present');
      return;
    }
    const doc = readJson('inferred_cuisines.json');
    expect(doc).toHaveProperty('restaurants');
    expect(doc).toHaveProperty('taxonomy');
    expect(Array.isArray(doc.taxonomy)).toBe(true);
    expect(doc.taxonomy.length).toBeGreaterThan(20);

    // Each restaurant key in inferred should appear in the actual offers
    // dataset (otherwise we wasted entries on stale names).
    const offers = readJson('offers.json');
    const liveNames = new Set(offers.offers.map((o) => o.restaurant));
    const inferredKeys = Object.keys(doc.restaurants);
    expect(inferredKeys.length, 'inferred file is empty').toBeGreaterThan(50);

    const stale = inferredKeys.filter((k) => !liveNames.has(k));
    // A small amount of staleness is OK (one daily refresh of churn) but
    // a large gap means name canonicalization regressed.
    expect(
      stale.length / inferredKeys.length,
      `${stale.length}/${inferredKeys.length} inferred entries are no longer in offers.json — name canonicalization may have regressed.`
    ).toBeLessThan(0.10);
  });

  test('every cuisine tag is in the declared taxonomy', () => {
    if (!fs.existsSync(inferredPath)) {
      test.skip(true, 'inferred_cuisines.json not present');
      return;
    }
    const doc = readJson('inferred_cuisines.json');
    const taxonomy = new Set(doc.taxonomy);
    const violations = [];
    for (const [name, tags] of Object.entries(doc.restaurants)) {
      if (!Array.isArray(tags)) violations.push({ name, reason: 'tags not array' });
      for (const t of tags || []) {
        if (!taxonomy.has(t)) violations.push({ name, reason: `unknown cuisine ${JSON.stringify(t)}` });
      }
    }
    expect(violations.length, `${violations.length} taxonomy violations: ${JSON.stringify(violations.slice(0, 5))}`).toBe(0);
  });
});

test.describe('offers.json shape (source of truth for the split pipeline)', () => {
  test('top-level has expected keys', () => {
    if (!fs.existsSync(path.join(DATA_DIR, 'offers.json'))) {
      test.skip(true, 'offers.json not present locally — split-only build');
      return;
    }
    const offers = readJson('offers.json');
    for (const k of ['generatedAt', 'dayNames', 'cities', 'stats', 'offers']) {
      expect(offers, `missing key "${k}" in offers.json`).toHaveProperty(k);
    }
    expect(Array.isArray(offers.offers), 'offers must be an array').toBe(true);
    expect(offers.offers.length, 'offers array is empty').toBeGreaterThan(100);
  });

  test('IF offers.json has restaurants enrichment, it survives to the split output', () => {
    // The actual regression we caught: merge_easypaisa + merge_nbp were
    // stripping `restaurants` from offers.json mid-pipeline. The split
    // script then quietly skipped writing the enrichment file. This
    // asserts the contract: if offers.json HAS restaurants, then either
    // offers-restaurants.json exists OR the index has restaurantsFile.
    const offersPath = path.join(DATA_DIR, 'offers.json');
    if (!fs.existsSync(offersPath)) {
      test.skip(true, 'offers.json not present locally');
      return;
    }
    const offers = readJson('offers.json');
    if (!offers.restaurants || Object.keys(offers.restaurants).length === 0) {
      test.skip(true, 'offers.json has no enrichment to propagate');
      return;
    }
    const index = readJson('offers-index.json');
    expect(
      index.restaurantsFile,
      'offers.json carries restaurants enrichment but offers-index.json has no restaurantsFile — split pipeline broke the propagation.'
    ).toBeTruthy();
  });
});
