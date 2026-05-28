from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import stat
import time
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

# Mirror of BANK_LOGO_FILES from assets/state.js. Keys are normalized bank names
# (lowercase, alphanumeric only). Values are filenames in /assets/bank-logos/.
BANK_LOGO_FILES = {
    "albarakabank": "al-baraka-bank.png",
    "alliedbank": "allied-bank.png",
    "askaribanklimited": "askari-bank.png",
    "bankalhabib": "bank-al-habib.png",
    "bankalfalah": "bank-alfalah.png",
    "bankofpunjab": "bank-of-punjab.png",
    "bankislami": "bankislami.png",
    "easypaisa": "easypaisa.png",
    "faysalbanklimited": "faysal-bank.png",
    "habibbanklimited": "hbl.png",
    "habibmetrobank": "habib-metro.png",
    "hblislamicbanklimited": "hbl-islamic.png",
    "jsbank": "js-bank.png",
    "mcbbanklimited": "mcb-bank.png",
    "mcbislamicbankltd": "mcb-islamic.png",
    "meezanbank": "meezan-bank.png",
    "nationalbankofpakistan": "national-bank-of-pakistan.png",
    "standardcharteredbank": "standard-chartered.png",
    "unitedbanklimitedubl": "ubl.png",
}


def bank_logo_url(bank_name: str) -> str | None:
    key = "".join(c for c in bank_name.lower() if c.isalnum())
    filename = BANK_LOGO_FILES.get(key)
    return f"/assets/bank-logos/{filename}" if filename else None


def bank_logo_img(bank_name: str, *, css_class: str = "bank-logo-image", lazy: bool = True) -> str:
    src = bank_logo_url(bank_name)
    if not src:
        return ""
    loading = ' loading="lazy"' if lazy else ""
    return (
        f'<img class="{css_class}" src="{src}" alt="{escape(bank_name)} logo"'
        f' width="64" height="64"{loading} />'
    )


def format_dataset_date(timestamp_str: str) -> tuple[str, str]:
    """Parse an ISO timestamp and return (iso_date, human_date) e.g.
    ("2026-05-20", "May 20, 2026"). Empty strings on failure.
    """
    if not timestamp_str:
        return "", ""
    try:
        dt = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
    except ValueError:
        return "", ""
    iso = dt.date().isoformat()
    human = dt.strftime("%B ") + str(dt.day) + dt.strftime(", %Y")
    return iso, human


def last_updated_html(iso_date: str, human_date: str) -> str:
    if not iso_date:
        return ""
    return f'Last updated <time datetime="{iso_date}">{human_date}</time>. '


ATTRIBUTION_FOOTER = (
    '<div class="page-footer">'
    'Restaurant data, branch addresses, and offer details are sourced from '
    '<a href="https://peekaboo.guru" target="_blank" rel="noopener noreferrer">Peekaboo Guru</a>, '
    '<a href="https://easypaisa.com.pk" target="_blank" rel="noopener noreferrer">Easypaisa</a>, '
    'and bank-published material. KonsaCard is an independent comparison and is not affiliated with any bank or merchant.'
    '</div>'
)


def freshness_chip_html(iso_date: str, human_date: str) -> str:
    """Small always-visible chip at the top of bank/restaurant/card pages —
    mirrors the homepage chip styling. Uses absolute date so it doesn't lie
    when the page is viewed weeks after deploy. Wrapped in a max-width
    container so the chip aligns with the hero/content gutter."""
    if not iso_date:
        return ""
    return (
        '<div class="freshness-chip-wrap">'
        '<div class="freshness-chip" role="status">'
        '<span class="freshness-chip-dot" aria-hidden="true"></span>'
        f'<span>Offers verified <strong><time datetime="{iso_date}">{human_date}</time></strong></span>'
        "</div>"
        "</div>"
    )


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
    ("/about/", ROOT / "about" / "index.html", "monthly", "0.6"),
    ("/methodology/", ROOT / "methodology" / "index.html", "monthly", "0.7"),
    ("/how-card-tiers-affect-discounts/", ROOT / "how-card-tiers-affect-discounts" / "index.html", "weekly", "0.8"),
    ("/how-discount-caps-work/", ROOT / "how-discount-caps-work" / "index.html", "weekly", "0.8"),
    ("/contact/", ROOT / "contact" / "index.html", "monthly", "0.5"),
    ("/privacy-policy/", ROOT / "privacy-policy" / "index.html", "monthly", "0.4"),
    ("/terms/", ROOT / "terms" / "index.html", "monthly", "0.4"),
]

# Component CSS for generated pages lives in apps/web/assets/components.css
# (formerly an inlined ~9.6 KB <style> block here). Moved out so the file is
# cacheable and HTML text/markup ratio improves on every generated page.

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
    <link rel="manifest" href="/manifest.webmanifest" />
    <meta name="theme-color" content="#BD5B3D" />
    <meta name="robots" content="index,follow,max-image-preview:large" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="{canonical_url}" />
    <meta property="og:title" content="{escaped_title}" />
    <meta property="og:description" content="{escaped_description}" />
    <meta property="og:site_name" content="konsacard.pk" />
    <meta property="og:image" content="{SITE_URL}/assets/og-image.jpg" />
    <meta property="og:image:alt" content="KonsaCard - Restaurant discount comparison for Pakistan" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="{escaped_title}" />
    <meta name="twitter:description" content="{escaped_description}" />
    <meta name="twitter:image" content="{SITE_URL}/assets/og-image.jpg" />
    <meta name="twitter:image:alt" content="KonsaCard - Restaurant discount comparison for Pakistan" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" media="print" onload="this.media='all'" />
    <noscript><link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" /></noscript>
    <link rel="stylesheet" href="/assets/dist/styles.css?v=__BUILD_VERSION__" />
    <link rel="stylesheet" href="/assets/dist/components.css?v=__BUILD_VERSION__" />
    <script type="application/ld+json">
{schema_json}
    </script>
  </head>
  <body class="content-page">
    <div class="page-shell content-shell">
    {body}
    </div>
    <script defer src="/assets/dist/content-pages.js?v=__BUILD_VERSION__"></script>
  </body>
