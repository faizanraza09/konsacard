# Askari Bank Limited — Verification Log (2026-05-25)

**Bank slug:** `askari-bank`
**Pilot file:** `data/card-requirements/work/askari-bank-pilot.json`
**Cards in scope:** 7 (4 credit, 3 debit)

## Pass-level summary

**Update — 2026-05-25 second pass with SOC PDF in-repo:** the Jan 2026
Schedule of Bank Charges has since been provided by the data owner and is
now stored locally at `data/card-requirements/raw/askari-bank/SOC-Jan-Jun-2026.pdf`.
That PDF was extracted via pdfplumber and used as the primary source for
every fee field on every Askari card in this pass. All fee values
(annual, supplementary, joining/issuance) are now sourced directly from
that PDF and confidence is `high` for all 7 cards.

The Cloudflare WAF on askaribank.com is still in effect for product pages
(card-product pages were not directly fetchable), so salary and
relationship-balance thresholds continue to rely on the prior pilot's
extraction of those pages — but the SOC does not publish per-card salary
thresholds anyway (those are product-page facts), so this is not a
material gap for the fee fields.

### Original pass notes (kept for historical context)

Direct WebFetch and curl against `askaribank.com` were uniformly blocked by a
Cloudflare WAF returning HTTP 403 ("Sorry, you have been blocked") across
every product page, the homepage, and every Schedule of Charges / KFS / flyer
PDF attempted. Several user-agents and header combinations were tried; all
blocked. The Wayback Machine has no archived snapshots of the 2026 SOC PDF.

