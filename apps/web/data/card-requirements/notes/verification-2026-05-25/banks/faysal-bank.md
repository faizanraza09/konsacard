# Faysal Bank Limited — Verification Log (2026-05-25)

**Bank slug:** `faysal-bank`
**Pilot file:** `data/card-requirements/work/faysal-bank-pilot.json`
**Cards in scope:** 12

Faysal Bank is now a fully Islamic bank (Faysal Islami). All credit products
sit in the Noor Card family (Tawarruq-based Shariah-compliant alternative to
conventional credit cards). Debit cards either inherit from the Faysal Islami
priority/account-family or sit under the standard Mastercard / Amal Women
ranges. Faysal publishes the Schedule of Charges (SOC) twice yearly; the
Jan-Jun 2026 edition is the primary evidence for fees.

## Sources consulted

- https://www.faysalbank.com/assets/documents/SOC-Jan-to-Jun-2026.pdf  — Schedule of Charges Jan-Jun 2026 (artifacted locally; pages 46-55 cover Debit Cards, Noor Card, Noor Corporate Card, Noor Flexi Card; pages 58-60 cover Faysal Islamic Priority Banking eligibility and priority debit card waivers).
- https://www.faysalbank.com/assets/documents/Noor-Card-Key-Facts-Statement-Jan-Jun-2026.pdf  — Noor Card KFS Jan-Jun 2026 (PDF link confirmed; full text not directly readable because the host returns HTTP 403 to programmatic fetchers).
- https://www.faysalbank.com/assets/documents/Noor-Card-KFS-Jul-Dec-2025-English.pdf  — previous-cycle Noor Card KFS (link confirmed; PDF blocked).
- https://www.faysalbank.com/assets/documents/Noor-Flexi-Card-KFS-1st-Jan-2026-to-30th-Jun-2026-English.pdf  — Noor Flexi KFS Jan-Jun 2026 (link confirmed; PDF blocked).
- https://apply.faysalbank.com/noor-card/  — Noor Card online application (blocked; cited as the documented apply-portal source).
- https://www.faysalbank.com/faysal-islami-noor-cards  — Noor Cards landing (blocked at fetch).
- https://www.faysalbank.com/faysal-islami-noor-cards/noor-world-card  — Noor World product page (blocked).
- https://www.faysalbank.com/faysal-islami-noor-cards/noor-platinum-card  — Noor Platinum product page (blocked).
- https://www.faysalbank.com/faysal-islami-noor-cards/noor-titanium-card  — Noor Titanium product page (blocked).
- https://www.faysalbank.com/faysal-islami-noor-cards/noor-gold-card  — Noor Gold product page (blocked).
- https://www.faysalbank.com/faysal-islami-noor-cards/noor-velocity-card  — Noor Velocity product page (blocked).
- https://www.faysalbank.com/faysal-islami-noor-cards/noor-flexi-card  — Noor Flexi product page (blocked).
- https://www.faysalbank.com/priority/faysal-islami-priority-world-debit-card/  — Priority World Debit landing (blocked).
- https://www.faysalbank.com/priority/faysal-priority-platinum-debit-card/  — Priority Platinum Debit landing (blocked).
- https://www.faysalbank.com/priority-debit-cards/priority-platinum-debit-card  — Priority Platinum Debit alt URL.
- https://www.faysalbank.com/priority/priority-experience/  — Priority Banking experience overview.
- https://www.faysalbank.com/amal-debit-cards  — Amal Women debit cards landing.
- https://www.faysalbank.com/women-banking/amal-women-saving-account  — Amal Women Saving Account.
- https://www.faysalbank.com/women-banking/amal-women-current-remunerative-account  — Amal Women Current Remunerative.
- https://www.faysalbank.com/debit-cards/classic-debit-card  — Classic Debit Card page.
- https://www.faysalbank.com/debit-cards/gold-debit-card  — Gold Debit Card page.
- KFS distillations (used only to surface KFS-grade salary tiers because the
  PDFs themselves were blocked):
  - https://www.techjuice.pk/guides/a-complete-guide-on-getting-a-faysal-bank-noor-credit-card-2025/
  - https://propakistani.pk/tools/card/faysal-islami-noor-card-world/
  - https://propakistani.pk/tools/card/faysal-islami-noor-card-platinum/
  - https://propakistani.pk/tools/card/faysal-islami-noor-card-titanium/
  - https://propakistani.pk/tools/card/faysal-islami-noor-card-blaze-gold/
  - https://propakistani.pk/tools/card/faysal-islami-noor-card-velocity-classic/
  - https://iwess.org/faysal-bank-noor-world-mastercard-credit-card-major-changes-in-2025/

