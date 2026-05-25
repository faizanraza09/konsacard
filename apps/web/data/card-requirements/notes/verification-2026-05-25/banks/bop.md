# The Bank of Punjab (BOP) - Verification Log (2026-05-25)

**Bank slug:** `bank-of-punjab`
**Pilot file:** `data/card-requirements/work/bop-pilot.json`
**Cards in scope:** 14

## Sources consulted

- https://www.bop.com.pk/BOPCreditCards - top-level credit card landing (lists six credit cards)
- https://www.bop.com.pk/view.aspx?id=3373 - credit card fee table and spend-based fee reversal rules
- https://www.bop.com.pk/view.aspx?id=3374 - credit card FAQs (only mentions limit "based on factors such as income, net worth, and creditworthiness"; no published salary/age)
- https://www.bop.com.pk/view.aspx?id=3381 - BOP Lahore Qalandars Debit Card product page
- https://www.bop.com.pk/view.aspx?id=3567 - debit card landing with KHAAS/World pricing tiers
- https://www.bop.com.pk/view.aspx?id=3360 - KHAAS Platinum debit-card detail page (transaction limits, "Free Platinum KHAAS Card (Annual Fee waiver only if customer is marked as 'Priority')")
- https://www.bop.com.pk/BOP%20Khaas%20Banking%20-%20Introduction - KHAAS proposition (eligibility, PKR 2M current / PKR 3M saving / PKR 500K salary)
- https://www.bop.com.pk/BOP%20KHAAS%20Monthly%20Saving%20Account - KHAAS Monthly Saving Account ("monthly salary of PKR 500k or more" OR "PKR 3 million relationship balance", initial deposit PKR 500K)
- https://www.bop.com.pk/Documents/Resource_Center/con%20SOBC%20-%20English%20-%20Jan-June%20%202026.pdf - **current canonical SOBC (Jan-Jun 2026)**, Section M-1 (debit cards), Section O (credit cards), Section R-9 (BOP@Work payroll waivers), Section R-10 (KHAAS waivers)
- https://www.bop.com.pk/Documents/Resource_Center/con%20SOBC%20English%20Version%20%2001-07-2025.pdf - H2-2025 SOBC; cross-referenced and flagged as superseded (temporary reduced pricing was reverted in Jan-Jun 2026 SOBC)
- https://www.bop.com.pk/Documents/Resource_Center/Combined%20KFS%20conventional.pdf - Combined KFS for Current/Saving/Term Deposit - lists Classic 2,800 / Gold 3,600 / Platinum 6,000 / PayPak 1,850 / Lahore Qalandars 3,000 / World 18,000 supp 9,000
- https://www.bop.com.pk/Documents/Resource_Center/Revised%20Debit%20Card%20Application%20Form%20%28Conventional%29.pdf - BOP Debit Card Application Form; confirms debit cards are tied to an existing BOP current/saving account
- https://www.bop.com.pk/BOPNaaz - Naaz proposition page (free debit card with Naaz Current, PKR 50K monthly avg balance for embedded insurance)
- https://www.bop.com.pk/Documents/Resource_Center/BOPKFS/RBG/English/BOP%20NAAZ%20%28Current%20Account%29.pdf - Naaz Current Account KFS: "NAAZ Card Issuance: Free; Renewal / Replacement Charges: PKR 2,400 P.A, Supplementary: 1,100"
- https://www.bop.com.pk/Documents/Resource_Center/BOPKFS/ISL/English/Current%20Account%20PKR%2032%20%281%29.pdf - Taqwa Islamic Current Account KFS (Jan 01 - Jun 30, 2026), lists Taqwa Platinum 6,000/2,500, KHAAS Platinum Free for priority + 6,000/3,000 for Non-Priority, World 7,500 priority / 18,000 non-priority
- https://www.bop.com.pk/Documents/Resource_Center/BOPKFS/ISL/English/TAQWA%20BOP%20at%20Work%20Remunerative%20Current%20Account%20(Form%2029).pdf - Taqwa BOP at Work KFS; no salary threshold published
- https://www.bop.com.pk/Islamic%20Products - Taqwa product list with KHAAS Islamic eligibility (PKR 3M relationship balance or PKR 500K monthly income; initial deposit PKR 500K)
- https://www.bop.com.pk/BOP%20at%20Work%20Current%20Account - confirms "Minimum Balance/ Initial Deposit: Nil"; no published salary threshold
- https://www.bop.com.pk/Eligibility%20Criteria - SME page only, no consumer credit card content

