/* game-theme.js — app.js və auth.js-dən SONRA yüklənir */
(() => {
  "use strict";

  const P = {
    hat: '<path d="M3 16h18M6 16c0-5 1.2-9 6-9s6 4 6 9M6.4 12.5h11.2"/>',
    star: '<path d="M12 3l2.6 5.6 6 .7-4.4 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.4 9.3l6-.7z"/>',
    cross: '<path d="M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z"/>',
    skull: '<path d="M12 3a7 7 0 0 0-7 7c0 2.5 1.2 4 3 5v3h8v-3c1.8-1 3-2.5 3-5a7 7 0 0 0-7-7zM9 11h.01M15 11h.01M11 17v2M13 17v2"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    rook: '<path d="M5 21h14M7 21V10h10v11M6 10V4h2v2h2V4h4v2h2V4h2v6"/>',
    bot: '<rect x="5" y="8" width="14" height="10" rx="2"/><path d="M12 8V4M9 13h.01M15 13h.01M3 12v2M21 12v2"/>',
    crown: '<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/>'
  };
  const MAP = { "♠": "hat", "✚": "cross", "⌕": "eye", "♟": "user", "♛": "crown",
                "★": "star", "☠": "skull", "🤖": "bot", "◷": "clock", "♜": "rook" };
  const svg = (n) => `<svg class="gi" viewBox="0 0 24 24" aria-hidden="true">${P[n]}</svg>`;

  const SEL = [".feature-icon", ".role-symbol", ".modal-icon", ".lobby-waiting-message>span",
    ".lobby-host-avatar", ".lobby-player-avatar", ".game-player-avatar", ".game-role-symbol",
    "#gameAnnouncementIcon", '#modalDescription div[style*="font-size:42px"]'].join(",");

  const ROLE_ICON = { "mafia-card": "hat", "sheriff-card": "star", "doctor-card": "cross", "maniac-card": "skull" };
  const FEATURE = ["user", "clock", "rook"];

  function swapIcons() {
    document.querySelectorAll(SEL).forEach((el) => {
      if (el.querySelector("svg")) return;
      let name = MAP[el.textContent.trim()];
      const card = el.closest(".role-card");
      if (card) name = ROLE_ICON[[...card.classList].find((c) => ROLE_ICON[c])] || name;
      if (el.classList.contains("feature-icon")) {
        name = FEATURE[[...document.querySelectorAll(".feature-icon")].indexOf(el)] || name;
      }
      if (name) el.innerHTML = svg(name);
    });
  }

  function applyTheme() {
    const screen = document.getElementById("gameScreen");
    if (screen) {
      const phase = (document.getElementById("gamePhase")?.textContent || "").toUpperCase();
      screen.classList.toggle("is-night", phase.includes("GECƏ"));
      screen.classList.toggle("is-day", phase.includes("GÜNDÜZ"));
      screen.classList.toggle("is-finished", phase.includes("BİTDİ"));

      const card = screen.querySelector(".game-role-card");
      const role = (document.getElementById("myRoleName")?.textContent || "").trim();
      const cls = { "MAFİYA": "role-mafia", "HƏKİM": "role-doctor", "DETEKTİV": "role-detective" }[role] || "role-civilian";
      if (card && !card.classList.contains(cls)) {
        card.classList.remove("role-mafia", "role-doctor", "role-detective", "role-civilian");
        card.classList.add(cls);
        card.style.animation = "none"; void card.offsetWidth; card.style.animation = "";
      }
    }
    const email = document.getElementById("profileEmail");
    if (email && !document.querySelector(".profile-tag")) {
      email.insertAdjacentHTML("beforebegin", '<span class="profile-tag">AGENT · MAFIA CLUB</span>');
    }
  }

  let queued = false;
  const run = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; swapIcons(); applyTheme(); });
  };

  new MutationObserver(run).observe(document.body, { childList: true, subtree: true, characterData: true });
  run();
})();
