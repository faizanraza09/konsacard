from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from merge_easypaisa_into_offers import merge_easypaisa_into_offers


ROOT = Path(__file__).resolve().parents[2]
PEEKABOO_REFRESH = ROOT / "refresh_data.py"
EASYPAISA_REFRESH = ROOT / "scripts" / "offers" / "extract_easypaisa_discountworld.py"
OFFERS_VALIDATION = ROOT / "scripts" / "offers" / "validate_offers_dataset.py"


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

    print("[offers] Merging Easypaisa into data/offers.json...")
    payload = merge_easypaisa_into_offers()
    run_step("Validating merged offers dataset", [python, str(OFFERS_VALIDATION)])
    print("[offers] Done.")
    print(f"[offers] Offers: {payload['stats']['offers']}")
    print(f"[offers] Cards: {payload['stats']['cards']}")
    print(f"[offers] Banks: {payload['stats']['banks']}")
    print(f"[offers] Restaurants: {payload['stats']['restaurants']}")


if __name__ == "__main__":
    main()
