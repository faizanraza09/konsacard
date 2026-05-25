# Al Baraka Bank (Pakistan) — Verification Log (2026-05-25)

**Bank slug:** `al-baraka`
**Pilot file:** `data/card-requirements/work/al-baraka-pilot.json`
**Cards in scope:** 8

## Sources consulted

- https://www.albaraka.com.pk/ — bank home / navigation
- https://www.albaraka.com.pk/page/schedule-of-charges/ — SOC index
- https://www.albaraka.com.pk/uploads/Al-Baraka-Current-Accounts.pdf — Jan–Jun 2026 KFS for current accounts (full debit-card fee row table on page 2)
- https://www.albaraka.com.pk/uploads/Al-Baraka-Saving-Accounts.pdf — Jan–Jun 2026 KFS for saving accounts (full debit-card fee row table on page 2, plus account opening balances on page 1)
- https://www.albaraka.com.pk/uploads/Al-Baraka-Employee-Banking-Payroll-Current-Accounts.pdf — Jan–Jun 2026 Payroll KFS (Basic/Plus/Executive); shows which debit-card tiers are free under each payroll variant
- https://www.albaraka.com.pk/uploads/Al-Baraka-SOC-Jan-June-2025-English.pdf — Jan–Jun 2025 Schedule of Bank Charges (Tier-1 → Tier-2 Gold Debit Card waiver text on page 7; Freelancer footnote for free Classic Mastercard at MAB 100k)
- https://www.albaraka.com.pk/uploads/Schedule-of-Charges-(Jul-Dec-2026)-English.pdf — Jul–Dec 2026 SOC (forthcoming): page 5 lists all debit-card annual fees and explicitly states "Issuance of Debit Card: Free"; page 7 lists Shafqaat / Business Plus / Consumer Business Partner / Banaat first-year PayPak free benefits
- https://www.albaraka.com.pk/page/al-baraka-debit-mastercard/ — Mastercard debit product page (markets Silver and Gold tiers)
- https://www.albaraka.com.pk/page/al-baraka-platinum-debit-mastercard/ — Platinum Mastercard product page
- https://www.albaraka.com.pk/page/al-baraka-unionpay-debit-card/ — UnionPay debit product page (markets Silver and Gold tiers)
- https://www.albaraka.com.pk/page/al-baraka-paypak/ — PayPak debit product page
- https://www.albaraka.com.pk/page/al-baraka-aura-card/ — Aura women's debit card product page
- https://www.albaraka.com.pk/page/al-baraka-tifl-young-savers-account/ — Tifl Young Savers Account page (1 day–18 years, PKR 100 opening, NIL minimum)
- https://www.albaraka.com.pk/page/al-baraka-banaat-account/ — Banaat women's account (PKR 5,000 opening, PayPak free at MAB 10K)
- https://www.albaraka.com.pk/page/al-baraka-mahana-barkah-account/ — Mahana Barkah account (PKR 10,000 opening)
- https://www.albaraka.com.pk/page/al-baraka-asaan-account/ — Asaan account (PKR 100 opening)

## Card-by-card verification

### UnionPay Classic Debit Card

- `card_type` / `tier`: debit / classic — verified.
- `minimum_monthly_salary_pkr`: **null** — corrected from `0` — methodology rule (silence is not zero); no salary threshold ever published for this card.
- `minimum_account_balance_pkr`: **null** — corrected from `0` — same reason; bank does not publish a card-specific balance threshold.
- `annual_fee_pkr`: **2500** — verified — matches Jan-Jun 2026 current-account KFS p.2 row "Classic Union Pay Int. — PKR 2,500/-" and saving-account KFS p.2.
- `joining_fee_pkr`: **0** — newly added — Jul-Dec 2026 SOC p.5 section 6.i.a "Issuance of Debit Card: Free".
- `annual_fee_waiver_rule`: **null** — verified; no card-specific waiver published.
- `minimum_age_years` / `maximum_age_years`: null / null — verified, not published per-card.
- `income_document_required`: null. `salary_transfer_required`: false. `pakistani_cnic_required`: true (universal account-opening requirement). `existing_account_required`: true (debit card is account-linked).
- Confidence: high — fee figure is unambiguous in two independent KFS PDFs.
- Notes / conflicts: Bank product page calls this card "Al Baraka UnionPay Silver Debit Card" while the KFS fee table labels it "Classic Union Pay Int." The pilot retains both Classic and Silver entries because the product page exposes both naming. Forthcoming Jul-Dec 2026 SOC raises this fee to PKR 2,800.

