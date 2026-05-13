from __future__ import annotations

import json
import os
import shutil
import stat
import unicodedata
from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime
from html import escape
from pathlib import Path
from typing import Iterable
from urllib.parse import urlencode


ROOT = Path(__file__).resolve().parents[2]
OFFERS_PATH = ROOT / "data" / "offers.json"
CARD_REQUIREMENTS_PATH = ROOT / "data" / "card-requirements" / "normalized" / "card_requirements.json"
DEAL_CARD_MAP_PATH = ROOT / "data" / "card-requirements" / "normalized" / "deal_requirement_card_map.json"
BANKS_DIR = ROOT / "banks"
RESTAURANTS_DIR = ROOT / "restaurants"
SITEMAP_PATH = ROOT / "sitemap.xml"
SITE_URL = "https://konsacard.pk"


def build_req_lookup(req_records: list[dict], mapping: list[dict]) -> dict[tuple[str, str], dict]:
    by_card_id = {r["card_id"]: r for r in req_records}
    lookup: dict[tuple[str, str], dict] = {}
    for row in mapping:
        if row.get("matched") and row.get("requirement_card_id"):
            req = by_card_id.get(row["requirement_card_id"])
            if req:
                lookup[(row["deal_bank_name"], row["deal_card_name"])] = req
    return lookup


def find_req(lookup: dict[tuple[str, str], dict], bank: str, card: str) -> dict | None:
    return lookup.get((bank, card))
STATIC_ROUTES = [
    ("/", ROOT / "index.html", "daily", "1.0"),
    ("/about", ROOT / "about.html", "monthly", "0.6"),
    ("/methodology", ROOT / "methodology.html", "monthly", "0.7"),
    ("/how-card-tiers-affect-discounts", ROOT / "how-card-tiers-affect-discounts.html", "weekly", "0.8"),
    ("/how-discount-caps-work", ROOT / "how-discount-caps-work.html", "weekly", "0.8"),
    ("/contact", ROOT / "contact.html", "monthly", "0.5"),
    ("/privacy-policy", ROOT / "privacy-policy.html", "monthly", "0.4"),
]

COMPONENT_CSS = """\
      :root { --brand-deep: #9E4530; }
      .content {
        display: grid;
        gap: 22px;
        width: 100%;
        max-width: 1180px;
        margin: 0 auto;
        padding: 24px 20px 56px;
      }
      .section {
        padding: 28px;
        border-radius: 22px;
        background: var(--surface);
        border: 1px solid rgba(226,232,240,0.9);
        box-shadow: var(--shadow);
      }
      .section h2 {
        margin: 0 0 10px;
        font-size: 1.45rem;
        font-weight: 800;
        letter-spacing: -0.03em;
        color: var(--ink);
      }
      .section > p { color: var(--muted); line-height: 1.75; margin-bottom: 12px; }
      .breadcrumbs {
        display: flex; flex-wrap: wrap; gap: 8px;
        font-size: 0.88rem; color: var(--muted); margin-bottom: 14px; overflow-wrap: anywhere;
      }
      .breadcrumbs .sep { color: #c6b8ad; }
      .card-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 16px; margin-top: 16px;
      }
      .entity-card {
        border: 1px solid rgba(226,232,240,0.9);
        border-radius: 20px; padding: 20px;
        background: linear-gradient(180deg, #fff 0%, #fffaf6 100%);
      }
      .entity-card h3 {
        margin: 0 0 8px; font-size: 1.05rem; font-weight: 700;
        line-height: 1.35; overflow-wrap: anywhere;
      }
      .entity-card h3 a { color: var(--ink); }
      .pill-row { display: flex; flex-wrap: wrap; gap: 7px; margin: 10px 0 14px; }
      .pill {
        display: inline-flex; align-items: center; padding: 4px 10px;
        border-radius: 999px; background: var(--brand-light);
        color: var(--brand-deep); font-size: 0.82rem; font-weight: 700;
      }
      .meta-list { display: grid; gap: 5px; font-size: 0.88rem; color: var(--muted); overflow-wrap: anywhere; }
      .meta-list strong { color: var(--ink); }
      .actions { display: flex; flex-wrap: wrap; gap: 9px; margin-top: 14px; }
      .btn {
        display: inline-flex; align-items: center; justify-content: center;
        padding: 8px 14px; border-radius: 9px; border: 1px solid var(--line);
        background: #fff; font-weight: 700; font-size: 13px; color: var(--ink); white-space: nowrap;
      }
      .btn.primary { border-color: var(--brand); background: var(--brand); color: #fff; }
      .table-tool-link { font-size: 12px; font-weight: 700; color: var(--brand); white-space: nowrap; }
      .table-wrap {
        overflow-x: auto; border: 1px solid rgba(226,232,240,0.9);
        border-radius: 16px; margin-top: 14px;
      }
      table { width: 100%; border-collapse: collapse; min-width: 580px; }
      th, td {
        padding: 12px 14px; border-bottom: 1px solid rgba(226,232,240,0.9);
        text-align: left; vertical-align: top; font-size: 0.9rem;
      }
      th {
        background: var(--brand-light); color: var(--muted);
        font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700;
      }
      tr:last-child td { border-bottom: 0; }
      .directory { columns: 3 210px; gap: 22px; margin-top: 14px; }
      .directory-group { break-inside: avoid; margin-bottom: 18px; }
      .directory-group h3 {
        margin: 0 0 7px; font-size: 0.8rem; color: var(--brand);
        font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase;
      }
      .directory-group ul { list-style: none; padding: 0; margin: 0; }
      .directory-group li { margin: 0 0 7px; overflow-wrap: anywhere; }
      .directory-group li a { color: var(--ink); font-weight: 600; font-size: 0.88rem; }
      .note {
        margin-top: 14px; padding: 12px 16px; border-radius: 14px;
        background: var(--brand-light); color: var(--brand-deep); font-size: 0.88rem; line-height: 1.65;
      }
      .page-footer {
        max-width: 1180px; margin: 0 auto; padding: 6px 20px 48px;
        color: var(--muted); font-size: 0.85rem; text-align: center;
      }
      @media (max-width: 760px) {
        .content { padding: 16px 14px 40px; }
        .section { padding: 18px; border-radius: 18px; }
        .card-grid { grid-template-columns: 1fr; }
        .directory { columns: 1; }
        .table-wrap { overflow: visible; border: 0; border-radius: 0; }
        table, thead, tbody, tr, th, td { display: block; width: 100%; min-width: 0; }
        thead { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
        tbody { display: grid; gap: 10px; }
        tr { border: 1px solid rgba(226,232,240,0.9); border-radius: 14px; background: #fffaf6; overflow: hidden; }
        td { border-bottom: 1px solid rgba(226,232,240,0.7); padding: 9px 12px; font-size: 0.88rem; }
        td:last-child { border-bottom: 0; }
        td::before { content: attr(data-label); display: block; margin-bottom: 3px; color: var(--muted); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; }
        .btn { width: 100%; }
        .actions { flex-direction: column; }
        .pagination { flex-wrap: wrap; gap: 4px; }
        .pg-btn { min-width: 38px; height: 38px; }
      }
      .pagination {
        display: flex; align-items: center; justify-content: center;
        flex-wrap: wrap; gap: 6px; padding: 16px 0 6px;
      }
      .pg-btn {
        min-width: 34px; height: 34px; padding: 0 10px;
        border-radius: 9px; border: 1px solid var(--line);
        background: #fff; font-size: 13px; font-weight: 600;
        color: var(--ink); cursor: pointer; line-height: 1;
        display: inline-flex; align-items: center; justify-content: center;
        transition: background 0.12s, border-color 0.12s;
      }
      .pg-btn:hover:not(:disabled) { background: var(--brand-light); border-color: var(--brand); color: var(--brand-deep); }
      .pg-btn.active { background: var(--brand); color: #fff; border-color: var(--brand); }
      .pg-btn:disabled { opacity: 0.35; cursor: default; }
      .pg-ellipsis { font-size: 13px; color: var(--muted); padding: 0 2px; line-height: 34px; }
      .pg-info { font-size: 12px; color: var(--muted); padding: 0 6px; white-space: nowrap; }
      .req-grid {
        display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
        gap: 10px; margin-top: 14px;
      }
      .req-item {
        padding: 12px 14px; border-radius: 12px;
        background: var(--surface2); border: 1px solid var(--line2);
      }
      .req-label {
        display: block; font-size: 10px; font-weight: 800; text-transform: uppercase;
        letter-spacing: .07em; color: var(--muted); margin-bottom: 4px;
      }
      .req-value { display: block; font-size: 1rem; font-weight: 700; color: var(--ink); }
      .req-waiver {
        margin-top: 12px; padding: 10px 14px; border-radius: 10px;
        background: var(--green-light); color: var(--green);
        font-size: 0.875rem; line-height: 1.55;
      }
      .req-waiver strong { font-weight: 700; }
      .req-confidence {
        margin-top: 10px; font-size: 0.8rem; color: var(--muted);
        display: flex; align-items: center; gap: 6px;
      }
      .conf-badge {
        display: inline-block; padding: 2px 7px; border-radius: 4px;
        font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: .07em;
      }
      .conf-high { background: var(--green-light); color: var(--green); }
      .conf-medium { background: var(--amber-light); color: var(--amber); }
      .conf-low { background: #fce8e6; color: var(--red); }
      .req-notes-details { margin-top: 14px; border-top: 1px solid var(--line2); padding-top: 10px; }
      .req-notes-summary {
        list-style: none; cursor: pointer; user-select: none; padding: 2px 0;
        font-size: 12px; font-weight: 600; color: var(--brand);
        text-decoration: underline; text-underline-offset: 2px;
      }
      .req-notes-summary::-webkit-details-marker { display: none; }
      .req-notes-details:not([open]) .req-hide { display: none; }
      .req-notes-details[open] .req-show { display: none; }
      .req-notes-list {
        list-style: none; padding: 10px 0 0; margin: 0; display: flex;
        flex-direction: column; gap: 7px;
      }
      .req-note-item {
        padding: 9px 12px; border-radius: 8px; font-size: 0.82rem;
        line-height: 1.55; color: var(--ink2);
        background: var(--surface2); border: 1px solid var(--line2);
      }
      .req-na { font-size: 0.875rem; color: var(--muted); font-style: italic; margin-top: 8px; }"""


