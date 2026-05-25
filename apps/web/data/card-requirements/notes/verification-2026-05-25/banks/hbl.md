# HBL (Habib Bank Limited, conventional) — Verification Log (2026-05-25)

**Bank slug:** `hbl`
**Pilot file:** `data/card-requirements/work/hbl-pilot.json`
**Cards in scope:** 13 (5 credit + 8 debit)
**Excluded:** HBL Islamic (handled by a separate agent).

## Sources consulted

- https://www.hbl.com/personal/cards/credit-cards/credit-cards-overview — credit card eligibility table (salaried salary + self-employed balance + age)
- https://www.hbl.com/personal/cards/credit-cards/fuel-saver-credit-card — FuelSaver Gold / Green product page (annual fee table)
- https://www.hbl.com/personal/cards/debit-cards/debit-cards-overview — debit card umbrella list
- https://www.hbl.com/personal/cards/debit-cards/hbl-classic-debitcard — Classic debit card product page
- https://www.hbl.com/personal/cards/debit-cards/hbl-gold-debit-card — Gold debit card product page
- https://www.hbl.com/personal/cards/debit-cards/hbl-business-debitcard — Business debit (Mastercard Business Classic)
- https://www.hbl.com/personal/cards/debit-cards/hbl-world-business-debit-card — World Business debit
- https://www.hbl.com/personal/cards/debit-cards/hbl-world-debitcard — World debit
- https://www.hbl.com/prestige/prestige-exclusive/prestige-cards/hbl-prestige-world-elite-debitcard — Prestige World Elite product page
- https://www.hbl.com/personal/cards/complimentary-lounge-access — names Titanium Debit Card (dedicated page 404'd)
- https://www.hbl.com/personal/accounts/current/hbl-conventional-currentaccount — linked-account monthly average balance (PKR 40,000)
- https://www.hbl.com/assets/documents/SOBC_January_to_June_2026_-_English_Web.pdf — Schedule of Bank Charges (Parts M, T, U, V)
- https://www.hbl.com/assets/documents/Addendum_to_SOBC_for_January_to_June_2026_-_HBL_Premium_-_English.pdf — Premium-segment Master World debit fee waivers
- https://www.hbl.com/assets/documents/KFS_HBL_Conventional_Current_Account.pdf — KFS confirms first-year debit waivers (Nisa Plus, RDA, Asaan, @Work, Freedom)
- https://www.hbl.com/assets/downloads/Limit%20Enhancement.pdf — debit-card transaction limits (used for cross-check, not eligibility)

The Jan-Jun 2026 SOBC is the most current half-yearly publication; no Jul-Dec 2026 SOBC has appeared as of the verification date, so the existing citations remain authoritative.

## Card-by-card verification

### HBL Platinum CreditCard
- `minimum_monthly_salary_pkr`: **400000** — verified — credit-cards-overview (salaried)
- `minimum_relationship_balance_pkr`: **1000000** — verified — credit-cards-overview (self-employed)
- `annual_fee_pkr`: **22000** — verified — SOBC Jan-Jun 2026, line 1080 (Part M, Section 5e)
- `supplementary_annual_fee_pkr`: **11000** — added — SOBC line 1083
- `annual_fee_waiver_rule`: now states the 50% Prestige waiver (SOBC Part T Section 5) — previously null
- `minimum_age_years` / `maximum_age_years`: **21 / 65** — verified (60 salaried, 65 self-employed; we record the wider envelope)
- Confidence: medium → **high** after re-verification.

### HBL Gold CreditCard
- `minimum_monthly_salary_pkr`: **100000** — verified
- `minimum_relationship_balance_pkr`: **300000** — verified
- `annual_fee_pkr`: **14000** — verified — SOBC line 1079
- `supplementary_annual_fee_pkr`: **7000** — added — SOBC line 1082
- `minimum_age_years` / `maximum_age_years`: **21 / 65** — verified
- Confidence: medium → **high**.

