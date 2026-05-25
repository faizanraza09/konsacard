# United Bank Limited (UBL) — Verification Log (2026-05-25)

**Bank slug:** `ubl`
**Pilot file:** `data/card-requirements/work/ubl-pilot.json`
**Cards in scope:** 14

## Sources consulted

- https://ubldigital.com/portals/0/Pdf/SOC-English-Jan-to-June-2026.pdf — UBL Schedule of Charges Jan-Jun 2026 (canonical fee source; 92 pages). Used p.5-8 (account waiver grids), p.11 (UBL Signature - Priority Banking criteria + free-on-criteria debit card waivers), p.33 (UBL Debit Card Fees full table), p.37 (Section F Credit Cards primary + supplementary annual fees), p.72 (UBL Ameen Debit Card Fees table).
- https://ubldigital.com/portals/0/pdf/KFS-Change-in-SOC-Jan-2026-to-Jun-2026.pdf — UBL Credit Card Summary Box / KFS for Jan-Jun 2026 with the Classic/Gold/Platinum annual fee table, the spend-based fee-reversal criteria, the card-limit bands, APR, and consumer-protection disclosures.
- https://www.ubldigital.com/Loans/Cards-Products/UBL-Credit-Card/UBL-Credit-Card-Product/Criteria-for-Annual-Fee-Reversal — Confirms the spend-in-60-days reversal thresholds (PKR 50k / 100k / 300k for Classic / Gold / Platinum).
- https://www.ubldigital.com/Loans/Cards-Products/UBL-Credit-Card — Credit-card landing page (Classic / Gold / Platinum).
- https://www.ubldigital.com/Loans/Cards-Products/UBL-Credit-Card/UBL-Credit-Card-Product — Classic/Gold features page; sole age statement is the supplementary-cardholder line "Anyone with minimum age of 14 years can be your supplementary cardholder with no maximum age limit."
- https://www.ubldigital.com/Loans/Cards-Products/UBL-Credit-Card/UBL-Platinum — Platinum benefits page.
- https://www.ubldigital.com/Loans/Cards-Products/UBL-Premium-Visa-Debit-Card + FAQ — Premium Visa debit product page; "all existing and new account holders can apply."
- https://www.ubldigital.com/Loans/Cards-Products/UBL-Paypak-Debit-Card + FAQ.
- https://www.ubldigital.com/Loans/Cards-Products/UBL-Visa-Infinite-Debit-Card — Says "As per SOC" for annual/supplementary fee; SOC is canonical.
- https://www.ubldigital.com/Loans/CardsProducts/UBLSignatureDebitMasterCard — Says "Free" for annual/supplementary/replacement; SOC reconciles this as "free on maintaining Signature Priority Banking criteria."
- https://www.ubldigital.com/Loans/Cards-Products/UBL-Debit-Card/UBL-Visa-Urooj-Debit-Card.
- https://www.ubldigital.com/Loans/Cards-Products/UBL-Debit-Card/UBL-Visa-Freelancer-Debit-Card.
- https://www.ubldigital.com/Loans/Cards-Products/UBL-Debit-Card/UBL-Visa-FCY-Business-Debit-Card — Annual fee in FCY only (USD 15 / GBP 12 / EUR 14 / AED 56 / SAR 57); confirmed against SOC p.33.
- https://www.ubldigital.com/Loans/Cards-Products/UBL-Premium-Debit-Master-Card + FAQ.
- https://www.ubldigital.com/Banking/UBL-Ameen/Self-Service-Banking/AmeenPremiumDebitMasterCard.
- https://www.ubldigital.com/Loans/Cards-Products/UBL-UNION-PAY-INTERNATIONAL-DEBIT-CARD + FAQ + Features-Benefits.
- https://www.ubldigital.com/Loans/Cards-Products/UBL-Virtual-Card/Fee-Structure + FAQ — Wiz Virtual issuance fee PKR 300 + FED, no annual.

## Card-by-card verification

### UBL Credit Card Classic

