# Konsacard Food Intelligence — Architecture & Pipeline

The definitive design for Konsacard's food-discovery system: a structured intelligence
layer over Pakistani restaurants that answers real food questions **and** tells the user
which card saves them the most. This is the single source of truth for the architecture,
the offline pipeline, the models, and the runtime inference layer.

---

## 1. Goal & product thesis

Answer questions a map app and a delivery app can't, such as:

- Best mutton karahi in Karachi
- Best BBQ within 5 km of me
- Which Kababjees branch has the best handi
- Best coffee shop on my route from DHA to Clifton
- How is the service at restaurant Z
- Best biryani under Rs. 500 near me
- Best family restaurant with good ambiance and clean seating
- **…and at every one of those, the card/bank offer that makes it cheapest**

**The thesis (the moat):** discovery alone is an unwinnable fight against Foodpanda and
Google. Konsacard wins on the *combination* — **review-grounded quality + the card that
saves you most**. The card-savings layer is therefore a first-class citizen throughout this
system, not an add-on. Strip it out and we've built a worse Foodpanda.

The real asset is not reviews or menus. It is the structured intelligence layer:

```
restaurant → branch → dish → sentiment → price → card savings → confidence → location
```

---

## 2. Guiding principles

1. **LLMs label, audit, and explain — they do not classify at bulk runtime.** Use an LLM
   teacher to generate training data and handle edge cases; train specialized neural models
   to process millions of reviews cheaply; use a small LLM only for query parsing and the
   final spoken answer.
