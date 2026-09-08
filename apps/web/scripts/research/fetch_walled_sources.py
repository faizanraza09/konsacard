"""Fetch bank documents from sites that block plain HTTP clients, using a real browser.

Several Pakistani bank sites sit behind bot protection that returns a JS challenge to
curl/requests (bop.com.pk on Imperva/Incapsula, faysalbank.com HTML on Cloudflare), so a
Schedule of Charges PDF cannot simply be downloaded. A real Chromium profile solves the
challenge and the resulting cookie authorises the download.

This script exists so the auto-heal agent does not depend on having a working browser in
its own sandbox: it runs on a GitHub runner (see .github/workflows/fetch-walled-sources.yml),
which can always install Chromium, and publishes the documents as a build artifact that the
agent downloads with `gh run download`.

It only retrieves documents that the bank publishes publicly, and only from URLs it is
given. It reads nothing else and submits nothing.

Usage:
    python3 fetch_walled_sources.py --out DIR --urls "<page-or-pdf-url>[,...]"
                                    [--link-filter REGEX] [--render-pages 14,15] [--max 8]

For each URL:
  * a direct .pdf link is downloaded through the browser session;
  * any other page is opened, and every same-origin PDF link in its DOM that matches
    --link-filter is downloaded. Hrefs are taken from the DOM rather than constructed,
    because these sites' filenames contain en dashes and literal ellipses that do not
    survive hand-encoding.

Each PDF is saved alongside a .txt of its extracted text, and --render-pages renders those
1-indexed pages to PNG — necessary when a schedule is scanned, or when its text layer emits
the card-name column and the charges column as separate streams (BOP), which silently pairs
cards with the wrong fees.
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
import urllib.parse
from pathlib import Path

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36"
)
SETTLE_MS = 6000


def safe_name(url: str) -> str:
    name = urllib.parse.unquote(url.split("/")[-1]) or "document.pdf"
    if name.lower().endswith(".pdf"):
        name = name[:-4]
    return re.sub(r"[^A-Za-z0-9]+", "_", name).strip("_").lower()[:80] or "document"


def extract_text(pdf: Path) -> None:
    try:
        import pypdf
    except ImportError:
        return
    try:
        reader = pypdf.PdfReader(str(pdf))
    except Exception as exc:  # a scanned or malformed PDF is still useful as bytes
        print(f"      ! text extraction skipped: {exc}")
        return
    pages = []
    for index, page in enumerate(reader.pages, 1):
        try:
            pages.append(f"\n===== page {index} =====\n" + (page.extract_text() or ""))
        except Exception:
            pages.append(f"\n===== page {index} (extraction failed) =====\n")
    out = pdf.with_suffix(".txt")
    out.write_text("".join(pages), encoding="utf-8")
    chars = sum(len(p) for p in pages)
    note = "  (little or no text layer - render the pages instead)" if chars < 200 * len(pages) else ""
    print(f"      text -> {out.name} ({len(reader.pages)} pages, {chars} chars){note}")


def render(pdf: Path, spec: str) -> None:
    pages = sorted({int(p) for p in re.split(r"[,\s]+", spec) if p.strip().isdigit()})
    for page in pages:
        prefix = pdf.with_name(f"{pdf.stem}-p{page}")
        cmd = ["pdftoppm", "-f", str(page), "-l", str(page), "-r", "150", "-png",
               str(pdf), str(prefix)]
        if subprocess.run(cmd, capture_output=True).returncode == 0:
            for produced in sorted(pdf.parent.glob(f"{prefix.name}*.png")):
                print(f"      render -> {produced.name}")
        else:
            print(f"      ! could not render page {page}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--urls", required=True, help="comma/newline separated page or .pdf URLs")
    ap.add_argument("--out", required=True)
    ap.add_argument("--link-filter", default=r".*", help="regex a page's PDF links must match")
    ap.add_argument("--render-pages", default="", help="1-indexed pages to render, e.g. 14,15")
    ap.add_argument("--max", type=int, default=8, help="max PDFs to download per URL")
    args = ap.parse_args()

    urls = [u.strip() for u in re.split(r"[,\n]+", args.urls) if u.strip()]
    if not urls:
        print("no URLs given")
        return 2
    try:
        link_re = re.compile(args.link_filter, re.I)
    except re.error as exc:
        print(f"bad --link-filter: {exc}")
        return 2

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    from playwright.sync_api import sync_playwright

    downloaded = 0
    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            user_data_dir=str(out / ".profile"),
            channel="chromium",
            headless=True,
            user_agent=UA,
            viewport={"width": 1440, "height": 900},
            locale="en-US",
            timezone_id="Asia/Karachi",
            args=["--disable-blink-features=AutomationControlled"],
            accept_downloads=True,
        )
        page = ctx.pages[0] if ctx.pages else ctx.new_page()

        def save(url: str) -> bool:
            try:
                resp = ctx.request.get(url, timeout=120000)
                body = resp.body()
            except Exception as exc:
                print(f"      ! request failed: {exc}")
                return False
            if resp.status != 200 or body[:4] != b"%PDF":
                head = bytes(body[:60]).decode("utf-8", "replace").replace("\n", " ")
                print(f"      ! HTTP {resp.status}, {len(body)}B, not a PDF: {head}")
                return False
            target = out / f"{safe_name(url)}.pdf"
            target.write_bytes(body)
            print(f"      saved {len(body):>9}B -> {target.name}")
            extract_text(target)
            if args.render_pages:
                render(target, args.render_pages)
            return True

        for url in urls:
            print(f"\n== {url}")
            if url.lower().split("?")[0].endswith(".pdf"):
                downloaded += save(url)
                continue
            try:
                resp = page.goto(url, wait_until="load", timeout=90000)
                page.wait_for_timeout(SETTLE_MS)
                print(f"   opened: HTTP {resp.status if resp else '?'} | {page.title()[:70]}")
            except Exception as exc:
                print(f"   ! could not open: {exc}")
                continue
            hrefs = page.eval_on_selector_all(
                "a[href]",
                "els => els.map(e => e.href).filter(h => /\\.pdf(\\?|$)/i.test(h))",
            )
            uniq = [h for h in dict.fromkeys(hrefs) if link_re.search(urllib.parse.unquote(h))]
            print(f"   {len(hrefs)} pdf links, {len(uniq)} match the filter")
            for href in uniq[: args.max]:
                print(f"   -> {urllib.parse.unquote(href.split('/')[-1])[:90]}")
                downloaded += save(href)
        ctx.close()

    profile = out / ".profile"
    if profile.exists():
        subprocess.run(["rm", "-rf", str(profile)], check=False)

    print(f"\ndownloaded {downloaded} PDF(s) into {out}")
    return 0 if downloaded else 1


if __name__ == "__main__":
    sys.exit(main())
