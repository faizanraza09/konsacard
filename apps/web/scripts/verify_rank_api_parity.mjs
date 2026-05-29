// Parity + sanity check for the /api/rank endpoint's pure compute pipeline.
//
// The endpoint (functions/api/rank.js) is a thin Worker shell around
// lib/eligibility-core.mjs:rankCards (= computeRanking + applyEligibility).
// rankCards is runtime-free, so we import and exercise it directly here for a
// matrix of settings, without spinning up wrangler.
//
// Asserts, for every settings combination:
//   - output is sorted by score desc (tie-break coverageAdjustedSaving, coverage)
//   - every score is in [0, 100]
//   - when useEligibility is on AND salary/balance is set, no "ineligible" leaks
// And proves the DEFAULT scope (bill 10000, no filters, eligibility off) equals
// summary.json's precomputed scope — the same invariant verify_ranking_parity
// guards for the browser. If that holds, the online endpoint serves exactly the
// summary ranking at the default scope.
//
// Run: node scripts/verify_rank_api_parity.mjs   (after precompute_rankings.mjs)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rankCards, buildRequirementsPack } from "../lib/eligibility-core.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(__dirname, "..");
const DATA_DIR = path.join(WEB, "data");
const REQ_DIR = path.join(DATA_DIR, "card-requirements/normalized");

function readJson(p) { return JSON.parse(fs.readFileSync(p, "utf8")); }
function localFile(rel) { return path.join(DATA_DIR, path.basename(String(rel).split("?")[0])); }

// Mirror functions/api/rank.js loadDataset: merge city offers, merge enrichment
// (Peekaboo wins, inferred fills gaps), build the requirements pack.
function loadDataset() {
  const index = readJson(path.join(DATA_DIR, "offers-index.json"));
  let offers = [];
  for (const city of index.cities) {
    const rel = index.cityFiles?.[city];
    if (rel) offers = offers.concat(readJson(localFile(rel)).offers || []);
  }
  const restaurantsEnrichment = {};
  if (index.restaurantsFile) {
    try { Object.assign(restaurantsEnrichment, readJson(localFile(index.restaurantsFile)).restaurants || {}); } catch {}
  }
  try {
    const inferred = readJson(path.join(DATA_DIR, "inferred_cuisines.json")).restaurants || {};
    for (const [name, cuisines] of Object.entries(inferred)) {
      if (!Array.isArray(cuisines) || cuisines.length === 0) continue;
      if (!restaurantsEnrichment[name]) restaurantsEnrichment[name] = { servesCuisine: cuisines };
    }
  } catch {}

  let requirements = null;
  try {
    const records = readJson(path.join(REQ_DIR, "card_requirements.json"));
    const mappings = readJson(path.join(REQ_DIR, "deal_requirement_card_map.json"));
    requirements = buildRequirementsPack(records, mappings);
  } catch {}

  return { offers, restaurantsEnrichment, requirements };
}

const baseSettings = () => ({
  city: "all",
  orderValue: 10000,
  outingsPerWeek: 1,
  selectedDays: [],
  selectedRestaurants: [],
  selectedBanks: [],
  selectedCardTypes: [],
  selectedCards: [],
  selectedCuisines: [],
  monthlySalary: null,
  accountBalance: null,
  useEligibility: false,
});

