from __future__ import annotations

import argparse
import functools
import posixpath
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[2]


class CleanUrlHandler(SimpleHTTPRequestHandler):
    """Serve extensionless page routes by mapping them to matching .html files."""

    def __init__(self, *args, directory: str | None = None, **kwargs):
        super().__init__(*args, directory=directory or str(ROOT), **kwargs)

    def translate_path(self, path: str) -> str:
        parsed_path = urlsplit(path).path
        normalized = posixpath.normpath(unquote(parsed_path))
        segments = [segment for segment in normalized.split("/") if segment]

        candidate = Path(self.directory)
        for segment in segments:
            candidate /= segment

        # Preserve normal file handling for actual files, directories, and assets.
        if candidate.exists():
            return str(candidate)

        # Map extensionless routes like /about to about.html.
        if candidate.suffix == "":
            html_candidate = candidate.with_suffix(".html")
            if html_candidate.exists():
                return str(html_candidate)

            # Also allow /foo/ to resolve to foo/index.html if ever needed.
            index_candidate = candidate / "index.html"
            if index_candidate.exists():
                return str(index_candidate)

        return str(candidate)

    def end_headers(self) -> None:
        # Avoid stale browser caching while iterating locally.
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Serve the site locally with clean URL support."
    )
    parser.add_argument("--host", default="0.0.0.0", help="Host interface to bind.")
    parser.add_argument("--port", type=int, default=8000, help="Port to listen on.")
    args = parser.parse_args()

    handler = functools.partial(CleanUrlHandler, directory=str(ROOT))
    with ThreadingHTTPServer((args.host, args.port), handler) as httpd:
        print(f"Serving clean URLs at http://{args.host}:{args.port}")
        print(f"Project root: {ROOT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopping server.")


if __name__ == "__main__":
    main()
