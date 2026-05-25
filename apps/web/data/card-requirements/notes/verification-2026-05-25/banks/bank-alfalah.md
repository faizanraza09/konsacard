# Bank Alfalah — Verification Log (2026-05-25)

**Bank slug:** `bank-alfalah`
**Pilot file:** `data/card-requirements/work/bank-alfalah-pilot.json`
**Cards in scope:** 27 (conventional + Islamic, debit + credit, Premier + Infinite + Islamic Premier)

## Sources consulted

Primary sources only — every fee or threshold below is anchored to one of these
URLs. Comparison aggregators and third-party blogs were used only as search
leads, never as evidence.

- https://www.bankalfalah.com/personal-banking/cards/credit-cards/eligibility-criteria-credit-cards/ — shared credit card eligibility table (salary, age, documents).
- https://prodbaf.blob.core.windows.net/data/KFS%20for%20Credit%20Card%20Summary%20Box%20%28Jan-Jun%202026%29.pdf — Jan-Jun 2026 Credit Card Summary Box / KFS (Classic, Gold, Optimus, Platinum, Premier Platinum, Ultra).
- https://prodbaf.blob.core.windows.net/data/AMEX%20Credit%20Card%20Summary%20Box%20%28Jan%20to%20June%202026%29.pdf — AMEX Gold Jan-Jun 2026 KFS.
- https://prodbaf.blob.core.windows.net/data/Corporate%20Card%20Summary%20Box%20%28Jan%20to%20June%202026%29.pdf — Visa Corporate Jan-Jun 2026 KFS.
- https://bafblob.blob.core.windows.net/data/annual-fee-reversal-criteria.pdf — Annual Fee Spend Reversal Criteria effective 2026-01-01 (AFRC).
- https://prodbaf.blob.core.windows.net/data/SOC%20Conventional%20English%20Black%20(Jan-Jun%202026)%2002-12-25.pdf — Conventional Schedule of Charges Jan-Jun 2026 (Sec A Pt 1 credit cards; Sec A Pt 5 debit cards; Bank Alfalah Premier section; Bank Alfalah Infinite section).
- https://prodbaf.blob.core.windows.net/data/SOC%20Islamic%20English%20Black%20(Jan-Jun%202026)%2002-12-25.pdf — Islamic Schedule of Charges Jan-Jun 2026 (Sec I Pt 1, 2, 3 — debit cards).
- https://www.bankalfalah.com/premier/eligibility-criteria/ — Premier eligibility (PKR 3M CASA / 10M AUM / 30M mortgage / 1M salary credit).
- https://www.bankalfalah.com/personal-banking/credit-cards/ — credit-card landing page (used to confirm Titanium is no longer advertised).
- https://www.bankalfalah.com/digital-banking/debit-cards/visa-classic-debit-card — Visa Classic debit product page (no income / no balance).
- https://www.bankalfalah.com/digital-banking/debit-cards/visa-gold-debit — Visa Gold debit product page.
- https://www.bankalfalah.com/digital-banking/debit-cards/visa-signature-debit — Visa Signature debit product page.
- https://www.bankalfalah.com/digital-banking/debit-cards/visa-platinum-debit-card — Visa Platinum debit product page.
- https://www.bankalfalah.com/personal-banking/cards/debit-cards/signature-debit-card/ — Signature debit eligibility (PKR 1M deposit / 12-mo average).
- https://www.bankalfalah.com/personal-banking/credit-cards/american-express-gold-credit-card — AMEX Gold product page.
- https://www.bankalfalah.com/personal-banking/credit-cards/mastercard-optimus-credit-card — Mastercard Optimus product page.
- https://www.bankalfalah.com/personal-banking/cards/credit-cards/alfalah-platinum-visa-credit-card/ — Visa Platinum credit product page.
- https://www.bankalfalah.com/personal-banking/credit-cards/visa-corporate-card — Visa Corporate product page.
- https://www.bankalfalah.com/personal-banking/credit-cards/visa-ultra-cashback-card — Ultra Cashback product page.
- https://www.bankalfalah.com/premier/credit-card/premier-visa-platinum-credit-card/ — Premier Visa Platinum credit card page ("Zero annual and issuance fee exclusively for Premier clients").
- https://www.bankalfalah.com/premier/debit-card/premier-visa-signature-debit-card/ — Premier Visa Signature debit page.
- https://www.bankalfalah.com/premier/debit-card/islamic-premier-visa-signature-debit-card/ — Islamic Premier Visa Signature debit page.
- https://www.bankalfalah.com/islamic/debit-card/alfalah-visa-islamic-classic-debit-card/ — Islamic Classic debit page.
- https://www.bankalfalah.com/islamic/debit-card/alfalah-visa-islamic-gold-debit-card/ — Islamic Gold debit page.
- https://www.bankalfalah.com/islamic/debit-card/alfalah-visa-islamic-signature-debit-card/ — Islamic Signature debit page.
- https://www.bankalfalah.com/islamic/debit-card/alfalah-islamic-power-pack-signature-debit-card/ — Islamic Power Pack Signature debit page.
- https://www.bankalfalah.com/islamic/debit-card/alfalah-paypak-islamic-classic-debit-card/ — Islamic PayPak Classic debit page.
- https://www.bankalfalah.com/islamic/debit-card/bank-alfalah-islamic-gold-women-debit-card/ — Islamic Gold Women debit page.
- https://www.bankalfalah.com/islamic/debit-card/bank-alfalah-islamic-power-pack-women-debit-card/ — Islamic Power Pack Women debit page.
- https://www.bankalfalah.com/personal-banking/deposit-accounts/alfalah-pehchaan-current-account/ — Pehchaan account ("no minimum balance requirement").
- https://www.bankalfalah.com/personal-banking/cards/credit-cards/eligibility-criteria-credit-cards/ — common credit-card eligibility (CNIC required; salary slip / bank statements).

