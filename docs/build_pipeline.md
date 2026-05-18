# Build pipeline

The `banks/` and `restaurants/` directories on disk are **build artifacts**
generated from `data/offers.json` + `scripts/seo/generate_seo_pages.py`. They
will be ignored by git going forward (see `.gitignore`) and regenerated at
deploy time.

This document captures how to finish migrating to this model. Until step 3 is
done the old files are still tracked in git, so nothing breaks today — but
PRs touching data still produce huge diffs.

## Why ignore them?

- ~1,500 file diffs every time `data/offers.json` is refreshed make PRs
  unreviewable.
- Visual changes to the bank/restaurant page template require regenerating
  every page (we already hit this once when fixing a responsive overflow —
  had to add a higher-specificity global CSS override because inline `<style>`
  blocks in the generated HTML were frozen at generation time).
- Two devs running `npm run generate:seo` on different branches produce
  unmergeable conflicts in 1,500 files.

## How it should work

1. Source of truth: `data/offers.json` + `scripts/seo/generate_seo_pages.py`
2. CI / CF Pages runs `npm run build` (= the Python generator) on every deploy.
3. The output `banks/` and `restaurants/` directories are served by CF Pages.

## Migration steps

### 1. (Done) Add a `build` script

`package.json` now exposes:
```bash
npm run build      # runs scripts/seo/generate_seo_pages.py
npm run generate:seo  # alias
```

### 2. (Done) Ignore the directories in git

The `.gitignore` ignores `/banks/` and `/restaurants/`. Existing tracked
files inside those directories are still in the repo until step 3.

### 3. (TODO — requires Cloudflare dashboard change)

In the Cloudflare Pages dashboard for this project:

* **Settings → Builds & deployments → Build configurations**
* **Build command**: `npm run build`
* **Build output directory**: `.` (the project root — same as `pages_build_output_dir` in `wrangler.toml`)
* **Root directory**: leave as `/` (project root)
* **Environment variables**: ensure `PYTHON_VERSION=3.11` (CF Pages defaults to 2.7)

Then push a **dummy commit to `dev`** and confirm the preview deploy:

* runs the generator successfully (check Build output logs)
* the resulting preview URL serves `/banks/habib-bank-limited/` correctly
* card detail pages like `/banks/habib-bank-limited/hbl-classic-debitcard/` work

### 4. (TODO — after step 3 verified)

Once the preview deploy works without committed `banks/`/`restaurants/`,
remove the tracked files from the index (without deleting them locally):

```bash
git rm -r --cached banks/ restaurants/
git commit -m "chore: stop tracking generated SEO pages (built at deploy time)"
git push
```

The local files stay so you can keep iterating. CF Pages will rebuild them
on the next deploy.

## Local development

After pulling a fresh clone, run the generator once to populate `banks/` and
`restaurants/`:

```bash
npm run build
```

Re-run any time you change `data/offers.json` or the generator template.
