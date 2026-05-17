from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from merge_easypaisa_into_offers import merge_easypaisa_into_offers
from merge_nbp_into_offers import merge_nbp_into_offers


ROOT = Path(__file__).resolve().parents[2]
PEEKABOO_REFRESH = ROOT / "scripts" / "offers" / "refresh_peekaboo.py"
EASYPAISA_REFRESH = ROOT / "scripts" / "offers" / "extract_easypaisa_discountworld.py"
NBP_REFRESH = ROOT / "scripts" / "offers" / "extract_nbp_merchants.py"
OFFERS_VALIDATION = ROOT / "scripts" / "offers" / "validate_offers_dataset.py"
OFFERS_SPLIT = ROOT / "scripts" / "offers" / "split_offers_by_city.py"
SEO_PAGE_GENERATION = ROOT / "scripts" / "seo" / "generate_seo_pages.py"


def run_step(label: str, command: list[str]) -> None:
    print(f"[offers] {label}...")
    completed = subprocess.run(command, cwd=ROOT, check=False)
    if completed.returncode != 0:
        raise SystemExit(
            f"[offers] {label} failed with exit code {completed.returncode}."
        )


def main() -> None:
    python = sys.executable

    run_step("Refreshing Peekaboo dataset", [python, str(PEEKABOO_REFRESH)])
    run_step("Refreshing Easypaisa dataset", [python, str(EASYPAISA_REFRESH)])
    run_step("Refreshing NBP merchant dataset", [python, str(NBP_REFRESH)])

    print("[offers] Merging Easypaisa into data/offers.json...")
    payload = merge_easypaisa_into_offers()
    print("[offers] Merging NBP into data/offers.json...")
    payload = merge_nbp_into_offers()
    run_step("Validating merged offers dataset", [python, str(OFFERS_VALIDATION)])
    run_step("Splitting offers.json by city for faster client loads", [python, str(OFFERS_SPLIT)])
    run_step("Generating bank, restaurant, and sitemap SEO pages", [python, str(SEO_PAGE_GENERATION)])
    print("[offers] Done.")
    print(f"[offers] Offers: {payload['stats']['offers']}")
    print(f"[offers] Cards: {payload['stats']['cards']}")
    print(f"[offers] Banks: {payload['stats']['banks']}")
    print(f"[offers] Restaurants: {payload['stats']['restaurants']}")


if __name__ == "__main__":
    main()
