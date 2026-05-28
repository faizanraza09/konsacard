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

/* ── NEXT CARD RECOMMENDATIONS ──
   For each card the user does NOT own, compute the incremental savings it
   would add on top of their current cards. Marginal value per (venue,day):
     delta = max(0, candidate_best_saving - current_best_saving_from_owned)
*/
function computeNextCardRecommendations() {
  if (!state.data) return { ranked: [], stats: { ownedCount: 0, venuesInScope: 0, totalCandidates: 0 } };

  const ownedKeys = state.ownedCards;
  const selectedDays = getEffectiveSelectedDays();
  const totalSelectedDays = selectedDays.size || 1;

  // Scope: all venues in the chosen city (or restaurant filter, if any)
  const scopeKey = (offer) => `${offer.city} || ${offer.restaurant}`;
  const scopeOffers = state.data.offers.filter((offer) => {
    if (!cityMatches(offer.city)) return false;
    if (state.selectedRestaurants.size > 0 && !state.selectedRestaurants.has(offer.restaurant)) return false;
    return true;
  });

  // Collect all venues in scope (whether or not anyone has a card for them)
  const venuesInScope = new Set();
  state.data.offers.forEach((offer) => {
    if (!cityMatches(offer.city)) return;
    if (state.selectedRestaurants.size > 0 && !state.selectedRestaurants.has(offer.restaurant)) return;
    venuesInScope.add(scopeKey(offer));
  });
  const venueCount = venuesInScope.size;

  // Step 1: build current_best[venueKey][day] from owned cards' offers
  const currentBest = new Map(); // venueKey -> Map<day, saving>
  if (ownedKeys.size > 0) {
    scopeOffers.forEach((offer) => {
      const cardKey = buildCardKey(offer.bank, offer.card);
      if (!ownedKeys.has(cardKey)) return;
      const saving = getOfferSavingValue(offer, state.orderValue);
      if (!Number.isFinite(saving) || saving <= 0) return;
      const venueKey = scopeKey(offer);
      let dayMap = currentBest.get(venueKey);
      if (!dayMap) { dayMap = new Map(); currentBest.set(venueKey, dayMap); }
      selectedDays.forEach((day) => {
        if (!offer.days.includes(day)) return;
        const prev = dayMap.get(day) || 0;
        if (saving > prev) dayMap.set(day, saving);
      });
    });
  }

  // Step 2: walk all non-owned card offers and compute delta per venue/day
  // Aggregate into per-card records.
  const cardMap = new Map(); // cardKey -> record
  scopeOffers.forEach((offer) => {
    const cardKey = buildCardKey(offer.bank, offer.card);
    if (ownedKeys.has(cardKey)) return;
    const saving = getOfferSavingValue(offer, state.orderValue);
    if (!Number.isFinite(saving) || saving <= 0) return;
    const venueKey = scopeKey(offer);

    let record = cardMap.get(cardKey);
    if (!record) {
      record = {
        bank: offer.bank,
        card: offer.card,
        cardCategory: offer.cardCategory || null,
        // venueKey -> Map<day, { candidateBest, currentBest }>
        venueDayCells: new Map(),
      };
      cardMap.set(cardKey, record);
    }
    if (!record.cardCategory && offer.cardCategory) record.cardCategory = offer.cardCategory;

    let venueMap = record.venueDayCells.get(venueKey);
    if (!venueMap) { venueMap = new Map(); record.venueDayCells.set(venueKey, venueMap); }
    selectedDays.forEach((day) => {
      if (!offer.days.includes(day)) return;
      const cell = venueMap.get(day);
      if (!cell || saving > cell.candidateBest) {
        const currentBestVal = currentBest.get(venueKey)?.get(day) || 0;
        venueMap.set(day, {
          candidateBest: saving,
          currentBest: currentBestVal,
          discountPct: getOfferDiscountPct(offer),
          discountLabel: offer.discountLabel,
          offerTitle: offer.offerTitle,
          orderTypes: offer.orderTypes || [],
          capPkr: offer.capPkr,
          fixedDiscountPkr: offer.fixedDiscountPkr ?? null,
          city: offer.city,
          restaurant: offer.restaurant,
        });
      }
    });
  });

  // Step 3: aggregate per card
  const aggregates = Array.from(cardMap.values()).map((record) => {
    let newVenues = 0;     // venues where owned cards had no offer at all
    let boostedVenues = 0; // venues where owned cards already had something but candidate beats it on at least one day
    let totalDeltaSaving = 0;     // sum of per-day deltas across venues (raw)
    let coveredVenues = 0;        // venues where candidate delivers any positive delta
    const venueSummaries = [];

    record.venueDayCells.forEach((dayMap, venueKey) => {
      let venueDeltaSum = 0;
      let venueAnyDelta = false;
      const venueOwnedAny = currentBest.has(venueKey) && Array.from(currentBest.get(venueKey).values()).some((v) => v > 0);
      let bestSampleCell = null;
      dayMap.forEach((cell) => {
        const delta = Math.max(0, cell.candidateBest - cell.currentBest);
        if (delta > 0) {
          venueDeltaSum += delta;
          venueAnyDelta = true;
        }
        if (!bestSampleCell || cell.candidateBest > bestSampleCell.candidateBest) bestSampleCell = cell;
      });
      if (!venueAnyDelta) return;
      coveredVenues += 1;
      totalDeltaSaving += venueDeltaSum;
      if (venueOwnedAny) boostedVenues += 1; else newVenues += 1;
      venueSummaries.push({
        venueKey,
        city: bestSampleCell.city,
        restaurant: bestSampleCell.restaurant,
        perOutingDelta: venueDeltaSum / totalSelectedDays,
        candidatePctLabel: bestSampleCell.discountLabel,
        candidatePct: bestSampleCell.discountPct,
        offerTitle: bestSampleCell.offerTitle,
        orderTypes: bestSampleCell.orderTypes,
        wasUncovered: !venueOwnedAny,
      });
    });

    // avg delta per outing = (total delta across days) / (covered venues * selectedDays)
    // Same shape as existing avgExpectedSaving but for the delta. Captures the user's
    // typical experience visiting one of the boosted venues.
    const avgDeltaPerOuting = coveredVenues > 0 ? totalDeltaSaving / (coveredVenues * totalSelectedDays) : 0;
    const coverageDelta = venueCount > 0 ? coveredVenues / venueCount : 0;

    // Yearly value estimate: how many of the user's typical outings hit boosted venues
    const outingsPerYear = (state.outingsPerWeek || 1) * 52;
    const hitRate = coverageDelta; // probability an outing is at a boosted venue (rough)
    const yearlyDelta = outingsPerYear * hitRate * avgDeltaPerOuting;

    const topVenueWins = venueSummaries
      .sort((a, b) => b.perOutingDelta - a.perOutingDelta)
      .slice(0, 3);

    return {
      bank: record.bank,
      card: record.card,
      cardCategory: record.cardCategory,
      newVenues,
      boostedVenues,
      coveredVenues,
      venueCount,
      avgDeltaPerOuting,
      coverageDelta,
      yearlyDelta,
      totalDeltaSaving,
      topVenueWins,
    };
  });

  // Step 4: eligibility + filtering (mirrors normal recs)
  aggregates.forEach((item) => {
    item.requirementStatus = evaluateEligibility(item.bank, item.card);
  });

  const hasEligibilityInput = state.monthlySalary !== null || state.accountBalance !== null;

  // Score 0..100 from blended (avgDelta × sqrt(coverageDelta))
  aggregates.forEach((item) => {
    item.E = item.avgDeltaPerOuting * (0.35 + 0.65 * Math.sqrt(item.coverageDelta));
  });
  const eSorted = aggregates.map((i) => i.E).sort((a, b) => a - b);
  const p95E = eSorted.length > 0
    ? eSorted[Math.max(0, Math.ceil(0.95 * eSorted.length) - 1)]
    : 1;
  const p95Safe = Math.max(p95E, 1);
  aggregates.forEach((item) => {
    const Ns = Math.min(1, item.E / p95Safe);
    const R = 0.65 * Ns + 0.25 * item.coverageDelta + 0.10 * Math.min(1, item.newVenues / Math.max(1, venueCount * 0.1));
    item.baseScore = 20 + 80 * R;
    item.qualificationConfidence = computeQualificationConfidence(item.requirementStatus);
    item.qualificationDelta = (state.useEligibility && hasEligibilityInput)
      ? 30 * (item.qualificationConfidence - 0.5)
      : 0;
    item.score = Math.max(0, Math.min(100, item.baseScore + item.qualificationDelta));
  });

  let visible = aggregates.filter((item) => item.coveredVenues > 0);
  visible = visible.filter((item) => {
    if (state.selectedBanks.size > 0 && !state.selectedBanks.has(item.bank)) return false;
    if (state.selectedCardTypes.size > 0 && !state.selectedCardTypes.has(item.cardCategory)) return false;
    return true;
  });
  if (state.useEligibility && hasEligibilityInput) {
    visible = visible.filter((item) => item.requirementStatus.status !== "ineligible");
  }

  visible.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.yearlyDelta !== a.yearlyDelta) return b.yearlyDelta - a.yearlyDelta;
    return b.avgDeltaPerOuting - a.avgDeltaPerOuting;
  });

  // Portfolio stats: what is the user's current wallet actually worth in scope?
  // Walk currentBest (best saving per venue/day from owned cards) and aggregate.
  let walletTotalDailyBest = 0;
  let walletCoveredVenues = 0;
  currentBest.forEach((dayMap) => {
    let any = false;
    dayMap.forEach((s) => { if (s > 0) { walletTotalDailyBest += s; any = true; } });
    if (any) walletCoveredVenues += 1;
  });
  const walletPerOuting = walletCoveredVenues > 0
    ? walletTotalDailyBest / (walletCoveredVenues * totalSelectedDays)
    : 0;
  const walletCoverage = venueCount > 0 ? walletCoveredVenues / venueCount : 0;
  const walletYearly = walletPerOuting * (state.outingsPerWeek || 1) * 52 * walletCoverage;

  // Total annual fees from owned cards (when published)
  let walletAnnualFee = 0;
  let walletFeeUnknown = false;
  ownedKeys.forEach((ck) => {
    const [bank, card] = ck.split(" || ");
    const status = evaluateEligibility(bank, card);
    const fee = status?.annualFeePkr;
    if (fee === null || fee === undefined) walletFeeUnknown = true;
    else if (Number.isFinite(fee)) walletAnnualFee += fee;
  });

  return {
    ranked: visible,
    stats: {
      ownedCount: ownedKeys.size,
      venuesInScope: venueCount,
      totalCandidates: aggregates.length,
      wallet: {
        perOuting: walletPerOuting,
        coverage: walletCoverage,
        coveredVenues: walletCoveredVenues,
        venueCount,
        yearly: walletYearly,
        annualFee: walletAnnualFee,
        feeUnknown: walletFeeUnknown,
      },
    },
  };
}

