# JS Bank — Verification Log (2026-05-25)

**Bank slug:** `js-bank`
**Pilot file:** `data/card-requirements/work/js-bank-pilot.json`
**Cards in scope:** 11

## Sources consulted

- https://www.jsbl.com/personal/credit-card/ — credit-card overview page; lists JS Classic / JS Gold / JS Platinum / JS Signature with PKR 70,000 minimum monthly salary across the table and annual fees Rs. 5,000 / 8,500 / 15,000 / (Signature not on this table).
- https://www.jsbl.com/js-credit-card/ — second credit-card landing page; same comparison numbers (Classic, Gold, Platinum).
- https://www.jsbl.com/wp-content/uploads/2025/12/SOC-Jan-Jun-2026-Final-Eng.pdf — JS Bank Schedule of Charges Jan-Jun 2026. Section A (JS Bank Credit Card VISA) lists Classic / Gold / Platinum / Signature annual fees and reduced fees. Section A on p.26 (Mastercard/PAYPAK Debit Card Charges) lists all debit card annual fees, supplementary fees, retention fees, issuance fees and replacement fees. Section F (Private Banking) lists PB Signature Credit Card and Mastercard World. "Fee Waivers" section spells out the account-linked waiver paths (JS Platinum Business, JS Premier Raabta, JS HER, JS Elite / Elite Plus, JS Inclusive, JS L/CY).
- https://www.jsbl.com/wp-content/uploads/2026/01/CC-KFS-Jan-Jun-2026.pdf — Credit Card Key Fact Statement Jan-Jun 2026; same Classic / Gold / Platinum numbers as the SOC plus the supplementary fee table.
- https://www.jsbl.com/wp-content/uploads/2025/07/Signature-KFS-Jul-Dec%202025-FINAL-18-Jul.pdf — JS Signature Credit Card KFS Jul-Dec 2025; primary source for Signature annual fee Rs. 20,000 / reduced Rs. 7,700 on Rs. 150,000 first-month spend, supplementary Rs. 8,000 / reduced Rs. 7,200.
- https://www.jsbl.com/personal/accounts/current-accounts/js-asaan/ — JS Asaan Current Account; PKR 100 initial deposit, "No Minimum Monthly Average Balance Required", PayPak Classic Debit Card.
- https://www.jsbl.com/js-inclusive-current-account/ — JS Inclusive Current Account; nil initial deposit, "PayPak Debit Card – Annual Fee Waiver".
- https://www.jsbl.com/personal/accounts/savings-account/js-pls-savings-account/ — JS PLS Savings; advertises "Free MasterCard Gold debit card annual fee" with no numeric balance threshold on the page itself.
- https://www.jsbl.com/her-finances/ — JS HER proposition page; "Services Offered on Maintenance of Average Balance of PKR 50,000", Mastercard Titanium Debit Card.
- https://www.jsbl.com/personal/accounts/current-accounts/js-platinum-business-current-account/ — JS Platinum Business Current Account; PKR 150,000 over the past three months, "Mastercard Platinum debit card – annual fee waiver".
- https://www.jsbl.com/js-priority-banking/ — JS Priority Banking proposition; PKR 3,000,000 (current account) or PKR 8,000,000 (savings account), 3-month average balance.

## Card-by-card verification

### JS Credit Card Classic (credit / classic)

- `minimum_monthly_salary_pkr`: **70,000** — verified against the jsbl.com credit-card comparison table.
- `minimum_account_balance_pkr`: **null** — corrected from `0`. Per methodology, silence means `null`, not `0`. Unsecured card; no balance is required, but no number is published either.
- `annual_fee_pkr`: **5,000** — verified against Jan-Jun 2026 SOC Section A (JS Bank Credit Card VISA, Classic) and Jan-Jun 2026 KFS.
- `joining_fee_pkr`: **0** — added. KFS states "No Card Issuance or Joining Fee" and SOC entry i lists Joining Fee = Nil.
- `supplementary_annual_fee_pkr`: **2,000** — added. SOC Section A.iii Classic supplementary card annual fee Rs. 2,000 (reduced Rs. 1,000).
- `annual_fee_waiver_rule`: **"Reduced fee of PKR 1,200 charged on spending PKR 25,000 within 1 month of card activation."** — verified verbatim from SOC and KFS.
- `minimum_age_years` / `maximum_age_years`: **18 / null** — minimum inferred (standard Pakistani credit-card minimum); no maximum published.
- `income_document_required`: **true** — KFS-implied: customers must provide proof of income.
- `salary_transfer_required`: **false** — not required (KFS notes salary credit only reverses fee for Employee Banking, not a gate).
- `pakistani_cnic_required`: **true** — standard.
- `existing_account_required`: **false** — credit-card application is standalone.
- Confidence: **high**.