### UnionPay Gold Debit Card

- `card_type` / `tier`: debit / gold — verified.
- `minimum_monthly_salary_pkr`: **null** — verified — no salary requirement published.
- `minimum_account_balance_pkr`: **null** — moved to `minimum_average_balance_pkr`.
- `minimum_average_balance_pkr`: **100000** — verified — Jan-Jun 2025 SOC p.7 and Jul-Dec 2026 SOC p.7 both state "A 'Tier-1' customer can be upgraded to 'Tier-2' on the basis of maintaining previous Monthly Average Balance of PKR 100k, however the customer will have to wait for at least 03 months while maintaining Monthly Average Balance of 100K before they can avail Gold Debit Card free waiver." The bank's own term is Monthly Average Balance, so the value is recorded under `minimum_average_balance_pkr` (was `minimum_account_balance_pkr`).
- `annual_fee_pkr`: **3500** — verified — matches both Jan-Jun 2026 KFS rows "Gold Union Pay Int. — PKR 3,500/-".
- `joining_fee_pkr`: **0** — newly added — SOC "Issuance of Debit Card: Free".
- `annual_fee_waiver_rule`: **"Free for Tier-2 customers who maintain a Monthly Average Balance of PKR 100,000 for 3 consecutive months (per Al Baraka SOC)."** — paraphrased from SOC p.7. Previous pilot wording was close; refined to use the bank's exact "Tier-2 / 3 consecutive months" language.
- `minimum_age_years` / `maximum_age_years`: null / null — not published per-card.
- `income_document_required`: null. `salary_transfer_required`: false. `pakistani_cnic_required`: true. `existing_account_required`: true.
- Confidence: high — KFS + SOC both cite the same threshold.
- Notes: forthcoming Jul-Dec 2026 SOC raises this fee to PKR 4,000.

### Mastercard Platinum Debit Card

- `card_type` / `tier`: debit / platinum — verified.
- `minimum_monthly_salary_pkr`: **null** — verified — not published.
- `minimum_account_balance_pkr`: **null** — corrected from `100000` — the SOC tier-upgrade waiver text on p.7 of both Jan-Jun 2025 and Jul-Dec 2026 SOC explicitly mentions only the **Gold** Debit Card. There is no Platinum-tier balance threshold or waiver published. The previous pilot value was an unsourced inheritance from the Gold rule.
- `annual_fee_pkr`: **10000** — verified — Jan-Jun 2026 KFS p.2 row "Platinum MasterCard — PKR 10,000/-".
- `joining_fee_pkr`: **0** — newly added — SOC "Issuance of Debit Card: Free".
- `annual_fee_waiver_rule`: **null** — corrected from `"Waived if PKR 100,000 maintained for 3 consecutive months"`. That rule is the Gold waiver and does NOT apply to Platinum per source review.
- `minimum_age_years` / `maximum_age_years`: null / null.
- `income_document_required`: null. `salary_transfer_required`: false. `pakistani_cnic_required`: true. `existing_account_required`: true.
- Confidence: high — fee is unambiguous; waiver correction is a deliberate removal because no Platinum waiver exists in any source.
- Notes: forthcoming Jul-Dec 2026 SOC raises Platinum to PKR 12,000.

### PayPak Standard Debit Card

- `card_type` / `tier`: debit / other — verified.
- `minimum_monthly_salary_pkr`: **null** — corrected from `0` per methodology.
- `minimum_account_balance_pkr`: **null** — corrected from `0` per methodology.
- `annual_fee_pkr`: **2200** — verified — Jan-Jun 2026 KFS row "Paypak Standard — PKR 2,200/-" in both current and saving KFS.
- `joining_fee_pkr`: **0** — newly added — SOC "Issuance of Debit Card: Free".
- `annual_fee_waiver_rule`: **"First-year fee waived for Shafqaat, Banaat, Consumer Business Partner, and Business Plus account holders maintaining the published MAB threshold (per Jan-Jun 2025 / Jul-Dec 2026 SOC)."** — newly added; sourced from Jul-Dec 2026 SOC p.7 sections 1 (Shafqaat MAB 10K), 2 (Business Plus Tier-1 MAB 25K), 3 (Consumer Business Partner MAB 25K), 4 (Banaat MAB 10K), each listing "Free ATM/Debit Card (Paypak) for the first year".
- `minimum_age_years` / `maximum_age_years`: null / null.
- `income_document_required`: null. `salary_transfer_required`: false. `pakistani_cnic_required`: true. `existing_account_required`: true.
- Confidence: high.
- Notes: forthcoming Jul-Dec 2026 SOC raises this fee to PKR 2,500.

