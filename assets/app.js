// @ts-check
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

/* ── INIT ── */
async function init() {
  // The offers payload is now split per city (data/offers-<city>.json) with a
  // lightweight index (data/offers-index.json) that holds metadata + the
  // restaurantsByCity map. Loading three smaller files in parallel beats one
  // ~25MB JSON over the wire (especially on mobile 4G). If the split files
  // aren't available (older builds, dev that hasn't run the split script),
  // we fall back to the original monolithic offers.json.
  const [payload, requirements] = await Promise.all([
    loadOffersPayload(),
    loadRequirementsContext(),
  ]);
  state.data = payload;
  state.requirements = requirements;

  restoreStateFromUrl();
  bindEvents();
  syncDomToState();
  render();
}

async function loadOffersPayload() {
  let payload;
  try {
    const index = await fetchJson("./data/offers-index.json");
    if (!index || !index.cityFiles || !Array.isArray(index.cities)) {
      throw new Error("offers-index.json missing cityFiles or cities");
    }
    // Fetch all city files in parallel
    const cityFetches = index.cities.map((city) => {
      const url = index.cityFiles[city];
      if (!url) return Promise.resolve({ offers: [] });
      return fetchJson(url).catch((err) => {
        console.warn(`[offers] failed to load ${url}:`, err);
        return { offers: [] };
      });
    });
    const cityPayloads = await Promise.all(cityFetches);
    const offers = cityPayloads.flatMap((p) => (Array.isArray(p?.offers) ? p.offers : []));
    payload = { ...index, offers };
  } catch (err) {
    console.warn("[offers] split payload unavailable, falling back to offers.json", err);
    payload = await fetchJson("./data/offers.json");
  }
  validateOffersPayload(payload);
  return payload;
}

/**
 * Lightweight runtime schema check on the offers payload. We don't pull in
 * Zod or Ajv — instead we assert the shape the rest of the app assumes,
 * and surface a clear error in the UI if the build pipeline ever emits
 * something malformed (rather than silently rendering blank cards).
 *
 * Throws OffersSchemaError; the boot handler catches this and shows a
 * visible error block.
 */
function validateOffersPayload(payload) {
  const errors = [];
  if (!payload || typeof payload !== "object") errors.push("payload is not an object");
  if (!Array.isArray(payload?.cities) || payload.cities.length === 0) errors.push("cities[] missing or empty");
  if (!Array.isArray(payload?.dayNames) || payload.dayNames.length !== 7) errors.push("dayNames must be a 7-element array");
  if (!Array.isArray(payload?.offers)) errors.push("offers[] missing");
  if (!payload?.stats || typeof payload.stats.offers !== "number") errors.push("stats.offers must be a number");

  if (Array.isArray(payload?.offers) && payload.offers.length > 0) {
    // Spot-check the first few offers — full validation across 26k+ rows would be wasteful.
    const sampleSize = Math.min(50, payload.offers.length);
    for (let i = 0; i < sampleSize; i++) {
      const o = payload.offers[i];
      if (!o || typeof o !== "object") { errors.push(`offer[${i}] not an object`); continue; }
      const required = ["city", "restaurant", "bank", "card", "days"];
      for (const k of required) {
        if (o[k] === undefined || o[k] === null) {
          errors.push(`offer[${i}].${k} missing (bank=${o.bank || "?"} card=${o.card || "?"})`);
          break;
        }
      }
      if (!Array.isArray(o.days)) { errors.push(`offer[${i}].days must be an array`); continue; }
      // discountPct OR fixedDiscountPkr must be present for the saving math to work
      if (!Number.isFinite(o.discountPct) && !Number.isFinite(o.fixedDiscountPkr)) {
        // Some legitimate offers may have neither (e.g., text-only), so this is a warning, not an error.
      }
    }
  }

  if (errors.length > 0) {
    const err = new Error(
      "Offers payload failed schema validation:\n  - " + errors.slice(0, 8).join("\n  - ") +
      (errors.length > 8 ? `\n  ...and ${errors.length - 8} more` : "")
    );
    err.name = "OffersSchemaError";
    throw err;
  }
}

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Failed to load ${path}: ${response.status}`);
  return response.json();
}

async function loadRequirementsContext() {
  try {
    const [requirementsPayload, mappingPayload, sourcesPayload] = await Promise.all([
      fetchJson("./data/card-requirements/normalized/card_requirements.json"),
      fetchJson("./data/card-requirements/normalized/deal_requirement_card_map.json"),
      fetchJson("./data/card-requirements/normalized/sources.json"),
    ]);
    return {
      available: true,
      byCardId: new Map(requirementsPayload.map((row) => [row.card_id, row])),
      mappingByDealKey: new Map(
        mappingPayload.map((row) => [buildDealCardKey(row.deal_bank_name, row.deal_card_name), row]),
      ),
      sourcesById: new Map(sourcesPayload.map((s) => [s.source_id, s])),
      estimatesByTier: buildEstimatesByTier(requirementsPayload),
    };
  } catch {
    return { available: false, byCardId: new Map(), mappingByDealKey: new Map(), sourcesById: new Map(), estimatesByTier: new Map() };
  }
}

/* ── BIND EVENTS ── */
function bindCityChip() {
  const chip = document.getElementById("rh-chip-city");
  if (!chip) return;
  chip.addEventListener("click", () => {
    let picker = document.getElementById("city-chip-picker");
    if (picker) { picker.remove(); return; }
    if (!state.data) return;
    const cities = ["all", ...state.data.cities.map((c) => normalizeCityValue(c)).filter(Boolean)];
    picker = document.createElement("div");
    picker.id = "city-chip-picker";
    picker.className = "city-chip-picker";
    cities.forEach((city) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `city-chip-opt${state.selectedCity === city ? " active" : ""}`;
      btn.textContent = formatCityLabel(city);
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        state.selectedCity = city;
        picker.remove();
        render();
      });
      picker.appendChild(btn);
    });
    chip.style.position = "relative";
    chip.appendChild(picker);
    const dismiss = (ev) => {
      if (!chip.contains(ev.target)) {
        picker.remove();
        document.removeEventListener("click", dismiss, true);
      }
    };
    setTimeout(() => document.addEventListener("click", dismiss, true), 0);
  });
}

function bindEvents() {
  // Nav city tabs
  renderNavCityTabs();
  setupMobileNavMenu();

  // Sidebar bill slider
  const orderSlider = document.getElementById("order-value");
  if (orderSlider) {
    orderSlider.addEventListener("input", (e) => {
      state.orderValue = Number(e.target.value);
      render();
    });
  }

  // Restaurant search
  const restSearch = document.getElementById("restaurant-search");
  if (restSearch) {
    restSearch.addEventListener("input", (e) => {
      state.restSearchTerm = e.target.value.trim();
      renderRestaurantSearch();
    });
  }

  // Bank search
  const bankSearch = document.getElementById("bank-search");
  if (bankSearch) {
    bankSearch.addEventListener("input", (e) => {
      state.bankSearchTerm = e.target.value.trim();
      renderBankSearch();
    });
  }

  // Card search
  const cardSearch = document.getElementById("card-search");
  if (cardSearch) {
    cardSearch.addEventListener("input", (e) => {
      state.cardSearchTerm = e.target.value.trim();
      renderCardSearch();
    });
  }

  // Eligibility
  const monthlySalary = document.getElementById("monthly-salary");
  const accountBalance = document.getElementById("account-balance");
  const clearElig = document.getElementById("clear-eligibility");

  function syncEligibilityState() {
    state.useEligibility = state.monthlySalary !== null || state.accountBalance !== null;
    if (clearElig) clearElig.style.display = state.useEligibility ? "" : "none";
  }

  if (monthlySalary) {
    monthlySalary.addEventListener("input", (e) => {
      state.monthlySalary = parseOptionalNumber(e.target.value);
      syncEligibilityState();
      render();
    });
  }
  if (accountBalance) {
    accountBalance.addEventListener("input", (e) => {
      state.accountBalance = parseOptionalNumber(e.target.value);
      syncEligibilityState();
      render();
    });
  }
  if (clearElig) {
    clearElig.addEventListener("click", () => {
      state.useEligibility = false;
      state.monthlySalary = null;
      state.accountBalance = null;
      if (monthlySalary) monthlySalary.value = "";
      if (accountBalance) accountBalance.value = "";
      clearElig.style.display = "none";
      render();
    });
  }

  // Reset all
  const resetBtn = document.getElementById("reset-filters");
  if (resetBtn) resetBtn.addEventListener("click", resetFilters);

  // Quiz
  const openQuizBtn = document.getElementById("btn-open-quiz");
  if (openQuizBtn) openQuizBtn.addEventListener("click", () => {
    trackEvent("quiz_open");
    openQuiz();
  });

  // Find My Card FAB (mobile)

  // Compare tray
  const cmpClear = document.getElementById("btn-cmp-clear");
  if (cmpClear) cmpClear.addEventListener("click", () => {
    state.compareList = [];
    renderCompareTray();
    renderRecommendations();
  });
  const cmpOpen = document.getElementById("btn-compare-open");
  if (cmpOpen) cmpOpen.addEventListener("click", () => openCompareModal());

  // Chat
  document.getElementById("chat-fab")?.addEventListener("click", openChat);
  document.getElementById("chat-close")?.addEventListener("click", closeChat);
  document.getElementById("chat-clear-btn")?.addEventListener("click", clearChat);
document.getElementById("chat-send")?.addEventListener("click", () => {
    const inp = document.getElementById("chat-input");
    if (inp) sendChatMessage(inp.value);
  });
  const chatInput = document.getElementById("chat-input");
  if (chatInput) {
    chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage(chatInput.value);
      }
    });
    // Auto-resize textarea
    chatInput.addEventListener("input", () => {
      chatInput.style.height = "auto";
      chatInput.style.height = Math.min(chatInput.scrollHeight, 80) + "px";
    });
  }

  // Mobile tabs
  const tabFilters = document.getElementById("mob-tab-filters");
  const tabResults = document.getElementById("mob-tab-results");
  const tabChat = document.getElementById("mob-tab-chat");
  if (tabFilters) tabFilters.addEventListener("click", () => {
    const sidebar = document.getElementById("sidebar");
    const main = document.getElementById("main-content");
    if (sidebar) sidebar.classList.toggle("mob-open");
    setActiveTab("mob-tab-filters");
    if (main) main.style.display = sidebar?.classList.contains("mob-open") ? "none" : "";
  });
  if (tabResults) tabResults.addEventListener("click", () => {
    const sidebar = document.getElementById("sidebar");
    const main = document.getElementById("main-content");
    if (sidebar) sidebar.classList.remove("mob-open");
    if (main) main.style.display = "";
    setActiveTab("mob-tab-results");
  });
  if (tabChat) tabChat.addEventListener("click", () => {
    openChat();
    setActiveTab("mob-tab-chat");
  });

  // Tonight button
  document.getElementById("btn-tonight")?.addEventListener("click", () => {
    const todayIdx = (new Date().getDay() + 6) % 7;
    if (state.selectedDays.size === 1 && state.selectedDays.has(todayIdx)) {
      state.selectedDays = new Set();
    } else {
      state.selectedDays = new Set([todayIdx]);
    }
    render();
  });

  // View toggle
  document.getElementById("btn-view-cards")?.addEventListener("click", () => {
    state.viewMode = "cards";
    trackEvent("view_change", { view: "cards" });
    render();
  });
  document.getElementById("btn-view-restaurants")?.addEventListener("click", () => {
    state.viewMode = "restaurants";
    trackEvent("view_change", { view: "restaurants" });
    render();
  });
  document.getElementById("btn-view-next-card")?.addEventListener("click", () => {
    state.viewMode = "my-wallet";
    trackEvent("view_change", { view: "my-wallet" });
    render();
  });
  document.getElementById("btn-view-wallet")?.addEventListener("click", () => {
    state.viewMode = "wallet";
    trackEvent("view_change", { view: "wallet" });
    render();
  });

  // Card detail modal
  document.getElementById("card-detail-modal")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeCardDetail();
  });
  document.getElementById("restaurant-detail-modal")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeRestaurantDetail();
  });

  // Modals close on backdrop click
  document.getElementById("quiz-modal")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeQuiz();
  });
  document.getElementById("compare-modal")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeCompareModal();
  });
}

function setActiveTab(id) {
  document.querySelectorAll(".mob-tab").forEach((t) => t.classList.remove("active"));
  document.getElementById(id)?.classList.add("active");
}

/* ── RESET ── */
function resetFilters() {
  state.selectedCity = "all";
  state.selectedDays = new Set();
  state.selectedRestaurants = new Set();
  state.selectedBanks = new Set();
  state.selectedCardTypes = new Set();
  state.selectedCards = new Set();
  state.bankSearchTerm = "";
  state.restSearchTerm = "";
  state.cardSearchTerm = "";
  state.orderValue = 10000;
  state.outingsPerWeek = 1;
  state.viewMode = "cards";
  state.useEligibility = false;
  state.monthlySalary = null;
  state.accountBalance = null;
  state.ownedCards = new Set();
  state.ownedCardSearchTerm = "";
  state.walletSize = 2;
  state.walletBuildOnOwned = false;
  state.walletMaxFee = null;
  state.walletNoSameBank = false;
  state.walletMixedTypes = false;
  state.walletObjective = "savings";
  state.walletMustInclude = new Set();
  state.walletMustIncludeSearchTerm = "";
  state.walletAdvancedOpen = false;

  const orderSlider = document.getElementById("order-value");
  if (orderSlider) orderSlider.value = "10000";
  const restSearch = document.getElementById("restaurant-search");
  if (restSearch) restSearch.value = "";
  const bankSearch = document.getElementById("bank-search");
  if (bankSearch) bankSearch.value = "";
  const cardSearch = document.getElementById("card-search");
  if (cardSearch) cardSearch.value = "";
  const clearEligBtn = document.getElementById("clear-eligibility");
  if (clearEligBtn) clearEligBtn.style.display = "none";
  const monthlySalary = document.getElementById("monthly-salary");
  if (monthlySalary) monthlySalary.value = "";
  const accountBalance = document.getElementById("account-balance");
  if (accountBalance) accountBalance.value = "";

  render();
}

/* ── RENDER ── */
function render() {
  pruneRestaurants();
  pruneCards();
  renderOrderValueLabel();
  renderOutingsPills();
  renderNavCityTabs();
  renderDayPills();
  renderCardTypePills();
  renderBankSearch();
  renderSelectedBanks();
  renderRestaurantSearch();
  renderSelectedRestaurants();
  renderRecommendations();
  updateMobileFilterBadge();
  updateTonightButton();
  updateViewToggle();
  encodeStateToUrl();
}

function renderOrderValueLabel() {
  const label = document.getElementById("order-value-label");
  if (label) label.textContent = formatCurrency(state.orderValue);
  const billSummary = document.getElementById("bill-summary");
  if (billSummary) billSummary.textContent = formatCurrency(state.orderValue);
}

/* ── NAV CITY TABS ── */
function renderNavCityTabs() {
  if (!state.data) return;
  const cities = ["all", ...state.data.cities.map((city) => normalizeCityValue(city)).filter(Boolean)];

  const buildTabs = (container, btnClass) => {
    if (!container) return;
    container.innerHTML = "";
    cities.forEach((city) => {
      const btn = document.createElement("button");
      btn.className = `${btnClass}${state.selectedCity === city ? " active" : ""}`;
      btn.textContent = formatCityLabel(city);
      btn.type = "button";
      btn.addEventListener("click", () => {
        state.selectedCity = city;
        render();
      });
      container.appendChild(btn);
    });
  };

  buildTabs(document.getElementById("nav-city-tabs"), "city-tab");
  buildTabs(document.getElementById("rh-city-tabs"), "rh-city-tab");
}

function updateCityChip() {
  // city chip replaced by rh-city-tabs — kept for any external callers
}

/* ── DAY PILLS ── */
function renderDayPills() {
  if (!state.data) return;
  const container = document.getElementById("day-pills");
  if (!container) return;
  container.innerHTML = "";
  state.data.dayNames.forEach((dayName, index) => {
    const btn = document.createElement("button");
    btn.className = `s-pill${state.selectedDays.has(index) ? " active" : ""}`;
    btn.textContent = DAY_SHORT[index];
    btn.title = dayName;
    btn.type = "button";
    btn.addEventListener("click", () => {
      if (state.selectedDays.has(index)) {
        state.selectedDays.delete(index);
      } else {
        state.selectedDays.add(index);
      }
      renderDayPills();
      renderRecommendations();
    });
    container.appendChild(btn);
  });
}

/* ── CARD TYPE PILLS ── */
function renderCardTypePills() {
  const container = document.getElementById("card-type-pills");
  if (!container) return;
  container.innerHTML = "";
  CARD_TYPE_OPTIONS.forEach(({ value, label }) => {
    const btn = document.createElement("button");
    btn.className = `s-pill${state.selectedCardTypes.has(value) ? " active" : ""}`;
    btn.textContent = label;
    btn.type = "button";
    btn.addEventListener("click", () => {
      if (state.selectedCardTypes.has(value)) {
        state.selectedCardTypes.delete(value);
      } else {
        state.selectedCardTypes.add(value);
      }
      renderCardTypePills();
      renderRecommendations();
    });
    container.appendChild(btn);
  });
}

/* ── BANK SEARCH ── */
function getAvailableBanks() {
  if (!state.data) return [];
  const bankCounts = new Map();
  state.data.offers.forEach((offer) => {
    if (!cityMatches(offer.city)) return;
    if (!cardTypeMatches(offer.cardCategory)) return;
    bankCounts.set(offer.bank, (bankCounts.get(offer.bank) || 0) + 1);
  });
  return Array.from(bankCounts.keys()).sort((a, b) => a.localeCompare(b));
}

function renderBankSearch() {
  const banks = getAvailableBanks();
  state.selectedBanks.forEach((bank) => {
    if (!banks.includes(bank)) state.selectedBanks.delete(bank);
  });

  const term = state.bankSearchTerm.toLowerCase();
  const results = banks
    .filter((b) => !state.selectedBanks.has(b))
    .filter((b) => !term || b.toLowerCase().includes(term))
    .slice(0, 10);

  const container = document.getElementById("bank-results");
  if (!container) return;
  container.innerHTML = "";
  results.forEach((bank) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "s-search-item";
    item.innerHTML = `<span>${escapeHtml(bank)}</span><span class="s-search-item-add">Add</span>`;
    item.addEventListener("click", () => {
      state.selectedBanks.add(bank);
      state.bankSearchTerm = "";
      const bankSearch = document.getElementById("bank-search");
      if (bankSearch) bankSearch.value = "";
      render();
    });
    container.appendChild(item);
  });
}

function renderSelectedBanks() {
  const container = document.getElementById("selected-banks");
  if (!container) return;
  container.innerHTML = "";
  Array.from(state.selectedBanks).sort((a, b) => a.localeCompare(b)).forEach((bank) => {
    const chip = document.createElement("div");
    chip.className = "s-chip";
    chip.innerHTML = `<span>${escapeHtml(bank)}</span>`;
    const rm = document.createElement("button");
    rm.className = "s-chip-remove";
    rm.type = "button";
    rm.textContent = "×";
    rm.setAttribute("aria-label", `Remove ${bank}`);
    rm.addEventListener("click", () => { state.selectedBanks.delete(bank); render(); });
    chip.appendChild(rm);
    container.appendChild(chip);
  });
}

/* ── CARD SEARCH ── */
function getAvailableCards() {
  if (!state.data) return [];
  const cardSet = new Set();
  state.data.offers.forEach((offer) => {
    if (!cityMatches(offer.city)) return;
    if (!cardTypeMatches(offer.cardCategory)) return;
    if (state.selectedBanks.size > 0 && !state.selectedBanks.has(offer.bank)) return;
    if (state.selectedRestaurants.size > 0 && !state.selectedRestaurants.has(offer.restaurant)) return;
    cardSet.add(offer.card);
  });
  return Array.from(cardSet).sort((a, b) => a.localeCompare(b));
}

function pruneCards() {
  const available = new Set(getAvailableCards());
  state.selectedCards.forEach((card) => {
    if (!available.has(card)) state.selectedCards.delete(card);
  });
}

function renderCardSearch() {
  const available = getAvailableCards();
  const term = state.cardSearchTerm.toLowerCase();
  const results = available
    .filter((c) => !state.selectedCards.has(c))
    .filter((c) => !term || c.toLowerCase().includes(term))
    .slice(0, 14);

  const container = document.getElementById("card-results");
  if (!container) return;
  container.innerHTML = "";
  results.forEach((card) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "s-search-item";
    item.innerHTML = `<span>${escapeHtml(card)}</span><span class="s-search-item-add">Add</span>`;
    item.addEventListener("click", () => {
      state.selectedCards.add(card);
      state.cardSearchTerm = "";
      const cardSearch = document.getElementById("card-search");
      if (cardSearch) cardSearch.value = "";
      render();
    });
    container.appendChild(item);
  });
}

function renderSelectedCards() {
  const container = document.getElementById("selected-cards");
  if (!container) return;
  container.innerHTML = "";

  const count = state.selectedCards.size;
  const countEl = document.getElementById("selected-cards-count");
  if (countEl) {
    countEl.textContent = count > 0 ? `(${count})` : "";
    countEl.style.display = count > 0 ? "" : "none";
  }

  Array.from(state.selectedCards).sort((a, b) => a.localeCompare(b)).forEach((card) => {
    const chip = document.createElement("div");
    chip.className = "s-chip";
    chip.innerHTML = `<span>${escapeHtml(card)}</span>`;
    const rm = document.createElement("button");
    rm.className = "s-chip-remove";
    rm.type = "button";
    rm.textContent = "×";
    rm.setAttribute("aria-label", `Remove ${card}`);
    rm.addEventListener("click", () => { state.selectedCards.delete(card); render(); });
    chip.appendChild(rm);
    container.appendChild(chip);
  });
}

/* ── RESTAURANT SEARCH ── */
function getAvailableRestaurants() {
  if (!state.data) return [];
  const names = new Set();
  state.data.offers.forEach((offer) => {
    if (!cityMatches(offer.city)) return;
    if (!cardTypeMatches(offer.cardCategory)) return;
    if (state.selectedBanks.size > 0 && !state.selectedBanks.has(offer.bank)) return;
    names.add(offer.restaurant);
  });
  return Array.from(names).sort((a, b) => a.localeCompare(b));
}

function pruneRestaurants() {
  const available = new Set(getAvailableRestaurants());
  state.selectedRestaurants.forEach((name) => {
    if (!available.has(name)) state.selectedRestaurants.delete(name);
  });
}

function renderRestaurantSearch() {
  const available = getAvailableRestaurants();
  const term = state.restSearchTerm.toLowerCase();
  const results = available
    .filter((r) => !state.selectedRestaurants.has(r))
    .filter((r) => !term || r.toLowerCase().includes(term))
    .slice(0, 14);

  const container = document.getElementById("restaurant-results");
  if (!container) return;
  container.innerHTML = "";
  results.forEach((restaurant) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "s-search-item";
    item.innerHTML = `<span>${escapeHtml(restaurant)}</span><span class="s-search-item-add">Add</span>`;
    item.addEventListener("click", () => {
      state.selectedRestaurants.add(restaurant);
      state.restSearchTerm = "";
      const restSearch = document.getElementById("restaurant-search");
      if (restSearch) restSearch.value = "";
      render();
    });
    container.appendChild(item);
  });
}

function renderSelectedRestaurants() {
  const container = document.getElementById("selected-restaurants");
  if (!container) return;
  container.innerHTML = "";

  const count = state.selectedRestaurants.size;
  const countEl = document.getElementById("selected-rest-count");
  if (countEl) {
    countEl.textContent = count > 0 ? `(${count})` : "";
    countEl.style.display = count > 0 ? "" : "none";
  }

  Array.from(state.selectedRestaurants).sort((a, b) => a.localeCompare(b)).forEach((restaurant) => {
    const chip = document.createElement("div");
    chip.className = "s-chip";
    chip.innerHTML = `<span>${escapeHtml(restaurant)}</span>`;
    const rm = document.createElement("button");
    rm.className = "s-chip-remove";
    rm.type = "button";
    rm.textContent = "×";
    rm.setAttribute("aria-label", `Remove ${restaurant}`);
    rm.addEventListener("click", () => { state.selectedRestaurants.delete(restaurant); render(); });
    chip.appendChild(rm);
    container.appendChild(chip);
  });
}

/* ── RECOMMENDATIONS ── */
function renderRecommendations() {
  const results = computeRecommendations();
  const countEl   = document.getElementById("result-count");
  const rhSub     = document.getElementById("rh-sub");
  const emptyState = document.getElementById("empty-state");
  const topPick   = document.getElementById("top-pick");
  const resultsGrid = document.getElementById("results-grid");
  const summaryBest = document.getElementById("summary-best");

  updateCityChip();

  const countLabel = document.getElementById("result-count-label");
  if (state.viewMode === "my-wallet") {
    renderNextCardView(resultsGrid);
    renderCompareTray();
    return;
  }
  if (state.viewMode === "wallet") {
    renderWalletView(resultsGrid);
    renderCompareTray();
    return;
  }
  if (state.viewMode === "restaurants") {
    const deals = computeRestaurantDeals();
    if (countEl) countEl.textContent = String(deals.length);
    if (countLabel) countLabel.textContent = "restaurants matched";
    if (rhSub) rhSub.textContent = `Restaurants with active deals · at ${formatCurrency(state.orderValue)} bill`;
    if (summaryBest) summaryBest.textContent = deals.length > 0 ? `${deals[0].discountLabel} at ${deals[0].restaurant}` : "—";
    if (emptyState) emptyState.classList.add("hidden");
    if (topPick) topPick.innerHTML = "";
    renderRestaurantView(resultsGrid);
    renderCompareTray();
    return;
  }

  if (countEl) countEl.textContent = String(results.length);
  if (countLabel) countLabel.textContent = "cards matched";
  if (rhSub) {
    rhSub.textContent = `Ranked by estimated savings on a ${formatCurrency(state.orderValue)} bill`;
  }
  if (summaryBest) {
    summaryBest.textContent = results.length > 0
      ? `${formatCurrency(results[0].avgExpectedSaving)} / outing`
      : "—";
  }

  if (results.length === 0) {
    setEmptyStateCopy();
    if (emptyState) emptyState.classList.remove("hidden");
    if (topPick) topPick.innerHTML = "";
    if (resultsGrid) resultsGrid.innerHTML = "";
    renderCompareTray();
    return;
  }

  if (emptyState) emptyState.classList.add("hidden");
  if (topPick) topPick.innerHTML = "";
  renderPagedResultCards(results, resultsGrid);
  renderCompareTray();
}

function normalizeBankKey(bank) {
  return String(bank || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function getBankLogoPath(bank) {
  const filename = BANK_LOGO_FILES[normalizeBankKey(bank)];
  return filename ? `./assets/bank-logos/${filename}` : "";
}

function getBankLogoInitials(bank) {
  return String(bank || "")
    .split(/\s+/)
    .map((part) => part[0] || "")
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

function renderBankLogo(bank, className) {
  const src = getBankLogoPath(bank);
  const initials = getBankLogoInitials(bank);
  return `
    <div class="${escapeAttr(className)}">
      ${src ? `<img class="bank-logo-image" src="${escapeAttr(src)}" alt="${escapeAttr(bank)} logo" loading="lazy" onerror="this.style.display='none'" />` : ""}
      ${src ? "" : `<span class="bank-logo-fallback">${escapeHtml(initials)}</span>`}
    </div>
  `;
}

function renderMetricLabel(label) {
  return `<span class="metric-label-text">${escapeHtml(label)}</span>`;
}

/* ── FEATURED CARD ── */
function renderFeaturedCard(result, container) {
  if (!container) return;
  const cardKey = buildCardKey(result.bank, result.card);
  const inCmp = state.compareList.includes(cardKey);
  const canCmp = state.compareList.length < 2 || inCmp;
  const isExpanded = state.expandedCard === cardKey;
  const score = Number(result.score).toFixed(1);
  const scorePct = Math.max(0, Math.min(100, Number(result.score) || 0));
  const sc = scoreColor(scorePct);
  const showEligibility = isEligibilityContextActive();
  const eligStatus = result.requirementStatus;
  container.innerHTML = `
    <article class="card-item card-item--featured${inCmp ? " in-compare" : ""}" id="feat-${escapeAttr(cardKey)}" data-key="${escapeAttr(cardKey)}" tabindex="0" role="button" aria-label="Open details for ${escapeAttr(result.card)} from ${escapeAttr(result.bank)}">
      <div class="card-row card-row--clickable">
        <div class="card-rank rank-1">1</div>
        ${renderBankLogo(result.bank, "card-logo-box")}
        <div class="card-info">
          <div class="card-badges">
            <span class="badge-top-pick">#1 TOP PICK</span>
            ${showEligibility ? renderEligibilityBadge(eligStatus) : ""}
          </div>
          <div class="card-name">${escapeHtml(result.card)}</div>
          <div class="card-bank">${escapeHtml(result.bank)}</div>
        </div>
        <div class="score-box">
          <div class="score-num" style="color:${sc}">${score}</div>
          <div class="score-label">Fit Score</div>
          <div class="score-bar">
            <div class="score-bar-fill" style="width:${scorePct}%;background:${sc}"></div>
          </div>
        </div>
        <div class="card-btns">
          <button class="btn-compare${inCmp ? " active" : ""}" data-key="${escapeAttr(cardKey)}" type="button"
            ${!canCmp ? "disabled" : ""}>
            ${inCmp ? "✓ Comparing" : "+ Compare"}
          </button>
        </div>
      </div>
      <div class="card-stats-row card-stats-row--clickable">
        <div class="card-stat">
          <div class="cs-l">${renderMetricLabel("Estimated Saving")}</div>
          <div class="cs-v green">${formatCurrency(result.avgExpectedSaving)} / outing</div>
        </div>
        <div class="card-stat">
          <div class="cs-l">${renderMetricLabel("Restaurants Matched")}</div>
          <div class="cs-v">${result.coveredVenueCount} of ${result.totalVenueCount}</div>
        </div>
        <div class="card-stat">
          <div class="cs-l">${renderMetricLabel("Annual Fees")}</div>
          <div class="cs-v">${result.requirementStatus?.annualFeePkr === null ? "Not listed" : result.requirementStatus?.annualFeePkr === 0 ? "Free" : result.requirementStatus?.annualFeeWaiverRule ? `${formatCurrency(result.requirementStatus?.annualFeePkr)} (waivable)` : formatCurrency(result.requirementStatus?.annualFeePkr)}</div>
        </div>
        <div class="card-stat">
          <div class="cs-l">${renderMetricLabel("Typical Cap")}</div>
          <div class="cs-v">${result.medianCap !== null ? formatCurrency(result.medianCap) : "No cap"}</div>
        </div>
      </div>
      ${isExpanded ? renderCardDetail(result) : ""}
    </article>
  `;

  container.querySelector(".btn-compare")?.addEventListener("click", (e) => {
    toggleCompare(e.currentTarget.dataset.key);
  });
  bindCardOpenInteractions(container.querySelector("article"), cardKey);
}

/* ── RESULT CARDS ── */
function renderResultCards(results, container) {
  if (!container) return;
  container.innerHTML = "";

  results.forEach((result, index) => {
    const page = state.pagination.results || 1;
    const rank = page === 1 ? index + 2 : PAGE_ONE_LIST_SIZE + (page - 2) * PAGINATION_ITEMS_PER_PAGE + index + 2;
    const cardKey = buildCardKey(result.bank, result.card);
    const inCmp = state.compareList.includes(cardKey);
    const canCmp = state.compareList.length < 2 || inCmp;
    const isExpanded = state.expandedCard === cardKey;
    const score = Number(result.score).toFixed(1);
    const scorePct = Math.max(0, Math.min(100, Number(result.score) || 0));
    const sc = scoreColor(scorePct);
    const showEligibility = isEligibilityContextActive();
    const eligStatus = result.requirementStatus;

    const article = document.createElement("article");
    article.className = `card-item${inCmp ? " in-compare" : ""}`;
    article.style.animationDelay = `${index * 0.05}s`;
    article.dataset.key = cardKey;

    article.innerHTML = `
      <div class="card-row card-row--clickable">
        <div class="card-rank${rank === 1 ? " rank-1" : ""}">${rank}</div>
        ${renderBankLogo(result.bank, "card-logo-box")}
        <div class="card-info">
          <div class="card-badges">
            ${showEligibility ? renderEligibilityBadge(eligStatus) : ""}
          </div>
          <div class="card-name">${escapeHtml(result.card)}</div>
          <div class="card-bank">${escapeHtml(result.bank)}</div>
        </div>
        <div class="score-box">
          <div class="score-num" style="color:${sc}">${score}</div>
          <div class="score-label">Fit Score</div>
          <div class="score-bar">
            <div class="score-bar-fill" style="width:${scorePct}%;background:${sc}"></div>
          </div>
        </div>
        <div class="card-btns">
          <button class="btn-compare${inCmp ? " active" : ""}" data-key="${escapeAttr(cardKey)}" type="button"
            ${!canCmp ? "disabled" : ""}>
            ${inCmp ? "✓ Comparing" : "+ Compare"}
          </button>
        </div>
      </div>
      <div class="card-stats-row card-stats-row--clickable">
        <div class="card-stat">
          <div class="cs-l">${renderMetricLabel("Estimated Saving")}</div>
          <div class="cs-v green">${formatCurrency(result.avgExpectedSaving)} / outing</div>
        </div>
        <div class="card-stat">
          <div class="cs-l">${renderMetricLabel("Restaurants Matched")}</div>
          <div class="cs-v">${result.coveredVenueCount} of ${result.totalVenueCount}</div>
        </div>
        <div class="card-stat">
          <div class="cs-l">${renderMetricLabel("Annual Fees")}</div>
          <div class="cs-v">${result.requirementStatus?.annualFeePkr === null ? "Not listed" : result.requirementStatus?.annualFeePkr === 0 ? "Free" : result.requirementStatus?.annualFeeWaiverRule ? `${formatCurrency(result.requirementStatus?.annualFeePkr)} (waivable)` : formatCurrency(result.requirementStatus?.annualFeePkr)}</div>
        </div>
        <div class="card-stat">
          <div class="cs-l">${renderMetricLabel("Typical Cap")}</div>
          <div class="cs-v">${result.medianCap !== null ? formatCurrency(result.medianCap) : "No cap"}</div>
        </div>
      </div>
      ${isExpanded ? renderCardDetail(result) : ""}
    `;

    article.querySelector(".btn-compare")?.addEventListener("click", (e) => {
      toggleCompare(e.currentTarget.dataset.key);
    });
    article.tabIndex = 0;
    article.setAttribute("role", "button");
    article.setAttribute("aria-label", `Open details for ${result.card} from ${result.bank}`);
    bindCardOpenInteractions(article, cardKey);

    container.appendChild(article);
  });
}

function renderPagedResultCards(results, container) {
  if (!container) return;

  const allResults = results;
  container.innerHTML = `
    <div class="cards-view-search-wrap">
      <input type="search" class="s-search cards-view-search" placeholder="Search ${results.length} cards…" autocomplete="off" />
    </div>
    <div class="cards-view-featured"></div>
    <div class="cards-view-list"></div>
  `;

  const searchInput = container.querySelector(".cards-view-search");
  const featuredContainer = container.querySelector(".cards-view-featured");
  const listContainer = container.querySelector(".cards-view-list");

  const renderRows = () => {
    const term = searchInput?.value.trim().toLowerCase() || "";
    const filteredResults = allResults.filter((result) =>
      !term || result.card.toLowerCase().includes(term) || result.bank.toLowerCase().includes(term)
    );

    if ((state.pagination.results || 1) === 1 && filteredResults.length > 0) {
      renderFeaturedCard(filteredResults[0], featuredContainer);
    } else {
      featuredContainer.innerHTML = "";
    }

    const restResults = filteredResults.slice(1);
    const listPageSize = (state.pagination.results || 1) === 1 ? PAGE_ONE_LIST_SIZE : PAGINATION_ITEMS_PER_PAGE;
    const pageData = paginateItems(restResults, "results", listPageSize);
    renderResultCards(pageData.items, listContainer);
    if (pageData.totalPages > 1) {
      listContainer.insertAdjacentHTML("beforeend", renderPaginationControls("results", pageData));
      bindPaginationControls(listContainer, "results", () => renderRows());
    }
  };

  searchInput?.addEventListener("input", () => {
    state.pagination.results = 1;
    renderRows();
  });

  renderRows();
}

function renderOrderTypeBadges(orderTypes) {
  const styles = {
    "Dine-In": "background:#e8f5e9;color:#2e7d32",
    "Takeaway": "background:#e3f2fd;color:#1565c0",
    "Delivery": "background:#fff3e0;color:#e65100",
  };
  if (!orderTypes || !orderTypes.length) return "";
  return orderTypes.map((ot) => `<span class="pill" style="${styles[ot] || "background:#f5f5f5;color:#666"}">${escapeHtml(ot)}</span>`).join("");
}

