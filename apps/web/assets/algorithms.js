// @ts-check
/* ── ALGORITHM MODULE ──
   computeRecommendations (cards-view ranking) delegates to the shared
   ranking-core that the SSR Pages Function also uses, then layers on the
   browser-only post-processing (eligibility, fee penalty, qualification
   delta) that needs state.requirements + state.useEligibility +
   state.monthlySalary etc. That keeps SSR and browser using the SAME
   per-offer math, the SAME aggregation, the SAME baseScore — guaranteeing
   identical ranking for users who haven't entered eligibility input.

   computeWalletRecommendations / computeNextCardRecommendations stay
   browser-local: they're more complex (greedy K-card selection, marginal
   delta vs owned cards) and aren't shared with SSR.

   This file gets bundled by esbuild with --bundle (see package.json
   "build:assets:bundle") so the ES module import below resolves into a
   self-contained IIFE that classic scripts (app.js, chat.js, quiz.js)
   can call by name. The bottom of the file explicitly re-exposes every
   externally-used function on window for that reason.
*/
import {
  computeRanking as computeRankingCore,
  getOfferSavingValue as coreGetOfferSavingValue,
  getOfferDiscountPct as coreGetOfferDiscountPct,
} from "../lib/ranking-core.mjs";
import {
  evaluateEligibility as coreEvaluateEligibility,
  computeQualificationConfidence as coreComputeQualificationConfidence,
  inferCardTier as coreInferCardTier,
  buildEstimatesByTier as coreBuildEstimatesByTier,
} from "../lib/eligibility-core.mjs";

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
  // FIRST-PAINT FAST PATH: at the default scope (no raw offers loaded yet,
  // plain ranked cards view, default bill, no filters, eligibility off) the
  // precomputed summary IS the ranking core's default output — same shared
  // `computeRanking` core, same settings. Serve it verbatim instead of
  // aggregating ~28k raw records on the main thread.
  //
  // The summary cards carry every ranking + display field (baseScore,
  // feePenalty, score, avgExpectedSaving, coverage, medianCap, topMatches,
  // saturationBill, …) but NOT `requirementStatus` — that's a browser-only
  // overlay computed from state.requirements + user input. Layer it on here,
  // mirroring the cheap tail of the compute path below. At the default scope
  // there is no salary/balance input, so qualificationDelta is 0 and the
  // adjusted score equals the precomputed score: order is UNCHANGED. Do NOT
  // re-sort — that would risk diverging from the summary order on ties.
  if (!state.data && typeof isDefaultScope === "function" && isDefaultScope()) {
    const cityKey = typeof getSummaryCityKey === "function" ? getSummaryCityKey() : null;
    const summaryCards = cityKey ? state.summary?.scopes?.[cityKey] : null;
    if (Array.isArray(summaryCards)) {
      return summaryCards.map((c) => ({
        ...c,
        // Reuse the app's own eligibility overlay (no new logic / no parity
        // risk). Falls back gracefully to "unavailable" if requirements
        // failed to load — renders without the badge rather than crashing.
        requirementStatus: evaluateEligibility(c.bank, c.card),
        qualificationDelta: 0, // default scope: no salary/balance entered
      }));
    }
    // Summary scope unexpectedly missing → fall through (returns [] below
    // since raw offers aren't loaded; the caller's lazy-load path recovers).
  }

  if (!state.data) return [];

  // Delegate the pure data steps (per-offer saving math, per-card aggregation,
  // blended E score, P95 normalization, narrowing filters) to the shared
  // ranking-core that the SSR Pages Function also uses. The aggregates come
  // back with .baseScore set; we layer browser-only post-processing on top
  // (eligibility, fee penalty, qualification delta), then resort by the
  // adjusted .score.
  // Core sets baseScore + feePenalty + score (= baseScore - feePenalty).
  // Browser additionally overlays qualificationDelta on top — eligibility is
  // user-input-driven so it can't live in the core.
  const { aggregates } = computeRankingCore({
    offers: state.data.offers,
    restaurantsEnrichment: state.data?.restaurants,
    requirements: state.requirements,
    settings: {
      city: state.selectedCity,
      orderValue: state.orderValue,
      outingsPerWeek: state.outingsPerWeek,
      selectedDays: state.selectedDays,
      selectedRestaurants: state.selectedRestaurants,
      selectedBanks: state.selectedBanks,
      selectedCardTypes: state.selectedCardTypes,
      selectedCards: state.selectedCards,
      selectedCuisines: state.selectedCuisines,
      daysShort: typeof DAY_SHORT !== "undefined" ? DAY_SHORT : undefined,
    },
  });

  const hasEligibilityInput = state.monthlySalary !== null || state.accountBalance !== null;

  for (const item of aggregates) {
    item.requirementStatus = evaluateEligibility(item.bank, item.card);
    item.qualificationConfidence = computeQualificationConfidence(item.requirementStatus);
    // Calibration #3: halve qualDelta to ±7.5. Was ±15 (range 30), which let
    // "you can probably get this" beat "this saves you more" too easily —
    // both salary-60k and salary-150k users landed on the same #1 because the
    // boost saturated for any eligible card.
    item.qualificationDelta =
      state.useEligibility && hasEligibilityInput
        ? 15 * (item.qualificationConfidence - 0.5)
        : 0;
    item.score = Math.max(
      0,
      Math.min(100, item.baseScore + item.qualificationDelta - item.feePenalty),
    );
  }

  let visible = aggregates;
  if (state.useEligibility && hasEligibilityInput) {
    visible = visible.filter((item) => item.requirementStatus.status !== "ineligible");
  }

  return visible.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.coverageAdjustedSaving !== a.coverageAdjustedSaving)
      return b.coverageAdjustedSaving - a.coverageAdjustedSaving;
    return b.coverage - a.coverage;
  });
}