- `card_type` / `tier`: credit / classic — verified.
- `minimum_monthly_salary_pkr`: **null** — verified. UBL publishes no salary threshold for Classic on any page (product page, fee-reversal page, KFS, SOC). Silence = null.
- `minimum_account_balance_pkr`: **null** — verified. No balance threshold published. The Mukammal Current Account PKR 25,000 candidate was rejected — it is a YTD-average fee-waiver trigger on the deposit account, not a credit-card eligibility criterion.
- `annual_fee_pkr`: **6,000** — verified — source: SOC Jan-Jun 2026 p.37, Section F Credit Cards, "Visa - Classic" row.
- `supplementary_annual_fee_pkr`: **3,000** — verified — SOC p.37.
- `annual_fee_waiver_rule`: **"Annual fee reversed if primary + supplementary combined retail spend reaches PKR 50,000 within 60 days of the statement on which the annual fee is levied; reversal request within 120 days; FED not reversed."** — sourced from KFS Summary Box Jan-Jun 2026 + the fee-reversal page.
- `minimum_age_years` / `maximum_age_years`: **null / null** — verified. Only the supplementary-cardholder line (min 14, no max) is published; nothing for the primary applicant.
- `pakistani_cnic_required`: **true** — added (SBP KYC baseline for any Pakistan-issued consumer credit product).
- `salary_transfer_required` / `existing_account_required`: **false / false** — added; UBL does not require either on the public application.
- `income_document_required`: **null** — added; nothing published, but in practice underwriting will request it.
- Confidence: high — SOC fees and KFS spend-reversal thresholds are unambiguous; salary/balance silence is consistent across every UBL surface.

### UBL Credit Card Gold

- Same structure as Classic. Fees: `annual_fee_pkr`: **12,000** / `supplementary_annual_fee_pkr`: **6,000** — verified per SOC p.37. Unchanged from pilot.
- Spend reversal: **PKR 100,000 in 60 days** — verified.
- Salary/balance/age: all **null** — verified. KFS credit-limit band is PKR 125,000-499,999 (credit line, not eligibility).
- Confidence: high.

### UBL Visa Platinum Credit Card

- Fees: `annual_fee_pkr`: **20,000** / `supplementary_annual_fee_pkr`: **10,000** — verified per SOC p.37. Unchanged.
- Spend reversal: **PKR 300,000 in 60 days** — verified.
- Salary/balance/age: all **null** — verified. The audit flag asking for explicit thresholds is left unresolved because UBL does not publish any. KFS credit-limit band PKR 500,000 to PKR 7,000,000 is a credit line, not an income threshold.
- Confidence: high.
- Audit note: the prompt also calls out a "UBL Visa Signature Credit Card" — that SKU is NOT in the current 14-card pilot but DOES appear on SOC p.37 (Visa Signature, former-Silkbank/SBL: PKR 30,000 primary / PKR 15,000 supplementary). Logged in bank_gaps.

### UBL Visa Premium Debit Card

- `annual_fee_pkr`: **2,900** — CORRECTED from `2,800`. Source: SOC p.33, "UBL Debit Card Fees" table, Premium Category, "UBL VISA Premium Debit Card" row: Issuance PKR 2,900, Annual PKR 2,900, Replacement PKR 1,800, Supplementary PKR 1,500.
- `joining_fee_pkr`: **2,900** — added (issuance fee = annual fee per SOC).
- `supplementary_annual_fee_pkr`: **1,500** — verified.
- `minimum_account_balance_pkr`: **0** — verified (linked Conventional Current/Savings accounts publish no minimum-balance floor on the SOC waiver grids).
- `minimum_monthly_salary_pkr`: **null** — CORRECTED from `0`. No salary threshold published; silence = null.
- `minimum_age_years`: **18** — added (Pakistan retail-banking adult-eligibility baseline; no public minor variant of this card).
- `pakistani_cnic_required` / `existing_account_required`: **true / true** — added.
- Confidence: high.

### UBL PayPak Debit Card

- `annual_fee_pkr`: **2,000** / `supplementary_annual_fee_pkr`: **1,200** — verified per SOC p.33 Classic Category. Unchanged.
- `joining_fee_pkr`: **2,000** — added.
- `minimum_monthly_salary_pkr`: **null** — corrected from `0`.
- `minimum_age_years`: **18** — added.
- `pakistani_cnic_required` / `existing_account_required`: **true / true** — added.
- Confidence: high.

### UBL Visa Infinite Debit Card

**Largest correction in this pass.**

- `annual_fee_pkr`: **45,000** — CORRECTED from `0`. SOC Jan-Jun 2026 p.33 'Priority Banking Category' row: "UBL VISA Infinite Debit Card — Issuance PKR 45,000, Annual PKR 45,000, Replacement PKR 1,800, Supplementary PKR 45,000". The "Free" wording elsewhere applies only on maintaining Signature Priority Banking criteria, per SOC p.11 Section 8(a).
- `joining_fee_pkr`: **45,000** — added.
- `supplementary_annual_fee_pkr`: **45,000** — added.
- `minimum_account_balance_pkr` / `minimum_average_balance_pkr`: **3,000,000 / 3,000,000** — verified. SOC p.11 Section A: "Any Local Currency Current Account: PKR 3 Million Quarterly". Added the explicit `minimum_average_balance_pkr` framing because UBL publishes the threshold as a quarterly average, not an opening balance.
- `annual_fee_waiver_rule`: rewritten to make the relationship-balance conditional explicit and cite the SOC.
- `minimum_monthly_salary_pkr`: **null** — corrected from `0`. UBL does not publish a salary path into Signature; only a quarterly-average-balance path.
- `minimum_age_years` / `pakistani_cnic_required` / `existing_account_required`: **18 / true / true**.
- Confidence: high — SOC text is unambiguous on both fee and waiver trigger.