function renderCardDetail(result) {
  const eligStatus = result.requirementStatus;
  const showEligibility = isEligibilityContextActive();
  const reqSummary = renderRequirementSummary(eligStatus, { showStatus: showEligibility });

  const detailItems = [
    { icon: "🏙️", l: "Available In", v: getTopPickCitiesLabel() },
    { icon: "📊", l: "Restaurants Matched", v: `${result.coveredVenueCount} of ${result.totalVenueCount}` },
    { icon: "💳", l: "Annual Fees", v: result.requirementStatus?.annualFeePkr === null ? "Not listed" : result.requirementStatus?.annualFeePkr === 0 ? "Free" : result.requirementStatus?.annualFeeWaiverRule ? `${formatCurrency(result.requirementStatus?.annualFeePkr)} (waivable)` : formatCurrency(result.requirementStatus?.annualFeePkr) },
    { icon: "💰", l: "Typical Cap", v: result.medianCap !== null ? formatCurrency(result.medianCap) : "No cap listed" },
  ];

  const topMatchesHtml = result.topMatches.slice(0, 3).map((match) => `
    <div class="match-item">
      <div>
        <div class="match-rest">${escapeHtml(match.restaurant)} <span style="color:var(--muted);font-weight:400">(${escapeHtml(match.city)})</span></div>
        <div class="match-meta">${escapeHtml(match.discountLabel)} · ${escapeHtml(match.daysLabel)}${match.offerTitle ? ` · ${escapeHtml(match.offerTitle)}` : ""}</div>
        ${match.offerDescription ? `<div class="match-meta" style="margin-top:1px"><span class="offer-detail-toggle" onclick="var d=this.nextElementSibling;d.style.display=d.style.display==='none'?'block':'none';this.textContent=d.style.display==='none'?'Details ▾':'Details ▴'" style="cursor:pointer;font-size:11px;color:var(--brand);font-weight:600">Details ▾</span><div class="offer-detail-text" style="display:none;font-size:11px;color:var(--muted);margin-top:2px;line-height:1.4">${escapeHtml(match.offerDescription)}</div></div>` : ""}
        ${match.orderTypes && match.orderTypes.length ? `<div class="match-meta" style="margin-top:2px">${renderOrderTypeBadges(match.orderTypes)}</div>` : ""}
      </div>
      <div class="match-saving">${formatCurrency(match.expectedSaving)}</div>
    </div>
  `).join("");

  return `
    <div class="card-detail">
      <div class="card-detail-grid">
        ${detailItems.map((i) => `
          <div class="card-detail-item">
            <span class="card-detail-icon">${i.icon}</span>
            <div>
              <div class="card-detail-label">${i.l}</div>
              <div class="card-detail-val">${escapeHtml(i.v)}</div>
            </div>
          </div>
        `).join("")}
      </div>
      ${reqSummary}
      ${topMatchesHtml ? `<div class="card-detail-matches">${topMatchesHtml}</div>` : ""}
    </div>
  `;
}

/* ── COMPARE ── */
function buildCardKey(bank, card) {
  return `${bank} || ${card}`;
}

function toggleCompare(cardKey) {
  if (state.compareList.includes(cardKey)) {
    state.compareList = state.compareList.filter((k) => k !== cardKey);
  } else if (state.compareList.length < 2) {
    state.compareList.push(cardKey);
  }
  renderCompareTray();
  renderRecommendations();
}

function renderCompareTray() {
  const tray = document.getElementById("cmp-tray");
  const cardsEl = document.getElementById("cmp-tray-cards");
  const openBtn = document.getElementById("btn-compare-open");
  if (!tray || !cardsEl) return;

  if (state.compareList.length === 0) {
    tray.style.display = "none";
    document.body.classList.remove("has-cmp-tray");
    return;
  }

  tray.style.display = "";
  document.body.classList.add("has-cmp-tray");
  cardsEl.innerHTML = "";

  state.compareList.forEach((key) => {
    const [bank, card] = key.split(" || ");
    const shortName = card.split(" ").slice(0, 3).join(" ");
    const cardEl = document.createElement("div");
    cardEl.className = "cmp-tray-card";
    cardEl.innerHTML = `
      <span class="cmp-tray-card-name">${escapeHtml(shortName)}</span>
      <button class="cmp-tray-card-remove" type="button" data-key="${escapeAttr(key)}">×</button>
    `;
    cardEl.querySelector(".cmp-tray-card-remove").addEventListener("click", (e) => {
      toggleCompare(e.currentTarget.dataset.key);
    });
    cardsEl.appendChild(cardEl);
  });

  if (state.compareList.length < 2) {
    const placeholder = document.createElement("div");
    placeholder.className = "cmp-tray-placeholder";
    placeholder.textContent = "+ Pick 1 more card";
    cardsEl.appendChild(placeholder);
  }

  if (openBtn) {
    openBtn.style.display = state.compareList.length === 2 ? "" : "none";
  }
}

