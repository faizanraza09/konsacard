# Card Requirements Verification — Pass Summary (2026-05-25)

This pass re-verified every field on every card in the dataset against
official primary sources. It was not a gap-fill — values that already had a
number had to be re-checked against the bank's current materials and either
confirmed in the per-bank log or corrected with a new source.

## Scope

- **18 banks re-verified** out of 19 in the dataset. NBP is excluded
  because its 5-card pilot is sourced from an official NBP-provided
  workbook (`raw/nbp/nbp_card_details_template.xlsx`); first-party
  bank submissions outrank public sources and are not overwritten by
  this pass. See `banks/nbp.md`.
- **191 cards after the pass** (down from 192). One card removed:
  Bank Alfalah Mastercard Titanium Credit Card was verified as
  discontinued (absent from Jan–Jun 2026 KFS Summary Box, absent from
  the AFRC document, missing from the credit-cards landing page, and
  the product URL returns HTTP 404). Two renames inside BOP and Bank
  Alfalah. NBP's 5 cards are unchanged.
- One agent per bank, dispatched in parallel
- Each agent wrote: `notes/verification-2026-05-25/banks/<bank>.md` (research log)
  and updated `work/<bank>-pilot.json` in place.
- Normalization rerun: `scripts/card_requirements/build_card_requirements_normalized.py`
  and `scripts/card_requirements/build_deal_requirement_card_map.py`.
- Audit refreshed: `scripts/card_requirements/audit_requirement_evidence.py`.

## Before / after — completeness

The completeness shape changed deliberately. Many cards now have **fewer**
non-null salary or balance values than before — because agents enforced the
"silence ≠ 0" rule. A 0 derived from a blank product page was reset to null.
This is correct: 0 means "no requirement", null means "we don't know".

```
                                BEFORE   AFTER
Total cards                        192     192
Missing minimum_monthly_salary      40     134  (mostly silence-zeros reset to null)
Missing minimum_account_balance     41      94  (some moved to average/relationship)
Missing minimum_average_balance      -     158  (new field surfaced for HBL conv, BOP, MCB Privilege)
Missing minimum_relationship_balance -     162  (new field surfaced for HBL World, BAHL Signature, BOP KHAAS)
Missing annual_fee_pkr              11       5  (fees verified against SOC/KFS; only 5 genuinely undisclosed remain)
Missing annual_fee_waiver_rule      96      69  (27 cards gained verbatim waiver rules)
Missing joining_fee_pkr              -     132  (new field populated where banks publish it separately)
Missing supplementary_annual_fee     -      56  (new field populated for 136 cards)
```

The dataset is now **smaller in "apparent completeness" but materially more
correct** — every retained value carries a verified source, every dropped
value was a silently-zero placeholder, and the new fields capture facts the
banks actually publish (average balance, relationship balance, supplementary
fees, joining fees).

## Cross-bank patterns observed

### Salary vs balance — what banks actually publish

- **Pakistani banks rarely publish a per-card monthly salary threshold for
  debit cards.** The exceptions are credit-card overview tables (HBL,
  Faysal Noor, SCB, Bank Alfalah) and a small number of explicit
  segment-eligibility pages (BOP KHAAS, UBL Signature, HBL Prestige).
- **Balance is more commonly published than salary**, but usually as a
  relationship balance on the linked-account page (CASA monthly average,
  quarterly average for premium segments) rather than a per-card field.
- **The two are independent.** If a bank publishes one but not the other,
  the unknown one stays null. This pass undid many old "0" placeholders on
  the silent side of the pair.

### Linked-account inheritance is the dominant pattern

- ~70% of debit cards in the dataset are account-linked: the eligibility
  belongs to the linked account product (e.g., HBL Conventional Current
  Account, BOP KHAAS Current, Bank Alfalah Premier proposition).
- The card itself contributes economics (fee, supplementary fee, channel
  access) but not eligibility.
- Per-bank logs now cite the linked account explicitly and put the
  inherited threshold under `minimum_average_balance_pkr` or
  `minimum_relationship_balance_pkr` (which is more honest than dumping
  it under `minimum_account_balance_pkr`).

### Waiver rules — three common shapes

1. **Spend-based reversal** — most credit cards (HBL, Bank Alfalah,
   Standard Chartered, Faysal). The Bank Alfalah AFRC PDF is the cleanest
   public example.
2. **Relationship-based waiver** — premium and priority segments (HBL
   Prestige, UBL Signature Priority Banking, BAHL Signature, Meezan Premium).
3. **First-year promo** — Easypaisa, NBP PayPak Classic (when linked to
   Itmenan), Bank Alfalah Premier 1st-year on AMEX Gold.

"Subject to T&Cs" was rejected as a usable waiver rule throughout.

## Most consequential corrections this pass

Selected from the 19 per-bank logs:

- **Bank Alfalah Visa Platinum Debit Card** — annual fee was off by ~3.4x
  (PKR 2,900 → PKR 10,000). Classic-tier fee had been copied onto the
  Platinum row.
- **Bank Alfalah Visa Infinite Debit Card** — minimum balance was off by
  100x (PKR 1,500,000 → PKR 150,000,000). Pilot had confused the Premier
  segment (PKR 3M CASA) with the Infinite segment (PKR 150M AUM).