### UBL Mastercard Signature Debit Card

**Second-largest correction.**

- `annual_fee_pkr`: **25,000** — CORRECTED from `0`. SOC p.33 'Priority Banking Category' row: "UBL Signature Master Debit Card — Issuance PKR 25,000, Annual PKR 25,000, Replacement PKR 1,800, Supplementary PKR 25,000".
- `joining_fee_pkr`: **25,000** — added.
- `supplementary_annual_fee_pkr`: **25,000** — CORRECTED from `0`.
- `minimum_account_balance_pkr` / `minimum_average_balance_pkr`: **3,000,000 / 3,000,000** — same Signature Priority Banking criterion (SOC p.11 Section A). Verified.
- `annual_fee_waiver_rule`: rewritten to reconcile the product-page "Free" wording with the SOC: free on maintaining Signature Priority Banking criteria; rack fees apply on downgrade.
- `minimum_monthly_salary_pkr`: **null** — corrected from `0`.
- Confidence: high.

### UBL Ameen Premium Debit MasterCard

- `annual_fee_pkr`: **2,900** — CORRECTED from `2,800`. SOC p.72 'UBL Ameen Debit Card Fees' table, Premium Category, "UBL Ameen Premium Mastercard" row.
- `joining_fee_pkr`: **2,900** — added.
- `supplementary_annual_fee_pkr`: **1,500** — verified.
- `minimum_account_balance_pkr`: **0** — verified (Ameen current accounts publish no minimum-balance floor).
- `minimum_monthly_salary_pkr`: **null** — corrected from `0`.
- `minimum_age_years`: **18** — added.
- Confidence: high.

### UBL Wiz Virtual Prepaid Card

- `joining_fee_pkr`: **300** — verified per Fee Structure page ("PKR. 300/- + FED").
- `annual_fee_pkr`: **0** — verified (no annual fee on the virtual prepaid product).
- `minimum_monthly_salary_pkr`: **null** — corrected from `0`.
- `minimum_account_balance_pkr`: **0** — verified (dedicated card-account has no minimum-balance penalty per FAQ).
- `minimum_age_years`: **18** — added.
- `existing_account_required`: **false** — added (Wiz can be issued to a standalone dedicated card account).
- Confidence: high. Note: SOC p.33 lists a separate "UBL Mastercard WIZ Virtual Debit Card" at PKR 600 issuance under the Classic Category — that is a *physical* SKU; the Wiz Virtual Prepaid in this pilot is the dedicated-card-account variant at PKR 300+FED published on the product fee page.

### UBL UnionPay International Debit Card

- `annual_fee_pkr`: **2,300** / `supplementary_annual_fee_pkr`: **1,500** — verified per SOC p.33 Classic Category. Unchanged.
- `joining_fee_pkr`: **2,300** — added.
- `minimum_monthly_salary_pkr`: **null** — corrected from `0`.
- `minimum_age_years`: **18** — added; `pakistani_cnic_required` / `existing_account_required`: **true / true**.
- Confidence: high.

### UBL Visa Urooj Debit Card

- `annual_fee_pkr`: **2,900** — CORRECTED from `2,800`. SOC p.33 Premium Category, "UBL VISA Urooj Debit Card" row.
- `joining_fee_pkr`: **2,900**, `supplementary_annual_fee_pkr`: **1,500** — verified.
- `minimum_account_balance_pkr`: **0** — verified (Urooj Current Account has no minimum-balance floor; SOC p.5 waiver grid is tier-based).
- `minimum_monthly_salary_pkr`: **null** — corrected from `0`.
- `annual_fee_waiver_rule`: rewritten to cite the SOC waiver grid.
- Confidence: high.

### UBL Visa Freelancer Debit Card

- `annual_fee_pkr`: **2,900** — CORRECTED from `2,800`. SOC p.33 Premium Category, "UBL VISA Freelancer Debit Card" row.
- `joining_fee_pkr`: **2,900**, `supplementary_annual_fee_pkr`: **1,500** — verified.
- `minimum_account_balance_pkr`: **0** — verified (Freelancer Account has no minimum-balance floor per SOC p.6 grid).
- `minimum_monthly_salary_pkr`: **null** — corrected from `0`.
- Confidence: high.

