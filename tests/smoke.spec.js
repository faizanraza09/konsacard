// @ts-check
const { test, expect } = require('@playwright/test');
const { gotoApp, collectConsoleErrors } = require('./helpers');

test.describe('Smoke — app boots and core interactions work', () => {
  test('home loads, no console errors, data hydrated', async ({ page }) => {
    const getErrors = collectConsoleErrors(page);
    await gotoApp(page);
    const stats = await page.evaluate(() => /** @type {any} */ (window).__app.state.data.stats);
    expect(stats.offers).toBeGreaterThan(1000);
    expect(stats.cards).toBeGreaterThan(50);
    expect(getErrors(), `unexpected console errors: ${getErrors().join('\n')}`).toEqual([]);
  });

  test('Cards view: featured card + ranked list render', async ({ page }) => {
    await gotoApp(page);
    await expect(page.locator('.card-item--featured').first()).toBeVisible();
    const cardCount = await page.locator('article.card-item').count();
    expect(cardCount).toBeGreaterThan(5);
  });

  test('Restaurants view: switch + data renders', async ({ page }) => {
    await gotoApp(page);
    await page.locator('#btn-view-restaurants').click();
    await page.waitForTimeout(300);
    const active = await page.locator('#btn-view-restaurants').evaluate((el) => el.classList.contains('active'));
    expect(active).toBeTruthy();
  });

  test('My Wallet view: empty state then portfolio summary after adding a card', async ({ page }) => {
    await gotoApp(page);
    await page.locator('#btn-view-next-card').click();
    await page.waitForTimeout(300);

    // Empty state
    await expect(page.locator('#empty-state-title')).toContainText(/wallet/i);
    expect(await page.locator('.mw-summary').count()).toBe(0);

    // Add a card
    await page.locator('#nc-owned-search').fill('HBL');
    await page.waitForTimeout(150);
    await page.locator('#nc-owned-results .nc-search-item').first().click();
    await page.waitForTimeout(400);

    // Portfolio summary appears with 4 stats
    await expect(page.locator('.mw-summary')).toBeVisible();
    const stats = await page.locator('.mw-summary-v').allTextContents();
    expect(stats.length).toBe(4);

    // "Best next card to add" section header
    await expect(page.locator('.mw-section-label')).toContainText(/best next card/i);

    // Featured next card present
    await expect(page.locator('#top-pick .card-item--featured')).toBeVisible();
  });

  test('Build Wallet view: K=3 yields 3 cards in stack + alternative wallets', async ({ page }) => {
    await gotoApp(page);
    await page.locator('#btn-view-wallet').click();
    await page.waitForTimeout(400);
    await page.locator('#wo-k-pills .wo-pill[data-k="3"]').click();
    await page.waitForTimeout(500);

    const stackCount = await page.locator('#top-pick .wo-stack-card').count();
    expect(stackCount).toBe(3);

    const altCount = await page.locator('#results-grid .wo-alt-item').count();
    expect(altCount).toBeGreaterThan(0);
    expect(altCount).toBeLessThanOrEqual(9);
  });

  test('Build Wallet: same-bank diversity rule actually enforces unique banks', async ({ page }) => {
    await gotoApp(page);
    await page.locator('#btn-view-wallet').click();
    await page.waitForTimeout(400);
    await page.locator('#wo-k-pills .wo-pill[data-k="4"]').click();
    await page.waitForTimeout(300);
    // Advanced options are collapsed by default — open the disclosure first
    await page.locator('.wo-advanced summary').click();
    await page.waitForTimeout(200);
    await page.locator('label.wo-toggle:has(#wo-nobank)').click();
    await page.waitForTimeout(500);

    const banks = await page.locator('#top-pick .wo-stack-card-bank').allTextContents();
    expect(banks.length).toBe(4);
    expect(new Set(banks).size).toBe(banks.length);
  });

  test('Quiz modal opens and shows step 1', async ({ page }) => {
    await gotoApp(page);
    await page.locator('#btn-open-quiz').click();
    await page.waitForTimeout(300);
    await expect(page.locator('#quiz-modal')).toBeVisible();
    await expect(page.locator('#quiz-modal-inner')).toContainText(/question 1/i);
  });

  test('Card detail modal opens via card click', async ({ page }) => {
    await gotoApp(page);
    await page.waitForTimeout(300);
    await page.locator('.card-item--featured').first().click();
    await page.waitForTimeout(400);
    await expect(page.locator('#card-detail-modal')).toBeVisible();
  });

  test('Sidebar bill slider updates the bill summary', async ({ page }) => {
    await gotoApp(page);
    const slider = page.locator('#order-value');
    await slider.evaluate((el) => {
      /** @type {HTMLInputElement} */ (el).value = '20000';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForTimeout(200);
    const label = await page.locator('#order-value-label').textContent();
    expect(label).toContain('20,000');
  });

  test('Legacy ?view=next-card URL canonicalizes to my-wallet', async ({ page }) => {
    await page.addInitScript(() => { try { localStorage.setItem('konsacard_visited_v2','true'); } catch{} });
    await page.goto('/?view=next-card');
    await page.waitForLoadState('networkidle');
    const active = await page.locator('#btn-view-next-card').evaluate((el) => el.classList.contains('active'));
    expect(active).toBeTruthy();
    expect(page.url()).toContain('view=my-wallet');
  });
});
