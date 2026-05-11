# Repo guide for agents

## What this repo is
`card-match-pk` is a static web app for comparing Pakistani dining card offers. The site ranks cards by estimated savings across Karachi, Lahore, and Islamabad and ships as static HTML/CSS/JS plus generated data files.

## Main surfaces
- `index.html` and the other root `.html` files are the public pages.
- `assets/` holds the frontend code: `app.js`, `styles.css`, `config.js`, and shared page helpers/content.
- `data/offers.json` is the main app dataset consumed by the frontend.
- `banks/` and `restaurants/` contain generated SEO-style landing pages.
- `docs/` contains process notes and pipeline docs.
- `scripts/` contains the data refresh, normalization, SEO, and local-dev scripts.

## Key workflows
### Offers dataset
Run `python scripts/offers/refresh_all_offers.py` to rebuild the app data. It:
1. refreshes the Peekaboo-backed dataset via `refresh_data.py`
2. refreshes the Easypaisa public-source dataset
3. merges Easypaisa into `data/offers.json`
4. validates the merged output
5. generates SEO pages

### Card requirements dataset
The separate card-eligibility pipeline lives under `data/card-requirements/` and `scripts/card_requirements/`.
- Raw evidence: `data/card-requirements/raw/`
- Bank pilot outputs: `data/card-requirements/work/`
- Normalized outputs: `data/card-requirements/normalized/`

Main builders:
- `python scripts/card_requirements/build_card_requirements_normalized.py`
- `python scripts/card_requirements/build_deal_requirement_card_map.py`

## Local development
Use `python scripts/dev/local_dev_server.py --host 0.0.0.0 --port 8000` for a clean-URL local server. It maps extensionless routes like `/about` to the matching `.html` files.

## Repo conventions
- Prefer editing source scripts/data rather than generated outputs unless the task is specifically about regeneration.
- Keep evidence-backed and normalized requirement data separate; do not flatten contradictions silently.
- The repo is static-site oriented; most changes are in data, HTML, CSS, or build scripts rather than a server app.

## Fast orientation
If you need to understand the app quickly, read these in order:
1. `README.md`
2. `index.html`
3. `assets/app.js`
4. `scripts/offers/refresh_all_offers.py`
5. `docs/offers_refresh_pipeline.md`
6. `docs/card_requirements_process.md`

## Deployment
The site is intended for Cloudflare Pages with the repo root as the published directory.
