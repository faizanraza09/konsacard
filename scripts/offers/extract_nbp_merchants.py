from __future__ import annotations

import json
import re
from collections import Counter
from datetime import datetime
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET


ROOT = Path(__file__).resolve().parents[2]
SOURCE_XLSX = ROOT / "data" / "card-requirements" / "raw" / "nbp" / "Active Merchant List - V03.26.xlsx"
OUT_PATH = ROOT / "data" / "sources" / "nbp" / "active-merchants-food.json"

SUPPORTED_CITIES = {"Karachi", "Lahore", "Islamabad"}
NBP_CARDS = [
    "PayPak Classic",
    "PayPak Pink",
    "PayPak Edge co-badge Mastercard",
    "UPI Classic",
    "UPI Gold",
]

NS = {"a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def shared_strings(zf: ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in zf.namelist():
        return []
    root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
    return ["".join(t.text or "" for t in si.iterfind(".//a:t", NS)) for si in root.findall("a:si", NS)]


def cell_value(cell, shared: list[str]) -> str | None:
    cell_type = cell.attrib.get("t")
    value = cell.find("a:v", NS)
    inline = cell.find("a:is", NS)
    if cell_type == "s" and value is not None:
        return shared[int(value.text)]
    if cell_type == "inlineStr" and inline is not None:
        return "".join(text.text or "" for text in inline.iterfind(".//a:t", NS))
    return value.text if value is not None else None


def column(ref: str) -> str:
    return re.match(r"[A-Z]+", ref).group(0)


def normalize_text(value: str | None) -> str:
    return re.sub(r"\s+", " ", (value or "")).strip()


def parse_int(value: str | None) -> int | None:
    if value is None:
        return None
    text = normalize_text(value).replace(",", "")
    if not text or text == "-":
        return None
    match = re.search(r"\d+", text)
    return int(match.group(0)) if match else None


def workbook_sheet_rows(path: Path, sheet_name: str) -> tuple[list[dict[str, str | None]], dict[str, str]]:
    with ZipFile(path) as zf:
        shared = shared_strings(zf)
        workbook = ET.fromstring(zf.read("xl/workbook.xml"))
        rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
        rel_map = {rel.attrib["Id"]: rel.attrib["Target"] for rel in rels}
        wanted = sheet_name.strip()
        sheet = next(sh for sh in workbook.findall("a:sheets/a:sheet", NS) if sh.attrib["name"].strip() == wanted)
        target = rel_map[sheet.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]]
        worksheet = ET.fromstring(zf.read("xl/" + target.lstrip("/")))

        rows: list[dict[str, str | None]] = []
        for row in worksheet.findall(".//a:sheetData/a:row", NS):
            values: dict[str, str | None] = {}
            for cell in row.findall("a:c", NS):
                values[column(cell.attrib["r"])] = cell_value(cell, shared)
            rows.append(values)
        return rows, {"sheet": sheet.attrib["name"], "path": str(path.relative_to(ROOT))}


def extract_discount(offer: str | None, description: str | None) -> tuple[float | None, int | None, int | None, bool, str]:
    text = " ".join(part for part in [offer or "", description or ""] if part)
    percent_match = re.search(r"(\d+(?:\.\d+)?)\s*%", text)
    discount_pct = float(percent_match.group(1)) if percent_match else None

    # Detect "Up to" wording so consumers know this is a maximum, not guaranteed
    discount_is_up_to = bool(re.search(r"\bup\s*to\b", text, re.I)) if discount_pct is not None else False

    fixed_discount_pkr = None
    cap_pkr = None
    discount_source = "percent"  # how discount_pct was determined

    fixed_match = re.search(
        r"Rs\.?\s*([0-9,]+)\s*(?:instead of|instead of rs\.?|instead of rs)\s*Rs\.?\s*([0-9,]+)",
        text,
        re.I,
    )
    if fixed_match:
        promo_price = int(fixed_match.group(1).replace(",", ""))
        regular_price = int(fixed_match.group(2).replace(",", ""))
        if regular_price > promo_price:
            fixed_discount_pkr = regular_price - promo_price
            if discount_pct is None and regular_price > 0:
                discount_pct = round((fixed_discount_pkr / regular_price) * 100, 1)
                discount_source = "fixed"

    if discount_pct is None:
        bogo_match = re.search(r"buy\s*(\d+)[^|]*?get\s*(\d+)", text, re.I)
        if bogo_match:
            buy_count = int(bogo_match.group(1))
            free_count = int(bogo_match.group(2))
            total_items = buy_count + free_count
            if total_items > 0:
                discount_pct = round((free_count / total_items) * 100, 1)
                discount_source = "bogo"

    cap_patterns = [
        r"(?:maximum|max)\s+discount\s+(?:cap|amount|limit)\s*(?:rs\.?\s*)?\s*([0-9,]+)",
        r"discount\s+cap\s*(?:rs\.?\s*)?\s*([0-9,]+)",
        r"(?:max|maximum)\s+(?:discount\s+)?(?:amount|limit)\s*(?:rs\.?\s*)?\s*([0-9,]+)",
        r"cap\s*(?:rs\.?\s*)?\s*([0-9,]+)",
    ]
    for pattern in cap_patterns:
        cap_match = re.search(pattern, text, re.I)
        if cap_match:
            cap_pkr = int(cap_match.group(1).replace(",", ""))
            break

    if discount_pct is not None:
        discount_pct = round(discount_pct, 1)

    # Classify discount type: fixed combo > up_to > bogo > percentage
    if fixed_discount_pkr is not None:
        discount_type = "fixed"
    elif discount_is_up_to:
        discount_type = "up_to"
    elif discount_source == "bogo":
        discount_type = "bogo"
    else:
        discount_type = "percentage"

    return discount_pct, fixed_discount_pkr, cap_pkr, discount_is_up_to, discount_type


