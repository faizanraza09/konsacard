// @ts-check
const { test, expect } = require('@playwright/test');
const { gotoApp } = require('./helpers');

// After the nav-unification work, every page should expose the SAME mobile
// utility-nav contents. We snapshot the home page list and assert each
// sub-page produces an identical list of (text, href) pairs.
async function readUtilityNav(page) {
  return await page.evaluate(() => {
    const items = /** @type {NodeListOf<HTMLAnchorElement>} */ (
      document.querySelectorAll(".nav > .utility-nav a")
    );
    return Array.from(items).map((a) => ({
      text: (a.textContent || "").trim(),
      href: a.getAttribute("href") || "",
    }));
  });
}

test.describe("Nav — mobile utility-nav is identical across pages", () => {
  test("home + /about/ + /contact/ + /banks/ all share the same mobile menu", async ({ page }) => {
    await gotoApp(page);
    const home = await readUtilityNav(page);
    expect(home.length).toBeGreaterThan(0);

    for (const path of ["/about/", "/contact/", "/banks/", "/methodology/"]) {
      await page.goto(path);
      // content-pages.js runs on DOMContentLoaded; a small wait covers any
      // sync timing edge case.
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(50);
      const items = await readUtilityNav(page);
      const compare = (rows) =>
        rows.map((r) => `${r.text} → ${r.href}`).join(" | ");
      expect(compare(items), `mismatched mobile menu on ${path}`).toBe(compare(home));
    }
  });
});
