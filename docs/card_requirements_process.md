# Card Requirements Process

This document records the actual workflow used to build the card
requirements dataset in this repo.

It covers:

- how bank-card requirement data was sourced
- how weak and conflicting evidence was handled
- how pilot bank files were normalized
- how deal-side card names were matched back to requirement-side cards
- what remains unresolved

The current data artifacts live in:

- `data/card-requirements/raw/`
- `data/card-requirements/work/`
- `data/card-requirements/normalized/`

The main build scripts are:

- `scripts/build_card_requirements_normalized.py`
- `scripts/build_deal_requirement_card_map.py`

## Why this was not a simple scraper

Bank requirement data was not consistently exposed on one clean HTML page.

Depending on the bank and the card family, the usable data appeared across:

- card landing pages
- comparison pages
- application pages
- schedule-of-charges PDFs
- fee-reversal or annual-fee waiver pages
- account-product pages for account-linked debit cards
- segment pages for premium / priority / premier clients

Because of that, the right unit of work was:

- bank-by-bank
- source-backed
- reviewable

and not one generic parser trying to read every bank site the same way.

## Data model

The dataset is layered on purpose.

### `raw/`

`data/card-requirements/raw/<bank-slug>/`

Used for bank-level evidence capture where we had structured source and
evidence extraction available.

Typical files:

- `sources.json`
- `evidence.json`

### `work/`

`data/card-requirements/work/<bank-slug>-pilot.json`

This is the pilot layer.

Each file represents the best current bank-level interpretation after source
collection and manual or agent-assisted consolidation. These files were the
working truth before cross-bank normalization.

### `normalized/`

Structured repo-wide outputs:

- `cards.json`
- `card_requirements.json`
- `sources.json`
- `deal_requirement_card_map.json`
- `deal_requirement_coverage_summary.json`

These are generated views, not the original evidence layer.

## Bank sourcing workflow

For each bank, the workflow was:

1. Discover official public pages.
2. Prioritize stronger sources.
3. Build a bank pilot file.
4. Normalize into the repo-wide schema.
5. Reconcile against the restaurant-deals card names.

### 1. Discovery

Per bank, discovery targeted:

- debit-card overview pages
- credit-card overview pages
- compare pages
- schedule-of-charges / SOC PDFs
- KFS / summary-box pages
- eligibility or application pages
- annual-fee waiver pages
- account-product pages for linked debit variants

### 2. Source priority

Sources were treated with roughly this priority:

1. official SOC / KFS / fee PDF
2. official product page with explicit eligibility or fees
3. official application / compare page
4. official account page for account-linked debit products
5. weaker marketing copy

When two official sources disagreed, the contradiction was preserved instead of
flattened away.

### 3. Pilot bank files

Each bank got a pilot file under `data/card-requirements/work/`.

Those files preserve:

- the bank’s card list
- available requirement fields
- notes about weak evidence
- unresolved contradictions
- alias or family observations where needed

Current pilot bank files include:

- `al-baraka-pilot.json`
- `allied-bank-pilot.json`
- `askari-bank-pilot.json`
- `bank-al-habib-pilot.json`
- `bank-alfalah-pilot.json`
- `bankislami-pilot.json`
- `bop-pilot.json`
- `faysal-bank-pilot.json`
- `habib-metro-pilot.json`
- `hbl-pilot.json`
- `hbl-islamic-pilot.json`
- `js-bank-pilot.json`
- `mcb-bank-pilot.json`
- `mcb-islamic-pilot.json`
- `meezan-pilot.json`
- `standard-chartered-pilot.json`
- `ubl-pilot.json`

### 4. Normalization

Normalization was done by `scripts/build_card_requirements_normalized.py`.

The output schema separates:

- card identity
- normalized requirement fields
- source registry

Important normalization rules:

- preserve source traceability
- preserve weak/conflicted notes
- do not invent values to force completeness
- use stable `card_id` values

The normalized requirement layer includes keys like:

- `minimum_monthly_salary_pkr`
- `minimum_account_balance_pkr`
- `minimum_average_balance_pkr`
- `minimum_relationship_balance_pkr`
- `minimum_deposit_pkr`
- `annual_fee_pkr`
- `joining_fee_pkr`
- `supplementary_annual_fee_pkr`
- `annual_fee_waiver_rule`
- `minimum_age_years`
- `maximum_age_years`
- `income_document_required`
- `salary_transfer_required`
- `pakistani_cnic_required`
- `existing_account_required`

Not every card has every field.

