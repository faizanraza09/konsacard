// Foodpanda (Pakistan) scraper — JSON API, no browser.
//
// The listing API is DELIVERY-LOCATION scoped: it returns vendors that deliver
// to a given lat/lng. To cover a whole city, sweep a GRID of points and dedupe
// vendors by code (overlapping delivery radii guarantee coverage).
//
// Usage:
//   single point:  node fp_scrape.mjs --lat 24.8138 --lng 67.0300 --limit 10
//   whole city:    node fp_scrape.mjs --grid --bbox 24.75,66.95,25.10,67.25 --step 4
//   discover only: add --list-only   (find unique vendors, skip menu fetches)
//   menus only:    node fp_scrape.mjs --codes-from data/raw/foodpanda_vendors.jsonl  (skip discovery)
//   gentle resume: add --delay-ms 3000   (the menu endpoint is PerimeterX-protected;
//                  sustained fast pulls trip a 403 CAPTCHA. go slow + resumable.)
//   search filter: add --q biryani
//
// Menu fetching is RESUMABLE: output is opened append-mode and vendors already in
// the output file are skipped, so a crashed run just continues where it left off.
import fs from "fs";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const raw = process.argv.slice(2);
const args = {}; const flags = new Set();
for (let i=0;i<raw.length;i++){ if(raw[i].startsWith("--")){ const k=raw[i].slice(2); if(raw[i+1]&&!raw[i+1].startsWith("--")){ args[k]=raw[++i]; } else flags.add(k); } }

const GRID = flags.has("grid");
const LIST_ONLY = flags.has("list-only");
const CODES_FROM = args["codes-from"] || null;
const Q = args.q || null;
const LIMIT = args.limit ? +args.limit : Infinity;        // cap on MENU fetches
const PER_POINT = args["per-point"] ? +args["per-point"] : 250;  // cap vendors pulled per grid point
const STEP = +(args.step ?? 4);                            // km between grid points
const OUT = args.out || "food-discovery/data/raw/foodpanda.jsonl";
const DELAY = args["delay-ms"] ? +args["delay-ms"] : 350, PAGE = 48;

const sleep = ms => new Promise(r=>setTimeout(r,ms));
const perseus = () => `${Date.now()}.${Math.floor(Math.random()*1e18)}.${Math.random().toString(36).slice(2,12)}`;
const baseHeaders = () => ({ "User-Agent":UA, "Accept":"application/json", "x-fp-api-key":"volo",
  "x-disco-client-id":"web", "Perseus-Client-Id":perseus(), "Perseus-Session-Id":perseus(), "dps-session-id":perseus() });

async function getJSON(url, tries=3){
  for(let t=0;t<tries;t++){
    try{ const r=await fetch(url,{headers:baseHeaders()}); if(r.status===200) return await r.json();
      if(r.status===429||r.status>=500){ await sleep(1000*(t+1)); continue; } return {__err:r.status}; }
    catch(e){ if(t===tries-1) return {__err:e.message}; await sleep(800*(t+1)); }
  }
  return {__err:"retries_exhausted"};
}

// list vendors that deliver to one point (paginated up to `max`)
async function listAt(lat,lng,max){
  const out=[]; let offset=0, avail=Infinity;
  while(out.length<max && offset<avail){
    const u=new URL("https://disco.deliveryhero.io/listing/api/v1/pandora/vendors");
    Object.entries({longitude:lng, latitude:lat, language_id:1, dynamic_pricing:0, configuration:"Variant1",
      country:"pk", customer_type:"regular", limit:PAGE, offset, vertical:"restaurants", ...(Q?{q:Q}:{})})
      .forEach(([k,v])=>u.searchParams.set(k,v));
    const j=await getJSON(u.toString());
    if(j.__err) break;
    avail = j?.data?.available_count ?? 0;
    const items = j?.data?.items || [];
    if(!items.length) break;
    out.push(...items); offset+=PAGE; await sleep(DELAY);
    if(items.length<PAGE) break;
  }
  return out;
}

// build grid points across a bbox at STEP km spacing
function gridPoints(minLat,minLng,maxLat,maxLng,stepKm){
  const pts=[]; const dLat=stepKm/111;
  for(let lat=minLat; lat<=maxLat+1e-9; lat+=dLat){
    const dLng=stepKm/(111*Math.cos(lat*Math.PI/180));
    for(let lng=minLng; lng<=maxLng+1e-9; lng+=dLng) pts.push([+lat.toFixed(5),+lng.toFixed(5)]);
  }
  return pts;
}

