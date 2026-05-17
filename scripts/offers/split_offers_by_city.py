"""Split data/offers.json into per-city payloads + an index.

Output files in data/:
    offers.json                    — original full payload (untouched)
    offers-index.json              — metadata + restaurantsByCity + stats (lightweight)
    offers-<slug>.json             — per-city subset (only offers in that city)

The frontend can fetch offers-index.json on boot to get the city list and
stats, then lazy-load one or more offers-<slug>.json files as the user picks
cities. This shrinks the first-paint payload roughly 3x on the typical case
(user picks one city) without changing any algorithm.

Run as a build step (called from refresh_all_offers.py).
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "data" / "offers.json"
OUT_DIR = ROOT / "data"


def slugify(name: str) -> str:
    s = name.strip().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"missing source: {SRC}")
    with SRC.open(encoding="utf-8") as f:
        payload = json.load(f)

    cities = payload.get("cities", [])
    offers = payload.get("offers", [])
    print(f"[split] {len(offers)} offers across {len(cities)} cities")

    # Per-city offer lists
    by_city: dict[str, list] = {city: [] for city in cities}
    for offer in offers:
        city = offer.get("city")
        if city in by_city:
            by_city[city].append(offer)

    # Write per-city files
    city_files: dict[str, str] = {}
    for city, city_offers in by_city.items():
        slug = slugify(city)
        out = OUT_DIR / f"offers-{slug}.json"
        with out.open("w", encoding="utf-8") as f:
            json.dump(
                {
                    "generatedAt": payload.get("generatedAt"),
                    "city": city,
                    "offers": city_offers,
                    "count": len(city_offers),
                },
                f,
                ensure_ascii=False,
                separators=(",", ":"),
            )
        city_files[city] = f"./data/offers-{slug}.json"
        print(f"[split]   {city}: {len(city_offers)} offers -> {out.name}")

    # Lightweight index: everything except the offers array
    index = {k: v for k, v in payload.items() if k != "offers"}
    index["cityFiles"] = city_files
    index["splitFormat"] = "v1"
    with (OUT_DIR / "offers-index.json").open("w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, separators=(",", ":"))
    print(f"[split] wrote offers-index.json (no offers list)")


if __name__ == "__main__":
    main()
