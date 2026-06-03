// 05 — Ranking engine + grounded synthesis demo.
// Answers example "best <dish> in <city>" queries using the scored index,
// folding in Konsacard card savings, then has the local LLM phrase the answer.
//
// In:  data/work/scores.json
// Out: out/demo_results.json, out/demo.md
import fs from "fs";
import { canonicalizeQuery } from "./lib/gazetteer.mjs";

const IDX = "food-discovery/data/work/scores.json";
const OUT_JSON = "food-discovery/out/demo_results.json";
const OUT_MD = "food-discovery/out/demo.md";
const MODEL = process.env.MODEL || "llama3.2:3b";
const HOST = "http://localhost:11434";

// deterministic scorer weights (proximity omitted in demo — no user location)
const W = { quality:0.30, dish:0.45, savings:0.25 };

const index = JSON.parse(fs.readFileSync(IDX,"utf8"));
const branches = Object.values(index);

// canonical exact lookup against the branch's dish OR cuisine index (gazetteer-keyed)
function intentMatch(b, intent){
  if(!intent) return null;
  const table = intent.kind==="cuisine" ? b.cuisines : b.dishes;
  const v = table && table[intent.id];
  return v ? {key:intent.id, ...v} : null;
}
function savingsScore(b){ const pct=b.best_offer?.discountPct||0; return Math.min(pct/30,1); } // 30% -> 1.0

function rank(query){
  const {term, city} = query;
  const intent = term ? canonicalizeQuery(term) : null;
  const cands = branches.filter(b=>b.city===city);
  const scored=[];
  for(const b of cands){
    const dm = intentMatch(b, intent);
    if(term && intent && (!dm || dm.score==null)) continue;  // need evidence for this intent
    const dishScore = dm ? dm.score : 0.6;
    const score = W.quality*b.star_quality + W.dish*dishScore + W.savings*savingsScore(b);
    scored.push({ branch:b, dm, dishScore, score:+score.toFixed(3) });
  }
  scored.sort((a,c)=>c.score-a.score);
  return scored.slice(0,5);
}

async function synth(query, top){
  const what = query.term||"restaurant";
  const facts = top.map((t,i)=>{
    const b=t.branch, dm=t.dm, o=b.best_offer;
    const conf = dm ? (dm.source==="branch" ? `${dm.n} reviews of this branch` : dm.source==="brand_prior" ? `estimated from ${b.brand} overall` : `${dm.n} reviews + brand prior`) : "overall";
    return `${i+1}. ${b.title} (${b.city}) — ${b.brand}. ${what} score ${t.dishScore} [${conf}]. Google ${b.google_rating||"?"}★/${b.google_review_count||0}. ${o?`Offer: ${o.discountLabel} with ${o.bank} ${o.card} (${o.scope})`:"no card offer"}.`;
  }).join("\n");
  const prompt = `You are Konsacard's food assistant. The user asked: "best ${what} in ${query.city}". Using ONLY these ranked facts, write a friendly 2-3 sentence recommendation. Lead with the top pick, mention the review evidence, and name the best card to pay with if any. Be concise. Do not invent facts.\n\n${facts}`;
  try{
    const res=await fetch(`${HOST}/api/generate`,{method:"POST",body:JSON.stringify({model:MODEL,prompt,stream:false,options:{temperature:0.3,num_predict:200}})});
    return (await res.json()).response.trim();
  }catch(e){ return "(synthesis skipped: model offline)"; }
}

const QUERIES = [
  {term:"biryani", city:"Karachi"},
  {term:"karahi", city:"Karachi"},
  {term:"nihari", city:"Lahore"},
  {term:"bbq", city:"Lahore"},     // cuisine intent (resolved via gazetteer)
  {term:null, city:"Islamabad"},   // best overall
];

const results=[]; let md=`# Food-Discovery — ranking + synthesis demo\n\nDeterministic scorer: \`${W.quality}·quality + ${W.dish}·dishMatch + ${W.savings}·savings\` (proximity omitted — no user location in demo).\n\n`;
for(const q of QUERIES){
  const top = rank(q);
  const answer = await synth(q, top);
  results.push({query:q, top: top.map(t=>({title:t.branch.title, brand:t.branch.brand, score:t.score, dishScore:t.dishScore, dish_source:t.dm?.source||null, dish_n:t.dm?.n||0, google:`${t.branch.google_rating}★/${t.branch.google_review_count}`, best_offer:t.branch.best_offer?`${t.branch.best_offer.discountLabel} ${t.branch.best_offer.bank} (${t.branch.best_offer.scope})`:null})), answer});
  md += `## "best ${q.term||"restaurant"} in ${q.city}"\n\n`;
  if(!top.length){ md += `_no candidates with evidence_\n\n`; continue; }
  md += `**Answer:** ${answer}\n\n| # | branch | score | dish | evidence | google | card offer |\n|--|--|--|--|--|--|--|\n`;
  top.forEach((t,i)=>{ md += `| ${i+1} | ${t.branch.title} | ${t.score} | ${t.dishScore} | ${t.dm?`${t.dm.source}(n=${t.dm.n})`:"-"} | ${t.branch.google_rating}★/${t.branch.google_review_count} | ${t.branch.best_offer?`${t.branch.best_offer.discountLabel} ${t.branch.best_offer.bank} [${t.branch.best_offer.scope}]`:"—"} |\n`; });
  md += `\n`;
}
fs.writeFileSync(OUT_JSON, JSON.stringify(results,null,1));
fs.writeFileSync(OUT_MD, md);
console.log("=== rank_demo ===");
console.log(`queries answered: ${QUERIES.length} -> out/demo.md, out/demo_results.json`);
for(const r of results) console.log(`\n"best ${r.query.term||"restaurant"} in ${r.query.city}": ${r.top.length} results` + (r.top[0]?` | #1 ${r.top[0].title} (score ${r.top[0].score})`:""));
