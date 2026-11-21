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
        const username =
          user.user_metadata?.username ||
          user.email?.split("@")[0] ||
          "Player";

        profileButton.textContent = username.toUpperCase();
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
    const username =
      user.user_metadata?.username ||
      user.email?.split("@")[0] ||
      "Player";

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

  function openAuth(type) {
    const isSignup = type === "signup";

    openAuthModal(
      isSignup ? "HESAB YARAT" : "DAXİL OL",
      `
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

  authLoginBtn.addEventListener("click", () => openAuth("login"));
  authSignupBtn.addEventListener("click", () => openAuth("signup"));

  authModal.addEventListener("click", (event) => {
    if (event.target === authModal) closeAuthModal();
  });

  document.getElementById("modalClose").addEventListener("click", closeAuthModal);

  mafiaSupabase.auth.onAuthStateChange((event, session) => {
    updateNavbar(session?.user || null);
  });

  async function initializeAuth() {
    const { data, error } = await mafiaSupabase.auth.getSession();

    if (error) {
      console.error("Auth error:", error.message);
      return;
    }

    updateNavbar(data.session?.user || null);
  }

  initializeAuth();

  console.log("MAFIA AUTH READY");
})();