/* ── WALLET RESTAURANT COVERAGE ──
   For each restaurant in scope, find the best offer reachable using a card
   already in state.ownedCards. Returns rows in the same shape as
   computeRestaurantDeals so renderRestaurantDealRows can render them
   unchanged. Used by the "Restaurants your wallet covers" panel in My Wallet. */
function computeWalletRestaurantCoverage() {
  if (!state.data || state.ownedCards.size === 0) return [];
  const effectiveDays = getEffectiveSelectedDays();
  const ownedKeys = state.ownedCards;
  const best = new Map();

  state.data.offers.forEach((offer) => {
    if (!cityMatches(offer.city)) return;
    if (state.selectedRestaurants.size > 0 && !state.selectedRestaurants.has(offer.restaurant)) return;
    const cardKey = buildCardKey(offer.bank, offer.card);
    if (!ownedKeys.has(cardKey)) return;
    if (!offer.days.some((d) => effectiveDays.has(d))) return;

    const saving = getOfferSavingValue(offer, state.orderValue);
    if (!Number.isFinite(saving) || saving <= 0) return;

    const rk = `${offer.city}|||${offer.restaurant}`;
    const cur = best.get(rk);
    if (!cur || saving > cur.saving) {
      best.set(rk, {
        restaurant: offer.restaurant,
        city: offer.city,
        saving,
        discountLabel: offer.discountLabel,
        discountPct: getOfferDiscountPct(offer) || 0,
        daysLabel: offer.daysLabel,
        bestCard: offer.card,
        bestBank: offer.bank,
      });
    }
  });

  return [...best.values()].sort((a, b) => b.saving - a.saving);
}

