import {
  evaluateEligibility,
  computeQualificationConfidence,
  eligibilityScoreDelta,
} from "@/lib/eligibility";
import type { AlgorithmState, RequirementsPack } from "@/types";

function makeState(over: Partial<AlgorithmState> = {}): AlgorithmState {
  const reqs: RequirementsPack = {
    available: true,
    byCardId: new Map(),
    mappingByDealKey: new Map(),
    estimatesByTier: new Map(),
  };
  return {
    data: null,
    requirements: reqs,
    selectedCity: "all",
    selectedDays: new Set(),
    selectedRestaurants: new Set(),
    selectedBanks: new Set(),
    selectedCardTypes: new Set(),
    selectedCards: new Set(),
    selectedCuisines: new Set(),
    orderValue: 10000,
    useEligibility: true,
    monthlySalary: null,
    accountBalance: null,
    outingsPerWeek: 1,
    ownedCards: new Set(),
    walletSize: 2,
    walletBuildOnOwned: false,
    walletMaxFee: null,
    walletNoSameBank: false,
    walletMixedTypes: false,
    walletObjective: "savings",
    walletMustInclude: new Set(),
    favoriteRestaurants: new Set(),
    ...over,
  };
}

function seed(
  reqs: RequirementsPack,
  bank: string,
  card: string,
  requirements: Record<string, number | null>
) {
  const id = `${bank.toLowerCase()}--${card.toLowerCase().replace(/\s+/g, "-")}`;
  reqs.byCardId.set(id, {
    card_id: id,
    bank_slug: bank.toLowerCase(),
    bank_name: bank,
    card_name: card,
    requirements,
  });
  reqs.mappingByDealKey.set(`${bank.toLowerCase()} || ${card.toLowerCase()}`, {
    deal_card_key: `${bank.toLowerCase()} || ${card.toLowerCase()}`,
    requirement_card_id: id,
    matched: true,
  });
}

describe("evaluateEligibility — Allied Visa Infinite Debit bug fix", () => {
  test("balance-only requirement with failing user balance returns ineligible (the bug we squashed)", () => {
    const state = makeState({ monthlySalary: null, accountBalance: 500_000 });
    seed(state.requirements!, "Allied Bank", "Visa Infinite Debit", {
      minimum_monthly_salary_pkr: 0,
      minimum_account_balance_pkr: 5_000_000,
      annual_fee_pkr: 0,
    });
    const status = evaluateEligibility(state, "allied bank", "visa infinite debit");
    expect(status.status).toBe("ineligible");
  });

  test("balance-only requirement with passing balance returns eligible", () => {
    const state = makeState({ accountBalance: 6_000_000 });
    seed(state.requirements!, "Allied Bank", "Visa Infinite Debit", {
      minimum_monthly_salary_pkr: 0,
      minimum_account_balance_pkr: 5_000_000,
    });
    const status = evaluateEligibility(state, "allied bank", "visa infinite debit");
    expect(status.status).toBe("eligible");
  });

  test("balance-only requirement with no balance entered returns needs_input", () => {
    const state = makeState({ accountBalance: null });
    seed(state.requirements!, "Allied Bank", "Visa Infinite Debit", {
      minimum_monthly_salary_pkr: 0,
      minimum_account_balance_pkr: 5_000_000,
    });
    const status = evaluateEligibility(state, "allied bank", "visa infinite debit");
    expect(status.status).toBe("needs_input");
  });
});

describe("evaluateEligibility — OR alternative paths", () => {
  test("both reqs, user passes salary but fails balance → eligible", () => {
    const state = makeState({ monthlySalary: 200_000, accountBalance: 500_000 });
    seed(state.requirements!, "Bank A", "Premium Card", {
      minimum_monthly_salary_pkr: 100_000,
      minimum_account_balance_pkr: 1_000_000,
    });
    expect(evaluateEligibility(state, "bank a", "premium card").status).toBe("eligible");
  });

  test("both reqs, both fail → ineligible", () => {
    const state = makeState({ monthlySalary: 50_000, accountBalance: 500_000 });
    seed(state.requirements!, "Bank A", "Premium Card", {
      minimum_monthly_salary_pkr: 100_000,
      minimum_account_balance_pkr: 1_000_000,
    });
    expect(evaluateEligibility(state, "bank a", "premium card").status).toBe("ineligible");
  });

  test("both reqs, balance fails but salary still missing → needs_input (user might rescue)", () => {
    const state = makeState({ monthlySalary: null, accountBalance: 500_000 });
    seed(state.requirements!, "Bank A", "Premium Card", {
      minimum_monthly_salary_pkr: 100_000,
      minimum_account_balance_pkr: 1_000_000,
    });
    expect(evaluateEligibility(state, "bank a", "premium card").status).toBe("needs_input");
  });
});

