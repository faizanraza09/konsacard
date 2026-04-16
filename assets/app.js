const state = {
  data: null,
  requirements: null,
  selectedCities: new Set(),
  selectedDays: new Set(),
  selectedRestaurants: new Set(),
  selectedBanks: new Set(),
  selectedCardTypes: new Set(),
  bankSearchTerm: "",
  orderValue: 10000,
  searchTerm: "",
  useEligibility: false,
  monthlySalary: null,
  accountBalance: null,
};

const elements = {
  filtersShell: document.getElementById("filters-shell"),
  filtersToggle: document.querySelector(".filters-toggle"),
  mobileFiltersApplied: document.getElementById("mobile-filters-applied"),
  cityPills: document.getElementById("city-pills"),
  dayPills: document.getElementById("day-pills"),
  cardTypePills: document.getElementById("card-type-pills"),
  citiesSummary: document.getElementById("cities-summary"),
  restaurantsSummary: document.getElementById("restaurants-summary"),
  daysSummary: document.getElementById("days-summary"),
  billSummary: document.getElementById("bill-summary"),
  banksSummary: document.getElementById("banks-summary"),
  cardTypesSummary: document.getElementById("card-types-summary"),
  eligibilitySummary: document.getElementById("eligibility-summary"),
  bankSearch: document.getElementById("bank-search"),
  bankResults: document.getElementById("bank-results"),
  selectedBanks: document.getElementById("selected-banks"),
  clearCities: document.getElementById("clear-cities"),
  clearDays: document.getElementById("clear-days"),
  clearCardTypes: document.getElementById("clear-card-types"),
  clearEligibility: document.getElementById("clear-eligibility"),
  restaurantSearch: document.getElementById("restaurant-search"),
  restaurantResults: document.getElementById("restaurant-results"),
  selectedRestaurants: document.getElementById("selected-restaurants"),
  clearBanks: document.getElementById("clear-banks"),
  orderValue: document.getElementById("order-value"),
  orderValueLabel: document.getElementById("order-value-label"),
  useEligibility: document.getElementById("use-eligibility"),
  monthlySalary: document.getElementById("monthly-salary"),
  accountBalance: document.getElementById("account-balance"),
  resetFilters: document.getElementById("reset-filters"),
  clearRestaurants: document.getElementById("clear-restaurants"),
  mobileHeaderResetFilters: document.getElementById("mobile-header-reset-filters"),
  mobileApplyFilters: document.getElementById("mobile-apply-filters"),
  mobileResetFilters: document.getElementById("mobile-reset-filters"),
  resultsGrid: document.getElementById("results-grid"),
  topPick: document.getElementById("top-pick"),
  emptyState: document.getElementById("empty-state"),
  emptyStateTitle: document.getElementById("empty-state-title"),
  emptyStateMessage: document.getElementById("empty-state-message"),
  resultCount: document.getElementById("result-count"),
  summaryBrands: document.getElementById("summary-brands"),
  summaryCities: document.getElementById("summary-cities"),
  summaryDays: document.getElementById("summary-days"),
  summaryBest: document.getElementById("summary-best"),
  statOffers: document.getElementById("stat-offers"),
  statCards: document.getElementById("stat-cards"),
  statRestaurants: document.getElementById("stat-restaurants"),
};

const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const COLLAPSIBLE_FILTER_BREAKPOINT = 720;

const CARD_TYPE_OPTIONS = [
  { value: "debit", label: "Debit" },
  { value: "credit", label: "Credit" },
  { value: "other", label: "Other" },
];

async function init() {
  const [payload, requirements] = await Promise.all([
    fetchJson("./data/offers.json"),
    loadRequirementsContext(),
  ]);
  state.data = payload;
  state.requirements = requirements;
  state.selectedCities = new Set();
  state.selectedDays = new Set();
  state.selectedBanks = new Set();
  state.selectedCardTypes = new Set();
  elements.orderValue.value = String(state.orderValue);
  if (elements.useEligibility) {
    elements.useEligibility.checked = false;
  }
  if (elements.monthlySalary) {
    elements.monthlySalary.value = "";
  }
  if (elements.accountBalance) {
    elements.accountBalance.value = "";
  }

  elements.statOffers.textContent = formatNumber(payload.stats.offers);
  elements.statCards.textContent = formatNumber(payload.stats.cards);
  elements.statRestaurants.textContent = formatNumber(payload.stats.restaurants);

  bindEvents();
  syncFiltersShellForViewport();
  render();
}

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }
  return response.json();
}

async function loadRequirementsContext() {
  try {
    const [requirementsPayload, mappingPayload] = await Promise.all([
      fetchJson("./data/card-requirements/normalized/card_requirements.json"),
      fetchJson("./data/card-requirements/normalized/deal_requirement_card_map.json"),
    ]);

    return {
      available: true,
      byCardId: new Map(requirementsPayload.map((row) => [row.card_id, row])),
      mappingByDealKey: new Map(
        mappingPayload.map((row) => [
          buildDealCardKey(row.deal_bank_name, row.deal_card_name),
          row,
        ]),
      ),
    };
  } catch (error) {
    console.warn("Requirements data could not be loaded.", error);
    return {
      available: false,
      byCardId: new Map(),
      mappingByDealKey: new Map(),
    };
  }
}

