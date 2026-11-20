
const SUPABASE_URL = "https://pgmjtimnnmcttdvfqcnw.supabase.co";

// auth.js faylındakı eyni publishable key-i bura yaz.
const SUPABASE_KEY = "sb_publishable_o_Xk7py1CvvLlU3imqwiOA_ke2Rr-HU";

const mafiaDB = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const languageSelect = document.getElementById("languageSelect");
const mobileMenu = document.getElementById("mobileMenu");
const navLinks = document.querySelector(".nav-links");

const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modalTitle");
const modalDescription = document.getElementById("modalDescription");
const modalClose = document.getElementById("modalClose");

let currentLanguage = "az";

const roomTexts = {
  az: {
    createTitle: "OTAQ YARAT",
    roomName: "Otağın adı",
    maxPlayers: "Oyunçu sayı",
    language: "Oyun dili",
    createButton: "OTAĞI YARAT",
    codeTitle: "OTAĞIN HAZIRDIR!",
    yourCode: "Otaq kodun:",
    copy: "KODU KOPYALA",
    copied: "Kod kopyalandı!",
    joinTitle: "OTAQ AXTARIŞI",
    enterCode: "8 simvolluq otaq kodunu daxil et",
    search: "OTAĞI AXTAR",
    roomFound: "OTAQ TAPILDI",
    roomFull: "Otaq doludur",
    players: "Oyunçu",
    joinRoom: "OTAĞA QOŞUL",
    success: "Otağa uğurla qoşuldun!",
    login: "Əvvəlcə hesabına daxil olmalısan.",
    error: "Xəta baş verdi: ",
    notFound: "Otaq tapılmadı və ya artıq aktiv deyil.",
    loading: "GÖZLƏ..."
  },
  tr: {
    createTitle: "ODA OLUŞTUR",
    roomName: "Oda adı",
    maxPlayers: "Oyuncu sayısı",
    language: "Oyun dili",
    createButton: "ODA OLUŞTUR",
    codeTitle: "ODAN HAZIR!",
    yourCode: "Oda kodun:",
    copy: "KODU KOPYALA",
    copied: "Kod kopyalandı!",
    joinTitle: "ODA ARAMA",
    enterCode: "8 karakterli oda kodunu gir",
    search: "ODA ARA",
    roomFound: "ODA BULUNDU",
    roomFull: "Oda dolu",
    players: "Oyuncu",
    joinRoom: "ODAYA KATIL",
    success: "Odaya başarıyla katıldın!",
    login: "Önce hesabına giriş yapmalısın.",
    error: "Hata oluştu: ",
    notFound: "Oda bulunamadı veya artık aktif değil.",
    loading: "BEKLE..."
  },
  en: {
    createTitle: "CREATE ROOM",
    roomName: "Room name",
    maxPlayers: "Player limit",
    language: "Game language",
    createButton: "CREATE ROOM",
    codeTitle: "YOUR ROOM IS READY!",
    yourCode: "Room code:",
    copy: "COPY CODE",
    copied: "Code copied!",
    joinTitle: "FIND A ROOM",
    enterCode: "Enter the 8-character room code",
    search: "FIND ROOM",
    roomFound: "ROOM FOUND",
    roomFull: "Room is full",
    players: "Players",
    joinRoom: "JOIN ROOM",
    success: "You joined the room!",
    login: "Please log in first.",
    error: "An error occurred: ",
    notFound: "Room not found or no longer available.",
    loading: "PLEASE WAIT..."
  }
};

function roomText(key) {
  return roomTexts[currentLanguage]?.[key] || roomTexts.az[key];
}

function translatePage(language) {
  currentLanguage = translations[language] ? language : "az";

  document.documentElement.lang = currentLanguage;

  document.querySelectorAll("[data-i18n]").forEach(element => {
    const key = element.dataset.i18n;
    const translatedText = translations[currentLanguage][key];

    if (translatedText) {
      element.textContent = translatedText;
    }
  });

  if (languageSelect) {
    languageSelect.value = currentLanguage;
  }
}

