# Plan: Enhance Offer Details on Restaurant Pages

## What changes

Restaurant pages (`restaurants/<slug>/index.html`) currently show a table with: Bank, Card, Type, Discount, Cap, Days, Action. We enrich this by:

1. **Surface `offerTitle` and `orderTypes`** — two new columns in the table
2. **Show ALL offers per card** — instead of picking only the best, list every unique deal variation

### Before vs After (table columns)

| Before | After |
|---|---|
| Bank, Card, Type, Discount, Cap, Days, Action | Bank, Card, Type, **Offer Details**, Discount, Cap, Days, **Order**, Action |

## Why these fields

- `offerTitle` — the actual deal description, e.g., "50% off on Entire Menu" vs "20% off on Ala Carte". This is the key missing context.
- `orderTypes` — ["Dine-In"], ["Dine-In","Takeaway","Delivery"] shown as small badges/pills so users know how to use the discount.
- Showing all offers — some cards have multiple distinct deals at the same restaurant (e.g., different menus, different days). We were hiding those.

## Files to change

### 1. `scripts/seo/generate_seo_pages.py`

**`build_summaries()` — restaurant section (around line 1300)**

Current: picks `best_row` per `(bank, card)` pair, discards the rest.
Change: iterate all rows per `(bank, card)`, deduplicate by a composite key of `(offerTitle, orderTypes, discountPct, capPkr, daysLabel)`, and emit one `card_offer` dict per unique offer.

New fields added to each `card_offer` dict:
- `offer_title` — the `offerTitle` field from raw data, falling back to discountLabel if null
- `order_types` — the `orderTypes` list (e.g., `["Dine-In"]`, `["Dine-In","Takeaway"]`)  
- `discount_is_up_to` — the `discountIsUpTo` boolean flag

Sort: group by (bank, card) so related offers stay together, within each group sort by discount desc.

**`render_restaurant_page()` — card_rows template (around line 818)**

Add two new `<th>` and `<td>` cells:
- `<th>Offer Details</th>` / `<td data-label="Offer Details">` — displays `offer_title`
- `<th>Order</th>` / `<td data-label="Order">` — displays `order_types` as comma-separated badge spans

If `offer_title` is empty/None, fall back to the `discount_label`.

**`render_restaurant_page()` — table section description text**

Update the paragraph: "Every card..." → "Every deal..." to reflect that multiple offers per card may appear.

### 2. No other files need changes

- `assets/app.js` — dynamic client-side tool unchanged; it reads offers.json directly
- `assets/content-pages.js` — table pagination already handles any number of rows
- Bank pages and card pages — these show different views, no changes needed
- `assets/styles.css` — no changes; pill styles already exist in COMPONENT_CSS

## Dedup logic

```python
seen = set()
for row in card_rows:
    key = (
        row.get("offerTitle") or "", 
        tuple(sorted(row.get("orderTypes") or [])), 
        row.get("discountPct"), 
        row.get("capPkr"), 
        row.get("daysLabel") or ""
    )
    if key not in seen:
        seen.add(key)
        card_offers.append({...})
```

Ensures identical offers across different cities appear once.

## Order type badge styling

Reuse existing `.pill` CSS class:
```html
<span class="pill" style="background:#e8f5e9;color:#2e7d32">Dine-In</span>
```

Green for Dine-In, blue for Takeaway, amber for Delivery.

## Verification

1. Run `python scripts/seo/generate_seo_pages.py` to regenerate all pages
2. Spot-check a restaurant with varied offers (e.g., `restaurants/bar-b-q-tonight/index.html`) — verify Offer Details and Order columns
3. Check a restaurant with Easypaisa offers (offerTitle is null) — verify fallback works
4. Check mobile view — verify data-label attributes
5. Run `python scripts/offers/validate_offers_dataset.py` — confirm data integrity
