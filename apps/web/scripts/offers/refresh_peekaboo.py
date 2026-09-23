from __future__ import annotations

import json
import os
import random
import re
import socket
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path
from threading import Lock

import requests
from requests.adapters import HTTPAdapter


BASE_DIR = Path(__file__).resolve().parents[2]
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


# Peekaboo's API is intermittently slow under the volume we hit it with
# (~200 cards x 3 cities, paginated = thousands of POSTs). A single 60s read
# timeout used to raise straight out of a worker and abort the whole scrape,
# throwing away everything already fetched and falling back to stale data.
# Every Peekaboo call now goes through request_with_retries: it retries
# timeouts, connection errors, and 429/5xx with exponential backoff + jitter.
# Completeness is prioritised over speed — a run either fetches everything or
# fails loudly, so the pipeline keeps yesterday's COMPLETE data rather than
# publishing a partial dataset.
DEFAULT_TIMEOUT = (15, 90)  # (connect, read) seconds
MAX_ATTEMPTS = 6
# 520-524 are Cloudflare's own origin-failure codes (peekaboo.guru is behind
# Cloudflare); they are as transient as a 502/504 and worth the same retries.
RETRYABLE_STATUS = {429, 500, 502, 503, 504, 520, 521, 522, 523, 524}


def request_with_retries(method: str, url: str, **kwargs):
    kwargs.setdefault("timeout", DEFAULT_TIMEOUT)
    last_exc: Exception | None = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            res = session.request(method, url, **kwargs)
            if res.status_code in RETRYABLE_STATUS:
                raise requests.exceptions.HTTPError(
                    f"{res.status_code} Server Error for {method} {url}", response=res
                )
            return res
        except requests.exceptions.RequestException as exc:
            last_exc = exc
            if attempt == MAX_ATTEMPTS:
                break
            backoff = min(30.0, 2.0 ** (attempt - 1))
            delay = backoff / 2 + random.uniform(0, backoff / 2)
            endpoint = url.split("?", 1)[0].replace(BASE, "")
            print(
                f"  [peekaboo] {method} {endpoint} failed "
                f"(attempt {attempt}/{MAX_ATTEMPTS}): {exc!r} — retrying in {delay:.1f}s",
                flush=True,
            )
            time.sleep(delay)
    assert last_exc is not None  # loop only exits via return or break-with-exc
    raise last_exc

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


