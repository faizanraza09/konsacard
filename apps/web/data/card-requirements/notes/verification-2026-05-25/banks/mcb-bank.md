# MCB Bank Limited — Verification Log (2026-05-25)

**Bank slug:** `mcb-bank`
**Pilot file:** `data/card-requirements/work/mcb-bank-pilot.json`
**Cards in scope:** 11 (5 MCB-debit family + 1 Mastercard debit + 1 Nayab + 1 Fun Club + 3 credit)

> MCB is the weakest-documented bank in the dataset. The only fully usable
> primary source is the Jan-Jun 2026 Schedule of Bank Charges (SOBC). The card
> product pages themselves publish almost no eligibility data; income / age
> thresholds simply are not on mcb.com.pk for any tier. This log records every
> URL hit, including ones that turned out to be unproductive, so future
> reproductions don't redo the same dead-ends.

## Sources consulted (productive)

- https://www.mcb.com.pk/assets/documents/SOBC-Jan-June-2026-English.pdf — Jan-Jun 2026 SOBC. The authoritative fee table for every MCB card lives on p.23 (MCB Debit Cards table with SILVER / GOLD / GOLD LOCAL / GOLD PLUS / PLATINUM columns; the column headers are only legible in the rendered PNG, not in pdfplumber/pymupdf text extraction). PayPak / Mastercard Classic / Signature / Fun Club fee lines also on p.23. Credit-card fee lines under Section F on p.24. Multiple account product tables (Salary Club, Nayab, Freelancer, Asaan Digital, Young, Pensioner, Works, MCB One) describe which debit cards are issued free with which account and at which tier.
- https://www.mcb.com.pk/assets/documents/Credit-card-Summary-Box-1-January-to-June-22-Jan-2026.pdf — Credit Card Summary Box Jan-Jun 2026. Basic / supplementary fees (PKR 7,000 / 14,000 / 22,000 basic; PKR 3,500 / 7,000 / 11,000 supplementary), waiver-spend thresholds (PKR 50,000 / 150,000 / 250,000 basic; PKR 10,000 / 25,000 / 50,000 supplementary; all within 60 days; no cross-eligibility between basic and supplementary). Card credit-limit ranges by tier.
- https://www.mcb.com.pk/assets/documents/MCB_CreditCardFeeInfo-5-7-24.pdf — Standalone 2026 H1 fee notice; confirms basic-card waiver-spend thresholds and that transactions on basic and supplementary are evaluated independently.
- https://www.mcb.com.pk/assets/documents/Signature-FAQs-6-March-2024-Green.pdf — March 2024 Signature Debit Card FAQ. Confirms deposit-based eligibility (PKR 2M CA or PKR 5M total deposits, application-time and quarterly average) and that supplementary cards are not allowed. Publishes a PKR 5,000/quarter non-maintenance fee — superseded by SOBC at PKR 10,000/quarter.
- https://www.mcb.com.pk/privilege/relationship/eligibility — MCB Privilege Banking segment eligibility page. PKR 2,000,000 quarterly average Current Account (LCY/FCY) OR PKR 5,000,000 across total relationship (CA + SA + TD). This is the inheritance source for Privilege-tier debit cards (Platinum and Signature debit).
- https://www.mcb.com.pk/privilege/privilege_cards/privilege_debit_card/mcb-visa-platinum-debit-card — Privilege Visa Platinum Debit page. Daily limits (ATM 350K, POS 800K, IBFT 300K) and Annual/Issuance Fee 14,000, Replacement 14,000 (exclusive of FED/taxes). No salary, age, or document fields.
- https://www.mcb.com.pk/privilege/privilege_cards/privilege_debit_card/mcb-visa-signature-debit-card — Privilege Visa Signature Debit page. Identical deposit-threshold language to the 2024 FAQ.
- https://www.mcb.com.pk/personal/cards/credit-cards/classic-gold-credit-card — Classic / Gold Credit Card product page (combined). Lists features (EasyCash, EasyPay, Balance Transfer, insurance). No eligibility data.
- https://www.mcb.com.pk/personal/cards/credit-cards/platinum-credit-card — Platinum Credit Card product page. Lists lounge access (international: USD 5 cumulative spend in 90 days, 6 visits/year). No eligibility data.
- https://www.mcb.com.pk/personal/cards/credit-cards/mcb-visa-credit-card — MCB Visa Credit Card (Roshan Digital). Eligibility: "All MCB Roshan Digital Account holders (PKR/FCY)". Document list: CNIC/NICOP/POC/Passport, application form, declaration, CF-1, CF-19, Summary Box, T&Cs. No income / age threshold.
- https://www.mcb.com.pk/personal/cards/ — Cards landing page. Lists every retail card MCB issues (debit and credit). No fee or eligibility data inline.
- https://www.mcb.com.pk/personal/women-financial-services/mcb-nayab-current-account — MCB Nayab Current Account product page. "No Account Activation Deposit requirement and no minimum balance requirement." Free Debit Cards (Nayab Card). Tier rules live in the SOBC, not on the product page.
- https://www.mcb.com.pk/personal/deposit-accounts/current-deposit/fun-club-banking-for-kids — Fun Club current account product page. Age cap: "Less than 18 years old in case of natural Guardian, or Less than 21 years old in case of court appointed Guardian." Used to set `maximum_age_years: 18`.
- https://www.mcb.com.pk/personal/deposit-accounts/current-deposit/current-account — Standard MCB Current Account product page. Explicit "No minimum balance maintenance requirement". Used to confirm zero balance floor on the entry-tier debit cards (Silver / Gold / Mastercard Classic / PayPak when issued against the standard current account).
- https://www.mcb.com.pk/quick-links/key-fact-statement — KFS index page. Confirms there are no credit-card or debit-card KFS PDFs on mcb.com.pk (only deposit / lending KFS).

