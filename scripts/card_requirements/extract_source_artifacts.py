from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlparse

import fitz
import pdfplumber
import pytesseract
import requests
from bs4 import BeautifulSoup
from PIL import Image
from pypdf import PdfReader


DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/136.0.0.0 Safari/537.36"
)

ROOT = Path(__file__).resolve().parents[2]
WINDOWS_TESSERACT_CANDIDATES = [
    Path(r"C:\Program Files\Tesseract-OCR\tesseract.exe"),
    Path(r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe"),
]


def configure_tesseract_binary() -> str | None:
    configured = getattr(pytesseract.pytesseract, "tesseract_cmd", None)
    if configured and Path(configured).exists():
        return configured

    for candidate in WINDOWS_TESSERACT_CANDIDATES:
        if candidate.exists():
            pytesseract.pytesseract.tesseract_cmd = str(candidate)
            return str(candidate)
    return None


@dataclass
class ExtractionResult:
    kind: str
    source_url: str
    final_url: str
    content_type: str
    output_dir: Path
    files: list[str]
    metadata: dict[str, Any]


def sanitize_filename(value: str) -> str:
    value = re.sub(r"[^A-Za-z0-9._-]+", "-", value).strip("-")
    return value or "source"


def build_session() -> requests.Session:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": DEFAULT_USER_AGENT,
            "Accept": "text/html,application/pdf,*/*",
            "Accept-Language": "en-US,en;q=0.9",
        }
    )
    return session