DISCOUNT_KIND_TO_TYPE = {
    "percent_exact": "percentage",
    "percent_upto": "up_to",
    "percent_with_fixed_cap": "percentage",
    "fixed_amount": "fixed",
    "unknown": "percentage",
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
        res = request_with_retries("POST", f"{BASE}/api/v8/entity/deals", json=payload)
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
    res = request_with_retries(
        "POST",
        f"{BASE}/api/v6/sourceEntities",
        json={**COMMON_BODY, "limit": 200, "offset": 0},
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
    res = request_with_retries("GET", url)
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
        res = request_with_retries(
            "POST",
            f"{BASE}/api/v8/entities",
            json={**base_body, "limit": 50, "offset": offset},
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
                    nearest = entity.get("nearestBranch") or {}
                    offers.append(
                        {
                            "city": city_name,
                            "restaurant": entity.get("name"),
                            "entityId": entity.get("id"),
                            "bank": bank["name"],
                            "card": card["typeName"],
                            "cardCategory": infer_card_category(card["typeName"]),
                            "discountPct": discount_fields["discountPct"],
                            "discountLabel": discount_label,
                            "fixedDiscountPkr": discount_fields["fixedDiscountPkr"],
                            "offerTitle": None,
                            "days": list(range(7)),
                            "daysLabel": "All Days",
                            "capPkr": None,
                            "sourceMerchantName": entity.get("name"),
                            "sourceAddress": nearest.get("name") or None,
                            "sourceLat": nearest.get("lat"),
                            "sourceLng": nearest.get("long"),
                            "discountIsUpTo": discount_fields["discountKind"] == "percent_upto",
                            "discountType": DISCOUNT_KIND_TO_TYPE.get(discount_fields["discountKind"], "percentage"),
                            "orderTypes": [],
                            "transactionLimitPerDay": None,
                            "transactionLimitPerMonth": None,
                            "branchCount": (entity.get("stats") or {}).get("branches"),
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
                nearest = entity.get("nearestBranch") or {}
                order_type = deal.get("orderType", "")
                order_types_list = ["Dine-In"] if order_type in ("OUTLET", "DINE_IN") else ([order_type] if order_type else [])
                offers.append(
                    {
                        "city": city_name,
                        "restaurant": entity.get("name"),
                        "entityId": entity.get("id"),
                        "bank": bank["name"],
                        "card": card["typeName"],
                        "cardCategory": infer_card_category(card["typeName"]),
                        "discountPct": float(deal.get("percentageValue")) if deal.get("percentageValue") is not None else discount_fields["discountPct"],
                        "discountLabel": discount_label,
                        "fixedDiscountPkr": discount_fields["fixedDiscountPkr"],
                        "offerTitle": deal.get("title"),
                        "days": [DAY_ORDER.index(day) for day in days],
                        "daysLabel": extract_schedule_label(deal.get("title"), deal.get("description")),
                        "capPkr": parse_discount_cap(deal.get("description")),
                        "sourceMerchantName": entity.get("name"),
                        "sourceAddress": nearest.get("name") or None,
                        "sourceLat": nearest.get("lat"),
                        "sourceLng": nearest.get("long"),
                        "discountIsUpTo": discount_fields["discountKind"] == "percent_upto",
                        "discountType": DISCOUNT_KIND_TO_TYPE.get(discount_fields["discountKind"], "percentage"),
                        "orderTypes": order_types_list,
                        "transactionLimitPerDay": extract_transaction_limit(deal.get("description"), "day"),
                        "transactionLimitPerMonth": extract_transaction_limit(deal.get("description"), "month"),
                        "branchCount": (entity.get("stats") or {}).get("branches"),
                        "branches": list(deal.get("targetBranches", {}).values()),
                    }
                )

        if not data.get("nextPage"):
            break
        offset += 50

    return offers


# ----------------------------------------------------------------------
# Peekaboo enrichment: detail + branches per restaurant.
# Used by the SEO generator to emit accurate Restaurant schema (real
# description, photos, telephone, cuisine, social, aggregateRating, and
# real per-branch street addresses + coords + opening hours).
# ----------------------------------------------------------------------

DAY_NAMES_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
DAY_NAME_TO_SCHEMA = {
    "Monday": "Mo",
    "Tuesday": "Tu",
    "Wednesday": "We",
    "Thursday": "Th",
    "Friday": "Fr",
    "Saturday": "Sa",
    "Sunday": "Su",
}


def _parse_time_12h_to_24h(raw: str | None) -> str | None:
    """Parse '04:30PM' / '4:30 PM' / '16:30' style strings to 'HH:MM'.

    Peekaboo's everyDayTimngs uses formats like '04:30PM-01:00AM' which we
    split on '-' first; here we convert one side.
    """
    if not raw:
        return None
    s = raw.strip().upper().replace(" ", "")
    if not s:
        return None
    try:
        if s.endswith("AM") or s.endswith("PM"):
            ampm = s[-2:]
            body = s[:-2]
            if ":" in body:
                h_str, m_str = body.split(":", 1)
            else:
                h_str, m_str = body, "00"
            h, m = int(h_str), int(m_str)
            if ampm == "AM":
                if h == 12:
                    h = 0
            else:
                if h != 12:
                    h += 12
            return f"{h:02d}:{m:02d}"
        # Already 24h
        if ":" in s:
            h_str, m_str = s.split(":", 1)
            return f"{int(h_str):02d}:{int(m_str):02d}"
    except Exception:
        return None
    return None


def parse_branch_hours(every_day: dict | None) -> list[dict]:
    """Convert Peekaboo's everyDayTimngs dict into schema.org-friendly rows.

    Returns a list of {"day": "Monday", "opens": "16:30", "closes": "01:00"}.
    """
    if not isinstance(every_day, dict):
        return []
    rows: list[dict] = []
    for day in DAY_NAMES_ORDER:
        raw = every_day.get(day)
        if not raw or not isinstance(raw, str) or raw.lower() == "closed":
            continue
        if "-" not in raw:
            continue
        open_raw, close_raw = raw.split("-", 1)
        opens = _parse_time_12h_to_24h(open_raw)
        closes = _parse_time_12h_to_24h(close_raw)
        if not opens or not closes:
            continue
        rows.append({"day": day, "opens": opens, "closes": closes})
    return rows


def _gallery_urls(detail: dict) -> list[str]:
    """Pull cover + gallery photo URLs from entity/detail richContent."""
    urls: list[str] = []
    rc = detail.get("richContent") or {}
    cover = rc.get("cover") or {}
    cover_list = cover.get("content")
    if isinstance(cover_list, list):
        urls.extend(u for u in cover_list if isinstance(u, str) and u.strip())
    gallery = rc.get("gallery") or {}
    gallery_list = gallery.get("content")
    if isinstance(gallery_list, list):
        urls.extend(u for u in gallery_list if isinstance(u, str) and u.strip())
    # De-dupe while preserving order
    seen: set[str] = set()
    deduped: list[str] = []
    for u in urls:
        if u in seen:
            continue
        seen.add(u)
        deduped.append(u)
    return deduped


# Curated allowlist of actual cuisines / cuisine-style food categories.
# Peekaboo's `tags` field mixes real cuisines (e.g. "Pakistani", "BBQ")
# with service styles (e.g. "Buffet", "Dine-in") that aren't cuisines at
# all — we filter against this list so chip rows like "BBQ · Pakistani"
# never end up looking like "Buffet · Dine-in" (true story: that's what
# the raw tags said for Rangoli, which actually serves 8 cuisines all
# named in its description).
#
# Keep entries in the canonical capitalization we want to render. Match is
# case-insensitive and looks at whole-word boundaries to avoid false hits
# (e.g. "Thai" must not match inside "Thailand"). Add to this list when
# new cuisines show up — false negatives (dropping a real cuisine) are
# preferable to false positives (claiming a service style is a cuisine).
KNOWN_CUISINES = [
    # Regional / cultural
    "Pakistani", "Indian", "Chinese", "Japanese", "Thai", "Korean", "Vietnamese",
    "Italian", "French", "Spanish", "Greek", "Mediterranean", "Continental",
    "Lebanese", "Arabic", "Persian", "Turkish", "Afghan", "Mexican", "American",
    "British", "European", "Asian", "Middle Eastern",
    # Food category / style
    "BBQ", "Burgers", "Pizza", "Sushi", "Seafood", "Steakhouse", "Steaks",
    "Sandwiches", "Wraps", "Shawarma", "Falafel", "Tacos", "Noodles", "Ramen",
    "Dumplings", "Pasta", "Fast Food", "Cafe", "Bistro", "Bakery", "Desserts",
    "Ice Cream", "Cakes", "Donuts", "Crepes", "Waffles", "Pancakes", "Bagels",
    "Sweets", "Chocolate", "Beverages", "Tea", "Coffee", "Shakes", "Smoothies",
    "Juices", "Karak", "Snacks", "Bowls", "Salads", "Dry Fruits", "Nuts",
    # Pakistani specifics
    "Biryani", "Karahi", "Nihari", "Mughlai", "Punjabi", "Sindhi", "Pathani",
    "Hyderabadi", "Lahori", "Tikka",
    # Dietary
    "Healthy", "Wellness", "Vegan", "Vegetarian",
]
_CUISINE_LOWER_TO_CANON = {c.lower(): c for c in KNOWN_CUISINES}


def _cuisines_from_detail(detail: dict) -> list[str]:
    """Build the cuisine list by combining Peekaboo's `tags` (filtered to
    actual cuisines via KNOWN_CUISINES) with cuisine words found in the
    free-text `description`. Returns a deduped, canonical-cased list.

    Why this is more complicated than just reading `tags`: Peekaboo's tag
    system is mixed-use — same field carries cuisines AND service styles.
    Without the filter we'd surface garbage like "Buffet" or "Dine-in" as
    cuisines.
    """
    canon_seen: set[str] = set()
    out: list[str] = []

    def _add(label: str) -> None:
        canon = _CUISINE_LOWER_TO_CANON.get(label.strip().lower())
        if canon and canon not in canon_seen:
            canon_seen.add(canon)
            out.append(canon)

    # 1. Filter Peekaboo's tags through the allowlist.
    tags = detail.get("tags") or []
    if isinstance(tags, list):
        for t in tags:
            if isinstance(t, dict) and t.get("tag"):
                _add(str(t["tag"]))

    # 2. Scan the restaurant name + description text for cuisine words.
    #    Restaurant names often carry the cuisine clue (e.g. "YUM Chinese
    #    & Thai", "Shawarma On Fire", "Bombay Bhel") even when the
    #    description text is empty or vague. Whole-word matching avoids
    #    false positives (e.g. "Thai" inside "Thailand").
    haystacks = [detail.get("name") or "", detail.get("description") or ""]
    for raw in haystacks:
        if not isinstance(raw, str) or not raw:
            continue
        lowered = raw.lower()
        for canon in KNOWN_CUISINES:
            needle = canon.lower()
            idx = 0
            while True:
                pos = lowered.find(needle, idx)
                if pos < 0:
                    break
                before = lowered[pos - 1] if pos > 0 else " "
                after_pos = pos + len(needle)
                after = lowered[after_pos] if after_pos < len(lowered) else " "
                if not before.isalpha() and not after.isalpha():
                    _add(canon)
                    break
                idx = pos + 1

    return out[:8]


def _social_urls(detail: dict) -> dict[str, str]:
    social = detail.get("social") or {}
    if not isinstance(social, dict):
        return {}
    cleaned: dict[str, str] = {}
    for k, v in social.items():
        if isinstance(v, str) and v.strip() and v != "null":
            cleaned[k] = v.strip()
    return cleaned


# In-memory caches so concurrent enrichment doesn't refetch.
_detail_cache: dict[int, dict | None] = {}
_detail_cache_lock = Lock()
_branches_cache: dict[tuple[int, str], list[dict]] = {}
_branches_cache_lock = Lock()


def fetch_entity_detail(entity_id: int, city_name: str, city_meta: dict) -> dict | None:
    """Return Peekaboo's /api/v8/entity/detail payload for `entity_id`, or
    None on error. Cached per entity_id (city affects only nearestBranch,
    which we don't rely on)."""
    if entity_id is None:
        return None
    with _detail_cache_lock:
        if entity_id in _detail_cache:
            return _detail_cache[entity_id]
    try:
        res = request_with_retries(
            "POST",
            f"{BASE}/api/v8/entity/detail",
            json={
                "city": city_name,
                "country": "Pakistan",
                "lat": city_meta["lat"],
                "long": city_meta["long"],
                "language": "en",
                "entityId": str(entity_id),
            },
        )
        if res.status_code != 200:
            with _detail_cache_lock:
                _detail_cache[entity_id] = None
            return None
        data = res.json()
        with _detail_cache_lock:
            _detail_cache[entity_id] = data
        return data
    except Exception:
        with _detail_cache_lock:
            _detail_cache[entity_id] = None
        return None


def fetch_entity_branches(entity_id: int, entity_name: str, city_name: str, city_meta: dict) -> list[dict]:
    """Return Peekaboo's /api/v6/entity/branch/_all branches for one
    (entity, city), or [] on error. Cached per (entity_id, city)."""
    if entity_id is None:
        return []
    key = (entity_id, city_name)
    with _branches_cache_lock:
        if key in _branches_cache:
            return _branches_cache[key]
    try:
        res = request_with_retries(
            "POST",
            f"{BASE}/api/v6/entity/branch/_all",
            json={
                "city": city_name,
                "country": "Pakistan",
                "lat": city_meta["lat"],
                "long": city_meta["long"],
                "language": "en",
                "entity": entity_name,
                "entityId": entity_id,
                "entityName": entity_name,
                "limit": 50,
                "offset": 0,
                "sortType": "alphabetical",
                "sortOrder": "asc",
                "openNow": "false",
                "isOpenOnTop": "false",
                "amenityIds": [98],
            },
        )
        if res.status_code != 200:
            with _branches_cache_lock:
                _branches_cache[key] = []
            return []
        data = res.json()
        raw = data.get("branches", []) if isinstance(data, dict) else []
        normalized: list[dict] = []
        for b in raw:
            if not isinstance(b, dict):
                continue
            lat = b.get("latitude")
            lng = b.get("longitude")
            normalized.append({
                "id": b.get("id"),
                "name": b.get("name"),
                "address": (b.get("address") or "").strip() or None,
                "city": b.get("city") or city_name,
                "country": b.get("country") or "Pakistan",
                "lat": lat,
                "lng": lng,
                "telephone": b.get("contactNumber") or None,
                "openingHours": parse_branch_hours(b.get("everyDayTimngs")),
                "isVerified": bool(b.get("isVerified")),
            })
        with _branches_cache_lock:
            _branches_cache[key] = normalized
        return normalized
    except Exception:
        with _branches_cache_lock:
            _branches_cache[key] = []
        return []


def enrich_restaurants(offers: list[dict]) -> dict[str, dict]:
    """Build a {restaurant_name: enriched_dict} map for every restaurant
    referenced in `offers`.

    For each restaurant we fetch entity/detail once, plus
    entity/branch/_all once per (entity, city). Calls run in a thread pool
    and tolerate per-call errors so a few bad entities don't kill the
    pipeline.
    """
    # 1. Build the unique work list.
    name_to_id: dict[str, int] = {}
    name_to_cities: dict[str, set[str]] = {}
    for o in offers:
        eid = o.get("entityId")
        name = o.get("restaurant")
        city = o.get("city")
        if eid is None or not name or not city:
            continue
        name_to_id.setdefault(name, eid)
        name_to_cities.setdefault(name, set()).add(city)

    print(f"\nEnriching {len(name_to_id)} unique restaurants...")

    # 2. Fetch entity details in parallel.
    detail_tasks: dict[str, tuple[int, str, dict]] = {}
    for name, eid in name_to_id.items():
        # Use any city the entity appears in for the detail call (the
        # endpoint is city-bound only for the nearestBranch field, which
        # we discard).
        any_city = next(iter(name_to_cities[name]))
        detail_tasks[name] = (eid, any_city, CITIES[any_city])

    details: dict[str, dict | None] = {}
    completed = 0
    with ThreadPoolExecutor(max_workers=12) as executor:
        future_to_name = {
            executor.submit(fetch_entity_detail, eid, city, meta): name
            for name, (eid, city, meta) in detail_tasks.items()
        }
        for future in as_completed(future_to_name):
            name = future_to_name[future]
            try:
                details[name] = future.result()
            except Exception:
                details[name] = None
            completed += 1
            if completed % 100 == 0 or completed == len(detail_tasks):
                print(f"  detail: {completed}/{len(detail_tasks)}")

    # 3. Fetch branches per (entity, city) in parallel.
    branch_tasks: list[tuple[str, int, str]] = [
        (name, name_to_id[name], city)
        for name, cities in name_to_cities.items()
        for city in sorted(cities)
    ]
    print(f"  fetching branches: {len(branch_tasks)} (entity, city) pairs")
    branches_by_name_city: dict[tuple[str, str], list[dict]] = {}
    completed = 0
    with ThreadPoolExecutor(max_workers=12) as executor:
        future_to_key = {
            executor.submit(fetch_entity_branches, eid, name, city, CITIES[city]): (name, city)
            for (name, eid, city) in branch_tasks
        }
        for future in as_completed(future_to_key):
            key = future_to_key[future]
            try:
                branches_by_name_city[key] = future.result()
            except Exception:
                branches_by_name_city[key] = []
            completed += 1
            if completed % 200 == 0 or completed == len(branch_tasks):
                print(f"  branches: {completed}/{len(branch_tasks)}")

    # 4. Assemble per-restaurant enriched dicts.
    #
    # We intentionally do NOT persist Peekaboo's photo/logo/menu URLs even
    # though the API returns them. Hot-linking those would (a) put load on
    # Peekaboo's CDN and (b) raise display-rights issues we don't have a
    # license for. We keep only text-style enrichment (description, phone,
    # cuisine, social URLs, and our own structured branch data).
    restaurants: dict[str, dict] = {}
    for name, eid in name_to_id.items():
        detail = details.get(name) or {}
        contact_list = detail.get("contactNumber") or []
        telephone = None
        if isinstance(contact_list, list) and contact_list:
            telephone = str(contact_list[0])
        elif isinstance(contact_list, str) and contact_list:
            telephone = contact_list
        social = _social_urls(detail)
        cuisines = _cuisines_from_detail(detail)

        branches_by_city: dict[str, list[dict]] = {}
        for city in sorted(name_to_cities[name]):
            entries = branches_by_name_city.get((name, city)) or []
            if entries:
                branches_by_city[city] = entries

        restaurants[name] = {
            "entityId": eid,
            "description": detail.get("description") or None,
            "telephone": telephone,
            "social": social,
            "servesCuisine": cuisines,
            "branchesByCity": branches_by_city,
        }
    print(f"Enriched {len(restaurants)} restaurants "
          f"({sum(1 for v in restaurants.values() if v['branchesByCity'])} have branch data).")
    return restaurants


def build_payload(offers: list[dict], restaurants_enrichment: dict[str, dict] | None = None) -> dict:
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
            "cards": len({f"{offer['bank']}||{offer['card']}" for offer in offers}),
            "banks": len({offer["bank"] for offer in offers}),
            "restaurants": len(unique_restaurants),
        },
        "offers": offers,
    }
    if restaurants_enrichment:
        payload["restaurants"] = restaurants_enrichment
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
        # Gentler concurrency (was 8) to reduce the request rate that triggers
        # Peekaboo's slow responses; request_with_retries absorbs the rest.
        with ThreadPoolExecutor(max_workers=6) as executor:
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

    # Per-restaurant enrichment (real address, photos, telephone, cuisine,
    # social links, aggregateRating). Failures are tolerated so a flaky
    # Peekaboo run still produces a usable offers.json — the SEO generator
    # treats the enrichment as optional.
    enrichment: dict[str, dict] = {}
    if os.environ.get("PEEKABOO_SKIP_ENRICHMENT") == "1":
        print("\nSkipping restaurant enrichment (PEEKABOO_SKIP_ENRICHMENT=1).")
    else:
        try:
            enrichment = enrich_restaurants(offers)
        except Exception as e:
            print(f"\nEnrichment failed: {e!r} — continuing without it.")
            enrichment = {}

    payload = build_payload(offers, enrichment)
    OUTPUT_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"\nDone: {OUTPUT_PATH}")
    print(payload["stats"])


if __name__ == "__main__":
    main()
