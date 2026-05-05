const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

function sanitize(value) {
  return (value || "source").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "source";
}

async function main() {
  const args = process.argv.slice(2);
  const params = {};
  for (let i = 0; i < args.length; i += 2) {
    params[args[i].replace(/^--/, "")] = args[i + 1];
  }

  if (!params.url || !params.bankSlug || !params.label) {
    throw new Error("Usage: node capture_web_source.js --url <url> --bankSlug <slug> --label <label>");
  }

  const root = process.cwd();
  const outDir = path.join(root, "data", "card-requirements", "artifacts", params.bankSlug, sanitize(params.label), "playwright");
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 2200 },
    deviceScaleFactor: 1,
  });

  await page.goto(params.url, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: path.join(outDir, "page-full.png"), fullPage: true });
  const pdfLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("a[href]"))
      .map((a) => ({
        text: (a.textContent || "").trim(),
        href: a.href,
      }))
      .filter((item) => {
        const combined = `${item.text} ${item.href}`.toLowerCase();
        return ["pdf", "schedule", "charges", "soc", "summary", "fact", "fee", "card"].some((needle) => combined.includes(needle));
      });
  });

  fs.writeFileSync(
    path.join(outDir, "links.json"),
    JSON.stringify(
      {
        capturedUrl: page.url(),
        title: await page.title(),
        interestingLinks: pdfLinks,
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
