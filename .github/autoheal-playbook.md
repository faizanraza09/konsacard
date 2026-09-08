# Daily-refresh auto-heal playbook

Operating procedure for the `daily-refresh-autoheal` routine (a Claude Code cloud agent)
when the **Daily offers refresh** workflow fails. It encodes the repairs that have been
done by hand, most recently the 2026-08-19 → 2026-09-08 outage (21 consecutive failures,
39 auto-opened issues) which this playbook's earlier version would *not* have healed.

Working directory for every command below is `apps/web` unless stated otherwise.

---

## 0. Invariants — these override anything else

1. **Never invent a financial figure.** Minimum salaries, fees and eligibility are the
   product. If a value is not published in an official document, leave the field `null`
   and record why in `bank_gaps`. A tier-median estimate shown as "estimated" is
   acceptable; a number you made up is not, ever.
2. **A bank's own document beats everything.** Schedule of Charges (SOC/SOBC) and Key
   Fact Statements first, official product pages second. Blogs, aggregators, forums and
   search snippets are never data — at most context, labelled as such.
3. **Verify locally before pushing.** Section 6 rehearses every gate offline. Never push
   a fix you have not rehearsed.
4. **`main` and `dev` stay in lockstep** for source changes: commit on `main`,
   cherry-pick to `dev`, push both (section 7).
5. **Never race the refresh workflow.** It checks out `main` and ends with
   `git push origin HEAD:main`. If you push while a run is mid-flight, its push is
   rejected and the run fails. Check for an in-flight run first; cancel it or wait.
6. **Leave an audit trail.** Comment the root cause on the failure issue, cite the exact
   document and clause behind every figure, and say plainly what you left for a human.

---

## 1. Triage — find the failing gate

```bash
gh run list --workflow=daily-refresh.yml --limit 5
gh run view <id> --log-failed | grep -iE "offers:validate|seo|error"
gh run download <id> -n refresh-report -D /tmp/rep && cat /tmp/rep/refresh-report.md
gh issue list --label daily-refresh --state open
```

If the latest run's conclusion is not `failure`, stop — nothing to do.

The diff report is the most useful artifact: it lists per-bank offer deltas, **New (bank,
card) pairs**, and new/lost restaurants. Note that **gates fail one at a time** — clearing
the first can reveal a second (in the 2026-09 outage the bank gate hid eleven unbridged
cards). After any fix, rehearse *all* gates offline (section 6), not just the one that
failed.

Gate → route:

| Failure text | Section |
|---|---|
| `unexpected new bank(s) in offers` | 2A — heal |
| `new (bank, card) pair(s) appeared ... with no requirements record` | 2B — heal |
| `expected banks have zero offers` | 2C — judgement |
| `total offers dropped N%` / `source ... below floor` / `city ... below floor` | 2D — stop |
| `restaurants present in HEAD are missing now` | 2D — stop |
| `[seo:determinism] FAILED` | 2E — stop |
| CI red after your own push (mobile ranking parity) | 2F — heal |

---

## 2. Repairs by gate

### 2A. Unexpected new bank

The feed started carrying a bank that is not in `data/expected_banks.json`. This gate is a
review checkpoint, not a bug.

1. Confirm the bank is **real and correctly named** from its own website. The feed does
   mislabel things (see 2B).
2. Add it to **`optional_banks`**, not `banks`:
   - `banks` = must have ≥1 offer, losing one fails the run.
   - `optional_banks` = reviewed and allowed, presence not required.
   A newcomer arriving with a small offer count (the 2026-09 trio had 22–30 each) can
   legitimately vanish again; putting it in `banks` sets up the opposite failure a week
   later. Promote to `banks` only once it has held a substantial count for a long while.
3. Every new bank also needs the wire-up in **section 5** — otherwise it renders without a
   logo and with no Apply link.
4. Its cards will now trip 2B. Handle both in one commit.

### 2B. New unmatched card

One or more `(bank, card)` pairs have no requirements record. Take the exact strings from
the diff report (verbatim casing).