## Card-by-card verification

### BOP Mastercard Gold Credit Card

- `annual_fee_pkr`: **6,250** - verified against Jan-Jun 2026 SOBC Section O (Mastercard Gold Basic Rs. 6,250).
- `supplementary_annual_fee_pkr`: **3,125** - verified, same SOBC.
- `annual_fee_waiver_rule`: **"Spend PKR 40,000 within 60 days of issuance to reverse the annual fee (via helpline)."** - source view.aspx?id=3373.
- `minimum_monthly_salary_pkr`, `minimum_account_balance_pkr`, ages: **null (verified - not published)** - BOP FAQs (view.aspx?id=3374) only mention "limit is assigned based on factors such as income, net worth, and creditworthiness".
- `pakistani_cnic_required`: **true** added (debit card application form lists CNIC; credit card SOC implies CNIC required for any consumer card application).
- Confidence: high.

### BOP Mastercard World Credit Card (renamed from "BOP World Credit Card")

- `annual_fee_pkr`: **25,000** - verified Jan-Jun 2026 SOBC.
- `supplementary_annual_fee_pkr`: **12,500** - verified.
- `annual_fee_waiver_rule`: **"Spend PKR 1,500,000 within 12 months to reverse the annual fee."** - verified view.aspx?id=3373.
- Salary/balance/age: null, verified.
- Noted: H2-2025 SOBC briefly carried PKR 22,500/11,500; reverted in Jan-Jun 2026 SOBC.
- Confidence: high.

### BOP World Debit Card

- `annual_fee_pkr`: **18,000** standard, **7,500** KHAAS Current, **11,000** KHAAS Saving - verified Jan-Jun 2026 SOBC Section M-1 (verbatim multi-tier listing).
- `supplementary_annual_fee_pkr`: **9,000** standard / **3,300** KHAAS Current / **5,000** KHAAS Saving.
- `annual_fee_waiver_rule`: full tiered rule recorded verbatim.
- `existing_account_required`: **true** (debit card application form confirms BOP account is the linked account).
- Salary/balance: **null** (no published card-level threshold).
- Confidence: high (multi-tier explicit in SOBC).

### BOP KHAAS Platinum Debit Card

- AUDIT-FLAG VERIFIED. Both salary 500,000 and balance 2,000,000 are valid alternative entry routes, with PKR 3,000,000 as the published relationship-balance route on the Saving Account variant.
- `minimum_monthly_salary_pkr`: **500,000** - source: BOP KHAAS Monthly Saving Account page ("Client with a monthly salary of PKR 500k or more") and KHAAS Banking Introduction page.
- `minimum_account_balance_pkr`: **2,000,000** - source: KHAAS Banking Introduction ("PKR 2 Million or equivalent FCY" for Individuals/Sole Proprietors on Current Account). This is the lowest-floor entry route.
- `minimum_relationship_balance_pkr`: **3,000,000** - source: KHAAS Monthly Saving Account ("PKR 3 million in all Saving accounts").
- `annual_fee_pkr`: **0** for Priority-marked KHAAS customers; PKR 6,000 / PKR 3,000 supp for Non-Priority per Jan-Jun 2026 SOBC Section M-1 ("Issuance & renewal is free for priority customers").
- `existing_account_required`: **true** (linked to BOP KHAAS account).
- Inferred-account-relationship cite: **BOP KHAAS Current or KHAAS Monthly Saving** (both KHAAS-proposition pages cited).
- Confidence: medium (inherited from linked-account proposition, as methodology prescribes for account-linked debit cards).

### BOP Lahore Qalandars Debit Card

- `annual_fee_pkr`: **3,000** - verified Jan-Jun 2026 SOBC Section M-1 ("Lahore Qalandars Debit Card PKR 3,000/- per annum").
- `supplementary_annual_fee_pkr`: **1,400** - verified.
- `existing_account_required`: **true** (card page: "New customers can open an account in the nearest BOP branch and apply for LQDC").
- Salary/balance: **null** (corrected from previous 0 - the card page is silent on numeric thresholds; methodology requires null when silent).
- Confidence: high.

### BOP Mastercard Gold Debit Card