@dataclass
class RelatedItem:
    name: str
    slug: str
    offers: int
    cards: int
    cities: list[str]
    max_discount_pct: float | None
    max_cap_pkr: int | None


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    chars: list[str] = []
    prev_dash = False
    for char in normalized.lower():
        if char.isalnum():
            chars.append(char)
            prev_dash = False
        elif not prev_dash:
            chars.append("-")
            prev_dash = True
    slug = "".join(chars).strip("-")
    return slug or "item"


def build_unique_slug_map(names: Iterable[str]) -> dict[str, str]:
    slug_map: dict[str, str] = {}
    used: set[str] = set()
    for name in sorted(set(names), key=lambda item: item.casefold()):
        base = slugify(name)
        slug = base
        suffix = 2
        while slug in used:
            slug = f"{base}-{suffix}"
            suffix += 1
        used.add(slug)
        slug_map[name] = slug
    return slug_map


def html_page(*, title: str, description: str, canonical_path: str, schema: list[dict], body: str) -> str:
    canonical_url = f"{SITE_URL}{canonical_path}"
    escaped_title = escape(title)
    escaped_description = escape(description)
    schema_json = json.dumps(schema, ensure_ascii=False, indent=2)
    return f"""<!doctype html>
<html lang="en" class="content-page-root">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{escaped_title}</title>
    <meta name="description" content="{escaped_description}" />
    <link rel="canonical" href="{canonical_url}" />
    <link rel="icon" type="image/svg+xml" href="/assets/logo/favicon.svg" />
    <link rel="icon" type="image/png" sizes="32x32" href="/assets/logo/mark-32.png" />
    <link rel="icon" type="image/png" sizes="64x64" href="/assets/logo/mark-64.png" />
    <link rel="apple-touch-icon" href="/assets/logo/apple-touch-icon.png" />
    <meta name="robots" content="index,follow,max-image-preview:large" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="{canonical_url}" />
    <meta property="og:title" content="{escaped_title}" />
    <meta property="og:description" content="{escaped_description}" />
    <meta property="og:site_name" content="konsacard.pk" />
    <meta property="og:image" content="{SITE_URL}/assets/og-image.png" />
    <meta property="og:image:alt" content="KonsaCard - Restaurant discount comparison for Pakistan" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="{escaped_title}" />
    <meta name="twitter:description" content="{escaped_description}" />
    <meta name="twitter:image" content="{SITE_URL}/assets/og-image.png" />
    <meta name="twitter:image:alt" content="KonsaCard - Restaurant discount comparison for Pakistan" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="/assets/styles.css" />
    <style>
{COMPONENT_CSS}
    </style>
    <script type="application/ld+json">
{schema_json}
    </script>
  </head>
  <body class="content-page">
    <div class="page-shell content-shell">
    {body}
    </div>
    <script defer src="/assets/content-pages.js"></script>
  </body>
</html>
"""