First, check whether the pair even needs a record: rebuild the deal map (section 6) — the
matcher may already resolve it via `canon()`, which lowercases, expands `&`, splits
`debitcard`→`debit card`, and strips bank tokens (`bank|alfalah|allied|askari|bahl|habib|
metro|meezan|mcb|ubl|hbl|bop|js|faysal`). A record named `BOP PayPak Debit Card` therefore
canon-matches a feed card called `PayPak Debit Card`.

Then, per pair, in order of preference:

- **(a) Alias** — the feed name is a variant/rename of an existing record for the same
  bank and tier. Add to `MANUAL_ALIASES` in
  `scripts/card_requirements/build_deal_requirement_card_map.py`. The target must exist in
  `cards.json` with that exact `card_name`.
  Also the right answer when **the feed invented a product**: Standard Chartered has no
  "Standard" debit tier (its lineup is PayPak, Classic, Platinum/Titanium, Priority
  Platinum, Mastercard World, FCY), so the feed's `Paypak Standard Debit Card` is aliased
  to the real `PayPak Debit Card`. Always cross-check the bank's actual lineup before
  writing a record for a name the bank does not use.
- **(b) New sourced record** — a genuinely distinct product. Research per section 3 and add
  one row to each of `cards.json`, `card_requirements.json` and `sources.json` (section 4).
  Do **not** collapse distinct products: Mobilink's branch `PAY PAK Classic` (PKR 1,300)
  and its branchless `JazzCash PayPak Debit Card` (999 + 299/yr) are separate products on
  separate rails at separate prices.
- **(c) Known-unmatched** — only if the card cannot be sourced at all. Append to
  `data/known_unmatched_cards.json` with a dated note, and say so explicitly in the issue
  comment so a human can finish it.

Idempotency: before adding, check the pair is not already in `known_unmatched_cards.json`
and that no open auto-heal PR already covers it.

### 2C. Expected bank has zero offers

- Bank is in `optional_banks` → cannot happen (that list only warns). If you see this, the
  bank is in `banks`.
- Bank is in `banks` and the feed shows a clean zero while other banks look normal → the
  bank most likely stopped running offers. That is a **product judgement, not a repair**:
  comment on the issue with the evidence and stop. Do not quietly delete it from the list.

### 2D. Volume, floor and restaurant-loss gates — do not heal

These mean the scrape or the upstream feed is broken, not that data is missing. Papering
over them by loosening `data/refresh_thresholds.json` would ship a gutted dataset to
users. Comment on the issue with the numbers from the diff report and stop.

### 2E. SEO determinism — do not heal

`generate_seo_pages.py` produced different bytes on two consecutive runs. That is a code
bug (unsorted iteration, a timestamp, a hash of a dict order). Comment with the two
fingerprints and stop; a human fixes the generator.

### 2F. CI red after your own push — regenerate the summary

`data/summary.json` is a **precomputed cache of the default render, built from the
requirements pack**. Any change under `data/card-requirements/normalized/` that moves a
fee or eligibility value makes it stale, and the mobile ranking-parity gate
(`apps/mobile/__tests__/ranking-parity.test.ts`) compares its own computation against that
committed file — so CI goes red on **both** branches with a message like:

```
[karachi] card ranking: first divergence at index 161
  mobile[161] = Bank of Punjab||Mastercard Platinum Credit Card|42.2123
  web   [161] = Bank of Punjab||Mastercard Platinum Credit Card|42.6739
```

That is staleness, not a real divergence. Fix, and always do this in the *same* commit as
any requirements change so CI never goes red in the first place:

```bash
node scripts/precompute_rankings.mjs     # dependency-free, no npm install needed
git add data/summary.json data/offers-index.json
```

Confirm the regenerated score equals the figure mobile computed before pushing. Never
"fix" this by weakening the parity test.

---

## 3. Research rules

Official sources only. Two obstacles recur, both solved:

**Bot walls.** `bop.com.pk` is behind Imperva/Incapsula and `faysalbank.com` HTML is behind
Cloudflare; both serve a challenge to `curl`/WebFetch. A real browser profile solves the
challenge and the cookie then authorises the download.

