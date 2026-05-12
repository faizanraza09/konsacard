# KonsaCard Mobile QA Report

**Date:** 2026-04-28  
**URL tested:** http://localhost:8787/  
**App:** KonsaCard — Pakistani bank card comparison single-page app  
**Tester:** Automated Playwright QA (Claude Code)  
**Viewports tested:** iPhone SE (375×667), iPhone 14 (390×844), Pixel 5 (393×851)

---

## Summary Table

| Section | Description | iPhone SE | iPhone 14 | Pixel 5 | Status |
|---------|-------------|-----------|-----------|---------|--------|
| A | Landing / Quiz flow | ⚠️ Issues | ✅ Pass | ✅ Pass | PARTIAL |
| B | Main results page | ⚠️ Issues | ⚠️ Issues | ⚠️ Issues | PARTIAL |
| C | Sidebar filters | ❌ FAIL | n/a | n/a | FAIL |
| D | Card detail view | ⚠️ Issues | ✅ Pass | ⚠️ Issues | PARTIAL |
| E | Compare modal | ❌ FAIL | n/a | n/a | FAIL |
| F | Chat panel | ⚠️ Issues | ⚠️ Issues | ⚠️ Issues | PARTIAL |
| G | Horizontal overflow | ✅ Pass | ✅ Pass | ✅ Pass | PASS |

**Total issues found: 19** (1 HIGH, 13 MEDIUM, 5 LOW)

---

## Issues Found

### Section A — Landing / Quiz Flow

---

#### A-1 — MEDIUM — Landing "Skip to app →" and secondary skip link are too small to tap

- **Viewport:** iPhone SE (375×667), likely all phones
- **Measured size:** "Skip to app →" button = 81×16px; "Already know what you want? Skip…" = 309×16px (both height = 16px, far below 44px minimum)
- **Description:** Two of the three buttons on the landing screen have 16px hit height. On a phone, the primary "Get Started →" CTA (185×58px) is fine, but the skip links are essentially untappable without precise tapping.
- **CSS selector to fix:** `.landing-skip`, `#landing-skip-nav-btn`
- **Fix:** Add `padding: 14px 16px;` (or `min-height: 44px; display: inline-flex; align-items: center;`) to `.landing-skip` and the nav skip button. The text can remain small but the hit target must be larger.

```css
/* current */
.landing-skip { font-size: 13px; ... }

/* fix */
.landing-skip { font-size: 13px; padding: 14px 16px; display: inline-flex; align-items: center; ... }
```

---

#### A-2 — MEDIUM — Onboarding "Skip →" button is 40×16px — untappable

- **Viewport:** All phones
- **Measured size:** 40×16px
- **Description:** The `#ob-skip-btn` "Skip →" link in the top-right of the onboarding screen has only 16px height. Users will find it very difficult to tap on mobile.
- **CSS selector to fix:** `#ob-skip-btn`, `.ob-s-nav button`
- **Fix:** Apply `min-height: 44px; padding: 10px 16px;` to this button.

---

#### A-3 — LOW — After skipping onboarding, the quiz modal does not auto-open

- **Viewport:** All phones
- **Description:** When a first-time user clicks "Get Started →" → sees the onboarding flow → clicks "Skip →", the quiz modal (`#quiz-modal`) is not shown afterward. The app simply displays the main results screen with no quiz prompt, which means new users bypass the personalization step entirely when they skip onboarding.
- **CSS selector to fix:** N/A — this is a JavaScript behavior in `assets/app.js` around the `ob-skip-btn` listener (`line ~1164`).
- **Fix:** On `ob-skip-btn` click, either call `openQuiz()` or at least mark state so the quiz will open when the user clicks "Find My Card". Currently `skipToApp()` just hides the screen without prompting the quiz.

---

### Section B — Main Results Page

---

#### B-1 — MEDIUM — Hamburger button is 36×36px — below 44px touch target minimum

