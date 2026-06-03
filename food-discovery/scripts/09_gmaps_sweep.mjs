// 09 — Google Maps Karachi sweep (throttled, resumable directory builder).
//
// Drives the gosom google-maps-scraper over a generated area x category query set,
// in small batches with delays between them, deduping places by place_id into one
// corpus file. Resumable: completed queries are checkpointed, so a stopped/blocked
// run continues where it left off. This is the deliberately slow, block-averse path
// (no proxies/evasion) — coverage grows incrementally across sessions.
//
//   directory pass (fast, default):  node scripts/09_gmaps_sweep.mjs --max-batches 5
//   deep review pull (slow):         node scripts/09_gmaps_sweep.mjs --extra-reviews --batch 3
//
// Out: data/raw/karachi_gmaps.jsonl (one place/line, deduped) + data/work/gmaps_sweep_state.json
import fs from "fs";
import { spawn } from "child_process";

// gosom binary: $GOSOM_BIN if set, else the default go-install location (cross-platform).
const GOBIN = process.env.HOME || process.env.USERPROFILE || ".";
const BIN = process.env.GOSOM_BIN || `${GOBIN}/go/bin/google-maps-scraper${process.platform === "win32" ? ".exe" : ""}`;

const raw = process.argv.slice(2);
const args = {}; const flags = new Set();
for (let i = 0; i < raw.length; i++) { if (raw[i].startsWith("--")) { const k = raw[i].slice(2); if (raw[i + 1] && !raw[i + 1].startsWith("--")) args[k] = raw[++i]; else flags.add(k); } }

// inputs/outputs are overridable so the same runner does Pass A (directory, generated
// queries) and Pass B (deep reviews over a place-URL list from 10_select_deep_targets).
const QUERIES = args.queries || "food-discovery/data/work/queries_karachi.txt";
const CORPUS = args.out || "food-discovery/data/raw/karachi_gmaps.jsonl";
const STATE = args.state || "food-discovery/data/work/gmaps_sweep_state.json";
const TMP_IN = "food-discovery/data/work/.gmaps_batch_in.txt";
const TMP_OUT = "food-discovery/data/work/.gmaps_batch_out.jsonl";
const BATCH = +(args.batch ?? (flags.has("extra-reviews") ? 3 : 6));   // queries per gosom invocation
const DELAY = +(args.delay ?? 20) * 1000;                              // pause between batches (s)
const C = +(args.concurrency ?? 2);
const DEPTH = +(args.depth ?? 12);
const EXTRA = flags.has("extra-reviews");
const MAX_BATCHES = +(args["max-batches"] ?? Infinity);                // throttle: cap batches per session

// --- Karachi area x category query set (edit freely; regenerated only if file missing) ---
// ~76 areas covering all Karachi towns (curated from Wikipedia "Neighbourhoods of Karachi").
// Originals are kept verbatim so already-completed queries stay checkpointed on restart.
const AREAS = [
  // South / Central food hubs
  "Clifton", "Defence", "DHA Phase 1", "DHA Phase 2", "DHA Phase 4", "DHA Phase 5", "DHA Phase 6", "DHA Phase 7", "DHA Phase 8",
  "Zamzama", "Khayaban-e-Shahbaz", "Boat Basin", "Gizri", "Kehkashan", "Sea View",
  "Saddar", "Burns Road", "Kharadar", "Garden", "Soldier Bazaar", "Empress Market",
  "Tariq Road", "PECHS", "Bahadurabad", "Dhoraji", "Shahra-e-Faisal", "Mehmoodabad", "Akhtar Colony",
  // East (Gulshan / Johar)
  "Gulshan-e-Iqbal", "Gulistan-e-Johar", "Gulzar-e-Hijri", "NIPA", "Pehlwan Goth", "Safora Goth", "University Road",
  // Central
  "Nazimabad", "North Nazimabad", "Hyderi", "Sakhi Hassan", "Buffer Zone", "Paposh Nagar",
  "Liaquatabad", "Karimabad", "Azizabad", "Water Pump", "Ancholi", "Federal B Area", "Gulberg", "Aisha Manzil",
  // West / North
  "North Karachi", "New Karachi", "Khawaja Ajmer Nagri", "Orangi Town", "SITE Area", "Baldia Town",
  "Surjani Town", "Gulshan-e-Maymar", "Manghopir", "Gadap", "Yousuf Goth", "Scheme 33",
  // Southeast (Malir / Korangi / Landhi)
  "Malir", "Malir Cantt", "Model Colony", "Saudabad", "Khokhrapar", "Korangi", "Korangi Industrial Area",
  "Landhi", "Shah Faisal Colony", "Drigh Road", "Gulshan-e-Hadeed", "Bahria Town Karachi",
  // West / South (Kemari / Lyari)
  "Kemari", "Maripur", "Lyari", "Lea Market",
];
// ~40 food categories spanning venue types + PK dishes + cuisines. Originals kept
// verbatim so already-completed queries stay checkpointed on restart.
const CATEGORIES = [
  // venue types
  "restaurants", "fast food", "fine dining", "family restaurant", "cafe", "coffee shop", "bakery", "dhaba",
  // desi mains
  "biryani", "pulao", "karahi", "nihari", "haleem", "paya", "handi", "qeema",
  // bbq / grill
  "bbq", "tikka", "seekh kabab", "chargha", "sajji",
  // breakfast / street
  "breakfast", "halwa puri", "chaat",
  // fast food / intl
  "burgers", "pizza", "fried chicken", "broast", "shawarma", "rolls",
  // asian / continental
  "chinese restaurant", "thai restaurant", "continental restaurant", "italian restaurant", "steak house", "afghani restaurant",
  // seafood
  "seafood restaurant",
  // sweets / beverages / shisha
  "desserts", "ice cream", "sweets", "shisha lounge",
];

