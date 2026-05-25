# Standard Chartered Bank (Pakistan) — Verification Log (2026-05-25)

**Bank slug:** `standard-chartered`
**Pilot file:** `data/card-requirements/work/standard-chartered-pilot.json`
**Cards in scope:** 5 (Mastercard Platinum, Mastercard World, Mastercard Titanium, Easy Credit, Saadiq Mastercard Platinum)

## Sources consulted

- https://www.sc.com/pk/credit-cards/ — credit-card landing page; surfaces minimum income for Titanium (PKR 50,000 marketing claim) and Easy Credit (PKR 50,000) but not for Platinum/World/Saadiq.
- https://www.sc.com/pk/credit-cards/compare/ — compare page; lists age 21+ salaried / 25+ self-employed across the lineup, no fee/income disclosure.
- https://www.sc.com/pk/credit-cards/mastercard-platinum/ — Platinum product page; only age criteria visible.
- https://www.sc.com/pk/credit-cards/mastercard-platinum/apply-now/ — **explicit "Minimum Monthly Salary / Income: 300,000" PKR**.
- https://www.sc.com/pk/credit-cards/mastercard-world/ — World product page; only age criteria visible.
- https://www.sc.com/pk/credit-cards/mastercard-world/apply-now/ — **explicit "Minimum Monthly Salary / Income: 500,000" PKR**.
- https://www.sc.com/pk/credit-cards/master-card-titanium/ — Titanium product page; only age criteria visible; requires existing credit card/loan >1 year.
- https://www.sc.com/pk/credit-cards/master-card-titanium/apply-now/ — **explicit "Minimum Monthly Salary / Income: 40,000" PKR**.
- https://www.sc.com/pk/credit-cards/mastercard-saadiq-platinum/ — Saadiq Platinum product page.
- https://www.sc.com/pk/credit-cards/mastercard-saadiq-platinum/apply-now/ — income brackets start at PKR 100,000-249,999.
- https://av.sc.com/pk/content/docs/CC_Summary_Box.pdf — conventional credit-card Summary Box (SCBCPRMIDV123012024, Jan 2024). Definitive primary/supp fees for Platinum, World, Easy Credit. Linked from every conventional card product page.
- https://av.sc.com/pk/content/docs/CCPL_MID.pdf — Personal Installment Finance & Credit Cards MID (SCBCPRMIDV008012026, Jan 2026). Repeats summary-box pricing logic and links Employee / Premium / Priority / Non-Priority waiver rules.
- https://av.sc.com/pk/content/docs/pk-saadiq-credit-card-mid.pdf — Saadiq Credit Card MID (SCBPLSAADIQMID-CC&PF-08052026, May 2026). Definitive primary/supp fees for Saadiq Mastercard Platinum (Murabaha).
- https://av.sc.com/pk/content/docs/pk-annual-fee-reversal-criteria.pdf — Annual Fee Reversal Criteria 2026 (effective 1 Jan 2026). Definitive year-2+ reversal grids per card (Platinum, World, Titanium, Cashback, Easy Credit, Saadiq Platinum).
- https://av.sc.com/pk/content/docs/pk-ramadan-and-eid-campaign-tnc.pdf — confirms Titanium / Platinum / World / Saadiq Platinum are all current 2026 SCB products.
- https://www.sc.com/global/av/pk-completep-schedule-of-charges-eng.pdf — **2017 SOC, outdated** (lists Titanium at Rs 3,000, Visa Platinum at Rs 8,000). Not used as evidence for current fees.

## Card-by-card verification

### Mastercard Platinum Credit Card

