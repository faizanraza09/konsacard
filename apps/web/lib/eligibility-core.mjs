// Shared eligibility core — single source of truth for the per-user
// eligibility overlay that sits on top of the ranking-core aggregates.
// Imported in three places:
//
//   - apps/web/assets/algorithms.js  (browser)
//     Thin wrappers bind these to state.* so the existing call sites
//     evaluateEligibility(bank, card) / computeQualificationConfidence(status)
//     keep working unchanged.
//
//   - apps/web/functions/api/rank.js (Cloudflare Pages Function)
//     Runs computeRanking() then applyEligibility() to produce the final,
//     personalized, re-sorted, eligibility-filtered list server-side.
//
//   - mirrors apps/mobile/src/lib/eligibility.ts + algorithms.ts exactly so the
//     mobile offline fallback and this online path agree to the decimal.
//
// Design constraints
// ──────────────────
// 0. Pulls in computeRanking from ranking-core so callers (the /api/rank Pages
//    Function and the parity test) get one pure, runtime-free entry point:
//    rankCards({ offers, restaurantsEnrichment, requirements, settings }).
// 1. Pure functions. No globals, no DOM, no fetch. Every input explicit.
// 2. The math (qualificationDelta = 15·(conf−0.5) when eligibility on with
//    salary/balance, final score = clamp(0,100, baseScore − feePenalty +
//    qualificationDelta), re-sort by score → coverageAdjustedSaving → coverage,
//    drop ineligible when useEligibility && has salary/balance) MUST match
//    apps/mobile/src/lib/algorithms.ts:computeRecommendations.

import { computeRanking } from "./ranking-core.mjs";

// ── small format helpers (mirror apps/mobile/src/lib/format.ts) ──

