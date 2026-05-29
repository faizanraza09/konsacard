export function formatCurrency(value: number): string {
  return `PKR ${Math.round(value).toLocaleString("en-US")}`;
}

export function formatNumber(value: number): string {
  return Number(value).toLocaleString("en-US");
}

export function formatSavingsAmount(
  value: number,
  options: { per?: string; signed?: boolean } = {}
): string {
  const { per = "", signed = false } = options;
  const rounded = Math.round(Number(value) || 0);
  const unit = per ? `/${per}` : "";
  if (signed && rounded < 0) return `~Cost ${formatCurrency(Math.abs(rounded))}${unit}`;
  return `~Save ${formatCurrency(Math.abs(rounded))}${unit}`;
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function average(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function buildCardKey(bank: string, card: string): string {
  return `${bank} || ${card}`;
}

export function buildDealCardKey(bank: string, card: string): string {
  return `${normalizeDealCardFragment(bank)} || ${normalizeDealCardFragment(card)}`;
}

export function normalizeDealCardFragment(value: string): string {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function normalizeRequirementNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeCityValue(city: string | null | undefined): string {
  const normalized = String(city || "").trim().toLowerCase();
  return normalized || "all";
}

export function formatRequirementCriterion(
  value: number | null,
  kind: "salary" | "balance" | "fee"
): string | null {
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

export const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Mirrors web's formatRequirementFieldValue (apps/web/assets/state.js). Used by
// the compare screen and the CardRow stats strip so both surfaces speak the
// same language for annual fee / salary / balance values.
export function formatRequirementFieldValue(
  status: {
    hasRequirementRecord?: boolean;
    annualFeePkr?: number | null;
    annualFeeWaiverRule?: string | null;
    salaryReq?: number | null;
    balanceReq?: number | null;
    salaryIsEstimated?: boolean;
    balanceIsEstimated?: boolean;
  } | null | undefined,
  field: "salaryReq" | "balanceReq" | "annualFeePkr"
): string {
  if (!status?.hasRequirementRecord) return "Unavailable";
  const value = (status as Record<string, number | null | undefined>)[field];
  if (field === "annualFeePkr" && value === null && status.annualFeeWaiverRule) return "Conditional";
  if (value === null || value === undefined) return "Not listed";
  const est =
    (field === "salaryReq" && status.salaryIsEstimated) ||
    (field === "balanceReq" && status.balanceIsEstimated);
  if (value === 0) {
    if (field === "salaryReq") return "No minimum salary";
    if (field === "balanceReq") return "No minimum balance";
    return "No annual fee";
  }
  return `${est ? "~" : ""}${formatCurrency(value)}`;
}

// Pakistani consumers think in lakh/crore for large rupee amounts. For values
// ≥ 1 lakh (100,000) we render the lakh form ("PKR 1.73 lakh"); ≥ 1 crore the
// crore form. Below 1 lakh we fall back to the precise format, which is the
// right grain for per-outing / per-month savings. Mirrors web
// formatCurrencyShort (apps/web/assets/state.js) — keep the two in sync.
export function formatCurrencyShort(value: number): string {
  const v = Math.round(Number(value) || 0);
  const abs = Math.abs(v);
  if (abs >= 10_000_000) {
    const crore = v / 10_000_000;
    return `PKR ${crore.toFixed(crore >= 10 ? 1 : 2)} crore`;
  }
  if (abs >= 100_000) {
    const lakh = v / 100_000;
    return `PKR ${lakh.toFixed(lakh >= 10 ? 1 : 2)} lakh`;
  }
  return formatCurrency(v);
}