- `card_type` / `tier`: credit / platinum.
- `minimum_monthly_salary_pkr`: **300,000** — **corrected from 50,000** — source: https://www.sc.com/pk/credit-cards/mastercard-platinum/apply-now/ ("Minimum Monthly Salary / Income: 300,000"). Previously recorded PKR 50,000 figure appears to have been mis-attributed from the Titanium/Easy Credit tier.
- `minimum_account_balance_pkr`: **null** — verified. No deposit threshold surfaced for this unsecured product. Changed from `0` to `null` per methodology (silent page → null, not 0).
- `annual_fee_pkr`: **14,000** — **corrected from 19,000** — source: CC_Summary_Box.pdf Table 1.
- `supplementary_annual_fee_pkr`: **5,000** — **corrected from 7,500** — source: CC_Summary_Box.pdf Table 1.
- `joining_fee_pkr`: **0** — verified — source: CCPL_MID.pdf p.3 ("There is no Joining Fee").
- `annual_fee_waiver_rule`: First-year spend PKR 125,000 or 70% of card limit (whichever lower) within 3 months → reversal. Year 2+: 1.5x credit limit in 3 months after fee charge, capped at PKR 800,000 / floored at PKR 200,000. Plus first-year waiver for Employee Banking and Premium Banking; ongoing waiver for Priority Banking. Sources: CC_Summary_Box.pdf Table 2 + annual fee reversal PDF.
- `minimum_age_years`: **21** (salaried) — verified — source: product page.
- `maximum_age_years`: **null** — verified, no upper bound published.
- `income_document_required`: **true** — verified — source: apply-now ("CNIC, Income Proof").
- `salary_transfer_required`: **false** — not required per public pages.
- `pakistani_cnic_required`: **true** — verified.
- `existing_account_required`: **false** — CCPL_MID p.4 explicitly states "opening an account for credit card is not mandatory".
- Confidence: **high**.

### Mastercard World Credit Card

- `card_type` / `tier`: credit / world.
- `minimum_monthly_salary_pkr`: **500,000** — verified — source: https://www.sc.com/pk/credit-cards/mastercard-world/apply-now/.
- `minimum_account_balance_pkr`: **null** — verified (was 0; changed to null per methodology).
- `annual_fee_pkr`: **18,000** — **corrected from 26,000** — source: CC_Summary_Box.pdf Table 1.
- `supplementary_annual_fee_pkr`: **6,000** — **corrected from 9,000** — source: CC_Summary_Box.pdf Table 1.
- `joining_fee_pkr`: **0** — verified.
- `annual_fee_waiver_rule`: First-year spend PKR 250,000 within 3 months → reversal (note: no 70% option for World). Year 2+: 1.5x credit limit in 3 months, capped PKR 900,000 / floored PKR 600,000. Sources: CC_Summary_Box.pdf Table 2 + annual fee reversal PDF.
- `minimum_age_years`: **21** — **corrected from null** — source: product page (salaried 21+).
- `maximum_age_years`: **null** — verified.
- `income_document_required` / `salary_transfer_required` / `pakistani_cnic_required` / `existing_account_required`: true / false / true / false.
- Confidence: **high**.

### Mastercard Titanium Credit Card

- `card_type` / `tier`: credit / titanium.
- `minimum_monthly_salary_pkr`: **40,000** — **corrected from 50,000** — source: https://www.sc.com/pk/credit-cards/master-card-titanium/apply-now/ ("Minimum Monthly Salary / Income: 40,000"). The credit-card landing page still markets "above PKR 50,000" for Titanium, but the live apply-now form publishes PKR 40,000 as the binding threshold.
- `minimum_account_balance_pkr`: **null** — verified (changed from 0 to null).
- `annual_fee_pkr`: **null** — verified — Titanium does NOT appear in CC_Summary_Box.pdf Table 1, nor in the CCPL_MID Table 1. The annual fee reversal PDF (2026) groups Titanium with Platinum for year-2+ reversal logic but lists no headline fee. Per methodology, this stays null and is flagged as a bank gap.
- `supplementary_annual_fee_pkr`: **null** — same rationale.
- `joining_fee_pkr`: **0** — verified.
- `annual_fee_waiver_rule`: Year 2+ grouped with Platinum (1.5x limit, capped PKR 800,000 / floored PKR 200,000) per annual fee reversal PDF.
- `minimum_age_years`: **21** — verified — product page.
- `maximum_age_years`: **null** — verified.
- `income_document_required` / `salary_transfer_required` / `pakistani_cnic_required` / `existing_account_required`: true / false / true / false. Note Titanium product page requires "credit card or loan product from any bank for more than 1 year" — this is a credit-history requirement, not an existing-SCB-account requirement.
- Confidence: **medium** — annual fee genuinely undisclosed by SCB.

### Easy Credit