def nav_html(current: str = "") -> str:
    primary = [
        ("/banks/", "Banks"),
        ("/restaurants/", "Restaurants"),
    ]
    learn_pages = [
        ("/about", "About"),
        ("/methodology", "Methodology"),
        ("/how-discount-caps-work", "Discount Caps"),
        ("/how-card-tiers-affect-discounts", "Card Tiers"),
    ]
    all_pages = primary + learn_pages + [
        ("/privacy-policy", "Privacy"),
        ("/contact", "Contact"),
    ]

    def d_link(href: str, text: str) -> str:
        cur = ' aria-current="page"' if href.rstrip("/") == f"/{current}".rstrip("/") else ""
        return f'          <a class="nav-link" href="{href}"{cur}>{text}</a>'

    def u_link(href: str, text: str) -> str:
        cur = ' aria-current="page"' if href.rstrip("/") == f"/{current}".rstrip("/") else ""
        return f'          <a class="utility-link" href="{href}"{cur}>{text}</a>'

    learn_active = any(href.rstrip("/") == f"/{current}".rstrip("/") for href, _ in learn_pages)
    learn_trigger_cur = ' aria-current="page"' if learn_active else ""
    learn_dropdown_items = "\n".join(
        f'                <a class="nav-dropdown-link" href="{href}"{" aria-current=\"page\"" if href.rstrip("/") == f"/{current}".rstrip("/") else ""}>{text}</a>'
        for href, text in learn_pages
    )
    contact_link = d_link("/contact", "Contact")
    desk_primary = "\n".join(d_link(h, t) for h, t in primary)
    util = "\n".join(u_link(h, t) for h, t in all_pages)

    return f"""
      <nav class="nav" role="banner">
        <a class="nav-wordmark" href="/" aria-label="KonsaCard home">konsa<span>card</span><em>.pk</em></a>
        <div class="city-tab-group" aria-label="Available cities">
          <span class="city-tab active">All</span>
          <span class="city-tab">Karachi</span>
          <span class="city-tab">Lahore</span>
          <span class="city-tab">Islamabad</span>
        </div>
        <div style="flex:1"></div>
        <div class="nav-links-desk">
{desk_primary}
          <div class="nav-dropdown">
            <span class="nav-link nav-dropdown-trigger"{learn_trigger_cur}>Learn</span>
            <div class="nav-dropdown-menu">
              <div class="nav-dropdown-menu-inner">
{learn_dropdown_items}
              </div>
            </div>
          </div>
{contact_link}
        </div>
        <a class="btn-find-my-card" href="/" title="Find your best card">
          <span>🎯</span> Find My Card
        </a>
        <button class="hamburger-btn" id="nav-toggle" type="button" aria-label="Open navigation menu" aria-expanded="false">
          <span></span><span></span><span></span>
        </button>
        <nav class="utility-nav" id="main-nav" aria-label="Site links">
          <a class="utility-link" href="/">Home</a>
{util}
        </nav>
      </nav>"""


def breadcrumbs_html(items: list[tuple[str, str | None]]) -> str:
    chunks: list[str] = ['<div class="breadcrumbs">']
    for index, (label, href) in enumerate(items):
        if index:
            chunks.append('<span class="sep">/</span>')
        if href:
            chunks.append(f'<a href="{escape(href)}">{escape(label)}</a>')
        else:
            chunks.append(f"<span>{escape(label)}</span>")
    chunks.append("</div>")
    return "".join(chunks)


def stats_html(items: list[tuple[str, str]]) -> str:
    return '<div class="stats">' + "".join(
        f'<div class="stat"><div class="stat-label">{escape(label)}</div><div class="stat-value">{escape(value)}</div></div>'
        for label, value in items
    ) + "</div>"


def format_pct(value: float | None) -> str:
    if value is None:
        return "N/A"
    return f"{value:.0f}%"


def format_pkr(value: int | None) -> str:
    if value is None:
        return "N/A"
    return f"PKR {value:,}"


def build_tool_url(*, bank: str | None = None, restaurant: str | None = None, city: str | None = None) -> str:
    params: dict[str, str] = {}
    if bank:
        params["banks"] = bank
    if restaurant:
        params["rests"] = restaurant
    if city:
        params["city"] = city.lower()
    query = urlencode(params)
    return f"/?{query}" if query else "/"


def dedupe_sorted(values: Iterable[str]) -> list[str]:
    return sorted(set(values), key=lambda item: item.casefold())


def make_breadcrumb_schema(path_parts: list[tuple[str, str]]) -> dict:
    return {
        "@type": "BreadcrumbList",
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": index + 1,
                "name": label,
                "item": f"{SITE_URL}{path}",
            }
            for index, (label, path) in enumerate(path_parts)
        ],
    }


def entity_page_schema(
    title: str,
    description: str,
    canonical_path: str,
    item_name: str,
    related: list[RelatedItem],
    related_base_path: str,
) -> list[dict]:
    item_list = [
        {
            "@type": "ListItem",
            "position": index + 1,
            "name": item.name,
            "url": f"{SITE_URL}{related_base_path}{item.slug}/",
        }
        for index, item in enumerate(related[:10])
    ]
    return [
        {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "WebPage",
                    "name": title,
                    "url": f"{SITE_URL}{canonical_path}",
                    "description": description,
                    "about": item_name,
                },
                make_breadcrumb_schema([
                    ("Home", "/"),
                    ("Banks" if canonical_path.startswith("/banks/") else "Restaurants", "/banks/" if canonical_path.startswith("/banks/") else "/restaurants/"),
                    (item_name, canonical_path),
                ]),
                {
                    "@type": "ItemList",
                    "name": f"Related pages for {item_name}",
                    "itemListElement": item_list,
                },
            ],
        }
    ]


def restaurant_page_schema(
    title: str,
    description: str,
    canonical_path: str,
    restaurant_name: str,
    related_banks: list[RelatedItem],
    related_base_path: str,
    cities: list[str],
) -> list[dict]:
    """Schema for restaurant pages with LocalBusiness information."""
    item_list = [
        {
            "@type": "ListItem",
            "position": index + 1,
            "name": item.name,
            "url": f"{SITE_URL}{related_base_path}{item.slug}/",
        }
        for index, item in enumerate(related_banks[:10])
    ]
    
    # LocalBusiness schema for restaurant
    local_business = {
        "@type": "LocalBusiness",
        "name": restaurant_name,
        "url": f"{SITE_URL}{canonical_path}",
        "description": description,
    }
    
    # Add addresses for known cities
    if cities:
        local_business["areaServed"] = cities
    
    return [
        {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "WebPage",
                    "name": title,
                    "url": f"{SITE_URL}{canonical_path}",
                    "description": description,
                    "about": restaurant_name,
                },
                make_breadcrumb_schema([
                    ("Home", "/"),
                    ("Restaurants", "/restaurants/"),
                    (restaurant_name, canonical_path),
                ]),
                local_business,
                {
                    "@type": "ItemList",
                    "name": f"Banks with offers at {restaurant_name}",
                    "itemListElement": item_list,
                },
            ],
        }
    ]


def directory_page_schema(title: str, description: str, canonical_path: str, items: list[tuple[str, str]]) -> list[dict]:
    return [
        {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "CollectionPage",
                    "name": title,
                    "url": f"{SITE_URL}{canonical_path}",
                    "description": description,
                },
                make_breadcrumb_schema([
                    ("Home", "/"),
                    ("Banks" if canonical_path.startswith("/banks") else "Restaurants", canonical_path),
                ]),
                {
                    "@type": "ItemList",
                    "name": title,
                    "numberOfItems": len(items),
                    "itemListElement": [
                        {
                            "@type": "ListItem",
                            "position": index + 1,
                            "name": name,
                            "url": f"{SITE_URL}{path}",
                        }
                        for index, (name, path) in enumerate(items[:100])
                    ],
                },
            ],
        }
    ]


