const { chromium } = require("@playwright/test");
const path = require("path");

async function capture(pagePath, outFile) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  await page.goto(`http://127.0.0.1:8010${pagePath}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: outFile, fullPage: true });
  await browser.close();
}

async function main() {
  const root = process.cwd();
  await capture("/banks/al-baraka-bank/", path.join(root, "mobile-bank-page.png"));
  await capture("/restaurants/xander-s/", path.join(root, "mobile-restaurant-page.png"));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
