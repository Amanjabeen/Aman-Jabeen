
document.addEventListener("DOMContentLoaded", () => {
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  const menuBtn = document.getElementById("menuBtn");
  const navLinks = document.getElementById("navLinks");
  if (menuBtn && navLinks) {
    menuBtn.addEventListener("click", () => navLinks.classList.toggle("open"));
    navLinks.querySelectorAll("a").forEach(a => a.addEventListener("click", () => navLinks.classList.remove("open")));
  }

  // Reviews slider
  const reviews = [...document.querySelectorAll(".review-card")];
  const dotsWrap = document.getElementById("reviewDots");
  let reviewIndex = 0;
  if (reviews.length && dotsWrap) {
    reviews.forEach((_, i) => {
      const dot = document.createElement("button");
      dot.className = "dot" + (i === 0 ? " active" : "");
      dot.setAttribute("aria-label", `Show review ${i + 1}`);
      dot.addEventListener("click", () => showReview(i));
      dotsWrap.appendChild(dot);
    });
    const dots = [...dotsWrap.children];
    function showReview(i){
      reviewIndex = (i + reviews.length) % reviews.length;
      reviews.forEach((r,j) => r.classList.toggle("active", j === reviewIndex));
      dots.forEach((d,j) => d.classList.toggle("active", j === reviewIndex));
    }
    document.getElementById("reviewPrev")?.addEventListener("click", () => showReview(reviewIndex - 1));
    document.getElementById("reviewNext")?.addEventListener("click", () => showReview(reviewIndex + 1));
  }

  // Portfolio filters
  const filterBtns = [...document.querySelectorAll(".filter-btn")];
  const caseCards = [...document.querySelectorAll(".case-card")];
  filterBtns.forEach(btn => btn.addEventListener("click", () => {
    filterBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const f = btn.dataset.filter;
    caseCards.forEach(card => {
      const cats = (card.dataset.category || "").split(" ");
      card.classList.toggle("case-hidden", f !== "all" && !cats.includes(f));
    });
  }));

  // Portfolio quick-view modal
  const modal = document.getElementById("caseModal");
  if (modal) {
    const closeModal = () => {
      modal.classList.remove("open");
      modal.setAttribute("aria-hidden","true");
      document.body.style.overflow = "";
    };
    document.querySelectorAll(".case-details").forEach(btn => btn.addEventListener("click", () => {
      const c = JSON.parse(btn.dataset.case);
      document.getElementById("modalBadge").textContent = c.badge;
      document.getElementById("modalTitle").textContent = c.title;
      document.getElementById("modalSubtitle").textContent = c.subtitle;
      document.getElementById("modalSummary").textContent = c.summary;
      const mm = document.getElementById("modalMetrics");
      mm.innerHTML = c.metrics.map(m => `<div class="case-metric"><strong>${m[0]}</strong><span>${m[1]}</span></div>`).join("");
      const mf = document.getElementById("modalFile");
      mf.href = c.file;
      mf.textContent = `Open full ${c.filetype} case study`;
      modal.classList.add("open");
      modal.setAttribute("aria-hidden","false");
      document.body.style.overflow = "hidden";
    }));
    document.getElementById("modalClose")?.addEventListener("click", closeModal);
    document.getElementById("modalClose2")?.addEventListener("click", closeModal);
    modal.addEventListener("click", e => { if (e.target === modal) closeModal(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });
  }
});
