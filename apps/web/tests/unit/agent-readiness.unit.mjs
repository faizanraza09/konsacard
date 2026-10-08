// Agent-readiness behaviour: homepage Markdown negotiation, the /privacy
// redirect, the Organization JSON-LD and the llms.txt guidance.
// Run: npm run test:unit
import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildHomepageMarkdown, prefersMarkdown, withVaryAccept } from "../../lib/markdown-negotiation.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

/* ── Accept parsing ── */

test("prefersMarkdown: markdown only when it is the preferred acceptable type", () => {
  const yes = ["text/markdown", "text/markdown, text/html;q=0.8", "text/markdown, text/html", "TEXT/Markdown;q=0.9, text/html;q=0.5"];
  const no = [
    undefined,
    "",
    "text/html",
    "*/*",
    "text/*",
    "text/html, */*;q=0.8",
    "text/html, text/markdown;q=0.5",
    "text/html, text/markdown",
    "text/markdown;q=0",
    "application/json",
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8", // a real browser
  ];
  for (const a of yes) assert.equal(prefersMarkdown(a), true, `should prefer markdown: ${a}`);
  for (const a of no) assert.equal(prefersMarkdown(a), false, `should NOT prefer markdown: ${a}`);
});

test("withVaryAccept adds Accept without clobbering or duplicating Vary", () => {
  const vary = (h) => withVaryAccept(new Response("x", { headers: h })).headers.get("Vary");
  assert.equal(vary({}), "Accept");
  assert.equal(vary({ Vary: "Accept-Encoding" }), "Accept-Encoding, Accept");
  assert.equal(vary({ Vary: "Accept" }), "Accept");
  assert.equal(vary({ Vary: "*" }), "*");
  // "Accept-Encoding" alone must not be mistaken for "Accept".
  assert.match(vary({ Vary: "Accept-Language" }), /Accept$/);
});

