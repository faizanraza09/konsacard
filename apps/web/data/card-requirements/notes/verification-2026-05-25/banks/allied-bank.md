# Allied Bank — Verification Log (2026-05-25)

**Bank slug:** `allied-bank`
**Pilot file:** `data/card-requirements/work/allied-bank-pilot.json`
**Cards in scope:** 13

## Sources consulted

- https://www.abl.com/personal/cards/credit-cards/allied-visa-gold-credit-card/ — (Gold credit card product page; mentions reversal text, no salary/age)
- https://www.abl.com/personal/cards/credit-cards/visa-platinum-credit-card/ — (Platinum credit card product page; same shape as Gold)
- https://www.abl.com/wp-content/uploads/2025/07/Allied-Visa-Credit-Card-Summary-Box-Q2-2025_30-06-25_05-03-56-1.pdf — (Q2 2025 Credit Card Summary Box; effective Jul 1, 2025: annual fees, supplementary fees, APR, reversal rules)
- https://www.abl.com/wp-content/uploads/2025/05/Schedule-of-Charges-July-Dec-2025-Conventional-Banking.pdf — (Jul-Dec 2025 conventional SOC)
- https://www.abl.com/wp-content/uploads/2025/11/Schedule-of-Charges-Jan-Jun-2026-Conventional-Banking-1.pdf — (Jan-Jun 2026 conventional SOC; current)
- https://www.abl.com/personal/cards/debit-cards/ — (debit card landing page; lists 10 active variants)
- https://www.abl.com/personal/cards/debit-cards/visa-premium-debit-card/ — (Premium Debit; current English eligibility text — 4 paths, no income path)
- https://www.abl.com/ur/personal/cards/debit-cards/visa-premium-debit-card/ — (Premium Debit Urdu mirror; still has 5 paths including PKR 5M annual income)
- https://www.abl.com/personal/cards/debit-cards/foreign-currency-visa-debit-cards-for-roshan-digital-and-foreign-currency-accounts/ — (FCY Visa Debit Cards; corroborates Premium eligibility)
- https://www.abl.com/personal/cards/debit-cards/visa-platinum-debit-card/ — (Platinum Debit; annual income PKR 1M or balance PKR 300k)
- https://www.abl.com/personal/cards/debit-cards/visa-infinite-debit-card/ — (Infinite Debit; PKR 5M / 10M balance paths and Rs. 8,000 non-maintenance)
- https://www.abl.com/personal/cards/debit-cards/allied-visa-classic-debit-card/ — (Visa Classic Debit; account-holder based)
- https://www.abl.com/personal/cards/debit-cards/allied-unionpay-paypak-gold-debit-card/ — (UPI/PayPak Gold; annual income Rs. 500,000 or balance Rs. 100,000)
- https://www.abl.com/personal/cards/debit-cards/allied-unionpay-paypak-classic-debit-card/ — (UPI/PayPak Classic; Asaan + Regular)
- https://www.abl.com/personal/cards/debit-cards/allied-basic-debit-card/ — (Basic Debit; illiterate/photo-account categories)
- https://www.abl.com/personal/cards/debit-cards/temporary-limit-enhancement-on-abl-debit-card/ — (Classic Plus limits)
- https://www.abl.com/personal/accounts/exclusive-account/allied-youth-account/ — (Allied Youth Account; ages 18-35, balance 10k/50k)

## Card-by-card verification

### Allied Visa Gold Credit Card