</html>
"""


def nav_html(current: str = "") -> str:
    primary = [
        ("/banks/", "Banks"),
        ("/restaurants/", "Restaurants"),
    ]
    learn_pages = [
        ("/about/", "About"),
        ("/methodology/", "Methodology"),
        ("/how-discount-caps-work/", "Discount Caps"),
        ("/how-card-tiers-affect-discounts/", "Card Tiers"),
    ]
    all_pages = primary + learn_pages + [
        ("/privacy-policy/", "Privacy"),
        ("/terms/", "Terms"),
        ("/contact/", "Contact"),
    ]

    def d_link(href: str, text: str) -> str:
        cur = ' aria-current="page"' if href.rstrip("/") == f"/{current}".rstrip("/") else ""
        return f'          <a class="nav-link" href="{href}"{cur}>{text}</a>'

    def u_link(href: str, text: str) -> str:
        cur = ' aria-current="page"' if href.rstrip("/") == f"/{current}".rstrip("/") else ""
        return f'          <a class="utility-link" href="{href}"{cur}>{text}</a>'

    learn_active = any(href.rstrip("/") == f"/{current}".rstrip("/") for href, _ in learn_pages)
    learn_trigger_cur = ' aria-current="page"' if learn_active else ""

    def _learn_dropdown_link(href: str, text: str) -> str:
        # Extracted into a helper so Python 3.11 doesn't choke on backslashes
        # inside the f-string expression (that restriction was lifted in 3.12).
        cur_attr = ' aria-current="page"' if href.rstrip("/") == f"/{current}".rstrip("/") else ""
        return f'                <a class="nav-dropdown-link" href="{href}"{cur_attr}>{text}</a>'

    learn_dropdown_items = "\n".join(
        _learn_dropdown_link(href, text) for href, text in learn_pages
    )
    contact_link = d_link("/contact/", "Contact")
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


def faq_schema(faqs: list[tuple[str, str]]) -> dict:
    """Build FAQPage JSON-LD from a list of (question, answer) pairs.

    Google rewards pages that combine FAQPage schema with the same Q&A
    visible in the HTML — the page can earn a rich snippet that shows
    the questions inline in the SERP, dramatically boosting CTR.
    """
    return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {
                "@type": "Question",
                "name": q,
                "acceptedAnswer": {"@type": "Answer", "text": a},
            }
            for q, a in faqs
        ],
    }


def render_faq_section(title: str, faqs: list[tuple[str, str]]) -> str:
    """Render the FAQ section as <details>/<summary> for native accessibility,
    matching the FAQPage schema. The answers MUST be visible on-page for
    Google to honor the schema."""
    if not faqs:
        return ""
    items = "".join(
        f"""
        <details class="faq-item">
          <summary>{escape(q)}</summary>
          <div class="faq-answer">{escape(a)}</div>
        </details>
        """
        for q, a in faqs
    )
    return f"""
      <section class="section">
        <h2>{escape(title)}</h2>
        {items}
      </section>
    """


def build_bank_faqs(summary: dict, top_restaurants: list) -> list[tuple[str, str]]:
    """Templated FAQ list for a bank page, parameterized from data."""
    name = summary["name"]
    n_rest = summary["restaurant_count"]
    n_cards = summary["card_count"]
    cities = ", ".join(summary["cities"])
    best_card = summary["cards"][0]["name"] if summary["cards"] else None
    best_pct = format_pct(max((c.get("max_discount_pct") or 0) for c in summary["cards"])) if summary["cards"] else "—"
    top_rest_names = ", ".join(r.name for r in top_restaurants[:3]) if top_restaurants else None

    faqs: list[tuple[str, str]] = []
    faqs.append((
        f"How many restaurants offer {name} card discounts in Pakistan?",
        f"{name} cards work at {n_rest} restaurants across {cities}. KonsaCard lists every active dining offer for {n_cards} {name} cards "
        f"{'including ' + top_rest_names + '.' if top_rest_names else 'in our database.'}"
    ))
    if best_card:
        faqs.append((
            f"Which {name} card has the highest restaurant discount?",
            f"The {best_card} carries the deepest dining discount among {name} cards on KonsaCard, reaching {best_pct} at participating restaurants. "
            f"Headline % alone isn't always the best signal though. Caps and which restaurants are covered matter just as much. "
            f"Use the comparison tool to find the {name} card that maximises your actual savings."
        ))
    faqs.append((
        f"Do {name} restaurant discounts apply every day?",
        f"It depends on the offer. Many {name} dining offers run on specific days of the week (e.g. weekday-only) while others apply daily. "
        f"Each row in the table above shows the days a given card's discount is valid. Filter by day in the main tool to see only offers active when you plan to dine out."
    ))
    faqs.append((
        f"Are {name} discounts available for delivery and takeaway?",
        f"Offer types vary by deal. Some {name} cards cover dine-in only, others extend to takeaway or delivery. The 'Order' column on each card's individual page shows which order types qualify. "
        f"If you mostly order delivery, filter for delivery-eligible cards in the comparison tool."
    ))
    faqs.append((
        f"What is the monthly cap on {name} dining discounts?",
        f"Caps are set per card and per offer, not per bank. Most {name} dining offers cap savings at a fixed PKR amount per transaction, per month, or both. "
        f"A high headline % paired with a low cap can be worse value than a moderate % with no cap. The 'Highest cap' column in the cards table above shows the best-case ceiling on each card; "
        f"the comparison tool then estimates how much of that cap you'd actually use given your typical bill size."
    ))
    faqs.append((
        f"Which {name} card is best for casual dining versus premium restaurants?",
        f"It depends on average bill size. Lower-tier {name} cards (Classic, Silver, debit) typically work well at casual restaurants where the bill stays under common per-transaction caps. "
        f"Premium {name} cards (Platinum, World, Signature) tend to carry both a higher headline % and a higher monthly ceiling, which pays off more at fine-dining bills. "
        f"The comparison tool ranks by estimated rupee savings on your input bill, so the right answer falls out automatically once you set your typical spend."
    ))
    faqs.append((
        f"How do I apply for a {name} card with restaurant discounts?",
        f"KonsaCard does not process card applications — we only compare. Once you've found the {name} card you want, open its card page from the table above and follow the link to {name}'s official site. "
        f"All restaurant discount cards on KonsaCard link to the issuing bank's own application page. For eligibility, income requirements, and joining fees, contact {name} directly."
    ))
    faqs.append((
        f"How often is {name} offer data on KonsaCard updated?",
        f"The full offers dataset is refreshed periodically from public bank and merchant feeds. Each card and restaurant page shows when its data was last verified. "
        f"Banks change terms frequently and sometimes without notice, so we recommend confirming the current discount % and cap with {name} or the restaurant before relying on the figures shown here. "
        f"If you spot a discrepancy, the contact page has a form for reporting corrections with a source link."
    ))
    return faqs


def build_restaurant_faqs(summary: dict) -> list[tuple[str, str]]:
    """Templated FAQ list for a restaurant page."""
    name = summary["name"]
    n_cards = summary["card_count"]
    n_banks = summary["bank_count"]
    cities = ", ".join(summary.get("cities", []))
    offers = summary.get("card_offers", []) or []
    best_pct = format_pct(max((o.get("max_discount_pct") or 0) for o in offers)) if offers else "—"
    best_bank = offers[0]["bank"] if offers else None

    faqs: list[tuple[str, str]] = []
    faqs.append((
        f"Which bank cards work at {name}?",
        f"{n_cards} cards from {n_banks} banks offer discounts at {name}{' in ' + cities if cities else ''}. "
        f"The cards range from basic debit cards to premium credit cards, with the top performer being {best_bank or 'multiple options'}. "
        f"Use the table above to compare every active offer."
    ))
    faqs.append((
        f"What is the best discount at {name}?",
        f"The deepest discount available at {name} on KonsaCard right now is {best_pct}. "
        f"But the highest headline % isn't always the most you'll save, because many cards cap the discount per transaction. "
        f"Open the comparison tool to enter your typical bill size and see actual estimated savings rather than just the % off."
    ))
    faqs.append((
        f"Do {name} discounts work every day?",
        f"Offers at {name} vary by day. Some cards run weekday-only offers, others apply across the full week. "
        f"The 'Days' column on each row shows when the offer is active. Filter by your dining day in the main tool to see only relevant cards."
    ))
    faqs.append((
        f"How do I get a {name} discount?",
        f"Pay your bill with one of the listed cards on a qualifying day, and the discount is applied automatically at the till. No coupon code needed. "
        f"Always confirm current terms with your bank or the restaurant before assuming an offer is still active, as discounts can change."
    ))
    return faqs


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


def bank_page_schema(
    title: str,
    description: str,
    canonical_path: str,
    bank_name: str,
    cities: list[str],
    top_restaurants: list[RelatedItem],
) -> list[dict]:
    """Schema graph for bank pages.

    The page is a CollectionPage whose `about` is the bank entity. We use
    Organization instead of the more specific FinancialService because the
    latter inherits from LocalBusiness, which Google's structured-data
    validator requires `address` on. We can't supply a meaningful single
    address for a nationwide bank with many branches, and Organization is
    accurate — we're describing the bank as an abstract issuer of cards, not
    a particular branch.
    """
    item_list = [
        {
            "@type": "ListItem",
            "position": index + 1,
            "name": item.name,
            "url": f"{SITE_URL}/restaurants/{item.slug}/",
        }
        for index, item in enumerate(top_restaurants[:10])
    ]

    bank_entity: dict = {
        "@type": "Organization",
        "@id": f"{SITE_URL}{canonical_path}#bank",
        "name": bank_name,
        "url": f"{SITE_URL}{canonical_path}",
    }
    # Use the real bank logo if we have one — accurate and tied to the entity.
    logo_path = bank_logo_url(bank_name)
    if logo_path:
        bank_entity["logo"] = f"{SITE_URL}{logo_path}"
        bank_entity["image"] = f"{SITE_URL}{logo_path}"
    if cities:
        bank_entity["areaServed"] = [
            {"@type": "City", "name": city} for city in cities
        ]

    return [
        {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "CollectionPage",
                    "name": title,
                    "url": f"{SITE_URL}{canonical_path}",
                    "description": description,
                    "about": {"@id": f"{SITE_URL}{canonical_path}#bank"},
                    "isPartOf": {"@id": f"{SITE_URL}/#website"},
                },
                make_breadcrumb_schema([
                    ("Home", "/"),
                    ("Banks", "/banks/"),
                    (bank_name, canonical_path),
                ]),
                bank_entity,
                {
                    "@type": "ItemList",
                    "name": f"Top restaurants for {bank_name}",
                    "itemListElement": item_list,
                },
            ],
        }
    ]


SCHEMA_DAY_TO_FULL = {
    "Monday": "https://schema.org/Monday",
    "Tuesday": "https://schema.org/Tuesday",
    "Wednesday": "https://schema.org/Wednesday",
    "Thursday": "https://schema.org/Thursday",
    "Friday": "https://schema.org/Friday",
    "Saturday": "https://schema.org/Saturday",
    "Sunday": "https://schema.org/Sunday",
}


def restaurant_page_schema(
    title: str,
    description: str,
    canonical_path: str,
    restaurant_name: str,
    related_banks: list[RelatedItem],
    related_base_path: str,
    cities: list[str],
    branches: list[dict] | None = None,
    enrichment: dict | None = None,
) -> list[dict]:
    """Schema graph for restaurant pages.

    Emits only fields we can substantiate. The cheap path (no `enrichment`)
    uses Peekaboo's nearestBranch labels + coords. The rich path uses
    `/api/v6/entity/branch/_all` data: real street address, geo, telephone,
    opening hours per branch, plus entity-level description, photos,
    cuisine tags, social links, and aggregateRating.
    """
    item_list = [
        {
            "@type": "ListItem",
            "position": index + 1,
            "name": item.name,
            "url": f"{SITE_URL}{related_base_path}{item.slug}/",
        }
        for index, item in enumerate(related_banks[:10])
    ]

    restaurant_entity: dict = {
        "@type": "Restaurant",
        "@id": f"{SITE_URL}{canonical_path}#restaurant",
        "name": restaurant_name,
        "url": f"{SITE_URL}{canonical_path}",
    }
    if cities:
        restaurant_entity["areaServed"] = [
            {"@type": "City", "name": city} for city in cities
        ]

    enr = enrichment or {}

    # Entity-level fields from Peekaboo's /api/v8/entity/detail.
    if enr.get("description"):
        restaurant_entity["description"] = enr["description"]
    images: list[str] = []
    if enr.get("logo"):
        images.append(enr["logo"])
    images.extend(u for u in (enr.get("images") or []) if isinstance(u, str))
    # De-dupe in order
    seen_img: set[str] = set()
    deduped_images: list[str] = []
    for u in images:
        if u in seen_img:
            continue
        seen_img.add(u)
        deduped_images.append(u)
    if deduped_images:
        restaurant_entity["image"] = deduped_images
    if enr.get("telephone"):
        restaurant_entity["telephone"] = enr["telephone"]
    cuisines = enr.get("servesCuisine") or []
    if cuisines:
        restaurant_entity["servesCuisine"] = cuisines
    social = enr.get("social") or {}
    same_as = [
        v for k, v in social.items()
        if k in ("facebook", "website", "instagram", "android", "ios") and isinstance(v, str) and v.startswith("http")
    ]
    if same_as:
        restaurant_entity["sameAs"] = same_as
    # Branches: prefer enriched (street address + geo + phone + hours) over
    # the legacy nearestBranch-labelled fallback.
    rich_branches: list[dict] = []
    if enr.get("branchesByCity"):
        for city, items in (enr["branchesByCity"] or {}).items():
            for b in items or []:
                rich_branches.append({**b, "city": b.get("city") or city})

    # Top-level address — required by Google's validator on Restaurant (a
    # LocalBusiness subtype). A chain doesn't have a single canonical
    # address, so we pick the best available representative: the first
    # enriched branch with a real street address, falling back to the first
    # legacy nearestBranch label, then to areaServed city, then to country
    # alone. Per-branch addresses still appear in `location` below.
    primary_address: dict | None = None
    if rich_branches:
        pick = next(
            (b for b in rich_branches if b.get("address") and b.get("city")),
            None,
        )
        if pick:
            primary_address = {
                "@type": "PostalAddress",
                "streetAddress": pick["address"],
                "addressLocality": pick["city"],
                "addressCountry": pick.get("country") or "PK",
            }
    if primary_address is None and branches:
        pick = next(
            (b for b in branches if b.get("address") and b.get("city")),
            None,
        )
        if pick:
            primary_address = {
                "@type": "PostalAddress",
                "streetAddress": pick["address"],
                "addressLocality": pick["city"],
                "addressCountry": "PK",
            }
    if primary_address is None and cities:
        primary_address = {
            "@type": "PostalAddress",
            "addressLocality": cities[0],
            "addressCountry": "PK",
        }
    if primary_address is None:
        primary_address = {
            "@type": "PostalAddress",
            "addressCountry": "PK",
        }
    restaurant_entity["address"] = primary_address

    location_entries: list[dict] = []
    if rich_branches:
        for b in rich_branches:
            addr = b.get("address")
            city = b.get("city")
            if not addr or not city:
                continue
            place: dict = {
                "@type": "Place",
                "name": b.get("name") or addr,
                "address": {
                    "@type": "PostalAddress",
                    "streetAddress": addr,
                    "addressLocality": city,
                    "addressCountry": b.get("country") or "PK",
                },
            }
            lat, lng = b.get("lat"), b.get("lng")
            if lat is not None and lng is not None:
                place["geo"] = {
                    "@type": "GeoCoordinates",
                    "latitude": lat,
                    "longitude": lng,
                }
            tel = b.get("telephone")
            if tel:
                place["telephone"] = tel
            hours = b.get("openingHours") or []
            ohs = [
                {
                    "@type": "OpeningHoursSpecification",
                    "dayOfWeek": SCHEMA_DAY_TO_FULL[h["day"]],
                    "opens": h["opens"],
                    "closes": h["closes"],
                }
                for h in hours
                if isinstance(h, dict) and h.get("day") in SCHEMA_DAY_TO_FULL and h.get("opens") and h.get("closes")
            ]
            if ohs:
                place["openingHoursSpecification"] = ohs
            location_entries.append(place)
    else:
        # Legacy path: Peekaboo's nearestBranch label only, no real street.
        for branch in branches or []:
            addr_label = branch.get("address")
            city = branch.get("city")
            if not addr_label or not city:
                continue
            place = {
                "@type": "Place",
                "name": addr_label,
                "address": {
                    "@type": "PostalAddress",
                    "addressLocality": city,
                    "addressCountry": "PK",
                },
            }
            lat, lng = branch.get("lat"), branch.get("lng")
            if lat is not None and lng is not None:
                place["geo"] = {
                    "@type": "GeoCoordinates",
                    "latitude": lat,
                    "longitude": lng,
                }
            location_entries.append(place)
    if location_entries:
        restaurant_entity["location"] = location_entries

    return [
        {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "CollectionPage",
                    "name": title,
                    "url": f"{SITE_URL}{canonical_path}",
                    "description": description,
                    "about": {"@id": f"{SITE_URL}{canonical_path}#restaurant"},
                    "isPartOf": {"@id": f"{SITE_URL}/#website"},
                },
                make_breadcrumb_schema([
                    ("Home", "/"),
                    ("Restaurants", "/restaurants/"),
                    (restaurant_name, canonical_path),
                ]),
                restaurant_entity,
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
        logo_html = bank_logo_img(bank["name"])
        cards.append(
            f"""
            <article class="entity-card">
              {f'<div class="entity-card-logo">{logo_html}</div>' if logo_html else ''}
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
      {ATTRIBUTION_FOOTER}
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
            f'<li data-name="{escape(item["name"]).lower()}"><a href="/restaurants/{item["slug"]}/">{escape(item["name"])}</a> <span>· {item["bank_count"]} banks · {len(item["cities"])} cities</span></li>'
            for item in by_letter[letter]
        )
        groups.append(f'<div class="directory-group" data-group="{escape(letter)}"><h3>{escape(letter)}</h3><ul>{links}</ul></div>')

    total_restaurants = len(restaurant_summaries)
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
          <div class="rest-index-search-wrap" style="margin:14px 0 18px;">
            <input type="search" class="rest-index-search" id="rest-index-search" placeholder="Search {total_restaurants} restaurants…" autocomplete="off" style="width:100%;max-width:480px;padding:12px 16px;border:1.5px solid var(--line);border-radius:12px;font-size:15px;font-family:inherit;background:#fff;color:var(--ink);" aria-label="Search restaurants" />
            <div class="rest-index-empty" id="rest-index-empty" style="display:none;margin-top:12px;color:var(--muted);font-size:0.9rem;">No restaurants match that search.</div>
          </div>
          <div class="directory" id="rest-index-directory">
            {''.join(groups)}
          </div>
        </section>
      </div>
      <script>
      (function() {{
        var input = document.getElementById('rest-index-search');
        var empty = document.getElementById('rest-index-empty');
        if (!input) return;
        var groups = document.querySelectorAll('#rest-index-directory .directory-group');
        var items = document.querySelectorAll('#rest-index-directory li[data-name]');
        function apply() {{
          var q = input.value.trim().toLowerCase();
          var any = false;
          items.forEach(function(li) {{
            var match = !q || li.getAttribute('data-name').indexOf(q) !== -1;
            li.style.display = match ? '' : 'none';
            if (match) any = true;
          }});
          groups.forEach(function(g) {{
            var visible = g.querySelectorAll('li[data-name]:not([style*="display: none"])').length;
            g.style.display = visible ? '' : 'none';
          }});
          if (empty) empty.style.display = any ? 'none' : '';
        }}
        input.addEventListener('input', apply);
      }})();
      </script>
      <div class="page-footer">Independent restaurant discount coverage directory for Pakistan. Offers can change, so always confirm with the bank or restaurant before relying on any deal.</div>
      {ATTRIBUTION_FOOTER}
    """
    schema = directory_page_schema(
        title,
        description,
        "/restaurants/",
        [(item["name"], f"/restaurants/{item['slug']}/") for item in restaurant_summaries],
    )
    return html_page(title=title, description=description, canonical_path="/restaurants/", schema=schema, body=body)


def render_bank_page(summary: dict, restaurant_slug_map: dict[str, str], *, last_updated: str = "", freshness_chip: str = "") -> str:
    title = f"{summary['name']} restaurant discounts in Pakistan | KonsaCard"
    best_pct_num = max((c.get("max_discount_pct") or 0) for c in summary["cards"]) if summary["cards"] else 0
    best_pct_str = format_pct(best_pct_num) if best_pct_num else None
    description = (
        f"Compare {summary['card_count']} {summary['name']} cards across {summary['restaurant_count']} restaurants in {', '.join(summary['cities'])}. "
        f"{('Discounts up to ' + best_pct_str + '.') if best_pct_str else ''} Independent rankings. Not sponsored."
    ).strip()
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
        f'<li><a href="/banks/{summary["slug"]}/{card["slug"]}/">{escape(card["name"])}</a> ({card["card_type"]}), {card["restaurant_count"]} restaurants, up to {format_pct(card["max_discount_pct"])} off</li>'
        for card in summary["cards"]
    )
    
    bank_faqs = build_bank_faqs(summary, top_restaurants)
    body = f"""
      {nav_html('banks')}

      <header class="content-hero">
        <div class="hero-meta-row">
          {f'<div class="content-hero-logo">{bank_logo_img(summary["name"], lazy=False)}</div>' if bank_logo_url(summary['name']) else ''}
          <p class="eyebrow">Bank Guide</p>
        </div>
        <h1>{escape(summary['name'])}</h1>
        <p>Every dining offer across {escape(summary['name'])}'s {summary['card_count']} cards, in {', '.join(summary['cities'])}.</p>
        <div class="hero-stats">
          <div class="hero-stat">
            <span class="hero-stat-label">Restaurants</span>
            <span class="hero-stat-value">{summary['restaurant_count']}</span>
          </div>
          <div class="hero-stat">
            <span class="hero-stat-label">Cards</span>
            <span class="hero-stat-value">{summary['card_count']}</span>
          </div>
          {f'<div class="hero-stat"><span class="hero-stat-label">Best discount</span><span class="hero-stat-value green">{escape(best_pct_str)}</span><span class="hero-stat-sub">headline %</span></div>' if best_pct_str else ''}
          <div class="hero-stat">
            <span class="hero-stat-label">Cities</span>
            <span class="hero-stat-value">{len(summary['cities'])}</span>
          </div>
        </div>
        <div class="hero-actions">
          <a class="btn primary" href="/?bank={summary['slug']}" style="background:var(--brand);color:#fff;padding:12px 22px;border-radius:12px;font-weight:700;display:inline-flex;gap:8px;align-items:center;"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>Open the comparison tool →</a>
          {freshness_chip}
        </div>
      </header>

      <div class="content">
        <section class="section">
          <h2>Cards listed for {escape(summary['name'])}</h2>
          <p>Each card below shows how many restaurants it covers and its headline discount. Headline % alone isn't the full picture, because caps and restaurant overlap matter just as much. That is why the comparison tool ranks by estimated savings on your typical bill rather than raw discount %. Click Compare to pre-select this bank.</p>
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

        {render_faq_section(f"Frequently asked about {summary['name']} discounts", bank_faqs)}
      </div>
      <div class="page-footer">{last_updated}Independent restaurant discount comparison for Pakistan. Offers can change, so always confirm current terms directly with the bank or restaurant.</div>
      {ATTRIBUTION_FOOTER}
    """
    schema = bank_page_schema(
        title,
        description,
        f"/banks/{summary['slug']}/",
        summary["name"],
        summary["cities"],
        top_restaurants,
    )
    schema.append(faq_schema(bank_faqs))
    return html_page(
        title=title,
        description=description,
        canonical_path=f"/banks/{summary['slug']}/",
        schema=schema,
        body=body,
    )


def render_offer_details_cell(title: str, description: str | None) -> str:
    """Build the 'Offer Details' table cell.

    Extracted into its own function because Python 3.11 forbids backslashes
    inside f-string `{...}` expressions, and the inline HTML below uses
    escaped quotes throughout the `onclick` attribute. Building the string
    here keeps the call site clean and 3.11-compatible.
    """
    head = escape(title or "")
    if not description:
        return head
    toggle = (
        '<div class="offer-detail-toggle" '
        'onclick="var d=this.nextElementSibling;'
        "d.style.display=d.style.display==='none'?'block':'none';"
        'this.textContent=d.style.display===\'none\'?\'Details ▾\':\'Details ▴\'" '
        'style="cursor:pointer;font-size:0.72rem;color:var(--brand);font-weight:600;margin-top:2px"'
        ">Details ▾</div>"
        '<div class="offer-detail-text" '
        'style="display:none;font-size:0.78rem;color:var(--muted);margin-top:3px;line-height:1.4">'
        + escape(description)
        + "</div>"
    )
    return head + toggle


_DAY_ORDER_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
_SOCIAL_LABELS_SEO = {
    "website": "Website",
    "facebook": "Facebook",
    "instagram": "Instagram",
    "android": "Android app",
    "ios": "iOS app",
}


def render_entity_photos(images: list[str] | None, logo: str | None) -> str:
    """Horizontal photo strip — cover first, then gallery, up to 6 thumbs."""
    seen: set[str] = set()
    picks: list[str] = []
    if logo and logo not in seen:
        seen.add(logo)
        picks.append(logo)
    for u in (images or [])[:6]:
        if isinstance(u, str) and u not in seen:
            seen.add(u)
            picks.append(u)
        if len(picks) >= 6:
            break
    if not picks:
        return ""
    imgs = "".join(
        f'<img src="{escape(u)}" alt="" loading="lazy" />'
        for u in picks
    )
    return f'<div class="entity-hero-photos">{imgs}</div>'


def render_entity_cuisines(cuisines: list[str] | None) -> str:
    if not cuisines:
        return ""
    chips = "".join(
        f'<span class="entity-cuisine-tag">{escape(c)}</span>'
        for c in cuisines
    )
    return f'<div class="entity-cuisine-row" aria-label="Cuisines">{chips}</div>'


def render_entity_socials(social: dict | None) -> str:
    if not social:
        return ""
    links: list[str] = []
    for key in ("website", "facebook", "instagram", "android", "ios"):
        url = social.get(key)
        if isinstance(url, str) and url.startswith("http"):
            label = _SOCIAL_LABELS_SEO.get(key, key)
            links.append(
                f'<a class="entity-social-link" href="{escape(url)}" target="_blank" rel="noopener noreferrer">{escape(label)}</a>'
            )
    if not links:
        return ""
    return f'<div class="entity-social-row">{"".join(links)}</div>'


def render_branch_card_seo(branch: dict) -> str:
    name = branch.get("name") or branch.get("address") or "Branch"
    addr = branch.get("address") or ""
    lat = branch.get("lat")
    lng = branch.get("lng")
    tel = branch.get("telephone")
    maps_href = None
    if isinstance(lat, (int, float)) and isinstance(lng, (int, float)):
        maps_href = f"https://www.google.com/maps?q={lat},{lng}"
    elif addr:
        from urllib.parse import quote
        maps_href = f"https://www.google.com/maps/search/?api=1&query={quote(addr)}"

    hours = branch.get("openingHours") or []
    hours_by_day = {h.get("day"): h for h in hours if isinstance(h, dict)}
    hours_dl = ""
    if hours_by_day:
        rows = "".join(
            f"<dt>{escape(day[:3])}</dt><dd>{escape(hours_by_day[day]['opens'])}–{escape(hours_by_day[day]['closes'])}</dd>"
            for day in _DAY_ORDER_FULL
            if day in hours_by_day
        )
        if rows:
            hours_dl = f'<dl class="branch-hours-list">{rows}</dl>'

    meta_parts: list[str] = []
    if maps_href:
        meta_parts.append(f'<a href="{escape(maps_href)}" target="_blank" rel="noopener noreferrer">Directions</a>')
    if tel:
        clean_tel = "".join(c for c in str(tel) if c.isdigit() or c == "+")
        meta_parts.append(f'<a href="tel:{escape(clean_tel)}">Call</a>')
    meta_html = f'<div class="branch-card-meta">{"".join(meta_parts)}</div>' if meta_parts else ""

    return (
        '<div class="branch-card">'
        f'<div class="branch-card-name">{escape(name)}</div>'
        + (f'<div class="branch-card-addr">{escape(addr)}</div>' if addr else "")
        + meta_html
        + hours_dl
        + "</div>"
    )


def render_restaurant_enrichment_section(enrichment: dict | None, restaurant_name: str, cities: list[str]) -> str:
    """Visible-HTML rendering of the enrichment so humans see the same data
    that's in the JSON-LD. Matching content is what Google requires before
    honoring Restaurant rich-result fields.

    No photos here intentionally — we don't have a license to display the
    restaurant's own imagery. See refresh_peekaboo.py for the same call-out
    on the data-collection side.
    """
    if not enrichment:
        return ""

    desc = enrichment.get("description") or ""
    cuisines = enrichment.get("servesCuisine") or []
    social = enrichment.get("social") or {}
    branches_by_city = enrichment.get("branchesByCity") or {}

    desc_html = f'<p class="entity-description">{escape(desc)}</p>' if desc else ""
    cuisines_html = render_entity_cuisines(cuisines)
    socials_html = render_entity_socials(social)

    intro_section = ""
    if desc_html or cuisines_html or socials_html:
        # Drop the "About {restaurant_name}" H2 — the H1 above already prints
        # the name. Repeating it here just bulks the page out.
        intro_section = f"""
        <section class="section">
          <h2>About</h2>
          {desc_html}
          {cuisines_html}
          {socials_html}
        </section>
        """

    branches_section = ""
    branch_blocks: list[str] = []
    for city in cities:
        items = branches_by_city.get(city) or []
        if not items:
            continue
        cards_html = "".join(render_branch_card_seo(b) for b in items)
        branch_blocks.append(
            f'<h3>{escape(city)} <span style="font-weight:500;color:var(--muted)">· {len(items)} branch{"es" if len(items) != 1 else ""}</span></h3>'
            f'<div class="branch-grid">{cards_html}</div>'
        )
    if branch_blocks:
        branches_section = f"""
        <section class="section">
          <h2>Branches</h2>
          <p>Verified branch locations, addresses, and opening hours. Tap Directions to open in Google Maps.</p>
          {''.join(branch_blocks)}
        </section>
        """

    return intro_section + branches_section


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


def render_restaurant_page(summary: dict, bank_slug_map: dict[str, str], *, last_updated: str = "", freshness_chip: str = "") -> str:
    title = f"{summary['name']} bank discounts in Pakistan | KonsaCard"
    best_offer_pct = max((o.get("max_discount_pct") or 0) for o in summary.get("card_offers", [])) if summary.get("card_offers") else 0
    best_offer_str = format_pct(best_offer_pct) if best_offer_pct else None
    description = (
        f"Compare {summary['card_count']} cards from {summary['bank_count']} banks with discounts at {summary['name']} in {', '.join(summary['cities'])}. "
        f"{('Up to ' + best_offer_str + ' off.') if best_offer_str else ''} Independent, not sponsored."
    ).strip()
    card_rows = "".join(
        f"""
        <tr>
          <td data-label="Bank"><a href="/banks/{bank_slug_map.get(offer['bank'], '#')}/">{escape(offer['bank'])}</a></td>
          <td data-label="Card"><a href="/banks/{offer['bank_slug']}/{offer['card_slug']}/" style="color:var(--ink);font-weight:600">{escape(offer['card'])}</a></td>
          <td data-label="Type">{escape(offer['card_type'])}</td>
          <td data-label="Offer Details">{render_offer_details_cell(offer.get('offer_title') or offer.get('discount_label') or '', offer.get('offer_description'))}</td>
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
        f'<li><a href="/banks/{bank_slug_map.get(bank["name"], "#")}/">{escape(bank["name"])}</a>: {bank["card_count"]} cards, up to {format_pct(bank["max_discount_pct"])} off</li>'
        for bank in summary["banks"]
    )
    
    rest_faqs = build_restaurant_faqs(summary)
    enrichment = summary.get("enrichment") or {}
    enrichment_section = render_restaurant_enrichment_section(
        enrichment if enrichment else None,
        summary["name"],
        summary.get("cities", []),
    )
    body = f"""
      {nav_html('restaurants')}

      <header class="content-hero">
        <p class="eyebrow">Restaurant Guide</p>
        <h1>{escape(summary['name'])}</h1>
        <p>Every bank card with an active dining offer at {escape(summary['name'])} in {', '.join(summary['cities'])}.</p>
        <div class="hero-stats">
          <div class="hero-stat">
            <span class="hero-stat-label">Cards</span>
            <span class="hero-stat-value">{summary['card_count']}</span>
          </div>
          <div class="hero-stat">
            <span class="hero-stat-label">Banks</span>
            <span class="hero-stat-value">{summary['bank_count']}</span>
          </div>
          {f'<div class="hero-stat"><span class="hero-stat-label">Best discount</span><span class="hero-stat-value green">{escape(best_offer_str)}</span><span class="hero-stat-sub">headline %</span></div>' if best_offer_str else ''}
          <div class="hero-stat">
            <span class="hero-stat-label">Cities</span>
            <span class="hero-stat-value">{len(summary['cities'])}</span>
          </div>
        </div>
        <div class="hero-actions">
          <a class="btn primary" href="/?restaurant={summary['slug']}" style="background:var(--brand);color:#fff;padding:12px 22px;border-radius:12px;font-weight:700;display:inline-flex;gap:8px;align-items:center;"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>Open the comparison tool →</a>
          {freshness_chip}
        </div>
      </header>

      <div class="content">
        {enrichment_section}
        <section class="section">
          <h2>Cards available at {escape(summary['name'])}</h2>
          <p>Every deal that shows a discount at {escape(summary['name'])}, sorted by headline discount. Headline % isn't always the best signal, because many offers cap savings per transaction, so what looks like a big discount may save less than a smaller % with no cap. Open the tool with Compare to rank by estimated actual savings on your bill.</p>
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

        {render_faq_section(f"Frequently asked about {summary['name']} discounts", rest_faqs)}
      </div>
      <div class="page-footer">{last_updated}Independent restaurant discount comparison for Pakistan. Offers can change, so always confirm current terms directly with the bank or restaurant.</div>
      {ATTRIBUTION_FOOTER}
    """
    schema = restaurant_page_schema(
        title,
        description,
        f"/restaurants/{summary['slug']}/",
        summary["name"],
        summary["top_banks"],
        "/banks/",
        summary.get("cities", []),
        summary.get("branches", []),
        summary.get("enrichment"),
    )
    schema.append(faq_schema(rest_faqs))
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
            age_str = f"{reqs['minimum_age_years']} to {reqs['maximum_age_years']}"
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