### Mastercard Gold Debit Card

- `card_type` / `tier`: debit / gold — verified.
- `minimum_monthly_salary_pkr`: **null** — verified.
- `minimum_account_balance_pkr`: **null** — moved to `minimum_average_balance_pkr`.
- `minimum_average_balance_pkr`: **100000** — verified — same SOC Tier-2 / Gold Debit Card waiver text used for the UnionPay Gold card. The waiver is tier-wide; both Gold cards (UnionPay and Mastercard) share the same balance requirement to qualify for the free-card benefit.
- `annual_fee_pkr`: **4500** — verified — Jan-Jun 2026 KFS row "Gold MasterCard — PKR 4,500/-" in both current and saving KFS.
- `joining_fee_pkr`: **0** — newly added — SOC "Issuance of Debit Card: Free".
- `annual_fee_waiver_rule`: **"Free for Tier-2 customers who maintain a Monthly Average Balance of PKR 100,000 for 3 consecutive months (Al Baraka SOC Gold Debit Card waiver)."** — refined wording.
- `minimum_age_years` / `maximum_age_years`: null / null.
- Booleans: salary_transfer_required=false, pakistani_cnic_required=true, existing_account_required=true. Income doc null.
- Confidence: high.
- Notes: forthcoming Jul-Dec 2026 SOC raises this fee to PKR 5,000. The Jan-Jun 2026 Payroll KFS shows the Executive tier of Al Baraka Payroll Account receives the Gold Mastercard FREE.

### Mastercard Silver Debit Card

- `card_type` / `tier`: debit / silver — verified (product-page naming).
- `minimum_monthly_salary_pkr`: **null** — corrected from `0` per methodology.
- `minimum_account_balance_pkr`: **null** — corrected from `10000`. The previous pilot value came from older material; no current KFS or product page restates a Silver-tier balance threshold. The Freelancer-Account footnote (free Classic Mastercard at MAB 10K) is captured as a waiver rule, not a hard balance prerequisite.
- `annual_fee_pkr`: **3200** — verified — Jan-Jun 2026 KFS row "Classic MasterCard — PKR 3,200/-". (Note: product page markets this tier as "Al Baraka Silver debit Mastercard"; KFS calls it "Classic".)
- `joining_fee_pkr`: **0** — newly added.
- `annual_fee_waiver_rule`: **"Free for Freelancer (ESFCA) account customers maintaining MAB of PKR 10,000 and above; free for Plus-tier Payroll Account holders (per Jan-Jun 2026 Payroll KFS)."** — corrected from the vague `"Waiver available for specific savings account holders"`. Sourced to the Jan-Jun 2026 saving-account KFS footnote 11 and the Jan-Jun 2026 Payroll KFS p.2 row showing Classic MasterCard FREE for Payroll Plus.
- `minimum_age_years` / `maximum_age_years`: null / null.
- Booleans: salary_transfer_required=false, pakistani_cnic_required=true, existing_account_required=true.
- Confidence: high.
- Notes: forthcoming Jul-Dec 2026 SOC raises this fee to PKR 3,500.

### UnionPay Silver Debit Card

- `card_type` / `tier`: debit / silver — verified (product-page naming).
- `minimum_monthly_salary_pkr`: **null** — corrected from `0`.
- `minimum_account_balance_pkr`: **null** — corrected from `0`.
- `annual_fee_pkr`: **2500** — verified — same KFS row as UnionPay Classic ("Classic Union Pay Int. — PKR 2,500/-"). The bank's product page lists "Silver" and "Gold" UnionPay tiers; the KFS lists "Classic" and "Gold" fee rows. Silver and Classic appear to be the same product under two marketing names, but the pilot retains both since the product page exposes both.
- `joining_fee_pkr`: **0** — newly added.
- `annual_fee_waiver_rule`: **null** — verified.
- Booleans: salary_transfer_required=false, pakistani_cnic_required=true, existing_account_required=true.
- Confidence: medium — because of the Silver-vs-Classic ambiguity.
- Notes: forthcoming Jul-Dec 2026 SOC raises this fee to PKR 2,800.

