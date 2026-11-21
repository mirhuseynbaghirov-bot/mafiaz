/* =========================================
   MAFIA — STATS.JS
   Real online counter (Supabase Presence)
   + visitor registration (register_visit)
   + small owner-only number in the footer
   app.js-dən SONRA yüklənməlidir.
========================================= */

(() => {
  "use strict";

  const db = window.mafiaDB;
  if (!db) {
    console.warn("stats.js: mafiaDB tapılmadı (app.js əvvəl yüklənməlidir).");
    return;
  }

  /* ---------- cihaz id-si ---------- */

  function makeId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  let uid = null;
  try { uid = localStorage.getItem("mafia_uid"); } catch (e) { /* ignore */ }

  if (!uid) {
    uid = makeId();
    try { localStorage.setItem("mafia_uid", uid); } catch (e) { /* ignore */ }
  }

  /* ---------- state ---------- */

  let online = 0;
  let today = 0;
  let total = 0;

  /* ---------- styles ---------- */

  const style = document.createElement("style");
  style.textContent = `
    .live-online {
      display: inline-flex;
      align-items: center;
      gap: 9px;
      margin-top: 22px;
      padding: 8px 14px;
      border: 1px solid rgba(143,198,154,.22);
      border-radius: 20px;
      background: rgba(143,198,154,.06);
      color: #b9d9c0;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: .6px;
    }
    .live-online i {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #79c88c;
      box-shadow: 0 0 10px #79c88c;
      animation: liveOnlinePulse 1.6s infinite;
    }
    .live-online b { color: #e5f4e8; }
    @keyframes liveOnlinePulse { 50% { opacity: .3; } }

    .owner-stat {
      display: block;
      width: 100%;
      text-align: center;
      color: #8a848d;
      font-size: 11px;
      letter-spacing: 3px;
      opacity: .55;
      user-select: none;
    }
  `;
  document.head.appendChild(style);

  /* ---------- UI ---------- */

  let liveBox = null;
  let liveCount = null;
  let ownerEl = null;

  function buildUI() {
    // Ana səhifədə, otaq kodu bölməsinin altında REAL online sayı
    const joinRoom = document.querySelector(".join-room");

    if (joinRoom && !liveBox) {
      liveBox = document.createElement("div");
      liveBox.className = "live-online";
      liveBox.hidden = true;
      liveBox.innerHTML = '<i></i><span><b id="liveOnlineCount">0</b> oyunçu online</span>';
      joinRoom.insertAdjacentElement("afterend", liveBox);
      liveCount = liveBox.querySelector("#liveOnlineCount");
    }

    // Saytın ən aşağısında yalnız səndən başa düşülən kiçik rəqəm
    const footer = document.getElementById("mainFooter");

    if (footer && !ownerEl) {
      ownerEl = document.createElement("span");
      ownerEl.className = "owner-stat";
      footer.appendChild(ownerEl);
    }
  }

  function render() {
    if (liveBox) {
      liveBox.hidden = online < 1;
      if (liveCount) liveCount.textContent = String(online);
    }

    // format:  online · bu gün · ümumi
    if (ownerEl) ownerEl.textContent = `${online}·${today}·${total}`;
  }

  /* ---------- online (Presence) ---------- */

  const channel = db.channel("site-online", {
    config: { presence: { key: uid } }
  });

  channel
    .on("presence", { event: "sync" }, () => {
      online = Object.keys(channel.presenceState()).length;
      render();
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        try { await channel.track({ at: Date.now() }); }
        catch (e) { console.warn("Presence track xətası:", e); }
      }
    });

  /* ---------- ziyarətçi qeydi + say ---------- */

  async function loadStats() {
    try {
      const { data, error } = await db.rpc("get_visitor_stats");
      if (error) throw error;

      if (data) {
        total = Number(data.total) || 0;
        today = Number(data.today) || 0;
        render();
      }
    } catch (e) {
      console.warn("Statistika oxunmadı:", e);
    }
  }

  async function registerVisit() {
    try {
      const { error } = await db.rpc("register_visit", { visitor: uid });
      if (error) throw error;
    } catch (e) {
      console.warn("Ziyarət qeydə alınmadı:", e);
    }
  }

  /* ---------- start ---------- */

  buildUI();
  render();

  registerVisit().then(loadStats);
  setInterval(loadStats, 60000);
})();