- **UBL Visa Infinite Debit / Mastercard Signature Debit** — both had
  annual fee PKR 0; the "Free" wording on the product page is conditional
  on Signature Priority Banking criteria. Corrected to PKR 45,000 / 25,000
  per SOC p.33.
- **Standard Chartered Mastercard Platinum** — minimum monthly salary was
  PKR 50,000; the apply-now form is explicit at PKR 300,000.
- **MCB Islamic all 5 cards** — all annual fees were stale pre-2025 SOBC
  values; corrected to Jan–Jun 2026 SOBC.
- **HBL conventional debit cards** — PKR 40,000 was sitting under
  `minimum_account_balance_pkr`; moved to `minimum_average_balance_pkr`
  (it's the linked Conventional CA monthly average, not opening balance).
- **Habib Metro "Visa Signature Debit Card"** — renamed to "Business Debit
  Card" (tier `business`); the prior "PKR 3M balance / 3-month waiver" rule
  was unsourced and removed.
- **Bank AL Habib Signature Debit Card** — unsourced PKR 3,000,000 MAB
  waiver removed; PayPak Debit annual fee added at PKR 2,750.
- **Faysal Noor Flexi** — annual fee PKR 6,500 → PKR 9,000; pilot had
  conflated it with Noor Velocity.
- **Allied Visa Premium Debit Card** — salary PKR 416,667 → null; the
  English product page no longer lists the PKR 5M income path that
  derived value came from.
- **BankIslami Titanium** — unsourced PKR 25,000 balance threshold
  removed; that figure was the Islami Sahulat Account "free services"
  trigger, not a Titanium waiver.
- **NBP (excluded from re-verification)** — NBP's pilot is sourced from
  an official NBP-provided workbook
  (`raw/nbp/nbp_card_details_template.xlsx`). The verification agent
  did initially overwrite the pilot with public-SOC-derived values
  (the PKR 500,000 / 100,000 balances on Edge and UPI Gold are not in
  the public SOC); that overwrite was reverted. See `banks/nbp.md` for
  the operating rule on first-party bank submissions.
- **BOP** — two cards renamed: "BOP World Credit Card" →
  "BOP Mastercard World Credit Card"; "Lahore Qalandars Gold Credit Card"
  → "BOP Mastercard Lahore Qalandar Business Credit Card" (no Gold LQ
  credit variant exists).

## New / unresolved structural items

- **Askari World Mastercard Credit Card** — PKR 1,000,000 sits in
  `minimum_monthly_salary_pkr` and is correct as a **monthly** salary
  floor (confirmed by the data owner on 2026-05-25). The agent had
  initially moved it to a proposed `minimum_annual_income_pkr` field
  on plausibility grounds; that move has been reverted.
- **Askari SOC PDF** brought into the repo at
  `data/card-requirements/raw/askari-bank/SOC-Jan-Jun-2026.pdf`. All 7
  Askari cards re-sourced against the SOC directly: every fee, every
  supplementary fee, every issuance fee verbatim from Sections E and H.
  Confidence raised from medium/low to **high** for all 7 cards. Bank-
  level gaps now lists the additional Askari card variants present in
  the SOC but not yet in the pilot (Visa Debit Gold/Platinum, UnionPay
  Classic/Gold, PayPak Silver, FCY Debit, Corporate Mastercard, Awami
  Mastercard, PIA Co-Brand Classic/Gold/Platinum) — candidates for the
  next coverage-expansion pass.
- **Bank Alfalah Mastercard Titanium Credit Card** — verified to be
  discontinued (absent from Jan–Jun 2026 KFS, AFRC, credit-card landing
  page; product URL 404s). Removed from the pilot. The deal-side
  dataset still contains historical offers tagged to this card; the
  deal-requirement card map now correctly lists it as unmatched. The
  bank's `gaps[]` records the removal for traceability.
- **Standard Chartered Mastercard Titanium** — annual fee genuinely
  undisclosed (absent from Summary Box Table 1; only year-2 reversal
  published). Recorded as a SCB disclosure gap, not a research gap.
- **askaribank.com is behind Cloudflare WAF** and was unreachable to
  WebFetch this pass. Askari verification relied on Wayback snapshots
  and search-snippet evidence; confidence dropped to medium/low on
  several Askari credit cards as a result.

## Reproducibility

For every bank, the per-bank log lists:

- the URLs the agent actually fetched (not just plausible URLs)
- the field-by-field decision (verified / corrected / still unknown) with
  the source URL on the line
- any contradictions found and how they were preserved
- "Sources searched but unproductive" sections where relevant (MCB has
  the largest such section, given the weak public surface)

To re-run the same pass:

1. Read `README.md` for methodology.
2. Read `banks/_template.md` for log format.
3. Dispatch one agent per bank with the per-bank prompt patterns recorded
   in this directory.
4. Re-run `scripts/card_requirements/build_card_requirements_normalized.py`
   and `scripts/card_requirements/build_deal_requirement_card_map.py`.
5. Re-run `scripts/card_requirements/audit_requirement_evidence.py` and
   diff against the prior audit.

Bank-side materials change every six months (Jan–Jun and Jul–Dec SOC/SOBC
cycles). The Jul–Dec 2026 SOCs were already published for several banks at
the time of this pass (notably Al Baraka); pilot files retain Jan–Jun 2026
values and flag forward-looking changes in `notes[]`.