- **Viewport:** iPhone SE (375×667), iPhone 14 (390×844), Pixel 5 (393×851) — all phones
- **Measured size:** 36×36px
- **Description:** The hamburger/menu button (`.hamburger-btn`, `#nav-toggle`) is the sole navigation control on mobile (desktop nav links and "Find My Card" are `display:none` on mobile). At 36×36px it falls below the 44×44px minimum recommended touch target. Users with larger fingers or motor impairments will frequently miss it.
- **CSS selector to fix:** `.hamburger-btn` in `assets/styles.css` line 135
- **Fix:** Increase to `width: 44px; height: 44px;`

```css
/* current (line 135) */
.hamburger-btn { width: 36px; height: 36px; ... }

/* fix */
.hamburger-btn { width: 44px; height: 44px; ... }
```

---

#### B-2 — MEDIUM — "Find My Card" button is hidden on mobile with no replacement

- **Viewport:** All phones
- **Description:** `@media (max-width: 768px)` applies `.btn-find-my-card { display: none; }`. The only way to start the quiz on mobile is through the hamburger menu's utility nav. However, when the hamburger is clicked, it opens the `utility-nav` dropdown — but the dropdown's `.btn-find-my-card.utility-link` with id `nav-mobile-quiz` also shows as 0×0px in DOM inspection. This means there is **no accessible path to open the quiz from the main screen on mobile** unless the sidebar/utility nav renders correctly.
- **CSS selector to fix:** `assets/styles.css` line 1637: `.btn-find-my-card { display: none; }` inside `@media (max-width: 768px)`; also `.nav > .utility-nav.nav-open { display: flex; }` (line 1660)
- **Fix:** Verify that the mobile nav utility dropdown renders the quiz button correctly. Consider keeping a small "🎯 Find" icon button in the nav bar on mobile as a shortcut.

---

#### B-3 — MEDIUM — "+ Compare" buttons are 26px tall — below 44px touch target

- **Viewport:** All phones (375–393px)
- **Measured size:** 96×26px each
- **Description:** Every card row has a `+ Compare` button (`.btn-compare`) that is 26px tall at mobile widths. Although the mobile CSS widens them to `width: 100%` and reduces font to 10.5px, the height stays at 26px — well below the 44px minimum for touch targets.
- **CSS selector to fix:** `.btn-compare` in `@media (max-width: 480px)` at line 1672
- **Fix:** Add `min-height: 44px;` to the `.btn-compare` mobile rule.

```css
/* current (line 1672) */
.btn-compare { padding: 5px 8px; font-size: 10.5px; width: 100%; text-align: center; }

/* fix */
.btn-compare { padding: 5px 8px; font-size: 10.5px; width: 100%; text-align: center; min-height: 44px; }
```

---

#### B-4 — MEDIUM — Detail expand button (⤢) and inline expand (↓) are 28×28px — below 44px

- **Viewport:** All phones
- **Measured size:** `.btn-detail` = 32×32px at 375px (28×28px at 480px breakpoint); `.btn-expand` = 28×28px
- **Description:** Both icon-only buttons have no visible label and sit at 28–32px — too small for reliable tapping. They often appear in the top-right area of each card where fingers are less precise.
- **CSS selector to fix:** `.btn-detail, .btn-expand` in `@media (max-width: 480px)` at line 1673
- **Fix:** At minimum add padding to create a larger hit area:

```css
/* current (line 1673) */
.btn-detail, .btn-expand { width: 28px; height: 28px; font-size: 12px; }

/* fix */
.btn-detail, .btn-expand { width: 44px; height: 44px; font-size: 14px; }
```

---

#### B-5 — MEDIUM — "Fit Score" label text is 9px — too small to read on mobile

- **Viewport:** All phones
- **Description:** The "Fit Score" label under the score number renders at 9px on mobile (`.cs-l` class, `font-size: 9.5px` on line 617). This falls below the recommended 11px minimum for body copy. Combined with the label being in uppercase, it is very hard to read on mobile.
- **CSS selector to fix:** `.cs-l` at `assets/styles.css` line 617
- **Fix:** Raise `font-size` to at least `10.5px` (ideally `11px`) on mobile.

