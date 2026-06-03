// Corpus filters — single source of truth for which places/reviews we keep.
// gosom can't express these (no review-sort/limit/closed flags), so we apply them
// in post-processing: place-level filters gate the expensive deep-review pull (Pass B),
// review-level filters shape the per-place corpus.
//
// Defaults match the agreed policy:
//   - drop permanently-closed places (best-effort; Google search already excludes most)
//   - drop places with < MIN_REVIEW_COUNT Google reviews (too thin to rank)
//   - per place, keep only the MOST RECENT MAX_REVIEWS_PER_PLACE reviews
//   - drop reviews older than REVIEW_MAX_AGE_YEARS

export const FILTERS = {
  minReviewCount: 50,         // place must have at least this many Google reviews
  maxReviewsPerPlace: 500,    // keep only the N most-recent reviews per place
  reviewMaxAgeYears: 2,       // drop reviews older than this
};

// Best-effort closed detection. gosom leaves `status` empty, so we sniff title/status text.
// Google Maps search rarely returns permanently-closed places, so this is a backstop.
export function isPermanentlyClosed(place) {
  const s = `${place.status || ""} ${place.title || ""}`.toLowerCase();
  return /permanently closed/.test(s) || /\bclosed\b/.test(`${place.status || ""}`.toLowerCase());
}

export function reviewCountOf(place) {
  return place.review_count ?? place.google_review_count ?? 0;
}

// Place gate (used to select deep-pull targets and to drop places in 01).
export function placeQualifies(place, f = FILTERS) {
  if (isPermanentlyClosed(place)) return false;
  if (reviewCountOf(place) < f.minReviewCount) return false;
  return true;
}

// Review age gate. ts is UNIX SECONDS; undated reviews (ts falsy) are treated as
// failing the age test, since we can't prove they're within the window.
export function reviewWithinAge(ts, f = FILTERS, now = Date.now()) {
  if (!ts) return false;
  const cutoff = now / 1000 - f.reviewMaxAgeYears * 365.25 * 86400;
  return ts >= cutoff;
}

// Apply age filter, sort newest-first, cap to the most-recent N. `reviews` carry `.ts` (seconds).
export function capRecentReviews(reviews, f = FILTERS, now = Date.now()) {
  return reviews
    .filter(r => reviewWithinAge(r.ts, f, now))
    .sort((a, b) => b.ts - a.ts)
    .slice(0, f.maxReviewsPerPlace);
}
