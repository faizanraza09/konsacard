# HBL Islamic Bank Limited — Verification Log (2026-05-25)

**Bank slug:** `hbl-islamic`
**Pilot file:** `data/card-requirements/work/hbl-islamic-pilot.json`
**Cards in scope:** 8

## Sources consulted

- https://www.hbl.com/islamic/islamic-cards/islamic-debit-card/debitcards-overview — Islamic debit card overview, lists product family (PayPak, Mastercard, Visa, UnionPay, Gold, World).
- https://www.hbl.com/islamic/islamic-cards/islamic-debit-card/hbl-islamic-paypak-debitcard — PayPak product page (no fee table; defers to ISOBC).
- https://www.hbl.com/islamic/islamic-cards/islamic-debit-card/hbl-islamic-classic-debitcard-mastercard-visa-unionpay — Mastercard Standard / Visa / UnionPay Classic product page.
- https://www.hbl.com/islamic/islamic-cards/islamic-debit-card/hbl-islamic-gold-debitcard — Gold product page.
- https://www.hbl.com/islamic/islamic-cards/islamic-debit-card/hbl-islamic-world-debitcard — World product page.
- https://www.hbl.com/islamic/islamic-cards/islamic-debit-card/hbl-islamic-business-debitcard — Business Classic + Business World page (states Business Classic free for life, Business World first year free / PKR 22,000 thereafter with partial waivers).
- https://www.hbl.com/islamic/islamic-cards/islamic-debit-card/hbl-world-islamic-business-debitcard — World Business product page (same disclosure).
- https://www.hbl.com/prestige/prestige-experience — Prestige eligibility page: Islamic Current/Saving Rs. 5,000,000 quarterly average; RDA USD 50,000.
- https://www.hbl.com/prestige/islamic-prestige/islamic-prestige-cards/hbl-islamic-world-elite-debitcard — Islamic Prestige World Elite page: "Free issuance and renewal" and "Free card replacements".
- https://www.hbl.com/assets/documents/ISOBC_January_to_June_2026_-_English_Web.pdf — Islamic Schedule of Bank Charges, Jan–Jun 2026, Part M (Debit Cards, page 17), Part M footnotes (page 18).
- https://www.hbl.com/islamic/islamic-accounts/islamic-current/hbl-islamic-currentaccount — HBL Islamic Current Account ("No minimum balance requirement").
- https://www.hbl.com/islamic/islamic-accounts/islamic-saving/hbl-islamic-plsaccount — HBL Islamic PLS Saving Account ("No minimum balance requirement").
- https://www.hbl.com/islamic/islamic-accounts/islamic-current/hbl-islamic-asaanaccount — Islamic Asaan Account (no minimum balance; max credit balance Rs. 3,000,000).
- https://www.hbl.com/personal/accounts/hbl-nisa/hbl-nisa-tawfir-islamic-savings-account — Nisa Tawfir Islamic Saving (no minimum to open; takaful tied to PKR 35,000 average from year 2).

Attempted but absent:
- https://www.hbl.com/islamic/islamic-cards/islamic-debit-card/hbl-islamic-titanium-debitcard — 404; HBL does not publish a standalone Islamic Titanium debit-card product page.
- https://www.hbl.com/prestige/islamic-prestige/islamic-prestige-saving-accounts/hbl-al-mukhtar — 404.

## Card-by-card verification

### HBL Islamic PayPak Debit Card

- `tier`: paypak — verified.
- `minimum_monthly_salary_pkr`: **null** — corrected from `0`. Bank publishes no card-level salary threshold; per methodology rule 3, silent means null, not zero.
- `minimum_account_balance_pkr`: **null** — verified. Linked Islamic Current/PLS accounts carry no minimum balance, so card-level field is null (not zero).
- `annual_fee_pkr`: **2000** — verified against ISOBC Jan–Jun 2026 (Part M, page 17): "PayPak Chip - Rs. 2,000/-".
- `supplementary_annual_fee_pkr`: **0** — verified: "PayPak Chip - Nil" in supplementary fee column.
- `annual_fee_waiver_rule`: **kept** — verbatim from ISOBC footnote (iii), page 18.
- `pakistani_cnic_required`: **true** — added. CNIC is required at Islamic account opening per the Islamic Current/Saving pages.
- `existing_account_required`: **true** — added. Card is issued through account-opening or additional-request form.
- Confidence: medium — fees clean; salary/balance intentionally absent from bank disclosure.

