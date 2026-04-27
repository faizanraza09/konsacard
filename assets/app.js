/* ── STATE ── */
const state = {
  data: null,
  requirements: null,
  selectedCity: "all",           // nav city tab
  selectedDays: new Set(),
  selectedRestaurants: new Set(),
  selectedBanks: new Set(),
  selectedCardTypes: new Set(),
  bankSearchTerm: "",
  restSearchTerm: "",
  orderValue: 10000,
  useEligibility: false,
  monthlySalary: null,
  accountBalance: null,
  outingsPerWeek: 2,
  viewMode: "cards",
  myCard: null,
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
  chatLoading: false,
};

const QUICK_QUESTIONS = [
  "Best card for Karachi?",
  "No credit card options?",
  "Highest discount %?",
  "Best low-fee options?",
];
const PAGINATION_ITEMS_PER_PAGE = 10;
const RESULTS_LIST_ITEMS_PER_PAGE = Math.max(1, PAGINATION_ITEMS_PER_PAGE - 1);

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
  standardcharteredbank: "https://www.sc.com/pk/credit-cards/",
  unitedbanklimitedubl:  "https://www.ubl.com.pk/consumer-banking/cards/",
};

/* ── INIT ── */
async function init() {
  const [payload, requirements] = await Promise.all([
    fetchJson("./data/offers.json"),
    loadRequirementsContext(),
  ]);
  state.data = payload;
  state.requirements = requirements;

  state.myCard = localStorage.getItem("konsacard_mycard") || null;
  restoreStateFromUrl();
  bindEvents();
  syncDomToState();
  render();
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
    };
  } catch {
    return { available: false, byCardId: new Map(), mappingByDealKey: new Map(), sourcesById: new Map() };
  }
}