2. **Ranking is deterministic and explainable.** "Best" is arithmetic over aggregated
   signals, never a black box. Every result can state *why* ("94% of 312 karahi mentions
   positive, 1.2 km away, 15% off with HBL").
3. **Branches come from the base map layer (universal); offers join on top.** No card source
   defines the restaurant universe.
4. **Offers attach at scope `branch | brand`.** Branch-precise where the source has branch
   data; brand-wide fan-out as the default otherwise.
5. **Branch-level truth, brand as fallback.** A branch's own reviews win once it has enough;
   a sparse branch borrows its brand's reputation (hierarchical shrinkage).
6. **Confidence is explicit.** Never force a confident answer from thin evidence.
7. **Right-sized infra.** Local + SQLite/DuckDB + Cloudflare free tier now; graduate to a
   managed data stack only when data volume demands it.
8. **Derive, don't republish.** Store derived signals (scores, aspects), not verbatim
   third-party review/menu text, in served artifacts.

---

## 3. High-level architecture

```
┌──────────────────────── OFFLINE PIPELINE (batch, periodic) ─────────────────────────┐
│                                                                                       │
│  COLLECT          NORMALIZE        LABEL+TRAIN        INFER+AGGREGATE      ENRICH       │
│  Google Maps  →   clean, dedup, →  LLM labels a   →   run models on ALL →  Foodpanda    │
│  (base layer)     name/dish         sample, human     reviews → aspect/    menus+prices │
│  restaurants,     normalization     audit, train      dish scores;         + Konsacard  │
│  reviews                            specialized       brand-prior          OFFERS join  │
│                                     models (distill)  shrinkage            (scope)      │
│                                                                                         │
│                                          ↓ build serving index (branch-level) ↓        │
└───────────────────────────────────────────────────────────────────────────────────────┘
                                              │
                                       precomputed index
                                              │
┌──────────────────────── RUNTIME / INFERENCE LAYER (per query, <100 ms) ───────────────┐
│  NL query → PARSE (LLM) → RETRIEVE (geo/dish/filters) → RANK (deterministic, incl.     │
│  card savings + brand shrinkage) → SYNTHESIZE (grounded answer naming the best card)   │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Data sources

| Source | Role | Notes |
|---|---|---|
| **Google Maps** | **Base restaurant universe** + reviews | Names, branches, geo, hours, categories, rating, review text/date, popular-times, price band. Each Google place = one **branch**. |
| **Foodpanda** | Menu items + prices | Platform/delivery pricing, not official dine-in. Timestamp + source confidence on every price. |
| **Konsacard offers** | **Card savings (the moat)** | Peekaboo (branch-level), NBP & Easypaisa (brand-level). Bank, card, discount, days, order types, caps. |
| **OSM / Overture / Foursquare** | Optional base supplement | Legal open-data coverage backfill. |
| Restaurant sites / socials | Later | Official menus, dine-in pricing, new items. |
| User submissions / owner dashboard | Later | Price corrections, menu updates, official data. |

**Sourcing reality:** Google Maps and Foodpanda collection are against those platforms'
ToS. This is an accepted, owned risk. Mitigations: treat as bootstrap, derive aggregates
rather than republish verbatim text, timestamp + confidence everything, and move toward
first-party data (owner dashboard, user submissions) over time.

---

## 5. Raw data layer

Store raw source records immutably before transforming.

```json
// raw Google restaurant (branch)
{ "source":"google_maps","google_place_id":"...","name":"Kababjees - Do Darya",
  "address":"...","city":"Karachi","area":"Do Darya","lat":24.789,"lng":67.101,
  "rating":4.4,"review_count":12000,"categories":["Pakistani restaurant"],
  "opening_hours":{},"popular_times":{},"price_band":"Rs 2,000–3,000","collected_at":"..." }

// raw review
{ "source":"google_maps","google_place_id":"...","review_id":"...","rating":5,
  "text":"The handi was amazing but service was slow.","language":"en",
  "review_date":"2025-11-12","author_id_hash":"...","collected_at":"..." }

// raw Foodpanda restaurant + menu item
{ "source":"foodpanda","foodpanda_id":"...","name":"Kababjees - Do Darya","url":"...",
  "city":"Karachi","area":"Do Darya","lat":24.790,"lng":67.102,"collected_at":"..." }
{ "foodpanda_id":"...","item_id":"...","category":"BBQ","name":"Chicken Malai Boti",
  "description":"10 pieces","price":1550,"discounted_price":null,"currency":"PKR",
  "availability":"available","collected_at":"..." }

// raw Konsacard offer
{ "source":"peekaboo|nbp|easypaisa","restaurant":"Kababjees","city":"Karachi",
  "bank":"HBL","card":"Visa Gold Debit","cardCategory":"debit","discountPct":15,
  "discountLabel":"15%","offerTitle":"15% off","days":[0,1,2,3,4,5,6],
  "orderTypes":["Dine-In"],"capPkr":null,"sourceLat":24.79,"sourceLng":67.10,
  "branches":["Do Darya"],"branchCount":3,"collected_at":"..." }
```

---

## 6. Cleaning & normalization

- **Reviews:** dedup, drop empty/spam, normalize whitespace, detect language, keep original
  + a normalized text for modeling, optionally sentence-split.
- **Restaurant names:** strip case/punctuation, branch suffixes, generic words
  (restaurant/cafe/kitchen/foods), area names → `kababjees do darya`.
- **Dish text:** map surface variants to canonical (`karhai/kadai→karahi`,
  `nehari→nihari`, `briyani→biryani`, `seekh kebab→seekh kabab`). This layer is essential
  for Pakistani food and feeds the ontology (§11).

  **Implemented (spike):** `data/gazetteer.json` (canonical dish/cuisine vocabulary + aliases,
  English + Roman Urdu) + `scripts/lib/gazetteer.mjs` (longest-phrase word-boundary matcher with
  protein-modifier capture, multi-dish splitting, and sentence/noise rejection). Wired into
  `04_aggregate` (dishes keyed on canonical id; per-branch cuisine rollup derived) and
  `05_rank_demo` (`canonicalizeQuery` → dish vs cuisine intent, exact lookup). On the 240-review
  set this collapsed **191 raw dish strings → 52 canonical dishes** and pooled fragmented evidence
  (e.g. `nehari/nihari/beef nihari` → one `nihari` score).

  **Completeness is a loop, not a list** — a hand-authored gazetteer is always sample-fit against a
  real corpus's long tail. Two feeders grow it: `08_harvest_menus` mines alias candidates from the
  scraped Foodpanda/GMaps menu vocabulary (the ground-truth dish universe), and `07_gazetteer_audit`
  reports coverage % and a frequency-ranked worklist of every unmapped string the teacher emits per
  batch. This realizes the "normalization 2k→10k aliases (grows continuously)" line in §10.

---

## 7. Entity model: brand ↔ branch, resolution, offer join

Two-level identity is the backbone:

```
Brand   (Kababjees)               identity, cuisine, brand reputation, brand-wide offers
  └─ Branch (Kababjees Do Darya)  geo, hours, popular-times, price, its OWN reviews, branch offers
```

- **Branch authority = the base (Google) layer**, universally — not any card source.
- **Entity resolution** clusters branches into brands and matches across sources
  (Google ↔ Foodpanda ↔ Konsacard) using **name + area + geo distance + category + phone +
  menu overlap**. This is the hardest stage and where most engineering effort goes.

  ```
  match_score = 0.35·name_sim + 0.25·branch_area_sim + 0.20·geo_sim
              + 0.10·cuisine_sim + 0.10·menu_sim
  accept ≥0.85 · manual-review 0.70–0.85 · reject <0.70
  ```

- **Offer join at scope:**
  - **Peekaboo** (has branch data) → match to the specific branch by name+coords →
    `scope: branch`.
  - **NBP / Easypaisa** (no branch data) → match to brand → `scope: brand`, **fan out to all
    branches** (default; often correct, flagged as "may vary by branch").
  - **Single-location places** → brand == branch, trivial.

  A branch's applicable offers = branch-scoped offers matched to it + all brand-scoped
  offers of its brand. Keep the best discount per branch for fast ranking.

---

## 8. The extraction contract (locked)

Every review is reduced to subjective, prose-locked signals — and **only** those. Objective
data (price, hours, geo, popular-times, offers) comes free from the sources, never the model.

```json
{
  "relevant": true,                         // false if it says nothing about the experience
  "aspects": {                              // each: positive | negative | neutral | not_mentioned
    "food": "positive", "service": "negative", "ambiance": "not_mentioned",
    "value": "not_mentioned", "cleanliness": "not_mentioned",
    "wait_time": "not_mentioned", "overall": "positive"
  },
  "dishes": [ {"text":"handi","sentiment":"positive"} ],   // dish/drink/dessert mentions
  "tags": ["occasion:family","vibe:rooftop","meal:dinner","value:expensive"],
  "hygiene_concern": false
}
```

`not_mentioned` (a true 4th class) distinguishes "neutral" from "didn't talk about it" —
critical for honest aspect scoring.

---

## 9. LLM labeling strategy (the teacher)

LLMs create high-quality training labels, not permanent bulk inference.

**Stratified sample** (not random) so models see hard cases early:

```
20k random  +  10k likely-contains-dish  +  10k low-rating  +  10k mixed/ambiguous
```

**Initial targets:** 50k review-level labels · 20k dish-extraction examples ·
100k dish-level sentiment examples. (A **first usable model needs only ~10k** — the learning
curve flattens around there; scale to the above for production polish.)

**Prompt:** compact, forced JSON, the §8 schema, Roman-Urdu glossary
(mazedar/lazeez=tasty, bakwas=bad, zabardast=excellent, mehnga=expensive).

**Teacher options (no external API needed):** local 7–8B on a CUDA box (RTX 5070 / 32 GB)
or 3B on Apple Silicon; or Haiku subagents in waves (each writes labels to a file). Labeling
10k locally is a few hours; the full corpus is a few-day background grind.

**Human audit:** 1–2k of the first 10k labels, 5% of every later batch, plus all
low-confidence/disagreement cases. Track aspect/dish/sentiment accuracy and failure modes.

---

## 10. Specialized models (the students)

Distill the teacher into fast, cheap, specialized models — **not** one generative LLM at
runtime. Four models:

| Model | Job | Recommended | Output |
|---|---|---|---|
| **Aspect sentiment** | review → per-aspect sentiment | ModernBERT-base / DeBERTa-v3-base, multi-head | pos/neg/neutral/not_mentioned per aspect |
| **Dish extraction** | review → dish spans | GLiNER, or DeBERTa/RoBERTa token classifier | dish/drink/dessert spans |
| **Dish sentiment** | (dish, context) → sentiment | ModernBERT/DeBERTa-v3 | pos/neg/neutral |
| **Dish normalization** | raw dish → canonical | embeddings (bge) + alias dict + rules + clustering | canonical_dish_id |

**Training sizes:** aspect 5k→20k→50–100k reviews · dish extraction 2k→10k→20–50k ·
dish sentiment 5k→25k→100k mentions · normalization 2k→10k aliases (grows continuously).

**Active learning loop:** train → run on unlabeled → pick uncertain (low confidence,
aspect⇄star conflict, unknown dish terms, Roman Urdu, sarcasm, mixed sentiment, very long,
rare cuisine) → label those → retrain. Beats random labeling.

> Bootstrap note: a single generative student (text→JSON) is a valid Phase-2 shortcut; the
> four-model decomposition above is the production target (faster, more accurate, auditable).

---

## 11. Pakistani food ontology

The component that turns casual mentions and specific menu items into one vocabulary.

```json
// canonical dish
{ "canonical_dish":"chicken karahi","base_dish":"karahi","protein":"chicken",
  "category":"Pakistani curry",
  "aliases":["chicken karhai","chicken kadai","murgh karahi"],
  "related":["mutton karahi","white karahi","boneless karahi"] }

// category includes (powers "best BBQ" even when no review says "bbq")
{ "category":"BBQ",
  "includes":["seekh kabab","malai boti","chicken tikka","bihari boti","reshmi kabab","chapli kabab"] }

// alias table
{ "nihari":["nehari","nihaari"], "biryani":["briyani","biriani"],
  "karahi":["karhai","kadai"], "chai":["tea","doodh patti","milk tea"] }
```

Categories: Biryani, Karahi, Handi, Nihari, Haleem, BBQ, Kabab, Rolls, Burgers, Pizza,
Chinese-Pakistani, Coffee, Tea, Desserts, Breakfast, Street food, Fast food, Seafood.
Dish embeddings (bge) handle fuzzy/novel mentions beyond the alias table.

---

## 12. Foodpanda menu & price layer

- **Collect:** per Google branch, normalize name → search Foodpanda → match candidates
  (§7 scoring) → if high-confidence, scrape menu, **timestamp every price**.
- **Parse menu items** into structure:
  `Chicken Makhni Handi Full → {protein:chicken, style:makhni, base_dish:handi, size:full}`.
- **Match menu item → canonical dish** (exact/alias + embedding + modifier/category
  compatibility + restaurant context):
  ```
  dish_match = 0.35·exact_or_alias + 0.25·embedding_sim + 0.15·modifier_compat
             + 0.15·category_compat + 0.10·restaurant_context
  ```
- **Price freshness:** fresh 0–14d · usable 15–45d · stale 45d+ (down-weight in ranking).
- **Price ranges, not false precision:** a review saying "the handi was great" maps to the
  branch's handi **range** (Rs 1,350–2,450), not one menu item.

---

## 13. Konsacard offer / savings layer — the moat

Joined onto branches/brands in §7. At serve time, each branch carries its **applicable
offers** and a computed **best card**:

```json
// branch.offers (resolved)
[ {"bank":"HBL","card":"Visa Gold Debit","discountPct":15,"days":[...],
   "orderTypes":["Dine-In"],"capPkr":null,"scope":"branch"},
  {"bank":"Meezan","card":"Mastercard World Debit","discountPct":20,"scope":"brand"} ]
```

- **`savings` is a first-class ranking term** (§14, §17).
- **Best-card computation** is contextual: filter offers by day, order type (dine-in vs
  delivery), and the user's own cards if known; pick max effective discount under caps.
- **Personalization:** if the user tells us their cards, rank by *their* achievable savings;
  otherwise show the best available card and name it.

---

## 14. Aggregation layer

Roll review predictions up to branch and brand, per aspect and per canonical dish.

**Per branch × dish / aspect:** mention counts (pos/neg/neutral), positive rate, recent
rate, confidence, example review ids.

**Brand-prior shrinkage** (the branch-vs-brand answer): a branch's score blends its own rate
with its brand's rate, weighted by how much data the branch has.

```
score = (n · branch_rate + k · brand_rate) / (n + k)
```

- Large `n` → branch speaks for itself (a proven-bad branch shows as bad regardless of brand).
- Small `n` → leans on brand reputation (a sparse/new branch is estimated from the chain).
- `n = 0` → falls back to the brand prior, flagged low-confidence.

**Confidence-adjusted ranking** (don't let 5 mentions beat 850):

```
adjusted = (raw·mentions + global_avg·smoothing) / (mentions + smoothing)
```

**Recency weighting:** 0–90d high · 90–365d medium · 1y+ low — quality drifts over time.

**Value score:** `food_quality / normalized_price`, with **category-specific** normalization
(Rs 1,500 is cheap for karahi, expensive for coffee).

---

## 15. Runtime / inference layer

The user-facing path. Target <100 ms over a precomputed index; LLM only for parse + answer.

```
NL query → PARSE → RETRIEVE → RANK → SYNTHESIZE
```

### 15.1 Parse (small LLM, or rules + ontology)
Freeform query → structured intent:
```json
{ "dish":"mutton karahi", "cuisine":null, "city":"Karachi", "near_me":true,
  "route":null, "max_price":null, "occasion":null, "vibe":null, "meal":null,
  "open_now":true, "user_cards":["HBL Visa Debit"] }
```
The LLM only *translates*; it never ranks.

### 15.2 Retrieve (candidate generation)
Filter **branches** by city/area, geo (haversine for near-me; polyline-buffer for route),
open-now (hours), order type, and dish/cuisine presence (via the ontology, so "bbq" expands
to seekh kabab/malai boti/etc.). Brand-prior fills branches lacking direct dish evidence.

### 15.3 Rank (deterministic, explainable)
Branch-level score, grouped by brand. Weights are tunable; savings is always present.

```
score(branch | query, user) =
    w_dish     · dish_or_intent_match     // shrinkage-adjusted dish/aspect score
  + w_quality  · overall_quality          // Bayesian star + food aspect
  + w_savings  · card_savings             // best achievable discount (user's cards if known)
  + w_distance · proximity_decay          // near-me / route detour
  + w_recency  · recency
  + w_value    · value_score              // when price/budget matters
  − penalties                             // hygiene_concern, closed, low confidence, stale price
```

Query-type variants:
- **"best <dish> in <area>"** → emphasize `dish_match` + `quality`, then `savings`.
- **"best <dish> near me / on route"** → add `proximity_decay`; route uses detour distance
  from the polyline.
- **"best <dish> under Rs X"** → hard price filter (Foodpanda range) + `value_score`.
- **"which <chain> branch has best <dish>"** → restrict to one brand, rank branches:
  ```
  branch_dish = 0.45·dish_score + 0.20·recent_dish + 0.15·service
              + 0.10·confidence + 0.10·consistency
  ```
- **"how is service at Z"** → return Z's aspect breakdown + representative quotes, no ranking.

### 15.4 Synthesize (small LLM or template)
Input = the ranked facts only (`use ONLY these facts`). Output = a 2–3 sentence grounded
answer that leads with #1, cites the review evidence, and **names the best card**:

> "Ghaffar Kabab House — its mutton karahi is praised in 312 reviews (94% positive), 1.2 km
> away, and you'll get **15% off with your HBL debit card**."

### 15.5 Confidence handling
Never fake certainty. Surface the basis:
- "Tariq Road branch — karahi rated poorly (based on 60 reviews here)." ← branch-verified
- "Bahria branch — likely good (estimated from Kababjees overall; few reviews yet)." ← prior
- "Foodpanda match uncertain — price not shown."

---

## 16. Database design

```
restaurant_entities      canonical brand/branch identity (chain_id, branch, city, area, lat/lng)
chains                   brand-level identity
google_places            raw Google branch records → restaurant_id
foodpanda_restaurants    raw Foodpanda records
source_matches           cross-source links (score, status, signals)
reviews                  raw reviews → restaurant_id
review_predictions       per-model aspect labels + confidences + model_version + processed_at
review_dish_mentions     dish spans → canonical_dish_id, sentiment, confidence, offsets
canonical_dishes         ontology nodes (base_dish, protein, category)
dish_aliases             alias → canonical_dish_id
menu_items               Foodpanda items (raw_name, parsed fields, price, observed_at)
menu_item_dish_matches   menu_item → canonical_dish (score, type)
restaurant_aspect_scores aggregated aspects (+ recent, confidence)
restaurant_dish_scores   aggregated per dish (counts, raw/adjusted/recent, confidence, examples)
branch_aspect_scores     branch-level aspects
branch_dish_scores       branch-level dish (with brand-prior shrinkage applied)
offers                   Konsacard offers → restaurant_id/branch_id, scope, bank, card, discount, days, caps
branch_offers            resolved applicable offers per branch (+ best_offer)
restaurant_price_scores  value/price aggregates
areas                    geo areas
model_versions           model_name, version, dataset_version, metrics, created_at
labeling_jobs / training_datasets   provenance
```

**Never overwrite predictions** — keep `model_version`, `processed_at`, `confidence`,
input-text version, so the corpus can be reprocessed when models improve.

---

## 17. Infrastructure & orchestration (right-sized, phased)

| Concern | Now (spike → MVP, local + free) | At scale (millions of reviews) |
|---|---|---|
| Store | SQLite / DuckDB + JSON index | PostgreSQL + PostGIS + pgvector |
| Search | in-memory filter over index | OpenSearch / Elasticsearch / Meilisearch |
| Geo | haversine in code | PostGIS (radius, route-adjacent) |
| Object store | local disk | S3 / GCS / MinIO (raw dumps, snapshots) |
| Orchestration | numbered scripts + cron | Airflow / Prefect / Dagster / Temporal |
| Queues | none | Redis/Celery / RabbitMQ / Kafka |
| Models | local Ollama (teacher) + CPU students | GPU batch inference |
| Serving | Cloudflare Workers (`/api/discover`) + precomputed artifacts; mobile mirror in `algorithms.ts` | same, scaled |

Do not stand up Kafka/Airflow to rank Karachi. Graduate components only when volume forces it.

**Pipeline jobs:** collect_google → clean → sample → llm_label → human_audit →
train_aspect/dish/sentiment/normalize → bulk_inference → aggregate (+shrinkage) →
collect_foodpanda → match_foodpanda → scrape_menus → match_dishes → join_offers →
compute_value+savings → publish_index.

---

## 18. Model versioning & evaluation

Track every model: name, version, training-dataset version, label-schema version, metrics.

- **Aspect:** accuracy, macro-F1, per-aspect F1, `not_mentioned` precision, confusion matrix.
- **Dish extraction:** entity P/R/F1, exact + partial span match.
- **Dish sentiment:** accuracy, macro-F1, pos/neg F1.
- **Normalization:** top-1/top-3 accuracy, false-merge / false-split rate.

**Evaluate on slices, not just overall:** Karachi/Lahore/Islamabad; high-end vs dhaba; BBQ
vs biryani vs cafe; Roman Urdu vs English vs mixed; short vs long; 1★ vs 5★.

---

## 19. Quality & safety

- **Data quality:** duplicate restaurants/reviews, wrong branch matches, Foodpanda
  mismatches, alias mistakes, price outliers, stale prices.
- **Spam / fake reviews:** similar-text bursts, rating spikes, generic one-liners, repeated
  reviewer behavior → **reduce confidence**, don't necessarily delete.
- **Low confidence:** withhold or hedge; never force a ranking from thin evidence.

---

## 20. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Noisy/vague Google reviews | confidence scoring, volume, aspect-specific models, recency |
| Dish ambiguity (roll/bbq/handi) | ontology, menu context, category constraints, confidence |
| Wrong cross-source matching | probabilistic match, thresholds, manual review band, stored signals |
| Stale Foodpanda prices | observed_at, freshness rules, price ranges, source confidence |
| Over-reliance on LLMs | LLM for labels/edge/explain only; trained students for bulk |
| **Sourcing legality (Google/Foodpanda ToS)** | bootstrap only, derive-don't-republish, timestamps, shift to first-party data |
| **Losing the moat** | card savings is a first-class ranking term and named in every answer |

---

## 21. Phased roadmap

1. **MVP data foundation** — Google restaurants + reviews for **Karachi only**; raw tables,
   cleaning, dedup, exploration. *(Spike already validated this end-to-end.)*
2. **LLM labeling + first models** — label schema, ~10k labels, human audit, first
   aspect/dish/dish-sentiment models. *(Distillation loop already proven.)*
3. **Bulk review intelligence** — run models on all reviews; restaurant/branch/dish scores
   with shrinkage. *(Aggregation + shrinkage already proven.)*
4. **Food ontology** — canonical dishes, aliases, categories, embeddings, normalization svc.
5. **Foodpanda menu & price layer** — candidates, matching, menu parsing, dish matching,
   freshness, value scoring.
6. **Konsacard offer layer + ranking & search** — offer join at scope, savings in the
   scorer, geo/dish search, the runtime inference layer, grounded explanations.
   *(Offer join at scope + grounded synthesis already proven in the spike.)*
7. **Continuous improvement** — active learning, retraining, user feedback, owner dashboard,
   price updates, quality monitoring.

**First useful milestones, in order:** (a) summarize any restaurant (best dishes, top
complaints, service/ambiance/value); (b) "best <dish> in <area>" with card savings; (c) add
Foodpanda prices, budget filters, and value ranking; (d) geo/route queries.

---

## 22. Already built & validated (the spike)

A working local proof on 240 real KHI/LHR/ISB reviews has already validated the spine:
scrape → review set → entity resolution + **offer join at scope branch|brand** → LLM
extraction to the locked contract (240/240, 0 failures) → per-branch aggregation with
**brand-prior shrinkage** → deterministic ranking + grounded synthesis naming the card →
**distillation proof** (a model trained only on teacher labels hit 83% vs 62% baseline on
held-out reviews). This document is the scaled, production-grade generalization of that spine
— with the specialized-model decomposition, food ontology, Foodpanda price layer, and runtime
inference layer fully specified, and the card-savings moat woven through every layer.