function genQueries() {
  const qs = [];
  for (const a of AREAS) for (const c of CATEGORIES) qs.push(`${c} in ${a} Karachi`);
  fs.writeFileSync(QUERIES, qs.join("\n") + "\n");
  console.log(`generated ${qs.length} queries (${AREAS.length} areas x ${CATEGORIES.length} categories) -> ${QUERIES}`);
  return qs;
}

if (flags.has("gen-only")) { genQueries(); process.exit(0); }   // regenerate query set + exit (no scraping)
if (!fs.existsSync(QUERIES)) {
  if (args.queries) { console.error(`input file not found: ${QUERIES}`); process.exit(1); }   // Pass B expects a real targets file
  genQueries();
}
const queries = fs.readFileSync(QUERIES, "utf8").trim().split("\n").filter(Boolean);
const state = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, "utf8")) : { done: [] };
const doneQ = new Set(state.done);
const seen = new Set();   // place_id dedup across corpus
if (fs.existsSync(CORPUS)) for (const l of fs.readFileSync(CORPUS, "utf8").trim().split("\n").filter(Boolean)) { try { const p = JSON.parse(l); const id = p.place_id || p.cid || p.data_id || p.link; if (id) seen.add(id); } catch {} }

const pending = queries.filter(q => !doneQ.has(q));
console.log(`=== gmaps sweep === ${queries.length} queries, ${doneQ.size} done, ${pending.length} pending | extra-reviews=${EXTRA} batch=${BATCH} delay=${DELAY / 1000}s`);
console.log(`corpus has ${seen.size} unique places so far -> ${CORPUS}`);

const fd = fs.openSync(CORPUS, "a");
const sleep = ms => new Promise(r => setTimeout(r, ms));
let batchesRun = 0, addedTotal = 0;

// Run gosom with a watchdog. gosom writes results to TMP_OUT incrementally (verified),
// so once it logs "scrapemate exited" the batch's data is already on disk — but on some
// machines the process then HANGS in Chromium teardown. So: kill the whole process group
// as soon as work is done (exit message) or after `idleMs` of no output, with a hard cap.
// This avoids the blind multi-minute wait that previously lost a batch on teardown hang.
function runGosom(gosomArgs, { idleMs, hardMs }) {
  return new Promise((resolve) => {
    let child;
    try { child = spawn(BIN, gosomArgs, { stdio: ["ignore", "pipe", "pipe"], detached: true }); }
    catch (e) { return resolve(`spawn-failed:${e.message}`); }
    let finished = false, idle, hard;
    const killTree = () => { try { process.kill(-child.pid, "SIGKILL"); } catch { try { child.kill("SIGKILL"); } catch {} } };
    const finish = (reason) => {
      if (finished) return; finished = true;
      clearTimeout(idle); clearTimeout(hard);
      killTree();
      resolve(reason);
    };
    const bumpIdle = () => { clearTimeout(idle); idle = setTimeout(() => finish("idle"), idleMs); };
    const onData = (buf) => {
      if (buf.toString().includes("scrapemate exited")) { setTimeout(() => finish("done"), 1500); return; }  // grace for final flush
      bumpIdle();
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("exit", () => finish("process-exit"));
    child.on("error", (e) => finish(`error:${e.message}`));
    hard = setTimeout(() => finish("hard-timeout"), hardMs);
    bumpIdle();
  });
}

for (let i = 0; i < pending.length && batchesRun < MAX_BATCHES; i += BATCH) {
  const batch = pending.slice(i, i + BATCH);
  fs.writeFileSync(TMP_IN, batch.join("\n") + "\n");
  fs.rmSync(TMP_OUT, { force: true });
  const gosomArgs = ["-input", TMP_IN, "-results", TMP_OUT, "-json", "-c", String(C), "-depth", String(DEPTH), "-lang", "en", "-exit-on-inactivity", "90s"];
  if (EXTRA) gosomArgs.push("-extra-reviews");
  console.log(`\n[batch ${batchesRun + 1}] ${batch.length} queries: ${batch[0]} ...`);
  const reason = await runGosom(gosomArgs, { idleMs: EXTRA ? 120000 : 60000, hardMs: (EXTRA ? 60 : 15) * 60000 });
  if (reason !== "done" && reason !== "process-exit") console.log(`  gosom stopped (${reason}) — merging whatever was written`);
  // merge dedup
  let added = 0;
  if (fs.existsSync(TMP_OUT)) for (const l of fs.readFileSync(TMP_OUT, "utf8").trim().split("\n").filter(Boolean)) {
    try { const p = JSON.parse(l); const id = p.place_id || p.cid || p.data_id || p.link; if (id && !seen.has(id)) { seen.add(id); fs.writeSync(fd, l + "\n"); added++; } } catch {}
  }
  addedTotal += added;
  for (const q of batch) { doneQ.add(q); state.done.push(q); }
  fs.writeFileSync(STATE, JSON.stringify(state, null, 1));
  batchesRun++;
  console.log(`  +${added} new places (corpus now ${seen.size}) | ${doneQ.size}/${queries.length} queries done`);
  if (i + BATCH < pending.length && batchesRun < MAX_BATCHES) { console.log(`  sleeping ${DELAY / 1000}s...`); await sleep(DELAY); }
}
fs.closeSync(fd);
fs.rmSync(TMP_IN, { force: true }); fs.rmSync(TMP_OUT, { force: true });
console.log(`\ndone this session: ${batchesRun} batches, +${addedTotal} new places, corpus=${seen.size} unique, ${doneQ.size}/${queries.length} queries complete.`);
if (doneQ.size < queries.length) console.log(`resume with the same command to continue the remaining ${queries.length - doneQ.size} queries.`);