export function normalizeRequirementNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDealCardFragment(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function buildDealCardKey(bank, card) {
  return `${normalizeDealCardFragment(bank)} || ${normalizeDealCardFragment(card)}`;
}

export function formatCurrency(value) {
  return `PKR ${Math.round(value).toLocaleString("en-US")}`;
}

export function formatRequirementCriterion(value, kind) {
  if (value === null) return null;
  if (kind === "salary") {
    return value === 0 ? "No minimum salary" : `Salary at least ${formatCurrency(value)} / month`;
  }
  if (kind === "balance") {
    return value === 0 ? "No minimum balance" : `Balance at least ${formatCurrency(value)}`;
  }
  if (kind === "fee") {
    return value === 0 ? "No annual fee" : `Annual fee ${formatCurrency(value)}`;
  }
  return null;
}

// ── tier inference + per-tier estimate medians ──

export function inferCardTier(cardName) {
  const n = (cardName || "").toLowerCase();
  if (n.includes("world") || n.includes("infinite") || n.includes("signature") || n.includes("privilege")) return "world";
  if (n.includes("platinum")) return "platinum";
  if (n.includes("titanium")) return "titanium";
  if (n.includes("gold")) return "gold";
  if (n.includes("silver")) return "silver";
  if (n.includes("classic") || n.includes("standard") || n.includes("basic")) return "classic";
  return "other";
}

export function buildEstimatesByTier(requirementsPayload) {
  const groups = {};
  requirementsPayload.forEach((row) => {
    const salary = normalizeRequirementNumber(row.requirements?.minimum_monthly_salary_pkr);
    const balance = normalizeRequirementNumber(row.requirements?.minimum_account_balance_pkr);
    if (salary === null && balance === null) return;
    const tier = inferCardTier(row.card_name);
    if (!groups[tier]) groups[tier] = { salaries: [], balances: [], count: 0 };
    if (salary !== null && salary > 0) groups[tier].salaries.push(salary);
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

// ── requirements pack builder (mirrors precompute's loadRequirements +
//    mobile's loadRequirements) ──
//
// records  : array of card_requirements.json rows
// mappings  : array of deal_requirement_card_map.json rows (or {mappings:[...]})
// Returns { available, byCardId, mappingByDealKey, estimatesByTier }.
export function buildRequirementsPack(records, mappings) {
  if (!Array.isArray(records) || records.length === 0) {
    return { available: false, byCardId: new Map(), mappingByDealKey: new Map(), estimatesByTier: new Map() };
  }
  const byCardId = new Map();
  records.forEach((r) => byCardId.set(r.card_id, r));

  const list = Array.isArray(mappings) ? mappings : mappings?.mappings || [];
  const mappingByDealKey = new Map();
  list.forEach((row) => {
    if (!row?.deal_bank_name || !row?.deal_card_name) return;
    const key = buildDealCardKey(row.deal_bank_name, row.deal_card_name);
    mappingByDealKey.set(key, {
      deal_card_key: key,
      matched: !!row.matched,
      requirement_card_id: row.requirement_card_id ?? null,
    });
  });

  return {
    available: true,
    byCardId,
    mappingByDealKey,
    estimatesByTier: buildEstimatesByTier(records),
  };
}

// ── eligibility evaluation ──
//
// `settings` carries the user inputs the evaluator needs:
//   { monthlySalary: number|null, accountBalance: number|null }
// `requirements` is a pack with { available, byCardId, mappingByDealKey,
//   estimatesByTier }. Returns the same status object shape the browser +
//   mobile already render.

const EMPTY_NOTES = { cardNotes: [], bankGaps: [] };

function emptyStatus(status, label, tone, sortRank, detail) {
  return {
    status,
    label,
    tone,
    sortRank,
    detail,
    criteria: [],
    annualFeePkr: null,
    annualFeeWaiverRule: null,
    salaryReq: null,
    balanceReq: null,
    hasRequirementRecord: false,
    sourceIds: [],
    ...EMPTY_NOTES,
  };
}

export function evaluateEligibility(settings, bank, card, requirements) {
  const monthlySalary = settings?.monthlySalary ?? null;
  const accountBalance = settings?.accountBalance ?? null;

  if (!requirements?.available) {
    return emptyStatus("unavailable", "Requirements unavailable", "unclear", 1, "Requirements data could not be loaded.");
  }

  const mapping = requirements.mappingByDealKey.get(buildDealCardKey(bank, card));
  if (!mapping?.matched || !mapping.requirement_card_id) {
    return emptyStatus("unclear", "Requirements unclear", "unclear", 1, "This deal-side card is not yet mapped to a verified requirements record.");
  }

  const record = requirements.byCardId.get(mapping.requirement_card_id);
  if (!record) {
    return emptyStatus("unclear", "Requirements unclear", "unclear", 1, "A mapped requirements record could not be loaded.");
  }

  const reqs = record.requirements || {};
  let salaryReq = normalizeRequirementNumber(reqs.minimum_monthly_salary_pkr);

  // Consolidate various balance-like fields into a single effective balance req.
  let balanceReq = normalizeRequirementNumber(reqs.minimum_account_balance_pkr);
  if (balanceReq === null) {
    const alts = [
      reqs.minimum_average_balance_pkr,
      reqs.minimum_relationship_balance_pkr,
      reqs.minimum_deposit_pkr,
    ].map(normalizeRequirementNumber).filter((v) => v !== null);
    if (alts.length > 0) balanceReq = Math.max(...alts);
  }

  const annualFeePkr = normalizeRequirementNumber(reqs.annual_fee_pkr);
  const annualFeeWaiverRule = reqs.annual_fee_waiver_rule || null;
  const benefitSummary = record.benefits || reqs.benefits || null;
  const sourceIds = record.source_ids || [];
  const cardNotes = (record.notes || []).filter((n) => n && typeof n === "string");
  const bankGaps = (record.bank_gaps || []).filter((n) => n && typeof n === "string");

  // Fill missing salary/balance from tier-peer medians.
  let salaryIsEstimated = false;
  let balanceIsEstimated = false;
  let estimationNote = null;
  if (salaryReq === null || balanceReq === null) {
    const tier = inferCardTier(record.card_name);
    const tierEst = requirements.estimatesByTier?.get(tier);
    if (tierEst) {
      if (salaryReq === null && tierEst.medianSalary !== null) { salaryReq = tierEst.medianSalary; salaryIsEstimated = true; }
      if (balanceReq === null && tierEst.medianBalance !== null) { balanceReq = tierEst.medianBalance; balanceIsEstimated = true; }
      if (salaryIsEstimated || balanceIsEstimated) {
        const tierLabel = tier === "other" ? "similar" : tier.charAt(0).toUpperCase() + tier.slice(1);
        estimationNote = `Estimated from ${tierEst.peerCount} similar ${tierLabel} cards`;
      }
    }
  }
  const isEstimated = salaryIsEstimated || balanceIsEstimated;

  const criteria = [];
  const blockers = [];
  let salaryPassed = true;
  let balancePassed = true;
  let missingInput = false;

  if (salaryReq !== null) {
    criteria.push(formatRequirementCriterion(salaryReq, "salary"));
    if (salaryReq > 0) {
      if (monthlySalary === null) {
        missingInput = true;
      } else if (monthlySalary < salaryReq) {
        salaryPassed = false;
        const qualifier = salaryIsEstimated ? "estimated " : "listed ";
        blockers.push(`Below the ${qualifier}salary threshold of ${formatCurrency(salaryReq)} / month`);
      }
    }
  }

  if (balanceReq !== null) {
    criteria.push(formatRequirementCriterion(balanceReq, "balance"));
    if (balanceReq > 0) {
      if (accountBalance === null) {
        missingInput = true;
      } else if (accountBalance < balanceReq) {
        balancePassed = false;
        const qualifier = balanceIsEstimated ? "estimated " : "listed ";
        blockers.push(`Below the ${qualifier}account balance threshold of ${formatCurrency(balanceReq)}`);
      }
    }
  }

  if (annualFeePkr !== null) criteria.push(formatRequirementCriterion(annualFeePkr, "fee"));

  const base = {
    criteria, annualFeePkr, annualFeeWaiverRule, benefitSummary, salaryReq, balanceReq,
    isEstimated, salaryIsEstimated, balanceIsEstimated, estimationNote,
    hasRequirementRecord: true, sourceIds, cardNotes, bankGaps,
  };

  // Salary and Balance are ALTERNATIVE paths (OR) when both are listed. A
  // "passed path" only counts when the path actually exists, and a fail blocks
  // only when no other defined path could rescue (passing or still-undecided).
  const hasSalaryReq = salaryReq !== null && salaryReq > 0;
  const hasBalanceReq = balanceReq !== null && balanceReq > 0;
  const salaryHardPass = hasSalaryReq && monthlySalary !== null && monthlySalary >= salaryReq;
  const balanceHardPass = hasBalanceReq && accountBalance !== null && accountBalance >= balanceReq;
  const salaryHardFail = hasSalaryReq && !salaryPassed;
  const balanceHardFail = hasBalanceReq && !balancePassed;
  const salaryInputMissing = hasSalaryReq && monthlySalary === null;
  const balanceInputMissing = hasBalanceReq && accountBalance === null;
  const isBlocked = (salaryHardFail || balanceHardFail)
    && !(salaryHardPass || balanceHardPass)
    && !salaryInputMissing
    && !balanceInputMissing;

  if (isBlocked) {
    const detail = blockers.length > 1 ? `${blockers[0]} (and balance)` : blockers[0];
    if (isEstimated) return { ...base, status: "est_ineligible", label: "May not qualify (est.)", tone: "est-ineligible", sortRank: 0.5, detail };
    return { ...base, status: "ineligible", label: "Likely ineligible", tone: "ineligible", sortRank: 0, detail };
  }
  if (salaryReq === null && balanceReq === null) {
    return { ...base, status: "unclear", label: "Requirements unclear", tone: "unclear", sortRank: 1, detail: "No public salary or balance threshold was captured for this card." };
  }
  if (missingInput) {
    if (isEstimated) return { ...base, status: "est_needs_input", label: "Est. requirements exist", tone: "est-needs-input", sortRank: 1.5, detail: estimationNote || "Estimated thresholds exist but salary or balance details have not been entered." };
    return { ...base, status: "needs_input", label: "Salary/balance not entered", tone: "needs-input", sortRank: 2, detail: "Public thresholds exist, but salary or balance details have not been entered." };
  }
  if (isEstimated) return { ...base, status: "est_eligible", label: "Possibly eligible (est.)", tone: "est-eligible", sortRank: 2.5, detail: estimationNote || "Entered salary and balance meet the estimated thresholds for this card." };
  return { ...base, status: "eligible", label: "Likely eligible", tone: "eligible", sortRank: 3, detail: "Entered salary and balance meet the public thresholds captured for this card." };
}

export function computeQualificationConfidence(settings, status) {
  const monthlySalary = settings?.monthlySalary ?? null;
  const accountBalance = settings?.accountBalance ?? null;
  const hasEligibilityInput = monthlySalary !== null || accountBalance !== null;
  if (!hasEligibilityInput || !status?.hasRequirementRecord) return 0.5;

  // Hard penalty for known ineligibility (unifies filter and score).
  if (status.status === "ineligible" || status.status === "est_ineligible") return 0.0;

  const scores = [];
  const scoreDimension = (inputValue, requirementValue, isEstimated = false) => {
    const input = normalizeRequirementNumber(inputValue);
    const req = normalizeRequirementNumber(requirementValue);
    if (req === null || req <= 0) return;

    let q = 0.5;
    let entered = true;
    if (input === null) {
      q = 0.5;
      entered = false;
    } else {
      const ratio = input / req;
      if (ratio >= 1.3) q = 1.0;
      else if (ratio >= 1.0) q = 0.8 + (ratio - 1.0) * (0.2 / 0.3);
      else if (ratio >= 0.7) q = 0.0 + (ratio - 0.7) * (0.8 / 0.3);
      else q = 0.0;
    }

    if (isEstimated) q = 0.5 + (q - 0.5) * 0.7;
    scores.push({ q, entered });
  };

  scoreDimension(monthlySalary, status.salaryReq, status.salaryIsEstimated);
  scoreDimension(accountBalance, status.balanceReq, status.balanceIsEstimated);

  if (!scores.length) return 0.5;

  const enteredFailures = scores.filter((s) => s.entered && s.q < 0.5);
  const allEntered = scores.every((s) => s.entered);
  const maxScore = Math.max(...scores.map((s) => s.q));
  let confidence = maxScore;
  if (!allEntered && enteredFailures.length > 0) {
    confidence = Math.min(0.25, maxScore);
  }
  return Math.max(0, Math.min(1, confidence));
}

/**
 * Layer the per-user eligibility overlay on top of computeRanking's aggregates
 * and return the final, re-sorted list. Mirrors the tail of
 * apps/mobile/src/lib/algorithms.ts:computeRecommendations exactly.
 *
 * The aggregates already carry baseScore + feePenalty (+ a provisional score =
 * baseScore − feePenalty) from ranking-core. Here we add requirementStatus,
 * qualificationConfidence, qualificationDelta, recompute score, re-sort, and
 * filter out ineligible cards when eligibility is on with salary/balance.
 *
 * @param {Array<Object>} aggregates - from computeRanking({...}).aggregates
 * @param {Object} settings - { monthlySalary, accountBalance, useEligibility }
 * @param {Object} requirements - pack from buildRequirementsPack
 * @returns {Array<Object>} final personalized, re-sorted, filtered list
 */
export function applyEligibility(aggregates, settings, requirements) {
  const useEligibility = !!settings?.useEligibility;
  const monthlySalary = settings?.monthlySalary ?? null;
  const accountBalance = settings?.accountBalance ?? null;
  const hasEligibilityInput = monthlySalary !== null || accountBalance !== null;

  const evalSettings = { monthlySalary, accountBalance };

  for (const item of aggregates) {
    item.requirementStatus = evaluateEligibility(evalSettings, item.bank, item.card, requirements);
    item.qualificationConfidence = computeQualificationConfidence(evalSettings, item.requirementStatus);
    // Calibration #3: ±7.5 (15·(conf−0.5)) so eligibility nudges, not dominates.
    item.qualificationDelta = useEligibility && hasEligibilityInput
      ? 15 * (item.qualificationConfidence - 0.5)
      : 0;
    item.score = Math.max(
      0,
      Math.min(100, item.baseScore + item.qualificationDelta - item.feePenalty),
    );
  }

  let visible = aggregates;
  if (useEligibility && hasEligibilityInput) {
    visible = visible.filter((item) => item.requirementStatus.status !== "ineligible");
  }

  return visible.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.coverageAdjustedSaving !== a.coverageAdjustedSaving)
      return b.coverageAdjustedSaving - a.coverageAdjustedSaving;
    return b.coverage - a.coverage;
  });
}

/**
 * One pure entry point for the full personalized ranking pipeline: runs the
 * shared computeRanking core then layers the eligibility overlay on top.
 * Runtime-free — no fetch, no globals — so both the /api/rank Pages Function
 * and the parity test can import and call it directly.
 *
 * @param {Object} args
 * @param {Array<Object>} args.offers
 * @param {Object} [args.restaurantsEnrichment]
 * @param {Object} [args.requirements] - pack from buildRequirementsPack
 * @param {Object} args.settings - all ranking-core settings PLUS
 *   { monthlySalary, accountBalance, useEligibility }
 * @returns {{ recs: Array<Object>, totalVenueCount: number, scoringVenueCount: number }}
 */
export function rankCards({ offers, restaurantsEnrichment, requirements, settings }) {
  const { aggregates, totalVenueCount, scoringVenueCount } = computeRanking({
    offers,
    restaurantsEnrichment,
    requirements,
    settings,
  });
  const recs = applyEligibility(aggregates, settings, requirements);
  return { recs, totalVenueCount, scoringVenueCount };
}
