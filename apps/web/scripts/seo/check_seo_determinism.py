"""Run generate_seo_pages.py twice and fail if outputs are not byte-identical.

Used by the daily-refresh cron so non-determinism in the generator cannot pollute
daily commits with spurious churn.
"""
from __future__ import annotations

import hashlib
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
GENERATOR = ROOT / "scripts" / "seo" / "generate_seo_pages.py"
TARGETS = [ROOT / "banks", ROOT / "restaurants", ROOT / "sitemap.xml"]


def fingerprint() -> str:
    h = hashlib.sha256()
    files: list[Path] = []
    for t in TARGETS:
        if t.is_file():
            files.append(t)
        elif t.is_dir():
            files.extend(p for p in t.rglob("*") if p.is_file())
    for f in sorted(files):
        h.update(f.relative_to(ROOT).as_posix().encode())
        h.update(b"\0")
        h.update(f.read_bytes())
        h.update(b"\0")
    return h.hexdigest()


def run_generator() -> None:
    result = subprocess.run([sys.executable, str(GENERATOR)], cwd=ROOT)
    if result.returncode != 0:
        raise SystemExit(f"[seo:determinism] generator failed with exit {result.returncode}")


def main() -> None:
    run_generator()
    first = fingerprint()
    run_generator()
    second = fingerprint()
    if first != second:
        raise SystemExit(
            f"[seo:determinism] FAILED — output diverged between runs.\n"
            f"  first:  {first}\n"
            f"  second: {second}\n"
            f"Non-deterministic SEO generation would pollute daily commits."
        )
    print(f"[seo:determinism] OK (hash {first[:16]})")


if __name__ == "__main__":
    main()