### HBL Green CreditCard
- `minimum_monthly_salary_pkr`: **35000** — verified
- `minimum_relationship_balance_pkr`: **105000** — verified
- `annual_fee_pkr`: **6500** — verified — SOBC line 1078
- `supplementary_annual_fee_pkr`: **3250** — added — SOBC line 1081
- `minimum_age_years` / `maximum_age_years`: **21 / 65** — verified
- Confidence: medium → **high**.

### HBL FuelSaver Gold CreditCard
- `minimum_monthly_salary_pkr`: **100000** — verified (inherits Gold-tier eligibility)
- `minimum_relationship_balance_pkr`: **300000** — added (Gold-tier inheritance — self-employed)
- `annual_fee_pkr`: **7200** — verified from product page; **conflict** with SOBC monthly framing (Rs. 700/mo × 12 = 8,400)
- `supplementary_annual_fee_pkr`: **4200** — added (Rs. 350/mo × 12)
- `minimum_age_years` / `maximum_age_years`: **21 / 65** — added (inherited from Gold tier)
- Confidence: **high** (conflict logged in notes).

### HBL FuelSaver Green CreditCard
- `minimum_monthly_salary_pkr`: **35000** — verified
- `minimum_relationship_balance_pkr`: **105000** — added (Green-tier inheritance)
- `annual_fee_pkr`: **3600** — verified from product page; **conflict** with SOBC monthly framing (Rs. 350/mo × 12 = 4,200)
- `supplementary_annual_fee_pkr`: **2100** — added (Rs. 175/mo × 12)
- `minimum_age_years` / `maximum_age_years`: **21 / 65** — added
- Confidence: **high** (conflict logged in notes).

### HBL Classic DebitCard
- `minimum_monthly_salary_pkr`: **null** — corrected from `0` (not publicly disclosed; null per methodology)
- `minimum_account_balance_pkr`: **null**; `minimum_average_balance_pkr`: **40000** — moved to the correct field, source: HBL Conventional Current Account product page
- `annual_fee_pkr`: **3000** — verified — SOBC line 1461 (Mastercard Standard primary)
- `supplementary_annual_fee_pkr`: **550** — added — SOBC line 1472
- `annual_fee_waiver_rule`: added (Nisa first-year + @Work free + Freedom-account free at PKR 40,000+ MAB)
- `existing_account_required`: **true** — added (debit cards are account-bound)
- Confidence: **medium**.

### HBL Gold DebitCard
- `minimum_monthly_salary_pkr`: **null** — verified
- `minimum_average_balance_pkr`: **40000** — moved from `minimum_account_balance_pkr` per template
- `annual_fee_pkr`: **3800** — verified — SOBC line 1462
- `annual_fee_waiver_rule`: added — Preferred customers (PKR 500k-2M quarterly avg) get 50% waiver (SOBC Part V)
- `existing_account_required`: **true** — added
- Confidence: **medium**.

### HBL Business DebitCard (Mastercard Business Classic)
- `minimum_monthly_salary_pkr`: **null** — corrected from `0` (business-only product, salary N/A)
- `minimum_average_balance_pkr`: **40000** — kept (inherited from Conventional CA assumption)
- `annual_fee_pkr`: **0** — verified — SOBC Part M note (line 1551) explicit 100% waiver; product page confirms "Free for life"
- `existing_account_required`: **true** — added (PKR business account required; personal accounts not eligible)
- Confidence: medium → **high**.

