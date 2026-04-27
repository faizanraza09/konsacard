import json
import re
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
NORMALIZED_DIR = ROOT / "data" / "card-requirements" / "normalized"
AUDIT_DIR = ROOT / "data" / "card-requirements" / "audit"


FIELD_LABELS = {
    "minimum_monthly_salary_pkr": "salary",
    "minimum_account_balance_pkr": "balance",
    "annual_fee_pkr": "annual_fee",
}


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def classify_field(row: dict, field_name: str, source_lookup: dict[str, dict]) -> dict:
    requirements = row.get("requirements", {})
    value = requirements.get(field_name)
    notes = " ".join(row.get("notes", [])).lower()
    bank_gaps = " ".join(row.get("bank_gaps", [])).lower()
    retrieved_note = (row.get("retrieved_note") or "").lower()
    confidence = row.get("confidence", "low")
    source_ids = row.get("requirement_sources", {}).get(field_name, [])
    urls = [source_lookup[source_id]["url"] for source_id in source_ids if source_id in source_lookup]
    urls_lower = [url.lower() for url in urls]

    has_pdf = any(url.endswith(".pdf") or ".pdf?" in url for url in urls_lower)
    has_apply = any("/apply" in url or "apply-now" in url for url in urls_lower)
    has_priority_or_account = any(
        token in url
        for url in urls_lower
        for token in (
            "current-account",
            "saving-account",
            "savings-account",
            "premium-banking",
            "priority",
            "khaas",
            "women-account",
            "student-account",
            "freelancer",
            "roshan",
            "asaan",
            "kids-club",
            "inclusive-current-account",
        )
    )
    has_card_page = any(
        token in url
        for url in urls_lower
        for token in (
            "credit-card",
            "debit-card",
            "cards/",
            "visa-",
            "mastercard",
            "paypak",
            "unionpay",
            "card/",
        )
    )
    inferred_words = (
        "account-linked",
        "account linked",
        "eligibility is balance-based",
        "existing account",
        "relationship",
        "premium customer",
        "priority customer",
        "priority relationship",
        "khaas",
        "inferred",
        "income band",
        "lowest selectable",
        "no separate public",
        "underlying account",
        "ordinary current-account relationships",
        "current-account faq",
        "kfs",
        "fee waiver",
        "waived for",
        "maintaining",
    )
    explicit_words = (
        "page states",
        "official apply-now page explicitly states",
        "official boppdf",  # harmless unmatched fallback
        "soc lists",
        "public 2026 soc lists",
        "summary box",
        "official mcb soc",
    )
    note_inferred = any(word in notes for word in inferred_words)
    note_explicit = any(word in notes for word in explicit_words)

    if value is None:
        basis = "missing"
        reason = "Field is null."
    elif field_name == "annual_fee_pkr":
        if has_pdf and ("schedule" in " ".join(urls_lower) or "soc" in " ".join(urls_lower) or "summary-box" in " ".join(urls_lower) or "summary_box" in " ".join(urls_lower)):
            basis = "explicit_soc_or_summary_pdf"
            reason = "Annual fee is supported by an SOC or summary-box PDF."
        elif has_card_page and not note_inferred:
            basis = "explicit_card_page"
            reason = "Annual fee is supported by a public card page."
        elif has_priority_or_account or note_inferred:
            basis = "inferred_account_relationship"
            reason = "Annual fee depends on the account relationship, waiver logic, or premium segment."
        else:
            basis = "other_explicit_source"
            reason = "Annual fee is filled from a public source, but not cleanly classifiable as card-page or SOC PDF."
    elif field_name == "minimum_monthly_salary_pkr":
        if has_apply:
            if "income band" in notes or "lowest selectable" in notes:
                basis = "inferred_apply_flow"
                reason = "Salary is inferred from official apply-flow income bands."
            else:
                basis = "explicit_apply_flow"
                reason = "Salary is explicitly supported by an official apply-flow or eligibility page."
        elif has_card_page and value == 0 and (has_priority_or_account or note_inferred):
            basis = "inferred_account_relationship"
            reason = "Zero salary was derived from account-linked or balance-based eligibility rather than explicit salary wording."
        elif has_card_page and (note_explicit or not note_inferred):
            basis = "explicit_card_page"
            reason = "Salary is supported by a public card or eligibility page."
        elif has_priority_or_account or note_inferred:
            basis = "inferred_account_relationship"
            reason = "Salary was derived from account relationship or balance-based access rather than an explicit salary threshold."
        else:
            basis = "other_explicit_source"
            reason = "Salary is filled from public material but not cleanly classifiable."
    else:
        if any(
            requirements.get(key) is not None
            for key in ("minimum_average_balance_pkr", "minimum_deposit_pkr", "minimum_relationship_balance_pkr")
        ):
            alt_values = [
                requirements.get("minimum_average_balance_pkr"),
                requirements.get("minimum_deposit_pkr"),
                requirements.get("minimum_relationship_balance_pkr"),
            ]
            alt_values = [alt for alt in alt_values if alt is not None]
            if len(set(alt_values)) == 1 and value in alt_values:
                basis = "normalized_from_alt_balance_key"
                reason = "Balance surfaced through normalization from a non-standard balance key."
            elif note_inferred or has_priority_or_account:
                basis = "inferred_account_relationship"
                reason = "Balance is relationship-based and came from premium/account material."
            else:
                basis = "other_explicit_source"
                reason = "Balance is populated from public material but needs closer manual provenance review."
        elif has_card_page and note_explicit:
            basis = "explicit_card_page"
            reason = "Balance is explicitly stated on the public card page."
        elif has_pdf and ("soc" in " ".join(urls_lower) or "schedule" in " ".join(urls_lower)):
            basis = "explicit_soc_or_summary_pdf"
            reason = "Balance is taken from an official PDF schedule or summary-style document."
        elif has_priority_or_account or note_inferred:
            basis = "inferred_account_relationship"
            reason = "Balance is derived from account, relationship, or premium-banking material."
        elif has_card_page:
            basis = "explicit_card_page"
            reason = "Balance appears to be supported directly on a public card page."
        else:
            basis = "other_explicit_source"
            reason = "Balance is filled from public material but not cleanly classifiable."

    manual_review = basis in {
        "inferred_account_relationship",
        "inferred_apply_flow",
        "normalized_from_alt_balance_key",
        "other_explicit_source",
    } or confidence == "low"

    if "public sources did not expose clear" in bank_gaps and basis == "inferred_account_relationship":
        reason += " Bank-level gaps still note weak direct publication."

    return {
        "value": value,
        "basis": basis,
        "manual_review": manual_review,
        "reason": reason,
        "confidence": confidence,
        "source_urls": urls,
    }