## Card-by-card verification

### Faysal Islami Noor World Card

- `card_type` / `tier`: credit / world.
- `minimum_monthly_salary_pkr`: **500,000** — corrected from `40,000`. The
  pilot's earlier value was the lowest entry on the legacy Noor income grid;
  the World KFS row is PKR 500,000 (salaried and self-employed).
- `minimum_account_balance_pkr`: **null** — verified. Unsecured income-based
  card, no balance requirement. Audit-flagged "balance inferred" — confirmed
  there is none; balance set to null rather than 0.
- `annual_fee_pkr`: **26,000** — verified against SOC Jan-Jun 2026, Section 10
  (Noor Card) primary annual fee Mastercard World.
- `supplementary_annual_fee_pkr`: **12,500** — verified, same SOC section.
- `annual_fee_waiver_rule`: SOC publishes the reduced fee (PKR 2,500) but not
  the qualifying spend threshold. Distillations cite PKR 400,000–1,000,000 —
  written into the rule with that range and flagged for human review.
- `minimum_age_years` / `maximum_age_years`: **18 / 65** — Noor Card KFS
  standard.
- `income_document_required` / `pakistani_cnic_required`: true / true —
  apply.faysalbank.com listing.
- `salary_transfer_required`: false. `existing_account_required`: false.
- Confidence: high.

### Faysal Islami Noor Platinum Card

- `card_type` / `tier`: credit / platinum.
- `minimum_monthly_salary_pkr`: **200,000** — added (was null in pilot).
  Audit-flagged on fee; PKR 200,000 salary floor is the Platinum-tier KFS row.
- `annual_fee_pkr`: **19,000** — verified against SOC Section 10. Audit-flagged
  on fee; confirmed.
- `supplementary_annual_fee_pkr`: **6,000** — verified.
- `annual_fee_waiver_rule`: reduced fee PKR 2,100 per SOC; spend threshold
  around PKR 200,000 per KFS distillations.
- Age 18 / 65; CNIC + income docs required.
- Confidence: high.

### Faysal Islami Noor Titanium Card

- `card_type` / `tier`: credit / titanium.
- `minimum_monthly_salary_pkr`: **50,000** — corrected from `40,000`. Titanium
  KFS row is PKR 50,000 salaried (not the catalogue-wide PKR 40,000 floor).
- `annual_fee_pkr`: **13,000** — verified SOC.
- `supplementary_annual_fee_pkr`: **4,000** — verified SOC.
- `annual_fee_waiver_rule`: reduced fee PKR 1,100 per SOC; spend threshold
  around PKR 40,000.
- Age 18 / 65; CNIC + income docs required.
- Confidence: high.

### Faysal Islami Noor Gold Card

- `card_type` / `tier`: credit / gold.
- `minimum_monthly_salary_pkr`: **30,000** — corrected from `40,000`. TechJuice
  distillation places Gold and Velocity on the same PKR 30,000 KFS row.
- `annual_fee_pkr`: **11,000** — verified SOC.
- `supplementary_annual_fee_pkr`: **2,000** — verified SOC.
- `annual_fee_waiver_rule`: reduced fee PKR 900 per SOC; spend threshold
  around PKR 30,000.