test("buildHomepageMarkdown is useful with and without ranking data", () => {
  const empty = buildHomepageMarkdown({});
  assert.match(empty, /^# /);
  assert.match(empty, /https:\/\/konsacard\.pk\/contact\//);
  assert.ok(empty.length > 500);
  const withRank = buildHomepageMarkdown({
    ranked: [{ bank: "HBL", card: "Platinum", bankSlug: "hbl", cardSlug: "platinum", avgExpectedSaving: 1234, coverage: 0.5, averageDiscount: 20, medianCap: 1500 }],
    scopeLabel: "Karachi",
    orderValue: 10000,
  });
  assert.match(withRank, /## Top restaurant discount cards in Karachi/);
  assert.match(withRank, /\[HBL: Platinum\]\(https:\/\/konsacard\.pk\/banks\/hbl\/platinum\/\)/);
  assert.match(withRank, /PKR 10,000/);
});

/* ── middleware, bundled and run against the real static files ── */

async function loadMiddleware() {
  const out = await build({
    entryPoints: [path.join(root, "functions/_middleware.js")],
    bundle: true,
    format: "esm",
    write: false,
    platform: "neutral",
    logLevel: "silent",
  });
  return import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString("base64")}`);
}

const assets = (overrides = {}) => ({
  async fetch(req) {
    const p = new URL(req.url).pathname;
    if (p in overrides) return overrides[p];
    const file = p === "/index.html" ? "index.html" : p.replace(/^\//, "");
    try {
      const body = fs.readFileSync(path.join(root, file));
      return new Response(body, { status: 200 });
    } catch {
      return new Response("not found", { status: 404 });
    }
  },
});

async function hit(onRequest, { url = "https://konsacard.pk/", method = "GET", accept, env = { ASSETS: assets() } } = {}) {
  const request = new Request(url, { method, headers: accept ? { Accept: accept } : {} });
  let nextCalled = false;
  const res = await onRequest({
    request,
    env,
    next: async () => {
      nextCalled = true;
      return new Response("static-asset", { status: 200, headers: { "content-type": "text/html" } });
    },
  });
  return { res, nextCalled };
}

test("homepage: Accept text/markdown -> markdown body, Content-Type text/markdown, Vary Accept", async () => {
  const { onRequest } = await loadMiddleware();
  const { res } = await hit(onRequest, { accept: "text/markdown" });
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /^text\/markdown/);
  assert.match(res.headers.get("vary"), /\bAccept\b/);
  const body = await res.text();
  assert.match(body, /^# KonsaCard/);
  assert.match(body, /## Top restaurant discount cards in Pakistan/);
  assert.match(body, /https:\/\/konsacard\.pk\/banks\//);
  assert.ok(!body.includes("<html"));
});

test("homepage: Accept text/html, */* and no Accept -> HTML, and Vary Accept is present", async () => {
  const { onRequest } = await loadMiddleware();
  for (const accept of ["text/html", "*/*", undefined, "text/html,application/xhtml+xml,*/*;q=0.8"]) {
    const { res } = await hit(onRequest, { accept });
    assert.match(res.headers.get("content-type"), /^text\/html/, `accept=${accept}`);
    assert.match(res.headers.get("vary"), /\bAccept\b/, `accept=${accept}`);
    const body = await res.text();
    assert.match(body, /<h1/, `accept=${accept}`);
    assert.ok(body.length > 5000);
  }
});

test("homepage: HEAD negotiates the same way", async () => {
  const { onRequest } = await loadMiddleware();
  const md = (await hit(onRequest, { method: "HEAD", accept: "text/markdown" })).res;
  assert.match(md.headers.get("content-type"), /^text\/markdown/);
  const html = (await hit(onRequest, { method: "HEAD", accept: "text/html" })).res;
  assert.match(html.headers.get("content-type"), /^text\/html/);
  assert.match(html.headers.get("vary"), /\bAccept\b/);
});

test("homepage: markdown is still non-empty when ranking data is unavailable", async () => {
  const { onRequest } = await loadMiddleware();
  const env = { ASSETS: assets({ "/data/summary.json": new Response("nope", { status: 500 }) }) };
  const { res } = await hit(onRequest, { accept: "text/markdown", env });
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /^text\/markdown/);
  const body = await res.text();
  assert.match(body, /^# KonsaCard/);
  assert.ok(body.length > 500);
});

test("homepage: markdown honours ?city= and ignores a custom ?bill=", async () => {
  const { onRequest } = await loadMiddleware();
  const { res } = await hit(onRequest, { url: "https://konsacard.pk/?city=karachi&bill=25000", accept: "text/markdown" });
  assert.match(await res.text(), /Top restaurant discount cards in Karachi/);
});

test("homepage: HTML fallback paths also carry Vary Accept", async () => {
  const { onRequest } = await loadMiddleware();
  const custom = await hit(onRequest, { url: "https://konsacard.pk/?bill=25000", accept: "text/html" });
  assert.equal(custom.nextCalled, true);
  assert.match(custom.res.headers.get("vary"), /\bAccept\b/);
  const broken = await hit(onRequest, { accept: "text/html", env: { ASSETS: assets({ "/index.html": new Response("x", { status: 500 }) }) } });
  assert.equal(broken.nextCalled, true);
  assert.match(broken.res.headers.get("vary"), /\bAccept\b/);
});

test("other paths and methods pass straight through untouched", async () => {
  const { onRequest } = await loadMiddleware();
  const other = await hit(onRequest, { url: "https://konsacard.pk/about/", accept: "text/markdown" });
  assert.equal(other.nextCalled, true);
  assert.equal(other.res.headers.get("vary"), null);
  const post = await hit(onRequest, { method: "POST", accept: "text/markdown" });
  assert.equal(post.nextCalled, true);
});

/* ── static files ── */

test("/privacy redirects to /privacy-policy/ and the 404 fallback stays last", () => {
  const rules = read("_redirects")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => l.split(/\s+/));
  const find = (from) => rules.find((r) => r[0] === from);
  assert.deepEqual(find("/privacy"), ["/privacy", "/privacy-policy/", "301"]);
  assert.deepEqual(find("/privacy/"), ["/privacy/", "/privacy-policy/", "301"]);
  assert.deepEqual(rules[rules.length - 1], ["/*", "/404.html", "404"]);
  assert.ok(fs.existsSync(path.join(root, "privacy-policy/index.html")));
});

test("homepage JSON-LD Organization has contactPoint and a PostalAddress", () => {
  const html = read("index.html");
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
  const graph = blocks.flatMap((b) => b["@graph"] || [b]);
  const org = graph.find((n) => n["@type"] === "Organization");
  assert.ok(org, "Organization node present");
  assert.equal(org.contactPoint["@type"], "ContactPoint");
  assert.ok(org.contactPoint.contactType);
  assert.match(org.contactPoint.email, /^[^@\s]+@konsacard\.pk$/);
  assert.equal(org.address["@type"], "PostalAddress");
  assert.equal(org.address.addressCountry, "PK");
  // The published email must be one the contact page already shows.
  assert.ok(read("contact/index.html").includes(org.contactPoint.email));
});

test("llms.txt tells agents when to use the site and how to get markdown", () => {
  const txt = read("llms.txt");
  assert.match(txt, /^## When to use this$/m);
  assert.match(txt, /Accept: text\/markdown/);
  assert.match(txt, /Not a fit:/);
  // Existing structure is preserved.
  assert.match(txt, /^# KonsaCard$/m);
  assert.match(txt, /^## How KonsaCard works$/m);
});
