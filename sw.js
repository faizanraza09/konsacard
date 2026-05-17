// @ts-nocheck
/**
 * Service worker for KonsaCard.
 *
 * Strategy:
 *  - App shell (HTML, CSS, JS, logos): cache-first, fall back to network.
 *    Versioned by SHELL_VERSION; bump to invalidate after a deploy.
 *  - Data JSON (offers, requirements): stale-while-revalidate. We return the
 *    cached copy immediately for snappy first paint, then fetch a fresh copy
 *    in the background so the next reload sees the latest data.
 *  - Everything else: network-first.
 *
 * This is intentionally minimal — no fancy precaching, no Workbox dependency.
 * If anything goes wrong with the SW it should "fail open" to the network so
 * users always see fresh content.
 */

const SHELL_VERSION = "v1";
const SHELL_CACHE = `konsa-shell-${SHELL_VERSION}`;
const DATA_CACHE  = `konsa-data-${SHELL_VERSION}`;

// Pre-cache the app shell on install. Keep this list tight — anything missing
// would block the SW install.
const SHELL_URLS = [
  "/",
  "/assets/styles.css",
  "/assets/algorithms.js",
  "/assets/chat.js",
  "/assets/app.js",
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
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== DATA_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
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
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }
  // Everything else (generated /banks/* and /restaurants/* pages, etc.)
  // — let it pass through to network normally.
});

self.addEventListener("message", (event) => {
  // Allow the page to ask us to skip waiting after a new SW is installed.
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
