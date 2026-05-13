# Pipeline Architecture

## Overview

Card Match PK has two parallel data pipelines that converge at SEO page generation:

```
                   ┌──────────────────────┐
                   │   data/offers.json   │  ← The primary app dataset
                   │  (~23K offer rows)   │
                   └──────────┬───────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
   Peekaboo API      Easypaisa public      NBP workbook
   (authenticated)   pages (scraped)       (Excel .xlsx)
         │                    │                    │
         ▼                    ▼                    ▼
   refresh_peekaboo    extract_easypaisa    extract_nbp_merchants
         │                    │                    │
         ▼                    ▼                    ▼
   data/offers.json     data/sources/       data/sources/
   (initial)            easypaisa/          nbp/
                        discountworld-      active-merchants-
                        food.json           food.json
         │                    │                    │
         │                    ▼                    ▼
         │           merge_easypaisa       merge_nbp_into
         │           _into_offers          _offers
         │                    │                    │
         └────────────────────┼────────────────────┘
                              │
                              ▼
                     validate_offers_dataset
                              │
                              ▼
                   ┌──────────────────────┐
                   │    SEO Generation    │
                   │ generate_seo_pages   │
                   └──────────┬───────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
   banks/*/            restaurants/*/       sitemap.xml
   index.html          index.html
   (19 banks)          (~1,233 restaurants)
   banks/*/card-slug/
   index.html
   (~167 cards)
                              ▲
                              │
   ┌──────────────────────────┴──────────────────────┐
   │             Card Requirements Pipeline          │
   │                                                  │
   │  Bank websites/PDFs → pilot files (work/*.json)  │
   │                          │                       │
   │                          ▼                       │
   │              build_card_requirements_normalized  │
   │                          │                       │
   │                          ▼                       │
   │              data/card-requirements/normalized/  │
   │              cards.json                          │
   │              card_requirements.json              │
   │              sources.json                        │
   │                          │                       │
   │                          ▼                       │
   │              build_deal_requirement_card_map     │
   │                          │                       │
   │                          ▼                       │
   │              deal_requirement_card_map.json      │
   │              deal_requirement_coverage_summary   │
   └──────────────────────────────────────────────────┘
```

## Offers Pipeline Flow

### Step 1: Peekaboo API Refresh
`scripts/offers/refresh_peekaboo.py`

- Calls the authenticated Peekaboo API to get the latest dining offers
- Writes directly to `data/offers.json`
- This establishes the initial dataset and canonical restaurant names

### Step 2: Easypaisa Extraction
`scripts/offers/extract_easypaisa_discountworld.py`

- Scrapes public Easypaisa Discount World pages for food offers
- Outputs: `data/sources/easypaisa/discountworld-food.json`

### Step 3: Easypaisa Merge
`scripts/offers/merge_easypaisa_into_offers.py`

- Does a **full refresh**: strips all existing Easypaisa offers, re-adds from source
- Maps each Easypaisa card to its own row in offers.json
- Uses the same deduplication key format as the NBP merge

### Step 4: NBP Extraction
`scripts/offers/extract_nbp_merchants.py`

- Parses the NBP "Active Merchant List" Excel workbook (raw XML parsing)
- Filters: Food category, Instore vertical, POS=YES, 3 cities, minus exclusions
- Maps tier column to appropriate cards (Tier 1 → classic, Tier 2 → premium/gold)
- Extracts discount percentages, fixed discounts, caps, and BOGO offers
- Flags "Up to" discounts separately
- Outputs: `data/sources/nbp/active-merchants-food.json`

### Step 5: NBP Merge
`scripts/offers/merge_nbp_into_offers.py`

- Does a **full refresh** like Easypaisa
- Fuzzy-matches NBP merchant names to canonical restaurant names
- Each NBP source row with 5 cards becomes 5 offer rows
- Preserves source merchant name and address for traceability

### Step 6: Validation
`scripts/offers/validate_offers_dataset.py`

- Checks required fields, city values, discount ranges, deduplication
- Verifies stats consistency and restaurant-by-city index
- Ensures Easypaisa appears (sanity check that the merge ran)

## Card Requirements Pipeline

### Data Model

Three layers:

| Layer | Location | Purpose |
|-------|----------|---------|
| `raw/` | `data/card-requirements/raw/<bank-slug>/` | Captured evidence (Excel, PDFs, web captures) |
| `work/` | `data/card-requirements/work/<bank-slug>-pilot.json` | Bank-by-bank structured extraction |
| `normalized/` | `data/card-requirements/normalized/` | Cross-bank unified output |

Most banks skip the `raw/` layer — evidence URLs are embedded directly in pilot files.

### Build Steps

1. **Pilot file creation** — bank-by-bank research extracts card requirements from official sources (web pages, SOC PDFs, product pages). Format: snake_case flat `requirements{}` dict per card.

2. **Normalization** — `scripts/card_requirements/build_card_requirements_normalized.py` reads all pilot files and produces:
   - `cards.json` — card identity index
   - `card_requirements.json` — eligibility & fees per card with source traceability
   - `sources.json` — deduplicated source catalog

3. **Card name mapping** — `scripts/card_requirements/build_deal_requirement_card_map.py` matches deal-side card names to requirement-side card IDs, handling partial naming mismatches.

## SEO Page Generation

`scripts/seo/generate_seo_pages.py` consumes both `data/offers.json` and the card requirements normalized files to generate:
- Bank landing pages
- Card-specific pages
- Restaurant pages
- Index pages
- Sitemap

## Key Design Decisions

- **Full refresh on merge** — both Easypaisa and NBP merges strip their own existing offers and re-add from source. No stale data accumulation.
- **Snake_case for pilot files** — chosen because it matches the source data (Excel columns, JSON APIs) without unnecessary transforms.
- **Fuzzy restaurant matching** — NBP merchant names need matching because the Excel workbook uses different punctuation/spelling than the canonical Peekaboo restaurant names.
- **Card-level source traceability** — all non-null requirement fields for a card share all source URLs. Individual field-level provenance is captured in audit files.
