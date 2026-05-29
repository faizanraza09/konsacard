// Shape mirrors data/offers-*.json from the web app. Authoritative source:
// see card-match-pk/data/offers-lahore.json for example rows.

export type DayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type CardCategory = "debit" | "credit" | "other";

export type DiscountType = "percentage" | "fixed" | "up_to" | "bogo";

export type OrderType = "Dine-In" | "Takeaway" | "Delivery";

export interface Offer {
  city: string;
  restaurant: string;
  entityId?: number;
  bank: string;
  card: string;
  cardCategory?: CardCategory;
  discountPct: number | null;
  discountLabel: string;
  fixedDiscountPkr: number | null;
  offerTitle?: string;
  offerDescription?: string;
  days: number[]; // 0..6 Mon..Sun
  daysLabel?: string;
  capPkr: number | null;
  sourceMerchantName?: string;
  sourceAddress?: string;
  sourceLat?: number;
  sourceLng?: number;
  discountIsUpTo?: boolean;
  discountType?: DiscountType;
  orderTypes?: OrderType[];
  transactionLimitPerDay?: number | null;
  transactionLimitPerMonth?: number | null;
  branchCount?: number;
  branches?: string[];
}

export interface Branch {
  id?: number;
  name: string;
  address: string;
  city?: string;
  country?: string;
  lat?: number;
  lng?: number;
  telephone?: string;
  openingHours?: { day: string; opens: string; closes: string }[];
  isVerified?: boolean;
}

export interface RestaurantEnrichment {
  entityId?: number;
  description?: string;
  telephone?: string;
  social?: Record<string, string>;
  servesCuisine?: string[];
  branchesByCity?: Record<string, Branch[]>;
}

export interface OffersIndex {
  generatedAt: string;
  dayNames: string[];
  cities: string[];
  restaurantsByCity: Record<string, string[]>;
  stats: { offers: number; cards: number; banks: number; restaurants: number };
  cityFiles: Record<string, string>;
  restaurantsFile?: string;
  splitFormat?: string;
  /** Relative path to the precomputed summary, e.g. "./data/summary.json". */
  summaryFile?: string;
  /** Content hash of the summary, used as a cache-busting query param. */
  summaryVersion?: string;
}

export interface OffersBundle {
  generatedAt: string;
  dayNames: string[];
  offers: Offer[];
  restaurantsEnrichment: Record<string, RestaurantEnrichment>;
  stats: { offers: number; cards: number; banks: number; restaurants: number };
}

/**
 * A single precomputed card entry inside `summary.scopes[scope]`. These are
 * byte-identical to mobile's `computeRecommendations` output at the DEFAULT
 * scope (selectedCity=scope, orderValue=10000, outingsPerWeek=1, no filters,
 * eligibility off) EXCEPT they lack `requirementStatus` (added at render time
 * by `evaluateEligibility`) and `qualificationDelta` (0 at default). They carry
 * a few extra precompute-only fields (bankSlug/cardSlug) which the UI ignores.
 *
 * Shape is a structural subset of CardRecommendation minus requirementStatus,
 * so once we attach requirementStatus the result satisfies CardRecommendation.
 */
export type SummaryCard = Omit<CardRecommendation, "requirementStatus"> & {
  bankSlug?: string;
  cardSlug?: string;
};

/**
 * Parsed `summary.json` plus the index meta we need to render the Cards tab and
 * city tabs at cold start without loading the ~21 MB raw offers.
 */
export interface SummaryBundle {
  splitFormat: string;
  /** Bill amount the summary was precomputed at (10000). */
  orderValue: number;
  /** Cards per scope: "all" | "karachi" | "lahore" | "islamabad". */
  scopes: Record<string, SummaryCard[]>;
  restaurantDeals: Record<string, unknown[]>;
  facets: { banks: unknown; cardTypes: unknown; cards: unknown };
  // Index meta (carried so the UI can render freshness + city tabs cold).
  generatedAt: string;
  dayNames: string[];
  cities: string[];
  restaurantsByCity: Record<string, string[]>;
  stats: { offers: number; cards: number; banks: number; restaurants: number };
}

export interface CardRequirements {
  minimum_monthly_salary_pkr?: number | null;
  minimum_account_balance_pkr?: number | null;
  minimum_average_balance_pkr?: number | null;
  minimum_relationship_balance_pkr?: number | null;
  minimum_deposit_pkr?: number | null;
  annual_fee_pkr?: number | null;
  annual_fee_waiver_rule?: string | null;
  minimum_age_years?: number | null;
  maximum_age_years?: number | null;
}

export interface RequirementRecord {
  card_id: string;
  bank_slug: string;
  bank_name: string;
  card_name: string;
  requirements: CardRequirements;
  benefits?: string | null;
  source_ids?: string[];
  notes?: string[];
  bank_gaps?: string[];
  confidence?: string;
}

export interface RequirementMapping {
  deal_card_key: string;
  requirement_card_id: string | null;
  matched: boolean;
}