function bindEvents() {
  window.addEventListener("resize", syncFiltersShellForViewport);
  elements.filtersShell?.addEventListener("toggle", syncFiltersShellForViewport);
  bindDetailsSummaryTouchGuard(elements.filtersToggle);
  bindMobileFilterActions();
  bindTooltipActions();

  elements.clearCities.addEventListener("click", () => {
    state.selectedCities = new Set();
    render();
  });

  elements.clearDays.addEventListener("click", () => {
    state.selectedDays = new Set();
    render();
  });

  elements.clearBanks.addEventListener("click", () => {
    state.selectedBanks = new Set();
    state.bankSearchTerm = "";
    elements.bankSearch.value = "";
    render();
  });

  elements.clearCardTypes.addEventListener("click", () => {
    state.selectedCardTypes = new Set();
    render();
  });

  elements.bankSearch.addEventListener("input", (event) => {
    state.bankSearchTerm = event.target.value.trim();
    renderBankSearch();
  });

  elements.orderValue.addEventListener("input", (event) => {
    state.orderValue = Number(event.target.value);
    render();
  });

  if (elements.useEligibility) {
    elements.useEligibility.addEventListener("change", (event) => {
      state.useEligibility = event.target.checked;
      render();
    });
  }

  if (elements.monthlySalary) {
    elements.monthlySalary.addEventListener("input", (event) => {
      state.monthlySalary = parseOptionalNumber(event.target.value);
      render();
    });
  }

  if (elements.accountBalance) {
    elements.accountBalance.addEventListener("input", (event) => {
      state.accountBalance = parseOptionalNumber(event.target.value);
      render();
    });
  }

  elements.restaurantSearch.addEventListener("input", (event) => {
    state.searchTerm = event.target.value.trim();
    renderRestaurantSearch();
  });

  elements.resetFilters.addEventListener("click", () => {
    resetFilters();
  });

  elements.clearRestaurants.addEventListener("click", () => {
    state.selectedRestaurants = new Set();
    state.searchTerm = "";
    elements.restaurantSearch.value = "";
    render();
  });

  elements.clearEligibility?.addEventListener("click", () => {
    state.useEligibility = false;
    state.monthlySalary = null;
    state.accountBalance = null;
    if (elements.useEligibility) {
      elements.useEligibility.checked = false;
    }
    if (elements.monthlySalary) {
      elements.monthlySalary.value = "";
    }
    if (elements.accountBalance) {
      elements.accountBalance.value = "";
    }
    render();
  });
}

function bindMobileFilterActions() {
  if (elements.mobileApplyFilters) {
    elements.mobileApplyFilters.addEventListener("click", () => {
      if (window.innerWidth <= COLLAPSIBLE_FILTER_BREAKPOINT && elements.filtersShell) {
        elements.filtersShell.open = false;
        syncFiltersShellForViewport();
      }
    });
  }

  if (elements.mobileResetFilters) {
    elements.mobileResetFilters.addEventListener("click", resetFilters);
  }

  if (elements.mobileHeaderResetFilters) {
    elements.mobileHeaderResetFilters.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      resetFilters();
    });
  }
}

function bindTooltipActions() {
  document.addEventListener("click", (event) => {
    const infoDot = event.target.closest(".info-dot");
    const allTooltips = Array.from(document.querySelectorAll(".tooltip-card"));

    if (!infoDot) {
      allTooltips.forEach((tooltip) => {
        tooltip.style.cssText = "";
      });
      return;
    }

    event.stopPropagation();
    const tooltipWrap = infoDot.closest(".tooltip-wrap");
    const tooltip = tooltipWrap?.querySelector(".tooltip-card");
    const isVisible = tooltip?.style.opacity === "1";

    allTooltips.forEach((card) => {
      card.style.cssText = "";
    });

    if (tooltip && !isVisible) {
      tooltip.style.opacity = "1";
      tooltip.style.pointerEvents = "auto";
      tooltip.style.transform = "translateY(0)";
    }
  });
}

function resetFilters() {
  state.selectedCities = new Set();
  state.selectedDays = new Set();
  state.selectedRestaurants = new Set();
  state.selectedBanks = new Set();
  state.selectedCardTypes = new Set();
  state.bankSearchTerm = "";
  state.searchTerm = "";
  state.orderValue = 10000;
  state.useEligibility = false;
  state.monthlySalary = null;
  state.accountBalance = null;
  elements.bankSearch.value = "";
  elements.orderValue.value = String(state.orderValue);
  elements.restaurantSearch.value = "";
  if (elements.useEligibility) {
    elements.useEligibility.checked = false;
  }
  if (elements.monthlySalary) {
    elements.monthlySalary.value = "";
  }
  if (elements.accountBalance) {
    elements.accountBalance.value = "";
  }
  render();
}

function render() {
  pruneRestaurants();
  elements.orderValueLabel.textContent = formatCurrency(state.orderValue);
  renderCityPills();
  renderBankSearch();
  renderSelectedBanks();
  renderDayPills();
  renderCardTypePills();
  renderSelectedRestaurants();
  renderRestaurantSearch();
  renderFilterSummaries();
  renderSummary();
  renderRecommendations();
}