/* ── SAVING MATH ──
   getOfferSavingValue and getOfferDiscountPct live in the shared
   ranking-core module so the SSR Pages Function and the browser compute
   identical per-offer savings. We re-export them here so other browser
   files (app.js, chat.js, etc.) can call them as before. */
const getOfferSavingValue = coreGetOfferSavingValue;
const getOfferDiscountPct = coreGetOfferDiscountPct;

/* ── ELIGIBILITY ──
   Card tier inference + estimates by tier + per-card eligibility evaluation
   against the user-entered salary / balance. The math now lives in the shared
   eligibility-core module (imported above) so the SSR /api/rank Pages Function
   and the mobile offline fallback compute IDENTICAL eligibility/qualification
   results. The functions below are thin wrappers that bind state.* (the
   browser's user input) to the core's explicit-input signatures, preserving
   the legacy call sites: evaluateEligibility(bank, card) and
   computeQualificationConfidence(status). */
const inferCardTier = coreInferCardTier;
const buildEstimatesByTier = coreBuildEstimatesByTier;

function evaluateEligibility(bank, card) {
  return coreEvaluateEligibility(
    { monthlySalary: state.monthlySalary, accountBalance: state.accountBalance },
    bank,
    card,
    state.requirements,
  );
}

function computeQualificationConfidence(status) {
  return coreComputeQualificationConfidence(
    { monthlySalary: state.monthlySalary, accountBalance: state.accountBalance },
    status,
  );
}

/* ── GLOBAL EXPOSURE ──
   esbuild bundles this file with --bundle (so the ranking-core import
   resolves at build time) and wraps everything in an IIFE. That kills the
   classic-script convention where top-level `function foo()` declarations
   become window globals. Other browser scripts (app.js, chat.js, quiz.js,
   content-pages.js) are NOT bundled — they expect to call these functions
   by bare name. Re-expose explicitly. */
const __glob = typeof window !== "undefined" ? window : globalThis;
Object.assign(__glob, {
  computeRecommendations,
  computeWalletRecommendations,
  computeNextCardRecommendations,
  computeWalletRestaurantCoverage,
  getOfferSavingValue,
  getOfferDiscountPct,
  evaluateEligibility,
  inferCardTier,
  buildEstimatesByTier,
  computeQualificationConfidence,
});
