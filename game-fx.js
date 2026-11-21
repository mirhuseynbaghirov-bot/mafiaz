/* game-fx.js — game-chat.js-dən SONRA yüklə */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const scr = () => $("gameScreen");
  const visible = () => scr() && !scr().hidden;

  /* Azərbaycan hərfləri üçün təhlükəsiz böyük hərf (İ→I normallaşdırılır) */
  const up = (s) => (s || "").toLocaleUpperCase("az-AZ").replace(/İ/g, "I");
  const isNightText = (s) => /GEC[ƏE]/.test(up(s));
  const isEndText = (s) => up(s).includes("BITDI");

  /* ================= EFEKT LAYI: bütün müvəqqəti efektlər buradadır =================
     fixed + contain:paint → heç bir efekt səhifəni aşağı uzada bilməz (boşluq bug-ı) */
  const layer = document.createElement("div");
  layer.id = "fxLayer";
  document.body.appendChild(layer);

  /* ================= AVATARLAR (hər ad üçün unikal personaj) ================= */
  const hash = (s) => { let h = 2166136261; for (const c of s.toLowerCase()) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
  const pick = (a, h, sh) => a[(h >>> sh) % a.length];
  const SKIN = ["#f1c9a5", "#e0ac82", "#c68863", "#8d5a3b", "#f7d9bf"];
  const SUIT = ["#23232b", "#3a1c24", "#1f2f3a", "#2e2a22", "#3b3b44"];
  const HAIR = ["#18120d", "#3a2415", "#8a8a90", "#a8742c", "#0e0e0e"];

  function avatar(name) {
    const h = hash(name), skin = pick(SKIN, h, 0), suit = pick(SUIT, h, 3), hair = pick(HAIR, h, 6);
    const style = (h >>> 9) % 4, glasses = (h >>> 12) % 3 === 0, stache = (h >>> 14) % 3 === 0;
    const hd = [
      `<ellipse cx="32" cy="21" rx="17" ry="4" fill="#16151a"/><path d="M22 21c0-9 3-13 10-13s10 4 10 13z" fill="#1d1b22"/><path d="M22 18.5h20v2.5H22z" fill="#982b3d"/>`,
      `<path d="M20 22c1-9 7-12 14-12s10 4 11 12z" fill="#3a3a44"/><path d="M38 21h11c0 2-4 3-11 2z" fill="#2a2a32"/>`,
      `<path d="M21 28c-1-11 5-17 12-17s11 6 10 17c-2-5-5-8-11-8s-9 3-11 8z" fill="${hair}"/>`,
      `<path d="M21 27c0-9 5-14 11-14s11 5 11 14c-3-4-6-6-11-6s-8 2-11 6z" fill="${hair}"/>`
    ][style];
    const delay = ((h % 40) / 10).toFixed(1);
    return `<svg class="av" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" fill="#15131a"/>
      <circle cx="32" cy="30" r="26" fill="rgba(152,43,61,.18)"/>
      <path d="M6 64c0-12 10-17 26-17s26 5 26 17z" fill="${suit}"/><path d="M26 47l6 8 6-8z" fill="#e9e4da"/><path d="M30.5 50h3l1.5 12h-6z" fill="#982b3d"/>
      <rect x="28" y="38" width="8" height="10" fill="${skin}"/><ellipse cx="32" cy="29" rx="11" ry="13" fill="${skin}"/>
      <circle class="eye" style="animation-delay:${delay}s" cx="27.5" cy="29" r="1.5" fill="#1a1a1a"/><circle class="eye" style="animation-delay:${delay}s" cx="36.5" cy="29" r="1.5" fill="#1a1a1a"/>
      <path d="M28.5 36q3.5 2 7 0" stroke="#7a3b2e" fill="none" stroke-width="1.2"/>
      ${stache ? `<path d="M26.5 34.5q5.5-3 11 0q-5.5 1.5-11 0z" fill="${hair}"/>` : ""}
      ${glasses ? `<g fill="none" stroke="#d8b65d" stroke-width="1"><circle cx="27.5" cy="29" r="3.6"/><circle cx="36.5" cy="29" r="3.6"/><path d="M31 29h2"/></g>` : ""}${hd}</svg>`;
  }
  const who = (n) => (n === "Sən" ? ($("profileBtn")?.textContent.trim() || n) : n);

  function paint() {
    document.querySelectorAll("#gamePlayers .game-player-card").forEach((c) => {
      const a = c.querySelector(".game-player-avatar");
      if (a && !a.querySelector(".av")) a.innerHTML = avatar(who(c.querySelector(".game-player-name")?.textContent.trim() || "?"));
    });
    document.querySelectorAll(".lobby-player-card .lobby-player-avatar").forEach((a) => {
      if (a.querySelector(".av")) return;
      const n = a.closest(".lobby-player-card").querySelector(".lobby-player-name")?.textContent.trim();
      if (n) a.innerHTML = avatar(n);
    });
  }

  /* ================= 3D MASA: oyunçular masanın ətrafında ================= */
  function seatPlayers() {
    const box = $("gamePlayers");
    if (!box) return;
    box.classList.add("fx-table");
    const cards = [...box.querySelectorAll(".game-player-card")];
    if (!cards.length || cards.every((c) => c.dataset.seat)) return;
    const n = cards.length;
    let me = cards.findIndex((c) => c.querySelector(".game-player-name")?.textContent.trim() === "Sən");
    if (me < 0) me = 0;
    cards.forEach((c, i) => {
      const k = (i - me + n) % n;                    // "Sən" həmişə aşağıda (k=0)
      const a = Math.PI / 2 + (k * 2 * Math.PI) / n;
      const x = 50 + 39 * Math.cos(a), y = 50 + 35 * Math.sin(a);
      const depth = (Math.sin(a) + 1) / 2;           // 0 = arxa, 1 = ön
      c.dataset.seat = k;
      c.style.cssText = `left:${x.toFixed(1)}%;top:${y.toFixed(1)}%;scale:${(0.78 + 0.27 * depth).toFixed(2)};z-index:${depth < 0.35 ? 1 : 10 + Math.round(depth * 10)}`;
    });
  }

  /* ================= SƏS (WebAudio, fayl lazım deyil) ================= */
  let ctx = null, muted = localStorage.getItem("fxMute") === "1";
  const ac = () => { if (!ctx) { const A = window.AudioContext || window.webkitAudioContext; if (A) ctx = new A(); } if (ctx && ctx.state === "suspended") ctx.resume(); return ctx; };
  function noise(dur, gain, freq) {
    const c = ac(); if (!c || muted) return;
    const n = c.sampleRate * dur, buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = buf; f.type = "lowpass"; f.frequency.value = freq; g.gain.value = gain;
    s.connect(f); f.connect(g); g.connect(c.destination); s.start();
  }
  function tone(freq, dur, gain, type = "sine") {
    const c = ac(); if (!c || muted) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(gain, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + dur);
  }
  const sfx = {
    shot() { noise(0.55, 0.9, 5000); tone(70, 0.45, 0.7); },
    tick() { tone(880, 0.06, 0.08, "square"); },
    lock() { tone(300, 0.08, 0.15, "square"); setTimeout(() => tone(600, 0.12, 0.15, "square"), 90); },
    night() { tone(98, 1.6, 0.25); tone(147, 1.6, 0.12); },
    day() { tone(523, 0.5, 0.1); setTimeout(() => tone(659, 0.7, 0.1), 180); }
  };
  document.addEventListener("pointerdown", () => ac(), { once: true });

  /* ================= EFEKTLƏR (başlıqlar NÖVBƏ ilə, üst-üstə düşmür) ================= */
  const TITLE_MS = 2600;            // CSS-dəki .fx-title animasiyası ilə eyni olmalıdır
  const fxQueue = [];
  let fxBusy = false;

  function title(text, red, sub = "", before = null, wait = 0) {
    fxQueue.push({ text, red, sub, before, wait });
    if (!fxBusy) nextTitle();
  }
  function nextTitle() {
    const it = fxQueue.shift();
    if (!it) { fxBusy = false; document.body.classList.remove("fx-titling"); return; }
    fxBusy = true;
    document.body.classList.add("fx-titling");
    try { it.before?.(); } catch (e) { console.error(e); }
    setTimeout(() => {
      const t = document.createElement("div");
      t.className = "fx-title" + (it.red ? " red" : "");
      t.innerHTML = "<i></i><i></i><div><h1></h1><p></p></div>";
      t.querySelector("h1").textContent = it.text;
      t.querySelector("p").textContent = it.sub;
      layer.appendChild(t);
      setTimeout(() => { t.remove(); setTimeout(nextTitle, 150); }, TITLE_MS);
    }, it.wait);
  }
  function resetTitles() {
    fxQueue.length = 0; fxBusy = false;
    document.querySelectorAll(".fx-title").forEach((t) => t.remove());
    document.body.classList.remove("fx-titling");
  }

  function killFx(name) {
    const me = name === "Sən";
    title(me ? "ÖLDÜRÜLDÜN" : name.toUpperCase(), true, me ? "Sən artıq izləyicisən" : "ELİMİNƏ EDİLDİ", () => {
      const card = findCard(name);
      if (card) {
        const r = card.getBoundingClientRect();
        if (r.bottom > 0 && r.top < innerHeight) {
          const ret = document.createElement("div");
          ret.className = "fx-kill-ret";
          ret.style.left = r.left + r.width / 2 + "px"; ret.style.top = r.top + r.height / 2 + "px";
          layer.appendChild(ret); setTimeout(() => ret.remove(), 1700);
        }
      }
      gunShot(name);
    }, 1700);
  }

  /* ================= TAPANÇA: masanın ortasından qurbana ================= */
  const GUN_SVG = `<svg viewBox="0 0 96 64" aria-hidden="true">
    <path d="M16 32l-9 27h19l7-27z" fill="#5a3a22" stroke="#0b0b10" stroke-width="2" stroke-linejoin="round"/>
    <path d="M14 30h42l-4 9H14z" fill="#33363e" stroke="#0b0b10" stroke-width="2" stroke-linejoin="round"/>
    <path d="M40 38v5q0 6 8 6h5" fill="none" stroke="#2a2c33" stroke-width="3" stroke-linecap="round"/>
    <rect x="12" y="15" width="78" height="17" rx="3" fill="#4a4e59" stroke="#0b0b10" stroke-width="2"/>
    <rect x="88" y="19" width="7" height="9" fill="#23252b"/>
    <path d="M18 19h66" stroke="#8b909c" stroke-width="2" stroke-linecap="round"/>
    <rect x="14" y="11" width="6" height="5" fill="#23252b"/>
  </svg>`;
  function findCard(name) {
    return [...document.querySelectorAll("#gamePlayers .game-player-card")].find((c) => c.querySelector(".game-player-name")?.textContent.trim() === name);
  }

  function shotFx() {
    const f = document.createElement("div"); f.className = "fx-flash"; layer.appendChild(f); setTimeout(() => f.remove(), 500);
    scr()?.classList.add("fx-shake"); setTimeout(() => scr()?.classList.remove("fx-shake"), 500);
    sfx.shot(); navigator.vibrate?.([90, 40, 180]);
  }
  function gunShot(name) {
    const box = $("gamePlayers"), card = findCard(name);
    const vr = card?.getBoundingClientRect();
    if (!box || !vr || vr.bottom <= 0 || vr.top >= innerHeight) { setTimeout(shotFx, 1100); return; }
    const br = box.getBoundingClientRect();
    const cx = br.left + br.width / 2, cy = br.top + br.height * 0.525;   // masanın mərkəzi
    const tx = vr.left + vr.width / 2, ty = vr.top + vr.height / 2;
    const rad = Math.atan2(ty - cy, tx - cx), ang = (rad * 180) / Math.PI, dist = Math.hypot(tx - cx, ty - cy);

    const gun = document.createElement("div");
    gun.className = "fx-gun";
    gun.style.cssText = `left:${cx}px;top:${cy}px;--a:${ang}deg`;
    gun.innerHTML = GUN_SVG;
    layer.appendChild(gun);
    sfx.tick();

    setTimeout(() => {                                   // atəş
      const tr = document.createElement("div");
      tr.className = "fx-tracer";
      tr.style.cssText = `left:${cx}px;top:${cy - 1.5}px;width:${Math.max(0, dist - 28)}px;--a:${ang}deg`;
      const mz = document.createElement("div");
      mz.className = "fx-muzzle";
      mz.style.cssText = `left:${cx + Math.cos(rad) * 46}px;top:${cy + Math.sin(rad) * 46}px`;
      layer.append(tr, mz);
      gun.classList.add("fire");
      findCard(name)?.classList.add("fx-hit");
      shotFx();
      setTimeout(() => { tr.remove(); mz.remove(); findCard(name)?.classList.remove("fx-hit"); }, 700);
    }, 1100);
    setTimeout(() => gun.remove(), 1800);
  }

  /* ================= SƏHƏR QƏZETİ ================= */
  const deathLog = [];
  let prevType = null, morning = null, lastDeathT = 0;
  const rnd = (a) => a[Math.floor(Math.random() * a.length)];
  const HEAD1 = [
    (n) => `${n} SƏHƏR GÖZ AÇMADI`,
    (n) => `ŞƏHƏRDƏ QANLI GECƏ — QURBAN: ${n}`,
    (n) => `GECƏ YARISI GÜLLƏ SƏSİ: ${n} ÖLÜ TAPILDI`,
    (n) => `ŞƏHƏR ŞOKDA: ${n} ÖLDÜRÜLDÜ`
  ];
  const HEADN = [(k) => `QANLI GECƏ: ${k} NƏFƏR ÖLDÜRÜLDÜ`, (k) => `ŞƏHƏR MATƏMDƏ: ${k} QURBAN`];
  const HEAD0 = ["HEÇ KİM ÖLMƏDİ — KİMSƏ ŞƏHƏRİ QORUDU?", "SAKİT GECƏ, AMMA ŞƏHƏR NİYƏ GƏRGİNDİR?", "MAFİYA SƏHV ETDİ, YOXSA KİMSƏ XİLAS ETDİ?"];
  const SUB1 = [
    "Şahidlər gecə yarısı güllə səsi eşitdiklərini bildirir.",
    "Polis hadisə yerində iz tapa bilmədi. Şübhəlilər şəhərin içindədir.",
    "Qonşular gecə qapının açıldığını gördüklərini deyir.",
    "Mafiyanın əli yenə iş başında. Növbəti hədəf kimdir?"
  ];
  const SUBN = ["Mafiya sərt vurdu. Şəhər artıq yalnız danışmaqla xilas ola bilər.", "Polis bunu bir neçə nəfərin işi hesab edir."];
  const SUB0 = ["Həkimin əli işləyib? Yoxsa mafiya səhv edib? Hamıya şübhə ilə baxın.", "Şəhər sağ-salamat səhərə çıxdı, amma qatil hələ aramızdadır."];

  function newspaper(names, roundLabel) {
    document.querySelector(".fx-news")?.remove();
    const shown = names.map((n) => who(n));
    const head = !names.length ? rnd(HEAD0) : names.length === 1 ? rnd(HEAD1)(shown[0].toUpperCase()) : rnd(HEADN)(names.length);
    const sub = !names.length ? rnd(SUB0) : names.length === 1 ? rnd(SUB1) : rnd(SUBN) + " Qurbanlar: " + shown.join(", ") + ".";

    const el = document.createElement("div");
    el.className = "fx-news";
    el.innerHTML = `<div class="fx-paper"><div class="fx-mast"><small></small><b>GECƏ ŞƏHƏRİ QƏZETİ</b><small></small></div>
      <h2></h2><div class="fx-photos"></div><p></p><span class="fx-tap">bağlamaq üçün toxun</span></div>`;
    const sm = el.querySelectorAll(".fx-mast small");
    sm[0].textContent = roundLabel || ""; sm[1].textContent = "ŞƏHƏR XƏBƏRLƏRİ";
    el.querySelector("h2").textContent = head;
    el.querySelector("p").textContent = sub;
    const ph = el.querySelector(".fx-photos");
    names.slice(0, 3).forEach((n, i) => {
      const fig = document.createElement("figure");
      fig.innerHTML = `<div class="fx-photo">${avatar(shown[i])}</div><figcaption></figcaption>`;
      fig.querySelector("figcaption").textContent = shown[i];
      ph.appendChild(fig);
    });
    if (!names.length) ph.remove();
    layer.appendChild(el);
    noise(0.25, 0.4, 1800); tone(120, 0.2, 0.3);
    const close = () => { el.classList.add("bye"); setTimeout(() => el.remove(), 350); };
    el.addEventListener("click", close);
    setTimeout(close, 7500);
  }

  function newsLoop() {
    if (!morning || !visible()) return;
    const now = Date.now();
    const waited = now - morning.t;
    /* başlıqlar bitsin + son ölümdən 1.8 san keçsin; amma 15 san-dən çox gözləmə */
    if (waited < 15000 && (fxBusy || now - Math.max(morning.t, lastDeathT) < 1800)) return;
    const m = morning; morning = null;
    const dead = deathLog.filter((d) => !d.done).map((d) => d.name);
    deathLog.forEach((d) => (d.done = true));
    newspaper(dead, m.round);
  }
  setInterval(newsLoop, 250);

  let prevAlive = null;
  function scanDeaths() {
    const cur = {};
    document.querySelectorAll("#gamePlayers .game-player-card").forEach((c) => {
      const n = c.querySelector(".game-player-name")?.textContent.trim();
      if (n) cur[n] = !c.classList.contains("dead");
    });
    if (!Object.keys(cur).length) return;
    if (prevAlive) for (const n in cur) if (prevAlive[n] === true && cur[n] === false) {
      lastDeathT = Date.now();
      deathLog.push({ name: n, t: lastDeathT, done: false });
      killFx(n);
    }
    prevAlive = { ...(prevAlive || {}), ...cur };
  }

  /* ================= HƏDƏFƏ NİŞAN ================= */
  let aimName = null;
  const role = () => up($("myRoleName")?.textContent).trim();
  const isNight = () => isNightText($("gamePhase")?.textContent);
  function aimStyle() {
    if (!isNight()) return ["#ffb347", "ŞÜBHƏLİ"];
    return { "MAFIYA": ["#ff3b52", "HƏDƏF"], "HƏKIM": ["#3dd68c", "QORUNUR"], "DETEKTIV": ["#f0b13c", "ARAŞDIRILIR"] }[role()] || ["#ffb347", "SEÇİLDİ"];
  }
  function showPreview() {
    const [color, verb] = aimStyle();
    scr().style.setProperty("--aim", color);
    let p = $("fxPreview");
    if (!p) {
      p = document.createElement("div"); p.id = "fxPreview"; p.className = "fx-preview";
      $("gameActionBtn")?.insertAdjacentElement("beforebegin", p);
    }
    p.hidden = false; p.classList.remove("locked");
    p.innerHTML = `<div class="fx-av"><div class="fx-av-in">${avatar(who(aimName))}</div><i class="fx-ret"></i></div><b></b><small>${verb}</small>`;
    p.querySelector("b").textContent = aimName;
  }
  function markAim() {
    document.querySelectorAll("#gamePlayers .game-player-card").forEach((c) =>
      c.classList.toggle("is-aimed", !!aimName && c.querySelector(".game-player-name")?.textContent.trim() === aimName));
    const p = $("fxPreview");
    if (p && !p.hidden && !p.classList.contains("locked") && $("gameActionBtn")?.textContent.trim() === "GÖNDƏRİLDİ") {
      p.classList.add("locked"); sfx.lock(); navigator.vibrate?.(60);
    }
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest?.(".game-target-btn");
    if (!b) return;
    aimName = b.textContent.trim(); showPreview(); markAim(); sfx.tick();
  }, true);

  /* ================= FAZA BAŞLIĞI ================= */
  let lastKey = null;
  function checkPhase() {
    const r = $("gameRound")?.textContent.trim(), p = $("gamePhase")?.textContent.trim();
    if (!r || !p || r + p === lastKey) return;
    lastKey = r + p; aimName = null;
    const type = isNightText(p) ? "night" : isEndText(p) ? "end" : "day";
    console.log("[fx] faza:", r, "|", p, "→", type);

    if (type === "night") { deathLog.length = 0; morning = null; }          // yeni gecə: köhnə ölümləri sil
    if (prevType === "night" && type !== "night") morning = { t: Date.now(), round: r };   // gecə → səhər
    prevType = type;

    if ($("fxPreview")) $("fxPreview").hidden = true;
    if (type === "end") return title("OYUN BİTDİ", true);
    title(r, false, p, () => (type === "night" ? sfx.night() : sfx.day()));
  }

  /* ================= ATMOSFER ================= */
  const mute = document.createElement("button");
  mute.id = "fxMute"; mute.type = "button";
  const label = () => (mute.textContent = muted ? "SƏS: OFF" : "SƏS: ON");
  mute.addEventListener("click", () => { muted = !muted; localStorage.setItem("fxMute", muted ? "1" : "0"); label(); ac(); });
  label(); document.body.appendChild(mute);

  function particles() {
    if (!visible() || scr().querySelector(".fx-p")) return;
    const wrap = document.createElement("div");      // hissəciklər öz qutusunda kəsilir → səhifə uzanmır
    wrap.className = "fx-pwrap";
    for (let i = 0; i < 30; i++) {
      const s = document.createElement("span");
      s.className = "fx-p";
      s.style.cssText = `left:${Math.random() * 100}%;width:${1 + Math.random() * 3}px;height:${1 + Math.random() * 3}px;animation-duration:${8 + Math.random() * 14}s;animation-delay:${-Math.random() * 20}s`;
      wrap.appendChild(s);
    }
    scr().appendChild(wrap);
  }

  /* ================= GECƏ TAYMERİ (7 san, düymə lazım deyil) ================= */
  const NIGHT_MS = 7000;
  const nTimer = document.createElement("div");
  nTimer.id = "fxNightTimer"; nTimer.hidden = true;
  nTimer.innerHTML = "<span></span><div><i></i></div>";
  document.body.appendChild(nTimer);
  let nt = { key: null, end: 0, fired: 0 };

  function nightTimer() {
    if (!visible() || !isNight() || !lastKey) { nTimer.hidden = true; return; }
    if (nt.key !== lastKey) nt = { key: lastKey, end: 0, fired: 0 };
    if (!nt.end) {                       // başlıq animasiyaları bitəndən sonra başla
      if (fxBusy) { nTimer.hidden = true; return; }
      nt.end = Date.now() + NIGHT_MS;
    }
    const left = Math.max(0, nt.end - Date.now());
    nTimer.hidden = false;
    nTimer.querySelector("span").textContent = "GECƏ · " + Math.ceil(left / 1000);
    nTimer.querySelector("i").style.width = (left / NIGHT_MS) * 100 + "%";
    const host = $("gameHostControls") && !$("gameHostControls").hidden;
    if (left === 0 && host && Date.now() - nt.fired > 2500) {
      nt.fired = Date.now();
      $("finishNightBtn")?.click();      // yalnız host-un cihazı gecəni bağlayır
    }
  }
  setInterval(nightTimer, 200);

  /* gecə pərdəsini body-yə köçür: gameScreen-in transform/isolation-ından asılı olmasın */
  function liftCurtain() {
    const c = document.querySelector(".night-curtain");
    if (c && c.parentNode !== document.body) document.body.appendChild(c);
  }

  /* ================= ƏSAS DÖVR (observer + ehtiyat intervalı) ================= */
  function tick() {
    const v = visible();
    mute.hidden = !v;
    paint();
    if (!v) {
      prevAlive = null; lastKey = null; aimName = null; prevType = null; morning = null;
      deathLog.length = 0; resetTitles();
      return;
    }
    liftCurtain(); seatPlayers();
    particles(); checkPhase(); scanDeaths(); markAim();
  }
  new MutationObserver(tick).observe(document.body, { childList: true, subtree: true, characterData: true });
  setInterval(tick, 500);   // DOM dəyişməsə belə faza/ölüm yoxlansın
  paint();
})();
