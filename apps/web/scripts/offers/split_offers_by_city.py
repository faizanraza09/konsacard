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

    # Restaurant enrichment (description, photos, social, branches, cuisine)
    # lives in its own file so the index stays tiny. The frontend loads it
    # in parallel with the per-city offer files — total payload is the same,
    # but a fresh boot sees the index + a stable URL it can cache separately.
    restaurants_enrichment = payload.get("restaurants") or {}
    restaurants_url = None
    if restaurants_enrichment:
        with (OUT_DIR / "offers-restaurants.json").open("w", encoding="utf-8") as f:
            json.dump(
                {
                    "generatedAt": payload.get("generatedAt"),
                    "restaurants": restaurants_enrichment,
                },
                f,
                ensure_ascii=False,
                separators=(",", ":"),
            )
        restaurants_url = "./data/offers-restaurants.json"
        print(f"[split] wrote offers-restaurants.json ({len(restaurants_enrichment)} restaurants)")

    # Lightweight index: everything except the offers array AND the
    # restaurants map (which lives in its own file now).
    index = {k: v for k, v in payload.items() if k not in ("offers", "restaurants")}
    index["cityFiles"] = city_files
    if restaurants_url:
        index["restaurantsFile"] = restaurants_url
    elif (OUT_DIR / "offers-restaurants.json").exists():
        # Defense in depth: the merge pipeline upstream may have stripped the
        # `restaurants` key from offers.json (this was a real regression that
        # broke the cuisine UI for 6 days in May 2026 — see the merge scripts'
        # build_payload carry-forward). If an enrichment file exists on disk
        # from a prior run, still reference it from the index so the UI
        # degrades to "slightly stale enrichment" rather than "no cuisine
        # filter at all".
        index["restaurantsFile"] = "./data/offers-restaurants.json"
        print("[split] WARNING: payload lacks 'restaurants' key — referencing stale offers-restaurants.json instead.")
    index["splitFormat"] = "v2"
    with (OUT_DIR / "offers-index.json").open("w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, separators=(",", ":"))
    print(f"[split] wrote offers-index.json (no offers list, no restaurants map)")


if __name__ == "__main__":
    main()