## Sources searched but unproductive

Listed explicitly so a future verifier doesn't repeat them:

- https://www.mcb.com.pk/privilege-banking/mcb-visa-platinum-credit-card — duplicate marketing page for the Platinum credit card; no eligibility data.
- https://www.mcb.com.pk/privilege/privilege_cards/privilege_credit_card — Privilege credit-card index page; only lists MCB Visa Platinum Credit Card with a "Learn More" link.
- https://www.mcb.com.pk/privilege/privilege_cards/privilege_credit_card/mcb-visa-platinum-credit-card — Privilege Platinum credit card product page; lists features only, no eligibility / fee.
- https://www.mcb.com.pk/privilege/privilege_cards/privilege_credit_card/mcb-visa-gold-credit-card — 404 (slug exists in sitemap fragments but the page returns the global 404 shell).
- https://www.mcb.com.pk/personal/accounts/current-accounts/mcb-nayab-current-account — 404 (correct slug is under `/personal/women-financial-services/`).
- https://www.mcb.com.pk/assets/documents/MCB-Credit-card-Summary-Box-English.pdf — generic Summary Box link; gated by Cloudflare bot challenge when fetched outside a browser session. The dated Jan-Jun 2026 file in artifacts is the current copy.
- https://www.mcb.com.pk/assets/documents/Plastic_Card_Term__Cond..pdf — Plastic Card Terms & Conditions. Binary-only content that did not yield extractable text via WebFetch; no published age / income threshold surfaced in the text fragments that did come through.
- https://www.mcb.com.pk/assets/documents/Credit_Card_Documentation.pdf — Document checklist PDF, binary-only via WebFetch.
- https://www.mcb.com.pk/assets/documents/MCB-Nayab-FAQs-Website.pdf — Nayab FAQs PDF, binary-only via WebFetch.
- https://www.mcb.com.pk/become-a-customer — Become-a-Customer apply landing; the form collects CNIC + current net salary + employment details, but no published thresholds.
- https://www.mcb.com.pk/personal/cards/debit-cards — 404 (correct slug is `mcb-debit-card/`).
- https://www.mcb.com.pk/personal/deposit-accounts/savings-deposit/mcb-burqraftaar-account — 404.
- https://www.mcb.com.pk/personal/deposit-accounts/current-deposit/mcb-young-current-account — page exists but does not publish a minimum balance, age range, or salary requirement (only lists free card / cheque book / etc.). Not used as a fact source.
- https://www.mcb.com.pk/personal/deposit-accounts/savings-deposit/mcb-nayab-savings-account — Nayab Savings page; useful for confirming "50% issuance discount on Exclusive Ladies Debit Card; full annual / renewal fee charged" but did not change any fact in the pilot beyond the wording already encoded.