/* ── COMPUTE RECOMMENDATIONS ──
   Fit-score ranking of every card by saving + coverage + day-fit, with an
   eligibility-based boost/penalty when the user has entered salary/balance.
   This is the algorithm that powers the default "Cards" view. */
function computeRecommendations() {
  if (!state.data) return [];

  const allCityVenues = new Set();
  state.data.offers.forEach((offer) => {
    if (!cityMatches(offer.city)) return;
    allCityVenues.add(`${offer.city} || ${offer.restaurant}`);
  });
  const totalVenueCount = allCityVenues.size;
  if (!totalVenueCount) return [];

  // Determine the baseline set of venues we are scoring against.
  // If user selected restaurants, use those.
  // Otherwise, use all restaurants in the current city.
  // Crucially, we do NOT filter this by bank, otherwise filtering to a single
  // bank makes that bank's coverage look like 100%.
  const scoringVenues = new Map();
  if (state.selectedRestaurants.size > 0) {
    state.selectedRestaurants.forEach(name => {
      const found = state.data.offers.find(o => o.restaurant === name && cityMatches(o.city));
      if (found) scoringVenues.set(`${found.city} || ${name}`, { city: found.city, restaurant: name });
    });
  } else {
    allCityVenues.forEach(key => {
      const [city, restaurant] = key.split(" || ");
      scoringVenues.set(key, { city, restaurant });
    });
  }

  const scoringVenueCount = scoringVenues.size || 1; // Prevent div by zero

  // Score against the use-case only. Narrowing filters like bank/card/type
  // should not rebase fit scores.
  const cuisineFilter = state.selectedCuisines;
  const hasCuisineFilter = cuisineFilter && cuisineFilter.size > 0;
  const scoringOffers = state.data.offers.filter((offer) => {
    if (!cityMatches(offer.city)) return false;
    if (state.selectedRestaurants.size > 0 && !state.selectedRestaurants.has(offer.restaurant)) return false;
    if (hasCuisineFilter) {
      const enr = (typeof getRestaurantEnrichment === "function") ? getRestaurantEnrichment(offer.restaurant) : null;
      const cuisines = enr?.servesCuisine || [];
      if (!cuisines.some((c) => cuisineFilter.has(c))) return false;
    }
    return true;
  });

  const selectedDays = getEffectiveSelectedDays();
  const totalSelectedDays = selectedDays.size;
  const cardMap = new Map();

  scoringOffers.forEach((offer) => {
    const offerSaving = getOfferSavingValue(offer, state.orderValue);
    if (!Number.isFinite(offerSaving) || offerSaving <= 0) return;

    const venueKey = `${offer.city} || ${offer.restaurant}`;
    const cardKey = `${offer.bank} || ${offer.card}`;

    if (!cardMap.has(cardKey)) {
      cardMap.set(cardKey, { bank: offer.bank, card: offer.card, cardCategory: offer.cardCategory || null, venueDailyBest: new Map() });
    }

    const cardRecord = cardMap.get(cardKey);
    if (!cardRecord.cardCategory && offer.cardCategory) cardRecord.cardCategory = offer.cardCategory;
    if (!cardRecord.venueDailyBest.has(venueKey)) {
      cardRecord.venueDailyBest.set(venueKey, new Map());
    }

    const dayMap = cardRecord.venueDailyBest.get(venueKey);
    selectedDays.forEach((day) => {
      if (!offer.days.includes(day)) return;
      const current = dayMap.get(day);
      const candidate = {
        city: offer.city,
        restaurant: offer.restaurant,
        saving: offerSaving,
        discountPct: getOfferDiscountPct(offer),
        discountLabel: offer.discountLabel,
        offerTitle: offer.offerTitle,
        offerDescription: offer.offerDescription,
        orderTypes: offer.orderTypes || [],
        daysLabel: offer.daysLabel,
        capPkr: offer.capPkr,
        fixedDiscountPkr: offer.fixedDiscountPkr ?? null,
      };
      if (!current || candidate.saving > current.saving) {
        dayMap.set(day, candidate);
      }
    });
  });

  const aggregates = Array.from(cardMap.values()).map((cardRecord) => {
    const venueSummaries = Array.from(cardRecord.venueDailyBest.entries())
      .map(([venueKey, dayMap]) => {
        if (!dayMap.size) return null;
        const bestByDay = Array.from(dayMap.entries()).sort((a, b) => a[0] - b[0]);
        const totalExpectedSaving = bestByDay.reduce((sum, [, match]) => sum + match.saving, 0);
        const coveredDayCount = bestByDay.length;
        const expectedSaving = totalExpectedSaving / totalSelectedDays;
        const dayFit = coveredDayCount / totalSelectedDays;
        const strongestMatch = bestByDay.reduce((best, [, match]) =>
          !best || match.saving > best.saving ? match : best, null);
        const averageDiscount = average(
          bestByDay.map(([, match]) => match.discountPct).filter((v) => Number.isFinite(v)),
        );
        const caps = bestByDay
          .map(([, match]) => match.capPkr)
          .filter((v) => Number.isFinite(v));

        return {
          venueKey,
          city: strongestMatch.city,
          restaurant: strongestMatch.restaurant,
          rawSaving: strongestMatch.saving,
          expectedSaving,
          dayFit,
          coveredDayCount,
          discountPct: averageDiscount,
          discountLabel: strongestMatch.discountLabel,
          offerTitle: strongestMatch.offerTitle,
          offerDescription: strongestMatch.offerDescription,
          orderTypes: strongestMatch.orderTypes,
          daysLabel: coveredDayCount === totalSelectedDays
            ? "Matches all your chosen days"
            : bestByDay.map(([day]) => DAY_SHORT[day]).join(", "),
          capPkr: caps.length ? Math.max(...caps) : null,
          fixedDiscountPkr: strongestMatch.fixedDiscountPkr,
        };
      })
      .filter(Boolean);

    const matches = venueSummaries;
    const coveredVenueCount = matches.length;
    const coverage = coveredVenueCount / scoringVenueCount;
    const totalExpectedSaving = matches.reduce((sum, match) => sum + match.expectedSaving, 0);
    const totalDayFit = matches.reduce((sum, match) => sum + match.dayFit, 0);
    const avgExpectedSaving = coveredVenueCount > 0 ? totalExpectedSaving / coveredVenueCount : 0;

    // Day fit should be relative to COVERED venues (Reliability)
    // not scoringVenueCount (Broadness), otherwise the number is confusingly diluted.
    const avgDayFit = coveredVenueCount > 0 ? totalDayFit / coveredVenueCount : 0;
    const averageDiscount = average(
      matches.map((match) => match.discountPct).filter((v) => Number.isFinite(v)),
    );
    const caps = matches
      .map((match) => match.capPkr)
      .filter((v) => Number.isFinite(v));
    const medianCap = caps.length ? median(caps) : null;
    // Saturation bill: the bill amount at which a card's cap kicks in. Below it
    // the user gets the headline % on the full bill; above it the saving caps.
    // Computed per match where both cap and % are finite, then medianed across
    // the card's matches. Null means the card has no caps in scope → uncapped.
    const saturations = matches
      .map((m) => {
        const cap = Number(m.capPkr);
        const pct = Number(m.discountPct);
        if (!Number.isFinite(cap) || !Number.isFinite(pct) || pct <= 0) return null;
        return cap / (pct / 100);
      })
      .filter((v) => v !== null && Number.isFinite(v));
    const saturationBill = saturations.length ? median(saturations) : null;
    const topMatches = matches.sort((a, b) => b.expectedSaving - a.expectedSaving).slice(0, 3);

    return {
      bank: cardRecord.bank,
      card: cardRecord.card,
      // cardCategory must survive into the aggregate — the visibility filter
      // below (`state.selectedCardTypes.has(item.cardCategory)`) treats a
      // missing value as a non-match, which silently filters every card out
      // when the user toggles Debit/Credit/Other. cardMap already stores it
      // at line ~777; just pass it through.
      cardCategory: cardRecord.cardCategory,
      score: 0,
      avgExpectedSaving,
      coverage,
      avgDayFit,
      coveredVenueCount,
      totalVenueCount: scoringVenues.size,
      averageDiscount,
      medianCap,
      saturationBill,
      topMatches,
    };
  });

  aggregates.forEach((item) => {
    item.requirementStatus = evaluateEligibility(item.bank, item.card);
  });

  const hasEligibilityInput = state.monthlySalary !== null || state.accountBalance !== null;

  // Step 1: compute blended savings-strength index E for each card
  aggregates.forEach((item) => {
    item.coverageAdjustedSaving = item.avgExpectedSaving * item.coverage;
    item.E = item.avgExpectedSaving * (0.35 + 0.65 * Math.sqrt(item.coverage));
  });

  // Step 2: P95 of E (robust normalization — one outlier card won't compress all others)
  const eSorted = aggregates.map((item) => item.E).sort((a, b) => a - b);
  const p95E = eSorted.length > 0
    ? eSorted[Math.max(0, Math.ceil(0.95 * eSorted.length) - 1)]
    : 1;
  const p95ESafe = Math.max(p95E, 1);

  // Annual-fee penalty. Cards with a positive fee get a score deduction
  // proportional to (effective fee / expected yearly gross value at this scope).
  // Effective fee halves when the card has a documented waiver rule (we can't
  // tell whether the user qualifies for the waiver, so we hedge). Cards with
  // null annualFeePkr get no penalty — we treat absent data as unknown, not
  // free. Bounded at -25 points so it never single-handedly buries a great
  // card; combined with the qualification floor it remains a real signal.
  const outingsPerYear = (state.outingsPerWeek || 1) * 52;
  aggregates.forEach((item) => {
    const Ns = Math.min(1, item.E / p95ESafe);
    // Calibration #6: drop avgDayFit from R. It's already inside
    // expectedSaving via the /totalSelectedDays divisor, so weighting it
    // here double-discounts cards with limited day windows. The freed 0.10
    // weight folds into Ns (which already encodes coverage via √coverage
    // inside E).
    const R = 0.75 * Ns + 0.25 * item.coverage;
    item.baseScore = 20 + 80 * R;
    item.qualificationConfidence = computeQualificationConfidence(item.requirementStatus);
    // Calibration #3: halve qualDelta to ±7.5. Was ±15 (range 30), which
    // let "you can probably get this" beat "this saves you more" too easily
    // — both salary-60k and salary-150k users landed on the same #1
    // because the boost saturated for any eligible card.
    item.qualificationDelta = (state.useEligibility && hasEligibilityInput)
      ? 15 * (item.qualificationConfidence - 0.5)
      : 0;
    item.feePenalty = computeFeePenalty(item, outingsPerYear);
    item.score = Math.max(0, Math.min(100, item.baseScore + item.qualificationDelta - item.feePenalty));
  });

  let visible = aggregates.filter((item) => {
    if (state.selectedBanks.size > 0 && !state.selectedBanks.has(item.bank)) return false;
    if (state.selectedCardTypes.size > 0 && !state.selectedCardTypes.has(item.cardCategory)) return false;
    if (state.selectedCards.size > 0 && !state.selectedCards.has(item.card)) return false;
    return true;
  });

  if (state.useEligibility && hasEligibilityInput) {
    visible = visible.filter((item) => item.requirementStatus.status !== "ineligible");
  }

  return visible.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.coverageAdjustedSaving !== a.coverageAdjustedSaving) return b.coverageAdjustedSaving - a.coverageAdjustedSaving;
    return b.coverage - a.coverage;
  });
}

