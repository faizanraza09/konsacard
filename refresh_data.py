from __future__ import annotations

import json
import os
import re
import socket
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path
from threading import Lock

import requests
from requests.adapters import HTTPAdapter


BASE_DIR = Path(__file__).resolve().parent
OUTPUT_PATH = BASE_DIR / "data" / "offers.json"
ENV_PATH = BASE_DIR / ".env"


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


load_dotenv(ENV_PATH)

TOKEN = os.environ.get("PEEKABOO_TOKEN")
BASE = "https://peekaboo.guru"

if not TOKEN:
    raise RuntimeError("Missing PEEKABOO_TOKEN in .env or environment.")

HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json",
    "medium": "WEB",
    "version": "2.1.0.2",
}

CITIES = {
    "Karachi": {"lat": 24.861462, "long": 67.009939},
    "Lahore": {"lat": 31.520370, "long": 74.358749},
    "Islamabad": {"lat": 33.684420, "long": 73.047882},
}

COMMON_BODY = {
    "city": "Karachi",
    "country": "Pakistan",
    "lat": 24.861462,
    "long": 67.009939,
    "language": "en",
}

DAY_ORDER = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
]

DINING_NAME_KEYWORDS = {
    "restaurant",
    "cafe",
    "coffee",
    "grill",
    "bbq",
    "barbecue",
    "bistro",
    "kitchen",
    "steak",
    "steakhouse",
    "diner",
    "pizza",
    "burger",
    "pavilion",
    "pavillion",
    "bakery",
    "tea",
    "wok",
    "sushi",
    "lounge",
    "food",
    "eatery",
}

NON_DINING_TITLE_KEYWORDS = {
    "rack rate",
    "rack rates",
    "room",
    "rooms",
    "laundry",
    "gym",
    "business centre",
    "business center",
    "hall rental",
    "rent a car",
    "banquet",
    "wedding",
}

GENERIC_VENUE_KEYWORDS = {
    "hotel",
    "suites",
    "suite",
    "inn",
    "resort",
    "club",
}


original_getaddrinfo = socket.getaddrinfo


def patched_getaddrinfo(host, port, family=0, *args):
    return original_getaddrinfo(host, port, socket.AF_INET, *args)


socket.getaddrinfo = patched_getaddrinfo

session = requests.Session()
session.headers.update(HEADERS)
adapter = HTTPAdapter(pool_connections=20, pool_maxsize=20, max_retries=3)
session.mount("https://", adapter)
session.mount("http://", adapter)

deals_cache: dict[tuple[str, str], list[dict]] = {}
deals_cache_lock = Lock()


def infer_card_category(card_name: str | None) -> str:
    lowered = str(card_name or "").lower()
    if "noor " in lowered or lowered.startswith("noor "):
        return "credit"
    if "credit" in lowered:
        return "credit"
    if "debit" in lowered:
        return "debit"
    return "other"


def extract_discount(entity: dict) -> str | None:
    stats = entity.get("stats") or {}
    if not isinstance(stats, dict):
        return entity.get("discount")

    discount_flag = stats.get("discountFlag")
    max_discount = stats.get("maxDiscount")
    if discount_flag:
        if max_discount not in (None, ""):
            return f"{discount_flag} {max_discount}%"
        return str(discount_flag)
    if max_discount not in (None, ""):
        return f"{max_discount}%"
    return entity.get("discount")


def extract_percent_values(*parts: str | None) -> list[float]:
    text = " ".join(str(part or "") for part in parts)
    return [float(value) for value in re.findall(r"(\d+(?:\.\d+)?)\s*%", text)]


def parse_discount_pct(*parts: str | None) -> float | None:
    matches = extract_percent_values(*parts)
    if not matches:
        return None
    return max(matches)


