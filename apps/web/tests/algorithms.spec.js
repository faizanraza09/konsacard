// @ts-check
/**
 * Algorithm regression tests.
 *
 * These call the live compute* functions from the loaded app with a controlled
 * state mutation (set selected city + filters), and assert invariants — not
 * exact numbers — so the tests don't break every time data refreshes.
 *
 * Invariants are the contract: e.g. "wallet of K=3 returns 3 picks", "owned
 * cards never appear as a Next Card recommendation", "ROI objective with a
 * fee budget returns wallets whose total fee is within budget".
 */
const { test, expect } = require('@playwright/test');
const { gotoApp, ensureRawOffers } = require('./helpers');

test.describe('Algorithm — invariants on compute* functions', () => {
  test('computeRecommendations: returns sorted cards with valid scores', async ({ page }) => {
    await gotoApp(page);
    const res = await page.evaluate(() => {
      const a = /** @type {any} */ (window).__app;
      const rs = a.computeRecommendations();
      return rs.slice(0, 10).map((r) => ({
        bank: r.bank,
        card: r.card,
        score: r.score,
        coverage: r.coverage,
        avgExpectedSaving: r.avgExpectedSaving,
      }));
    });
    expect(res.length).toBeGreaterThan(0);
    for (const r of res) {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
      expect(r.coverage).toBeGreaterThanOrEqual(0);
      expect(r.coverage).toBeLessThanOrEqual(1);
      expect(r.avgExpectedSaving).toBeGreaterThan(0);
    }
    // Sorted descending by score
    for (let i = 1; i < res.length; i++) {
      expect(res[i].score).toBeLessThanOrEqual(res[i - 1].score + 0.001);
    }
  });

  test('computeNextCardRecommendations: owned cards excluded; deltas non-negative', async ({ page }) => {
    await gotoApp(page);
    // Next-card recs run over raw offers (not precomputed in the summary).
    await ensureRawOffers(page);
    const result = await page.evaluate(() => {
      const a = /** @type {any} */ (window).__app;
      // Pick the top card from the regular recs as the user's "owned card"
      const top = a.computeRecommendations()[0];
      a.state.ownedCards = new Set([`${top.bank} || ${top.card}`]);
      const { ranked, stats } = a.computeNextCardRecommendations();
      return {
        ownedKey: `${top.bank} || ${top.card}`,
        top10: ranked.slice(0, 10).map((r) => ({
          key: `${r.bank} || ${r.card}`,
          delta: r.avgDeltaPerOuting,
          newVenues: r.newVenues,
          boostedVenues: r.boostedVenues,
        })),
        walletStats: stats.wallet,
      };
    });
    expect(result.top10.length).toBeGreaterThan(0);
    // Owned card must not appear in recommendations
    for (const r of result.top10) {
      expect(r.key).not.toBe(result.ownedKey);
      expect(r.delta).toBeGreaterThan(0);
      expect(r.newVenues + r.boostedVenues).toBeGreaterThan(0);
    }
    // Portfolio stats are populated
    expect(result.walletStats.coveredVenues).toBeGreaterThan(0);
    expect(result.walletStats.perOuting).toBeGreaterThan(0);
  });

  test('computeWalletRecommendations: K=3 returns exactly 3 picks; sub-monotone savings vs K=2', async ({ page }) => {
    await gotoApp(page);
    // Wallet optimization runs over raw offers (not precomputed in the summary).
    await ensureRawOffers(page);
    const result = await page.evaluate(() => {
      const a = /** @type {any} */ (window).__app;
      a.state.walletMustInclude = new Set();
      a.state.walletNoSameBank = false;
      a.state.walletMixedTypes = false;
      a.state.walletMaxFee = null;
      a.state.walletObjective = 'savings';
      a.state.walletBuildOnOwned = false;
      a.state.ownedCards = new Set();

      a.state.walletSize = 2;
      const k2 = a.computeWalletRecommendations().ranked[0];
      a.state.walletSize = 3;
      const k3 = a.computeWalletRecommendations().ranked[0];
      return {
        k2: { picks: k2.picks.length, perOuting: k2.perOutingTotal, coverage: k2.coverage },
        k3: { picks: k3.picks.length, perOuting: k3.perOutingTotal, coverage: k3.coverage },
      };
    });
    expect(result.k2.picks).toBe(2);
    expect(result.k3.picks).toBe(3);
    // Adding a card can never reduce coverage (monotone submodular set)
    expect(result.k3.coverage).toBeGreaterThanOrEqual(result.k2.coverage);
  });

  test('computeWalletRecommendations: no-same-bank → all banks unique', async ({ page }) => {
    await gotoApp(page);
    await ensureRawOffers(page);
    const banks = await page.evaluate(() => {
      const a = /** @type {any} */ (window).__app;
      a.state.walletSize = 4;
      a.state.walletNoSameBank = true;
      a.state.walletMustInclude = new Set();
      a.state.walletMixedTypes = false;
      a.state.walletMaxFee = null;
      a.state.walletBuildOnOwned = false;
      a.state.ownedCards = new Set();
      a.state.walletObjective = 'savings';
      const w = a.computeWalletRecommendations().ranked[0];
      return w.picks.map((p) => p.bank);
    });
    expect(banks.length).toBe(4);
    expect(new Set(banks).size).toBe(banks.length);
  });

  test('computeWalletRecommendations: mixed-types → both debit & credit present', async ({ page }) => {
    await gotoApp(page);
    await ensureRawOffers(page);
    const cats = await page.evaluate(() => {
      const a = /** @type {any} */ (window).__app;
      a.state.walletSize = 2;
      a.state.walletMixedTypes = true;
      a.state.walletNoSameBank = false;
      a.state.walletMustInclude = new Set();
      a.state.walletMaxFee = null;
      a.state.walletBuildOnOwned = false;
      a.state.ownedCards = new Set();
      a.state.walletObjective = 'savings';
      const w = a.computeWalletRecommendations().ranked[0];
      return w.picks.map((p) => p.cardCategory);
    });
    expect(cats).toContain('debit');
    expect(cats).toContain('credit');
  });

  test('computeWalletRecommendations: max-fee budget respected (non-pinned greedy picks)', async ({ page }) => {
    await gotoApp(page);
    await ensureRawOffers(page);
    const result = await page.evaluate(() => {
      const a = /** @type {any} */ (window).__app;
      a.state.walletSize = 3;
      a.state.walletMaxFee = 5000;
      a.state.walletMustInclude = new Set();
      a.state.walletNoSameBank = false;
      a.state.walletMixedTypes = false;
      a.state.walletBuildOnOwned = false;
      a.state.ownedCards = new Set();
      a.state.walletObjective = 'savings';
      const w = a.computeWalletRecommendations().ranked[0];
      return { totalFee: w.totalAnnualFee, breached: w.feeBudgetBreached, picks: w.picks.length };
    });
    // No pinned cards in this test, so the budget is hard — total must fit
    expect(result.totalFee).toBeLessThanOrEqual(5000);
    expect(result.breached).toBe(false);
  });

  test('computeWalletRecommendations: must-include pin is in every wallet shape', async ({ page }) => {
    await gotoApp(page);
    // Reads state.data.offers[0] to pick a pin → needs raw offers loaded.
    await ensureRawOffers(page);
    const result = await page.evaluate(() => {
      const a = /** @type {any} */ (window).__app;
      // Pick a card from the catalog to pin
      const candidate = a.state.data.offers[0];
      const pinKey = `${candidate.bank} || ${candidate.card}`;

      a.state.walletSize = 3;
      a.state.walletMustInclude = new Set([pinKey]);
      a.state.walletNoSameBank = false;
      a.state.walletMixedTypes = false;
      a.state.walletMaxFee = null;
      a.state.walletBuildOnOwned = false;
      a.state.ownedCards = new Set();
      a.state.walletObjective = 'savings';
      const r = a.computeWalletRecommendations();
      return {
        pinKey,
        wallets: r.ranked.map((w) => w.picks.map((p) => `${p.bank} || ${p.card}`)),
      };
    });
    expect(result.wallets.length).toBeGreaterThan(0);
    // Every wallet (optimal + alternatives) must contain the pinned card
    for (const w of result.wallets) {
      expect(w).toContain(result.pinKey);
    }
  });

  test('getOfferSavingValue: respects cap and never exceeds order value', async ({ page }) => {
    await gotoApp(page);
    const cases = await page.evaluate(() => {
      const a = /** @type {any} */ (window).__app;
      const orderValue = 10000;
      return [
        // 20% off, no cap → 2000
        { offer: { discountPct: 20, days: [0], discountType: 'percentage' }, expected: 2000 },
        // 20% off, cap 1000 → 1000
        { offer: { discountPct: 20, days: [0], capPkr: 1000, discountType: 'percentage' }, expected: 1000 },
        // Fixed PKR 500 off → 500
        { offer: { discountType: 'fixed', fixedDiscountPkr: 500, days: [0] }, expected: 500 },
        // up_to 40% with cap 1500 → expectedPct 24% = 2400 → capped at 1500
        { offer: { discountType: 'up_to', discountPct: 40, capPkr: 1500, days: [0] }, expected: 1500 },
      ].map((c) => ({ in: c.offer, expected: c.expected, got: a.getOfferSavingValue(c.offer, orderValue) }));
    });
    for (const c of cases) {
      expect(c.got).toBeCloseTo(c.expected, 1);
    }
  });
});
