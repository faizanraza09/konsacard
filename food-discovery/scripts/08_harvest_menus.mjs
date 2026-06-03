// 08 — Menu harvester (the seed-growth loop).
// Mines real dish vocabulary from scraped Foodpanda menus + vendor cuisines and
// reports which menu phrases the gazetteer does NOT yet recognize, ranked by
// frequency. This is how the gazetteer reaches the long tail without hand-typing
// a 240-review-sized guess: real menus are the ground-truth dish universe.
//
// In:  data/raw/foodpanda.jsonl (menu[].name/description), data/raw/foodpanda_vendors.jsonl (cuisines[])
// Out: data/work/menu_candidates.json  (unmapped menu phrases + observed cuisines)
import fs from "fs";
import { canonicalizeDish, GAZETTEER } from "./lib/gazetteer.mjs";

const MENUS = "food-discovery/data/raw/foodpanda.jsonl";
const VENDORS = "food-discovery/data/raw/foodpanda_vendors.jsonl";
const OUT = "food-discovery/data/work/menu_candidates.json";

function readJsonl(p) { return fs.existsSync(p) ? fs.readFileSync(p, "utf8").trim().split("\n").filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : []; }

// Pull short, dish-like noun phrases out of menu item names/descriptions.
// Menu names are noisy ("Extreme Value Meal 1"), so we lean on the gazetteer to
// tell us what's already a dish and surface the rest as candidates.
function phrases(s) {
  return String(s || "").toLowerCase()
    .replace(/\([^)]*\)/g, " ")               // drop parentheticals
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\b(?:with|and|&|plus|served|combo|deal|meal|value|of|in|the)\b/)
    .map(x => x.replace(/\s+/g, " ").trim())
    .filter(x => x && x.split(" ").length <= 4);
}

const menus = readJsonl(MENUS);
const vendors = readJsonl(VENDORS);

const candidate = {};        // unmapped menu phrase -> count
const mappedItems = { n: 0 }, totalItems = { n: 0 };
for (const r of menus) {
  for (const item of (r.menu || [])) {
    totalItems.n++;
    const text = `${item.name || ""} ${item.description || ""}`;
    if (canonicalizeDish(item.name || "").length || canonicalizeDish(text).length) { mappedItems.n++; continue; }
    for (const p of phrases(text)) if (!canonicalizeDish(p).length) candidate[p] = (candidate[p] || 0) + 1;
  }
}

// Observed cuisine vocabulary across the full vendor set (1.8k vendors) — checks
// whether our cuisine taxonomy covers what Foodpanda actually tags.
const cuisineFreq = {};
const knownCuisine = new Set(Object.values(GAZETTEER.cuisines).flat());
for (const v of vendors) for (const c of (v.cuisines || [])) { const k = c.toLowerCase(); cuisineFreq[k] = (cuisineFreq[k] || 0) + 1; }
const unknownCuisines = Object.entries(cuisineFreq).filter(([c]) => !knownCuisine.has(c)).sort((a, b) => b[1] - a[1]);

const candSorted = Object.entries(candidate).filter(([p]) => p.length > 2).sort((a, b) => b[1] - a[1]);
fs.writeFileSync(OUT, JSON.stringify({
  generated: new Date().toISOString(),
  menu_rows: menus.length, vendor_rows: vendors.length,
  candidate_phrases: candSorted.map(([p, n]) => ({ phrase: p, n })),
  unknown_cuisines: unknownCuisines.map(([c, n]) => ({ cuisine: c, n })),
}, null, 1));

console.log("=== menu harvest ===");
console.log(`menus: ${menus.length} rows / ${totalItems.n} items  (${mappedItems.n} already map to a canonical dish)`);
console.log(`vendors: ${vendors.length} rows / cuisine tags observed: ${Object.keys(cuisineFreq).length}`);
console.log(`\nunknown cuisine tags (extend gazetteer.cuisines):`);
for (const [c, n] of unknownCuisines.slice(0, 15)) console.log(`  ${String(n).padStart(4)}  ${c}`);
console.log(`\ntop unmapped menu phrases (alias candidates) -> ${OUT}:`);
for (const [p, n] of candSorted.slice(0, 30)) console.log(`  ${String(n).padStart(3)}  ${p}`);
