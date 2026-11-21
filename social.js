/* social.js — app.js, auth.js-dən SONRA yüklə
   Otaqlar siyahısı · Dostlar · Dəvətlər · Link ilə giriş */
(() => {
  "use strict";
  const db = window.mafiaDB;
  if (!db) return;

  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let me = null;
  let panelMode = null;          // "rooms" | "friends"
  let pollTimer = null;
  let inviteChannel = null;

  /* ---------------- panel (öz pəncərəsi, mövcud modala toxunmur) ---------------- */
  const overlay = document.createElement("div");
  overlay.className = "soc-overlay";
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="soc-panel" role="dialog" aria-modal="true">
      <button class="soc-close" type="button" aria-label="Bağla">×</button>
      <h2 class="soc-title"></h2>
      <div class="soc-body"></div>
    </div>`;
  document.body.appendChild(overlay);

  const body = () => overlay.querySelector(".soc-body");
  const title = (t) => (overlay.querySelector(".soc-title").textContent = t);

  const toastBox = document.createElement("div");
  toastBox.className = "soc-toasts";
  document.body.appendChild(toastBox);

  function toast(html, ms = 6000) {
    const el = document.createElement("div");
    el.className = "soc-toast";
    el.innerHTML = html;
    toastBox.appendChild(el);
    if (ms) setTimeout(() => el.remove(), ms);
    return el;
  }

  function closePanel() {
    overlay.hidden = true;
    panelMode = null;
    clearInterval(pollTimer);
    pollTimer = null;
  }
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closePanel(); });
  overlay.querySelector(".soc-close").addEventListener("click", closePanel);

  async function requireUser() {
    const { data } = await db.auth.getUser();
    me = data?.user || null;
    if (!me) {
      closePanel();
      $("loginBtn")?.click();
      return false;
    }
    return true;
  }

  async function joinCode(code) {
    closePanel();
    await window.mafiaApp?.joinByCode(code);
  }

  /* ===================== OTAQLAR ===================== */
  async function openRooms() {
    if (!(await requireUser())) return;
    panelMode = "rooms";
    title("OTAQLAR");
    overlay.hidden = false;
    body().innerHTML = '<p class="soc-empty">Yüklənir...</p>';
    await loadRooms();
    clearInterval(pollTimer);
    pollTimer = setInterval(() => panelMode === "rooms" && loadRooms(), 4000);
  }

  async function loadRooms() {
    const { data, error } = await db.rpc("list_rooms");
    if (panelMode !== "rooms") return;

    if (error) {
      body().innerHTML = '<p class="soc-empty">Otaqlar yüklənmədi (mafia-social.sql işlədilib?).</p>';
      console.warn(error);
      return;
    }

    const rows = data || [];
    const list = rows.length ? rows.map((r) => {
      const full = r.player_count >= r.max_players;
      return `
        <li class="soc-row">
          <div class="soc-info">
            <b>${r.has_password ? '<span class="soc-lock" title="Parollu">🔒</span> ' : ""}${esc(r.room_name)}</b>
            <small>Host: ${esc(r.host_name)} · ${esc(String(r.language || "az").toUpperCase())}</small>
          </div>
          <span class="soc-count${full ? " full" : ""}">${r.player_count}/${r.max_players}</span>
          <button type="button" class="soc-btn" data-join="${esc(r.room_code)}" ${full ? "disabled" : ""}>${full ? "DOLUDUR" : "QOŞUL"}</button>
        </li>`;
    }).join("") : '<li class="soc-empty">Hazırda açıq otaq yoxdur. Birincini sən yarat!</li>';

    body().innerHTML = `
      <div class="soc-actions">
        <button type="button" class="soc-btn gold" id="socCreate">+ OTAQ YARAT</button>
        <button type="button" class="soc-btn" id="socRefresh">YENİLƏ</button>
      </div>
      <ul class="soc-list">${list}</ul>
      <small class="soc-hint">Siyahı hər 4 saniyədən bir yenilənir.</small>`;

    $("socRefresh").onclick = loadRooms;
    $("socCreate").onclick = () => { closePanel(); $("createBtn")?.click(); };
    body().querySelectorAll("[data-join]").forEach((b) => (b.onclick = () => joinCode(b.dataset.join)));
  }

  /* ===================== DOSTLAR ===================== */
  async function openFriends() {
    if (!(await requireUser())) return;
    panelMode = "friends";
    title("DOSTLAR");
    overlay.hidden = false;
    body().innerHTML = '<p class="soc-empty">Yüklənir...</p>';
    await loadFriends();
    clearInterval(pollTimer);
    pollTimer = setInterval(() => panelMode === "friends" && loadFriends(true), 8000);
  }

  async function loadFriends(keepInput) {
    const { data, error } = await db.rpc("list_friends");
    if (panelMode !== "friends") return;

    if (error) {
      body().innerHTML = '<p class="soc-empty">Dostlar yüklənmədi (mafia-social.sql işlədilib?).</p>';
      console.warn(error);
      return;
    }

    const rows = data || [];
    const myRoom = window.mafiaApp?.getActiveRoom?.();
    const incoming = rows.filter((r) => r.relation === "incoming");
    const outgoing = rows.filter((r) => r.relation === "outgoing");
    const friends = rows.filter((r) => r.relation === "friend");

    const typed = keepInput ? ($("socFriendName")?.value || "") : "";

    const friendRow = (f) => {
      let action = "";
      const inLobby = f.room_code && f.room_status === "waiting";
      if (myRoom && f.online) action += `<button type="button" class="soc-btn gold" data-invite="${f.other_id}">DƏVƏT ET</button>`;
      if (inLobby && !(myRoom && myRoom.room_code === f.room_code)) {
        action += `<button type="button" class="soc-btn" data-join="${esc(f.room_code)}">${f.room_locked ? "🔒 " : ""}QOŞUL</button>`;
      }
      const status = f.room_code
        ? (f.room_status === "in_progress" ? "oyundadır" : "otaqda: " + esc(f.room_name || ""))
        : (f.online ? "onlayn" : "oflayn");
      return `
        <li class="soc-row">
          <span class="soc-dot${f.online ? " on" : ""}"></span>
          <div class="soc-info"><b>${esc(f.username)}</b><small>${status}</small></div>
          ${action}
          <button type="button" class="soc-x" data-remove="${f.other_id}" title="Sil">×</button>
        </li>`;
    };

    body().innerHTML = `
      <form class="soc-add" id="socAddForm" autocomplete="off">
        <input id="socFriendName" maxlength="20" placeholder="İstifadəçi adı ilə dost əlavə et" value="${esc(typed)}">
        <button type="submit" class="soc-btn gold">ƏLAVƏ ET</button>
      </form>
      <p class="soc-msg" id="socMsg"></p>
      ${incoming.length ? `<span class="soc-sub">GƏLƏN SORĞULAR</span><ul class="soc-list">${incoming.map((r) => `
        <li class="soc-row">
          <div class="soc-info"><b>${esc(r.username)}</b><small>sənə dostluq sorğusu göndərib</small></div>
          <button type="button" class="soc-btn gold" data-accept="${r.other_id}">QƏBUL ET</button>
          <button type="button" class="soc-x" data-decline="${r.other_id}" title="Rədd et">×</button>
        </li>`).join("")}</ul>` : ""}
      <span class="soc-sub">DOSTLARIM (${friends.length})</span>
      <ul class="soc-list">${friends.length ? friends.map(friendRow).join("") : '<li class="soc-empty">Hələ dostun yoxdur. Yuxarıda adını yazıb əlavə et.</li>'}</ul>
      ${outgoing.length ? `<span class="soc-sub">GÖNDƏRİLMİŞ SORĞULAR</span><ul class="soc-list">${outgoing.map((r) => `
        <li class="soc-row"><div class="soc-info"><b>${esc(r.username)}</b><small>cavab gözlənilir</small></div>
        <button type="button" class="soc-x" data-remove="${r.other_id}" title="Ləğv et">×</button></li>`).join("")}</ul>` : ""}`;

    const msg = (t, ok) => { const m = $("socMsg"); m.textContent = t; m.className = "soc-msg" + (ok ? " ok" : ""); };

    $("socAddForm").onsubmit = async (e) => {
      e.preventDefault();
      const name = $("socFriendName").value.trim();
      if (!name) return;
      const { data: res, error: err } = await db.rpc("send_friend_request", { p_username: name });
      if (err) return msg(err.message);
      await loadFriends();
      msg(res?.status === "accepted" ? "Artıq dostsunuz!" : "Sorğu göndərildi.", true);
    };

    const act = async (fn) => { await fn(); loadFriends(); };
    body().querySelectorAll("[data-accept]").forEach((b) => (b.onclick = () => act(() => db.rpc("respond_friend_request", { p_from: b.dataset.accept, p_accept: true }))));
    body().querySelectorAll("[data-decline]").forEach((b) => (b.onclick = () => act(() => db.rpc("respond_friend_request", { p_from: b.dataset.decline, p_accept: false }))));
    body().querySelectorAll("[data-remove]").forEach((b) => (b.onclick = () => confirm("Dostluğu sil?") && act(() => db.rpc("remove_friend", { p_other: b.dataset.remove }))));
    body().querySelectorAll("[data-join]").forEach((b) => (b.onclick = () => joinCode(b.dataset.join)));
    body().querySelectorAll("[data-invite]").forEach((b) => (b.onclick = async () => {
      const room = window.mafiaApp?.getActiveRoom?.();
      if (!room) return;
      b.disabled = true;
      const { error: err } = await db.rpc("invite_friend", { p_friend: b.dataset.invite, p_room_code: room.room_code });
      if (err) { msg(err.message); b.disabled = false; return; }
      b.textContent = "GÖNDƏRİLDİ ✓";
    }));
  }

  /* ===================== DƏVƏT BİLDİRİŞİ ===================== */
  async function startInvites() {
    if (inviteChannel || !me) return;
    inviteChannel = db.channel("invites-" + me.id)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "room_invites", filter: "to_user=eq." + me.id },
        (p) => showInvite(p.new))
      .subscribe();

    // səhifəni yeni açıbsa, son 10 dəqiqənin dəvətlərini göstər
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data } = await db.from("room_invites").select("*").eq("to_user", me.id).gte("created_at", since).order("id", { ascending: false }).limit(3);
    (data || []).forEach(showInvite);
  }

  function showInvite(inv) {
    if (!inv || window.mafiaApp?.getActiveRoom?.()) return;
    const el = toast(`
      <b>${esc(inv.from_name || "Dostun")}</b> səni otağa çağırır<br>
      <small>${inv.locked ? "🔒 " : ""}${esc(inv.room_name || inv.room_code)}</small>
      <div class="soc-toast-actions">
        <button type="button" class="soc-btn gold" data-go>QOŞUL</button>
        <button type="button" class="soc-btn" data-no>İMTİNA</button>
      </div>`, 30000);
    el.querySelector("[data-go]").onclick = () => { el.remove(); joinCode(inv.room_code); };
    el.querySelector("[data-no]").onclick = () => el.remove();
    navigator.vibrate?.(80);
  }

  /* ===================== PRESENCE ===================== */
  const ping = () => me && db.rpc("touch_presence").then(() => {}, () => {});

  /* ===================== LİNK İLƏ GİRİŞ ===================== */
  const inviteUrl = (code) => location.origin + location.pathname + "?room=" + encodeURIComponent(code);

  function captureInviteParam() {
    const code = new URLSearchParams(location.search).get("room");
    if (!code) return;
    sessionStorage.setItem("pendingRoom", code.trim().toUpperCase());
    history.replaceState({}, "", location.pathname + location.hash);
  }

  async function consumePending() {
    const code = sessionStorage.getItem("pendingRoom");
    if (!code || !me) return;
    sessionStorage.removeItem("pendingRoom");
    await window.mafiaApp?.joinByCode(code);
  }

  function addLobbyButtons() {
    const copy = $("copyLobbyCode");
    if (!copy || $("shareInviteBtn")) return;

    const share = document.createElement("button");
    share.id = "shareInviteBtn";
    share.type = "button";
    share.textContent = "LİNKİ PAYLAŞ";
    share.addEventListener("click", async () => {
      const room = window.mafiaApp?.getActiveRoom?.();
      if (!room) return;
      const url = inviteUrl(room.room_code);
      try {
        if (navigator.share) await navigator.share({ title: "MAFIA", text: "Mafia otağına qoşul!", url });
        else { await navigator.clipboard.writeText(url); share.textContent = "KOPYALANDI ✓"; setTimeout(() => (share.textContent = "LİNKİ PAYLAŞ"), 1600); }
      } catch { /* istifadəçi ləğv etdi */ }
    });

    const inv = document.createElement("button");
    inv.id = "inviteFriendBtn";
    inv.type = "button";
    inv.textContent = "DOSTU DƏVƏT ET";
    inv.addEventListener("click", openFriends);

    copy.insertAdjacentElement("afterend", inv);
    copy.insertAdjacentElement("afterend", share);
  }

  /* ===================== BAĞLAMA ===================== */
  $("roomsBtn")?.addEventListener("click", openRooms);
  $("friendsBtn")?.addEventListener("click", openFriends);

  new MutationObserver(addLobbyButtons).observe(document.body, { childList: true, subtree: true });
  addLobbyButtons();

  async function onAuth(user) {
    me = user || null;
    document.querySelectorAll(".soc-needs-login").forEach((el) => (el.hidden = !me));
    if (me) { ping(); startInvites(); consumePending(); }
    else if (inviteChannel) { db.removeChannel(inviteChannel); inviteChannel = null; }
  }

  captureInviteParam();
  db.auth.getSession().then(({ data }) => {
    onAuth(data.session?.user);
    if (!data.session && sessionStorage.getItem("pendingRoom")) {
      toast("Dəvət linkinə qoşulmaq üçün əvvəlcə <b>daxil ol</b> və ya <b>qeydiyyatdan keç</b>.", 9000);
    }
  });
  db.auth.onAuthStateChange((_e, session) => onAuth(session?.user));
  setInterval(ping, 60000);
})();
