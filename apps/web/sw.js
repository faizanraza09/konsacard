// @ts-nocheck
/**
 * Service worker for KonsaCard.
 *
 * Strategy:
 *  - App shell (HTML, CSS, JS, logos): stale-while-revalidate. Returns the
 *    cached copy immediately for instant paint, then fetches in the
 *    background so the next reload always sees the latest. (Previously
 *    cache-first, which made Cmd+R show the old shell forever and forced
 *    users into Cmd+Shift+R.)
 *  - Data JSON (offers, requirements): stale-while-revalidate, same idea.
 *  - Everything else: network-first.
 *
 * SHELL_VERSION is replaced at build time with the build timestamp
 * (see scripts/seo/generate_seo_pages.py). Each deploy ships a new
 * sw.js byte-for-byte, which triggers `install` → re-primes the new
 * cache name and `activate` → deletes the old caches.
 */

// SHELL_VERSION is replaced at build time by scripts/seo/generate_seo_pages.py
// with the build epoch (e.g. "1748293340"). If it stays literal "0260526T204215"
// in local dev, that's fine — the SW still works, it just doesn't auto-invalidate
// across local edits (you can unregister it from DevTools if needed).
const SHELL_VERSION = "4d4b0caa0c9a";
const SHELL_CACHE = `konsa-shell-${SHELL_VERSION}`;
const DATA_CACHE  = `konsa-data-${SHELL_VERSION}`;

// Pre-cache the app shell on install. Keep this list tight — anything missing
// would block the SW install.
// Versioned bundles use ?v= query strings substituted at build time so they
// match exactly what HTML <script>/<link> tags request — otherwise the SW
// would pre-cache /assets/chat.js (no version) while HTML asks for
// /assets/chat.js?v=abc, causing a duplicate network fetch every page load.
const SHELL_URLS = [
  "/",
  `/assets/dist/styles.css?v=${SHELL_VERSION}`,
  `/assets/dist/state.js?v=${SHELL_VERSION}`,
  `/assets/dist/algorithms.js?v=${SHELL_VERSION}`,
  `/assets/dist/chat.js?v=${SHELL_VERSION}`,
  `/assets/dist/quiz.js?v=${SHELL_VERSION}`,
  `/assets/dist/app.js?v=${SHELL_VERSION}`,
  "/assets/logo/favicon.svg",
  "/assets/logo/mark-32.png",
  "/assets/logo/mark-64.png",
  "/assets/logo/apple-touch-icon.png",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      // Use addAll with individual failure tolerance so one missing asset
      // (e.g. an icon we renamed) doesn't break SW install on next deploy.
      Promise.allSettled(SHELL_URLS.map((url) => cache.add(url).catch(() => null)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== SHELL_CACHE && k !== DATA_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
      .then(async () => {
        // A genuinely new SW version just activated. Reload every controlled
        // tab so the user instantly sees the new shell instead of having to
        // hit Cmd+R themselves. Guarded by the registration's `installing`
        // history — we only reload if there was a prior controller (i.e. an
        // older SW handed control over to us), so first-time visitors don't
        // see a surprise reload during their initial load.
        const clientsList = await self.clients.matchAll({ type: "window" });
        for (const client of clientsList) {
          // `client.navigate(client.url)` is the right primitive but isn't
          // supported in WebKit; postMessage lets the page decide.
          client.postMessage({ type: "SW_ACTIVATED", version: SHELL_VERSION });
        }
      })
  );
});

function isDataRequest(url) {
  return url.pathname.startsWith("/data/");
}

function isShellRequest(url) {
  if (url.pathname === "/" || url.pathname === "/index.html") return true;
  if (url.pathname.startsWith("/assets/")) return true;
  if (url.pathname === "/manifest.webmanifest") return true;
  return false;
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok && fresh.type === "basic") {
      cache.put(request, fresh.clone()).catch(() => {});
    }
    return fresh;
  } catch (err) {
    return cached || Response.error();
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkFetch = fetch(request).then((res) => {
    if (res && res.ok && res.type === "basic") {
      cache.put(request, res.clone()).catch(() => {});
    }
    return res;
  }).catch(() => null);
  // Return cached if we have it; in the background, revalidate
  return cached || networkFetch || fetch(request);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Don't try to cache cross-origin requests (Sentry, fonts, ads, etc.)
  if (url.origin !== self.location.origin) return;

  if (isDataRequest(url)) {
    event.respondWith(staleWhileRevalidate(request, DATA_CACHE));
    return;
  }
  if (isShellRequest(url)) {
    // SWR for shell too — cache-first was making Cmd+R serve the stale shell
    // forever after a deploy, since `install` only re-primes when sw.js bytes
    // change. SWR returns the cached shell for instant paint and updates the
    // cache in the background, so the next reload picks up the new build.
    event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
    return;
  }
  // Everything else (generated /banks/* and /restaurants/* pages, etc.)
  // — let it pass through to network normally.
});

self.addEventListener("message", (event) => {
  // Allow the page to ask us to skip waiting after a new SW is installed.
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
