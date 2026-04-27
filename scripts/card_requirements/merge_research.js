// merge_research.js — merges GPT deep-research output into card_requirements.json + sources.json
// Usage: node merge_research.js research_input.json

const fs   = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT       = path.resolve(__dirname, "../..");
const REQS_PATH  = path.join(ROOT, "data/card-requirements/normalized/card_requirements.json");
const SRC_PATH   = path.join(ROOT, "data/card-requirements/normalized/sources.json");
const INPUT_PATH = process.argv[2];

if (!INPUT_PATH) { console.error("Usage: node merge_research.js <research_input.json>"); process.exit(1); }

const research = JSON.parse(fs.readFileSync(INPUT_PATH, "utf8"));
const reqs     = JSON.parse(fs.readFileSync(REQS_PATH, "utf8"));
const sources  = JSON.parse(fs.readFileSync(SRC_PATH, "utf8"));

const normalize = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();

// Build lookup maps
const reqByNameKey = new Map(reqs.map(r => [normalize(r.bank_name) + "|" + normalize(r.card_name), r]));
const sourceByUrl  = new Map(sources.map(s => [s.url, s]));

function slugify(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

function bankSlug(bankName) {
  return slugify(bankName
    .replace(/\s+limited$/i, "")
    .replace(/\s+ltd\.?$/i, "")
    .replace(/\s+bank$/i, "")
    .replace(/\(.*?\)/g, "")
    .trim());
}

function makeSourceId(bankSlug, url) {
  const hash = crypto.createHash("sha256").update(url).digest("hex").slice(0, 10);
  return `${bankSlug}-src-${hash}`;
}

function sourceType(url) { return url.toLowerCase().endsWith(".pdf") ? "pdf" : "html"; }

let updated = 0, added = 0;

for (const item of research) {
  const key     = normalize(item.bank_name) + "|" + normalize(item.card_name);
  const existing = reqByNameKey.get(key);

  // --- Upsert source ---
  let srcId = null;
  if (item.source_url) {
    if (!sourceByUrl.has(item.source_url)) {
      const bs  = bankSlug(item.bank_name);
      const sid = makeSourceId(bs, item.source_url);
      const newSrc = {
        source_id:       sid,
        bank_slug:       bs,
        bank_name:       item.bank_name,
        url:             item.source_url,
        source_type:     sourceType(item.source_url),
        used_by_card_ids: [],
      };
      sources.push(newSrc);
      sourceByUrl.set(item.source_url, newSrc);
    }
    const src = sourceByUrl.get(item.source_url);
    srcId = src.source_id;

    if (existing && !src.used_by_card_ids.includes(existing.card_id)) {
      src.used_by_card_ids.push(existing.card_id);
    }
  }

  if (existing) {
    // --- Update existing record ---
    const req = existing.requirements;

    if (item.minimum_monthly_salary_pkr !== undefined)  req.minimum_monthly_salary_pkr  = item.minimum_monthly_salary_pkr;
    if (item.minimum_account_balance_pkr !== undefined) req.minimum_account_balance_pkr = item.minimum_account_balance_pkr;
    if (item.annual_fee_pkr !== undefined)              req.annual_fee_pkr              = item.annual_fee_pkr;
    if (item.annual_fee_waiver_rule !== undefined)      req.annual_fee_waiver_rule      = item.annual_fee_waiver_rule;

    existing.confidence = item.confidence;

    // Append note if it's new
    if (item.notes && !existing.notes.includes(item.notes)) {
      existing.notes = [item.notes, ...existing.notes.filter(n => n !== item.notes)];
    }

    // Add source id
    if (srcId && !existing.source_ids.includes(srcId)) {
      existing.source_ids.push(srcId);
      if (!existing.requirement_sources) existing.requirement_sources = {};
      ["minimum_monthly_salary_pkr","minimum_account_balance_pkr","annual_fee_pkr"].forEach(f => {
        if (!existing.requirement_sources[f]) existing.requirement_sources[f] = [];
        if (!existing.requirement_sources[f].includes(srcId)) existing.requirement_sources[f].push(srcId);
      });
    }

    console.log(`  UPDATED: ${existing.bank_name} | ${existing.card_name}`);
    updated++;
  } else {
    // --- Add new record ---
    const bs     = bankSlug(item.bank_name);
    const cardId = `${bs}--${slugify(item.card_name)}`;

    const newReq = {
      card_id:   cardId,
      bank_slug: bs,
      bank_name: item.bank_name,
      card_name: item.card_name,
      requirements: {
        minimum_monthly_salary_pkr:  item.minimum_monthly_salary_pkr  ?? null,
        minimum_account_balance_pkr: item.minimum_account_balance_pkr ?? null,
        annual_fee_pkr:              item.annual_fee_pkr              ?? null,
        annual_fee_waiver_rule:      item.annual_fee_waiver_rule      ?? null,
        minimum_age_years:           null,
        maximum_age_years:           null,
      },
      requirement_sources: {},
      source_ids: srcId ? [srcId] : [],
      confidence: item.confidence,
      notes:      item.notes ? [item.notes] : [],
      bank_gaps:  [],
      retrieved_note: "Added via deep-research merge.",
    };

    if (srcId) {
      ["minimum_monthly_salary_pkr","minimum_account_balance_pkr","annual_fee_pkr"].forEach(f => {
        newReq.requirement_sources[f] = [srcId];
      });
      const src = sourceByUrl.get(item.source_url);
      if (src && !src.used_by_card_ids.includes(cardId)) src.used_by_card_ids.push(cardId);
    }

    reqs.push(newReq);
    reqByNameKey.set(key, newReq);
    console.log(`  ADDED:   ${item.bank_name} | ${item.card_name} (id: ${cardId})`);
    added++;
  }
}

fs.writeFileSync(REQS_PATH, JSON.stringify(reqs, null, 2));
fs.writeFileSync(SRC_PATH,  JSON.stringify(sources, null, 2));

console.log(`\nDone. Updated: ${updated}, Added: ${added}`);
console.log(`card_requirements.json: ${reqs.length} records`);
console.log(`sources.json: ${sources.length} records`);
