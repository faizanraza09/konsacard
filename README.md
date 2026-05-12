# Card Match PK

Static web app for comparing restaurant discount cards in Pakistan across
Karachi, Lahore, and Islamabad.

The app is driven by `data/offers.json` and now combines:

- the existing Peekaboo-backed offers pipeline
- a public-source Easypaisa offers pipeline
- an NBP merchant-workbook pipeline

## Repo Structure

```text
assets/                     Frontend CSS, JS, and logo assets
data/
  offers.json               Final app dataset used by the frontend
  sources/                  Intermediate/source-specific datasets
  card-requirements/        Requirements research workspace and normalized outputs
docs/                       Process notes, pipeline docs, and roadmap
scripts/
  offers/                   Offers refresh, merge, and validation scripts
  card_requirements/        Requirements normalization and mapping builders
  dev/                      Local development utilities
```

## Main Data Outputs

Primary app dataset:

```text
data/offers.json
```

Easypaisa intermediate dataset:

```text
data/sources/easypaisa/discountworld-food.json
```

Card requirements research workspace:

```text
data/card-requirements/
  raw/
  work/
  normalized/
```

## Offers Refresh

Create a `.env` file in the project root with:

```text
PEEKABOO_TOKEN=PASTE_TOKEN_HERE
```

Then run the full offers rebuild with:

```powershell
python scripts/offers/refresh_all_offers.py
```

That orchestrates:

2. `scripts/offers/extract_easypaisa_discountworld.py`
3. `scripts/offers/merge_easypaisa_into_offers.py`
4. `scripts/offers/extract_nbp_merchants.py`
5. `scripts/offers/merge_nbp_into_offers.py`
6. `scripts/offers/validate_offers_dataset.py`

For more detail, see:

- `docs/offers_refresh_pipeline.md`

## Card Requirements Pipeline

The repo also contains a separate card eligibility / fee research workflow.

Main outputs:

```text
data/card-requirements/normalized/cards.json
data/card-requirements/normalized/card_requirements.json
data/card-requirements/normalized/sources.json
data/card-requirements/normalized/deal_requirement_card_map.json
data/card-requirements/normalized/deal_requirement_coverage_summary.json
```

Main builders:

```powershell
python scripts/card_requirements/build_card_requirements_normalized.py
python scripts/card_requirements/build_deal_requirement_card_map.py
```

Documentation:

- `data/card-requirements/README.md`
- `docs/card_requirements_agentic_pipeline.md`
- `docs/card_requirements_process.md`

## Run Locally

From the repo root:

```powershell
python scripts/dev/local_dev_server.py --host 0.0.0.0 --port 8000
```

Then open:

```text
http://localhost:8000
```

This local server supports the same clean URLs used in production, so routes like
`/about` and `/contact` work locally instead of breaking back to `.html`.

## Recommended Local Check

Before deploying:

```powershell
python scripts/offers/refresh_all_offers.py
python scripts/dev/local_dev_server.py --host 0.0.0.0 --port 8000
```

Then verify:

- city filters
- restaurant filters
- bank filters
- card type filters
- top pick and ranking output
- Easypaisa appears in bank search/filter results

## Deploy

Recommended host:

- Cloudflare Pages

Use the repo root as the static site directory.