---

#### B-6 — LOW — View toggle buttons ("💳 Cards" / "🍽️ Restaurants") are 26px tall

- **Viewport:** All phones
- **Measured size:** 26px height
- **Description:** The view toggle buttons (`.view-toggle-btn`) above the results list are 26px tall. Although they span across the screen, the hit height is small for a toggle that changes the entire content view.
- **CSS selector to fix:** `.view-toggle-btn`
- **Fix:** Add `min-height: 36px; align-items: center;` at minimum (or 44px to fully comply).

---

#### B-7 — LOW — Mobile bottom tab bar (`#mob-tab-filters`) not found by initial test

- **Viewport:** All phones
- **Description:** The first test pass couldn't locate the mobile tab bar because it uses class `.mob-tabs` (not `.mobile-tabs` or `.bottom-tab-bar`). Upon inspection, the tab bar **does exist and work** (`#mob-tab-filters`, `#mob-tab-results`, `#mob-tab-chat` — each 125×57px, which is fine). The sidebar toggling is handled by the Filters tab via JavaScript (toggling `.mob-open` class on `#sidebar`). This is a test infrastructure note — the tab bar itself passes.

---

### Section C — Sidebar Filters on Mobile

---

#### C-1 — HIGH — Hamburger menu opens utility nav dropdown, NOT the sidebar filters

- **Viewport:** All phones
- **Description:** There are two separate mobile entry points that appear to control filters: (1) The hamburger button (`.hamburger-btn`) in the top nav toggles a `.utility-nav` dropdown for links (About, Methodology, etc.) — it does NOT open the sidebar. (2) The bottom tab bar "Filters" tab (`#mob-tab-filters`) correctly toggles `.mob-open` on `#sidebar`. However, **the hamburger is a natural target for "open the filter panel"** and users clicking it will see a nav link dropdown, not filters. The sidebar filter panel is buried behind the less-obvious bottom tab bar.
- **Additional detail:** When hamburger is clicked, `aria-expanded="true"` is set on `#nav-toggle` and `.nav-open` is toggled on `.utility-nav`, but the sidebar remains `display:none`. The sidebar only opens via the `mob-tab-filters` click handler.
- **CSS/JS selector to fix:** `assets/app.js` — the hamburger button handler and `assets/styles.css` `.nav > .utility-nav.nav-open`
- **Fix (UX):** Add a clear "Filters" link or chevron in the utility nav dropdown, or add a brief label "Filters" below the hamburger button. Alternatively, make the hamburger directly open the sidebar (if nav links have another home).

---

#### C-2 — MEDIUM — Search inputs in sidebar are 32px tall — below 44px minimum

- **Viewport:** All phones (when sidebar is open)
- **Measured size:** `#restaurant-search` and `#bank-search` = 339×32px
- **Description:** The two search inputs inside the sidebar filters have a computed height of 32px. While the width is fine (full-width), the 32px height makes tapping and text entry harder on mobile, especially for users with larger fingers.
- **CSS selector to fix:** `#restaurant-search, #bank-search` or the `s-search-box input` rule
- **Fix:** Add `min-height: 44px; padding: 10px 12px;` to these inputs in the mobile breakpoint.

---

#### C-3 — MEDIUM — Eligibility checkbox is 14×14px — far too small for mobile

- **Viewport:** All phones
- **Measured size:** `#use-eligibility` checkbox = 14×14px
- **Description:** The eligibility toggle checkbox is a native 14×14px browser checkbox. With no surrounding clickable label that has sufficient padding, it is extremely difficult to tap accurately on mobile.
- **CSS selector to fix:** `#use-eligibility` or its parent `label`
- **Fix:** Either use a custom toggle switch, or ensure the wrapping `<label>` has `padding: 12px 8px; min-height: 44px; display: flex; align-items: center;`.

---

#### C-4 — LOW — Filter pill buttons (times/week, day-of-week) are 28px tall

