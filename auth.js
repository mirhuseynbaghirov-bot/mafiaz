(() => {
  "use strict";

  /* Supabase client app.js-dən götürülür (iki ayrı client yaranmasın deyə) */
  const mafiaSupabase = window.mafiaDB;

  if (!mafiaSupabase) {
    console.error("Supabase client tapılmadı. app.js düzgün yüklənməyib.");
    return;
  }

  const authModal = document.getElementById("modal");
  const authTitle = document.getElementById("modalTitle");
  const authDescription = document.getElementById("modalDescription");
  const authLoginBtn = document.getElementById("loginBtn");
  const authSignupBtn = document.getElementById("signupBtn");

  let profileButton = null;

  /* =========================================
     STYLES (Google düyməsi, "və ya" xətti)
  ========================================= */

  function addAuthStyles() {
    if (document.getElementById("mafiaAuthStyles")) return;

    const style = document.createElement("style");
    style.id = "mafiaAuthStyles";

    style.textContent = `
      .google-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        width: 100%;
        min-height: 48px;
        padding: 0 18px;
        border: 1px solid #dadce0;
        border-radius: 4px;
        background: #ffffff;
        color: #3c4043;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: .3px;
        cursor: pointer;
        transition: .2s ease;
      }

      .google-btn:hover:not(:disabled) {
        background: #f6f7f8;
        box-shadow: 0 4px 18px rgba(255,255,255,.12);
        transform: translateY(-2px);
      }

      .google-btn:disabled {
        opacity: .6;
        cursor: not-allowed;
      }

      .google-btn svg {
        width: 20px;
        height: 20px;
        flex-shrink: 0;
      }

      .auth-divider {
        display: flex;
        align-items: center;
        gap: 12px;
        margin: 18px 0;
        color: #77717a;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 2px;
        text-transform: uppercase;
      }

      .auth-divider::before,
      .auth-divider::after {
        content: "";
        flex: 1;
        height: 1px;
        background: rgba(255,255,255,.12);
      }

      .auth-hint {
        margin: 0 0 6px;
        color: #aaa2a4;
        font-size: 12px;
        line-height: 1.7;
        text-align: center;
      }

      .auth-link-btn {
        margin-top: 4px;
        padding: 8px;
        background: transparent;
        border: none;
        color: #99939b;
        font-size: 11px;
        text-decoration: underline;
        cursor: pointer;
      }

      .auth-link-btn:hover {
        color: #e27b88;
      }

      /* Ad seçimi: öz ayrıca pəncərəsi (digər skriptlərin modalından asılı deyil) */
      .username-overlay {
        position: fixed;
        inset: 0;
        z-index: 2147483000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        background: rgba(0,0,0,.88);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
      }

      .username-box {
        width: 100%;
        max-width: 420px;
        max-height: 90vh;
        overflow-y: auto;
        padding: 40px 30px;
        background: linear-gradient(145deg, #211e24, #131218);
        border: 1px solid rgba(198,161,91,.28);
        border-radius: 6px;
        text-align: center;
        box-shadow: 0 25px 80px rgba(0,0,0,.6);
      }

      .username-icon {
        color: #c6a15b;
        font-size: 43px;
      }

      .username-box h2 {
        margin: 18px 0 16px;
        color: #eee9e1;
        font-family: 'Cinzel', serif;
        font-size: 23px;
      }
    `;

    document.head.appendChild(style);
  }

  addAuthStyles();

  /* =========================================
     MODAL
  ========================================= */

  function openAuthModal(title, content) {
    authTitle.textContent = title;
    authDescription.replaceChildren();

    const wrapper = document.createElement("div");
    wrapper.innerHTML = content;
    authDescription.appendChild(wrapper);

    authModal.classList.add("active");
  }

  function closeAuthModal() {
    authModal.classList.remove("active");
  }

  /* =========================================
     USERNAME HELPERS
  ========================================= */

  // Yalnız istifadəçinin özünün seçdiyi ad göstərilir.
  // (Google adı və ya e-poçt prefiksi göstərilmir ki, təsadüfi ad görünməsin.)
  function getChosenUsername(user) {
    return user?.user_metadata?.username?.trim() || "";
  }

  function getDisplayName(user) {
    return getChosenUsername(user) || "Player";
  }

  function validateUsername(value) {
    if (!value || value.length < 3) {
      return "Ad ən azı 3 simvol olmalıdır.";
    }

    if (value.length > 20) {
      return "Ad ən çox 20 simvol ola bilər.";
    }

    if (!/^[\p{L}\p{N}_.\- ]+$/u.test(value)) {
      return "Ad yalnız hərf, rəqəm, boşluq, _ . - simvollarından ibarət ola bilər.";
    }

    return null;
  }

  /* =========================================
     GOOGLE LOGIN
  ========================================= */

  const GOOGLE_ICON = `
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  `;

  function googleButtonHTML(label) {
    return `
      <button id="googleAuthBtn" type="button" class="google-btn">
        ${GOOGLE_ICON}
        <span>${label}</span>
      </button>
      <div class="auth-divider">və ya e-poçt ilə</div>
    `;
  }

  async function signInWithGoogle() {
    const button = document.getElementById("googleAuthBtn");
    const message = document.getElementById("mafiaMessage");
    const label = button?.querySelector("span");
    const originalLabel = label?.textContent;

    if (button) button.disabled = true;
    if (label) label.textContent = "Google-a yönləndirilir...";
    if (message) message.textContent = "";

    try {
      const { error } = await mafiaSupabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
          queryParams: { prompt: "select_account" }
        }
      });

      if (error) throw error;
      // Uğurlu olarsa brauzer Google səhifəsinə yönləndirilir.
    } catch (error) {
      console.error("Google giriş xətası:", error);

      if (message) {
        message.textContent =
          error.message || "Google ilə giriş alınmadı. Yenidən cəhd edin.";
      }

      if (button) button.disabled = false;
      if (label && originalLabel) label.textContent = originalLabel;
    }
  }

  /* =========================================
     USERNAME PROMPT (Google girişindən sonra)
  ========================================= */

  function needsUsername(user) {
    if (!user) return false;
    return !getChosenUsername(user);
  }

  function closeUsernamePrompt() {
    document.getElementById("mafiaUsernameOverlay")?.remove();
  }

  function openUsernamePrompt() {
    if (document.getElementById("mafiaUsernameOverlay")) return; // artıq açıqdır

    const overlay = document.createElement("div");
    overlay.id = "mafiaUsernameOverlay";
    overlay.className = "username-overlay";

    overlay.innerHTML = `
      <div class="username-box" role="dialog" aria-modal="true">
        <span class="username-icon">♛</span>
        <h2>ADINI SEÇ</h2>

        <form id="mafiaUsernameForm" class="room-form">
          <p class="auth-hint">
            Hesabın təsdiqləndi ✓<br>
            Oyunda görünəcək adını özün seç.
          </p>

          <label for="mafiaChosenUsername">İstifadəçi adı</label>
          <input id="mafiaChosenUsername" type="text"
            minlength="3" maxlength="20"
            placeholder="Məsələn: GecəŞahı"
            autocomplete="off" required>

          <p id="mafiaUsernameMessage" class="room-form-message"></p>

          <button id="mafiaUsernameSubmit" type="submit" class="modal-action-btn">
            DAVAM ET
          </button>

          <button id="mafiaUsernameLogout" type="button" class="auth-link-btn">
            Hesabdan çıx
          </button>
        </form>
      </div>
    `;

    document.body.appendChild(overlay);

    const input = document.getElementById("mafiaChosenUsername");
    input?.focus();

    document
      .getElementById("mafiaUsernameForm")
      .addEventListener("submit", async (event) => {
        event.preventDefault();

        const username = input.value.trim();
        const message = document.getElementById("mafiaUsernameMessage");
        const button = document.getElementById("mafiaUsernameSubmit");

        const validationError = validateUsername(username);

        if (validationError) {
          message.textContent = validationError;
          return;
        }

        button.disabled = true;
        button.textContent = "GÖZLƏ...";
        message.textContent = "";

        try {
          const { data, error } = await mafiaSupabase.auth.updateUser({
            data: { username }
          });

          if (error) throw error;

          updateNavbar(data.user);
          closeUsernamePrompt();
        } catch (error) {
          console.error("Ad yadda saxlanmadı:", error);
          message.textContent =
            error.message || "Ad yadda saxlanmadı. Yenidən cəhd edin.";
          button.disabled = false;
          button.textContent = "DAVAM ET";
        }
      });

    document
      .getElementById("mafiaUsernameLogout")
      .addEventListener("click", async () => {
        await mafiaSupabase.auth.signOut();
        closeUsernamePrompt();
      });
  }

  function checkUsernameRequirement(user) {
    if (needsUsername(user)) {
      // onAuthStateChange içindən birbaşa UI açmamaq üçün
      setTimeout(openUsernamePrompt, 0);
    }
  }

  /* =========================================
     NAVBAR
  ========================================= */

  function updateNavbar(user) {
    authLoginBtn.hidden = !!user;
    authSignupBtn.hidden = !!user;

    if (user && !profileButton) {
      profileButton = document.createElement("button");
      profileButton.className = "signup-btn";
      profileButton.id = "profileBtn";

      authSignupBtn.parentElement.insertBefore(
        profileButton,
        authSignupBtn
      );

      profileButton.addEventListener("click", showProfile);
    }

    if (profileButton) {
      profileButton.hidden = !user;

      if (user) {
        profileButton.textContent = getDisplayName(user).toUpperCase();
      }
    }
  }

  /* ---------- EXP / SƏVİYYƏ ---------- */
  // Səviyyə N üçün lazım olan EXP: 100 × (N−1)²   (SQL-dəki düsturla eynidir)
  const levelOf = (exp) => Math.floor(Math.sqrt(Math.max(0, exp) / 100)) + 1;
  const expFloor = (lvl) => 100 * (lvl - 1) * (lvl - 1);
  const RANKS = [
    [1, "XƏBƏRÇİ"], [3, "SOLDATO"], [5, "KAPO"], [8, "KONSİLYERİ"], [12, "ƏRKAN"]
  ];
  const rankOf = (lvl) => RANKS.filter(([min]) => lvl >= min).pop()[1];
  const ROLE_AZ = { mafia: "Mafiya", doctor: "Həkim", detective: "Detektiv", civilian: "Mülki sakin", maniac: "Manyak" };

  async function loadProfileStats(userId) {
    const out = { exp: 0, games: 0, wins: 0, survived: 0, mafiaGames: 0, mafiaWins: 0, recent: [], ok: true };

    const [statsRes, awardsRes] = await Promise.all([
      mafiaSupabase.from("player_stats").select("exp").eq("user_id", userId).maybeSingle(),
      mafiaSupabase.from("exp_awards").select("role,won,survived,exp_gained,created_at")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(200)
    ]);

    if (statsRes.error || awardsRes.error) {
      console.warn("Statistika oxunmadı (mafia-update.sql işlədilib?)");
      out.ok = false;
      return out;
    }

    const rows = awardsRes.data || [];
    out.exp = statsRes.data?.exp || 0;
    out.games = rows.length;
    out.wins = rows.filter((r) => r.won).length;
    out.survived = rows.filter((r) => r.survived).length;
    out.mafiaGames = rows.filter((r) => r.role === "mafia").length;
    out.mafiaWins = rows.filter((r) => r.role === "mafia" && r.won).length;
    out.recent = rows.slice(0, 5);
    return out;
  }

  function profileStatsHTML(st) {
    const lvl = levelOf(st.exp);
    const lo = expFloor(lvl), hi = expFloor(lvl + 1);
    const pct = Math.min(100, Math.round(((st.exp - lo) / (hi - lo)) * 100));
    const losses = st.games - st.wins;
    const rate = st.games ? Math.round((st.wins / st.games) * 100) : 0;
    const cell = (v, l) => `<div class="pf-cell"><b>${v}</b><span>${l}</span></div>`;

    const recent = st.recent.length
      ? st.recent.map((r) => `
          <li class="${r.won ? "win" : "loss"}">
            <span>${r.won ? "QƏLƏBƏ" : "MƏĞLUBİYYƏT"}</span>
            <em>${ROLE_AZ[r.role] || r.role || "?"}</em>
            <strong>+${r.exp_gained} EXP</strong>
          </li>`).join("")
      : '<li class="empty">Hələ bitmiş oyun yoxdur.</li>';

    return `
      <div class="pf-level">
        <div class="pf-badge"><small>LVL</small><b>${lvl}</b></div>
        <div class="pf-rank">
          <strong>${rankOf(lvl)}</strong>
          <div class="pf-bar"><i style="width:${pct}%"></i></div>
          <span>${st.exp} / ${hi} EXP</span>
        </div>
      </div>
      <div class="pf-grid">
        ${cell(st.games, "OYUN")}
        ${cell(st.wins, "QƏLƏBƏ")}
        ${cell(losses, "MƏĞLUBİYYƏT")}
        ${cell(rate + "%", "QƏLƏBƏ %")}
        ${cell(st.survived, "SAĞ QALDI")}
        ${cell(st.mafiaWins + "/" + st.mafiaGames, "MAFİYA QƏLƏBƏ")}
      </div>
      <div class="pf-recent">
        <span class="pf-title">SON OYUNLAR</span>
        <ul>${recent}</ul>
      </div>
      ${st.ok ? "" : '<p class="pf-note">Statistika hələ aktiv deyil (mafia-update.sql işlədilməyib).</p>'}`;
  }

  async function showProfile() {
    const { data, error } = await mafiaSupabase.auth.getUser();

    if (error || !data.user) return;

    const user = data.user;
    const username = getDisplayName(user);

    const joined = user.created_at
      ? new Date(user.created_at).toLocaleDateString("az-AZ", { year: "numeric", month: "long", day: "numeric" })
      : "";

    openAuthModal("OYUNÇU PROFİLİ", `
      <div style="text-align:center;padding:15px 0;">
        <div style="font-size:42px;">♟</div>
        <h3 id="profileUsername" style="color:#c6a15b;"></h3>
        <p id="profileEmail" style="color:#aaa;"></p>
        ${joined ? `<p class="pf-joined">Üzv olub: ${joined}</p>` : ""}

        <div id="profileStats" class="pf-stats"><p class="pf-note">Statistika yüklənir...</p></div>

        <button id="logoutBtn"
          style="width:100%;padding:13px;margin-top:12px;background:#8e2633;color:white;border:0;border-radius:8px;cursor:pointer;">
          HESABDAN ÇIX
        </button>
        <p id="profileMessage" style="font-size:13px;color:#c6a15b;"></p>
      </div>
    `);

    document.getElementById("profileUsername").textContent = username;
    document.getElementById("profileEmail").textContent = user.email || "";

    loadProfileStats(user.id).then((st) => {
      const box = document.getElementById("profileStats");
      if (box) box.innerHTML = profileStatsHTML(st);
    });

    document.getElementById("logoutBtn").addEventListener("click", async () => {
      const button = document.getElementById("logoutBtn");
      const message = document.getElementById("profileMessage");

      button.disabled = true;
      button.textContent = "GÖZLƏ...";

      const { error } = await mafiaSupabase.auth.signOut();

      if (error) {
        message.textContent = error.message;
        button.disabled = false;
        button.textContent = "HESABDAN ÇIX";
        return;
      }

      closeAuthModal();
    });
  }

  /* =========================================
     LOGIN / SIGNUP FORM
  ========================================= */

  function openAuth(type) {
    const isSignup = type === "signup";

    openAuthModal(
      isSignup ? "HESAB YARAT" : "DAXİL OL",
      `
        ${googleButtonHTML(
          isSignup ? "Google ilə qeydiyyatdan keç" : "Google ilə daxil ol"
        )}

        <form id="mafiaAuthForm">
          ${isSignup ? `
            <label for="mafiaUsername">İstifadəçi adı</label>
            <input id="mafiaUsername" type="text"
              minlength="3" maxlength="20"
              placeholder="Player123" required>
          ` : ""}

          <label for="mafiaEmail">E-poçt</label>
          <input id="mafiaEmail" type="email"
            placeholder="example@gmail.com" required>

          <label for="mafiaPassword">Şifrə</label>
          <input id="mafiaPassword" type="password"
            minlength="8" placeholder="Ən azı 8 simvol" required>

          <button id="mafiaSubmit" type="submit" class="modal-action-btn">
            ${isSignup ? "QEYDİYYATDAN KEÇ" : "DAXİL OL"}
          </button>

          <p id="mafiaMessage" class="room-form-message"></p>
        </form>
      `
    );

    document
      .getElementById("googleAuthBtn")
      .addEventListener("click", signInWithGoogle);

    document.getElementById("mafiaAuthForm").addEventListener("submit", async (event) => {
      event.preventDefault();

      const email = document.getElementById("mafiaEmail").value.trim();
      const password = document.getElementById("mafiaPassword").value;
      const username = document.getElementById("mafiaUsername")?.value.trim();

      const button = document.getElementById("mafiaSubmit");
      const message = document.getElementById("mafiaMessage");

      button.disabled = true;
      button.textContent = "GÖZLƏ...";
      message.textContent = "";

      try {
        if (isSignup) {
          const usernameError = validateUsername(username);
          if (usernameError) throw new Error(usernameError);

          const { data, error } = await mafiaSupabase.auth.signUp({
            email,
            password,
            options: {
              data: { username },
              emailRedirectTo: window.location.origin
            }
          });

          if (error) throw error;

          if (data.session) {
            message.textContent = "Qeydiyyat uğurludur!";
            updateNavbar(data.user);
            setTimeout(closeAuthModal, 1000);
          } else {
            message.textContent =
              "Hesab yaradıldı! E-poçtunu təsdiqlə, sonra daxil ol.";
          }
        } else {
          const { data, error } = await mafiaSupabase.auth.signInWithPassword({
            email,
            password
          });

          if (error) throw error;

          updateNavbar(data.user);
          message.textContent = "Giriş uğurludur!";

          setTimeout(closeAuthModal, 1000);
        }
      } catch (error) {
        message.textContent = error.message;
      } finally {
        button.disabled = false;
        button.textContent = isSignup ? "QEYDİYYATDAN KEÇ" : "DAXİL OL";
      }
    });
  }

  /* =========================================
     EVENTS
  ========================================= */

  authLoginBtn.addEventListener("click", () => openAuth("login"));
  authSignupBtn.addEventListener("click", () => openAuth("signup"));

  authModal.addEventListener("click", (event) => {
    if (event.target === authModal) closeAuthModal();
  });

  document.getElementById("modalClose").addEventListener("click", closeAuthModal);

  mafiaSupabase.auth.onAuthStateChange((event, session) => {
    const user = session?.user || null;

    // Çıxış edilibsə, ad seçimi pəncərəsini bağla
    if (!user) closeUsernamePrompt();

    updateNavbar(user);
    checkUsernameRequirement(user);
  });

  async function initializeAuth() {
    const { data, error } = await mafiaSupabase.auth.getSession();

    if (error) {
      console.error("Auth error:", error.message);
      return;
    }

    const user = data.session?.user || null;

    updateNavbar(user);
    checkUsernameRequirement(user);
  }

  initializeAuth();

  console.log("MAFIA AUTH READY");
})();