### HBL World Business DebitCard (Mastercard Business World)
- `minimum_monthly_salary_pkr`: **null** — corrected from `0`
- `annual_fee_pkr`: **22000** — verified — SOBC line 1469
- `supplementary_annual_fee_pkr`: **2500** — added — SOBC line 1488
- `annual_fee_waiver_rule`: refined — product page now publicly states "first year free, PKR 22,000 from year 2 onward" (matches SOBC's "issuance 100% waived, annual 50% charged" framing)
- `existing_account_required`: **true** — added
- Confidence: medium → **high**.

### HBL World DebitCard (Mastercard World, personal)
- `minimum_monthly_salary_pkr`: **null** — corrected from `0`
- `minimum_relationship_balance_pkr`: **2000000** — added (HBL Premium qualifying balance per SOBC Part U)
- `annual_fee_pkr`: **20000** — verified — SOBC line 1468
- `supplementary_annual_fee_pkr`: **2000** — added — SOBC line 1487
- `annual_fee_waiver_rule`: confirmed — Premium addendum: 100% waiver Y1, 50% Y2+
- `existing_account_required`: **true** — added
- Confidence: **medium**.

### HBL Prestige World Elite DebitCard
- `minimum_relationship_balance_pkr`: **5000000** — moved from `minimum_account_balance_pkr` per template (quarterly average current-account balance, not opening balance) — SOBC Part T
- `minimum_monthly_salary_pkr`: **null** — corrected from `0`
- `annual_fee_pkr`: **0** — verified — SOBC Part T Section 2A (Free annual fee + free issuance + free replacement)
- `existing_account_required`: **true** — confirmed
- Confidence: **high**.

### HBL Nisa DebitCard
- `minimum_monthly_salary_pkr`: **null** — corrected from `0`
- `minimum_account_balance_pkr`: **null** — corrected from `0`
- `annual_fee_pkr`: **3000** — added (default Mastercard Standard variant; Gold variant Rs. 3,800 if customer selects it)
- `annual_fee_waiver_rule`: expanded to include both SOBC line 1543-1545 and KFS Mastercard Gold issuance waiver at PKR 25,000+ opening balance
- `existing_account_required`: **true** — added
- Confidence: **medium** (no standalone Nisa-branded fee table; relies on Mastercard Standard inheritance).

### HBL Titanium DebitCard
- `minimum_account_balance_pkr` → moved to `minimum_average_balance_pkr`: **40000** — inherited from Conventional CA
- `annual_fee_pkr`: **3000** — verified — SOBC line 1467 (Mastercard Titanium primary)
- `supplementary_annual_fee_pkr`: **900** — added — SOBC line 1476
- `existing_account_required`: **true** — added
- Dedicated product page returned 404 — verification relies on complimentary-lounge page + SOBC + linked-account page.
- Confidence: **medium**.

## Cross-card observations

- **All conventional HBL debit cards inherit account-side eligibility** rather than publishing card-level salary or age criteria. The Conventional Current Account requires PKR 40,000 monthly average balance, and that is the consistent floor recorded under `minimum_average_balance_pkr` for Classic/Gold/Business/Titanium.
- **Salary thresholds are credit-card-only** at HBL (overview page). They are not republished on debit-card pages, so debit `minimum_monthly_salary_pkr` is `null` per methodology (corrected from prior `0` placeholders).
- **Premium / Preferred / Prestige tiers** drive the fee-waiver structure for the upper debit cards (World, Gold, World Elite). All three are now documented from the SOBC's Part T / Part U / Part V tables.
- **Age**: only published on credit-cards-overview as 21–60 (salaried) / 21–65 (self-employed); we record `21 / 65` as the outer envelope. Debit cards have no published age.

## Conflicts

- **FuelSaver fee framing.** SOBC Jan-Jun 2026 (Part M, Section 5g-h) publishes FuelSaver fees as a monthly schedule: Rs. 350/mo (Green basic), Rs. 700/mo (Gold basic). Annualized that is Rs. 4,200 / Rs. 8,400. The FuelSaver product page's branded fee table shows annual fees of Rs. 3,600 / Rs. 7,200. We keep the product-page annual fee as the headline number and log the conflict.

## Gaps / unresolved

- **No dedicated Titanium debit-card product page** (404 on 2026-05-25) — relying on the lounge-access page that still names the card.
- **No dedicated Nisa debit-card product page** (404 on 2026-05-25) — relying on the debit-card overview + KFS + SOBC.
- **Debit-card age** is uniformly undisclosed across HBL's debit pages — kept null.
- **FuelSaver SOBC vs. product-page fee gap** — unresolved (logged above).
