import json
import re
import time
from html import unescape
from pathlib import Path
from urllib.parse import urljoin

import requests


ROOT = Path(__file__).resolve().parents[2]
OUT_PATH = ROOT / "data" / "sources" / "easypaisa" / "discountworld-food.json"
BASE = "https://discovery.discountworld.net"
COFFEE_PAGE_API = "https://easypaisa.com.pk/wp-json/wp/v2/pages/54677"
COFFEE_PAGE_URL = "https://easypaisa.com.pk/coffee-house-partners/"

CITIES = {
    1: "Karachi",
    2: "Lahore",
    3: "Islamabad",
}

CARDS = {
    1: "Easy Paisa DebitCard",
    2: "Easy Paisa Union Pay Debit Card",
    3: "Easy Paisa Pay Pak Debit Card",
}

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}


def normalize_space(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def strip_tags(value: str) -> str:
    return normalize_space(unescape(re.sub(r"<.*?>", " ", value)))


def slugify_name(value: str) -> str:
    cleaned = strip_tags(value).lower()
    cleaned = cleaned.replace("&", " and ")
    cleaned = re.sub(r"[^a-z0-9]+", " ", cleaned)
    return normalize_space(cleaned)


def fetch(session: requests.Session, url: str) -> str:
    response = session.get(url, headers=HEADERS, timeout=60)
    response.raise_for_status()
    time.sleep(0.5)
    return response.text


def parse_cap_pkr(value: str | None) -> int | None:
    if not value:
        return None
    match = re.search(r"cap:\s*rs\.?\s*([0-9,]+)", value, re.I)
    if not match:
        return None
    return int(match.group(1).replace(",", ""))


def parse_list_page(html: str) -> list[dict]:
    cards = []
    pattern = re.compile(
        r'<a href="(?P<href>https://discovery\.discountworld\.net/brand-detail/\d+\?type=card&amp;cityId=\d+)".*?'
        r'<div class="card-name">\s*<p>(?P<name>.*?)</p>.*?'
        r'<div class="discount-inner">\s*<p><span>Up to</span></p>(?P<discount>[^<]+)</div>.*?'
        r'<img\s+class="nec-img"\s+src="https://discovery\.discountworld\.net/assets/imgs/card\.png"/>'
        r'\s*<p class="nec-p">(?P<card_deals>\d+)</p>.*?'
        r'<img\s+class="nec-img"\s+src="https://discovery\.discountworld\.net/assets/imgs/branch\.png"/>'
        r'\s*<p class="nec-p">(?P<branches>\d+)</p>',
        re.S,
    )
    for match in pattern.finditer(html):
        cards.append(
            {
                "detail_url": match.group("href").replace("&amp;", "&"),
                "merchant_name": normalize_space(
                    re.sub(r"<.*?>", "", match.group("name"))
                ),
                "headline_discount_pct": int(
                    normalize_space(match.group("discount")).replace("%", "")
                ),
                "card_deals_count": int(match.group("card_deals")),
                "branches_in_city": int(match.group("branches")),
            }
        )
    return cards


def parse_detail_page(html: str) -> dict:
    merchant_name = None
    headline_discount = None
    summary = None
    phone = None
    cards = []
    outlets = []

    merchant_match = re.search(r"<h1 class=\"\">(.*?)</h1>", html, re.S)
    if merchant_match:
        merchant_name = normalize_space(re.sub(r"<.*?>", "", merchant_match.group(1)))

    summary_match = re.search(r"<h2>(.*?)</h2>", html, re.S)
    if summary_match:
        summary = normalize_space(re.sub(r"<.*?>", "", summary_match.group(1)))

    discount_match = re.search(
        r'<div class="card-disc">\s*<p class=""><span>Up to</span></p>\s*([0-9]+%)',
        html,
        re.S,
    )
    if discount_match:
        headline_discount = discount_match.group(1)

    phone_match = re.search(r'<a href="tel:([^"]+)"', html)
    if phone_match:
        phone = normalize_space(phone_match.group(1))

    for card_name in re.findall(r"<div class=\"bank-btn\">\s*<img[^>]+>\s*<p>(.*?)</p>", html, re.S):
        cards.append(normalize_space(re.sub(r"<.*?>", "", card_name)))

    outlet_pattern = re.compile(
        r'<a href="https://discovery\.discountworld\.net/outlet-detail/\d+\?type=card&amp;cityId=\d+">.*?'
        r'<div class="discount-card2-text">(.*?)</div>.*?'
        r'<p class="branch-sub">(.*?)</p>',
        re.S,
    )
    for match in outlet_pattern.finditer(html):
        outlets.append(
            {
                "outlet_name": normalize_space(re.sub(r"<.*?>", "", match.group(1))),
                "address": normalize_space(re.sub(r"<.*?>", "", match.group(2))),
            }
        )

    return {
        "merchant_name": merchant_name,
        "summary": summary,
        "headline_discount_label": headline_discount,
        "phone": phone,
        "cards": cards,
        "outlets": outlets,
    }


def parse_city_labels(block_html: str) -> list[dict]:
    entries = []
    pattern = re.compile(
        r'<p class="city_label">(.*?)</p>\s*<ul>(.*?)</ul>',
        re.S,
    )
    for match in pattern.finditer(block_html):
        city_label = strip_tags(match.group(1))
        raw_locations = []
        for item in re.findall(r"<li>(.*?)</li>", match.group(2), re.S):
            cleaned = strip_tags(item.replace("Location", ""))
            if cleaned:
                raw_locations.append(cleaned.replace(" -", ""))
        entries.append(
            {
                "city_label": city_label,
                "locations": raw_locations,
            }
        )
    return entries


def expand_coffee_cities(city_label: str, locations: list[str]) -> list[str]:
    lowered = city_label.lower()
    if lowered in {"karachi", "lahore", "islamabad"}:
        return [city_label]
    if lowered == "nationwide":
        return ["Karachi", "Lahore", "Islamabad"]
    resolved = set()
    haystack = " ".join(locations).lower()
    if "karachi" in haystack:
        resolved.add("Karachi")
    if "lahore" in haystack or "lhr" in haystack:
        resolved.add("Lahore")
    if "islamabad" in haystack or "isb" in haystack:
        resolved.add("Islamabad")
    return sorted(resolved)


def parse_coffee_partner_page(html: str) -> list[dict]:
    page = json.loads(html)
    rendered = page["content"]["rendered"]
    records = []
    accordion_pattern = re.compile(
        r'<div class="accordion_item">(.*?)</div>\s*</div>',
        re.S,
    )
    for block in accordion_pattern.findall(rendered):
        name_match = re.search(r"<span>(.*?)</span>", block, re.S)
        discount_match = re.search(r"<strong>([0-9]+)%\s*OFF</strong>", block, re.I)
        terms_match = re.search(r'<div class="terms_label">(.*?)</div>', block, re.S)
        if not name_match or not discount_match:
            continue
        merchant_name = strip_tags(name_match.group(1))
        terms = strip_tags(terms_match.group(1)) if terms_match else None
        city_entries = parse_city_labels(block)
        records.append(
            {
                "merchant_name": merchant_name,
                "merchant_slug": slugify_name(merchant_name),
                "discount_pct": int(discount_match.group(1)),
                "terms": terms,
                "cap_pkr": parse_cap_pkr(terms),
                "city_entries": city_entries,
                "source_url": COFFEE_PAGE_URL,
            }
        )
    return records


def main() -> None:
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    session = requests.Session()
    results = []

    for city_id, city_name in CITIES.items():
        for card_id, card_name in CARDS.items():
            list_url = (
                f"{BASE}/brand-list?cityId={city_id}&catId=1&type=card&keyword="
                f"&sort_by=trending&cardId={card_id}"
            )
            html = fetch(session, list_url)
            merchants = parse_list_page(html)

            for merchant in merchants:
                detail = parse_detail_page(fetch(session, merchant["detail_url"]))
                results.append(
                    {
                        "city_id": city_id,
                        "city": city_name,
                        "card_id": card_id,
                        "card_name": card_name,
                        "merchant_name": detail["merchant_name"] or merchant["merchant_name"],
                        "detail_url": merchant["detail_url"],
                        "headline_discount_pct": merchant["headline_discount_pct"],
                        "headline_discount_label": detail["headline_discount_label"],
                        "cap_pkr": None,
                        "card_deals_count": merchant["card_deals_count"],
                        "branches_in_city": merchant["branches_in_city"],
                        "summary": detail["summary"],
                        "phone": detail["phone"],
                        "cards_listed_on_detail": detail["cards"],
                        "outlets": detail["outlets"],
                        "terms": None,
                        "source_urls": [merchant["detail_url"]],
                    }
                )

    coffee_records = parse_coffee_partner_page(fetch(session, COFFEE_PAGE_API))
    coffee_index = {}
    for record in coffee_records:
        for city_entry in record["city_entries"]:
            for resolved_city in expand_coffee_cities(
                city_entry["city_label"], city_entry["locations"]
            ):
                coffee_index[(record["merchant_slug"], resolved_city)] = {
                    "discount_pct": record["discount_pct"],
                    "cap_pkr": record["cap_pkr"],
                    "terms": record["terms"],
                    "locations": city_entry["locations"],
                    "source_url": record["source_url"],
                }

    deduped = {}
    for row in results:
        key = (row["city_id"], row["card_id"], row["merchant_name"], row["detail_url"])
        coffee_match = coffee_index.get((slugify_name(row["merchant_name"]), row["city"]))
        if coffee_match:
            row["headline_discount_pct"] = coffee_match["discount_pct"]
            row["headline_discount_label"] = f'{coffee_match["discount_pct"]}%'
            row["cap_pkr"] = coffee_match["cap_pkr"]
            row["terms"] = coffee_match["terms"]
            if coffee_match["locations"]:
                row["official_locations"] = coffee_match["locations"]
            row["source_urls"] = [coffee_match["source_url"], row["detail_url"]]
        deduped[key] = row

    existing_keys = {
        (slugify_name(row["merchant_name"]), row["city"], row["card_id"])
        for row in deduped.values()
    }
    for record in coffee_records:
        for city_entry in record["city_entries"]:
            for city_name in expand_coffee_cities(city_entry["city_label"], city_entry["locations"]):
                city_id = next((key for key, value in CITIES.items() if value == city_name), None)
                if city_id is None:
                    continue
                for card_id, card_name in CARDS.items():
                    key = (record["merchant_slug"], city_name, card_id)
                    if key in existing_keys:
                        continue
                    deduped[(city_id, card_id, record["merchant_name"], COFFEE_PAGE_URL)] = {
                        "city_id": city_id,
                        "city": city_name,
                        "card_id": card_id,
                        "card_name": card_name,
                        "merchant_name": record["merchant_name"],
                        "detail_url": COFFEE_PAGE_URL,
                        "headline_discount_pct": record["discount_pct"],
                        "headline_discount_label": f'{record["discount_pct"]}%',
                        "cap_pkr": record["cap_pkr"],
                        "card_deals_count": None,
                        "branches_in_city": None,
                        "summary": None,
                        "phone": None,
                        "cards_listed_on_detail": list(CARDS.values()),
                        "outlets": [],
                        "official_locations": city_entry["locations"],
                        "terms": record["terms"],
                        "source_urls": [record["source_url"]],
                    }
                    existing_keys.add(key)

    payload = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "source": {
            "catalog": "https://discovery.discountworld.net",
            "coffeePartners": COFFEE_PAGE_URL,
        },
        "scope": {
            "cities": CITIES,
            "cards": CARDS,
            "category": "Food",
        },
        "offers": sorted(
            deduped.values(),
            key=lambda item: (item["city"], item["card_id"], item["merchant_name"]),
        ),
    }

    OUT_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