function openCompareModal() {
  if (state.compareList.length !== 2) return;
  state.pagination.compareRestaurants = 1;
  const results = computeRecommendations();
  const cards = state.compareList.map((key) => {
    const [bank, card] = key.split(" || ");
    return results.find((r) => r.bank === bank && r.card === card);
  }).filter(Boolean);
  if (cards.length < 2) return;

  const modal = document.getElementById("compare-modal");
  const inner = document.getElementById("compare-modal-inner");
  if (!modal || !inner) return;

  const annuals   = cards.map((c) => c.avgExpectedSaving * state.outingsPerWeek * 52);
  const fees      = cards.map((c) => c.requirementStatus?.annualFeePkr ?? null);
  const nets      = cards.map((c, i) => fees[i] !== null ? annuals[i] - fees[i] : null);
  const salaryReqs = cards.map((c) => c.requirementStatus?.salaryReq ?? null);
  const balanceReqs = cards.map((c) => c.requirementStatus?.balanceReq ?? null);
  const excl      = getExclusiveRestaurantCounts(state.compareList[0], state.compareList[1]);
  const restaurantRows = getCompareRestaurantRows(state.compareList);
  const outLabel  = state.outingsPerWeek === 4 ? "4×+" : `${state.outingsPerWeek}×`;

  const rows = [
    { l: "Fit Score",                 vals: cards.map((c) => Number(c.score)),         fmt: (v)    => `${v.toFixed(1)} / 100`,               compare: "high" },
    { l: "Est. Saving / outing",      vals: cards.map((c) => c.avgExpectedSaving),     fmt: (v)    => formatSavingsAmount(v, { per: "outing" }), compare: "high" },
    { l: `Annual saving (${outLabel}/wk)`, vals: annuals,                             fmt: (v)    => formatSavingsAmount(v, { per: "yr" }), compare: "high" },
    { l: "Salary requirement",        vals: salaryReqs,                                fmt: (v, i) => formatRequirementFieldValue(cards[i].requirementStatus, "salaryReq"), compare: "none" },
    { l: "Minimum balance",           vals: balanceReqs,                               fmt: (v, i) => formatRequirementFieldValue(cards[i].requirementStatus, "balanceReq"), compare: "none" },
    { l: "Annual fee",                vals: fees,                                      fmt: (v, i) => formatRequirementFieldValue(cards[i].requirementStatus, "annualFeePkr"), compare: "low" },
    nets.some((n) => n !== null)
      ? { l: "Net annual saving",     vals: nets,                                      fmt: (v, i) => nets[i] !== null ? formatSavingsAmount(nets[i], { per: "yr", signed: true }) : "—", compare: "high" }
      : null,
    { l: "Restaurants Matched",       vals: cards.map((c) => c.coveredVenueCount),    fmt: (v)    => `${v} of ${cards[0].totalVenueCount}`,  compare: "high" },
    { l: "Exclusive restaurants",     vals: excl,                                     fmt: (v)    => v > 0 ? `${v} only here` : "—",         compare: "high" },
    { l: "Avg Discount",              vals: cards.map((c) => c.averageDiscount || 0), fmt: (v)    => v ? v.toFixed(1) + "%" : "—",           compare: "high" },
  ].filter(Boolean);

  let wins = [0, 0];
  rows.forEach((row) => {
    const winner = getCompareRowWinner(row);
    if (winner >= 0) wins[winner]++;
  });

  const wi = wins[0] === wins[1]
    ? (cards[0].score >= cards[1].score ? 0 : 1)
    : (wins[0] > wins[1] ? 0 : 1);
  const headColors  = ["var(--brand-light)", "var(--green-light)"];
  const labelColors = ["var(--brand)", "var(--green)"];
  const sharedRestaurantCount = restaurantRows.filter((row) => row.entries.every(Boolean)).length;

  inner.innerHTML = `
    <div class="cmp-modal-head">
      <div class="cmp-modal-title">Head-to-Head</div>
      <button class="btn-modal-close" id="btn-cmp-modal-close" type="button">×</button>
    </div>
    <div style="overflow-x:auto">
      <div class="cmp-grid">
        <div class="cmp-head-cell" style="background:var(--surface2);display:flex;align-items:center;justify-content:center">
          <div style="text-align:center">
            <div class="cmp-tally">${wins[0]}<span style="color:var(--muted2);font-size:14px;margin:0 6px;font-weight:400">vs</span>${wins[1]}</div>
            <div style="font-size:9px;font-weight:600;color:var(--muted);letter-spacing:.06em;text-transform:uppercase;margin-top:2px">categories</div>
          </div>
        </div>
        ${cards.map((c, i) => `
          <div class="cmp-head-cell" style="background:${headColors[i]};border-left:1px solid var(--line)">
            <div style="font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${labelColors[i]};margin-bottom:4px">${wins[i] > wins[1 - i] ? "🏆 " : ""}Card ${i + 1}</div>
            <div style="font-weight:800;font-size:14px;color:var(--ink);line-height:1.25;margin-bottom:1px">${escapeHtml(c.card)}</div>
            <div style="font-size:11px;color:var(--muted);margin-bottom:10px">${escapeHtml(c.bank)}</div>
            <div class="cmp-score-bar-wrap"><div class="cmp-score-bar-fill" style="width:${Number(c.score)}%;background:${scoreColor(c.score)}"></div></div>
            <div style="font-size:22px;font-weight:800;color:${scoreColor(c.score)};line-height:1.2">${Number(c.score).toFixed(1)}<span style="font-size:11px;color:var(--muted);font-weight:500"> / 100</span></div>
          </div>
        `).join("")}
        ${rows.map((row, ri) => {
          const winner = getCompareRowWinner(row);
          const bg = ri % 2 === 0 ? "var(--surface2)" : "var(--surface)";
          return `
            <div class="cmp-label-cell" style="background:${bg}">${escapeHtml(row.l)}</div>
            ${cards.map((c, i) => {
              const cellClass = winner === i ? " win" : (winner >= 0 ? " lose" : "");
              return `
              <div class="cmp-val-cell${cellClass}" style="background:${bg}">
                ${row.fmt(row.vals[i], i)}
                ${winner === i ? `<span class="better-badge">Better</span>` : ""}
              </div>`;
            }).join("")}
          `;
        }).join("")}
      </div>
    </div>
    <div class="cmp-winner-bar">
      <div class="cmp-winner-label">🏆 Verdict</div>
      <div style="flex:1">
        <div class="cmp-winner-name">${escapeHtml(cards[wi].card)}</div>
        <div class="cmp-winner-sub">
          Wins ${wins[wi]} of ${wins[0] + wins[1]} categories ·
          ~${formatCurrency(annuals[wi])} / yr ·
          ${Math.abs(cards[0].score - cards[1].score).toFixed(1)} pts ahead
        </div>
      </div>
      ${getBankApplyUrl(cards[wi].bank) ? `<a class="btn-apply btn-apply-sm" href="${escapeAttr(getBankApplyUrl(cards[wi].bank))}" target="_blank" rel="noopener">Apply →</a>` : ""}
    </div>
    <div class="cmp-rest-section">
      <div class="cmp-rest-head">
        <div>
          <div class="cmp-rest-title">Restaurant-by-restaurant</div>
          <div class="cmp-rest-sub">${sharedRestaurantCount} shared restaurants · ${restaurantRows.length} total in current filters</div>
        </div>
      </div>
      <input type="search" class="s-search cmp-rest-search" placeholder="Search restaurants…" autocomplete="off" />
      <div class="cmp-rest-list"></div>
    </div>
  `;

  modal.style.display = "flex";
  inner.querySelector("#btn-cmp-modal-close")?.addEventListener("click", closeCompareModal);
  const searchInput = inner.querySelector(".cmp-rest-search");
  const listContainer = inner.querySelector(".cmp-rest-list");
  const renderRows = () => {
    const term = searchInput?.value.trim().toLowerCase() || "";
    const filteredRows = restaurantRows.filter((row) => !term || `${row.restaurant} ${row.city}`.toLowerCase().includes(term));
    renderCompareRestaurantRows(listContainer, cards, filteredRows);
  };
  searchInput?.addEventListener("input", () => {
    state.pagination.compareRestaurants = 1;
    renderRows();
  });
  renderRows();
}

function closeCompareModal() {
  const modal = document.getElementById("compare-modal");
  if (modal) modal.style.display = "none";
}

/* ── QUIZ ── */
let quizState = null;

/* ── LANDING + ONBOARDING SCREENS ── */
const OB_STEP_DEFS = [
  { id: "city", q: "Which city do you usually dine in?",      hint: "We'll focus the ranking on where you actually use the card." },
  { id: "bill", q: "What's your typical restaurant bill?",    hint: "Per outing for your group. This directly affects your estimated savings." },
  { id: "type", q: "Which card types work for you?",          hint: "Pick all that apply. We'll only show cards you can actually get." },
];

let obState = { step: 0, city: null, type: [], bill: 8000 };

function checkFirstVisitAndShowQuickQuiz() {
  const visited = localStorage.getItem("konsacard_visited_v2");
  if (!visited) {
    localStorage.setItem("konsacard_visited_v2", "true");
    showLandingScreen();
  }
}

function showLandingScreen() {
  const el = document.getElementById("landing-screen");
  if (!el) return;
  el.style.display = "";
  document.getElementById("landing-start-btn")?.addEventListener("click", showOnboardingScreen, { once: true });
  document.getElementById("landing-skip-btn")?.addEventListener("click", skipToApp, { once: true });
  document.getElementById("landing-skip-nav-btn")?.addEventListener("click", skipToApp, { once: true });
}

function hideLandingScreen() {
  const el = document.getElementById("landing-screen");
  if (el) el.style.display = "none";
}

function showOnboardingScreen() {
  obState = { step: 0, city: null, type: [], bill: 8000 };
  hideLandingScreen();
  const el = document.getElementById("onboarding-screen");
  if (!el) return;
  el.style.display = "";
  document.getElementById("ob-skip-btn")?.addEventListener("click", skipToApp, { once: true });
  renderOnboardingStep();
}

function hideOnboardingScreen() {
  const el = document.getElementById("onboarding-screen");
  if (el) el.style.display = "none";
}

function skipToApp() {
  hideLandingScreen();
  hideOnboardingScreen();
}

function renderOnboardingStep() {
  const inner = document.getElementById("ob-inner");
  if (!inner) return;

  const step = obState.step;
  const cur = OB_STEP_DEFS[step];
  const isLast = step === OB_STEP_DEFS.length - 1;

  const progressBars = OB_STEP_DEFS.map((_, i) =>
    `<div class="ob-prog-bar${i <= step ? " done" : ""}"></div>`
  ).join("");

  let bodyHtml = "";
  let canNext = false;

  if (cur.id === "city") {
    canNext = Boolean(obState.city);
    const cityOpts = [
      { value: "all",       label: "Multiple Cities", iconHtml: `<span style="display:flex;align-items:center">${CITY_ICON_ALL}</span>` },
      { value: "karachi",   label: "Karachi",         iconHtml: `<img src="./assets/mazar-e-quaid.svg" alt="Karachi" />` },
      { value: "lahore",    label: "Lahore",           iconHtml: `<img src="./assets/minar-e-pakistan.svg" alt="Lahore" />` },
      { value: "islamabad", label: "Islamabad",        iconHtml: `<img src="./assets/faisal-mosque.svg" alt="Islamabad" />` },
    ];
    bodyHtml = `<div class="ob-opts">${cityOpts.map(opt => `
      <button class="ob-opt${obState.city === opt.value ? " sel" : ""}" data-ob-city="${escapeAttr(opt.value)}" type="button">
        <span class="ob-opt-icon">${opt.iconHtml}</span>
        <span>${escapeHtml(opt.label)}</span>
        ${obState.city === opt.value ? `<span class="ob-opt-check">✓</span>` : ""}
      </button>`).join("")}</div>`;

  } else if (cur.id === "bill") {
    canNext = true;
    bodyHtml = `
      <div>
        <div class="ob-slider-val">${formatCurrency(obState.bill)}</div>
        <input type="range" id="ob-slider" min="1000" max="30000" step="500" value="${obState.bill}" style="width:100%;accent-color:var(--brand)" />
        <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-top:6px"><span>PKR 1,000</span><span>PKR 30,000</span></div>
      </div>`;

  } else if (cur.id === "type") {
    const types = obState.type;
    canNext = types.length > 0;
    const typeOpts = [
      ...QUIZ_CARD_TYPE_OPTIONS,
      { value: "any", label: "I'm open to all", icon: "🎯" },
    ];
    bodyHtml = `<div class="ob-opts">${typeOpts.map(opt => `
      <button class="ob-opt${types.includes(opt.value) ? " sel" : ""}" data-ob-type="${escapeAttr(opt.value)}" type="button">
        <span class="ob-opt-icon" style="font-size:28px">${opt.icon}</span>
        <span>${escapeHtml(opt.label)}</span>
        ${types.includes(opt.value) ? `<span class="ob-opt-check">✓</span>` : ""}
      </button>`).join("")}</div>`;
  }

  inner.innerHTML = `
    <div style="max-width:520px;width:100%;animation:fadeUp .3s ease both">
      <div class="ob-prog">${progressBars}</div>
      <div class="ob-step-label">Question ${step + 1} of ${OB_STEP_DEFS.length}</div>
      <h2 class="ob-q">${escapeHtml(cur.q)}</h2>
      <p class="ob-hint">${escapeHtml(cur.hint)}</p>
      ${bodyHtml}
      <div class="ob-nav-row">
        ${step > 0 ? `<button class="ob-back" id="ob-back-btn" type="button">← Back</button>` : `<div></div>`}
        ${isLast
          ? `<button class="ob-next-btn" id="ob-finish-btn" type="button"${!canNext ? " disabled" : ""}>See My Cards →</button>`
          : `<button class="ob-next-btn" id="ob-next-btn" type="button"${!canNext ? " disabled" : ""}>Next →</button>`}
      </div>
    </div>`;

  const obSlider = document.getElementById("ob-slider");
  obSlider?.addEventListener("input", (e) => {
    obState.bill = parseInt(e.target.value);
    const valEl = document.querySelector(".ob-slider-val");
    if (valEl) valEl.textContent = formatCurrency(obState.bill);
  });
  obSlider?.addEventListener("change", () => {
    renderOnboardingStep();
  });

  document.querySelectorAll("[data-ob-city]").forEach(btn => {
    btn.addEventListener("click", () => {
      obState.city = btn.dataset.obCity;
      renderOnboardingStep();
    });
  });

  document.querySelectorAll("[data-ob-type]").forEach(btn => {
    btn.addEventListener("click", () => {
      const v = btn.dataset.obType;
      if (v === "any") {
        obState.type = obState.type.includes("any") ? [] : ["any"];
      } else {
        const without = obState.type.filter(x => x !== "any");
        obState.type = without.includes(v) ? without.filter(x => x !== v) : [...without, v];
      }
      renderOnboardingStep();
    });
  });

  document.getElementById("ob-next-btn")?.addEventListener("click", () => {
    obState.step++;
    renderOnboardingStep();
  });

  document.getElementById("ob-back-btn")?.addEventListener("click", () => {
    obState.step--;
    renderOnboardingStep();
  });

  document.getElementById("ob-finish-btn")?.addEventListener("click", applyOnboardingResults);
}

function applyOnboardingResults() {
  if (obState.city && obState.city !== "all") {
    state.selectedCity = obState.city;
    updateCityChip();
    renderNavCityTabs();
  }
  if (obState.type.length > 0 && !obState.type.includes("any")) {
    obState.type.forEach(t => state.selectedCardTypes.add(t));
  }
  if (obState.bill) {
    state.orderValue = obState.bill;
  }
  syncDomToState();
  renderRecommendations();
  hideOnboardingScreen();
}

/* Quick Quiz (First Visit Onboarding — kept for openQuickQuiz fallback) */
let quickQuizState = { step: 0, city: null, type: null, bill: 10000 };

function openQuickQuiz() {
  quickQuizState = { step: 0, city: null, type: null, bill: 10000 };
  renderQuickQuiz();
  const modal = document.getElementById("quiz-modal");
  if (modal) modal.style.display = "flex";
}

function renderQuickQuiz() {
  const inner = document.getElementById("quiz-modal-inner");
  if (!inner) return;

  const steps = ["city", "type", "bill"];
  const step = quickQuizState.step;
  const isLast = step === steps.length - 1;
  
  const progressBars = steps.map((_, index) => `<div class="q-bar${index <= step ? " done" : ""}"></div>`).join("");
  
  let bodyHtml = "";
  let title = "";
  let canNext = false;

  if (steps[step] === "city") {
    title = "Which city are you in?";
    canNext = Boolean(quickQuizState.city);
    bodyHtml = `
      <div class="q-grid">
        ${QUIZ_CITY_OPTIONS.slice(1).map((option) => `
          <button class="q-opt${quickQuizState.city === option.value ? " sel" : ""}" data-qquiz-city="${escapeAttr(option.value)}" type="button">
            <span class="q-icon"><img class="q-icon-img" src="${escapeAttr(option.iconSrc)}" alt="${escapeAttr(option.iconAlt)}" style="width:32px;height:32px;" /></span>
            <span>${escapeHtml(option.label)}</span>
            ${quickQuizState.city === option.value ? `<span class="q-check">✓</span>` : ""}
          </button>
        `).join("")}
      </div>
    `;
  } else if (steps[step] === "type") {
    title = "What type of card?";
    canNext = Boolean(quickQuizState.type);
    bodyHtml = `
      <div class="q-grid">
        ${QUIZ_CARD_TYPE_OPTIONS.map((option) => `
          <button class="q-opt${quickQuizState.type === option.value ? " sel" : ""}" data-qquiz-type="${escapeAttr(option.value)}" type="button">
            <span class="q-icon" style="font-size:32px;">${option.icon}</span>
            <span>${escapeHtml(option.label)}</span>
            ${quickQuizState.type === option.value ? `<span class="q-check">✓</span>` : ""}
          </button>
        `).join("")}
      </div>
    `;
  } else if (steps[step] === "bill") {
    title = "Typical bill amount?";
    canNext = true;
    bodyHtml = `
      <div style="display:flex;gap:8px;flex-direction:column;align-items:center;">
        <div class="q-slider-val">${formatCurrency(quickQuizState.bill)}</div>
        <input type="range" min="1000" max="50000" step="500" value="${quickQuizState.bill}" id="qquiz-slider" style="width:100%;accent-color:var(--brand)" />
        <div class="q-slider-ends" style="font-size:12px;color:var(--muted2);"><span>1K</span><span>50K</span></div>
      </div>
    `;
  }

  inner.innerHTML = `
    <div style="width:100%;max-width:400px;display:flex;flex-direction:column;gap:24px;">
      <div style="display:flex;gap:4px;justify-content:center;">${progressBars}</div>
      <div>
        <h2 style="font-size:20px;font-weight:600;margin-bottom:16px;color:var(--ink);">${title}</h2>
        ${bodyHtml}
      </div>
      <div style="display:flex;gap:8px;">
        ${step > 0 ? `<button class="btn-secondary qquiz-prev" style="flex:1;padding:12px;border-radius:var(--r-sm);background:var(--surface2);color:var(--ink);font-weight:500;cursor:pointer;border:1px solid var(--line);">Back</button>` : ""}
        ${!isLast ? `<button class="btn-primary qquiz-next" style="flex:1;padding:12px;border-radius:var(--r-sm);background:${canNext ? "var(--brand)" : "var(--muted2)"};color:#fff;font-weight:500;cursor:${canNext ? "pointer" : "not-allowed"};opacity:${canNext ? "1" : "0.5"};" ${!canNext ? "disabled" : ""}>Next</button>` : `<button class="btn-primary qquiz-finish" style="flex:1;padding:12px;border-radius:var(--r-sm);background:var(--brand);color:#fff;font-weight:500;cursor:pointer;">See Results</button>`}
      </div>
      <button class="qquiz-skip" style="padding:8px;background:none;color:var(--muted2);text-align:center;font-size:13px;cursor:pointer;text-decoration:underline;">Skip for now</button>
    </div>
  `;

  // Event listeners
  const slider = document.getElementById("qquiz-slider");
  if (slider) {
    slider.addEventListener("input", (e) => {
      quickQuizState.bill = parseInt(e.target.value);
      const valEl = document.querySelector(".q-slider-val");
      if (valEl) valEl.textContent = formatCurrency(quickQuizState.bill);
    });
    slider.addEventListener("change", () => renderQuickQuiz());
  }

  document.querySelectorAll("[data-qquiz-city]").forEach(btn => {
    btn.addEventListener("click", () => {
      quickQuizState.city = btn.dataset.qquizCity;
      renderQuickQuiz();
    });
  });

  document.querySelectorAll("[data-qquiz-type]").forEach(btn => {
    btn.addEventListener("click", () => {
      quickQuizState.type = btn.dataset.qquizType;
      renderQuickQuiz();
    });
  });

  const nextBtn = document.querySelector(".qquiz-next");
  if (nextBtn && canNext) {
    nextBtn.addEventListener("click", () => {
      quickQuizState.step++;
      renderQuickQuiz();
    });
  }

  const prevBtn = document.querySelector(".qquiz-prev");
  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      quickQuizState.step--;
      renderQuickQuiz();
    });
  }

  const finishBtn = document.querySelector(".qquiz-finish");
  if (finishBtn) {
    finishBtn.addEventListener("click", () => {
      applyQuickQuizResults();
    });
  }

  const skipBtn = document.querySelector(".qquiz-skip");
  if (skipBtn) {
    skipBtn.addEventListener("click", () => {
      closeQuiz();
    });
  }
}

