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
  // Wait for state.data to be populated — that's when the app is interactive.
  await page.waitForFunction(() => /** @type {any} */ (window).__app?.state?.data?.offers?.length > 0, { timeout: 10_000 });
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

module.exports = { gotoApp, collectConsoleErrors };
