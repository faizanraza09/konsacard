# Food-Discovery — collection runbook

Practical steps to run the scrapers + build pipeline, including on a **fresh device**
(e.g. a different machine/network to get a new IP). Run all commands from the repo root.

## What git does and does NOT carry

- **Carried:** all scripts, `data/gazetteer.json`, `data/work/queries_karachi.txt`, docs.
- **NOT carried (gitignored):** everything under `data/raw/` (the scraped corpora — large +
  verbatim review text) and transient run artifacts (`*.log`, `gmaps_sweep_state.json`,
  `deep_targets.txt`, audit/worklist JSONs). On a fresh device these regenerate (see below),
  or copy them over manually (USB/AirDrop/scp) if you want to resume rather than restart.

## Prereqs

```bash
# Go 1.26+ and the gosom scraper
go install github.com/gosom/google-maps-scraper@latest   # installs to ~/go/bin/
node -v                                                  # any recent Node
# Ollama (only for the teacher/extraction step, not collection): ollama + a model
```

---

## A. Foodpanda (vendor directory + price/cuisine; menus are PerimeterX-walled)

The **listing API works** (host `disco.deliveryhero.io`). The **menu API is PerimeterX-protected**
(host `pk.fd-api.com`): a fresh IP gets a grace window of ~100 menu pulls, then it flips to a
sticky 403 CAPTCHA and a cooldown does NOT clear it. No evasion (proxies/CAPTCHA/token forging).

```bash
# 1. Discover all Karachi vendors (regenerates data/raw/foodpanda_vendors.jsonl). Safe/unblocked.
node food-discovery/scripts/fp_scrape.mjs --grid --list-only \
  --out food-discovery/data/raw/foodpanda.jsonl

# 2. Pull menus — GO SLOW to stretch the grace window. Resumable (skips vendors already saved).
node food-discovery/scripts/fp_scrape.mjs \
  --codes-from food-discovery/data/raw/foodpanda_vendors.jsonl \
  --out food-discovery/data/raw/foodpanda.jsonl --delay-ms 3000
```

When it starts returning 403s, stop — that IP is flagged. A different network gives another
~100-pull window. The vendor-level data (rating, budget tier, cuisines, discounts) is fully
available from step 1 regardless.

---

## B. Google Maps (the review corpus — the spine)

`09_gmaps_sweep` runs gosom over 77 areas × 41 categories, throttled and resumable (per-batch
checkpoint in `gmaps_sweep_state.json`, deduped by `place_id` into `data/raw/karachi_gmaps.jsonl`).
gosom drives a real browser, so it's far more block-tolerant than the Foodpanda API — but a fresh
IP still helps after heavy use (Google soft-throttles a search to ~20 results when flagged).

```bash
# Pass A — directory sweep (fast, no reviews). --max-batches caps it per session for throttling.
node food-discovery/scripts/09_gmaps_sweep.mjs                 # run to completion
node food-discovery/scripts/09_gmaps_sweep.mjs --max-batches 20  # or a chunk at a time
node food-discovery/scripts/09_gmaps_sweep.mjs --gen-only        # just (re)generate the query file

# Pass B — pick deep-pull targets (>=100 reviews, not closed), then pull recent reviews for them.
node food-discovery/scripts/10_select_deep_targets.mjs
node food-discovery/scripts/09_gmaps_sweep.mjs \
  --queries food-discovery/data/work/deep_targets.txt \
  --out food-discovery/data/raw/karachi_gmaps_reviews.jsonl \
  --state food-discovery/data/work/deep_state.json \
  --extra-reviews
```

Resume after a stop/block by re-running the same command — done queries are skipped.
Filters (min reviews, recent-500, <2yr, not closed) live in `scripts/lib/filters.mjs`.

---

## C. Build pipeline (after collecting)

```bash
node food-discovery/scripts/01_build_review_set.mjs    # apply place + review filters → reviews.jsonl
node food-discovery/scripts/02_resolve_offers.mjs      # join Konsacard offers (brand|branch scope)
node food-discovery/scripts/03_extract.mjs             # teacher labels each review (needs ollama)
node food-discovery/scripts/04_aggregate.mjs           # canonicalize dishes → per-branch scores
node food-discovery/scripts/05_rank_demo.mjs           # ranking + grounded synthesis demo

# Gazetteer maintenance (no LLM) — grow coverage from real data:
node food-discovery/scripts/07_gazetteer_audit.mjs     # coverage % + unmapped-string worklist
node food-discovery/scripts/08_harvest_menus.mjs       # alias candidates from Foodpanda menus
```

Add real dishes surfaced by 07/08 to `data/gazetteer.json`; re-run 04 to re-aggregate.
```