function applyQuickQuizResults() {
  if (quickQuizState.city) {
    state.selectedCity = quickQuizState.city;
    updateCityChip();
    renderNavCityTabs();
  }
  if (quickQuizState.type) {
    state.selectedCardTypes.add(quickQuizState.type);
  }
  if (quickQuizState.bill) {
    state.orderValue = quickQuizState.bill;
  }
  renderRecommendations();
  closeQuiz();
}

function openQuiz() {
  quizState = buildQuizStateFromCurrent();
  renderQuiz();
  const modal = document.getElementById("quiz-modal");
  if (modal) modal.style.display = "flex";
}

function closeQuiz() {
  const modal = document.getElementById("quiz-modal");
  if (modal) modal.style.display = "none";
}

function renderQuiz() {
  const inner = document.getElementById("quiz-modal-inner");
  if (!inner || !quizState) return;

  pruneQuizRestaurants();
  const steps = getQuizSteps();
  const step = Math.min(quizState.step || 0, steps.length - 1);
  quizState.step = step;
  const current = steps[step];
  const isLast = step === steps.length - 1;
  const progressBars = steps.map((_, index) => `<div class="q-bar${index <= step ? " done" : ""}"></div>`).join("");
  const bankResults = getAvailableBanksForQuiz()
    .filter((bank) => !quizState.banks.includes(bank))
    .filter((bank) => !quizState.bankSearchTerm || bank.toLowerCase().includes(quizState.bankSearchTerm.toLowerCase()))
    .slice(0, 10);
  const restaurantResults = getAvailableRestaurantsForQuiz()
    .filter((restaurant) => !quizState.restaurants.includes(restaurant))
    .filter((restaurant) => !quizState.restSearchTerm || restaurant.toLowerCase().includes(quizState.restSearchTerm.toLowerCase()))
    .slice(0, 14);

  let bodyHtml = "";
  let canNext = true;

  if (current.id === "city") {
    canNext = Boolean(quizState.city);
    bodyHtml = `
      <div class="q-grid">
        ${QUIZ_CITY_OPTIONS.map((option) => `
          <button class="q-opt${quizState.city === option.value ? " sel" : ""}" data-quiz-city="${escapeAttr(option.value)}" type="button">
            <span class="q-icon">${option.iconSrc
              ? `<img class="q-icon-img" src="${escapeAttr(option.iconSrc)}" alt="${escapeAttr(option.iconAlt || option.label)}" />`
              : option.icon}</span>
            <span style="flex:1">${escapeHtml(option.label)}</span>
            ${quizState.city === option.value ? `<span class="q-check">✓</span>` : ""}
          </button>
        `).join("")}
      </div>
    `;
  } else if (current.id === "bill") {
    bodyHtml = `
      <div class="q-slider-val">${formatCurrency(quizState.bill)}</div>
      <input type="range" min="1000" max="50000" step="500" value="${quizState.bill}" id="quiz-slider" style="width:100%;accent-color:var(--brand)" />
      <div class="q-slider-ends"><span>PKR 1,000</span><span>PKR 50,000</span></div>
    `;
  } else if (current.id === "days") {
    bodyHtml = `
      <div class="quiz-pills">
        ${state.data.dayNames.map((dayName, index) => `
          <button class="s-pill${quizState.days.includes(index) ? " active" : ""}" data-quiz-day="${index}" type="button" title="${escapeAttr(dayName)}">${DAY_SHORT[index]}</button>
        `).join("")}
      </div>
      <p class="q-hint" style="margin-top:14px;margin-bottom:0">Leave this blank if your days vary.</p>
    `;
  } else if (current.id === "types") {
    canNext = quizState.types.length > 0;
    const allTypeOpts = [...QUIZ_CARD_TYPE_OPTIONS, { value: "any", label: "I'm open to all", icon: "🎯" }];
    bodyHtml = `
      <div class="q-grid">
        ${allTypeOpts.map((option) => `
          <button class="q-opt${quizState.types.includes(option.value) ? " sel" : ""}" data-quiz-type="${escapeAttr(option.value)}" type="button">
            <span class="q-icon">${option.icon}</span>
            <span style="flex:1">${escapeHtml(option.label)}</span>
            ${quizState.types.includes(option.value) ? `<span class="q-check">✓</span>` : ""}
          </button>
        `).join("")}
      </div>
    `;
  } else if (current.id === "banks") {
    bodyHtml = `
      <input id="quiz-bank-search" class="s-search" type="search" placeholder="Search banks..." autocomplete="off" value="${escapeAttr(quizState.bankSearchTerm)}" />
      <div class="quiz-search-results">
        ${bankResults.map((bank) => `
          <button class="s-search-item" data-quiz-add-bank="${escapeAttr(bank)}" type="button">
            <span>${escapeHtml(bank)}</span><span class="s-search-item-add">Add</span>
          </button>
        `).join("")}
      </div>
      <div class="quiz-chip-list">
        ${quizState.banks.slice().sort((a, b) => a.localeCompare(b)).map((bank) => `
          <div class="s-chip">
            <span>${escapeHtml(bank)}</span>
            <button class="s-chip-remove" data-quiz-remove-bank="${escapeAttr(bank)}" type="button">×</button>
          </div>
        `).join("")}
      </div>
      <p class="q-hint" style="margin-top:14px;margin-bottom:0">Optional. Skip if you want the widest shortlist.</p>
    `;
  } else if (current.id === "restaurants") {
    bodyHtml = `
      <input id="quiz-restaurant-search" class="s-search" type="search" placeholder="Search restaurants..." autocomplete="off" value="${escapeAttr(quizState.restSearchTerm)}" />
      <div class="quiz-search-results">
        ${restaurantResults.map((restaurant) => `
          <button class="s-search-item" data-quiz-add-restaurant="${escapeAttr(restaurant)}" type="button">
            <span>${escapeHtml(restaurant)}</span><span class="s-search-item-add">Add</span>
          </button>
        `).join("")}
      </div>
      <div class="quiz-chip-list">
        ${quizState.restaurants.slice().sort((a, b) => a.localeCompare(b)).map((restaurant) => `
          <div class="s-chip">
            <span>${escapeHtml(restaurant)}</span>
            <button class="s-chip-remove" data-quiz-remove-restaurant="${escapeAttr(restaurant)}" type="button">×</button>
          </div>
        `).join("")}
      </div>
      <p class="q-hint" style="margin-top:14px;margin-bottom:0">Optional, but this gives the ranking much better signal.</p>
    `;
  } else if (current.id === "eligibility") {
    canNext = true;
    bodyHtml = `
      <div class="quiz-inline-grid">
        <div>
          <div class="quiz-field-label">Monthly salary</div>
          <input id="quiz-monthly-salary" class="s-search" type="number" inputmode="numeric" min="0" step="1000" placeholder="e.g. 100,000" value="${quizState.monthlySalary ?? ""}" />
          <p class="q-hint" style="margin-top:6px;margin-bottom:0">Leave blank for no restriction</p>
        </div>
        <div>
          <div class="quiz-field-label">Account balance</div>
          <input id="quiz-account-balance" class="s-search" type="number" inputmode="numeric" min="0" step="1000" placeholder="e.g. 250,000" value="${quizState.accountBalance ?? ""}" />
          <p class="q-hint" style="margin-top:6px;margin-bottom:0">Leave blank for no restriction</p>
        </div>
      </div>
    `;
  }

  inner.innerHTML = `
    <div class="quiz-wrap">
      <div class="quiz-header">
        <div class="quiz-brand">
          <div class="quiz-brand-icon">🎯</div>
          <div class="quiz-brand-name">Find My Card</div>
        </div>
        <button class="btn-quiz-close" id="btn-quiz-close" type="button">×</button>
      </div>
      <div class="q-prog">${progressBars}</div>
      <div class="q-step-label">Question ${step + 1} of ${steps.length}</div>
      <h2 class="q-text">${escapeHtml(current.title)}</h2>
      <p class="q-hint">${escapeHtml(current.hint)}</p>
      ${bodyHtml}
      <div class="q-nav">
        ${step > 0
          ? `<button class="btn-q-back" id="btn-q-back" type="button">← Back</button>`
          : `<button class="btn-q-back" id="btn-quiz-reset" type="button">Reset</button>`}
        <button class="btn-q-next" id="btn-q-next" type="button" ${!canNext ? "disabled" : ""}>
          ${isLast ? "Show My Cards →" : "Next →"}
        </button>
      </div>
    </div>
  `;

  inner.querySelector("#btn-quiz-close")?.addEventListener("click", closeQuiz);
  inner.querySelector("#btn-quiz-reset")?.addEventListener("click", () => {
    quizState = buildDefaultQuizState();
    renderQuiz();
  });
  inner.querySelector("#btn-q-back")?.addEventListener("click", () => {
    quizState.step = Math.max(0, quizState.step - 1);
    renderQuiz();
  });
  inner.querySelector("#btn-q-next")?.addEventListener("click", () => {
    if (isLast) {
      handleQuizDone(quizState);
      closeQuiz();
      return;
    }
    quizState.step += 1;
    renderQuiz();
  });
  inner.querySelector("#quiz-slider")?.addEventListener("input", (e) => {
    quizState.bill = Number(e.target.value);
    const valueEl = inner.querySelector(".q-slider-val");
    if (valueEl) valueEl.textContent = formatCurrency(quizState.bill);
  });

  inner.querySelectorAll("[data-quiz-city]").forEach((btn) => {
    btn.addEventListener("click", () => {
      quizState.city = btn.dataset.quizCity;
      pruneQuizRestaurants();
      renderQuiz();
    });
  });
  inner.querySelectorAll("[data-quiz-day]").forEach((btn) => {
    btn.addEventListener("click", () => {
      toggleQuizArrayValue("days", Number(btn.dataset.quizDay));
      renderQuiz();
    });
  });
  inner.querySelectorAll("[data-quiz-type]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const v = btn.dataset.quizType;
      if (v === "any") {
        quizState.types = quizState.types.includes("any") ? [] : ["any"];
      } else {
        const without = quizState.types.filter(x => x !== "any");
        quizState.types = without.includes(v) ? without.filter(x => x !== v) : [...without, v];
      }
      pruneQuizRestaurants();
      renderQuiz();
    });
  });
  inner.querySelector("#quiz-bank-search")?.addEventListener("input", (e) => {
    quizState.bankSearchTerm = e.target.value.trim();
    renderQuiz();
    restoreQuizFocus("quiz-bank-search");
  });
  inner.querySelector("#quiz-restaurant-search")?.addEventListener("input", (e) => {
    quizState.restSearchTerm = e.target.value.trim();
    renderQuiz();
    restoreQuizFocus("quiz-restaurant-search");
  });
  inner.querySelectorAll("[data-quiz-add-bank]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const bank = btn.dataset.quizAddBank;
      if (!quizState.banks.includes(bank)) quizState.banks.push(bank);
      quizState.bankSearchTerm = "";
      pruneQuizRestaurants();
      renderQuiz();
    });
  });
  inner.querySelectorAll("[data-quiz-remove-bank]").forEach((btn) => {
    btn.addEventListener("click", () => {
      quizState.banks = quizState.banks.filter((bank) => bank !== btn.dataset.quizRemoveBank);
      pruneQuizRestaurants();
      renderQuiz();
    });
  });
  inner.querySelectorAll("[data-quiz-add-restaurant]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const restaurant = btn.dataset.quizAddRestaurant;
      if (!quizState.restaurants.includes(restaurant)) quizState.restaurants.push(restaurant);
      quizState.restSearchTerm = "";
      renderQuiz();
    });
  });
  inner.querySelectorAll("[data-quiz-remove-restaurant]").forEach((btn) => {
    btn.addEventListener("click", () => {
      quizState.restaurants = quizState.restaurants.filter((restaurant) => restaurant !== btn.dataset.quizRemoveRestaurant);
      renderQuiz();
    });
  });
  inner.querySelector("#quiz-monthly-salary")?.addEventListener("input", (e) => {
    quizState.monthlySalary = parseOptionalNumber(e.target.value);
  });
  inner.querySelector("#quiz-account-balance")?.addEventListener("input", (e) => {
    quizState.accountBalance = parseOptionalNumber(e.target.value);
  });
}

function getQuizSteps() {
  return [
    { id: "city",        title: "Which city do you usually dine in?",          hint: "We’ll focus the ranking on where you actually use the card." },
    { id: "bill",        title: "What’s your typical restaurant bill?",         hint: "Per outing. Caps and savings change a lot with bill size." },
    { id: "days",        title: "What days do you usually go out?",             hint: "Optional. We’ll keep all days if your pattern varies." },
    { id: "types",       title: "What type of card can you get?",               hint: "Select one or more. This one matters, so pick at least one." },
    { id: "banks",       title: "Do you want to limit this to certain banks?",  hint: "Optional. Add banks only if you want to narrow the shortlist." },
    { id: "restaurants", title: "Which restaurants should we prioritize?",      hint: "Optional, but this produces much better recommendations." },
    { id: "eligibility", title: "What’s your monthly salary and balance?",      hint: "Optional. Helps us hide cards you likely won’t qualify for." },
  ];
}

function handleQuizDone(ans) {
  state.selectedCity = normalizeCityValue(ans.city);
  state.orderValue = ans.bill || 10000;
  state.selectedDays = new Set(ans.days || []);
  state.selectedCardTypes = new Set((ans.types || []).includes("any") ? [] : (ans.types || []));
  state.selectedBanks = new Set(ans.banks || []);
  state.selectedRestaurants = new Set(ans.restaurants || []);
  state.monthlySalary = parseOptionalNumber(ans.monthlySalary);
  state.accountBalance = parseOptionalNumber(ans.accountBalance);
  state.useEligibility = state.monthlySalary !== null || state.accountBalance !== null;
  state.bankSearchTerm = "";
  state.restSearchTerm = "";
  trackEvent("quiz_complete", {
    city: state.selectedCity,
    bill: state.orderValue,
    banks_count: state.selectedBanks.size,
    restaurants_count: state.selectedRestaurants.size,
    eligibility: state.useEligibility ? 1 : 0,
  });

  syncDomToState();
  renderNavCityTabs();
  render();
}

function buildDefaultQuizState() {
  return {
    step: 0,
    city: "all",
    bill: 10000,
    days: [],
    types: [],
    banks: [],
    restaurants: [],
    useEligibility: false,
    monthlySalary: null,
    accountBalance: null,
    bankSearchTerm: "",
    restSearchTerm: "",
  };
}

function buildQuizStateFromCurrent() {
  return {
    step: 0,
    city: normalizeCityValue(state.selectedCity),
    bill: state.orderValue,
    days: Array.from(state.selectedDays),
    types: Array.from(state.selectedCardTypes),
    banks: Array.from(state.selectedBanks),
    restaurants: Array.from(state.selectedRestaurants),
    useEligibility: state.useEligibility,
    monthlySalary: state.monthlySalary,
    accountBalance: state.accountBalance,
    bankSearchTerm: "",
    restSearchTerm: "",
  };
}

function toggleQuizArrayValue(key, value) {
  if (!quizState) return;
  const current = new Set(quizState[key]);
  if (current.has(value)) current.delete(value);
  else current.add(value);
  quizState[key] = Array.from(current);
}

function getAvailableBanksForQuiz() {
  if (!state.data || !quizState) return [];
  const bankCounts = new Map();
  const selectedCity = normalizeCityValue(quizState.city);
  state.data.offers.forEach((offer) => {
    if (selectedCity !== "all" && normalizeCityValue(offer.city) !== selectedCity) return;
    if (quizState.types.length > 0 && !quizState.types.includes("any") && !quizState.types.includes(offer.cardCategory)) return;
    bankCounts.set(offer.bank, (bankCounts.get(offer.bank) || 0) + 1);
  });
  return Array.from(bankCounts.keys()).sort((a, b) => a.localeCompare(b));
}

function getAvailableRestaurantsForQuiz() {
  if (!state.data || !quizState) return [];
  const names = new Set();
  const selectedCity = normalizeCityValue(quizState.city);
  state.data.offers.forEach((offer) => {
    if (selectedCity !== "all" && normalizeCityValue(offer.city) !== selectedCity) return;
    if (quizState.types.length > 0 && !quizState.types.includes("any") && !quizState.types.includes(offer.cardCategory)) return;
    if (quizState.banks.length > 0 && !quizState.banks.includes(offer.bank)) return;
    names.add(offer.restaurant);
  });
  return Array.from(names).sort((a, b) => a.localeCompare(b));
}

function pruneQuizRestaurants() {
  if (!quizState) return;
  const available = new Set(getAvailableRestaurantsForQuiz());
  quizState.restaurants = quizState.restaurants.filter((restaurant) => available.has(restaurant));
}

function restoreQuizFocus(id) {
  const input = document.getElementById(id);
  if (!input) return;
  const end = input.value.length;
  input.focus();
  input.setSelectionRange?.(end, end);
}

/* ══════════════════════════════════════════════════════
   CHAT — Gemini 2.5 Flash with streaming (via /api/chat proxy)
   ══════════════════════════════════════════════════════ */

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

