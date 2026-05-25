# Bank AL Habib — Verification Log (2026-05-25)

**Bank slug:** `bank-al-habib`
**Pilot file:** `data/card-requirements/work/bank-al-habib-pilot.json`
**Cards in scope:** 13

## Sources consulted

- https://www.bankalhabib.com/debit-cards — public debit-card overview with fees and Signature/Platinum eligibility tables (rates effective 1 July 2025).
- https://www.bankalhabib.com/credit-cards — credit-card overview with eligibility (salary, age) for Gold & Green.
- https://www.bankalhabib.com/signature — Signature segment landing page (salary PKR 750,000 / balance PKR 2,000,000).
- https://www.bankalhabib.com/schedule-of-charges/alhabib-signature-debit-card — dedicated Signature SOC card page.
- https://www.bankalhabib.com/alhabib-gold-credit-card-soc — dedicated Gold credit-card SOC page.
- https://www.bankalhabib.com/alhabib-digital-account — Digital Account product page.
- https://www.bankalhabib.com/accounts/digital — Digital Account FAQs (age 18, no minimum balance, debit-card options).
- https://www.bankalhabib.com/accounts/current — current-account catalogue (Apna, Remit, Pensioner, Asaan, etc.).
- https://www.bankalhabib.com/cards — comparison page for UnionPay Apna / UnionPay / PayPak.
- https://www.bankalhabib.com/ur/alhabib-woman-debit-card — Woman debit card product page.
- https://www.bankalhabib.com/files/download/reports/CREDIT-CARD-SUMMARY-BOX-2025.pdf — 2025 credit-card summary box (PKR 6,500 Gold / PKR 4,500 Green primary fees).
- https://www.bankalhabib.com/files/download/reports/SOC-jan-june-2026_english.pdf — current SOC (Inst Cir.# 180 dated 2025-11-27); authoritative for fees on today's date.
- https://www.bankalhabib.com/files/download/reports/SOC-july-dec-2026-english.pdf — future SOC effective 1 July 2026 (Inst Cir.# 093 dated 2026-05-21); used for forward visibility, not as primary today.
- https://www.bankalhabib.com/files/download/reports/SOC-jan-june-2025_english.pdf — predecessor SOC, used to confirm direction of change.
- https://www.bankalhabib.com/files/documents/Apna-Indiviual-Current-Account-KFS.pdf — Apna / Current / Current Plus / Asaan KFS (Jan 2026 update).
- https://www.bankalhabib.com/files/documents/Asaan-Remittance-Account-KFS.pdf — Asaan Remittance / Remit Current Account KFS (PKR 5,000 MAB threshold for PayPak waiver on Remit).
- https://www.bankalhabib.com/files/download/documents/Key-Fact-Sheet-for-digital-account.pdf — Digital Account KFS (no minimum balance).
- https://www.bankalhabib.com/files/download/documents/AL-Habib-Woman-Current-Account-KFS.pdf — Woman Current Account KFS with discounted Visa/UPI/PayPak rates on this account.

## Card-by-card verification

### AL Habib Gold Credit Card

- `card_type` / `tier`: credit / gold.
- `minimum_monthly_salary_pkr`: **20000** — verified from /credit-cards (salaried minimum PKR 20,000/mo).
- `minimum_account_balance_pkr`: **null** — corrected from `25000`. The earlier `minimum_relationship_balance_pkr: 25000` is not supported by any BAHL credit-card page; appears to have been carried over from Apna current-account free-service threshold. Removed.
- `annual_fee_pkr`: **6500** — verified from CREDIT-CARD-SUMMARY-BOX-2025.pdf and SOC Jan-Jun 2026 Section IX.
- `supplementary_annual_fee_pkr`: **3000** — verified from same sources.
- `annual_fee_waiver_rule`: **null** — verified absent for Jan-Jun 2026. (Jul-Dec 2026 SOC introduces a spend-reversal incentive; future-dated.)
- `minimum_age_years` / `maximum_age_years`: **21 / 60** — added; sourced from /credit-cards (salaried band 21-60, self-employed 21-65, supplementary 18-70). Chose salaried band as the typical applicant.
- `income_document_required` / `salary_transfer_required` / `pakistani_cnic_required` / `existing_account_required`: **true / false / true / false** — added; /credit-cards lists CNIC plus bank statements (min 6 months) plus CF-1 Annexure as required; salary transfer not required; existing account not required.
- Confidence: high (multiple primary sources, no conflict).
- Notes / conflicts: previously claimed `minimum_relationship_balance_pkr: 25000` was an unsourced inference; removed.