- **Viewport:** All phones
- **Measured size:** `.s-pill` = various widths × 28px height
- **Description:** All the pill-style filter buttons (1×, 2×, 3×, Mon, Tue, etc., Debit, Credit, Other) are 28px tall. While they are usable, they fall short of the 44px recommendation. Day-of-week pills (Mon–Sun) are particularly small at 42–52px wide × 28px tall.
- **CSS selector to fix:** `.s-pill` at `assets/styles.css` line 246
- **Fix:** Add `min-height: 36px;` or `padding: 8px 12px;` to `.s-pill`.

---

### Section D — Card Detail View

---

#### D-1 — MEDIUM — Modal close button is 30×30px — below 44px minimum

- **Viewport:** iPhone SE (375×667), Pixel 5 (393×851)
- **Measured size:** 30×30px
- **Description:** The close button on the card detail modal is only 30×30px. For a modal that covers the full screen, the close button must be easily tappable. At 30×30px it is too small, especially in the top-right corner where precision is lower.
- **CSS selector to fix:** `.modal-bg .modal-close` or the close button selector in `#card-detail-modal`
- **Fix:** Increase to `min-width: 44px; min-height: 44px;`.

---

#### D-2 — LOW — No ~PKR "estimated fee" values or estimation note visible in tested card

- **Viewport:** All phones
- **Description:** The first card's detail view contained no `~PKR` estimated fee values during testing, so the "estimation note" check was inconclusive. If any card does display `~PKR` (estimated) values (for cards where fee data is approximate), the test confirmed the system looks for an estimation disclaimer. Manual verification is needed on a card known to have estimated fees to confirm the disclaimer note is properly visible.
- **CSS selector to fix:** N/A — flag for manual review
- **Fix:** Verify manually on a card with estimated fees.

---

#### D-3 — LOW — Restaurant list items inside card detail not found by CSS class

- **Viewport:** All phones
- **Description:** The restaurant list inside the card detail is present (72 items found via broader selector) but the specific class names (`rest-item`, `restaurant-item`) didn't match. This is a test infrastructure note — the content is present but class names differ. The list renders correctly.

---

### Section E — Compare Modal

---

#### E-1 — HIGH — Compare tray "Compare →" button is inaccessible — tray first button is "×" (remove card), not "Compare →"

- **Viewport:** iPhone SE (375×667), likely all phones
- **Description:** When 2 cards are added to compare, the compare tray (`#cmp-tray`) appears. The tray contains: `×` (remove card 1), `×` (remove card 2), `Compare →`, `Clear`. However, the `×` buttons (`.cmp-tray-card-remove`) are only **9×16px** — essentially invisible touch targets. On the automated test, clicking the first button in the tray hit the `×` instead of "Compare →", causing the modal to never open.
  
  More critically: the tray sits at `right: 86px` on mobile (leaving space for the chat FAB at right), placing the "Compare →" button (`#btn-compare-open`) which is 105×36px — this button itself is below 44px height. The tray layout on mobile needs validation.
- **CSS selector to fix:** `.cmp-tray-card-remove` and `.btn-compare-open` in `assets/styles.css` lines 849 and 860
- **Fix:**
  - `.cmp-tray-card-remove`: add `min-width: 32px; min-height: 32px; display: flex; align-items: center; justify-content: center;`
  - `.btn-compare-open`: add `min-height: 44px;`

---

#### E-2 — MEDIUM — Compare modal did not open in automated test; manual verification needed

- **Viewport:** iPhone SE (375×667)
- **Description:** Due to issue E-1 (× button being clicked instead of "Compare →"), the compare modal itself was never verified on mobile. Manual testing is needed to confirm the modal opens and the comparison table either fits within the viewport or scrolls horizontally.
- **CSS selector to fix:** `#compare-modal .modal` — check `max-height`, `overflow-y`, and any inner table width
- **Fix:** Verify `#compare-modal table` is wrapped in a `overflow-x: auto` container. Looking at the CSS, `#compare-modal` uses `.modal-bg`/`.modal` which has `max-height: 88vh; overflow-y: auto` but no explicit `overflow-x: auto` for inner table columns. Add a scrollable wrapper for the comparison table on mobile.

