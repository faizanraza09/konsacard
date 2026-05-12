import hashlib
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
WORK_DIR = ROOT / "data" / "card-requirements" / "work"
NORMALIZED_DIR = ROOT / "data" / "card-requirements" / "normalized"


def slugify(value: str) -> str:
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = re.sub(r"-{2,}", "-", value).strip("-")
    return value


def source_type_for_url(url: str) -> str:
    lowered = url.lower()
    if lowered.endswith(".xlsx") or lowered.endswith(".xls"):
        return "spreadsheet"
    if lowered.endswith(".pdf") or ".pdf?" in lowered:
        return "pdf"
    return "html"


def source_id_for(bank_slug: str, url: str) -> str:
    digest = hashlib.sha1(url.encode("utf-8")).hexdigest()[:10]
    return f"{bank_slug}-src-{digest}"


def normalize_requirements(requirements: dict) -> dict:
    normalized = dict(requirements or {})
    if normalized.get("minimum_account_balance_pkr") is None:
        alt_values = [
            normalized.get("minimum_average_balance_pkr"),
            normalized.get("minimum_deposit_pkr"),
            normalized.get("minimum_relationship_balance_pkr"),
        ]
        alt_values = [value for value in alt_values if value is not None]
        unique_values = sorted(set(alt_values))
        # Only normalize when public balance-like thresholds agree or there is a single
        # surfaced numeric threshold. Conflicting new-vs-existing customer thresholds are
        # left untouched for manual review.
        if len(unique_values) == 1:
            normalized["minimum_account_balance_pkr"] = unique_values[0]
    return normalized


def main() -> None:
    NORMALIZED_DIR.mkdir(parents=True, exist_ok=True)

    source_index = {}
    cards = []
    card_requirements = []

    for path in sorted(WORK_DIR.glob("*-pilot.json")):
        with path.open("r", encoding="utf-8") as handle:
            pilot = json.load(handle)

        bank_slug = pilot["bank_slug"]
        bank_name = pilot["bank_name"]
        bank_gaps = pilot.get("gaps", [])
        retrieved_note = pilot.get("retrieved_note")

        for index, card in enumerate(pilot.get("cards", []), start=1):
            card_slug = slugify(card["card_name"])
            card_id = f"{bank_slug}--{card_slug}"
            urls = card.get("sources", [])
            source_ids = []

            for url in urls:
                source_id = source_id_for(bank_slug, url)
                source_ids.append(source_id)
                existing = source_index.get(source_id)
                if existing is None:
                    source_index[source_id] = {
                        "source_id": source_id,
                        "bank_slug": bank_slug,
                        "bank_name": bank_name,
                        "url": url,
                        "source_type": source_type_for_url(url),
                        "used_by_card_ids": [card_id],
                    }
                elif card_id not in existing["used_by_card_ids"]:
                    existing["used_by_card_ids"].append(card_id)

            confidence = card.get("confidence", "low")
            requirements = normalize_requirements(card.get("requirements", {}))
            requirement_sources = {
                key: source_ids[:] for key, value in requirements.items() if value is not None
            }

            cards.append(
                {
                    "card_id": card_id,
                    "bank_slug": bank_slug,
                    "bank_name": bank_name,
                    "card_name": card["card_name"],
                    "card_slug": card_slug,
                    "card_type": card.get("card_type"),
                    "tier": card.get("tier"),
                    "confidence": confidence,
                    "pilot_position": index,
                }
            )

            card_requirements.append(
                {
                    "card_id": card_id,
                    "bank_slug": bank_slug,
                    "bank_name": bank_name,
                    "card_name": card["card_name"],
                    "requirements": requirements,
                    "requirement_sources": requirement_sources,
                    "source_ids": source_ids,
                    "confidence": confidence,
                    "notes": card.get("notes", []),
                    "bank_gaps": bank_gaps,
                    "retrieved_note": retrieved_note,
                }
            )

    cards.sort(key=lambda item: (item["bank_name"], item["card_type"] or "", item["card_name"]))
    card_requirements.sort(
        key=lambda item: (item["bank_name"], item["requirements"].get("minimum_monthly_salary_pkr") is None, item["card_name"])
    )
    sources = sorted(source_index.values(), key=lambda item: (item["bank_name"], item["url"]))

    for source in sources:
        source["used_by_card_ids"].sort()

    outputs = {
        "cards.json": cards,
        "card_requirements.json": card_requirements,
        "sources.json": sources,
    }

    for filename, payload in outputs.items():
        out_path = NORMALIZED_DIR / filename
        with out_path.open("w", encoding="utf-8", newline="\n") as handle:
            json.dump(payload, handle, indent=2)
            handle.write("\n")


if __name__ == "__main__":
    main()
