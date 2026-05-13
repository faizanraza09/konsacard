# Card Requirements Data

This folder is for card eligibility, fee, and requirement data that sits
separately from the dining-offers dataset.

The model is intentionally layered because bank websites, forms, brochures,
and fee schedules often contradict each other or express the same fact in
different ways.

For the full repo workflow used to build the dataset, see:

- `docs/card_requirements_process.md`
- `docs/card_requirements_agentic_pipeline.md`

For the format banks should submit data in, see:

- `data/BANK_DATA_SPEC.md`

## Layout

```text
data/card-requirements/
  raw/
    <bank-slug>/
      source workbooks / PDFs / other evidence artifacts
  work/
    <bank-slug>-pilot.json
  normalized/
    cards.json
    card_requirements.json
    sources.json
    deal_requirement_card_map.json
    deal_requirement_coverage_summary.json
  meta/
    schema.json               Schema for pilot files
  notes/
    Research scratch files
```

## Principles

- `raw/` stores captured evidence artifacts (Excel workbooks, PDFs, web page snapshots). Most banks skip this layer — evidence is embedded directly in pilot files as URLs.
- `work/` stores bank-by-bank pilot outputs gathered before full normalization.
- `normalized/` stores the best current structured view for app use.
- Conflicting evidence should be preserved, not overwritten silently.
- Each normalized fact should trace back to one or more source IDs.

## Requirement Keys

Common keys for `card_requirements.json`:

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

## Confidence

Use:

- `high` for a clear primary source with unambiguous wording
- `medium` for reasonable normalization or multiple agreeing sources
- `low` for weak wording, inferred values, or unresolved contradictions
