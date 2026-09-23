import json
import random
import re
import time
from html import unescape
from pathlib import Path
from urllib.parse import urljoin

import requests


ROOT = Path(__file__).resolve().parents[2]
OUT_PATH = ROOT / "data" / "sources" / "easypaisa" / "discountworld-food.json"
BASE = "https://discovery.discountworld.net"
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


# A single transient error used to abandon the whole source for the run and
# fall back to stale data. Retry timeouts, connection errors, 429 and 5xx
# (including Cloudflare's 520-524, since discountworld.net is behind
# Cloudflare) with exponential backoff + jitter, as refresh_peekaboo.py does.
MAX_ATTEMPTS = 5
RETRYABLE_STATUS = {429, 500, 502, 503, 504, 520, 521, 522, 523, 524}


def fetch(session: requests.Session, url: str) -> str:
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            response = session.get(url, headers=HEADERS, timeout=60)
            if response.status_code in RETRYABLE_STATUS:
                raise requests.exceptions.HTTPError(
                    f"{response.status_code} Server Error for url: {url}", response=response
                )
            response.raise_for_status()
            time.sleep(0.5)
            return response.text
        except requests.exceptions.RequestException as exc:
            retryable = exc.response is None or exc.response.status_code in RETRYABLE_STATUS
            if not retryable or attempt == MAX_ATTEMPTS:
                raise
            backoff = min(30.0, 2.0 ** (attempt - 1))
            delay = backoff / 2 + random.uniform(0, backoff / 2)
            print(
                f"  [easypaisa] GET {url} failed (attempt {attempt}/{MAX_ATTEMPTS}): "
                f"{exc!r} — retrying in {delay:.1f}s",
                flush=True,
            )
            time.sleep(delay)
    raise AssertionError("unreachable")


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


_ADDR_CELL_RE = r'<td class="addr_(?:cell|col)"[^>]*>([\s\S]*?)</td>'
_CITY_BEFORE_ADDR_RE = r'<td(?:[^>]*)?>\s*([^<]+?)\s*</td>\s*<td class="addr_(?:cell|col)"'
_DISCOUNT_CELL_RE = r'<td(?:[^>]*)?>\s*([0-9]+)%\s*</td>'
_CAP_CELL_RE = r'<td(?:[^>]*)?>\s*Cap:\s*Rs\.?\s*([0-9,]+)\s*</td>'


def parse_coffee_partner_page(html: str) -> list[dict]:
    """Parse the coffee-partners page (https://easypaisa.com.pk/coffee-house-partners/).

    The page is a single <table> where each merchant occupies one or more rows.
    Multi-branch merchants use rowspan on the discount and cap cells so the
    first row carries: brand box + discount + first city + first address + map
    link + cap, and subsequent rows carry just the next city (when changing) +
    next address + map link.

    Single-branch merchants (e.g. Senzo London, Faba Coffee) don't use rowspan
    — every cell is on the one row, classes may be missing. To handle both
    layouts uniformly we identify cells by content rather than by class:
      - Discount = the first <td> whose contents are an integer %.
      - Cap      = the first <td> whose contents start with "Cap:".
      - City     = the <td> immediately preceding the address cell.
      - Address  = <td class="addr_cell"> or <td class="addr_col"> (newer
                   entries use the second class).
    """
    first = html.find('brand_box_dsktp')
    if first < 0:
        return []
    end = html.find('</tr>', html.rfind('brand_box_dsktp'))
    section = html[first:end + 5]

    rows = re.findall(r'<tr[^>]*>([\s\S]*?)</tr>', section)
    merchants: list[dict] = []
    current: dict | None = None
    city_carry: str | None = None

    for row in rows:
        brand_m = re.search(
            r'<div class="brand_box_dsktp"[^>]*>\s*<img[^>]*>\s*<strong>([^<]+)</strong>',
            row,
        )
        if brand_m:
            if current and current["_addrs"]:
                merchants.append(current)
            current = {
                "name": strip_tags(brand_m.group(1)),
                "discount_pct": None,
                "cap_pkr": None,
                "_addrs": [],
            }
            city_carry = None
        if current is None:
            continue

        disc_m = re.search(_DISCOUNT_CELL_RE, row)
        if disc_m and current["discount_pct"] is None:
            current["discount_pct"] = int(disc_m.group(1))

        cap_m = re.search(_CAP_CELL_RE, row)
        if cap_m and current["cap_pkr"] is None:
            current["cap_pkr"] = int(cap_m.group(1).replace(",", ""))

        city_m = re.search(_CITY_BEFORE_ADDR_RE, row)
        if city_m:
            t = city_m.group(1).strip()
            if t and not re.match(r"^[0-9]+%$", t) and "Cap" not in t and not t.startswith("Rs"):
                city_carry = t

        addr_m = re.search(_ADDR_CELL_RE, row)
        if addr_m:
            addr_text = strip_tags(addr_m.group(1))
            if addr_text and city_carry:
                current["_addrs"].append((city_carry, addr_text))

    if current and current["_addrs"]:
        merchants.append(current)

    records: list[dict] = []
    for m in merchants:
        if m["discount_pct"] is None:
            continue
        by_city: dict[str, list[str]] = {}
        for city, addr in m["_addrs"]:
            by_city.setdefault(city, []).append(addr)
        terms = f"Cap: Rs. {m['cap_pkr']:,}" if m["cap_pkr"] else None
        records.append(
            {
                "merchant_name": m["name"],
                "merchant_slug": slugify_name(m["name"]),
                "discount_pct": m["discount_pct"],
                "terms": terms,
                "cap_pkr": m["cap_pkr"],
                "city_entries": [
                    {"city_label": city, "locations": addrs}
                    for city, addrs in by_city.items()
                ],
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

    # Fetch the public coffee-partners HTML page. The wp-json variant
    # (/wp-json/wp/v2/pages/54677) started returning 403 from datacenter IPs
    # like the GitHub Actions runners on 2026-05-28, breaking the whole daily
    # refresh. The public HTML URL has the same merchant table inlined and
    # appears to be served without the same WAF rule. We still wrap the call
    # in try/except so any future block degrades gracefully — discountworld
    # offers above are unaffected and the merge step will fall back to the
    # last committed source JSON for the coffee data.
    try:
        coffee_records = parse_coffee_partner_page(fetch(session, COFFEE_PAGE_URL))
    except requests.HTTPError as exc:
        print(
            f"[easypaisa] WARN: coffee partner page fetch failed ({exc}). "
            f"Proceeding without coffee-partner enrichments."
        )
        coffee_records = []
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
