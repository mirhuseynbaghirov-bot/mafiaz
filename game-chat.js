/* game-chat.js — app.js, auth.js, game-theme.js-dən SONRA yüklə */
(() => {
  "use strict";
  const db = window.mafiaDB;
  if (!db) return;
  const $ = (id) => document.getElementById(id);

  let roomId = null, me = null, myName = "Oyunçu", tab = "city", alive = true;
  let discSeconds = 120, channel = null, tickTimer = null, seen = new Set(), lastKey = "", lastAlive = null;

  const panel = document.createElement("div");
  panel.id = "gameChat";
  panel.className = "game-chat";
  panel.innerHTML = `
    <span class="game-card-label">CHAT</span>
    <div class="chat-tabs">
      <button type="button" data-tab="city" class="active">ŞƏHƏR</button>
      <button type="button" data-tab="mafia" hidden>MAFİYA</button>
    </div>
    <div class="chat-phase" id="chatPhase"></div>
    <div class="chat-list" id="chatList"></div>
    <form class="chat-form" id="chatForm" autocomplete="off">
      <input id="chatInput" maxlength="300" placeholder="Mesaj yaz...">
      <button type="submit" id="chatSend">→</button>
      <button type="button" id="chatMic" disabled title="Səsli söhbət tezliklə">MIC</button>
    </form>`;

  const curtain = document.createElement("div");
  curtain.className = "night-curtain";
  curtain.hidden = true;
  curtain.innerHTML = '<div><svg class="gi" viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><path d="M3 21L21 3"/></svg><h2>GÖZLƏRİNİ YUM</h2><p>Şəhər yatır. Mafiya öz işini görür...</p><button type="button" id="curtainFinish" hidden>GECƏNİ TAMAMLA</button></div>';
  curtain.addEventListener("click", (e) => { if (e.target.id === "curtainFinish") $("finishNightBtn")?.click(); });

  const toast = document.createElement("div");
  toast.className = "game-toast";
  toast.hidden = true;

  const role = () => ($("myRoleName")?.textContent || "").trim();
  const isMafia = () => role() === "MAFİYA";
  const phase = () => {
    const t = ($("gamePhase")?.textContent || "").toUpperCase();
    return t.includes("GECƏ") ? "night" : t.includes("GÜNDÜZ") ? "day" : "end";
  };
  const round = () => parseInt(($("gameRound")?.textContent || "").replace(/\D/g, "")) || 1;

  function say(text, ms = 4200) {
    toast.textContent = text;
    toast.hidden = false;
    clearTimeout(say.t);
    say.t = setTimeout(() => (toast.hidden = true), ms);
  }

  function addMsg(m) {
    if (m.id && seen.has(m.id)) return;
    if (m.id) seen.add(m.id);
    const list = $("chatList");
    const el = document.createElement("div");
    el.className = "chat-msg" + (m.system ? " system" : "") + (m.channel === "mafia" ? " mafia" : "") + (m.user_id === me ? " mine" : "");
    if (!m.system) {
      const n = document.createElement("b");
      n.textContent = m.author_name;
      el.appendChild(n);
    }
    const s = document.createElement("span");
    s.textContent = m.body;
    el.appendChild(s);
    if (m.channel && m.channel !== tab && !m.system) el.hidden = true;
    el.dataset.channel = m.channel || "all";
    list.appendChild(el);
    list.scrollTop = list.scrollHeight;
  }

  function applyTab() {
    document.querySelectorAll("#gameChat .chat-tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    document.querySelectorAll("#chatList .chat-msg").forEach((el) => {
      el.hidden = el.dataset.channel !== "all" && el.dataset.channel !== tab;
    });
  }

  async function refreshAlive() {
    const { data } = await db.from("room_players").select("is_alive").eq("room_id", roomId).eq("user_id", me).maybeSingle();
    alive = data ? !!data.is_alive : true;
  }

  async function start() {
    if (roomId) return;
    const code = ($("gameRoomCodeDisplay")?.textContent || "").replace("ROOM:", "").trim();
    if (!code) return setTimeout(start, 600);
    const { data: u } = await db.auth.getUser();
    if (!u?.user) return;
    me = u.user.id;
    myName = u.user.user_metadata?.username || u.user.email?.split("@")[0] || "Oyunçu";
    const { data: room } = await db.from("rooms").select("id, game_settings").eq("room_code", code).maybeSingle();
    if (!room) return;
    roomId = room.id;
    discSeconds = Number(room.game_settings?.discussion_seconds) || 120;

    const side = document.querySelector(".game-sidebar");
    if (side && !panel.isConnected) side.appendChild(panel);
    if (!curtain.isConnected) { $("gameScreen").append(curtain); document.body.append(toast); }

    const { data: old, error } = await db.from("room_messages").select("*").eq("room_id", roomId).order("id").limit(80);
    if (error) addMsg({ system: true, body: "Chat hazır deyil: chat-setup.sql işlədilməyib." });
    (old || []).forEach(addMsg);
    addMsg({ system: true, body: "Oyun başladı. Diqqətli ol — kimsəyə güvənmə." });

    channel = db.channel("chat-" + roomId).on("postgres_changes",
      { event: "INSERT", schema: "public", table: "room_messages", filter: "room_id=eq." + roomId },
      (p) => addMsg(p.new)).subscribe();

    await refreshAlive();
    tickTimer = setInterval(tick, 1000);
    tick();
  }

  function stop() {
    if (channel) db.removeChannel(channel);
    clearInterval(tickTimer);
    channel = null; roomId = null; seen = new Set(); lastKey = ""; lastAlive = null;
    panel.remove(); curtain.hidden = true;
    const l = $("chatList"); if (l) l.innerHTML = "";
    $("gameScreen")?.classList.remove("is-discussion");
  }

  function tick() {
    const screen = $("gameScreen");
    if (!screen || screen.hidden || !roomId) return;
    const ph = phase(), key = ph + "-" + round();

    if (key !== lastKey) {
      const prev = lastKey; lastKey = key;
      refreshAlive();
      const n = parseInt($("gameAliveCount")?.textContent) || 0;
      if (prev.startsWith("night") && ph === "day" && lastAlive !== null) {
        const dead = lastAlive - n;
        say(dead > 0 ? `Səhər açıldı. Bu gecə ${dead} nəfər öldürüldü.` : "Səhər açıldı. Bu gecə heç kim ölmədi.");
        addMsg({ system: true, body: dead > 0 ? `☀ Səhər: ${dead} nəfər öldürüldü.` : "☀ Səhər: heç kim ölmədi." });
      } else if (prev.startsWith("day") && ph === "night") {
        const dead = lastAlive - n;
        say(dead > 0 ? "Səsvermə bitdi. Bir nəfər şəhərdən çıxarıldı." : "Səsvermə bitdi. Heç kim çıxarılmadı.");
        addMsg({ system: true, body: "🌙 Gecə düşür. Hamı gözünü yumur." });
      }
      lastAlive = n;
      if (ph === "day" && !localStorage.getItem("disc-" + roomId + "-" + round())) localStorage.setItem("disc-" + roomId + "-" + round(), Date.now());
    }
    if (lastAlive === null) lastAlive = parseInt($("gameAliveCount")?.textContent) || 0;

    /* faza status + müzakirə taymeri */
    let left = 0, label = "";
    if (ph === "day") {
      const t0 = Number(localStorage.getItem("disc-" + roomId + "-" + round())) || Date.now();
      left = Math.max(0, discSeconds - Math.floor((Date.now() - t0) / 1000));
      label = left > 0 ? `MÜZAKİRƏ · ${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}` : "SƏSVERMƏ AÇIQDIR";
    } else label = ph === "night" ? "GECƏ · şəhər yatır" : "OYUN BİTDİ";
    $("chatPhase").textContent = label;
    $("chatPhase").className = "chat-phase " + ph;
    screen.classList.toggle("is-discussion", ph === "day" && left > 0);

    /* gecə pərdəsi: xüsusi hərəkəti olmayanlar üçün */
    const acts = ["MAFİYA", "HƏKİM", "DETEKTİV"].includes(role());
    curtain.hidden = !(ph === "night" && !acts && alive);
    const cf = $("curtainFinish"); if (cf) cf.hidden = !!$("gameHostControls")?.hidden;

    /* tablar və yazma icazəsi */
    panel.querySelector('[data-tab="mafia"]').hidden = !isMafia();
    if (tab === "mafia" && !isMafia()) { tab = "city"; applyTab(); }
    const canWrite = alive && ((tab === "city" && ph === "day") || (tab === "mafia" && ph === "night"));
    const input = $("chatInput");
    input.disabled = !canWrite; $("chatSend").disabled = !canWrite;
    input.placeholder = !alive ? "Ölənlər yaza bilməz" : canWrite ? "Mesaj yaz..." :
      tab === "city" ? "Şəhər yatır..." : "Mafiya yalnız gecə danışır";
  }

  panel.addEventListener("click", (e) => {
    const b = e.target.closest("[data-tab]");
    if (b) { tab = b.dataset.tab; applyTab(); tick(); }
  });

  panel.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = $("chatInput"), body = input.value.trim();
    if (!body || input.disabled) return;
    input.value = "";
    const { error } = await db.from("room_messages").insert({ room_id: roomId, author_name: myName, channel: tab, body });
    if (error) addMsg({ system: true, body: "Göndərilmədi: " + error.message });
  });

  const watch = () => {
    const s = $("gameScreen");
    if (!s) return setTimeout(watch, 500);
    new MutationObserver(() => (s.hidden ? stop() : start())).observe(s, { attributes: true, attributeFilter: ["hidden"] });
    if (!s.hidden) start();
  };
  watch();
})();