- `card_type` / `tier`: credit / gold — verified.
- `minimum_monthly_salary_pkr`: **null** — verified (not published on product page or Summary Box).
- `minimum_account_balance_pkr`: **null** — verified (not published).
- `annual_fee_pkr`: **2,500** — verified against Q2 2025 Summary Box ("Gold Card Rs. 2,500/-") and Jan-Jun 2026 SOC line F.1.(b).(i).
- `joining_fee_pkr`: **0** — added; Summary Box says "No Card Issuance or Joining Fee".
- `supplementary_annual_fee_pkr`: **600** — added; Summary Box says "Annual Membership Fee – Supplementary Card – Gold Card Rs. 600/-".
- `annual_fee_waiver_rule`: **"Annual Membership Fee reversed on spending Rs. 25,000 through the card within 3 months."** — verified from Summary Box.
- `minimum_age_years` / `maximum_age_years`: null / null — not published.
- `pakistani_cnic_required`: true (signature box on the Summary Box requires Customer's CNIC No.).
- Confidence: medium — fee fields are clean; salary/balance/age remain unpublished.

### Allied Visa Platinum Credit Card

- `annual_fee_pkr`: **5,000** — verified (Summary Box and Jan-Jun 2026 SOC).
- `joining_fee_pkr`: **0** — added (Summary Box: no joining fee).
- `supplementary_annual_fee_pkr`: **1,200** — added (Summary Box: "Platinum Card Rs. 1,200/-").
- `annual_fee_waiver_rule`: **"Annual Membership Fee reversed on spending Rs. 50,000 through the card within 3 months."** — verified.
- All other fields same shape as Gold — unpublished.
- Confidence: medium — same reasoning as Gold.

### Allied UnionPay & PayPak Gold Debit Card

- `minimum_monthly_salary_pkr`: **41,667** — verified (PKR 500,000 annual income ÷ 12 from product page).
- `minimum_account_balance_pkr`: **100,000** — verified.
- `annual_fee_pkr`: **3,000** — **corrected from 2,900 to 3,000**. SOC line "UPI & PayPak Gold & Visa Sapphire — Annual Fee / Issuance Fee / Renewal Fee Rs. 3,000/-" in both Jul-Dec 2025 and Jan-Jun 2026 SOC.
- Confidence raised to high.

### Allied Visa Premium Debit Card

- `minimum_monthly_salary_pkr`: **null** — **corrected from 416,667 to null**. Current English product page no longer lists the "PKR 5M annual income" path; it only lists deposit/investment/loan/executive paths. The 5M path still appears on the Urdu mirror — flagged as drift, not adopted.
- `minimum_deposit_pkr`: **2,000,000** — verified (English product page: "minimum deposit of PKR 2 million in a Current, Savings, Term Deposit, or equivalent in FCY").
- `annual_fee_pkr`: **19,500** — verified (both SOCs).
- `supplementary_annual_fee_pkr`: **15,000** — added (Jan-Jun 2026 SOC; was Rs. 13,750 in Jul-Dec 2025 SOC).
- `annual_fee_waiver_rule`: **"Annual fee waiver if customer maintains a daily average balance of PKR 500,000 in a Current Account or PKR 1,000,000 in a Savings Account over the last 11 months."** — verified verbatim from product page.
- Confidence: medium — the eligibility-path drift between English and Urdu is the main risk.

### Allied Visa Platinum Debit Card

- `minimum_monthly_salary_pkr`: **83,333** — verified (PKR 1,000,000 annual ÷ 12).
- `minimum_account_balance_pkr`: **300,000** — verified.
- `annual_fee_pkr`: **6,000** — verified (both SOCs).
- `supplementary_annual_fee_pkr`: **3,300** — **corrected from null to 3,300** per Jan-Jun 2026 SOC (was Rs. 3,000 in Jul-Dec 2025 SOC).
- Confidence raised to high.

### Allied Visa Infinite Debit Card

- `minimum_monthly_salary_pkr`: **null** — **corrected from 0 to null**. The card is balance/deposit-gated, not salary-gated; the product page is silent on salary, so silence should not be encoded as "0 required".
- `minimum_account_balance_pkr`: **5,000,000** — verified.
- `annual_fee_pkr`: **0** — verified ("Free" in both SOCs).
- `annual_fee_waiver_rule`: updated to make the full mechanism explicit (Rs. 8,000/month non-maintenance fee, 3-month downgrade).
- Confidence raised to high.

### Allied Visa Classic Debit Card

- `annual_fee_pkr`: **2,900** — verified against both SOCs ("Allied Visa Debit Cards - Primary - Classic Rs. 2,900/-").
- `minimum_account_balance_pkr`: **1,000** — verified (inherits from LCY current/savings account).
- All else unchanged; existing_account_required set to true.

### Allied UnionPay PayPak Classic Debit Card

- `annual_fee_pkr`: **2,800** — verified (both SOCs, "UPI & PayPak Classic Rs. 2,800/-").
- All else unchanged.

### Allied UPI & PayPak Classic Plus

- `annual_fee_pkr`: **2,900** — verified (both SOCs, "UPI & PayPak Classic Plus Rs. 2,900/-").
- No standalone product page; reconstructed via SOC + temporary-limit-enhancement page.

### Allied Basic Debit Card

- `annual_fee_pkr`: **2,000** — verified (both SOCs, "Basic Debit Card Rs. 2,000/-").
- SOC also explicitly states "Illiterate customers can apply for ABL Basic Debit Card only" — preserved in notes.

### Allied Youth Visa Debit Card

- `minimum_age_years`: **18** — added (Allied Youth Account page).
- `maximum_age_years`: **35** — added (Allied Youth Account page).
- `minimum_account_balance_pkr`: **10,000** — verified (18-25 tier; 26-35 tier is Rs. 50,000, called out in notes). Both confirmed in the Jan-Jun 2026 SOC fee-exemption grid.
- `annual_fee_pkr`: **2,900** — **corrected from 2,400 to 2,900**. The SOC does not list a "Youth" debit card row separately; the Visa-branded youth card falls under "Visa Debit Cards - Primary - Classic" at Rs. 2,900. Confidence kept medium because the SOC doesn't have a dedicated youth row.

### Cash+Shop Sapphire Visa Debit Card

- `annual_fee_pkr`: **3,000** — verified (SOC "UPI & PayPak Gold & Visa Sapphire Rs. 3,000/-").
- Confidence dropped to low: this card no longer has a standalone product page on the current debit-card landing page; existing notes about transition-to-UPI-PayPak-Gold-on-renewal are corroborated by the combined SOC grouping.

### Islamic Banking VISA Debit Card

- No standalone product page exists. Allied does not publish a separately-priced "Islamic Visa Debit Card"; Islamic Banking customers get the same Visa Classic/Platinum/Premium/Infinite cards with Islamic eligibility splits (only the Infinite page makes the split explicit — PKR 10M in current for Islamic vs PKR 5M for conventional).
- `annual_fee_pkr`: **2,900** — mapped to Visa Classic Primary line in both SOCs.
- Confidence kept low — this entry effectively represents the Islamic Visa Classic equivalent.

## Cross-card observations

- **Two SOCs are in scope**: Jul-Dec 2025 and Jan-Jun 2026. The Jan-Jun 2026 SOC is current. Primary-card annual fees are identical between the two SOCs; the only deltas are supplementary fees on Platinum and Premium (both increased in Jan-Jun 2026).
- **English vs Urdu drift on Premium Debit Card**: the English page lists 4 eligibility paths; the Urdu page still lists 5 (including PKR 5M annual income). The English page is the more current source. This is what flips the salary from 416,667 to null.
- **SOC consolidation of Sapphire**: SOC bundles "UPI & PayPak Gold & Visa Sapphire" and "Platinum Debit Card & Visa Sapphire 200" — the legacy Sapphire variants share fees with their successors, confirming the transition story in earlier notes.
- **No published age threshold on any non-Youth debit card** — explicit gap.
- **Credit card eligibility (salary/age) is not publicly disclosed by Allied** — even the comprehensive Summary Box only documents fees, APR, limits, and reversal rules. Marked as a bank-level gap.

## Gaps / unresolved

- Allied Visa Gold/Platinum Credit Cards — no public salary/age threshold; would need an internal eligibility matrix to fill.
- Cash+Shop Sapphire — no current standalone product page; eligibility/balance are inferred from the linked current account.
- Islamic Banking Visa Debit Card — no dedicated card-level page; treated as the Islamic-side mirror of Visa Classic at Rs. 2,900.
- The Jan-Jun 2025 KFS LCY Current Accounts XLSX (previously cited) was not directly re-fetched in this pass; it is recorded under `sources_unreachable` for the two legacy cards. PKR 1,000 balance assumption is consistent with the ABL current account baseline.