def ensure_dir(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


def save_text(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8", newline="\n")


def save_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def extract_html_text(html: str) -> dict[str, Any]:
    soup = BeautifulSoup(html, "lxml")
    title = soup.title.get_text(" ", strip=True) if soup.title else ""
    meta_description = ""
    meta = soup.find("meta", attrs={"name": "description"})
    if meta and meta.get("content"):
        meta_description = meta["content"].strip()

    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()

    main_text = soup.get_text("\n", strip=True)
    main_text = re.sub(r"\n{3,}", "\n\n", main_text)

    links = []
    for anchor in soup.find_all("a", href=True):
        href = anchor["href"].strip()
        text = anchor.get_text(" ", strip=True)
        absolute = href
        links.append({"text": text, "href": absolute})

    return {
        "title": title,
        "meta_description": meta_description,
        "text": main_text,
        "links": links,
    }


def collect_interesting_links(page_url: str, links: list[dict[str, str]]) -> list[dict[str, str]]:
    interesting = []
    seen = set()
    keywords = ("pdf", "schedule", "charges", "soc", "summary", "fact", "key fact", "fees", "debit", "credit", "card")
    for link in links:
        href = urljoin(page_url, link["href"])
        combined = f"{link.get('text', '')} {href}".lower()
        if not any(keyword in combined for keyword in keywords):
            continue
        if href in seen:
            continue
        seen.add(href)
        interesting.append({"text": link.get("text", ""), "href": href})
    return interesting


def extract_pdf_with_pypdf(pdf_path: Path) -> str:
    reader = PdfReader(str(pdf_path))
    chunks = []
    for page in reader.pages:
        chunks.append(page.extract_text() or "")
    return "\n\n".join(chunks).strip()


def extract_pdf_with_pdfplumber(pdf_path: Path) -> str:
    chunks = []
    with pdfplumber.open(str(pdf_path)) as pdf:
        for page in pdf.pages:
            chunks.append(page.extract_text() or "")
    return "\n\n".join(chunks).strip()


def extract_pdf_with_fitz(pdf_path: Path) -> str:
    doc = fitz.open(pdf_path)
    try:
        chunks = [page.get_text("text") for page in doc]
        return "\n\n".join(chunks).strip()
    finally:
        doc.close()


def render_pdf_screenshots(pdf_path: Path, screenshots_dir: Path, max_pages: int) -> list[str]:
    ensure_dir(screenshots_dir)
    doc = fitz.open(pdf_path)
    written = []
    try:
        total = min(len(doc), max_pages)
        for index in range(total):
            page = doc.load_page(index)
            pix = page.get_pixmap(matrix=fitz.Matrix(2.0, 2.0), alpha=False)
            out_path = screenshots_dir / f"page-{index + 1:03d}.png"
            pix.save(out_path)
            written.append(str(out_path.relative_to(ROOT)))
    finally:
        doc.close()
    return written


def ocr_images(image_paths: list[Path], output_dir: Path) -> tuple[list[str], dict[str, Any]]:
    ensure_dir(output_dir)
    tesseract_cmd = configure_tesseract_binary()
    if not tesseract_cmd:
        raise RuntimeError("Tesseract OCR binary not found.")
    written_files: list[str] = []
    page_stats = []
    combined_chunks = []

    for image_path in image_paths:
        text = pytesseract.image_to_string(Image.open(image_path), lang="eng")
        combined_chunks.append(text.strip())
        txt_path = output_dir / f"{image_path.stem}.ocr.txt"
        save_text(txt_path, text)
        written_files.append(str(txt_path.relative_to(ROOT)))
        page_stats.append(
            {
                "image": str(image_path.relative_to(ROOT)),
                "ocr_text_length": len(text.strip()),
            }
        )

    combined_text = "\n\n".join(chunk for chunk in combined_chunks if chunk)
    combined_path = output_dir / "combined-ocr.txt"
    save_text(combined_path, combined_text)
    written_files.append(str(combined_path.relative_to(ROOT)))
    return written_files, {
        "tesseract_cmd": tesseract_cmd,
        "pages": page_stats,
        "combined_text_length": len(combined_text.strip()),
    }


def extract_pdf_artifacts(session: requests.Session, url: str, output_dir: Path, max_screenshot_pages: int) -> ExtractionResult:
    response = session.get(url, timeout=60)
    response.raise_for_status()

    pdf_name = sanitize_filename(Path(urlparse(response.url).path).name or "source.pdf")
    if not pdf_name.lower().endswith(".pdf"):
        pdf_name += ".pdf"
    pdf_path = output_dir / pdf_name
    pdf_path.write_bytes(response.content)

    extracted = {
        "pypdf": extract_pdf_with_pypdf(pdf_path),
        "pdfplumber": extract_pdf_with_pdfplumber(pdf_path),
        "pymupdf": extract_pdf_with_fitz(pdf_path),
    }
    scores = {name: len(text.strip()) for name, text in extracted.items()}
    best_method = max(scores, key=scores.get)
    best_text = extracted[best_method]

    files = [str(pdf_path.relative_to(ROOT))]
    text_dir = ensure_dir(output_dir / "extracted-text")
    for method, text in extracted.items():
        method_path = text_dir / f"{method}.txt"
        save_text(method_path, text)
        files.append(str(method_path.relative_to(ROOT)))

    screenshots = render_pdf_screenshots(
        pdf_path,
        output_dir / "screenshots",
        max_pages=max_screenshot_pages if len(best_text.strip()) < 500 else min(2, max_screenshot_pages),
    )
    files.extend(screenshots)

    ocr_files: list[str] = []
    ocr_metadata: dict[str, Any] | None = None
    if screenshots:
        screenshot_paths = [ROOT / relative_path for relative_path in screenshots]
        ocr_files, ocr_metadata = ocr_images(screenshot_paths, output_dir / "ocr")
        files.extend(ocr_files)

    metadata = {
        "best_method": best_method,
        "text_lengths": scores,
        "rendered_screenshot_pages": len(screenshots),
        "needs_visual_review": len(best_text.strip()) < 1000,
        "ocr": ocr_metadata,
    }
    manifest_path = output_dir / "manifest.json"
    save_json(
        manifest_path,
        {
            "kind": "pdf",
            "source_url": url,
            "final_url": response.url,
            "content_type": response.headers.get("Content-Type", ""),
            "files": files,
            "metadata": metadata,
        },
    )
    files.append(str(manifest_path.relative_to(ROOT)))
    return ExtractionResult("pdf", url, response.url, response.headers.get("Content-Type", ""), output_dir, files, metadata)


def extract_html_artifacts(session: requests.Session, url: str, output_dir: Path) -> ExtractionResult:
    response = session.get(url, timeout=60)
    response.raise_for_status()
    html_path = output_dir / "source.html"
    html_path.write_text(response.text, encoding=response.encoding or "utf-8", errors="ignore")

    parsed = extract_html_text(response.text)
    links = collect_interesting_links(response.url, parsed["links"])

    text_path = output_dir / "page-text.txt"
    links_path = output_dir / "interesting-links.json"
    summary_path = output_dir / "page-summary.json"
    save_text(text_path, parsed["text"])
    save_json(links_path, links)
    save_json(
        summary_path,
        {
            "title": parsed["title"],
            "meta_description": parsed["meta_description"],
            "interesting_link_count": len(links),
            "text_length": len(parsed["text"]),
        },
    )

    files = [
        str(html_path.relative_to(ROOT)),
        str(text_path.relative_to(ROOT)),
        str(links_path.relative_to(ROOT)),
        str(summary_path.relative_to(ROOT)),
    ]
    manifest_path = output_dir / "manifest.json"
    metadata = {
        "interesting_link_count": len(links),
        "text_length": len(parsed["text"]),
        "title": parsed["title"],
    }
    save_json(
        manifest_path,
        {
            "kind": "html",
            "source_url": url,
            "final_url": response.url,
            "content_type": response.headers.get("Content-Type", ""),
            "files": files,
            "metadata": metadata,
        },
    )
    files.append(str(manifest_path.relative_to(ROOT)))
    return ExtractionResult("html", url, response.url, response.headers.get("Content-Type", ""), output_dir, files, metadata)


def detect_kind(url: str, content_type: str) -> str:
    lowered_url = url.lower()
    lowered_content_type = content_type.lower()
    if lowered_url.endswith(".pdf") or ".pdf?" in lowered_url:
        return "pdf"
    if "application/pdf" in lowered_content_type:
        return "pdf"
    return "html"


def probe_content_type(session: requests.Session, url: str) -> tuple[str, str]:
    response = session.get(url, timeout=30, stream=True)
    response.raise_for_status()
    content_type = response.headers.get("Content-Type", "")
    final_url = response.url
    response.close()
    return final_url, content_type


def main() -> None:
    parser = argparse.ArgumentParser(description="Download and extract webpage/PDF artifacts for card requirement research.")
    parser.add_argument("--url", required=True, help="Official source URL to inspect.")
    parser.add_argument("--bank-slug", required=True, help="Bank slug used for output folder names.")
    parser.add_argument("--label", default="source", help="Short label for this source, e.g. soc-2026-h1.")
    parser.add_argument(
        "--output-root",
        default=str(ROOT / "data" / "card-requirements" / "artifacts"),
        help="Root directory for downloaded artifacts.",
    )
    parser.add_argument("--max-screenshot-pages", type=int, default=6, help="Max PDF pages to render as screenshots.")
    args = parser.parse_args()

    session = build_session()
    final_url, content_type = probe_content_type(session, args.url)
    kind = detect_kind(final_url, content_type)

    output_dir = ensure_dir(Path(args.output_root) / args.bank_slug / sanitize_filename(args.label))
    if kind == "pdf":
        result = extract_pdf_artifacts(session, args.url, output_dir, max_screenshot_pages=args.max_screenshot_pages)
    else:
        result = extract_html_artifacts(session, args.url, output_dir)

    print(json.dumps(
        {
            "kind": result.kind,
            "source_url": result.source_url,
            "final_url": result.final_url,
            "content_type": result.content_type,
            "output_dir": str(result.output_dir.relative_to(ROOT)),
            "files": result.files,
            "metadata": result.metadata,
        },
        indent=2,
    ))


if __name__ == "__main__":
    main()
