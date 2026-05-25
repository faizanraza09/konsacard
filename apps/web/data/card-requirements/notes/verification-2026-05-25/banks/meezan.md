# Meezan Bank Limited — Verification Log (2026-05-25)

**Bank slug:** `meezan`
**Pilot file:** `data/card-requirements/work/meezan-pilot.json`
**Cards in scope:** 12 (all debit; no consumer credit-card catalogue published by Meezan)

## Sources consulted

- https://www.meezanbank.com/wp-content/themes/mbl/downloads/home-downloads/SOC-ENG-Jan-Jun-2026.pdf — Official Schedule of Charges, Jan-Jun 2026. Section K (ADC Services), Section L (Premium Banking), Section M (Meezan Plus Account), Section N (Roshan Digital), Section R (Smart PayPak).
- https://www.meezanbank.com/visa-debit-card — Visa Silver / Gold debit overview (transaction limits only; fees referred to SOC).
- https://www.meezanbank.com/visa-infinite-debit-card/ — Visa Infinite Debit Card product page.
- https://www.meezanbank.com/world-debit-card/ — Mastercard World Debit Card product page.
- https://www.meezanbank.com/premium-banking/ — Meezan Premium Banking eligibility and bundled debit cards.
- https://www.meezanbank.com/women-account/ — Women First Account (linked account for Women First Card).
- https://www.meezanbank.com/student-debit-card/ — Visa Student Debit Card page.
- https://www.meezanbank.com/digital-asaan-student-account/ — Asaan Student Account (linked account).
- https://www.meezanbank.com/kids-club-account — Kids Club Account (linked account; covers Kids & Teens card).
- https://www.meezanbank.com/visa-platinum-debit-card — Visa Platinum Debit Card.
- https://www.meezanbank.com/titanium-debit-card/ — Mastercard Titanium Debit Card.
- https://www.meezanbank.com/paypak-debit-card/ — Meezan PayPak Debit Card.

The SOC PDF was fetched, downloaded locally, and converted via `pdftotext -layout`; Section K (ADC Services / debit-card fees) is the authoritative table for all fee values below.

## SOC Section K - master fee table (verbatim extract)

```
Card Type        Issuance Fee   Annual Fee*
Visa Classic         3,500        3,500
Visa Gold            4,500        4,500
Visa Platinum       10,000       10,000
Visa Infinite       42,500       42,500
Women First            500        3,500
Kids & Teens          Free        1,250
Student Card          Free        Free
Master Classic       3,500        3,500
Master Titanium      5,000        5,000
Master World        27,500       27,500
FCY Debit          USD 15       USD 15
PayPak               2,500        2,500
```
Replacement = same as annual; supplementary = same as annual.

## Card-by-card verification

### Meezan Visa Silver Debit Card
- `joining_fee_pkr` / `annual_fee_pkr`: **3,500 / 3,500** — verified against SOC Section K.
- `minimum_monthly_salary_pkr`: **null** — corrected from `0`. Card itself publishes no salary threshold; eligibility is account-linked.
- `minimum_account_balance_pkr`: **null** — corrected from `0`. No card-side balance floor; the 200,000 figure belongs to the Meezan Plus *waiver*, not card issuance.
- `minimum_average_balance_pkr`: **200,000** — added, sourced from SOC Section M (Meezan Plus).
- `annual_fee_waiver_rule`: corrected to cite both SOC Waiver Criteria 1-2 (free issuance for MDA / Asaan / Rupee Current) and SOC Section M Meezan Plus (free annual at PKR 200,000 MAB).
- `pakistani_cnic_required`: **true** — standard SBP / NADRA requirement, account-linked.
- `existing_account_required`: **true** — verified.
- Confidence: **high**.

### Meezan Visa Gold Debit Card
- `joining_fee_pkr` / `annual_fee_pkr`: **4,500 / 4,500** — verified against SOC Section K.
- `minimum_monthly_salary_pkr`, `minimum_account_balance_pkr`: corrected to **null** (no card-side threshold).
- `minimum_average_balance_pkr`: **200,000** added (Meezan Plus waiver).
- Waiver rule now captures Senior Citizen first-card-free issuance and Asaan / Rupee Current first-card-free per SOC Waiver Criteria 2-3.
- Confidence: **high**.

