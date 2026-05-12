# Bank Data Specification

This document defines the exact formats Card Match PK accepts for two types of data:

- **Dining Offers** — your card's restaurant discount deals across Karachi, Lahore, and Islamabad
- **Card Requirements** — eligibility criteria, fees, and documentation requirements for each card product

We accept data as CSV/Excel spreadsheets or JSON files. Both formats are described below.

---

## 1. Dining Offers

Send us one row per (city, restaurant, card, discount) combination.

### Spreadsheet / CSV Columns

| # | Column | Required | Type | Description | Example |
|---|--------|----------|------|-------------|---------|
| 1 | `city` | ✅ | Text | Must be one of: `Karachi`, `Lahore`, `Islamabad` | `Karachi` |
| 2 | `restaurant_name` | ✅ | Text | Restaurant or chain name | `KFC` |
| 3 | `restaurant_address` | — | Text | Branch location or address (optional but helpful) | `Dolmen Mall, Clifton` |
| 4 | `card_name` | ✅ | Text | Full card product name that gets this discount | `PayPak Classic` |
| 5 | `card_type` | ✅ | Text | `debit` or `credit` | `debit` |
| 6 | `discount_percentage` | ⚠️ | Number | Percentage off (e.g. `20` for 20%). Required unless `fixed_discount_pkr` is provided | `20` |
| 7 | `fixed_discount_pkr` | ⚠️ | Number | Fixed PKR discount amount. Required unless `discount_percentage` is provided | `380` |
| 8 | `discount_label` | ✅ | Text | Human-readable discount (shown to users) | `20%` or `Rs. 380 off` |
| 9 | `cap_pkr` | — | Number | Maximum discount cap in PKR (leave blank if no cap) | `500` |
| 10 | `offer_title` | — | Text | Brief description of the deal | `Zinger Burger + Drink Rs. 400` |
| 11 | `days_applicable` | — | Text | Which days this offer is valid. Default: `All Days` | `All Days` or `Mon-Thu` |
| 12 | `tier_requirement` | — | Text | Minimum card tier needed. Leave blank if none | `classic`, `gold`, `platinum` |
| 13 | `discount_type` | ✅ | Text | One of: `percentage`, `up_to`, `fixed`, `bogo`. See notes below | `percentage` |

**⚠️ At least one of `discount_percentage` or `fixed_discount_pkr` is required.** You can provide both if the offer has both a percentage and a fixed component.

### JSON Format

If you prefer to send JSON, here is the structure:

```jsonc
{
  "bank_name": "National Bank of Pakistan",
  "offers": [
    {
      "city": "Karachi",
      "restaurant_name": "KFC",
      "restaurant_address": "Dolmen Mall, Clifton",
      "card_name": "PayPak Classic",
      "card_type": "debit",
      "discount_percentage": 20,
      "fixed_discount_pkr": null,
      "discount_label": "20%",
      "cap_pkr": 500,
      "offer_title": "20% off on entire bill",
      "days_applicable": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      "tier_requirement": null,
      "discount_type": "percentage"
    }
  ]
}
```

### Notes

- **Discount caps matter.** If your offer says "20% off (max discount Rs. 500)", please include the `cap_pkr: 500` — don't just write "20% off". Users need to know the cap to compare cards accurately.
- **"Up to" vs "Flat"** — If an offer says "Up to 45% off", please clarify whether the 45% is guaranteed or theoretical maximum. If there's a guaranteed flat discount alongside it, we prefer to show the guaranteed rate.
- **Discount types** — The `discount_type` field tells our ranking engine how to interpret the discount:
  - `percentage` — Flat % off the entire bill (e.g., "20% off entire menu"). May have a cap.
  - `up_to` — Maximum possible %, not guaranteed (e.g., "Up to 45% off"). We apply a conservatism factor in ranking.
  - `fixed` — Specific PKR saving on a combo or meal deal (e.g., "Zinger + Drink Rs. 400, save Rs. 380"). The `fixed_discount_pkr` field is required for this type.
  - `bogo` — Buy X Get Y free on specific items (e.g., "Buy 1 Get 1 Free on Coffee"). We apply a conservative estimate since BOGO only covers specific items.
- **Multi-card offers** — If the same discount applies to multiple cards, list them as separate rows (one per card). This is intentional — users filter by card.
- **Branch-specific offers** — Use the `restaurant_address` field to distinguish branch-specific deals. If an offer is chain-wide, leave it blank or use "All branches".

---

## 2. Card Requirements

Send us one row per card product. This covers eligibility, fees, and what customers need to apply.