function showModal(title, description) {
  if (!modal) return;

  modalTitle.textContent = title;
  modalDescription.textContent = description;
  modal.classList.add("active");
}

function showRoomContent(title, html) {
  if (!modal) return;

  modalTitle.textContent = title;
  modalDescription.innerHTML = html;
  modal.classList.add("active");
}

function closeModal() {
  modal?.classList.remove("active");
}

function message(key) {
  return translations[currentLanguage][key] || translations.az[key];
}

async function checkLogin() {
  const { data, error } = await mafiaDB.auth.getUser();

  if (error || !data.user) {
    showModal(roomText("createTitle"), roomText("login"));
    return false;
  }

  return true;
}

// LANGUAGE
languageSelect?.addEventListener("change", event => {
  translatePage(event.target.value);
});

// MOBILE MENU
if (mobileMenu && navLinks) {
  mobileMenu.addEventListener("click", () => {
    navLinks.classList.toggle("active");
  });
}

document.querySelectorAll(".nav-links a").forEach(link => {
  link.addEventListener("click", () => {
    navLinks?.classList.remove("active");
  });
});

// MODAL
modalClose?.addEventListener("click", closeModal);

modal?.addEventListener("click", event => {
  if (event.target === modal) closeModal();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeModal();
});

// PLAY BUTTON
document.getElementById("playBtn")?.addEventListener("click", () => {
  showModal(
    message("comingTitle"),
    message("comingDescription")
  );
});

// CREATE ROOM FORM
document.getElementById("createBtn")?.addEventListener("click", async () => {
  if (!(await checkLogin())) return;

  showRoomContent(roomText("createTitle"), `
    <form id="createRoomForm" style="display:flex;flex-direction:column;gap:14px;text-align:left;">

      <label>${roomText("roomName")}</label>
      <input id="newRoomName" type="text"
        maxlength="40"
        value="Mafia Room"
        required
        style="padding:12px;border-radius:8px;">

      <label>${roomText("maxPlayers")}</label>
      <select id="newRoomPlayers" style="padding:12px;border-radius:8px;">
        ${Array.from({length: 7}, (_, i) =>
          `<option value="${i + 6}" ${i === 6 ? "selected" : ""}>${i + 6}</option>`
        ).join("")}
      </select>

      <label>${roomText("language")}</label>
      <select id="newRoomLanguage" style="padding:12px;border-radius:8px;">
        <option value="az">Azərbaycan</option>
        <option value="tr">Türkçe</option>
        <option value="en">English</option>
      </select>

      <button id="createRoomSubmit" type="submit"
        style="padding:14px;background:#8e2633;color:white;border:0;border-radius:8px;cursor:pointer;">
        ${roomText("createButton")}
      </button>

      <p id="roomMessage" style="color:#c6a15b;text-align:center;"></p>
    </form>
  `);

  document.getElementById("createRoomForm").addEventListener("submit", async event => {
    event.preventDefault();

    const button = document.getElementById("createRoomSubmit");
    const output = document.getElementById("roomMessage");

    const roomName = document.getElementById("newRoomName").value.trim();
    const maxPlayers = Number(document.getElementById("newRoomPlayers").value);
    const language = document.getElementById("newRoomLanguage").value;

    button.disabled = true;
    button.textContent = roomText("loading");

    try {
      const { data, error } = await mafiaDB.rpc("create_room", {
        p_room_name: roomName,
        p_max_players: maxPlayers,
        p_language: language
      });

      if (error) throw error;

      showRoomContent(roomText("codeTitle"), `
        <div style="text-align:center;padding:15px 0;">
          <p>${roomText("yourCode")}</p>
          <h2 id="createdRoomCode"
            style="font-size:32px;letter-spacing:5px;color:#c6a15b;">
          </h2>
          <button id="copyRoomCode"
            style="padding:13px;background:#8e2633;color:white;border:0;border-radius:8px;cursor:pointer;">
            ${roomText("copy")}
          </button>
          <p id="copyMessage" style="color:#c6a15b;"></p>
        </div>
      `);

      document.getElementById("createdRoomCode").textContent = data.room_code;

      document.getElementById("copyRoomCode").addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(data.room_code);
          document.getElementById("copyMessage").textContent = roomText("copied");
        } catch {
          document.getElementById("copyMessage").textContent = data.room_code;
        }
      });

    } catch (error) {
      output.textContent = roomText("error") + error.message;
      button.disabled = false;
      button.textContent = roomText("createButton");
    }
  });
});