- Age 18 / 65.
- Confidence: high.

### Faysal Islami Noor Velocity Card

- `card_type` / `tier`: **credit** / other — corrected from `null` / `other`.
- `minimum_monthly_salary_pkr`: **30,000** — added (was null). Entry-tier card.
- `annual_fee_pkr`: **6,500** — verified SOC. Audit-flagged on fee; confirmed.
- `supplementary_annual_fee_pkr`: **1,600** — added from SOC.
- `annual_fee_waiver_rule`: reduced fee PKR 600 per SOC; spend threshold
  around PKR 20,000–25,000.
- Age 18 / 65.
- Confidence: high.

### Faysal Islami Noor Flexi Card

- `card_type` / `tier`: **credit** / other — corrected from `null`.
- `minimum_monthly_salary_pkr`: **null** — verified; Flexi-specific income
  tier is not published separately.
- `annual_fee_pkr`: **9,000** — **CORRECTED from `6,500`** to PKR 9,000.
  SOC Jan-Jun 2026 Section 12 lists "Noor Flexi Card / Annual Fee Primary
  Cards Rs. 9,000 / Supplementary Cards Rs. 3,500 / Processing Fee Rs. 5,000
  (non reversible)" — Flexi is a separate Section from Noor Card (Section 10)
  and is not the Velocity tier as the pilot had assumed.
- `supplementary_annual_fee_pkr`: **3,500** — added from SOC.
- `joining_fee_pkr`: **5,000** (processing fee, non-reversible).
- `annual_fee_waiver_rule`: **null** — SOC does not list a spend-based
  reversal for Flexi (unlike the Noor Card section).
- Audit-flagged on fee; Velocity/Flexi conflation resolved.
- Confidence: high.

### Faysal Islami Priority World Debit Card

- `card_type` / `tier`: debit / world.
- `minimum_monthly_salary_pkr`: **500,000** — verified. Employee Banking
  route to Priority status: PKR 500,000 gross salary per month.
- `minimum_account_balance_pkr`: **5,000,000** — corrected from `3,000,000`.
  World-tier NTB requires PKR 5Mn CASA; pilot was using the Platinum-tier
  CASA threshold.
- `minimum_average_balance_pkr`: **5,000,000** — corrected (ETB CASA quarterly
  average).
- `minimum_relationship_balance_pkr`: **10,000,000** — added (AUM route).
- `minimum_deposit_pkr`: **15,000,000** — corrected from `5,000,000`. World
  Term Deposit threshold is PKR 15Mn (vs PKR 5Mn for Platinum).
- `annual_fee_pkr`: **0** — verified (complimentary while threshold maintained).
- `annual_fee_waiver_rule`: rewritten with the SOC's explicit
  PKR 4,250 (primary) / PKR 2,500 (supplementary) quarterly fee for waiver
  failure.
- Age 18+ (supplementary 18+ per Priority experience page).
- Confidence: high.

### Faysal Islami Priority Platinum Debit Card

- `card_type` / `tier`: debit / platinum.
- `minimum_monthly_salary_pkr`: **500,000** — verified (Employee Banking
  route).
- `minimum_account_balance_pkr`: **3,000,000** — verified (NTB CA/SA).
- `minimum_average_balance_pkr`: **3,000,000** — verified (ETB CASA quarterly).
- `minimum_relationship_balance_pkr`: **10,000,000** — added (AUM route).
- `minimum_deposit_pkr`: **5,000,000** — verified (Term Deposit route).
- `annual_fee_pkr`: **0** — verified.
- `annual_fee_waiver_rule`: rewritten with SOC's PKR 1,750 (primary) /
  PKR 1,500 (supplementary) quarterly fee for waiver failure.
- Age 18+.
- Confidence: high.

### Faysal Islami Mastercard Amal Gold Debit Card

- `card_type` / `tier`: debit / gold.
- `minimum_monthly_salary_pkr`: **null** — Amal Women accounts publish no
  salary threshold for the base product.
