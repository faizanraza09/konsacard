# Temp Notes: Editorial Redesign Pass

Date: 2026-04-13

## Source

Implemented from the mockup/reference file:

- `C:\Users\Faizan.Raza\Downloads\konsacard_redesign_concept.html`

## Design Direction

- move from warm glassmorphism/card-heavy UI to a darker editorial/tool aesthetic
- make the app feel closer to a specialist finance/consumer publication than a
  generic fintech template
- preserve the existing static app structure and recommendation logic

## Changes Implemented

- replaced the old Space Grotesk / Source Sans font import with DM Serif Display
  and DM Sans across the HTML pages
- added a dark editorial theme layer in CSS
- removed the practical effect of glassmorphism on the main app cards
- reduced large rounded-card treatment in favor of flatter terminal-style cells
- converted the top-pick score badge into a conic-gradient score ring
- made the summary strip behave more like a full-width filter/status bar
- made result cards more like ranked rows with lighter dividers and chip metadata
- aligned content/trust pages, footer, and detail panels with the darker system

## Review Notes

- default app logic and eligibility logic were preserved
- `assets/app.js` passes `node --check`
- local clean-URL server returned HTTP 200 for:
  - `/`
  - `/about`
  - `/methodology`
  - `/data/offers.json`
  - `/data/card-requirements/normalized/card_requirements.json`
- remaining risk is visual only: final spacing/contrast should still be checked in
  a browser on desktop and phone before shipping