def render_card_page(bank_summary: dict, card: dict, *, last_updated: str = "", freshness_chip: str = "") -> str:
    canonical_path = f"/banks/{bank_summary['slug']}/{card['slug']}/"
    title = f"{card['name']} from {bank_summary['name']}: restaurant discounts | KonsaCard"
    description = (
        f"See every restaurant where {bank_summary['name']} {card['name']} ({card['card_type']}) "
        f"gives a dining discount in Pakistan. {card['restaurant_count']} restaurants, "
        f"best discount {format_pct(card['max_discount_pct'])}."
    )
    restaurant_rows = "".join(
        f"""
        <tr>
          <td data-label="Restaurant"><a href="/restaurants/{r['slug']}/" style="color:var(--ink);font-weight:600">{escape(r['name'])}</a></td>
          <td data-label="Offer Details">{render_offer_details_cell(r.get('offer_title') or r.get('discount_label') or '', r.get('offer_description'))}</td>
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
            f'<li><a href="/banks/{bank_summary["slug"]}/{c["slug"]}/">{escape(c["name"])} ({c["card_type"]})</a>: {c["restaurant_count"]} restaurants</li>'
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
        <div class="hero-meta-row">
          {f'<div class="content-hero-logo">{bank_logo_img(bank_summary["name"], lazy=False)}</div>' if bank_logo_url(bank_summary['name']) else ''}
          <p class="eyebrow">Card Guide</p>
        </div>
        <h1>{escape(card['name'])}</h1>
        <p>{escape(bank_summary['name'])} &middot; {escape(card['card_type'])} &middot; {card['restaurant_count']} restaurants &middot; up to {escape(format_pct(card['max_discount_pct']))} off</p>
      </header>

      {freshness_chip}

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
      <div class="page-footer">{last_updated}Independent restaurant discount comparison for Pakistan. Offers can change. Always confirm current terms directly with the bank or restaurant.</div>
      {ATTRIBUTION_FOOTER}
    """
    is_credit = "credit" in (card.get("card_type") or "").lower()
    card_entity_type = "CreditCard" if is_credit else "FinancialProduct"
    issuer_logo = bank_logo_url(bank_summary["name"])
    card_entity: dict = {
        "@type": card_entity_type,
        "@id": f"{SITE_URL}{canonical_path}#card",
        "name": card["name"],
        "url": f"{SITE_URL}{canonical_path}",
        "category": card.get("card_type"),
        "provider": {
            "@type": "Organization",
            "name": bank_summary["name"],
            "url": f"{SITE_URL}/banks/{bank_summary['slug']}/",
            **({"logo": f"{SITE_URL}{issuer_logo}"} if issuer_logo else {}),
        },
        "areaServed": [
            {"@type": "City", "name": city}
            for city in card.get("cities", [])
        ],
    }
    schema = [
        {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "WebPage",
                    "name": title,
                    "url": f"{SITE_URL}{canonical_path}",
                    "description": description,
                    "about": {"@id": f"{SITE_URL}{canonical_path}#card"},
                    "isPartOf": {"@id": f"{SITE_URL}/#website"},
                },
                make_breadcrumb_schema([
                    ("Home", "/"),
                    ("Banks", "/banks/"),
                    (bank_summary["name"], f"/banks/{bank_summary['slug']}/"),
                    (card["name"], canonical_path),
                ]),
                card_entity,
            ],
        }
    ]
    return html_page(title=title, description=description, canonical_path=canonical_path, schema=schema, body=body)