function main() {
  const { offers, restaurantsEnrichment, requirements } = loadDataset();
  const summary = readJson(path.join(DATA_DIR, "summary.json"));

  // Discover a real bank + cuisine present in the data so those filter cases
  // actually narrow the result rather than no-op.
  const sampleBank = offers.find((o) => o.bank)?.bank;
  const sampleCuisine = (() => {
    for (const o of offers) {
      const c = restaurantsEnrichment[o.restaurant]?.servesCuisine;
      if (Array.isArray(c) && c.length) return c[0];
    }
    return null;
  })();

  const cases = [
    { name: "default (all, bill 10000, no filters, elig off)", patch: {} },
    { name: "city=karachi", patch: { city: "karachi" } },
    { name: "bill=25000", patch: { orderValue: 25000 } },
    { name: "bank filter", patch: sampleBank ? { selectedBanks: [sampleBank] } : {} },
    { name: "cuisine filter", patch: sampleCuisine ? { selectedCuisines: [sampleCuisine] } : {} },
    { name: "eligibility ON, salary=150000", patch: { useEligibility: true, monthlySalary: 150000 } },
  ];

  let failures = 0;
  const fail = (msg) => { failures++; console.error(`[rank-api] ✗ ${msg}`); };

  for (const c of cases) {
    const settings = { ...baseSettings(), ...c.patch };
    const { recs, totalVenueCount, scoringVenueCount, total } = (() => {
      const r = rankCards({ offers, restaurantsEnrichment, requirements, settings });
      return { ...r, total: r.recs.length };
    })();

    // 1) sorted by score desc, tie-break coverageAdjustedSaving then coverage
    let sortOk = true;
    for (let i = 1; i < recs.length; i++) {
      const a = recs[i - 1], b = recs[i];
      if (b.score > a.score + 1e-9) { sortOk = false; break; }
      if (Math.abs(b.score - a.score) <= 1e-9) {
        if (b.coverageAdjustedSaving > a.coverageAdjustedSaving + 1e-9) { sortOk = false; break; }
        if (Math.abs(b.coverageAdjustedSaving - a.coverageAdjustedSaving) <= 1e-9 &&
            b.coverage > a.coverage + 1e-9) { sortOk = false; break; }
      }
    }
    if (!sortOk) fail(`${c.name}: result not sorted by score/coverageAdjustedSaving/coverage`);

    // 2) scores in [0, 100]
    const badScore = recs.find((r) => !(r.score >= 0 && r.score <= 100));
    if (badScore) fail(`${c.name}: score out of [0,100] → ${badScore.bank}/${badScore.card} = ${badScore.score}`);

    // 3) bank/cuisine filters honored
    if (c.patch.selectedBanks?.length) {
      const leak = recs.find((r) => !c.patch.selectedBanks.includes(r.bank));
      if (leak) fail(`${c.name}: bank filter leaked ${leak.bank}`);
    }

    // 4) eligibility filter: no ineligible when useEligibility && salary/balance set
    if (settings.useEligibility && (settings.monthlySalary !== null || settings.accountBalance !== null)) {
      const leak = recs.find((r) => r.requirementStatus?.status === "ineligible");
      if (leak) fail(`${c.name}: ineligible card leaked → ${leak.bank}/${leak.card}`);
    }

    // 5) every rec carries the eligibility overlay fields the contract promises
    const missing = recs.find((r) => r.requirementStatus === undefined || r.qualificationDelta === undefined);
    if (missing) fail(`${c.name}: rec missing requirementStatus/qualificationDelta`);

    if (!Number.isFinite(totalVenueCount) || !Number.isFinite(scoringVenueCount)) {
      fail(`${c.name}: non-finite venue counts`);
    }

    console.log(`[rank-api] ✓ ${c.name} — ${total} cards, scores ${recs.length ? recs[recs.length-1].score.toFixed(2)+".."+recs[0].score.toFixed(2) : "—"}, venues ${totalVenueCount}/${scoringVenueCount}`);
  }

  // 6) DEFAULT scope === summary.json (eligibility off ⇒ delta 0 ⇒ same order/score)
  for (const scope of ["all", "karachi", "lahore", "islamabad"]) {
    const settings = { ...baseSettings(), city: scope };
    const { recs } = rankCards({ offers, restaurantsEnrichment, requirements, settings });
    const got = recs.map((c) => `${c.bank}||${c.card}|${(c.score ?? 0).toFixed(4)}`);
    const want = (summary.scopes[scope] || []).map((c) => `${c.bank}||${c.card}|${(c.score ?? 0).toFixed(4)}`);
    let mismatch = -1;
    const n = Math.max(got.length, want.length);
    for (let i = 0; i < n; i++) { if (got[i] !== want[i]) { mismatch = i; break; } }
    if (got.length !== want.length || mismatch >= 0) {
      fail(`summary parity scope="${scope}": endpoint=${got.length} cards, summary=${want.length} cards` +
        (mismatch >= 0 ? ` | first diff @${mismatch}: endpoint=${got[mismatch] || "—"} summary=${want[mismatch] || "—"}` : ""));
    } else {
      console.log(`[rank-api] ✓ summary parity scope="${scope}" — ${got.length} cards identical (order + score)`);
    }
  }

  if (failures) {
    console.error(`[rank-api] FAILED: ${failures} assertion(s) failed.`);
    process.exit(1);
  }
  console.log("[rank-api] PASS: /api/rank compute pipeline is internally consistent and matches summary at default scope.");
}

main();
