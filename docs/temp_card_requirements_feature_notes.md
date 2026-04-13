# Temp Notes: Card Requirements Feature

Date: 2026-04-09

## Goal

Add the first app-level card requirements feature directly into the existing
recommendation flow instead of building a separate tool.

## Initial scope

- load normalized requirement data and deal-to-requirement card mappings in the frontend
- add salary and account-balance inputs in the existing filters
- add a toggle to use eligibility in results
- badge cards as:
  - likely eligible
  - likely ineligible
  - add salary/balance to confirm
  - requirements unclear
- when eligibility mode is on, hide clearly ineligible cards
- keep cards with unclear requirements visible instead of pretending they are eligible

## Data reality check

- normalized requirements include usable salary data for only part of the card universe
- normalized requirements include usable balance data for an even smaller subset
- annual fee data is much more complete and should be surfaced as context, not used
  as a hard eligibility filter
- deal-to-requirement mapping currently matches most, but not all, deal-side cards

## Product decisions

- keep this integrated into the current app
- do not create a separate "what cards can I get" page/tool yet
- use eligibility as an optional refinement layer
- never overstate certainty when requirements are missing or unmapped

## Review checklist

- clean load with no JS errors
- cards still rank correctly with eligibility mode off
- cards show eligibility badges with reasonable text
- eligibility mode hides only clearly ineligible cards
- top pick and result cards remain readable on desktop and mobile

## Implementation notes

- added a dedicated Eligibility filter group to the existing filter stack
- loads normalized requirements plus deal-to-requirement mapping in the frontend
- evaluates cards into four states:
  - likely eligible
  - likely ineligible
  - add salary/balance to confirm
  - requirements unclear
- when eligibility mode is on, only likely ineligible cards are hidden
- improved deal-card key matching by normalizing case and spacing before lookup
- added a dedicated empty state when eligibility filtering removes all candidates

## Review outcome

- the feature stays optional and does not disturb the default ranking flow
- cards with missing or unmapped requirements remain visible and labeled, which is
  safer than pretending eligibility
- annual fee and waiver information is surfaced as context only, not used as a
  hard filter
- the remaining limitation is still data coverage: not every deal-side card has a
  verified mapped requirements record yet
