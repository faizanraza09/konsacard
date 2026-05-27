"""Fill cuisine tags for restaurants that aren't in the Peekaboo
enrichment file. The high-quality baseline (`data/inferred_cuisines.json`)
was bootstrapped via Haiku agents tagging the entire uncovered set;
this script only touches new restaurants that have appeared since.

Rationale: the daily cron picks up new NBP/Easypaisa merchants. Without
ongoing inference they'd silently fall off the cuisine UI. Rather than
calling an LLM on every refresh (slow + new failure mode), we run a
conservative regex pass that catches the obvious cases ('X Pizza Co.',
'Y Coffee', 'Z Steakhouse'). If a name is too ambiguous to pattern-match,
we leave it untagged — better to be missing than wrong.

Invariants:
  - Existing entries in data/inferred_cuisines.json are NEVER modified.
    The Haiku baseline is authoritative for the names it covers; only
    new keys get appended.
  - Pattern outputs use the same taxonomy as the Peekaboo enrichment
    so the frontend lookup is consistent.
  - Run from anywhere; reads/writes apps/web/data/inferred_cuisines.json.

Usage:
    python3 apps/web/scripts/offers/infer_cuisines_from_names.py
"""
from __future__ import annotations

import datetime
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OFFERS_PATH = ROOT / "data" / "offers.json"
ENRICHMENT_PATH = ROOT / "data" / "offers-restaurants.json"
INFERRED_PATH = ROOT / "data" / "inferred_cuisines.json"


# (regex, [cuisines]). Order matters when a name matches multiple — we
# accumulate up to 3 distinct cuisines per restaurant. Patterns are
# matched case-insensitively against the cleaned restaurant name.
PATTERNS: list[tuple[re.Pattern[str], list[str]]] = [
    (re.compile(r"\b(?:pizz?eria|pizza)\b", re.I),                ["Pizza"]),
    (re.compile(r"\bburgers?\b", re.I),                            ["Burgers", "Fast Food"]),
    (re.compile(r"\b(?:steakhouse|steak\s*house)\b", re.I),       ["Steakhouse"]),
    (re.compile(r"\bsteak(?:s)?\b", re.I),                         ["Steaks"]),
    (re.compile(r"\b(?:bbq|barbecue|barbeque)\b", re.I),          ["BBQ"]),
    (re.compile(r"\b(?:tikka|kebabs?|seekh)\b", re.I),            ["BBQ", "Pakistani"]),
    (re.compile(r"\bgrill\b", re.I),                               ["BBQ"]),
    (re.compile(r"\bbiry?ani\b", re.I),                            ["Biryani", "Pakistani"]),
    (re.compile(r"\bkarahi\b", re.I),                              ["Karahi", "Pakistani"]),
    (re.compile(r"\bnihari\b", re.I),                              ["Nihari", "Pakistani"]),
    (re.compile(r"\bhaleem\b", re.I),                              ["Pakistani"]),
    (re.compile(r"\bpaketan?i?\b", re.I),                          ["Pakistani"]),
    (re.compile(r"\bmughlai\b", re.I),                             ["Mughlai", "Pakistani"]),
    (re.compile(r"\b(?:caf[eé]|caff[eé])\b", re.I),               ["Cafe"]),
    (re.compile(r"\b(?:coffee|espresso|barista|roaster|roastery)\b", re.I), ["Coffee"]),
    (re.compile(r"\b(?:chai|chaaye|chaye|tea)\b", re.I),          ["Tea", "Cafe"]),
    (re.compile(r"\b(?:bakery|bakers?|patisserie)\b", re.I),      ["Bakery"]),
    (re.compile(r"\bcakes?\b", re.I),                              ["Cakes", "Bakery"]),
    (re.compile(r"\b(?:sweets?|mithai|halwa)\b", re.I),           ["Sweets"]),
    (re.compile(r"\b(?:juices?|fresh\s*juice)\b", re.I),          ["Juices"]),
    (re.compile(r"\bshakes?\b", re.I),                             ["Shakes"]),
    (re.compile(r"\b(?:donuts?|doughnuts?)\b", re.I),             ["Donuts"]),
    (re.compile(r"\b(?:ice\s*cream|gelato|creamery|fro\s*yo|froyo)\b", re.I), ["Ice Cream"]),
    (re.compile(r"\b(?:waffles?)\b", re.I),                        ["Waffles"]),
    (re.compile(r"\b(?:pancakes?|crepes?)\b", re.I),              ["Pancakes"]),
    (re.compile(r"\b(?:arabic|arab|mandi|yemen|yemeni)\b", re.I), ["Arabic", "Middle Eastern"]),
    (re.compile(r"\b(?:lebanese|shawarma)\b", re.I),              ["Lebanese", "Middle Eastern"]),
    (re.compile(r"\b(?:turkish|doner|kebap|baklava)\b", re.I),    ["Turkish"]),
    (re.compile(r"\b(?:persian|iranian)\b", re.I),                ["Persian"]),
    (re.compile(r"\b(?:afghan|afghani|pulao|pulav)\b", re.I),     ["Afghan"]),
    (re.compile(r"\b(?:chinese|wok|hakka|szechuan|shanghai|cantonese)\b", re.I), ["Chinese"]),
    (re.compile(r"\b(?:thai)\b", re.I),                            ["Thai"]),
    (re.compile(r"\b(?:sushi|ramen|izakaya)\b", re.I),            ["Japanese"]),
    (re.compile(r"\b(?:italian|trattoria|ristorante|pasta)\b", re.I), ["Italian"]),
    (re.compile(r"\b(?:dim\s*sum|dumplings?)\b", re.I),           ["Dumplings"]),
    (re.compile(r"\b(?:seafood|fish|prawns?)\b", re.I),           ["Seafood"]),
    (re.compile(r"\b(?:sandwich(?:es)?|subs?|wraps?)\b", re.I),   ["Sandwiches"]),
    (re.compile(r"\b(?:bistro)\b", re.I),                          ["Bistro"]),
    (re.compile(r"\b(?:continental)\b", re.I),                    ["Continental"]),
    (re.compile(r"\b(?:fast\s*food|fries|fried\s*chicken|broast(?:ed)?)\b", re.I), ["Fast Food"]),
    (re.compile(r"\b(?:peri[\s-]?peri)\b", re.I),                 ["Fast Food"]),
    (re.compile(r"\b(?:salad|salads|healthy|smoothie)\b", re.I),  ["Salads", "Healthy"]),
    (re.compile(r"\b(?:dry\s*fruits?|nuts?)\b", re.I),            ["Dry Fruits", "Nuts"]),
    (re.compile(r"\b(?:chocolate)\b", re.I),                      ["Chocolate", "Desserts"]),
    (re.compile(r"\b(?:hotel|lounge|club)\b", re.I),              ["Continental"]),
]