describe("computeQualificationConfidence — req=0 no longer dominates Math.max", () => {
  test("balance-only fail: confidence is 0, not 1", () => {
    const state = makeState({ accountBalance: 500_000 });
    seed(state.requirements!, "Allied Bank", "Visa Infinite Debit", {
      minimum_monthly_salary_pkr: 0,
      minimum_account_balance_pkr: 5_000_000,
    });
    const status = evaluateEligibility(state, "allied bank", "visa infinite debit");
    expect(computeQualificationConfidence(state, status)).toBe(0);
  });
});

describe("severe miss on an entered dimension is decisive (+ floor for mild misses)", () => {
  // The bug the product owner hit: enter a ~100k balance and every premium
  // "needs 2M balance / 400k salary" card still floods the top. The OLD code
  // only floored confidence to 0.25 (a ~-7.5pt nudge) because the unentered
  // salary field was treated as a rescue path. Now a SEVERE miss (<50% of the
  // requirement) on a dimension the user ACTUALLY entered is disqualifying
  // unless they clear some other listed path.
  test("balance entered at 25% of req, salary missing → ineligible (was needs_input)", () => {
    const state = makeState({ monthlySalary: null, accountBalance: 500_000 });
    seed(state.requirements!, "Allied Bank", "Visa Premium Debit", {
      minimum_monthly_salary_pkr: 416_667,
      minimum_account_balance_pkr: 2_000_000,
    });
    const status = evaluateEligibility(state, "allied bank", "visa premium debit");
    expect(status.status).toBe("ineligible");
    expect(computeQualificationConfidence(state, status)).toBe(0);
  });

  test("balance entered at a MILD miss (≥50% of req), salary missing → needs_input, capped at 0.25", () => {
    // 1.2M of a 2M requirement = ratio 0.6 (mild) → still deferred to the
    // unentered salary path, but confidence is floored so it ranks below sure things.
    const state = makeState({ monthlySalary: null, accountBalance: 1_200_000 });
    seed(state.requirements!, "Allied Bank", "Visa Premium Debit", {
      minimum_monthly_salary_pkr: 416_667,
      minimum_account_balance_pkr: 2_000_000,
    });
    const status = evaluateEligibility(state, "allied bank", "visa premium debit");
    expect(status.status).toBe("needs_input");
    expect(computeQualificationConfidence(state, status)).toBeLessThanOrEqual(0.25);
  });

  test("balance entered + passes, salary missing → confidence ≥ 0.8 (no floor applies)", () => {
    const state = makeState({ monthlySalary: null, accountBalance: 3_000_000 });
    seed(state.requirements!, "Allied Bank", "Visa Premium Debit", {
      minimum_monthly_salary_pkr: 416_667,
      minimum_account_balance_pkr: 2_000_000,
    });
    const status = evaluateEligibility(state, "allied bank", "visa premium debit");
    const confidence = computeQualificationConfidence(state, status);
    // ratio = 3M/2M = 1.5 → q = 1.0 for balance; salary missing → 0.5; floor doesn't apply since no entered failure
    expect(confidence).toBe(1.0);
  });

  test("both entered, one passes one fails → OR semantics, no floor", () => {
    // User has 300K salary (passes 100K req) but 500K balance (fails 1M req).
    // OR semantics: Math.max picks the salary pass. No floor because user has
    // explicitly entered every defined dimension, no rescue needed.
    const state = makeState({ monthlySalary: 300_000, accountBalance: 500_000 });
    seed(state.requirements!, "Bank A", "Premium Card", {
      minimum_monthly_salary_pkr: 100_000,
      minimum_account_balance_pkr: 1_000_000,
    });
    const status = evaluateEligibility(state, "bank a", "premium card");
    expect(status.status).toBe("eligible");
    const confidence = computeQualificationConfidence(state, status);
    expect(confidence).toBeGreaterThanOrEqual(0.8);
  });

  test("nothing entered → neutral 0.5 (no input means no opinion)", () => {
    const state = makeState({ monthlySalary: null, accountBalance: null });
    seed(state.requirements!, "Bank A", "Premium Card", {
      minimum_monthly_salary_pkr: 100_000,
      minimum_account_balance_pkr: 1_000_000,
    });
    const status = evaluateEligibility(state, "bank a", "premium card");
    expect(computeQualificationConfidence(state, status)).toBe(0.5);
  });
});

describe("eligibilityScoreDelta — asymmetric boost vs penalty", () => {
  test("neutral confidence (0.5) → no delta", () => {
    expect(eligibilityScoreDelta(0.5)).toBe(0);
  });
  test("full confidence → small positive boost (≤6)", () => {
    expect(eligibilityScoreDelta(1)).toBeCloseTo(6);
  });
  test("zero confidence → large negative penalty (≈ -45)", () => {
    expect(eligibilityScoreDelta(0)).toBeCloseTo(-45);
  });
  test("penalty magnitude dwarfs the boost (the whole point of decoupling)", () => {
    expect(Math.abs(eligibilityScoreDelta(0))).toBeGreaterThan(Math.abs(eligibilityScoreDelta(1)) * 3);
  });
});
