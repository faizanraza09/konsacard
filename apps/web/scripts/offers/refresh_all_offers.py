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
DEAL_MAP_BUILD = ROOT / "scripts" / "card_requirements" / "build_deal_requirement_card_map.py"
OFFERS_VALIDATION = ROOT / "scripts" / "offers" / "validate_offers_dataset.py"
OFFERS_SPLIT = ROOT / "scripts" / "offers" / "split_offers_by_city.py"
CUISINE_INFER = ROOT / "scripts" / "offers" / "infer_cuisines_from_names.py"
PRECOMPUTE_RANKINGS = ROOT / "scripts" / "precompute_rankings.mjs"
SEO_PAGE_GENERATION = ROOT / "scripts" / "seo" / "generate_seo_pages.py"


def run_step(label: str, command: list[str], *, must_succeed: bool = True) -> bool:
    """Run a pipeline step. Returns True on success, False on failure.

    By default any non-zero exit aborts the whole pipeline. Source extractor
    steps pass must_succeed=False: a single flaky external feed (e.g. easypaisa
    blocking the runner with a 403) shouldn't kill the rest of the refresh.
    The merge steps that follow naturally fall back to the previous JSON in
    data/sources/<source>/ — i.e. yesterday's data for that one source — and
    strict validation at the end still gates the commit if drift is too large.
    """
    print(f"[offers] {label}...")
    completed = subprocess.run(command, cwd=ROOT, check=False)
    if completed.returncode == 0:
        return True
    msg = f"[offers] {label} failed with exit code {completed.returncode}."
    if must_succeed:
        raise SystemExit(msg)
    print(f"{msg} Continuing with previous source data for this feed.")
    return False


def main() -> None:
    python = sys.executable

    failed_sources: list[str] = []
    if not run_step("Refreshing Peekaboo dataset", [python, str(PEEKABOO_REFRESH)], must_succeed=False):
        failed_sources.append("peekaboo")
    if not run_step("Refreshing Easypaisa dataset", [python, str(EASYPAISA_REFRESH)], must_succeed=False):
        failed_sources.append("easypaisa")
    if not run_step("Refreshing NBP merchant dataset", [python, str(NBP_REFRESH)], must_succeed=False):
        failed_sources.append("nbp")

    print("[offers] Merging Easypaisa into data/offers.json...")
    payload = merge_easypaisa_into_offers()
    print("[offers] Merging NBP into data/offers.json...")
    payload = merge_nbp_into_offers()
    run_step("Rebuilding deal->requirement card map", [python, str(DEAL_MAP_BUILD)])
    run_step("Validating merged offers dataset", [python, str(OFFERS_VALIDATION)])
    run_step("Splitting offers.json by city for faster client loads", [python, str(OFFERS_SPLIT)])
    run_step("Inferring cuisine tags for new non-Peekaboo restaurants", [python, str(CUISINE_INFER)])
    # Precompute the per-scope ranking summary AFTER the shards + enrichment are
    # final. This regenerates data/summary.json and re-publishes summaryFile +
    # summaryVersion into offers-index.json, so the default first-paint ranking
    # stays in lockstep with the refreshed offers (a stale summary would show
    # yesterday's rankings on the default view).
    run_step("Precomputing per-scope ranking summary", ["node", str(PRECOMPUTE_RANKINGS)])
    run_step("Generating bank, restaurant, and sitemap SEO pages", [python, str(SEO_PAGE_GENERATION)])
    print("[offers] Done.")
    print(f"[offers] Offers: {payload['stats']['offers']}")
    print(f"[offers] Cards: {payload['stats']['cards']}")
    print(f"[offers] Banks: {payload['stats']['banks']}")
    print(f"[offers] Restaurants: {payload['stats']['restaurants']}")
    if failed_sources:
        print(
            f"[offers] WARN: {len(failed_sources)} source(s) used stale data this run: "
            f"{', '.join(failed_sources)}. Strict validation gates the eventual commit."
        )


if __name__ == "__main__":
    main()