### Nexgen Student PayPak Debit Card

- `card_type` / `tier`: debit / other — verified.
- `minimum_monthly_salary_pkr`: **null** — corrected from `0` per methodology.
- `minimum_account_balance_pkr`: **100** — verified — Jan-Jun 2026 saving-account KFS p.1 lists Tifl-Young Savers Account "To open PKR 100, To keep NIL". Tifl is the only Al Baraka deposit product covering the underage segment, and the product page explicitly accepts ages 1 day–18 years.
- `annual_fee_pkr`: **2200** — verified — Jan-Jun 2026 KFS row "Paypak NexGen — PKR 2,200/-".
- `joining_fee_pkr`: **0** — newly added.
- `annual_fee_waiver_rule`: **null** — verified; no waiver published for this card variant.
- `minimum_age_years`: **0** — newly added — Tifl page says "any child and teenager aged between one day and 18 years"; recorded as 0 to indicate the linked-account floor.
- `maximum_age_years`: **18** — newly added — same source.
- `income_document_required`: false (linked to minors' account). `salary_transfer_required`: false. `pakistani_cnic_required`: true (B-Form/CNIC of guardian; CNIC of customer at adulthood). `existing_account_required`: true (linked to the Tifl account).
- Confidence: medium — because Al Baraka does not publish a card-specific KFS for NexGen; the Tifl linkage is the strongest publicly available eligibility anchor.
- Notes: Jul-Dec 2026 SOC re-labels this "NexGen Banking PayPak Debit Card" and raises the fee to PKR 2,500.

## Cross-card observations

- **Card naming inconsistency.** Bank product pages still use "Silver" / "Gold" for both Mastercard and UnionPay; the Jan-Jun 2026 KFS uses "Classic" / "Gold". For UnionPay, the Silver and Classic entries refer to the same fee row (PKR 2,500); for Mastercard, Silver and Classic refer to the same fee row (PKR 3,200). The pilot keeps Silver entries because the product page exposes them, but confidence is medium for those records.
- **Gold-tier shared waiver.** The SOC's "Tier-1 → Tier-2 by maintaining MAB of PKR 100K for 3 months" waiver applies to **the Gold Debit Card only** (the SOC literally names it). No Platinum waiver exists. Both UnionPay Gold and Mastercard Gold qualify under the same Tier-2 rule.
- **Issuance is free, annual fee is not.** Jul-Dec 2026 SOC p.5 section 6.i.a explicitly states "Issuance of Debit Card: Free", so joining/issuance fee is PKR 0 across all variants. The published Rupee fee is the annual fee.
- **Six-month fee cycle.** Every variant's annual fee changes in the Jul-Dec 2026 SOC (typically +PKR 300–2,000). Pilot retains the Jan-Jun 2026 KFS values because that schedule is in force on the 2026-05-25 verification date.
- **First-year PayPak free for segment accounts.** Shafqaat, Banaat, Consumer Business Partner, and Business Plus all give a first-year free PayPak (at the published MAB) per Jul-Dec 2026 SOC p.7.
- **Al Baraka has no consumer credit-card catalogue.** As a fully Shariah-compliant bank, Al Baraka Pakistan does not issue conventional or Islamic consumer credit cards. The full card universe is debit-only.

## Gaps / unresolved

- **Aura debit card** (PKR 3,000 Jan-Jun 2026 / PKR 2,500 Jul-Dec 2026) appears in the official KFS and has its own product page (women-segment), but is not present in the pilot. Recorded in `gaps[]`.
- **FCY MasterCard** (USD 15 annual) appears in both KFS but is excluded from the pilot (FCY-only product). Recorded in `gaps[]` implicitly.
- **Salary thresholds**: Al Baraka does not publish a salary requirement for any debit card; all such fields stay null.
- **Age**: only the Tifl-linked NexGen has a published age window (0–18); all other cards remain null.
- **Income document, CNIC, account-linkage booleans**: derived from universal Al Baraka account-opening rules (Pakistani residents only for most accounts, CNIC required); income docs are not per-card published, kept null.
