# Easypaisa (easypaisa Bank Ltd. / Easypaisa Digital Bank) — Verification Log (2026-05-25)

**Bank slug:** `easypaisa`
**Pilot file:** `data/card-requirements/work/easypaisa-pilot.json`
**Cards in scope:** 3 (Visa, PayPak, UnionPay)

## Sources consulted

- https://easypaisa.com.pk/debit-cards/ — official debit-cards landing page; confirms three networks (Visa, UnionPay, PayPak) and the online (virtual) Visa variant.
- https://easypaisa.com.pk/schedule-of-charges/ — index listing the two current SOC PDFs (Branchless Banking and Retail Banking).
- https://easypaisa.com.pk/public-information/Schedule-of-Bank-Charges/Schedule-of-Bank-Charges-Branchless-Banking-English.pdf — Branchless Banking SOC, April 2026 to June 2026; the "Debit Card Issuance" row on p.4 (Digital Value-Added Services) lists the per-network issuance fees.
- https://easypaisa.com.pk/public-information/Schedule-of-Bank-Charges/Schedule-of-Bank-Charges-Retail-Banking-English.pdf — Retail Banking SOC, Jan 2026 to Jun 2026; same per-card fee row appears on p.4 (printed there under the heading "Debit Card Insurance", which is a typo in the Retail SOC — the Branchless SOC unambiguously labels it "Debit Card Issuance" and the values match).
- https://easypaisa.com.pk/asaan-account/ — Asaan Account product page; PKR 100 opening balance, CNIC required, Pakistani nationality, one Asaan per CNIC.
- https://easypaisa.com.pk/my-account/ — My Account hub; lists Digital Current / Saving (transact up to Rs. 100 million, 9.5% profit, no minimum balance) and NewGEN (12-17 parent-supervised).

## Card-by-card verification

### Easy Paisa DebitCard (Visa, primary product)

- `card_type` / `tier`: debit / classic — verified.
- `minimum_monthly_salary_pkr`: **null** — corrected from `0` because no salary threshold is published anywhere on easypaisa.com.pk. Per the methodology, silence means `null`, not `0`. Source: debit-cards page and both SOC PDFs (no mention of salary).
- `minimum_account_balance_pkr`: **0** — verified. The linked easypaisa Digital Current / Saving Account on the My Account page has no minimum balance ("transact up to Rs. 100 million" with no published floor) and the New Mobile Account Opening row in both SOCs is "Rs. 0.00". Asaan Account opens at PKR 100 (an opening balance, not a maintenance floor); modeled as 0 because the default wallet path is free.
- `annual_fee_pkr`: **0** — verified. Neither SOC lists an annual or renewal fee for any easypaisa debit card. Only a one-time issuance fee is listed.
- `joining_fee_pkr`: **1000** — added. Branchless Banking SOC Apr-Jun 2026, p.4, "Debit Card Issuance" row: "Rs. 1000 (Incl. Tax) (easypaisa VISA Debit card)". Same value in the Retail SOC.
- `annual_fee_waiver_rule`: rewritten to make the issuance-vs-annual distinction explicit and cite the SOC. Source: both SOC PDFs.
- `minimum_age_years`: **18** — added (was null). Inferred from the Asaan Account / mobile-account framing: NewGEN (12-17) is explicitly parent-supervised, and Asaan Account requires a CNIC, which makes adult eligibility the standalone-card path. Not stated explicitly on the debit-cards page.
- `maximum_age_years`: **null** — verified (no upper bound published).
- `pakistani_cnic_required`: **true** — added. FAQ snippet and Asaan Account page require a valid CNIC; Asaan is restricted to Pakistani nationals.
- `existing_account_required`: **true** — added. The debit card is issued against the easypaisa mobile / digital account; there is no standalone card product.
- `income_document_required`: **false** — added. No income-document requirement is published.
- `salary_transfer_required`: **false** — added.
- Confidence: high — primary-source SOC fee table is unambiguous; eligibility inheritance is explicit on the linked account pages.

### Easy Paisa Pay Pak Debit Card

- Same structure as above. `joining_fee_pkr`: **1000** — Branchless Banking SOC: "Rs. 1000 (Incl. Tax) (easypaisa PayPak Debit card)".
- All other fields identical to the Visa variant.
- Confidence: high.

### Easy Paisa Union Pay Debit Card

- Same structure as above. `joining_fee_pkr`: **999** — Branchless Banking SOC: "Rs. 999 (Incl. Tax) (easypaisa Union Pay Debit card)". The Rs. 1 difference vs Visa/PayPak is what the bank publishes.
- All other fields identical to the Visa variant.
- Confidence: high.

## Cross-card observations

- Bank rebranded from Telenor Microfinance Bank to **easypaisa Bank Ltd.** (Easypaisa Digital Bank); both 2026 SOCs are issued under the new name. The pilot `bank_name` was updated to reflect this.
- All three card variants share identical eligibility (no salary, no balance floor, CNIC, account-linked). Only the per-network one-time issuance fee differs: Visa 1,000 / PayPak 1,000 / UnionPay 999.
- A fourth virtual variant ("easypaisa Visa Online Debit card") is listed in the SOC at Rs. 500 issuance, but it is not in the pilot card list and not in scope for this pass.
- Annual fee is universally **PKR 0** — easypaisa monetizes via the one-time issuance fee, ATM withdrawal fees, and the funding-pull markup; not via annual card fees.
- The Retail Banking SOC mis-labels the per-card fee row as "Debit Card Insurance"; the Branchless Banking SOC labels the same row "Debit Card Issuance" with identical values. Treated as a typo in the Retail SOC; issuance is the correct read.

## Gaps / unresolved

- No public minimum-salary threshold for any easypaisa card — corrected from `0` to `null` (silence is not zero).
- Minimum age is not stated explicitly on the card page; modeled as 18 by inference from the NewGEN / Asaan framing. Confidence on the age field alone is medium even though card confidence overall is high.
