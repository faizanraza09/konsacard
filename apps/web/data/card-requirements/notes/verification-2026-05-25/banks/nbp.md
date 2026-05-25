# National Bank of Pakistan — Verification Log (2026-05-25)

**Bank slug:** `nbp`
**Pilot file:** `data/card-requirements/work/nbp-pilot.json`
**Cards in scope:** 5

## Status — not re-verified this pass

NBP is excluded from the 2026-05-25 web-verification pass.

The current pilot values for the 5 NBP cards (PayPak Classic, PayPak Pink,
PayPak Edge co-badge Mastercard, UPI Classic, UPI Gold) come from an
official NBP-provided workbook at
`data/card-requirements/raw/nbp/nbp_card_details_template.xlsx`. That
workbook is treated as the authoritative source for this bank — not the
NBP public SOC PDF or product pages.

A verification agent did re-run NBP this pass and tried to cross-check
the xlsx values against the public NBP SOC. It overwrote the pilot file
with public-SOC-derived values (notably resetting the PKR 500,000 / 100,000
balance values on Edge and UPI Gold to null because they were not surfaced
in the SOC). That overwrite was reverted: the NBP pilot file was restored
from git to the pre-pass state, and the normalization output was
regenerated.

## Why the xlsx wins for NBP

- NBP shared the workbook directly. It is the bank's own data, not a
  derivation from a scraped public document.
- The 500,000 / 100,000 minimum balances on PayPak Edge and UPI Gold are
  not present in NBP's public SOC PDF because NBP's SOC publishes fees,
  not card-level eligibility thresholds — the thresholds live in the
  workbook NBP provided to us.
- Treating the public SOC as "the only primary source" for NBP would
  discard the bank's own first-party submission, which is exactly the
  data format the dataset is designed to accept (see
  `data/BANK_DATA_SPEC.md` — JSON / CSV / xlsx submissions from banks
  are first-class inputs).

## Operating rule going forward

When a bank has provided a first-party data submission (xlsx, csv, or
JSON), that submission is the primary source for that bank. Public SOC
PDFs and product pages are used only to:

- Sanity-check the submission (and surface contradictions in
  `notes[]`, not overwrite the submission).
- Fill fields the submission left blank (where it's not ambiguous).
- Catch fee/threshold changes the bank has made since the submission.

If the public source disagrees with the submission and there is no
obvious reason to prefer the public source, the submission wins and the
conflict is logged.

## What is NOT changed

- `requirements` block on each of the 5 NBP cards.
- `sources[]` (still points at the xlsx).
- `confidence` values.

If NBP later refreshes the workbook, the new workbook replaces this one
and we re-normalize.
