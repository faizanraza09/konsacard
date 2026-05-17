// @ts-check
/* ── BUILD WALLET RECOMMENDATIONS ──
   Greedy K-card selection. Repeatedly pick the card that adds the most
   marginal saving on top of what the current wallet already gives. This
   solves the "best 2 / 3 / 4 cards together" problem that Next Card can't
   answer (Next Card is one-step greedy from a fixed starting wallet).

   Greedy is near-optimal here because the objective (sum of per-(venue,day)
   max saving over wallet cards) is monotone submodular. For extra polish
   we also generate alternative wallets by branching from the 2nd / 3rd
   best first picks.

   This module is a pure-ish set of functions: it reads state and calls a
   few helpers (cityMatches, getEffectiveSelectedDays, evaluateEligibility,
   formatCurrency, getOfferSavingValue, buildCardKey) that live in app.js.
   Loaded before app.js via <script defer> tags — function resolution
   happens at call time, after both files have executed.
*/

// Precompute card -> venue -> day -> best saving for the current scope.
// Used by both wallet greedy and downstream stats.
function precomputeCardSavingsByVenueDay(scopeOffers, selectedDays, orderValue) {
  const out = new Map();
  scopeOffers.forEach((offer) => {
    const saving = getOfferSavingValue(offer, orderValue);
    if (!Number.isFinite(saving) || saving <= 0) return;
    const cardKey = buildCardKey(offer.bank, offer.card);
    const venueKey = `${offer.city} || ${offer.restaurant}`;
    let venueMap = out.get(cardKey);
    if (!venueMap) {
      venueMap = { bank: offer.bank, card: offer.card, cardCategory: offer.cardCategory || null, venues: new Map() };
      out.set(cardKey, venueMap);
    }
    if (!venueMap.cardCategory && offer.cardCategory) venueMap.cardCategory = offer.cardCategory;
    let dayMap = venueMap.venues.get(venueKey);
    if (!dayMap) { dayMap = new Map(); venueMap.venues.set(venueKey, dayMap); }
    selectedDays.forEach((day) => {
      if (!offer.days.includes(day)) return;
      const prev = dayMap.get(day) || 0;
      if (saving > prev) dayMap.set(day, saving);
    });
  });
  return out;
}

// Given current best saving per (venue,day), compute marginal value of adding cardKey.
// Returns: { delta (sum over venues/days), boostedVenues, newVenues, coveredVenues }
function marginalForCard(cardEntry, currentBest) {
  let delta = 0;
  let boosted = 0;
  let unlocked = 0;
  let coveredByCandidate = 0;
  cardEntry.venues.forEach((dayMap, venueKey) => {
    let venueImproves = false;
    let venueWasUncovered = true;
    const cur = currentBest.get(venueKey);
    if (cur) {
      for (const v of cur.values()) {
        if (v > 0) { venueWasUncovered = false; break; }
      }
    }
    dayMap.forEach((s, day) => {
      const curVal = cur ? (cur.get(day) || 0) : 0;
      if (s > curVal) {
        delta += (s - curVal);
        venueImproves = true;
      }
    });
    if (venueImproves) {
      coveredByCandidate += 1;
      if (venueWasUncovered) unlocked += 1; else boosted += 1;
    }
  });
  return { delta, boostedVenues: boosted, newVenues: unlocked, coveredVenues: coveredByCandidate };
}

function applyCardToCurrentBest(cardEntry, currentBest) {
  cardEntry.venues.forEach((dayMap, venueKey) => {
    let cur = currentBest.get(venueKey);
    if (!cur) { cur = new Map(); currentBest.set(venueKey, cur); }
    dayMap.forEach((s, day) => {
      if (s > (cur.get(day) || 0)) cur.set(day, s);
    });
  });
}

// Snapshot stats for a finished wallet given the resulting currentBest map.
function summarizeWallet(currentBest, totalSelectedDays, venueCount) {
  let totalDailyBest = 0;
  let coveredVenues = 0;
  currentBest.forEach((dayMap) => {
    let any = false;
    dayMap.forEach((s) => { if (s > 0) { totalDailyBest += s; any = true; } });
    if (any) coveredVenues += 1;
  });
  const perOutingTotal = coveredVenues > 0 ? totalDailyBest / (coveredVenues * Math.max(1, totalSelectedDays)) : 0;
  const coverage = venueCount > 0 ? coveredVenues / venueCount : 0;
  return { perOutingTotal, coverage, coveredVenues };
}

function annualFeeForCard(bank, card) {
  const status = evaluateEligibility(bank, card);
  return Number.isFinite(status?.annualFeePkr) ? status.annualFeePkr : null;
}