def tag_from_name(name: str, taxonomy: set[str]) -> list[str]:
    """Apply patterns and return at most 3 distinct cuisines (in
    insertion order). Skips any cuisine not in the taxonomy so we never
    invent vocabulary the rest of the app doesn't know about."""
    cuisines: list[str] = []
    for pattern, candidates in PATTERNS:
        if not pattern.search(name):
            continue
        for c in candidates:
            if c in taxonomy and c not in cuisines:
                cuisines.append(c)
        if len(cuisines) >= 3:
            break
    return cuisines[:3]


def main() -> int:
    offers = json.loads(OFFERS_PATH.read_text(encoding="utf-8"))
    enrichment = json.loads(ENRICHMENT_PATH.read_text(encoding="utf-8")) if ENRICHMENT_PATH.exists() else {"restaurants": {}}
    inferred_doc = (
        json.loads(INFERRED_PATH.read_text(encoding="utf-8"))
        if INFERRED_PATH.exists()
        else {"restaurants": {}, "taxonomy": []}
    )

    peekaboo_names = set(enrichment.get("restaurants", {}).keys())
    inferred_existing = inferred_doc.get("restaurants", {})
    taxonomy = set(
        inferred_doc.get("taxonomy")
        or {c for v in enrichment.get("restaurants", {}).values() for c in (v.get("servesCuisine") or [])}
    )

    all_rest = {o["restaurant"] for o in offers.get("offers", [])}
    # Already-handled = Peekaboo OR existing inferred entry (even if empty list).
    handled = peekaboo_names | set(inferred_existing.keys())
    new_names = sorted(all_rest - handled)

    if not new_names:
        print(f"[infer-cuisines] no new restaurants to tag ({len(all_rest)} total, {len(handled)} already handled)")
        return 0

    tagged = 0
    added: dict[str, list[str]] = {}
    for name in new_names:
        cuisines = tag_from_name(name, taxonomy)
        added[name] = cuisines
        if cuisines:
            tagged += 1

    # Merge: append new entries, NEVER touch existing ones.
    merged = {**inferred_existing, **added}
    out = {
        "generatedAt": datetime.datetime.now().isoformat(timespec="seconds"),
        "source": inferred_doc.get("source", "haiku-name-inference-v1"),
        "taxonomy": sorted(taxonomy),
        "restaurants": merged,
    }
    INFERRED_PATH.write_text(
        json.dumps(out, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(
        f"[infer-cuisines] {len(new_names)} new restaurants seen, {tagged} pattern-tagged, "
        f"{len(new_names) - tagged} left empty. Total entries: {len(merged)}."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
