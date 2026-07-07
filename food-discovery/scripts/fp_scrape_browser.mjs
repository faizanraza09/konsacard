// Foodpanda (Pakistan) scraper — Browser-assisted to bypass PerimeterX 403s.
// This script uses Playwright to fetch menus, mimicking a real Chrome browser
// to pass TLS fingerprinting and JS challenges that block native Node.js fetch.
//
// Usage:
//   1. Install dependencies: npm install playwright
//   2. Install browser: npx playwright install chromium
//   3. Run: node food-discovery/scripts/fp_scrape_browser.mjs --codes-from food-discovery/data/raw/foodpanda_vendors.jsonl --out food-discovery/data/raw/foodpanda.jsonl --delay-ms 3000
//
import fs from "fs";
import { chromium } from "playwright";

const raw = process.argv.slice(2);
const args = {}; const flags = new Set();
for (let i=0;i<raw.length;i++){ 
  if(raw[i].startsWith("--")){ 
    const k=raw[i].slice(2); 
    if(raw[i+1]&&!raw[i+1].startsWith("--")){ args[k]=raw[++i]; } 
    else flags.add(k); 
  } 
}

const CODES_FROM = args["codes-from"] || "food-discovery/data/raw/foodpanda_vendors.jsonl";
const OUT = args.out || "food-discovery/data/raw/foodpanda.jsonl";
const DELAY = args["delay-ms"] ? +args["delay-ms"] : 3000;
const LIMIT = args.limit ? +args.limit : Infinity;

const sleep = ms => new Promise(r=>setTimeout(r,ms));

function parseMenu(v){
  const out=[];
  for(const m of (v.menus||[])) {
    for(const c of (m.menu_categories||[])) {
      for(const p of (c.products||[])){
        const variations=(p.product_variations||[]).map(x=>({name:x.name||null, price:x.price??null, original:x.original_price??null}));
        const best=variations[0]||{};
        out.push({ category:c.name, name:p.name, description:p.description||null,
          price:best.price??null, original_price:best.original??null, variations: variations.length>1?variations:undefined });
      }
    }
  }
  return out;
}

async function getMenuWithBrowser(code, page) {
  try {
    const url = `https://pk.fd-api.com/api/v5/vendors/${code}?include=menus&language_id=1&opening_type=delivery&basket_currency=PKR`;
    
    // Add browser-like headers to the request
    await page.setExtraHTTPHeaders({
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      "Accept": "application/json",
      "x-fp-api-key": "volo",
      "x-disco-client-id": "web"
    });

    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
    
    if (response.status() === 200) {
      const json = await response.json();
      return json.data;
    }
    return { __err: `HTTP_${response.status()}` };
  } catch (e) {
    return { __err: e.message };
  }
}

async function main() {
  console.log(`=== Foodpanda Browser Scraper ===`);
  console.log(`Reading codes from: ${CODES_FROM}`);
  
  const unique = new Map();
  if(fs.existsSync(CODES_FROM)) {
    for(const l of fs.readFileSync(CODES_FROM,"utf8").trim().split("\n").filter(Boolean)){ 
      try{ const v=JSON.parse(l); if(v.code) unique.set(v.code, v); }catch{} 
    }
  }
  
  const allCodes = [...unique.keys()].slice(0, isFinite(LIMIT) ? LIMIT : undefined);
  const done = new Set();
  if(fs.existsSync(OUT)) {
    for(const l of fs.readFileSync(OUT,"utf8").trim().split("\n").filter(Boolean)){ 
      try{ done.add(JSON.parse(l).code); }catch{} 
    }
  }
  
  const codes = allCodes.filter(c => !done.has(c));
  console.log(`Fetching menus for ${codes.length} vendors (${done.size} already done → skipped)...`);
  
  if (codes.length === 0) {
    console.log("Nothing to do. All vendors already processed.");
    process.exit(0);
  }

  console.log("Launching headless browser (this bypasses PerimeterX)...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
  });
  const page = await context.newPage();
  
  const fd = fs.openSync(OUT, "a");
  let ok = 0, err = 0, items = 0, t0 = Date.now();
  
  for(let i = 0; i < codes.length; i++){
    const code = codes[i];
    const v = await getMenuWithBrowser(code, page);
    
    if(v.__err){ 
      err++; 
      console.error(`  [${i+1}/${codes.length}] ERR ${code}: ${v.__err}`);
    } else { 
      ok++; 
      const menu = parseMenu(v);
      items += menu.length; 
      const record = { 
        foodpanda_id: v.id, code: v.code, name: v.name, chain: v.chain?.name||null, address: v.address||null,
        area: v.address_line2||null, city: v.city?.name||null, lat: v.latitude??null, lng: v.longitude??null,
        cuisines: (v.cuisines||[]).map(c=>c.name), rating: v.rating??null, review_number: v.review_number??null,
        min_order: v.minimum_order_amount??null, menu: menu 
      };
      fs.writeSync(fd, JSON.stringify(record) + "\n"); 
    }
    
    if((i+1)%10 === 0 || i === codes.length-1){ 
      const rate = (i+1) / ((Date.now()-t0)/1000); 
      console.log(`  Progress: ${i+1}/${codes.length} | ok=${ok} err=${err} items=${items} | ${rate.toFixed(2)} req/s`); 
    }
    
    // Jittered delay to avoid triggering rate limits
    await sleep(DELAY + Math.random() * 1000);
  }
  
  fs.closeSync(fd);
  await browser.close();
  console.log(`\nDone: ${ok} vendors with menus this run, ${err} errors, ${items} menu items, ${done.size+ok} total → ${OUT}`);
}

main().catch(e => {
  console.error("Fatal error:", e);
  process.exit(1);
});