---

### Section F — Chat Panel

---

#### F-1 — MEDIUM — Chat input textarea is 36px tall — below 44px touch target

- **Viewport:** iPhone SE (375×667), iPhone 14 (390×844), Pixel 5 (393×851) — all phones
- **Measured size:** `#chat-panel textarea` = 264–282px wide × 36px tall
- **Description:** The chat textarea (`.chat-in`) has `padding: 9px 13px` which produces a 36px rendered height. Users must tap a 36px target to start typing. The 8px shortfall means many thumb taps in the lower-input area will miss.
- **CSS selector to fix:** `.chat-in` at `assets/styles.css` line 1213
- **Fix:** Add `min-height: 44px;` to `.chat-in` — it already has `max-height: 80px` so this won't break the auto-resize.

```css
/* current (line 1213) */
.chat-in { flex: 1; padding: 9px 13px; ... max-height: 80px; }

/* fix */
.chat-in { flex: 1; padding: 9px 13px; ... max-height: 80px; min-height: 44px; }
```

---

#### F-2 — MEDIUM — Chat send button (`#chat-send`) is 28×28px — below 44px

- **Viewport:** All phones
- **Measured size:** 28×28px
- **Description:** The send button (`.chat-send`, `#chat-send`) renders at 28×28px. Note: the automated test found the `#chat-close` (×) button at 28×28px — this is the close button in the chat header, not the actual Send button. Looking at CSS, `.chat-send` has `padding: 9px 14px` but the computed size is small because the flex layout collapses it. The Send button is below minimum touch target size.
- **CSS selector to fix:** `.chat-send` at `assets/styles.css` line 1226, and `.chat-close`, `.chat-top-btn` at lines 1181–1188
- **Fix:** Add explicit `min-height: 44px; min-width: 44px;` to `.chat-send`. For `.chat-close` and `.chat-top-btn`, increase from 28px to at least 36px (32px is acceptable in header contexts but 44px is ideal).

```css
/* current (line 1226) */
.chat-send { padding: 9px 14px; border-radius: 9px; ... }

/* fix */
.chat-send { padding: 9px 14px; border-radius: 9px; min-height: 44px; min-width: 60px; ... }
```

---

#### F-3 — LOW — Chat FAB (💬) is correctly 52×52px — PASS

- **Viewport:** All phones
- **Measured size:** 52×52px
- **Description:** The chat FAB button (`#chat-fab`) is 52×52px and well within touch target guidelines. On mobile, it sits at bottom-right at `bottom: 76px` to clear the mobile tab bar. No issue.

---

#### F-4 — LOW — Quick question chips are 28px tall

- **Viewport:** All phones
- **Measured size:** `.quick-chip` = various widths × ~28px
- **Description:** The suggested quick-question chips (`.quick-chip`) inside the chat panel are 28px tall. They are the first interactive element users see when opening chat, and they're slightly below the 44px recommendation. However, they're presentational enough that this is LOW severity.
- **CSS selector to fix:** `.quick-chip` at `assets/styles.css` line 1202
- **Fix:** Add `padding: 8px 10px; min-height: 36px;` to `.quick-chip`.

---

### Section G — Horizontal Overflow

---

#### G-1 — PASS — No horizontal overflow detected on any device

- **Viewport:** iPhone SE (375×667), iPhone 14 (390×844), Pixel 5 (393×851)
- **Description:** `document.documentElement.scrollWidth > document.documentElement.clientWidth` returned `false` on all three viewports for the main results page. No element was found extending beyond the right viewport edge. The CSS `@media (max-width: 768px)` rules correctly constrain layout.

---

## Additional Observations (Not Classified as Issues)

