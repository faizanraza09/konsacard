# Taste (Continuously Learned by [CommandCode][cmd])

[cmd]: https://commandcode.ai/

# data-processing
- Do not infer card eligibility from unlabeled tier/classification columns in bank workbooks. When column meaning is undocumented, assign all bank cards to all offers equally (default assumption: every card gets every discount). Confidence: 0.70

# content-style
- On the methodology page, keep content user-facing — explain how ranking works for visitors, avoid internal implementation details like specific data pipelines, APIs, scraping methods, or normalization processes. Confidence: 0.70

# ui
- Pagination must show exactly 10 result cards per page uniformly across all pages, including page 1 (the featured #1 card counts as one of the 10, not an extra). Confidence: 0.85