/* ── COMPUTE RECOMMENDATIONS ── */
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
      // Find the specific city-restaurant keys for the selected names
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
  const scoringOffers = state.data.offers.filter((offer) => {
    if (!cityMatches(offer.city)) return false;
    if (state.selectedRestaurants.size > 0 && !state.selectedRestaurants.has(offer.restaurant)) return false;
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
    const topMatches = matches.sort((a, b) => b.expectedSaving - a.expectedSaving).slice(0, 3);

    return {
      bank: cardRecord.bank,
      card: cardRecord.card,
      score: 0,
      avgExpectedSaving,
      coverage,
      avgDayFit,
      coveredVenueCount,
      totalVenueCount: scoringVenues.size,
      averageDiscount,
      medianCap,
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

  aggregates.forEach((item) => {
    const Ns = Math.min(1, item.E / p95ESafe);
    const R = 0.65 * Ns + 0.25 * item.coverage + 0.10 * item.avgDayFit;
    item.baseScore = 20 + 80 * R;
    item.qualificationConfidence = computeQualificationConfidence(item.requirementStatus);
    item.qualificationDelta = (state.useEligibility && hasEligibilityInput)
      ? 30 * (item.qualificationConfidence - 0.5)
      : 0;
    item.score = Math.max(0, Math.min(100, item.baseScore + item.qualificationDelta));
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

/* ── NEXT CARD: OWNED CARDS INPUT + VIEW ── */
function getAllCardsCatalog() {
  // List of { cardKey, bank, card, cardCategory } across the entire dataset.
  if (!state.data) return [];
  const seen = new Map();
  state.data.offers.forEach((offer) => {
    const key = buildCardKey(offer.bank, offer.card);
    if (!seen.has(key)) {
      seen.set(key, { cardKey: key, bank: offer.bank, card: offer.card, cardCategory: offer.cardCategory || "other" });
    }
  });
  return Array.from(seen.values()).sort((a, b) => {
    const bankCmp = a.bank.localeCompare(b.bank);
    if (bankCmp !== 0) return bankCmp;
    return a.card.localeCompare(b.card);
  });
}

function renderOwnedCardsPanel(container, walletStats) {
  if (!container) return;
  const catalog = getAllCardsCatalog();
  const ownedCount = state.ownedCards.size;
  const hasWallet = ownedCount > 0;
  const summaryHtml = hasWallet && walletStats ? `
    <div class="mw-summary">
      <div class="mw-summary-head">
        <div class="mw-summary-title-wrap">
          <div class="mw-summary-kicker">Your wallet</div>
          <div class="mw-summary-title">${ownedCount} card${ownedCount === 1 ? "" : "s"} · ${formatCurrency(walletStats.perOuting)} / outing</div>
          <div class="mw-summary-sub">What your current wallet is worth at a ${formatCurrency(state.orderValue)} bill</div>
        </div>
      </div>
      <div class="mw-summary-stats">
        <div class="mw-summary-stat">
          <div class="mw-summary-l">Savings / outing</div>
          <div class="mw-summary-v green">${formatCurrency(walletStats.perOuting)}</div>
        </div>
        <div class="mw-summary-stat">
          <div class="mw-summary-l">Restaurants Covered</div>
          <div class="mw-summary-v">${walletStats.coveredVenues} of ${walletStats.venueCount}</div>
        </div>
        <div class="mw-summary-stat">
          <div class="mw-summary-l">Est. Yearly</div>
          <div class="mw-summary-v green">~${formatCurrency(walletStats.yearly)}</div>
        </div>
        <div class="mw-summary-stat">
          <div class="mw-summary-l">Total Annual Fees</div>
          <div class="mw-summary-v">${walletStats.annualFee === 0 ? (walletStats.feeUnknown ? "Not listed" : "Free") : formatCurrency(walletStats.annualFee)}${walletStats.feeUnknown ? ` <span class="wo-fee-note">(some unlisted)</span>` : ""}</div>
        </div>
      </div>
    </div>
  ` : "";

  container.innerHTML = `
    ${summaryHtml}
    <div class="nc-setup">
      <div class="nc-setup-head">
        <div class="nc-setup-title-wrap">
          <div class="nc-setup-kicker">${hasWallet ? "Manage" : "Step 1"}</div>
          <div class="nc-setup-title">${hasWallet ? "Cards in your wallet" : "Add the cards you carry"}</div>
          <div class="nc-setup-sub">${hasWallet
            ? "Add or remove cards to see how it changes your savings and the best card to add next."
            : "Tell us what's in your wallet and we'll show what it's worth — plus the single best card to add next."}</div>
        </div>
        <div class="nc-setup-count">
          <span class="nc-setup-count-num">${ownedCount}</span>
          <span class="nc-setup-count-label">${ownedCount === 1 ? "card" : "cards"}</span>
        </div>
      </div>
      <div class="nc-setup-body">
        <input id="nc-owned-search" class="s-search nc-search" type="search" placeholder="Search bank or card name…" autocomplete="off" value="${escapeAttr(state.ownedCardSearchTerm)}" />
        <div id="nc-owned-results" class="s-search-results nc-search-results"></div>
        <div id="nc-owned-chips" class="s-chips nc-chips"></div>
        <div class="nc-setup-foot">
          ${ownedCount > 0 ? `<button id="nc-owned-clear" class="nc-clear-btn" type="button">Clear all</button>` : `<span class="nc-setup-foot-spacer"></span>`}
          <span class="nc-crosslink">
            Want to redesign? <a class="nc-link" id="nc-go-wallet">Try Build Wallet →</a>
          </span>
        </div>
      </div>
    </div>
  `;

  const searchInput = document.getElementById("nc-owned-search");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      state.ownedCardSearchTerm = e.target.value.trim();
      renderOwnedCardsResults(catalog);
    });
  }
  document.getElementById("nc-owned-clear")?.addEventListener("click", () => {
    state.ownedCards = new Set();
    state.ownedCardSearchTerm = "";
    render();
  });
  document.getElementById("nc-go-wallet")?.addEventListener("click", () => {
    state.viewMode = "wallet";
    render();
  });

  renderOwnedCardsResults(catalog);
  renderOwnedCardsChips();
}

function renderOwnedCardsResults(catalogArg) {
  const container = document.getElementById("nc-owned-results");
  if (!container) return;
  const catalog = catalogArg || getAllCardsCatalog();
  const term = (state.ownedCardSearchTerm || "").toLowerCase();
  // Only show suggestions when user is typing; otherwise keep panel quiet.
  if (!term) { container.innerHTML = ""; return; }
  const results = catalog
    .filter((c) => !state.ownedCards.has(c.cardKey))
    .filter((c) => `${c.bank} ${c.card}`.toLowerCase().includes(term))
    .slice(0, 12);

  container.innerHTML = "";
  if (results.length === 0) {
    container.innerHTML = `<div class="nc-search-empty">No matching cards. Try the bank name (e.g. "HBL", "Meezan").</div>`;
    return;
  }
  results.forEach((entry) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "s-search-item nc-search-item";
    item.innerHTML = `
      <span class="nc-search-item-text">
        <span class="nc-search-item-card">${escapeHtml(entry.card)}</span>
        <span class="nc-search-item-bank">${escapeHtml(entry.bank)}</span>
      </span>
      <span class="s-search-item-add">+ Add</span>
    `;
    item.addEventListener("click", () => {
      state.ownedCards.add(entry.cardKey);
      state.ownedCardSearchTerm = "";
      const input = document.getElementById("nc-owned-search");
      if (input) input.value = "";
      trackEvent("owned_card_add", { bank: entry.bank, total: state.ownedCards.size });
      render();
    });
    container.appendChild(item);
  });
}

function renderOwnedCardsChips() {
  const container = document.getElementById("nc-owned-chips");
  if (!container) return;
  container.innerHTML = "";
  Array.from(state.ownedCards).sort().forEach((cardKey) => {
    const [bank, card] = cardKey.split(" || ");
    const chip = document.createElement("div");
    chip.className = "s-chip nc-chip";
    chip.innerHTML = `
      <span class="nc-chip-text">
        <span class="nc-chip-card">${escapeHtml(card || "")}</span>
        <span class="nc-chip-bank">${escapeHtml(bank || "")}</span>
      </span>
    `;
    const rm = document.createElement("button");
    rm.className = "s-chip-remove";
    rm.type = "button";
    rm.textContent = "×";
    rm.setAttribute("aria-label", `Remove ${card}`);
    rm.addEventListener("click", () => { state.ownedCards.delete(cardKey); render(); });
    chip.appendChild(rm);
    container.appendChild(chip);
  });
}

function renderNextCardView(resultsGrid) {
  const setupContainer = document.getElementById("next-card-setup");
  const topPick = document.getElementById("top-pick");
  const emptyState = document.getElementById("empty-state");
  const countEl = document.getElementById("result-count");
  const countLabel = document.getElementById("result-count-label");
  const rhSub = document.getElementById("rh-sub");
  const summaryBest = document.getElementById("summary-best");

  // No cards entered → setup-only state (no wallet stats yet)
  if (state.ownedCards.size === 0) {
    renderOwnedCardsPanel(setupContainer, null);
    if (countEl) countEl.textContent = "0";
    if (countLabel) countLabel.textContent = "cards yet — add yours above";
    if (rhSub) rhSub.textContent = "Add the cards in your wallet to see what they're worth and the best one to add";
    if (summaryBest) summaryBest.textContent = "—";
    if (emptyState) {
      emptyState.classList.remove("hidden");
      const title = document.getElementById("empty-state-title");
      const msg = document.getElementById("empty-state-message");
      if (title) title.textContent = "Your wallet is empty";
      if (msg) msg.textContent = "Add the cards you carry above. You'll see what your wallet is worth and the best next card to add.";
    }
    if (topPick) topPick.innerHTML = "";
    if (resultsGrid) resultsGrid.innerHTML = "";
    return;
  }

  const { ranked, stats } = computeNextCardRecommendations();
  const walletStats = stats.wallet;
  renderOwnedCardsPanel(setupContainer, walletStats);

  if (countEl) countEl.textContent = String(ranked.length);
  if (countLabel) countLabel.textContent = "cards would add extra savings";
  if (rhSub) {
    rhSub.textContent = `Your wallet covers ${walletStats.coveredVenues} of ${walletStats.venueCount} restaurants · ${formatCurrency(state.orderValue)} bill`;
  }
  if (summaryBest) {
    summaryBest.textContent = ranked.length > 0
      ? `+${formatCurrency(ranked[0].avgDeltaPerOuting)} / outing`
      : "—";
  }

  if (ranked.length === 0) {
    if (emptyState) {
      emptyState.classList.remove("hidden");
      const title = document.getElementById("empty-state-title");
      const msg = document.getElementById("empty-state-message");
      if (title) title.textContent = "Nothing beats what you already have";
      if (msg) msg.textContent = "With your current wallet, no other card meaningfully improves savings in this scope. Try a different city, broader days, or a higher bill.";
    }
    if (topPick) topPick.innerHTML = "";
    if (resultsGrid) resultsGrid.innerHTML = "";
    return;
  }

  if (emptyState) emptyState.classList.add("hidden");

  // Section header + featured top pick
  if (topPick) {
    topPick.innerHTML = "";
    const header = document.createElement("div");
    header.className = "mw-section-header";
    header.innerHTML = `
      <span class="mw-section-label">Best next card to add</span>
      <span class="mw-section-sub">Ranked by extra savings on top of your wallet</span>
    `;
    topPick.appendChild(header);
    const slot = document.createElement("div");
    topPick.appendChild(slot);
    renderNextCardFeatured(ranked[0], slot);
  }
  // Ranked list (skip the featured one)
  if (resultsGrid) {
    resultsGrid.innerHTML = "";
    const rest = ranked.slice(1, 21);
    rest.forEach((result, idx) => {
      renderNextCardItem(result, resultsGrid, idx + 2);
    });
  }
}

function buildNextCardReason(result) {
  const bits = [];
  if (result.newVenues > 0) {
    bits.push(`<strong>${result.newVenues}</strong> new restaurant${result.newVenues === 1 ? "" : "s"} unlocked`);
  }
  if (result.boostedVenues > 0) {
    bits.push(`<strong>${result.boostedVenues}</strong> existing restaurant${result.boostedVenues === 1 ? "" : "s"} boosted`);
  }
  if (!bits.length) bits.push(`covers ${result.coveredVenues} restaurants in scope`);
  return bits.join(" · ");
}

function renderNextCardFeatured(result, container) {
  if (!container) return;
  const cardKey = buildCardKey(result.bank, result.card);
  const score = Number(result.score).toFixed(1);
  const scorePct = Math.max(0, Math.min(100, Number(result.score) || 0));
  const sc = scoreColor(scorePct);
  const showEligibility = isEligibilityContextActive();
  const eligStatus = result.requirementStatus;
  const reason = buildNextCardReason(result);
  const yearly = result.yearlyDelta;
  const topVenues = result.topVenueWins.slice(0, 3).map((v) => escapeHtml(v.restaurant)).join(", ");

  container.innerHTML = `
    <article class="card-item card-item--featured nc-featured" data-key="${escapeAttr(cardKey)}" tabindex="0" role="button" aria-label="Open details for ${escapeAttr(result.card)} from ${escapeAttr(result.bank)}">
      <div class="card-row card-row--clickable">
        <div class="card-rank rank-1">1</div>
        ${renderBankLogo(result.bank, "card-logo-box")}
        <div class="card-info">
          <div class="card-badges">
            <span class="badge-top-pick">💎 BEST NEXT CARD</span>
            ${showEligibility ? renderEligibilityBadge(eligStatus) : ""}
          </div>
          <div class="card-name">${escapeHtml(result.card)}</div>
          <div class="card-bank">${escapeHtml(result.bank)}</div>
          <div class="nc-reason">${reason}</div>
        </div>
        <div class="score-box">
          <div class="score-num" style="color:${sc}">${score}</div>
          <div class="score-label">Fit Score</div>
          <div class="score-bar">
            <div class="score-bar-fill" style="width:${scorePct}%;background:${sc}"></div>
          </div>
        </div>
      </div>
      <div class="card-stats-row card-stats-row--clickable">
        <div class="card-stat">
          <div class="cs-l">${renderMetricLabel("Extra Saving")}</div>
          <div class="cs-v green">+${formatCurrency(result.avgDeltaPerOuting)} / outing</div>
        </div>
        <div class="card-stat">
          <div class="cs-l">${renderMetricLabel("Estimated Yearly")}</div>
          <div class="cs-v green">~+${formatCurrency(yearly)}</div>
        </div>
        <div class="card-stat">
          <div class="cs-l">${renderMetricLabel("New Restaurants")}</div>
          <div class="cs-v">${result.newVenues}</div>
        </div>
        <div class="card-stat">
          <div class="cs-l">${renderMetricLabel("Improves On")}</div>
          <div class="cs-v">${result.boostedVenues}</div>
        </div>
      </div>
      ${topVenues ? `<div class="nc-feat-topvenues"><span class="nc-feat-topvenues-l">Best wins:</span> ${topVenues}</div>` : ""}
    </article>
  `;
  bindCardOpenInteractions(container.querySelector("article"), cardKey);
}

function renderNextCardItem(result, container, rank) {
  const cardKey = buildCardKey(result.bank, result.card);
  const score = Number(result.score).toFixed(1);
  const scorePct = Math.max(0, Math.min(100, Number(result.score) || 0));
  const sc = scoreColor(scorePct);
  const showEligibility = isEligibilityContextActive();
  const eligStatus = result.requirementStatus;
  const reason = buildNextCardReason(result);

  const article = document.createElement("article");
  article.className = "card-item nc-item";
  article.style.animationDelay = `${Math.min(rank, 12) * 0.04}s`;
  article.dataset.key = cardKey;
  article.innerHTML = `
    <div class="card-row card-row--clickable">
      <div class="card-rank">${rank}</div>
      ${renderBankLogo(result.bank, "card-logo-box")}
      <div class="card-info">
        <div class="card-badges">
          ${showEligibility ? renderEligibilityBadge(eligStatus) : ""}
        </div>
        <div class="card-name">${escapeHtml(result.card)}</div>
        <div class="card-bank">${escapeHtml(result.bank)}</div>
        <div class="nc-reason nc-reason--row">${reason}</div>
      </div>
      <div class="score-box">
        <div class="score-num" style="color:${sc}">${score}</div>
        <div class="score-label">Fit</div>
        <div class="score-bar">
          <div class="score-bar-fill" style="width:${scorePct}%;background:${sc}"></div>
        </div>
      </div>
    </div>
    <div class="card-stats-row card-stats-row--clickable">
      <div class="card-stat">
        <div class="cs-l">${renderMetricLabel("Extra Saving")}</div>
        <div class="cs-v green">+${formatCurrency(result.avgDeltaPerOuting)} / outing</div>
      </div>
      <div class="card-stat">
        <div class="cs-l">${renderMetricLabel("Yearly")}</div>
        <div class="cs-v green">~+${formatCurrency(result.yearlyDelta)}</div>
      </div>
      <div class="card-stat">
        <div class="cs-l">${renderMetricLabel("New")}</div>
        <div class="cs-v">${result.newVenues}</div>
      </div>
      <div class="card-stat">
        <div class="cs-l">${renderMetricLabel("Boosts")}</div>
        <div class="cs-v">${result.boostedVenues}</div>
      </div>
    </div>
  `;
  container.appendChild(article);
  bindCardOpenInteractions(article, cardKey);
}

/* ── BUILD WALLET: VIEW + SETUP PANEL ── */
function renderWalletSetupPanel(container) {
  if (!container) return;
  const K = state.walletSize;
  const ownedCount = state.ownedCards.size;
  const canBuildOnOwned = ownedCount > 0;
  const buildOnOwned = state.walletBuildOnOwned && canBuildOnOwned;
  const sizeOptions = [2, 3, 4];
  const objectiveOptions = [
    { v: "savings",  label: "Savings",  hint: "Maximum gross saving per outing" },
    { v: "coverage", label: "Coverage", hint: "Most restaurants helped" },
    { v: "roi",      label: "ROI",      hint: "Best net of annual fees" },
  ];
  const obj = state.walletObjective || "savings";
  const noSameBank = !!state.walletNoSameBank;
  const mixedTypes = !!state.walletMixedTypes;
  const maxFeeRaw = state.walletMaxFee;
  const mustCount = state.walletMustInclude.size;

  container.innerHTML = `
    <div class="wo-setup">
      <div class="wo-setup-head">
        <div class="wo-setup-title-wrap">
          <div class="wo-setup-kicker">Wallet Builder</div>
          <div class="wo-setup-title">Best ${K}-card wallet for you</div>
          <div class="wo-setup-sub">We pick a combination of cards that <strong>together</strong> covers the most restaurants and saves the most. Unlike Next Card, this designs your wallet from scratch.</div>
        </div>
      </div>

      <div class="wo-controls-grid">
        <div class="wo-control">
          <div class="wo-control-label">Wallet size</div>
          <div class="wo-pill-group" id="wo-k-pills">
            ${sizeOptions.map((n) => `<button class="wo-pill${n === K ? " active" : ""}" type="button" data-k="${n}">${n} cards</button>`).join("")}
          </div>
        </div>

        <div class="wo-control">
          <div class="wo-control-label">Start from</div>
          <div class="wo-mode-toggle">
            <button class="wo-mode-btn${!buildOnOwned ? " active" : ""}" type="button" data-mode="scratch">Scratch</button>
            <button class="wo-mode-btn${buildOnOwned ? " active" : ""}${canBuildOnOwned ? "" : " disabled"}" type="button" data-mode="owned" ${canBuildOnOwned ? "" : "disabled"}>
              My ${ownedCount} card${ownedCount === 1 ? "" : "s"}
            </button>
          </div>
        </div>

        <div class="wo-control">
          <div class="wo-control-label">Optimize for</div>
          <div class="wo-pill-group" id="wo-obj-pills">
            ${objectiveOptions.map((o) => `<button class="wo-pill${o.v === obj ? " active" : ""}" type="button" data-obj="${o.v}" title="${escapeAttr(o.hint)}">${o.label}</button>`).join("")}
          </div>
        </div>

        <div class="wo-control">
          <div class="wo-control-label">Max annual fee</div>
          <div class="wo-fee-wrap">
            <span class="wo-fee-prefix">PKR</span>
            <input id="wo-max-fee" type="number" inputmode="numeric" min="0" step="1000" placeholder="No cap" value="${maxFeeRaw !== null ? String(maxFeeRaw) : ""}" />
            <span class="wo-fee-suffix">/ year</span>
            ${maxFeeRaw !== null ? `<button class="wo-fee-clear" id="wo-max-fee-clear" type="button" aria-label="Clear cap">×</button>` : ""}
          </div>
        </div>
      </div>

      <details class="wo-advanced" ${state.walletAdvancedOpen || noSameBank || mixedTypes || mustCount > 0 ? "open" : ""}>
        <summary class="wo-advanced-summary">
          <span class="wo-advanced-summary-text">
            <span class="wo-advanced-icon">⚙</span>
            Advanced options
          </span>
          ${(() => {
            const activeBits = [];
            if (noSameBank) activeBits.push("No same bank");
            if (mixedTypes) activeBits.push("Mixed types");
            if (mustCount > 0) activeBits.push(`${mustCount} pinned`);
            return activeBits.length > 0
              ? `<span class="wo-advanced-badges">${activeBits.map((b) => `<span class="wo-advanced-badge">${escapeHtml(b)}</span>`).join("")}</span>`
              : `<span class="wo-advanced-hint">Diversity, mixed types, pin specific cards</span>`;
          })()}
          <span class="wo-advanced-chevron" aria-hidden="true"></span>
        </summary>

        <div class="wo-advanced-body">
          <div class="wo-toggles">
            <label class="wo-toggle">
              <input type="checkbox" id="wo-nobank" ${noSameBank ? "checked" : ""} />
              <span class="wo-toggle-slider"></span>
              <span class="wo-toggle-label">No two cards from the same bank</span>
            </label>
            <label class="wo-toggle">
              <input type="checkbox" id="wo-mix" ${mixedTypes ? "checked" : ""} />
              <span class="wo-toggle-slider"></span>
              <span class="wo-toggle-label">Mix card types (≥1 debit + ≥1 credit)</span>
            </label>
          </div>

          <div class="wo-must-section">
            <div class="wo-must-head">
              <div class="wo-control-label">Must include cards <span class="wo-must-count">${mustCount > 0 ? `(${mustCount})` : ""}</span></div>
              ${mustCount > 0 ? `<button class="wo-must-clear" id="wo-must-clear" type="button">Clear</button>` : ""}
            </div>
            <input id="wo-must-search" class="s-search wo-must-search" type="search" placeholder="Pin specific cards to the wallet…" autocomplete="off" value="${escapeAttr(state.walletMustIncludeSearchTerm)}" />
            <div id="wo-must-results" class="s-search-results wo-must-results"></div>
            <div id="wo-must-chips" class="s-chips wo-must-chips"></div>
          </div>
        </div>
      </details>

      ${buildOnOwned ? `
        <div class="wo-anchor-note">
          Building on top of: ${Array.from(state.ownedCards).slice(0, 3).map((ck) => {
            const [bank, card] = ck.split(" || ");
            return `<span class="wo-anchor-pill">${escapeHtml(card)}</span>`;
          }).join(" ")}${state.ownedCards.size > 3 ? ` <span class="wo-anchor-pill wo-anchor-pill--more">+${state.ownedCards.size - 3} more</span>` : ""}
        </div>
      ` : `
        <div class="wo-crosslink">
          ${canBuildOnOwned
            ? `Already added your cards in <a class="wo-link" id="wo-go-next-card">My Wallet</a>? <a class="wo-link" id="wo-switch-build-owned">Build on top of them →</a>`
            : `Have cards already? <a class="wo-link" id="wo-go-next-card">Open My Wallet →</a> to add them and see the best next card.`
          }
        </div>
      `}
    </div>
  `;

  // Event wiring
  container.querySelectorAll("#wo-k-pills .wo-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      const k = Number(btn.dataset.k);
      if (k >= 2 && k <= 4 && k !== state.walletSize) {
        state.walletSize = k;
        trackEvent("wallet_k_change", { k });
        render();
      }
    });
  });
  container.querySelectorAll(".wo-mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.classList.contains("disabled")) return;
      const mode = btn.dataset.mode;
      const next = mode === "owned";
      if (next !== state.walletBuildOnOwned) {
        state.walletBuildOnOwned = next;
        trackEvent("wallet_mode_change", { mode: next ? "owned" : "scratch" });
        render();
      }
    });
  });
  container.querySelectorAll("#wo-obj-pills .wo-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      const o = btn.dataset.obj;
      if (o && o !== state.walletObjective) {
        state.walletObjective = o;
        trackEvent("wallet_objective_change", { objective: o });
        render();
      }
    });
  });
  const maxFeeInput = container.querySelector("#wo-max-fee");
  if (maxFeeInput) {
    maxFeeInput.addEventListener("input", debounce((e) => {
      const v = parseOptionalNumber(e.target.value);
      state.walletMaxFee = (v !== null && v >= 0) ? v : null;
      trackEvent("wallet_max_fee_set", { cap: state.walletMaxFee });
      render();
    }, 220));
  }
  container.querySelector("#wo-max-fee-clear")?.addEventListener("click", () => {
    state.walletMaxFee = null;
    render();
  });
  container.querySelector("#wo-nobank")?.addEventListener("change", (e) => {
    state.walletNoSameBank = !!e.target.checked;
    trackEvent("wallet_diversity_toggle", { rule: "no_same_bank", on: state.walletNoSameBank });
    render();
  });
  container.querySelector("#wo-mix")?.addEventListener("change", (e) => {
    state.walletMixedTypes = !!e.target.checked;
    trackEvent("wallet_diversity_toggle", { rule: "mixed_types", on: state.walletMixedTypes });
    render();
  });
  container.querySelector("#wo-must-clear")?.addEventListener("click", () => {
    state.walletMustInclude = new Set();
    state.walletMustIncludeSearchTerm = "";
    render();
  });
  const mustSearch = container.querySelector("#wo-must-search");
  if (mustSearch) {
    mustSearch.addEventListener("input", (e) => {
      state.walletMustIncludeSearchTerm = e.target.value.trim();
      renderWalletMustResults();
    });
  }
  container.querySelector(".wo-advanced")?.addEventListener("toggle", (e) => {
    state.walletAdvancedOpen = !!e.target.open;
  });
  container.querySelector("#wo-switch-build-owned")?.addEventListener("click", () => {
    state.walletBuildOnOwned = true;
    render();
  });
  container.querySelector("#wo-go-next-card")?.addEventListener("click", () => {
    state.viewMode = "my-wallet";
    render();
  });

  renderWalletMustResults();
  renderWalletMustChips();
}

