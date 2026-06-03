// Gazetteer matcher — canonicalizes free-text dish strings (review/menu surface
// forms, English + Roman Urdu) to canonical dish ids, cuisines and categories.
//
// Design: data lives in data/gazetteer.json (auditable, grows continuously).
// This module is the logic: longest-phrase, word-boundary alias matching, with
// protein-modifier capture, multi-dish splitting, and sentence/noise rejection.
//
//   import { canonicalizeDish, canonicalizeQuery } from "./lib/gazetteer.mjs";
//   canonicalizeDish("chicken biryani")  -> [{canonical:"biryani", cuisine:"desi", category:"rice", protein:"chicken"}]
//   canonicalizeDish("nehari")           -> [{canonical:"nihari", ...}]
//   canonicalizeDish("good food")        -> []            (noise)
//   canonicalizeQuery("bbq")             -> {kind:"cuisine", id:"bbq"}
//   canonicalizeQuery("biryani")         -> {kind:"dish", id:"biryani"}
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GAZ = JSON.parse(fs.readFileSync(path.join(HERE, "../../data/gazetteer.json"), "utf8"));

const PROTEINS = new Set(GAZ.proteins);
const STOPWORDS = new Set(GAZ.stopwords);
const MAX_EXTRA_WORDS = 3;   // accept a match only if segment isn't much longer than the alias (filters sentences)

// normalize: lowercase, strip punctuation -> single-spaced tokens
function norm(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

// category rank for tie-breaking: prefer specific dishes over bare proteins
function catRank(category) { return category === "meat" ? 9 : 1; }

// Build a flat alias index, sorted longest-phrase-first then specific-first.
const DISH_ALIASES = [];
for (const [canonical, def] of Object.entries(GAZ.dishes)) {
  for (const alias of def.aliases) {
    const a = norm(alias);
    if (a) DISH_ALIASES.push({ alias: a, words: a.split(" ").length, canonical, cuisine: def.cuisine, category: def.category, rank: catRank(def.category) });
  }
}
DISH_ALIASES.sort((x, y) => y.words - x.words || x.rank - y.rank || y.alias.length - x.alias.length);

// cuisine query index
const CUISINE_ALIASES = [];
for (const [id, aliases] of Object.entries(GAZ.cuisines)) {
  for (const a of aliases) CUISINE_ALIASES.push({ alias: norm(a), id, words: norm(a).split(" ").length });
}
CUISINE_ALIASES.sort((x, y) => y.words - x.words);

function hasPhrase(haystack, phrase) {
  return (" " + haystack + " ").includes(" " + phrase + " ");
}

function detectProtein(seg) {
  for (const tok of seg.split(" ")) if (PROTEINS.has(tok)) return tok === "anda" ? "egg" : tok;
  return null;
}

// Match a single segment (no list separators) -> {canonical,...} | null
function matchSegment(seg) {
  seg = norm(seg);
  if (!seg) return null;
  if (STOPWORDS.has(seg)) return null;
  const segWords = seg.split(" ").length;
  for (const e of DISH_ALIASES) {
    if (!hasPhrase(seg, e.alias)) continue;
    // sentence guard: alias present but buried in a long phrase -> likely prose, not a dish label
    if (segWords > e.words + MAX_EXTRA_WORDS) return null;
    return { canonical: e.canonical, cuisine: e.cuisine, category: e.category, protein: detectProtein(seg) };
  }
  return null;
}

// Public: free text -> array of canonical dish hits (deduped by canonical).
// Splits "beef nihari, chicken nihari, chana" style lists the teacher sometimes emits.
export function canonicalizeDish(raw) {
  const text = norm(raw);
  if (!text) return [];
  const segments = text.split(/\s*,\s*|\s+and\s+|\s+&\s+|\s*\/\s*|\s*\+\s*/).filter(Boolean);
  const out = [];
  const seen = new Set();
  for (const seg of segments) {
    const m = matchSegment(seg);
    if (m && !seen.has(m.canonical)) { seen.add(m.canonical); out.push(m); }
  }
  return out;
}

// Public: a query term -> {kind:"cuisine"|"dish", id} | null (null = "best overall").
// Cuisine wins over dish (e.g. "bbq", "cafe", "chinese" are cuisine intents).
export function canonicalizeQuery(term) {
  const t = norm(term);
  if (!t) return null;
  for (const c of CUISINE_ALIASES) if (hasPhrase(t, c.alias) || t === c.alias) return { kind: "cuisine", id: c.id };
  const hits = canonicalizeDish(t);
  if (hits.length) return { kind: "dish", id: hits[0].canonical };
  return null;
}

export const GAZETTEER = GAZ;
export function stats() {
  return { dishes: Object.keys(GAZ.dishes).length, aliases: DISH_ALIASES.length, cuisines: Object.keys(GAZ.cuisines).length };
}