URLs that returned HTTP 404 at verification time (recorded as gaps in the
pilot): `mastercard-titanium-credit-card`, `alfalah-paypak-debit-card`,
`alfalah-pehchaan-debit-card`, `premier/credit-card/premier-visa-infinite-credit-card/`,
`islamic-premier/eligibility-criteria/`.

## Bank-level conventions established up front

1. **Salaried vs self-employed.** The shared credit-card eligibility table
   publishes PKR 50,000 salaried and PKR 75,000 self-employed; ages 21-60
   salaried, 21-70 self-employed. We record the salaried floor as
   `minimum_monthly_salary_pkr` and the wider age envelope (21 / 70).
2. **`minimum_relationship_balance_pkr` is the right balance key for Premier
   and Infinite cards** because the qualification is segment-level, not
   per-card. `minimum_average_balance_pkr` + `minimum_deposit_pkr` are used for
   Signature-tier debit cards where the bank publishes "PKR 1M deposit OR PKR
   1M average balance" on the card page itself.
3. **Annual fee reversal is the bank-wide consumer credit-card waiver
   convention.** It is published in a single AFRC document; per-card values
   appear in the KFS Summary Box. Premier Platinum is excluded (already zero
   fee), AMEX Gold is explicitly excluded (only Premier 1st-year waiver), and
   Ultra Cashback gets only a 1st-year waiver at PKR 75,000 spend.
4. **Premier (3M CASA tier) and Infinite (150M AUM tier) are separate
   propositions.** The conventional SOC has dedicated "Bank Alfalah Premier"
   and "Bank Alfalah Infinite" sections that list every card available with
   waived fees. Two cards (Premier Visa Top Tier Debit and Premier VISA
   Signature Credit) carry an additional PKR 25M Current Account requirement.

## Card-by-card verification

### Standard conventional debit cards

