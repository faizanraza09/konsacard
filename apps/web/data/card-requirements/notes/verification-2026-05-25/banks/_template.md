# <Bank Name> — Verification Log (2026-05-25)

**Bank slug:** `<bank-slug>`
**Pilot file:** `data/card-requirements/work/<bank-slug>-pilot.json`
**Cards in scope:** N

## Sources consulted

List every URL visited, with one-line description of what was on it:

- https://...  — (debit card overview)
- https://...  — (Jan–Jun 2026 Schedule of Charges PDF)
- https://...  — (linked-account product page for X)

## Card-by-card verification

### <Card Name 1>

- `card_type` / `tier`: ...
- `minimum_monthly_salary_pkr`: **<value>** — verified / corrected from `<old>` — source: <url>
- `minimum_account_balance_pkr`: **<value>** — verified / corrected — source: <url>
  - If from linked account, name the account here.
- `annual_fee_pkr`: **<value>** — verified / corrected — source: SOC PDF p.<n>
- `annual_fee_waiver_rule`: **"..."** — source: <url>
- `minimum_age_years` / `maximum_age_years`: ...
- `income_document_required` / `salary_transfer_required` / `pakistani_cnic_required` / `existing_account_required`: ...
- Confidence: high / medium / low — why.
- Notes / conflicts: ...

### <Card Name 2>

... (same structure)

## Cross-card observations

- Bank-level convention notes (e.g. "all Premier-segment debit cards inherit
  PKR 3,000,000 relationship balance from the Premier proposition page").

## Gaps / unresolved

- Card X — could not find a public salary threshold.
- Card Y — fee table on product page disagrees with SOC; flagged in notes.
