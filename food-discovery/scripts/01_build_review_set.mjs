// 01 — Build the review training set from the raw Google Maps scrape.
//
// Input:  food-discovery/data/raw/scrape.json   (one place per line, gosom JSON)
// Output: food-discovery/data/work/reviews.jsonl (sampled training reviews)
//         food-discovery/data/work/entities.json (brands -> branches, with metadata)
//
// Policy (see lib/filters.mjs): drop closed places, drop places with < minReviewCount
// Google reviews, keep only the most-recent maxReviewsPerPlace reviews per place, and
// drop reviews older than reviewMaxAgeYears.
import fs from "fs";
import { placeQualifies, capRecentReviews, reviewCountOf, isPermanentlyClosed, reviewWithinAge, FILTERS } from "./lib/filters.mjs";

const RAW_DIR = "food-discovery/data/raw";
const OUT_REVIEWS = "food-discovery/data/work/reviews.jsonl";
const OUT_ENTITIES = "food-discovery/data/work/entities.json";

const MIN_LEN = 40;         // skip trivially short reviews

const CITIES = ["Karachi", "Lahore", "Islamabad", "Rawalpindi"];

// --- brand normalization: collapse a branch title to its brand identity ---
function normalizeBrand(title) {
  let t = (title || "").trim();
  // drop everything after a " - " / " | " (usually the branch/area)
  t = t.split(/\s+[-|–]\s+/)[0];
  // strip trailing "Branch", area words, city names
  t = t.replace(/\b(branch|restaurant|cafe|café|kitchen|foods?|grill|bbq)\b\.?$/gi, "").trim();
  for (const c of CITIES) t = t.replace(new RegExp(`\\b${c}\\b`, "gi"), "").trim();
  t = t.replace(/[-|–,]+$/g, "").trim();
  return t || (title || "").trim();
}

function inferCity(place) {
  const hay = `${place.complete_address ? JSON.stringify(place.complete_address) : ""} ${place.address || ""}`;
  for (const c of CITIES) if (new RegExp(`\\b${c}\\b`, "i").test(hay)) return c === "Rawalpindi" ? "Islamabad" : c;
  // fall back to the search query (input_id often carries it)
  const q = `${place.input_id || ""}`;
  for (const c of CITIES) if (new RegExp(c, "i").test(q)) return c;
  return "Unknown";
}

function reviewText(r) { return (r.text_original || r.Description || "").trim().replace(/\s+/g, " "); }
function reviewTs(r) {
  if (r.posted_at_unix_micros) return Math.floor(Number(r.posted_at_unix_micros) / 1e6);
  if (r.published_at) { const t = Date.parse(r.published_at); if (!isNaN(t)) return Math.floor(t / 1000); }
  return 0;
}
function reviewStars(r) { return r.Rating || r.rating_float || (r.rating_scale && r.rating ? r.rating : null) || null; }

// read all GMaps place files (.json + .jsonl), skipping the Foodpanda menu files
const files = fs.readdirSync(RAW_DIR).filter(f => (f.endsWith(".json") || f.endsWith(".jsonl")) && !/foodpanda/i.test(f));
const lines = files.flatMap(f => fs.readFileSync(`${RAW_DIR}/${f}`, "utf8").trim().split("\n").filter(Boolean));
const brands = {};            // brandKey -> { name, branches: {branchId -> branchObj} }
const branchReviews = {};     // branchId -> [reviewRecord]  (before age/recency caps)

let placesTotal = 0, dropClosed = 0, dropThin = 0, placesKept = 0;