function renderFilterSummaries() {
  if (elements.citiesSummary) {
    elements.citiesSummary.textContent = state.selectedCities.size
      ? `${state.selectedCities.size} selected`
      : "All cities";
  }

  if (elements.restaurantsSummary) {
    elements.restaurantsSummary.textContent = state.selectedRestaurants.size
      ? `${state.selectedRestaurants.size} selected`
      : "All restaurants";
  }

  if (elements.daysSummary) {
    elements.daysSummary.textContent = state.selectedDays.size
      ? Array.from(state.selectedDays)
          .sort((a, b) => a - b)
          .map((day) => DAY_SHORT[day])
          .join(", ")
      : "All days";
  }

  if (elements.billSummary) {
    elements.billSummary.textContent = formatCurrency(state.orderValue);
  }

  if (elements.banksSummary) {
    elements.banksSummary.textContent = state.selectedBanks.size
      ? `${state.selectedBanks.size} selected`
      : "All banks";
  }

  if (elements.cardTypesSummary) {
    elements.cardTypesSummary.textContent = state.selectedCardTypes.size
      ? Array.from(state.selectedCardTypes)
          .map((type) => CARD_TYPE_OPTIONS.find((option) => option.value === type)?.label || type)
          .join(", ")
      : "All card types";
  }

  if (elements.eligibilitySummary) {
    const parts = [];
    if (state.useEligibility) {
      parts.push("On");
    }
    if (state.monthlySalary !== null) {
      parts.push("salary");
    }
    if (state.accountBalance !== null) {
      parts.push("balance");
    }
    elements.eligibilitySummary.textContent = parts.length ? parts.join(" · ") : "Off";
  }

  if (elements.mobileFiltersApplied) {
    const applied = [];
    if (state.selectedCities.size > 0) {
      applied.push(`${state.selectedCities.size} city${state.selectedCities.size === 1 ? "" : "ies"}`);
    }
    if (state.selectedRestaurants.size > 0) {
      applied.push(`${state.selectedRestaurants.size} restaurant${state.selectedRestaurants.size === 1 ? "" : "s"}`);
    }
    if (state.selectedDays.size > 0) {
      applied.push(Array.from(state.selectedDays).sort((a, b) => a - b).map((day) => DAY_SHORT[day]).join(", "));
    }
    if (state.selectedBanks.size > 0) {
      applied.push(`${state.selectedBanks.size} bank${state.selectedBanks.size === 1 ? "" : "s"}`);
    }
    if (state.selectedCardTypes.size > 0) {
      applied.push(
        Array.from(state.selectedCardTypes)
          .map((type) => CARD_TYPE_OPTIONS.find((option) => option.value === type)?.label || type)
          .join(", "),
      );
    }
    if (state.orderValue !== 10000) {
      applied.push(formatCurrency(state.orderValue));
    }
    if (state.useEligibility || state.monthlySalary !== null || state.accountBalance !== null) {
      applied.push("eligibility");
    }

    elements.mobileFiltersApplied.innerHTML = applied
      .slice(0, 3)
      .map((label) => `<span class="mobile-filter-chip">${escapeHtml(label)}</span>`)
      .join("");
  }
}

function getAvailableBanks() {
  const bankCounts = new Map();
  state.data.offers.forEach((offer) => {
    if (!cityMatches(offer.city)) {
      return;
    }
    if (!cardTypeMatches(offer.cardCategory)) {
      return;
    }
    bankCounts.set(offer.bank, (bankCounts.get(offer.bank) || 0) + 1);
  });
  return Array.from(bankCounts.keys()).sort((a, b) => a.localeCompare(b));
}

function renderBankSearch() {
  const banks = getAvailableBanks();
  state.selectedBanks.forEach((bank) => {
    if (!banks.includes(bank)) {
      state.selectedBanks.delete(bank);
    }
  });
  const term = state.bankSearchTerm.toLowerCase();
  const results = banks
    .filter((bank) => !state.selectedBanks.has(bank))
    .filter((bank) => !term || bank.toLowerCase().includes(term))
    .slice(0, 10);

  elements.bankResults.innerHTML = "";
  results.forEach((bank) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "search-item";
    button.innerHTML = `
      <div>
        <strong class="search-title">${escapeHtml(bank)}</strong>
      </div>
      <span class="search-action">Add</span>
    `;
    button.addEventListener("click", () => {
      state.selectedBanks.add(bank);
      state.bankSearchTerm = "";
      elements.bankSearch.value = "";
      render();
    });
    elements.bankResults.appendChild(button);
  });
}

function renderSelectedBanks() {
  elements.selectedBanks.innerHTML = "";
  Array.from(state.selectedBanks)
    .sort((a, b) => a.localeCompare(b))
    .forEach((bank) => {
      const chip = document.createElement("div");
      chip.className = "selected-chip";
      chip.innerHTML = `<span>${escapeHtml(bank)}</span>`;

      const close = document.createElement("button");
      close.type = "button";
      close.setAttribute("aria-label", `Remove ${bank}`);
      close.textContent = "x";
      close.addEventListener("click", () => {
        state.selectedBanks.delete(bank);
        render();
      });
      chip.appendChild(close);
      elements.selectedBanks.appendChild(chip);
    });
}