*Preferred route — dispatch the helper workflow.* Do not assume your own sandbox has
Chromium or the egress to solve a challenge. `fetch-walled-sources.yml` runs
`apps/web/scripts/research/fetch_walled_sources.py` on a GitHub runner, which always can,
and publishes the PDFs plus extracted text plus page renders as the `bank-sources`
artifact:

```bash
gh workflow run fetch-walled-sources.yml \
  -f urls="https://www.bop.com.pk/view.aspx?id=2224" \
  -f link_filter="01-07-2026" \
  -f render_pages="14,15"
gh run watch <id> --exit-status
gh run download <id> -n bank-sources -D /tmp/sources && ls /tmp/sources
```

Then read `/tmp/sources/*-p14.png` for the table and `*.txt` for everything else. Pass an
index page (its PDF links are harvested from the DOM) or a direct `.pdf` URL. Useful
`link_filter` values: `01-07-2026` for the current BOP half-year documents, `English` to
skip Urdu mirrors.

*Local route — inline Playwright*, when you do have a browser (running this by hand):

```python
from playwright.sync_api import sync_playwright
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36")
with sync_playwright() as p:
    ctx = p.chromium.launch_persistent_context(
        user_data_dir="/tmp/chrome-profile", channel="chromium", headless=True,
        user_agent=UA, viewport={"width": 1440, "height": 900}, locale="en-US",
        timezone_id="Asia/Karachi",
        args=["--disable-blink-features=AutomationControlled"], accept_downloads=True)
    page = ctx.pages[0]
    page.goto("https://www.bop.com.pk/view.aspx?id=2224", wait_until="load")
    page.wait_for_timeout(5000)
    # ctx.request.get(<href from the page's own DOM>) inherits the solved cookie
```

Notes that save time:
- Take the PDF href **from the page's own DOM**, not a guessed path. BOP's current
  filenames contain an en dash and even a literal `...`, and a hand-built URL returns a
  212-byte challenge stub while the DOM href downloads fine.
- Canonical index pages: BOP conventional SOBC `view.aspx?id=2224`, BOP Islamic (Taqwa)
  `/Schedule of Bank Charges Islamic`. Faysal's SOC lives at the stable path
  `/assets/documents/FBL-English-SOC.pdf` and *is* directly fetchable; only its HTML is
  walled. `soneribank.com` (apex) works where `www.soneribank.com` 403s.

**Unreliable PDF text.** Two failure modes, same fix — render the page and read it:

```bash
pdftoppm -f 14 -l 14 -r 150 -png schedule.pdf /tmp/page   # then read /tmp/page-14.png
```

