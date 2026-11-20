
const SUPABASE_URL = "https://pgmjtimnnmcttdvfqcnw.supabase.co";

const SUPABASE_KEY = "sb_publishable_o_Xk7py1CvvLlU3imqwiOA_ke2Rr-HU";

const mafiaSupabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const authModal = document.getElementById("modal");
const authTitle = document.getElementById("modalTitle");
const authDescription = document.getElementById("modalDescription");

function openAuth(type) {
  if (!authModal || !authTitle || !authDescription) return;

  const isSignup = type === "signup";

  authTitle.textContent = isSignup ? "HESAB YARAT" : "DAXİL OL";

  authDescription.innerHTML = `
    <form id="authForm" style="display:flex;flex-direction:column;gap:14px;text-align:left;">

      ${isSignup ? `
        <label style="color:#c6a15b;font-size:13px;">İstifadəçi adı</label>
        <input
          id="authUsername"
          type="text"
          placeholder="Məsələn: Player123"
          minlength="3"
          maxlength="20"
          required
          style="padding:13px;background:#101012;color:white;border:1px solid #49434a;border-radius:8px;"
        >
      ` : ""}

      <label style="color:#c6a15b;font-size:13px;">E-poçt</label>
      <input
        id="authEmail"
        type="email"
        placeholder="example@gmail.com"
        required
        style="padding:13px;background:#101012;color:white;border:1px solid #49434a;border-radius:8px;"
      >

      <label style="color:#c6a15b;font-size:13px;">Şifrə</label>
      <input
        id="authPassword"
        type="password"
        placeholder="Ən azı 8 simvol"
        minlength="8"
        required
        style="padding:13px;background:#101012;color:white;border:1px solid #49434a;border-radius:8px;"
      >

      <button
        type="submit"
        id="authSubmit"
        style="padding:14px;background:#8e2633;color:white;border:0;border-radius:8px;font-weight:bold;cursor:pointer;margin-top:8px;"
      >
        ${isSignup ? "QEYDİYYATDAN KEÇ" : "DAXİL OL"}
      </button>

      <p id="authMessage" style="font-size:13px;color:#c6a15b;text-align:center;"></p>
    </form>
  `;

  authModal.classList.add("active");

  document.getElementById("authForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("authEmail").value.trim();
    const password = document.getElementById("authPassword").value;
    const username = document.getElementById("authUsername")?.value.trim();

    const submitButton = document.getElementById("authSubmit");
    const message = document.getElementById("authMessage");

    submitButton.disabled = true;
    submitButton.textContent = "GÖZLƏ...";

    message.textContent = "";

    try {
      if (isSignup) {
        const { data, error } = await mafiaSupabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username
            }
          }
        });

        if (error) throw error;

        if (data.session) {
          message.textContent = "Qeydiyyat uğurludur! Hesabına daxil oldun.";
          submitButton.textContent = "UĞURLU";
        } else {
          message.textContent = "Qeydiyyat uğurludur! E-poçtuna gələn təsdiq linkini yoxla.";
          submitButton.textContent = "TƏSDİQ GÖZLƏNİLİR";
        }

      } else {
        const { error } = await mafiaSupabase.auth.signInWithPassword({
          email,
          password
        });

        if (error) throw error;

        message.textContent = "Giriş uğurludur! Səhifə yenilənir.";
        submitButton.textContent = "UĞURLU";

        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }

    } catch (error) {
      message.textContent = error.message;
      submitButton.disabled = false;
      submitButton.textContent = isSignup ? "QEYDİYYATDAN KEÇ" : "DAXİL OL";
    }
  });
}

// Qeydiyyat düyməsi
document.getElementById("signupBtn")?.addEventListener("click", () => {
  openAuth("signup");
});

// Daxil ol düyməsi
document.getElementById("loginBtn")?.addEventListener("click", () => {
  openAuth("login");
});

// İstifadəçinin sessiyasını yoxla
async function checkUserSession() {
  const { data, error } = await mafiaSupabase.auth.getSession();

  if (error) {
    console.error("Session error:", error.message);
    return;
  }

  if (data.session) {
    console.log("Daxil olan istifadəçi:", data.session.user.email);
  }
}

checkUserSession();

console.log("MAFIA authentication initialized.");
