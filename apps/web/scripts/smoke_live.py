"""Post-deploy smoke check against a live URL.

Run after pushing main to confirm the deploy actually shipped:

    python3 apps/web/scripts/smoke_live.py
    python3 apps/web/scripts/smoke_live.py https://preview-abc123.konsacard.pages.dev

What it catches:
  - Pages auto-deploy isn't firing (live offers-index.json older than local).
  - Cloudflare Browser Cache TTL overriding _headers (sw.js / asset
    Cache-Control isn't what we set).
  - sw.js shipped with __BUILD_VERSION__ placeholder unstamped.
  - HTML script tags missing ?v= cache-bust.
  - /api/chat returning a vendor identifier ("DeepSeek", "Gemini",
    "Claude", "_model") that leaked into responses.
  - offers-index.json missing restaurantsFile when the enrichment file
    exists on the CDN (the May 2026 cuisine-UI regression).

Exit code 0 = healthy, 1 = at least one assertion failed.
"""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone

DEFAULT_BASE = "https://konsacard.pk"


def fetch(url: str, *, timeout: int = 10) -> tuple[int, dict, bytes]:
    req = urllib.request.Request(url, headers={"User-Agent": "konsacard-smoke/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.status, dict(resp.headers), resp.read()


def post(url: str, body: dict, *, timeout: int = 20) -> tuple[int, dict, bytes]:
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json", "User-Agent": "konsacard-smoke/1.0"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.status, dict(resp.headers), resp.read()


class Smoke:
    def __init__(self, base: str) -> None:
        self.base = base.rstrip("/")
        self.failures: list[str] = []

    def check(self, label: str, predicate: bool, detail: str = "") -> None:
        if predicate:
            print(f"  PASS  {label}")
        else:
            self.failures.append(f"{label} — {detail}" if detail else label)
            print(f"  FAIL  {label}" + (f"  ({detail})" if detail else ""))

    # ── deploy freshness ───────────────────────────────────────────────
    def check_deploy_freshness(self) -> None:
        print("\n[deploy freshness]")
        _, _, body = fetch(f"{self.base}/data/offers-index.json")
        ix = json.loads(body)
        gen = ix.get("generatedAt", "")
        try:
            ts = datetime.fromisoformat(gen.replace("Z", "+00:00"))
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            age_h = (datetime.now(timezone.utc) - ts).total_seconds() / 3600
        except ValueError:
            self.check("offers-index.json generatedAt is parseable", False, f"got {gen!r}")
            return
        self.check(f"offers-index.json fresh (age {age_h:.1f}h)", age_h < 48, f"age = {age_h:.1f}h, generatedAt = {gen}")

    # ── cuisine UI prerequisites ───────────────────────────────────────
    def check_cuisine_data_chain(self) -> None:
        print("\n[cuisine UI prerequisites]")
        _, _, body = fetch(f"{self.base}/data/offers-index.json")
        ix = json.loads(body)
        has_file = "restaurantsFile" in ix
        self.check("offers-index.json has restaurantsFile", has_file, "cuisine UI will stay hidden without it")
        if not has_file:
            return
        try:
            status, _, body = fetch(f"{self.base}{ix['restaurantsFile'].lstrip('.')}")
            enr = json.loads(body)
            n = len(enr.get("restaurants", {}))
            self.check(f"enrichment file loadable ({n} restaurants)", n > 0, f"only {n} restaurants in enrichment file")
        except (urllib.error.URLError, json.JSONDecodeError) as e:
            self.check("enrichment file loadable", False, str(e))

    # ── cache headers ──────────────────────────────────────────────────
    def check_cache_headers(self) -> None:
        print("\n[cache headers]")
        # sw.js MUST be uncached or the browser keeps the old SW for hours.
        _, h, _ = fetch(f"{self.base}/sw.js")
        cc = (h.get("Cache-Control") or h.get("cache-control") or "").lower()
        self.check("sw.js Cache-Control is max-age=0", "max-age=0" in cc, f"got {cc!r}")

        # Index HTML must revalidate every visit so new versioned URLs ship.
        _, h, _ = fetch(f"{self.base}/")
        cc = (h.get("Cache-Control") or h.get("cache-control") or "").lower()
        self.check("/ Cache-Control is max-age=0", "max-age=0" in cc, f"got {cc!r}")

        # Versioned JS/CSS should have long cache OR at least not be the 4hr
        # Cloudflare default that breaks every cuisine deploy.
        _, h, body = fetch(f"{self.base}/")
        html = body.decode("utf-8", errors="replace")
        import re
        m = re.search(r'/assets/(chat|app|state)\.js\?v=[a-f0-9]+', html)
        if m:
            asset = m.group(0).split("?", 1)[0]
            _, h, _ = fetch(f"{self.base}{asset}?v=test")
            cc = (h.get("Cache-Control") or h.get("cache-control") or "").lower()
            # We expect either immutable+long, or at least not the default 14400.
            ok = "immutable" in cc or "max-age=31536000" in cc
            self.check(f"{asset} has long immutable cache", ok, f"got {cc!r} — check Cloudflare Browser Cache TTL = Respect Existing Headers")

    # ── HTML stamping ──────────────────────────────────────────────────
    def check_html_stamping(self) -> None:
        print("\n[HTML cache-bust]")
        _, _, body = fetch(f"{self.base}/")
        html = body.decode("utf-8", errors="replace")
        self.check("no literal __BUILD_VERSION__ in HTML", "__BUILD_VERSION__" not in html, "unstamped placeholder shipped to prod")
        import re
        hashes = set(re.findall(r"\?v=([a-f0-9]{8,16})", html))
        self.check(f"HTML has ?v= cache-bust ({len(hashes)} distinct)", bool(hashes), "no ?v= in any asset URL")
        self.check("all ?v= hashes are identical", len(hashes) <= 1, f"distinct: {sorted(hashes)}")

    def check_sw_stamping(self) -> None:
        _, _, body = fetch(f"{self.base}/sw.js")
        sw = body.decode("utf-8", errors="replace")
        self.check("sw.js has no __BUILD_VERSION__ literal", "__BUILD_VERSION__" not in sw)
        import re
        m = re.search(r'const SHELL_VERSION = "([^"]+)"', sw)
        self.check("sw.js SHELL_VERSION is stamped", bool(m and m.group(1) and m.group(1) != "dev"), f"value = {m.group(1) if m else None!r}")

    # ── chat API ───────────────────────────────────────────────────────
    def check_chat_api(self) -> None:
        print("\n[/api/chat sanity]")
        try:
            status, _, body = post(
                f"{self.base}/api/chat",
                {"messages": [{"role": "user", "content": "hi"}], "systemPrompt": "You are KonsaCard AI.", "stream": False, "maxTokens": 80},
            )
        except urllib.error.HTTPError as e:
            self.check("/api/chat reachable", False, f"HTTP {e.code}: {e.read()[:200]!r}")
            return
        self.check("/api/chat returns 200", status == 200, f"status = {status}")
        text = body.decode("utf-8", errors="replace")
        # Must be OpenAI shape, not Gemini.
        self.check("response is OpenAI shape (has choices[])", '"choices"' in text and '"candidates"' not in text,
                   "response still has Gemini-style 'candidates' field — old worker code still live?")
        # Must NOT leak vendor names.
        for vendor in ["DeepSeek", "deepseek", "Gemini", "gemini", "Anthropic", "Claude"]:
            self.check(f"no leaked vendor name {vendor!r}", vendor not in text, f"found in response: {text[:200]}")

    def run(self) -> int:
        print(f"Smoke check: {self.base}")
        self.check_deploy_freshness()
        self.check_cuisine_data_chain()
        self.check_cache_headers()
        self.check_html_stamping()
        self.check_sw_stamping()
        self.check_chat_api()
        print(f"\n{'-' * 60}")
        if self.failures:
            print(f"FAILED ({len(self.failures)})")
            for f in self.failures:
                print(f"  - {f}")
            return 1
        print("All checks passed.")
        return 0


def main() -> int:
    base = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_BASE
    return Smoke(base).run()


if __name__ == "__main__":
    sys.exit(main())
