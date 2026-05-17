// @ts-check
/* ── STATE + CONSTANTS + UTIL HELPERS ── moved to assets/state.js */



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

  // Order matters: defaults (from state.js) → localStorage → URL.
  // URL takes the last word so shared links keep working.
  restoreStateFromLocal();
  restoreStateFromUrl();
  bindEvents();
  syncDomToState();
  renderDataFreshness();
  render();
}

/* ── DATA FRESHNESS ──
   The offers payload carries a single dataset-level generatedAt timestamp
   (no per-offer timestamps in the schema today). We surface this in two
   places: a calm "verified Xd ago" line in the footer, and a stale-data
   banner at the top if the data is more than 60 days old. */
function getDataFreshnessDaysAgo() {
  const ts = state.data?.generatedAt;
  if (!ts) return null;
  const then = new Date(ts);
  if (Number.isNaN(then.getTime())) return null;
  const days = Math.floor((Date.now() - then.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
}

function formatDaysAgo(d) {
  if (d === null || d === undefined) return "";
  if (d === 0) return "today";
  if (d === 1) return "1 day ago";
  if (d < 30) return `${d} days ago`;
  if (d < 60) return `~${Math.round(d / 7)} weeks ago`;
  return `~${Math.round(d / 30)} months ago`;
}

function buildReportMailto(bank, card) {
  const subject = `Offer correction: ${bank || ""} — ${card || ""}`.trim();
  const body = [
    `Bank: ${bank || ""}`,
    `Card: ${card || ""}`,
    `URL: ${typeof location !== "undefined" ? location.href : ""}`,
    "",
    "What's incorrect about this card or its offers? (e.g., discount %, cap, days, eligibility):",
    "",
  ].join("\n");
  return `mailto:hello@konsacard.pk?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function renderDataFreshness() {
  const days = getDataFreshnessDaysAgo();
  if (days === null) return;
  const label = formatDaysAgo(days);
  const footer = document.getElementById("footer-freshness");
  if (footer) footer.textContent = ` Data last verified ${label}.`;
  const banner = document.getElementById("stale-banner");
  if (banner) {
    if (days > 60) {
      banner.classList.remove("hidden");
      banner.innerHTML = `
        <span class="stale-banner-icon">⏳</span>
        <span>Our offers data was last verified <strong>${escapeHtml(label)}</strong>. Some deals may have changed — always confirm with your bank.</span>
      `;
    } else {
      banner.classList.add("hidden");
      banner.innerHTML = "";
    }
  }
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

/* ── QUIZ + LANDING + ONBOARDING ── moved to assets/quiz.js */



/* ══════════════════════════════════════════════════════
   CHAT — Gemini 2.5 Flash with streaming (via /api/chat proxy)
   ══════════════════════════════════════════════════════ */

/* ── CHAT PANEL + AI TOOLS ── moved to assets/chat.js */



/* ── COMPUTE RECOMMENDATIONS ── moved to assets/algorithms.js */


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
    if (countLabel) countLabel.textContent = "cards in wallet";
    if (rhSub) rhSub.textContent = "Add the cards you carry to find the best next one";
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

/* ── NEXT CARD RECOMMENDATIONS ── moved to assets/algorithms.js */


/* ── BUILD WALLET RECOMMENDATIONS ──
   Moved to assets/algorithms.js — loaded before this file via <script> in
   index.html. The functions (precomputeCardSavingsByVenueDay, marginalForCard,
   applyCardToCurrentBest, summarizeWallet, annualFeeForCard,
   computeWalletRecommendations) are accessible globally by name. */


/* ── ELIGIBILITY MATH ── moved to assets/algorithms.js (renderEligibilityBadge/Meta remain below) */



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

      <div class="cd-report">
        <span class="cd-report-l">See something wrong?</span>
        <a class="cd-report-link" href="${escapeAttr(buildReportMailto(bank, card))}">Report this card →</a>
        <span class="cd-report-fresh">${escapeHtml(getDataFreshnessDaysAgo() !== null ? `Data verified ${formatDaysAgo(getDataFreshnessDaysAgo())}` : "")}</span>
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

/* ── CHAT CHIPS ── moved to assets/chat.js */


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
  // Mirror to localStorage so settings survive across sessions (URL params
  // already cover shared-link state; this layer covers returning users).
  saveStateToLocal();
}

/* ── LOCAL PERSISTENCE ──
   Stores wallet + filter + eligibility state in localStorage so a returning
   user finds the app as they left it. URL params still take precedence on
   init, so shared links keep working. No expiry: localStorage persists until
   the user explicitly clears browser data. Search terms, chat messages, and
   pagination state are intentionally not persisted (they're transient). */
const LS_KEY = "konsacard_state_v1";
function saveStateToLocal() {
  try {
    const payload = {
      v: 1,
      selectedCity: state.selectedCity,
      orderValue: state.orderValue,
      outingsPerWeek: state.outingsPerWeek,
      selectedDays: Array.from(state.selectedDays),
      selectedCardTypes: Array.from(state.selectedCardTypes),
      selectedBanks: Array.from(state.selectedBanks),
      selectedRestaurants: Array.from(state.selectedRestaurants),
      selectedCards: Array.from(state.selectedCards),
      useEligibility: state.useEligibility,
      monthlySalary: state.monthlySalary,
      accountBalance: state.accountBalance,
      viewMode: state.viewMode,
      ownedCards: Array.from(state.ownedCards),
      walletSize: state.walletSize,
      walletBuildOnOwned: state.walletBuildOnOwned,
      walletMaxFee: state.walletMaxFee,
      walletNoSameBank: state.walletNoSameBank,
      walletMixedTypes: state.walletMixedTypes,
      walletObjective: state.walletObjective,
      walletMustInclude: Array.from(state.walletMustInclude),
      walletAdvancedOpen: state.walletAdvancedOpen,
    };
    localStorage.setItem(LS_KEY, JSON.stringify(payload));
  } catch (_) { /* quota or disabled — silently skip */ }
}

function restoreStateFromLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const p = JSON.parse(raw);
    if (!p || p.v !== 1) return;
    if (typeof p.selectedCity === "string") state.selectedCity = p.selectedCity;
    if (Number.isFinite(p.orderValue)) state.orderValue = p.orderValue;
    if (Number.isFinite(p.outingsPerWeek)) state.outingsPerWeek = Math.max(1, Math.min(4, p.outingsPerWeek));
    if (Array.isArray(p.selectedDays)) state.selectedDays = new Set(p.selectedDays.filter((n) => n >= 0 && n <= 6));
    if (Array.isArray(p.selectedCardTypes)) state.selectedCardTypes = new Set(p.selectedCardTypes.filter(Boolean));
    if (Array.isArray(p.selectedBanks)) state.selectedBanks = new Set(p.selectedBanks.filter(Boolean));
    if (Array.isArray(p.selectedRestaurants)) state.selectedRestaurants = new Set(p.selectedRestaurants.filter(Boolean));
    if (Array.isArray(p.selectedCards)) state.selectedCards = new Set(p.selectedCards.filter(Boolean));
    if (typeof p.useEligibility === "boolean") state.useEligibility = p.useEligibility;
    if (p.monthlySalary === null || Number.isFinite(p.monthlySalary)) state.monthlySalary = p.monthlySalary;
    if (p.accountBalance === null || Number.isFinite(p.accountBalance)) state.accountBalance = p.accountBalance;
    if (typeof p.viewMode === "string" && ["cards", "restaurants", "my-wallet", "wallet"].includes(p.viewMode)) state.viewMode = p.viewMode;
    if (Array.isArray(p.ownedCards)) state.ownedCards = new Set(p.ownedCards.filter(Boolean));
    if (Number.isFinite(p.walletSize) && p.walletSize >= 2 && p.walletSize <= 4) state.walletSize = p.walletSize;
    if (typeof p.walletBuildOnOwned === "boolean") state.walletBuildOnOwned = p.walletBuildOnOwned;
    if (p.walletMaxFee === null || Number.isFinite(p.walletMaxFee)) state.walletMaxFee = p.walletMaxFee;
    if (typeof p.walletNoSameBank === "boolean") state.walletNoSameBank = p.walletNoSameBank;
    if (typeof p.walletMixedTypes === "boolean") state.walletMixedTypes = p.walletMixedTypes;
    if (typeof p.walletObjective === "string" && ["savings", "coverage", "roi"].includes(p.walletObjective)) state.walletObjective = p.walletObjective;
    if (Array.isArray(p.walletMustInclude)) state.walletMustInclude = new Set(p.walletMustInclude.filter(Boolean));
    if (typeof p.walletAdvancedOpen === "boolean") state.walletAdvancedOpen = p.walletAdvancedOpen;
  } catch (_) { /* corrupted payload — ignore */ }
}

function clearLocalState() {
  try { localStorage.removeItem(LS_KEY); } catch (_) {}
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