function renderCityPills() {
  elements.cityPills.innerHTML = "";
  state.data.cities.forEach((city) => {
    const button = buildPill(city, state.selectedCities.has(city), () => {
      if (state.selectedCities.has(city)) {
        state.selectedCities.delete(city);
      } else {
        state.selectedCities.add(city);
      }
      render();
    });
    elements.cityPills.appendChild(button);
  });
}

function renderDayPills() {
  elements.dayPills.innerHTML = "";
  state.data.dayNames.forEach((dayName, index) => {
    const button = buildPill(DAY_SHORT[index], state.selectedDays.has(index), () => {
      if (state.selectedDays.has(index)) {
        state.selectedDays.delete(index);
      } else {
        state.selectedDays.add(index);
      }
      render();
    });
    button.title = dayName;
    elements.dayPills.appendChild(button);
  });
}

function renderCardTypePills() {
  elements.cardTypePills.innerHTML = "";
  CARD_TYPE_OPTIONS.forEach(({ value, label }) => {
    const button = buildPill(label, state.selectedCardTypes.has(value), () => {
      if (state.selectedCardTypes.has(value)) {
        state.selectedCardTypes.delete(value);
      } else {
        state.selectedCardTypes.add(value);
      }
      render();
    });
    elements.cardTypePills.appendChild(button);
  });
}

