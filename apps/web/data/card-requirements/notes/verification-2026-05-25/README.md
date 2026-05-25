# Card Requirements Verification Pass — 2026-05-25

Full re-verification of the 192 cards across 19 Pakistani banks in this dataset.
Each bank was assigned to its own research agent. Each agent operated against
official primary sources (bank product pages, Schedule of Charges / Schedule of
Bank Charges PDFs, Key Fact Statements, account-product pages) and wrote a
per-bank research log under `banks/<bank-slug>.md`.

**Scope: every field on every card is re-checked.** This is not a gap-fill
pass. Even fields that already have a number must be looked up again against
the current official source, and the per-bank log must record either
"verified — matches source X" or "corrected from A to B because source X says
B". Values that survive without changes still count as verified and are
called out as such in the log.

## Goals

For every card, confirm or correct:

1. `minimum_monthly_salary_pkr` — minimum monthly salary required (0 = no
   requirement, null = couldn't find).
2. `minimum_account_balance_pkr` — minimum balance the customer must hold
   (account opening balance, minimum monthly average balance, or relationship
   balance, depending on how the bank publishes it).
3. `minimum_average_balance_pkr` / `minimum_relationship_balance_pkr` /
   `minimum_deposit_pkr` — when the bank uses one of these specifically rather
   than the simpler "minimum balance" framing.
4. `annual_fee_pkr` — annual / renewal fee.
5. `joining_fee_pkr` / `supplementary_annual_fee_pkr` — when published.
6. `annual_fee_waiver_rule` — verbatim or paraphrased waiver / fee-reversal
   condition from the bank's own materials. Examples: "spend PKR 150,000 in 12
   months", "free for HBL Premium customers", "first year free".
7. `minimum_age_years` / `maximum_age_years`.
8. `income_document_required`, `salary_transfer_required`,
   `pakistani_cnic_required`, `existing_account_required` — booleans.

## Methodology

1. **Inventory.** Each agent starts from
   `data/card-requirements/work/<bank>-pilot.json` (the existing bank pilot
   file) and from the matching slice of
   `data/card-requirements/normalized/card_requirements.json`.

2. **Primary sources only.** Agents are restricted to:
   - **First-party data submissions from the bank** when they exist (xlsx,
     csv, or JSON files the bank itself provided — these live under
     `data/card-requirements/raw/<bank>/`). These are the authoritative
     source for that bank and outrank everything else.
   - The bank's own `*.com.pk` / `*.com` domain (product pages,
     overview/compare pages, SOC/SOBC PDFs, KFS PDFs, account pages, premium
     segment pages).
   - SBP Schedule of Charges PDFs hosted on bank domains.
   Independent blogs, news sites, and comparison aggregators are not used as
   evidence — they may be used only to find URLs to verify against the bank.

   **First-party submission rule:** if a bank provided a workbook or JSON
   directly, that submission wins. Public sources may sanity-check the
   submission (with contradictions logged in `notes[]`) but may NOT
   overwrite it. Currently this rule applies to NBP, whose 5-card pilot
   draws from `raw/nbp/nbp_card_details_template.xlsx`.

3. **Salary vs balance — explicit labelling.**
   Banks routinely publish only one of these. The convention agents follow:
   - If the bank publishes a salary threshold, use it. If not, salary stays
     `null` (we cannot say what is or isn't required). Do not set salary to 0
     just because the page is silent.
   - Same rule for balance.
   - When a balance value comes from a *linked account* rather than the card
     itself, record it under `minimum_average_balance_pkr` or
     `minimum_relationship_balance_pkr` and call out the linkage in
     `notes[]`.
   - When a card has neither salary nor balance information publicly, both
     stay `null` and a `bank_gap` entry is added.

4. **Account-linked inheritance.**
   For account-linked debit cards (women / student / digital / branchless /
   remit), the linked account's eligibility becomes the card's eligibility.
   Agents must:
   - Identify the linked account product (from the card page or from the
     bank's account catalogue).
   - Cite the account page in `sources[]`.
   - Note the inheritance in `notes[]` (e.g., "Inherits eligibility from
     HBL Conventional Current Account — PKR 40,000 monthly average balance
     per the official account page.").

5. **Fees — separate from salary.**
   Annual fee is a card-economics field. It is sourced from SOC/SOBC PDFs or
   the card's own fee disclosure. It is recorded independently of the
   salary/balance fields. If the SOC lists multiple tiers, the agent picks the
   one matching this card's tier and product family.

6. **Waivers — verbatim from source.**
   `annual_fee_waiver_rule` is written as a one-sentence rule that paraphrases
   only what the official source says. Spend thresholds, member-segment
   waivers, salary-transfer waivers, and first-year promos are all valid.
   "Subject to terms and conditions" is not a usable rule.

7. **Confidence.**
   - `high`: clean primary source, unambiguous.
   - `medium`: requires normalization across pages, or a reasonable
     account-linked inference with an explicit linked-account cite.
   - `low`: weak wording, multiple plausible reads, or unresolved conflict.

8. **Conflicts.** Preserved. If the product page says one fee and the SOC PDF
   says another, both go into `notes[]` and `confidence` drops.

## Outputs per bank

Each agent updates:
- `data/card-requirements/work/<bank>-pilot.json` (the canonical pilot file).
- `data/card-requirements/notes/verification-2026-05-25/banks/<bank>.md`
  (the research log: what URLs were visited, what was found, what changed,
  what remains uncertain).

After all banks are reprocessed,
`scripts/card_requirements/build_card_requirements_normalized.py` is rerun to
regenerate `normalized/*.json` from the updated pilot files.

## Provenance

- Pass start: 2026-05-25
- Dispatcher: Claude (Opus 4.7, 1M context) under user direction.
- Reproducibility: each per-bank log lists the exact URLs hit and the
  field-by-field decision. Re-running the same agents against the same source
  set should produce the same pilot file (modulo bank-side updates to their
  own pages between runs).