#### Visa Classic Debit Card
- `annual_fee_pkr`: **3,500** — corrected from 2,900 — SOC Jan-Jun 2026 Sec A Pt 5 i.
- `supplementary_annual_fee_pkr`: **1,750** — added — same SOC line.
- Salary / balance: **0 / 0** — verified — Classic debit product page explicitly states no income / no balance.
- Age: kept null (debit-card pages do not publish age bands).
- Confidence: medium → **high**.

#### Visa Gold Debit Card
- `annual_fee_pkr`: **5,000** — verified — SOC Sec A Pt 5 i.
- `supplementary_annual_fee_pkr`: **2,500** — added — SOC same section.
- Salary / balance: **0 / 0** — verified — Gold debit product page: "No minimum income required for issuance."
- Confidence: high (kept).

#### Visa Platinum Debit Card
- `annual_fee_pkr`: **10,000** — corrected from 2,900 — SOC Sec A Pt 5 i: "Rs. 10,000/- per Platinum Debit Card Per Year."
- `supplementary_annual_fee_pkr`: **5,000** — added.
- Confidence: high. (The previous PKR 2,900 value was clearly stale — likely a Classic-card fee copied across.)

#### Visa Signature Debit Card
- `annual_fee_pkr`: **22,000** — corrected from 18,000 — SOC Sec A Pt 5 i: "Rs. 22,000/- per Signature Debit Card Per Year."
- `supplementary_annual_fee_pkr`: **11,000** — added.
- `minimum_average_balance_pkr` / `minimum_deposit_pkr`: **1,000,000 / 1,000,000** — verified — Signature card product page (PKR 1M new deposit or PKR 1M 12-mo average).
- `annual_fee_waiver_rule`: corrected — fee-free under Premier (3M+) and Infinite (150M+) sections of SOC, not just Premier.
- Confidence: medium → **high**.

### Mainstream consumer credit cards (shared eligibility grid)

All inherit the shared eligibility table (PKR 50,000 salaried, ages 21-60
salaried / 21-70 self-employed) and the spend-based AFRC.

#### Visa Classic Credit Card
- `minimum_monthly_salary_pkr`: **50,000** — verified.
- **Removed `minimum_relationship_balance_pkr: 75000`** — this value was an artifact of misreading the eligibility table. PKR 75,000 is the self-employed gross-income threshold; it is not a relationship balance. The bank publishes no balance requirement for the Classic card.
- `annual_fee_pkr` / `supplementary_annual_fee_pkr`: **7,000 / 3,500** — verified — KFS + AFRC.
- `annual_fee_waiver_rule`: kept verbatim from AFRC (PKR 70,000 / 35,000 in 2 months).
- Age: **21 / 70** (envelope). Document / CNIC / no salary transfer / no existing account flags added.
- Confidence: high (kept).

#### Visa Gold Credit Card
- Same corrections as Classic. **Removed `minimum_relationship_balance_pkr: 75000`** (same artifact). Fees PKR 13,000 / 6,500; reversal PKR 200,000 / 100,000 in 2 months. Confidence high.

#### Bank Alfalah American Express Gold Credit Card
- Fees PKR 13,000 / 6,500 — verified against AMEX KFS Jan-Jun 2026.
- `annual_fee_waiver_rule`: clarified — Premier 1st-year only; AFRC explicitly states "Bank Alfalah American Express Cardholders are not eligible for reversal under these criteria."
- Confidence: high (kept).

#### Bank Alfalah Mastercard Optimus Credit Card
- PKR 16,000 / 8,000; reversal PKR 300,000 / 150,000 — verified against KFS + AFRC. High confidence (kept).

#### Bank Alfalah Visa Platinum Credit Card
- PKR 23,000 / 11,500; reversal PKR 475,000 / 237,500 — verified against KFS + AFRC. High confidence (kept).