- *Scanned* schedules (Mobilink's branch SOBC) have no text layer at all.
- Worse, some schedules (BOP's) have a text layer that emits the card-name column and the
  charges column as **separate streams**, so extracted text pairs cards with the wrong
  fees. This is what made BOP's PayPak fee unverifiable for a whole cycle. If a table's
  labels and values are not adjacent in the extracted text, you *must* read a render.

**Sanity checks before writing a figure.** A fee that appears in a neighbouring row is the
classic error: three HBL records had a **replacement** fee sitting in
`supplementary_annual_fee_pkr`, and one carried another card's supplementary figure. Ask
where each number sits in the table, and confirm the row label above it names your card.

---

## 4. Data model

`data/card-requirements/normalized/`:

- **`cards.json`** — `card_id` (`<bank_slug>--<card_slug>`), `bank_slug`, `bank_name`,
  `card_name`, `card_slug`, `card_type`, `tier`, `confidence`, `pilot_position`.
- **`card_requirements.json`** — same identity fields plus `requirements`,
  `requirement_sources` (per field → source ids), `source_ids`, `confidence`, `notes`,
  `bank_gaps`, `retrieved_note`.
- **`sources.json`** — `source_id` (`<bank_slug>-src-<10 hex>`; use
  `sha1(url).hexdigest()[:10]` for determinism), `url`, `source_type`, `used_by_card_ids`.

Rules:
- `card_id` sets must match exactly between `cards.json` and `card_requirements.json`.
- Every non-null requirement field needs at least one entry in `requirement_sources`.
- `bank_name` must equal the `BANK_NAME_MAP` value for the feed's bank string, and new
  banks need a `BANK_NAME_MAP` entry.
- `annual_fee_pkr` is what the app shows. If the SOC prices a single
  "issuance/renewal/replacement" fee with no stated annual period, record it and explain
  in `annual_fee_pkr_note` — an honest note beats a null that becomes a tier-median guess.
- A fee-waiver threshold is **not** a balance requirement. Soneri's "waived above PKR
  25,000 average balance" belongs in `annual_fee_waiver_rule`, never in
  `minimum_average_balance_pkr`.
- Files are grouped by bank in `bank_name` order; append within a bank's block and re-sort
  with a **stable** sort so existing rows do not move.
- Serialise with `json.dumps(rows, indent=2)` + trailing newline — **`ensure_ascii=True`**
  (the default). Writing with `ensure_ascii=False` rewrites every `—` and produces a
  200-line phantom diff.
- Some sources are **CRLF** (`assets/state.js`,
  `scripts/card_requirements/build_deal_requirement_card_map.py`). Patch them in binary
  mode preserving `\r\n`, or the diff becomes the whole file.
- `data/card-requirements/audit/` is regenerated by
  `scripts/card_requirements/audit_requirement_evidence.py`. Run it to confirm exit 0,
  then **revert** its output — it has its own stale vintage and does not belong in a fix.

---

## 5. Wire-up checklist for a genuinely new bank

Data alone is not enough; three mirrored maps and some copy are hand-maintained.

1. `data/expected_banks.json` → `optional_banks` (section 2A).
2. `scripts/card_requirements/build_deal_requirement_card_map.py` → `BANK_NAME_MAP` (CRLF).
3. Logo: save a PNG in `assets/bank-logos/` (take the bank's own apple-touch-icon or
   wordmark; 180–256 px square, or a wordmark like `hbl.png`), then add the key to **all
   three** mirrors, which are keyed by `bank.toLowerCase().replace(/[^a-z0-9]/g,"")`:
   - `assets/state.js` → `BANK_LOGO_FILES` (CRLF)
   - `scripts/seo/generate_seo_pages.py` → `BANK_LOGO_FILES`
   - `../mobile/src/lib/bankLogo.ts` → `BANK_LOGO_FILES`
   Missing key = text initials on web/mobile and **no logo at all** on SEO pages.
4. `assets/state.js` → `BANK_APPLY_URLS` (CRLF). Verify the URL returns 200 first.
5. Hardcoded counts in copy — the bank count is user-visible in six places:
   `index.html` (banks-covered heading, noscript link list, footer label + chips, landing
   stat, features line), `llms.txt` (intro + link list), `about/index.html` (hero,
   "all N banks", the bank/card-types table), `methodology/index.html`,
   `../mobile/app/_layout.tsx`, `../mobile/app/onboarding.tsx`.
   Derive the number from the data, don't guess:
   ```bash
   python3 -c "import json;d=json.load(open('data/offers.json'));print(d['stats'])"
   ```

Bank pages, sitemap and per-bank SEO are fully data-derived — no action needed.

---

## 6. Rehearse offline before pushing

Inject the new pairs into a temp `offers.json`, rebuild the deal map into a temp dir, then
run the real validator against it. This reproduces every strict gate without touching
tracked files:

```python
import importlib.util, json, sys
from pathlib import Path
WEB = Path("apps/web"); TMP = Path("/tmp/harness"); TMP.mkdir(exist_ok=True)
def load(rel, name):
    spec = importlib.util.spec_from_file_location(name, WEB / rel)
    m = importlib.util.module_from_spec(spec); sys.modules[name] = m
    spec.loader.exec_module(m); return m               # sys.modules first: @dataclass needs it

payload = json.loads((WEB / "data/offers.json").read_text())
for bank, card in NEW_PAIRS:                            # from the diff report
    payload["offers"].append({"city": "Karachi", "restaurant": "HARNESS", "bank": bank,
        "card": card, "cardCategory": "debit", "discountLabel": "10%", "discountPct": 10,
        "days": [0], "daysLabel": "Monday"})
payload["stats"] = {"offers": len(payload["offers"]),
    "cards": len({f"{o['bank']}||{o['card']}" for o in payload["offers"]}),
    "banks": len({o["bank"] for o in payload["offers"]}),
    "restaurants": len({f"{o['city']}||{o['restaurant']}" for o in payload["offers"]})}
for city in ("Karachi", "Lahore", "Islamabad"):
    payload["restaurantsByCity"][city] = sorted(
        {o["restaurant"] for o in payload["offers"] if o["city"] == city})
(TMP / "offers.json").write_text(json.dumps(payload))

b = load("scripts/card_requirements/build_deal_requirement_card_map.py", "builder")
b.OFFERS_PATH, b.OUT_DIR = TMP / "offers.json", TMP; b.main()

v = load("scripts/offers/validate_offers_dataset.py", "validator")
v.OFFERS_PATH = TMP / "offers.json"
v.DEAL_MAP_PATH = TMP / "deal_requirement_card_map.json"
sys.argv = ["x", "--strict"]; v.main()                  # must print "strict checks passed"
```

Then also:

```bash
python3 scripts/offers/validate_offers_dataset.py --strict     # against committed data
python3 scripts/card_requirements/audit_requirement_evidence.py && git checkout data/card-requirements/audit/
python3 scripts/offers/test_merges_preserve_enrichment.py
python3 scripts/offers/test_restaurant_match.py
python3 scripts/seo/check_seo_determinism.py                   # then revert index.html/sitemap.xml/sw.js
```

`check_seo_determinism.py` restamps a build hash into `index.html`, `sitemap.xml` and
`sw.js`. Those are the refresh workflow's outputs — revert them so the fix commit stays
source-only.

Integrity check worth running every time:

```python
cids = {c["card_id"] for c in cards}; rids = {r["card_id"] for r in reqs}
assert cids == rids
assert not {s for r in reqs for s in r["source_ids"]} - {s["source_id"] for s in srcs}
assert not [(r["card_name"], k) for r in reqs for k, v in r["requirements"].items()
            if v is not None and not k.endswith("_note") and k != "annual_fee_waiver_rule"
            and not r["requirement_sources"].get(k)]
```

Finally, diff-shape check: confirm only the records you meant to touch changed, by diffing
`git show HEAD:<file>` against the new one by `card_id`.

---

## 7. Push protocol

```bash
gh run list --workflow=daily-refresh.yml --limit 1     # in-flight? cancel or wait (invariant 5)
git add <only the files you changed>
git commit -F <message-file>                            # plain prose, no emojis, no trailers
git push origin main
git fetch origin && git checkout -B dev origin/dev
git cherry-pick <sha> && git push origin dev
git checkout main
git diff --stat origin/main origin/dev                  # must be empty
```

Commit message: state which gate failed, what changed with the *numbers*, the document and
clause behind them, and anything left for a human.

---

## 8. Re-run and confirm green

```bash
gh workflow run daily-refresh.yml --ref main
gh run watch <id> --exit-status          # ~15-25 min; the scrape alone is ~15
```

A fresh scrape is required — new cards only exist in a new scrape, not in the committed
offers.json. If it fails again, re-triage: gates surface one at a time.

Then confirm CI is green on **both** branches (the mobile parity job runs on both).

---

## 9. Report

- Comment the root cause on the failure issue: which gate, what changed, the figures with
  their source documents, and anything unsourced left for a human.
- Close the issue once the re-run is green. If a backlog of daily failure issues has piled
  up, close the stale ones with a one-line pointer to the issue carrying the write-up.
- If you stopped at a non-healable gate (2C/2D/2E), say so plainly and leave it open.

---

## Guardrails recap

- Never invent salaries or fees. Unsourced ⇒ `null` + `bank_gaps` + flag it.
- Heal 2A, 2B and 2F. Comment and stop on 2C, 2D and 2E.
- Cross-check the bank's real lineup: the feed invents card names.
- Regenerate `summary.json` in the same commit as any requirements change.
- Keep `main` and `dev` identical; never race the refresh workflow's push.
- Keep diffs scoped; revert incidental regenerated artifacts.