## Handling account-linked debit cards

One major recovery strategy was treating some unresolved debit-card variants as
account-linked products rather than standalone underwritten cards.

This was used when the bank’s own public materials clearly indicated that:

- the card belongs to a specific account program
- the account carries the real eligibility condition
- the card itself mainly contributes fees / branding / channel access

Typical examples:

- women-account debit cards
- student / youth / program debit cards
- digital-account debit cards
- remit / branchless wrappers
- some Islamic account-linked debit variants

In those cases, the practical rule was:

- eligibility from the linked account
- card economics from the card page or SOC where available
- record the linkage explicitly rather than pretending it was a direct
  standalone card requirement source

This strategy materially improved coverage for banks like:

- Bank of Punjab
- HBL Islamic
- Meezan

## Contradiction handling

Contradictions were expected.

Common examples:

- product page and SOC disagree on fee amount
- premium marketing page implies broad access, but issuance rules are narrower
- one page lists a card family while another lists a more specific tier

The handling rule was:

- do not silently pick whichever value looks nicer
- keep the stronger source attached to the published field
- preserve conflicts in notes and bank gaps
- leave the card weak if the conflict was not defensibly resolvable

This is why some banks remained intentionally undercovered rather than being
forced into fake completeness.

## Deal-side matching process

The restaurant-deals dataset and the requirement dataset do not use perfectly
aligned card names.

That mismatch was handled in a separate step by
`scripts/build_deal_requirement_card_map.py`.

### Why a separate matching layer was needed

The deal-side dataset often includes:

- legacy names
- family-level labels
- inconsistent branding
- wrappers or program names instead of strict product SKUs
- Islamic / conventional variants with partial naming overlap

So the requirement-side dataset could not simply be joined on raw card name.

### Matching rules

The matching process was deliberately conservative.

Cards were matched when there was one of:

- exact or near-exact bank-local naming equivalence
- a bank-published alias or clearly equivalent family mapping
- a defensible account-linked mapping

Cards were not matched when the linkage would have required guessing.

### Crosswalk outputs

- `deal_requirement_card_map.json`
- `deal_requirement_coverage_summary.json`

These files show:

- matched cards
- unmatched cards
- per-bank coverage against the deal-side card list

## Agent-assisted bank rollout

The bank-by-bank rollout used agent-style parallel research, but the output was
still consolidated into repo files rather than trusted blindly.

Practical pattern:

- bounded bank-specific tasks
- recover official pages and PDFs
- extract explicit fee / salary / balance signals
- merge only defensible results

This was especially useful because different banks required different recovery
strategies.

Examples:

- some banks were SOC-heavy
- some relied on product pages plus fee-reversal pages
- some required account-linked reasoning for debit variants
- some had weak public documentation and remained incomplete

## Current quality state

The normalized dataset is usable, but not “everything in the market with
perfect certainty.”

Strengths:

- strong public traceability
- explicit handling of weak evidence
- bank-by-bank reviewability
- conservative crosswalk instead of overclaiming matches

Current limitations:

- some banks are still weak, especially `MCB`
- some cards in the deals dataset are likely legacy, wrapper, or naming
  variants with no clean public requirement source
- a portion of the dataset still depends on account-linked inference rather
  than direct card-level underwriting text

## Current coverage snapshot

The current matched coverage against the deal-side card list is stored in:

- `data/card-requirements/normalized/deal_requirement_coverage_summary.json`

At the time this process document was written, the matched coverage had been
lifted materially through:

- alias expansion
- account-linked recovery
- targeted bank follow-up on weak banks

The unresolved set should always be read from the summary file rather than
hardcoding counts into docs.

## How to extend the dataset safely

If continuing this work, the recommended order is:

1. Read the unresolved cards from
   `deal_requirement_coverage_summary.json`.
2. Separate them into:
   - likely alias
   - needs targeted research
   - probably not publicly verifiable
3. Prefer official PDFs and KFS pages before weaker marketing pages.
4. Use account-linked inference only when the bank’s own product structure
   clearly supports it.
5. Re-run:
   - `python scripts/build_card_requirements_normalized.py`
   - `python scripts/build_deal_requirement_card_map.py`
6. Review coverage changes and unresolved cards again.

## Important rule

This dataset is not intended to maximize apparent completeness at any cost.

The operating rule is:

- if a value is weak, say it is weak
- if a card is unresolved, leave it unresolved
- if two official sources conflict, preserve the conflict

That is why the dataset is defensible enough to build on.