#### Bank Alfalah Visa Ultra Cashback Card
- `annual_fee_pkr`: **10,000** — verified — SOC Sec A Pt 1 v: "(Annual Fee) Rs. 10,000/-".
- `joining_fee_pkr`: **10,000** — added — SOC Sec A Pt 1 iv: "(Issuance Fee) Rs. 10,000/-".
- `supplementary_annual_fee_pkr`: **5,000** — added.
- `annual_fee_waiver_rule`: 1st-year only on PKR 75,000 spend in 2 months. (Ultra is excluded from ongoing AFRC.)
- Salary / age / documents: set from the shared credit-card eligibility table. Confidence high.

#### Bank Alfalah Visa Corporate Credit Card
- `annual_fee_pkr`: **6,000** — verified — Corporate KFS Jan-Jun 2026 ("Rs. 6,000/- per card from second year onwards").
- `annual_fee_waiver_rule`: corrected from null — "Year one: no annual fee. PKR 6,000 per card applies from second year onwards." This is the structural framing in the Corporate KFS.
- Salary / age inherit the shared credit-card grid. Confidence: medium → **high**.

### Premier-segment cards (3M CASA tier)

#### Bank Alfalah Premier Visa Platinum Credit Card
- `minimum_relationship_balance_pkr`: **3,000,000** — verified — Premier eligibility page (3M CASA route).
- `annual_fee_pkr`: **0** — verified — card page: "Zero annual and issuance fee exclusively for Premier clients."
- `supplementary_annual_fee_pkr`: **0** — added (complimentary up to 6).
- Salary set to **null** (Premier is relationship-gated, not salary-gated). Age 21-70 retained as the credit-card envelope.
- Confidence: medium → **high**.

#### Bank Alfalah Premier Visa Signature Debit Card
- `minimum_relationship_balance_pkr`: **3,000,000** — verified.
- `annual_fee_pkr` / `supplementary_annual_fee_pkr`: **0 / 0** — verified — card page + SOC Premier section.
- `annual_fee_waiver_rule`: paraphrased verbatim from card page.
- Confidence: medium → **high**.

#### Bank Alfalah Islamic Premier Visa Signature Debit Card
- `minimum_relationship_balance_pkr`: **3,000,000** — kept; matches the parent Premier eligibility page which serves as the Islamic Premier criteria source.
- `annual_fee_pkr` / `supplementary_annual_fee_pkr`: **0 / 0** — verified — Islamic Premier signature page lists no fees, requires Islamic Premier Account to apply.
- Confidence: medium (kept) — there is no dedicated, currently-live Islamic Premier eligibility URL (the `islamic-premier/eligibility-criteria/` URL returns 404).

#### Bank Alfalah Premier Visa Top Tier Debit Card (renamed from Premier Visa Infinite Debit Card)
- **Renamed** — there is no "Premier Visa Infinite" card in the SOC; the SOC's Premier section names this exact product "Premier Visa Top Tier Debit Card."
- `minimum_relationship_balance_pkr`: **25,000,000** — corrected from 1,500,000 — SOC: "Eligibility criteria for availing this card is PKR 25 Million in Current Account or equivalent in foreign currency."
- `annual_fee_pkr`: **0** — corrected from 22,000 — SOC Premier section lists this card as fee-waived for qualifying Premier customers.
- Confidence: high (kept) — the corrections come directly from the conventional SOC.

#### Bank Alfalah Premier Visa Signature Credit Card (renamed from Premier Visa Infinite Credit Card)
- **Renamed** — there is no Premier Visa Infinite credit card. The SOC names the top-tier Premier credit card "Premier VISA Signature Credit Card."
- `minimum_relationship_balance_pkr`: **25,000,000** — corrected — same SOC line as Top Tier debit.
- `annual_fee_pkr`: **0** — Premier waiver overrides the underlying PKR 30,000 Signature credit-card fee shown in SOC Sec A Pt 1.
- Confidence: medium — record retained but the "USD 500 equivalent" line previously in notes appears to refer to a different product family entirely (we could not source it on the current SOC).

### Bank Alfalah Infinite (150M AUM tier)