def build_summaries(payload: dict) -> tuple[list[dict], list[dict]]:
    offers = payload["offers"]
    restaurants_enrichment: dict[str, dict] = payload.get("restaurants") or {}
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

        # Collect unique branches per restaurant. Banks list the same physical
        # branch under multiple offers (one per card), so dedupe by (city,
        # address) — coords for the same branch should match across rows.
        branches_seen: set[tuple[str, str]] = set()
        branches: list[dict] = []
        for row in rows:
            addr = (row.get("sourceAddress") or "").strip()
            city = row.get("city") or ""
            if not addr or not city:
                continue
            key = (city, addr)
            if key in branches_seen:
                continue
            branches_seen.add(key)
            branches.append({
                "city": city,
                "address": addr,
                "lat": row.get("sourceLat"),
                "lng": row.get("sourceLng"),
            })

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
                "branches": branches,
                "enrichment": restaurants_enrichment.get(restaurant_name) or None,
            }
        )

    bank_summaries.sort(key=lambda item: item["name"].casefold())
    restaurant_summaries_all.sort(key=lambda item: item["name"].casefold())
    return bank_summaries, restaurant_summaries_all


def render_and_write_pages(payload: dict) -> tuple[int, int, int]:
    bank_summaries, restaurant_summaries = build_summaries(payload)
    bank_slug_map = {item["name"]: item["slug"] for item in bank_summaries}
    restaurant_slug_map = {item["name"]: item["slug"] for item in restaurant_summaries}

    iso_date, human_date = format_dataset_date(payload.get("generatedAt", ""))
    last_updated = last_updated_html(iso_date, human_date)
    chip = freshness_chip_html(iso_date, human_date)

    clear_directory(BANKS_DIR)
    clear_directory(RESTAURANTS_DIR)

    write_file(BANKS_DIR / "index.html", render_bank_index(bank_summaries))
    write_file(RESTAURANTS_DIR / "index.html", render_restaurant_index(restaurant_summaries, len(bank_summaries)))

    card_count = 0
    for summary in bank_summaries:
        write_file(BANKS_DIR / summary["slug"] / "index.html", render_bank_page(summary, restaurant_slug_map, last_updated=last_updated, freshness_chip=chip))
        for card in summary["cards"]:
            write_file(BANKS_DIR / summary["slug"] / card["slug"] / "index.html", render_card_page(summary, card, last_updated=last_updated, freshness_chip=chip))
            card_count += 1

    for summary in restaurant_summaries:
        write_file(RESTAURANTS_DIR / summary["slug"] / "index.html", render_restaurant_page(summary, bank_slug_map, last_updated=last_updated, freshness_chip=chip))

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
        # Sitemap priority by depth:
        #   /banks/ and /restaurants/         (depth 2) → 0.8  index hubs
        #   /banks/<slug>/, /restaurants/<slug>/ (depth 3) → 0.7  entity pages
        #   /banks/<slug>/<card-slug>/       (depth 4+) → 0.6  card pages
        depth = relative.count("/")
        if depth <= 2:
            priority = "0.8"
        elif depth == 3:
            priority = "0.7"
        else:
            priority = "0.6"
        dynamic_urls.append(
            f"""  <url>
    <loc>{SITE_URL}{relative}</loc>
    <lastmod>{today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>{priority}</priority>
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


# Files whose content drives the build version. A change to any of these
# bumps the ?v= query string in every <script>/<link> tag and the SW's
# SHELL_VERSION, which busts both the HTTP cache (because the URL changes)
# and the SW's cache (because the pre-cache list rebuilds). Stable across
# no-op builds — running the build twice with no code change keeps the
# version, so users don't get a forced refresh for nothing.
VERSIONED_ASSET_FILES = [
    "assets/styles.css",
    "assets/components.css",
    "assets/state.js",
    "assets/algorithms.js",
    "assets/chat.js",
    "assets/quiz.js",
    "assets/app.js",
    "assets/content-pages.js",
    "assets/sentry-init.js",
    "assets/ga-init.js",
]


def compute_build_version() -> str:
    """Content hash of all versioned asset files. Returns a 12-char hex token."""
    h = hashlib.sha256()
    for rel in VERSIONED_ASSET_FILES:
        p = ROOT / rel
        if p.exists():
            h.update(rel.encode("utf-8"))
            h.update(b"\0")
            h.update(p.read_bytes())
            h.update(b"\0")
    return h.hexdigest()[:12]


def stamp_build_version(version: str) -> None:
    """Replace __BUILD_VERSION__ placeholders in sw.js and all generated
    HTML files, plus rewrite any previously-stamped ?v= tokens so re-runs
    keep moving forward."""
    # 1. Service worker — keep the existing 'const SHELL_VERSION = "..."'
    #    line in sync so SHELL_URLS pre-cache the right ?v= URLs.
    sw_path = ROOT / "sw.js"
    if sw_path.exists():
        text = sw_path.read_text(encoding="utf-8")
        if "__BUILD_VERSION__" in text:
            text = text.replace("__BUILD_VERSION__", version)
        else:
            text = re.sub(
                r'const SHELL_VERSION = "[^"]*";',
                f'const SHELL_VERSION = "{version}";',
                text,
                count=1,
            )
        sw_path.write_text(text, encoding="utf-8")

    # 2. All HTML files under ROOT — replace both the source placeholder and
    #    any previously-stamped hash so consecutive builds work.
    prev_hash_pattern = re.compile(r"\?v=(?:__BUILD_VERSION__|[a-f0-9]{8,16})")
    html_count = 0
    for html_path in ROOT.rglob("*.html"):
        # Skip node_modules and any test artifacts.
        parts_set = set(html_path.parts)
        if "node_modules" in parts_set or "test-results" in parts_set:
            continue
        text = html_path.read_text(encoding="utf-8")
        new_text = prev_hash_pattern.sub(f"?v={version}", text)
        if new_text != text:
            html_path.write_text(new_text, encoding="utf-8")
            html_count += 1

    print(f"[seo] Stamped build version {version} into sw.js and {html_count} HTML files")


def main() -> None:
    payload = json.loads(OFFERS_PATH.read_text(encoding="utf-8"))
    bank_count, restaurant_count, card_count = render_and_write_pages(payload)
    regenerate_sitemap(payload, bank_count, restaurant_count, card_count)
    # Stamp build version LAST — it walks all generated HTML and replaces
    # __BUILD_VERSION__ placeholders, so it has to run after page generation.
    stamp_build_version(compute_build_version())


if __name__ == "__main__":
    main()