function parseMenu(v){
  const out=[];
  for(const m of (v.menus||[])) for(const c of (m.menu_categories||[])) for(const p of (c.products||[])){
    const variations=(p.product_variations||[]).map(x=>({name:x.name||null, price:x.price??null, original:x.original_price??null}));
    const best=variations[0]||{};
    out.push({ category:c.name, name:p.name, description:p.description||null,
      price:best.price??null, original_price:best.original??null, variations: variations.length>1?variations:undefined });
  }
  return out;
}
async function getMenu(code){
  const u=`https://pk.fd-api.com/api/v5/vendors/${code}?include=menus&language_id=1&opening_type=delivery&basket_currency=PKR`;
  const j=await getJSON(u);
  if(j.__err) return {__err:j.__err};
  const v=j.data;
  return { foodpanda_id:v.id, code:v.code, name:v.name, chain:v.chain?.name||null, address:v.address||null,
    area:v.address_line2||null, city:v.city?.name||null, lat:v.latitude??null, lng:v.longitude??null,
    cuisines:(v.cuisines||[]).map(c=>c.name), rating:v.rating??null, review_number:v.review_number??null,
    min_order:v.minimum_order_amount??null, menu:parseMenu(v) };
}

// --- discover unique vendors ---
const unique = new Map(); // code -> listing item
if(CODES_FROM){
  for(const l of fs.readFileSync(CODES_FROM,"utf8").trim().split("\n").filter(Boolean)){ try{const v=JSON.parse(l); if(v.code) unique.set(v.code, v);}catch{} }
  console.log(`=== foodpanda CODES-FROM === ${unique.size} vendors loaded from ${CODES_FROM} (skipping discovery)`);
} else if(GRID){
  const [minLat,minLng,maxLat,maxLng] = (args.bbox || "24.75,66.95,25.10,67.25").split(",").map(Number);
  const pts = gridPoints(minLat,minLng,maxLat,maxLng,STEP);
  console.log(`=== foodpanda GRID === bbox=[${minLat},${minLng},${maxLat},${maxLng}] step=${STEP}km points=${pts.length}${Q?` q="${Q}"`:""}`);
  for(let i=0;i<pts.length;i++){
    const items = await listAt(pts[i][0], pts[i][1], PER_POINT);
    for(const it of items) if(it.code && !unique.has(it.code)) unique.set(it.code, it);
    console.log(`  point ${i+1}/${pts.length} (${pts[i]}) +${items.length} seen → ${unique.size} unique`);
  }
} else {
  const lat=+(args.lat ?? 24.8138), lng=+(args.lng ?? 67.0300);
  console.log(`=== foodpanda SINGLE === loc=${lat},${lng}${Q?` q="${Q}"`:""}`);
  const items = await listAt(lat,lng, isFinite(LIMIT)?LIMIT:PER_POINT);
  for(const it of items) if(it.code) unique.set(it.code, it);
  console.log(`  ${unique.size} vendors deliver here`);
}
console.log(`\nUNIQUE VENDORS DISCOVERED: ${unique.size}`);

if(LIST_ONLY){
  fs.writeFileSync(OUT.replace(/\.jsonl$/,"_vendors.jsonl"), [...unique.values()].map(v=>JSON.stringify({code:v.code,name:v.name,chain:v.chain?.name||null,cuisines:(v.cuisines||[]).map(c=>c.name),rating:v.rating,lat:v.latitude,lng:v.longitude})).join("\n"));
  console.log(`list-only: wrote ${unique.size} vendor stubs (no menus).`);
  process.exit(0);
}

// --- fetch menus (resumable: skip vendors already in OUT, append) ---
const allCodes=[...unique.keys()].slice(0, isFinite(LIMIT)?LIMIT:undefined);
const done=new Set();
if(fs.existsSync(OUT)) for(const l of fs.readFileSync(OUT,"utf8").trim().split("\n").filter(Boolean)){ try{done.add(JSON.parse(l).code);}catch{} }
const codes=allCodes.filter(c=>!done.has(c));
console.log(`fetching menus for ${codes.length} vendors (${done.size} already done → skipped)...`);
const fd=fs.openSync(OUT,"a");
let ok=0,err=0,items=0,t0=Date.now();
for(let i=0;i<codes.length;i++){
  const m=await getMenu(codes[i]);
  if(m.__err){ err++; } else { ok++; items+=m.menu.length; fs.writeSync(fd, JSON.stringify(m)+"\n"); }
  if((i+1)%25===0||i===codes.length-1){ const rate=(i+1)/((Date.now()-t0)/1000); console.log(`  ${i+1}/${codes.length}  ok=${ok} err=${err} items=${items}  ${rate.toFixed(1)}/s`); }
  await sleep(DELAY + Math.random()*DELAY);   // jitter to look less mechanical
}
fs.closeSync(fd);
console.log(`\ndone: ${ok} vendors with menus this run, ${err} errors, ${items} menu items, ${done.size+ok} total → ${OUT}`);