/* ── SAVING MATH ── */
function getOfferSavingValue(offer, orderValue) {
  const discountType = offer.discountType || "percentage";
  const discountPct = getOfferDiscountPct(offer);
  const fixedDiscountPkr = Number.isFinite(offer.fixedDiscountPkr) ? offer.fixedDiscountPkr : null;
  const capPkr = Number.isFinite(offer.capPkr) ? offer.capPkr : null;

  switch (discountType) {
    case "fixed":
      if (fixedDiscountPkr !== null && fixedDiscountPkr > 0) {
        return Math.min(fixedDiscountPkr, orderValue);
      }
      return null;

    case "up_to":
      if (Number.isFinite(discountPct) && discountPct > 0) {
        var effectivePct = discountPct * 0.6;
        var pctSaving = (orderValue * effectivePct) / 100;
        return Math.min(pctSaving, capPkr || Number.POSITIVE_INFINITY);
      }
      return null;

    case "bogo":
      if (Number.isFinite(discountPct) && discountPct > 0) {
        var bogoEffectivePct = discountPct * 0.3;
        var bogoPctSaving = (orderValue * bogoEffectivePct) / 100;
        return Math.min(bogoPctSaving, capPkr || Number.POSITIVE_INFINITY);
      }
      return null;

    case "percentage":
    default:
      if (Number.isFinite(discountPct) && discountPct > 0) {
        return Math.min(
          (orderValue * discountPct) / 100,
          fixedDiscountPkr || capPkr || Number.POSITIVE_INFINITY,
        );
      }
      if (fixedDiscountPkr !== null && fixedDiscountPkr > 0) return Math.min(fixedDiscountPkr, orderValue);
      return null;
  }
}

