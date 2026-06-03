// 10 — Select deep-review targets from the directory sweep.
// Applies the PLACE-level filters (not closed, >= minReviewCount Google reviews) to the
// directory built by 09, and writes the qualifying place URLs as a gosom input file.
// Pass B then deep-pulls reviews only for these — no wasted -extra-reviews on thin/closed places.
//
// In:  data/raw/karachi_gmaps.jsonl   (directory sweep output)
// Out: data/work/deep_targets.txt     (one Google Maps place URL per qualifying place)
//
// Then run Pass B (throttled, resumable, deep reviews):
//   node scripts/09_gmaps_sweep.mjs --queries data/work/deep_targets.txt \
//        --out data/raw/karachi_gmaps_reviews.jsonl --state data/work/deep_state.json --extra-reviews
import fs from "fs";
import { placeQualifies, isPermanentlyClosed, reviewCountOf, FILTERS } from "./lib/filters.mjs";

const IN = "food-discovery/data/raw/karachi_gmaps.jsonl";
const OUT = "food-discovery/data/work/deep_targets.txt";

const rows = fs.existsSync(IN) ? fs.readFileSync(IN, "utf8").trim().split("\n").filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : [];

let closed = 0, thin = 0; const targets = []; const seen = new Set();
for (const p of rows) {
  if (isPermanentlyClosed(p)) { closed++; continue; }
  if (reviewCountOf(p) < FILTERS.minReviewCount) { thin++; continue; }
  const url = p.link || (p.place_id ? `https://www.google.com/maps/place/?q=place_id:${p.place_id}` : null);
  if (!url || seen.has(url)) continue;
  seen.add(url); targets.push(url);
}

fs.writeFileSync(OUT, targets.join("\n") + (targets.length ? "\n" : ""));
console.log("=== select_deep_targets ===");
console.log(`directory: ${rows.length} places`);
console.log(`dropped: ${closed} closed, ${thin} thin (<${FILTERS.minReviewCount} reviews)`);
console.log(`deep-pull targets: ${targets.length} → ${OUT}`);
console.log(`(est. up to ${(targets.length * FILTERS.maxReviewsPerPlace).toLocaleString()} reviews at ${FILTERS.maxReviewsPerPlace}/place cap)`);