function buildPill(label, active, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `pill${active ? " active" : ""}`;
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function getAvailableRestaurants() {
  const names = new Set();
  state.data.offers.forEach((offer) => {
    if (!cityMatches(offer.city)) {
      return;
    }
    if (!cardTypeMatches(offer.cardCategory)) {
      return;
    }
    if (state.selectedBanks.size > 0 && !state.selectedBanks.has(offer.bank)) {
      return;
    }
    names.add(offer.restaurant);
  });
  return Array.from(names).sort((a, b) => a.localeCompare(b));
}

function pruneRestaurants() {
  const available = new Set(getAvailableRestaurants());
  state.selectedRestaurants.forEach((name) => {
    if (!available.has(name)) {
      state.selectedRestaurants.delete(name);
    }
  });
}

function renderSelectedRestaurants() {
  elements.selectedRestaurants.innerHTML = "";
  Array.from(state.selectedRestaurants)
    .sort((a, b) => a.localeCompare(b))
    .forEach((restaurant) => {
      const chip = document.createElement("div");
      chip.className = "selected-chip";
      chip.innerHTML = `<span>${escapeHtml(restaurant)}</span>`;

      const close = document.createElement("button");
      close.type = "button";
      close.setAttribute("aria-label", `Remove ${restaurant}`);
      close.textContent = "x";
      close.addEventListener("click", () => {
        state.selectedRestaurants.delete(restaurant);
        render();
      });
      chip.appendChild(close);
      elements.selectedRestaurants.appendChild(chip);
    });
}

function renderRestaurantSearch() {
  const available = getAvailableRestaurants();
  const term = state.searchTerm.toLowerCase();
  const results = available
    .filter((restaurant) => !state.selectedRestaurants.has(restaurant))
    .filter((restaurant) => !term || restaurant.toLowerCase().includes(term))
    .slice(0, 14);

  elements.restaurantResults.innerHTML = "";
  results.forEach((restaurant) => {
    const cities = Array.from(state.selectedCities).filter((city) =>
      (state.data.restaurantsByCity[city] || []).includes(restaurant),
    );
    const button = document.createElement("button");
    button.type = "button";
    button.className = "search-item";
    button.innerHTML = `
      <div>
        <strong class="search-title">${escapeHtml(restaurant)}</strong>
        <span class="search-meta">${escapeHtml(cities.join(", "))}</span>
      </div>
      <span class="search-action">Add</span>
    `;
    button.addEventListener("click", () => {
      state.selectedRestaurants.add(restaurant);
      state.searchTerm = "";
      elements.restaurantSearch.value = "";
      render();
    });
    elements.restaurantResults.appendChild(button);
  });
}

function renderSummary() {
  if (
    !elements.summaryCities ||
    !elements.summaryDays ||
    !elements.summaryBrands ||
    !elements.summaryBest
  ) {
    return;
  }
  const cityCount = getEffectiveCityCount();
  const dayCount = getEffectiveDayCount();
  elements.summaryCities.textContent =
    state.selectedCities.size > 0
      ? `${cityCount} ${cityCount === 1 ? "city" : "cities"}`
      : "All cities";
  elements.summaryDays.textContent =
    state.selectedDays.size > 0
      ? `${dayCount} ${dayCount === 1 ? "day" : "days"}`
      : "All days";
  elements.summaryBrands.textContent =
    state.selectedBanks.size > 0
      ? `${state.selectedBanks.size} ${state.selectedBanks.size === 1 ? "bank" : "banks"}`
      : "All banks";

  const summaryBanksItem = elements.summaryBrands.closest(".summary-item");
  const summaryDaysItem = elements.summaryDays.closest(".summary-item");
  summaryBanksItem?.classList.toggle("is-empty-mobile", state.selectedBanks.size === 0);
  summaryDaysItem?.classList.toggle("is-empty-mobile", state.selectedDays.size === 0);
}

function renderRecommendations() {
  const results = computeRecommendations();

  elements.resultCount.textContent = `${results.length} ${results.length === 1 ? "card" : "cards"}`;

  if (results.length === 0) {
    setEmptyStateCopy();
    elements.emptyState.classList.remove("hidden");
    elements.topPick.classList.add("hidden");
    elements.resultsGrid.innerHTML = "";
    if (elements.summaryBest) {
      elements.summaryBest.textContent = "-";
    }
    return;
  }

  elements.emptyState.classList.add("hidden");
  if (elements.summaryBest) {
    elements.summaryBest.textContent = `${formatCurrency(results[0].avgExpectedSaving)} / outing`;
  }
  renderTopPick(results[0]);
  renderResultCards(results.slice(0, 10));
}

function bindDetailsSummaryTouchGuard(target) {
  if (!target) {
    return;
  }

  let touchStartY = 0;
  let touchStartX = 0;
  let moved = false;

  target.addEventListener(
    "touchstart",
    (event) => {
      const touch = event.touches[0];
      if (!touch) {
        return;
      }
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      moved = false;
    },
    { passive: true },
  );

  target.addEventListener(
    "touchmove",
    (event) => {
      const touch = event.touches[0];
      if (!touch) {
        return;
      }
      if (
        Math.abs(touch.clientY - touchStartY) > 8 ||
        Math.abs(touch.clientX - touchStartX) > 8
      ) {
        moved = true;
      }
    },
    { passive: true },
  );

  target.addEventListener("click", (event) => {
    if (moved) {
      event.preventDefault();
      moved = false;
    }
  });
}

function computeRecommendations() {
  const desiredOffers = state.data.offers.filter((offer) => {
    if (!cityMatches(offer.city)) {
      return false;
    }
    if (state.selectedBanks.size > 0 && !state.selectedBanks.has(offer.bank)) {
      return false;
    }
    if (!cardTypeMatches(offer.cardCategory)) {
      return false;
    }
    if (state.selectedRestaurants.size > 0 && !state.selectedRestaurants.has(offer.restaurant)) {
      return false;
    }
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
  if (!totalVenueCount) {
    return [];
  }

  const selectedDays = getEffectiveSelectedDays();
  const totalSelectedDays = selectedDays.size;
  const cardMap = new Map();

  desiredOffers.forEach((offer) => {
    const offerSaving = getOfferSavingValue(offer, state.orderValue);
    if (!Number.isFinite(offerSaving) || offerSaving <= 0) {
      return;
    }

    const venueKey = `${offer.city} || ${offer.restaurant}`;
    const cardKey = `${offer.bank} || ${offer.card}`;

    if (!cardMap.has(cardKey)) {
      cardMap.set(cardKey, {
        bank: offer.bank,
        card: offer.card,
        venueDailyBest: new Map(),
      });
    }

    const cardRecord = cardMap.get(cardKey);
    if (!cardRecord.venueDailyBest.has(venueKey)) {
      cardRecord.venueDailyBest.set(venueKey, new Map());
    }

    const dayMap = cardRecord.venueDailyBest.get(venueKey);
    selectedDays.forEach((day) => {
      if (!offer.days.includes(day)) {
        return;
      }
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
        if (!dayMap.size) {
          return null;
        }

        const bestByDay = Array.from(dayMap.entries()).sort((a, b) => a[0] - b[0]);
        const totalExpectedSaving = bestByDay.reduce((sum, [, match]) => sum + match.saving, 0);
        const coveredDayCount = bestByDay.length;
        const expectedSaving = totalExpectedSaving / totalSelectedDays;
        const dayFit = coveredDayCount / totalSelectedDays;
        const strongestMatch = bestByDay.reduce((best, [, match]) => (
          !best || match.saving > best.saving ? match : best
        ), null);
        const averageDiscount = average(
          bestByDay
            .map(([, match]) => match.discountPct)
            .filter((value) => Number.isFinite(value)),
        );
        const caps = bestByDay
          .map(([, match]) => match.capPkr ?? match.fixedDiscountPkr)
          .filter((value) => Number.isFinite(value));

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
      matches.map((match) => match.discountPct).filter((value) => Number.isFinite(value)),
    );
    const caps = matches
      .map((match) => match.capPkr ?? match.fixedDiscountPkr)
      .filter((value) => Number.isFinite(value));
    const medianCap = caps.length ? median(caps) : null;
    const topMatches = matches
      .sort((a, b) => b.expectedSaving - a.expectedSaving)
      .slice(0, 3);

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
      ((item.avgExpectedSaving / bestExpected) * 70) + item.coverage * 20 + item.avgDayFit * 10;
  });

  const visibleAggregates = state.useEligibility
    ? aggregates.filter((item) => item.requirementStatus.status !== "ineligible")
    : aggregates;

  return visibleAggregates.sort((a, b) => {
    if (state.useEligibility && b.requirementStatus.sortRank !== a.requirementStatus.sortRank) {
      return b.requirementStatus.sortRank - a.requirementStatus.sortRank;
    }
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    if (b.avgExpectedSaving !== a.avgExpectedSaving) {
      return b.avgExpectedSaving - a.avgExpectedSaving;
    }
    return b.coverage - a.coverage;
  });
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

  if (fixedDiscountPkr !== null && fixedDiscountPkr > 0) {
    return fixedDiscountPkr;
  }

  return null;
}

function setEmptyStateCopy() {
  if (!elements.emptyStateTitle || !elements.emptyStateMessage) {
    return;
  }

  if (state.useEligibility) {
    elements.emptyStateTitle.textContent = "No cards passed your current eligibility filter";
    elements.emptyStateMessage.textContent =
      "Try turning off eligibility mode, increasing your salary or balance inputs, or broadening your city, bank, or restaurant filters.";
    return;
  }

  elements.emptyStateTitle.textContent = "No matching offers";
  elements.emptyStateMessage.textContent =
    "Try adding another city, loosening the restaurant list, or choosing more days.";
}

function isEligibilityContextActive() {
  return state.useEligibility || state.monthlySalary !== null || state.accountBalance !== null;
}

function evaluateEligibility(bank, card) {
  if (!state.requirements?.available) {
    return {
      status: "unavailable",
      label: "Requirements unavailable",
      tone: "unclear",
      sortRank: 1,
      detail: "Requirements data could not be loaded in this session.",
      criteria: [],
      annualFeePkr: null,
      annualFeeWaiverRule: null,
    };
  }

  const mapping = state.requirements.mappingByDealKey.get(buildDealCardKey(bank, card));
  if (!mapping?.matched || !mapping.requirement_card_id) {
    return {
      status: "unclear",
      label: "Requirements unclear",
      tone: "unclear",
      sortRank: 1,
      detail: "This deal-side card is not yet mapped to a verified requirements record.",
      criteria: [],
      annualFeePkr: null,
      annualFeeWaiverRule: null,
    };
  }

  const record = state.requirements.byCardId.get(mapping.requirement_card_id);
  if (!record) {
    return {
      status: "unclear",
      label: "Requirements unclear",
      tone: "unclear",
      sortRank: 1,
      detail: "A mapped requirements record could not be loaded.",
      criteria: [],
      annualFeePkr: null,
      annualFeeWaiverRule: null,
    };
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
    criteria.push(`Salary at least ${formatCurrency(salaryReq)} / month`);
    if (state.monthlySalary === null) {
      missingInput = true;
    } else if (state.monthlySalary < salaryReq) {
      blockers.push(`Needs salary of at least ${formatCurrency(salaryReq)} / month`);
    }
  }

  if (balanceReq !== null) {
    criteria.push(`Balance at least ${formatCurrency(balanceReq)}`);
    if (state.accountBalance === null) {
      missingInput = true;
    } else if (state.accountBalance < balanceReq) {
      blockers.push(`Needs account balance of at least ${formatCurrency(balanceReq)}`);
    }
  }

  if (annualFeePkr !== null) {
    criteria.push(`Annual fee ${formatCurrency(annualFeePkr)}`);
  }

  if (blockers.length) {
    return {
      status: "ineligible",
      label: "Likely ineligible",
      tone: "ineligible",
      sortRank: 0,
      detail: blockers[0],
      criteria,
      annualFeePkr,
      annualFeeWaiverRule,
    };
  }

  if (salaryReq === null && balanceReq === null) {
    return {
      status: "unclear",
      label: "Requirements unclear",
      tone: "unclear",
      sortRank: 1,
      detail: "No public salary or balance threshold was captured for this card.",
      criteria,
      annualFeePkr,
      annualFeeWaiverRule,
    };
  }

  if (missingInput) {
    return {
      status: "needs_input",
      label: "Add salary/balance to confirm",
      tone: "needs-input",
      sortRank: 2,
      detail: "Public thresholds exist, but you have not filled all the needed inputs yet.",
      criteria,
      annualFeePkr,
      annualFeeWaiverRule,
    };
  }

  return {
    status: "eligible",
    label: "Likely eligible",
    tone: "eligible",
    sortRank: 3,
    detail: "Your salary and balance inputs meet the public thresholds captured for this card.",
    criteria,
    annualFeePkr,
    annualFeeWaiverRule,
  };
}

function buildDealCardKey(bank, card) {
  return `${normalizeDealCardFragment(bank)} || ${normalizeDealCardFragment(card)}`;
}

function normalizeRequirementNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDealCardFragment(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function parseOptionalNumber(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function renderEligibilityBadge(status) {
  return `<span class="status-badge status-badge--${escapeHtml(status.tone)}">${escapeHtml(status.label)}</span>`;
}

function renderEligibilityMeta(status) {
  const bits = [];
  if (status.annualFeePkr !== null) {
    bits.push(`Annual fee ${formatCurrency(status.annualFeePkr)}`);
  }
  if (status.annualFeeWaiverRule) {
    bits.push(status.annualFeeWaiverRule);
  }
  return bits;
}

function renderTopPick(result) {
  const coveragePct = Math.round(result.coverage * 100);
  const daysFitPct = Math.round(result.avgDayFit * 100);
  const filterContext = `${getTopPickCitiesLabel()} - ${getTopPickDaysLabel()}`;
  const eligibilityMeta = renderEligibilityMeta(result.requirementStatus);
  const showEligibility = isEligibilityContextActive();
  const scorePct = Math.max(0, Math.min(100, Number(result.score) || 0));
  elements.topPick.classList.remove("hidden");
  elements.topPick.innerHTML = `
    <article class="pick-card">
      <p class="pick-context">${escapeHtml(filterContext)}</p>
      <div class="pick-header">
        <div class="pick-copy">
          <div class="pick-badge-row">
            <span class="pick-kicker">Top Match</span>
            ${showEligibility ? renderEligibilityBadge(result.requirementStatus) : ""}
          </div>
          <h2>${escapeHtml(result.card)}</h2>
          <p class="pick-bank">${escapeHtml(result.bank)}</p>
          ${
            showEligibility
              ? `<p class="pick-requirement-note">${escapeHtml(result.requirementStatus.detail)}</p>`
              : ""
          }
        </div>
        <div class="score-wrap">
          <div class="score-badge" style="--score-pct: ${scorePct}%;">
            <strong>${formatScore(result.score)}</strong>
          </div>
          <p class="score-hint">
            <span>Fit Score / 100</span>
            <span class="tooltip-wrap">
              <button class="info-dot" type="button" aria-label="Fit score info">i</button>
              <span class="tooltip-card" role="tooltip">
                Fit Score is a blended ranking out of 100 using expected savings, coverage, and day fit.
              </span>
            </span>
          </p>
        </div>
      </div>

      <div class="pick-stats">
        <div class="stat-tile">
          <span>Estimated Saving</span>
          <strong>${formatCurrency(result.avgExpectedSaving)} / outing</strong>
        </div>
        <div class="stat-tile">
          <span>Coverage</span>
          <strong>${result.coveredVenueCount} of ${result.totalVenueCount} restaurants</strong>
        </div>
        <div class="stat-tile">
          <span>Days Fit</span>
          <strong>${Math.round(result.avgDayFit * 100)}%</strong>
        </div>
        <div class="stat-tile">
          <span>Median Cap</span>
          <strong>${result.medianCap !== null ? formatCurrency(result.medianCap) : "No cap listed"}</strong>
        </div>
      </div>

      <details class="pick-more-details">
        <summary>See why this card matches</summary>
        <div class="pick-details">
          <div class="detail-box">
            <h3>Why it ranks first</h3>
            <div class="detail-list">
              <article class="detail-row">
                <strong>${formatCurrency(result.avgExpectedSaving)} expected value</strong>
                <span>Best projected savings per outing after discount and cap effects.</span>
              </article>
              <article class="detail-row">
                <strong>${coveragePct}% venue coverage</strong>
                <span>Works at ${result.coveredVenueCount} of the ${result.totalVenueCount} restaurants that match your filters.</span>
              </article>
              <article class="detail-row">
                <strong>${daysFitPct}% day fit</strong>
                <span>Its offers line up with your selected going-out days more often than the alternatives.</span>
              </article>
              ${
                showEligibility
                  ? `
                    <article class="detail-row">
                      <strong>${escapeHtml(result.requirementStatus.label)}</strong>
                      <span>${escapeHtml(result.requirementStatus.detail)}</span>
                    </article>
                    ${
                      result.requirementStatus.criteria.length
                        ? `
                          <article class="detail-row">
                            <strong>Known public requirements</strong>
                            <span>${escapeHtml(result.requirementStatus.criteria.join(" | "))}</span>
                          </article>
                        `
                        : ""
                    }
                    ${
                      eligibilityMeta.length
                        ? `
                          <article class="detail-row">
                            <strong>Fees and notes</strong>
                            <span>${escapeHtml(eligibilityMeta.join(" | "))}</span>
                          </article>
                        `
                        : ""
                    }
                  `
                  : ""
              }
            </div>
          </div>
          <div class="detail-box">
            <h3>Best matching places</h3>
            <div class="detail-list">
              ${result.topMatches
                .slice(0, 3)
                .map(
                  (match) => `
                    <article class="detail-row">
                      <strong>${escapeHtml(match.restaurant)} <span class="subtle">(${escapeHtml(match.city)})</span></strong>
                      <span>${escapeHtml(match.discountLabel)} | ${escapeHtml(match.daysLabel)}</span>
                    </article>
                  `,
                )
                .join("")}
            </div>
          </div>
        </div>
      </details>
    </article>
  `;
}

function renderResultCards(results) {
  const showEligibility = isEligibilityContextActive();
  elements.resultsGrid.innerHTML = results
    .map((result, index) => {
      const eligibilityMeta = renderEligibilityMeta(result.requirementStatus);
      const topMatches = result.topMatches
        .map(
          (match) => `
            <div class="match-item">
              <div>
                <strong>${escapeHtml(match.restaurant)} <span class="subtle">(${escapeHtml(match.city)})</span></strong>
                <span>${escapeHtml(match.offerTitle || match.discountLabel)} - ${escapeHtml(match.daysLabel)}</span>
              </div>
              <div>
                <strong>${formatCurrency(match.expectedSaving)}</strong>
                <span>${match.capPkr !== null ? `Cap ${formatCurrency(match.capPkr)}` : match.fixedDiscountPkr !== null ? `Fixed ${formatCurrency(match.fixedDiscountPkr)}` : "No cap listed"}</span>
              </div>
            </div>
          `,
        )
        .join("");

      return `
        <article class="result-card">
          <div class="rank-pill">#${index + 1}</div>
          <div class="result-main">
            <div class="result-title-row">
              <div>
                <h3>${escapeHtml(result.card)}</h3>
                <p>${escapeHtml(result.bank)}</p>
                ${
                  showEligibility
                    ? `
                      <div class="result-status-row">
                        ${renderEligibilityBadge(result.requirementStatus)}
                        <span class="result-status-text">${escapeHtml(result.requirementStatus.detail)}</span>
                      </div>
                    `
                    : ""
                }
              </div>
              <div class="result-side mobile-inline">
                <strong>${formatScore(result.score)}</strong>
                <span>Fit Score / 100</span>
              </div>
            </div>
            <div class="result-metrics">
              <span class="metric-chip">${formatCurrency(result.avgExpectedSaving)} expected per outing</span>
              <span class="metric-chip">${result.coveredVenueCount}/${result.totalVenueCount} restaurants covered</span>
              <span class="metric-chip">${Math.round(result.avgDayFit * 100)}% days fit</span>
              <span class="metric-chip">${result.medianCap !== null ? `Median cap: ${formatCurrency(result.medianCap)}` : "No cap listed"}</span>
            </div>
            <details class="result-details">
              <summary>View matching restaurants</summary>
              ${
                showEligibility && (result.requirementStatus.criteria.length || eligibilityMeta.length)
                  ? `
                    <div class="requirements-inline">
                      <strong>${escapeHtml(result.requirementStatus.label)}</strong>
                      ${
                        result.requirementStatus.criteria.length
                          ? `<span>${escapeHtml(result.requirementStatus.criteria.join(" | "))}</span>`
                          : `<span>${escapeHtml(result.requirementStatus.detail)}</span>`
                      }
                      ${
                        eligibilityMeta.length
                          ? `<span>${escapeHtml(eligibilityMeta.join(" | "))}</span>`
                          : ""
                      }
                    </div>
                  `
                  : ""
              }
              <div class="match-list">${topMatches}</div>
            </details>
          </div>
        </article>
      `;
    })
    .join("");
}

function getTopPickCitiesLabel() {
  const cityCount = getEffectiveCityCount();
  return state.selectedCities.size > 0
    ? `${cityCount} ${cityCount === 1 ? "city" : "cities"}`
    : "All cities";
}

function getTopPickDaysLabel() {
  const dayCount = getEffectiveDayCount();
  return state.selectedDays.size > 0
    ? `${dayCount} ${dayCount === 1 ? "day" : "days"}`
    : "All days";
}

function formatCurrency(value) {
  return `PKR ${Math.round(value).toLocaleString("en-US")}`;
}

function formatNumber(value) {
  return Number(value).toLocaleString("en-US");
}

function formatScore(value) {
  return Number(value).toFixed(1);
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function average(values) {
  if (!values.length) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function syncFiltersShellForViewport() {
  if (!elements.filtersShell) {
    return;
  }
  const filterGroups = Array.from(document.querySelectorAll(".filter-group"));
  if (window.innerWidth <= COLLAPSIBLE_FILTER_BREAKPOINT) {
    if (elements.filtersShell.dataset.mobileInitialized !== "true") {
      elements.filtersShell.open = false;
      filterGroups.forEach((group) => {
        group.open = group.dataset.mobileOpen === "true";
      });
      elements.filtersShell.dataset.mobileInitialized = "true";
    }
    elements.filtersShell.dataset.desktopInitialized = "false";
    document.body.classList.toggle("filters-open", elements.filtersShell.open);
  } else {
    if (elements.filtersShell.dataset.desktopInitialized !== "true") {
      elements.filtersShell.open = true;
      elements.filtersShell.dataset.desktopInitialized = "true";
    }
    elements.filtersShell.dataset.mobileInitialized = "false";
    document.body.classList.remove("filters-open");
  }
}

function cityMatches(city) {
  return state.selectedCities.size === 0 || state.selectedCities.has(city);
}

function getOfferDiscountPct(offer) {
  if (Number.isFinite(offer.discountPct)) {
    return Number(offer.discountPct);
  }
  const text = `${offer.discountLabel || ""} ${offer.offerTitle || ""}`;
  const matches = text.match(/(\d+(?:\.\d+)?)\s*%/g) || [];
  if (!matches.length) {
    return null;
  }
  return Math.max(...matches.map((match) => Number.parseFloat(match)));
}

function cardTypeMatches(cardType) {
  const normalized = String(cardType || "other").trim().toLowerCase() || "other";
  return state.selectedCardTypes.size === 0 || state.selectedCardTypes.has(normalized);
}

function getEffectiveSelectedDays() {
  return state.selectedDays.size === 0
    ? new Set(state.data.dayNames.map((_, idx) => idx))
    : state.selectedDays;
}

function getEffectiveCityCount() {
  return state.selectedCities.size === 0 ? state.data.cities.length : state.selectedCities.size;
}

function getEffectiveDayCount() {
  return state.selectedDays.size === 0 ? state.data.dayNames.length : state.selectedDays.size;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

init().catch((error) => {
  console.error(error);
  elements.resultsGrid.innerHTML = `
    <article class="panel">
      <h2>Could not load the app data</h2>
      <p class="helper">Check that <code>data/offers.json</code> exists and is being served over HTTP.</p>
    </article>
  `;
});