- `minimum_account_balance_pkr`: **null** — same.
- `annual_fee_pkr`: **3,300** — verified SOC Section 1.a.xii.
- `supplementary_annual_fee_pkr`: **2,300** — added from SOC Section 1.b.x.
- `annual_fee_waiver_rule`: **null** — none published.
- Age 18+.
- Confidence: high.

### Faysal Islami Mastercard Amal Platinum Debit Card

- `card_type` / `tier`: debit / platinum.
- `minimum_monthly_salary_pkr`: **null**.
- `minimum_account_balance_pkr`: **null**.
- `annual_fee_pkr`: **7,000** — verified SOC Section 1.a.xi.
- `supplementary_annual_fee_pkr`: **6,000** — added from SOC Section 1.b.ix.
- Age 18+.
- Confidence: high.

### Faysal Islami Mastercard Classic Debit Card

- `card_type` / `tier`: debit / classic.
- `annual_fee_pkr`: **2,300** — verified SOC Section 1.a.v. (ProPakistani's
  Rs. 1,150 figure is for the Roshan Digital Account variant or an older
  cycle and was discarded.)
- `supplementary_annual_fee_pkr`: **1,600** — added.
- Salary / balance null (base card, all account holders).
- Age 18+.
- Confidence: high.

### Faysal Islami Mastercard Gold Debit Card

- `card_type` / `tier`: debit / gold.
- `annual_fee_pkr`: **3,300** — verified SOC Section 1.a.vi.
- `supplementary_annual_fee_pkr`: **2,300** — added.
- Salary / balance null.
- Age 18+.
- Confidence: high.

## Cross-card observations

- The Jan-Jun 2026 SOC Section 4 (Faysal Islamic Priority Banking) is the
  canonical source for both priority debit card thresholds AND for the
  waiver-failure quarterly fees. Pilot priority-card entries were treating
  the World card as having the Platinum thresholds (PKR 3Mn / PKR 5Mn); this
  has been corrected to PKR 5Mn / PKR 15Mn for World.
- Pilot was applying a flat PKR 40,000 salary across every Noor variant. The
  Noor KFS uses a tiered grid that scales with the card (Velocity/Gold 30k,
  Titanium 50k, Platinum 200k, World 500k). All five Noor credit cards updated.
- SOC Section 10 (Noor Card) and Section 12 (Noor Flexi Card) are separate
  product sections with different fee tables; the pilot was treating Flexi
  as a Velocity-equivalent and was off by PKR 2,500 on the primary annual fee.
- Faysal publishes the spend-based reversal *reduced fee* in the SOC but not
  the *qualifying spend threshold*; thresholds in the pilot are KFS-derived
  and should be treated as informational rather than primary-cited.

## Gaps / unresolved

- Faysal Bank's website returns HTTP 403 to programmatic fetchers across all
  product, KFS, and SOC PDF URLs. The SOC was readable via the locally-stored
  artifact under `data/card-requirements/artifacts/faysal-bank/soc-2026-h1/`;
  KFS PDFs were not directly readable in this session. Salary tiers were
  taken from KFS distillations after confirming the KFS PDF URL on
  faysalbank.com.
- Exact spend thresholds for Noor Card annual fee reversal (per variant) are
  not in the SOC and could not be directly extracted from the KFS PDF this
  session; distilled values written into the waiver rule for V/G/T/P/W are
  approximate and flagged.
- The publicly-advertised "Noor Blaze" name appears in older marketing and in
  TechJuice's distillation but no longer appears in either the current Noor
  Cards landing inventory or the Jan-Jun 2026 SOC. The 12-card inventory in
  this pilot reflects the current Faysal Islami line-up (Noor: World,
  Platinum, Titanium, Gold, Velocity, Flexi; Priority: World, Platinum;
  Mastercard Amal Gold / Amal Platinum; Mastercard Classic / Gold).