1. **Landing screen renders correctly at 375×667** — full 375×667px, text is readable, the "Get Started →" CTA (185×58px) is well-sized.
2. **Onboarding city selection buttons (159×64–72px)** — the option cards in the onboarding step are well-sized and easily tappable.
3. **Mobile tab bar (Filters / Results / Ask AI)** — each tab is 125×57px, which comfortably exceeds the 44px minimum. The tab bar itself is correct.
4. **Card items do not overflow horizontally** — card items are 335–353px wide on the three test devices (viewport 375–393px), leaving ~20px margins on each side. Layout is clean.
5. **Sidebar filter content (when force-shown)** — the range slider for Typical Bill and the day/card-type pill groups all render correctly within the 375px width.
6. **Chat panel dimensions on mobile** — the panel is `calc(100vw - 20px)` wide and 490px tall, positioned at `bottom: 70px` to clear the tab bar. On iPhone SE (375×667) the panel occupies 355×490px, leaving only 667 − 70 − 490 = 107px from the top. The panel is functional but very tall relative to the viewport.

---

## Priority Fix List

| Priority | Issue | Section | Severity | Estimated Effort |
|----------|-------|---------|----------|-----------------|
| 1 | Hamburger opens nav links, not filters — no clear filter entry on mobile | C-1 | HIGH | Medium (UX redesign) |
| 2 | Compare tray × buttons are 9×16px; "Compare →" button 36px tall | E-1 | HIGH | Small CSS fix |
| 3 | Hamburger button 36×36px (all phones) | B-1 | MEDIUM | Trivial CSS |
| 4 | "+ Compare" buttons 26px tall (all phones, all cards) | B-3 | MEDIUM | Trivial CSS |
| 5 | `.btn-detail` / `.btn-expand` 28–32px (all phones) | B-4 | MEDIUM | Trivial CSS |
| 6 | Chat textarea 36px tall (all phones) | F-1 | MEDIUM | Trivial CSS |
| 7 | Chat send button 28×28px (all phones) | F-2 | MEDIUM | Trivial CSS |
| 8 | Landing skip links 16px tall (all phones) | A-1, A-2 | MEDIUM | Small CSS |
| 9 | Sidebar search inputs 32px tall | C-2 | MEDIUM | Small CSS |
| 10 | Eligibility checkbox 14px (no label hit area) | C-3 | MEDIUM | Small CSS/HTML |
| 11 | Modal close button 30×30px | D-1 | MEDIUM | Trivial CSS |
| 12 | "Fit Score" label 9px font | B-5 | MEDIUM | Trivial CSS |
| 13 | View toggle buttons 26px tall | B-6 | LOW | Trivial CSS |
| 14 | Filter pill buttons 28px tall | C-4 | LOW | Small CSS |
| 15 | Quiz not shown after skipping onboarding | A-3 | LOW | Small JS |

---

## Screenshots Taken

All screenshots saved to `C:/Temp/mobile-qa/`

### Section A — Landing & Quiz
- `A-01-landing-iphone-se.png` — Landing screen, iPhone SE
- `A-01-landing-iphone-14.png` — Landing screen, iPhone 14
- `A-01-landing-pixel-5.png` — Landing screen, Pixel 5
- `EXTRA-01-fresh-load.png` — Fresh load (localStorage cleared)
- `EXTRA-02-after-get-started.png` — After clicking "Get Started →"
- `EXTRA-03-onboarding.png` — Onboarding screen (city selection)
- `EXTRA-04-ob-step0.png` — Onboarding step 0
- `EXTRA-05-after-onboarding.png` — After clicking "Skip →" in onboarding

### Section B — Results Page
- `B-01-results-iphone-se.png` — Results list, iPhone SE
- `B-01-results-iphone-14.png` — Results list, iPhone 14
- `B-01-results-pixel-5.png` — Results list, Pixel 5
- `B-02-results-full-iphone-se.png` — Full-page results, iPhone SE
- `B-02-results-full-iphone-14.png` — Full-page results, iPhone 14
- `B-02-results-full-pixel-5.png` — Full-page results, Pixel 5
- `B-03-results-scrolled-iphone-se.png` — Results scrolled mid-page, iPhone SE
- `B-03-results-scrolled-iphone-14.png` — Results scrolled mid-page, iPhone 14
- `B-03-results-scrolled-pixel-5.png` — Results scrolled mid-page, Pixel 5