def write_file(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def clear_directory(path: Path) -> None:
    def handle_remove_readonly(func, target, exc_info) -> None:
        os.chmod(target, stat.S_IWRITE)
        func(target)

    if path.exists():
        shutil.rmtree(path, onerror=handle_remove_readonly)
    path.mkdir(parents=True, exist_ok=True)


def render_bank_index(bank_summaries: list[dict]) -> str:
    title = "Bank Restaurant Discount Pages in Pakistan | KonsaCard"
    description = (
        f"Browse restaurant discount coverage across {len(bank_summaries)} Pakistani banks. "
        "See which banks have the widest restaurant coverage, the most cards, and the best headline discounts."
    )
    cards = []
    for bank in bank_summaries:
        city_list = ", ".join(bank["cities"])
        cards.append(
            f"""
            <article class="entity-card">
              <h3><a href="/banks/{bank['slug']}/">{escape(bank['name'])}</a></h3>
              <div class="pill-row">
                <span class="pill">{bank['restaurant_count']} restaurants</span>
                <span class="pill">{bank['card_count']} cards</span>
                <span class="pill">Best {format_pct(bank['max_discount_pct'])}</span>
              </div>
              <div class="meta-list">
                <div><strong>Cities:</strong> {escape(city_list)}</div>
                <div><strong>Total offers:</strong> {bank['offers_count']}</div>
                <div><strong>Highest cap seen:</strong> {escape(format_pkr(bank['max_cap_pkr']))}</div>
              </div>
              <div class="actions">
                <a class="btn primary" href="/banks/{bank['slug']}/">View bank page</a>
                <a class="btn" href="{escape(build_tool_url(bank=bank['name']))}">Compare in tool</a>
              </div>
            </article>
            """
        )
    body = f"""
      {nav_html('banks')}

      <header class="content-hero">
        <p class="eyebrow">Banks</p>
        <h1>Browse bank discount pages</h1>
        <p>Pick a bank to see which restaurants, cards, and cities are currently covered across Pakistan.</p>
      </header>

      <div class="content">
        <section class="section">
          <h2>All bank pages</h2>
          <p>Use these pages to inspect restaurant coverage for a single bank before you jump into a deeper card-vs-card comparison.</p>
          <div class="card-grid">
            {''.join(cards)}
          </div>
        </section>
      </div>
      <div class="page-footer">Independent restaurant discount coverage directory for Pakistan. Offers can change, so always confirm with the bank before relying on any deal.</div>
    """
    schema = directory_page_schema(
        title,
        description,
        "/banks/",
        [(item["name"], f"/banks/{item['slug']}/") for item in bank_summaries],
    )
    return html_page(title=title, description=description, canonical_path="/banks/", schema=schema, body=body)


def render_restaurant_index(restaurant_summaries: list[dict], bank_count: int) -> str:
    title = "Restaurant Discount Pages by Bank in Pakistan | KonsaCard"
    description = (
        f"Browse {len(restaurant_summaries)} restaurant discount pages across Karachi, Lahore, and Islamabad. "
        "See which banks and cards currently show dining deals for each restaurant."
    )
    by_letter: dict[str, list[dict]] = defaultdict(list)
    for item in restaurant_summaries:
        initial = item["name"][0].upper() if item["name"] else "#"
        if not initial.isalpha():
            initial = "#"
        by_letter[initial].append(item)

    groups: list[str] = []
    for letter in sorted(by_letter):
        links = "".join(
            f'<li><a href="/restaurants/{item["slug"]}/">{escape(item["name"])}</a> <span>· {item["bank_count"]} banks · {len(item["cities"])} cities</span></li>'
            for item in by_letter[letter]
        )
        groups.append(f'<div class="directory-group"><h3>{escape(letter)}</h3><ul>{links}</ul></div>')

    body = f"""
      {nav_html('restaurants')}

      <header class="content-hero">
        <p class="eyebrow">Restaurants</p>
        <h1>Browse restaurant discount pages</h1>
        <p>Pick a restaurant to see which banks currently show dining deals for it across Karachi, Lahore, and Islamabad.</p>
      </header>

      <div class="content">
        <section class="section">
          <h2>Restaurant directory</h2>
          <p>This directory is grouped alphabetically. Every restaurant page links to the banks found in the dataset for that restaurant and back into the comparison tool with that venue preselected.</p>
          <div class="directory">
            {''.join(groups)}
          </div>
        </section>
      </div>
      <div class="page-footer">Independent restaurant discount coverage directory for Pakistan. Offers can change, so always confirm with the bank or restaurant before relying on any deal.</div>
    """
    schema = directory_page_schema(
        title,
        description,
        "/restaurants/",
        [(item["name"], f"/restaurants/{item['slug']}/") for item in restaurant_summaries],
    )
    return html_page(title=title, description=description, canonical_path="/restaurants/", schema=schema, body=body)


def render_bank_page(summary: dict, restaurant_slug_map: dict[str, str]) -> str:
    title = f"{summary['name']} restaurant discounts in Pakistan | KonsaCard"
    description = (
        f"See restaurant discount coverage for {summary['name']} across {summary['restaurant_count']} restaurants "
        f"and {summary['card_count']} cards in {', '.join(summary['cities'])}."
    )
    top_restaurants: list[RelatedItem] = summary["top_restaurants"]
    table_rows = "".join(
        f"""
        <tr>
          <td data-label="Card"><a href="/banks/{summary['slug']}/{card['slug']}/" style="color:var(--ink);font-weight:600">{escape(card['name'])}</a></td>
          <td data-label="Type">{escape(card['card_type'])}</td>
          <td data-label="Restaurants">{card['restaurant_count']}</td>
          <td data-label="Best discount">{escape(format_pct(card['max_discount_pct']))}</td>
          <td data-label="Highest cap">{escape(format_pkr(card['max_cap_pkr']))}</td>
          <td data-label="Action"><a href="{escape(build_tool_url(bank=summary['name']))}" class="table-tool-link">Compare →</a></td>
        </tr>
        """
        for card in summary["cards"]
    )
    best_cards = summary.get("best_cards_at_restaurants", {})
    restaurant_cards = "".join(
        f"""
        <article class="entity-card">
          <h3><a href="/restaurants/{restaurant_slug_map[item.name]}/">{escape(item.name)}</a></h3>
          <div class="pill-row">
            <span class="pill">Best {format_pct(item.max_discount_pct)}</span>
            {f'<span class="pill">Cap {escape(format_pkr(item.max_cap_pkr))}</span>' if item.max_cap_pkr else ''}
          </div>
          <div class="meta-list">
            {f'<div><strong>Best card:</strong> {escape(best_cards[item.name]["card"])}</div>' if item.name in best_cards else ''}
            {f'<div><strong>Days:</strong> {escape(best_cards[item.name]["days_label"])}</div>' if item.name in best_cards and best_cards[item.name].get("days_label") else ''}
            <div><strong>Cities:</strong> {escape(", ".join(item.cities))}</div>
          </div>
          <div class="actions">
            <a class="btn primary" href="{escape(build_tool_url(bank=summary['name'], restaurant=item.name))}">Compare in tool</a>
            <a class="btn" href="/restaurants/{restaurant_slug_map[item.name]}/">Restaurant page</a>
          </div>
        </article>
        """
        for item in top_restaurants[:8]
    )
    
    # Internal linking: Show all cards
    all_cards_list = "".join(
        f'<li><a href="/banks/{summary["slug"]}/{card["slug"]}/">{escape(card["name"])}</a> ({card["card_type"]}) – {card["restaurant_count"]} restaurants, up to {format_pct(card["max_discount_pct"])} off</li>'
        for card in summary["cards"]
    )
    
    body = f"""
      {nav_html('banks')}

      <header class="content-hero">
        <p class="eyebrow">Bank Guide</p>
        <h1>{escape(summary['name'])} restaurant discounts</h1>
        <p>{escape(summary['name'])} covers {summary['restaurant_count']} restaurants across {summary['card_count']} cards. Browse cards and top restaurant links below, or open the tool for a personalised comparison.</p>
      </header>

      <div class="content">
        <section class="section">
          <h2>Cards listed for {escape(summary['name'])}</h2>
          <p>Each card below shows how many restaurants it covers and its headline discount. Use Compare to open the tool with this bank pre-selected.</p>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Card</th>
                  <th>Type</th>
                  <th>Restaurants</th>
                  <th>Best discount</th>
                  <th>Highest cap</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {table_rows}
              </tbody>
            </table>
          </div>
        </section>

        <section class="section">
          <h2>Top restaurants for {escape(summary['name'])}</h2>
          <p>The best card deal from {escape(summary['name'])} at each restaurant. Use Compare to open the tool with that specific bank and restaurant pre-selected.</p>
          <div class="card-grid">
            {restaurant_cards}
          </div>
        </section>
        
        <section class="section">
          <h2>All {escape(summary['name'])} cards</h2>
          <p>Complete list of {escape(summary['name'])} cards available on KonsaCard:</p>
          <ul style="list-style: disc; margin-left: 20px; color: var(--ink); line-height: 1.8; columns: 2; gap: 40px;">
            {all_cards_list}
          </ul>
        </section>
      </div>
      <div class="page-footer">Independent restaurant discount comparison for Pakistan. Offers can change, so always confirm current terms directly with the bank or restaurant.</div>
    """
    schema = entity_page_schema(
        title,
        description,
        f"/banks/{summary['slug']}/",
        summary["name"],
        top_restaurants,
        "/restaurants/",
    )
    return html_page(
        title=title,
        description=description,
        canonical_path=f"/banks/{summary['slug']}/",
        schema=schema,
        body=body,
    )


def render_order_type_badges(order_types: list[str]) -> str:
    badge_styles = {
        "Dine-In": "background:#e8f5e9;color:#2e7d32",
        "Takeaway": "background:#e3f2fd;color:#1565c0",
        "Delivery": "background:#fff3e0;color:#e65100",
    }
    if not order_types:
        return '<span class="pill" style="background:#f5f5f5;color:#999">—</span>'
    badges = "".join(
        f'<span class="pill" style="{badge_styles.get(ot, "background:#f5f5f5;color:#666")}">{escape(ot)}</span>'
        for ot in order_types
    )
    return badges


def render_restaurant_page(summary: dict, bank_slug_map: dict[str, str]) -> str:
    title = f"{summary['name']} bank discounts in Pakistan | KonsaCard"
    description = (
        f"See which banks and cards show restaurant discount coverage for {summary['name']} "
        f"across {', '.join(summary['cities'])}. Compare {summary['bank_count']} banks and {summary['card_count']} cards."
    )
    card_rows = "".join(
        f"""
        <tr>
          <td data-label="Bank"><a href="/banks/{bank_slug_map.get(offer['bank'], '#')}/">{escape(offer['bank'])}</a></td>
          <td data-label="Card"><a href="/banks/{offer['bank_slug']}/{offer['card_slug']}/" style="color:var(--ink);font-weight:600">{escape(offer['card'])}</a></td>
          <td data-label="Type">{escape(offer['card_type'])}</td>
          <td data-label="Offer Details">{escape(offer['offer_title'] or offer['discount_label'] or '')}{"<div class=\"offer-detail-toggle\" onclick=\"var d=this.nextElementSibling;d.style.display=d.style.display===\'none\'?'block':'none';this.textContent=d.style.display===\'none\'?'Details \u25be':'Details \u25b4'\" style=\"cursor:pointer;font-size:0.72rem;color:var(--brand);font-weight:600;margin-top:2px\">Details \u25be</div><div class=\"offer-detail-text\" style=\"display:none;font-size:0.78rem;color:var(--muted);margin-top:3px;line-height:1.4\">" + escape(offer["offer_description"]) + "</div>" if offer.get('offer_description') else ""}</td>
          <td data-label="Discount">{escape(offer['discount_label'] or format_pct(offer['max_discount_pct']))}</td>
          <td data-label="Cap">{escape(format_pkr(offer['max_cap_pkr']))}</td>
          <td data-label="Days">{escape(offer['days_label'] or 'All Days')}</td>
          <td data-label="Order">{render_order_type_badges(offer['order_types'])}</td>
          <td data-label="Action"><a href="{escape(build_tool_url(bank=offer['bank'], restaurant=summary['name']))}" class="table-tool-link">Compare →</a></td>
        </tr>
        """
        for offer in summary["card_offers"]
    )
    bank_cards = "".join(
        f"""
        <article class="entity-card">
          <h3><a href="/banks/{bank_slug_map[item.name]}/">{escape(item.name)}</a></h3>
          <div class="pill-row">
            <span class="pill">{item.cards} cards</span>
            <span class="pill">Best {format_pct(item.max_discount_pct)}</span>
          </div>
          <div class="meta-list">
            <div><strong>Cities:</strong> {escape(", ".join(item.cities))}</div>
            <div><strong>Highest cap:</strong> {escape(format_pkr(item.max_cap_pkr))}</div>
          </div>
          <div class="actions">
            <a class="btn primary" href="/banks/{bank_slug_map[item.name]}/">View bank page</a>
            <a class="btn" href="{escape(build_tool_url(bank=item.name, restaurant=summary['name']))}">Compare in tool</a>
          </div>
        </article>
        """
        for item in summary["top_banks"][:8]
    )
    
    # Internal linking: Show all banks with offers
    all_banks_list = "".join(
        f'<li><a href="/banks/{bank_slug_map.get(bank["name"], "#")}/">{escape(bank["name"])}</a> – {bank["card_count"]} cards, up to {format_pct(bank["max_discount_pct"])} off</li>'
        for bank in summary["banks"]
    )
    
    body = f"""
      {nav_html('restaurants')}

      <header class="content-hero">
        <p class="eyebrow">Restaurant Guide</p>
        <h1>{escape(summary['name'])} bank discount coverage</h1>
        <p>{escape(summary['name'])} has offers from {summary['bank_count']} banks across {summary['card_count']} cards. See every card deal available here, or open the tool for a personalised ranking.</p>
      </header>

      <div class="content">
        <section class="section">
          <h2>Cards available at {escape(summary['name'])}</h2>
          <p>Every deal that shows a discount for this restaurant, sorted by headline discount. Use the Compare link to open the tool with that bank and restaurant pre-selected.</p>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Bank</th>
                  <th>Card</th>
                  <th>Type</th>
                  <th>Offer Details</th>
                  <th>Discount</th>
                  <th>Cap</th>
                  <th>Days</th>
                  <th>Order</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {card_rows}
              </tbody>
            </table>
          </div>
        </section>

        <section class="section">
          <h2>Banks that cover {escape(summary['name'])}</h2>
          <p>Jump to a bank page to see all restaurants and cards for that bank, or use Compare to open the tool with this restaurant pre-selected.</p>
          <div class="card-grid">
            {bank_cards}
          </div>
        </section>
        
        <section class="section">
          <h2>All banks with {escape(summary['name'])} offers</h2>
          <p>Complete list of banks offering discounts at {escape(summary['name'])}:</p>
          <ul style="list-style: disc; margin-left: 20px; color: var(--ink); line-height: 1.8;">
            {all_banks_list}
          </ul>
        </section>
      </div>
      <div class="page-footer">Independent restaurant discount comparison for Pakistan. Offers can change, so always confirm current terms directly with the bank or restaurant.</div>
    """
    schema = restaurant_page_schema(
        title,
        description,
        f"/restaurants/{summary['slug']}/",
        summary["name"],
        summary["top_banks"],
        "/banks/",
        summary.get("cities", []),
    )
    return html_page(
        title=title,
        description=description,
        canonical_path=f"/restaurants/{summary['slug']}/",
        schema=schema,
        body=body,
    )


def format_pkr_amount(value: int | float | None) -> str:
    if not value:
        return ""
    return f"PKR {int(value):,}"


def render_eligibility_section(card: dict | None) -> str:
    if not card:
        return ""
    reqs = card.get("requirements") or {}
    notes = [n for n in (card.get("notes") or []) if n]
    gaps  = [g for g in (card.get("bank_gaps") or []) if g]
    benefits = (card.get("benefits") or "").strip()
    confidence = card.get("confidence", "")

    items: list[tuple[str, str]] = []
    if reqs.get("annual_fee_pkr") is not None:
        fee_val = reqs["annual_fee_pkr"]
        items.append(("Annual fee", format_pkr_amount(fee_val) if fee_val else "Free"))
    if reqs.get("joining_fee_pkr"):
        items.append(("Joining fee", format_pkr_amount(reqs["joining_fee_pkr"])))
    if reqs.get("supplementary_annual_fee_pkr"):
        items.append(("Supplementary card fee", format_pkr_amount(reqs["supplementary_annual_fee_pkr"])))
    if reqs.get("minimum_monthly_salary_pkr") is not None:
        salary = reqs["minimum_monthly_salary_pkr"]
        items.append(("Min. monthly salary", "No minimum salary" if salary == 0 else format_pkr_amount(salary)))
    balance = None
    for field in (
        "minimum_account_balance_pkr",
        "minimum_average_balance_pkr",
        "minimum_relationship_balance_pkr",
        "minimum_deposit_pkr",
    ):
        if reqs.get(field) is not None:
            balance = reqs[field]
            break
    if balance is not None:
        items.append(("Min. balance / deposit", "No minimum balance" if balance == 0 else format_pkr_amount(balance)))
    if reqs.get("minimum_age_years"):
        age_str = f"{reqs['minimum_age_years']}+"
        if reqs.get("maximum_age_years"):
            age_str = f"{reqs['minimum_age_years']}–{reqs['maximum_age_years']}"
        items.append(("Age", age_str))
    if reqs.get("existing_account_required"):
        items.append(("Existing account", "Required"))
    if benefits:
        items.append(("Benefits", benefits))

    if not items and not notes and not gaps:
        return ""

    grid_html = ""
    if items:
        cells = "".join(
            f'<div class="req-item"><span class="req-label">{escape(label)}</span><span class="req-value">{escape(value)}</span></div>'
            for label, value in items
        )
        grid_html = f'<div class="req-grid">{cells}</div>'

    waiver_html = ""
    if reqs.get("annual_fee_waiver_rule"):
        waiver_html = f'<div class="req-waiver"><strong>Fee waiver:</strong> {escape(reqs["annual_fee_waiver_rule"])}</div>'

    all_notes = notes + gaps
    notes_html = ""
    if all_notes:
        items_html = "".join(f'<li class="req-note-item">{escape(n)}</li>' for n in all_notes)
        notes_html = f"""
        <details class="req-notes-details">
          <summary class="req-notes-summary">
            <span class="req-show">Show notes</span><span class="req-hide">Hide notes</span>
          </summary>
          <ul class="req-notes-list">{items_html}</ul>
        </details>"""

    return f"""
        <section class="section">
          <h2>Eligibility &amp; fees</h2>
          <p>Key requirements and fees for this card. Always verify current terms directly with the bank.</p>
          {grid_html}
          {waiver_html}
          {notes_html}
        </section>"""


def render_card_page(bank_summary: dict, card: dict) -> str:
    canonical_path = f"/banks/{bank_summary['slug']}/{card['slug']}/"
    title = f"{card['name']} – {bank_summary['name']} restaurant discounts | KonsaCard"
    description = (
        f"See every restaurant where {bank_summary['name']} {card['name']} ({card['card_type']}) "
        f"gives a dining discount in Pakistan. {card['restaurant_count']} restaurants, "
        f"best discount {format_pct(card['max_discount_pct'])}."
    )
    restaurant_rows = "".join(
        f"""
        <tr>
          <td data-label="Restaurant"><a href="/restaurants/{r['slug']}/" style="color:var(--ink);font-weight:600">{escape(r['name'])}</a></td>
          <td data-label="Offer Details">{escape(r['offer_title'] or r['discount_label'] or '')}{"<div class=\"offer-detail-toggle\" onclick=\"var d=this.nextElementSibling;d.style.display=d.style.display===\'none\'?'block':'none';this.textContent=d.style.display===\'none\'?'Details \u25be':'Details \u25b4'\" style=\"cursor:pointer;font-size:0.72rem;color:var(--brand);font-weight:600;margin-top:2px\">Details \u25be</div><div class=\"offer-detail-text\" style=\"display:none;font-size:0.78rem;color:var(--muted);margin-top:3px;line-height:1.4\">" + escape(r["offer_description"]) + "</div>" if r.get('offer_description') else ""}</td>
          <td data-label="Discount">{escape(format_pct(r['max_discount_pct']))}</td>
          <td data-label="Cap">{escape(format_pkr(r['max_cap_pkr']))}</td>
          <td data-label="Days">{escape(r['days_label'] or 'All Days')}</td>
          <td data-label="Order">{render_order_type_badges(r['order_types'])}</td>
          <td data-label="Cities">{escape(', '.join(r['cities']))}</td>
          <td data-label="Action"><a href="{escape(build_tool_url(bank=bank_summary['name'], restaurant=r['name']))}" class="table-tool-link">Compare →</a></td>
        </tr>
        """
        for r in card["restaurants"]
    )
    
    # Internal linking: Show other cards from the same bank
    other_cards = [c for c in bank_summary['cards'] if c['slug'] != card['slug']][:5]
    related_cards_html = ""
    if other_cards:
        card_links = "".join(
            f'<li><a href="/banks/{bank_summary["slug"]}/{c["slug"]}/">{escape(c["name"])} ({c["card_type"]})</a> – {c["restaurant_count"]} restaurants</li>'
            for c in other_cards
        )
        related_cards_html = f"""
        <section class="section">
          <h2>Other {escape(bank_summary['name'])} cards</h2>
          <p>Compare this card with other offerings from {escape(bank_summary['name'])}:</p>
          <ul style="list-style: disc; margin-left: 20px; color: var(--ink); line-height: 1.7;">
            {card_links}
          </ul>
        </section>"""
    
    body = f"""
      {nav_html('banks')}

      <header class="content-hero">
        <p class="eyebrow">Card Guide</p>
        <h1>{escape(card['name'])}</h1>
        <p>{escape(bank_summary['name'])} &middot; {escape(card['card_type'])} &middot; {card['restaurant_count']} restaurants &middot; up to {escape(format_pct(card['max_discount_pct']))} off</p>
      </header>

      <div class="content">
        {breadcrumbs_html([("Home", "/"), ("Banks", "/banks/"), (bank_summary["name"], f"/banks/{bank_summary['slug']}/"), (card["name"], None)])}

        <section class="section">
          <h2>Restaurants covered by {escape(card['name'])}</h2>
          <p>Every restaurant in our dataset where {escape(bank_summary['name'])} lists a discount for this card, sorted by headline discount. Click Compare to open the tool with this bank and restaurant pre-selected.</p>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Restaurant</th>
                  <th>Offer Details</th>
                  <th>Discount</th>
                  <th>Cap</th>
                  <th>Days</th>
                  <th>Order</th>
                  <th>Cities</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {restaurant_rows}
              </tbody>
            </table>
          </div>
        </section>

        {render_eligibility_section(card)}

        <section class="section">
          <h2>Card overview</h2>
          <div class="meta-list">
            <div><strong>Bank:</strong> <a href="/banks/{bank_summary['slug']}/">{escape(bank_summary['name'])}</a></div>
            <div><strong>Card type:</strong> {escape(card['card_type'])}</div>
            <div><strong>Restaurants covered:</strong> {card['restaurant_count']}</div>
            <div><strong>Best discount:</strong> {escape(format_pct(card['max_discount_pct']))}</div>
            <div><strong>Highest cap:</strong> {escape(format_pkr(card['max_cap_pkr']))}</div>
            <div><strong>Cities:</strong> {escape(', '.join(card['cities']))}</div>
            {f"<div><strong>Benefits:</strong> {escape(card.get('benefits') or '')}</div>" if card.get("benefits") else ""}
          </div>
          <div class="actions" style="margin-top:16px">
            <a class="btn primary" href="{escape(build_tool_url(bank=bank_summary['name']))}">Compare all {escape(bank_summary['name'])} cards</a>
            <a class="btn" href="/banks/{bank_summary['slug']}/">Back to {escape(bank_summary['name'])}</a>
          </div>
        </section>
        
        {related_cards_html}
      </div>
      <div class="page-footer">Independent restaurant discount comparison for Pakistan. Offers can change — always confirm current terms directly with the bank or restaurant.</div>
    """
    schema = [
        {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "WebPage",
                    "name": title,
                    "url": f"{SITE_URL}{canonical_path}",
                    "description": description,
                },
                make_breadcrumb_schema([
                    ("Home", "/"),
                    ("Banks", "/banks/"),
                    (bank_summary["name"], f"/banks/{bank_summary['slug']}/"),
                    (card["name"], canonical_path),
                ]),
            ],
        }
    ]
    return html_page(title=title, description=description, canonical_path=canonical_path, schema=schema, body=body)


