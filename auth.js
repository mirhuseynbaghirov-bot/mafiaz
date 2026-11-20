
(() => {
  const SUPABASE_URL = "https://pgmjtimnnmcttdvfqcnw.supabase.co";
  const SUPABASE_KEY = "sb_publishable_o_Xk7py1CvvLlU3imqwiOA_ke2Rr-HU";

  const mafiaSupabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );

  const authModal = document.getElementById("modal");
  const authTitle = document.getElementById("modalTitle");
  const authDescription = document.getElementById("modalDescription");

  const authLoginBtn = document.getElementById("loginBtn");
  const authSignupBtn = document.getElementById("signupBtn");

  let profileButton = null;

  function openAuthModal(title, content) {
    authTitle.textContent = title;
    authDescription.innerHTML = content;
    authModal.classList.add("active");
  }

  function closeAuthModal() {
    authModal.classList.remove("active");
  }

  function updateNavbar(user) {
    if (user) {
      authLoginBtn.style.display = "none";
      authSignupBtn.style.display = "none";

      if (!profileButton) {
        profileButton = document.createElement("button");
        profileButton.className = "signup-btn";
        profileButton.id = "profileBtn";

        authSignupBtn.parentElement.insertBefore(
          profileButton,
          authSignupBtn
        );

        profileButton.addEventListener("click", showProfile);
      }

      profileButton.textContent =
        (user.user_metadata?.username || user.email?.split("@")[0] || "Player").toUpperCase();

      profileButton.style.display = "inline-block";

    } else {
      authLoginBtn.style.display = "";
      authSignupBtn.style.display = "";

      if (profileButton) {
        profileButton.style.display = "none";
      }
    }
  }

  async function showProfile() {
    const { data, error } = await mafiaSupabase.auth.getUser();

    if (error || !data.user) return;

    const user = data.user;
    const username =
      user.user_metadata?.username ||
      user.email?.split("@")[0] ||
      "Player";

    openAuthModal("OYUNÇU PROFİLİ", `
      <div style="text-align:center;padding:15px 0;">
        <div style="font-size:42px;">♟</div>
        <h3 id="profileUsername" style="color:#c6a15b;"></h3>
        <p id="profileEmail" style="color:#aaa;"></p>
        <button id="logoutBtn"
          style="width:100%;padding:13px;background:#8e2633;color:white;border:0;border-radius:8px;cursor:pointer;">
          HESABDAN ÇIX
        </button>
      </div>
    `);

    document.getElementById("profileUsername").textContent = username;
    document.getElementById("profileEmail").textContent = user.email || "";

    document.getElementById("logoutBtn").addEventListener("click", async () => {
      const { error } = await mafiaSupabase.auth.signOut();

      if (error) {
        alert(error.message);
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
        <form id="mafiaAuthForm" style="display:flex;flex-direction:column;gap:12px;text-align:left;">

          ${isSignup ? `
            <label>İstifadəçi adı</label>
            <input id="mafiaUsername" type="text"
              minlength="3" maxlength="20"
              placeholder="Player123" required>
          ` : ""}

          <label>E-poçt</label>
          <input id="mafiaEmail" type="email"
            placeholder="example@gmail.com" required>

          <label>Şifrə</label>
          <input id="mafiaPassword" type="password"
            minlength="8" placeholder="Ən azı 8 simvol" required>

          <button id="mafiaSubmit" type="submit"
            style="padding:13px;background:#8e2633;color:white;border:0;border-radius:8px;cursor:pointer;">
            ${isSignup ? "QEYDİYYATDAN KEÇ" : "DAXİL OL"}
          </button>

          <p id="mafiaMessage" style="font-size:13px;color:#c6a15b;text-align:center;"></p>
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