// Tiny debounce helper for the fee input
function debounce(fn, delay) {
  let t = null;
  return (...args) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

function renderWalletMustResults() {
  const container = document.getElementById("wo-must-results");
  if (!container) return;
  const term = (state.walletMustIncludeSearchTerm || "").toLowerCase();
  if (!term) { container.innerHTML = ""; return; }
  const catalog = getAllCardsCatalog();
  const results = catalog
    .filter((c) => !state.walletMustInclude.has(c.cardKey))
    .filter((c) => `${c.bank} ${c.card}`.toLowerCase().includes(term))
    .slice(0, 12);
  container.innerHTML = "";
  if (results.length === 0) {
    container.innerHTML = `<div class="nc-search-empty">No matching cards.</div>`;
    return;
  }
  results.forEach((entry) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "s-search-item nc-search-item";
    item.innerHTML = `
      <span class="nc-search-item-text">
        <span class="nc-search-item-card">${escapeHtml(entry.card)}</span>
        <span class="nc-search-item-bank">${escapeHtml(entry.bank)}</span>
      </span>
      <span class="s-search-item-add">+ Pin</span>
    `;
    item.addEventListener("click", () => {
      state.walletMustInclude.add(entry.cardKey);
      state.walletMustIncludeSearchTerm = "";
      const input = document.getElementById("wo-must-search");
      if (input) input.value = "";
      trackEvent("wallet_pin_card", { bank: entry.bank, pinned: state.walletMustInclude.size });
      render();
    });
    container.appendChild(item);
  });
}

function renderWalletMustChips() {
  const container = document.getElementById("wo-must-chips");
  if (!container) return;
  container.innerHTML = "";
  Array.from(state.walletMustInclude).sort().forEach((cardKey) => {
    const [bank, card] = cardKey.split(" || ");
    const chip = document.createElement("div");
    chip.className = "s-chip nc-chip wo-must-chip";
    chip.innerHTML = `
      <span class="wo-must-pin-icon">📌</span>
      <span class="nc-chip-text">
        <span class="nc-chip-card">${escapeHtml(card || "")}</span>
        <span class="nc-chip-bank">${escapeHtml(bank || "")}</span>
      </span>
    `;
    const rm = document.createElement("button");
    rm.className = "s-chip-remove";
    rm.type = "button";
    rm.textContent = "×";
    rm.setAttribute("aria-label", `Unpin ${card}`);
    rm.addEventListener("click", () => { state.walletMustInclude.delete(cardKey); render(); });
    chip.appendChild(rm);
    container.appendChild(chip);
  });
}

function renderWalletView(resultsGrid) {
  const setupContainer = document.getElementById("wallet-setup");
  const topPick = document.getElementById("top-pick");
  const emptyState = document.getElementById("empty-state");
  const countEl = document.getElementById("result-count");
  const countLabel = document.getElementById("result-count-label");
  const rhSub = document.getElementById("rh-sub");
  const summaryBest = document.getElementById("summary-best");

  renderWalletSetupPanel(setupContainer);

  const { ranked, stats } = computeWalletRecommendations();
  const K = stats.K;

  if (countEl) countEl.textContent = ranked.length ? String(K) : "0";
  if (countLabel) countLabel.textContent = ranked.length ? `card wallet recommended` : "wallets possible";
  if (rhSub) {
    const ctx = stats.buildOnOwned
      ? `Best ${K} cards to add on top of your ${stats.anchorCount} · ${formatCurrency(state.orderValue)} bill`
      : `Best ${K}-card combination from scratch · ${formatCurrency(state.orderValue)} bill`;
    rhSub.textContent = ctx;
  }
  if (summaryBest) {
    summaryBest.textContent = ranked.length > 0
      ? `${formatCurrency(ranked[0].perOutingTotal)} / outing`
      : "—";
  }

  if (ranked.length === 0) {
    if (emptyState) {
      emptyState.classList.remove("hidden");
      const title = document.getElementById("empty-state-title");
      const msg = document.getElementById("empty-state-message");
      if (title) title.textContent = "Couldn't build a wallet with current filters";
      const baseMsg = "Try a broader scope: clear bank/card-type filters, pick a city with more coverage, or turn off eligibility mode.";
      if (msg) msg.textContent = (stats.warnings || []).length > 0 ? stats.warnings.join(" ") : baseMsg;
    }
    if (topPick) topPick.innerHTML = "";
    if (resultsGrid) resultsGrid.innerHTML = "";
    return;
  }
  if (emptyState) emptyState.classList.add("hidden");

  if (topPick) {
    topPick.innerHTML = "";
    // Surface warnings (over budget, missing types, etc.)
    if ((stats.warnings || []).length > 0) {
      const banner = document.createElement("div");
      banner.className = "wo-warning-banner";
      banner.innerHTML = stats.warnings.map((w) => `<div class="wo-warning-line"><span class="wo-warning-icon">⚠️</span><span>${escapeHtml(w)}</span></div>`).join("");
      topPick.appendChild(banner);
    }
    const slot = document.createElement("div");
    topPick.appendChild(slot);
    renderWalletFeatured(ranked[0], slot, stats);
  }
  if (resultsGrid) {
    resultsGrid.innerHTML = "";
    const alternates = ranked.slice(1);
    if (alternates.length > 0) {
      const header = document.createElement("div");
      header.className = "wo-alt-header";
      header.innerHTML = `<span class="wo-alt-header-label">Alternative wallets</span> <span class="wo-alt-header-sub">other strong ${K}-card combinations</span>`;
      resultsGrid.appendChild(header);
      alternates.forEach((wallet, idx) => renderWalletAlternative(wallet, resultsGrid, idx + 2, stats));
    }
  }
}

function renderWalletFeatured(wallet, container, stats) {
  if (!container) return;
  const K = wallet.picks.length;
  const yearly = wallet.perOutingTotal * (state.outingsPerWeek || 1) * 52 * wallet.coverage;
  const totalFee = wallet.totalAnnualFee || 0;
  const feeNote = wallet.feeUnknown ? " <span class='wo-fee-note'>(some unlisted)</span>" : "";
  const showEligibility = isEligibilityContextActive();

  const picksHtml = wallet.picks.map((p, idx) => {
    const eligBadge = showEligibility ? renderEligibilityBadge(p.requirementStatus) : "";
    const role = p.pinned
      ? "Pinned by you"
      : (idx === 0
          ? "Anchor"
          : `Adds${p.newVenues > 0 ? ` ${p.newVenues} new` : ""}${p.newVenues > 0 && p.boostedVenues > 0 ? "," : ""}${p.boostedVenues > 0 ? ` boosts ${p.boostedVenues}` : ""}`);
    return `
      <div class="wo-stack-card${p.pinned ? " wo-stack-card--pinned" : ""}" data-key="${escapeAttr(p.cardKey)}" tabindex="0" role="button">
        <div class="wo-stack-card-rank">${p.pinned ? "📌" : idx + 1}</div>
        ${renderBankLogo(p.bank, "wo-stack-logo")}
        <div class="wo-stack-card-info">
          <div class="wo-stack-card-name">${escapeHtml(p.card)}</div>
          <div class="wo-stack-card-bank">${escapeHtml(p.bank)}</div>
          <div class="wo-stack-card-meta">
            <span class="wo-stack-card-role">${escapeHtml(role)}</span>
            ${!p.pinned && p.newVenues > 0 ? `<span class="wo-stack-card-tag wo-stack-card-tag--new">+${p.newVenues} new</span>` : ""}
            ${!p.pinned && p.boostedVenues > 0 ? `<span class="wo-stack-card-tag">${p.boostedVenues} boosts</span>` : ""}
          </div>
          ${eligBadge ? `<div class="wo-stack-card-elig">${eligBadge}</div>` : ""}
        </div>
      </div>
    `;
  }).join("");

  container.innerHTML = `
    <article class="card-item card-item--featured wo-featured">
      <div class="wo-featured-head">
        <div class="wo-featured-head-left">
          <div class="card-badges">
            <span class="badge-top-pick">🧩 BEST WALLET</span>
          </div>
          <div class="wo-featured-title">${K}-card wallet · ${stats.buildOnOwned ? `on top of your ${stats.anchorCount}` : "from scratch"}</div>
          <div class="wo-featured-sub">Combined savings across all your restaurants — coverage: <strong>${Math.round(wallet.coverage * 100)}%</strong> · ${wallet.coveredVenues} of ${wallet.venueCount} restaurants</div>
        </div>
      </div>

      <div class="wo-stack">
        ${picksHtml}
      </div>

      <div class="wo-combined-stats">
        <div class="wo-combined-stat">
          <div class="wo-combined-l">Combined Saving</div>
          <div class="wo-combined-v green">${formatCurrency(wallet.perOutingTotal)} / outing</div>
        </div>
        <div class="wo-combined-stat">
          <div class="wo-combined-l">Restaurants Covered</div>
          <div class="wo-combined-v">${wallet.coveredVenues} of ${wallet.venueCount}</div>
        </div>
        <div class="wo-combined-stat">
          <div class="wo-combined-l">Est. Yearly</div>
          <div class="wo-combined-v green">~${formatCurrency(yearly)}</div>
        </div>
        <div class="wo-combined-stat">
          <div class="wo-combined-l">Total Annual Fees</div>
          <div class="wo-combined-v">${totalFee === 0 ? "Free / not listed" : formatCurrency(totalFee)}${feeNote}</div>
        </div>
      </div>
    </article>
  `;

  container.querySelectorAll(".wo-stack-card").forEach((node) => {
    const key = node.dataset.key;
    if (!key) return;
    node.addEventListener("click", () => openCardDetail(key));
    node.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openCardDetail(key); }
    });
  });
}

function renderWalletAlternative(wallet, container, rank, stats) {
  const article = document.createElement("article");
  article.className = "card-item wo-alt-item";
  article.style.animationDelay = `${Math.min(rank, 12) * 0.05}s`;
  const picksLine = wallet.picks.map((p) =>
    `<span class="wo-alt-card-chip" data-key="${escapeAttr(p.cardKey)}">${escapeHtml(p.card)} <span class="wo-alt-card-chip-bank">· ${escapeHtml(p.bank)}</span></span>`
  ).join("");
  const totalFee = wallet.totalAnnualFee || 0;
  article.innerHTML = `
    <div class="card-row wo-alt-row">
      <div class="card-rank">${rank}</div>
      <div class="wo-alt-body">
        <div class="wo-alt-cards">${picksLine}</div>
        <div class="wo-alt-stats">
          <span class="wo-alt-stat"><span class="wo-alt-stat-l">Combined:</span> <span class="green">${formatCurrency(wallet.perOutingTotal)} / outing</span></span>
          <span class="wo-alt-stat"><span class="wo-alt-stat-l">Coverage:</span> ${Math.round(wallet.coverage * 100)}%</span>
          <span class="wo-alt-stat"><span class="wo-alt-stat-l">Fees:</span> ${totalFee === 0 ? "Free" : formatCurrency(totalFee)}</span>
        </div>
      </div>
    </div>
  `;
  container.appendChild(article);
  article.querySelectorAll(".wo-alt-card-chip").forEach((chip) => {
    const key = chip.dataset.key;
    if (!key) return;
    chip.addEventListener("click", (e) => { e.stopPropagation(); openCardDetail(key); });
  });
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

/* ── BUILD WALLET RECOMMENDATIONS ──
   Greedy K-card selection. Repeatedly pick the card that adds the most
   marginal saving on top of what the current wallet already gives. This
   solves the "best 2 / 3 / 4 cards together" problem that Next Card can't
   answer (Next Card is one-step greedy from a fixed starting wallet).

   Greedy is near-optimal here because the objective (sum of per-(venue,day)
   max saving over wallet cards) is monotone submodular. For extra polish
   we also generate alternative wallets by branching from the 2nd / 3rd
   best first picks.
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

/* ── ELIGIBILITY ── */
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

  // Treat Salary and Balance as ALTERNATIVE paths (OR logic)
  // A card is only "ineligible" if it has requirements and the user fails BOTH.
  const hasSalaryReq  = salaryReq !== null && salaryReq > 0;
  const hasBalanceReq = balanceReq !== null && balanceReq > 0;
  const isBlocked     = (hasSalaryReq || hasBalanceReq) && (!salaryPassed && !balancePassed);

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

function computeQualificationConfidence(status) {
  const hasEligibilityInput = state.monthlySalary !== null || state.accountBalance !== null;
  if (!hasEligibilityInput || !status?.hasRequirementRecord) return 0.5;

  // Hard penalty for known ineligibility (unifies filter and score)
  if (status.status === "ineligible" || status.status === "est_ineligible") return 0.0;

  const scores = [];
  const scoreDimension = (inputValue, requirementValue, isEstimated = false) => {
    const input = normalizeRequirementNumber(inputValue);
    const req = normalizeRequirementNumber(requirementValue);
    if (req === null) return;

    let q = 0.5;
    if (req <= 0) {
      q = 1.0;
    } else if (input === null) {
      q = 0.5;
    } else {
      const ratio = input / req;
      // Smooth piecewise linear curve
      if (ratio >= 1.3) {
        q = 1.0;
      } else if (ratio >= 1.0) {
        // Linear between 1.0 (0.8 score) and 1.3 (1.0 score)
        q = 0.8 + (ratio - 1.0) * (0.2 / 0.3);
      } else if (ratio >= 0.7) {
        // Linear between 0.7 (0.0 score) and 1.0 (0.8 score)
        q = 0.0 + (ratio - 0.7) * (0.8 / 0.3);
      } else {
        q = 0.0;
      }
    }

    if (isEstimated) {
      q = 0.5 + (q - 0.5) * 0.7;
    }

    scores.push(q);
  };

  scoreDimension(state.monthlySalary, status.salaryReq, status.salaryIsEstimated);
  scoreDimension(state.accountBalance, status.balanceReq, status.balanceIsEstimated);

  if (!scores.length) return 0.5;
  // Use Math.max to support alternative qualification paths (OR logic)
  const maxScore = Math.max(...scores);
  return Math.max(0, Math.min(1, maxScore));
}

function renderEligibilityBadge(status) {
  return `<span class="status-badge status-badge--${escapeHtml(status.tone)}">${escapeHtml(status.label)}</span>`;
}

function renderEligibilityMeta(status) {
  const bits = [];
  if (status.annualFeeWaiverRule) bits.push(status.annualFeeWaiverRule);
  return bits;
}

function setEmptyStateCopy() {
  const title = document.getElementById("empty-state-title");
  const msg = document.getElementById("empty-state-message");
  if (state.useEligibility) {
    if (title) title.textContent = "No cards passed the current eligibility filter";
    if (msg) msg.textContent = "Try turning off eligibility mode, increasing the salary or balance values, or broadening the filters.";
  } else {
    if (title) title.textContent = "No cards match your filters";
    if (msg) msg.textContent = "Try a different city or reset the filters.";
  }
}

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

function renderRequirementSummary(status, options = {}) {
  const { showStatus = false } = options;
  const fields = [
    { label: "Salary", field: "salaryReq" },
    { label: "Min balance", field: "balanceReq" },
    { label: "Annual fee", field: "annualFeePkr" },
  ];
  if (status?.benefitSummary) {
    fields.push({ label: "Benefits", field: "benefitSummary" });
  }
  const estNote = status.isEstimated && status.estimationNote
    ? `<div class="requirement-est-note">~ values are estimates — ${escapeHtml(status.estimationNote)}</div>`
    : "";
  return `
    <div class="requirement-panel">
      <div class="requirement-panel-head">
        <div class="requirement-panel-title">Requirements & fees</div>
        ${showStatus ? renderEligibilityBadge(status) : ""}
      </div>
      <div class="requirement-grid">
        ${fields.map(({ label, field }) => `
          <div class="requirement-item">
            <div class="requirement-label">${escapeHtml(label)}</div>
            <div class="requirement-value">${escapeHtml(formatRequirementFieldValue(status, field))}</div>
          </div>
        `).join("")}
      </div>
      ${estNote}
      ${renderRequirementNotes(status)}
    </div>
  `;
}

function renderSourcesSection(sourceIds) {
  if (!state.requirements?.sourcesById || !sourceIds?.length) return "";
  const sources = sourceIds
    .map((id) => state.requirements.sourcesById.get(id))
    .filter((s) => s && s.source_type !== "spreadsheet");
  if (!sources.length) return "";
  return `
    <div class="cd-section cd-sources-section">
      <div class="cd-section-title">Data sources</div>
      <div class="cd-sources-list">
        ${sources.map((s) => {
          const isPdf = s.source_type === "pdf";
          return `<a class="cd-source-link" href="${escapeAttr(s.url)}" target="_blank" rel="noopener noreferrer">
            <span class="cd-source-label">${escapeHtml(isPdf ? "Official document" : "Official bank page")}</span>
            <span class="cd-source-badge cd-source-badge--${isPdf ? "pdf" : "web"}">${isPdf ? "PDF" : "Web"}</span>
          </a>`;
        }).join("")}
      </div>
      <div class="cd-sources-note">Requirements and fees are sourced from publicly available bank documents. Values may change, so verify with your bank before applying.</div>
    </div>
  `;
}

function getCompareRowWinner(row) {
  if (!row || row.compare === "none") return -1;
  const [left, right] = row.vals;
  if (!Number.isFinite(left) || !Number.isFinite(right) || left === right) return -1;
  if (row.compare === "low") return left < right ? 0 : 1;
  return left > right ? 0 : 1;
}

function bindCardOpenInteractions(article, cardKey) {
  if (!article) return;
  const openDetail = () => openCardDetail(cardKey);
  article.querySelectorAll(".card-row--clickable, .card-stats-row--clickable").forEach((node) => {
    node.addEventListener("click", (e) => {
      if (e.target.closest("button, a, input, select, textarea, label")) return;
      openDetail();
    });
  });
  article.addEventListener("keydown", (e) => {
    if (e.target !== article) return;
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    openDetail();
  });
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

/* ── TONIGHT BUTTON ── */
function updateTonightButton() {
  const btn = document.getElementById("btn-tonight");
  if (!btn) return;
  const todayIdx = (new Date().getDay() + 6) % 7;
  const isActive = state.selectedDays.size === 1 && state.selectedDays.has(todayIdx);
  btn.textContent = `🌙 ${DAY_SHORT[todayIdx]} Tonight`;
  btn.classList.toggle("active", isActive);
}

/* ── VIEW TOGGLE ── */
function updateViewToggle() {
  document.getElementById("btn-view-cards")?.classList.toggle("active", state.viewMode === "cards");
  document.getElementById("btn-view-restaurants")?.classList.toggle("active", state.viewMode === "restaurants");
  document.getElementById("btn-view-next-card")?.classList.toggle("active", state.viewMode === "my-wallet");
  document.getElementById("btn-view-wallet")?.classList.toggle("active", state.viewMode === "wallet");
  const ncSetup = document.getElementById("next-card-setup");
  if (ncSetup) ncSetup.style.display = state.viewMode === "my-wallet" ? "" : "none";
  const woSetup = document.getElementById("wallet-setup");
  if (woSetup) woSetup.style.display = state.viewMode === "wallet" ? "" : "none";
}

function setupMobileNavMenu() {
  const nav = document.querySelector(".nav");
  const toggle = document.getElementById("nav-toggle");
  if (!nav || !toggle) return;

  let utilityNav = nav.querySelector(".utility-nav");
  if (!utilityNav) {
    const deskLinks = Array.from(nav.querySelectorAll(".nav-links-desk a"))
      .map((link) => `<a class="nav-link utility-link" href="${escapeAttr(link.getAttribute("href") || "#")}">${escapeHtml(link.textContent || "")}</a>`)
      .join("");
    utilityNav = document.createElement("div");
    utilityNav.className = "utility-nav";
    utilityNav.innerHTML = deskLinks;
    nav.appendChild(utilityNav);
    utilityNav.querySelector("#nav-mobile-quiz")?.addEventListener("click", () => {
      closeMobileNavMenu();
      openQuiz();
    });
  }

  const toggleMenu = (forceOpen) => {
    const willOpen = typeof forceOpen === "boolean" ? forceOpen : !utilityNav.classList.contains("nav-open");
    utilityNav.classList.toggle("nav-open", willOpen);
    toggle.setAttribute("aria-expanded", willOpen ? "true" : "false");
    toggle.setAttribute("aria-label", willOpen ? "Close menu" : "Open menu");
  };

  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleMenu();
  });

  utilityNav.addEventListener("click", (e) => {
    if (e.target.closest("a")) toggleMenu(false);
  });

  document.addEventListener("click", (e) => {
    if (!utilityNav.classList.contains("nav-open")) return;
    if (nav.contains(e.target)) return;
    toggleMenu(false);
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 768) toggleMenu(false);
  });
}

