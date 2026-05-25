# Habib Metropolitan Bank — Verification Log (2026-05-25)

**Bank slug:** `habib-metro`
**Pilot file:** `data/card-requirements/work/habib-metro-pilot.json`
**Cards in scope:** 8 (was 8 — same count; one card renamed from "Visa Signature Debit Card" to "Business Debit Card" after source review)

## Sources consulted

- https://www.habibmetro.com/digital-banking/cards/visa-debit-card/ — consumer Visa debit-card overview (Classic, Gold, Platinum, Infinite, Business, Ladies, PayPak). Lists tiered annual fees and Platinum 3M-balance eligibility.
- https://www.habibmetro.com/digital-banking/cards/visa-infinite-debit-card/ — Visa Infinite Metal Debit Card product page. States PKR 100 MN relationship balance and invitation-only issuance.
- https://www.habibmetro.com/digital-banking/cards/paypak-debit-card/ — PayPak product page. Annual fee Rs. 2,200; balance required: None; local-only.
- https://www.habibmetro.com/digital-banking/cards/fcy-debit-card/ — Foreign-currency Visa debit card. Linked to Freelancer / ESFCA accounts.
- https://www.habibmetro.com/digital-banking/cards/business-debit-card/ — Business Debit Card, described as "a Signature Business variant powered by Visa". PKR 16,000 fee.
- https://www.habibmetro.com/information-center/schedule-of-charges/ — SOC landing page; lists 2026 H1 and 2025 H2 PDFs.
- https://www.habibmetro.com/habibmetro/2026/01/SOC-Jan-to-Jun-Eng-2026-Dec-30.pdf — Schedule of Charges 1 Jan to 30 Jun 2026 (English). Authoritative source for all card fees. Sections 7 (PayPak), 8 (Visa Debit Card incl. Business and Infinite), 9 (FCY Visa Debit Card), 11 (Mera Mustaqbil), 12 (HABIBMETRO Ladies Debit Card).

## Card-by-card verification

### Visa Platinum Debit Card

- `card_type` / `tier`: debit / platinum — verified.
- `minimum_monthly_salary_pkr`: **null** — corrected from `0`. SOC and product page are silent on salary; the Platinum gate is balance, not salary. Per methodology, silence => null.
- `minimum_average_balance_pkr`: **3,000,000** — verified. SOC section 8 footnote: "ELIGIBILITY CRITERIA FOR PLATINUM DEBIT CARD: 3 MILLION AVERAGE BALANCE FOR LAST 3 MONTHS".
- `annual_fee_pkr`: **7,500** — verified. SOC section 8 row (a) Platinum column.
- `supplementary_annual_fee_pkr`: **7,500** — added. SOC section 8: "SUPPLEMENTARY CARDS FEE WILL BE THE SAME AS THOSE OF PRIMARY CARDS".
- `annual_fee_waiver_rule`: **null** — verified; no waiver published.
- `minimum_age_years` / `maximum_age_years`: null / null — not published.
- `pakistani_cnic_required`: true — consumer card on a Pakistan-domiciled account.
- `existing_account_required`: true — account-linked debit card.
- `income_document_required` / `salary_transfer_required`: null — not published.
- Confidence: high — SOC + product-page agree.

### Visa Gold Debit Card

- `minimum_monthly_salary_pkr`: **null** — corrected from `0`. Not published.
- `minimum_account_balance_pkr`: **null** — corrected from `0`. Product page states "no minimum balance" only on the consumer marketing page; treated as null because the linked-account threshold (not stated) is what actually governs.
- `annual_fee_pkr`: **4,400** — verified. SOC section 8 Gold column.
- `supplementary_annual_fee_pkr`: **4,400** — added per SOC supplementary clause.
- `annual_fee_waiver_rule`: null — verified.
- Confidence: high.

### Visa Classic Debit Card

- `minimum_monthly_salary_pkr`: **null** — corrected from `0`.
- `minimum_account_balance_pkr`: **null** — corrected from `0`. Inherits from linked account, which is not specified on the card page.
- `annual_fee_pkr`: **3,300** — verified. SOC section 8 Premium/Classic column.
- `supplementary_annual_fee_pkr`: **3,300** — added.
- `annual_fee_waiver_rule`: null — verified.
- Confidence: high.

### Visa Infinite Debit Card

- `minimum_monthly_salary_pkr`: **null** — corrected from `0`.
- `minimum_relationship_balance_pkr`: **100,000,000** — verified. Product page: "Account holders maintaining a relationship balance of PKR 100 MN and above".
- `minimum_account_balance_pkr`: 100,000,000 — kept as parallel key consistent with the normalized output.
- `annual_fee_pkr`: **35,000** — verified. SOC section 8 Visa Infinite Metal Debit Card column.
- `supplementary_annual_fee_pkr`: **35,000** — added per SOC.
- `annual_fee_waiver_rule`: **"Annual fee for additional spouse card is waived for Priority Banking customers."** — kept from prior pilot; product page references the Priority Banking spouse-card waiver. Confidence: medium for the waiver string (taken from the previous pass).
- Confidence: high overall.

