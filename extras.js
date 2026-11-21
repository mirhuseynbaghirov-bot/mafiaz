/* extras.js — game-fx.js-dən SONRA yüklə (app.js-də PATCHES.md dəyişiklikləri lazımdır) */
(() => {
  "use strict";
  const db = window.mafiaDB;
  if (!db) return;

  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const SUPABASE_URL = "https://pgmjtimnnmcttdvfqcnw.supabase.co";
  const SUPABASE_KEY = "sb_publishable_o_Xk7py1CvvLlU3imqwiOA_ke2Rr-HU";

  /* ---------- sessiya (səhifə bağlananda sorğu göndərmək üçün) ---------- */
  let token = null, uid = null;
  const setSession = (s) => { token = s?.access_token || null; uid = s?.user?.id || null; };
  db.auth.getSession().then(({ data }) => setSession(data.session));
  db.auth.onAuthStateChange((_e, s) => setSession(s));

  /* ---------- SAYTDAN ÇIXANDA OTAQDAN SİL ---------- */
  function leaveOnExit() {
    const st = window.mafiaApp?.getState?.();
    if (!st?.roomId || !token || !uid) return;
    try {
      fetch(
        `${SUPABASE_URL}/rest/v1/room_players?room_id=eq.${encodeURIComponent(st.roomId)}&user_id=eq.${encodeURIComponent(uid)}`,
        { method: "DELETE", keepalive: true, headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + token } }
      );
    } catch { /* səhifə bağlanır */ }
  }
  addEventListener("pagehide", leaveOnExit);

  /* =====================================================================
     OYUN BİTDİ POP-UP
  ===================================================================== */
  const ROLE_AZ = { mafia: "Mafiya", doctor: "Həkim", detective: "Detektiv", civilian: "Mülki sakin" };
  let popup = null, expText = "", expReady = false;

  const closePopup = () => { popup?.remove(); popup = null; };

  function showResult(detail) {
    closePopup();
    const st = window.mafiaApp?.getState?.() || {};
    const isMafia = st.role === "mafia";
    const winner = detail?.winner || st.winner;
    const won = winner === "mafia" ? isMafia : !isMafia;

    popup = document.createElement("div");
    popup.className = "res-overlay";
    popup.innerHTML = `
      <div class="res-box ${won ? "win" : "lose"}" role="dialog" aria-modal="true">
        <div class="res-icon">${won ? "♛" : "☠"}</div>
        <h2>${won ? "QALİB GƏLDİNİZ" : "MƏĞLUB OLDUNUZ"}</h2>
        <p class="res-winner">${winner === "mafia" ? "MAFİYA" : "ŞƏHƏR SAKİNLƏRİ"} qalib gəldi</p>
        <p class="res-role">Rolun: <b>${esc(ROLE_AZ[st.role] || "—")}</b></p>
        <p class="res-exp" id="resExp">${esc(expText || "EXP hesablanır...")}</p>
        <div class="res-actions">
          <button type="button" class="res-btn gold" id="resAgain" disabled>YENİDƏN OYNA</button>
          <button type="button" class="res-btn" id="resHome">ANA SƏHİFƏYƏ QAYIT</button>
        </div>
        <small>"Yenidən oyna" basan hər kəs eyni otaqda qalır.</small>
      </div>`;
    document.body.appendChild(popup);

    const again = $("resAgain"), home = $("resHome");
    const unlock = () => { if (again && !again.dataset.busy) again.disabled = false; };
    if (expReady) unlock(); else setTimeout(unlock, 5000);   // EXP yazılsın deyə qısa gözləmə
    popup._unlock = unlock;

    again.onclick = async () => {
      again.dataset.busy = "1";
      again.disabled = home.disabled = true;
      again.textContent = "GÖZLƏYİN...";
      const ok = await window.mafiaApp.backToLobby();
      if (ok) return closePopup();
      delete again.dataset.busy;
      again.disabled = home.disabled = false;
      again.textContent = "YENİDƏN OYNA";
    };

    home.onclick = async () => {
      again.disabled = home.disabled = true;
      home.textContent = "GÖZLƏYİN...";
      await window.mafiaApp.leaveNow();
      closePopup();
    };
  }

  document.addEventListener("mafia:gameover", (e) => {
    expText = ""; expReady = false;
    setTimeout(() => showResult(e.detail), 3200);   // öldürmə effektləri bitsin
  });

  document.addEventListener("mafia:exp", (e) => {
    expText = e.detail || ""; expReady = true;
    const el = $("resExp");
    if (el) el.textContent = expText;
    popup?._unlock?.();
  });

  /* =====================================================================
     ANA SƏHİFƏ: CANLI STATİSTİKA, LİDERLƏR, AÇIQ OTAQLAR
  ===================================================================== */
  const TIPS = [
    "Çox susan da, çox danışan da şübhə çəkir. Tarazlığı tap.",
    "Həkim özünü də qoruya bilər — amma hər gecə eyni adamı yox.",
    "Detektiv tapıntısını tez açsa, mafiyanın hədəfinə çevrilə bilər.",
    "Səsvermədə “keç” seçimi də strategiyadır.",
    "Mafiya üçün ən yaxşı maska: sakit və məntiqli mülki sakin.",
    "Dostlarını dəvət et: link ilə otağa bir toxunuşla girirlər."
  ];

  function buildLive() {
    if ($("liveSection")) return;
    const hero = document.querySelector(".hero");
    if (!hero) return;

    const sec = document.createElement("section");
    sec.className = "live-section";
    sec.id = "liveSection";
    sec.hidden = true;
    sec.innerHTML = `
      <div class="live-stats">
        <div><b id="lsRooms">–</b><span>AÇIQ OTAQ</span></div>
        <div><b id="lsPlayers">–</b><span>OTAQLARDA OYUNÇU</span></div>
        <div><b id="lsTotal">–</b><span>QEYDİYYATLI OYUNÇU</span></div>
      </div>
      <div class="live-grid">
        <div class="live-card">
          <span class="live-label">LİDERLƏR</span>
          <h3>Ən yaxşı oyunçular</h3>
          <ol class="live-list" id="lbList"><li class="live-empty">Yüklənir...</li></ol>
        </div>
        <div class="live-card">
          <span class="live-label">CANLI</span>
          <h3>Açıq otaqlar</h3>
          <ul class="live-list" id="lbRooms"><li class="live-empty">Yüklənir...</li></ul>
        </div>
      </div>
      <p class="live-tip" id="liveTip"></p>`;
    hero.insertAdjacentElement("afterend", sec);
    $("liveTip").textContent = "💡 " + TIPS[Math.floor(Math.random() * TIPS.length)];
  }

  async function loadLive() {
    const sec = $("liveSection");
    if (!sec || document.hidden || $("mainContent")?.hidden) return;

    const [stats, lb, rooms] = await Promise.all([
      db.rpc("site_stats"),
      db.rpc("leaderboard", { p_limit: 10 }),
      db.rpc("list_open_rooms")
    ]);

    if (stats.error && lb.error && rooms.error) return;   // SQL işlədilməyib → bölmə gizli qalır
    sec.hidden = false;

    if (!stats.error && stats.data) {
      $("lsRooms").textContent = stats.data.open_rooms ?? 0;
      $("lsPlayers").textContent = stats.data.room_players ?? 0;
      $("lsTotal").textContent = stats.data.total_players ?? 0;
    }

    if (!lb.error) {
      const rows = lb.data || [];
      $("lbList").innerHTML = rows.length
        ? rows.map((r, i) => `<li><i>${i + 1}</i><b>${esc(r.username)}</b><em>LVL ${r.level}</em><span>${r.exp} EXP</span></li>`).join("")
        : '<li class="live-empty">Hələ reytinq yoxdur. İlk oyunu sən qazan!</li>';
    }

    if (!rooms.error) {
      const rows = (rooms.data || []).slice(0, 5);
      $("lbRooms").innerHTML = rows.length
        ? rows.map((r) => `
            <li><b>${r.has_password ? "🔒 " : ""}${esc(r.room_name)}</b>
              <span>${r.player_count}/${r.max_players}</span>
              <button type="button" class="soc-btn" data-join="${esc(r.room_code)}" ${r.player_count >= r.max_players ? "disabled" : ""}>QOŞUL</button></li>`).join("")
        : '<li class="live-empty">Açıq otaq yoxdur. Birincini sən yarat!</li>';
    }
  }

  document.addEventListener("click", (e) => {
    const b = e.target.closest("#lbRooms [data-join]");
    if (b) window.mafiaApp?.joinByCode(b.dataset.join);
  });

  /* =====================================================================
     LOBBİ: ROL PAYLANMASI ÇİPLƏRİ
  ===================================================================== */
  function buildChips() {
    const save = $("saveGameSettingsBtn");
    if (!save || $("roleChips")) return;
    const box = document.createElement("div");
    box.id = "roleChips";
    box.className = "role-chips";
    save.insertAdjacentElement("beforebegin", box);
    updateChips();
  }

  function updateChips() {
    const box = $("roleChips");
    if (!box) return;
    const n = (id) => Number($(id)?.value || 0);
    const civ = $("gameCivilianCount")?.textContent || "0";
    box.innerHTML = [
      ["♠", "Mafiya", n("gameMafiaCount"), "m"],
      ["✚", "Həkim", n("gameDoctorCount"), "d"],
      ["⌕", "Detektiv", n("gameDetectiveCount"), "t"],
      ["♟", "Mülki", civ, "c"]
    ].map(([s, name, c, k]) => `<span class="chip ${k}"><i>${s}</i>${name} ×${c}</span>`).join("");
  }

  document.addEventListener("change", (e) => {
    if (e.target.closest?.(".game-settings-card")) updateChips();
  });

  /* ---------- başlat ---------- */
  function init() {
    buildLive();
    buildChips();
    const civ = $("gameCivilianCount");
    if (civ) new MutationObserver(updateChips).observe(civ, { childList: true, characterData: true, subtree: true });
    loadLive();
    setInterval(loadLive, 20000);
    db.auth.onAuthStateChange(() => setTimeout(loadLive, 500));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