### JS Credit Card Platinum (credit / platinum)

- `minimum_monthly_salary_pkr`: **70,000** — verified against jsbl.com comparison table.
- `minimum_account_balance_pkr`: **null** — corrected from `0` per methodology.
- `annual_fee_pkr`: **15,000** — verified against Jan-Jun 2026 SOC Section A and KFS.
- `joining_fee_pkr`: **0** — added.
- `supplementary_annual_fee_pkr`: **6,500** — added per SOC Section A.iii Platinum.
- `annual_fee_waiver_rule`: **"Reduced fee of PKR 3,100 charged on spending PKR 100,000 within 1 month of card activation."** — verified verbatim.
- `minimum_age_years` / `maximum_age_years`: **18 / null** — same as Classic.
- Booleans: same as Classic (`income_document_required` true, `salary_transfer_required` false, `pakistani_cnic_required` true, `existing_account_required` false).
- Confidence: **high**.

### PayPak Classic Debit Card (debit / classic)

- `minimum_monthly_salary_pkr`: **null** — verified (no salary published).
- `minimum_account_balance_pkr`: **0** — verified via JS Asaan Current Account page ("No Minimum Monthly Average Balance Required").
- `minimum_deposit_pkr`: **100** — verified; JS Asaan opens at PKR 100.
- `annual_fee_pkr`: **1,500** — corrected from `1,000` (which was account-page-derived). Jan-Jun 2026 SOC Section A.xiii PayPak Debit Card lists Annual Fee Rs. 1,500.
- `joining_fee_pkr`: **1,000** — added; SOC lists PayPak Debit Card Issuance Fee Rs. 1,000.
- `supplementary_annual_fee_pkr`: **750** — added per SOC.
- `annual_fee_waiver_rule`: rewritten to point to JS Inclusive Current Account (which explicitly states "PayPak Debit Card – Annual Fee Waiver") and JS Elite Current Account (SOC fee-waivers vii.c).
- `minimum_age_years`: **18** — inferred.
- Booleans: `existing_account_required` true, `pakistani_cnic_required` true, salary/income docs false.
- Confidence: **high**.

### Mastercard Gold Debit Card (debit / gold)

- `minimum_monthly_salary_pkr`: **null** — verified.
- `minimum_account_balance_pkr`: **null**.
- `minimum_average_balance_pkr`: **150,000** — corrected from `250,000`. The previous PKR 250,000 PLS-Savings number is not in the Jan-Jun 2026 SOC; the cleanest waiver path in the current SOC is JS Premier Raabta Current Account at PKR 150,000+ monthly/quarterly average balance (SOC Fee Waivers Section v.o).
- `annual_fee_pkr`: **2,500** — corrected from `1,650` (Jul-Dec 2025 SOC value). Jan-Jun 2026 SOC Section A.iii Mastercard Gold lists Rs. 2,500.
- `joining_fee_pkr`: **1,000** — added (Mastercard Debit Card Issuance Fee).
- `supplementary_annual_fee_pkr`: **1,250** — added.
- `annual_fee_waiver_rule`: rewritten to reference JS Premier Raabta (PKR 150,000), JS Elite Plus, and JS L/CY accounts.
- Booleans: `existing_account_required` true; salary/income docs false.
- Confidence: **medium** — JS PLS Savings page still markets a free Gold debit fee but the SOC no longer surfaces a numeric PLS-specific threshold.

### Mastercard World Debit Card (debit / world)

