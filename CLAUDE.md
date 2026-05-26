# Konsacard — Claude operating notes

## Project layout

- `apps/web` — static site (vanilla JS, deployed via Cloudflare). Card data + algorithms live in `apps/web/assets/algorithms.js`, `apps/web/data/`, `apps/web/scripts/`.
- `apps/mobile` — Expo / React Native app (file-router via `expo-router`). State in `src/store` (Zustand + AsyncStorage), shared algorithms reimplemented in `src/lib/algorithms.ts` mirroring the web.
- Both apps share design tokens conceptually (see `apps/mobile/src/theme/index.ts`, which mirrors `apps/web/assets/styles.css :root`).

## Working style

- **Use subagents to parallelize.** When the user gives multi-part requests, spawn targeted `Agent` calls in parallel rather than running each item sequentially in the main thread. Pick `Explore` for read-only audits and `general-purpose` for implementation. Keep prompts self-contained (file paths, exact changes, surrounding patterns to match).
- Keep mobile features in step with web. When fixing mobile UI, first check the equivalent web view (`apps/web/assets/app.js`) for the canonical layout and labels — the user wants the two surfaces to feel like the same product.
- Don't touch git config or push without explicit ask. Standard commit-message style: plain prose, no Claude trailers/footers, no emojis unless requested.