function getOfferDiscountPct(offer) {
  if (Number.isFinite(offer.discountPct)) return Number(offer.discountPct);
  const text = `${offer.discountLabel || ""} ${offer.offerTitle || ""}`;
  const matches = text.match(/(\d+(?:\.\d+)?)\s*%/g) || [];
  if (!matches.length) return null;
  return Math.max(...matches.map((m) => Number.parseFloat(m)));
}

/* ── ELIGIBILITY ──
   Card tier inference + estimates by tier + per-card eligibility evaluation
   against the user-entered salary / balance. Returns a status object that
   the UI uses to render badges, scores, and "needs input" hints. */
function inferCardTier(cardName) {
  const n = (cardName || "").toLowerCase();
  if (n.includes("world") || n.includes("infinite") || n.includes("signature") || n.includes("privilege")) return "world";
  if (n.includes("platinum")) return "platinum";
  if (n.includes("titanium")) return "titanium";
  if (n.includes("gold")) return "gold";
  if (n.includes("silver")) return "silver";
  if (n.includes("classic") || n.includes("standard") || n.includes("basic")) return "classic";
  return "other";
}

function buildEstimatesByTier(requirementsPayload) {
  const groups = {};
  requirementsPayload.forEach((row) => {
    const salary  = normalizeRequirementNumber(row.requirements?.minimum_monthly_salary_pkr);
    const balance = normalizeRequirementNumber(row.requirements?.minimum_account_balance_pkr);
    if (salary === null && balance === null) return;
    const tier = inferCardTier(row.card_name);
    if (!groups[tier]) groups[tier] = { salaries: [], balances: [], count: 0 };
    if (salary  !== null && salary  > 0) groups[tier].salaries.push(salary);
    if (balance !== null && balance > 0) groups[tier].balances.push(balance);
    groups[tier].count++;
  });

  function median(arr) {
    if (!arr.length) return null;
    const s = [...arr].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
  }

  const map = new Map();
  Object.entries(groups).forEach(([tier, g]) => {
    map.set(tier, { tier, medianSalary: median(g.salaries), medianBalance: median(g.balances), peerCount: g.count });
  });
  return map;
}