def main() -> None:
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    active_rows, active_meta = workbook_sheet_rows(SOURCE_XLSX, "Active Merchants")
    exclude_rows, exclude_meta = workbook_sheet_rows(SOURCE_XLSX, "Exclude Locations ")

    exclude_keys = set()
    for row in exclude_rows[1:]:
        name = normalize_text(row.get("B")).lower()
        city = normalize_text(row.get("H")).lower()
        address = normalize_text(row.get("I")).lower()
        if name and city:
            exclude_keys.add((name, city, address))

    offers = []
    counts = Counter()

    for row in active_rows[1:]:
        merchant_name = normalize_text(row.get("B"))
        category = normalize_text(row.get("C"))
        tier = normalize_text(row.get("D"))
        pos = normalize_text(row.get("E"))
        offer = normalize_text(row.get("F"))
        description = normalize_text(row.get("G"))
        city = normalize_text(row.get("H"))
        address = normalize_text(row.get("I"))
        vertical = normalize_text(row.get("J"))
        remarks = normalize_text(row.get("K"))

        if city not in SUPPORTED_CITIES:
            continue
        if category != "Food":
            continue
        if vertical != "Instore":
            continue
        if pos != "YES":
            continue

        exclude_key = (merchant_name.lower(), city.lower(), address.lower())
        if exclude_key in exclude_keys:
            continue

        if not merchant_name or not offer:
            continue

        discount_pct, fixed_discount_pkr, cap_pkr, discount_is_up_to, discount_type = extract_discount(offer, description)
        if discount_pct is None and fixed_discount_pkr is None:
            continue
        counts[city] += 1

        cards = NBP_CARDS[:]

        offers.append(
            {
                "city": city,
                "merchant_name": merchant_name,
                "address": address or None,
                "category": category,
                "tier": tier,
                "pos": pos,
                "vertical": vertical,
                "offer_title": offer,
                "offer_description": description or None,
                "discount_pct": discount_pct,
                "fixed_discount_pkr": fixed_discount_pkr,
                "cap_pkr": cap_pkr,
                "discount_is_up_to": discount_is_up_to,
                "discount_type": discount_type,
                "remarks": remarks or None,
                "cards": cards,
                "source_workbook": str(SOURCE_XLSX.relative_to(ROOT)),
                "source_sheet": active_meta["sheet"],
                "source_policy": "Food, Instore, POS=YES, supported-city rows only, excluding explicit excluded locations",
            }
        )

    payload = {
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "bank": "National Bank of Pakistan",
        "cards": NBP_CARDS,
        "source": {
            "workbook": str(SOURCE_XLSX.relative_to(ROOT)),
            "activeSheet": active_meta["sheet"],
            "excludeSheet": exclude_meta["sheet"],
            "supportedCities": sorted(SUPPORTED_CITIES),
            "category": "Food",
            "vertical": "Instore",
            "pos": "YES",
        },
        "stats": {
            "rows": len(offers),
            "rowsByCity": dict(counts),
            "excludedLocations": len(exclude_keys),
        },
        "offers": offers,
    }

    OUT_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(OUT_PATH.relative_to(ROOT)), "rows": len(offers)}, indent=2))


if __name__ == "__main__":
    main()