### AL Habib Green Credit Card

- `card_type` / `tier`: credit / green.
- `minimum_monthly_salary_pkr`: **20000** — verified.
- `minimum_account_balance_pkr`: **null** — corrected from 25000 (same reason as Gold).
- `annual_fee_pkr`: **4500** — verified in 2025 Summary Box and SOC Jan-Jun 2026.
- `supplementary_annual_fee_pkr`: **2000** — verified.
- `annual_fee_waiver_rule`: **null** — verified absent for the current SOC period.
- `minimum_age_years` / `maximum_age_years`: **21 / 60** — added.
- Booleans: **true / false / true / false** — added (same as Gold).
- Confidence: high.

### Signature Debit Card

- `card_type` / `tier`: debit / signature.
- `minimum_monthly_salary_pkr`: **750000** — verified from /debit-cards (Signature eligibility table) and /signature.
- `minimum_deposit_pkr`: **2000000** — verified.
- `minimum_average_balance_pkr`: **2000000** — verified ("Avg monthly account balance of PKR 2,000,000 & above for 180 days" for existing customers).
- `minimum_account_balance_pkr`: **2000000** — kept as same.
- `annual_fee_pkr`: **22000** — verified in SOC Jan-Jun 2026 Section III. VISA DEBIT CARD ("Rs. 22,000 for Signature Card").
- `supplementary_annual_fee_pkr`: **22000** — verified.
- `annual_fee_waiver_rule`: **null** — corrected from "Waived if PKR 3,000,000 average monthly balance maintained for 180 days". That waiver text was unsourced. The PKR 3,000,000 MAB threshold on /accounts/current is an Account Maintenance Charge waiver (PKR 1,500/month account fee) and applies to the Signature account, not the Signature debit card's PKR 22,000 annual fee.
- `minimum_age_years` / `maximum_age_years`: **null / null** — BAHL does not publish a card-level age band.
- Booleans: **true / false / true / true** — added; Signature segment requires income proof and an existing BAHL relationship.
- Confidence: high.
- Notes / conflicts: pre-existing pilot conflated the account-maintenance waiver with the card-fee waiver; corrected and explained in notes.

### Visa Platinum Debit Card

- `card_type` / `tier`: debit / platinum.
- `minimum_monthly_salary_pkr`: **150000** — verified from /debit-cards Platinum eligibility row.
- `minimum_deposit_pkr`: **200000** — verified ("PKR 200,000 at issuance" for new customers).
- `minimum_average_balance_pkr`: **200000** — verified ("PKR 200,000 monthly average deposit" for existing).
- `annual_fee_pkr`: **9000** — verified in SOC Jan-Jun 2026 (was 9,000 in pilot, matches SOC; debit-cards page also shows 9,000).
- `supplementary_annual_fee_pkr`: **6500** — verified in SOC; pilot previously had "6,500" in notes but not in the structured field. Added explicitly.
- `annual_fee_waiver_rule`: **null** — verified absent.
- Age fields: null (not published).
- Booleans: **false / false / true / true** — Platinum is account-linked; no separate card-level income document.
- Confidence: high.

### Visa Gold Debit Card