function closeMobileNavMenu() {
  const nav = document.querySelector(".nav");
  const toggle = document.getElementById("nav-toggle");
  const utilityNav = nav?.querySelector(".utility-nav");
  if (!toggle || !utilityNav) return;
  utilityNav.classList.remove("nav-open");
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-label", "Open menu");
}

/* ── BANK APPLY LINK ── */
function getBankApplyUrl(bank) {
  return BANK_APPLY_URLS[normalizeBankKey(bank)] || null;
}

/* ── DEAL DENSITY ── */
function getDealDensityByDay(bank, card) {
  const dayRests = Array.from({ length: 7 }, () => new Set());
  state.data.offers.forEach((offer) => {
    if (offer.bank !== bank || offer.card !== card) return;
    if (!cityMatches(offer.city)) return;
    offer.days.forEach((d) => dayRests[d].add(offer.restaurant));
  });
  return dayRests.map((s) => s.size);
}


/* ── CARD DETAIL MODAL ── */
function openCardDetail(cardKey) {
  state.detailCardKey = cardKey;
  state.pagination.cardDetailRestaurants = 1;
  const modal = document.getElementById("card-detail-modal");
  const inner = document.getElementById("card-detail-inner");
  if (!modal || !inner) return;
  renderCardDetailModal(inner);
  modal.style.display = "flex";
}

function closeCardDetail() {
  state.detailCardKey = null;
  const modal = document.getElementById("card-detail-modal");
  if (modal) modal.style.display = "none";
}

function getRequirementNotes(status) {
  const items = [];
  if (status.annualFeeWaiverRule) items.push(status.annualFeeWaiverRule);
  (status.cardNotes || []).forEach((n) => items.push(n));
  (status.bankGaps || []).forEach((n) => items.push(n));

  return [...new Set(
    items
      .filter((n) => typeof n === "string")
      .map((n) => n.trim())
      .filter(Boolean)
  )];
}

function renderRequirementNotes(status) {
  const items = getRequirementNotes(status);
  if (!items.length) return "";

  return `
    <details class="cd-notes-details">
      <summary class="cd-notes-summary">
        <span class="cd-notes-summary-left">
          <span class="cd-notes-heading">Notes</span>
          <span class="cd-notes-count">${items.length}</span>
        </span>
        <span class="cd-notes-caret" aria-hidden="true"></span>
      </summary>
      <ul class="cd-notes-list">
        ${items.map((text) => `<li class="cd-note-item">${escapeHtml(text)}</li>`).join("")}
      </ul>
    </details>
  `;
}

function renderCardDetailModal(inner) {
  const key = state.detailCardKey;
  if (!key || !state.data) return;
  const [bank, card] = key.split(" || ");

  const results = computeRecommendations();
  const result  = results.find((r) => r.bank === bank && r.card === card);

  const allOffers = state.data.offers.filter((o) =>
    o.bank === bank && o.card === card && cityMatches(o.city),
  );

  const byRest = new Map();
  allOffers.forEach((offer) => {
    const rk     = `${offer.city}|||${offer.restaurant}`;
    const saving = getOfferSavingValue(offer, state.orderValue) || 0;
    const cur    = byRest.get(rk);
    if (!cur || saving > cur.saving) {
      byRest.set(rk, {
        restaurant:   offer.restaurant,
        city:         offer.city,
        saving,
        discountLabel: offer.discountLabel,
        offerTitle:   offer.offerTitle,
        offerDescription: offer.offerDescription,
        orderTypes:   offer.orderTypes || [],
        daysLabel:    offer.daysLabel,
        capPkr:       offer.capPkr,
      });
    }
  });

  const restaurants = [...byRest.values()]
    .filter((r) => r.saving > 0)
    .sort((a, b) => b.saving - a.saving);

  const annualSaving = result ? result.avgExpectedSaving * state.outingsPerWeek * 52 : 0;
  const fee          = result?.requirementStatus?.annualFeePkr ?? null;
  const netAnnual    = fee !== null ? annualSaving - fee : null;
  const applyUrl     = getBankApplyUrl(bank);
  const score        = result ? Number(result.score).toFixed(1) : "—";
  inner.innerHTML = `
    <div class="cd-wrap">
      <div class="cd-head">
          <div class="cd-head-left">
            ${renderBankLogo(bank, "cd-logo")}
            <div class="cd-head-info">
              ${result ? `<div class="cd-score" style="color:${scoreColor(Number(result.score))}">Score ${score} / 100</div>` : ""}
              <div class="cd-card-name">${escapeHtml(card)}</div>
              <div class="cd-bank-name">${escapeHtml(bank)}</div>
            </div>
        </div>
        <div class="cd-head-actions">
          ${applyUrl ? `<a class="btn-apply" href="${escapeAttr(applyUrl)}" target="_blank" rel="noopener noreferrer">Apply →</a>` : ""}
          <button class="btn-modal-close" id="btn-cd-close" type="button">×</button>
        </div>
      </div>

      ${result ? `
      <div class="cd-stats">
        <div class="cd-stat cd-stat--saving">
          <div class="cd-stat-l">Saving / outing</div>
          <div class="cd-stat-v green">${formatCurrency(result.avgExpectedSaving)}</div>
        </div>
        <div class="cd-stat cd-stat--annual">
          <div class="cd-stat-l">Annual (${state.outingsPerWeek === 4 ? "4×+" : state.outingsPerWeek + "×"}/wk)</div>
          <div class="cd-stat-v green">${formatSavingsAmount(annualSaving, { per: "yr" })}</div>
        </div>
        ${netAnnual !== null ? `
        <div class="cd-stat cd-stat--net">
          <div class="cd-stat-l">Net annual saving</div>
          <div class="cd-stat-v" style="color:${netAnnual >= 0 ? "var(--green)" : "var(--red)"}">${formatSavingsAmount(netAnnual, { per: "yr", signed: true })}</div>
          <div class="cd-stat-sub">After ${formatCurrency(fee)} fee</div>
        </div>` : ""}
        <div class="cd-stat cd-stat--restaurants">
          <div class="cd-stat-l">Restaurants Matched</div>
          <div class="cd-stat-v">${result.coveredVenueCount} of ${result.totalVenueCount}</div>
        </div>
        <div class="cd-stat cd-stat--annual-fees">
          <div class="cd-stat-l">Annual Fees</div>
          <div class="cd-stat-v">${result.requirementStatus?.annualFeePkr === null ? "Not listed" : result.requirementStatus?.annualFeePkr === 0 ? "Free" : result.requirementStatus?.annualFeeWaiverRule ? `${formatCurrency(result.requirementStatus?.annualFeePkr)} (waivable)` : formatCurrency(result.requirementStatus?.annualFeePkr)}</div>
        </div>
      </div>` : ""}

      ${result ? renderRequirementSummary(result.requirementStatus, { showStatus: true }) : ""}

      ${result ? renderSourcesSection(result.requirementStatus.sourceIds) : ""}

      <div class="cd-section">
        <div class="cd-section-title">
          All restaurant deals
          <span class="cd-section-sub">${restaurants.length} restaurants · at ${formatCurrency(state.orderValue)} bill</span>
        </div>
        <input type="search" class="s-search cd-rest-search" placeholder="Search restaurants…" autocomplete="off" />
        <div class="cd-rest-list"></div>
      </div>
    </div>
  `;

  inner.querySelector("#btn-cd-close")?.addEventListener("click", closeCardDetail);
  const searchInput = inner.querySelector(".cd-rest-search");
  const listContainer = inner.querySelector(".cd-rest-list");
  const renderRows = () => {
    const term = searchInput?.value.trim().toLowerCase() || "";
    const filteredRestaurants = restaurants.filter((entry) => !term || entry.restaurant.toLowerCase().includes(term));
    renderCardDetailRestaurantRows(listContainer, filteredRestaurants);
  };
  searchInput?.addEventListener("input", () => {
    state.pagination.cardDetailRestaurants = 1;
    renderRows();
  });
  renderRows();
}

/* ── RESTAURANT VIEW ── */
function computeRestaurantDeals() {
  const validKeys = new Set(computeRecommendations().map((r) => `${r.bank} || ${r.card}`));
  const effectiveDays = getEffectiveSelectedDays();
  const best = new Map();

  state.data.offers.forEach((offer) => {
    if (!cityMatches(offer.city)) return;
    if (!validKeys.has(`${offer.bank} || ${offer.card}`)) return;
    if (state.selectedRestaurants.size > 0 && !state.selectedRestaurants.has(offer.restaurant)) return;
    if (!offer.days.some((d) => effectiveDays.has(d))) return;

    const saving = getOfferSavingValue(offer, state.orderValue);
    if (!Number.isFinite(saving) || saving <= 0) return;

    const rk  = `${offer.city}|||${offer.restaurant}`;
    const cur = best.get(rk);
    if (!cur || saving > cur.saving) {
      best.set(rk, {
        restaurant:   offer.restaurant,
        city:         offer.city,
        saving,
        discountLabel: offer.discountLabel,
        discountPct:  getOfferDiscountPct(offer) || 0,
        daysLabel:    offer.daysLabel,
        bestCard:     offer.card,
        bestBank:     offer.bank,
      });
    }
  });

  return [...best.values()].sort((a, b) => b.saving - a.saving);
}

function renderRestaurantView(resultsGrid) {
  if (!resultsGrid) return;
  const deals = computeRestaurantDeals();

  if (deals.length === 0) {
    resultsGrid.innerHTML = "";
    return;
  }

  resultsGrid.innerHTML = `
    <div class="rest-view-search-wrap">
      <input type="search" class="s-search rest-view-search" placeholder="Search ${deals.length} restaurants…" autocomplete="off" />
    </div>
    <div class="rest-view-list"></div>
  `;

  const searchInput = resultsGrid.querySelector(".rest-view-search");
  const listContainer = resultsGrid.querySelector(".rest-view-list");
  const renderRows = () => {
    const term = searchInput?.value.trim().toLowerCase() || "";
    const filteredDeals = deals.filter((deal) => !term || deal.restaurant.toLowerCase().includes(term));
    renderRestaurantDealRows(listContainer, filteredDeals);
  };
  searchInput?.addEventListener("input", () => {
    state.pagination.restaurantView = 1;
    renderRows();
  });
  renderRows();
}

function openRestaurantDetail(restaurantKey) {
  state.detailRestaurantKey = restaurantKey;
  state.pagination.restaurantDetailCards = 1;
  const modal = document.getElementById("restaurant-detail-modal");
  const inner = document.getElementById("restaurant-detail-inner");
  if (!modal || !inner) return;
  renderRestaurantDetailModal(inner);
  modal.style.display = "flex";
}

function closeRestaurantDetail() {
  state.detailRestaurantKey = null;
  const modal = document.getElementById("restaurant-detail-modal");
  if (modal) modal.style.display = "none";
}

function renderRestaurantDetailModal(inner) {
  const key = state.detailRestaurantKey;
  if (!key || !state.data) return;

  const [city, restaurant] = key.split("|||");
  const validKeys = new Set(computeRecommendations().map((r) => `${r.bank} || ${r.card}`));
  const bestByCard = new Map();

  state.data.offers.forEach((offer) => {
    if (offer.city !== city || offer.restaurant !== restaurant) return;
    if (!validKeys.has(`${offer.bank} || ${offer.card}`)) return;

    const saving = getOfferSavingValue(offer, state.orderValue);
    if (!Number.isFinite(saving) || saving <= 0) return;

    const cardKey = `${offer.bank} || ${offer.card}`;
    const current = bestByCard.get(cardKey);
    if (!current || saving > current.saving) {
      bestByCard.set(cardKey, {
        key: cardKey,
        bank: offer.bank,
        card: offer.card,
        saving,
        offerTitle: offer.offerTitle,
        offerDescription: offer.offerDescription,
        orderTypes: offer.orderTypes || [],
        discountLabel: offer.discountLabel,
        discountPct: getOfferDiscountPct(offer) || 0,
        daysLabel: offer.daysLabel,
        capPkr: offer.capPkr ?? null,
        applyUrl: getBankApplyUrl(offer.bank),
      });
    }
  });

  const cards = [...bestByCard.values()].sort((a, b) => {
    if (b.saving !== a.saving) return b.saving - a.saving;
    return b.discountPct - a.discountPct;
  });

  inner.innerHTML = `
    <div class="cd-wrap">
      <div class="cd-head">
        <div class="cd-head-left">
          <div class="cd-logo rd-logo">${escapeHtml(restaurant.slice(0, 1).toUpperCase())}</div>
          <div class="cd-head-info">
            <div class="cd-card-name">${escapeHtml(restaurant)}</div>
            <div class="cd-bank-name">${escapeHtml(city)} · ${cards.length} matching cards</div>
          </div>
        </div>
        <div class="cd-head-actions">
          <button class="btn-modal-close" id="btn-rd-close" type="button">×</button>
        </div>
      </div>

      <div class="cd-section">
        <div class="cd-section-title">
          Available card discounts
          <span class="cd-section-sub">at ${formatCurrency(state.orderValue)} bill</span>
        </div>
        <input type="search" class="s-search rd-card-search" placeholder="Search cards or banks…" autocomplete="off" />
        <div class="cd-rest-list rd-card-list"></div>
      </div>
    </div>
  `;

  inner.querySelector("#btn-rd-close")?.addEventListener("click", closeRestaurantDetail);
  const searchInput = inner.querySelector(".rd-card-search");
  const listContainer = inner.querySelector(".rd-card-list");
  const renderRows = () => {
    const term = searchInput?.value.trim().toLowerCase() || "";
    const filteredCards = cards.filter((entry) => !term || `${entry.card} ${entry.bank}`.toLowerCase().includes(term));
    renderRestaurantDetailCardRows(listContainer, filteredCards);
  };
  searchInput?.addEventListener("input", () => {
    state.pagination.restaurantDetailCards = 1;
    renderRows();
  });
  renderRows();
}

/* ── EXCLUSIVE RESTAURANTS FOR COMPARE ── */
function getExclusiveRestaurantCounts(key1, key2) {
  const [b1, c1] = key1.split(" || ");
  const [b2, c2] = key2.split(" || ");
  const get = (bank, card) => new Set(
    state.data.offers
      .filter((o) => o.bank === bank && o.card === card && cityMatches(o.city))
      .map((o) => o.restaurant),
  );
  const r1 = get(b1, c1);
  const r2 = get(b2, c2);
  return [[...r1].filter((r) => !r2.has(r)).length, [...r2].filter((r) => !r1.has(r)).length];
}

function getCompareRestaurantRows(compareKeys) {
  if (!state.data || !Array.isArray(compareKeys) || compareKeys.length !== 2) return [];

  const selectedDays = getEffectiveSelectedDays();
  const keySet = new Set(compareKeys);
  const byVenue = new Map();

  state.data.offers.forEach((offer) => {
    if (!cityMatches(offer.city)) return;
    if (!cardTypeMatches(offer.cardCategory)) return;
    if (state.selectedRestaurants.size > 0 && !state.selectedRestaurants.has(offer.restaurant)) return;

    const cardKey = `${offer.bank} || ${offer.card}`;
    if (!keySet.has(cardKey)) return;

    const saving = getOfferSavingValue(offer, state.orderValue);
    if (!Number.isFinite(saving) || saving <= 0) return;

    const venueKey = `${offer.city}|||${offer.restaurant}`;
    if (!byVenue.has(venueKey)) {
      byVenue.set(venueKey, {
        venueKey,
        city: offer.city,
        restaurant: offer.restaurant,
        byCard: new Map(compareKeys.map((key) => [key, new Map()])),
      });
    }

    const dayMap = byVenue.get(venueKey).byCard.get(cardKey);
    selectedDays.forEach((day) => {
      if (!offer.days.includes(day)) return;
      const current = dayMap.get(day);
      const candidate = {
        saving,
        discountLabel: offer.discountLabel,
        offerTitle: offer.offerTitle,
        offerDescription: offer.offerDescription,
        orderTypes: offer.orderTypes || [],
        capPkr: offer.capPkr ?? null,
      };
      if (!current || candidate.saving > current.saving) {
        dayMap.set(day, candidate);
      }
    });
  });

  const summarizeDayMap = (dayMap) => {
    if (!dayMap || dayMap.size === 0) return null;
    const matches = Array.from(dayMap.entries()).sort((a, b) => a[0] - b[0]);
    const strongest = matches.reduce((best, [, entry]) =>
      !best || entry.saving > best.saving ? entry : best, null);
    return {
      saving: strongest.saving,
      discountLabel: strongest.discountLabel,
      offerTitle: strongest.offerTitle,
      offerDescription: strongest.offerDescription,
      orderTypes: strongest.orderTypes,
      capPkr: strongest.capPkr,
      daysLabel: matches.length === selectedDays.size
        ? "All chosen days"
        : matches.map(([day]) => DAY_SHORT[day]).join(", "),
    };
  };

  return Array.from(byVenue.values())
    .map((venue) => {
      const entries = compareKeys.map((key) => summarizeDayMap(venue.byCard.get(key)));
      if (entries.every((entry) => !entry)) return null;
      const strongestSaving = Math.max(...entries.map((entry) => entry?.saving ?? 0));
      return { ...venue, entries, strongestSaving };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const aShared = a.entries.every(Boolean) ? 1 : 0;
      const bShared = b.entries.every(Boolean) ? 1 : 0;
      if (bShared !== aShared) return bShared - aShared;
      if (b.strongestSaving !== a.strongestSaving) return b.strongestSaving - a.strongestSaving;
      return a.restaurant.localeCompare(b.restaurant);
    });
}

function renderRestaurantDealRows(container, deals) {
  if (!container) return;
  if (deals.length === 0) {
    container.innerHTML = `<div class="cd-empty">No restaurant deals match that search.</div>`;
    return;
  }

  const pageData = paginateItems(deals, "restaurantView", PAGINATION_ITEMS_PER_PAGE);
  container.innerHTML = `
    ${pageData.items.map((deal, index) => `
      <button class="rest-deal-row" style="animation-delay:${index * 0.04}s" data-restaurant-key="${escapeAttr(`${deal.city}|||${deal.restaurant}`)}" type="button">
        <div class="rest-deal-rank">${pageData.startIndex + index + 1}</div>
        <div class="rest-deal-body">
          <div class="rest-deal-name">${escapeHtml(deal.restaurant)}</div>
          <div class="rest-deal-sub">${escapeHtml(deal.city)} · ${escapeHtml(deal.daysLabel)}</div>
          <div class="rest-deal-card">Best with: <strong>${escapeHtml(deal.bestCard)}</strong> <span style="color:var(--muted)">by ${escapeHtml(deal.bestBank)}</span></div>
        </div>
        <div class="rest-deal-right">
          <div class="rest-deal-pct">${escapeHtml(deal.discountLabel)}</div>
          <div class="rest-deal-saving">${formatCurrency(deal.saving)}</div>
        </div>
      </button>
    `).join("")}
    ${renderPaginationControls("restaurantView", pageData)}
  `;

  bindPaginationControls(container, "restaurantView", () => renderRestaurantDealRows(container, deals));
  container.querySelectorAll(".rest-deal-row").forEach((row) => {
    row.addEventListener("click", () => openRestaurantDetail(row.dataset.restaurantKey));
  });
}

