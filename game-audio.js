/* game-audio.js — game-fx.js-dən SONRA yüklə
   Gecə: caz · Gündüz: gərgin fon · Səsvermə: ürək döyüntüsü (vaxt azaldıqca sürətlənir)
   Fayl lazım deyil — hamısı WebAudio ilə canlı yaradılır. */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const up = (s) => (s || "").toLocaleUpperCase("az-AZ").replace(/İ/g, "I");
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

  let ctx = null, master = null, mode = "off";
  const layer = {};                         // night / day / vote gain düyünləri
  let nextBeat = 0, beatNo = 0, nextTick = 0, nextStab = 0, nextHeart = 0;
  let drone = null;

  const musicOn = () => localStorage.getItem("fxMute") !== "1" && localStorage.getItem("musicOff") !== "1";

  function init() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
    const A = window.AudioContext || window.webkitAudioContext;
    if (!A) return;
    ctx = new A();
    master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
    ["night", "day", "vote"].forEach((k) => { layer[k] = ctx.createGain(); layer[k].gain.value = 0; layer[k].connect(master); });
    buildDrone();
    setInterval(schedule, 100);
  }
  document.addEventListener("pointerdown", init, { once: true });
  document.addEventListener("keydown", init, { once: true });

  /* ---------- gündüz fonu: aşağı gərgin drone ---------- */
  function buildDrone() {
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 260; lp.Q.value = 4;
    const g = ctx.createGain(); g.gain.value = 0.5;
    [[38, 0], [45, 7], [50, -5]].forEach(([m, det]) => {
      const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = hz(m); o.detune.value = det;
      o.connect(lp); o.start();
    });
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = 0.12; lg.gain.value = 90; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
    lp.connect(g); g.connect(layer.day);
    drone = g;
  }

  /* ---------- səs bloklarının köməkçiləri ---------- */
  function tone(out, m, t, dur, vol, type = "triangle") {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = hz(m);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
  }
  function noiseHit(out, t, dur, vol, freq) {
    const n = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = buf; f.type = "highpass"; f.frequency.value = freq; g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(out); s.start(t);
  }

  /* ---------- GECƏ: caz (ii–V–I–VI, yellənən bas, yumşaq akkordlar, təsadüfi solo) ---------- */
  const BAR = [
    { root: 38, ch: [38, 41, 45, 48] },   // Dm7
    { root: 43, ch: [43, 47, 50, 53] },   // G7
    { root: 36, ch: [36, 40, 43, 47] },   // Cmaj7
    { root: 33, ch: [33, 37, 40, 43] }    // A7
  ];
  const SCALE = [62, 65, 67, 69, 72, 74, 77];   // D minor pentatonik-ə yaxın
  let lastSolo = 69;

  function jazzBeat(t, beat, spb) {
    const out = layer.night, bar = BAR[Math.floor(beat / 4) % 4], b = beat % 4;
    const next = BAR[(Math.floor(beat / 4) + 1) % 4];
    const bass = [bar.root, bar.ch[1], bar.ch[2], next.root - 1][b];
    tone(out, bass + (bass < 33 ? 12 : 0), t, spb * 0.9, 0.5, "sine");
    // rəqs ritmi: yellənən hi-hat
    noiseHit(out, t, 0.05, 0.05, 7000);
    noiseHit(out, t + spb * 0.66, 0.04, 0.03, 7500);
    // akkord: 1-ci vuruş və 2-nin "və"-si
    if (b === 0 || b === 2) bar.ch.forEach((m, i) => tone(out, m + 24, t + (b === 2 ? spb * 0.66 : 0), spb * 1.4, 0.07 - i * 0.008, "triangle"));
    // solo notu (bəzən)
    if (Math.random() < 0.38) {
      let i = SCALE.indexOf(lastSolo); if (i < 0) i = 3;
      i = Math.max(0, Math.min(SCALE.length - 1, i + (Math.random() < 0.5 ? -1 : 1) * (1 + Math.floor(Math.random() * 2))));
      lastSolo = SCALE[i];
      tone(out, lastSolo, t + (Math.random() < 0.5 ? 0 : spb * 0.66), spb * (0.6 + Math.random() * 0.8), 0.09, "sine");
    }
  }

  /* ---------- GÜNDÜZ: saat tıqqıltısı + dissonant zərbə ---------- */
  function dayTick(t) {
    noiseHit(layer.day, t, 0.03, 0.12, 3000);
    tone(layer.day, 96, t, 0.05, 0.05, "square");
  }
  function stab(t) {
    const base = 50 + Math.floor(Math.random() * 5);
    [base, base + 1, base + 7].forEach((m) => tone(layer.day, m + 12, t, 1.6, 0.05, "sawtooth"));
  }

  /* ---------- SƏSVERMƏ: ürək döyüntüsü ---------- */
  function heart(t) {
    [[0, 0.9], [0.17, 0.6]].forEach(([dt, v]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.setValueAtTime(95, t + dt); o.frequency.exponentialRampToValueAtTime(42, t + dt + 0.12);
      g.gain.setValueAtTime(v, t + dt); g.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.22);
      o.connect(g); g.connect(layer.vote); o.start(t + dt); o.stop(t + dt + 0.25);
    });
  }

  /* ---------- rejim təyini (DOM-dan oxuyur, başqa fayla toxunmur) ---------- */
  function detectMode() {
    const scr = $("gameScreen");
    if (!scr || scr.hidden) return "off";
    const p = up($("gamePhase")?.textContent);
    if (p.includes("BITDI")) return "off";
    if (p.includes("GECE")) return "night";
    const vt = $("voteTimer");
    return vt && vt.classList.contains("voting") ? "vote" : "day";
  }

  function voteFraction() {                 // 1 = vaxt təzə başlayıb, 0 = bitib
    const w = parseFloat($("voteTimer")?.querySelector("i")?.style.width);
    return Number.isFinite(w) ? Math.max(0, Math.min(1, w / 100)) : 1;
  }

  function fade() {
    const on = musicOn();
    const target = {
      night: on && mode === "night" ? 0.9 : 0,
      day: on && (mode === "day" || mode === "vote") ? (mode === "vote" ? 0.25 : 0.55) : 0,
      vote: on && mode === "vote" ? 1 : 0
    };
    for (const k in layer) layer[k].gain.setTargetAtTime(target[k], ctx.currentTime, 0.6);
  }

  function schedule() {
    if (!ctx) return;
    const m = detectMode();
    if (m !== mode) {
      mode = m;
      const now = ctx.currentTime;
      nextBeat = nextTick = nextHeart = now + 0.1; nextStab = now + 4; beatNo = 0;
    }
    fade();
    if (!musicOn() || mode === "off" || ctx.state !== "running") return;

    const now = ctx.currentTime, ahead = now + 0.35;

    if (mode === "night") {
      const spb = 60 / 84;
      while (nextBeat < ahead) { jazzBeat(nextBeat, beatNo, spb); beatNo++; nextBeat += spb; }
    } else {
      while (nextTick < ahead) { dayTick(nextTick); nextTick += 1; }
      if (nextStab < ahead) { stab(nextStab); nextStab += 7 + Math.random() * 6; }
      if (mode === "vote") {
        const bpm = 72 + (1 - voteFraction()) * 78;     // 72 → 150
        while (nextHeart < ahead) { heart(nextHeart); nextHeart += 60 / bpm; }
      }
    }
  }

  /* ---------- MUSİQİ düyməsi ---------- */
  const btn = document.createElement("button");
  btn.id = "musicToggle"; btn.type = "button";
  const label = () => (btn.textContent = localStorage.getItem("musicOff") === "1" ? "MUSİQİ: OFF" : "MUSİQİ: ON");
  btn.addEventListener("click", () => {
    localStorage.setItem("musicOff", localStorage.getItem("musicOff") === "1" ? "0" : "1");
    label(); init();
  });
  label();
  document.body.appendChild(btn);
  setInterval(() => { const s = $("gameScreen"); btn.hidden = !s || s.hidden; }, 500);
})();