function computeWalletRecommendations() {
  if (!state.data) return { ranked: [], stats: { venueCount: 0, candidateCount: 0, warnings: [] } };

  const K = Math.max(2, Math.min(4, Number(state.walletSize) || 2));
  const selectedDays = getEffectiveSelectedDays();
  const totalSelectedDays = selectedDays.size || 1;
  const buildOnOwned = !!state.walletBuildOnOwned && state.ownedCards.size > 0;
  const objective = state.walletObjective || "savings";
  const noSameBank = !!state.walletNoSameBank;
  const requireMixedTypes = !!state.walletMixedTypes;
  const maxFee = (Number.isFinite(state.walletMaxFee) && state.walletMaxFee >= 0) ? state.walletMaxFee : null;
  const outingsPerYear = (state.outingsPerWeek || 1) * 52;
  const warnings = [];

  // Scope: same filters as Next Card
  const scopeOffers = state.data.offers.filter((offer) => {
    if (!cityMatches(offer.city)) return false;
    if (state.selectedRestaurants.size > 0 && !state.selectedRestaurants.has(offer.restaurant)) return false;
    return true;
  });
  const venuesInScope = new Set();
  scopeOffers.forEach((o) => venuesInScope.add(`${o.city} || ${o.restaurant}`));
  const venueCount = venuesInScope.size;
  if (!venueCount) return { ranked: [], stats: { venueCount: 0, candidateCount: 0, warnings } };

  const cardIndex = precomputeCardSavingsByVenueDay(scopeOffers, selectedDays, state.orderValue);

  // Eligibility precompute
  const hasEligibilityInput = state.monthlySalary !== null || state.accountBalance !== null;
  const eligibilityCache = new Map();
  cardIndex.forEach((entry, key) => {
    const status = evaluateEligibility(entry.bank, entry.card);
    eligibilityCache.set(key, status);
  });

  function feeFor(cardKey) {
    const s = eligibilityCache.get(cardKey);
    const f = s?.annualFeePkr;
    return Number.isFinite(f) ? f : null;
  }

  // Filter by bank / card-type / eligibility (must-include cards bypass these)
  function isCandidate(cardKey, entry) {
    if (state.selectedBanks.size > 0 && !state.selectedBanks.has(entry.bank)) return false;
    if (state.selectedCardTypes.size > 0 && !state.selectedCardTypes.has(entry.cardCategory)) return false;
    if (state.useEligibility && hasEligibilityInput) {
      const status = eligibilityCache.get(cardKey);
      if (status?.status === "ineligible") return false;
    }
    return true;
  }

  function buildInitialCurrentBest() {
    const cb = new Map();
    if (!buildOnOwned) return cb;
    state.ownedCards.forEach((ck) => {
      const entry = cardIndex.get(ck);
      if (entry) applyCardToCurrentBest(entry, cb);
    });
    return cb;
  }
  const ownedExclusion = buildOnOwned ? state.ownedCards : new Set();

  // Score a candidate by the chosen objective.
  // - savings: marginal delta sum (gross saving improvement)
  // - coverage: number of venues the candidate helps (new + boosted)
  // - roi:     annualized net value (gross yearly improvement - annual fee)
  function scoreCandidate(marginal, cardKey) {
    if (marginal.delta <= 0) return -Infinity;
    if (objective === "coverage") return marginal.coveredVenues;
    if (objective === "roi") {
      // Yearly value of this card's marginal contribution.
      // marginalDelta = sum over selected days of saving improvement at covered venues.
      // Normalize to one outing, scaled by outings/year and hit-rate (coveredByCard / venueCount).
      const perOutingAtCoveredVenue = marginal.delta / Math.max(1, marginal.coveredVenues * totalSelectedDays);
      const hitRate = marginal.coveredVenues / Math.max(1, venueCount);
      const yearlyValue = perOutingAtCoveredVenue * hitRate * outingsPerYear;
      const fee = feeFor(cardKey) || 0;
      return yearlyValue - fee;
    }
    return marginal.delta; // savings
  }

  // Mixed-type feasibility helper.
  // Returns true if the candidate's category is allowed given remaining slots
  // and which mandatory categories (debit/credit) are still needed.
  function passesMixedTypeConstraint(entry, slotsLeft, missingMandatory) {
    if (!requireMixedTypes || missingMandatory.length === 0) return true;
    const freeSlots = slotsLeft - missingMandatory.length;
    if (freeSlots <= 0) {
      return missingMandatory.includes(entry.cardCategory || "other");
    }
    return true;
  }

  function computeMissingMandatory(categoriesPicked) {
    if (!requireMixedTypes) return [];
    const need = [];
    if (!categoriesPicked.has("debit"))  need.push("debit");
    if (!categoriesPicked.has("credit")) need.push("credit");
    return need;
  }

  // Run greedy from a given "forced first greedy pick" (or null for normal).
  // Must-include cards always go in first regardless.
  function greedyRun(forcedFirstKey) {
    const currentBest = buildInitialCurrentBest();
    const pickedKeys = new Set();
    const banksUsed = new Set();
    const categoriesPicked = new Set();
    const picks = [];
    let runningFee = 0;
    let feeBudgetBreached = false;

    function recordPick(cardKey, entry, marginal, pinned) {
      pickedKeys.add(cardKey);
      banksUsed.add(entry.bank);
      categoriesPicked.add(entry.cardCategory || "other");
      const fee = feeFor(cardKey);
      if (Number.isFinite(fee)) runningFee += fee;
      applyCardToCurrentBest(entry, currentBest);
      picks.push({
        cardKey,
        bank: entry.bank,
        card: entry.card,
        cardCategory: entry.cardCategory,
        marginalDelta: marginal.delta,
        boostedVenues: marginal.boostedVenues,
        newVenues: marginal.newVenues,
        coveredByCard: marginal.coveredVenues,
        requirementStatus: eligibilityCache.get(cardKey),
        pinned: !!pinned,
      });
    }

    // 1) Must-include cards seed the wallet (up to K slots).
    //    Must-includes override candidate filters (bank/type/eligibility) and fee budget —
    //    they are the user's explicit choice. Owned anchors take priority over must-includes
    //    that duplicate them.
    const mustList = Array.from(state.walletMustInclude).filter((ck) => !ownedExclusion.has(ck));
    for (const ck of mustList) {
      if (picks.length >= K) break;
      const entry = cardIndex.get(ck);
      if (!entry) continue; // out of scope; skip silently
      const m = marginalForCard(entry, currentBest);
      recordPick(ck, entry, m, true);
    }

    // 2) Optional forced first greedy pick (used to seed alternative wallets)
    if (forcedFirstKey && picks.length < K) {
      if (pickedKeys.has(forcedFirstKey)) {
        // already pinned via must-include — proceed with greedy normally
      } else {
        const entry = cardIndex.get(forcedFirstKey);
        if (!entry || ownedExclusion.has(forcedFirstKey) || !isCandidate(forcedFirstKey, entry)) {
          return null; // forced first infeasible
        }
        // Check mandatory constraints
        const missing = computeMissingMandatory(categoriesPicked);
        if (!passesMixedTypeConstraint(entry, K - picks.length, missing)) return null;
        if (noSameBank && banksUsed.has(entry.bank)) return null;
        const fee = feeFor(forcedFirstKey) || 0;
        if (maxFee !== null && runningFee + fee > maxFee) return null;
        const m = marginalForCard(entry, currentBest);
        if (m.delta <= 0) return null;
        recordPick(forcedFirstKey, entry, m, false);
      }
    }

    // 3) Greedy fill remaining slots
    while (picks.length < K) {
      const slotsLeft = K - picks.length;
      const missing = computeMissingMandatory(categoriesPicked);
      let bestKey = null, bestEntry = null, bestMarg = null, bestScore = -Infinity;
      cardIndex.forEach((entry, key) => {
        if (pickedKeys.has(key)) return;
        if (ownedExclusion.has(key)) return;
        if (!isCandidate(key, entry)) return;
        if (noSameBank && banksUsed.has(entry.bank)) return;
        if (!passesMixedTypeConstraint(entry, slotsLeft, missing)) return;
        const fee = feeFor(key) || 0;
        if (maxFee !== null && runningFee + fee > maxFee) return;
        const m = marginalForCard(entry, currentBest);
        const sc = scoreCandidate(m, key);
        if (sc <= 0) return;
        if (sc > bestScore) {
          bestScore = sc; bestKey = key; bestEntry = entry; bestMarg = m;
        }
      });
      if (!bestKey) break;
      recordPick(bestKey, bestEntry, bestMarg, false);
    }

    if (picks.length === 0) return null;

    const summary = summarizeWallet(currentBest, totalSelectedDays, venueCount);
    let totalAnnualFee = 0;
    let feeUnknown = false;
    picks.forEach((p) => {
      const fee = p.requirementStatus?.annualFeePkr;
      if (fee === null || fee === undefined) feeUnknown = true;
      else if (Number.isFinite(fee)) totalAnnualFee += fee;
    });
    if (maxFee !== null && totalAnnualFee > maxFee) feeBudgetBreached = true;

    // Mixed-type satisfaction check
    const mixedTypeSatisfied = !requireMixedTypes || (categoriesPicked.has("debit") && categoriesPicked.has("credit"));

    return {
      picks,
      perOutingTotal: summary.perOutingTotal,
      coverage: summary.coverage,
      coveredVenues: summary.coveredVenues,
      venueCount,
      totalAnnualFee,
      feeUnknown,
      feeBudgetBreached,
      mixedTypeSatisfied,
      walletKey: picks.map((p) => p.cardKey).sort().join(" | "),
    };
  }

  // Surface algorithm warnings
  if (state.walletMustInclude.size > K) {
    warnings.push(`Pinned ${state.walletMustInclude.size} cards but wallet size is ${K}. Only the first ${K} are used. Increase wallet size to include all.`);
  }
  if (requireMixedTypes && K < 2) {
    warnings.push(`Mixed-type rule needs wallet size of at least 2.`);
  }

  // Find candidates for alternative-wallet seeding (greedy first picks).
  // Skip already-pinned must-include cards.
  const seedCurrentBest = buildInitialCurrentBest();
  // Apply pins to the seed map so first-pick alternatives respect them.
  state.walletMustInclude.forEach((ck) => {
    if (ownedExclusion.has(ck)) return;
    const entry = cardIndex.get(ck);
    if (entry) applyCardToCurrentBest(entry, seedCurrentBest);
  });
  const pinnedKeys = new Set(Array.from(state.walletMustInclude).filter((k) => !ownedExclusion.has(k)));
  const firstPickRanked = [];
  cardIndex.forEach((entry, key) => {
    if (ownedExclusion.has(key) || pinnedKeys.has(key)) return;
    if (!isCandidate(key, entry)) return;
    if (noSameBank) {
      // Skip banks already used by pinned/owned (cheap pre-filter; still re-checked in greedy)
      const pinnedBanks = new Set();
      pinnedKeys.forEach((pk) => { const e = cardIndex.get(pk); if (e) pinnedBanks.add(e.bank); });
      if (buildOnOwned) state.ownedCards.forEach((ok) => { const e = cardIndex.get(ok); if (e) pinnedBanks.add(e.bank); });
      if (pinnedBanks.has(entry.bank)) return;
    }
    const m = marginalForCard(entry, seedCurrentBest);
    const sc = scoreCandidate(m, key);
    if (sc > 0) firstPickRanked.push({ key, score: sc });
  });
  firstPickRanked.sort((a, b) => b.score - a.score);

  // Default greedy + up to 9 alternates (10 wallets total). Alternates are
  // generated by forcing each of the next-best first picks as the seed pick.
  // We scan up to MAX_ALT_SEEDS first picks because some alternates may
  // collapse onto the same wallet shape (deduplicated by walletKey).
  const MAX_WALLETS = 10;
  const MAX_ALT_SEEDS = 30;
  const seenKeys = new Set();
  const wallets = [];
  const optimal = greedyRun(null);
  if (optimal) { wallets.push(optimal); seenKeys.add(optimal.walletKey); }
  for (let i = 1; i < Math.min(firstPickRanked.length, MAX_ALT_SEEDS) && wallets.length < MAX_WALLETS; i++) {
    const alt = greedyRun(firstPickRanked[i].key);
    if (alt && !seenKeys.has(alt.walletKey)) {
      wallets.push(alt);
      seenKeys.add(alt.walletKey);
    }
  }

  // Score 0..100 normalized to optimal wallet (uses chosen objective implicitly via
  // perOutingTotal/coverage; both reflect well-built wallets regardless of objective).
  const refE = wallets.length ? (wallets[0].perOutingTotal * (0.35 + 0.65 * Math.sqrt(wallets[0].coverage))) : 1;
  wallets.forEach((w) => {
    const e = w.perOutingTotal * (0.35 + 0.65 * Math.sqrt(w.coverage));
    w.score = Math.max(0, Math.min(100, refE > 0 ? (e / refE) * 100 : 100));
  });

  // Surface common infeasibility warnings on the top wallet
  if (wallets.length > 0) {
    const w = wallets[0];
    if (w.feeBudgetBreached) {
      const over = w.totalAnnualFee - (maxFee || 0);
      warnings.push(`Wallet exceeds your fee budget by ${formatCurrency(over)}/year (driven by pinned cards). Unpin or raise the cap.`);
    }
    if (requireMixedTypes && !w.mixedTypeSatisfied) {
      warnings.push(`Could not include both a debit and a credit card given the other constraints. Try relaxing bank or card-type filters, or raise the fee budget.`);
    }
    if (w.picks.length < K) {
      warnings.push(`Only ${w.picks.length} of ${K} cards could be picked under current constraints.`);
    }
  } else if (state.walletMustInclude.size === 0) {
    warnings.push("No wallet possible under current constraints. Try relaxing filters, raising the fee budget, or turning off diversity rules.");
  }

  return {
    ranked: wallets,
    stats: {
      K,
      venueCount,
      candidateCount: firstPickRanked.length,
      anchorCount: buildOnOwned ? state.ownedCards.size : 0,
      buildOnOwned,
      objective,
      noSameBank,
      requireMixedTypes,
      maxFee,
      mustIncludeCount: state.walletMustInclude.size,
      warnings,
    },
  };
}