export interface EligibilityStatus {
  status:
    | "eligible"
    | "est_eligible"
    | "needs_input"
    | "est_needs_input"
    | "unclear"
    | "ineligible"
    | "est_ineligible"
    | "unavailable";
  label: string;
  tone: string;
  sortRank: number;
  detail: string;
  criteria: (string | null)[];
  annualFeePkr: number | null;
  annualFeeWaiverRule: string | null;
  salaryReq: number | null;
  balanceReq: number | null;
  isEstimated?: boolean;
  salaryIsEstimated?: boolean;
  balanceIsEstimated?: boolean;
  estimationNote?: string | null;
  hasRequirementRecord: boolean;
  sourceIds: string[];
  cardNotes: string[];
  bankGaps: string[];
  benefitSummary?: string | null;
}

export interface RequirementsPack {
  available: boolean;
  byCardId: Map<string, RequirementRecord>;
  mappingByDealKey: Map<string, RequirementMapping>;
  estimatesByTier: Map<
    string,
    { tier: string; medianSalary: number | null; medianBalance: number | null; peerCount: number }
  >;
}

export interface VenueMatch {
  venueKey: string;
  city: string;
  restaurant: string;
  rawSaving?: number;
  expectedSaving: number;
  perOutingDelta?: number;
  dayFit?: number;
  coveredDayCount?: number;
  discountPct: number | null;
  candidatePct?: number | null;
  discountLabel?: string;
  candidatePctLabel?: string;
  offerTitle?: string;
  offerDescription?: string;
  orderTypes?: OrderType[];
  daysLabel?: string;
  capPkr?: number | null;
  fixedDiscountPkr?: number | null;
  wasUncovered?: boolean;
}

export interface CardRecommendation {
  bank: string;
  card: string;
  cardCategory?: CardCategory | null;
  score: number;
  baseScore?: number;
  qualificationConfidence?: number;
  qualificationDelta?: number;
  avgExpectedSaving: number;
  coverage: number;
  avgDayFit: number;
  coveredVenueCount: number;
  totalVenueCount: number;
  averageDiscount: number | null;
  medianCap: number | null;
  /** Bill amount at which this card's typical cap kicks in. Null = uncapped in scope. */
  saturationBill: number | null;
  topMatches: VenueMatch[];
  requirementStatus: EligibilityStatus;
  coverageAdjustedSaving?: number;
  E?: number;
  feePenalty?: number;
}

export interface NextCardRecommendation {
  bank: string;
  card: string;
  cardCategory?: CardCategory | null;
  newVenues: number;
  boostedVenues: number;
  coveredVenues: number;
  venueCount: number;
  avgDeltaPerOuting: number;
  coverageDelta: number;
  yearlyDelta: number;
  totalDeltaSaving: number;
  topVenueWins: VenueMatch[];
  requirementStatus: EligibilityStatus;
  score: number;
  baseScore?: number;
  qualificationConfidence?: number;
  qualificationDelta?: number;
  E?: number;
}

export interface WalletPick {
  cardKey: string;
  bank: string;
  card: string;
  cardCategory?: CardCategory | null;
  marginalDelta: number;
  boostedVenues: number;
  newVenues: number;
  coveredByCard: number;
  requirementStatus: EligibilityStatus;
  pinned: boolean;
}

export interface WalletShape {
  picks: WalletPick[];
  perOutingTotal: number;
  coverage: number;
  coveredVenues: number;
  venueCount: number;
  totalAnnualFee: number;
  feeUnknown: boolean;
  feeBudgetBreached: boolean;
  mixedTypeSatisfied: boolean;
  walletKey: string;
  score?: number;
}

export interface WalletResult {
  ranked: WalletShape[];
  stats: {
    K?: number;
    venueCount: number;
    candidateCount: number;
    anchorCount?: number;
    buildOnOwned?: boolean;
    objective?: WalletObjective;
    noSameBank?: boolean;
    requireMixedTypes?: boolean;
    maxFee?: number | null;
    mustIncludeCount?: number;
    warnings: string[];
  };
}

export type WalletObjective = "savings" | "coverage" | "roi";

export interface NextCardResult {
  ranked: NextCardRecommendation[];
  stats: {
    ownedCount: number;
    venuesInScope: number;
    totalCandidates: number;
    wallet?: {
      perOuting: number;
      coverage: number;
      coveredVenues: number;
      venueCount: number;
      yearly: number;
      annualFee: number;
      feeUnknown: boolean;
    };
  };
}

export type ViewMode = "cards" | "restaurants" | "my-wallet" | "wallet";

export interface AlgorithmState {
  data: OffersBundle | null;
  requirements: RequirementsPack | null;
  selectedCity: string;
  selectedDays: Set<number>;
  selectedRestaurants: Set<string>;
  selectedBanks: Set<string>;
  selectedCardTypes: Set<string>;
  selectedCards: Set<string>;
  selectedCuisines: Set<string>;
  orderValue: number;
  useEligibility: boolean;
  monthlySalary: number | null;
  accountBalance: number | null;
  outingsPerWeek: number;
  ownedCards: Set<string>;
  walletSize: number;
  walletBuildOnOwned: boolean;
  walletMaxFee: number | null;
  walletNoSameBank: boolean;
  walletMixedTypes: boolean;
  walletObjective: WalletObjective;
  walletMustInclude: Set<string>;
  favoriteRestaurants: Set<string>;
}