### HBL Islamic Mastercard Standard Debit Card

- `tier`: classic — verified.
- `minimum_monthly_salary_pkr`: **null** — corrected from `0`.
- `minimum_account_balance_pkr`: **null** — verified.
- `annual_fee_pkr`: **3000** — verified against ISOBC (Mastercard Standard - Rs. 3,000/-).
- `supplementary_annual_fee_pkr`: **550** — verified (Mastercard Standard - Rs. 550/-).
- `annual_fee_waiver_rule`: **tightened** — combined ISOBC footnotes (i) Nisa Tawfir first-year waiver and (iv) free Mastercard Standard for HBL @ Work Islamic Premium; both quoted verbatim from page 18.
- `pakistani_cnic_required` / `existing_account_required`: **true** — added.
- Confidence: medium.

### HBL Islamic Mastercard Gold Debit Card

- `tier`: gold — verified.
- `minimum_monthly_salary_pkr`: **null** — corrected from `0`.
- `minimum_account_balance_pkr`: **null** — verified.
- `annual_fee_pkr`: **3800** — verified against ISOBC (Mastercard Gold - Rs. 3,800/-). Matches HBL Conventional Gold primary annual fee in the parallel SOBC.
- `supplementary_annual_fee_pkr`: **null** — verified (ISOBC marks Gold supplementary as N/A).
- `annual_fee_waiver_rule`: **added** — ISOBC footnote (ii): Nisa Plus / Nisa Saving customers can pick Classic or Gold at account opening with first-year issuance waived. (Previous field was null.)
- `pakistani_cnic_required` / `existing_account_required`: **true** — added.
- Confidence: medium.

### HBL Islamic World Debit Card

- `tier`: world — verified.
- `minimum_monthly_salary_pkr`: **null** — corrected from `0`.
- `minimum_account_balance_pkr`: **null** — verified.
- `annual_fee_pkr`: **20000** — verified against ISOBC (Mastercard World - Rs. 20,000/-).
- `supplementary_annual_fee_pkr`: **null** — verified (N/A in ISOBC).
- `annual_fee_waiver_rule`: **null** — verified; no World-specific waiver is printed in the ISOBC.
- `pakistani_cnic_required` / `existing_account_required`: **true** — added.
- Confidence: medium.

### HBL Islamic Business DebitCard

- `tier`: business — verified.
- `minimum_monthly_salary_pkr`: **null** — corrected from `0`.
- `minimum_account_balance_pkr`: **null** — verified. The linked Islamic business account (Al-Mukhtar / business current) does not publish a minimum-balance threshold on the public page.
- `annual_fee_pkr`: **0** — verified. ISOBC footnote (v): "Master Business Classic: The Issuance and Annual fee is 100% waived". Product page confirms "Business Classic Debit Card: Free for life".
- `annual_fee_waiver_rule`: **tightened** to cite both the ISOBC footnote and the product page wording.
- `existing_account_required`: **true** — verified (card restricted to PKR Islamic business accounts; Proprietorship / Single Member Company only).
- `pakistani_cnic_required`: **true** — added.
- Confidence: medium.

### HBL World Islamic Business DebitCard