#### Bank Alfalah Visa Infinite Debit Card (renamed from Islamic Premier Visa Infinite Debit Card)
- **Renamed** — the SOC places "Visa Infinite Debit Card" under the conventional Bank Alfalah Infinite section, not Islamic Premier.
- `minimum_relationship_balance_pkr`: **150,000,000** — corrected from 1,500,000 (off by 100x) — SOC "Bank Alfalah Infinite" section: "Assets Under Management (AUM)* — 150 Million AUM."
- `annual_fee_pkr`: **0** — corrected from 22,000 — SOC: "Visa Infinite Debit Card*** — No Annual, Issuance and Replacement fee."
- Confidence: high.

### Islamic conventional debit cards

#### Bank Alfalah Visa Islamic Classic Debit Card
- `annual_fee_pkr`: **3,500** — verified — Islamic SOC Sec I Pt 1a.
- `supplementary_annual_fee_pkr`: **1,750** — added.
- Confidence: high (kept).

#### Bank Alfalah Visa Islamic Gold Debit Card
- `annual_fee_pkr`: **5,000** — verified — Islamic SOC Sec I Pt 1a.
- `supplementary_annual_fee_pkr`: **2,500** — added.
- Confidence: high (kept).

#### Bank Alfalah Visa Islamic Signature Debit Card
- `annual_fee_pkr`: **22,000** — corrected from 9,000 — Islamic SOC Sec I Pt 2: "Signature / Power Pack Signature Debit Card — Basic Card Issuance/Annual Fee PKR 22,000/-."
- `supplementary_annual_fee_pkr`: **11,000** — added.
- `minimum_average_balance_pkr` / `minimum_deposit_pkr`: **1,000,000 / 1,000,000** — verified — Islamic Signature card page.
- Confidence: medium → **high**.

#### Bank Alfalah Islamic Power Pack Signature Debit Card
- `annual_fee_pkr`: **22,000** — corrected from 9,000 — same Islamic SOC Sec I Pt 2 (Signature and Power Pack Signature share the same fee line).
- `supplementary_annual_fee_pkr`: **11,000** — added.
- `minimum_average_balance_pkr` / `minimum_deposit_pkr`: **250,000 / 250,000** — verified — Power Pack Signature product page.
- `annual_fee_waiver_rule`: set to null — the prior "Annual fee becomes payable if the customer falls below the Power Pack balance" sentence is not supported by the live page or the Jan-Jun 2026 Islamic SOC.
- Confidence: medium → **high**.

#### Bank Alfalah PayPak Islamic Classic Debit Card
- `annual_fee_pkr`: **2,800** — verified — Islamic SOC Sec I Pt 1a.
- `supplementary_annual_fee_pkr`: **1,400** — added.
- `annual_fee_waiver_rule`: changed to null — the prior "Free for Alfa Payroll account holders" rule is not in the current product page or Jan-Jun 2026 SOC.
- Confidence: high (kept).

### Islamic Women cards (Power Pack Women variants)

#### Bank Alfalah Islamic Gold Women Debit Card
- `annual_fee_pkr`: **5,000** — corrected from 4,400 — Islamic SOC Sec I Pt 1a: "PKR 5,000/- per Islamic Gold Women Debit Card per year."
- `supplementary_annual_fee_pkr`: **2,500** — added.
- Salary / balance: **0 / 0** — verified — Islamic Gold Women product page: "Open to all women without income criteria."
- Confidence: high (kept).

#### Bank Alfalah Islamic Power Pack Women Debit Card
- `annual_fee_pkr`: **22,000** — corrected from 20,500 — Islamic SOC Sec I Pt 3: "Islamic Power Pack Women Debit Card — Basic Card Issuance/Annual Fee PKR 22,000/-."
- `supplementary_annual_fee_pkr`: **11,000** — added.
- `minimum_average_balance_pkr`: **250,000** — verified — product page.
- Confidence: high (kept).

### Other

