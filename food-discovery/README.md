# Food-Discovery — spike

A working end-to-end spike of the review-grounded food-discovery engine layered on
Konsacard's offer data. Built/validated entirely locally on a Mac (Apple Silicon).

> **Status:** proof-of-pipeline on a small real dataset (240 reviews, 3 cities).
> See [`REPORT.md`](./REPORT.md) for results. This is a spike, not production.

## Pipeline

```
raw Google Maps scrape (gosom)              data/raw/*.json   (gitignored — large, raw review text)
  │
  │ 01_build_review_set.mjs   → sample latest reviews, group brand/branch
  ▼
data/work/reviews.jsonl  +  entities.json
  │
  │ 02_resolve_offers.mjs     → match brands to Konsacard offers.json, attach at scope brand|branch
  ▼
data/work/entities_offers.json
  │
  │ 03_extract.mjs            → LLM (Ollama) labels each review with the contract
  ▼
data/work/labels.jsonl       {relevant, dishes[], aspects[], tags[], hygiene_concern, overall}
  │
  │ 04_aggregate.mjs          → canonicalize dishes (gazetteer) → per-branch dish/cuisine/aspect
  ▼                             scores w/ brand-prior shrinkage
data/work/scores.json        (the served index)
  │
  ├─ 05_rank_demo.mjs         → rank + LLM synthesis for example queries  → out/demo.md
  └─ 06_train_student.mjs     → distillation proof: train NB on labels    → out/student_metrics.json

gazetteer (dish/cuisine normalization — grows continuously, never "done"):
  data/gazetteer.json          canonical dish/cuisine vocabulary + aliases (English + Roman Urdu)
  scripts/lib/gazetteer.mjs    matcher: canonicalizeDish() / canonicalizeQuery()
  ├─ 07_gazetteer_audit.mjs   → coverage % + freq-ranked UNKNOWNS from reviews  (the audit loop)
  └─ 08_harvest_menus.mjs     → alias candidates mined from real Foodpanda/GMaps menus (seed loop)
```

## Run

```bash
# prerequisites: node, ollama (model: llama3.2:3b), the gosom scraper for re-scraping
ollama serve &                       # if not already running
node scripts/01_build_review_set.mjs
node scripts/02_resolve_offers.mjs
node scripts/03_extract.mjs          # ~1.3s/review on M5
node scripts/04_aggregate.mjs
node scripts/05_rank_demo.mjs
node scripts/06_train_student.mjs

# gazetteer maintenance (no LLM needed — pure normalization)
node scripts/07_gazetteer_audit.mjs   # what % of dish mentions map; worklist of unknowns to add
node scripts/08_harvest_menus.mjs     # alias candidates mined from scraped menus
```

> **On gazetteer completeness:** the dish list is a *seed*, not a finished set — no
> hand-typed list survives the long tail of a real corpus. Coverage grows two ways:
> `08_harvest_menus` proposes aliases from real menu vocabulary, and `07_gazetteer_audit`
> surfaces every unmapped string the teacher emits per corpus batch. Add the real dishes
> from those worklists to `data/gazetteer.json`; the rest is noise the matcher correctly drops.

## The extraction contract (what the LLM/ML produces per review)

```json
{ "relevant": true,
  "dishes":  [{"dish":"mutton karahi","sentiment":"positive"}],
  "aspects": [{"aspect":"food|service|ambiance|value|cleanliness|portion|wait|delivery","sentiment":"..."}],
  "tags":    ["occasion:date","vibe:rooftop","meal:breakfast","value:expensive"],
  "hygiene_concern": false,
  "overall": "positive" }
```

Only **subjective, prose-locked** signals come from the model. Objective data
(price, hours, geo, busy-ness, offers) comes free from the scrape + Konsacard.

## Key design decisions (locked)

- **Branches come from the base/scrape layer** (universal), not from any card source.
- **Offers join at `scope: branch | brand`** — Peekaboo gets branch precision; NBP/Easypaisa
  fan out brand-wide (default).
- **Ranking is at the branch level, grouped by brand**; quality uses **brand-prior shrinkage**
  so a sparse branch borrows its brand's reputation until it has enough reviews of its own.
- **Teacher → student distillation**: LLM labels → small fast model. (Here the student is a
  dependency-free NB proof; the real student is a transformer on ~10k labels.)
