// @ts-check
const { test, expect } = require("@playwright/test");
const { gotoApp } = require("./helpers");

/**
 * Each filter must actually narrow the rendered cards list, not just turn
 * the chip blue. The cardCategory-dropout bug (item.cardCategory undefined
 * in the aggregate → state.selectedCardTypes.has(undefined) always false →
 * every card filtered out) would manifest here as "Credit toggle yields
 * zero cards" — the kind of silent failure unit-style algorithm tests
 * miss because they fabricate aggregate items rather than going through
 * the real compute pipeline.
 */

test.describe("Filter behavior — list actually narrows", () => {
  test("Credit type filter shows >0 cards and never the empty-state", async ({ page }) => {
    await gotoApp(page);
    const initialCount = await page.locator("article.card-item").count();
    expect(initialCount).toBeGreaterThan(5);

    await page.locator('#card-type-pills .s-pill', { hasText: /^Credit$/ }).click();
    await page.waitForTimeout(300);

    // The bug we're guarding against: filter returns zero, empty-state shows.
    const afterCount = await page.locator("article.card-item").count();
    expect(afterCount, "Credit filter must return at least 1 card").toBeGreaterThan(0);
    await expect(page.locator("#empty-state")).toBeHidden();

    // Every visible card must report cardCategory === "credit" in state.
    const allCredit = await page.evaluate(() => {
      const w = /** @type {any} */ (window);
      const recs = w.computeRecommendations();
      const visible = recs.slice(0, 10);
      return visible.every((c) => c.cardCategory === "credit");
    });
    expect(allCredit, "all visible cards must be cardCategory=credit").toBe(true);
  });

  test("Debit type filter shows >0 cards and only debit cards", async ({ page }) => {
    await gotoApp(page);
    await page.locator('#card-type-pills .s-pill', { hasText: /^Debit$/ }).click();
    await page.waitForTimeout(300);

    const afterCount = await page.locator("article.card-item").count();
    expect(afterCount, "Debit filter must return at least 1 card").toBeGreaterThan(0);

    const allDebit = await page.evaluate(() => {
      const w = /** @type {any} */ (window);
      return w.computeRecommendations().slice(0, 10).every((c) => c.cardCategory === "debit");
    });
    expect(allDebit).toBe(true);
  });

  test("Selecting both Credit + Debit shows both categories", async ({ page }) => {
    await gotoApp(page);
    await page.locator('#card-type-pills .s-pill', { hasText: /^Credit$/ }).click();
    await page.locator('#card-type-pills .s-pill', { hasText: /^Debit$/ }).click();
    // Selecting a card-type filter is a non-default scope, which lazily pulls in
    // the raw offer shards. Wait for them rather than a fixed timeout, else
    // computeRecommendations() returns [] before the shards land (flaky).
    await page.waitForFunction(() => /** @type {any} */ (window).__app?.state?.data?.offers?.length > 0, { timeout: 15_000 });

    // page.evaluate serializes return values across the browser bridge, so
    // Set instances don't survive — convert to plain Array in the browser
    // and check membership on the Node side.
    const categories = await page.evaluate(() => {
      const w = /** @type {any} */ (window);
      return Array.from(new Set(w.computeRecommendations().map((c) => c.cardCategory)));
    });
    expect(categories).toContain("credit");
    expect(categories).toContain("debit");
    expect(categories).not.toContain("other");
  });

  test("Selecting a bank narrows result to cards from only that bank", async ({ page }) => {
    await gotoApp(page);
    await page.locator("#bank-search").fill("HBL");
    await page.waitForTimeout(200);
    await page.locator("#bank-results .s-search-item").first().click();
    // Selecting a bank is a non-default filter that lazily pulls in raw offers;
    // computeRecommendations() returns [] until they land. Wait for the load to
    // settle before asserting the list actually narrows.
    await page.waitForFunction(
      () => /** @type {any} */ (window).__app?.state?.data?.offers?.length > 0,
      { timeout: 15_000 },
    );

    const banks = await page.evaluate(() => {
      const w = /** @type {any} */ (window);
      const selected = Array.from(w.__app.state.selectedBanks);
      const recs = w.computeRecommendations();
      return { selected, banks: Array.from(new Set(recs.map((c) => c.bank))) };
    });
    expect(banks.selected.length).toBeGreaterThan(0);
    expect(banks.banks.length).toBeGreaterThan(0);
    // Every visible card's bank should be one of the selected banks
    expect(banks.banks.every((b) => banks.selected.includes(b))).toBe(true);
  });

  test("Selecting a city narrows the offer scope (state.selectedCity persists)", async ({ page }) => {
    await gotoApp(page);
    await page.locator("#nav-city-tabs .city-tab", { hasText: "Lahore" }).click();
    await page.waitForTimeout(250);

    const city = await page.evaluate(() => /** @type {any} */ (window).__app.state.selectedCity);
    expect(city).toBe("lahore");

    const cardCount = await page.locator("article.card-item").count();
    expect(cardCount, "Lahore should still produce a non-empty card list").toBeGreaterThan(0);
  });

  test("Day pill toggle changes the algorithm's effective day window", async ({ page }) => {
    await gotoApp(page);
    // Click Monday pill (index 1)
    await page.locator("#day-pills .s-pill").nth(1).click();
    await page.waitForTimeout(200);

    const days = await page.evaluate(() => {
      const w = /** @type {any} */ (window);
      return Array.from(w.__app.state.selectedDays);
    });
    expect(days.length).toBe(1);
  });
});