def build_summaries(payload: dict) -> tuple[list[dict], list[dict]]:
    offers = payload["offers"]
    bank_slug_map = build_unique_slug_map(offer["bank"] for offer in offers)
    restaurant_slug_map = build_unique_slug_map(offer["restaurant"] for offer in offers)

    req_records = json.loads(CARD_REQUIREMENTS_PATH.read_text(encoding="utf-8"))
    req_mapping = json.loads(DEAL_CARD_MAP_PATH.read_text(encoding="utf-8"))
    req_lookup = build_req_lookup(req_records, req_mapping)

    bank_groups: dict[str, list[dict]] = defaultdict(list)
    restaurant_groups: dict[str, list[dict]] = defaultdict(list)
    for offer in offers:
        bank_groups[offer["bank"]].append(offer)
        restaurant_groups[offer["restaurant"]].append(offer)

    bank_summaries: list[dict] = []
    all_card_slugs: dict[str, dict[str, str]] = {}
    for bank_name in dedupe_sorted(bank_groups.keys()):
        rows = bank_groups[bank_name]
        cards: dict[tuple[str, str], list[dict]] = defaultdict(list)
        restaurants: dict[str, list[dict]] = defaultdict(list)
        for row in rows:
            cards[(row["card"], row["cardCategory"])].append(row)
            restaurants[row["restaurant"]].append(row)

        card_slug_map_local = build_unique_slug_map(cn for (cn, _) in cards.keys())
        all_card_slugs[bank_name] = card_slug_map_local

        card_summaries = []
        for (card_name, card_type), card_rows in sorted(cards.items(), key=lambda item: item[0][0].casefold()):
            rest_groups: dict[str, list[dict]] = defaultdict(list)
            for row in card_rows:
                rest_groups[row["restaurant"]].append(row)
            card_restaurant_list: list[dict] = []
            for rest_name, rest_rows in rest_groups.items():
                best = max(rest_rows, key=lambda r: (r.get("discountPct") or 0, r.get("capPkr") or 0))
                card_restaurant_list.append({
                    "name": rest_name,
                    "slug": restaurant_slug_map[rest_name],
                    "discount_label": best.get("discountLabel", ""),
                    "max_discount_pct": best.get("discountPct") or None,
                    "max_cap_pkr": best.get("capPkr") or None,
                    "days_label": best.get("daysLabel", ""),
                    "offer_title": best.get("offerTitle") or None,
                    "offer_description": best.get("offerDescription") or None,
                    "order_types": best.get("orderTypes") or [],
                    "cities": dedupe_sorted(r["city"] for r in rest_rows),
                })
            card_restaurant_list.sort(key=lambda x: (-(x["max_discount_pct"] or 0), -(x["max_cap_pkr"] or 0)))
            card_summaries.append(
                {
                    "name": card_name,
                    "slug": card_slug_map_local[card_name],
                    "card_type": card_type.title(),
                    "restaurant_count": len(rest_groups),
                    "max_discount_pct": max((row.get("discountPct") or 0) for row in card_rows) or None,
                    "max_cap_pkr": max((row.get("capPkr") or 0) for row in card_rows) or None,
                    "cities": dedupe_sorted(row["city"] for row in card_rows),
                    "restaurants": card_restaurant_list,
                    "requirements": find_req(req_lookup, bank_name, card_name),
                    "benefits": (find_req(req_lookup, bank_name, card_name) or {}).get("benefits"),
                }
            )

        restaurant_summaries: list[RelatedItem] = []
        for restaurant_name, restaurant_rows in restaurants.items():
            restaurant_summaries.append(
                RelatedItem(
                    name=restaurant_name,
                    slug=restaurant_slug_map[restaurant_name],
                    offers=len(restaurant_rows),
                    cards=len({row["card"] for row in restaurant_rows}),
                    cities=dedupe_sorted(row["city"] for row in restaurant_rows),
                    max_discount_pct=max((row.get("discountPct") or 0) for row in restaurant_rows) or None,
                    max_cap_pkr=max((row.get("capPkr") or 0) for row in restaurant_rows) or None,
                )
            )

        restaurant_summaries.sort(key=lambda item: (-item.cards, -item.offers, item.name.casefold()))

        # For each top restaurant, find the best individual card offer from this bank
        best_cards_at_restaurants: dict[str, dict] = {}
        for item in restaurant_summaries[:8]:
            rest_rows = restaurants[item.name]
            best = max(rest_rows, key=lambda r: (r.get("discountPct") or 0, r.get("capPkr") or 0), default=None)
            if best:
                best_cards_at_restaurants[item.name] = {
                    "card": best.get("card", ""),
                    "discount_label": best.get("discountLabel", ""),
                    "cap_pkr": best.get("capPkr"),
                    "days_label": best.get("daysLabel", ""),
                }

        bank_summaries.append(
            {
                "name": bank_name,
                "slug": bank_slug_map[bank_name],
                "offers_count": len(rows),
                "restaurant_count": len(restaurants),
                "card_count": len(cards),
                "cities": dedupe_sorted(row["city"] for row in rows),
                "max_discount_pct": max((row.get("discountPct") or 0) for row in rows) or None,
                "max_cap_pkr": max((row.get("capPkr") or 0) for row in rows) or None,
                "cards": card_summaries,
                "top_restaurants": restaurant_summaries[:8],
                "best_cards_at_restaurants": best_cards_at_restaurants,
            }
        )

    restaurant_summaries_all: list[dict] = []
    for restaurant_name in dedupe_sorted(restaurant_groups.keys()):
        rows = restaurant_groups[restaurant_name]
        banks: dict[str, list[dict]] = defaultdict(list)
        card_groups: dict[tuple[str, str], list[dict]] = defaultdict(list)
        cards = set()
        for row in rows:
            banks[row["bank"]].append(row)
            card_groups[(row["bank"], row["card"])].append(row)
            cards.add((row["bank"], row["card"]))

        bank_summaries_for_restaurant = []
        top_banks: list[RelatedItem] = []
        for bank_name, bank_rows in sorted(banks.items(), key=lambda item: item[0].casefold()):
            item = RelatedItem(
                name=bank_name,
                slug=bank_slug_map[bank_name],
                offers=len(bank_rows),
                cards=len({row["card"] for row in bank_rows}),
                cities=dedupe_sorted(row["city"] for row in bank_rows),
                max_discount_pct=max((row.get("discountPct") or 0) for row in bank_rows) or None,
                max_cap_pkr=max((row.get("capPkr") or 0) for row in bank_rows) or None,
            )
            top_banks.append(item)
            bank_summaries_for_restaurant.append(
                {
                    "name": bank_name,
                    "card_count": item.cards,
                    "cities": item.cities,
                    "max_discount_pct": item.max_discount_pct,
                    "max_cap_pkr": item.max_cap_pkr,
                }
            )

        top_banks.sort(key=lambda item: (-item.cards, -item.offers, item.name.casefold()))

        # Build per-card offer list, all unique offers per (bank,card), grouped by card then sorted best discount first
        card_offers: list[dict] = []
        for (bank_name, card_name), card_rows in card_groups.items():
            seen = set()
            for row in card_rows:
                key = (
                    row.get("offerTitle") or "",
                    tuple(sorted(row.get("orderTypes") or [])),
                    row.get("discountPct"),
                    row.get("capPkr"),
                    row.get("daysLabel") or "",
                )
                if key not in seen:
                    seen.add(key)
                    card_offers.append({
                        "bank": bank_name,
                        "bank_slug": bank_slug_map[bank_name],
                        "card": card_name,
                        "card_slug": all_card_slugs.get(bank_name, {}).get(card_name, slugify(card_name)),
                        "card_type": row.get("cardCategory", "").title(),
                        "offer_title": row.get("offerTitle") or row.get("discountLabel", ""),
                        "offer_description": row.get("offerDescription") or None,
                        "order_types": row.get("orderTypes") or [],
                        "discount_is_up_to": row.get("discountIsUpTo") or False,
                        "discount_label": row.get("discountLabel", ""),
                        "max_discount_pct": row.get("discountPct") or None,
                        "max_cap_pkr": row.get("capPkr") or None,
                        "days_label": row.get("daysLabel", ""),
                        "cities": dedupe_sorted(r["city"] for r in card_rows),
                    })
        card_offers.sort(key=lambda x: (x["bank"].casefold(), x["card"].casefold(), -(x["max_discount_pct"] or 0), -(x["max_cap_pkr"] or 0)))

        restaurant_summaries_all.append(
            {
                "name": restaurant_name,
                "slug": restaurant_slug_map[restaurant_name],
                "offers_count": len(rows),
                "bank_count": len(banks),
                "card_count": len(cards),
                "cities": dedupe_sorted(row["city"] for row in rows),
                "max_discount_pct": max((row.get("discountPct") or 0) for row in rows) or None,
                "max_cap_pkr": max((row.get("capPkr") or 0) for row in rows) or None,
                "banks": bank_summaries_for_restaurant,
                "top_banks": top_banks[:8],
                "card_offers": card_offers,
            }
        )

    bank_summaries.sort(key=lambda item: item["name"].casefold())
    restaurant_summaries_all.sort(key=lambda item: item["name"].casefold())
    return bank_summaries, restaurant_summaries_all


