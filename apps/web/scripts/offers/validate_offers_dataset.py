from __future__ import annotations

import argparse
import json
import subprocess
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
OFFERS_PATH = ROOT / "data" / "offers.json"
DEAL_MAP_PATH = ROOT / "data" / "card-requirements" / "normalized" / "deal_requirement_card_map.json"
EXPECTED_BANKS_PATH = ROOT / "data" / "expected_banks.json"
KNOWN_UNMATCHED_PATH = ROOT / "data" / "known_unmatched_cards.json"
THRESHOLDS_PATH = ROOT / "data" / "refresh_thresholds.json"
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


def warn(message: str) -> None:
    print(f"[offers:validate] WARN: {message}")


def source_of_bank(bank: str) -> str:
    if bank == "Easypaisa":
        return "easypaisa"
    if bank == "National Bank of Pakistan":
        return "nbp"
    return "peekaboo"


def load_previous_offers() -> list[dict] | None:
    try:
        result = subprocess.run(
            ["git", "show", "HEAD:apps/web/data/offers.json"],
            cwd=ROOT.parent.parent,
            capture_output=True,
            text=True,
            check=False,
        )
    except FileNotFoundError:
        return None
    if result.returncode != 0:
        return None
    try:
        return json.loads(result.stdout)["offers"]
    except (json.JSONDecodeError, KeyError):
        return None


def run_strict_checks(offers: list[dict]) -> None:
    expected_banks_doc = json.loads(EXPECTED_BANKS_PATH.read_text(encoding="utf-8"))
    expected_banks = set(expected_banks_doc["banks"])
    known_unmatched_doc = json.loads(KNOWN_UNMATCHED_PATH.read_text(encoding="utf-8"))
    known_unmatched = {(p["bank"], p["card"]) for p in known_unmatched_doc["pairs"]}
    thresholds = json.loads(THRESHOLDS_PATH.read_text(encoding="utf-8"))

    bank_counter: Counter = Counter(o["bank"] for o in offers)
    city_counter: Counter = Counter(o["city"] for o in offers)
    source_counter: Counter = Counter(source_of_bank(o["bank"]) for o in offers)

    missing_banks = expected_banks - set(bank_counter.keys())
    if missing_banks:
        fail(
            "expected banks have zero offers: "
            + ", ".join(sorted(missing_banks))
            + " (update data/expected_banks.json if this removal is intentional)"
        )

    unexpected_banks = set(bank_counter.keys()) - expected_banks
    if unexpected_banks:
        fail(
            "unexpected new bank(s) in offers: "
            + ", ".join(sorted(unexpected_banks))
            + " (add to data/expected_banks.json after reviewing)"
        )

    for source, floor in thresholds["min_offers_per_source"].items():
        actual = source_counter.get(source, 0)
        if actual < floor:
            fail(
                f"source '{source}' produced {actual} offers, below floor {floor} "
                f"(threshold in data/refresh_thresholds.json)"
            )

    for city, floor in thresholds["min_offers_per_city"].items():
        actual = city_counter.get(city, 0)
        if actual < floor:
            fail(
                f"city '{city}' has {actual} offers, below floor {floor} "
                f"(threshold in data/refresh_thresholds.json)"
            )

    if not DEAL_MAP_PATH.exists():
        fail(
            f"{DEAL_MAP_PATH.relative_to(ROOT)} is missing. Run "
            "`python scripts/card_requirements/build_deal_requirement_card_map.py` "
            "as part of the refresh pipeline so unmatched cards can be checked."
        )
    deal_map = json.loads(DEAL_MAP_PATH.read_text(encoding="utf-8"))
    distinct_pairs = {(o["bank"], o["card"]) for o in offers}
    mapped_pairs = {(e["deal_bank_name"], e["deal_card_name"]) for e in deal_map}
    missing_from_map = distinct_pairs - mapped_pairs
    if missing_from_map:
        bullets = "\n  - ".join(f"{b} || {c}" for b, c in sorted(missing_from_map))
        fail(
            "offers.json contains (bank, card) pair(s) absent from deal_requirement_card_map.json. "
            "Rerun build_deal_requirement_card_map.py before validating:\n  - " + bullets
        )

    unmatched_now = {
        (e["deal_bank_name"], e["deal_card_name"])
        for e in deal_map
        if not e.get("matched")
    } & distinct_pairs
    new_unmatched = sorted(unmatched_now - known_unmatched)
    if new_unmatched:
        bullets = "\n  - ".join(f"{b} || {c}" for b, c in new_unmatched)
        fail(
            "new (bank, card) pair(s) appeared in offers.json with no requirements record. "
            "Either add the card to data/card-requirements/normalized/card_requirements.json, "
            "add a MANUAL_ALIASES entry in scripts/card_requirements/build_deal_requirement_card_map.py, "
            "or (if intentional) append to data/known_unmatched_cards.json:\n  - " + bullets
        )

    previous = load_previous_offers()
    if previous is None:
        warn("could not load HEAD's offers.json for regression checks (no git, no HEAD, or parse failure) — skipping volume and restaurant guardrails")
        return

    prev_total = len(previous)
    if prev_total > 0:
        drop_pct = (prev_total - len(offers)) / prev_total * 100
        if drop_pct > thresholds["max_total_offer_drop_pct"]:
            fail(
                f"total offers dropped {drop_pct:.1f}% (was {prev_total}, now {len(offers)}), "
                f"exceeds threshold {thresholds['max_total_offer_drop_pct']}%"
            )

    prev_restaurants = {f"{o['city']}||{o['restaurant']}" for o in previous}
    curr_restaurants = {f"{o['city']}||{o['restaurant']}" for o in offers}
    lost = prev_restaurants - curr_restaurants
    if len(lost) > thresholds["max_restaurants_lost"]:
        sample = sorted(lost)[:5]
        fail(
            f"{len(lost)} restaurants present in HEAD are missing now "
            f"(threshold {thresholds['max_restaurants_lost']}). Examples: {sample}"
        )

    print(f"[offers:validate] strict checks passed (prev offers={prev_total}, curr={len(offers)}, restaurants lost={len(lost)})")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Run additional regression checks used by the daily-refresh cron.",
    )
    args = parser.parse_args()

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

    if args.strict:
        run_strict_checks(offers)


if __name__ == "__main__":
    main()
