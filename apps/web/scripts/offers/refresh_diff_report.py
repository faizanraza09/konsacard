"""Emit a markdown summary of how the working-tree offers.json differs from HEAD.

Used by the daily-refresh cron to upload a human-readable "what changed today"
report as a workflow artifact (and as the body of the failure issue when the
strict validator rejects a run).
"""
from __future__ import annotations

import json
import subprocess
import sys
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
OFFERS_PATH = ROOT / "data" / "offers.json"


def source_of_bank(bank: str) -> str:
    if bank == "Easypaisa":
        return "easypaisa"
    if bank == "National Bank of Pakistan":
        return "nbp"
    return "peekaboo"


def load_head_offers() -> list[dict] | None:
    result = subprocess.run(
        ["git", "show", "HEAD:apps/web/data/offers.json"],
        cwd=ROOT.parent.parent,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        return None
    try:
        return json.loads(result.stdout)["offers"]
    except (json.JSONDecodeError, KeyError):
        return None


def section(title: str, lines: list[str]) -> str:
    return f"### {title}\n\n" + ("\n".join(lines) if lines else "_no change_") + "\n"


def render(prev: list[dict] | None, curr: list[dict]) -> str:
    out: list[str] = ["# Daily refresh diff\n"]

    def counters(offers):
        return (
            Counter(o["bank"] for o in offers),
            Counter(o["city"] for o in offers),
            Counter(source_of_bank(o["bank"]) for o in offers),
            {(o["bank"], o["card"]) for o in offers},
            {f"{o['city']}||{o['restaurant']}" for o in offers},
        )

    curr_banks, curr_cities, curr_sources, curr_pairs, curr_rests = counters(curr)

    if prev is None:
        out.append("_No HEAD offers.json available to diff against — showing current totals only._\n")
        out.append(section("Totals", [
            f"- Offers: {len(curr)}",
            f"- Distinct (bank, card) pairs: {len(curr_pairs)}",
            f"- Restaurants (city-unique): {len(curr_rests)}",
        ]))
        return "\n".join(out)

    prev_banks, prev_cities, prev_sources, prev_pairs, prev_rests = counters(prev)

    out.append(section("Totals", [
        f"- Offers: **{len(prev)} → {len(curr)}** ({len(curr) - len(prev):+d})",
        f"- Distinct (bank, card) pairs: **{len(prev_pairs)} → {len(curr_pairs)}** ({len(curr_pairs) - len(prev_pairs):+d})",
        f"- Restaurants (city-unique): **{len(prev_rests)} → {len(curr_rests)}** ({len(curr_rests) - len(prev_rests):+d})",
    ]))

    src_lines = []
    for src in sorted(set(prev_sources) | set(curr_sources)):
        p, c = prev_sources.get(src, 0), curr_sources.get(src, 0)
        src_lines.append(f"- `{src}`: **{p} → {c}** ({c - p:+d})")
    out.append(section("Per source", src_lines))

    city_lines = []
    for city in sorted(set(prev_cities) | set(curr_cities)):
        p, c = prev_cities.get(city, 0), curr_cities.get(city, 0)
        city_lines.append(f"- `{city}`: **{p} → {c}** ({c - p:+d})")
    out.append(section("Per city", city_lines))

    bank_lines = []
    for bank in sorted(set(prev_banks) | set(curr_banks)):
        p, c = prev_banks.get(bank, 0), curr_banks.get(bank, 0)
        if p == c:
            continue
        bank_lines.append(f"- `{bank}`: **{p} → {c}** ({c - p:+d})")
    out.append(section("Per bank (changed only)", bank_lines))

    new_pairs = sorted(curr_pairs - prev_pairs)
    removed_pairs = sorted(prev_pairs - curr_pairs)
    out.append(section(
        f"New (bank, card) pairs ({len(new_pairs)})",
        [f"- `{b}` || `{c}`" for b, c in new_pairs[:50]] + (["- _…truncated…_"] if len(new_pairs) > 50 else []),
    ))
    out.append(section(
        f"Removed (bank, card) pairs ({len(removed_pairs)})",
        [f"- `{b}` || `{c}`" for b, c in removed_pairs[:50]] + (["- _…truncated…_"] if len(removed_pairs) > 50 else []),
    ))

    new_rests = sorted(curr_rests - prev_rests)
    lost_rests = sorted(prev_rests - curr_rests)
    out.append(section(
        f"New restaurants ({len(new_rests)})",
        [f"- {r.replace('||', ' / ')}" for r in new_rests[:30]] + (["- _…truncated…_"] if len(new_rests) > 30 else []),
    ))
    out.append(section(
        f"Lost restaurants ({len(lost_rests)})",
        [f"- {r.replace('||', ' / ')}" for r in lost_rests[:30]] + (["- _…truncated…_"] if len(lost_rests) > 30 else []),
    ))

    return "\n".join(out)


def main() -> None:
    curr = json.loads(OFFERS_PATH.read_text(encoding="utf-8"))["offers"]
    prev = load_head_offers()
    sys.stdout.write(render(prev, curr))


if __name__ == "__main__":
    main()
