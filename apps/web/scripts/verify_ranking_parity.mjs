// Golden parity check (web): proves the precomputed summary (built from the
// shared ranking-core) is exactly the ranking the BROWSER renders at the
// default scope. If this passes, shipping the summary cannot change what users
// see on first paint. Run after `build:assets:bundle` (needs dist/algorithms.js)
// and `precompute_rankings.mjs`.
//
// How: load the real browser bundles (dist/state.js then dist/algorithms.js) in
// browser order inside a vm context with a minimal DOM shim, then — INSIDE the
// context (state.js binds `state` lexically, unreachable from the host) — mutate
// `state` to each default scope, call the browser's computeRecommendations(),
// and diff its ranked (bank, card, score) list against summary.scopes[scope].

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(__dirname, "..");
const DATA_DIR = path.join(WEB, "data");
const REQ_DIR = path.join(DATA_DIR, "card-requirements/normalized");

const SCOPES = ["all", "karachi", "lahore", "islamabad"];
const ORDER_VALUE = 10000;

function readJson(p) { return JSON.parse(fs.readFileSync(p, "utf8")); }
// cityFiles/restaurantsFile carry a ?v=<hash> cache-bust suffix — strip it.
function localFile(rel) { return path.join(DATA_DIR, path.basename(String(rel).split("?")[0])); }

function loadOffers() {
  const index = readJson(path.join(DATA_DIR, "offers-index.json"));
  let offers = [];
  for (const city of index.cities) {
    const rel = index.cityFiles?.[city];
    if (rel) offers = offers.concat(readJson(localFile(rel)).offers || []);
  }
  let restaurants = {};
  if (index.restaurantsFile) {
    try { restaurants = readJson(localFile(index.restaurantsFile)).restaurants || {}; } catch {}
  }
  return { offers, restaurants };
}

function loadRequirementsRaw() {
  try {
    return {
      records: readJson(path.join(REQ_DIR, "card_requirements.json")),
      mappings: readJson(path.join(REQ_DIR, "deal_requirement_card_map.json")),
    };
  } catch { return null; }
}

function makeSandbox() {
  const noop = () => {};
  const el = () => ({
    style: {}, classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    setAttribute: noop, getAttribute: () => null, addEventListener: noop, removeEventListener: noop,
    appendChild: noop, querySelector: () => null, querySelectorAll: () => [], dataset: {}, children: [],
    textContent: "", innerHTML: "",
  });
  const sb = { console, JSON, Math, Date, Set, Map, Array, Object, Number, String };
  sb.window = sb; sb.globalThis = sb; sb.self = sb;
  sb.location = { href: "https://konsacard.pk/", search: "", hash: "", pathname: "/" };
  sb.navigator = { userAgent: "node", language: "en" };
  sb.localStorage = { getItem: () => null, setItem: noop, removeItem: noop };
  sb.matchMedia = () => ({ matches: false, addEventListener: noop, addListener: noop });
  sb.addEventListener = noop;
  sb.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  sb.document = {
    documentElement: el(), body: el(), readyState: "complete",
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    createElement: el, addEventListener: noop, location: sb.location,
  };
  return sb;
}

function main() {
  const bundlePath = path.join(WEB, "assets/dist/algorithms.js");
  const statePath = path.join(WEB, "assets/dist/state.js");
  const summaryPath = path.join(DATA_DIR, "summary.json");
  for (const [p, hint] of [[statePath, "build:assets:rest"], [bundlePath, "build:assets:bundle"], [summaryPath, "precompute_rankings.mjs"]]) {
    if (!fs.existsSync(p)) { console.error(`[parity] missing ${path.relative(WEB, p)} — run ${hint} first`); process.exit(2); }
  }

  const { offers, restaurants } = loadOffers();
  const reqRaw = loadRequirementsRaw();
  const summary = readJson(summaryPath);

  const sb = makeSandbox();
  vm.createContext(sb);
  try {
    vm.runInContext(fs.readFileSync(statePath, "utf8"), sb);
  } catch (e) {
    if (typeof vm.runInContext("typeof buildDealCardKey", sb) !== "string") {
      console.error("[parity] state.js failed to load helper globals:", e.message); process.exit(2);
    }
  }
  vm.runInContext(fs.readFileSync(bundlePath, "utf8"), sb);

  // Hand the raw inputs to the context; build requirement Maps + run the ranking
  // entirely inside the context so realm-bound types (Set/Map) match.
  sb.__offers = offers;
  sb.__restaurants = restaurants;
  sb.__reqRecords = reqRaw?.records || null;
  sb.__reqMappings = reqRaw?.mappings || null;

  vm.runInContext(`
    globalThis.__requirements = (__reqRecords && __reqMappings) ? {
      available: true,
      byCardId: new Map(__reqRecords.map(r => [r.card_id, r])),
      mappingByDealKey: new Map(__reqMappings.map(row => [
        (String(row.deal_bank_name||"").trim().replace(/\\s+/g," ").toLowerCase()) + " || " +
        (String(row.deal_card_name||"").trim().replace(/\\s+/g," ").toLowerCase()), row ])),
      estimatesByTier: new Map(),
    } : null;
    globalThis.__rankScope = function(scope) {
      state.data = { offers: __offers, restaurants: __restaurants };
      state.requirements = __requirements;
      state.selectedCity = scope;
      state.selectedDays = new Set(); state.selectedRestaurants = new Set(); state.selectedBanks = new Set();
      state.selectedCardTypes = new Set(); state.selectedCards = new Set(); state.selectedCuisines = new Set();
      state.orderValue = ${ORDER_VALUE}; state.outingsPerWeek = 1;
      state.monthlySalary = null; state.accountBalance = null; state.useEligibility = false;
      return computeRecommendations().map(c => c.bank + "||" + c.card + "|" + (c.score||0).toFixed(4));
    };
  `, sb);
  const rankScope = sb.__rankScope;

  let failures = 0;
  for (const scope of SCOPES) {
    const b = rankScope(scope);
    const e = (summary.scopes[scope] || []).map((c) => `${c.bank}||${c.card}|${(c.score ?? 0).toFixed(4)}`);
    let mismatch = -1;
    const n = Math.max(b.length, e.length);
    for (let i = 0; i < n; i++) { if (b[i] !== e[i]) { mismatch = i; break; } }
    if (b.length !== e.length || mismatch >= 0) {
      failures++;
      console.error(`[parity] ✗ scope="${scope}" MISMATCH: browser=${b.length} cards, summary=${e.length} cards`);
      if (mismatch >= 0) console.error(`         first diff @${mismatch}: browser=${b[mismatch] || "—"}  summary=${e[mismatch] || "—"}`);
    } else {
      console.log(`[parity] ✓ scope="${scope}" — ${b.length} cards identical (order + score)`);
    }
  }

  if (failures) { console.error(`[parity] FAILED: ${failures} scope(s) diverged. Summary would change the default render — do not ship.`); process.exit(1); }
  console.log("[parity] PASS: precomputed summary === browser default render for all scopes.");
}

main();
