"""
Google Indexing API bulk submission script.

Reads all URLs from sitemap.xml and submits them via the Google Indexing API.
Tracks progress in a state file so runs can be resumed if interrupted.

Quota: Google allows 200 URL submissions per day per project.
Run once per day until all URLs are submitted.

Usage:
    python scripts/seo/submit_indexing.py
    python scripts/seo/submit_indexing.py --dry-run   # preview only, no submissions
    python scripts/seo/submit_indexing.py --reset      # clear progress and restart
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path

import requests
from google.oauth2 import service_account
from google.auth.transport.requests import Request as GoogleRequest


ROOT         = Path(__file__).resolve().parents[2]
SITEMAP_PATH = ROOT / "sitemap.xml"
KEY_PATH     = ROOT / "konsacard-7ea9f4795a92.json"
STATE_PATH   = ROOT / "scripts" / "seo" / "indexing_state.json"

INDEXING_API = "https://indexing.googleapis.com/v3/urlNotifications:publish"
SCOPES       = ["https://www.googleapis.com/auth/indexing"]
DAILY_QUOTA  = 200
DELAY_S      = 0.5   # seconds between requests to avoid bursting


def load_sitemap_urls() -> list[str]:
    text = SITEMAP_PATH.read_text(encoding="utf-8")
    return re.findall(r"<loc>(.*?)</loc>", text)


def load_state() -> dict:
    if STATE_PATH.exists():
        return json.loads(STATE_PATH.read_text(encoding="utf-8"))
    return {"submitted": [], "failed": []}


def save_state(state: dict) -> None:
    STATE_PATH.write_text(json.dumps(state, indent=2), encoding="utf-8")


def get_credentials():
    creds = service_account.Credentials.from_service_account_file(
        str(KEY_PATH), scopes=SCOPES
    )
    creds.refresh(GoogleRequest())
    return creds


def submit_url(url: str, creds) -> tuple[bool, str]:
    headers = {
        "Authorization": f"Bearer {creds.token}",
        "Content-Type": "application/json",
    }
    body = {"url": url, "type": "URL_UPDATED"}
    resp = requests.post(INDEXING_API, headers=headers, json=body, timeout=15)
    if resp.status_code == 200:
        return True, "ok"
    return False, f"HTTP {resp.status_code}: {resp.text[:120]}"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Preview without submitting")
    parser.add_argument("--reset", action="store_true", help="Clear progress and restart from scratch")
    args = parser.parse_args()

    if args.reset and STATE_PATH.exists():
        STATE_PATH.unlink()
        print("Progress reset.")

    all_urls = load_sitemap_urls()
    state    = load_state()
    done     = set(state["submitted"]) | set(state["failed"])
    pending  = [u for u in all_urls if u not in done]

    print(f"Sitemap total : {len(all_urls)}")
    print(f"Already done  : {len(done)}  ({len(state['submitted'])} ok, {len(state['failed'])} failed)")
    print(f"Pending       : {len(pending)}")

    if not pending:
        print("All URLs already submitted.")
        return

    batch = pending[:DAILY_QUOTA]
    print(f"\nSubmitting {len(batch)} URLs today (quota: {DAILY_QUOTA}/day)")

    if args.dry_run:
        print("\n--- DRY RUN (no actual submissions) ---")
        for url in batch:
            print(f"  {url}")
        return

    creds = get_credentials()

    ok_count   = 0
    fail_count = 0

    for i, url in enumerate(batch, 1):
        # Refresh token every 50 requests (token expires after 1 hour)
        if i % 50 == 0:
            creds.refresh(GoogleRequest())

        success, msg = submit_url(url, creds)
        if success:
            state["submitted"].append(url)
            ok_count += 1
            print(f"[{i:4d}/{len(batch)}] OK       {url}")
        else:
            state["failed"].append(url)
            fail_count += 1
            print(f"[{i:4d}/{len(batch)}] FAILED   {url}  —  {msg}", file=sys.stderr)

        save_state(state)
        time.sleep(DELAY_S)

    remaining = len(pending) - len(batch)
    print(f"\nDone. Submitted: {ok_count}  Failed: {fail_count}  Still pending: {remaining}")
    if remaining > 0:
        print(f"Run again tomorrow to submit the next {min(remaining, DAILY_QUOTA)} URLs.")


if __name__ == "__main__":
    main()