### PayPak Debit Card

- `minimum_monthly_salary_pkr`: **null** — corrected from `0`.
- `minimum_account_balance_pkr`: **null** — corrected from `0`. Product page says "Balance required: None"; we treat that as null because the linked-account requirement is undisclosed and the card cannot be issued without an account.
- `annual_fee_pkr`: **2,200** — verified. SOC section 7 (a).
- `supplementary_annual_fee_pkr`: **2,200** — added.
- Confidence: high.

### Foreign Currency Visa Debit Card

- `minimum_monthly_salary_pkr`: **null** — corrected from `0`.
- `minimum_account_balance_pkr`: null — verified; no public threshold for ESFCA / Freelancer FCY accounts.
- `annual_fee_pkr`: **3,300** — verified for the FCY Premium/Classic tier (SOC section 9). FCY Gold is PKR 4,400; FCY Platinum is PKR 7,500 with the same 3M average-balance footnote.
- `supplementary_annual_fee_pkr`: **3,300** — added.
- Confidence: medium — because the product page does not specify which FCY tier the customer gets by default; we use Classic.

### Visa Ladies Debit Card

- `minimum_monthly_salary_pkr`: **null** — corrected from `0`.
- `minimum_account_balance_pkr`: **null** — corrected from `0`.
- `annual_fee_pkr`: **3,300** — corrected from prior value retained at 3,300 (no change). The Visa-debit-card marketing page lists Rs. 2,200 from year 2, but the SOC section 12 ("HABIBMETRO LADIES DEBIT CARD") says PKR 3,300 for subsequent years; SOC wins.
- `annual_fee_waiver_rule`: **"Free for the first year; PKR 3,300 for subsequent years."** — corrected to be a complete one-sentence rule referencing the subsequent-year fee from SOC.
- Confidence: high (SOC) — conflict with marketing page is noted in card.notes[].

### Business Debit Card (was "Visa Signature Debit Card" in prior pilot)

- **Renamed from "Visa Signature Debit Card" to "Business Debit Card".** The previous pilot used a "Visa Signature Debit Card" label with PKR 16,000 and a 3M-balance fee waiver. The Visa-debit-card overview page and SOC list this as the "Business Debit Card" — a Signature Business variant of Visa intended for Business Entity / Private & Public Limited / Partnership accounts, not a consumer Signature debit card.
- `card_type` / `tier`: debit / business.
- `minimum_monthly_salary_pkr`: **null** — corrected from `null` (kept). Not a consumer salary-driven card.
- `minimum_account_balance_pkr`: **null** — corrected from `3,000,000`. The 3M balance and "PKR 3M for 3 months" waiver rule from the prior pilot were not found on the current Business Debit Card product page or SOC and are removed.
- `annual_fee_pkr`: **16,000** — verified. SOC section 8 Business Debit Card column.
- `supplementary_annual_fee_pkr`: **16,000** — added per SOC.
- `annual_fee_waiver_rule`: **null** — corrected from "Waived if PKR 3,000,000 average balance maintained for 3 months". That waiver text was not substantiated by the SOC or current Business Debit Card page.
- Confidence: high.

## Cross-card observations

- Habib Metro does not publish minimum-salary thresholds for any debit card. All consumer debit cards are gated on the linked account; the only explicit on-card balance gate is Platinum (PKR 3M 3-month avg) and Infinite (PKR 100M relationship). Convention applied: salary => null unless a number is printed.
- "Visa Signature" does not exist as a consumer debit card at Habib Metro. The Signature trademark appears on the corporate "Business Debit Card". Any prior code references to a Habib Metro Visa Signature consumer card should map to the Business Debit Card.
- SOC section 8 supplementary clause was applied consistently: `supplementary_annual_fee_pkr` = primary fee for every Visa Debit Card variant (Classic, Gold, Platinum, Business, Infinite) and propagated to PayPak / Ladies / FCY where they follow the same convention.
- All cards require a Habib Metro account (existing_account_required = true) and Pakistani CNIC for the consumer variants. These were not previously populated.

## Gaps / unresolved

- No consumer credit-card catalogue surfaced on habibmetro.com in this pass; SOC section 8 covers only Visa Debit Card products. Credit cards were not in scope of the prior pilot and remain absent here.
- Age criteria (min/max) for every debit card variant remain unpublished on both product pages and SOC.
- FCY card page does not state which tier is issued by default; pilot uses Classic. If the bank issues a different tier based on FCY balance, the fee scales as documented in card.notes[].
- "Annual fee for additional spouse card is waived for Priority Banking customers" (Infinite) was retained from the prior pilot; the current product page is more focused on PKR 100M relationship eligibility than on spouse-card mechanics, so this waiver string is medium-confidence and may need a second look against the Priority Banking proposition page in a future pass.