- `minimum_monthly_salary_pkr`: **null** — corrected from `0` per methodology (silence is not zero).
- `minimum_account_balance_pkr`: **null**.
- `minimum_relationship_balance_pkr`: **3,000,000** — verified against jsbl.com/js-priority-banking/ ("PKR 3 Million for Current Account", 3-month average). Re-labelled from `minimum_account_balance_pkr` to relationship-balance per methodology (the threshold comes from a Premier/Priority proposition page, not a direct card or account page).
- `annual_fee_pkr`: **17,000** — verified against Jan-Jun 2026 SOC (Mastercard World row and Section F Private Banking).
- `joining_fee_pkr`: **1,000** — added.
- `supplementary_annual_fee_pkr`: **8,500** — added.
- `annual_fee_waiver_rule`: **null** — no published waiver; positioned as a Private Banking benefit.
- Confidence: **medium** — fee figures are unambiguous; the relationship-balance threshold is the current-account leg of a two-track Priority eligibility.

### JS PayPak Classic Debit Card (debit / classic)

- `minimum_monthly_salary_pkr`: **null** — verified.
- `minimum_account_balance_pkr`: **null**.
- `annual_fee_pkr`: **1,500** — corrected from `1,200` (Jul-Dec 2025 value). Jan-Jun 2026 SOC Section A.xiii.
- `joining_fee_pkr`: **1,000** — added.
- `supplementary_annual_fee_pkr`: **750** — added.
- Booleans: `existing_account_required` true; `pakistani_cnic_required` true.
- Confidence: **high**.
- Notes: This card likely duplicates "PayPak Classic Debit Card"; the SOC only has one PayPak debit product line.

### Mastercard Her Titanium Debit Card (debit / titanium)

- `minimum_monthly_salary_pkr`: **null** — verified.
- `minimum_account_balance_pkr`: **null**.
- `minimum_average_balance_pkr`: **50,000** — verified against jsbl.com/her-finances/ ("Services Offered on Maintenance of Average Balance of PKR 50,000") and SOC Section iii JS HER Current Account.
- `annual_fee_pkr`: **3,500** — corrected from `0`. The standalone published annual fee is Rs. 3,500 (Mastercard Titanium row in Jan-Jun 2026 SOC); the waiver is what produces the de facto Rs. 0 for HER account holders.
- `joining_fee_pkr`: **1,000** — added.
- `supplementary_annual_fee_pkr`: **1,750** — added.
- `annual_fee_waiver_rule`: paraphrased verbatim from SOC: free on JS HER Current Account at PKR 50,000 monthly average balance.
- Booleans: `existing_account_required` true; `pakistani_cnic_required` true.
- Confidence: **high**.

### Mastercard Platinum Debit Card (debit / platinum)

- `minimum_monthly_salary_pkr`: **null** — verified.
- `minimum_account_balance_pkr`: **null**.
- `minimum_average_balance_pkr`: **150,000** — verified against JS Platinum Business Current Account page ("150,000 Over the Past Three Months") and SOC Fee Waivers Section i.
- `annual_fee_pkr`: **7,000** — corrected from `3,000` (Jul-Dec 2025 value). Jan-Jun 2026 SOC Section A.iii Mastercard Platinum.
- `joining_fee_pkr`: **1,000** — added.
- `supplementary_annual_fee_pkr`: **3,500** — added.
- `annual_fee_waiver_rule`: verified verbatim from JS Platinum Business Current Account page and SOC.
- Confidence: **high**.

### Mastercard Titanium Debit Card (debit / titanium)

- `minimum_monthly_salary_pkr`: **null** — verified.
- `minimum_account_balance_pkr`: **null**.
- `annual_fee_pkr`: **3,500** — corrected from `1,200`. Jan-Jun 2026 SOC Section A.iii Mastercard Titanium.
- `joining_fee_pkr`: **1,000** — added.
- `supplementary_annual_fee_pkr`: **1,750** — added.
- `annual_fee_waiver_rule`: **null** — no standalone waiver published (the HER variant has its own waiver).
- Confidence: **high**.

### Private Banking Visa Signature Credit Card (credit / signature)

