# Card Requirements Agentic Pipeline

This repo now has a pilot dataset for card eligibility and fee requirements in:

- `data/card_requirements_pilot.json`
- `data/card_requirements_schema.json`

The right long-term shape is not a single scraper. It is a reviewable multi-step pipeline.

## Why an agentic workflow is justified

Bank requirement data is scattered across:

- card landing pages
- compare pages
- fee schedules / schedule-of-charges PDFs
- key fact statements
- FAQs
- account-product pages

A simple tag scraper will miss a lot of it and will fail when one bank changes layout.

## Recommended pipeline

### 1. Discovery

Per bank, find:

- debit-card overview pages
- credit-card overview pages
- compare pages
- schedule-of-charges PDFs
- key fact statements
- eligibility pages

### 2. Extraction

For each source, extract only evidence-backed fields:

- card name
- card type
- tier
- minimum salary
- minimum deposit
- minimum monthly average balance
- annual fee
- issuance fee
- replacement fee
- annual fee waiver / reversal rule
- age bounds

### 3. Normalization

Map bank-specific wording into one schema:

- `minimum gross income`
- `minimum monthly salary`
- `maintain deposit relationship`
- `average 12 months balance`
- `premium customers only`

### 4. Contradiction detection

Flag cases like:

- one page says premium-only, another says broader eligibility
- one page gives fee values, another says free for segment clients
- product page and schedule PDF disagree

### 5. Human review

Publish only reviewed records to any user-facing product.

## Pilot learnings from the first pass

- HBL exposes strong credit-card eligibility data on its overview page, but fee amounts are not always cleanly visible in crawlable text.
- Bank Alfalah exposes debit-card fees cleanly and credit-card fee reversal criteria cleanly, but fee amounts and eligibility often live on separate pages.
- Meezan exposes a useful schedule-of-charges PDF and several product pages, but there are already contradictions between premium-marketing pages and SOC issuance rules for some premium cards.

## Practical next rollout

1. Finish the current three-bank pilot with direct source quotes.
2. Add 3 more banks with the same schema.
3. Build a review UI or at least a CSV export for manual checking.
4. Only after review, wire the verified fields into the app.

## Minimum quality bar before using this in the app

Every published field should have:

- an official source URL
- a source type
- a last-checked date
- a confidence flag

If two official sources conflict, the record should remain review-only until resolved.
