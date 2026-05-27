"""Regression test: the easypaisa + NBP merges must carry forward the
`restaurants` enrichment from the input payload. Without this, the
split script never references offers-restaurants.json and the cuisine
UI silently disappears (the May 2026 incident).

Run directly:
    python3 apps/web/scripts/offers/test_merges_preserve_enrichment.py

Or via CI step:
    python3 -m pytest apps/web/scripts/offers/test_merges_preserve_enrichment.py
    (pytest treats `test_*` functions as cases)
"""
from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from merge_easypaisa_into_offers import build_payload as easypaisa_build_payload  # noqa: E402
import merge_nbp_into_offers as nbp_module  # noqa: E402


SYNTHETIC_ENRICHMENT = {
    "Pizza Hut": {"servesCuisine": ["Pizza", "Italian"], "telephone": "111-22-44-22"},
    "Bar.B.Q Tonight": {"servesCuisine": ["BBQ", "Pakistani"], "branchesByCity": {"Karachi": []}},
}

SYNTHETIC_OFFER = {
    "city": "Karachi", "restaurant": "Pizza Hut",
    "entityId": 1, "bank": "HBL", "card": "Debit",
    "cardCategory": "debit",
    "discountPct": 20, "discountLabel": "20%",
    "fixedDiscountPkr": None, "offerTitle": "20% off",
    "days": [0, 1, 2, 3, 4, 5, 6], "daysLabel": "Daily",
    "capPkr": 500, "branchCount": 1, "branches": ["Branch A"],
    "sourceAddress": "", "sourceLat": None, "sourceLng": None,
    "discountIsUpTo": False, "discountType": "percentage",
    "orderTypes": ["Dine-In"],
}


def test_easypaisa_build_payload_preserves_restaurants() -> None:
    existing = {
        "generatedAt": "2026-05-27T00:00:00",
        "dayNames": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        "cities": ["Karachi", "Lahore", "Islamabad"],
        "restaurants": SYNTHETIC_ENRICHMENT,
    }
    out = easypaisa_build_payload([SYNTHETIC_OFFER], existing)
    assert "restaurants" in out, "easypaisa build_payload dropped 'restaurants'"
    assert out["restaurants"] == SYNTHETIC_ENRICHMENT, "easypaisa altered 'restaurants' content"


def test_easypaisa_tolerates_payload_without_restaurants() -> None:
    existing = {
        "generatedAt": "2026-05-27T00:00:00",
        "dayNames": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        "cities": ["Karachi"],
    }
    out = easypaisa_build_payload([SYNTHETIC_OFFER], existing)
    assert "restaurants" not in out, "easypaisa added phantom 'restaurants' key"


def test_nbp_merge_preserves_restaurants() -> None:
    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        offers_path = td / "offers.json"
        nbp_path = td / "nbp.json"
        payload = {
            "generatedAt": "2026-05-27T00:00:00",
            "dayNames": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
            "cities": ["Karachi", "Lahore", "Islamabad"],
            "restaurants": SYNTHETIC_ENRICHMENT,
            "stats": {"offers": 1, "cards": 1, "banks": 1, "restaurants": 1},
            "offers": [SYNTHETIC_OFFER],
        }
        offers_path.write_text(json.dumps(payload), encoding="utf-8")
        nbp_path.write_text(json.dumps({"offers": []}), encoding="utf-8")
        result = nbp_module.merge_nbp_into_offers(offers_path=offers_path, nbp_source_path=nbp_path)
        assert "restaurants" in result, "NBP merge dropped 'restaurants' from return value"
        # And verify the file on disk also has it (the worker uses this on next pass).
        written = json.loads(offers_path.read_text(encoding="utf-8"))
        assert "restaurants" in written, "NBP merge wrote offers.json without 'restaurants'"
        assert written["restaurants"] == SYNTHETIC_ENRICHMENT, "NBP altered 'restaurants' content"


def main() -> int:
    tests = [
        test_easypaisa_build_payload_preserves_restaurants,
        test_easypaisa_tolerates_payload_without_restaurants,
        test_nbp_merge_preserves_restaurants,
    ]
    failed = 0
    for t in tests:
        try:
            t()
        except Exception as e:
            print(f"FAIL: {t.__name__}\n  {type(e).__name__}: {e}")
            failed += 1
            continue
        print(f"PASS: {t.__name__}")
    print(f"\n{len(tests) - failed}/{len(tests)} passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