// JOIN ROOM: SEARCH
document.getElementById("joinBtn")?.addEventListener("click", async () => {
  if (!(await checkLogin())) return;

  showRoomContent(roomText("joinTitle"), `
    <form id="findRoomForm" style="display:flex;flex-direction:column;gap:14px;">
      <input id="roomSearchCode"
        type="text"
        maxlength="8"
        minlength="8"
        placeholder="${roomText("enterCode")}"
        required
        style="padding:14px;text-align:center;text-transform:uppercase;letter-spacing:4px;">

      <button id="findRoomSubmit" type="submit"
        style="padding:14px;background:#8e2633;color:white;border:0;border-radius:8px;cursor:pointer;">
        ${roomText("search")}
      </button>

      <p id="findRoomMessage" style="color:#c6a15b;text-align:center;"></p>
    </form>
  `);

  document.getElementById("roomSearchCode").focus();

  document.getElementById("roomSearchCode").addEventListener("input", event => {
    event.target.value = event.target.value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  });

  document.getElementById("findRoomForm").addEventListener("submit", async event => {
    event.preventDefault();

    const button = document.getElementById("findRoomSubmit");
    const output = document.getElementById("findRoomMessage");
    const code = document.getElementById("roomSearchCode").value.trim();

    button.disabled = true;
    button.textContent = roomText("loading");

    try {
      const { data, error } = await mafiaDB.rpc("find_room_by_code", {
        p_room_code: code
      });

      if (error) throw error;

      if (!data.success) {
        output.textContent = roomText("notFound");
        return;
      }

      if (data.is_full) {
        output.textContent = roomText("roomFull");
        return;
      }

      showRoomContent(roomText("roomFound"), `
        <div style="text-align:center;padding:12px 0;">
          <h3 id="foundRoomName" style="color:#c6a15b;"></h3>
          <p id="foundRoomPlayers"></p>
          <p id="foundRoomCode"></p>
          <button id="joinRoomConfirm"
            style="width:100%;padding:14px;background:#8e2633;color:white;border:0;border-radius:8px;cursor:pointer;">
            ${roomText("joinRoom")}
          </button>
          <p id="joinRoomMessage" style="color:#c6a15b;"></p>
        </div>
      `);

      document.getElementById("foundRoomName").textContent = data.room_name;
      document.getElementById("foundRoomPlayers").textContent =
        `${roomText("players")}: ${data.player_count}/${data.max_players}`;
      document.getElementById("foundRoomCode").textContent = data.room_code;

      document.getElementById("joinRoomConfirm").addEventListener("click", async () => {
        const joinButton = document.getElementById("joinRoomConfirm");
        const joinMessage = document.getElementById("joinRoomMessage");

        joinButton.disabled = true;
        joinButton.textContent = roomText("loading");

        try {
          const { data: joinData, error: joinError } = await mafiaDB.rpc("join_room", {
            p_room_code: code
          });

          if (joinError) throw joinError;

          joinMessage.textContent = roomText("success");
          console.log("ROOM JOINED:", joinData);

        } catch (error) {
          joinMessage.textContent = roomText("error") + error.message;
          joinButton.disabled = false;
          joinButton.textContent = roomText("joinRoom");
        }
      });

    } catch (error) {
      output.textContent = roomText("error") + error.message;
    } finally {
      button.disabled = false;
      button.textContent = roomText("search");
    }
  });
});

// INITIAL LANGUAGE
translatePage(languageSelect?.value || "az");

console.log("MAFIA website initialized.");
