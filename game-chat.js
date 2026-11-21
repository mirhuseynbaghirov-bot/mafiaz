/* game-chat.js — app.js, auth.js, game-theme.js-dən SONRA yüklə */
(() => {
  "use strict";
  const db = window.mafiaDB;
  if (!db) return;
  const $ = (id) => document.getElementById(id);

  let roomId = null, me = null, myName = "Oyunçu", tab = "city", alive = true;
  let channel = null, tickTimer = null, seen = new Set(), lastKey = "", lastAlive = null;

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

  /* ---------- EMOJİ REAKSİYALARI ---------- */
  const EMOJIS = ["👍", "😂", "😮", "🤔", "😡"];
  let reactions = {};            // mesaj id -> [{user_id, emoji}]
  let rxTimer = null;

  function loadReactionsSoon() { clearTimeout(rxTimer); rxTimer = setTimeout(loadReactions, 250); }

  async function loadReactions() {
    if (!roomId) return;
    const { data, error } = await db.from("room_message_reactions").select("message_id,user_id,emoji").eq("room_id", String(roomId));
    if (error) return;                       // cədvəl yoxdursa (SQL işlənməyib) səssiz keç
    reactions = {};
    (data || []).forEach((r) => (reactions[r.message_id] ||= []).push(r));
    renderReactions();
  }

  function renderReactions() {
    document.querySelectorAll("#chatList .chat-msg[data-mid]").forEach((el) => {
      const box = el.querySelector(".chat-rx");
      if (!box) return;
      const list = reactions[el.dataset.mid] || [];
      const count = {};
      list.forEach((r) => (count[r.emoji] = (count[r.emoji] || 0) + 1));
      const mine = list.find((r) => r.user_id === me)?.emoji;
      box.innerHTML = Object.keys(count).map((e) =>
        `<button type="button" class="chat-chip${e === mine ? " mine" : ""}" data-emoji="${e}">${e} ${count[e]}</button>`).join("");
    });
  }

  async function setReaction(mid, emoji) {
    const list = reactions[mid] || (reactions[mid] = []);
    const mineIdx = list.findIndex((r) => r.user_id === me);
    const same = mineIdx >= 0 && list[mineIdx].emoji === emoji;

    if (mineIdx >= 0) list.splice(mineIdx, 1);          // dərhal göstər (optimistic)
    if (!same) list.push({ user_id: me, emoji });
    renderReactions();

    const q = same
      ? db.from("room_message_reactions").delete().eq("message_id", mid).eq("user_id", me)
      : db.from("room_message_reactions").upsert({ room_id: String(roomId), message_id: mid, user_id: me, emoji });
    const { error } = await q;
    if (error) loadReactions();
  }

  const clock = (ms) => { const x = Math.max(0, Math.ceil(ms / 1000)); return String(Math.floor(x / 60)).padStart(2, "0") + ":" + String(x % 60).padStart(2, "0"); };

  /* ---------- BOTLAR DANIŞIR (yalnız host cihazı yazır, təkrar olmasın) ---------- */
  const BOT_OPEN = ["Salam hamıya. Kimsə nəsə bilir?", "Gecə çətin keçdi. Diqqətli olaq.", "Tələsməyək, əvvəl hamını dinləyək.", "Mənim şübhələrim var, amma hələ danışmayacam."];
  const BOT_SUSPECT = [(n) => `${n} bu gün çox sakitdir, şübhəli görünür.`, (n) => `Mənə elə gəlir ki, ${n} nəsə gizlədir.`, (n) => `${n}, özünü izah edə bilərsən?`, (n) => `Səsimi ${n}-ə verməyi düşünürəm.`];
  const BOT_DEFEND = ["Mən günahsızam, mənə güvənin.", "Məni şübhəli bilməyin, mən şəhərdənəm.", "Səhv adamı çıxarmayaq, ehtiyatlı olun."];
  let botNext = 0, botRound = "", botOpened = false, botList = [], botListAt = 0;
  const rnd = (a) => a[Math.floor(Math.random() * a.length)];

  async function botTalk(T, ph) {
    if (!T || ph !== "day" || T.now >= T.discEnd || !roomId) return;
    if ($("gameHostControls")?.hidden !== false) return;          // yalnız host
    const key = roomId + "-" + T.round;
    if (botRound !== key) { botRound = key; botNext = Date.now() + 4000; botOpened = false; }
    if (Date.now() < botNext) return;
    botNext = Date.now() + 9000 + Math.random() * 11000;

    if (Date.now() - botListAt > 8000) {
      botListAt = Date.now();
      const { data } = await db.from("room_bots").select("bot_name,is_alive").eq("room_id", roomId);
      botList = (data || []).filter((b) => b.is_alive);
    }
    if (!botList.length) return;
    const bot = rnd(botList);

    const names = [...document.querySelectorAll("#gamePlayers .game-player-card:not(.dead) .game-player-name")]
      .map((e) => e.textContent.trim())
      .map((n) => (n === "Sən" ? myName : n))
      .filter((n) => n && n !== bot.bot_name);

    let body;
    if (!botOpened) { botOpened = true; body = rnd(BOT_OPEN); }
    else if (names.length && Math.random() < 0.7) body = rnd(BOT_SUSPECT)(rnd(names));
    else body = rnd(BOT_DEFEND);

    db.from("room_messages").insert({ room_id: roomId, author_name: bot.bot_name + " · BOT", channel: "city", body });
  }

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
    el.className = "chat-msg" + (m.system ? " system" : "") + (m.channel === "mafia" ? " mafia" : "") + (m.user_id === me && !/ · BOT$/.test(m.author_name || "") ? " mine" : "");
    if (!m.system) {
      const n = document.createElement("b");
      n.textContent = m.author_name;
      if (/ · BOT$/.test(m.author_name || "")) el.classList.add("bot");
      el.appendChild(n);
    }
    const s = document.createElement("span");
    s.textContent = m.body;
    el.appendChild(s);
    if (!m.system && m.id) {
      el.dataset.mid = String(m.id);
      const rx = document.createElement("div");
      rx.className = "chat-rx";
      el.appendChild(rx);
    }
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

    const side = document.querySelector(".game-sidebar");
    if (side && !panel.isConnected) side.appendChild(panel);
    if (!curtain.isConnected) { $("gameScreen").append(curtain); document.body.append(toast); }

    const { data: old, error } = await db.from("room_messages").select("*").eq("room_id", roomId).order("id").limit(80);
    if (error) addMsg({ system: true, body: "Chat hazır deyil: chat-setup.sql işlədilməyib." });
    (old || []).forEach(addMsg);
    addMsg({ system: true, body: "Oyun başladı. Diqqətli ol — kimsəyə güvənmə." });

    channel = db.channel("chat-" + roomId).on("postgres_changes",
      { event: "INSERT", schema: "public", table: "room_messages", filter: "room_id=eq." + roomId },
      (p) => addMsg(p.new))
      .on("postgres_changes", { event: "*", schema: "public", table: "room_message_reactions", filter: "room_id=eq." + roomId }, loadReactionsSoon)
      .subscribe();
    loadReactions();

    await refreshAlive();
    tickTimer = setInterval(tick, 1000);
    tick();
  }

  function stop() {
    if (channel) db.removeChannel(channel);
    clearInterval(tickTimer);
    reactions = {}; clearTimeout(rxTimer);
    channel = null; roomId = null; seen = new Set(); lastKey = ""; lastAlive = null; botRound = ""; botList = [];
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
    }
    if (lastAlive === null) lastAlive = parseInt($("gameAliveCount")?.textContent) || 0;

    /* faza status + sayğac: server saatına görə, hamıda eyni (app.js-dən) */
    const T = window.mafiaGame?.getTiming?.();
    let label = "", discussion = false;
    if (ph === "day" && T && T.phase === "day") {
      if (T.now < T.discEnd) { discussion = true; label = "MÜZAKİRƏ · " + clock(T.discEnd - T.now); }
      else if (T.now < T.voteEnd) label = "SƏSVERMƏ · " + Math.ceil((T.voteEnd - T.now) / 1000) + " san";
      else label = "SƏSLƏR HESABLANIR";
    } else if (ph === "day") label = "GÜNDÜZ";
    else label = ph === "night" ? "GECƏ · şəhər yatır" : "OYUN BİTDİ";
    $("chatPhase").textContent = label;
    $("chatPhase").className = "chat-phase " + ph;
    screen.classList.toggle("is-discussion", discussion);
    botTalk(T, ph);

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

  panel.addEventListener("click", (e) => {
    const chip = e.target.closest(".chat-chip");
    const pick = e.target.closest(".chat-pick button");
    const msg = e.target.closest(".chat-msg[data-mid]");
    if (chip || pick) {
      const mid = e.target.closest(".chat-msg")?.dataset.mid;
      if (mid) setReaction(mid, (chip || pick).dataset.emoji);
      document.querySelectorAll(".chat-pick").forEach((x) => x.remove());
      return;
    }
    const open = msg?.querySelector(".chat-pick");
    document.querySelectorAll(".chat-pick").forEach((x) => x.remove());
    if (msg && !open) {                                   // mesaja toxun → emoji paneli
      const bar = document.createElement("div");
      bar.className = "chat-pick";
      bar.innerHTML = EMOJIS.map((x) => `<button type="button" data-emoji="${x}">${x}</button>`).join("");
      msg.appendChild(bar);
    }
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
