// 04 — Aggregate review signals into per-branch dish/aspect scores,
// with brand-prior shrinkage for sparse branches.
//
// In:  data/work/labels.jsonl, data/work/entities_offers.json
// Out: data/work/scores.json   (the served index, per branch)
//
// Dish strings are canonicalized via the gazetteer before keying, so transliteration
// and modifier variants ("nehari"/"nihari"/"beef nihari") collapse to one dish id with
// pooled evidence, and a per-branch cuisine rollup is derived for cuisine queries.
import fs from "fs";
import { canonicalizeDish } from "./lib/gazetteer.mjs";

const LABELS = "food-discovery/data/work/labels.jsonl";
const ENT = "food-discovery/data/work/entities_offers.json";
const OUT = "food-discovery/data/work/scores.json";

const K_DISH = 4;     // shrinkage strength (≈ "phantom reviews" at brand rate)
const K_ASP = 3;
const M_STAR = 50;    // Bayesian prior weight for star quality
const GLOBAL_MEAN_STARS = 4.2;

const SENT_VAL = { positive:1, neutral:0.5, negative:0 };

const labels = fs.readFileSync(LABELS,"utf8").trim().split("\n").filter(Boolean).map(l=>JSON.parse(l));
const entities = JSON.parse(fs.readFileSync(ENT,"utf8"));

// index branch -> meta
const branchMeta = {};
for(const e of Object.values(entities)) for(const b of e.branches) branchMeta[b.branch_id] = b;

// collect mentions: branch x dish, branch x aspect (+ brand rollups)
function makeAcc(){ return { sum:0, n:0, pos:0, neg:0, neu:0 }; }
function add(acc, sent){ acc.sum += SENT_VAL[sent]??0.5; acc.n++; acc[sent==="positive"?"pos":sent==="negative"?"neg":"neu"]++; }

const branchDish={}, brandDish={}, branchAsp={}, brandAsp={};
const branchCuis={}, brandCuis={};            // per-branch / per-brand cuisine rollups
const variants={};                            // canonical dish -> {raw surface form: count}  (evidence/audit)
for(const l of labels){
  const bId=l.branch_id, bk=l.brand_key;
  for(const d of (l.dishes||[])){
    for(const hit of canonicalizeDish(d.dish)){   // 1 raw string -> 0..n canonical dishes
      const key=hit.canonical;
      ((branchDish[bId] ||= {})[key] ||= makeAcc()); add(branchDish[bId][key], d.sentiment);
      ((brandDish[bk] ||= {})[key] ||= makeAcc()); add(brandDish[bk][key], d.sentiment);
      ((branchCuis[bId] ||= {})[hit.cuisine] ||= makeAcc()); add(branchCuis[bId][hit.cuisine], d.sentiment);
      ((brandCuis[bk] ||= {})[hit.cuisine] ||= makeAcc()); add(brandCuis[bk][hit.cuisine], d.sentiment);
      ((variants[key] ||= {})[d.dish.toLowerCase().trim()] = (variants[key]?.[d.dish.toLowerCase().trim()]||0)+1);
    }
  }
  for(const a of (l.aspects||[])){
    ((branchAsp[bId] ||= {})[a.aspect] ||= makeAcc()); add(branchAsp[bId][a.aspect], a.sentiment);
    ((brandAsp[bk] ||= {})[a.aspect] ||= makeAcc()); add(brandAsp[bk][a.aspect], a.sentiment);
  }
}

function rate(acc){ return acc.n ? acc.sum/acc.n : null; }
function shrink(branchAcc, brandAcc, k){
  const br = brandAcc && brandAcc.n ? rate(brandAcc) : 0.6; // global-ish default
  if(!branchAcc || !branchAcc.n) return { score:+br.toFixed(3), n:0, source:"brand_prior", branch_rate:null, brand_rate:+br.toFixed(3) };
  const r = rate(branchAcc);
  const s = (branchAcc.n*r + k*br)/(branchAcc.n+k);
  return { score:+s.toFixed(3), n:branchAcc.n, pos:branchAcc.pos, neg:branchAcc.neg,
    source: branchAcc.n>=k ? "branch" : "branch+brand_prior",
    branch_rate:+r.toFixed(3), brand_rate:+br.toFixed(3) };
}

const index = {};
for(const e of Object.values(entities)){
  for(const b of e.branches){
    const bId=b.branch_id, bk=b.brand_key;
    // dish scores (union of dishes seen at this branch OR brand)
    const dishKeys = new Set([...Object.keys(branchDish[bId]||{}), ...Object.keys(brandDish[bk]||{})]);
    const dishes={};
    for(const dk of dishKeys) dishes[dk] = shrink((branchDish[bId]||{})[dk], (brandDish[bk]||{})[dk], K_DISH);
    const aspKeys = new Set([...Object.keys(branchAsp[bId]||{}), ...Object.keys(brandAsp[bk]||{})]);
    const aspects={};
    for(const ak of aspKeys) aspects[ak] = shrink((branchAsp[bId]||{})[ak], (brandAsp[bk]||{})[ak], K_ASP);
    // cuisine rollup (for "best <cuisine>" queries)
    const cuisKeys = new Set([...Object.keys(branchCuis[bId]||{}), ...Object.keys(brandCuis[bk]||{})]);
    const cuisines={};
    for(const ck of cuisKeys) cuisines[ck] = shrink((branchCuis[bId]||{})[ck], (brandCuis[bk]||{})[ck], K_DISH);
    // Bayesian star quality
    const R=b.google_rating??GLOBAL_MEAN_STARS, v=b.google_review_count??0;
    const starQuality = ((v*R + M_STAR*GLOBAL_MEAN_STARS)/(v+M_STAR))/5;
    index[bId] = {
      branch_id:bId, brand:b.brand, brand_key:bk, title:b.title, city:b.city,
      lat:b.lat, lng:b.lng, price_range:b.price_range,
      google_rating:b.google_rating, google_review_count:b.google_review_count,
      star_quality:+starQuality.toFixed(3), dishes, aspects, cuisines,
      best_offer:b.best_offer||null, offer_count:(b.applicable_offers||[]).length,
    };
  }
}

fs.writeFileSync(OUT, JSON.stringify(index,null,1));

// report + a shrinkage illustration if a multi-branch brand exists
console.log("=== aggregate ===");
console.log("branches scored:", Object.keys(index).length);
const dishUniverse = new Set(); for(const b of Object.values(index)) Object.keys(b.dishes).forEach(d=>dishUniverse.add(d));
console.log("distinct dishes:", dishUniverse.size);
const multi = Object.values(entities).filter(e=>e.branch_count>1)[0];
if(multi){
  console.log(`\nshrinkage illustration — brand "${multi.brand}" (${multi.branch_count} branches):`);
  for(const b of multi.branches){
    const di=index[b.branch_id].dishes;
    const top=Object.entries(di).sort((a,c)=>c[1].n-a[1].n)[0];
    if(top) console.log(`  ${b.title.slice(0,40)}: "${top[0]}" score=${top[1].score} (n=${top[1].n}, ${top[1].source}, branch_rate=${top[1].branch_rate}, brand_rate=${top[1].brand_rate})`);
  }
}