function evaluateEligibility(bank, card) {
  const _emptyNotes = { cardNotes: [], bankGaps: [] };
  if (!state.requirements?.available) {
    return { status: "unavailable", label: "Requirements unavailable", tone: "unclear", sortRank: 1, detail: "Requirements data could not be loaded.", criteria: [], annualFeePkr: null, annualFeeWaiverRule: null, salaryReq: null, balanceReq: null, hasRequirementRecord: false, sourceIds: [], ..._emptyNotes };
  }

  const mapping = state.requirements.mappingByDealKey.get(buildDealCardKey(bank, card));
  if (!mapping?.matched || !mapping.requirement_card_id) {
    return { status: "unclear", label: "Requirements unclear", tone: "unclear", sortRank: 1, detail: "This deal-side card is not yet mapped to a verified requirements record.", criteria: [], annualFeePkr: null, annualFeeWaiverRule: null, salaryReq: null, balanceReq: null, hasRequirementRecord: false, sourceIds: [], ..._emptyNotes };
  }

  const record = state.requirements.byCardId.get(mapping.requirement_card_id);
  if (!record) {
    return { status: "unclear", label: "Requirements unclear", tone: "unclear", sortRank: 1, detail: "A mapped requirements record could not be loaded.", criteria: [], annualFeePkr: null, annualFeeWaiverRule: null, salaryReq: null, balanceReq: null, hasRequirementRecord: false, sourceIds: [], ..._emptyNotes };
  }

  const requirements = record.requirements || {};
  let salaryReq  = normalizeRequirementNumber(requirements.minimum_monthly_salary_pkr);

  // Consolidate various balance-like fields into a single effective balance requirement
  let balanceReq = normalizeRequirementNumber(requirements.minimum_account_balance_pkr);
  if (balanceReq === null) {
    const alts = [
      requirements.minimum_average_balance_pkr,
      requirements.minimum_relationship_balance_pkr,
      requirements.minimum_deposit_pkr
    ].map(normalizeRequirementNumber).filter(v => v !== null);
    if (alts.length > 0) balanceReq = Math.max(...alts);
  }

  const annualFeePkr       = normalizeRequirementNumber(requirements.annual_fee_pkr);
  const annualFeeWaiverRule = requirements.annual_fee_waiver_rule || null;
  const benefitSummary      = record.benefits || requirements.benefits || null;
  const sourceIds  = record.source_ids || [];
  const cardNotes  = (record.notes || []).filter((n) => n && typeof n === "string");
  const bankGaps   = (record.bank_gaps || []).filter((n) => n && typeof n === "string");

  // Fill missing salary/balance from tier-peer medians
  let salaryIsEstimated  = false;
  let balanceIsEstimated = false;
  let estimationNote     = null;
  if (salaryReq === null || balanceReq === null) {
    const tier    = inferCardTier(record.card_name);
    const tierEst = state.requirements.estimatesByTier?.get(tier);
    if (tierEst) {
      if (salaryReq  === null && tierEst.medianSalary  !== null) { salaryReq  = tierEst.medianSalary;  salaryIsEstimated  = true; }
      if (balanceReq === null && tierEst.medianBalance !== null) { balanceReq = tierEst.medianBalance; balanceIsEstimated = true; }
      if (salaryIsEstimated || balanceIsEstimated) {
        const tierLabel = tier === "other" ? "similar" : tier.charAt(0).toUpperCase() + tier.slice(1);
        estimationNote  = `Estimated from ${tierEst.peerCount} similar ${tierLabel} cards`;
      }
    }
  }
  const isEstimated = salaryIsEstimated || balanceIsEstimated;

  const criteria = [];
  const blockers = [];
  let salaryPassed  = true;
  let balancePassed = true;
  let missingInput  = false;

  if (salaryReq !== null) {
    criteria.push(formatRequirementCriterion(salaryReq, "salary"));
    if (salaryReq > 0) {
      if (state.monthlySalary === null) {
        missingInput = true;
      } else if (state.monthlySalary < salaryReq) {
        salaryPassed = false;
        const qualifier = salaryIsEstimated ? "estimated " : "listed ";
        blockers.push(`Below the ${qualifier}salary threshold of ${formatCurrency(salaryReq)} / month`);
      }
    }
  }

  if (balanceReq !== null) {
    criteria.push(formatRequirementCriterion(balanceReq, "balance"));
    if (balanceReq > 0) {
      if (state.accountBalance === null) {
        missingInput = true;
      } else if (state.accountBalance < balanceReq) {
        balancePassed = false;
        const qualifier = balanceIsEstimated ? "estimated " : "listed ";
        blockers.push(`Below the ${qualifier}account balance threshold of ${formatCurrency(balanceReq)}`);
      }
    }
  }

  if (annualFeePkr !== null) criteria.push(formatRequirementCriterion(annualFeePkr, "fee"));

  const base = { criteria, annualFeePkr, annualFeeWaiverRule, benefitSummary, salaryReq, balanceReq, isEstimated, salaryIsEstimated, balanceIsEstimated, estimationNote, hasRequirementRecord: true, sourceIds, cardNotes, bankGaps };

  // Salary and Balance are treated as ALTERNATIVE paths (OR) when a card lists
  // both, since many Pakistani cards accept either. But a "passed path" only
  // counts when the path actually exists — otherwise a card with only one real
  // requirement gets a free pass on the absent one and slips through as eligible.
  const hasSalaryReq  = salaryReq !== null && salaryReq > 0;
  const hasBalanceReq = balanceReq !== null && balanceReq > 0;
  const salaryHardPass  = hasSalaryReq  && state.monthlySalary  !== null && state.monthlySalary  >= salaryReq;
  const balanceHardPass = hasBalanceReq && state.accountBalance !== null && state.accountBalance >= balanceReq;
  const salaryHardFail  = hasSalaryReq  && !salaryPassed;
  const balanceHardFail = hasBalanceReq && !balancePassed;
  const salaryInputMissing  = hasSalaryReq  && state.monthlySalary  === null;
  const balanceInputMissing = hasBalanceReq && state.accountBalance === null;
  // Block when user has affirmatively failed at least one defined path AND has
  // no other defined path that either passes or is still undecided (missing input).
  const isBlocked = (salaryHardFail || balanceHardFail)
                 && !(salaryHardPass || balanceHardPass)
                 && !salaryInputMissing
                 && !balanceInputMissing;

  if (isBlocked) {
    const detail = blockers.length > 1 ? `${blockers[0]} (and balance)` : blockers[0];
    if (isEstimated) return { ...base, status: "est_ineligible",  label: "May not qualify (est.)",    tone: "est-ineligible",  sortRank: 0.5, detail };
    return               { ...base, status: "ineligible",         label: "Likely ineligible",          tone: "ineligible",      sortRank: 0,   detail };
  }
  if (salaryReq === null && balanceReq === null) {
    return               { ...base, status: "unclear",            label: "Requirements unclear",       tone: "unclear",         sortRank: 1,   detail: "No public salary or balance threshold was captured for this card." };
  }
  if (missingInput) {
    if (isEstimated) return { ...base, status: "est_needs_input", label: "Est. requirements exist",   tone: "est-needs-input", sortRank: 1.5, detail: estimationNote || "Estimated thresholds exist but salary or balance details have not been entered." };
    return               { ...base, status: "needs_input",        label: "Salary/balance not entered", tone: "needs-input",     sortRank: 2,   detail: "Public thresholds exist, but salary or balance details have not been entered." };
  }
  if (isEstimated) return  { ...base, status: "est_eligible",     label: "Possibly eligible (est.)",  tone: "est-eligible",    sortRank: 2.5, detail: estimationNote || "Entered salary and balance meet the estimated thresholds for this card." };
  return                   { ...base, status: "eligible",          label: "Likely eligible",            tone: "eligible",        sortRank: 3,   detail: "Entered salary and balance meet the public thresholds captured for this card." };
}