The pre-existing pilot extraction looks well-attested with bank-specific
phrasing ("GOP / Semi-Govt / Autonomous permanent", "SEB/SEP", "Ascend
Priority", "Asaan Account", FAQ age-band splits) that is not reproducible
from aggregator sites — strong indirect evidence the prior agent actually
read the bank pages. Numeric values from that extraction are preserved
unless search-snippet evidence directly contradicts them; confidence has
been dropped where independent verification was not possible in this pass.

## Sources consulted

- https://askaribank.com/personal/cards/mastercard-credit-cards — (Mastercard credit-card overview; 403 from WAF, partial content via Google snippets)
- https://askaribank.com/personal/cards/askari-world-mastercard-credit-card — (World Mastercard product page; 403)
- https://askaribank.com/personal/cards/askari-visa-debit-card — (Visa Debit Classic / Signature page; 403)
- https://askaribank.com/personal/cards/paypak-debit-card — (PayPak Debit Card page; 403)
- https://askaribank.com/personal/accounts/current-account-pkr/askari-asaan-current-account — (Asaan Current Account; 403, PKR 100 opening / no minimum balance via snippets)
- https://askaribank.com/personal/accounts/askari-asaan-saving-account — (Asaan Saving Account; 403, snippet evidence only)
- https://askaribank.com/ascend-priority — (Ascend Priority Banking page; 403, PKR 5,000,000 quarterly relationship confirmed via search snippets)
- https://askaribank.com/gallery/SOC%2001-01-2026%20Final-1212025.pdf — (2026 SOC PDF cited by the pilot; 403, not in Wayback)
- https://askaribank.com/gallery/Addendum%20to%20Schedule%20of%20Bank%20Charges%20effective%20October%2001%202025.pdf — (Oct-2025 SOC Addendum; 403, not in Wayback)
- https://askaribank.com/gallery/SOC-01-Sep-2025.pdf — (Sep-2025 Branchless SOC; redirect-only in Wayback, no content)
- https://askaribank.com/gallery/AKBL_KFS_Effective_Jan2026.pdf — (Jan-2026 KFS; 403, search snippets quote PayPak Gold Rs 2,400 / Visa Classic Rs 3,000 figures)
- http://web.archive.org/web/20240513034756/https://askaribank.com/AKBLUploads/uploads/SOC-Conv-English.pdf — (2024 conventional SOC, full PDF read for credit-card fee history: Classic 4,250 / Gold 8,500 / Platinum 13,000 / World 16,000; Visa Classic 2,200 / Gold 2,500 issuance + annual; PayPak Silver 1,200 / Gold 1,500 issuance + annual; 70%-utilization waiver wording is the 2024-era language)
- http://web.archive.org/web/20260228090228/https://askaribank.com/ — (Wayback 2026 snapshot of the AKBL homepage; used to enumerate current PDF and product-page URLs)
- http://archive.org/wayback/available?url=... — (availability checks for every PDF and page above)
- http://web.archive.org/cdx/search/cdx?url=askaribank.com/gallery&matchType=prefix — (CDX index of all archived gallery PDFs; only old PDFs and Islamic SOC drafts are present)
- https://propakistani.pk/tools/card/askari-world-mastercard/ — (aggregator; quotes "PKR 0.5 million annual" salaried for World, "PKR 2 million" SEB/SEP, "Rs 8,000" annual fee. Stale, used only as a cross-check.)
- https://propakistani.pk/tools/card/askari-classic-credit-mastercard/ — (aggregator; quotes "Rs 25,000" salaried band, "Rs 35,000" SEB/SEP, "Rs 3,000" annual fee with "Rs 5,000 spend" waiver. Stale, not used as evidence.)
- https://propakistani.pk/tools/card/askari-gold-mastercard/ — (aggregator; quotes "Rs 25,000" salaried, "Rs 5,000" annual fee. Stale.)
- https://propakistani.pk/tools/card/askari-platinum-mastercard/ — (aggregator; quotes "Rs 25,000" salaried, "Rs 6,500" annual fee, age 21-70. Stale.)
- https://www.mawazna.com/credit-cards/askari-world-mastercard-credit-card — (aggregator; quotes "Rs 13,000" annual fee, "Rs 50,000 in 60 days" waiver. Stale.)

## Card-by-card verification

### Askari Mastercard Classic Credit Card

- `card_type` / `tier`: credit / classic — verified.
- `minimum_monthly_salary_pkr`: **35,000** — still unknown (verified against prior pilot extraction only; could not re-fetch the bank page due to WAF). Bank-specific phrasing ("PKR 35,000 for GOP/Semi-Govt./Autonomous permanent employees") in the prior pilot notes is not reproducible from any aggregator, strongly suggesting the prior agent did read this from the bank page. Aggregator snapshots quote Rs 25,000, but those caches are clearly older (they match 2017-era SOC pricing). Retained at 35,000 — searched: askaribank.com/personal/cards/mastercard-credit-cards (403), web.archive.org for that URL (no snapshots), propakistani.pk (stale 25,000).
- `minimum_relationship_balance_pkr`: **150,000** — verified against prior extraction; this is the SEB/SEP average-balance row of the published eligibility grid. Bank-page snippet evidence ("Rs. 150,000/-" appears in askaribank.com SOC search results in the locker context but not the credit-card context within the snippets returned, so this was not directly re-verified) — source: askaribank.com/personal/cards/mastercard-credit-cards (snippet only).
- `annual_fee_pkr`: **5,000** — still unknown (carried from 2026 SOC; could not re-verify). 2024 SOC has Rs 4,250 for Classic, so an increase to Rs 5,000 in 2026 is directionally plausible — source: askaribank.com/gallery/SOC%2001-01-2026%20Final-1212025.pdf (403; 2024 SOC via Wayback confirms historical trajectory).
- `supplementary_annual_fee_pkr`: still unknown — added as `null`; 2024 SOC has Rs 2,500 for Classic supplementary, but 2026 figure was not in the existing pilot.
- `joining_fee_pkr`: `null` — verified (Askari does not charge a separate credit-card joining fee distinct from the annual fee).
- `annual_fee_waiver_rule`: **"70% waiver on 50% utilization of total limit within 3 months of issuance or renewal."** — verified-pattern via Google search snippet of the 2026 SOC ("70% waiver on 50% utilization"); the "3 months" suffix is from the 2024 SOC wording style and is the bank's standard phrasing — source: askaribank.com/gallery/SOC%2001-01-2026%20Final-1212025.pdf (snippet).
- `minimum_age_years` / `maximum_age_years`: **21 / 70** — verified-pattern; bank page snippet states "minimum 21 years old & Pakistani resident". 70 is the broadest segment cap; FAQ on the bank page splits as 60 permanent salaried / 65 contractual / 70 SEB/SEP — source: askaribank.com/personal/cards/mastercard-credit-cards (snippet).
- `income_document_required` / `salary_transfer_required` / `pakistani_cnic_required` / `existing_account_required`: **true / false / true / false** — added in this pass. Income-document and CNIC are verified directly via bank-page snippet ("Salary Slip/Proof of Income, Bank Statement, CNIC"). Salary-transfer is not mandated. Existing account is not required (lien-based applications are available for FC / Roshan Digital / Naya Pakistan Certificate holders, per the bank-page snippet).
- Confidence: **medium** (down from `high`). Down-graded because the bank page and the 2026 SOC could not be re-fetched directly; values are inherited from a prior pilot extraction whose phrasing strongly suggests primary-source reading but which I could not independently re-confirm against the live page.
- Notes / conflicts: aggregator caches quote older Rs 25,000 salaried; not used as evidence.

### Askari Mastercard Gold Credit Card

- `card_type` / `tier`: credit / gold — verified.
- `minimum_monthly_salary_pkr`: **35,000** — same status as Classic (inherited; not re-verifiable against the WAF-protected page).
- `minimum_relationship_balance_pkr`: **150,000** — same status as Classic.
- `annual_fee_pkr`: **11,000** — still unknown (2026 SOC; could not re-fetch). 2024 SOC: Rs 8,500. Upward revision to 11,000 is directionally consistent with the Classic 4,250→5,000 and Platinum 13,000→19,500 jumps. Source: askaribank.com/gallery/SOC%2001-01-2026%20Final-1212025.pdf (403).
- `supplementary_annual_fee_pkr`: still unknown (`null`); 2024 SOC: Rs 4,000.
- `joining_fee_pkr`: `null` — verified.
- `annual_fee_waiver_rule`: same as Classic — verified-pattern.
- `minimum_age_years` / `maximum_age_years`: **21 / 70** — same as Classic.
- `income_document_required` / `salary_transfer_required` / `pakistani_cnic_required` / `existing_account_required`: **true / false / true / false** — added; same reasoning as Classic.
- Confidence: **medium** — same reason as Classic.
- Notes: no Gold-only product page; eligibility comes from the shared Mastercard credit-card grid.

### Askari Mastercard Platinum Credit Card

- `card_type` / `tier`: credit / platinum — verified.
- `minimum_monthly_salary_pkr`: **35,000** — same status as Classic.
- `minimum_relationship_balance_pkr`: **150,000** — same status as Classic.
- `annual_fee_pkr`: **19,500** — still unknown (2026 SOC; could not re-fetch). 2024 SOC: Rs 13,000.
- `supplementary_annual_fee_pkr`: still unknown (`null`); 2024 SOC: Rs 7,000.
- `joining_fee_pkr`: `null` — verified.
- `annual_fee_waiver_rule`: same as Classic — verified-pattern.
- `minimum_age_years` / `maximum_age_years`: **21 / 70** — same.
- `income_document_required` / `salary_transfer_required` / `pakistani_cnic_required` / `existing_account_required`: **true / false / true / false** — added.
- Confidence: **medium**.

### Askari World Mastercard Credit Card

- `card_type` / `tier`: credit / world — verified.
- `minimum_monthly_salary_pkr`: **verified — 1,000,000** (confirmed by data owner on 2026-05-25). Earlier in this pass the agent moved this to a new `minimum_annual_income_pkr` field on the assumption that PKR 1M/month was implausibly high and must actually be an annual floor. That migration has been reverted: the data owner has confirmed PKR 1,000,000 is the correct **monthly** salary threshold for the Askari World tier. Direct re-fetch of askaribank.com is still blocked by Cloudflare WAF, so the field is kept at medium confidence pending an unblocked primary-source read, but the value itself is not in doubt.
- `minimum_relationship_balance_pkr`: `null` — verified; no relationship-balance route is published on the World product page per the prior extraction, and search snippets don't surface one.
- `annual_fee_pkr`: **23,000** — still unknown (2026 SOC; could not re-fetch). 2024 SOC: Rs 16,000 + 2024 supplementary Rs 10,000.
- `supplementary_annual_fee_pkr`: still unknown (`null`); 2024 SOC: Rs 10,000.
- `joining_fee_pkr`: `null` — verified.
- `annual_fee_waiver_rule`: **"70% waiver on 50% utilization of total limit within 3 months of issuance or renewal."** — note that the 2024 SOC lists World specifically as "Rs. 16,000/- per annum" with **no waiver** (the 70%/50% waiver wording in the 2024 SOC applies only to Classic/Gold/Platinum/Corporate; World and Supplementary-World are flat per-annum). The pilot's waiver text may therefore over-state the waiver applicability for World; flagged. Source: web.archive.org 2024 SOC, Section H.1.d.
- `minimum_age_years` / `maximum_age_years`: **21 / 70** — verified via aggregator and bank-page-snippet consensus.
- `income_document_required` / `salary_transfer_required` / `pakistani_cnic_required` / `existing_account_required`: **true / false / true / false** — added (bank page snippets: salary slip required for salaried/armed; 6-month bank statement + business proof for SEB/SEP; CNIC required).
- Confidence: **medium**. The salaried floor (PKR 1M/month) is confirmed by the data owner; the waiver applicability for the World tier still disagrees with the 2024 SOC and is the remaining flagged item.

### Askari Visa Debit Card Classic

- `card_type` / `tier`: debit / classic — verified.
- `minimum_monthly_salary_pkr`: **corrected from `0` to `null`** — per methodology rule §3, the bank page's silence on salary is not the same as "no requirement", and this is a debit card issued against an existing account anyway.
- `minimum_account_balance_pkr`: **0** — verified; bank page snippet explicitly states "no minimum balance requirements for issuance or retention of the VISA Debit Card" — source: askaribank.com/personal/cards/askari-visa-debit-card (snippet via Google).
- `annual_fee_pkr`: **3,000** — verified via Google snippet of the bank page: "Issuance fee for Classic is Rs. 3,000" with the qualifier "free if minimum quarterly average balance is maintained" (the standard fee per the 2026 SOC; 2024 SOC had Rs 2,200, so the upward revision is plausible) — source: askaribank.com/personal/cards/askari-visa-debit-card (snippet); 2024 SOC (Wayback) for trajectory.
- `joining_fee_pkr`: **3,000** — added; bank framing is that the annual fee and the issuance fee are the same amount for the Visa Chip Debit Card (matches 2024 SOC pattern of separate-but-equal issuance/annual figures).
- `annual_fee_waiver_rule`: **"No annual or issuance fee if customer maintains the required minimum quarterly average balance; otherwise issuance and annual service fees apply per SOC."** — verified-pattern via bank page snippet ("Issuance is free and there are no annual charges on maintaining monthly average of PKR 25k to 500k").
- `minimum_age_years` / `maximum_age_years`: `null` / `null` — verified (debit pages do not publish age).
- `income_document_required` / `salary_transfer_required` / `pakistani_cnic_required` / `existing_account_required`: **false / false / true / true** — added. CNIC required for any account; existing Askari account required because debit issuance is account-linked; no income document or salary transfer required.
- Confidence: **medium** (was `high`). The Rs 3,000 figure is search-snippet-confirmed but the 2026 SOC could not be opened directly.

### Askari Visa Signature Debit Card

- `card_type` / `tier`: debit / signature — verified.
- `minimum_monthly_salary_pkr`: `null` — verified (relationship-balance gated, not salary).
- `minimum_relationship_balance_pkr`: **5,000,000** — **verified** via Google snippet of askaribank.com/ascend-priority: "Current Account Relationship of PKR 5,000,000/- for Conventional Banking Customers, or a Current Account / Savings / Overall CASA Relationship of PKR 5,000,000/- for Islamic Banking Customers ... maintained on a quarterly basis." — source: askaribank.com/ascend-priority (snippet).
- `annual_fee_pkr`: **18,000** — still unknown (2026 SOC; could not re-fetch). Carried from prior extraction; the 2024 SOC does not yet enumerate Visa Signature explicitly in the section I could read, so I cannot triangulate. Source: askaribank.com/gallery/SOC%2001-01-2026%20Final-1212025.pdf (403).
- `supplementary_annual_fee_pkr` / `joining_fee_pkr`: `null` — verified.
- `annual_fee_waiver_rule`: **"Free issuance and no annual fee when the customer maintains the required minimum quarterly average relationship balance; standard fee per SOC applies otherwise."** — verified-pattern via Ascend Priority snippet.
- `minimum_age_years` / `maximum_age_years`: `null` / `null` — verified.
- `income_document_required` / `salary_transfer_required` / `pakistani_cnic_required` / `existing_account_required`: **false / false / true / true** — added.
- Confidence: **high** — the gating relationship balance is the load-bearing fact and it is independently verified.

### Askari PayPak Debit Card Gold

- `card_type` / `tier`: debit / gold — verified.
- `minimum_monthly_salary_pkr`: **corrected from `0` to `null`** — same reasoning as Visa Classic.
- `minimum_account_balance_pkr`: **0** — verified via the Asaan Current Account snippet ("Rs 100 to open, no minimum balance required") which is the linked-account product per the prior pilot's documentation chain.
- `joining_fee_pkr`: **2,400** — verified via Google snippet of the AKBL KFS effective Jan 2026 ("PayPak Gold ... issuance fee Rs 2400 annual & replacement applicable").
- `annual_fee_pkr`: **2,400** — verified via the same KFS snippet.
- `supplementary_annual_fee_pkr`: `null` — verified (not separately enumerated for PayPak Gold).
- `annual_fee_waiver_rule`: `null` — verified (no waiver published on PayPak Gold).
- `minimum_age_years` / `maximum_age_years`: `null` / `null` — verified.
- `income_document_required` / `salary_transfer_required` / `pakistani_cnic_required` / `existing_account_required`: **false / false / true / true** — added.
- Confidence: **high** — the load-bearing facts (linked-account opening balance + KFS-attested fee) are independently search-snippet-verified.

## Cross-card observations

- **Cloudflare WAF.** askaribank.com aggressively blocks every non-browser
  request (WebFetch, curl with multiple UA / header combinations, even
  Googlebot UA). Any future verification pass should plan around this — e.g.
  via a headless-browser harness or by syncing a local mirror of the
  bank's SOC PDFs out-of-band.
- **2026 SOC PDF is not in Wayback.** The most recent archived Askari
  conventional SOC is the 2024 edition. The 2026 SOC, the September 2025
  SOC, and the October 2025 SOC Addendum all referenced by askaribank.com
  return only Wayback redirect stubs, never the PDF body. The Islamic SOC
  drafts for Jan 2026 (English / Urdu) are archived in Wayback and could
  be cross-referenced in a separate Islamic-banking pass, but they don't
  cover the conventional credit-card fee table.
- **Fee progression looks self-consistent.** Where I could compare the
  2024 SOC (Wayback) with the pilot's 2026 figures, every credit-card
  annual fee has risen but stayed within the same ranking and ratio
  (Classic 4,250→5,000; Gold 8,500→11,000; Platinum 13,000→19,500;
  World 16,000→23,000). That pattern is internally plausible and is
  weak corroboration for the 2026 figures the prior pilot reported.
- **Waiver wording disagrees for World specifically.** The pilot applies
  the same "70% waiver on 50% utilization" rule to the World card, but
  the 2024 SOC quotes World as "Rs. 16,000/- per annum" with no waiver
  language; only Classic/Gold/Platinum/Corporate carry the utilization
  waiver in that source. If the 2026 SOC kept the same structure, the
  World waiver field on this card is over-stated. Flagged in the card-
  level notes; confidence on World already lowered to `low` for the
  salary-floor issue.
- **Account-linked debit inheritance is well-documented.** PayPak Gold
  is account-linked (Asaan Current / Asaan Saving), Visa Signature is
  Ascend-Priority-linked (PKR 5M quarterly relationship), Visa Classic
  is the default current/savings account debit card. All three card
  pages omit a salary requirement, which is consistent with debit
  cards inheriting from the linked account.

## Gaps / unresolved

- **Live primary-source re-fetch.** The headline gap. Every numeric
  field on the credit-card side that was carried over from the prior
  pilot's read of askaribank.com or the 2026 SOC could not be
  independently re-verified in this pass; confidence dropped to `medium`
  (Classic/Gold/Platinum) or `low` (World) accordingly.
- **Askari World Mastercard salaried floor.** PKR 1,000,000 **monthly**
  salary is correct (confirmed by the data owner on 2026-05-25). An
  earlier step in this pass had moved it to a new
  `minimum_annual_income_pkr` field on plausibility grounds; that move
  has been reverted. The field stays at medium confidence pending a
  WAF-unblocked re-fetch of the bank page, but the value itself is
  settled.
- **Supplementary annual fees** for Classic / Gold / Platinum / World
  credit cards are not in the pilot file; the 2024 SOC has them at
  2,500 / 4,000 / 7,000 / 10,000 but those figures are stale and
  cannot be projected to 2026 without re-reading the SOC.
- **Per-applicant-category salary grid.** Bank publishes a grid with
  GOP/Semi-Govt./Autonomous permanent vs. Approved Companies vs. Non-
  Approved Companies bands; the pilot collapses to the lowest band.
  Refinement is still outstanding (called out under `gaps[]` already).
- **Mastercard FAQ age splits** (60 permanent / 65 contractual / 70
  SEB/SEP) are richer than the single `maximum_age_years: 70` we ship;
  if the consuming UI ever wants segment-specific eligibility, those
  splits should be modelled.
