// @ts-check
/* ── STATE + CONSTANTS + UTIL HELPERS ──
   Foundation module loaded FIRST by index.html (before algorithms.js,
   chat.js, quiz.js, app.js). All other modules reference these names
   at function-call time, by which point everything is defined. */

/* ── STATE ── */
const state = {
  data: null,
  requirements: null,
  selectedCity: "all",           // nav city tab
  selectedDays: new Set(),
  selectedRestaurants: new Set(),
  selectedBanks: new Set(),
  selectedCardTypes: new Set(),
  selectedCards: new Set(),      // card name search filter
  bankSearchTerm: "",
  restSearchTerm: "",
  cardSearchTerm: "",            // card name search term
  orderValue: 10000,
  useEligibility: false,
  monthlySalary: null,
  accountBalance: null,
  outingsPerWeek: 1,
  viewMode: "cards",                 // "cards" | "restaurants" | "my-wallet" | "wallet"
  ownedCards: new Set(),             // Set of cardKey "${bank} || ${card}" the user currently has
  ownedCardSearchTerm: "",
  walletSize: 2,                     // K for Build Wallet (2..4)
  walletBuildOnOwned: false,         // when true, wallet is computed on top of ownedCards
  walletMaxFee: null,                // PKR cap on total annual fees of the wallet
  walletNoSameBank: false,           // diversity: no two cards from the same bank
  walletMixedTypes: false,           // require >=1 debit AND >=1 credit in wallet
  walletObjective: "savings",        // "savings" | "coverage" | "roi"
  walletMustInclude: new Set(),      // cardKeys that MUST appear in every wallet
  walletMustIncludeSearchTerm: "",
  walletAdvancedOpen: false,         // disclosure state for "Advanced options" panel
  favoriteRestaurants: new Set(),    // restaurant names the user has starred
  selectedCuisines: new Set(),       // cuisine filter from enrichment (e.g. "BBQ", "Italian")
  cuisineSearchTerm: "",             // live filter for the cuisine chip list
  userLocation: null,                // {lat, lng, ts} once user grants geolocation; persisted via localStorage
  detailCardKey: null,
  detailRestaurantKey: null,
  compareList: [],               // up to 2 card keys "bank || card"
  expandedCard: null,            // card key of expanded detail
  pagination: {
    results: 1,
    restaurantView: 1,
    cardDetailRestaurants: 1,
    restaurantDetailCards: 1,
    compareRestaurants: 1,
  },
  chatOpen: false,
  chatMessages: [],
  chatApiMessages: [],  // OpenAI-format messages including tool call/result history
  chatLoading: false,
};

const QUICK_QUESTIONS = [
  "Best card for Karachi?",
  "No credit card options?",
  "Highest discount %?",
  "Best low-fee options?",
];
const PAGINATION_ITEMS_PER_PAGE = 10;
const PAGE_ONE_LIST_SIZE = PAGINATION_ITEMS_PER_PAGE - 1;

const CITY_LABELS = {
  all: "All",
  karachi: "Karachi",
  lahore: "Lahore",
  islamabad: "Islamabad",
};

const CITY_ICON_ALL = `<svg viewBox="0 0 32 32" width="26" height="26" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="16" cy="15" rx="2.5" ry="11" fill="currentColor"/>
  <path d="M4.5 18.5 L16 14 L27.5 18.5 L16 21 Z" fill="currentColor"/>
  <path d="M12.5 25.5 L16 27.5 L19.5 25.5 L16 23.5 Z" fill="currentColor"/>
</svg>`;

const QUIZ_CITY_OPTIONS = [
  { value: "all",       label: "Multiple Cities", icon: CITY_ICON_ALL },
  { value: "karachi",   label: "Karachi",         iconSrc: "./assets/mazar-e-quaid.svg", iconAlt: "Mazar-e-Quaid icon" },
  { value: "lahore",    label: "Lahore",          iconSrc: "./assets/minar-e-pakistan.svg", iconAlt: "Minar-e-Pakistan icon" },
  { value: "islamabad", label: "Islamabad",       iconSrc: "./assets/faisal-mosque.svg", iconAlt: "Faisal Mosque icon" },
];

const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const COLLAPSIBLE_FILTER_BREAKPOINT = 768;
const CARD_TYPE_OPTIONS = [
  { value: "debit",  label: "Debit" },
  { value: "credit", label: "Credit" },
  { value: "other",  label: "Other" },
];
const QUIZ_CARD_TYPE_OPTIONS = [
  { value: "debit", label: "Debit Card", icon: "🏦" },
  { value: "credit", label: "Credit Card", icon: "💳" },
  { value: "other", label: "Digital Wallet", icon: "📱" },
];
const BANK_LOGO_FILES = {
  albarakabank: "al-baraka-bank.png",
  alliedbank: "allied-bank.png",
  askaribanklimited: "askari-bank.png",
  bankalhabib: "bank-al-habib.png",
  bankalfalah: "bank-alfalah.png",
  bankofpunjab: "bank-of-punjab.png",
  bankislami: "bankislami.png",
  easypaisa: "easypaisa.png",
  faysalbanklimited: "faysal-bank.png",
  habibbanklimited: "hbl.png",
  habibmetrobank: "habib-metro.png",
  hblislamicbanklimited: "hbl-islamic.png",
  jsbank: "js-bank.png",
  mcbbanklimited: "mcb-bank.png",
  mcbislamicbankltd: "mcb-islamic.png",
  meezanbank: "meezan-bank.png",
  nationalbankofpakistan: "national-bank-of-pakistan.png",
  standardcharteredbank: "standard-chartered.png",
  unitedbanklimitedubl: "ubl.png",
};