/**
 * Convert a card's annual fee into a score penalty, capped at 25 points. Inputs:
 *   - item.requirementStatus.annualFeePkr   (number | null)
 *   - item.requirementStatus.annualFeeWaiverRule (string | null)
 *   - item.avgExpectedSaving                (PKR per outing in current scope)
 *   - item.coverage                         (0..1)
 *   - outingsPerYear                        (user-set, default 52)
 *
 * Logic:
 *   yearlyValue  = avgExpectedSaving * outingsPerYear * coverage     (in PKR)
 *   waiverFactor = 0.5 when waiver rule exists, 1.0 otherwise
 *   effectiveFee = (annualFeePkr || 0) * waiverFactor
 *   ratio        = effectiveFee / max(yearlyValue, 1)
 *   penalty      = min(25, 25 * ratio)
 *
 * Null fee → 0 penalty (we hedge in favour of visibility when data is missing).
 * Zero fee → 0 penalty.
 */
function computeFeePenalty(item, outingsPerYear) {
  const status = item.requirementStatus;
  const fee = status?.annualFeePkr;

  // Calibration #2: missing fee data → small soft penalty instead of free
  // pass. Cards without a verified requirements record were being silently
  // ranked alongside actually-free cards, advantaging them over disclosed
  // peers. 3 points is small enough not to dominate, big enough to level
  // the field with cards that publish their fee.
  if (fee === null || fee === undefined) {
    if (!status?.hasRequirementRecord) return 3;
    if (status?.annualFeeWaiverRule) return 0;  // documented "Conditional"
    return 3;                                    // null fee, no waiver context
  }
  if (fee <= 0) return 0;

  const waiver = !!status?.annualFeeWaiverRule;
  const effective = fee * (waiver ? 0.5 : 1.0);

  // Calibration #1: drop the × coverage multiplier from the denominator.
  // Previously the formula compared the fee against a coverage-discounted
  // "expected yearly value", which double-counted coverage (already in E +
  // R) and inverted the impact for high-coverage cards. The denominator
  // here now matches the "Annual saving" the card detail modal shows the
  // user — same number for explainability.
  const yearlyValue = (item.avgExpectedSaving || 0) * outingsPerYear;
  const ratio = effective / Math.max(yearlyValue, 1);
  return Math.min(25, 25 * Math.min(1, ratio));
}

