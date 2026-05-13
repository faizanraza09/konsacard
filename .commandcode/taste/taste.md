# Taste (Continuously Learned by [CommandCode][cmd])

[cmd]: https://commandcode.ai/


# data-processing
- Do not infer card eligibility from unlabeled tier/classification columns in bank workbooks. When column meaning is undocumented, assign all bank cards to all offers equally (default assumption: every card gets every discount). Confidence: 0.70

# content-style
- On the methodology page, keep content user-facing — explain how ranking works for visitors, avoid internal implementation details like specific data pipelines, APIs, scraping methods, or normalization processes. Confidence: 0.70

# ui
- Pagination must show exactly 10 result cards per page uniformly across all pages, including page 1 (the featured #1 card counts as one of the 10, not an extra). Confidence: 0.85
- Use "Learn" as the dropdown label for grouping secondary informational pages (About, Methodology, guides). Confidence: 0.65
- The dropdown arrow/indicator on the "Learn" nav trigger should be clearly visible, not subtle — when user questions visibility, make it more prominent. Confidence: 0.55
- Long offer descriptions should be hidden behind an interaction (collapsible, tooltip, or expandable) rather than displayed as full inline text — inline text is too hard to read. Confidence: 0.65
- The offer detail toggle (text + arrow) should appear on its own line, not crammed inline/side-by-side with other meta text like city, days, or cap. Confidence: 0.70
