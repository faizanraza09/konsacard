"""Restaurant-name cleaning + fuzzy matching used by all offer-source
merges. Pulled out of merge_nbp_into_offers.py so merge_easypaisa
(which previously had no matching at all and stored raw merchant names
with HTML entities and accents intact) can share the same logic and
canonicalize against the existing restaurant pool.

The May 2026 investigation found 8 name-drift pairs that the old
matcher silently treated as distinct restaurants:

  NBP-side (5):
    "TABAQ"                   <->  "Tabaq"                  (case-only)
    "Soho Cafe & Grill"       <->  "Soho Cafe & Grill "     (trailing ws)
    "OX & Grill Steak House"  <->  "Ox & Grill Steakhouse"  (split compound)
    "Karnivora Steak House"   <->  "Karnivora Steakhouse"   (split compound)
    "Butcher's Steak House"   <->  "Butcher's Steakhouse"   (split compound)

  Easypaisa-side (3+):
    "Fryday cafe"                       <->  "Fryday Cafe"
    "Substop"                           <->  "Sub Stop"
    "Manzil Grill (Parklane Hotel)"     <->  "Manzil Grill (Park Lane Hotel)"
    (plus dozens of HTML-entity / accent cases like "Café Bleu",
     "Meemu&#039;s", "LaLa&#039;s Café" that never normalized at all)

Fixes:
  - Single-token threshold lowered from 6 -> 4 chars (token-frequency
    guard prevents false matches on common short words).
  - "house" removed from GENERIC_TOKENS so compound siblings
    "X Steakhouse" / "X Steak House" produce the same signature.
  - clean_name() now also HTML-decodes (`&amp;`, `&#039;`) and
    Unicode-normalizes (`Café` -> `Cafe`) — used by easypaisa which
    fed raw HTML-encoded names straight through.
"""
from __future__ import annotations

import html
import re
import unicodedata
from collections import Counter
from difflib import SequenceMatcher

CITY_TOKENS = {"karachi", "lahore", "islamabad"}

# Tokens that appear in so many restaurant names that they don't help
# distinguish "X Restaurant" from "Y Restaurant". The matcher strips
# these before comparing signatures.
GENERIC_TOKENS = {
    "and",
    "bakery",
    "bar",
    "bistro",
    "cafe",
    "café",
    "co",
    "deli",
    "eatery",
    "express",
    "food",
    "foods",
    "family",
    "grill",
    # "house" intentionally NOT here — letting it stay as a token makes
    # "Steak House" and "Steakhouse" produce the same signature (both
    # collapse punctuation+space to "steakhouse"). Without this, the
    # multi-word version stripped "house" and the merge created
    # duplicate restaurants.
    "kitchen",
    "pakistan",
    "pk",
    "restaurant",
    "restaurants",
    "the",
}


_WINDOWS_1252_MOJIBAKE = {
    # When Windows-1252-encoded smart punctuation is decoded as UTF-8 by mistake,
    # each char becomes a "â<X>" triplet. These are the common ones in our
    # scraped data — none of them can be recovered by the latin1-decode trick
    # below because € (U+20AC) and ™ (U+2122) aren't in latin1.
    "â€™": "'",   # right single quotation mark (’)
    "â€˜": "'",   # left single quotation mark (‘)
    "â€œ": '"',   # left double quotation mark (“)
    "â€": '"',  # right double quotation mark (”) — variant
    "â€\x9d": '"',
    "â€“": "-",   # en dash (–)
    "â€”": "--",  # em dash (—)
    "â€¦": "...", # ellipsis (…)
}


def fix_mojibake(text: str | None) -> str:
    """Heuristic for the latin1-decoded-as-utf8 mojibake we see in
    scraped data (e.g. 'CafÃ©' instead of 'Café', 'Bakerâ€™s' instead
    of 'Baker's'). Idempotent on already-clean strings.

    Handles two patterns:
      1. Latin-1-decoded-as-UTF-8 (the 'CafÃ©' family) — recoverable via
         text.encode('latin1').decode('utf-8').
      2. Windows-1252-decoded-as-UTF-8 (the 'â€™' family) — NOT recoverable
         that way because € and ™ aren't in latin1, so the encode raises
         UnicodeError. Fall back to explicit triplet replacement.
    """
    if not text:
        return ""
    # First try the latin1 round-trip — handles most accented characters.
    if any(ch in text for ch in ("Ã", "Â", "Ð", "Ñ")):
        try:
            text = text.encode("latin1").decode("utf-8")
        except UnicodeError:
            pass  # fall through to triplet replacement below
    # Then sweep any remaining Windows-1252 triplets.
    if "â€" in text:
        for bad, good in _WINDOWS_1252_MOJIBAKE.items():
            text = text.replace(bad, good)
    return text


def strip_accents(text: str) -> str:
    return "".join(
        ch for ch in unicodedata.normalize("NFKD", text) if not unicodedata.combining(ch)
    )