/* ── BIND EVENTS ── */
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

  // Eligibility
  const useElig = document.getElementById("use-eligibility");
  if (useElig) {
    useElig.addEventListener("change", (e) => {
      state.useEligibility = e.target.checked;
      const inputs = document.getElementById("eligibility-inputs");
      const clearBtn = document.getElementById("clear-eligibility");
      if (inputs) inputs.style.display = e.target.checked ? "grid" : "none";
      if (clearBtn) clearBtn.style.display = e.target.checked ? "" : "none";
      render();
    });
  }
  const monthlySalary = document.getElementById("monthly-salary");
  if (monthlySalary) {
    monthlySalary.addEventListener("input", (e) => {
      state.monthlySalary = parseOptionalNumber(e.target.value);
      render();
    });
  }
  const accountBalance = document.getElementById("account-balance");
  if (accountBalance) {
    accountBalance.addEventListener("input", (e) => {
      state.accountBalance = parseOptionalNumber(e.target.value);
      render();
    });
  }
  const clearElig = document.getElementById("clear-eligibility");
  if (clearElig) {
    clearElig.addEventListener("click", () => {
      state.useEligibility = false;
      state.monthlySalary = null;
      state.accountBalance = null;
      if (useElig) useElig.checked = false;
      if (monthlySalary) monthlySalary.value = "";
      if (accountBalance) accountBalance.value = "";
      const inputs = document.getElementById("eligibility-inputs");
      if (inputs) inputs.style.display = "none";
      clearElig.style.display = "none";
      render();
    });
  }

  // Reset all
  const resetBtn = document.getElementById("reset-filters");
  if (resetBtn) resetBtn.addEventListener("click", resetFilters);

  // Quiz
  const openQuizBtn = document.getElementById("btn-open-quiz");
  if (openQuizBtn) openQuizBtn.addEventListener("click", () => openQuiz());

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
    render();
  });
  document.getElementById("btn-view-restaurants")?.addEventListener("click", () => {
    state.viewMode = "restaurants";
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
  state.bankSearchTerm = "";
  state.restSearchTerm = "";
  state.orderValue = 10000;
  state.outingsPerWeek = 2;
  state.viewMode = "cards";
  state.useEligibility = false;
  state.monthlySalary = null;
  state.accountBalance = null;

  const orderSlider = document.getElementById("order-value");
  if (orderSlider) orderSlider.value = "10000";
  const restSearch = document.getElementById("restaurant-search");
  if (restSearch) restSearch.value = "";
  const bankSearch = document.getElementById("bank-search");
  if (bankSearch) bankSearch.value = "";
  const useElig = document.getElementById("use-eligibility");
  if (useElig) useElig.checked = false;
  const eligInputs = document.getElementById("eligibility-inputs");
  if (eligInputs) eligInputs.style.display = "none";
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
  const container = document.getElementById("nav-city-tabs");
  if (!container) return;

  const cities = ["all", ...state.data.cities.map((city) => normalizeCityValue(city)).filter(Boolean)];

  container.innerHTML = "";
  cities.forEach((city) => {
    const btn = document.createElement("button");
    btn.className = `city-tab${state.selectedCity === city ? " active" : ""}`;
    btn.textContent = formatCityLabel(city);
    btn.type = "button";
    btn.addEventListener("click", () => {
      state.selectedCity = city;
      render();
    });
    container.appendChild(btn);
  });
}

function updateCityChip() {
  const el = document.getElementById("summary-cities");
  if (!el) return;
  el.textContent = state.selectedCity === "all"
    ? "All cities"
    : state.selectedCity.charAt(0).toUpperCase() + state.selectedCity.slice(1);
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

  if (state.viewMode === "restaurants") {
    const deals = computeRestaurantDeals();
    if (countEl) countEl.textContent = String(deals.length);
    if (rhSub) rhSub.textContent = `Restaurants with active deals · at ${formatCurrency(state.orderValue)} bill`;
    if (summaryBest) summaryBest.textContent = deals.length > 0 ? `${deals[0].discountLabel} at ${deals[0].restaurant}` : "—";
    if (emptyState) emptyState.classList.add("hidden");
    if (topPick) topPick.innerHTML = "";
    renderRestaurantView(resultsGrid);
    renderCompareTray();
    return;
  }

  if (countEl) countEl.textContent = String(results.length);
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
  renderFeaturedCard(results[0], topPick);
  renderPagedResultCards(results.slice(1), resultsGrid);
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

function renderMetricLabel(label, tooltip) {
  const labelText = `<span class="metric-label-text">${escapeHtml(label)}</span>`;
  if (!tooltip) return labelText;
  return `${labelText}<span class="metric-info" title="${escapeAttr(tooltip)}" aria-label="${escapeAttr(`${label}: ${tooltip}`)}" tabindex="0">i</span>`;
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
  const isMyCard = state.myCard === cardKey;

  container.innerHTML = `
    <article class="card-item card-item--featured${inCmp ? " in-compare" : ""}" id="feat-${escapeAttr(cardKey)}" data-key="${escapeAttr(cardKey)}" tabindex="0" role="button" aria-label="Open details for ${escapeAttr(result.card)} from ${escapeAttr(result.bank)}">
      <div class="card-row card-row--clickable">
        <div class="card-rank rank-1">1</div>
        ${renderBankLogo(result.bank, "card-logo-box")}
        <div class="card-info">
          <div class="card-badges">
            <span class="badge-top-pick">#1 TOP PICK</span>
            ${showEligibility ? renderEligibilityBadge(eligStatus) : ""}
            ${isMyCard ? `<span class="badge-mycard">MY CARD</span>` : ""}
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
          <button class="btn-detail" data-key="${escapeAttr(cardKey)}" type="button" title="View all deals">⤢</button>
          <button class="btn-expand" data-key="${escapeAttr(cardKey)}" type="button">
            ${isExpanded ? "↑" : "↓"}
          </button>
        </div>
      </div>
      <div class="card-stats-row card-stats-row--clickable">
        <div class="card-stat">
          <div class="cs-l cs-l-with-info">${renderMetricLabel("Estimated Saving", "Estimated discount value per outing for your current filters.")}</div>
          <div class="cs-v green">${formatCurrency(result.avgExpectedSaving)} / outing</div>
        </div>
        <div class="card-stat">
          <div class="cs-l cs-l-with-info">${renderMetricLabel("Restaurant Coverage", "How many of your filtered restaurants have active deals for this card.")}</div>
          <div class="cs-v">${result.coveredVenueCount} of ${result.totalVenueCount}</div>
        </div>
        <div class="card-stat">
          <div class="cs-l cs-l-with-info">${renderMetricLabel("Deal-Day Match", "Share of your selected going-out days where this card has active deals.")}</div>
          <div class="cs-v">${Math.round(result.avgDayFit * 100)}%</div>
        </div>
        <div class="card-stat">
          <div class="cs-l cs-l-with-info">${renderMetricLabel("Typical Cap", "Median per-offer discount cap found across matched deals.")}</div>
          <div class="cs-v">${result.medianCap !== null ? formatCurrency(result.medianCap) : "No cap"}</div>
        </div>
      </div>
      ${isExpanded ? renderCardDetail(result) : ""}
    </article>
  `;

  container.querySelector(".btn-compare")?.addEventListener("click", (e) => {
    toggleCompare(e.currentTarget.dataset.key);
  });
  container.querySelector(".btn-detail")?.addEventListener("click", (e) => {
    openCardDetail(e.currentTarget.dataset.key);
  });
  container.querySelector(".btn-expand")?.addEventListener("click", (e) => {
    const key = e.currentTarget.dataset.key;
    state.expandedCard = state.expandedCard === key ? null : key;
    render();
  });
  bindCardOpenInteractions(container.querySelector("article"), cardKey);
}

/* ── RESULT CARDS ── */
function renderResultCards(results, container) {
  if (!container) return;
  container.innerHTML = "";

  results.forEach((result, index) => {
    const rank = index + 2;
    const cardKey = buildCardKey(result.bank, result.card);
    const inCmp = state.compareList.includes(cardKey);
    const canCmp = state.compareList.length < 2 || inCmp;
    const isExpanded = state.expandedCard === cardKey;
    const isMyCard = state.myCard === cardKey;
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
            ${isMyCard ? `<span class="badge-mycard">MY CARD</span>` : ""}
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
          <button class="btn-detail" data-key="${escapeAttr(cardKey)}" type="button" title="View all deals">⤢</button>
          <button class="btn-expand" data-key="${escapeAttr(cardKey)}" type="button">
            ${isExpanded ? "↑" : "↓"}
          </button>
        </div>
      </div>
      <div class="card-stats-row card-stats-row--clickable">
        <div class="card-stat">
          <div class="cs-l cs-l-with-info">${renderMetricLabel("Estimated Saving", "Estimated discount value per outing for your current filters.")}</div>
          <div class="cs-v green">${formatCurrency(result.avgExpectedSaving)} / outing</div>
        </div>
        <div class="card-stat">
          <div class="cs-l cs-l-with-info">${renderMetricLabel("Restaurant Coverage", "How many of your filtered restaurants have active deals for this card.")}</div>
          <div class="cs-v">${result.coveredVenueCount} of ${result.totalVenueCount}</div>
        </div>
        <div class="card-stat">
          <div class="cs-l cs-l-with-info">${renderMetricLabel("Deal-Day Match", "Share of your selected going-out days where this card has active deals.")}</div>
          <div class="cs-v">${Math.round(result.avgDayFit * 100)}%</div>
        </div>
        <div class="card-stat">
          <div class="cs-l cs-l-with-info">${renderMetricLabel("Typical Cap", "Median per-offer discount cap found across matched deals.")}</div>
          <div class="cs-v">${result.medianCap !== null ? formatCurrency(result.medianCap) : "No cap"}</div>
        </div>
      </div>
      ${isExpanded ? renderCardDetail(result) : ""}
    `;

    article.querySelector(".btn-compare")?.addEventListener("click", (e) => {
      toggleCompare(e.currentTarget.dataset.key);
    });
    article.querySelector(".btn-detail")?.addEventListener("click", (e) => {
      openCardDetail(e.currentTarget.dataset.key);
    });
    article.querySelector(".btn-expand")?.addEventListener("click", (e) => {
      const key = e.currentTarget.dataset.key;
      state.expandedCard = state.expandedCard === key ? null : key;
      renderRecommendations();
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
  const pageData = paginateItems(results, "results", RESULTS_LIST_ITEMS_PER_PAGE);
  renderResultCards(pageData.items, container);
  if (pageData.totalPages > 1) {
    container.insertAdjacentHTML("beforeend", renderPaginationControls("results", pageData));
    bindPaginationControls(container, "results", renderRecommendations);
  }
}

function renderCardDetail(result) {
  const eligStatus = result.requirementStatus;
  const showEligibility = isEligibilityContextActive();
  const reqSummary = renderRequirementSummary(eligStatus, { showStatus: showEligibility });

  const detailItems = [
    { icon: "🏙️", l: "Available In", v: getTopPickCitiesLabel() },
    { icon: "📅", l: "Deal-Day Match", v: `${Math.round(result.avgDayFit * 100)}% of days` },
    { icon: "📊", l: "Restaurant Coverage", v: `${result.coveredVenueCount} / ${result.totalVenueCount} restaurants` },
    { icon: "💰", l: "Typical Cap", v: result.medianCap !== null ? formatCurrency(result.medianCap) : "No cap listed" },
  ];

  const topMatchesHtml = result.topMatches.slice(0, 3).map((match) => `
    <div class="match-item">
      <div>
        <div class="match-rest">${escapeHtml(match.restaurant)} <span style="color:var(--muted);font-weight:400">(${escapeHtml(match.city)})</span></div>
        <div class="match-meta">${escapeHtml(match.discountLabel)} · ${escapeHtml(match.daysLabel)}</div>
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
    return;
  }

  tray.style.display = "";
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
    { l: "Restaurant Coverage",       vals: cards.map((c) => c.coveredVenueCount),    fmt: (v)    => `${v} of ${cards[0].totalVenueCount}`,  compare: "high" },
    { l: "Exclusive restaurants",     vals: excl,                                     fmt: (v)    => v > 0 ? `${v} only here` : "—",         compare: "high" },
    { l: "Deal-Day Match",            vals: cards.map((c) => c.avgDayFit),            fmt: (v)    => Math.round(v * 100) + "%",              compare: "high" },
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
            <div class="cmp-tally">${wins[0]}<span style="color:var(--muted2);font-size:18px;margin:0 4px">—</span>${wins[1]}</div>
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
            ${cards.map((c, i) => `
              <div class="cmp-val-cell${winner === i ? " win" : ""}" style="background:${bg}">
                ${row.fmt(row.vals[i], i)}
                ${winner === i ? `<span class="better-badge">Better</span>` : ""}
              </div>
            `).join("")}
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
    bodyHtml = `
      <div class="q-grid">
        ${QUIZ_CARD_TYPE_OPTIONS.map((option) => `
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
  } else if (current.id === "options") {
    bodyHtml = `
      <div class="quiz-panel" style="padding:0;border:none;background:transparent">
        <label class="s-check-row">
          <input id="quiz-use-eligibility" type="checkbox" ${quizState.useEligibility ? "checked" : ""} />
          <span>Use salary and balance to hide clearly ineligible cards</span>
        </label>
      </div>
    `;
  } else if (current.id === "eligibility") {
    canNext = !quizState.useEligibility || quizState.monthlySalary !== null || quizState.accountBalance !== null;
    bodyHtml = `
      <div class="quiz-inline-grid">
        <div>
          <div class="quiz-field-label">Monthly salary</div>
          <input id="quiz-monthly-salary" class="s-search" type="number" inputmode="numeric" min="0" step="1000" placeholder="e.g. 100000" value="${quizState.monthlySalary ?? ""}" />
        </div>
        <div>
          <div class="quiz-field-label">Account balance</div>
          <input id="quiz-account-balance" class="s-search" type="number" inputmode="numeric" min="0" step="1000" placeholder="e.g. 250000" value="${quizState.accountBalance ?? ""}" />
        </div>
      </div>
      <p class="q-hint" style="margin-top:14px;margin-bottom:0">Enter one or both if you want eligibility filtering.</p>
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
      toggleQuizArrayValue("types", btn.dataset.quizType);
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
  inner.querySelector("#quiz-use-eligibility")?.addEventListener("change", (e) => {
    quizState.useEligibility = e.target.checked;
    if (!quizState.useEligibility) {
      quizState.monthlySalary = null;
      quizState.accountBalance = null;
    }
    renderQuiz();
  });
  inner.querySelector("#quiz-monthly-salary")?.addEventListener("input", (e) => {
    quizState.monthlySalary = parseOptionalNumber(e.target.value);
  });
  inner.querySelector("#quiz-account-balance")?.addEventListener("input", (e) => {
    quizState.accountBalance = parseOptionalNumber(e.target.value);
  });
}

function getQuizSteps() {
  const steps = [
    { id: "city", title: "Which city do you usually dine in?", hint: "We’ll focus the ranking on where you actually use the card." },
    { id: "bill", title: "What’s your typical restaurant bill?", hint: "Per outing — caps and savings change a lot with bill size." },
    { id: "days", title: "What days do you usually go out?", hint: "Optional. We’ll keep all days if your pattern varies." },
    { id: "types", title: "What type of card can you get?", hint: "Select one or more. This one matters, so pick at least one." },
    { id: "banks", title: "Do you want to limit this to certain banks?", hint: "Optional. Add banks only if you want to narrow the shortlist." },
    { id: "restaurants", title: "Which restaurants should we prioritize?", hint: "Optional, but this produces much better recommendations." },
    { id: "options", title: "Any special filters?", hint: "Eligibility filtering lives here." },
  ];
  if (quizState?.useEligibility) {
    steps.push({ id: "eligibility", title: "What salary or balance should we use?", hint: "Enter one or both so we can hide clearly ineligible cards." });
  }
  return steps;
}

function handleQuizDone(ans) {
  state.selectedCity = normalizeCityValue(ans.city);
  state.orderValue = ans.bill || 10000;
  state.selectedDays = new Set(ans.days || []);
  state.selectedCardTypes = new Set(ans.types || []);
  state.selectedBanks = new Set(ans.banks || []);
  state.selectedRestaurants = new Set(ans.restaurants || []);
  state.useEligibility = Boolean(ans.useEligibility);
  state.monthlySalary = state.useEligibility ? parseOptionalNumber(ans.monthlySalary) : null;
  state.accountBalance = state.useEligibility ? parseOptionalNumber(ans.accountBalance) : null;
  state.bankSearchTerm = "";
  state.restSearchTerm = "";

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
    if (quizState.types.length > 0 && !quizState.types.includes(offer.cardCategory)) return;
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
    if (quizState.types.length > 0 && !quizState.types.includes(offer.cardCategory)) return;
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
   CHAT — Gemini 2.5 Flash with streaming
   ══════════════════════════════════════════════════════ */

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_BASE    = "https://generativelanguage.googleapis.com/v1beta/models";
/* ── Key management ── */
function getGeminiKey() {
  return (window.GEMINI_KEY || "").trim();
}

/* ── Query-specific data context ── */
function buildQueryContext(userQuery) {
  if (!userQuery || !state.data?.offers) return "";
  const q = userQuery.toLowerCase();
  const offers = state.data.offers;

  // Respect current city/card-type filters
  const filteredOffers = offers.filter(
    (o) => cityMatches(o.city) && cardTypeMatches(o.cardCategory),
  );

  const allRestaurantNames = [...new Set(filteredOffers.map((o) => o.restaurant))];
  const allBankNames      = [...new Set(filteredOffers.map((o) => o.bank))];

  // Restaurant matching — full name or any significant word (>4 chars)
  const mentionedRestaurants = allRestaurantNames
    .filter((r) => {
      const rLow = r.toLowerCase();
      return q.includes(rLow) ||
        rLow.split(/\s+/).some((w) => w.length > 4 && q.includes(w));
    })
    .slice(0, 3);

  // Bank matching — meaningful word from bank name, excluding generic words
  const BANK_STOP = new Set(["bank", "limited", "ltd", "pvt", "and", "the", "of"]);
  const mentionedBanks = allBankNames
    .filter((b) => {
      const words = b.toLowerCase().replace(/[()]/g, "").split(/\s+/);
      return words.some((w) => w.length > 1 && !BANK_STOP.has(w) && q.includes(w));
    })
    .slice(0, 2);

  // Card tier mentions
  const TIERS = ["signature", "world", "platinum", "gold", "silver", "classic", "infinite"];
  const mentionedTiers = TIERS.filter((t) => q.includes(t));

  if (!mentionedRestaurants.length && !mentionedBanks.length && !mentionedTiers.length) {
    return "";
  }

  let ctx = "\n\nSPECIFIC DATA FOR THIS QUERY:";

  // Restaurant-specific offers
  mentionedRestaurants.forEach((rest) => {
    const ro = filteredOffers.filter((o) => o.restaurant === rest);
    if (!ro.length) return;
    ctx += `\n\n${rest} (${ro[0].city}) — active deals:`;
    ro.forEach((o) => {
      ctx +=
        `\n• ${o.bank} ${o.card} (${o.cardCategory}): ${o.offerTitle}` +
        `, valid ${o.daysLabel}` +
        (o.capPkr ? `, cap PKR ${Number(o.capPkr).toLocaleString()}` : "") +
        (o.fixedDiscountPkr ? `, fixed PKR ${Number(o.fixedDiscountPkr).toLocaleString()} off` : "");
    });
  });

  // Bank-specific cards with eligibility
  mentionedBanks.forEach((bank) => {
    const bo = filteredOffers.filter((o) => o.bank === bank);
    if (!bo.length) return;

    const byCard = new Map();
    bo.forEach((o) => {
      if (!byCard.has(o.card)) {
        byCard.set(o.card, {
          cardCategory: o.cardCategory,
          restaurants: new Set(),
          discounts: new Set(),
          caps: [],
        });
      }
      const entry = byCard.get(o.card);
      entry.restaurants.add(o.restaurant);
      entry.discounts.add(o.discountLabel);
      if (o.capPkr) entry.caps.push(o.capPkr);
    });

    ctx += `\n\n${bank} — all cards with deals:`;
    byCard.forEach((data, card) => {
      const capAvg = data.caps.length
        ? Math.round(data.caps.reduce((a, b) => a + b, 0) / data.caps.length)
        : null;
      const elig = evaluateEligibility(bank, card);
      const eligStr = elig.criteria.length ? ` | Requires: ${elig.criteria.join(", ")}` : "";
      const feeStr  = elig.annualFeePkr !== null ? ` | ${formatRequirementCriterion(elig.annualFeePkr, "fee")}` : "";
      ctx +=
        `\n• ${card} (${data.cardCategory}): ${data.restaurants.size} restaurants` +
        `, discounts: ${[...data.discounts].join(", ")}` +
        (capAvg ? `, avg cap PKR ${capAvg.toLocaleString()}` : "") +
        eligStr + feeStr;
    });
  });

  // Tier-specific cards (when no specific bank mentioned)
  if (mentionedTiers.length && !mentionedBanks.length) {
    const tierOffers = filteredOffers.filter((o) =>
      mentionedTiers.some((t) => o.card.toLowerCase().includes(t)),
    );
    if (tierOffers.length) {
      const byCard = new Map();
      tierOffers.forEach((o) => {
        const k = `${o.bank}||${o.card}`;
        if (!byCard.has(k)) {
          byCard.set(k, {
            bank: o.bank,
            card: o.card,
            cardCategory: o.cardCategory,
            restaurants: new Set(),
            discounts: new Set(),
          });
        }
        byCard.get(k).restaurants.add(o.restaurant);
        byCard.get(k).discounts.add(o.discountLabel);
      });
      ctx += `\n\nCards at "${mentionedTiers.join(", ")}" tier level:`;
      byCard.forEach((data) => {
        ctx += `\n• ${data.bank} ${data.card} (${data.cardCategory}): ${data.restaurants.size} restaurants, discounts: ${[...data.discounts].join(", ")}`;
      });
    }
  }

  return ctx;
}

/* ── Dynamic system prompt from live state ── */
function buildSystemPrompt(userQuery = "") {
  const results = computeRecommendations();
  const cityLabel =
    state.selectedCity === "all"
      ? "all cities (Karachi, Lahore, Islamabad)"
      : state.selectedCity;

  const filterLines = [
    `City: ${cityLabel}`,
    `Bill size: ${formatCurrency(state.orderValue)}`,
    state.selectedCardTypes.size
      ? `Card types: ${Array.from(state.selectedCardTypes).join(", ")}`
      : null,
    state.selectedBanks.size
      ? `Banks: ${Array.from(state.selectedBanks).join(", ")}`
      : null,
    state.selectedRestaurants.size
      ? `Restaurants: ${Array.from(state.selectedRestaurants).slice(0, 5).join(", ")}${state.selectedRestaurants.size > 5 ? " …" : ""}`
      : null,
  ]
    .filter(Boolean)
    .join(" | ");

  const userCtxParts = [
    state.outingsPerWeek ? `Outings per week: ${state.outingsPerWeek}` : null,
    state.monthlySalary  ? `Monthly salary: ${formatCurrency(state.monthlySalary)}` : null,
    state.accountBalance ? `Account balance: ${formatCurrency(state.accountBalance)}` : null,
  ].filter(Boolean);
  const userCtx = userCtxParts.length ? userCtxParts.join(" | ") : "Not specified";

  const topCardsCtx =
    results.length === 0
      ? "No cards match the current filters."
      : `Top ${Math.min(results.length, 15)} cards ranked by Fit Score:\n` +
        results.slice(0, 15).map((r, i) => {
          const elig = r.requirementStatus;
          const eligStr = elig?.criteria?.length ? ` | Requires: ${elig.criteria[0]}` : "";
          const feeStr  = elig?.annualFeePkr !== null ? ` | ${formatRequirementCriterion(elig.annualFeePkr, "fee")}` : "";
          return (
            `${i + 1}. ${r.card} (${r.bank}) — Score ${Number(r.score).toFixed(1)}/100 | ` +
            `Est. ${formatCurrency(r.avgExpectedSaving)}/outing | ` +
            `Covers ${r.coveredVenueCount}/${r.totalVenueCount} venues | ` +
            `Day fit ${Math.round(r.avgDayFit * 100)}%` +
            (r.medianCap ? ` | Cap ${formatCurrency(r.medianCap)}` : "") +
            eligStr + feeStr
          );
        }).join("\n");

  const queryCtx = buildQueryContext(userQuery);

  return `You are KonsaCard AI — a knowledgeable assistant for konsacard.pk, an independent restaurant discount card comparison tool for Pakistan.

ABOUT KONSACARD:
konsacard.pk compares restaurant discount deals from 18 Pakistani banks across Karachi, Lahore, and Islamabad. Cards are ranked by a Fit Score (0–100) blending estimated savings (70 wt), restaurant coverage (20 wt), and day fit (10 wt). Rankings are editorial — no bank pays for placement.

CARD TIERS (highest to lowest): Signature > World > Platinum > Gold > Basic.
Higher tiers usually offer higher caps and more partner restaurants, but stricter eligibility.

USER CONTEXT: ${userCtx}
CURRENT FILTERS: ${filterLines}

${topCardsCtx}${queryCtx}

RESPONSE RULES:
- Match depth to the question: brief for simple queries, full detail for comparisons or specific data requests.
- Always name specific card + bank — never be vague.
- Use PKR for all amounts. Monthly saving estimate = per-outing saving × outings/week × 4.3.
- When "SPECIFIC DATA FOR THIS QUERY" is present above, use it as the authoritative source.
- Never invent discount percentages or offer terms — only cite data in this prompt.
- For eligibility/fees, cite the requirements shown or say data is unavailable for that card.
- Format comparisons with bullets. Use **bold** for card names.
- If you genuinely don't know, say so and recommend the user check directly with the bank.`;
}

/* ── Gemini streaming generator ── */
async function* streamGemini(geminiContents, systemPrompt) {
  const key = getGeminiKey();
  const url = `${GEMINI_BASE}/${GEMINI_MODEL}:streamGenerateContent?alt=sse&key=${key}`;

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: geminiContents,
      generationConfig: {
        temperature: 0.35,
        maxOutputTokens: 2048,
        topP: 0.95,
      },
    }),
  });

  if (!resp.ok) {
    let msg = `Gemini API error ${resp.status}`;
    try {
      const body = await resp.json();
      msg = body?.error?.message || msg;
    } catch { /* ignore */ }
    throw new GeminiError(msg, resp.status);
  }

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
      if (!raw || raw === "[DONE]") continue;
      try {
        const parsed = JSON.parse(raw);
        const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) yield text;
      } catch { /* skip malformed chunk */ }
    }
  }
}

class GeminiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/* ── Convert internal message history to Gemini contents format ── */
function toGeminiContents(messages) {
  return messages
    .filter((m) => m.role === "user" || m.role === "bot")
    .map((m) => ({
      role: m.role === "bot" ? "model" : "user",
      parts: [{ text: m.text }],
    }));
}

/* ── Open / close ── */
function openChat() {
  const panel = document.getElementById("chat-panel");
  const fab   = document.getElementById("chat-fab");
  if (panel) panel.style.display = "flex";
  if (fab)   fab.style.display   = "none";

  if (state.chatMessages.length === 0) {
    state.chatMessages = [{
      role: "bot",
      text: "Hi! I'm KonsaCard AI, powered by Gemini. Tell me your city and typical bill and I'll help you find the best restaurant discount card. 💳",
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
    if (msg.streaming) {
      bubble.classList.add("streaming");
    }
    bubble.innerHTML = formatBubbleText(msg.text);
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
function updateStreamingBubble(text) {
  const msgs = document.getElementById("chat-msgs");
  if (!msgs) return;
  const bubbles = msgs.querySelectorAll(".bubble.bot.streaming");
  const last = bubbles[bubbles.length - 1];
  if (last) {
    last.innerHTML = formatBubbleText(text);
    msgs.scrollTop = msgs.scrollHeight;
  }
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

/* ── Send message with streaming ── */
async function sendChatMessage(text) {
  const t = (text || "").trim();
  if (!t || state.chatLoading) return;

  const input = document.getElementById("chat-input");
  if (input) input.value = "";

  state.chatMessages.push({ role: "user", text: t });
  state.chatLoading = true;
  renderChatBody();

  const systemPrompt = buildSystemPrompt(t);
  // Build Gemini contents from all non-system messages (excluding any in-progress streaming msg)
  const history = toGeminiContents(state.chatMessages.filter((m) => !m.streaming));

  // Add streaming placeholder
  const streamingMsg = { role: "bot", text: "", streaming: true };
  state.chatMessages.push(streamingMsg);
  renderChatBody();

  try {
    let fullText = "";
    for await (const chunk of streamGemini(history, systemPrompt)) {
      fullText += chunk;
      streamingMsg.text = fullText;
      updateStreamingBubble(fullText);
    }
    // Finalize
    streamingMsg.text = fullText || "…";
    streamingMsg.streaming = false;
  } catch (err) {
    streamingMsg.streaming = false;
    if (err instanceof GeminiError && (err.status === 400 || err.status === 403)) {
      streamingMsg.text =
        "⚠️ API key issue — your key may be invalid or have no quota. " +
        "Tap the key icon above to update it.";
    } else if (err instanceof GeminiError && err.status === 429) {
      streamingMsg.text =
        "⚠️ Rate limit hit — Gemini free tier allows limited requests per minute. Please wait a moment and try again.";
    } else {
      streamingMsg.text =
        "⚠️ Connection error — please check your internet connection and try again.";
    }
  }

  state.chatLoading = false;
  renderChatBody();
}

/* ── Clear conversation ── */
function clearChat() {
  state.chatMessages = [];
  state.chatLoading = false;
  openChat();
}

/* ── COMPUTE RECOMMENDATIONS ── */
function computeRecommendations() {
  if (!state.data) return [];

  const desiredOffers = state.data.offers.filter((offer) => {
    if (!cityMatches(offer.city)) return false;
    if (state.selectedBanks.size > 0 && !state.selectedBanks.has(offer.bank)) return false;
    if (!cardTypeMatches(offer.cardCategory)) return false;
    if (state.selectedRestaurants.size > 0 && !state.selectedRestaurants.has(offer.restaurant)) return false;
    return true;
  });

  const desiredVenues = new Map();
  desiredOffers.forEach((offer) => {
    const venueKey = `${offer.city} || ${offer.restaurant}`;
    if (!desiredVenues.has(venueKey)) {
      desiredVenues.set(venueKey, { city: offer.city, restaurant: offer.restaurant });
    }
  });

  const totalVenueCount = desiredVenues.size;
  if (!totalVenueCount) return [];

  const selectedDays = getEffectiveSelectedDays();
  const totalSelectedDays = selectedDays.size;
  const cardMap = new Map();

  desiredOffers.forEach((offer) => {
    const offerSaving = getOfferSavingValue(offer, state.orderValue);
    if (!Number.isFinite(offerSaving) || offerSaving <= 0) return;

    const venueKey = `${offer.city} || ${offer.restaurant}`;
    const cardKey = `${offer.bank} || ${offer.card}`;

    if (!cardMap.has(cardKey)) {
      cardMap.set(cardKey, { bank: offer.bank, card: offer.card, venueDailyBest: new Map() });
    }

    const cardRecord = cardMap.get(cardKey);
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
          .map(([, match]) => match.capPkr ?? match.fixedDiscountPkr)
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
    const coverage = coveredVenueCount / totalVenueCount;
    const totalExpectedSaving = matches.reduce((sum, match) => sum + match.expectedSaving, 0);
    const totalDayFit = matches.reduce((sum, match) => sum + match.dayFit, 0);
    const avgExpectedSaving = totalExpectedSaving / totalVenueCount;
    const avgDayFit = totalDayFit / totalVenueCount;
    const averageDiscount = average(
      matches.map((match) => match.discountPct).filter((v) => Number.isFinite(v)),
    );
    const caps = matches
      .map((match) => match.capPkr ?? match.fixedDiscountPkr)
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
      totalVenueCount,
      averageDiscount,
      medianCap,
      topMatches,
    };
  });

  aggregates.forEach((item) => {
    item.requirementStatus = evaluateEligibility(item.bank, item.card);
  });

  const bestExpected = Math.max(...aggregates.map((item) => item.avgExpectedSaving), 1);
  aggregates.forEach((item) => {
    item.score =
      (item.avgExpectedSaving / bestExpected) * 70 + item.coverage * 20 + item.avgDayFit * 10;
  });

  let visible = state.useEligibility
    ? aggregates.filter((item) => item.requirementStatus.status !== "ineligible")
    : aggregates;

  return visible.sort((a, b) => {
    if (state.useEligibility && b.requirementStatus.sortRank !== a.requirementStatus.sortRank) {
      return b.requirementStatus.sortRank - a.requirementStatus.sortRank;
    }
    if (b.score !== a.score) return b.score - a.score;
    if (b.avgExpectedSaving !== a.avgExpectedSaving) return b.avgExpectedSaving - a.avgExpectedSaving;
    return b.coverage - a.coverage;
  });
}

/* ── ELIGIBILITY ── */
function evaluateEligibility(bank, card) {
  if (!state.requirements?.available) {
    return { status: "unavailable", label: "Requirements unavailable", tone: "unclear", sortRank: 1, detail: "Requirements data could not be loaded.", criteria: [], annualFeePkr: null, annualFeeWaiverRule: null, salaryReq: null, balanceReq: null, hasRequirementRecord: false, sourceIds: [] };
  }

  const mapping = state.requirements.mappingByDealKey.get(buildDealCardKey(bank, card));
  if (!mapping?.matched || !mapping.requirement_card_id) {
    return { status: "unclear", label: "Requirements unclear", tone: "unclear", sortRank: 1, detail: "This deal-side card is not yet mapped to a verified requirements record.", criteria: [], annualFeePkr: null, annualFeeWaiverRule: null, salaryReq: null, balanceReq: null, hasRequirementRecord: false, sourceIds: [] };
  }

  const record = state.requirements.byCardId.get(mapping.requirement_card_id);
  if (!record) {
    return { status: "unclear", label: "Requirements unclear", tone: "unclear", sortRank: 1, detail: "A mapped requirements record could not be loaded.", criteria: [], annualFeePkr: null, annualFeeWaiverRule: null, salaryReq: null, balanceReq: null, hasRequirementRecord: false, sourceIds: [] };
  }

  const requirements = record.requirements || {};
  const salaryReq = normalizeRequirementNumber(requirements.minimum_monthly_salary_pkr);
  const balanceReq = normalizeRequirementNumber(requirements.minimum_account_balance_pkr);
  const annualFeePkr = normalizeRequirementNumber(requirements.annual_fee_pkr);
  const annualFeeWaiverRule = requirements.annual_fee_waiver_rule || null;
  const criteria = [];
  const blockers = [];
  let missingInput = false;

  if (salaryReq !== null) {
    criteria.push(formatRequirementCriterion(salaryReq, "salary"));
    if (salaryReq > 0) {
      if (state.monthlySalary === null) missingInput = true;
      else if (state.monthlySalary < salaryReq) blockers.push(`Below the listed salary threshold of ${formatCurrency(salaryReq)} / month`);
    }
  }

  if (balanceReq !== null) {
    criteria.push(formatRequirementCriterion(balanceReq, "balance"));
    if (balanceReq > 0) {
      if (state.accountBalance === null) missingInput = true;
      else if (state.accountBalance < balanceReq) blockers.push(`Below the listed account balance threshold of ${formatCurrency(balanceReq)}`);
    }
  }

  if (annualFeePkr !== null) criteria.push(formatRequirementCriterion(annualFeePkr, "fee"));

  const sourceIds = record.source_ids || [];

  if (blockers.length) return { status: "ineligible", label: "Likely ineligible", tone: "ineligible", sortRank: 0, detail: blockers[0], criteria, annualFeePkr, annualFeeWaiverRule, salaryReq, balanceReq, hasRequirementRecord: true, sourceIds };
  if (salaryReq === null && balanceReq === null) return { status: "unclear", label: "Requirements unclear", tone: "unclear", sortRank: 1, detail: "No public salary or balance threshold was captured for this card.", criteria, annualFeePkr, annualFeeWaiverRule, salaryReq, balanceReq, hasRequirementRecord: true, sourceIds };
  if (missingInput) return { status: "needs_input", label: "Salary/balance not entered", tone: "needs-input", sortRank: 2, detail: "Public thresholds exist, but salary or balance details have not been entered.", criteria, annualFeePkr, annualFeeWaiverRule, salaryReq, balanceReq, hasRequirementRecord: true, sourceIds };

  return { status: "eligible", label: "Likely eligible", tone: "eligible", sortRank: 3, detail: "Entered salary and balance meet the public thresholds captured for this card.", criteria, annualFeePkr, annualFeeWaiverRule, salaryReq, balanceReq, hasRequirementRecord: true, sourceIds };
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
  const discountPct = getOfferDiscountPct(offer);
  const fixedDiscountPkr = Number.isFinite(offer.fixedDiscountPkr) ? offer.fixedDiscountPkr : null;
  const capPkr = Number.isFinite(offer.capPkr) ? offer.capPkr : null;

  if (Number.isFinite(discountPct) && discountPct > 0) {
    return Math.min(
      (orderValue * discountPct) / 100,
      fixedDiscountPkr ?? capPkr ?? Number.POSITIVE_INFINITY,
    );
  }
  if (fixedDiscountPkr !== null && fixedDiscountPkr > 0) return fixedDiscountPkr;
  return null;
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
  if (field === "salaryReq") return value === 0 ? "No minimum salary" : `${formatCurrency(value)} / month`;
  if (field === "balanceReq") return value === 0 ? "No minimum balance" : formatCurrency(value);
  if (field === "annualFeePkr") return value === 0 ? "No annual fee" : formatCurrency(value);
  return "Not listed";
}

function renderRequirementSummary(status, options = {}) {
  const { showStatus = false } = options;
  const meta = renderEligibilityMeta(status);
  const fields = [
    { label: "Salary", field: "salaryReq" },
    { label: "Min balance", field: "balanceReq" },
    { label: "Annual fee", field: "annualFeePkr" },
  ];
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
      <div class="requirement-note">${escapeHtml(showStatus ? status.detail : "Shown only when the requirements dataset has a verified card mapping.")}</div>
      ${status.criteria.length ? `<div class="requirement-meta">${escapeHtml(status.criteria.join(" · "))}</div>` : ""}
      ${meta.length ? `<div class="requirement-meta">${escapeHtml(meta.join(" · "))}</div>` : ""}
    </div>
  `;
}

function renderSourcesSection(sourceIds) {
  if (!state.requirements?.sourcesById || !sourceIds?.length) return "";
  const sources = sourceIds.map((id) => state.requirements.sourcesById.get(id)).filter(Boolean);
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
      <div class="cd-sources-note">Requirements and fees are sourced from publicly available bank documents. Values may change — verify with your bank before applying.</div>
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
    const quizBtn = document.getElementById("btn-open-quiz");
    const quizMarkup = quizBtn
      ? `<button class="btn-find-my-card utility-link" id="nav-mobile-quiz" type="button"><span>🎯</span> Find My Card</button>`
      : "";
    utilityNav = document.createElement("div");
    utilityNav.className = "utility-nav";
    utilityNav.innerHTML = `${deskLinks}${quizMarkup}`;
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

/* ── MY CARD ── */
function setMyCard(cardKey) {
  if (state.myCard === cardKey) {
    state.myCard = null;
    localStorage.removeItem("konsacard_mycard");
  } else {
    state.myCard = cardKey;
    localStorage.setItem("konsacard_mycard", cardKey);
  }
  render();
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
        daysLabel:    offer.daysLabel,
        capPkr:       offer.capPkr,
      });
    }
  });

  const restaurants = [...byRest.values()]
    .filter((r) => r.saving > 0)
    .sort((a, b) => b.saving - a.saving);

  const density    = getDealDensityByDay(bank, card);
  const maxDensity = Math.max(...density, 1);
  const todayIdx   = (new Date().getDay() + 6) % 7;

  const annualSaving = result ? result.avgExpectedSaving * state.outingsPerWeek * 52 : 0;
  const fee          = result?.requirementStatus?.annualFeePkr ?? null;
  const netAnnual    = fee !== null ? annualSaving - fee : null;
  const applyUrl     = getBankApplyUrl(bank);
  const isMyCard     = state.myCard === key;
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
          <button class="btn-cd-mycard${isMyCard ? " active" : ""}" data-key="${escapeAttr(key)}" type="button">
            ${isMyCard ? "✓ My Card" : "♡ My Card"}
          </button>
          ${applyUrl ? `<a class="btn-apply" href="${escapeAttr(applyUrl)}" target="_blank" rel="noopener noreferrer">Apply →</a>` : ""}
          <button class="btn-modal-close" id="btn-cd-close" type="button">×</button>
        </div>
      </div>

      ${result ? `
      <div class="cd-stats">
        <div class="cd-stat">
          <div class="cd-stat-l">Saving / outing</div>
          <div class="cd-stat-v green">${formatCurrency(result.avgExpectedSaving)}</div>
        </div>
        <div class="cd-stat">
          <div class="cd-stat-l">Annual (${state.outingsPerWeek === 4 ? "4×+" : state.outingsPerWeek + "×"}/wk)</div>
          <div class="cd-stat-v green">${formatSavingsAmount(annualSaving, { per: "yr" })}</div>
        </div>
        ${netAnnual !== null ? `
        <div class="cd-stat">
          <div class="cd-stat-l">Net annual saving after ${formatCurrency(fee)} fee</div>
          <div class="cd-stat-v" style="color:${netAnnual >= 0 ? "var(--green)" : "var(--red)"}">${formatSavingsAmount(netAnnual, { per: "yr", signed: true })}</div>
        </div>` : ""}
        <div class="cd-stat">
          <div class="cd-stat-l">Restaurant Coverage</div>
          <div class="cd-stat-v">${result.coveredVenueCount} / ${result.totalVenueCount}</div>
        </div>
        <div class="cd-stat">
          <div class="cd-stat-l">Deal-Day Match</div>
          <div class="cd-stat-v">${Math.round(result.avgDayFit * 100)}%</div>
        </div>
      </div>` : ""}

      ${result ? renderRequirementSummary(result.requirementStatus, { showStatus: true }) : ""}

      ${result ? renderSourcesSection(result.requirementStatus.sourceIds) : ""}

      <div class="cd-section">
        <div class="cd-section-title">Deals by day</div>
        <div class="deal-calendar">
          ${density.map((count, i) => {
            const pct     = count > 0 ? Math.max(Math.round((count / maxDensity) * 100), 14) : 0;
            const isToday = i === todayIdx;
            return `
              <div class="deal-cal-day${isToday ? " today" : ""}">
                <div class="deal-cal-bar-wrap">
                  <div class="deal-cal-bar" style="height:${pct}%;background:${count > 0 ? "var(--green)" : "var(--line)"}"></div>
                </div>
                <div class="deal-cal-label">${DAY_SHORT[i]}</div>
                <div class="deal-cal-count">${count > 0 ? count : "—"}</div>
              </div>`;
          }).join("")}
        </div>
      </div>

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
  inner.querySelector(".btn-cd-mycard")?.addEventListener("click", (e) => {
    setMyCard(e.currentTarget.dataset.key);
    renderCardDetailModal(inner);
  });
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
  const best = new Map();

  state.data.offers.forEach((offer) => {
    if (!cityMatches(offer.city)) return;
    if (!validKeys.has(`${offer.bank} || ${offer.card}`)) return;
    if (state.selectedRestaurants.size > 0 && !state.selectedRestaurants.has(offer.restaurant)) return;

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
          <div class="cd-logo rd-logo">${restaurant.slice(0, 1).toUpperCase()}</div>
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
        capPkr: offer.capPkr ?? offer.fixedDiscountPkr ?? null,
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
          <div class="cd-rest-meta">${escapeHtml(entry.city)} · ${escapeHtml(entry.daysLabel)}${entry.capPkr ? ` · cap ${formatCurrency(entry.capPkr)}` : ""}</div>
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
              <div class="cd-rest-meta">${escapeHtml(entry.bank)} · ${escapeHtml(entry.daysLabel)}${entry.capPkr ? ` · cap ${formatCurrency(entry.capPkr)}` : ""}</div>
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
                <div class="cmp-rest-card-meta">${escapeHtml(entry.daysLabel)}${entry.capPkr ? ` · cap ${formatCurrency(entry.capPkr)}` : ""}</div>
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
    ? `Showing ${pageListCount + 1} cards on this page (including top pick) · ${pageData.totalItems + 1} total matches`
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
  const venueCtx = state.selectedRestaurants.size > 0
    ? `covers ${result.coveredVenueCount} of your ${state.selectedRestaurants.size} selected restaurants`
    : `covers ${result.coveredVenueCount} of ${result.totalVenueCount} restaurants`;
  const topRest = result.topMatches[0]?.restaurant;
  const savingCtx = topRest ? `best saving at ${topRest}` : `highest savings at your bill size`;
  return `Ranked #1 — ${venueCtx}, with the ${savingCtx}.`;
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
  if (state.selectedCardTypes.size > 0) n++;
  if (state.useEligibility) n++;
  return n;
}

function updateMobileFilterBadge() {
  const tab = document.getElementById("mob-tab-filters");
  if (!tab) return;
  const n = getActiveFilterCount();
  tab.innerHTML = n > 0
    ? `<span>⚙️</span>Filters <span class="mob-tab-badge">${n}</span>`
    : `<span>⚙️</span>Filters`;
}

/* ── SHAREABLE URL ── */
function encodeStateToUrl() {
  const params = new URLSearchParams();
  if (state.selectedCity !== "all") params.set("city", state.selectedCity);
  if (state.orderValue !== 10000) params.set("bill", state.orderValue);
  if (state.outingsPerWeek !== 2) params.set("outings", state.outingsPerWeek);
  if (state.selectedDays.size > 0) params.set("days", Array.from(state.selectedDays).join(","));
  if (state.selectedCardTypes.size > 0) params.set("types", Array.from(state.selectedCardTypes).join(","));
  if (state.selectedBanks.size > 0) params.set("banks", Array.from(state.selectedBanks).join("|"));
  if (state.selectedRestaurants.size > 0) params.set("rests", Array.from(state.selectedRestaurants).join("|"));
  if (state.useEligibility) params.set("elig", "1");
  if (state.monthlySalary !== null) params.set("salary", state.monthlySalary);
  if (state.accountBalance !== null) params.set("balance", state.accountBalance);
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
  if (params.has("banks")) state.selectedBanks = new Set(params.get("banks").split("|").filter(Boolean));
  if (params.has("rests")) state.selectedRestaurants = new Set(params.get("rests").split("|").filter(Boolean));
  if (params.get("elig") === "1") {
    state.useEligibility = true;
    if (params.has("salary")) state.monthlySalary = Number(params.get("salary"));
    if (params.has("balance")) state.accountBalance = Number(params.get("balance"));
  }
}

function syncDomToState() {
  const orderSlider = document.getElementById("order-value");
  if (orderSlider) orderSlider.value = String(state.orderValue);
  const bankSearch = document.getElementById("bank-search");
  if (bankSearch) bankSearch.value = "";
  const restSearch = document.getElementById("restaurant-search");
  if (restSearch) restSearch.value = "";
  const useElig = document.getElementById("use-eligibility");
  if (useElig) useElig.checked = state.useEligibility;
  const eligInputs = document.getElementById("eligibility-inputs");
  if (eligInputs) eligInputs.style.display = state.useEligibility ? "grid" : "none";
  const clearEligBtn = document.getElementById("clear-eligibility");
  if (clearEligBtn) clearEligBtn.style.display = state.useEligibility ? "" : "none";
  const monthlySalary = document.getElementById("monthly-salary");
  if (monthlySalary) monthlySalary.value = state.monthlySalary ?? "";
  const accountBalance = document.getElementById("account-balance");
  if (accountBalance) accountBalance.value = state.accountBalance ?? "";
}

/* ── BOOT ── */
init().then(() => {
  renderNavCityTabs();
  updateCityChip();
}).catch((error) => {
  console.error(error);
  const grid = document.getElementById("results-grid");
  if (grid) grid.innerHTML = `
    <div style="padding:40px 20px;text-align:center;background:var(--surface);border-radius:var(--r);border:1px solid var(--line);">
      <div style="font-weight:800;font-size:18px;color:var(--ink);margin-bottom:8px">Could not load app data</div>
      <div style="font-size:13px;color:var(--muted)">Check that data/offers.json exists and is being served over HTTP.</div>
    </div>
  `;
});
