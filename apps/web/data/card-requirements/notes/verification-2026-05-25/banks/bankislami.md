## BankIslami Pakistan — Verification Log (2026-05-25)

**Bank slug:** `bankislami`
**Pilot file:** `data/card-requirements/work/bankislami-pilot.json`
**Cards in scope:** 3 (Classic Debit Mastercard, PayPak Debit Card, Titanium Debit Mastercard)

## Sources consulted

- https://bankislami.com.pk/digital-channel/debitcards/ — debit-cards overview; lists three cards (Classic, PayPak, Titanium). Pure marketing copy, no figures.
- https://bankislami.com.pk/digital-channel/debitcards/classic-debit-mastercard/ — Classic product page. Descriptive only — no salary, balance, age, fee, or eligibility figures published.
- https://bankislami.com.pk/digital-channel/debitcards/paypak-debit-card/ — PayPak product page. Same: descriptive only.
- https://bankislami.com.pk/digital-channel/debitcards/titanium-debit-mastercard/ — Titanium product page. Same: descriptive only.
- https://bankislami.com.pk/wp-content/uploads/2025/12/Schedule-of-Charges-SOC-Jan-June-2026.pdf — Jan-Jun 2026 Schedule of Bank Charges PDF (33 pp). Section 4.A "Issuance / Annual Subscription & Replacement (for Cards)" on p.7 lists the three card fees. Section 11 lists BIPL staff salary-account waivers. Section 12 (Priority Banking) lists Priority Titanium waivers and the PKR 3 million quarterly-average relationship-balance criterion. Section 13 (Mashal Women Banking) lists women-banking debit-card waivers. Section 15 (Gen Z Account) lists Gen Z waivers.
- https://bankislami.com.pk/wp-content/uploads/2026/01/Schedule-of-Charges-SOC-Jan-June-2026.pdf — same PDF served from an alternate path. Both URLs resolve to identical content; kept both in sources for resilience.
- https://bankislami.com.pk/wp-content/uploads/2022/07/FAQs-Titanium-Debit-Mastercard.pdf — Titanium FAQ. Mentions no fee waiver, no balance threshold, no salary threshold.
- https://bankislami.com.pk/wp-content/uploads/2022/07/Terms-Condition-Titanium-Debit-Mastercard.pdf — Titanium T&C. Clause 1 lists eligible account holders (Individual / Joint Current or PLS Savings, and Roshan Digital). Clause 10 says cardholder pays fees per SOC, with no waiver carve-out.
- https://bankislami.com.pk/prioritybanking/ — Priority Banking overview. PKR 3 million combined relationship balance gates Priority Titanium issuance/replacement waiver.
- https://bankislami.com.pk/mashal-women-/ — Mashal Women Banking. Mashal Asaan gets 50% Classic/PayPak issuance + annual subscription discount; Mashal Saving with PKR 100,000 average balance gets free Classic/PayPak issuance + annual subscription. Titanium is not mentioned for Mashal.
- https://onboard.bankislami.com.pk/static/media/Products%20Brief%20Description%20-%20Digital%20Onboarding%20Final.f03233bc.pdf — Digital Onboarding product brief. Key finding: the "PKR 25,000 monthly average balance" figure is the **Islami Sahulat Account** "avail all free services" threshold (free chequebook / pay orders / inward clearing / internet / mobile / e-statement / one-touch), NOT a Titanium card fee waiver. The previous pilot misattributed this.

## Card-by-card verification

### Classic Debit Mastercard

- `card_type` / `tier`: debit / classic — verified.
- `minimum_monthly_salary_pkr`: **null** — corrected from `0`. The product page and SOC publish no salary threshold; per methodology silence is `null`, not `0`. Source: product page and SOC PDF.
- `minimum_account_balance_pkr`: **null** — corrected from `0`. The product page is silent; the card is account-linked, and the underlying account's balance varies (most BankIslami accounts have no minimum balance per the Digital Onboarding brief). Silence ⇒ null.
- `annual_fee_pkr`: **2900** — verified. SOC Jan-Jun 2026 p.7, section 4.A.(i): "Classic Debit Mastercard Rs. 2,900/-" for issuance / annual subscription / replacement.
- `annual_fee_waiver_rule`: **"Free for BIPL staff salary accounts (per Jan-Jun 2026 SOC, section 11)."** — added (was `null`). Source: SOC p.27, section 11 line 19: "Classic Debit Mastercard Free" for BIPL staff salary accounts. Note: Mashal and Gen Z waivers also exist but are account-segment specific.
- `minimum_age_years` / `maximum_age_years`: **null / null** — verified. Not published.
- `income_document_required`: **false** — added. Not required for a debit card per public materials.
- `salary_transfer_required`: **false** — added.
- `pakistani_cnic_required`: **true** — added. T&C clause 1 limits eligibility to BankIslami account holders; BankIslami account opening requires CNIC per the Digital Onboarding documentation requirements.
- `existing_account_required`: **true** — added. Card is issued only to existing Current / PLS Savings / Roshan Digital account holders per the Titanium T&C definitions (same convention applies bank-wide).
- Confidence: **high** — fee unambiguous; eligibility derived from explicit T&C and account-opening framework.
- Notes / conflicts: SOC URL paths `2025/12/...` and `2026/01/...` both return the same PDF — recorded both.