- `annual_fee_pkr`: **3,600** - verified Jan-Jun 2026 SOBC.
- `supplementary_annual_fee_pkr`: **1,500** - verified.
- `annual_fee_waiver_rule`: BOP@Work salary tier PKR 100,000-PKR 300,000 gets it free (SOBC Section R-9). Captured verbatim from SOBC.
- Salary/balance: **null** (corrected from 0). Existing pilot recorded 0 as a default; the card itself does not publish a salary or balance threshold. The BOP@Work tiers are payroll-bundle waivers, not card eligibility floors.
- `existing_account_required`: **true** (confirmed via debit card application form).
- Confidence: high.

### BOP Mastercard Platinum Credit Card

- `annual_fee_pkr`: **12,500** - verified.
- `supplementary_annual_fee_pkr`: **6,250** - verified.
- `annual_fee_waiver_rule`: **"Spend PKR 100,000 within 60 days of issuance to reverse the annual fee (via helpline)."** - verified.
- Salary/balance/age: null, verified.
- Confidence: high.

### BOP Mastercard Platinum Debit Card

- `annual_fee_pkr`: **6,000** - verified Jan-Jun 2026 SOBC.
- `supplementary_annual_fee_pkr`: **2,500** - verified.
- `annual_fee_waiver_rule`: BOP@Work salary > PKR 300,000 tier (SOBC Section R-9).
- Salary/balance: **null** (corrected from 0); `existing_account_required`: **true**.
- Confidence: high.

### BOP Mastercard Classic Debit Card

- `annual_fee_pkr`: **2,800** - verified.
- `supplementary_annual_fee_pkr`: **1,300** added (was missing in pilot) - verified SOBC and Combined KFS.
- `annual_fee_waiver_rule`: BOP@Work salary tier PKR 40,000-PKR 100,000; also free on Salary Plus and BOP Life Current accounts (SOBC Section R-2, R-3, R-9).
- Salary/balance: **null** (corrected from 0).
- Confidence: high.

### BOP Taqwa Platinum Islamic Debit Card

- `annual_fee_pkr`: **6,000** - verified against Taqwa Current Account KFS row "Platinum" (Issuance/Renewal/Replacement PKR 6,000 plus FED/PST, Supplementary 2,500).
- Salary/balance: **null** (corrected from 0; PKR 300K BOP@Work figure removed because Taqwa BOP@Work KFS does not publish a salary threshold either).
- Removed unsubstantiated PKR 300K salary inference; removed Taqwa Rahat Corporate KFS (corporate-only) and Taqwa BOP at Work KFS (no salary published) from sources.
- Confidence: high.

### BOP Taqwa KHAAS Platinum Islamic Debit Card

- `minimum_monthly_salary_pkr`: **500,000** - Islamic Products page ("Monthly income of PKR 500,000 or above").
- `minimum_account_balance_pkr`: **2,000,000** (KHAAS Current Account floor for individuals/sole proprietors); `minimum_relationship_balance_pkr`: **3,000,000** (KHAAS Saving relationship-balance route).
- `annual_fee_pkr`: **0** Priority; PKR 6,000 + PKR 3,000 supp Non-Priority - verified Taqwa Current Account KFS row "Platinum / Khaas ATM Platinum Card" ("Issuance & Renewal/Replacement: Zero (for priority marked customers); PKR 6,000 + Supplementary PKR 3,000 for Non-Priority customers").
- Inferred-account-relationship cite: **Taqwa KHAAS Current / Taqwa KHAAS Saving** (Islamic Products page).
- Confidence: medium.

### BOP Taqwa World Islamic Debit Card

- `annual_fee_pkr`: **18,000** standard / **7,500** Priority - verified Taqwa Current Account KFS ("World Debit Master Card: PKR 7,500 per annum (For Priority marked Accounts); PKR 18,000 per Annum (For Non-Priority Accounts)").
- `supplementary_annual_fee_pkr`: **9,000** added (was missing).
- Salary/balance: **null** (corrected from 0).
- Removed Taqwa Rahat Corporate KFS from sources (corporate-only).
- Confidence: high.

### BOP Naaz Debit Card

- `annual_fee_pkr`: **2,400** - verified Naaz Current Account KFS ("NAAZ Card Issuance: Free; Renewal / Replacement Charges: PKR 2,400 P.A").
- `supplementary_annual_fee_pkr`: **1,100** - verified.
- `annual_fee_waiver_rule`: Issuance free with Naaz Current Account; renewal/replacement chargeable per KFS.
- `minimum_account_balance_pkr`: corrected from **1,000** to **null** - previous PKR 1,000 figure was the Taqwa Naaz Saving opening amount, not a Naaz Debit Card eligibility threshold. The published Naaz Current KFS shows no numeric balance floor; PKR 50K monthly average is the insurance-benefit threshold only.
- Removed Taqwa Naaz Saving KFS from sources (Islamic-product KFS, not evidence for the conventional Naaz debit card).
- `existing_account_required`: **true**.
- Confidence: high.