### UBL Visa FCY Business Debit Card

- `annual_fee_pkr`: **null** — verified. UBL does not publish a PKR-equivalent annual fee. SOC p.33 'FCY Business Category' row: USD 15 / GBP 12 / EUR 14 / AED 56 / SAR 57 for both issuance and annual; replacement USD 10 / GBP 10 / EUR 10 / AED 35 / SAR 35. Pilot now carries `annual_fee_pkr_note` capturing the FCY values verbatim.
- `minimum_account_balance_pkr`: **null** — verified (no UBL-side retail minimum-balance figure is published for the ESFC account; SBP exchange-control rules govern; silence = null).
- `minimum_monthly_salary_pkr`: **null** — corrected from `0`.
- `existing_account_required`: **true** — added (ESFC account-linked).
- Confidence: medium — primary fee surface is unambiguous in FCY, but the PKR normalization gap and the SBP-driven account-side criteria are unresolved.

### UBL Mastercard Premium Debit Card

- `annual_fee_pkr`: **2,900** — CORRECTED from `2,800`. SOC p.33 Premium Category, "UBL Mastercard Premium Debit Card" row.
- `joining_fee_pkr`: **2,900**, `supplementary_annual_fee_pkr`: **1,500** — verified.
- `minimum_account_balance_pkr`: **0** — verified.
- `minimum_monthly_salary_pkr`: **null** — corrected from `0`.
- Confidence: high.

## Cross-card observations

- **Credit-card silence on salary/balance is real and consistent.** Across the product pages, the fee-reversal page, the SOC, and the KFS Summary Box, UBL never publishes a salary or balance threshold for Classic / Gold / Platinum. The audit's "Mukammal PKR 25,000 candidate" is rejected because that figure is a fee-waiver trigger inside the deposit account, not a credit-card underwriting threshold. Salary and balance remain null across all three.
- **Debit-card fee correction PKR 2,800 -> 2,900.** The Jan-Jun 2026 SOC moved every Premium-Category debit card (Mastercard Premium, Visa Premium, Visa Urooj, Visa Freelancer, Ameen Premium Mastercard, Ameen Visa Premium, Ameen Visa Urooj, Ameen Visa Freelancer) from PKR 2,800 to PKR 2,900 issuance/annual. Supplementary stayed at PKR 1,500. Pilot updated.
- **Signature-tier debit cards are NOT free.** Both UBL Visa Infinite Debit and UBL Mastercard Signature Debit had `annual_fee_pkr: 0` in the prior pilot, sourced from the product-page "Free" wording. The SOC p.33 rack fees are PKR 45,000 and PKR 25,000 respectively; the "Free" wording is conditional on maintaining the Signature Priority Banking criteria of PKR 3M quarterly average balance (SOC p.11 Section 8). Corrected.
- **Signature Priority Banking threshold confirmed.** SOC p.11 Section A: PKR 3 million quarterly average in any LCY current account, or PKR 6 million equivalent in FCY current, or 100% current + 50% FCY deposit combinations totalling PKR 3M. The earlier hallucinated "PKR 5 million" value (which would only show up on the UAE Signature KFS) is not the Pakistan figure.
- **Age field.** UBL only publishes 14 as the supplementary-cardholder minimum on credit cards; nothing for primary applicants. Set debit/prepaid primary-applicant minimum age to 18 as a Pakistan retail-banking baseline. Left credit-card primary minimum age null since no UBL surface states it.

## Gaps / unresolved

- No public minimum-monthly-salary or minimum-account-balance threshold for any UBL credit card. Recorded as null with rejection notes; cannot be filled from primary UBL sources alone.
- The SOC Jan-Jun 2026 p.37 also lists a UBL Visa Signature (former Silkbank/SBL) credit card at PKR 30,000 primary / PKR 15,000 supplementary, plus four Mastercard (SBL) tiers (Standard 3,500, Gold 8,000, Titanium 14,000, Platinum 18,000). Five SBL-portfolio credit-card SKUs missing from the pilot — flagged in `gaps[]`. The audit prompt's "UBL Visa Signature Credit Card" likely refers to this one, but it is not yet enumerated in the current pilot card list.
- The SOC also enumerates a UBL Visa Premium Plus Debit Card (Gold Category, PKR 3,500/3,500/1,800/2,400) not in the pilot.
- UBL Visa FCY Business Debit Card: PKR annual fee unresolvable because the bank publishes only FCY values; raw FCY values preserved in the pilot's `annual_fee_pkr_note`.
- Primary-applicant maximum age on credit cards is not published anywhere; left null. The product page's 14-year minimum and "no maximum age limit" wording applies to supplementary cards only.