### PayPak Debit Card

- `card_type` / `tier`: debit / other — verified.
- `minimum_monthly_salary_pkr`: **null** — corrected from `0`. Silence ⇒ null.
- `minimum_account_balance_pkr`: **null** — corrected from `0`. Same reasoning as Classic.
- `annual_fee_pkr`: **1800** — verified. SOC Jan-Jun 2026 p.7, section 4.A.(iii): "PayPak Debit Card Rs. 1,800/-".
- `annual_fee_waiver_rule`: **"Free for BIPL staff salary accounts (per Jan-Jun 2026 SOC, section 11)."** — added (was `null`). SOC p.27, section 11 line 18: "PayPak Debit Card Issuance and Renewal Free" for BIPL staff salary accounts.
- `minimum_age_years` / `maximum_age_years`: **null / null** — verified.
- `income_document_required`: **false** — added.
- `salary_transfer_required`: **false** — added.
- `pakistani_cnic_required`: **true** — added (same reasoning as Classic).
- `existing_account_required`: **true** — added.
- Confidence: **high**.
- Notes: same as Classic.

### Titanium Debit Mastercard

- `card_type` / `tier`: debit / titanium — verified.
- `minimum_monthly_salary_pkr`: **null** — verified (was null).
- `minimum_account_balance_pkr`: **null** — corrected from `25000`. The previous pilot recorded "PKR 25,000 average balance unlocks fee waiver", which is incorrect. The PKR 25,000 average-balance figure in BankIslami's materials is the Islami Sahulat Account "avail all free services" threshold (free chequebook, pay orders, e-statement, etc.), NOT a Titanium card fee waiver. The Titanium FAQ, T&C, and SOC contain no per-balance fee waiver for the standard Titanium card. Source: Digital Onboarding brief (account-linked) cross-referenced with SOC and Titanium T&C clause 10.
- `annual_fee_pkr`: **4000** — verified. SOC Jan-Jun 2026 p.7, section 4.A.(ii): "Titanium Debit Mastercard Rs. 4,000/-".
- `annual_fee_waiver_rule`: **"Free issuance and replacement for Priority Banking customers (PKR 3 million combined quarterly-average relationship balance) per Jan-Jun 2026 SOC, section 12."** — corrected from the inaccurate PKR 25,000 rule. Source: SOC pp.27-28. Priority Titanium is the same Mastercard tier under the Priority Banking relationship segment.
- `minimum_age_years` / `maximum_age_years`: **null / null** — verified.
- `income_document_required`: **false** — added. Not required for the standard Titanium debit card. (Priority Banking onboarding may require additional documentation, but that is segment-level, not card-level.)
- `salary_transfer_required`: **false** — added.
- `pakistani_cnic_required`: **true** — added.
- `existing_account_required`: **true** — added. T&C clause 1 explicitly restricts eligibility to existing account holders (Current, PLS Savings, Joint, or Roshan Digital).
- Confidence: **high** — fee, account-linkage, and Priority waiver all confirmed in primary sources. The correction of the spurious PKR 25,000 waiver is the most important finding.
- Notes / conflicts: T&C clause 10 explicitly states cardholder pays all bank charges per SOC; no per-balance waiver is acknowledged in the T&C.

## Cross-card observations

- All three BankIslami debit cards are account-linked: they require an existing Rupee Current / PLS Savings / Roshan Digital account (T&C clause 1, consistent across the Titanium T&C and the Digital Onboarding brief's "Debit Card facility available" notes on each account product).
- The product pages on `bankislami.com.pk/digital-channel/debitcards/*` publish no eligibility figures — they are pure marketing pages. The 2026 SOC is the authoritative public source for fees.
- The PKR 25,000 figure that appears across BankIslami's materials is consistently the **Islami Sahulat Account** free-services threshold, not a card-level waiver. Any future card record citing "PKR 25,000" as a card eligibility threshold should be re-verified.
- Multiple segment-specific waivers exist (Priority Banking PKR 3M, Mashal Saving PKR 100K, BIPL staff salary, Gen Z) but apply to the underlying account relationship, not the card itself. They are recorded in `notes[]` for completeness.
- The SOC PDF is served at two URLs (`2025/12/...` and `2026/01/...`); both resolve to the same 33-page document. Kept both in `sources[]` for resilience.
- All BankIslami URLs return HTTP 403 to default WebFetch/PyPI user-agents; a browser user-agent via curl is required to reach primary sources.

## Gaps / unresolved

- No public consumer credit-card catalogue found on bankislami.com.pk in this pass — BankIslami currently appears to publish only debit cards.
- No standalone published age-floor / age-ceiling for any of the three debit cards. Adult eligibility is inferred from CNIC + standard account-opening requirements but not stated card-by-card.
- No standalone salary threshold for any debit card. Fields stay `null`.
- `income_document_required` set to `false` based on the public product pages and SOC making no mention of income documents for a debit card; this could differ in branch onboarding but is not publicly stated.