def parse_fixed_discount_amount(*parts: str | None) -> int | None:
    text = " ".join(str(part or "") for part in parts)
    patterns = [
        r"(?:pkr|rs\.?)\s*:?\s*([0-9,]+)\s*off",
        r"([0-9,]+)\s*(?:pkr|rs\.?)\s*off",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            return int(match.group(1).replace(",", ""))
    return None


def build_discount_fields(discount_label: str | None, offer_title: str | None) -> dict:
    label_text = normalize_text(discount_label)
    title_text = normalize_text(offer_title)
    label_pct = parse_discount_pct(discount_label)
    title_pct = parse_discount_pct(offer_title)
    fixed_amount = parse_fixed_discount_amount(offer_title)

    if title_pct is not None and "up to" not in title_text and "upto" not in title_text:
        return {
            "discountPct": title_pct,
            "maxHeadlinePct": label_pct,
            "fixedDiscountPkr": fixed_amount,
            "discountKind": "percent_exact",
        }

    if fixed_amount is not None:
        return {
            "discountPct": label_pct,
            "maxHeadlinePct": label_pct,
            "fixedDiscountPkr": fixed_amount,
            "discountKind": "percent_with_fixed_cap" if label_pct is not None else "fixed_amount",
        }

    if title_pct is not None:
        return {
            "discountPct": title_pct,
            "maxHeadlinePct": label_pct,
            "fixedDiscountPkr": None,
            "discountKind": "percent_upto",
        }

    if label_pct is not None:
        return {
            "discountPct": label_pct,
            "maxHeadlinePct": label_pct,
            "fixedDiscountPkr": None,
            "discountKind": "percent_upto" if "up to" in label_text or "upto" in label_text else "percent_exact",
        }

    return {
        "discountPct": None,
        "maxHeadlinePct": None,
        "fixedDiscountPkr": fixed_amount,
        "discountKind": "fixed_amount" if fixed_amount is not None else "unknown",
    }


def parse_discount_cap(text: str | None) -> int | None:
    if not text:
        return None
    text = str(text)
    patterns = [
        r"(?:cap(?:ping)?|maximum discount(?: of)?|max discount(?: of)?)(?:[^0-9\r\n]{0,80})?(?:pkr|rs\.?)\s*:?\s*([0-9,]+)",
        r"(?:discount cap|discount capping)\s*:?\s*([0-9,]+)(?:\s*/-)?",
        r"max\s+(?:pkr|rs\.?)\s*:?\s*([0-9,]+)",
        r"(?:[0-9]+%\s*or\s*)?(?:pkr|rs\.?)\s*:?\s*([0-9,]+)(?:\s*/-)?\s*whichever is lower",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            return int(match.group(1).replace(",", ""))
    return None


def extract_weekdays(title: str | None, description: str | None) -> list[str]:
    text = " ".join(part for part in [title, description] if part)
    if not text:
        return DAY_ORDER.copy()

    lowered = text.lower()
    day_index = {day.lower(): idx for idx, day in enumerate(DAY_ORDER)}
    found = set()
    range_matches = re.findall(
        r"(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s*(?:to|till|-)\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)",
        lowered,
        flags=re.IGNORECASE,
    )
    for start_day, end_day in range_matches:
        start_idx = day_index[start_day]
        end_idx = day_index[end_day]
        if start_idx <= end_idx:
            for idx in range(start_idx, end_idx + 1):
                found.add(DAY_ORDER[idx])

    for day in DAY_ORDER:
        if day.lower() in lowered:
            found.add(day)

    if found:
        return [day for day in DAY_ORDER if day in found]

    if any(
        pattern in lowered
        for pattern in ["everyday", "every day", "all days", "monday till sunday", "monday to sunday"]
    ):
        return DAY_ORDER.copy()

    return DAY_ORDER.copy()


def extract_schedule_label(title: str | None, description: str | None) -> str:
    weekdays = extract_weekdays(title, description)
    return "All Days" if weekdays == DAY_ORDER else ", ".join(weekdays)


def extract_transaction_limit(text: str | None, period: str) -> int | None:
    if not text:
        return None

    lowered = str(text).lower()
    period_pattern = {"day": "day", "month": "month"}[period]

    if period == "day":
        direct_markers = [
            "per card per day",
            "per day per card",
            "one transaction per day",
            "only one transaction per card per day",
            "discount is applicable per transaction per card per day",
            "discount is applicable per transaction per day per card",
        ]
        if any(marker in lowered for marker in direct_markers):
            return 1

    patterns = [
        rf"only\s+one\s+transaction\s+per\s+card\s+per\s+{period_pattern}",
        rf"one\s+transaction\s+per\s+card\s+per\s+{period_pattern}",
        rf"one\s+transaction\s+per\s+{period_pattern}\s+per\s+card",
        rf"([0-9]+)\s+discounted\s+transactions?\s+per\s+{period_pattern}",
        rf"maximum\s+of\s+([0-9]+)\s+transactions?\s+per\s+{period_pattern}",
        rf"maximum\s+[a-z]+\(([0-9]+)\)\s+transactions?\s+per\s+{period_pattern}",
        rf"([0-9]+)\s+transactions?\s+per\s+card\s+per\s+{period_pattern}",
        rf"five\s+\([0-9]+\)\s+discounted\s+transactions?\s+per\s+{period_pattern}",
        rf"two\s+transactions?\s+per\s+{period_pattern}",
        rf"three\s+transactions?\s+per\s+{period_pattern}",
        rf"four\s+transactions?\s+per\s+{period_pattern}",
        rf"five\s+transactions?\s+per\s+{period_pattern}",
    ]
    for pattern in patterns:
        match = re.search(pattern, lowered, flags=re.IGNORECASE)
        if not match:
            continue
        if match.lastindex:
            return int(match.group(1))
        text_match = match.group(0)
        if "one" in text_match:
            return 1
        if "two" in text_match:
            return 2
        if "three" in text_match:
            return 3
        if "four" in text_match:
            return 4
        if "five" in text_match:
            return 5
    return None


def extract_order_types(text: str | None) -> list[str]:
    if not text:
        return []
    lowered = str(text).lower()
    values = []
    if "dine-in" in lowered or "dine in" in lowered:
        values.append("Dine-In")
    if "delivery" in lowered:
        values.append("Delivery")
    if "takeaway" in lowered or "take away" in lowered:
        values.append("Takeaway")
    return values


def normalize_text(value: str | None) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip().lower())


def is_dining_title(title: str | None) -> bool:
    lowered = normalize_text(title)
    if not lowered:
        return True
    return not any(keyword in lowered for keyword in NON_DINING_TITLE_KEYWORDS)


def looks_like_dining_venue(name: str | None) -> bool:
    lowered = normalize_text(name)
    if not lowered:
        return False
    return any(keyword in lowered for keyword in DINING_NAME_KEYWORDS)


def is_generic_lodging_venue(name: str | None) -> bool:
    lowered = normalize_text(name)
    if not lowered:
        return False
    return any(keyword in lowered for keyword in GENERIC_VENUE_KEYWORDS)


def is_dining_entity_offer(entity_name: str | None, deal_title: str | None) -> bool:
    if deal_title and not is_dining_title(deal_title):
        return False
    if looks_like_dining_venue(entity_name):
        return True
    if is_generic_lodging_venue(entity_name):
        return False
    return True


def get_entity_deals(city_name: str, city_meta: dict, entity_id: str | int) -> list[dict]:
    cache_key = (city_name, str(entity_id))
    with deals_cache_lock:
        cached = deals_cache.get(cache_key)
    if cached is not None:
        return cached

    payload = {
        "associatedDeals": True,
        "atlId": "_all",
        "card": "All",
        "city": city_name,
        "country": "Pakistan",
        "language": "en",
        "lat": city_meta["lat"],
        "limit": 100,
        "long": city_meta["long"],
        "offset": 0,
        "sourceEntityId": "_all",
        "targetBranchId": "_all",
        "targetEntityId": entity_id,
    }

    deals = []
    while True:
        res = session.post(f"{BASE}/api/v8/entity/deals", json=payload, timeout=60)
        res.raise_for_status()
        data = res.json()
        page_deals = data.get("deals", [])
        if not page_deals:
            break
        deals.extend(page_deals)
        if len(page_deals) < payload["limit"]:
            break
        payload["offset"] += payload["limit"]

    with deals_cache_lock:
        deals_cache[cache_key] = deals
    return deals


def deal_matches_card(deal: dict, bank: dict, card: dict) -> bool:
    if str(deal.get("sourceEntityId")) != str(bank["sourceEntityId"]):
        return False
    for association in deal.get("associations") or []:
        if not isinstance(association, dict):
            continue
        if str(association.get("typeId")) == str(card["typeId"]):
            return True
        if str(association.get("sourceEntityAssociationId")) == str(card["associationId"]):
            return True
        if association.get("name") == card.get("typeName"):
            return True
    return False


def get_banks() -> list[dict]:
    res = session.post(
        f"{BASE}/api/v6/sourceEntities",
        json={**COMMON_BODY, "limit": 200, "offset": 0},
        timeout=60,
    )
    res.raise_for_status()
    banks = []
    for item in res.json():
        if not isinstance(item, dict):
            continue
        categories = [
            str(category.get("categoryName", "")).lower()
            for category in item.get("categories", [])
            if isinstance(category, dict)
        ]
        if "banks" in categories:
            banks.append(item)
    return banks


def get_cards(bank: dict) -> tuple[dict, list[dict]]:
    url = (
        f"{BASE}/api/sourceEntity/{bank['id']}/associationType/_all"
        f"?city=Karachi&country=Pakistan&entity=&language=en"
        f"&lat=24.861462&limit=50&long=67.009939&offset=0"
    )
    res = session.get(url, timeout=60)
    res.raise_for_status()
    data = res.json()
    if not isinstance(data, list):
        return bank, []
    cards = [item for item in data if isinstance(item, dict) and item.get("typeName")]
    return bank, cards


def get_card_offers(city_name: str, city_meta: dict, bank: dict, card: dict) -> list[dict]:
    offers = []
    offset = 0
    base_body = {
        "sortType": "trending",
        "targetEntities": "_all",
        "city": city_name,
        "country": "Pakistan",
        "lat": city_meta["lat"],
        "long": city_meta["long"],
        "language": "en",
        "category": "food",
        "categoryId": "1",
        "sourceEntityId": str(bank["sourceEntityId"]),
        "discount": bank["name"],
        "ai": str(card["associationId"]),
        "associationTypeId": str(card["typeId"]),
        "atlId": str(card["typeId"]),
        "card": re.sub(r"[^a-z0-9]+", "-", card["typeName"].lower()).strip("-"),
    }

    while True:
        res = session.post(
            f"{BASE}/api/v8/entities",
            json={**base_body, "limit": 50, "offset": offset},
            timeout=60,
        )
        res.raise_for_status()
        data = res.json()
        entities = data.get("entities", [])
        if not entities:
            break

        for entity in entities:
            entity_deals = get_entity_deals(city_name, city_meta, entity.get("id"))
            matched_deals = [deal for deal in entity_deals if deal_matches_card(deal, bank, card)]

            if not matched_deals:
                if not is_dining_entity_offer(entity.get("name"), None):
                    continue
                discount_label = extract_discount(entity)
                discount_fields = build_discount_fields(discount_label, None)
                if discount_label:
                    offers.append(
                        {
                            "city": city_name,
                            "restaurant": entity.get("name"),
                            "bank": bank["name"],
                            "card": card["typeName"],
                            "cardCategory": infer_card_category(card["typeName"]),
                            "cardKey": f"{bank['name']} || {card['typeName']}",
                            "discountPct": discount_fields["discountPct"],
                            "discountLabel": discount_label,
                            "discountKind": discount_fields["discountKind"],
                            "maxHeadlinePct": discount_fields["maxHeadlinePct"],
                            "fixedDiscountPkr": discount_fields["fixedDiscountPkr"],
                            "offerTitle": None,
                            "days": list(range(7)),
                            "daysLabel": "All Days",
                            "startDate": None,
                            "endDate": None,
                            "capPkr": None,
                            "dailyLimit": None,
                            "monthlyLimit": None,
                            "orderTypes": [],
                        }
                    )
                continue

            for deal in matched_deals:
                if not is_dining_entity_offer(entity.get("name"), deal.get("title")):
                    continue
                discount_label = extract_discount(entity)
                discount_fields = build_discount_fields(discount_label, deal.get("title"))
                if not discount_label:
                    continue
                days = extract_weekdays(deal.get("title"), deal.get("description"))
                offers.append(
                    {
                        "city": city_name,
                        "restaurant": entity.get("name"),
                        "bank": bank["name"],
                        "card": card["typeName"],
                        "cardCategory": infer_card_category(card["typeName"]),
                        "cardKey": f"{bank['name']} || {card['typeName']}",
                        "discountPct": discount_fields["discountPct"],
                        "discountLabel": discount_label,
                        "discountKind": discount_fields["discountKind"],
                        "maxHeadlinePct": discount_fields["maxHeadlinePct"],
                        "fixedDiscountPkr": discount_fields["fixedDiscountPkr"],
                        "offerTitle": deal.get("title"),
                        "days": [DAY_ORDER.index(day) for day in days],
                        "daysLabel": extract_schedule_label(deal.get("title"), deal.get("description")),
                        "startDate": str(deal.get("startDate") or "")[:10] or None,
                        "endDate": str(deal.get("endDate") or "")[:10] or None,
                        "capPkr": parse_discount_cap(deal.get("description")),
                        "dailyLimit": extract_transaction_limit(deal.get("description"), "day"),
                        "monthlyLimit": extract_transaction_limit(deal.get("description"), "month"),
                        "orderTypes": extract_order_types(deal.get("description")),
                    }
                )

        if not data.get("nextPage"):
            break
        offset += 50

    return offers


def build_payload(offers: list[dict]) -> dict:
    restaurants_by_city: dict[str, set[str]] = {}
    for offer in offers:
        restaurants_by_city.setdefault(offer["city"], set()).add(offer["restaurant"])
    unique_restaurants = {f"{offer['city']}||{offer['restaurant']}" for offer in offers}

    payload = {
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "dayNames": DAY_ORDER,
        "cities": list(CITIES.keys()),
        "restaurantsByCity": {
            city: sorted(values) for city, values in restaurants_by_city.items()
        },
        "stats": {
            "offers": len(offers),
            "cards": len({offer["cardKey"] for offer in offers}),
            "banks": len({offer["bank"] for offer in offers}),
            "restaurants": len(unique_restaurants),
        },
        "offers": offers,
    }
    return payload


def main() -> None:
    print("Fetching banks...")
    banks = get_banks()
    print(f"Found {len(banks)} banks")

    print("Fetching cards...")
    bank_cards: list[tuple[dict, dict]] = []
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(get_cards, bank) for bank in banks]
        for future in as_completed(futures):
            bank, cards = future.result()
            print(f"  {bank['name']}: {len(cards)} cards")
            for card in cards:
                bank_cards.append((bank, card))

    offers: list[dict] = []
    for city_name, city_meta in CITIES.items():
        print(f"\nFetching offers for {city_name}...")
        with ThreadPoolExecutor(max_workers=8) as executor:
            futures = [
                executor.submit(get_card_offers, city_name, city_meta, bank, card)
                for bank, card in bank_cards
            ]
            for future in as_completed(futures):
                card_offers = future.result()
                if card_offers:
                    offers.extend(card_offers)
                    first = card_offers[0]
                    print(f"  {first['bank']} / {first['card']} ({len(card_offers)} offers)")

    payload = build_payload(offers)
    OUTPUT_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"\nDone: {OUTPUT_PATH}")
    print(payload["stats"])


if __name__ == "__main__":
    main()