## Card-by-card verification

### MCB Visa Platinum Debit Card

- `card_type` / `tier`: debit / platinum — verified.
- `minimum_monthly_salary_pkr`: **null** — corrected from `0`. No published salary requirement; per methodology, silence = null.
- `minimum_account_balance_pkr`: **2,000,000** — corrected from `0`. Inherited from MCB Privilege segment eligibility page (https://www.mcb.com.pk/privilege/relationship/eligibility): "Current Account (FCY/LCY) Equivalent to PKR 2,000,000" quarterly average.
- `minimum_relationship_balance_pkr`: **5,000,000** — added. Privilege segment alternative path: "Total Deposit Relationship Equivalent to PKR 5,000,000" quarterly average (CA + SA + TD, LCY/FCY combined).
- `annual_fee_pkr`: **14,000** — verified. Jan-Jun 2026 SOBC, p.23, MCB Debit Cards table PLATINUM column: Issuance / Renewal / Replacement = Rs. 14,000/- each; matches the Privilege product page (Annual/Issuance Fee 14,000).
- `supplementary_annual_fee_pkr`: **5,500** — added. Same SOBC row, supplementary column.
- `annual_fee_waiver_rule`: **null** — verified. No standing waiver published in the SOBC or on the product page.
- `pakistani_cnic_required`: **true** — added.
- `existing_account_required`: **true** — added. Card is issued against a Privilege-eligible account.
- Confidence: high. Fee from SOBC + product page; balance from Privilege eligibility page (an explicit segment cite, not a guess).

### MCB Visa Signature Debit Card

- `card_type` / `tier`: debit / signature — verified.
- `minimum_account_balance_pkr`: **2,000,000** — verified.
- `minimum_relationship_balance_pkr`: **5,000,000** — verified.
- `annual_fee_pkr`: **null** — verified (intentionally null; quarterly fee model captured in waiver rule).
- `annual_fee_waiver_rule`: refined to PKR 10,000/quarter per the Jan-Jun 2026 SOBC (the 2024 FAQ figure of PKR 5,000/quarter is superseded). Source: SOBC p.23, Section B-3.
- Supplementary not allowed (Signature FAQ Q9) — `supplementary_annual_fee_pkr` intentionally omitted.
- `existing_account_required`: **true** — added. Photo, Joint-operated, Corporate, and MCB Works accounts are explicitly ineligible.
- Confidence: high.

### PayPak Debit Card

- `card_type` / `tier`: debit / other — verified.
- `minimum_monthly_salary_pkr` / `minimum_account_balance_pkr`: **null / null** — corrected from `0 / 0`.
- `annual_fee_pkr`: **null** — verified. SOBC publishes PayPak Classic at Rs. 2,000 and PayPak Gold at Rs. 2,300 as two separate fee lines; generic record left null to avoid mis-committing to one variant.
- `annual_fee_waiver_rule`: rewritten to enumerate the account-product tables that ship free PayPak Classic / Gold (Salary Club, Nayab Premium / Affluent, Freelancer, Asaan Digital, Young, Works affluent tiers).
- Confidence: medium — the only published-fee ambiguity is the Classic/Gold split.

### Mastercard Classic Debit Card

- `card_type` / `tier`: debit / classic — verified.
- `minimum_monthly_salary_pkr` / `minimum_account_balance_pkr`: **null / null** — corrected from `0 / 0`.
- `annual_fee_pkr`: **3,000** — verified. Jan-Jun 2026 SOBC, p.23, Section B-2 (MCB Debit Mastercard - Classic): all four lines (Issuance, Renewal/Annual, Supplementary, Replacement) at Rs. 3,000/-.
- `supplementary_annual_fee_pkr`: **3,000** — added.
- Confidence: high.

### Nayab Visa Debit Card

- `card_type` / `tier`: debit / other — verified.
- `minimum_monthly_salary_pkr` / `minimum_account_balance_pkr`: **null / null** — corrected from `0 / 0`.
- `annual_fee_pkr`: **4,000** — verified. SOBC Section P routes Nayab card pricing to the Visa Gold Plus column; Gold Plus column on p.23 = Rs. 4,000/- for Issuance / Renewal / Replacement.
- `annual_fee_waiver_rule`: rewritten to enumerate the three Nayab Current tiers (Mass <= PKR 100K; Premium PKR 100K - <1M; Affluent >= PKR 1M) plus the Nayab Savings Account. Only Affluent gets free Issuance / Annual / Renewal on the Exclusive Nayab Card; lower tiers get 50% issuance discount with full annual / renewal.
- Confidence: high.

### Visa Classic Credit Card

- `card_type` / `tier`: credit / classic — verified.
- `minimum_monthly_salary_pkr` / `minimum_account_balance_pkr`: **null / null** — verified. No public threshold on the product page, Summary Box, fee notice, or Privilege credit-card page.
- `annual_fee_pkr`: **7,000** — verified. SOBC Section F line 1; Summary Box "Issuance/Annual Fee Basic Card Classic PKR 7,000 p.a.".
- `supplementary_annual_fee_pkr`: **3,500** — added. SOBC Section F line 2; Summary Box "Supplementary Card PKR 3,500 p.a.".
- `annual_fee_waiver_rule`: refined to include the supplementary-side PKR 10,000 spend rule and the no-cross-eligibility clause from the Summary Box.
- `pakistani_cnic_required`: **true** — added.
- `existing_account_required`: **false** — added (standalone credit-card application is supported).
- Confidence: high on fees and waiver; null kept on income/balance per methodology.

### Visa Gold Credit Card

- Same structure as Visa Classic Credit Card.
- `annual_fee_pkr`: **14,000** — verified.
- `supplementary_annual_fee_pkr`: **7,000** — added.
- `annual_fee_waiver_rule`: PKR 150,000 basic / PKR 25,000 supplementary within 60 days.
- Credit limit range PKR 150,000 - PKR 1,000,000 (Summary Box, "Card Limits").
- Confidence: high.

### Visa Platinum Credit Card

- Same structure as Visa Classic / Gold Credit Card.
- `annual_fee_pkr`: **22,000** — verified.
- `supplementary_annual_fee_pkr`: **11,000** — added.
- `annual_fee_waiver_rule`: PKR 250,000 basic / PKR 50,000 supplementary within 60 days.
- Credit limit range PKR 400,000 - PKR 7,000,000 (Summary Box).
- Confidence: high.

### Visa Gold Debit Card

- `card_type` / `tier`: debit / gold — verified.
- `minimum_monthly_salary_pkr` / `minimum_account_balance_pkr`: **null / null** — confirmed. Standard MCB Current Account product page: "No minimum balance maintenance requirement" — no balance floor to inherit.
- `annual_fee_pkr`: **4,000** — verified (SOBC GOLD column).
- `supplementary_annual_fee_pkr`: **3,000** — added. SOBC footnote on p.23: "Supplementary Card for Visa Gold & Visa Gold Plus will be a Silver Visa Card" = Rs. 3,000/-.
- Confidence: high.

### Visa Silver Debit Card

- `card_type` / `tier`: debit / silver — verified.
- `minimum_monthly_salary_pkr` / `minimum_account_balance_pkr`: **null / null** — corrected from `0 / 0`.
- `annual_fee_pkr`: **3,000** — verified (SOBC SILVER column; same value across Issuance / Renewal / Supplementary / Replacement).
- `supplementary_annual_fee_pkr`: **3,000** — added.
- `annual_fee_waiver_rule`: added — first-issuance-free for MCB Asaan Digital account customers per SOBC Section X.
- Confidence: high.

### Visa Fun Club Debit Card

- `card_type` / `tier`: debit / other — verified.
- `minimum_monthly_salary_pkr`: **null** — corrected from `0`.
- `minimum_account_balance_pkr`: **null** — corrected from `0` (account product page does not publish a minimum balance maintenance requirement).
- `minimum_average_balance_pkr`: **50,000** — added. PKR 50,000 average balance is the explicit fee-waiver trigger published in SOBC Section B-4 (month-of-issuance for issuance fee; month-prior-to-due for annual fee).
- `annual_fee_pkr`: **1,000** — verified.
- `annual_fee_waiver_rule`: kept and re-cited.
- `maximum_age_years`: **18** — added. Inherited from the Fun Club current account page ("Less than 18 years old in case of natural Guardian, or Less than 21 years old in case of court appointed Guardian"). 18 used as the conservative natural-guardian cap; the court-appointed-guardian path (21) is recorded in notes but not used as the cap.
- Confidence: high.

## Cross-card observations

- **Privilege inheritance**. The MCB Privilege segment eligibility page (https://www.mcb.com.pk/privilege/relationship/eligibility) publishes a single set of thresholds (PKR 2,000,000 quarterly average CA or PKR 5,000,000 total relationship) that govern both Privilege-tier debit cards (Visa Platinum Debit, Visa Signature Debit). The Signature card adds an at-application minimum of PKR 2M / 5M (per the FAQ and the product page); the Platinum debit card inherits the same segment thresholds without a separate at-application clause being published. This is the cleanest inheritance link in the MCB catalogue.
- **Column-header trap on the SOBC debit-card fee table**. The header row of the MCB Debit Cards table on SOBC p.23 (SILVER / GOLD / GOLD LOCAL / GOLD PLUS / PLATINUM) is image-only and does not appear in pdfplumber or pymupdf text extraction. The headers must be read from the rendered PNG (`artifacts/mcb-bank/sobc-2026-h1/page-renders/page-023.png` — re-rendered at 300 DPI during this pass to verify). Any future automated extraction of the MCB debit fee table needs to OCR the header row separately.
- **PayPak fee split**. SOBC publishes PayPak Classic at Rs. 2,000 and PayPak Gold at Rs. 2,300 as two distinct fee lines. The pilot retains a single generic "PayPak Debit Card" record with annual_fee_pkr null. If the card catalogue is later split into two cards, the fee per variant is in the SOBC.
- **No public credit-card income / age thresholds**. None of MCB's public surfaces — product pages, Privilege segment pages, Summary Box, fee notice, KFS index — publish an income or age threshold for the three credit-card tiers. Third-party aggregators publish numbers (e.g., PKR 100K for Platinum, 21-60 salaried), but those are not on mcb.com.pk and per methodology cannot be used.
- **Signature FAQ vs SOBC**. The March-2024 Signature FAQ publishes a PKR 5,000/quarter non-maintenance fee; the Jan-Jun 2026 SOBC publishes PKR 10,000/quarter. The SOBC is the current and authoritative figure. The FAQ is retained as a primary source for the eligibility / supplementary-not-allowed clauses but its fee number is explicitly called out as superseded in the pilot notes.
- **CNIC + existing-account-required defaults**. Every MCB debit card is account-linked (no standalone debit product). Every MCB application form captures CNIC. So `pakistani_cnic_required` is set to true for every card and `existing_account_required` is true for every debit card; for credit cards, `existing_account_required` is false because the MCB Visa Credit Card (RDA) eligibility line explicitly opens to non-account customers via Roshan Digital Account, and the standard apply-now flow accepts standalone applicants.

## Gaps / unresolved

- Credit-card income / salary / age remain null for all three tiers — MCB does not publish them, and methodology forbids inference from aggregators.
- Generic PayPak record has `annual_fee_pkr: null` by design (two variants); not a true gap but flagged in pilot `gaps[]`.
- Fun Club minimum age is not published (only the maximum is); `minimum_age_years` left null.
- The Privilege Visa Gold Credit Card slug (`.../privilege_credit_card/mcb-visa-gold-credit-card`) is referenced in search results but resolves to the global 404 shell at the time of verification — likely a dead link in the Privilege section.
