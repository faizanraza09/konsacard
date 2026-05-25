# MCB Islamic Bank Ltd — Verification Log (2026-05-25)

**Bank slug:** `mcb-islamic`
**Pilot file:** `data/card-requirements/work/mcb-islamic-pilot.json`
**Cards in scope:** 5 (all debit; no consumer credit-card catalogue published by MCB Islamic)

## Sources consulted

- https://www.mcbislamicbank.com/Documents/MCB-ISLAMIC-SOBC-January-June%202026.pdf
  — Jan-Jun 2026 Schedule of Bank Charges. Authoritative card-fee table is on
  page 28 (Section O.4, MCB Islamic Debit Card / UnionPay / PayPak / Visa).
  Shandaar Account package and waivers on page 25 (entry 22). Prime Account
  Platinum waivers on page 24 (entry 21). PayFlex eligibility on page 26
  (entry 23).
- https://www.mcbislamicbank.com/investor-relations/schedule-of-charges/
  — Index page listing the 2025 and 2026 SOBC PDFs.
- https://www.mcbislamicbank.com/personal/digital-banking/debit-cards/unionpay-cards/
  — UnionPay / PayPak debit-card overview (Qadar Classic, Qadar Gold, Platinum,
  PayPak Classic).
- https://www.mcbislamicbank.com/personal/digital-banking/debit-cards/visa-cards/
  — Visa debit-card index (Classic, Gold, Platinum, Niswaan, Junior, FCY, FCY
  Business). Only Visa Classic is in scope for this pilot.
- https://www.mcbislamicbank.com/personal/digital-banking/debit-cards/visa-cards/visa-classic/
  — Visa Classic product page (eligibility + PKR 3,400 + FED issuance/annual/replacement).
- https://www.mcbislamicbank.com/personal/digital-banking/debit-cards/visa-cards/visa-platinum/
  — Used to confirm Platinum-tier waiver mechanics (quarterly renewal, PKR 3M
  preceding-90-day average).
- https://www.mcbislamicbank.com/personal/digital-banking/debit-cards/visa-cards/visa-gold/
  — Visa Gold reference (PKR 4,150 + FED). Not in scope for this pilot but used
  to triangulate the SOBC card-fee table.
- https://www.mcbislamicbank.com/personal/products/saving-accounts/shandaar-account/
  — Shandaar (linked) account page. Initial deposit nil; free debit-card
  issuance/annual/renewal for non-Platinum variants only under the Criteria-A
  (PKR 25K opening-month deposit) / Criteria-B (PKR 25K previous-month average
  balance) framework — note that the SOBC text restricts the free-issuance
  benefit to PayPak / UPI Classic / UPI Gold first-issuance only and does not
  in fact waive renewal/annual on those variants.
- https://www.mcbislamicbank.com/personal/products/current-accounts/asaan-current-account/
  — Asaan Current Account (PKR 100 initial deposit, no minimum balance).
- https://www.mcbislamicbank.com/personal/products/personal-digital-account/mcb-islamic-asaan-digital-current-account/
  — Asaan Digital Current Account (PKR 100 initial deposit; CNIC-only opening).

## Card-by-card verification

### MCB Islamic Qadar Classic Debit Card

- `card_type` / `tier`: debit / classic — verified.
- `minimum_monthly_salary_pkr`: **null** — corrected from `0`. Public sources
  publish no salary requirement; per methodology silence becomes null, not 0.
- `minimum_account_balance_pkr`: **null** — corrected from `0`. No card-level
  balance is published.
- `annual_fee_pkr`: **3250** — **corrected from 2,600**. Source: Jan-Jun 2026
  SOBC p.28, UnionPay Debit Card table (PKR 3,250 + FED for new / renewal /
  replacement). Also matches the live UnionPay product page.
- `annual_fee_waiver_rule`: rewritten to reflect SOBC entry 22 (Shandaar
  first-issuance only) and entry 23 (PayFlex Premier/Grand/Executive).
- `minimum_age_years` / `maximum_age_years`: null — bank does not publish per-card
  age limits.
- `income_document_required`: null — not separately published from
  account-opening docs.
- `salary_transfer_required`: false — not a card requirement.
- `pakistani_cnic_required`: true — implied by Resident-Pakistani account
  framework; cards are account-linked.
- `existing_account_required`: true — Qadar UnionPay cards are linked to an
  MCB Islamic PKR account per the product page.
- Confidence: high. Fee number is directly from the SOBC PDF.

### MCB Islamic Qadar Gold Debit Card

- `card_type` / `tier`: debit / gold — verified.
- `minimum_monthly_salary_pkr`: **null** — corrected from `0`.
- `minimum_account_balance_pkr`: **null** — corrected from `0`.
- `annual_fee_pkr`: **4000** — **corrected from 3,200**. Source: Jan-Jun 2026
  SOBC p.28, UnionPay Debit Card table (PKR 4,000 + FED). Matches live UnionPay
  product page.