def render_and_write_pages(payload: dict) -> tuple[int, int]:
    bank_summaries, restaurant_summaries = build_summaries(payload)
    bank_slug_map = {item["name"]: item["slug"] for item in bank_summaries}
    restaurant_slug_map = {item["name"]: item["slug"] for item in restaurant_summaries}

    clear_directory(BANKS_DIR)
    clear_directory(RESTAURANTS_DIR)

    write_file(BANKS_DIR / "index.html", render_bank_index(bank_summaries))
    write_file(RESTAURANTS_DIR / "index.html", render_restaurant_index(restaurant_summaries, len(bank_summaries)))

    card_count = 0
    for summary in bank_summaries:
        write_file(BANKS_DIR / summary["slug"] / "index.html", render_bank_page(summary, restaurant_slug_map))
        for card in summary["cards"]:
            write_file(BANKS_DIR / summary["slug"] / card["slug"] / "index.html", render_card_page(summary, card))
            card_count += 1

    for summary in restaurant_summaries:
        write_file(RESTAURANTS_DIR / summary["slug"] / "index.html", render_restaurant_page(summary, bank_slug_map))

    return len(bank_summaries), len(restaurant_summaries), card_count


def regenerate_sitemap(payload: dict, bank_count: int, restaurant_count: int, card_count: int = 0) -> None:
    today = datetime.now(UTC).date().isoformat()
    static_urls = []
    for route, _, changefreq, priority in STATIC_ROUTES:
        loc = f"{SITE_URL}{route}"
        static_urls.append(
            f"""  <url>
    <loc>{loc}</loc>
    <lastmod>{today}</lastmod>
    <changefreq>{changefreq}</changefreq>
    <priority>{priority}</priority>
  </url>"""
        )

    bank_paths = sorted(path for path in BANKS_DIR.rglob("index.html"))
    restaurant_paths = sorted(path for path in RESTAURANTS_DIR.rglob("index.html"))

    dynamic_urls: list[str] = []
    for path in bank_paths + restaurant_paths:
        relative = "/" + path.relative_to(ROOT).as_posix().replace("index.html", "")
        dynamic_urls.append(
            f"""  <url>
    <loc>{SITE_URL}{relative}</loc>
    <lastmod>{today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>{"0.7" if relative.count("/") <= 2 else "0.6"}</priority>
  </url>"""
        )

    sitemap = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(static_urls + dynamic_urls)
        + "\n</urlset>\n"
    )
    write_file(SITEMAP_PATH, sitemap)
    print(f"[seo] Sitemap updated with {len(static_urls) + len(dynamic_urls)} URLs.")
    print(f"[seo] Bank pages: {bank_count}")
    print(f"[seo] Card pages: {card_count}")
    print(f"[seo] Restaurant pages: {restaurant_count}")
    print(f"[seo] Offers dataset timestamp: {payload.get('generatedAt', 'unknown')}")


def main() -> None:
    payload = json.loads(OFFERS_PATH.read_text(encoding="utf-8"))
    bank_count, restaurant_count, card_count = render_and_write_pages(payload)
    regenerate_sitemap(payload, bank_count, restaurant_count, card_count)


if __name__ == "__main__":
    main()