#### Bank Alfalah PayPak Classic Debit Card
- `annual_fee_pkr`: **2,800** — verified — conventional SOC Sec A Pt 5 i: "Rs. 2,800/- per PayPak Debit Card Per Year."
- `supplementary_annual_fee_pkr`: **1,400** — added.
- Confidence: high (kept). Dedicated product URL returned 404; data sourced from the Compare debit cards page + SOC.

#### Bank Alfalah Pehchaan Debit Card
- `annual_fee_pkr`: **5,000** — corrected from 4,000 — conventional SOC Sec A Pt 5 i: "Rs. 5,000/- per Pehchaan Debit Card Per Year."
- `supplementary_annual_fee_pkr`: **2,500** — added.
- Salary / balance: **0 / 0** — verified — Pehchaan Current Account: "no minimum balance requirement."
- Confidence: medium → **high**. (Dedicated card-product URL returned 404; account page + SOC are the live sources.)

#### Bank Alfalah Mastercard Titanium Credit Card — DISCONTINUED
- All fee and threshold values now null.
- Salary value (50,000) removed — there is no current published eligibility for a discontinued product.
- Confidence: low (kept).
- Evidence: (a) absent from the Jan-Jun 2026 KFS Summary Box (which lists Classic, Gold, Optimus, Platinum, Premier Platinum, Ultra); (b) absent from the AFRC document; (c) absent from the bankalfalah.com/personal-banking/credit-cards/ landing page; (d) `mastercard-titanium-credit-card` product URL returns HTTP 404. Probable replacement: Mastercard Optimus (PKR 16,000 fee).

## Cross-card observations

- **Premier and Infinite are two distinct segments.** Premier = PKR 3 Million
  CASA (or 10M AUM / 30M mortgage / 1M salary credit + payroll). Infinite =
  PKR 150 Million AUM. The pilot file previously conflated these two as a
  single PKR 1.5M-balance tier (off by 100x), so all Infinite-tier card
  records have been corrected.
- **Premier Top Tier requires PKR 25M Current Account.** Two specific Premier
  products — the Premier Visa Top Tier Debit Card and the Premier VISA
  Signature Credit Card — sit above the standard PKR 3M Premier threshold and
  require PKR 25M in Current Account. They are still fee-free for qualifying
  customers; they're just gated differently within Premier.
- **AMEX Gold is structurally different from other credit cards.** No
  spend-based reversal; only a Premier 1st-year fee waiver. The AFRC document
  is explicit on this.
- **All credit cards share one salary / age table.** PKR 50,000 salaried
  (PKR 75,000 self-employed); 21-60 salaried, 21-70 self-employed and
  supplementary. We record the salaried floor and the wider age envelope.
- **Mainstream debit cards are issued to any account holder.** No income or
  balance requirement is published for Classic, Gold, Platinum, PayPak, or
  Pehchaan. Signature-tier debit cards (conventional and Islamic) require
  PKR 1M deposit or 12-month average balance.

## Gaps / unresolved

- **Mastercard Titanium Credit Card** — discontinued. All numeric fields now
  null; record retained for backwards compatibility. Recommend dropping
  before shipping to UI.
- **Islamic Premier dedicated eligibility URL** — both
  `islamic-premier/eligibility-criteria-4/` and
  `islamic-premier/eligibility-criteria/` return 404. The
  bankalfalah.com/premier/eligibility-criteria/ page is the only currently
  available source describing the Islamic Premier 3M CASA / 10M AUM grid.
- **Debit card ages** — Bank Alfalah does not publish age bands for its
  consumer debit cards; only the credit-card eligibility table publishes 21-70
  age envelope. Kept as null for all debit cards.
- **Premier Visa Signature Credit Card "USD 500 equivalent" fallback line** —
  the prior pilot's notes referenced a USD 500 equivalent in PKR charge for
  customers below the Premier Infinite AUM threshold. We could not locate
  this line in the current Jan-Jun 2026 Conventional SOC; it may have been
  from an earlier SOBC. Removed from authoritative fields and not
  re-introduced.
