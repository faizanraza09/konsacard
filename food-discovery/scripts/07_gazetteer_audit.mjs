// 07 — Gazetteer coverage audit (the growth loop).
// Runs the gazetteer over every dish string the teacher emitted and reports:
//   - % mapped to a canonical dish
//   - % rejected as noise/stopword/sentence
//   - the top UNMAPPED strings, ranked by frequency — the worklist of aliases
//     to fold into data/gazetteer.json next. Re-run after each corpus batch.
//
// In:  data/work/labels.jsonl
// Out: data/work/gazetteer_unknowns.json   (frequency-ranked unmapped strings)
import fs from "fs";
import { canonicalizeDish, stats } from "./lib/gazetteer.mjs";

const LABELS = "food-discovery/data/work/labels.jsonl";
const OUT = "food-discovery/data/work/gazetteer_unknowns.json";

const labels = fs.readFileSync(LABELS, "utf8").trim().split("\n").filter(Boolean).map(l => JSON.parse(l));

const raw = {};                       // raw dish string -> count
for (const l of labels) for (const d of (l.dishes || [])) { const k = (d.dish || "").trim(); if (k) raw[k] = (raw[k] || 0) + 1; }

let totalMentions = 0, mappedMentions = 0;
const unknown = {};                   // unmapped raw string -> count
const canonicalHits = {};             // canonical id -> count
for (const [str, n] of Object.entries(raw)) {
  totalMentions += n;
  const hits = canonicalizeDish(str);
  if (hits.length) { mappedMentions += n; for (const h of hits) canonicalHits[h.canonical] = (canonicalHits[h.canonical] || 0) + n; }
  else unknown[str] = n;
}

const distinct = Object.keys(raw).length;
const distinctMapped = distinct - Object.keys(unknown).length;
const unknownSorted = Object.entries(unknown).sort((a, b) => b[1] - a[1]);
const unknownMentions = unknownSorted.reduce((s, [, n]) => s + n, 0);

fs.writeFileSync(OUT, JSON.stringify({ generated: new Date().toISOString(), distinct_unknown: unknownSorted.length, unknowns: unknownSorted.map(([s, n]) => ({ str: s, n })) }, null, 1));

const s = stats();
console.log("=== gazetteer audit ===");
console.log(`gazetteer: ${s.dishes} dishes / ${s.aliases} aliases / ${s.cuisines} cuisines`);
console.log(`mentions:  ${mappedMentions}/${totalMentions} mapped (${(100 * mappedMentions / totalMentions).toFixed(1)}%)`);
console.log(`distinct:  ${distinctMapped}/${distinct} surface forms mapped (${(100 * distinctMapped / distinct).toFixed(1)}%)`);
console.log(`unmapped:  ${unknownSorted.length} surface forms / ${unknownMentions} mentions  -> ${OUT}`);
console.log(`\ntop canonical dishes (by mention):`);
for (const [c, n] of Object.entries(canonicalHits).sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(`  ${String(n).padStart(3)}  ${c}`);
console.log(`\ntop UNMAPPED strings (worklist — add aliases for the real dishes; the rest is noise):`);
for (const [str, n] of unknownSorted.slice(0, 30)) console.log(`  ${String(n).padStart(3)}  ${str}`);
