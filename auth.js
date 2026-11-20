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
          style="width:100%;padding:13px;margin-top:12px;background:#8e2633;color:white;border:0;border-radius:8px;cursor:pointer;">
          HESABDAN ÇIX
        </button>
        <p id="profileMessage" style="font-size:13px;color:#c6a15b;"></p>
      </div>
    `);

    document.getElementById("profileUsername").textContent = username;
    document.getElementById("profileEmail").textContent = user.email || "";

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