- `card_type` / `tier`: credit / easy-credit.
- `minimum_monthly_salary_pkr`: **50,000** — verified — source: credit-card landing page surfaces "monthly income above PKR 50,000".
- `minimum_account_balance_pkr`: **null** — verified (changed from 0 to null).
- `annual_fee_pkr`: **4,000** — **corrected from 3,000** — source: CC_Summary_Box.pdf Table 1 ("MasterCard Easy Credit Card 4,000").
- `supplementary_annual_fee_pkr`: **850** — **corrected from 1,000** — source: CC_Summary_Box.pdf Table 1.
- `joining_fee_pkr`: **0** — verified.
- `annual_fee_waiver_rule`: First-year spend PKR 200,000 or 70% of card limit (whichever lower) within 3 months. Easy Credit is unique in that cash-advance spend counts toward reversal eligibility per the annual fee reversal PDF. Year 2+ grouped with Platinum (1.5x, 200K-800K).
- `minimum_age_years`: **21** — verified.
- `maximum_age_years`: **null** — verified.
- `income_document_required` / `salary_transfer_required` / `pakistani_cnic_required` / `existing_account_required`: true / false / true / false.
- Confidence: **high**.

### Saadiq Mastercard Platinum Credit Card

- `card_type` / `tier`: credit / platinum (Islamic / Saadiq).
- `minimum_monthly_salary_pkr`: **100,000** — **corrected from null** — source: apply-now form's income bracket "PKR 100000 – 249999" as the lowest bucket implies PKR 100,000 minimum monthly income.
- `minimum_account_balance_pkr`: **null** — verified.
- `annual_fee_pkr`: **19,000** — **corrected from null** — source: pk-saadiq-credit-card-mid.pdf p.2 ("Mastercard Platinum (Murabaha) Rs.19,000").
- `supplementary_annual_fee_pkr`: **6,000** — **corrected from previously recorded 6,000** (matches MID) — verified.
- `joining_fee_pkr`: **0** — verified — Saadiq MID ("There is no Joining Fee").
- `annual_fee_waiver_rule`: First-year reversal on spend PKR 200,000 or 70% of card limit (whichever lower) within the year. First-year fee also reversed on digital acquisition (promotion valid till 31 Dec 2026). Supplementary first-year fee waived as a promotion till 31 Dec 2026. Employee Banking & Premium Banking get first-year waiver. Priority Banking gets ongoing waiver while Priority Client criteria are met. Year 2+ grouped with Platinum (1.5x, 200K-800K).
- `minimum_age_years`: **21** — verified.
- `maximum_age_years`: **null** — verified.
- `income_document_required` / `salary_transfer_required` / `pakistani_cnic_required` / `existing_account_required`: true / false / true / false.
- Confidence: **high**.

## Cross-card observations

- **SCB uses a single conventional Credit Card Summary Box (CC_Summary_Box.pdf) and a single conventional MID (CCPL_MID.pdf) shared across all conventional cards.** Card-specific MIDs do NOT exist on av.sc.com; per-card "Important Documents" sections all link to the same two PDFs.
- **Segmentation drives waivers, not eligibility.** Employee Banking, Non-Priority, Priority (AUM ≥ PKR 3,000,000 quarterly average), and Premium Banking each get distinct waiver rules but the headline annual fee is the same across segments.
- **Salaried vs self-employed age split is universal.** Every product page restates 21+ salaried / 25+ self-employed.
- **The 2017 Schedule of Charges PDF surfaced via Google (`pk-completep-schedule-of-charges-eng.pdf`) is stale** — its credit-card fees (Visa Platinum Rs 8,000, MasterCard Titanium Rs 3,000) do not match the live 2024-2026 figures and must not be used.
- **The 2018 combined Saadiq MID (`pk-saadiqdepositscreditcard-mid-tnc.pdf`) is also stale** (Saadiq Platinum Rs 5,000); the current Saadiq MID is `pk-saadiq-credit-card-mid.pdf` (May 2026, Rs 19,000).

## Gaps / unresolved

- **Mastercard Titanium annual fee**: genuinely not published. Annual fee reversal PDF groups Titanium under Platinum's reversal rule but Table 1 of the Summary Box and Table 1 of CCPL_MID omit Titanium. `annual_fee_pkr` and `supplementary_annual_fee_pkr` left null with a bank gap.
- **Debit cards**: not in scope of this pilot. No clean debit-card eligibility / fee pages surfaced (the legacy 2017 SOC is the only public reference and it is outdated).
- **Mastercard Cashback**: referenced in the annual fee reversal PDF (grouped with Platinum) but not in the current pilot card list. Worth adding in a future pass if SCB still markets it.
