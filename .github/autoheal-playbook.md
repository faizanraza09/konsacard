# Daily-refresh auto-heal playbook

This is the operating procedure for an agent (Claude Code) that repairs a failed
**Daily offers refresh** run. It encodes the exact fix that was done by hand for
the Faysal PayPak + AL Habib Platinum cards. Follow it precisely and conservatively.

**Core principle: never fabricate financial data.** Minimum salaries, annual fees,
and eligibility are the product. If you cannot source a value confidently from an
official bank page / Schedule of Charges, do NOT invent it — fall back to the safe
unblock (known-unmatched) and leave the real requirements for a human to fill.

Repo root assumes `apps/web` is the working dir for the scripts below.

---

## 1. Triage — is this a failure we heal?

1. Find the latest `Daily offers refresh` run: `gh run list --workflow=daily-refresh.yml --limit 1`.
   If its conclusion is not `failure`, stop — nothing to do.
2. Read the failure signal:
   - The auto-opened issue (`gh issue list --label daily-refresh --state open`), whose body
     embeds the diff report including a **"New (bank, card) pairs"** section, and/or
   - The `refresh-report` artifact, and/or the `Strict validation` step log.
3. **Only heal the "new unmatched card" gate.** That gate's error text is:
   `new (bank, card) pair(s) appeared in offers.json with no requirements record`
   (from `scripts/offers/validate_offers_dataset.py`).
4. If the failure is any OTHER gate — total-offer-drop %, missing expected bank,
   unexpected new bank, per-source/per-city floor, restaurants-lost, SEO determinism —
   **do not auto-fix.** Comment on the issue summarizing the cause and stop. Those
   indicate feed problems, not a missing card record, and need a human.

Collect the exact offending `(bank, card)` strings — they are the bullets under
"New (bank, card) pairs" / the `new_unmatched` list. Use them verbatim (exact casing).

## 2. Immediate safe unblock (auto, push allowed)

Goal: get the daily refresh green again today without shipping any fabricated data.

1. Append each offending pair to `apps/web/data/known_unmatched_cards.json` `pairs`,
   each with a short note, e.g. `{ "bank": "...", "card": "...", "note": "auto-unblock <YYYY-MM-DD>, requirements PR pending" }`.
2. Commit on `main` and apply the identical commit to `dev` (cherry-pick) — the two
   branches are kept in lockstep (see how the daily workflow mirrors). Push both.
   Commit message: `fix(data): auto-unblock <N> new unmatched card(s) for daily refresh`.
3. Re-trigger the refresh: `gh workflow run daily-refresh.yml`, then watch it
   (`gh run watch <id> --exit-status`). Confirm it goes green. A fresh scrape is
   required because the new cards only exist in a new scrape, not in the committed
   (yesterday's) offers.json.
4. If it still fails, the cause was not (only) the unmatched-card gate — go back to
   triage, comment on the issue, and stop.

Idempotency: before adding, check the pair is not already in known_unmatched and
that there is no open auto-heal PR already covering it (avoid duplicates).

## 3. Requirements PR (research, human-reviewed — never auto-merge)

For each unblocked pair, produce the *real* bridge on a branch and open a PR. When
merged, this supersedes the known-unmatched entry (which you remove in the PR).

Decide per card, in this order of preference:

- **(a) Alias to an existing record** when the card is clearly a variant/rename of a
  card already in `card_requirements.json` (same bank, same tier). Add a
  `MANUAL_ALIASES[bank][deal_card_name] = existing_requirement_card_name` entry in
  `apps/web/scripts/card_requirements/build_deal_requirement_card_map.py`. The alias
  target must exist in `cards.json`. (Example done by hand: the two Faysal PayPak
  debit cards → `Faysal Islami Mastercard Classic Debit Card`.)
- **(b) Add a sourced record** when it's a genuinely new distinct product. Research
  the requirements from the **official bank product page and/or Schedule of Charges
  PDF** (use WebSearch/WebFetch; PDFs can be downloaded and parsed with `pypdf`).
  Add one record to each of `cards.json`, `card_requirements.json`, and `sources.json`
  (see the AL Habib Platinum commit `3987296` as the template — fields, source_ids,
  notes, bank_gaps, retrieved_note). Also add a `MANUAL_ALIASES` entry if the scraped
  deal name won't canonically match the record name. Set `confidence` honestly.
- **(c) Leave as known-unmatched** if you cannot source it confidently. Keep the
  known_unmatched entry, and say so explicitly in the PR/issue so a human can finish it.

Cross-check the bank's real lineup before writing a record — the scraped feed
mislabels cards (e.g. it once emitted a nonexistent tier). If the SOC / official page
contradicts the scraped name, note it and prefer an alias to the real nearest card.

In the PR branch: apply (a)/(b), **remove** the corresponding known_unmatched entries,
then verify (section 4). Open the PR with sources cited; do NOT merge it.

## 4. Verify before pushing / opening the PR

Confirm the change actually clears the gate, without touching tracked outputs:

- Rebuild the deal map against offers that include the new pairs and assert each is
  `matched` and the validator's `new_unmatched` set is empty. (Reference harness:
  inject the pairs into a temp `offers.json`, point
  `build_deal_requirement_card_map.py`'s `OFFERS_PATH`/`OUT_DIR` at a temp dir, run it,
  then check `deal_requirement_card_map.json` — see how commit `3987296` was verified.)
- `python3 scripts/card_requirements/audit_requirement_evidence.py` must exit 0. It
  regenerates audit artifacts; **revert those audit file changes** unless updating them
  is the point — keep the diff scoped to the fix.
- JSON validity + `cards.json`↔`card_requirements.json` card_id parity.

## 5. Report

- Comment on the failure issue with what was done (unblocked pairs, PR link) and close
  it once the re-run is green.
- If anything was left for a human (unsourced requirements, a non-card-gate failure),
  say so plainly in the issue and the PR body.

## Guardrails recap

- Never invent salaries/fees. Unsure ⇒ known-unmatched + flag for a human.
- Only the unmatched-card gate is auto-healed; all other gates ⇒ comment + stop.
- Auto-push is limited to the safe known-unmatched unblock. Real requirements always
  go through a PR.
- Keep `main` and `dev` in lockstep for any source-file change.
- Keep diffs scoped; revert incidental regenerated artifacts.