- `tier`: world-business — verified.
- `minimum_monthly_salary_pkr`: **null** — corrected from `0`.
- `minimum_account_balance_pkr`: **null** — verified.
- `annual_fee_pkr`: **22000** — verified against ISOBC (Mastercard Business World - Rs. 22,000/-).
- `annual_fee_waiver_rule`: **tightened** — quotes ISOBC footnote (v): issuance 100% waived, annual fee 50% charged (effective Rs. 11,000). Product page mirrors this with "first year free; PKR 22,000 from year 2 with partial fee waivers".
- `existing_account_required`: **true** — verified.
- `pakistani_cnic_required`: **true** — added.
- Confidence: medium.

### HBL Islamic Prestige World Elite DebitCard

- `tier`: world-elite — verified.
- `minimum_monthly_salary_pkr`: **null** — corrected from `0`; no salary threshold is published.
- Balance field: **renamed** from `minimum_account_balance_pkr: 5000000` to `minimum_relationship_balance_pkr: 5000000`. Source: HBL Prestige Experience page — Islamic Current/Saving quarterly-average AUM of Rs. 5,000,000 (or equivalent foreign currency); RDA route USD 50,000. The number is published at the Prestige proposition / relationship level, not on the card itself, so the relationship-balance key is the correct field per methodology.
- `annual_fee_pkr`: **0** — verified. Product page: "Free issuance and renewal" and "Free card replacements" for Islamic Prestige members.
- `annual_fee_waiver_rule`: **tightened** verbatim from product page.
- `existing_account_required`: **true** — verified (card only issued to Islamic Prestige members).
- `pakistani_cnic_required`: **true** — added.
- Confidence: high.

### HBL Islamic Titanium DebitCard

- `tier`: titanium — verified at the ISOBC fee-row level only.
- `minimum_monthly_salary_pkr`: **null** — corrected from `null`/legacy; verified absent.
- `minimum_account_balance_pkr`: **null** — verified.
- `annual_fee_pkr`: **3000** — verified against ISOBC (Mastercard Titanium - Rs. 3,000/-).
- `supplementary_annual_fee_pkr`: **700** — added; ISOBC lists Mastercard Titanium supplementary annual fee at Rs. 700.
- `annual_fee_waiver_rule`: **null** — verified.
- `pakistani_cnic_required` / `existing_account_required`: **true** — added.
- Confidence: **low** (downgraded from medium) — there is no public Islamic Titanium product page on hbl.com (the URL returns 404). The tier exists only as a row in the ISOBC fee schedule, which makes it unclear whether the product is actively issued under the Islamic franchise or is reserved for cross-sale to existing customers.

## Cross-card observations

- HBL Islamic does NOT publish a salary or minimum-balance threshold for any consumer Islamic debit card. The card product pages explicitly defer fees to the ISOBC, and the ISOBC does not encode eligibility thresholds — only fees. Per the verification methodology, the correct value for both salary and balance on these cards is `null`, not `0`.
- All HBL Islamic debit cards are issued against an existing Islamic account (account-opening form or additional-request form), so `existing_account_required: true` is universal for this bank.
- HBL Islamic consumer accounts (Islamic Current, PLS Saving, Asaan, Nisa Tawfir variants) themselves carry no published minimum balance, so the linked-account inheritance route does not introduce a balance threshold either. This is a structural difference from HBL Conventional, where the Conventional Current Account publishes a PKR 40,000 monthly average balance that is inherited by conventional debit cards.
- The only published balance figure in the HBL Islamic universe is the Prestige proposition threshold (PKR 5,000,000 quarterly-average AUM in Islamic Current/Saving, or USD 50,000 RDA), which the Prestige World Elite card inherits.
- The audit observation that 7 of 8 cards are missing a balance value is therefore expected behaviour, not a data gap. The cards correctly carry `null` and the bank-level `gaps[]` array now documents the reason explicitly.

## Gaps / unresolved

- Titanium tier exists only in the ISOBC fee row; no consumer-facing Islamic Titanium product page is published on hbl.com.
- No HBL Islamic consumer credit-card catalogue was found on hbl.com in this pass (HBL credit cards are all under the conventional franchise).
- Age thresholds are not published for any HBL Islamic debit card.