def main() -> None:
    AUDIT_DIR.mkdir(parents=True, exist_ok=True)
    rows = load_json(NORMALIZED_DIR / "card_requirements.json")
    sources = load_json(NORMALIZED_DIR / "sources.json")
    deal_map = load_json(NORMALIZED_DIR / "deal_requirement_card_map.json")
    source_lookup = {item["source_id"]: item for item in sources}
    matched_card_ids = {
        item["requirement_card_id"]
        for item in deal_map
        if item.get("matched") and item.get("requirement_card_id")
    }

    audited_rows = []
    summary = {field: Counter() for field in FIELD_LABELS}
    flagged_rows = defaultdict(list)

    for row in rows:
        if row["card_id"] not in matched_card_ids:
            continue

        audited = {
            "card_id": row["card_id"],
            "bank_name": row["bank_name"],
            "card_name": row["card_name"],
            "confidence": row.get("confidence", "low"),
            "audit": {},
        }

        for field_name, short_label in FIELD_LABELS.items():
            field_audit = classify_field(row, field_name, source_lookup)
            audited["audit"][field_name] = field_audit
            summary[field_name][field_audit["basis"]] += 1
            if field_audit["manual_review"]:
                flagged_rows[short_label].append(
                    {
                        "bank_name": row["bank_name"],
                        "card_name": row["card_name"],
                        "value": field_audit["value"],
                        "basis": field_audit["basis"],
                        "confidence": field_audit["confidence"],
                        "reason": field_audit["reason"],
                    }
                )

        audited_rows.append(audited)

    audited_rows.sort(key=lambda item: (item["bank_name"], item["card_name"]))
    for key in flagged_rows:
        flagged_rows[key].sort(key=lambda item: (item["bank_name"], item["card_name"]))

    audit_payload = {
        "generated_at": "2026-04-26",
        "matched_card_count": len(audited_rows),
        "field_basis_summary": {field: dict(counter) for field, counter in summary.items()},
        "manual_review_counts": {field: len(items) for field, items in flagged_rows.items()},
        "rows": audited_rows,
    }
    (AUDIT_DIR / "requirement_evidence_audit.json").write_text(
        json.dumps(audit_payload, indent=2), encoding="utf-8"
    )

    lines = [
        "# Requirement Evidence Audit",
        "",
        "Audit date: 2026-04-26",
        "",
        "This report classifies filled requirement fields into direct evidence versus inferred/account-relationship fills.",
        "",
        "## Basis Summary",
        "",
    ]
    for field_name, short_label in FIELD_LABELS.items():
        lines.append(f"### {field_name}")
        for basis, count in sorted(summary[field_name].items()):
            lines.append(f"- {basis}: {count}")
        lines.append("")

    lines.append("## Manual Review Buckets")
    lines.append("")
    for short_label in ("salary", "balance", "annual_fee"):
        items = flagged_rows[short_label]
        lines.append(f"### {short_label}")
        lines.append(f"- flagged rows: {len(items)}")
        for item in items[:40]:
            lines.append(
                f"- {item['bank_name']} | {item['card_name']} | {item['value']} | {item['basis']} | {item['confidence']}"
            )
        if len(items) > 40:
            lines.append(f"- ... {len(items) - 40} more rows omitted from markdown; see JSON.")
        lines.append("")

    (AUDIT_DIR / "requirement_evidence_audit.md").write_text(
        "\n".join(lines) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