function renderCardDetailRestaurantRows(container, restaurants) {
  if (!container) return;
  if (restaurants.length === 0) {
    container.innerHTML = `<div class="cd-empty">No active deals match that search.</div>`;
    return;
  }

  const pageData = paginateItems(restaurants, "cardDetailRestaurants", PAGINATION_ITEMS_PER_PAGE);
  container.innerHTML = `
    ${pageData.items.map((entry) => `
      <div class="cd-rest-row">
        <div class="cd-rest-info">
          <div class="cd-rest-name">${escapeHtml(entry.restaurant)}</div>
          <div class="cd-rest-meta">${escapeHtml(entry.city)} · ${escapeHtml(entry.daysLabel)}${entry.capPkr ? ` · cap ${formatCurrency(entry.capPkr)}` : ""}${entry.offerTitle ? ` · ${escapeHtml(entry.offerTitle)}` : ""}</div>
          ${entry.orderTypes && entry.orderTypes.length ? `<div class="cd-rest-meta" style="margin-top:2px">${renderOrderTypeBadges(entry.orderTypes)}</div>` : ""}
          ${entry.offerDescription ? `<div class="cd-rest-meta" style="margin-top:1px"><span class="offer-detail-toggle" onclick="var d=this.nextElementSibling;d.style.display=d.style.display==='none'?'block':'none';this.textContent=d.style.display==='none'?'Details ▾':'Details ▴'" style="cursor:pointer;font-size:11px;color:var(--brand);font-weight:600">Details ▾</span><div class="offer-detail-text" style="display:none;font-size:11px;color:var(--muted);margin-top:2px;line-height:1.4">${escapeHtml(entry.offerDescription)}</div></div>` : ""}
        </div>
        <div class="cd-rest-right">
          <span class="cd-rest-pct">${escapeHtml(entry.discountLabel)}</span>
          <span class="cd-rest-saving">${formatCurrency(entry.saving)}</span>
        </div>
      </div>
    `).join("")}
    ${renderPaginationControls("cardDetailRestaurants", pageData)}
  `;

  bindPaginationControls(container, "cardDetailRestaurants", () => renderCardDetailRestaurantRows(container, restaurants));
}

function renderRestaurantDetailCardRows(container, cards) {
  if (!container) return;
  if (cards.length === 0) {
    container.innerHTML = `<div class="cd-empty">No matching card deals for this restaurant under your current filters.</div>`;
    return;
  }

  const pageData = paginateItems(cards, "restaurantDetailCards", PAGINATION_ITEMS_PER_PAGE);
  container.innerHTML = `
    ${pageData.items.map((entry) => `
      <div class="cd-rest-row rd-card-row">
        <div class="cd-rest-info">
          <div class="rd-card-top">
            ${renderBankLogo(entry.bank, "rd-card-logo")}
            <div class="rd-card-copy">
              <div class="cd-rest-name">${escapeHtml(entry.card)}</div>
              <div class="cd-rest-meta">${escapeHtml(entry.bank)} · ${escapeHtml(entry.daysLabel)}${entry.capPkr ? ` · cap ${formatCurrency(entry.capPkr)}` : ""}${entry.offerTitle ? ` · ${escapeHtml(entry.offerTitle)}` : ""}</div>
              ${entry.orderTypes && entry.orderTypes.length ? `<div class="cd-rest-meta" style="margin-top:2px">${renderOrderTypeBadges(entry.orderTypes)}</div>` : ""}
              ${entry.offerDescription ? `<div class="cd-rest-meta" style="margin-top:1px"><span class="offer-detail-toggle" onclick="var d=this.nextElementSibling;d.style.display=d.style.display==='none'?'block':'none';this.textContent=d.style.display==='none'?'Details ▾':'Details ▴'" style="cursor:pointer;font-size:11px;color:var(--brand);font-weight:600">Details ▾</span><div class="offer-detail-text" style="display:none;font-size:11px;color:var(--muted);margin-top:2px;line-height:1.4">${escapeHtml(entry.offerDescription)}</div></div>` : ""}
            </div>
          </div>
        </div>
        <div class="cd-rest-right">
          <span class="cd-rest-pct">${escapeHtml(entry.discountLabel)}</span>
          <span class="cd-rest-saving">${formatCurrency(entry.saving)}</span>
          <div class="rd-card-actions">
            <button class="btn-detail rd-open-card" data-key="${escapeAttr(entry.key)}" type="button" title="View card details">⤢</button>
            ${entry.applyUrl ? `<a class="btn-apply btn-apply-sm" href="${escapeAttr(entry.applyUrl)}" target="_blank" rel="noopener noreferrer">Apply →</a>` : ""}
          </div>
        </div>
      </div>
    `).join("")}
    ${renderPaginationControls("restaurantDetailCards", pageData)}
  `;

  bindPaginationControls(container, "restaurantDetailCards", () => renderRestaurantDetailCardRows(container, cards));
  container.querySelectorAll(".rd-open-card").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const cardKey = e.currentTarget.dataset.key;
      closeRestaurantDetail();
      openCardDetail(cardKey);
    });
  });
}

function renderCompareRestaurantRows(container, cards, rows) {
  if (!container) return;
  if (rows.length === 0) {
    container.innerHTML = `<div class="cd-empty">No restaurant deals are available for these two cards under the current filters.</div>`;
    return;
  }

  const pageData = paginateItems(rows, "compareRestaurants", PAGINATION_ITEMS_PER_PAGE);
  container.innerHTML = `
    ${pageData.items.map((row) => `
      <button class="cmp-rest-row" data-restaurant-key="${escapeAttr(row.venueKey)}" type="button">
        <div class="cmp-rest-venue">
          <div class="cmp-rest-venue-top">
            <div class="cmp-rest-venue-name">${escapeHtml(row.restaurant)}</div>
          </div>
          <div class="cmp-rest-venue-meta">${escapeHtml(row.city)}</div>
        </div>
        ${row.entries.map((entry, i) => `
          <div class="cmp-rest-card${entry ? "" : " empty"}">
            <div class="cmp-rest-card-label">${escapeHtml(cards[i].card)}</div>
            <div class="cmp-rest-card-bank">${escapeHtml(cards[i].bank)}</div>
            ${entry
              ? `
                <div class="cmp-rest-card-pct">${escapeHtml(entry.discountLabel)}</div>
                <div class="cmp-rest-card-saving">${formatCurrency(entry.saving)}</div>
                <div class="cmp-rest-card-meta">${escapeHtml(entry.daysLabel)}${entry.capPkr ? ` · cap ${formatCurrency(entry.capPkr)}` : ""}${entry.offerTitle ? ` · ${escapeHtml(entry.offerTitle)}` : ""}</div>
              `
              : `
                <div class="cmp-rest-card-pct">—</div>
                <div class="cmp-rest-card-meta">No active deal</div>
              `}
          </div>
        `).join("")}
      </button>
    `).join("")}
    ${renderPaginationControls("compareRestaurants", pageData)}
  `;

  bindPaginationControls(container, "compareRestaurants", () => renderCompareRestaurantRows(container, cards, rows));
  container.querySelectorAll(".cmp-rest-row").forEach((row) => {
    row.addEventListener("click", () => openRestaurantDetail(row.dataset.restaurantKey));
  });
}

function paginateItems(items, pageKey, pageSize = PAGINATION_ITEMS_PER_PAGE) {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(Math.max(state.pagination[pageKey] || 1, 1), totalPages);
  state.pagination[pageKey] = currentPage;
  const startIndex = (currentPage - 1) * pageSize;

  return {
    items: items.slice(startIndex, startIndex + pageSize),
    currentPage,
    totalPages,
    totalItems,
    startIndex,
    endIndex: Math.min(startIndex + pageSize, totalItems),
  };
}

function renderPaginationControls(pageKey, pageData) {
  if (!pageData || pageData.totalPages <= 1) return "";
  const pageListCount = Math.max(0, pageData.endIndex - pageData.startIndex);
  const metaText = pageKey === "results"
    ? `Showing ${pageListCount + (pageData.currentPage === 1 ? 1 : 0)} cards on this page${pageData.currentPage === 1 ? " (plus top pick above)" : ""} · ${pageData.totalItems + 1} total matches`
    : `Showing ${pageData.startIndex + 1}-${pageData.endIndex} of ${pageData.totalItems}`;
  return `
    <div class="pager">
      <div class="pager-meta">${metaText}</div>
      <div class="pager-actions">
        <button class="pager-btn" data-page-key="${escapeAttr(pageKey)}" data-page-action="prev" type="button"${pageData.currentPage === 1 ? " disabled" : ""}>Prev</button>
        <div class="pager-label">Page ${pageData.currentPage} of ${pageData.totalPages}</div>
        <button class="pager-btn" data-page-key="${escapeAttr(pageKey)}" data-page-action="next" type="button"${pageData.currentPage === pageData.totalPages ? " disabled" : ""}>Next</button>
      </div>
    </div>
  `;
}

function bindPaginationControls(container, pageKey, onChange) {
  container.querySelectorAll(`[data-page-key="${pageKey}"]`).forEach((btn) => {
    btn.addEventListener("click", () => {
      const currentPage = state.pagination[pageKey] || 1;
      state.pagination[pageKey] = btn.dataset.pageAction === "prev" ? currentPage - 1 : currentPage + 1;
      onChange();
    });
  });
}

/* ── OUTINGS PILLS ── */
function renderOutingsPills() {
  const container = document.getElementById("outings-pills");
  if (!container) return;
  container.innerHTML = "";
  [1, 2, 3, 4].forEach((n) => {
    const btn = document.createElement("button");
    btn.className = `s-pill${state.outingsPerWeek === n ? " active" : ""}`;
    btn.textContent = n === 4 ? "4×+" : `${n}×`;
    btn.type = "button";
    btn.addEventListener("click", () => {
      state.outingsPerWeek = n;
      render();
    });
    container.appendChild(btn);
  });
}

/* ── TOP PICK REASON ── */
function buildTopPickReason(result) {
  const venueCtx = `covers ${result.coveredVenueCount} of ${result.totalVenueCount} restaurants`;
  const topRest = result.topMatches[0]?.restaurant;
  const savingCtx = topRest ? `best saving at ${topRest}` : `highest savings at your bill size`;
  return `Ranked #1: ${venueCtx}, with the ${savingCtx}.`;
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

/* ── MOBILE FILTER BADGE ── */
function getActiveFilterCount() {
  let n = 0;
  if (state.selectedCity !== "all") n++;
  if (state.selectedDays.size > 0) n++;
  if (state.selectedRestaurants.size > 0) n++;
  if (state.selectedBanks.size > 0) n++;
  if (state.selectedCards.size > 0) n++;
  if (state.selectedCardTypes.size > 0) n++;
  if (state.useEligibility) n++;
  return n;
}

function updateMobileFilterBadge() {
  const tab = document.getElementById("mob-tab-filters");
  if (!tab) return;
  const n = getActiveFilterCount();
  tab.innerHTML = n > 0
    ? `<span>⚙️</span><span class="mob-tab-label">Filters <span class="mob-tab-badge">${n}</span></span>`
    : `<span>⚙️</span><span class="mob-tab-label">Filters</span>`;
}

/* ── SHAREABLE URL ── */
function encodeStateToUrl() {
  const params = new URLSearchParams();
  if (state.selectedCity !== "all") params.set("city", state.selectedCity);
  if (state.orderValue !== 10000) params.set("bill", state.orderValue);
  if (state.outingsPerWeek !== 1) params.set("outings", state.outingsPerWeek);
  if (state.selectedDays.size > 0) params.set("days", Array.from(state.selectedDays).join(","));
  if (state.selectedCardTypes.size > 0) params.set("types", Array.from(state.selectedCardTypes).join(","));
  // Use repeated params for multi-select (banks, rests, cards)
  if (state.selectedBanks.size > 0) {
    for (const bank of state.selectedBanks) {
      params.append("banks", bank);
    }
  }
  if (state.selectedRestaurants.size > 0) {
    for (const rest of state.selectedRestaurants) {
      params.append("rests", rest);
    }
  }
  if (state.selectedCards.size > 0) {
    for (const card of state.selectedCards) {
      params.append("cards", card);
    }
  }
  if (state.useEligibility) params.set("elig", "1");
  if (state.monthlySalary !== null) params.set("salary", state.monthlySalary);
  if (state.accountBalance !== null) params.set("balance", state.accountBalance);
  if (state.viewMode && state.viewMode !== "cards") params.set("view", state.viewMode);
  if (state.ownedCards.size > 0) {
    for (const key of state.ownedCards) {
      params.append("owned", key);
    }
  }
  if (state.walletSize !== 2) params.set("k", state.walletSize);
  if (state.walletBuildOnOwned) params.set("build", "owned");
  if (state.walletMaxFee !== null) params.set("maxfee", state.walletMaxFee);
  if (state.walletNoSameBank) params.set("nobank", "1");
  if (state.walletMixedTypes) params.set("mix", "1");
  if (state.walletObjective && state.walletObjective !== "savings") params.set("obj", state.walletObjective);
  if (state.walletMustInclude.size > 0) {
    for (const key of state.walletMustInclude) params.append("must", key);
  }
  const qs = params.toString();
  history.replaceState(null, "", qs ? `${location.pathname}?${qs}` : location.pathname);
}

function restoreStateFromUrl() {
  const params = new URLSearchParams(location.search);
  if (!params.toString()) return;
  if (params.has("city")) state.selectedCity = normalizeCityValue(params.get("city"));
  if (params.has("bill")) state.orderValue = Number(params.get("bill")) || 10000;
  if (params.has("outings")) state.outingsPerWeek = Math.max(1, Math.min(4, Number(params.get("outings")) || 2));
  if (params.has("days")) state.selectedDays = new Set(params.get("days").split(",").map(Number).filter((n) => n >= 0 && n <= 6));
  if (params.has("types")) state.selectedCardTypes = new Set(params.get("types").split(",").filter(Boolean));
  // Parse repeated params for multi-select (banks, rests, cards)
  // Also support legacy pipe-separated format for backwards compatibility
  if (params.has("banks")) {
    const banks = params.getAll("banks");
    if (banks.length > 0 && banks[0].includes("|")) {
      state.selectedBanks = new Set(banks[0].split("|").filter(Boolean));
    } else {
      state.selectedBanks = new Set(banks.filter(Boolean));
    }
  }
  if (params.has("rests")) {
    const rests = params.getAll("rests");
    if (rests.length > 0 && rests[0].includes("|")) {
      state.selectedRestaurants = new Set(rests[0].split("|").filter(Boolean));
    } else {
      state.selectedRestaurants = new Set(rests.filter(Boolean));
    }
  }
  if (params.has("cards")) {
    const cards = params.getAll("cards");
    if (cards.length > 0 && cards[0].includes("|")) {
      state.selectedCards = new Set(cards[0].split("|").filter(Boolean));
    } else {
      state.selectedCards = new Set(cards.filter(Boolean));
    }
  }
  if (params.get("elig") === "1") {
    state.useEligibility = true;
    if (params.has("salary")) state.monthlySalary = Number(params.get("salary"));
    if (params.has("balance")) state.accountBalance = Number(params.get("balance"));
  }
  if (params.has("view")) {
    const v = String(params.get("view") || "").trim();
    // Legacy alias: view=next-card → my-wallet (the feature was renamed)
    if (v === "next-card" || v === "my-wallet") state.viewMode = "my-wallet";
    else if (v === "restaurants" || v === "cards" || v === "wallet") state.viewMode = v;
  }
  if (params.has("owned")) {
    state.ownedCards = new Set(params.getAll("owned").filter(Boolean));
  }
  if (params.has("k")) {
    const k = Number(params.get("k"));
    if (k >= 2 && k <= 4) state.walletSize = k;
  }
  if (params.get("build") === "owned") state.walletBuildOnOwned = true;
  if (params.has("maxfee")) {
    const n = Number(params.get("maxfee"));
    if (Number.isFinite(n) && n >= 0) state.walletMaxFee = n;
  }
  if (params.get("nobank") === "1") state.walletNoSameBank = true;
  if (params.get("mix") === "1") state.walletMixedTypes = true;
  if (params.has("obj")) {
    const o = String(params.get("obj") || "").trim();
    if (o === "coverage" || o === "roi" || o === "savings") state.walletObjective = o;
  }
  if (params.has("must")) {
    state.walletMustInclude = new Set(params.getAll("must").filter(Boolean));
  }
}

function syncDomToState() {
  const orderSlider = document.getElementById("order-value");
  if (orderSlider) orderSlider.value = String(state.orderValue);
  const bankSearch = document.getElementById("bank-search");
  if (bankSearch) bankSearch.value = "";
  const restSearch = document.getElementById("restaurant-search");
  if (restSearch) restSearch.value = "";
  const cardSearch = document.getElementById("card-search");
  if (cardSearch) cardSearch.value = "";
  const clearEligBtn = document.getElementById("clear-eligibility");
  if (clearEligBtn) clearEligBtn.style.display = state.useEligibility ? "" : "none";
  const monthlySalary = document.getElementById("monthly-salary");
  if (monthlySalary) monthlySalary.value = state.monthlySalary ?? "";
  const accountBalance = document.getElementById("account-balance");
  if (accountBalance) accountBalance.value = state.accountBalance ?? "";
}

/* ── DEBUG HOOK ──
   Expose state + compute fns on window for tests and devtools. No prod risk:
   nothing reads from this in app code paths; classic-script let/const bindings
   already share the same script scope so this is just discoverability sugar. */
if (typeof window !== "undefined") {
  window.__app = {
    get state() { return state; },
    computeRecommendations,
    computeNextCardRecommendations,
    computeWalletRecommendations,
    getOfferSavingValue,
  };
}

/* ── ANALYTICS ──
   Thin wrapper over gtag (already wired in index.html). Calls into the global
   gtag if it's loaded, swallows errors, and namespaces all events under
   "konsa_*" so they're easy to filter in GA. Pass small JSON-safe values only. */
function trackEvent(name, params) {
  try {
    const fn = /** @type {any} */ (window).gtag;
    if (typeof fn !== "function") return;
    fn("event", `konsa_${name}`, params || {});
  } catch (_) { /* no-op */ }
}

// Delegated apply-link tracking — covers every .btn-apply rendered anywhere,
// including inside modals and dynamically-rendered cards. Capture before the
// link navigates so the event has time to dispatch.
document.addEventListener("click", (e) => {
  const target = /** @type {HTMLElement | null} */ (e.target);
  const link = target && target.closest && target.closest("a.btn-apply, a.btn-feat-apply");
  if (!link) return;
  const href = /** @type {HTMLAnchorElement} */ (link).href || "";
  try {
    const host = new URL(href).hostname;
    trackEvent("apply_click", { host });
  } catch (_) { /* no-op */ }
}, true);

/* ── SERVICE WORKER ──
   Registered after first paint so it never blocks initial render. Skipped on
   localhost (always-fresh during dev) and when the SW API isn't available. */
function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  const host = location.hostname;
  if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0") return;
  // Defer to idle time so registration doesn't compete with the first render.
  const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1500));
  idle(() => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("[sw] registration failed", err);
    });
  });
}

/* ── BOOT ── */
init().then(() => {
  renderNavCityTabs();
  updateCityChip();
  // Check first visit and show quick quiz
  checkFirstVisitAndShowQuickQuiz();
  registerServiceWorker();
}).catch((error) => {
  console.error(error);
  // Report to Sentry if loaded
  try { /** @type {any} */(window).Sentry?.captureException?.(error); } catch {}

  const isSchema = error?.name === "OffersSchemaError";
  const title = isSchema ? "App data is malformed" : "Could not load app data";
  const detail = isSchema
    ? "The offers payload has a shape problem. This usually means the data pipeline emitted an incompatible build. Try refreshing in a minute, or check the browser console for details."
    : "Check that data/offers-index.json (or offers.json) exists and is being served over HTTP.";

  const grid = document.getElementById("results-grid");
  if (grid) grid.innerHTML = `
    <div style="padding:40px 20px;text-align:center;background:var(--surface);border-radius:var(--r);border:1px solid var(--line);">
      <div style="font-weight:800;font-size:18px;color:var(--ink);margin-bottom:8px">${escapeHtml(title)}</div>
      <div style="font-size:13px;color:var(--muted);max-width:520px;margin:0 auto;line-height:1.5">${escapeHtml(detail)}</div>
    </div>
  `;
});
