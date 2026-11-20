
/* =========================================
   MAFIA — APP.JS
   Room creation, joining, lobby,
   ready system, bots, game settings & roles
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

  /* BOT ELEMENTS */

  const lobbyBotControls = $("lobbyBotControls");
  const addBotBtn = $("addBotBtn");

  /* GAME SETTINGS */

  const gameMafiaCount = $("gameMafiaCount");
  const gameDoctorCount = $("gameDoctorCount");
  const gameDetectiveCount = $("gameDetectiveCount");
  const gameDiscussionTime = $("gameDiscussionTime");
  const gameVotingTime = $("gameVotingTime");

  const saveGameSettingsBtn = $("saveGameSettingsBtn");
  const gameSettingsMessage = $("gameSettingsMessage");
  const gameSpecialRoleCount = $("gameSpecialRoleCount");
  const gameCivilianCount = $("gameCivilianCount");

  /* =========================================
     STATE
  ========================================= */

  const MIN_PLAYERS = 6;

  const DEFAULT_GAME_SETTINGS = {
    mafia: 1,
    doctor: 1,
    detective: 1,
    discussion_seconds: 120,
    voting_seconds: 30
  };

  let currentLanguage = $("languageSelect")?.value || "az";

  let currentUser = null;
  let activeRoom = null;
  let activeRoomId = null;

  let isRoomHost = false;
  let roomChannel = null;
  let refreshTimeout = null;

  let currentPlayers = [];
  let currentBots = [];

  let isUpdatingReady = false;
  let isSavingGameSettings = false;
  let isStartingGame = false;
  let isAddingBot = false;

  let readyButton = null;

  const languageNames = {
    az: "Azərbaycan dili",
    tr: "Türkçe",
    en: "English"
  };

  const roleNames = {
    mafia: "MAFİYA",
    doctor: "HƏKİM",
    detective: "DETEKTİV",
    civilian: "MÜLKİ SAKİN"
  };

  const roleDescriptions = {
    mafia: "Sən mafiyasansa. Şəhərdəki digər oyunçular bunu bilməməlidir.",
    doctor: "Sən həkimsən. Gecələr bir oyunçunu qorumaq sənin vəzifəndir.",
    detective: "Sən detektivsən. Şübhəli oyunçuları araşdırmaq sənin vəzifəndir.",
    civilian: "Sən mülki sakinsən. Müzakirələrdə iştirak et və mafiyanı tapmağa çalış."
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

  function getTotalPlayerCount() {
    return currentPlayers.length + currentBots.length;
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
      if (message) {
        message.textContent = "Oyunçu sayı 6–12 arasında olmalıdır.";
      }
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
      if (message) {
        message.textContent = "8 simvollu otaq kodunu daxil edin.";
      }
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

          <p>
            Otaq kodu:
            <strong>${escapeHTML(room.room_code || code)}</strong>
          </p>

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
        throw new Error(
          result.message || "Otağa qoşulmaq mümkün olmadı."
        );
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
        .select(
          "id, room_code, room_name, host_id, max_players, language, status, game_settings"
        )
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

    unsubscribeFromRoomChanges();

    const room = await loadRoomDetails(roomCode, initialData);

    activeRoom = {
      ...room,
      room_code: room.room_code || roomCode
    };

    activeRoomId = room.id || room.room_id || null;

    currentPlayers = [];
    currentBots = [];

    if (room.host_id) {
      isRoomHost = room.host_id === user.id;
    }

    renderLobby();
    showLobby();

    createReadyButton();
    renderGameSettings();

    await refreshLobbyPlayers();

    subscribeToRoomChanges();

    if (activeRoom.status === "playing") {
      await displayMyRole();
    }
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
      lobbyRoomCode.textContent =
        activeRoom.room_code || "--------";
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
        activeRoom.status === "playing"
          ? "Oyun başladı"
          : "Oyunçular gözlənilir";
    }

    if (lobbyHostName) {
      lobbyHostName.textContent =
        activeRoom.host_name ||
        (isRoomHost ? getUserName(currentUser) : "Host");
    }

    updateGameSettingsPermissions();
    updateReadyButton();
    updateBotControls();
  }

  /* =========================================
     GAME SETTINGS
  ========================================= */

  function getGameSettings() {
    const saved = activeRoom?.game_settings;

    if (!saved || typeof saved !== "object") {
      return { ...DEFAULT_GAME_SETTINGS };
    }

    return {
      mafia: Number(saved.mafia ?? DEFAULT_GAME_SETTINGS.mafia),
      doctor: Number(saved.doctor ?? DEFAULT_GAME_SETTINGS.doctor),
      detective: Number(saved.detective ?? DEFAULT_GAME_SETTINGS.detective),
      discussion_seconds: Number(
        saved.discussion_seconds ??
        DEFAULT_GAME_SETTINGS.discussion_seconds
      ),
      voting_seconds: Number(
        saved.voting_seconds ??
        DEFAULT_GAME_SETTINGS.voting_seconds
      )
    };
  }

  function getSettingsFromInputs() {
    return {
      mafia: Number(gameMafiaCount?.value),
      doctor: Number(gameDoctorCount?.value),
      detective: Number(gameDetectiveCount?.value),
      discussion_seconds: Number(gameDiscussionTime?.value),
      voting_seconds: Number(gameVotingTime?.value)
    };
  }

  function renderGameSettings() {
    if (!activeRoom) return;

    const settings = getGameSettings();

    if (gameMafiaCount) gameMafiaCount.value = String(settings.mafia);
    if (gameDoctorCount) gameDoctorCount.value = String(settings.doctor);
    if (gameDetectiveCount) gameDetectiveCount.value = String(settings.detective);
    if (gameDiscussionTime) gameDiscussionTime.value = String(settings.discussion_seconds);
    if (gameVotingTime) gameVotingTime.value = String(settings.voting_seconds);

    updateGameSettingsSummary();
    updateGameSettingsPermissions();

    setGameSettingsMessage(
      isRoomHost
        ? "Ayarları dəyişdikdən sonra yadda saxlamağı unutmayın."
        : "Ayarları yalnız otaq sahibi dəyişə bilər."
    );
  }

  function updateGameSettingsSummary() {
    const settings = getSettingsFromInputs();

    const specialRoles =
      settings.mafia +
      settings.doctor +
      settings.detective;

    const maxPlayers = Number(activeRoom?.max_players || 8);
    const civilians = Math.max(0, maxPlayers - specialRoles);

    if (gameSpecialRoleCount) {
      gameSpecialRoleCount.textContent = specialRoles;
    }

    if (gameCivilianCount) {
      gameCivilianCount.textContent = civilians;
    }
  }

  function updateGameSettingsPermissions() {
    const settingsLocked =
      !isRoomHost ||
      !activeRoom ||
      activeRoom.status !== "waiting" ||
      isSavingGameSettings;

    const controls = [
      gameMafiaCount,
      gameDoctorCount,
      gameDetectiveCount,
      gameDiscussionTime,
      gameVotingTime
    ];

    controls.forEach((control) => {
      if (control) control.disabled = settingsLocked;
    });

    if (saveGameSettingsBtn) {
      saveGameSettingsBtn.disabled =
        settingsLocked || !activeRoomId;
    }
  }

  function setGameSettingsMessage(message, type = "") {
    if (!gameSettingsMessage) return;

    gameSettingsMessage.textContent = message;
    gameSettingsMessage.classList.remove("success", "error");

    if (type) {
      gameSettingsMessage.classList.add(type);
    }
  }

  function validateGameSettings(settings) {
    const values = [
      settings.mafia,
      settings.doctor,
      settings.detective,
      settings.discussion_seconds,
      settings.voting_seconds
    ];

    if (values.some((value) => !Number.isInteger(value))) {
      return "Ayarlar düzgün seçilməyib.";
    }

    if (
      settings.mafia < 1 ||
      settings.mafia > 4 ||
      settings.doctor < 0 ||
      settings.doctor > 2 ||
      settings.detective < 0 ||
      settings.detective > 2
    ) {
      return "Rol sayı düzgün deyil.";
    }

    const totalRoles =
      settings.mafia +
      settings.doctor +
      settings.detective;

    const maxPlayers = Number(activeRoom?.max_players || 8);

    if (totalRoles > maxPlayers) {
      return "Xüsusi rolların sayı maksimum oyunçu sayından çox ola bilməz.";
    }

    if (
      settings.discussion_seconds < 30 ||
      settings.discussion_seconds > 600
    ) {
      return "Müzakirə müddəti 30–600 saniyə arasında olmalıdır.";
    }

    if (
      settings.voting_seconds < 15 ||
      settings.voting_seconds > 180
    ) {
      return "Səsvermə müddəti 15–180 saniyə arasında olmalıdır.";
    }

    return null;
  }

  async function saveGameSettings() {
    if (!activeRoomId || !activeRoom) {
      setGameSettingsMessage("Otaq məlumatları tapılmadı.", "error");
      return;
    }

    if (!isRoomHost) {
      setGameSettingsMessage(
        "Ayarları yalnız otaq sahibi dəyişə bilər.",
        "error"
      );
      return;
    }

    if (activeRoom.status !== "waiting") {
      setGameSettingsMessage(
        "Oyun başladıqdan sonra ayarları dəyişmək mümkün deyil.",
        "error"
      );
      return;
    }

    if (isSavingGameSettings) return;

    const settings = getSettingsFromInputs();
    const validationError = validateGameSettings(settings);

    if (validationError) {
      setGameSettingsMessage(validationError, "error");
      return;
    }

    isSavingGameSettings = true;

    if (saveGameSettingsBtn) {
      saveGameSettingsBtn.textContent = "YADDA SAXLANILIR...";
    }

    updateGameSettingsPermissions();
    setGameSettingsMessage("Ayarlar yadda saxlanılır...");

    try {
      const { data, error } = await mafiaDB.rpc(
        "set_room_game_settings",
        {
          p_room_id: activeRoomId,
          p_settings: settings
        }
      );

      if (error) throw error;

      if (data === false) {
        throw new Error("Ayarları yadda saxlamaq mümkün olmadı.");
      }

      activeRoom = {
        ...activeRoom,
        game_settings: settings
      };

      renderGameSettings();

      setGameSettingsMessage(
        "✓ Ayarlar uğurla yadda saxlanıldı.",
        "success"
      );

    } catch (error) {
      console.error("Game settings xətası:", error);

      setGameSettingsMessage(
        error.message || "Ayarları yadda saxlamaq mümkün olmadı.",
        "error"
      );

    } finally {
      isSavingGameSettings = false;

      if (saveGameSettingsBtn) {
        saveGameSettingsBtn.textContent = "AYARLARI YADDA SAXLA";
      }

      updateGameSettingsPermissions();
    }
  }

  /* =========================================
     READY BUTTON STYLE
  ========================================= */

  function addReadyButtonStyles() {
    if ($("mafiaReadyStyles")) return;

    const style = document.createElement("style");
    style.id = "mafiaReadyStyles";

    style.textContent = `
      .mafia-ready-btn {
        display: block;
        width: 100%;
        max-width: 100%;
        padding: 15px 20px;
        margin: 0 0 12px;
        border: 1px solid #a17618;
        border-radius: 10px;
        background: #17161c;
        color: #d8b65d;
        font-weight: 800;
        font-size: 14px;
        letter-spacing: 1px;
        cursor: pointer;
        transition: .2s ease;
      }

      .mafia-ready-btn:hover:not(:disabled) {
        background: #252019;
        border-color: #d8b65d;
      }

      .mafia-ready-btn.is-ready {
        background: #173c2b;
        border-color: #3c9b68;
        color: #8de0ae;
      }

      .mafia-ready-btn:disabled {
        opacity: .55;
        cursor: not-allowed;
      }

      .lobby-player-card.is-ready .lobby-player-status {
        color: #8de0ae;
      }

      .lobby-player-card.is-not-ready .lobby-player-status {
        color: #c78a8a;
      }

      .lobby-ready-label {
        display: inline-block;
        margin-top: 5px;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 1px;
      }

      .lobby-ready-label.ready {
        color: #8de0ae;
      }

      .lobby-ready-label.not-ready {
        color: #c78a8a;
      }

      .lobby-bot-card {
        border-color: rgba(161,118,24,.55) !important;
      }

      .lobby-bot-label {
        display: inline-block;
        margin-top: 5px;
        color: #d8b65d;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 1px;
      }

      #addBotBtn:disabled {
        opacity: .5;
        cursor: not-allowed;
      }

      .game-settings-card .settings-description {
        margin: 8px 0 18px;
        color: #aaa2a4;
        font-size: 12px;
        line-height: 1.6;
      }

      .game-setting-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin: 12px 0;
      }

      .game-setting-row label {
        color: #c9c0c1;
        font-size: 12px;
      }

      .game-setting-row select {
        width: auto;
        max-width: 130px;
        min-width: 90px;
        padding: 9px 10px;
        border: 1px solid #39343a;
        border-radius: 7px;
        background: #111014;
        color: #e5d9d9;
        font: inherit;
        font-size: 12px;
      }

      .game-setting-row select:disabled {
        opacity: .55;
        cursor: not-allowed;
      }

      .game-setting-divider {
        height: 1px;
        margin: 16px 0;
        background: rgba(255,255,255,.08);
      }

      .game-setting-summary {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        margin: 10px 0;
        color: #aaa2a4;
        font-size: 12px;
      }

      .game-setting-summary strong {
        color: #d8b65d;
      }

      #saveGameSettingsBtn {
        width: 100%;
        max-width: 100%;
        margin-top: 15px;
        padding: 13px 10px;
        border: 1px solid #a17618;
        border-radius: 8px;
        background: linear-gradient(135deg, #7b5915, #a17618);
        color: #fff;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: .8px;
        cursor: pointer;
        transition: .2s ease;
      }

      #saveGameSettingsBtn:hover:not(:disabled) {
        filter: brightness(1.15);
      }

      #saveGameSettingsBtn:disabled {
        opacity: .5;
        cursor: not-allowed;
      }

      .game-settings-message {
        min-height: 30px;
        margin: 10px 0 0;
        color: #aaa2a4;
        font-size: 11px;
        line-height: 1.5;
      }

      .game-settings-message.success {
        color: #8de0ae;
      }

      .game-settings-message.error {
        color: #e58b8b;
      }
    `;

    document.head.appendChild(style);
  }

  /* =========================================
     CREATE READY BUTTON
  ========================================= */

  function createReadyButton() {
    if (!startGameBtn) {
      console.warn("startGameBtn elementi tapılmadı.");
      return;
    }

    addReadyButtonStyles();

    if (readyButton && readyButton.isConnected) return;

    readyButton = document.createElement("button");
    readyButton.type = "button";
    readyButton.id = "readyButton";
    readyButton.className = "mafia-ready-btn";
    readyButton.textContent = "HAZIRAM";

    readyButton.addEventListener("click", toggleReadyStatus);

    startGameBtn.insertAdjacentElement("beforebegin", readyButton);

    updateReadyButton();
  }

  /* =========================================
     CURRENT PLAYER READY STATUS
  ========================================= */

  function getCurrentPlayer() {
    if (!currentUser) return null;

    return currentPlayers.find(
      (player) => player.user_id === currentUser.id
    ) || null;
  }

  function updateReadyButton() {
    if (!readyButton) return;

    const myPlayer = getCurrentPlayer();
    const isReady = Boolean(myPlayer?.is_ready);
    const gameStarted = activeRoom?.status === "playing";

    readyButton.disabled =
      !myPlayer ||
      isUpdatingReady ||
      gameStarted;

    readyButton.classList.toggle("is-ready", isReady);

    if (gameStarted) {
      readyButton.textContent = "OYUN BAŞLAYIB";
    } else if (isUpdatingReady) {
      readyButton.textContent = "GÖZLƏYİN...";
    } else {
      readyButton.textContent = isReady
        ? "✓ HAZIRSINIZ — GERİ DÖN"
        : "HAZIRAM";
    }
  }

  /* =========================================
     TOGGLE READY STATUS
  ========================================= */

  async function toggleReadyStatus() {
    if (
      !activeRoomId ||
      !currentUser ||
      isUpdatingReady ||
      activeRoom?.status !== "waiting"
    ) {
      return;
    }

    const myPlayer = getCurrentPlayer();

    if (!myPlayer) {
      showMessage(
        "Xəta",
        "Oyunçu məlumatınız tapılmadı. Otağa yenidən qoşulun."
      );
      return;
    }

    const nextReadyStatus = !Boolean(myPlayer.is_ready);

    isUpdatingReady = true;
    updateReadyButton();

    try {
      const { data, error } = await mafiaDB.rpc(
        "set_room_player_ready",
        {
          p_room_id: activeRoomId,
          p_is_ready: nextReadyStatus
        }
      );

      if (error) throw error;

      if (data === false) {
        throw new Error("Hazır statusunu dəyişmək mümkün olmadı.");
      }

      await refreshLobbyPlayers();

    } catch (error) {
      console.error("Ready status xətası:", error);

      showMessage(
        "Xəta",
        error.message || "Hazır statusu dəyişdirilə bilmədi."
      );

    } finally {
      isUpdatingReady = false;
      updateReadyButton();
    }
  }

  /* =========================================
     BOT CONTROLS
  ========================================= */

  function updateBotControls() {
    if (!lobbyBotControls) return;

    const isWaiting = activeRoom?.status === "waiting";
    const isFull =
      getTotalPlayerCount() >= Number(activeRoom?.max_players || 12);

    lobbyBotControls.hidden = !isRoomHost || !isWaiting;

    if (addBotBtn) {
      addBotBtn.disabled =
        !isRoomHost ||
        !isWaiting ||
        isFull ||
        isAddingBot;

      addBotBtn.textContent = isAddingBot
        ? "BOT ƏLAVƏ EDİLİR..."
        : isFull
          ? "OTAQ DOLUDUR"
          : "+ BOT ƏLAVƏ ET";
    }
  }

  async function addRoomBot() {
    if (
      !activeRoomId ||
      !activeRoom ||
      !isRoomHost ||
      isAddingBot
    ) {
      return;
    }

    if (activeRoom.status !== "waiting") {
      showMessage("Məlumat", "Oyun başladıqdan sonra bot əlavə edilə bilməz.");
      return;
    }

    if (getTotalPlayerCount() >= Number(activeRoom.max_players)) {
      showMessage("Otaq doludur", "Bu otaqda boş yer qalmayıb.");
      return;
    }

    isAddingBot = true;
    updateBotControls();

    try {
      const { data, error } = await mafiaDB.rpc("add_room_bot", {
        p_room_id: activeRoomId
      });

      if (error) throw error;

      const result = normalizeResult(data);

      if (result?.success === false) {
        throw new Error(result.message || "Bot əlavə edilə bilmədi.");
      }

      await refreshLobbyPlayers();

    } catch (error) {
      console.error("Bot əlavə etmə xətası:", error);

      showMessage(
        "Bot əlavə edilmədi",
        error.message || "Bot əlavə edilərkən xəta baş verdi."
      );

    } finally {
      isAddingBot = false;
      updateBotControls();
    }
  }

  /* =========================================
     START BUTTON STATE
  ========================================= */

  function updateStartButton(players = currentPlayers, bots = currentBots) {
    if (!startGameBtn) return;

    const count = players.length + bots.length;
    const enoughPlayers = count >= MIN_PLAYERS;

    // İnsan oyunçular hazır olmalıdır.
    // Botlar avtomatik hazır hesab olunur.
    const allReady =
      enoughPlayers &&
      players.every((player) => Boolean(player.is_ready));

    const gameStarted = activeRoom?.status === "playing";

    const canStart =
      isRoomHost &&
      enoughPlayers &&
      allReady &&
      !gameStarted &&
      !isStartingGame;

    startGameBtn.disabled = !canStart;

    if (gameStarted) {
      startGameBtn.textContent = "OYUN BAŞLAYIB";
    } else if (isStartingGame) {
      startGameBtn.textContent = "OYUN BAŞLADILIR...";
    } else if (!isRoomHost) {
      startGameBtn.textContent = "HOST OYUNU BAŞLADACAQ";
    } else if (!enoughPlayers) {
      startGameBtn.textContent = "OYUNÇULAR GÖZLƏNİLİR";
    } else if (!allReady) {
      startGameBtn.textContent = "HAZIRLIQ GÖZLƏNİLİR";
    } else {
      startGameBtn.textContent = "OYUNU BAŞLAT →";
    }

    if (!lobbyStartMessage) return;

    if (gameStarted) {
      lobbyStartMessage.textContent =
        "Oyun başladı. Rolunuzu yoxlayın.";

    } else if (!isRoomHost) {
      lobbyStartMessage.textContent =
        "Oyunun başlamasını otaq sahibi idarə edir.";

    } else if (!enoughPlayers) {
      lobbyStartMessage.textContent =
        `Oyunun başlaması üçün ən azı ${MIN_PLAYERS} iştirakçı lazımdır (${count}/${MIN_PLAYERS}).`;

    } else if (!allReady) {
      const readyCount = players.filter(
        (player) => Boolean(player.is_ready)
      ).length;

      lobbyStartMessage.textContent =
        `İnsan oyunçuların hazır olması gözlənilir: ${readyCount}/${players.length}. Botlar avtomatik hazırdır.`;

    } else {
      lobbyStartMessage.textContent =
        "Bütün insan oyunçular hazırdır. Oyunu başlada bilərsiniz.";
    }
  }

  /* =========================================
     LOAD LOBBY PLAYERS AND BOTS
  ========================================= */

  async function refreshLobbyPlayers() {
    if (!activeRoomId || !lobbyPlayers) {
      renderEmptyLobby();
      return;
    }

    const [playersResult, botsResult] = await Promise.all([
      mafiaDB
        .from("room_players")
        .select("id, room_id, user_id, seat_number, is_alive, is_ready")
        .eq("room_id", activeRoomId)
        .order("seat_number", { ascending: true }),

      mafiaDB
        .from("room_bots")
        .select("id, room_id, bot_name, seat_number, is_alive, is_ready")
        .eq("room_id", activeRoomId)
        .order("seat_number", { ascending: true })
    ]);

    if (playersResult.error) {
      console.error("Oyunçular yüklənmədi:", playersResult.error);
      renderEmptyLobby("Oyunçu siyahısını yükləmək mümkün olmadı.");
      return;
    }

    if (botsResult.error) {
      console.error("Botlar yüklənmədi:", botsResult.error);
      showMessage(
        "Bot məlumatları yüklənmədi",
        botsResult.error.message || "Bot siyahısını oxumaq mümkün olmadı."
      );
      return;
    }

    renderPlayers(
      playersResult.data || [],
      botsResult.data || []
    );
  }

  function renderEmptyLobby(message = "Oyunçular gözlənilir...") {
    if (!lobbyPlayers) return;

    currentPlayers = [];
    currentBots = [];

    lobbyPlayers.innerHTML = `
      <div class="lobby-waiting-message">
        ${escapeHTML(message)}
      </div>
    `;

    if (lobbyPlayerCount) {
      lobbyPlayerCount.textContent =
        `0/${Number(activeRoom?.max_players || 12)}`;
    }

    updateReadyButton();
    updateStartButton([], []);
    updateGameSettingsSummary();
    updateBotControls();
  }

  /* =========================================
     RENDER PLAYERS AND BOTS
  ========================================= */

  function renderPlayers(players, bots = []) {
    if (!lobbyPlayers || !activeRoom) return;

    currentPlayers = players;
    currentBots = bots;

    const maxPlayers = Number(activeRoom.max_players || 12);
    const totalCount = players.length + bots.length;

    if (lobbyPlayerCount) {
      lobbyPlayerCount.textContent =
        `${totalCount}/${maxPlayers}`;
    }

    if (lobbyWaitingMessage) {
      lobbyWaitingMessage.hidden = totalCount >= maxPlayers;
    }

    updateReadyButton();
    updateStartButton(players, bots);
    updateGameSettingsSummary();
    updateBotControls();

    const playerCards = players.map((player, index) => {
      const isMe = player.user_id === currentUser?.id;

      const isHost =
        player.user_id === activeRoom.host_id ||
        (isMe && isRoomHost);

      const isReady = Boolean(player.is_ready);

      const playerName = isMe
        ? getUserName(currentUser)
        : `Oyunçu ${player.seat_number || index + 1}`;

      const avatarLetter = playerName.charAt(0).toUpperCase();

      return `
        <div class="
          lobby-player-card
          ${isHost ? "is-host" : ""}
          ${isReady ? "is-ready" : "is-not-ready"}
        ">
          <div class="lobby-player-avatar">
            ${escapeHTML(avatarLetter)}
          </div>

          <div class="lobby-player-name">
            ${escapeHTML(playerName)}
          </div>

          <div class="lobby-player-status">
            ${isMe ? "Siz" : "Qoşulub"}
          </div>

          <span class="lobby-ready-label ${isReady ? "ready" : "not-ready"}">
            ${isReady ? "✓ HAZIRDIR" : "HAZIR DEYİL"}
          </span>

          ${
            isHost
              ? '<span class="lobby-player-host-label">HOST</span>'
              : ""
          }
        </div>
      `;
    });

    const botCards = bots.map((bot) => {
      const botName = bot.bot_name || "Bot";

      return `
        <div class="lobby-player-card lobby-bot-card is-ready">
          <div class="lobby-player-avatar">
            🤖
          </div>

          <div class="lobby-player-name">
            ${escapeHTML(botName)}
          </div>

          <div class="lobby-player-status">
            Süni oyunçu
          </div>

          <span class="lobby-ready-label ready">
            ✓ HAZIRDIR
          </span>

          <span class="lobby-bot-label">BOT</span>
        </div>
      `;
    });

    const emptySlots = [];

    for (let i = totalCount; i < maxPlayers; i++) {
      emptySlots.push(`
        <div class="lobby-empty-slot">
          <div class="lobby-player-avatar">+</div>
          <div class="lobby-player-name">Boş yer</div>
          <div class="lobby-player-status">Gözlənilir</div>
        </div>
      `);
    }

    lobbyPlayers.innerHTML = [
      ...playerCards,
      ...botCards,
      ...emptySlots
    ].join("");
  }

  /* =========================================
     ROLE SYSTEM
  ========================================= */

  async function displayMyRole() {
    if (!activeRoomId || !currentUser) return;

    try {
      const { data, error } = await mafiaDB
        .from("room_player_roles")
        .select("role")
        .eq("room_id", activeRoomId)
        .eq("user_id", currentUser.id)
        .maybeSingle();

      if (error) throw error;

      if (!data?.role || !ROLE_NAMES_VALID(data.role)) {
        showMessage(
          "Rol tapılmadı",
          "Rol məlumatınız hələ yüklənməyib. Bir neçə saniyə sonra səhifəni yeniləyin."
        );
        return;
      }

      const role = data.role;
      const roleName = roleNames[role];
      const description = roleDescriptions[role];

      showModal(
        `SƏNİN ROLUN: ${roleName}`,
        description
      );

    } catch (error) {
      console.error("Rol yüklənmə xətası:", error);

      showMessage(
        "Rol yüklənmədi",
        error.message || "Rol məlumatını əldə etmək mümkün olmadı."
      );
    }
  }

  function ROLE_NAMES_VALID(role) {
    return Object.prototype.hasOwnProperty.call(roleNames, role);
  }

  /* =========================================
     START GAME
  ========================================= */

  async function handleStartGame() {
    if (!isRoomHost || isStartingGame) return;

    if (!activeRoomId || !activeRoom) {
      showMessage("Xəta", "Otaq məlumatları tapılmadı.");
      return;
    }

    if (activeRoom.status !== "waiting") {
      showMessage("Məlumat", "Bu oyunun artıq başladığı görünür.");
      return;
    }

    const totalCount = getTotalPlayerCount();

    const enoughPlayers = totalCount >= MIN_PLAYERS;

    const allReady =
      enoughPlayers &&
      currentPlayers.every(
        (player) => Boolean(player.is_ready)
      );

    if (!enoughPlayers) {
      showMessage(
        "Oyunçu sayı azdır",
        `Oyuna başlamaq üçün ən azı ${MIN_PLAYERS} iştirakçı lazımdır. Hazırda ${totalCount} nəfər var.`
      );
      return;
    }

    if (!allReady) {
      showMessage(
        "Oyunçular hazır deyil",
        "Oyunu başlamaq üçün bütün insan oyunçular hazır olmalıdır."
      );
      return;
    }

    isStartingGame = true;
    updateStartButton();

    try {
      const { data, error } = await mafiaDB.rpc(
        "start_mafia_game",
        {
          p_room_id: activeRoomId
        }
      );

      if (error) throw error;

      if (data === false) {
        throw new Error("Oyun başlatıla bilmədi.");
      }

      activeRoom = {
        ...activeRoom,
        status: "playing"
      };

      renderLobby();
      updateStartButton();

      await displayMyRole();

    } catch (error) {
      console.error("Oyuna başlama xətası:", error);

      showMessage(
        "Oyuna başlamaq mümkün olmadı",
        error.message || "Naməlum xəta baş verdi."
      );

    } finally {
      isStartingGame = false;
      updateStartButton();
    }
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
          scheduleLobbyRefresh();
        }
      )

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_bots",
          filter: `room_id=eq.${activeRoomId}`
        },
        () => {
          scheduleLobbyRefresh();
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
        async (payload) => {
          if (!payload.new) return;

          const previousStatus = activeRoom?.status;

          activeRoom = {
            ...activeRoom,
            ...payload.new
          };

          renderLobby();
          renderGameSettings();
          updateStartButton();

          if (
            previousStatus !== "playing" &&
            activeRoom.status === "playing"
          ) {
            await displayMyRole();
          }
        }
      )

      .subscribe((status) => {
        console.log("Lobby realtime status:", status);
      });
  }

  function scheduleLobbyRefresh() {
    clearTimeout(refreshTimeout);

    refreshTimeout = setTimeout(() => {
      refreshLobbyPlayers();
    }, 300);
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

      showMessage(
        "Otaq kodu",
        `Otaq kodunuz: ${code}`
      );
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
      currentPlayers = [];
      currentBots = [];

      isRoomHost = false;
      isUpdatingReady = false;
      isSavingGameSettings = false;
      isStartingGame = false;
      isAddingBot = false;

      if (readyButton) {
        readyButton.remove();
        readyButton = null;
      }

      showHome();

    } catch (error) {
      console.error("Otaqdan çıxma xətası:", error);

      showMessage(
        "Xəta",
        "Otaqdan çıxarkən xəta baş verdi."
      );
    }
  }

  /* =========================================
     LANGUAGE
  ========================================= */

  function translatePage(language) {
    currentLanguage = ["az", "tr", "en"].includes(language)
      ? language
      : "az";

    document.documentElement.lang = currentLanguage;

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
  addBotBtn?.addEventListener("click", addRoomBot);

  $("languageSelect")?.addEventListener("change", (event) => {
    translatePage(event.target.value);
  });

  /* GAME SETTINGS EVENTS */

  [
    gameMafiaCount,
    gameDoctorCount,
    gameDetectiveCount,
    gameDiscussionTime,
    gameVotingTime
  ].forEach((control) => {
    control?.addEventListener("change", updateGameSettingsSummary);
  });

  saveGameSettingsBtn?.addEventListener(
    "click",
    saveGameSettings
  );

  /* =========================================
     INITIALIZATION
  ========================================= */

  async function initializeApp() {
    await getCurrentUser();

    translatePage(currentLanguage);

    addReadyButtonStyles();

    console.log("MAFIA app.js initialized.");
  }

  initializeApp();

})();