const BANK_APPLY_URLS = {
  albarakabank:          "https://www.albaraka.com.pk/",
  alliedbank:            "https://www.abl.com/Cards",
  askaribanklimited:     "https://www.askaribank.com.pk/Cards/",
  bankalhabib:           "https://www.bankalhabib.com/cards",
  bankalfalah:           "https://www.bankalfalah.com/personal-banking/credit-cards/",
  bankofpunjab:          "https://www.bop.com.pk/personal/cards",
  bankislami:            "https://www.bankislami.com.pk/personal/",
  easypaisa:             "https://www.easypaisa.com.pk/wallet/",
  faysalbanklimited:     "https://faysalbank.com/personal/cards/",
  habibbanklimited:      "https://www.hbl.com/personal/cards/",
  habibmetrobank:        "https://www.habibmetro.com/personal-banking/cards/",
  hblislamicbanklimited: "https://www.hbl.com/islamic/",
  jsbank:                "https://www.jsbl.com/personal/debit-card/",
  mcbbanklimited:        "https://www.mcb.com.pk/personal/cards/",
  mcbislamicbankltd:     "https://www.mcbislamicbank.com/personal/digital-banking/debit-cards/",
  meezanbank:            "https://www.meezanbank.com/",
  nationalbankofpakistan: "https://www.nbp.com.pk/",
  standardcharteredbank: "https://www.sc.com/pk/credit-cards/",
  unitedbanklimitedubl:  "https://www.ubl.com.pk/consumer-banking/cards/",
};

/* ── HELPERS ── */
function cityMatches(city) {
  const selectedCity = normalizeCityValue(state.selectedCity);
  return selectedCity === "all" || selectedCity === normalizeCityValue(city);
}

function normalizeCityValue(city) {
  const normalized = String(city || "").trim().toLowerCase();
  return normalized || "all";
}

function formatCityLabel(city) {
  const normalized = normalizeCityValue(city);
  return CITY_LABELS[normalized] || normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function cardTypeMatches(cardType) {
  const normalized = String(cardType || "other").trim().toLowerCase() || "other";
  return state.selectedCardTypes.size === 0 || state.selectedCardTypes.has(normalized);
}

function isEligibilityContextActive() {
  return state.useEligibility || state.monthlySalary !== null || state.accountBalance !== null;
}

function getEffectiveSelectedDays() {
  return state.selectedDays.size === 0
    ? new Set(state.data.dayNames.map((_, idx) => idx))
    : state.selectedDays;
}

function getTopPickCitiesLabel() {
  if (state.selectedCity !== "all") {
    return formatCityLabel(state.selectedCity);
  }
  return "All cities";
}

/* ── SAVING MATH ── moved to assets/algorithms.js */



function buildDealCardKey(bank, card) {
  return `${normalizeDealCardFragment(bank)} || ${normalizeDealCardFragment(card)}`;
}

function normalizeRequirementNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatRequirementCriterion(value, kind) {
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

function formatRequirementFieldValue(status, field) {
  if (!status?.hasRequirementRecord) return "Unavailable";
  const value = status[field];
  if (field === "annualFeePkr" && value === null && status.annualFeeWaiverRule) return "Conditional";
  if (value === null) return "Not listed";
  const est = (field === "salaryReq" && status.salaryIsEstimated) || (field === "balanceReq" && status.balanceIsEstimated);
  const prefix = est ? "~" : "";
  if (field === "benefitSummary") return value;
  if (field === "salaryReq")  return value === 0 ? "No minimum salary"  : `${prefix}${formatCurrency(value)} / month`;
  if (field === "balanceReq") return value === 0 ? "No minimum balance" : `${prefix}${formatCurrency(value)}`;
  if (field === "annualFeePkr") return value === 0 ? "No annual fee" : formatCurrency(value);
  return "Not listed";
}

function formatQualificationDeltaLabel(delta) {
  const hasEligibilityInput = state.monthlySalary !== null || state.accountBalance !== null;
  if (!hasEligibilityInput) return "";
  const value = Number(delta);
  if (!Number.isFinite(value) || Math.abs(value) < 0.05) return "";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)} qual`;
}

function normalizeDealCardFragment(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function parseOptionalNumber(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function scoreColor(score) {
  return score >= 70 ? "var(--green)" : score >= 50 ? "var(--amber)" : "var(--red)";
}

function formatCurrency(value) {
  return `PKR ${Math.round(value).toLocaleString("en-US")}`;
}

// Pakistani consumers think in lakh/crore for large rupee amounts. For values
// ≥ 1 lakh (100,000) we render the lakh form ("PKR 1.7 lakh"); ≥ 1 crore we
// render the crore form. Below 1 lakh we fall back to the precise format,
// which is the right grain for per-outing / per-month savings.
function formatCurrencyShort(value) {
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

function formatSavingsAmount(value, options = {}) {
  const { per = "", signed = false } = options;
  const rounded = Math.round(Number(value) || 0);
  const unit = per ? `/${per}` : "";
  if (signed && rounded < 0) return `~Cost ${formatCurrency(Math.abs(rounded))}${unit}`;
  return `~Save ${formatCurrency(Math.abs(rounded))}${unit}`;
}

function formatNumber(value) {
  return Number(value).toLocaleString("en-US");
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function average(values) {
  if (!values.length) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return String(value).replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