function computeQualificationConfidence(status) {
  const hasEligibilityInput = state.monthlySalary !== null || state.accountBalance !== null;
  if (!hasEligibilityInput || !status?.hasRequirementRecord) return 0.5;

  // Hard penalty for known ineligibility (unifies filter and score)
  if (status.status === "ineligible" || status.status === "est_ineligible") return 0.0;

  // Track each dimension's score AND whether the user actually entered an input
  // for that dimension. The distinction matters for the OR-rescue blend below.
  const scores = [];
  const scoreDimension = (inputValue, requirementValue, isEstimated = false) => {
    const input = normalizeRequirementNumber(inputValue);
    const req = normalizeRequirementNumber(requirementValue);
    // Skip dimensions that aren't real requirements. A req of 0 or null is the
    // absence of a threshold, not a satisfied one — counting it as q=1.0 would
    // mask failures on the other dimension when blended below.
    if (req === null || req <= 0) return;

    let q = 0.5;
    let entered = true;
    if (input === null) {
      q = 0.5;
      entered = false;
    } else {
      const ratio = input / req;
      // Smooth piecewise linear curve
      if (ratio >= 1.3) {
        q = 1.0;
      } else if (ratio >= 1.0) {
        q = 0.8 + (ratio - 1.0) * (0.2 / 0.3);
      } else if (ratio >= 0.7) {
        q = 0.0 + (ratio - 0.7) * (0.8 / 0.3);
      } else {
        q = 0.0;
      }
    }

    if (isEstimated) {
      q = 0.5 + (q - 0.5) * 0.7;
    }

    scores.push({ q, entered });
  };

  scoreDimension(state.monthlySalary, status.salaryReq, status.salaryIsEstimated);
  scoreDimension(state.accountBalance, status.balanceReq, status.balanceIsEstimated);

  if (!scores.length) return 0.5;

  // OR-blend semantics, but with an "explicit-failure floor":
  //   - If the user has entered every defined dimension, Math.max is fine — the
  //     card uses OR semantics so passing one path is enough.
  //   - If only some dimensions are entered AND any entered dimension explicitly
  //     fails (q < 0.5), don't let the unentered "unknown=0.5" rescue the score.
  //     Cap confidence at 0.25, which translates to a ~7.5pt score penalty.
  //     The card stays visible (it's still needs_input), but ranks much lower.
  const enteredFailures = scores.filter((s) => s.entered && s.q < 0.5);
  const allEntered = scores.every((s) => s.entered);
  const maxScore = Math.max(...scores.map((s) => s.q));
  let confidence = maxScore;
  if (!allEntered && enteredFailures.length > 0) {
    confidence = Math.min(0.25, maxScore);
  }
  return Math.max(0, Math.min(1, confidence));
}
