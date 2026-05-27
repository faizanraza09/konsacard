// @ts-check
/**
 * Build-output consistency tests.
 *
 * These catch the class of regressions where the build script produces
 * output that's superficially valid but internally inconsistent — the
 * kind of bug that ships to production silently because no smoke test
 * triggers a visible failure.
 *
 * Specifically guards against:
 *  - Unstamped __BUILD_VERSION__ placeholder shipping to prod (would
 *    make every asset URL 404 with a literal "__BUILD_VERSION__" hash).
 *  - HTML ?v= hash drifting away from sw.js SHELL_VERSION, which makes
 *    the SW pre-cache different URLs than HTML requests → duplicate
 *    network fetches every page load.
 *  - <script>/<link> tags that forgot the ?v= query string, which
 *    means they're stuck on browser HTTP cache TTL with no cache-bust.
 */
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const INDEX_PATH = path.join(ROOT, 'index.html');
const SW_PATH = path.join(ROOT, 'sw.js');

test.describe('Build output consistency', () => {
  test('index.html has no unstamped __BUILD_VERSION__ placeholder', () => {
    const html = fs.readFileSync(INDEX_PATH, 'utf-8');
    expect(html, 'unstamped placeholder leaked to a built file — run `npm run build`').not.toContain('__BUILD_VERSION__');
  });

  test('every /assets/ script & stylesheet in index.html has a ?v= cache-bust', () => {
    const html = fs.readFileSync(INDEX_PATH, 'utf-8');
    const refs = [
      ...html.matchAll(/<script[^>]+src="(\.\/assets\/[^"]+\.js)([^"]*)"/g),
      ...html.matchAll(/<link[^>]+href="(\.\/assets\/[^"]+\.css)([^"]*)"/g),
    ];
    expect(refs.length, 'no /assets/ JS/CSS references found — selector drift?').toBeGreaterThan(3);
    for (const m of refs) {
      const [, url, query] = m;
      expect(query, `${url} is missing a ?v= cache-bust — long browser cache will hide deploys`).toMatch(/^\?v=[a-f0-9]{8,16}$/);
    }
  });

  test('all asset ?v= hashes in index.html are identical', () => {
    const html = fs.readFileSync(INDEX_PATH, 'utf-8');
    const hashes = [...html.matchAll(/\?v=([a-f0-9]{8,16})/g)].map((m) => m[1]);
    const unique = new Set(hashes);
    expect(unique.size, `multiple distinct ?v= hashes (${[...unique].join(', ')}) — partial stamp run?`).toBe(1);
  });

  test('sw.js SHELL_VERSION matches index.html ?v= hash', () => {
    const html = fs.readFileSync(INDEX_PATH, 'utf-8');
    const sw = fs.readFileSync(SW_PATH, 'utf-8');
    const htmlHash = html.match(/\?v=([a-f0-9]{8,16})/)?.[1];
    const swHash = sw.match(/const SHELL_VERSION = "([^"]+)"/)?.[1];
    expect(htmlHash, 'no ?v= hash in index.html').toBeTruthy();
    expect(swHash, 'no SHELL_VERSION literal in sw.js').toBeTruthy();
    // In local dev (no build run), sw.js may still hold the previous
    // build's hash while HTML stayed at the source placeholder — but if
    // HTML IS stamped (matches /[a-f0-9]+/), they must be in sync.
    expect(swHash, 'sw.js SHELL_VERSION drift from HTML — SW would pre-cache wrong URLs').toBe(htmlHash);
  });

  test('sw.js SHELL_URLS use the SHELL_VERSION template — no bare /assets/X.js entries', () => {
    const sw = fs.readFileSync(SW_PATH, 'utf-8');
    // Find the SHELL_URLS array literal.
    const arr = sw.match(/const SHELL_URLS = \[([\s\S]*?)\];/)?.[1];
    expect(arr, 'SHELL_URLS not found in sw.js').toBeTruthy();
    // Every /assets/*.js or *.css entry should reference SHELL_VERSION.
    // The icon/SVG/PNG entries are content-stable so they're allowed to be bare.
    const lines = arr.split('\n').filter((l) => /\/assets\/.*\.(?:js|css)/.test(l));
    expect(lines.length, 'no JS/CSS entries in SHELL_URLS — list shrank unexpectedly').toBeGreaterThan(3);
    for (const line of lines) {
      expect(line, `SHELL_URLS entry "${line.trim()}" missing SHELL_VERSION — SW would pre-cache the wrong URL`).toContain('SHELL_VERSION');
    }
  });
});
