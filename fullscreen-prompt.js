/* fullscreen-prompt.js — sayta daxil olanda tam ekran pop-up (CSS daxilidir) */
(() => {
  "use strict";

  // Google girişindən yenicə qayıdıbsa, pop-up göstərmə (giriş/ad pəncərəsinə mane olmasın)
  try {
    if (sessionStorage.getItem("mafiaOAuthReturn")) {
      sessionStorage.removeItem("mafiaOAuthReturn");
      return;
    }
  } catch (e) { /* ignore */ }

  const root = document.documentElement;
  const canFs = !!(root.requestFullscreen || root.webkitRequestFullscreen);
  const standalone =
    window.navigator.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches;

  // artıq tam ekrandır / ana ekrandan açılıb → göstərmə
  if (standalone || document.fullscreenElement) return;

  const style = document.createElement("style");
  style.textContent = `
    #fsPrompt{position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;z-index:9999;display:grid;place-items:center;
      padding:30px;text-align:center;color:#f0e0b8;
      background:radial-gradient(ellipse at 50% 35%,rgba(152,43,61,.35),transparent 60%),#07070a;
      animation:fsIn .45s both}
    #fsPrompt[hidden]{display:none}
    @keyframes fsIn{from{opacity:0}}
    #fsPrompt .fs-x{position:absolute;left:14px;top:max(14px,env(safe-area-inset-top));width:46px;height:46px;
      display:grid;place-items:center;border:1px solid rgba(198,161,91,.5);background:rgba(0,0,0,.5);
      color:#f0e0b8;font:300 30px/1 sans-serif;border-radius:50%;cursor:pointer;padding:0}
    #fsPrompt .fs-ic{width:84px;height:84px;margin:0 auto 22px;color:#c6a15b;filter:drop-shadow(0 0 14px rgba(198,161,91,.5))}
    #fsPrompt h2{max-width:520px;margin:0 auto;font:700 clamp(24px,6.5vw,38px)/1.3 "Oswald",sans-serif;letter-spacing:2px;text-transform:uppercase}
    #fsPrompt p{max-width:420px;margin:14px auto 0;font:13px/1.6 "Special Elite",monospace;letter-spacing:1px;color:#8b8590}
    #fsPrompt .fs-go{margin-top:30px;padding:16px 34px;border:1px solid #c44455;background:rgba(196,68,85,.18);color:#fff;
      font:700 16px "Oswald",sans-serif;letter-spacing:4px;text-transform:uppercase;cursor:pointer;border-radius:0;
      clip-path:polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px)}
  `;
  document.head.appendChild(style);

  const box = document.createElement("div");
  box.id = "fsPrompt";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");
  box.innerHTML = `
    <button type="button" class="fs-x" aria-label="Bağla">×</button>
    <div>
      <svg class="fs-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>
      </svg>
      <h2>Oyunu daha yaxşı hiss etmək üçün tam ekran edin</h2>
      <p class="fs-hint"></p>
      <button type="button" class="fs-go"></button>
    </div>`;
  document.body.appendChild(box);

  const go = box.querySelector(".fs-go");
  const hint = box.querySelector(".fs-hint");
  const close = () => box.remove();

  if (canFs) {
    go.textContent = "TAM EKRAN ET";
    hint.textContent = "İstədiyin an yuxarı sol küncdəki × ilə bağlaya bilərsən.";
    go.addEventListener("click", async () => {
      try {
        await (root.requestFullscreen
          ? root.requestFullscreen({ navigationUI: "hide" })
          : root.webkitRequestFullscreen());
      } catch (e) { console.warn("Tam ekran açılmadı:", e); }
      close();
    });
  } else {
    // iPhone Safari səhifəni birbaşa tam ekran etməyə icazə vermir
    go.textContent = "BAŞA DÜŞDÜM";
    hint.textContent = "iPhone-da: Paylaş düyməsinə bas → «Ana ekrana əlavə et». Oyunu oradan aç, tam ekran olacaq.";
    go.addEventListener("click", close);
  }

  box.querySelector(".fs-x").addEventListener("click", close);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
})();
