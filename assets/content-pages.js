document.addEventListener("DOMContentLoaded", () => {
  const navToggle = document.getElementById("nav-toggle");
  const mainNav = document.getElementById("main-nav");

  if (navToggle && mainNav) {
    navToggle.addEventListener("click", () => {
      const open = mainNav.classList.toggle("nav-open");
      navToggle.setAttribute("aria-expanded", String(open));
    });

    document.addEventListener("click", (event) => {
      if (!mainNav.classList.contains("nav-open")) return;
      if (mainNav.contains(event.target) || navToggle.contains(event.target)) return;
      mainNav.classList.remove("nav-open");
      navToggle.setAttribute("aria-expanded", "false");
    });

    mainNav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        mainNav.classList.remove("nav-open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  // FAQ accordion
  document.querySelectorAll(".faq-q").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = btn.closest(".faq-item");
      const wasOpen = item.classList.contains("open");
      document.querySelectorAll(".faq-item.open").forEach((el) => el.classList.remove("open"));
      if (!wasOpen) item.classList.add("open");
    });
  });

  // Table pagination
  const PAGE_SIZE = 15;

  function pageRange(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (current <= 4) return [1, 2, 3, 4, 5, "…", total];
    if (current >= total - 3) return [1, "…", total - 4, total - 3, total - 2, total - 1, total];
    return [1, "…", current - 1, current, current + 1, "…", total];
  }

  document.querySelectorAll(".table-wrap").forEach((wrap) => {
    const tbody = wrap.querySelector("tbody");
    if (!tbody) return;
    const rows = Array.from(tbody.querySelectorAll("tr"));
    if (rows.length <= PAGE_SIZE) return;

    const totalPages = Math.ceil(rows.length / PAGE_SIZE);
    let currentPage = 1;

    const controls = document.createElement("div");
    controls.className = "pagination";
    wrap.after(controls);

    function showPage(page) {
      currentPage = page;
      const start = (page - 1) * PAGE_SIZE;
      const end = page * PAGE_SIZE;
      rows.forEach((row, i) => {
        row.style.display = i >= start && i < end ? "" : "none";
      });
      if (page !== 1) {
        wrap.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
      renderControls();
    }

    function renderControls() {
      controls.innerHTML = "";

      const prev = document.createElement("button");
      prev.className = "pg-btn";
      prev.setAttribute("aria-label", "Previous page");
      prev.textContent = "←";
      prev.disabled = currentPage === 1;
      prev.addEventListener("click", () => showPage(currentPage - 1));
      controls.appendChild(prev);

      pageRange(currentPage, totalPages).forEach((item) => {
        if (item === "…") {
          const ellipsis = document.createElement("span");
          ellipsis.className = "pg-ellipsis";
          ellipsis.textContent = "…";
          controls.appendChild(ellipsis);
        } else {
          const btn = document.createElement("button");
          btn.className = "pg-btn" + (item === currentPage ? " active" : "");
          btn.textContent = String(item);
          btn.setAttribute("aria-label", `Page ${item}`);
          if (item === currentPage) btn.setAttribute("aria-current", "true");
          btn.addEventListener("click", () => showPage(item));
          controls.appendChild(btn);
        }
      });

      const next = document.createElement("button");
      next.className = "pg-btn";
      next.setAttribute("aria-label", "Next page");
      next.textContent = "→";
      next.disabled = currentPage === totalPages;
      next.addEventListener("click", () => showPage(currentPage + 1));
      controls.appendChild(next);

      const info = document.createElement("span");
      info.className = "pg-info";
      const start = (currentPage - 1) * PAGE_SIZE + 1;
      const end = Math.min(currentPage * PAGE_SIZE, rows.length);
      info.textContent = `${start}–${end} of ${rows.length}`;
      controls.appendChild(info);
    }

    showPage(1);
  });
});