### Meezan Visa Infinite Debit Card
- `joining_fee_pkr` / `annual_fee_pkr`: **42,500 / 42,500** — verified, SOC Section K.
- `minimum_account_balance_pkr` / `minimum_average_balance_pkr`: **1,000,000** — verified, SOC Waiver / Issuance Criteria #4 ("only issued to customers who make an initial deposit or maintain an average monthly balance of at least PKR 1,000,000").
- `minimum_relationship_balance_pkr`: **15,000,000** — verified, SOC Section L (Premium Banking) free-ADC clause.
- Waiver rule updated to match SOC Section L exactly: PKR 15M checking / 20M checking+TDCs / **50M** checking+TDCs+Naya Pakistan Certificates from Meezan RDA. The previous wording captured the same numbers.
- **Conflict preserved:** Visa Infinite product page surfaces the third tier as "PKR 20M or more" while SOC Section L says PKR 50M (with Naya Pakistan Certificates from RDA). SOC treated as authoritative.
- SOC Section L Note: PKR 3,500 / month fee if Premium status lapses. Added.
- Confidence: **medium** (premium-page vs SOC disagreement).

### Meezan World Debit Card
- `joining_fee_pkr` / `annual_fee_pkr`: **27,500 / 27,500** — verified, SOC Section K (row labelled "World Card").
- `minimum_account_balance_pkr` / `minimum_average_balance_pkr`: corrected to **500,000** (was 5,000,000 / 500,000 split). The PKR 500,000 figure is the SOC issuance floor (SOC Waiver / Issuance Criteria #5). The PKR 5M is the Premium-customer waiver threshold, captured separately as `minimum_relationship_balance_pkr`.
- `minimum_relationship_balance_pkr`: **5,000,000** — verified, SOC Section L.
- Waiver rule re-written: PKR 5M checking / 7M checking+TDCs / **25M** checking+TDCs+Naya Pakistan Certificates from RDA. The previous wording said "5M in accounts or 7M in TDCs" which understates the third tier and misclassifies the second.
- **Conflict preserved:** World card product page wording ("5M in accounts or 7M in TDCs") disagrees with SOC Section L (5M / 7M / 25M with INPC). SOC authoritative.
- SOC Section L Note: PKR 2,200 / month fee if Premium status lapses. Added.
- Confidence: **medium**.

### Meezan Women First Debit Card
- `joining_fee_pkr`: **500** — added (was missing). SOC Section K explicitly lists Women First issuance PKR 500.
- `annual_fee_pkr`: **3,500** — verified, SOC Section K.
- `minimum_monthly_salary_pkr`: corrected from **40,000** to **null**. The PKR 40,000 / 75,000 / 150,000 thresholds previously held are from Easy Home (House Finance) on the *meezan-women-first* product page, not from card eligibility. The Women First *account* page (women-account/) and SOC publish no salary threshold for the debit card.
- `minimum_age_years` / `maximum_age_years`: corrected from **25 / 65** to **null / null**. The 25-65 band on meezan-women-first/ explicitly applies to Easy Home and Car Ijarah underwriting, not to the debit card or the linked account.
- Waiver rule rewritten to reflect only what women-account/ publishes ("first-year discounted pricing on Women First Visa Debit Card only").
- Confidence: **medium** — card-page lacks an explicit eligibility line; reliant on account-page inheritance.

### Meezan Visa Student Debit Card
- `joining_fee_pkr` / `annual_fee_pkr`: **0 / 0** — verified, SOC Section K.
- `minimum_age_years` / `maximum_age_years`: **18 / 24** — verified, student-debit-card page.
- `minimum_monthly_salary_pkr` / `minimum_account_balance_pkr`: corrected from `0` to **null** (eligibility is the linked Asaan Student Account; the account itself has no minimum salary or initial deposit).
- `existing_account_required`: **true** — verified ("Only customers having Meezan Asaan Student Account can avail Meezan Visa Student Debit Card").
- Confidence: **high**.

### Meezan Master Classic Debit Card
- `joining_fee_pkr` / `annual_fee_pkr`: **3,500 / 3,500** — verified, SOC Section K (Mastercard Debit row, Classic tier).
- `minimum_monthly_salary_pkr`: corrected to **null**.
- `minimum_account_balance_pkr`: corrected to **null** (was previously implied as 200,000 via the average-balance field).
- `minimum_average_balance_pkr`: **200,000** — verified, SOC Section M (Meezan Plus).
- Waiver rule clarified - also picks up the SOC Waiver Criteria #1-2 free issuance.
- Confidence: upgraded from medium to **high**.

### Meezan PayPak Debit Card
- `joining_fee_pkr` / `annual_fee_pkr`: **2,500 / 2,500** — added; was previously null. SOC Section K (Meezan PayPak Debit Card row) explicitly publishes PKR 2,500 issuance and PKR 2,500 annual.
- **Conflict preserved (high-impact):** paypak-debit-card/ product page states "Annual Charges: Rs. 1600 per annum plus tax", while SOC says PKR 2,500. SOC is authoritative for billing; product page is stale. Noted explicitly.
- `minimum_average_balance_pkr`: **200,000** — verified, SOC Section M (Meezan Plus).
- Smart PayPak (separate product, Rs. 500 per annum, SOC Section R) explicitly NOT conflated.
- Confidence: **low** — fee conflict on primary sources.

### Meezan Kids & Teens Card
- `joining_fee_pkr` / `annual_fee_pkr`: **0 / 1,250** — verified, SOC Section K.
- `minimum_account_balance_pkr`: **500** — verified, Kids Club Account page ("Minimum investment Rs. 500/-").
- `maximum_age_years`: **11** — verified ("under 12 years old, upgrades to Teens Club after 12th birthday").
- `pakistani_cnic_required`: set to **false** (B-Form / guardian CNIC; child does not hold CNIC).
- Confidence: **high**.

### Meezan Platinum MasterCard Debit Card
- `joining_fee_pkr` / `annual_fee_pkr`: **0 / 0** — verified Premium-customer price per Premium Banking page. **Important caveat:** SOC Section K (Mastercard Debit row) does NOT list a Platinum tier - it only has Classic / Titanium / World / FCY. The card exists only inside the Premium proposition.
- `minimum_account_balance_pkr` / `minimum_relationship_balance_pkr`: **3,000,000** — verified, SOC Section L (Individual / Sole Proprietor: PKR 3M checking-only Premium membership floor).
- Waiver rule expanded to include the salaried Premium route (PKR 750,000 gross salary credited to Meezan Payroll Partner).
- SOC Section L Note: PKR 800 / month fee if Premium status lapses. Added (effectively PKR 9,600 / yr).
- Confidence: **medium** — fee-line not in SOC Section K, only published via Premium proposition.

### Meezan Visa Platinum Debit Card
- `joining_fee_pkr` / `annual_fee_pkr`: **10,000 / 10,000** — verified, SOC Section K. Joining fee was previously missing.
- `minimum_account_balance_pkr`: **null** — verified, no card-side balance threshold and Visa Platinum is NOT in the Meezan Plus PKR 200,000 waiver list.
- `annual_fee_waiver_rule`: null — confirmed, no standing waiver published for this tier.
- Confidence: **high**.

### Meezan Titanium MasterCard Debit Card
- `joining_fee_pkr` / `annual_fee_pkr`: **5,000 / 5,000** — verified, SOC Section K (Mastercard Debit row, Titanium tier).
- `annual_fee_waiver_rule`: added; SOC Section N (Roshan Digital Account) free-first-year for customers who have remitted funds in their PKR RDA. Titanium is NOT in the Plus PKR 200,000 list.
- `minimum_monthly_salary_pkr` / `minimum_account_balance_pkr`: **null** — no published thresholds.
- Confidence: **high**.

## Cross-card observations

- **Meezan publishes everything in the SOC.** Section K is a single tidy fee table covering all 12 cards; values from product pages should always be cross-checked against Section K.
- **Two parallel waiver regimes:** Meezan Plus (mass-affluent, PKR 200,000 MAB) covers Silver / Gold / Master Classic / PayPak. Premium Banking (PKR 3M+ / PKR 750,000 salary) bundles Platinum Mastercard, World Mastercard, and Visa Infinite as free.
- **Issuance floors are independent of waiver floors.** Visa Infinite and World Mastercard each have a separate SOC-mandated minimum (PKR 1M and PKR 500,000 respectively) just to be issued the card - distinct from the Premium-customer thresholds that waive the annual fee.
- **Bogus card-page eligibility values cleaned.** Several previously held values (Women First salary 40,000 / age 25-65) were sourced from House-Finance underwriting on the same domain, not from card eligibility. Cleared.

## Gaps / unresolved

- **PayPak SOC vs product-page fee conflict** (PKR 2,500 vs PKR 1,600). Recorded SOC value; PayPak product page is likely outdated. Worth re-checking next pass.
- **Mastercard Platinum has no SOC Section K row.** Annual fee is implicit ("free for Premium", or PKR 800 / month if Premium lapses). Recorded as `annual_fee_pkr: 0` to reflect the published Premium price; the lapse fee is captured in `notes[]` only.
- **Visa Infinite product-page Premium tier #3 (PKR 20M)** disagrees with SOC Section L (PKR 50M with INPC). SOC treated as authoritative; product-page conflict logged in `notes[]`.
- **Mastercard World card-page wording** ("5M accounts or 7M TDCs") understates SOC Section L (5M / 7M / 25M with INPC). Conflict logged.
- **No public Meezan consumer credit-card catalogue.** As of Jan-Jun 2026 SOC, Meezan offers no conventional consumer credit card (consistent with their Shariah-compliant remit).