- `minimum_monthly_salary_pkr`: **null** — verified (Private Banking is balance-gated, not salary-gated).
- `minimum_account_balance_pkr`: **null**.
- `minimum_relationship_balance_pkr`: **3,000,000** — added (Priority Banking proposition; inherits current-account threshold).
- `annual_fee_pkr`: **20,000** — verified against the JS Signature KFS and Jan-Jun 2026 SOC Section F (PB Signature Credit Card).
- `joining_fee_pkr`: **0** — added (KFS: "No Card Issuance or Joining Fee").
- `supplementary_annual_fee_pkr`: **8,000** — added per Signature KFS.
- `annual_fee_waiver_rule`: verified verbatim ("Reduced fee of PKR 7,700 charged on spending PKR 150,000 within 1 month of card activation.").
- Booleans: `existing_account_required` true (Private Banking customer relationship is the eligibility lever).
- Confidence: **high**.

### Visa Gold Credit Card (credit / gold)

- `minimum_monthly_salary_pkr`: **70,000** — corrected from `null`. The product comparison table on jsbl.com lists Rs. 70,000 for JS Gold (which is the same card).
- `minimum_account_balance_pkr`: **null**.
- `annual_fee_pkr`: **8,500** — corrected from `5,000`. Jan-Jun 2026 SOC Section A.ii Gold and KFS both list Rs. 8,500.
- `joining_fee_pkr`: **0** — added.
- `supplementary_annual_fee_pkr`: **3,500** — added.
- `annual_fee_waiver_rule`: corrected to **"Reduced fee of PKR 1,800 charged on spending PKR 50,000 within 1 month of card activation."** — the previous "Rs. 2,000 reduced fee" was a stale value.
- Booleans: same as Classic / Platinum.
- Confidence: **high**.

## Cross-card observations

- **Schedule of Charges has changed materially between Jul-Dec 2025 and Jan-Jun 2026** for debit-card fees:
  - Mastercard Gold: 1,650 -> 2,500
  - Mastercard Titanium: 1,200 -> 3,500
  - Mastercard Platinum: 3,000 -> 7,000
  - Mastercard World: 17,000 (unchanged)
  - PayPak: 1,200 -> 1,500
  Credit-card annual fees for Classic / Gold / Platinum / Signature are unchanged across the two SOCs.
- JS Bank does not publish a salary threshold for any debit card; salary on every debit card stays `null`. The PKR 70,000 salary threshold appears only on the credit-card comparison table and is shared across Classic / Gold / Platinum.
- Account-linked debit cards inherit eligibility from the account product. Pattern of waiver paths:
  - PayPak debit -> JS Inclusive (free) or JS Elite (free); JS Asaan opens at PKR 100 with no monthly average required, but the PayPak annual fee still applies.
  - Mastercard Gold debit -> JS Premier Raabta (PKR 150,000), JS Elite Plus, JS L/CY.
  - Mastercard Titanium debit (HER variant) -> JS HER Current Account (PKR 50,000).
  - Mastercard Platinum debit -> JS Platinum Business Current Account (PKR 150,000).
  - Mastercard World debit -> JS Private Banking / JS Priority Banking (PKR 3M current or PKR 8M savings).
- The pilot's "Visa Gold Credit Card" was carrying Classic-tier numbers (Rs. 5,000 / Rs. 2,000). Corrected to Gold-tier values.
- The pilot listed both "PayPak Classic Debit Card" and "JS PayPak Classic Debit Card" — these appear to be the same card; both rows now share the same numbers from the Jan-Jun 2026 SOC.

## Gaps / unresolved

- JS PLS Savings Account page still advertises "Free MasterCard Gold debit card annual fee" but no numeric balance threshold is published on the page itself, and the Jan-Jun 2026 SOC does not list a PLS-specific Gold-debit waiver. Documented threshold for Gold-debit waiver re-anchored to JS Premier Raabta (PKR 150,000).
- No published maximum age on any JS Bank card or account page.
- Document requirements (CNIC, salary slip, bank statement) are not explicitly enumerated on the credit-card product page; modelled as `income_document_required: true` and `pakistani_cnic_required: true` based on the KFS reference to "proof of income" and standard Pakistani credit-card practice.
- One JS Bank blog article quotes PKR 40,000 as the salary minimum; the official credit-card product page quotes PKR 70,000. Treated the product page as authoritative.
