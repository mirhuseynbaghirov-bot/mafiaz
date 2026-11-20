/* =========================================
   MAFIA — APP.JS
   Room creation, joining and lobby system
========================================= */

(() => {
  "use strict";

  /* =========================================
     SUPABASE
  ========================================= */

  const SUPABASE_URL = "https://pgmjtimnnmcttdvfqcnw.supabase.co";
  const SUPABASE_KEY = "sb_publishable_o_Xk7py1CvvLlU3imqwiOA_ke2Rr-HU";

  if (!window.supabase) {
    console.error("Supabase kitabxanası yüklənmədi.");
    return;
  }

  const mafiaDB = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );

  // auth.js eyni client-dən istifadə etsin
  window.mafiaDB = mafiaDB;

  /* =========================================
     ELEMENTS
  ========================================= */

  const $ = (id) => document.getElementById(id);

  const modal = $("modal");
  const modalTitle = $("modalTitle");
  const modalDescription = $("modalDescription");
  const modalClose = $("modalClose");

  const mainContent = $("mainContent");
  const mainNavbar = $("mainNavbar");
  const mainFooter = $("mainFooter");

  const lobbyScreen = $("lobbyScreen");
  const lobbyRoomName = $("lobbyRoomName");
  const lobbyRoomCode = $("lobbyRoomCode");
  const lobbyPlayerCount = $("lobbyPlayerCount");
  const lobbyLanguage = $("lobbyLanguage");
  const lobbyStatus = $("lobbyStatus");
  const lobbyPlayers = $("lobbyPlayers");
  const lobbyWaitingMessage = $("lobbyWaitingMessage");
  const lobbyHostName = $("lobbyHostName");
  const lobbyMaxPlayers = $("lobbyMaxPlayers");
  const lobbyStartMessage = $("lobbyStartMessage");
  const startGameBtn = $("startGameBtn");

  /* =========================================
     STATE
  ========================================= */

  const MIN_PLAYERS = 6;

  let currentLanguage = $("languageSelect")?.value || "az";
  let currentUser = null;
  let activeRoom = null;
  let activeRoomId = null;
  let isRoomHost = false;
  let roomChannel = null;
  let refreshTimeout = null;

  const languageNames = {
    az: "Azərbaycan dili",
    tr: "Türkçe",
    en: "English"
  };

  /* =========================================
     GENERAL HELPERS
  ========================================= */

  function showModal(title, description = "") {
    if (!modal) return;

    if (modalTitle) modalTitle.textContent = title;
    if (modalDescription) modalDescription.textContent = description;

    modal.classList.add("active");
  }

  function closeModal() {
    if (!modal) return;

    modal.classList.remove("active");
  }

  function showMessage(title, message) {
    showModal(title, message);
  }

  function setButtonLoading(button, loading, originalText = "") {
    if (!button) return;

    if (loading) {
      button.dataset.originalText = button.textContent;
      button.disabled = true;
      button.textContent = "Gözləyin...";
    } else {
      button.disabled = false;
      button.textContent =
        originalText || button.dataset.originalText || "Davam et";
    }
  }

  function normalizeResult(data) {
    if (Array.isArray(data)) return data[0] || null;
    return data || null;
  }

  function getUserName(user) {
    return (
      user?.user_metadata?.username ||
      user?.user_metadata?.full_name ||
      user?.email?.split("@")[0] ||
      "Oyunçu"
    );
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => {
      const entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      };

      return entities[character];
    });
  }

  function showHome() {
    if (mainContent) mainContent.hidden = false;
    if (mainNavbar) mainNavbar.hidden = false;
    if (mainFooter) mainFooter.hidden = false;
    if (lobbyScreen) lobbyScreen.hidden = true;

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showLobby() {
    if (mainContent) mainContent.hidden = true;
    if (mainNavbar) mainNavbar.hidden = true;
    if (mainFooter) mainFooter.hidden = true;
    if (lobbyScreen) lobbyScreen.hidden = false;

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* =========================================
     AUTHENTICATION
  ========================================= */

  async function getCurrentUser() {
    const { data, error } = await mafiaDB.auth.getUser();

    if (error) {
      console.error("İstifadəçi yoxlanılarkən xəta:", error);
      return null;
    }

    currentUser = data?.user || null;
    return currentUser;
  }

  /* =========================================
     MODAL CONTENT
  ========================================= */

  function openCreateRoomModal() {
    if (!modal) return;

    modalTitle.textContent = "Yeni otaq yarat";
    modalDescription.innerHTML = `
      <form id="createRoomForm" class="room-form">
        <label for="newRoomName">Otağın adı</label>
        <input
          id="newRoomName"
          type="text"
          maxlength="30"
          placeholder="Məsələn: Gecə şəhəri"
          required
        >

        <label for="newRoomPlayers">Oyunçu sayı</label>
        <select id="newRoomPlayers" required>
          <option value="6">6 oyunçu</option>
          <option value="7">7 oyunçu</option>
          <option value="8" selected>8 oyunçu</option>
          <option value="9">9 oyunçu</option>
          <option value="10">10 oyunçu</option>
          <option value="11">11 oyunçu</option>
          <option value="12">12 oyunçu</option>
        </select>

        <label for="newRoomLanguage">Oyun dili</label>
        <select id="newRoomLanguage" required>
          <option value="az">Azərbaycan dili</option>
          <option value="tr">Türkçe</option>
          <option value="en">English</option>
        </select>

        <p id="roomMessage" class="room-form-message"></p>

        <button id="createRoomSubmit" type="submit" class="modal-action-btn">
          Otaq yarat
        </button>
      </form>
    `;

    modal.classList.add("active");

    $("createRoomForm")?.addEventListener("submit", createRoom);
  }

  function openJoinRoomModal() {
    if (!modal) return;

    modalTitle.textContent = "Otağa qoşul";
    modalDescription.innerHTML = `
      <form id="findRoomForm" class="room-form">
        <label for="roomSearchCode">Otaq kodu</label>
        <input
          id="roomSearchCode"
          type="text"
          maxlength="8"
          placeholder="8 simvollu kod"
          autocomplete="off"
          required
        >

        <p id="findRoomMessage" class="room-form-message"></p>

        <button id="findRoomSubmit" type="submit" class="modal-action-btn">
          Otağı tap
        </button>
      </form>
    `;

    modal.classList.add("active");

    $("findRoomForm")?.addEventListener("submit", findRoom);
  }

  /* =========================================
     CREATE ROOM
  ========================================= */

  async function createRoom(event) {
    event.preventDefault();

    const user = await getCurrentUser();

    if (!user) {
      showMessage(
        "Giriş tələb olunur",
        "Otaq yaratmaq üçün əvvəlcə hesabınıza daxil olun."
      );
      return;
    }

    const roomName = $("newRoomName")?.value.trim();
    const maxPlayers = Number($("newRoomPlayers")?.value);
    const language = $("newRoomLanguage")?.value || "az";

    const message = $("roomMessage");
    const button = $("createRoomSubmit");

    if (!roomName) {
      if (message) message.textContent = "Otağın adını daxil edin.";
      return;
    }

    if (maxPlayers < 6 || maxPlayers > 12) {
      if (message) message.textContent = "Oyunçu sayı 6–12 arasında olmalıdır.";
      return;
    }

    setButtonLoading(button, true);

    if (message) message.textContent = "";

    try {
      const { data, error } = await mafiaDB.rpc("create_room", {
        p_room_name: roomName,
        p_max_players: maxPlayers,
        p_language: language
      });

      if (error) throw error;

      const result = normalizeResult(data);

      if (!result?.room_code) {
        throw new Error("Server otaq kodu qaytarmadı.");
      }

      isRoomHost = true;

      await enterRoom(result.room_code, {
        room_name: result.room_name || roomName,
        max_players: result.max_players || maxPlayers,
        language: result.language || language,
        room_id: result.room_id || result.id || null,
        host_id: result.host_id || user.id
      });

      closeModal();

    } catch (error) {
      console.error("Otaq yaratma xətası:", error);

      if (message) {
        message.textContent =
          error.message || "Otaq yaradılarkən xəta baş verdi.";
      }

      setButtonLoading(button, false);
    }
  }

  /* =========================================
     FIND ROOM
  ========================================= */

  async function findRoom(event) {
    event.preventDefault();

    const user = await getCurrentUser();

    if (!user) {
      showMessage(
        "Giriş tələb olunur",
        "Otağa qoşulmaq üçün əvvəlcə hesabınıza daxil olun."
      );
      return;
    }

    const code = $("roomSearchCode")?.value.trim().toUpperCase();
    const message = $("findRoomMessage");
    const button = $("findRoomSubmit");

    if (!code || code.length !== 8) {
      if (message) message.textContent = "8 simvollu otaq kodunu daxil edin.";
      return;
    }

    setButtonLoading(button, true);

    if (message) message.textContent = "";

    try {
      const { data, error } = await mafiaDB.rpc("find_room_by_code", {
        p_room_code: code
      });

      if (error) throw error;

      const room = normalizeResult(data);

      if (!room || room.success === false) {
        throw new Error("Bu kodla otaq tapılmadı.");
      }

      if (room.is_full) {
        throw new Error("Bu otaqda boş yer yoxdur.");
      }

      if (room.status && room.status !== "waiting") {
        throw new Error("Bu otaqda oyun artıq başlayıb.");
      }

      modalTitle.textContent = "Otaq tapıldı";
      modalDescription.innerHTML = `
        <div class="room-preview">
          <h3>${escapeHTML(room.room_name || "Mafia otağı")}</h3>
          <p>Otaq kodu: <strong>${escapeHTML(room.room_code || code)}</strong></p>
          <p>
            Oyunçular:
            <strong>${Number(room.player_count || 0)}</strong>
            /
            <strong>${Number(room.max_players || 0)}</strong>
          </p>
          <p>Bu otağa qoşulmaq istəyirsiniz?</p>

          <p id="joinRoomMessage" class="room-form-message"></p>

          <button id="confirmJoinRoom" class="modal-action-btn" type="button">
            Otağa qoşul
          </button>
        </div>
      `;

      $("confirmJoinRoom")?.addEventListener("click", () => {
        joinRoom(code, room);
      });

    } catch (error) {
      console.error("Otaq axtarış xətası:", error);

      if (message) {
        message.textContent =
          error.message || "Otaq axtarılarkən xəta baş verdi.";
      }

      setButtonLoading(button, false);
    }
  }

  /* =========================================
     JOIN ROOM
  ========================================= */

  async function joinRoom(code, roomInfo = {}) {
    const button = $("confirmJoinRoom");
    const message = $("joinRoomMessage");

    setButtonLoading(button, true);

    try {
      const { data, error } = await mafiaDB.rpc("join_room", {
        p_room_code: code
      });

      if (error) throw error;

      const result = normalizeResult(data);

      if (result?.success === false) {
        throw new Error(result.message || "Otağa qoşulmaq mümkün olmadı.");
      }

      isRoomHost = false;

      await enterRoom(code, {
        ...roomInfo,
        ...(result || {})
      });

      closeModal();

    } catch (error) {
      console.error("Otağa qoşulma xətası:", error);

      if (message) {
        message.textContent =
          error.message || "Otağa qoşularkən xəta baş verdi.";
      }

      setButtonLoading(button, false);
    }
  }

  /* =========================================
     LOAD ROOM DETAILS
  ========================================= */

  async function loadRoomDetails(roomCode, initialData = {}) {
    let room = { ...initialData };

    try {
      const { data, error } = await mafiaDB
        .from("rooms")
        .select("id, room_code, room_name, host_id, max_players, language, status")
        .eq("room_code", roomCode)
        .maybeSingle();

      if (!error && data) {
        room = { ...room, ...data };
      } else if (error) {
        console.warn("Otaq məlumatları oxunmadı:", error.message);
      }
    } catch (error) {
      console.warn("Otaq məlumatları yüklənmədi:", error);
    }

    return room;
  }

  /* =========================================
     ENTER ROOM
  ========================================= */

  async function enterRoom(roomCode, initialData = {}) {
    const user = await getCurrentUser();

    if (!user) {
      showMessage("Xəta", "İstifadəçi məlumatları tapılmadı.");
      return;
    }

    const room = await loadRoomDetails(roomCode, initialData);

    activeRoom = {
      ...room,
      room_code: room.room_code || roomCode
    };

    activeRoomId = room.id || room.room_id || null;

    if (room.host_id) {
      isRoomHost = room.host_id === user.id;
    }

    renderLobby();
    showLobby();

    await refreshLobbyPlayers();
    subscribeToRoomChanges();
  }

  /* =========================================
     RENDER LOBBY
  ========================================= */

  function renderLobby() {
    if (!activeRoom) return;

    if (lobbyRoomName) {
      lobbyRoomName.textContent =
        activeRoom.room_name || "Mafia otağı";
    }

    if (lobbyRoomCode) {
      lobbyRoomCode.textContent = activeRoom.room_code || "--------";
    }

    if (lobbyLanguage) {
      lobbyLanguage.textContent =
        languageNames[activeRoom.language] || "Azərbaycan dili";
    }

    if (lobbyMaxPlayers) {
      lobbyMaxPlayers.textContent =
        activeRoom.max_players || 12;
    }

    if (lobbyStatus) {
      lobbyStatus.textContent =
        activeRoom.status === "started" ? "Oyun başladı" : "Oyunçular gözlənilir";
    }

    if (lobbyHostName) {
      lobbyHostName.textContent =
        activeRoom.host_name ||
        (isRoomHost ? getUserName(currentUser) : "Host");
    }
  }

  /* =========================================
     START BUTTON STATE
  ========================================= */

  function updateStartButton(count) {
    if (!startGameBtn) return;

    const enough = count >= MIN_PLAYERS;

    startGameBtn.disabled = !(isRoomHost && enough);
    startGameBtn.textContent = isRoomHost
      ? "OYUNU BAŞLAT →"
      : "HOST OYUNU BAŞLADACAQ";

    if (lobbyStartMessage) {
      if (!isRoomHost) {
        lobbyStartMessage.textContent =
          "Oyunun başlamasını otaq sahibi idarə edir.";
      } else if (enough) {
        lobbyStartMessage.textContent =
          "Hazırsınızsa oyunu başlada bilərsiniz.";
      } else {
        lobbyStartMessage.textContent =
          `Oyunun başlaması üçün ən azı ${MIN_PLAYERS} oyunçu lazımdır (${count}/${MIN_PLAYERS}).`;
      }
    }
  }

  /* =========================================
     LOAD LOBBY PLAYERS
  ========================================= */

  async function refreshLobbyPlayers() {
    if (!activeRoomId || !lobbyPlayers) {
      renderEmptyLobby();
      return;
    }

    const { data, error } = await mafiaDB
      .from("room_players")
      .select("id, room_id, user_id, seat_number, is_alive")
      .eq("room_id", activeRoomId)
      .order("seat_number", { ascending: true });

    if (error) {
      console.error("Oyunçular yüklənmədi:", error);
      renderEmptyLobby("Oyunçu siyahısını yükləmək mümkün olmadı.");
      return;
    }

    renderPlayers(data || []);
  }

  function renderEmptyLobby(message = "Oyunçular gözlənilir...") {
    if (!lobbyPlayers) return;

    lobbyPlayers.innerHTML = `
      <div class="lobby-waiting-message">
        ${escapeHTML(message)}
      </div>
    `;

    if (lobbyPlayerCount) {
      lobbyPlayerCount.textContent =
        `0/${Number(activeRoom?.max_players || 12)}`;
    }

    updateStartButton(0);
  }

  function renderPlayers(players) {
    if (!lobbyPlayers || !activeRoom) return;

    const maxPlayers = Number(activeRoom.max_players || 12);
    const playerCount = players.length;

    if (lobbyPlayerCount) {
      lobbyPlayerCount.textContent = `${playerCount}/${maxPlayers}`;
    }

    updateStartButton(playerCount);

    if (lobbyWaitingMessage) {
      lobbyWaitingMessage.hidden = playerCount >= maxPlayers;
    }

    const playerCards = players.map((player, index) => {
      const isMe = player.user_id === currentUser?.id;
      const isHost = player.user_id === activeRoom.host_id || (isMe && isRoomHost);

      const playerName = isMe
        ? getUserName(currentUser)
        : `Oyunçu ${player.seat_number || index + 1}`;

      const avatarLetter = playerName.charAt(0).toUpperCase();

      return `
        <div class="lobby-player-card ${isHost ? "is-host" : ""}">
          <div class="lobby-player-avatar">
            ${escapeHTML(avatarLetter)}
          </div>

          <div class="lobby-player-name">
            ${escapeHTML(playerName)}
          </div>

          <div class="lobby-player-status">
            ${isMe ? "Siz" : "Qoşulub"}
          </div>

          ${
            isHost
              ? '<span class="lobby-player-host-label">HOST</span>'
              : ""
          }
        </div>
      `;
    });

    const emptySlots = [];

    for (let i = playerCount; i < maxPlayers; i++) {
      emptySlots.push(`
        <div class="lobby-empty-slot">
          <div class="lobby-player-avatar">+</div>
          <div class="lobby-player-name">Boş yer</div>
          <div class="lobby-player-status">Gözlənilir</div>
        </div>
      `);
    }

    lobbyPlayers.innerHTML = [...playerCards, ...emptySlots].join("");
  }

  /* =========================================
     REALTIME
  ========================================= */

  function subscribeToRoomChanges() {
    unsubscribeFromRoomChanges();

    if (!activeRoomId) {
      console.warn(
        "Realtime qoşulmadı: otağın ID-si tapılmadı."
      );
      return;
    }

    roomChannel = mafiaDB
      .channel(`mafia-room-${activeRoomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_players",
          filter: `room_id=eq.${activeRoomId}`
        },
        () => {
          clearTimeout(refreshTimeout);

          refreshTimeout = setTimeout(() => {
            refreshLobbyPlayers();
          }, 300);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${activeRoomId}`
        },
        (payload) => {
          if (payload.new) {
            activeRoom = {
              ...activeRoom,
              ...payload.new
            };

            renderLobby();
          }
        }
      )
      .subscribe((status) => {
        console.log("Lobby realtime status:", status);
      });
  }

  function unsubscribeFromRoomChanges() {
    if (roomChannel) {
      mafiaDB.removeChannel(roomChannel);
      roomChannel = null;
    }

    clearTimeout(refreshTimeout);
  }

  /* =========================================
     COPY ROOM CODE
  ========================================= */

  async function copyRoomCode() {
    const code = activeRoom?.room_code;

    if (!code) return;

    try {
      await navigator.clipboard.writeText(code);

      const button = $("copyLobbyCode");

      if (button) {
        const oldText = button.textContent;
        button.textContent = "Kopyalandı!";
        setTimeout(() => {
          button.textContent = oldText;
        }, 1500);
      }
    } catch (error) {
      console.error("Kopyalama xətası:", error);
      showMessage("Otaq kodu", `Otaq kodunuz: ${code}`);
    }
  }

  /* =========================================
     LEAVE ROOM
  ========================================= */

  async function leaveRoom() {
    if (!activeRoom || !currentUser) {
      showHome();
      return;
    }

    const confirmed = window.confirm(
      "Bu otaqdan çıxmaq istədiyinizə əminsiniz?"
    );

    if (!confirmed) return;

    try {
      if (activeRoomId) {
        const { error } = await mafiaDB
          .from("room_players")
          .delete()
          .eq("room_id", activeRoomId)
          .eq("user_id", currentUser.id);

        if (error) {
          console.error("Otaqdan çıxma xətası:", error);
          showMessage(
            "Xəta",
            "Otaqdan çıxmaq mümkün olmadı. Supabase icazələrini yoxlamaq lazımdır."
          );
          return;
        }
      }

      unsubscribeFromRoomChanges();

      activeRoom = null;
      activeRoomId = null;
      isRoomHost = false;

      showHome();

    } catch (error) {
      console.error("Otaqdan çıxma xətası:", error);
      showMessage("Xəta", "Otaqdan çıxarkən xəta baş verdi.");
    }
  }

  /* =========================================
     START GAME
  ========================================= */

  function handleStartGame() {
    if (!isRoomHost) return;

    showMessage(
      "Növbəti mərhələ",
      "Lobby hazırdır. Oyunun başladılması üçün ayrıca oyun mexanikası və server funksiyası əlavə edilməlidir."
    );
  }

  /* =========================================
     LANGUAGE
  ========================================= */

  function translatePage(language) {
    currentLanguage = ["az", "tr", "en"].includes(language)
      ? language
      : "az";

    document.documentElement.lang = currentLanguage;

    /*
      Tərcümə obyekti (window.translations) varsa istifadə olunur.
      Yoxdursa, səhifə xəta vermədən olduğu kimi qalır.
    */

    const dictionary =
      window.translations ||
      (typeof translations !== "undefined" ? translations : null);

    if (!dictionary?.[currentLanguage]) return;

    document.querySelectorAll("[data-i18n]").forEach((element) => {
      const key = element.dataset.i18n;
      const value = dictionary[currentLanguage][key];

      if (value !== undefined) {
        element.textContent = value;
      }
    });
  }

  /* =========================================
     MOBILE MENU
  ========================================= */

  const navLinks = document.querySelector(".nav-links");

  $("mobileMenu")?.addEventListener("click", () => {
    navLinks?.classList.toggle("active");
  });

  navLinks?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      navLinks.classList.remove("active");
    });
  });

  /* =========================================
     EVENT LISTENERS
  ========================================= */

  $("createBtn")?.addEventListener("click", async () => {
    const user = await getCurrentUser();

    if (!user) {
      showMessage(
        "Giriş tələb olunur",
        "Otaq yaratmaq üçün hesabınıza daxil olun."
      );
      return;
    }

    openCreateRoomModal();
  });

  $("joinBtn")?.addEventListener("click", async () => {
    const user = await getCurrentUser();

    if (!user) {
      showMessage(
        "Giriş tələb olunur",
        "Otağa qoşulmaq üçün hesabınıza daxil olun."
      );
      return;
    }

    openJoinRoomModal();
  });

  $("playBtn")?.addEventListener("click", () => {
    $("createBtn")?.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  });

  modalClose?.addEventListener("click", closeModal);

  modal?.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeModal();
    }
  });

  $("copyLobbyCode")?.addEventListener("click", copyRoomCode);

  $("leaveRoomBtn")?.addEventListener("click", leaveRoom);

  startGameBtn?.addEventListener("click", handleStartGame);

  $("languageSelect")?.addEventListener("change", (event) => {
    translatePage(event.target.value);
  });

  /* =========================================
     INITIALIZATION
  ========================================= */

  async function initializeApp() {
    await getCurrentUser();

    translatePage(currentLanguage);

    console.log("MAFIA app.js initialized.");
  }

  initializeApp();

})();
