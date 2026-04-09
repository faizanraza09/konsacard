import json
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OFFERS_PATH = ROOT / "data" / "offers.json"
DEFAULT_EASYPAISA_PATH = ROOT / "data" / "sources" / "easypaisa" / "discountworld-food.json"

DAY_ORDER = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
]


def normalize_offer(row: dict) -> dict:
    discount_pct = row.get("headline_discount_pct")
    discount_label = row.get("headline_discount_label")
    if discount_label is None and discount_pct is not None:
        discount_label = f"{discount_pct}%"

    return {
        "city": row["city"],
        "restaurant": row["merchant_name"],
        "bank": "Easypaisa",
        "card": row["card_name"],
        "cardCategory": "debit",
        "discountPct": float(discount_pct) if discount_pct is not None else None,
        "discountLabel": discount_label,
        "fixedDiscountPkr": None,
        "offerTitle": None,
        "days": list(range(7)),
        "daysLabel": "All Days",
        "capPkr": row.get("cap_pkr"),
    }


def build_payload(offers: list[dict], existing_payload: dict) -> dict:
    restaurants_by_city: dict[str, set[str]] = {}
    for offer in offers:
        restaurants_by_city.setdefault(offer["city"], set()).add(offer["restaurant"])

    unique_restaurants = {f"{offer['city']}||{offer['restaurant']}" for offer in offers}

    return {
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "dayNames": existing_payload["dayNames"],
        "cities": existing_payload["cities"],
        "restaurantsByCity": {
            city: sorted(values) for city, values in restaurants_by_city.items()
        },
        "stats": {
            "offers": len(offers),
            "cards": len({f"{offer['bank']}||{offer['card']}" for offer in offers}),
            "banks": len({offer["bank"] for offer in offers}),
            "restaurants": len(unique_restaurants),
        },
        "offers": offers,
    }


def dedupe_offers(offers: list[dict]) -> list[dict]:
    deduped: dict[tuple, dict] = {}
    for offer in offers:
        key = (
            offer["city"],
            offer["restaurant"],
            offer["bank"],
            offer["card"],
            tuple(offer["days"]),
            offer.get("discountPct"),
            offer.get("fixedDiscountPkr"),
            offer.get("capPkr"),
            offer.get("offerTitle"),
        )
        deduped[key] = offer
    return list(deduped.values())


def filter_invalid_offers(offers: list[dict]) -> list[dict]:
    cleaned = []
    for offer in offers:
        pct = offer.get("discountPct")
        fixed = offer.get("fixedDiscountPkr")
        if pct is None and fixed is None:
            continue
        if pct is not None and float(pct) <= 0:
            continue
        if fixed is not None and int(fixed) <= 0:
            continue
        cleaned.append(offer)
    return cleaned


def merge_easypaisa_into_offers(
    offers_path: Path = DEFAULT_OFFERS_PATH,
    easypaisa_path: Path = DEFAULT_EASYPAISA_PATH,
) -> dict:
    offers_payload = json.loads(offers_path.read_text(encoding="utf-8"))
    easypaisa_payload = json.loads(easypaisa_path.read_text(encoding="utf-8"))

    existing_offers = offers_payload["offers"]
    existing_keys = {
        (
            row["city"],
            row["restaurant"],
            row["bank"],
            row["card"],
            tuple(row["days"]),
            row["capPkr"],
            row["discountPct"],
        )
        for row in existing_offers
    }

    merged_offers = list(existing_offers)
    for row in easypaisa_payload["offers"]:
        normalized = normalize_offer(row)
        key = (
            normalized["city"],
            normalized["restaurant"],
            normalized["bank"],
            normalized["card"],
            tuple(normalized["days"]),
            normalized["capPkr"],
            normalized["discountPct"],
        )
        if key in existing_keys:
            continue
        merged_offers.append(normalized)
        existing_keys.add(key)

    merged_offers = filter_invalid_offers(merged_offers)
    merged_offers = dedupe_offers(merged_offers)

    merged_offers.sort(
        key=lambda item: (
            item["city"],
            item["bank"],
            item["card"],
            item["restaurant"],
            item["discountPct"] if item["discountPct"] is not None else -1,
        )
    )

    payload = build_payload(merged_offers, offers_payload)
    offers_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return payload


def main() -> None:
    merge_easypaisa_into_offers()


if __name__ == "__main__":
    main()
