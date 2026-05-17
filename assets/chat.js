// @ts-check
/* ── CHAT PANEL + AI TOOLS ──
   Moved out of app.js as a self-contained module. Loaded after
   algorithms.js but before app.js via <script defer> in index.html.
   Depends on: state, escapeHtml, escapeAttr, computeRecommendations,
   computeNextCardRecommendations, getOfferSavingValue, formatCurrency,
   buildCardKey, normalizeCityValue (all live in app.js or algorithms.js;
   resolved at call time). */

/* ── FUZZY NAME MATCH ── */
function fuzzyMatch(query, target) {
  if (!query || !target) return false;
  const norm = (s) => s.toLowerCase().replace(/[‘’’`]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const q = norm(query), t = norm(target);
  if (t.includes(q) || q.includes(t)) return true;
  // Strip generic banking words before prefix matching — they appear in almost
  // every card/bank name and cause false positives ("card" matching any card, etc.)
  const STOP = new Set(["card", "bank", "debit", "credit", "visa", "gold", "silver", "plus", "lite", "easy"]);
  const sig = (s) => s.split(" ").filter((w) => w.length >= 4 && !STOP.has(w));
  const qw = sig(q);
  const tw = sig(t);
  if (!qw.length || !tw.length) return false;
  return qw.some((qword) => tw.some((tword) => tword.startsWith(qword) || qword.startsWith(tword)));
}

/* ── TOOL DEFINITIONS (OpenAI format) ── */
const CHAT_TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "search_offers",
      description: "Search and filter the full offers database. Use for: all deals at a restaurant, all offers from a bank, day-of-week deals, offers above a discount threshold, or any combination of filters. Returns raw offer rows with full detail.",
      parameters: {
        type: "object",
        properties: {
          restaurants: { type: "array", items: { type: "string" }, description: "Restaurant name(s) — partial/fuzzy match ok. Pass multiple to get deals at all of them." },
          banks:       { type: "array", items: { type: "string" }, description: "Bank name(s) — partial match ok, e.g. 'HBL', 'Meezan', 'Alfalah'." },
          cards:       { type: "array", items: { type: "string" }, description: "Card name(s) — partial match ok." },
          card_types:  { type: "array", items: { type: "string" }, description: "Card category: debit, credit, or other (digital wallets)." },
          city:        { type: "string", description: "City filter: karachi, lahore, islamabad, or all." },
          days:        { type: "array", items: { type: "number" }, description: "Valid-on-day filter: 0=Mon 1=Tue 2=Wed 3=Thu 4=Fri 5=Sat 6=Sun." },
          min_discount_pct: { type: "number", description: "Minimum discount percentage to include." },
          sort_by:     { type: "string", description: "Sort: discount (default), cap, restaurant, bank." },
          limit:       { type: "number", description: "Max results (default 30, max 60)." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "rank_cards",
      description: "Get cards ranked by estimated savings and restaurant coverage for a given context. Use for: best card overall, best card for specific restaurants (pass multiple for AND logic), best card for specific days, best card within a budget.",
      parameters: {
        type: "object",
        properties: {
          city:        { type: "string", description: "City: karachi, lahore, islamabad, or all." },
          bill_size:   { type: "number", description: "Typical bill size in PKR for savings estimate." },
          card_types:  { type: "array", items: { type: "string" }, description: "Restrict to these card types: debit, credit, other." },
          restaurants: { type: "array", items: { type: "string" }, description: "Only rank cards covering ALL of these restaurants (AND logic)." },
          days:        { type: "array", items: { type: "number" }, description: "Only count offers valid on these days (0=Mon...6=Sun)." },
          limit:       { type: "number", description: "Max results (default 15)." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_bank_cards",
      description: "Get all cards and deal stats for one bank or every bank. Use for: what cards does bank X have, which bank covers the most restaurants, bank-level comparisons.",
      parameters: {
        type: "object",
        properties: {
          bank: { type: "string", description: "Bank name (partial match ok). Omit to get a summary of all 19 banks." },
          city: { type: "string", description: "City filter (optional)." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_restaurant_rankings",
      description: "Get restaurants ranked by max discount, total deal count, or number of banks covering them. Use for: highest discount restaurant, most deals in a city, which places are covered by the most banks.",
      parameters: {
        type: "object",
        properties: {
          city:       { type: "string", description: "City filter (optional)." },
          card_types: { type: "array", items: { type: "string" }, description: "Card type filter (optional)." },
          sort_by:    { type: "string", description: "max_discount (default), deal_count, bank_count." },
          limit:      { type: "number", description: "Max results (default 20)." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "compare_cards",
      description: "Head-to-head comparison of 2-4 specific cards: savings estimate, restaurant coverage, day-by-day deal breakdown, caps, and eligibility side by side.",
      parameters: {
        type: "object",
        properties: {
          cards: {
            type: "array",
            items: { type: "object", properties: { bank: { type: "string" }, card: { type: "string" } } },
            description: "Array of {bank, card} pairs to compare.",
          },
          bill_size: { type: "number", description: "Bill size in PKR for savings estimates." },
          city:      { type: "string", description: "City filter (optional)." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_card_requirements",
      description: "Get eligibility requirements and annual fee details for specific cards or the current top recommendations.",
      parameters: {
        type: "object",
        properties: {
          cards: {
            type: "array",
            items: { type: "object", properties: { bank: { type: "string" }, card: { type: "string" } } },
            description: "Array of {bank, card} pairs. Omit to fetch requirements for top ranked cards.",
          },
          limit: { type: "number", description: "If cards are omitted, max top cards to return (default 5)." },
        },
      },
    },
  },
];

/* ── TOOL IMPLEMENTATIONS ── */

function chatTool_searchOffers({ restaurants, banks, cards, card_types, city, days, min_discount_pct, sort_by = "discount", limit = 30 } = {}) {
  if (!state.data?.offers) return { error: "Offers data not loaded." };
  let results = state.data.offers;
  if (city && city !== "all") {
    const c = normalizeCityValue(city);
    results = results.filter((o) => normalizeCityValue(o.city) === c);
  }
  if (restaurants?.length) results = results.filter((o) => restaurants.some((r) => fuzzyMatch(r, o.restaurant)));
  if (banks?.length)       results = results.filter((o) => banks.some((b) => fuzzyMatch(b, o.bank)));
  if (cards?.length)       results = results.filter((o) => cards.some((c) => fuzzyMatch(c, o.card)));
  if (card_types?.length)  results = results.filter((o) => card_types.includes(o.cardCategory));
  if (days?.length)        results = results.filter((o) => days.some((d) => o.days.includes(d)));
  if (min_discount_pct)    results = results.filter((o) => o.discountPct != null && o.discountPct >= min_discount_pct);
  const total = results.length;
  if (sort_by === "discount")        results = results.slice().sort((a, b) => (b.discountPct || 0) - (a.discountPct || 0));
  else if (sort_by === "cap")        results = results.slice().sort((a, b) => (b.capPkr || 0) - (a.capPkr || 0));
  else if (sort_by === "restaurant") results = results.slice().sort((a, b) => a.restaurant.localeCompare(b.restaurant));
  else if (sort_by === "bank")       results = results.slice().sort((a, b) => a.bank.localeCompare(b.bank));
  const cap = Math.min(limit, 60);
  return {
    total_matching: total, returned: Math.min(total, cap),
    offers: results.slice(0, cap).map((o) => ({
      offer_id: `${o.bank}||${o.card}||${o.restaurant}||${o.city}`.toLowerCase(),
      restaurant: o.restaurant,
      city: o.city,
      bank: o.bank,
      card: o.card,
      card_type: o.cardCategory,
      discount_pct: o.discountPct,
      cap_pkr: o.capPkr,
      valid_days: o.daysLabel,
      offer_title: o.offerTitle,
    })),
  };
}

function chatTool_rankCards({ city, bill_size, card_types, restaurants, days, limit = 15 } = {}) {
  if (!state.data?.offers) return { error: "Offers data not loaded." };
  const saved = {
    selectedCity: state.selectedCity, orderValue: state.orderValue,
    selectedCardTypes: state.selectedCardTypes, selectedRestaurants: state.selectedRestaurants,
    selectedDays: state.selectedDays,
    selectedBanks: state.selectedBanks, selectedCards: state.selectedCards,
  };
  // Chat is independent of UI filters — reset bank/card constraints so the AI
  // sees the full dataset, not whatever the user happens to have filtered.
  state.selectedBanks = new Set();
  state.selectedCards = new Set();
  if (city)               state.selectedCity = normalizeCityValue(city);
  if (bill_size)          state.orderValue = bill_size;
  if (card_types?.length) state.selectedCardTypes = new Set(card_types);
  if (days?.length)       state.selectedDays = new Set(days);
  if (restaurants?.length) {
    const allNames = [...new Set(state.data.offers.map((o) => o.restaurant))];
    state.selectedRestaurants = new Set(allNames.filter((n) => restaurants.some((r) => fuzzyMatch(r, n))));
  }
  const results = computeRecommendations().slice(0, Math.min(limit, 30));
  Object.assign(state, saved);
  return {
    ranked_cards: results.map((r, i) => {
      // Get discount stats for this card
      let cardOffers = state.data.offers.filter((o) => o.card === r.card && o.bank === r.bank);
      
      // If restaurants were specified, show stats only for those restaurants
      if (restaurants?.length && state.selectedRestaurants.size > 0) {
        cardOffers = cardOffers.filter((o) => state.selectedRestaurants.has(o.restaurant));
      }
      
      const discounts = cardOffers.map((o) => o.discountPct).filter((v) => v != null);
      const avgDiscount = discounts.length ? discounts.reduce((a, b) => a + b, 0) / discounts.length : 0;
      const caps = cardOffers.map((o) => o.capPkr).filter((v) => v != null);
      
      // When restaurants are specified, show coverage relative to those restaurants only
      let restaurantsCovered = r.coveredVenueCount;
      let totalInFilter = r.totalVenueCount;
      if (restaurants?.length && state.selectedRestaurants.size > 0) {
        const coveredRestaurants = new Set();
        cardOffers.forEach((o) => {
          if (state.selectedRestaurants.has(o.restaurant)) {
            coveredRestaurants.add(o.restaurant);
          }
        });
        restaurantsCovered = coveredRestaurants.size;
        totalInFilter = state.selectedRestaurants.size;
      }
      
      return {
        rank: i + 1, 
        card: r.card, 
        bank: r.bank, 
        card_type: r.cardCategory,
        fit_score: Number(r.score).toFixed(1),
        avg_discount_pct: Math.round(avgDiscount * 10) / 10,
        median_cap_pkr: r.medianCap || null,
        restaurants_covered: restaurantsCovered,
        total_restaurants_in_filter: totalInFilter,
        day_fit_pct: Math.round(r.avgDayFit * 100),
      };
    }),
  };
}

function chatTool_getBankCards({ bank, city } = {}) {
  if (!state.data?.offers) return { error: "Offers data not loaded." };
  let offers = state.data.offers;
  if (city && city !== "all") {
    const c = normalizeCityValue(city);
    offers = offers.filter((o) => normalizeCityValue(o.city) === c);
  }
  const allBanks = [...new Set(offers.map((o) => o.bank))].sort((a, b) => a.localeCompare(b));
  const targetBanks = bank ? allBanks.filter((b) => fuzzyMatch(bank, b)) : allBanks;
  if (bank && !targetBanks.length) return { error: `No bank found matching "${bank}". Available: ${allBanks.join(", ")}` };
  return {
    banks: targetBanks.map((bankName) => {
      const bo = offers.filter((o) => o.bank === bankName);
      const cardMap = new Map();
      bo.forEach((o) => {
        if (!cardMap.has(o.card)) cardMap.set(o.card, { card: o.card, card_type: o.cardCategory, restaurants: new Set(), discounts: new Set(), caps: [], cities: new Set() });
        const e = cardMap.get(o.card);
        e.restaurants.add(o.restaurant); e.discounts.add(o.discountLabel);
        if (o.capPkr) e.caps.push(o.capPkr); e.cities.add(o.city);
      });
      return {
        bank: bankName, total_cards: cardMap.size, total_deals: bo.length,
        unique_restaurants: new Set(bo.map((o) => o.restaurant)).size,
        cards: Array.from(cardMap.values()).map((c) => ({
          card: c.card, card_type: c.card_type, restaurants_covered: c.restaurants.size,
          discount_range: [...c.discounts].join(", "),
          avg_cap_pkr: c.caps.length ? Math.round(c.caps.reduce((a, b) => a + b, 0) / c.caps.length) : null,
          cities: [...c.cities].join(", "),
        })),
      };
    }),
  };
}

function chatTool_getRestaurantRankings({ city, card_types, sort_by = "max_discount", limit = 20 } = {}) {
  if (!state.data?.offers) return { error: "Offers data not loaded." };
  let offers = state.data.offers;
  if (city && city !== "all") {
    const c = normalizeCityValue(city);
    offers = offers.filter((o) => normalizeCityValue(o.city) === c);
  }
  if (card_types?.length) offers = offers.filter((o) => card_types.includes(o.cardCategory));
  const byRest = new Map();
  offers.forEach((o) => {
    if (!byRest.has(o.restaurant)) byRest.set(o.restaurant, { restaurant: o.restaurant, city: o.city, max_discount_pct: 0, best_deal: null, best_bank: null, best_card: null, total_deals: 0, banks: new Set() });
    const r = byRest.get(o.restaurant);
    r.total_deals++; r.banks.add(o.bank);
    if (o.discountPct != null && o.discountPct > r.max_discount_pct) {
      r.max_discount_pct = o.discountPct;
      r.best_deal = `${o.offerTitle} (${o.daysLabel}${o.capPkr ? ", cap PKR " + Number(o.capPkr).toLocaleString() : ""})`;
      r.best_bank = o.bank; r.best_card = o.card;
    }
  });
  let results = Array.from(byRest.values());
  if (sort_by === "max_discount")   results.sort((a, b) => b.max_discount_pct - a.max_discount_pct);
  else if (sort_by === "deal_count") results.sort((a, b) => b.total_deals - a.total_deals);
  else if (sort_by === "bank_count") results.sort((a, b) => b.banks.size - a.banks.size);
  return {
    restaurants: results.slice(0, Math.min(limit, 50)).map((r) => ({
      restaurant: r.restaurant, city: r.city, max_discount_pct: r.max_discount_pct,
      best_deal: r.best_deal, best_bank: r.best_bank, best_card: r.best_card,
      total_deals: r.total_deals, banks_covering: r.banks.size, banks: [...r.banks].join(", "),
    })),
  };
}

function chatTool_compareCards({ cards, bill_size, city } = {}) {
  if (!state.data?.offers) return { error: "Offers data not loaded." };
  if (!cards?.length) return { error: "No cards specified." };
  const cityFilter = normalizeCityValue(city || state.selectedCity);
  return {
    city_filter: cityFilter,
    cards: cards.map(({ bank, card }) => {
      const offers = state.data.offers.filter((o) =>
        fuzzyMatch(bank, o.bank) && fuzzyMatch(card, o.card) &&
        (cityFilter === "all" || normalizeCityValue(o.city) === cityFilter)
      );
      if (!offers.length) return { bank, card, error: "No offers found. Check bank/card name spelling." };
      const rests = new Set(offers.map((o) => o.restaurant));
      const discounts = offers.map((o) => o.discountPct).filter((v) => v != null);
      const caps = offers.map((o) => o.capPkr).filter((v) => v != null);
      const avgDiscount = discounts.length ? discounts.reduce((a, b) => a + b, 0) / discounts.length : 0;
      const avgCap = caps.length ? caps.reduce((a, b) => a + b, 0) / caps.length : null;
      const elig = evaluateEligibility(offers[0].bank, offers[0].card);
      return {
        bank: offers[0].bank, card: offers[0].card, card_type: offers[0].cardCategory,
        restaurants_covered: rests.size,
        avg_discount_pct: Math.round(avgDiscount * 10) / 10,
        avg_cap_pkr: avgCap ? Math.round(avgCap) : "no cap",
        day_breakdown: [0,1,2,3,4,5,6].map((d) => ({ day: ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][d], valid_deals: offers.filter((o) => o.days.includes(d)).length })),
        salary_required_pkr: elig.salaryReq, balance_required_pkr: elig.balanceReq,
        annual_fee_pkr: elig.annualFeePkr, fee_waiver: elig.annualFeeWaiverRule || null,
        sample_restaurants: [...rests].slice(0, 8),
      };
    }),
  };
}

function resolveCanonicalCardPair(bank, card) {
  const match = state.data?.offers?.find((o) => fuzzyMatch(bank, o.bank) && fuzzyMatch(card, o.card));
  return {
    bank: match?.bank || bank,
    card: match?.card || card,
  };
}

function chatTool_getCardRequirements({ cards, limit = 5 } = {}) {
  if (!state.requirements?.available) {
    return { error: "Card requirements data unavailable." };
  }
  let candidates;
  if (Array.isArray(cards) && cards.length) {
    candidates = cards.map(({ bank, card }) => resolveCanonicalCardPair(bank, card));
  } else {
    const savedBanks = state.selectedBanks;
    const savedCards = state.selectedCards;
    state.selectedBanks = new Set();
    state.selectedCards = new Set();
    candidates = computeRecommendations().slice(0, Math.min(limit, 8)).map((r) => ({ bank: r.bank, card: r.card }));
    state.selectedBanks = savedBanks;
    state.selectedCards = savedCards;
  }

  return {
    cards: candidates.map(({ bank, card }) => {
      const status = evaluateEligibility(bank, card);
      return {
        bank,
        card,
        status: status.status,
        status_label: status.label,
        salary_required_pkr: status.salaryReq,
        balance_required_pkr: status.balanceReq,
        annual_fee_pkr: status.annualFeePkr,
        fee_waiver: status.annualFeeWaiverRule || null,
        requirements: status.criteria || [],
        is_estimated: !!status.isEstimated,
        estimation_note: status.estimationNote || null,
      };
    }),
  };
}

function compactToolResultForModel(name, result) {
  if (!result || result.error) return result;
  if (name === "search_offers") {
    return {
      total_matching: result.total_matching,
      returned: result.returned,
      offers: (result.offers || []).slice(0, 20),
    };
  }
  if (name === "rank_cards") {
    return { ranked_cards: (result.ranked_cards || []).slice(0, 12) };
  }
  if (name === "get_restaurant_rankings") {
    return { restaurants: (result.restaurants || []).slice(0, 20) };
  }
  if (name === "get_bank_cards") {
    return {
      banks: (result.banks || []).slice(0, 8).map((b) => ({
        bank: b.bank,
        total_cards: b.total_cards,
        total_deals: b.total_deals,
        unique_restaurants: b.unique_restaurants,
        cards: (b.cards || []).slice(0, 8),
      })),
    };
  }
  if (name === "compare_cards") {
    return { bill_size_pkr: result.bill_size_pkr, city_filter: result.city_filter, cards: (result.cards || []).slice(0, 4) };
  }
  if (name === "get_card_requirements") {
    return {
      cards: (result.cards || []).map((c) => ({
        bank: c.bank,
        card: c.card,
        status: c.status,
        status_label: c.status_label,
        salary_required_pkr: c.salary_required_pkr,
        balance_required_pkr: c.balance_required_pkr,
        annual_fee_pkr: c.annual_fee_pkr,
        fee_waiver: c.fee_waiver,
      })),
    };
  }
  return result;
}

function executeChatTool(name, args) {
  try {
    switch (name) {
      case "search_offers":           return chatTool_searchOffers(args);
      case "rank_cards":              return chatTool_rankCards(args);
      case "get_bank_cards":          return chatTool_getBankCards(args);
      case "get_restaurant_rankings": return chatTool_getRestaurantRankings(args);
      case "compare_cards":           return chatTool_compareCards(args);
      case "get_card_requirements":   return chatTool_getCardRequirements(args);
      default: return { error: `Unknown tool: ${name}` };
    }
  } catch (e) {
    return { error: `Tool error: ${e.message}` };
  }
}

/* ── System prompt ── */
function buildSystemPrompt() {
  const cityLabel = state.selectedCity === "all" ? "all cities (Karachi, Lahore, Islamabad)" : state.selectedCity;
  const userCtx = `City: ${cityLabel}`;

  // Compute top 3 independent of UI bank/card filters so the AI sees the full dataset.
  // JS is single-threaded so the mutation+restore is safe, but try/finally guarantees
  // state is always restored even if computeRecommendations throws.
  const savedBanks = state.selectedBanks;
  const savedCards = state.selectedCards;
  let top3 = [];
  try {
    state.selectedBanks = new Set();
    state.selectedCards = new Set();
    top3 = computeRecommendations().slice(0, 3);
  } finally {
    state.selectedBanks = savedBanks;
    state.selectedCards = savedCards;
  }

  const top3text = top3.length
    ? `TOP CARDS (city context only):\n` +
      top3.map((r, i) => `${i + 1}. ${r.card} (${r.bank}) — ${Math.round((r.averageDiscount || 0) * 10) / 10}% avg discount`).join("\n")
    : "No cards available.";

  return `You are KonsaCard AI, the expert assistant for konsacard.pk — Pakistan's independent restaurant discount card comparison tool.

USER CONTEXT:
${userCtx}

${top3text}

## QUESTION TYPES — identify which applies, then follow the strategy:

**LOOKUP** — specific fact ("what discount does HBL give at Hardee's?", "which days is this deal valid?")
→ Call the most relevant tool and present the data directly.
→ Best tools: search_offers (offer-level detail), get_bank_cards, get_card_requirements.

**RECOMMENDATION** — best-fit query ("best card for me?", "best card at X?", "best card on Fridays?")
→ Call rank_cards with all relevant filters. Pass restaurant name(s) if mentioned, pass days if mentioned.
→ Optionally follow with get_card_requirements if eligibility hasn't been shown yet.
→ Present top 2-3 options with specific discount %, cap, and a one-line reason each fits.

**COMPARISON** — head-to-head ("HBL vs MCB", "debit vs credit for dining?")
→ For specific cards: call compare_cards.
→ For type-level comparison (debit vs credit): call rank_cards twice with card_types filter and contrast the results.
→ Highlight the single deciding factor clearly.

**ADVISORY** — judgment or strategy ("is a premium card worth it?", "how do caps affect me?", "should I get two cards?")
→ Answer from domain knowledge. Pull one grounding data point with a tool only if it sharpens the answer.
→ Give a direct recommendation; explain the key tradeoff in one sentence.

**OVERVIEW/BROAD** — landscape question ("which bank has the most deals?", "best restaurants for discounts?", "which city has the most offers?")
→ Call get_bank_cards (omit bank param for all banks), get_restaurant_rankings, or rank_cards without a restaurant filter.
→ Summarize the pattern — top 3-4 entries with the key distinguishing stat, not every row.

## TOOLS (never answer data questions from memory — always call a tool):
* search_offers — offer-level detail; filters by restaurant, bank, card, day, discount threshold
* rank_cards — cards scored by savings + coverage; use restaurants/days/city params to narrow
* get_bank_cards — bank-level card inventory and coverage stats across restaurants
* get_restaurant_rankings — restaurants ranked by max discount, deal count, or bank coverage
* compare_cards — head-to-head comparison of 2-4 cards
* get_card_requirements — eligibility (salary/balance), annual fee, and waiver conditions

## CONSTANTS:
- Fit Score (0-100) = savings 70% + coverage 20% + day fit 10%
- Monthly savings estimate = per-outing saving × outings/week × 4.3
- Fuzzy matching is built in — "Xanders" finds "Xander's", "hbl" finds "HBL"
- Always use PKR for amounts. Always name the specific card and bank.
- Personalize savings ("at PKR 5,000 that's PKR 750 off") ONLY if the user stated their bill size. Otherwise give the % and cap only.
- If no data exists for a query, say so and suggest checking with the bank directly.`;
}


class GeminiError extends Error {
  constructor(message, status, reason) {
    super(message);
    this.status = status;
    this.reason = reason;
  }
}

/* ── Retry helper: retries on network errors and 5xx/429 with backoff ── */
async function withRetry(fn, { maxAttempts = 3, signal } = {}) {
  let lastErr;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    try {
      return await fn();
    } catch (err) {
      if (err.name === "AbortError") throw err;
      lastErr = err;
      const retryable = !(err instanceof GeminiError) || err.status === 429 || err.status >= 500;
      if (!retryable || attempt === maxAttempts - 1) throw err;
      const delay = err instanceof GeminiError && err.status === 429 ? 3000 : 1000 * (attempt + 1);
      await new Promise((res) => setTimeout(res, delay));
    }
  }
  throw lastErr;
}

/* ── Gemini streaming generator (Gemini SSE format) ── */
async function* streamGemini(messages, systemPrompt, signal, maxTokens = 1000) {
  const resp = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, systemPrompt, stream: true, maxTokens }),
    signal,
  });

  if (!resp.ok) {
    let msg = `Chat error ${resp.status}`, reason;
    try { const b = await resp.json(); msg = b?.error || msg; reason = b?.reason; } catch { /* ignore */ }
    throw new GeminiError(msg, resp.status, reason);
  }

  // Get token estimate from response if available
  const tokenEstimate = resp.headers.get("X-Token-Estimate");
  // (Token logging kept in backend server logs only)

  const reader = resp.body.getReader();
  const dec = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        // Extract text from Gemini response format
        if (parsed?.candidates?.[0]?.content?.parts) {
          for (const part of parsed.candidates[0].content.parts) {
            if (part.text) yield part.text;
          }
        }
      } catch { /* skip malformed chunk */ }
    }
  }
}

/* ── Non-streaming Gemini call (used for tool resolution loop) ── */
async function callGeminiNonStreaming(messages, systemPrompt, signal, maxTokens = 700, firstCall = false) {
  const resp = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, systemPrompt, stream: false, maxTokens, firstCall }),
    signal,
  });
  if (!resp.ok) {
    let msg = `Chat error ${resp.status}`, reason;
    try { const b = await resp.json(); msg = b?.error || msg; reason = b?.reason; } catch { /* ignore */ }
    throw new GeminiError(msg, resp.status, reason);
  }
  const data = await resp.json();
  
  // Convert Gemini response to OpenAI-compatible format for rest of code
  if (data?.candidates?.[0]) {
    const candidate = data.candidates[0];
    const content = candidate.content?.parts?.map((p) => p.text || "").join("") || "";
    const toolCalls = [];
    
    if (candidate.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.functionCall) {
          toolCalls.push({
            type: "function",
            function: {
              name: part.functionCall.name,
              arguments: JSON.stringify(part.functionCall.args || {}),
            },
          });
        }
      }
    }
    
    data.choices = [
      {
        message: {
          role: "assistant",
          content,
          tool_calls: toolCalls.length ? toolCalls : undefined,
        },
      },
    ];
  }
  
  return data;
}

/* ── Convert internal message history to OpenAI messages format ── */
function truncateModelMessage(text, maxChars = 900) {
  if (!text || text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n[truncated for context budget]`;
}

function trimOpenAiMessages(messages, { maxMessages = 16, maxChars = 14000 } = {}) {
  const kept = [];
  let used = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const row = messages[i];
    const len = JSON.stringify(row).length;
    if (kept.length && (kept.length >= maxMessages || used + len > maxChars)) break;
    kept.push(row);
    used += len;
  }
  const normalized = kept.reverse();
  const firstUser = normalized.findIndex((m) => m.role === "user");
  return firstUser > 0 ? normalized.slice(firstUser) : normalized;
}

/* ── Open / close ── */
function openChat() {
  const panel = document.getElementById("chat-panel");
  const fab   = document.getElementById("chat-fab");
  if (panel) panel.style.display = "flex";
  if (fab)   fab.style.display   = "none";

  if (state.chatMessages.length === 0) {
    const cityLabel = state.selectedCity === "all" ? "all cities" : state.selectedCity;
    state.chatMessages = [{
      role: "bot",
      text: `Hi! I'm KonsaCard AI. I can see you're browsing ${cityLabel} deals — ask me anything about restaurant discounts, card comparisons, or eligibility. 💳`,
    }];
  }
  renderChatBody();
}

function closeChat() {
  const panel = document.getElementById("chat-panel");
  const fab   = document.getElementById("chat-fab");
  if (panel) panel.style.display = "none";
  if (fab)   fab.style.display   = "";
}


/* ── Main chat body render ── */
function renderChatBody() {
  const msgs = document.getElementById("chat-msgs");
  const inputWrap = document.querySelector(".chat-input-wrap");
  if (!msgs) return;
  if (inputWrap) inputWrap.style.display = "";

  msgs.innerHTML = "";

  state.chatMessages.forEach((msg, idx) => {
    if (msg.role === "system") return;
    const row = document.createElement("div");
    row.className = `msg-row ${msg.role}`;
    row.dataset.idx = String(idx);

    const bubble = document.createElement("div");
    bubble.className = `bubble ${msg.role}`;
    if (msg.streaming) bubble.classList.add("streaming");
    bubble.innerHTML = formatBubbleText(msg.text);

    if (msg.retryText) {
      const retryBtn = document.createElement("button");
      retryBtn.className = "chat-retry-btn";
      retryBtn.textContent = "Retry";
      retryBtn.addEventListener("click", () => {
        const retryText = msg.retryText;
        // Remove the failed bot message and re-send
        state.chatMessages = state.chatMessages.filter((m) => m !== msg);
        // Also remove the user message that preceded it
        const lastUser = [...state.chatMessages].reverse().find((m) => m.role === "user");
        if (lastUser) state.chatMessages = state.chatMessages.filter((m) => m !== lastUser);
        sendChatMessage(retryText);
      });
      bubble.appendChild(retryBtn);
    }

    row.appendChild(bubble);
    msgs.appendChild(row);
  });

  if (state.chatLoading && !state.chatMessages.some((m) => m.streaming)) {
    const row = document.createElement("div");
    row.className = "msg-row bot";
    row.innerHTML = `<div class="bubble bot typing-dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>`;
    msgs.appendChild(row);
  }

  const visibleMsgs = state.chatMessages.filter((m) => m.role !== "system");
  const lastVisible = visibleMsgs[visibleMsgs.length - 1];
  if (lastVisible?.role === "bot" && !lastVisible.streaming && !state.chatLoading) {
    const isGreeting = visibleMsgs.length === 1;
    const chips = isGreeting ? getContextualQuickQuestions() : getFollowUpChips();
    if (chips.length) {
      const qcWrap = document.createElement("div");
      qcWrap.className = "quick-chips";
      chips.forEach((q) => {
        const btn = document.createElement("button");
        btn.className = "quick-chip";
        btn.textContent = q;
        btn.addEventListener("click", () => sendChatMessage(q));
        qcWrap.appendChild(btn);
      });
      msgs.appendChild(qcWrap);
    }
  }

  msgs.scrollTop = msgs.scrollHeight;
}

/* Update just the last streaming bubble without full re-render */
function updateStreamingBubble(text, slow = false) {
  const msgs = document.getElementById("chat-msgs");
  if (!msgs) return;
  const bubbles = msgs.querySelectorAll(".bubble.bot.streaming");
  const last = bubbles[bubbles.length - 1];
  if (!last) return;
  if (slow && !text) {
    last.innerHTML = `<span class="chat-slow-hint">Taking a moment…</span>`;
  } else {
    last.innerHTML = formatBubbleText(text);
  }
  msgs.scrollTop = msgs.scrollHeight;
}

/* Markdown: **bold**, ## headers, bullet + numbered lists, line breaks */
function formatBubbleText(text) {
  if (!text) return "";
  let html = escapeHtml(text);
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // Headers (### and ##)
  html = html.replace(/^###\s+(.+)$/gm, "<strong>$1</strong>");
  html = html.replace(/^##\s+(.+)$/gm, "<strong><u>$1</u></strong>");
  // Numbered list items: "1. text"
  html = html.replace(/^\d+\.\s+(.+)$/gm, "<li>$1</li>");
  // Bullet list items: "- text" or "• text" or "* text"
  html = html.replace(/^[-•*]\s+(.+)$/gm, "<li>$1</li>");
  // Wrap consecutive <li> blocks in <ul> (non-greedy, respects breaks between lists)
  html = html.replace(/((?:<li>[^\n]*<\/li>\n?)+)/g, "<ul>$1</ul>");
  // Line breaks (after list processing so <br> doesn't break list grouping)
  html = html.replace(/\n/g, "<br>");
  return html;
}

/* ── In-flight abort controller ── */
let _chatAbort = null;

/* ── Send message with tool-calling loop + streaming final answer ── */
async function sendChatMessage(text) {
  const t = (text || "").trim();
  if (!t || state.chatLoading) return;

  // Cancel any previous in-flight request
  if (_chatAbort) { _chatAbort.abort(); _chatAbort = null; }
  const abort = new AbortController();
  _chatAbort = abort;
  const { signal } = abort;

  const input = document.getElementById("chat-input");
  if (input) input.value = "";

  state.chatMessages.push({ role: "user", text: t });
  state.chatLoading = true;
  renderChatBody();

  const systemPrompt = buildSystemPrompt();
  const streamingMsg = { role: "bot", text: "", streaming: true };
  state.chatMessages.push(streamingMsg);
  renderChatBody();

  // Show "still thinking" hint if first token takes > 9s
  const slowTimer = setTimeout(() => {
    if (streamingMsg.streaming && !streamingMsg.text) {
      updateStreamingBubble("", true);
    }
  }, 9000);

  // Overall 50s hard timeout
  const timeoutTimer = setTimeout(() => abort.abort(), 50000);

  const queryStartTime = Date.now();

  try {
    // Start from the persisted API message history (includes prior tool call/result turns),
    // then append the new user message.
    let messages = trimOpenAiMessages([
      ...state.chatApiMessages,
      { role: "user", content: t },
    ]);
    let directText = "";
    let toolsUsed = false;
    const MAX_TOOL_ROUNDS = 4;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const data = await withRetry(
        () => callGeminiNonStreaming(messages, systemPrompt, signal, 1200, round === 0),
        { maxAttempts: 3, signal }
      );
      const msg   = data?.choices?.[0]?.message;
      const toolCalls = msg?.tool_calls || [];

      if (!toolCalls.length) {
        if (!toolsUsed) directText = msg?.content || "";
        break;
      }

      toolsUsed = true;
      // Append assistant's tool-call message, then each tool result
      const toolResults = toolCalls.map((tc) => ({
        role: "tool",
        tool_call_id: tc.id,
        name: tc.function.name,
        content: JSON.stringify(compactToolResultForModel(
          tc.function.name,
          executeChatTool(tc.function.name, JSON.parse(tc.function.arguments || "{}"))
        )),
      }));
      messages = [
        ...messages,
        { role: "assistant", content: msg.content || null, tool_calls: toolCalls },
        ...toolResults,
      ];
      messages = trimOpenAiMessages(messages);
    }

    let finalText = "";
    if (directText) {
      // Stream word-by-word so direct answers feel consistent with tool-backed ones.
      finalText = directText;
      const words = finalText.split(" ");
      let built = "";
      for (const word of words) {
        if (signal.aborted) break;
        built += (built ? " " : "") + word;
        streamingMsg.text = built;
        updateStreamingBubble(built);
        await new Promise((r) => setTimeout(r, 18));
      }
      streamingMsg.text = finalText;
      streamingMsg.streaming = false;
    } else {
      for await (const chunk of streamGemini(messages, systemPrompt, signal, 1600)) {
        finalText += chunk;
        streamingMsg.text = finalText;
        updateStreamingBubble(finalText);
      }
      streamingMsg.text = finalText || "…";
      streamingMsg.streaming = false;
    }

    // Persist the full message exchange (including tool history) for the next turn
    state.chatApiMessages = trimOpenAiMessages([
      ...messages,
      { role: "assistant", content: finalText || streamingMsg.text },
    ]);
  } catch (err) {
    streamingMsg.streaming = false;
    if (err.name === "AbortError") {
      // Timed out or superseded by new message — remove the empty bubble
      state.chatMessages = state.chatMessages.filter((m) => m !== streamingMsg);
      if (signal.aborted && !_chatAbort?.signal.aborted) return; // superseded, new message handling it
      streamingMsg.text = "⚠️ Request timed out. Please try again.";
      state.chatMessages.push(streamingMsg);
    } else if (err instanceof GeminiError && (err.status === 400 || err.status === 403)) {
      streamingMsg.text = "⚠️ Chat configuration error. Please try again later.";
    } else if (err instanceof GeminiError && err.status === 429) {
      streamingMsg.text = err.reason === "daily"
        ? "You're officially today's most curious user! 🏆 I've hit my daily limit but I'll be fully recharged tomorrow — come back then and let's keep finding you great deals! 💳"
        : "You're on a roll! 🔥 I need a quick hourly breather — check back in a bit and let's keep going! 💳";
    } else if (err instanceof GeminiError && err.status >= 500) {
      streamingMsg.text = "⚠️ Chat service is temporarily unavailable. Please try again shortly.";
    } else {
      streamingMsg.text = "⚠️ Connection error. Check your internet and try again.";
    }
    streamingMsg.retryText = t;
  } finally {
    clearTimeout(slowTimer);
    clearTimeout(timeoutTimer);
    if (_chatAbort === abort) _chatAbort = null;
  }

  state.chatLoading = false;
  renderChatBody();
}

/* ── Clear conversation ── */
function clearChat() {
  state.chatMessages = [];
  state.chatApiMessages = [];
  state.chatLoading = false;
  openChat();
}


/* ── CONTEXTUAL CHAT CHIPS ── */
function getContextualQuickQuestions() {
  const results = computeRecommendations();
  if (!results.length) {
    return ["What filters should I try?", "How does the Fit Score work?", "Best low-fee cards?", "Debit cards only?"];
  }
  const top = results[0];
  const chips = [`Why is ${top.card} ranked #1?`];
  if (results.length >= 2) chips.push(`Compare ${top.card} vs ${results[1].card}`);
  if (top.topMatches.length > 0) chips.push(`Best deal at ${top.topMatches[0].restaurant}?`);
  chips.push("What's the highest discount %?");
  return chips.slice(0, 4);
}

/* ── FOLLOW-UP CHIPS after each bot turn ── */
function getFollowUpChips() {
  const results = computeRecommendations();
  if (!results.length) {
    return ["Change city filter?", "How does the Fit Score work?", "Best low-fee cards?"];
  }
  const top = results[0];
  const asked = state.chatMessages
    .filter((m) => m.role === "user")
    .map((m) => m.text.toLowerCase());

  const POOL = [
    {
      text: `What's my estimated monthly saving with ${top.card.split(" ").slice(-2).join(" ")}?`,
      skip: asked.some((a) => a.includes("month") || a.includes("saving")),
    },
    {
      text: `What are the eligibility requirements for the top card?`,
      skip: asked.some((a) => a.includes("eligib") || a.includes("salary") || a.includes("fee")),
    },
    {
      text: results.length >= 2 ? `Compare ${top.card} vs ${results[1].card}` : null,
      skip: asked.some((a) => a.includes("compar") || a.includes(" vs ")),
    },
    {
      text: top.topMatches[0] ? `All deals at ${top.topMatches[0].restaurant}?` : null,
      skip: top.topMatches[0] && asked.some((a) => a.includes(top.topMatches[0].restaurant.toLowerCase().split(" ")[0])),
    },
    {
      text: "Which card has the highest discount cap?",
      skip: asked.some((a) => a.includes("discount cap") || a.includes("highest discount")),
    },
    {
      text: "Which card works best on weekends?",
      skip: asked.some((a) => a.includes("weekend") || a.includes("saturday") || a.includes("sunday")),
    },
    {
      text: "Show me debit cards only?",
      skip: state.selectedCardTypes.has("debit") || asked.some((a) => a.includes("debit")),
    },
  ];

  return POOL
    .filter((c) => c.text && !c.skip)
    .map((c) => c.text)
    .slice(0, 3);
}

