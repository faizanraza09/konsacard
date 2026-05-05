# Card Requirements Research Tooling

This repo now has a dedicated fallback chain for collecting official bank-card requirement evidence from webpages and PDFs.

## Installed / expected libraries

Research dependencies are listed in:

- `requirements-card-research.txt`

The intended stack is:

- `requests` for source fetching
- `beautifulsoup4` + `lxml` for HTML parsing
- `pypdf`, `pdfplumber`, and `PyMuPDF` for redundant PDF text extraction
- `Pillow` for image compatibility
- `playwright` for browser capture when a source is JS-heavy or links are hidden behind rendered DOM

## Extraction workflow

### 1. Start with the official webpage

Use:

```powershell
python scripts/card_requirements/extract_source_artifacts.py --url "<official-url>" --bank-slug "<bank-slug>" --label "<label>"
```

If the URL is HTML, the script saves:

- raw HTML
- extracted page text
- interesting official links
- a manifest JSON

### 2. Follow likely evidence docs

Do not stop at the first product page. Look for:

- schedule of charges / SOC
- key fact sheet / KFS
- summary box
- account opening forms
- debit/credit card FAQs
- digital account documents

### 2b. Always check linked-account eligibility

For debit and premium segment cards, card eligibility is often inherited from an
underlying account or relationship program.

When salary/balance fields are missing on the card page, explicitly search for:

- linked current/savings account pages
- premium / priority / prestige / premier program pages
- account KFS / SOC / fee schedules
- account-opening and eligibility documents

If official sources clearly state that the card is only issued through a linked
account or segment, carry those account thresholds into the card requirements
record and note that the value is account-linked.

### 3. If the source is a PDF

The extractor automatically:

- downloads the PDF
- extracts text with `pypdf`
- extracts text with `pdfplumber`
- extracts text with `PyMuPDF`
- keeps all three outputs
- renders page screenshots when visual review is still needed

This is deliberate. Bank PDFs often fail in one parser and work in another.

### 4. If the webpage is JS-heavy or hides links

Use:

```powershell
node scripts/card_requirements/capture_web_source.js --url "<official-url>" --bankSlug "<bank-slug>" --label "<label>"
```

That captures:

- full-page screenshot
- discovered DOM links with PDF / SOC / fee keywords

### 5. If PDF text extraction is weak

Use the rendered screenshots under:

- `data/card-requirements/artifacts/<bank-slug>/<label>/screenshots/`

Those images are meant for manual or agent-assisted visual review.

## Research posture

Do not give up after one failed source.

If a product page is thin, keep going through:

- SOC PDFs
- KFS / summary box PDFs
- FAQ PDFs
- terms and conditions PDFs
- account-opening PDFs
- bank document libraries

The goal is not just to scrape text. The goal is to exhaust the official evidence chain before concluding a value is missing.

For account-linked cards, treat "missing on card page" as incomplete research
until linked-account and segment pages are checked.
