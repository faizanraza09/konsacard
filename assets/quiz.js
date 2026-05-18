// @ts-check
/* ── QUIZ + LANDING + ONBOARDING ──
   Moved out of app.js. Loaded after algorithms.js + chat.js, before app.js.
   Depends on: state, escapeHtml, escapeAttr, render, syncDomToState,
   getAvailableBanks, getAvailableRestaurants, trackEvent, formatCurrency,
   CITY_LABELS, QUIZ_CITY_OPTIONS, QUIZ_CARD_TYPE_OPTIONS, DAY_SHORT,
   OB_STEP_DEFS (defined here). Resolution happens at call time. */

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