for (const ln of lines) {
  let place; try { place = JSON.parse(ln); } catch { continue; }
  const title = place.title;
  if (!title) continue;
  placesTotal++;

  // PLACE FILTERS: closed + minimum review count
  if (isPermanentlyClosed(place)) { dropClosed++; continue; }
  if (reviewCountOf(place) < FILTERS.minReviewCount) { dropThin++; continue; }
  placesKept++;

  const city = inferCity(place);
  const brandName = normalizeBrand(title);
  const brandKey = brandName.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const branchId = place.place_id || place.cid || `${brandKey}-${title}`;

  brands[brandKey] ||= { name: brandName, branches: {} };
  brands[brandKey].branches[branchId] ||= {
    branch_id: branchId, brand_key: brandKey, brand: brandName, title, city,
    place_id: place.place_id || null,
    lat: place.latitude ?? null,
    lng: place.longitude ?? place.longtitude ?? null,
    address: place.address || null,
    categories: place.categories || (place.category ? [place.category] : []),
    price_range: place.price_range || null,
    google_rating: place.review_rating ?? null,
    google_review_count: place.review_count ?? null,
    has_popular_times: !!place.popular_times,
    delivery: (place.order_online || []).map(o => o.source).filter(Boolean),
    review_pool: 0,
  };

  // collect candidate reviews (deep + preview), dedup by text prefix
  const revs = [...(place.user_reviews_extended || []), ...(place.user_reviews || [])];
  const seen = new Set();
  for (const r of revs) {
    const text = reviewText(r);
    if (text.length < MIN_LEN) continue;
    const key = text.slice(0, 80);
    if (seen.has(key)) continue; seen.add(key);
    (branchReviews[branchId] ||= []).push({
      _branchId: branchId, _brandKey: brandKey, brand: brandName, branch_title: title, city,
      stars: reviewStars(r), ts: reviewTs(r), text,
    });
  }
}

// REVIEW FILTERS, per place: drop > reviewMaxAgeYears old, keep most-recent maxReviewsPerPlace.
const kept = [];
let reviewId = 0, candidateReviews = 0, droppedAge = 0, droppedOverCap = 0;
for (const [branchId, revs] of Object.entries(branchReviews)) {
  candidateReviews += revs.length;
  const withinAge = revs.filter(r => reviewWithinAge(r.ts));
  droppedAge += revs.length - withinAge.length;
  const capped = capRecentReviews(revs);            // age + newest-first + slice(maxReviewsPerPlace)
  droppedOverCap += withinAge.length - capped.length;
  for (const r of capped) { r.review_id = reviewId++; kept.push(r); }
}

// write reviews.jsonl
fs.writeFileSync(OUT_REVIEWS, kept.map(r => JSON.stringify({
  review_id: r.review_id, brand: r.brand, branch_id: r._branchId, brand_key: r._brandKey,
  city: r.city, stars: r.stars, ts: r.ts, text: r.text,
})).join("\n"));

// entities.json: only branches that kept >=1 review
const usedBranches = new Set(kept.map(r => r._branchId));
const entities = {};
for (const [bk, b] of Object.entries(brands)) {
  const branches = Object.values(b.branches).filter(x => usedBranches.has(x.branch_id));
  if (!branches.length) continue;
  entities[bk] = { brand: b.name, brand_key: bk, branch_count: branches.length, branches };
}
fs.writeFileSync(OUT_ENTITIES, JSON.stringify(entities, null, 1));

// --- report ---
const cityCounts = {};
kept.forEach(r => cityCounts[r.city] = (cityCounts[r.city] || 0) + 1);
console.log("=== build_review_set ===");
console.log(`filters: minReviews=${FILTERS.minReviewCount}, maxPerPlace=${FILTERS.maxReviewsPerPlace}, maxAge=${FILTERS.reviewMaxAgeYears}y`);
console.log(`places: ${placesTotal} seen → dropped ${dropClosed} closed, ${dropThin} thin(<${FILTERS.minReviewCount} reviews) → ${placesKept} kept, ${usedBranches.size} with usable reviews`);
console.log(`reviews: ${candidateReviews} candidates → dropped ${droppedAge} (>${FILTERS.reviewMaxAgeYears}y), ${droppedOverCap} (over ${FILTERS.maxReviewsPerPlace}/place) → ${kept.length} kept`, cityCounts);
console.log("brands:", Object.keys(entities).length);