- `card_type` / `tier`: debit / gold.
- `minimum_monthly_salary_pkr`: **null** — verified absent on /debit-cards (card doesn't show eligibility row).
- `minimum_account_balance_pkr` / `minimum_average_balance_pkr`: **null / null** — kept null. Card is account-linked; threshold is set by the underlying account product.
- `annual_fee_pkr`: **4500** — verified in SOC Jan-Jun 2026.
- `supplementary_annual_fee_pkr`: **3500** — verified in SOC.
- `annual_fee_waiver_rule`: **null**.
- Age: null.
- Booleans: **false / false / true / true**.
- Confidence: high (clean SOC fee; null thresholds are correct because BAHL does not publish them).

### Visa Silver Debit Card

- `card_type` / `tier`: debit / silver.
- `minimum_monthly_salary_pkr`: **null** — **corrected from `0`**. BAHL does not state a zero salary requirement on the card; it simply doesn't gate the card on salary, which we record as null (the methodology says "Do not set salary to 0 just because the page is silent").
- `minimum_account_balance_pkr` / `minimum_average_balance_pkr`: **null / null** — corrected from `0`.
- `annual_fee_pkr`: **3700** — verified in SOC Jan-Jun 2026.
- `supplementary_annual_fee_pkr`: **2700** — verified.
- `annual_fee_waiver_rule`: **null**.
- Age: null.
- Booleans: **false / false / true / true**.
- Confidence: high. Audit flag (low confidence + balance 0) resolved by re-verification.

### AL Habib Digital Account Gold Debit Card

- `card_type` / `tier`: debit / digital-gold.
- `minimum_monthly_salary_pkr`: **null** — corrected from 0 (page is silent on salary).
- `minimum_account_balance_pkr` / `minimum_average_balance_pkr`: **0 / 0** — verified from the Digital Account KFS: "No minimum balance requirement" and "No initial deposit requirement" are explicit zero statements, so 0 is appropriate here (unlike the Visa Gold card where the underlying account isn't fixed).
- `annual_fee_pkr`: **4500** — verified (Visa Gold pricing under the SOC).
- `supplementary_annual_fee_pkr`: **3500** — added.
- `minimum_age_years`: **18** — verified from /accounts/digital.
- Booleans: **false / false / true / true**.
- Confidence: high.

### AL Habib Digital Account Classic Debit Card

- `card_type` / `tier`: debit / digital-classic.
- `minimum_monthly_salary_pkr`: **null** — corrected from 0.
- `minimum_account_balance_pkr` / `minimum_average_balance_pkr`: **0 / 0** — verified (Digital Account KFS).
- `annual_fee_pkr`: **3700** — verified (Visa Silver tariff applied on Digital Account).
- `supplementary_annual_fee_pkr`: **2700** — verified.
- `minimum_age_years`: **18** — verified.
- Booleans: **false / false / true / true**.
- Confidence: high.

### AL Habib Remit Debit Card

- `card_type` / `tier`: debit / remit.
- `minimum_monthly_salary_pkr`: **null** — corrected from 0.
- `minimum_account_balance_pkr`: **0** — verified ("No Initial Deposit Requirement" on Asaan Remittance per /accounts/current).
- `minimum_average_balance_pkr`: **5000** — added; per the Asaan Remit KFS, monthly average balance of PKR 5,000 is the threshold above which Account Maintenance Fee is zero. Also the PayPak waiver hinge on this account.
- `annual_fee_pkr`: **3700** — verified.
- `supplementary_annual_fee_pkr`: **2700** — verified.
- `annual_fee_waiver_rule`: added — "Issuance / annual / renewal fee on PayPak debit card is waived if PKR 5,000 monthly average balance is maintained on the AL Habib Remit Current Account; Visa-variant Remit cards follow the standard Visa Silver schedule." (Sourced from SOC Jul-Dec 2026 PayPak note and the Remit KFS.)
- `minimum_age_years` / `maximum_age_years`: **18 / 60** — added; Remit current account age band per /accounts/current (insurance eligibility).
- Booleans: **false / false / true / true**.
- Confidence: medium (because the live /debit-cards row treats Remit as Visa Silver-priced, while the underlying free product is PayPak; we report the Visa Silver tariff since that's what the headline page exposes for this card).

### AL Habib Woman Debit Card

- `card_type` / `tier`: debit / woman.
- `minimum_monthly_salary_pkr`: **null** — corrected from 0.
- `minimum_account_balance_pkr` / `minimum_average_balance_pkr`: **0 / 0** — verified ("No Minimum Balance Requirement" and "No Initial Balance Requirement" on Woman Account KFS).
- `annual_fee_pkr`: **3700** — verified against /debit-cards (Visa Silver default).
- `supplementary_annual_fee_pkr`: **2700** — verified.
- `annual_fee_waiver_rule`: **null**.
- `minimum_age_years` / `maximum_age_years`: **18 / 60** — added from Woman KFS insurance eligibility.
- Booleans: **false / false / true / true**.
- Confidence: medium because the Woman Account KFS lists discounted Visa fees (Silver PKR 1,500 / Gold PKR 2,000 / Platinum PKR 4,500 / UnionPay PKR 1,500 / PayPak free) which conflict with the headline /debit-cards page's PKR 3,700 figure. We retained the public /debit-cards rate.

### BAHL UnionPay Apna Debit Card

- `card_type` / `tier`: debit / unionpay-apna.
- `minimum_monthly_salary_pkr`: **null** — corrected from 0.
- `minimum_account_balance_pkr`: **null** — corrected from 0 (Apna has no minimum balance to open per the KFS, but the PKR 25,000 monthly average is the free-service threshold).
- `minimum_average_balance_pkr`: **25000** — added; sourced from the Apna KFS ("On maintaining monthly average balance of PKR 25,000/-").
- `annual_fee_pkr`: **3000** — **corrected from null** per SOC Jan-Jun 2026 Section V (China UnionPay) and /cards comparison page.
- `supplementary_annual_fee_pkr`: **2000** — added.
- `annual_fee_waiver_rule`: **null**.
- `minimum_age_years` / `maximum_age_years`: **18 / 60** — added (Apna current account band).
- Booleans: **false / false / true / true**.
- Confidence: high.

### BAHL UnionPay Debit Card

- `card_type` / `tier`: debit / unionpay.
- `minimum_monthly_salary_pkr`: **null** — corrected from 0.
- `minimum_account_balance_pkr` / `minimum_average_balance_pkr`: **null / null** — corrected from 0 (no single underlying account; varies by issuance context).
- `annual_fee_pkr`: **3000** — **corrected from null** per SOC and /cards.
- `supplementary_annual_fee_pkr`: **2000** — added.
- `annual_fee_waiver_rule`: **null**.
- `minimum_age_years`: **18** — added (Digital Account default).
- Booleans: **false / false / true / true**.
- Confidence: high.

### PayPak Debit Card

- `card_type` / `tier`: debit / paypak.
- `minimum_monthly_salary_pkr`: **null** — corrected from 0.
- `minimum_account_balance_pkr`: **null** — corrected from 0 (varies by underlying account).
- `minimum_average_balance_pkr`: **25000** — added (waiver hinge on standard current accounts).
- `annual_fee_pkr`: **2750** — **corrected from null** per SOC Jan-Jun 2026 Section VII.
- `supplementary_annual_fee_pkr`: **null** — confirmed via /cards comparison ("No supplementary cards") for PayPak.
- `annual_fee_waiver_rule`: added — "Issuance / annual / renewal fee waived if monthly average balance of PKR 25,000 is maintained on AL Habib Current / Current Plus / Apna Individual accounts (PKR 5,000 on AL Habib Remit account) in previous or next calendar month." (Verbatim paraphrase of SOC note.)
- `minimum_age_years`: **18** — added.
- Booleans: **false / false / true / true**.
- Confidence: high.

## Cross-card observations

- All Visa debit cards use a single bank-wide tariff (Signature 22,000 / Platinum 9,000 / Gold 4,500 / Silver 3,700 primary). The Digital Account Gold = Visa Gold pricing; Digital Account Classic = Visa Silver pricing; Woman default and Remit default also map to Visa Silver pricing on the /debit-cards page. This explains the recurring 3,700 / 2,700 figure across multiple "different" cards.
- UnionPay is a flat PKR 3,000 / PKR 2,000 across both variants (Apna and standard).
- PayPak has an account-level waiver that is the single biggest "missing waiver rule" in the prior pilot file (previously null for 12 of 13 cards; PayPak's waiver is now captured, and the Remit card's PayPak-tied waiver is also captured).
- Audit flags resolved:
  - 3 cards missing annual_fee (UnionPay Apna, UnionPay, PayPak): all three now populated from the SOC Jan-Jun 2026.
  - Signature Debit Card: salary 750,000 and balance 2,000,000 verified directly on the /debit-cards eligibility table; the unsourced PKR 3,000,000 fee-waiver claim was removed.
  - Visa Silver Debit Card balance 0: corrected to null (no published zero-threshold language at the card level).
  - AL Habib Gold/Green Credit Cards balance 25,000: corrected to null (unsourced).
- The Jan-Jun 2026 SOC (Inst Cir.# 180 dated 2025-11-27) is the authoritative document for today (2026-05-25). The Jul-Dec 2026 SOC (Inst Cir.# 093 dated 2026-05-21) introduces upward repricing (Signature 22k -> 23k, Platinum 9k -> 10k, plus a new Platinum credit-card tier and spend-reversal incentives on all credit-card variants). Those are future-dated and not applied to today's pilot.

## Gaps / unresolved

- BAHL does not publish a maximum age for non-insurance-tied accounts (Digital, Current, Current Plus, Apna for non-insurance customers). Cards on those accounts have `maximum_age_years: null` even though many do carry an 18-60 insurance window when the customer opts in.
- Visa Gold / Visa Silver standalone debit cards have no published salary or balance gate at the card level; entry is governed by the underlying account, so card-level salary / balance remain null rather than 0.
- Woman Account KFS publishes a card-fee discount that conflicts with the headline /debit-cards page. Reported the higher (headline) rate; flagged the conflict in notes.