### BOP Mastercard Lahore Qalandar Business Credit Card (renamed from "Lahore Qalandars Gold Credit Card")

- Card-name correction: the pilot called this "Lahore Qalandars Gold Credit Card", but bop.com.pk/view.aspx?id=3373 lists it as **"BOP Mastercard Lahore Qalandar Business Credit Card"** with no "Gold" variant.
- `annual_fee_pkr`: **5,000** - verified Jan-Jun 2026 SOBC ("Lahore Qalandar Business Credit Card: Rs. 5,000/-").
- `supplementary_annual_fee_pkr`: **2,500** added (was missing) - verified SOBC.
- `annual_fee_waiver_rule`: **"Spend PKR 70,000 within 60 days of issuance to reverse the annual fee (via helpline)."** - verified view.aspx?id=3373.
- Confidence: high.

## Cross-card observations

- **Salary/balance silence is widespread on BOP.** No consumer credit card page or FAQ surfaces a numeric minimum salary or age threshold. The bank's stated policy (FAQs view.aspx?id=3374) is that credit limit is assigned "based on factors such as income, net worth, and creditworthiness". Per the methodology, every credit-card salary/balance/age stays `null`.
- **Account-linked debit cards.** All conventional and Islamic debit cards (Classic, Gold, Platinum, KHAAS Platinum, World, Lahore Qalandars, Naaz, Taqwa variants) require an underlying BOP current/saving account (confirmed via the BOP Debit Card Application Form). `existing_account_required: true` set across all debit cards.
- **KHAAS proposition is the only place BOP publishes numeric thresholds for retail customers.** PKR 2M current-account floor for individuals/sole proprietors, PKR 3M saving-account relationship balance, PKR 500K monthly salary, PKR 500K minimum initial deposit on the Monthly Saving variant. This applies symmetrically to conventional KHAAS and Taqwa KHAAS.
- **BOP@Work payroll grid** is the only public BOP document listing salary tiers, but it allocates which debit-card tier is *issued free* to which salary band, not whether a customer can apply for a tier. These are recorded under `annual_fee_waiver_rule` for the affected debit cards.
- **SOBC versioning.** The H2-2025 SOBC (effective 01-07-2025 to 31-12-2025) briefly carried reduced pricing (Classic 2,600 / Gold 3,300 / Platinum 5,500 / World CC 22,500 / Gold CC 5,000). The current Jan-Jun 2026 SOBC reverts these to the original values, which match the Combined KFS. All annual fees in this pilot are pulled from the Jan-Jun 2026 SOBC as the canonical current source.
- **Naming corrections.** "BOP World Credit Card" -> "BOP Mastercard World Credit Card"; "Lahore Qalandars Gold Credit Card" -> "BOP Mastercard Lahore Qalandar Business Credit Card" (there is no Gold variant of the LQ credit card).
- **Null vs zero corrections.** Previous pilot used `0` for `minimum_monthly_salary_pkr` and `minimum_account_balance_pkr` on debit cards where the page was silent. These have all been corrected to `null` per the methodology ("Do not set salary to 0 just because the page is silent.").
- **Removed misleading sources.** Taqwa Rahat Corporate KFS (corporate-only), Taqwa Naaz Saving KFS (Islamic-saving, not Naaz-debit evidence), and Taqwa BOP at Work Form 30 KFS (URL returns 404; KFS does not publish a salary threshold even on Form 29) removed from card sources.

## Gaps / unresolved

- Consumer minimum monthly salary not published on any BOP credit card page or FAQ.
- Minimum age / maximum age never surfaced for any consumer credit or debit card.
- Salary-transfer requirement not published.
- Income-document requirement not published (only "factors such as income" mentioned in the FAQ).
- BOP@Work salary tiers act as payroll-bundle waivers, not card-level entry floors, so they cannot be promoted to `minimum_monthly_salary_pkr`.
- Taqwa BOP@Work KFS (Form 30) URL referenced in earlier pilot now returns 404; Form 29 (Remunerative Current) is the live replacement and still does not publish a salary threshold.
