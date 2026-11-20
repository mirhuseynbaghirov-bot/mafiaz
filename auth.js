
const SUPABASE_URL = "https://pgmjtimnnmcttdvfqcnw.supabase.co";
const SUPABASE_KEY = "sb_publishable_o_Xk7py1CvvLlU3imqwiOA_ke2Rr-HU";

const mafiaSupabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modalTitle");
const modalDescription = document.getElementById("modalDescription");
const modalClose = document.getElementById("modalClose");

const loginBtn = document.getElementById("loginBtn");
const signupBtn = document.getElementById("signupBtn");

let profileButton;

function showAuthModal(title, content) {
  modalTitle.textContent = title;
  modalDescription.innerHTML = content;
  modal.classList.add("active");
}

function closeAuthModal() {
  modal.classList.remove("active");
}

modalClose?.addEventListener("click", closeAuthModal);

modal?.addEventListener("click", (event) => {
  if (event.target === modal) closeAuthModal();
});

function updateNavbar(user) {
  if (user) {
    loginBtn.style.display = "none";
    signupBtn.style.display = "none";

    if (!profileButton) {
      profileButton = document.createElement("button");
      profileButton.id = "profileBtn";
      profileButton.className = "btn btn-primary";
      profileButton.textContent = "PROFİL";

      signupBtn.parentElement.insertBefore(
        profileButton,
        signupBtn
      );

      profileButton.addEventListener("click", showProfile);
    }

    profileButton.style.display = "inline-flex";

    const username =
      user.user_metadata?.username ||
      user.email?.split("@")[0] ||
      "Player";

    profileButton.textContent = username.toUpperCase();

  } else {
    loginBtn.style.display = "";
    signupBtn.style.display = "";

    if (profileButton) {
      profileButton.style.display = "none";
    }
  }
}

function showProfile() {
  mafiaSupabase.auth.getUser().then(({ data, error }) => {
    if (error || !data.user) return;

    const user = data.user;
    const username =
      user.user_metadata?.username ||
      user.email?.split("@")[0] ||
      "Player";

    showAuthModal("OYUNÇU PROFİLİ", `
      <div style="text-align:center;padding:15px 0;">
        <div style="font-size:42px;margin-bottom:12px;">♟</div>
        <h3 style="color:#c6a15b;">${username.replace(/[&<>"']/g, "")}</h3>
        <p style="color:#aaa;margin:12px 0;">${user.email}</p>
        <button id="logoutBtn"
          style="width:100%;padding:13px;background:#8e2633;color:white;border:0;border-radius:8px;cursor:pointer;">
          HESABDAN ÇIX
        </button>
      </div>
    `);

    document.getElementById("logoutBtn").addEventListener("click", async () => {
      const { error } = await mafiaSupabase.auth.signOut();

      if (error) {
        alert(error.message);
        return;
      }

      closeAuthModal();
    });
  });
}

function openAuth(type) {
  const isSignup = type === "signup";

  showAuthModal(
    isSignup ? "HESAB YARAT" : "DAXİL OL",
    `
      <form id="authForm" style="display:flex;flex-direction:column;gap:12px;text-align:left;">

        ${isSignup ? `
          <label>İstifadəçi adı</label>
          <input id="authUsername" type="text" minlength="3" maxlength="20"
            placeholder="Player123" required>
        ` : ""}

        <label>E-poçt</label>
        <input id="authEmail" type="email"
          placeholder="example@gmail.com" required>

        <label>Şifrə</label>
        <input id="authPassword" type="password"
          minlength="8" placeholder="Ən azı 8 simvol" required>

        <button id="authSubmit" type="submit"
          style="padding:13px;background:#8e2633;color:white;border:0;border-radius:8px;cursor:pointer;">
          ${isSignup ? "QEYDİYYATDAN KEÇ" : "DAXİL OL"}
        </button>

        <p id="authMessage" style="font-size:13px;color:#c6a15b;text-align:center;"></p>
      </form>
    `
  );

  const form = document.getElementById("authForm");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("authEmail").value.trim();
    const password = document.getElementById("authPassword").value;
    const username = document.getElementById("authUsername")?.value.trim();

    const button = document.getElementById("authSubmit");
    const message = document.getElementById("authMessage");

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
          updateNavbar(data.session.user);
        } else {
          message.textContent =
            "Hesab yaradıldı! E-poçtunu təsdiqlə, sonra Daxil ol düyməsindən istifadə et.";
        }

      } else {
        const { data, error } =
          await mafiaSupabase.auth.signInWithPassword({
            email,
            password
          });

        if (error) throw error;

        updateNavbar(data.user);
        message.textContent = "Giriş uğurludur!";

        setTimeout(closeAuthModal, 900);
      }

    } catch (error) {
      message.textContent = error.message;
    } finally {
      button.disabled = false;
      button.textContent = isSignup ? "QEYDİYYATDAN KEÇ" : "DAXİL OL";
    }
  });
}

loginBtn?.addEventListener("click", () => openAuth("login"));
signupBtn?.addEventListener("click", () => openAuth("signup"));

mafiaSupabase.auth.onAuthStateChange((event, session) => {
  updateNavbar(session?.user || null);
});

async function initializeAuth() {
  const { data, error } = await mafiaSupabase.auth.getSession();

  if (error) {
    console.error(error.message);
    return;
  }

  updateNavbar(data.session?.user || null);
}

initializeAuth();

console.log("MAFIA AUTH READY");