- `annual_fee_waiver_rule`: same Shandaar-first-issuance + PayFlex rewrite
  as Qadar Classic.
- Age / income-doc / salary-transfer / CNIC / existing-account: same as Qadar
  Classic.
- Confidence: high.

### MCB Islamic Platinum Debit Card

- `card_type` / `tier`: debit / platinum — verified.
- `minimum_monthly_salary_pkr`: **null** — corrected from `0`.
- `minimum_account_balance_pkr`: **1,000,000** — **corrected from `0`**. SOBC
  Platinum Debit Card Renewal Criteria (page 24 and page 28 notes) require a
  minimum account balance of PKR 1,000,000 to be issued and a 90-day average of
  PKR 1,000,000 to continue; otherwise the card is downgraded.
- `annual_fee_pkr`: **9600** — **corrected from 7,750**. Source: Jan-Jun 2026
  SOBC p.28, UnionPay Debit Card table (PKR 9,600 + FED).
- `annual_fee_waiver_rule`: rewritten — Prime-account waiver (PKR 3M monthly
  average in any 6 of previous 12 months). Shandaar waiver explicitly excludes
  Platinum (SOBC entry 22).
- Age / income-doc / salary-transfer / CNIC / existing-account: same defaults
  as other UnionPay cards.
- Confidence: high.

### MCB Islamic PayPak Classic Debit Card

- `card_type` / `tier`: debit / other — verified.
- `minimum_monthly_salary_pkr`: **null** — corrected from `0`.
- `minimum_account_balance_pkr`: **null** — corrected from `0`.
- `minimum_deposit_pkr`: **100** — verified. Inherits from Asaan Current /
  Asaan Digital Current account pages (PKR 100 initial deposit).
- `annual_fee_pkr`: **2750** — **corrected from 2,200**. Source: Jan-Jun 2026
  SOBC p.28, PayPak Debit Card section (PKR 2,750 + FED). Matches live UnionPay
  / PayPak overview page.
- `annual_fee_waiver_rule`: rewritten with Shandaar first-issuance + PayFlex
  detail; previous wording incorrectly implied a recurring annual/renewal
  waiver under Shandaar.
- Age / income-doc / salary-transfer / CNIC / existing-account: same defaults.
- Confidence: high.

### MCB Islamic Visa Classic Debit Card

- `card_type` / `tier`: debit / classic — verified.
- `minimum_monthly_salary_pkr`: **null** — corrected from `0`.
- `minimum_account_balance_pkr`: **null** — corrected from `0`.
- `annual_fee_pkr`: **3400** — **corrected from 2,950**. Source: Jan-Jun 2026
  SOBC p.28, MCB Islamic Visa Debit Card table (Classic = PKR 3,400 for
  issuance / renewal / replacement). Matches the live Visa Classic product
  page (PKR 3,400 + FED) and the Visa overview page.
- `annual_fee_waiver_rule`: rewritten — Shandaar-VDC reversal explicit in
  SOBC entry 22: PKR 100K monthly average for 3 months from issuance, first
  issuance only (annual/renewal still charged). The previous waiver wording
  (PKR 25K Shandaar criteria) was specific to non-Visa variants and was
  inaccurate for Visa Classic.
- Age / income-doc / salary-transfer / CNIC / existing-account: same defaults.
- Confidence: high.

## Cross-card observations

- MCB Islamic publishes a single SOBC-driven debit-card fee schedule that
  cleanly separates UnionPay / PayPak fees from Visa fees. Every debit card in
  this pilot's scope appears on page 28 of the Jan-Jun 2026 SOBC; this is
  authoritative.
- Shandaar Account waivers are narrower than the prior pilot suggested. They
  cover **first-issuance only** for PayPak / UPI Classic / UPI Gold (annual
  and renewal still charged), and have a **separate, balance-driven reversal
  path** for Visa Classic / Visa Gold (PKR 100K monthly average for 3 months).
- Prime Account is the relevant package for waiving Platinum debit-card fees;
  PayFlex Employee-Banking packages waive UPI Classic / UPI Gold / PayPak
  fees subject to salary tiering (25K / 100K / 250K thresholds).
- All MCB Islamic debit cards are account-linked; cards are issued against
  singly operated PKR accounts. CNIC and Pakistani residency are required at
  the account level.
- Previous pilot fees (PKR 2,600 / 3,200 / 7,750 / 2,200 / 2,950) appear to
  date to a pre-2025 SOBC edition. All five have been corrected upward to the
  Jan-Jun 2026 numbers.

## Gaps / unresolved

- MCB Islamic has no consumer credit-card catalogue on its public site (only
  debit cards), so no credit-card requirements can be verified.
- No public per-card minimum monthly salary or age threshold is published
  for any of the in-scope cards; salary and age fields are left null per
  methodology.
- `income_document_required` is left null for all cards — the bank's
  account-opening documentation list is referenced behind PDFs (Annexure A)
  that were not in scope for this card-requirement pass.
