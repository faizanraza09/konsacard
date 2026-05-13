from __future__ import annotations

import json
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
OFFERS_PATH = ROOT / "data" / "offers.json"
REQUIRED_DAY_NAMES = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
]
VALID_CATEGORIES = {"credit", "debit", "other"}
VALID_CITIES = {"Karachi", "Lahore", "Islamabad"}


def fail(message: str) -> None:
    raise SystemExit(f"[offers:validate] {message}")


def main() -> None:
    payload = json.loads(OFFERS_PATH.read_text(encoding="utf-8"))

    for key in ["generatedAt", "dayNames", "cities", "restaurantsByCity", "stats", "offers"]:
        if key not in payload:
            fail(f"Missing top-level key: {key}")

    if payload["dayNames"] != REQUIRED_DAY_NAMES:
        fail("Unexpected dayNames ordering.")

    offers = payload["offers"]
    if not isinstance(offers, list) or not offers:
        fail("Offers list is empty or invalid.")

    seen = set()
    city_counter = Counter()
    bank_counter = Counter()
    restaurant_pairs = set()

    for index, offer in enumerate(offers):
        for field in [
            "city",
            "restaurant",
            "bank",
            "card",
            "cardCategory",
            "discountLabel",
            "days",
            "daysLabel",
        ]:
            if field not in offer:
                fail(f"Offer #{index} missing field: {field}")

        if offer["city"] not in VALID_CITIES:
            fail(f"Offer #{index} has unexpected city: {offer['city']}")
        if not str(offer["restaurant"]).strip():
            fail(f"Offer #{index} has empty restaurant.")
        if not str(offer["bank"]).strip():
            fail(f"Offer #{index} has empty bank.")
        if not str(offer["card"]).strip():
            fail(f"Offer #{index} has empty card.")
        if offer["cardCategory"] not in VALID_CATEGORIES:
            fail(f"Offer #{index} has invalid cardCategory: {offer['cardCategory']}")
        if not isinstance(offer["days"], list) or not offer["days"]:
            fail(f"Offer #{index} has invalid days list.")
        if any(day not in range(7) for day in offer["days"]):
            fail(f"Offer #{index} has out-of-range day indexes.")

        pct = offer.get("discountPct")
        fixed = offer.get("fixedDiscountPkr")
        cap = offer.get("capPkr")

        if pct is None and fixed is None:
            fail(f"Offer #{index} has neither discountPct nor fixedDiscountPkr.")
        if pct is not None and not (0 < float(pct) <= 100):
            fail(f"Offer #{index} has invalid discountPct: {pct}")
        if fixed is not None and int(fixed) <= 0:
            fail(f"Offer #{index} has invalid fixedDiscountPkr: {fixed}")
        if cap is not None and int(cap) <= 0:
            fail(f"Offer #{index} has invalid capPkr: {cap}")

        dedupe_key = (
            offer["city"],
            offer["restaurant"],
            offer["bank"],
            offer["card"],
            tuple(offer["days"]),
            offer.get("discountPct"),
            offer.get("fixedDiscountPkr"),
            offer.get("capPkr"),
            offer.get("offerTitle"),
            offer.get("offerDescription"),
            tuple(offer.get("orderTypes", [])),
            offer.get("sourceAddress"),
        )
        if dedupe_key in seen:
            fail(
                f"Duplicate offer detected for {offer['bank']} / {offer['card']} / {offer['restaurant']}."
            )
        seen.add(dedupe_key)

        city_counter[offer["city"]] += 1
        bank_counter[offer["bank"]] += 1
        restaurant_pairs.add(f"{offer['city']}||{offer['restaurant']}")

    if set(city_counter.keys()) != VALID_CITIES:
        fail("One or more required cities are missing from offers.")
    if "Easypaisa" not in bank_counter:
        fail("Easypaisa offers are missing from the merged dataset.")

    stats = payload["stats"]
    expected_stats = {
        "offers": len(offers),
        "cards": len({f"{offer['bank']}||{offer['card']}" for offer in offers}),
        "banks": len(bank_counter),
        "restaurants": len(restaurant_pairs),
    }
    if stats != expected_stats:
        fail(f"Stats mismatch. Expected {expected_stats}, found {stats}.")

    restaurants_by_city = payload["restaurantsByCity"]
    for city in VALID_CITIES:
        expected_restaurants = sorted(
            {offer["restaurant"] for offer in offers if offer["city"] == city}
        )
        if restaurants_by_city.get(city) != expected_restaurants:
            fail(f"restaurantsByCity mismatch for {city}.")

    print("[offers:validate] Dataset looks valid.")
    print(f"[offers:validate] Offers: {expected_stats['offers']}")
    print(f"[offers:validate] Cards: {expected_stats['cards']}")
    print(f"[offers:validate] Banks: {expected_stats['banks']}")
    print(f"[offers:validate] Restaurants: {expected_stats['restaurants']}")


if __name__ == "__main__":
    main()
