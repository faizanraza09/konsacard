// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * URL → state restoration must be symmetric with encodeStateToUrl, so that
 * a shared/refreshed link reproduces the same UI the original user had.
 * Asymmetric encode/decode (like the cuisines bug — encode added later but
 * decoder existed first, or vice versa) would show up here as "URL says X
 * but state.selectedX is empty after load."
 *
 * These tests go straight to a parameterized URL without clicking anything
 * first, then assert the corresponding state Set / scalar reflects it.
 */

async function gotoWithUrl(page, urlPath) {
  await page.addInitScript(() => {
    try { localStorage.setItem("konsacard_visited_v2", "true"); } catch {}
  });
  await page.goto(urlPath);
  // App is interactive once it has renderable data. Under the summary-first
  // architecture a default scope (e.g. ?city=karachi) is served from
  // state.summary with raw offers still lazy; non-default params (?bill,
  // ?types, ?banks…) trigger ensureRawOffers() and populate state.data.
  // Accept either, matching helpers.js gotoApp.
  await page.waitForFunction(
    () => {
      const s = /** @type {any} */ (window).__app?.state;
      return !!(s && (s.summary || (s.data?.offers?.length > 0)));
    },
    { timeout: 15_000 },
  );
  // `summary` can appear BEFORE restoreStateFromUrl + the first render finish,
  // so also wait until result cards are on the page — that signals the full
  // boot → URL-restore → render cycle (and any lazy raw-offer load it triggered)
  // has completed, before the test reads state.
  await page.waitForFunction(
    () => (document.querySelector("#results-grid")?.childElementCount || 0) > 0,
    { timeout: 15_000 },
  );
}

test.describe("URL → state restoration", () => {
  test("?city=karachi sets state.selectedCity and activates the tab", async ({ page }) => {
    await gotoWithUrl(page, "/?city=karachi");
    const city = await page.evaluate(() => /** @type {any} */ (window).__app.state.selectedCity);
    expect(city).toBe("karachi");
    const tabActive = await page
      .locator("#nav-city-tabs .city-tab", { hasText: "Karachi" })
      .evaluate((el) => el.classList.contains("active"));
    expect(tabActive).toBe(true);
  });

  test("?bill=15000 sets state.orderValue and slider value", async ({ page }) => {
    await gotoWithUrl(page, "/?bill=15000");
    const orderValue = await page.evaluate(() => /** @type {any} */ (window).__app.state.orderValue);
    expect(orderValue).toBe(15000);
    const slider = await page.locator("#order-value").evaluate((el) => /** @type {HTMLInputElement} */ (el).value);
    expect(slider).toBe("15000");
  });

  test("?types=credit sets selectedCardTypes and lights the Credit pill", async ({ page }) => {
    await gotoWithUrl(page, "/?types=credit");
    const types = await page.evaluate(() =>
      Array.from(/** @type {any} */ (window).__app.state.selectedCardTypes),
    );
    expect(types).toEqual(["credit"]);
    const active = await page.locator('#card-type-pills .s-pill', { hasText: /^Credit$/ })
      .evaluate((el) => el.classList.contains("active"));
    expect(active).toBe(true);
  });

  test("?days=1,2,3 restores three selected days", async ({ page }) => {
    await gotoWithUrl(page, "/?days=1,2,3");
    const days = await page.evaluate(() =>
      Array.from(/** @type {any} */ (window).__app.state.selectedDays).sort(),
    );
    expect(days).toEqual([1, 2, 3]);
  });

  test("?cuisines=Italian round-trips to selectedCuisines", async ({ page }) => {
    await gotoWithUrl(page, "/?cuisines=Italian");
    const cuisines = await page.evaluate(() =>
      Array.from(/** @type {any} */ (window).__app.state.selectedCuisines),
    );
    expect(cuisines).toContain("Italian");
  });

  test("?banks=Habib+Bank+Limited restores the chip", async ({ page }) => {
    await gotoWithUrl(page, "/?banks=Habib+Bank+Limited");
    const banks = await page.evaluate(() =>
      Array.from(/** @type {any} */ (window).__app.state.selectedBanks),
    );
    expect(banks).toContain("Habib Bank Limited");
    // chip rendered in #selected-banks
    const chipCount = await page.locator("#selected-banks .s-chip").count();
    expect(chipCount).toBeGreaterThanOrEqual(1);
  });

  test("multi-filter URL: city + bill + types + days all restore together", async ({ page }) => {
    await gotoWithUrl(page, "/?city=lahore&bill=8000&types=debit&days=0,5,6");
    const snapshot = await page.evaluate(() => {
      const s = /** @type {any} */ (window).__app.state;
      return {
        selectedCity: s.selectedCity,
        orderValue: s.orderValue,
        selectedCardTypes: Array.from(s.selectedCardTypes),
        selectedDays: Array.from(s.selectedDays).sort(),
      };
    });
    expect(snapshot).toEqual({
      selectedCity: "lahore",
      orderValue: 8000,
      selectedCardTypes: ["debit"],
      selectedDays: [0, 5, 6],
    });
  });

  test("repeated multi-select params (banks) round-trip", async ({ page }) => {
    await gotoWithUrl(page, "/?banks=Habib+Bank+Limited&banks=Bank+Alfalah");
    const banks = await page.evaluate(() =>
      Array.from(/** @type {any} */ (window).__app.state.selectedBanks).sort(),
    );
    expect(banks).toEqual(["Bank Alfalah", "Habib Bank Limited"]);
  });
});