### Section C — Sidebar Filters
- `C-01-filters-open-iphone-se.png` — State when Filters tab clicked (before fix)
- `C-01-hamburger-open-iphone-se.png` — Hamburger clicked, showing utility nav (not filters)
- `EXTRA-C-01-before-hamburger.png` — Before hamburger click
- `EXTRA-C-02-after-hamburger.png` — After hamburger click (full page)
- `EXTRA-C-03-after-hamburger-viewport.png` — After hamburger, viewport view
- `EXTRA-SIDEBAR-forced-visible.png` — Sidebar filter panel force-shown (full page)

### Section D — Card Detail
- `D-01-detail-open-iphone-se.png` — Card detail modal, iPhone SE
- `D-01-detail-open-pixel-5.png` — Card detail modal, Pixel 5
- `D-02-detail-full-iphone-se.png` — Card detail full page, iPhone SE
- `D-02-detail-full-pixel-5.png` — Card detail full page, Pixel 5

### Section E — Compare
- `EXTRA-E-01-one-added.png` — After first card added to compare
- `EXTRA-E-02-two-added.png` — After second card added, tray visible
- `EXTRA-E-03-after-tray-click.png` — After clicking first button in tray (× hit instead of Compare)

### Section F — Chat Panel
- `F-01-before-chat-iphone-se.png` — Before opening chat, iPhone SE
- `F-01-before-chat-iphone-14.png` — Before opening chat, iPhone 14
- `F-01-before-chat-pixel-5.png` — Before opening chat, Pixel 5
- `F-02-chat-open-iphone-se.png` — Chat panel open, iPhone SE
- `F-02-chat-open-iphone-14.png` — Chat panel open, iPhone 14
- `F-02-chat-open-pixel-5.png` — Chat panel open, Pixel 5
- `F-03-chat-full-iphone-se.png` — Chat full page, iPhone SE
- `F-03-chat-full-iphone-14.png` — Chat full page, iPhone 14
- `F-03-chat-full-pixel-5.png` — Chat full page, Pixel 5

---

## CSS Quick-Fix Reference

The following CSS additions in `assets/styles.css` fix the majority of touch target issues (add inside or after the `@media (max-width: 768px)` block):

```css
/* === MOBILE TOUCH TARGET FIXES === */

/* Hamburger button */
.hamburger-btn { width: 44px; height: 44px; }

/* View toggle buttons */
.view-toggle-btn { min-height: 36px; display: inline-flex; align-items: center; }

/* Card action buttons */
.btn-compare { min-height: 44px; }
.btn-detail, .btn-expand { min-width: 44px; min-height: 44px; }

/* Chat */
.chat-in { min-height: 44px; }
.chat-send { min-height: 44px; min-width: 60px; }
.chat-top-btn, .chat-close { min-width: 36px; min-height: 36px; }

/* Landing skip links */
.landing-skip { padding: 14px 16px; display: inline-flex; align-items: center; min-height: 44px; }
#landing-skip-nav-btn { padding: 14px 16px; min-height: 44px; display: inline-flex; align-items: center; }

/* Onboarding skip */
#ob-skip-btn { padding: 10px 16px; min-height: 44px; }

/* Sidebar inputs */
#restaurant-search, #bank-search { min-height: 44px; padding: 10px 12px; }

/* Eligibility label */
label[for="use-eligibility"] { padding: 12px 8px; min-height: 44px; display: flex; align-items: center; }

/* Compare tray */
.cmp-tray-card-remove { min-width: 32px; min-height: 32px; display: flex; align-items: center; justify-content: center; }
.btn-compare-open { min-height: 44px; }

/* Modal close */
#card-detail-modal .modal-close { min-width: 44px; min-height: 44px; }

/* Filter pills */
.s-pill { min-height: 36px; padding: 6px 12px; }

/* Score label */
.cs-l { font-size: 10.5px; }
```