### Spreadsheet / CSV Columns

| # | Column | Required | Type | Description | Example |
|---|--------|----------|------|-------------|---------|
| 1 | `card_name` | ✅ | Text | Full card product name | `PayPak Classic` |
| 2 | `card_type` | ✅ | Text | `debit`, `credit`, or `prepaid` | `debit` |
| 3 | `card_tier` | — | Text | Tier level: `classic`, `gold`, `platinum`, `premium`, `signature`, `infinite`, `world`, `student` | `classic` |
| 4 | `minimum_monthly_salary_pkr` | — | Number | Minimum salary required. Use `0` if no salary requirement | `0` |
| 5 | `minimum_account_balance_pkr` | — | Number | Minimum account balance required. Use `0` if none | `0` |
| 6 | `minimum_deposit_pkr` | — | Number | Initial deposit required to get this card | (blank) |
| 7 | `annual_fee_pkr` | ✅ | Number | Annual card fee. Use `0` if free for life | `1800` |
| 8 | `joining_fee_pkr` | — | Number | One-time issuance/joining fee | (blank) |
| 9 | `supplementary_fee_pkr` | — | Number | Annual fee for supplementary/additional cards | (blank) |
| 10 | `annual_fee_waiver_rule` | — | Text | Conditions under which the annual fee is waived | `Spend PKR 150,000 annually` |
| 11 | `minimum_age_years` | — | Number | Minimum age to apply | `18` |
| 12 | `maximum_age_years` | — | Number | Maximum age to apply | (blank) |
| 13 | `income_document_required` | — | Yes/No | Does the applicant need to submit income proof? | `Yes` |
| 14 | `salary_transfer_required` | — | Yes/No | Must salary be transferred to this bank? | `No` |
| 15 | `cnic_required` | — | Yes/No | Is Pakistani CNIC required? | `Yes` |
| 16 | `existing_account_required` | — | Yes/No | Must applicant already hold an account with this bank? | `Yes` |
| 17 | `source_url` | ✅ | Text | Public URL where this information is officially published | `https://www.nbp.com.pk/cards/paypak-classic` |

### JSON Format

If you prefer to send JSON, here is the structure:

```jsonc
{
  "bank_name": "National Bank of Pakistan",
  "bank_slug": "nbp",
  "cards": [
    {
      "card_name": "PayPak Classic",
      "card_type": "debit",
      "tier": "classic",
      "requirements": {
        "minimum_monthly_salary_pkr": 0,
        "minimum_account_balance_pkr": 0,
        "minimum_deposit_pkr": null,
        "annual_fee_pkr": 1800,
        "joining_fee_pkr": null,
        "supplementary_annual_fee_pkr": null,
        "annual_fee_waiver_rule": null,
        "minimum_age_years": 18,
        "maximum_age_years": null,
        "income_document_required": true,
        "salary_transfer_required": false,
        "pakistani_cnic_required": true,
        "existing_account_required": true
      },
      "sources": [
        "https://www.nbp.com.pk/cards/paypak-classic"
      ],
      "confidence": "high",
      "notes": []
    }
  ]
}
```

### Notes

- **Source URLs are required.** We link every requirement to a public source so users can verify the information. Please provide the official bank URL where each card's fees and eligibility are published.
- **Use `0` not blank for "no requirement".** If a card has no minimum salary or balance, write `0` — not blank. Blank means "we don't know yet", `0` means "none required".
- **Balance fields** — Only fill in the balance fields that your bank actually uses. Some banks use "minimum account balance", others use "average monthly balance", others use "relationship balance". Use the terminology that matches your official documentation.
- **Confidence** — Mark `high` if the information is clearly published and unambiguous. Mark `medium` if there's some ambiguity or the information is split across multiple pages. Mark `low` if the values are inferred or uncertain.
- **Fee waiver rules** — Please describe clearly. "Spend PKR 150,000 annually" is better than "subject to conditions".
- **Account-linked cards** — If a debit card is only available with a specific account product (e.g., "Asaan Student Account"), please note this in the `notes` field and provide the account's requirements alongside the card's requirements.

---

## 3. Delivery

Please send the completed spreadsheet or JSON file to the Card Match PK team. We accept:

- `.xlsx` or `.xls` (Excel)
- `.csv` (CSV)
- `.json` (JSON)

Multiple files are fine — you can send offers and requirements separately.

---

## 4. Questions?

If any of these fields don't match how your bank structures card products, please reach out and we'll adjust. The goal is to represent your cards accurately, not to force-fit data into a template.
