# Product Roadmap

This roadmap is based on the current state of the repo:

- static frontend in `index.html`, `assets/app.js`, and `assets/styles.css`
- merged offers dataset in `data/offers.json`
- unified offers refresh pipeline
- separate card-requirements research pipeline

The app already answers:

- which card gives the best restaurant discounts for a given city, restaurant
  set, day set, and bill size

The next major product shift should be:

- which card should I realistically get, and is it worth it for how I dine

## Current Position

The product already has strong foundations:

- a clear recommendation engine
- a merged issuer dataset across banks plus Easypaisa
- reproducible data refresh scripts
- a separate eligibility / fee requirements workflow

That means the next wins are not “start over” tasks.

They are:

- product hardening
- requirements integration
- data architecture cleanup
- recommendation quality improvements

## Phase 1: Tighten the Current Product

### 1. Fix stale static copy

Some static copy still understates current dataset scope.

Examples:

- hero badges in `index.html`
- any hardcoded issuer-count messaging

The dynamic filter logic already reflects the real dataset, but the static copy
should match it too.

### 2. Add trust and freshness signals

Expose:

- `Last updated` from `data/offers.json`
- a short source note such as `Bank offers + Easypaisa public offers`
- a lightweight note when some rows are missing caps or detailed schedules

This matters more now that the data comes from multiple pipelines with uneven
detail quality.

### 3. Add “why this card ranked here”

The app already computes meaningful results. Make the ranking explain itself.

Show:

- estimated savings
- coverage count
- day fit
- whether the result assumes all days

This improves user trust without changing the ranking logic itself.

### 4. Add source-quality labels

At minimum:

- `Full details available`
- `Cap unknown`
- `Days assumed all days`
- `Public-source estimate`

This will make mixed-source data safer to present.

## Phase 2: Connect the App to the Card Requirements Dataset

This is the highest-leverage product expansion.

### 1. Add “Can I get this card?”

Use:

- `data/card-requirements/normalized/cards.json`
- `data/card-requirements/normalized/card_requirements.json`
- `data/card-requirements/normalized/deal_requirement_card_map.json`

to show:

- minimum salary
- minimum balance
- annual fee
- annual fee waiver rule
- confidence / source-backed status

### 2. Add “best card you can actually qualify for”

Let users input:

- monthly salary
- account balance
- debit vs credit preference
- Islamic vs conventional preference

Then rank only cards that are plausibly eligible.

This is a large product jump in usefulness.

### 3. Add “worth it after fees?”

For premium or fee-heavy cards, subtract:

- annual fee
- likely non-reversed fee exposure

from expected savings.

This lets the app answer:

- best headline card
- best net-value card

## Phase 3: Clean Up the Data Architecture

The project works now, but the data layer is still evolving.

### 1. Add a repo-wide data refresh entrypoint

The offers pipeline already has:

- `python scripts/refresh_all_offers.py`

The next step is one higher-level entrypoint such as:

- `python scripts/refresh_all_data.py`

which would orchestrate:

- offers refresh
- Easypaisa extraction
- offers validation
- card-requirements normalization
- card crosswalk rebuild

### 2. Separate source outputs from app outputs

Recommended longer-term structure:

- `data/sources/...` for raw and intermediate source outputs
- `data/app/...` for frontend-ready outputs

Right now `data/offers.json` is both a build target and the frontend payload.
That is acceptable for now, but it becomes harder to reason about as more
sources get added.

### 3. Add schema versions

Recommended fields:

- `schemaVersion` in `data/offers.json`
- `schemaVersion` in the requirements outputs

This will make future format changes safer.

## Phase 4: Improve Recommendation Quality

### 1. Add restaurant weighting

Not all restaurants matter equally.

Possible weighting dimensions:

- premium dining
- coffee / bakery
- casual dining
- fast food
- user-selected favorites

### 2. Add user behavior profiles

Examples:

- weekend family dining
- coffee + casual lunches
- premium dinners only
- low annual-fee preference
- student / debit-only user

These can be presets on top of the existing filter system.

### 3. Add offer reliability scoring

Ranking should eventually consider:

- cap known vs unknown
- day schedule known vs assumed
- first-party vs third-party source quality
- weak vs strong evidence

### 4. Add alternate ranking views

Possible ranking modes:

- max savings
- broadest restaurant coverage
- best no-fee option
- best debit card
- best credit card
- best eligible card

## Phase 5: Product Expansion

### 1. Expand wallet / fintech coverage carefully

Easypaisa is now a precedent.

Future additions should only be taken when there is a clear public source
surface and the ingestion is maintainable.

### 2. Expand beyond dining only after dining is stable

Possible next categories:

- coffee
- groceries
- cinema
- travel

But dining should remain the core product until the quality and eligibility
layers are strong.

### 3. Add shareable comparison links

Support URL-driven state for:

- city
- selected restaurants
- bill size
- issuer filters
- card type filters

This would improve virality and reuse.

### 4. Add personal shortlist comparison

Let users:

- save top cards
- compare them side by side
- view requirements and dining value together

## Suggested Priority Order

If sequencing the next few milestones, use this order:

1. Fix stale copy and add trust/freshness signals.
2. Integrate card requirements into the UI.
3. Build `best card you can actually get`.
4. Add fee-aware / net-value ranking.
5. Add a repo-wide all-data refresh command.
6. Add source-quality labels into the frontend.
7. Only then expand scope to more issuers or categories.

## Most Important Strategic Shift

Right now the product answers:

- which card has the best dining offers

The next version should answer:

- which card should I realistically get, and is it worth it for how I dine

That is the clearest product direction for making the app materially more
useful rather than just larger.