def clean_name(raw: str | None) -> str:
    """Display-ready cleaning: HTML-decode + mojibake-fix + NFKC
    normalize + accent-strip + apostrophe-normalize + whitespace
    collapse. Preserves casing so the result is still the user-facing
    restaurant name.

    Idempotent — clean_name(clean_name(x)) == clean_name(x)."""
    if not raw:
        return ""
    text = html.unescape(raw)          # &amp; -> &  ;  &#039; -> '
    text = fix_mojibake(text)           # CafÃ© -> Café
    text = unicodedata.normalize("NFKC", text)
    text = strip_accents(text)          # Café  -> Cafe
    text = text.replace("’", "'").replace("‘", "'")
    text = re.sub(r"\s+", " ", text).strip()
    return text


def normalize_tokens(name: str, city: str) -> list[str]:
    """Match-friendly tokens: lowercase, ampersand→'and', non-alnum→space,
    drop generic + city tokens."""
    text = clean_name(name).lower().replace("&", " and ")
    text = re.sub(r"[^a-z0-9]+", " ", text)
    city_token = city.lower()
    return [
        token
        for token in text.split()
        if token
        and token not in GENERIC_TOKENS
        and token not in CITY_TOKENS
        and token != city_token
    ]


def signature(name: str, city: str) -> tuple[list[str], str]:
    tokens = normalize_tokens(name, city)
    return tokens, "".join(tokens)


def build_match_index(
    existing_offers: list[dict],
) -> tuple[dict[str, set[str]], dict[str, Counter]]:
    """Build per-city sets of existing restaurant names and a per-city
    Counter of how often each match-token appears. The Counter is used
    to gate single-token matches on uncommon tokens."""
    restaurants_by_city: dict[str, set[str]] = {}
    token_frequency_by_city: dict[str, Counter] = {}

    for offer in existing_offers:
        city = offer["city"]
        restaurants_by_city.setdefault(city, set()).add(offer["restaurant"])

    for city, restaurants in restaurants_by_city.items():
        freq: Counter = Counter()
        for restaurant in restaurants:
            freq.update(set(normalize_tokens(restaurant, city)))
        token_frequency_by_city[city] = freq

    return restaurants_by_city, token_frequency_by_city


def match_score(
    query_name: str,
    candidate_name: str,
    city: str,
    token_frequency_by_city: dict[str, Counter],
) -> float:
    """Score a candidate existing restaurant against an incoming query
    name. 1.0 = certain match, 0.0 = not a match. Calibration:
      - Identical signatures with ≥2 distinct tokens: 1.0
      - Identical single-token signature with token length ≥4 and the
        token appearing in ≤2 existing restaurants in the same city:
        0.98 (the frequency guard prevents 'BBQ', 'Chai' etc. from
        collapsing distinct chains into one).
      - Different signatures: only match if both ≥6 chars, ≥2 shared
        tokens, and SequenceMatcher ratio ≥ 0.90.
    """
    query_tokens, query_sig = signature(query_name, city)
    candidate_tokens, candidate_sig = signature(candidate_name, city)
    if not query_sig or not candidate_sig:
        return 0.0

    if query_sig == candidate_sig:
        if len(set(query_tokens)) >= 2 or len(set(candidate_tokens)) >= 2:
            return 1.0
        token = query_sig
        freq = token_frequency_by_city.get(city, Counter()).get(token, 0)
        # 4-char threshold (was 6) so "soho", "tabaq" can match their
        # exact siblings. Frequency ≤ 2 keeps "bbq" / "cafe"-type
        # tokens from collapsing dozens of distinct restaurants.
        return 0.98 if len(token) >= 4 and freq <= 2 else 0.0

    if len(query_sig) < 6 or len(candidate_sig) < 6:
        return 0.0

    shared_tokens = len(set(query_tokens) & set(candidate_tokens))
    if shared_tokens < 2:
        return 0.0

    similarity = SequenceMatcher(None, query_sig, candidate_sig).ratio()
    if similarity >= 0.90:
        return similarity
    return 0.0


def find_match(
    query_name: str,
    city: str,
    candidates: set[str] | list[str],
    token_frequency_by_city: dict[str, Counter],
    *,
    threshold: float = 0.85,
) -> str | None:
    """Return the canonical existing-restaurant name that this query
    should be merged into, or None if there's no good match. Caller is
    responsible for substituting the canonical name into the offer
    record before storing it."""
    cleaned_query = clean_name(query_name)
    if not cleaned_query:
        return None

    # Exact post-cleaning match wins immediately (cheaper than scoring).
    for c in candidates:
        if c == cleaned_query:
            return c

    best: str | None = None
    best_score = threshold
    for candidate in candidates:
        s = match_score(query_name, candidate, city, token_frequency_by_city)
        if s > best_score:
            best = candidate
            best_score = s
    return best
