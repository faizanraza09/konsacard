// @ts-check
/**
 * Shared helpers across the smoke + algorithm test suites.
 */

/**
 * Skip the first-visit landing screen and load the home page fully booted.
 * @param {import('@playwright/test').Page} page
 */
async function gotoApp(page) {
  await page.addInitScript(() => {
    try { localStorage.setItem('konsacard_visited_v2', 'true'); } catch {}
  });
  await page.goto('/');
  // App is interactive once it has renderable data. Under the summary-first
  // architecture that's `state.summary` (default first paint, raw offers still
  // lazy); the older eager path populated `state.data.offers`. Accept either so
  // the suite covers both the summary path and the raw fallback.
  await page.waitForFunction(() => {
    const s = /** @type {any} */ (window).__app?.state;
    return !!(s && (s.summary || (s.data?.offers?.length > 0)));
  }, { timeout: 15_000 });
  // `summary` can appear before the first render completes; wait for result
  // cards so the app is actually interactive before the test proceeds.
  await page.waitForFunction(
    () => (document.querySelector("#results-grid")?.childElementCount || 0) > 0,
    { timeout: 15_000 },
  );
}

/**
 * Force the lazily-loaded raw offers (state.data.offers) to be present.
 *
 * Wallet / next-card / per-offer computations are NOT precomputed in the
 * summary (by design) and need the full offers array. The default render path
 * leaves state.data null, so tests that exercise those compute fns must
 * explicitly pull raw offers in via the exposed ensureRawOffers() hook.
 * @param {import('@playwright/test').Page} page
 */
async function ensureRawOffers(page) {
  await page.evaluate(() => /** @type {any} */ (window).__app.ensureRawOffers());
  await page.waitForFunction(
    () => /** @type {any} */ (window).__app?.state?.data?.offers?.length > 0,
    { timeout: 15_000 },
  );
}

/**
 * Collects console errors + page errors during a test. Returns a function
 * that returns the collected errors, so the test can assert at the end.
 * @param {import('@playwright/test').Page} page
 */
function collectConsoleErrors(page) {
  /** @type {string[]} */
  const errors = [];
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
  });
  return () => errors.slice();
}

module.exports = { gotoApp, collectConsoleErrors, ensureRawOffers };
