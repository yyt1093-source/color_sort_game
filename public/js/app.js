/**
 * Main Application Controller for Color Sort Telegram Mini App
 */
async function initColorSortApp() {
  console.log('[App] Initializing Color Sort Game...');

  // 1. Init Telegram
  const TG = window.TelegramApp && window.TelegramApp.TelegramApp ? window.TelegramApp.TelegramApp : null;
  if (TG) TG.initTelegram();
  const userData = TG ? TG.getUserData() : {
    telegramId: 'guest_' + Math.floor(Math.random() * 10000),
    firstName: 'Игрок',
    photoUrl: ''
  };

  // 1.1 Maintenance Access Control (Admins Alligator & Maria always allowed)
  const MAINTENANCE_ALLOWED_IDS = ['5761685341', '7116446051'];
  const MAINTENANCE_ALLOWED_USERNAMES = ['alligator0709', 'maria290355'];

  const checkTid = String(userData.telegramId || localStorage.getItem('cs_last_telegram_id') || '').trim();
  const checkUname = String(userData.username || localStorage.getItem('cs_last_username') || '').toLowerCase().replace(/^@/, '').trim();
  const checkFirst = String(userData.firstName || localStorage.getItem('cs_last_first_name') || '').toUpperCase().trim();
  const isAllowedPlayer = MAINTENANCE_ALLOWED_IDS.includes(checkTid) || 
                          (checkUname && MAINTENANCE_ALLOWED_USERNAMES.includes(checkUname)) ||
                          checkUname.includes('alligator') ||
                          checkFirst.includes('ALLIGATOR') ||
                          checkTid === '5761685341' ||
                          (typeof sessionAdminPin !== 'undefined' && sessionAdminPin === '1986') ||
                          localStorage.getItem('color_sort_admin_pin') === '1986';

  window.__maintenanceBlocked = false;
  const maintEl = document.getElementById('maintenanceScreen');
  if (maintEl) maintEl.style.display = 'none';

  function applyMaintenanceBlock(messageText) {
    if (isAllowedPlayer || (typeof isAlligatorAdmin === 'function' && isAlligatorAdmin(currentUser))) return;
    console.warn('[Maintenance] Access closed for player:', checkTid, checkUname);
    window.__maintenanceBlocked = true;
    if (maintEl) {
      if (messageText) {
        const textEl = document.getElementById('maintenanceText');
        if (textEl) textEl.textContent = messageText;
      }
      maintEl.style.display = 'flex';
    }
    const startEl = document.getElementById('startScreen');
    if (startEl) startEl.style.display = 'none';
    const appEl = document.getElementById('appContainer');
    if (appEl) appEl.style.display = 'none';
    try {
      if (typeof audio !== 'undefined' && audio.stopAll) audio.stopAll();
      if (window.SoundEngine && window.SoundEngine.SoundEngine && window.SoundEngine.SoundEngine.stopAll) {
        window.SoundEngine.SoundEngine.stopAll();
      }
    } catch (e) {}
  }

  function liftMaintenanceBlock() {
    window.__maintenanceBlocked = false;
    if (maintEl) maintEl.style.display = 'none';
    const startEl = document.getElementById('startScreen');
    if (startEl && !window.__gameAlreadyStarted) {
      startEl.style.display = 'flex';
      startEl.style.pointerEvents = 'auto';
    }
    const appEl = document.getElementById('appContainer');
    if (appEl && window.__gameAlreadyStarted) {
      appEl.style.display = 'flex';
    }
  }

  // 2. Init Adsgram
  let AdController = null;
  let adsgramBlockId = '47788';

  async function initAdsgram() {
    try {
      const cfg = await apiCall('/api/config');
      if (cfg) {
        if (cfg.maintenance && !isAllowedPlayer) {
          applyMaintenanceBlock(cfg.maintenanceMessage);
          return;
        } else {
          liftMaintenanceBlock();
        }
        if (cfg.adsgramBlockId) {
          adsgramBlockId = String(cfg.adsgramBlockId).trim();
        }
        if (cfg.tonDepositAddress) {
          tonDepositAddress = String(cfg.tonDepositAddress).trim();
        }
      }
    } catch (e) {}

    try {
      if (window.Adsgram && adsgramBlockId) {
        AdController = window.Adsgram.init({
          blockId: adsgramBlockId,
          debug: false
        });
        console.log('[Adsgram] Инициализирован в боевом режиме с Block ID:', adsgramBlockId);
      } else if (window.Adsgram) {
        console.log('[Adsgram] SDK загружен, ожидается настройка Block ID в .env');
      }
    } catch (e) {
      console.warn('[Adsgram] Ошибка инициализации:', e);
    }
  }

  async function showRewardedAd() {
    const adModal = document.getElementById('adModal');
    const wasAdModalOpen = adModal && !adModal.classList.contains('hidden') && adModal.style.display !== 'none';

    // Временно скрываем модальное окно выбора бонусов на время показа рекламы
    if (wasAdModalOpen) {
      adModal.classList.add('hidden');
      adModal.style.display = 'none';
    }

    try {
      // 1. Проверяем наличие официального SDK Adsgram
      if (!window.Adsgram) {
        console.warn('[Adsgram] SDK sad.min.js не загружен');
        return { success: false, unavailable: true };
      }

      // 2. Инициализируем AdController, если ещё не инициализирован
      if (!AdController && adsgramBlockId) {
        try {
          AdController = window.Adsgram.init({
            blockId: adsgramBlockId,
            debug: false
          });
          console.log('[Adsgram] Инициализирован перед показом с Block ID:', adsgramBlockId);
        } catch (e) {
          console.warn('[Adsgram] Ошибка инициализации перед показом:', e);
          return { success: false, unavailable: true };
        }
      }

      if (!AdController) {
        console.warn('[Adsgram] AdController отсутствует');
        return { success: false, unavailable: true };
      }

      console.log(`[Adsgram] Запрос официального показа рекламы (Block ID: ${adsgramBlockId})...`);
      const res = await AdController.show();
      console.log('[Adsgram] Ответ SDK:', res);

      // Официальный Adsgram подтвердил полный просмотр ролика
      if (res && (res.done === true || res === true)) {
        return { success: true };
      }

      // Пользователь закрыл ролик до завершения
      if (res && res.done === false) {
        console.warn('[Adsgram] Ролик закрыт пользователем до завершения');
        if (wasAdModalOpen && adModal) {
          adModal.classList.remove('hidden');
          adModal.style.display = 'flex';
        }
        return { success: false, dismissed: true };
      }

      if (wasAdModalOpen && adModal) {
        adModal.classList.remove('hidden');
        adModal.style.display = 'flex';
      }
      return { success: false, unavailable: true };
    } catch (err) {
      console.warn('[Adsgram] Ответ SDK / ошибка:', err);
      if (wasAdModalOpen && adModal) {
        adModal.classList.remove('hidden');
        adModal.style.display = 'flex';
      }
      // Если пользователь нажал крестик / закрыл ролик
      if (err && (err.state === 'dismiss' || err.done === false)) {
        return { success: false, dismissed: true };
      }
      // Рекламы нет (no fill), ошибка сети или неподдерживаемый регион
      return { success: false, unavailable: true, description: err?.description || err?.message };
    }
  }

  // --- Game Session & Anti-Cheat Move Tracking ---
  let activeGameSessionToken = null;
  let activeMovesLog = [];
  let currentLevelStartedAt = Date.now();
  let currentLevelBoostersUsed = { hints: 0, undos: 0, reveals: 0, extraBottles: 0 };
  let pendingLevelVictory = null;

  // Verified Ad Watching Helper (Server-Authoritative)
  async function watchRewardedAdForBonus(rewardType) {
    let tokenRes = null;
    try {
      tokenRes = await apiCall('/api/ad-reward/start', 'POST', { rewardType });
    } catch (e) {}

    // Если сервер вернул ошибку 429 (cooldown лимит времени)
    if (tokenRes && tokenRes.success === false && tokenRes.error) {
      showInfoModal('⏳', 'Реклама', tokenRes.error);
      return false;
    }

    const adResult = await showRewardedAd();
    if (!adResult || !adResult.success) {
      if (adResult && adResult.dismissed) {
        showInfoModal('⏳', t('adTitle') || 'Реклама', t('adDismissedDesc') || 'Просмотр рекламы был прерван. Бонус начисляется только за полный просмотр ролика.');
      } else {
        showInfoModal('📺', t('adUnavailableTitle') || 'Реклама', t('adUnavailableDesc') || 'Реклама сейчас недоступна. Пожалуйста, попробуйте позже!');
      }
      return false;
    }

    // Подтверждение просмотра и начисление бонуса
    let claimRes = null;
    if (tokenRes && tokenRes.adToken) {
      try {
        claimRes = await apiCall('/api/ad-reward/claim', 'POST', {
          adToken: tokenRes.adToken,
          rewardType
        });
      } catch (e) {}
    }

    // Если /claim не сработал или нет adToken (например, на Vercel), используем прямой /api/ad-reward
    if (!claimRes || !claimRes.success) {
      try {
        claimRes = await apiCall('/api/ad-reward', 'POST', {
          rewardType,
          adToken: tokenRes ? tokenRes.adToken : undefined,
          telegramId: currentUser ? currentUser.telegramId : undefined
        });
      } catch (e) {}
    }

    if (claimRes && claimRes.success) {
      // 1. Надежно добавляем полученную награду в локальный объект пользователя
      if (rewardType === 'hints') {
        currentUser.hints = (currentUser.hints || 0) + 1;
      } else if (rewardType === 'undos') {
        currentUser.undos = (currentUser.undos || 0) + 1;
      } else if (rewardType === 'reveal_bottle' || rewardType === 'reveals') {
        currentUser.reveals = (currentUser.reveals || 0) + 1;
      } else if (rewardType === 'extra_bottle' || rewardType === 'extra_bottles') {
        currentUser.extraBottles = (currentUser.extraBottles || 0) + 1;
        currentUser.extra_bottles = currentUser.extraBottles;
      } else if (rewardType === 'coins') {
        currentUser.coins = (currentUser.coins || 0) + 150;
      }

      // 2. Неразрушающее слияние с данными сервера (никогда не зануляем другие бустеры и не сбрасываем уровень!)
      if (claimRes.user) {
        const srv = claimRes.user;
        const srvMaxLvl = Math.max(Number(srv.maxLevel || 0), Number(srv.max_level || 0), Number(srv.level || 0));
        const srvCurLvl = Math.max(Number(srv.currentLevel || 0), Number(srv.current_level || 0), srvMaxLvl);
        if (srvMaxLvl > 0) currentUser.maxLevel = Math.max(Number(currentUser.maxLevel || 1), srvMaxLvl);
        if (srvCurLvl > 0) currentUser.currentLevel = Math.max(Number(currentUser.currentLevel || 1), srvCurLvl, Number(currentUser.maxLevel || 1));
        currentUser.level = currentUser.maxLevel;

        currentUser.hints = Math.max(Number(currentUser.hints || 0), Number(srv.hints || 0));
        currentUser.undos = Math.max(Number(currentUser.undos || 0), Number(srv.undos || 0));
        currentUser.reveals = Math.max(Number(currentUser.reveals || 0), Number(srv.reveals || 0));
        const srvBottles = Math.max(Number(srv.extraBottles || 0), Number(srv.extra_bottles || 0));
        currentUser.extraBottles = Math.max(Number(currentUser.extraBottles || 0), srvBottles);
        currentUser.extra_bottles = currentUser.extraBottles;
        if (srv.coins) currentUser.coins = Math.max(Number(currentUser.coins || 0), Number(srv.coins || 0));
      }

      normalizeUserObject(currentUser);
      currentUser.updatedAt = Date.now();
      saveLocalUser();
      syncPlayerToCloud(currentUser);
      updateHeaderUI();

      // Закрываем окно рекламы, если оно было открыто
      const adModal = document.getElementById('adModal');
      if (adModal) {
        closeModal(adModal);
        resetAdModalButtons();
      }

      // Показываем красивое поздравительное модальное окно с полученной наградой
      showAdRewardSuccessModal(rewardType);
      return true;
    } else {
      const err = (claimRes && claimRes.error) ? claimRes.error : (t('adUnavailableDesc') || 'Реклама сейчас недоступна. Пожалуйста, попробуйте позже!');
      showInfoModal('⚠️', 'Ошибка', err);
      return false;
    }
  }

  // --- Translations (i18n) for 5 Languages: RU, UK, EN, DE, LT ---
    const TRANSLATIONS = {
    ru: {
      langName: "Русский",
      levelLabel: "Уровень",
      levelDisplayVal: (lvl) => `Уровень ${lvl}`,
      profileHint: "⚙️ Язык",
      profileTitle: "⚙️ Профиль",
      profileTabLabel: "Профиль",
      referralsTabLabel: "Рефералы",
      adminTabLabel: "Админ",
      langSectionTitle: "Сменить язык",
      restartBtn: "Сначала",
      undoBtn: "Отмена",
      hintBtn: "Подсказка",
      revealBtn: "Открыть цвета",
      extraBottleBtn: "Пустая колба",
      adBonusBtn: "Реклама",
      leaderboardTitle: "🏆 Таблица лидеров",
      leaderboardLive: "24/7 LIVE",
      leaderboardLoading: "⏳ Загрузка живых игроков...",
      leaderboardEmptyTitle: "Рейтинг пока формируется",
      leaderboardEmptyDesc: "Пройдите уровень через Telegram бота @sortcolors_bot, чтобы стать первым в глобальной таблице!",
      youTag: "(Вы)",
      maxLevelLabel: (lvl) => `Макс. уровень: ${lvl}`,
      levelPrefix: "Уровень",
      bottlesCountTag: (n) => {
        const mod10 = n % 10;
        const mod100 = n % 100;
        if (mod100 >= 11 && mod100 <= 19) return `${n} баночек`;
        if (mod10 === 1) return `${n} баночка`;
        if (mod10 >= 2 && mod10 <= 4) return `${n} баночки`;
        return `${n} баночек`;
      },
      winTitle: (lvl) => `Уровень ${lvl} пройден! 🎉`,
      winSubtext: (lvl) => `Все цвета успешно собраны! Переходим к уровню ${lvl}...`,
      nextLevelBtn: "Следующий уровень 🚀",
      restartTitle: "🔄 Начать заново?",
      restartDesc: "Весь прогресс на этом уровне будет сброшен.",
      cancelBtn: "Отмена",
      confirmRestartBtn: "Рестарт",
      securityAlertTitle: "Система безопасности Color Sort",
      securityAlertSubtitle: "Замечены хакерские действия",
      securityAlertRestartBtn: (lvl) => `Начать уровень ${lvl} заново`,
      serverReloadTitle: "Перезагрузка сервера",
      serverReloadDesc: "Выполняется обновление защиты и системы безопасности игры.<br>Пожалуйста, перезапустите игру для загрузки новой версии.",
      serverReloadTimerLabel: "Авто-перезапуск через:",
      serverReloadBtn: "Перезайти в игру",
      adModalTitle: "🎁 Реклама",
      adModalDesc: "Посмотрите короткие видео и получите бесплатные бонусы",
      adModalBottleTitle: "Пустая колба",
      adModalBottleDesc: "+1 пустая колба в запас",
      adModalHintsTitle: "+1 подсказка",
      adModalHintsDesc: "1 точная подсказка хода",
      adModalUndosTitle: "+1 отмена хода",
      adModalUndosDesc: "1 бесплатная отмена хода",
      adModalRevealTitle: "Открыть цвета",
      adModalRevealDesc: "Открыть 1 баночку со всеми цветами",
      noMovesTitle: "Нет ходов",
      noMovesDesc: "Вы ещё не сделали ни одного хода на этом уровне для отмены.",
      noHintDesc: "Нет доступных ходов, которые открывают новую краску. Попробуйте перелить другие цвета или добавьте пустую колбу!",
      allColorsVisibleTitle: "Все цвета видны",
      allColorsVisibleDesc: "В баночках на этом этапе уже открыты все цвета!",
      extraBottleTitle: "🎉 Успех",
      extraBottleDesc: "Пустая колба добавлена на поле!",
      extraBottleModalTitle: "Пустая колба",
      extraBottleModalPrompt: "У вас 0 пустых колб. Посмотрите короткую рекламу, чтобы получить пустую колбу на поле!",
      claimAdBtn: "▶ Смотреть рекламу",
      adStarting: "⏳ Запуск...",
      adClaimed: "✅ Получено! (+1)",
      adUnavailableTitle: "Реклама недоступна",
      adUnavailableDesc: "Реклама сейчас недоступна. Пожалуйста, попробуйте позже!",
      adDismissedDesc: "Просмотр рекламы был прерван. Бонус начисляется только за полный просмотр ролика.",
      adSuccessTitle: "Поздравляем! 🎉",
      adSuccessBottle: "+1 Пустая колба",
      adSuccessBottleDesc: "Колбочка добавлена в ваш запас!",
      adSuccessHint: "+1 Подсказка",
      adSuccessHintDesc: "Подсказка добавлена в ваш запас!",
      adSuccessUndo: "+1 Шаг назад",
      adSuccessUndoDesc: "Отмена хода добавлена в ваш запас!",
      adSuccessReveal: "+1 Открыть цвета",
      adSuccessRevealDesc: "Открытие цветов добавлено в запас!",
      adSuccessBtn: "Отлично!",
      adminBadge: "👑 Админ",
      adminPanelTitle: "Панель Администратора",
      adminPanelSub: "Доступно только Аллигатору",
      adminBoostersTitle: "⚡ Бесплатные функции (Без рекламы):",
      adminAddBottle: "+5 Пустых колб",
      adminAddBoardBottle: "+1 Колба на поле",
      adminAddHints: "+5 Подсказок",
      adminAddUndos: "+5 Отмен хода",
      adminAddReveals: "+5 Открытий",
      adminAddCoins: "+5 TON",
      adminAddLevels: "+5 Уровней",
      adminAddAll: "Пополнить ВСЁ сразу (+10 ко всем бонусам)",
      adminBottleAddedMsg: (count) => `🧪 +5 Пустых колб добавлено (Всего: ${count})`,
      adminBoardBottleAddedMsg: "🧪 Пустая колба добавлена на поле!",
      adminHintsAddedMsg: (count) => `💡 +5 Подсказок добавлено (Всего: ${count})`,
      adminUndosAddedMsg: (count) => `↩️ +5 Отмен хода добавлено (Всего: ${count})`,
      adminRevealsAddedMsg: (count) => `🔮 +5 Открытий добавлено (Всего: ${count})`,
      adminCoinsAddedMsg: (count) => `💎 +5 TON добавлено (Баланс: ${Number(count || 0).toFixed(2)} TON)`,
      adminLevelsAddedMsg: (lvl) => `🏆 +5 Уровней добавлено! (Текущий уровень: ${lvl})`,
      adminSetExactLevelTitle: "🎯 Установить точный уровень (1-500)",
      adminSetExactLevelBtnLabel: "Установить",
      adminExactLevelSuccessMsg: (lvl) => `🎯 Уровень ${lvl} успешно установлен!`,
      adminAllAddedMsg: "⚡ Все бонусы пополнены (+10 к каждому)!",
      adminResetPurchasesTitle: "💎 Управление покупками за TON (Только Admin)",
      adminResetPurchasesDesc: "Аннулировать действующие покупки преимуществ за TON (например, «Все краски открыты») без списания баланса с кошельков игроков.",
      adminResetSelfPurchasesBtnLabel: "👑 Сбросить только мой аккаунт",
      adminResetPurchasesBtnLabel: "🌐 Сбросить ВСЕМ игрокам в игре",
      adminResetSeasonDesc: "Сброс сезона обнуляет глобальный лидерборд и сбрасывает всех игроков на Уровень 0. Баланс TON, покупки и рефералы сохраняются.",
      adminResetSeasonBtnLabel: "🔥 Сбросить сезон (Всё в ноль)",
      adminResetPurchasesSuccessTitle: "💎 Покупки аннулированы!",
      adminResetPurchasesSuccessDesc: "Все действующие преимущества за GRAM из сундучка у всех игроков успешно аннулированы. Балансы кошельков не изменились.",
      adminResetSuccessTitle: "💥 Сезон сброшен!",
      adminResetSuccessDesc: "Все игроки сброшены на Уровень 0! Лидерборд пуст. Баланс TON, покупки и рефералы сохранены.",
      adminTabActionsLabel: "Управление",
      adminTabActionsDesc: "Бустеры и сброс",
      adminTabHistoryLabel: "Исследование лидера",
      adminTabHistoryDesc: "Снимки 23:59",
      adminTabCodeBackupLabel: "Резервные копии",
      adminTabCodeBackupDesc: "Версии кода",
      adminCodeBackupTitle: "Резервные копии КОДА ИГРЫ (Время Киева)",
      adminCodeBackupSub: "🛡️ Здесь зафиксированы контрольные точки рабочего кода игры. Выгрузка новых версий выполняется разработчиком при программировании. Если потребуется откат, назовите разработчику дату нужной версии.",
      adminCodeBackupListTitle: "Зафиксированные версии кода игры (Киев):",
      adminCodeBackupEmptyText: "Копии кода еще не создавались",
      adminCodeBackupLoadingText: "Загрузка списка версий кода...",
      adminCodeBackupDeleteBtnLabel: "Удалить",
      adminSaveCurrentVersionBtn: "Сохранить текущую версию",
      adminSaveVersionActionTitle: "Фиксация рабочей версии кода",
      adminSaveVersionActionSub: "Сохранить текущее состояние игры в контрольные точки",
      adminSaveVersionModalTitle: "Сохранение версии кода",
      adminSaveVersionTitleLabel: "Название версии:",
      adminSaveVersionTagLabel: "Метка Git (тег):",
      adminSaveVersionNoteLabel: "Описание изменений и состояния:",
      adminSaveVersionConfirmBtn: "Зафиксировать версию",
      adminHistoryTitle: "История лидерборда",
      adminHistorySub: "Ежедневные снимки в 23:59 (Киев). Ручные снимки сохраняются отдельно.",
      adminHistoryListTitle: "История сохранённых снимков:",
      adminHistoryTakeSnapshotLabel: "Сделать снимок сейчас",
      adminHistoryViewBtnLabel: "Просмотреть",
      adminHistoryDeleteBtnLabel: "Удалить",
      adminSnapshotAutoBadge: "🤖 Авто (23:59)",
      adminSnapshotManualBadge: "✋ Ручной",
      adminViewerBackBtn: "← Назад к списку снимков",
      adminHistoryEmptyText: "Нет сохранённых снимков",
      adminHistoryLoadingText: "Загрузка списка снимков...",
      adminHistoryColRank: "#",
      adminHistoryColPlayer: "Игрок",
      adminHistoryColTid: "Telegram ID",
      adminHistoryColLevel: "Уровень",
      adminHistoryTotalBadge: (count) => `👥 ${count} игроков`,
      adminHistorySearchPlaceholder: "Поиск по имени, username или ID...",
      adminHistorySnapshotSuccess: "📸 Ручной снимок текущего лидерборда успешно сохранён!",
      deleteSnapshotModalTitle: "Удаление снимка",
      deleteSnapshotLead: "Вы действительно хотите удалить этот снимок лидерборда?",
      deleteSnapshotSuccess: "🗑️ Снимок лидерборда успешно удалён!",
      adminTabWalletsLabel: "Кошелек",
      adminTabWalletsDesc: "TON игроки",
      adminWalletsTitle: "Кошельки игроков",
      adminWalletsSub: "Игроки, подключившие TON кошелёк к игре",
      adminWalletsEmptyText: "Нет игроков с подключённым кошельком",
      adminWalletsLoadingText: "Загрузка кошельков игроков...",
      adminWalletsSearchPlaceholder: "Поиск по нику, ID или адресу...",
      adminWalletViewBtnLabel: "Просмотреть",
      adminWalletDetailsTitle: "👛 Кошелёк игрока",
      adminWalletNoDeposits: "Подтверждённых пополнений пока нет",
      adminWalletBackBtn: "← Назад к списку кошельков",
      adminTabNewsLabel: "Новости",
      adminTabNewsDesc: "Рассылка сообщений в боте",
      adminNewsHeaderTitle: "Новости и рассылка игрокам",
      adminNewsHeaderSub: "Отправляйте игрокам сообщения, картинки, новости и обновления. В Telegram боте игрокам сразу придёт уведомление с кнопкой запуска игры!",
      adminNewsAudienceLabel: "Всего получателей (игроков):",
      adminNewsTimeLabel: "Время (Киев):",
      adminNewsTitleLabel: "Заголовок новости / сообщения:",
      adminNewsMessageLabel: "Текст сообщения игрокам:",
      adminNewsImageLabel: "Прикрепить картинку (необязательно):",
      adminNewsUploadFileLabel: "Выбрать фото с устройства",
      adminNewsButtonLabel: "Текст кнопки в сообщении Telegram:",
      adminNewsTestSendLabel: "Тестовая отправка себе (Админу)",
      adminNewsBroadcastLabel: "Опубликовать и разослать ВСЕМ игрокам",
      adminNewsHistoryTitle: "История отправленных новостей",
      adminNewsLoadingText: "Загрузка истории новостей...",
      adminNewsEmptyText: "Пока нет отправленных новостей",
      adminTabMaintenanceLabel: "Тех. работы",
      adminTabMaintenanceDesc: "Блокировка входа",
      adminMaintenanceHeaderTitle: "Управление техническими работами",
      adminMaintenanceHeaderSub: "Блокировка входа в игру для всех пользователей. Когда тех. работы включены, игроки при запуске видят окно «Идут технические работы». Доступ открыт только администраторам (Аллигатор и Мария).",
      adminMaintenanceStatusLabel: "Текущий статус входа:",
      adminMaintenanceStatusOpen: "🟢 Доступ открыт (Все игроки могут играть)",
      adminMaintenanceStatusActive: "🔴 Тех. работы активны (Вход заблокирован для всех)",
      adminMaintenanceToggleEnable: "Включить тех. работы (Заблокировать вход всем)",
      adminMaintenanceToggleDisable: "Выключить тех. работы (Открыть доступ всем)",
      adminMaintenancePreviewBtnLabel: "Предпросмотр окна тех. работ (как видят игроки)",
      adminMaintenanceMessageInputLabel: "Сообщение в окне технических работ:",
      adminMaintenanceResetMsgLabel: "По умолчанию",
      adminMaintenanceSaveMsgLabel: "Сохранить текст",
      tgChannelTitle: "Telegram–канал",
      officialBadge: "Официальный",
      ourProject: "Наш проект",
      tgChannelBadge: "Наш проект",
      tgChannelSub: "Новости, обновления и промокоды",
      tgChannelJoinBtn: "Перейти в канал",
      referralSectionTitle: "Color Sort",
      referralSectionSub: "За каждого приглашённого — 5 отмен хода, 5 подсказок, 5 открытий цвета и 5 пустых баночек",
      shareReferralTelegramBtn: "📢 Пригласить в Telegram",
      copyReferralLinkBtn: "📋 Скопировать ссылку",
      referralClaimTitle: "Доступны награды!",
      claimAllReferralsBtn: "Забрать всё",
      refUnitLabel: "друзей",
      referralsListHeader: "Приглашённые друзья:",
      tonModalTitle: "Пополнение баланса TON",
      tonConnectWalletBtn: "👛 Подключить кошелёк TON",
      tonWalletConnected: "Кошелёк подключен",
      tonDisconnectBtn: "Отключить",
      tonBalanceLabel: "Баланс в игре:",
      tonWithdrawBtn: "Вывести TON",
      tonDepositTitle: "Пополнить баланс",
      tonDepositDesc: "Отправьте TON на указанный адрес с вашим комментарием (Memo)",
      tonAddressLabel: "Адрес для перевода:",
      tonMemoLabel: "Ваш комментарий (Memo) — ОБЯЗАТЕЛЬНО:",
      tonDepositNotice: "⚠️ Обязательно укажите Memo при отправке, иначе средства не будут зачислены автоматически.",
      copyBtn: "Копировать",
      copiedNotice: "Скопировано в буфер обмена!",
      refCopySuccess: "Ссылка скопирована! Отправьте её друзьям.",
      refEmptyTitle: "Друзей пока нет",
      tonModalSubtitle: "Выберите сумму и любой удобный криптокошелек",
      tonBalanceSub: "Ваш текущий баланс TON:",
      tonWalletStatusSub: "Статус кошелька:",
      tonWalletDisconnected: "Не подключен",
      tonWalletConnected: "Активен",
      tonConnectHeading: "Подключение кошелька",
      tonConnectSubtext: "Привяжите кошелёк для наград и баланса",
      tonConnectBtnLabel: "Подключить TON Кошелёк",
      tonDisconnectBtnLabel: "Отключить кошелёк",
      disconnectWalletModalTitle: "Отключение кошелька",
      disconnectWalletModalDesc: "Вы действительно хотите отключить кошелёк?",
      disconnectWalletModalNote: "Ваш игровой баланс TON / GRAM полностью сохраняется в игре.",
      disconnectWalletConfirmBtn: "Да, отключить",
      disconnectWalletCancelBtn: "Отмена",
      tonAmountTitle: "Выберите сумму пополнения:",
      tonRewardLabel: "Зачисление на баланс GRAM:",
      tonChoiceHeader: "Выберите кошелёк для оплаты:",
      tonInstTitle: "Как оплатить через Telegram Wallet (@wallet):",
      tonInstStep1: "1. Нажмите на @wallet выше (комментарий автоматически скопируется).",
      tonInstStep2: "2. В боте выберите Отправить ➔ На сторонний кошелёк (TON).",
      tonAddrSub: "Адрес TON:",
      tonCopyLabel: "Копия",
      tonCopiedLabel: "Скопировано",
      tonVerifyBtn: "Проверить оплату",
      shopModalTitle: "Сундучок преимуществ",
      shopModalSubtitle: "Покупайте улучшения в игре за GRAM",
      shopBalanceSub: "Баланс в кошельке:",
      shopTopUpBtn: "+ Пополнить",
      shopActiveTitle: "Все краски открыты: АКТИВНО",
      shopSectionDivider: "Бустеры за криптовалюту GRAM",
      shopFeaturedTitle: "Все краски открыты",
      shopFeaturedDesc: "Все цвета во всех бутылочках открыты сразу с самого начала каждого уровня! Скрытые слои с вопросом «?» полностью убраны.",
      shopBottlesTitle: "+15 Пустых колб",
      shopBottlesDesc: "Запас дополнительных пустых колб для прохождения сложных уровней.",
      shopHintsTitle: "+20 Подсказок",
      shopHintsDesc: "Показывает лучший следующий ход при затруднении.",
      shopUndosTitle: "+20 Отмен хода",
      shopUndosDesc: "Возвращает ход назад в любой критической ситуации.",
      dailyBoostersTitle: "Подсказки каждый день (30 дней)",
      dailyBoostersDesc: "Первое начисление (+10 каждой подсказки) выдаётся сразу при покупке! Далее — каждый день ровно в 23:59 по Киеву в течение 30 дней.",
      dailyBoostersTag: "30 дней",
      dailyBoostersCounterLabel: "⏳ Осталось дней:",
      dailyBoostersNextLabel: "⏰ Следующее начисление:",
      dailyBoostersNextInfo: "⏰ Следующее начисление в 23:59 (Киев)",
      dailyBoostersBtnBuy: (price) => `Купить за ${price} GRAM`,
      dailyBoostersBtnExtend: (price) => `Продлить (+30 дн.) за ${price} GRAM`,
      dailyBoostersSuccessTitle: "✨ 30 дней подсказок активировано!",
      dailyBoostersSuccessMsg: "Вы успешно приобрели функцию за 5 GRAM!\n\nПервое начисление (+10 подсказок каждого вида) уже начислено на ваш баланс!\n\nПоследующие начисления будут начисляться каждый день ровно в 23:59 по Киеву в течение 30 дней.",
      dailyBoostersClaimTitle: "🎁 Ежедневный набор подсказок!",
      dailyBoostersClaimMsg: (amount, daysLeft) => `Наступило 23:59 (Киев)!\n\nВам начислено по ${amount} подсказок каждого вида:\n• ↩️ Отмена хода: +${amount}\n• 💡 Подсказка: +${amount}\n• 🔮 Открыть цвет: +${amount}\n• 🧪 Пустая колба: +${amount}\n\nОсталось дней: ${daysLeft}`,
      shopBuyGram: (price) => `Купить за ${price} GRAM`,
      shopActivateGram: (price) => `Активировать (${price} GRAM)`,
      shopExtendGram: (price) => `Продлить (+15 дн.) — ${price} GRAM`,
      resetPurchasesModalTitle: "Сброс покупок за TON",
      resetPurchasesWarningLead: "Внимание! Будут аннулированы действующие покупки:",
      confirmResetPurchasesBtnLabel: "💎 Сбросить покупки",
      resetSeasonModalTitle: "Сброс сезона",
      resetSeasonWarningLead: "Внимание! Это действие необратимо:",
      confirmResetSeasonBtnLabel: "🔥 Сбросить всё",
      shopActiveRemaining: (d, h, m) => `Осталось: ${d} дн. ${h} ч. ${m} мин.`,
      shopActiveExpiring: "Истекает...",
      shopFeaturedRibbon: "ХИТ 🔥",
      shopDurationTag: "⏳ 15 дней",
      shopPriceLabel: "Цена:",
      shopRevealsTitle: "+20 Открыть цвета",
      shopRevealsDesc: "Открывает скрытые цвета во всех колбах.",
      tonSpaceSub: "Приложение TON",
      tonWalletSub: "Telegram Кошелёк",
      tonCopyMemoTitle: "Скопировать Memo",
      tonConnecting: "Подключение...",
      tonConnectedPrefix: "Подключён:",
      tonConnectError: "Не удалось подключить кошелёк. Проверьте соединение или приложение кошелька.",
      tonVerifyingBtn: "Проверка платежа...",
      tonStepMinus: "Уменьшить",
      tonStepPlus: "Увеличить",
      refEmptyText: "Пока никто не зашёл по вашей ссылке. Отправьте ссылку друзьям в Telegram!",
      refClaimSubtitle: "+5 ко всем бонусам",
      rewardClaimed: "Награда получена",
      claimBonusBtn: "Забрать награду",
      adminPurchasesHeader: "💎 Управление покупками за TON (Только Admin)",
      adminResetSelfPurchasesBtn: "👑 Сбросить только мой аккаунт",
      resetPurchasesItem1: "🎨 Преимущество «Все краски открыты» будет выключено у всех игроков",
      resetPurchasesItem2: "⏳ Время действия всех активных улучшений из сундука будет обнулено",
      resetPurchasesItem3: "💎 Балансы TON / GRAM на кошельках игроков не изменятся",
      resetSeasonItem1: "💥 Глобальный лидерборд будет полностью очищен",
      resetSeasonItem2: "📉 Все игроки сбрасываются на Уровень 0",
      resetSeasonItem3: "🛡️ Баланс TON, покупки и рефералы сохраняются",
      resetSeasonItem4: "🏆 Игроки появятся в лидерборде только после победы в 1-м туре",
      adVideoSponsor: "РЕКЛАМНЫЙ СПОНСОР",
      adVideoTitle: "Новые игры в Telegram",
      adVideoDesc: "Играйте в топовые Mini Apps без установки!",
      adVideoBtn: "Смотреть каталог",
      adVideoStatus: "Пожалуйста, просмотрите рекламу до конца для получения бонуса",
      adVideoStatusSuccess: "🎉 Бонус начислен!",
      adVideoTimerReward: "✅ Награда разблокирована!",
      adVideoTimerSec: (s) => `⏳ ${s} сек`,
      soundBtnTitle: "Звук",
      refreshLeaderboardTitle: "Обновить рейтинг",
      closeBtn: "Закрыть",
      walletBtnTitle: "Кошелёк TON",
      shopBtnTitle: "Сундучок преимуществ",
      defaultPlayerName: "Игрок",
      infoModalTitle: "Информация",
      insufficientFundsTitle: "Недостаточно GRAM!",
      insufficientFundsDesc: (p, b) => `Для покупки требуется ${Number(p).toFixed(2)} GRAM. У вас на балансе: ${Number(b).toFixed(2)} GRAM.\n\nПополните баланс в TON кошельке, чтобы активировать преимущество!`,
      topUpBalanceBtn: "Пополнить баланс",
      bonusAddedBottle: "Вам добавлена +1 пустая колба в счётчик! Нажмите кнопку колбы, чтобы поставить её на поле.",
      bonusAddedHint: "Вам добавлена +1 подсказка в счётчик! Нажмите кнопку подсказки, чтобы использовать.",
      bonusAddedUndo: "Вам добавлена +1 отмена хода в счётчик! Нажмите кнопку отмены, чтобы использовать.",
      bonusAddedReveal: "Вам добавлено +1 открытие цвета в счётчик! Нажмите кнопку открытия, чтобы использовать.",
      outOfBottlesPrompt: "У вас 0 пустых колб. Посмотрите короткую рекламу, чтобы получить пустую колбу в счётчик!",
      outOfHintsPrompt: "У вас 0 подсказок. Посмотрите короткую рекламу, чтобы получить подсказку хода в счётчик!",
      outOfUndosPrompt: "У вас 0 отмен хода. Посмотрите короткую рекламу, чтобы получить отмену хода в счётчик!",
      outOfRevealsPrompt: "У вас 0 открытий. Посмотрите короткую рекламу, чтобы получить открытие цвета в счётчик!",
      bonusBottleTitle: "Пустая колба зачислена",
      bonusHintTitle: "Подсказка зачислена",
      bonusUndoTitle: "Отмена хода зачислена",
      bonusRevealTitle: "Открытие цвета зачислено",
      purchaseSuccessTitle: "Успешно зачислено!",
      purchaseSuccessAllColorsMsg: "Функция активирована на 15 дней!\n\nВсе скрытые слои жидкостей во всех колбах теперь видны сразу с 1-й секунды каждого уровня!",
      purchaseSuccessRevealsMsg: (c) => `Вам успешно начислено +20 открытий цвета (всего в наличии: ${c}).\n\nСчётчик на кнопке 🔮 «Открыть цвета» обновлён!`,
      purchaseSuccessBottlesMsg: (c) => `Вам успешно начислено +15 пустых колб (всего в наличии: ${c}).\n\nСчётчик на кнопке 🧪 «Пустая колба» обновлён!`,
      purchaseSuccessHintsMsg: (c) => `Вам успешно начислено +20 подсказок (всего в наличии: ${c}).\n\nСчётчик на кнопке 💡 «Подсказка» обновлён!`,
      purchaseSuccessUndosMsg: (c) => `Вам успешно начислено +20 отмен хода (всего в наличии: ${c}).\n\nСчётчик на кнопке ↩️ «Отмена» обновлён!`,
      adTabAds: "Бонусы",
      adTabGifts: "Подарки",
      adTabGiftsHeader: "🎁 Подарки",
      adTabGiftsDesc: "Получайте и отправляйте полезные подарки другим игрокам",
      giftsSubnavReceive: "📥 Получить подарки",
      giftsSubnavSend: "📤 Отправить подарок",
      giftsReceiveChecking: "Проверка входящих подарков...",
      giftsReceiveEmptyTitle: "Нет новых подарков",
      giftsReceiveEmptyDesc: "Когда другой игрок отправит вам подарок, он появится здесь с кнопкой «Забрать».",
      giftsClaimBtn: "Забрать",
      giftClaimedDone: "Забрано!",
      giftReceivedCardTitle: (name, amount) => `🎁 Подарок: ${name} (+${amount})`,
      giftReceivedCardDesc: "Вам прислан полезный подарок!",
      giftFromLabel: "От",
      adminSenderOptionLabel: "👑 От чьего имени отправить:",
      adminSenderFromSelf: "От своего имени",
      adminSenderFromGame: "От Color Sort",
      giftReceivedTimeKyiv: (time) => `🕒 ${time} (Киев)`,
      giftsDailySentLabel: "Отправлено сегодня:",
      giftsLimitFootnote: "Лимит: максимум 10 подарков в сутки. Сброс в 23:59 (Киев).",
      giftsAdminUnlimitedFootnote: "👑 Режим администратора: отправка подарков без ограничений (безлимит).",
      giftsUnlimitedTag: "∞ (Безлимит)",
      giftsStepRecipientTitle: "👥 Выберите получателя из игроков:",
      giftsSearchPlaceholder: "🔍 Поиск по имени или @username...",
      giftsSearchPlaceholderUser: "🔍 Найти игрока...",
      giftsPlayersLoading: "Загрузка списка игроков...",
      giftsPlayersNotFound: "Игроки по запросу не найдены",
      giftsPlayersEmpty: "Список игроков пуст",
      giftsSelectPlayerBtn: "Выбрать",
      giftsBackToRecipientsBtn: "‹ Сменить игрока",
      giftsRecipientLabel: "Получатель:",
      giftsStepItemTitle: "🎁 Выберите подарок для отправки:",
      giftsInStockLabel: "В наличии:",
      giftsSendActionBtn: "Подарить",
      giftItemUndo: "Отмена хода",
      giftItemHint: "Подсказка",
      giftItemReveal: "Открыть цвет",
      giftItemBottle: "Пустая колба",
      giftItemTon: "Монеты TON",
      adminTabBoostersLabel: "Подсказки",
      adminTabTonLabel: "Монеты TON",
      adminTonGiftHeading: "Отправить монеты TON",
      adminTonGiftFromBadge: "🎨 Подарок от имени: Color Sort",
      adminTonGiftAmountLabel: "Выберите или введите сумму (GRAM):",
      adminTonGiftNotice: "💡 Игрок получит этот подарок в синем оформлении как <b style=\"color: #38bdf8;\">«Подарок от Color Sort»</b>. При нажатии «Забрать» сумма сразу зачислится на текущий баланс TON, и игрок сможет покупать предметы и улучшения в Сундуке преимуществ.",
      btnAdminSendTonConfirm: "Отправить подарок игроку",
      giftQtyModalTitle: "Сколько подарить?",
      giftQtyRecipientDesc: "Получатель:",
      giftQtyInStockLabel: "В наличии:",
      giftQtyAvailableTodayLabel: "Доступно сегодня:",
      giftQtyPickerLabel: "Количество для отправки:",
      giftQtyPcs: "шт.",
      giftQtyConfirmBtn: (qty) => `Подарить (${qty} шт.)`,
      giftQtyCancelBtn: "Отмена",
      giftSelfSendError: "Вы не можете отправить подарок самому себе.",
      giftNoStockTitle: "У вас нет этого подарка",
      giftNoStockDesc: (name) => `У вас 0 шт. «${name}». Нельзя подарить предмет, которого нет в вашем балансе.`,
      giftLimitExceededTitle: "Лимит исчерпан",
      giftLimitExceededDesc: "Вы уже отправили максимум 10 подарков сегодня.\n\nСчётчик сбросится сегодня в 23:59 по времени Киева.",
      giftSentSuccessTitle: "Подарок отправлен!",
      giftSentSuccessDesc: (icon, name, qty, recipient, left, dailyNotice) => `Вы успешно отправили ${icon} «${name}» (${qty} шт.) игроку ${recipient}!\n\nС вашего баланса списано: ${qty} шт. (осталось: ${left}).\n${dailyNotice}`,
      giftClaimedSuccessTitle: "Подарок получен!",
      giftClaimedSuccessDesc: (icon, name, qty) => `Вы успешно забрали ${icon} «${name}» (+${qty})!\n\nПредмет добавлен в ваш баланс и готов к использованию.`,
      giftDailyNoticeAdmin: (count) => `Отправлено сегодня: ${count} шт. (Безлимит для администратора).`,
      giftDailyNoticeUser: (count, max) => `Отправлено сегодня: ${count} / ${max}.`,
      errorTitle: "Ошибка",
      errorSendGift: "Не удалось доставить подарок:",
      errorClaimGift: "Не удалось забрать подарок:",
      profileAdminQuickTitle: "Панель Администратора",
      profileAdminQuickSub: "Управление бонусами, снимки, кошельки и новости",
      adminPanelCollapseBtn: "Свернуть",
      adminPanelBottomCollapseBtn: "Свернуть панель администратора",
      seasonResetKickTitle: "Сброс сезона!",
      seasonResetKickOkBtn: "Начать заново (0 уровень)",
    },
    uk: {
      langName: "Українська",
      levelLabel: "Рівень",
      levelDisplayVal: (lvl) => `Рівень ${lvl}`,
      profileHint: "⚙️ Мова",
      profileTitle: "⚙️ Профіль",
      profileTabLabel: "Профіль",
      referralsTabLabel: "Реферали",
      adminTabLabel: "Адмін",
      langSectionTitle: "Змінити мову",
      restartBtn: "Спочатку",
      undoBtn: "Відміна",
      hintBtn: "Підказка",
      revealBtn: "Відкрити кольори",
      extraBottleBtn: "Порожня колба",
      adBonusBtn: "Реклама",
      leaderboardTitle: "🏆 Таблиця лідерів",
      leaderboardLive: "24/7 LIVE",
      leaderboardLoading: "⏳ Завантаження гравців...",
      leaderboardEmptyTitle: "Рейтинг формується",
      leaderboardEmptyDesc: "Пройдіть рівень через Telegram бота @sortcolors_bot, щоб стати першим у глобальній таблиці!",
      youTag: "(Ви)",
      maxLevelLabel: (lvl) => `Макс. рівень: ${lvl}`,
      levelPrefix: "Рівень",
      bottlesCountTag: (n) => {
        const mod10 = n % 10;
        const mod100 = n % 100;
        if (mod100 >= 11 && mod100 <= 19) return `${n} баночок`;
        if (mod10 === 1) return `${n} баночка`;
        if (mod10 >= 2 && mod10 <= 4) return `${n} баночки`;
        return `${n} баночок`;
      },
      winTitle: (lvl) => `Рівень ${lvl} пройдено! 🎉`,
      winSubtext: (lvl) => `Всі кольори успішно зібрані! Переходимо до рівня ${lvl}...`,
      nextLevelBtn: "Наступний рівень 🚀",
      restartTitle: "🔄 Почати заново?",
      restartDesc: "Весь прогрес на цьому рівні буде скинуто.",
      cancelBtn: "Скасувати",
      confirmRestartBtn: "Рестарт",
      securityAlertTitle: "Система безпеки Color Sort",
      securityAlertSubtitle: "Помічені хакерські дії",
      securityAlertRestartBtn: (lvl) => `Почати рівень ${lvl} заново`,
      serverReloadTitle: "Перезавантаження сервера",
      serverReloadDesc: "Виконується оновлення захисту та системи безпеки гри.<br>Будь ласка, перезапустіть гру для завантаження нової версії.",
      serverReloadTimerLabel: "Авто-перезапуск через:",
      serverReloadBtn: "Перезайти в гру",
      adModalTitle: "🎁 Реклама",
      adModalDesc: "Подивіться коротке відео та отримайте безкоштовні бонуси",
      adModalBottleTitle: "Порожня колба",
      adModalBottleDesc: "+1 порожня колба в запас",
      adModalHintsTitle: "+1 підказка",
      adModalHintsDesc: "1 точна підказка ходу",
      adModalUndosTitle: "+1 відміна ходу",
      adModalUndosDesc: "1 безкоштовна відміна ходу",
      adModalRevealTitle: "Відкрити кольори",
      adModalRevealDesc: "Відкрити 1 баночку з усіма кольорами",
      noMovesTitle: "Немає ходів",
      noMovesDesc: "Ви ще не зробили жодного ходу на цьому рівні для скасування.",
      noHintDesc: "Немає доступних ходів, які відкривають новий колір. Спробуйте перелити інші кольори або додайте порожню колбу!",
      allColorsVisibleTitle: "Всі кольори видно",
      allColorsVisibleDesc: "У баночках на цьому етапі вже відкриті всі кольори!",
      extraBottleTitle: "🎉 Успіх",
      extraBottleDesc: "Додаткова порожня колба додана на поле!",
      extraBottleModalTitle: "Додаткова колба",
      extraBottleModalPrompt: "У вас 0 додаткових колб. Подивіться коротку рекламу, щоб отримати порожню колбу на полі!",
      claimAdBtn: "▶ Дивитися рекламу",
      adStarting: "⏳ Запуск...",
      adClaimed: "✅ Отримано! (+1)",
      adUnavailableTitle: "Реклама недоступна",
      adUnavailableDesc: "Реклама зараз недоступна. Будь ласка, спробуйте пізніше!",
      adDismissedDesc: "Перегляд реклами було перервано. Бонус нараховується лише за повний перегляд ролика.",
      adminBadge: "👑 Адмін",
      adminPanelTitle: "Панель Адміністратора",
      adminPanelSub: "Доступно тільки Алігатору",
      adminBoostersTitle: "⚡ Безкоштовні функції (Без реклами):",
      adminAddBottle: "+5 Порожніх колб",
      adminAddBoardBottle: "+1 Колба на полі",
      adminAddHints: "+5 Підказок",
      adminAddUndos: "+5 Відмін ходу",
      adminAddReveals: "+5 Відкриттів",
      adminAddCoins: "+5 TON",
      adminAddLevels: "+5 Рівнів",
      adminAddAll: "Поповнити ВСЕ одразу (+10 до всіх бонусів)",
      adminBottleAddedMsg: (count) => `🧪 +5 Порожніх колб додано (Всього: ${count})`,
      adminBoardBottleAddedMsg: "🧪 Порожня колба додана на полі!",
      adminHintsAddedMsg: (count) => `💡 +5 Підказок додано (Всього: ${count})`,
      adminUndosAddedMsg: (count) => `↩️ +5 Відмін ходу додано (Всього: ${count})`,
      adminRevealsAddedMsg: (count) => `🔮 +5 Відкриттів додано (Всього: ${count})`,
      adminCoinsAddedMsg: (count) => `💎 +5 TON додано (Баланс: ${Number(count || 0).toFixed(2)} TON)`,
      adminLevelsAddedMsg: (lvl) => `🏆 +5 Рівнів додано! (Поточний рівень: ${lvl})`,
      adminSetExactLevelTitle: "🎯 Встановити точний рівень (1-500)",
      adminSetExactLevelBtnLabel: "Встановити",
      adminExactLevelSuccessMsg: (lvl) => `🎯 Рівень ${lvl} успішно встановлено!`,
      adminAllAddedMsg: "⚡ Всі бонуси поповнено (+10 до кожного)!",
      adminResetPurchasesTitle: "💎 Управління покупками за TON (Тільки Admin)",
      adminResetPurchasesDesc: "Анулювати діючі покупки переваг за TON без списання балансу з гаманців гравців.",
      adminResetSelfPurchasesBtnLabel: "👑 Скинути тільки мій акаунт",
      adminResetPurchasesBtnLabel: "🌐 Скинути ВСІМ гравцям в грі",
      adminResetSeasonDesc: "Скидання сезону обнуляє глобальний лідерборд і скидає всіх гравців на Рівень 0. Баланс TON, покупки та реферали зберігаються.",
      adminResetSeasonBtnLabel: "🔥 Скинути сезон (Все в нуль)",
      adminResetPurchasesSuccessTitle: "💎 Покупки анульовано!",
      adminResetPurchasesSuccessDesc: "Всі діючі переваги за GRAM із скриньки у всіх гравців успішно анульовані. Баланси гаманців не змінилися.",
      adminResetSuccessTitle: "💥 Сезон скинуто!",
      adminResetSuccessDesc: "Всі гравці скинуті на Рівень 0! Лідерборд порожній. Баланс TON, покупки та реферали збережені.",
      adminTabActionsLabel: "Керування",
      adminTabActionsDesc: "Бустери та скидання",
      adminTabHistoryLabel: "Дослідження лідера",
      adminTabHistoryDesc: "Знімки 23:59",
      adminTabCodeBackupLabel: "Резервні копії",
      adminTabCodeBackupDesc: "Версії коду",
      adminCodeBackupTitle: "Резервні копії КОДУ ГРИ (Час Києва)",
      adminCodeBackupSub: "🛡️ Тут зафіксовані контрольні точки робочого коду гри. Вивантаження нових версій виконується розробником під час програмування. Якщо знадобиться відкат, назвіть розробнику дату потрібної версії.",
      adminCodeBackupListTitle: "Зафіксовані версії коду гри (Київ):",
      adminCodeBackupEmptyText: "Копії коду ще не створювалися",
      adminCodeBackupLoadingText: "Завантаження списку версій коду...",
      adminCodeBackupDeleteBtnLabel: "Видалити",
      adminHistoryTitle: "Історія лідерборду",
      adminHistorySub: "Щоденні знімки о 23:59 (Київ). Ручні знімки зберігаються окремо.",
      adminHistoryListTitle: "Історія збережених знімків:",
      adminHistoryTakeSnapshotLabel: "Зробити знімок зараз",
      adminHistoryViewBtnLabel: "Переглянути",
      adminHistoryDeleteBtnLabel: "Видалити",
      adminSnapshotAutoBadge: "🤖 Авто (23:59)",
      adminSnapshotManualBadge: "✋ Ручний",
      adminViewerBackBtn: "← Назад до списку знімків",
      adminHistoryEmptyText: "Немає збережених знімків",
      adminHistoryLoadingText: "Завантаження списку знімків...",
      adminHistoryColRank: "#",
      adminHistoryColPlayer: "Гравець",
      adminHistoryColTid: "Telegram ID",
      adminHistoryColLevel: "Рівень",
      adminHistoryTotalBadge: (count) => `👥 ${count} гравців`,
      adminHistorySearchPlaceholder: "Пошук за ім'ям, username або ID...",
      adminHistorySnapshotSuccess: "📸 Ручний знімок поточного лідерборду успішно збережено!",
      deleteSnapshotModalTitle: "Видалення знімка",
      deleteSnapshotLead: "Ви дійсно бажаєте видалити цей знімок лідерборду?",
      deleteSnapshotSuccess: "🗑️ Знімок лідерборду успішно видалено!",
      adminTabWalletsLabel: "Гаманець",
      adminTabWalletsDesc: "TON гравці",
      adminWalletsTitle: "Гаманці гравців",
      adminWalletsSub: "Гравці, які підключили TON гаманець до гри",
      adminWalletsEmptyText: "Немає гравців з підключеним гаманцем",
      adminWalletsLoadingText: "Завантаження гаманців гравців...",
      adminWalletsSearchPlaceholder: "Пошук за ніком, ID або адресою...",
      adminWalletViewBtnLabel: "Проглянути",
      adminWalletDetailsTitle: "👛 Гаманець гравця",
      adminWalletNoDeposits: "Підтверджених поповнень поки немає",
      adminWalletBackBtn: "← Назад до списку гаманців",
      adminTabNewsLabel: "Новини",
      adminTabNewsDesc: "Розсилка повідомлень у боті",
      adminNewsHeaderTitle: "Новини та розсилка гравцям",
      adminNewsHeaderSub: "Надсилайте гравцям повідомлення, картинки, новини та оновлення. У Telegram боті гравцям одразу надійде сповіщення з кнопкою запуску гри!",
      adminNewsAudienceLabel: "Всього одержувачів (гравців):",
      adminNewsTimeLabel: "Час (Київ):",
      adminNewsTitleLabel: "Заголовок новини / повідомлення:",
      adminNewsMessageLabel: "Текст повідомлення гравцям:",
      adminNewsImageLabel: "Прикріпити картинку (необов'язково):",
      adminNewsUploadFileLabel: "Вибрати фото з пристрою",
      adminNewsButtonLabel: "Текст кнопки у повідомленні Telegram:",
      adminNewsTestSendLabel: "Тестове надсилання собі (Адміну)",
      adminNewsBroadcastLabel: "Опублікувати та розіслати ВСІМ гравцям",
      adminNewsHistoryTitle: "Історія надісланих новин",
      adminNewsLoadingText: "Завантаження історії новин...",
      adminNewsEmptyText: "Поки немає надісланих новин",
      adminTabMaintenanceLabel: "Тех. роботи",
      adminTabMaintenanceDesc: "Блокування входу",
      adminMaintenanceHeaderTitle: "Керування технічними роботами",
      adminMaintenanceHeaderSub: "Блокування входу до гри для всіх користувачів. Коли тех. роботи увімкнено, гравці при запуску бачать вікно «Йдуть технічні роботи». Доступ відкрито тільки адміністраторам (Алігатор та Марія).",
      adminMaintenanceStatusLabel: "Поточний статус входу:",
      adminMaintenanceStatusOpen: "🟢 Доступ відкрито (Всі гравці можуть грати)",
      adminMaintenanceStatusActive: "🔴 Тех. роботи активні (Вхід заблоковано для всіх)",
      adminMaintenanceToggleEnable: "Увімкнути тех. роботи (Заблокувати вхід всім)",
      adminMaintenanceToggleDisable: "Вимкнути тех. роботи (Відкрити доступ всім)",
      adminMaintenancePreviewBtnLabel: "Попередній перегляд вікна тех. робіт",
      adminMaintenanceMessageInputLabel: "Повідомлення у вікні технічних робіт:",
      adminMaintenanceResetMsgLabel: "За замовчуванням",
      adminMaintenanceSaveMsgLabel: "Зберегти текст",
      tgChannelTitle: "Telegram–канал",
      officialBadge: "Офіційний",
      ourProject: "Наш проєкт",
      tgChannelBadge: "Наш проєкт",
      tgChannelSub: "Новини, оновлення та промокоди",
      tgChannelJoinBtn: "Перейти до каналу",
      referralSectionTitle: "Color Sort",
      referralSectionSub: "За кожного запрошеного — 5 відмін ходу, 5 підказок, 5 відкриттів кольору та 5 порожніх баночок",
      shareReferralTelegramBtn: "📢 Запросити в Telegram",
      copyReferralLinkBtn: "📋 Скопіювати посилання",
      referralClaimTitle: "Доступні нагороди!",
      claimAllReferralsBtn: "Забрати все",
      refUnitLabel: "друзів",
      referralsListHeader: "Запрошені друзі:",
      tonModalTitle: "Поповнення балансу TON",
      tonModalSubtitle: "Виберіть суму та будь-який зручний криптогаманець",
      tonBalanceSub: "Ваш поточний баланс TON:",
      tonWalletStatusSub: "Статус гаманця:",
      tonWalletDisconnected: "Не підключений",
      tonWalletConnected: "Активний",
      tonConnectHeading: "Підключення гаманця",
      tonConnectSubtext: "Прив'яжіть гаманець для нагород та балансу",
      tonConnectBtnLabel: "Підключити TON Гаманець",
      tonDisconnectBtnLabel: "Відключити гаманець",
      disconnectWalletModalTitle: "Відключення гаманця",
      disconnectWalletModalDesc: "Ви дійсно бажаєте відключити гаманець?",
      disconnectWalletModalNote: "Ваш ігровий баланс TON / GRAM повністю зберігається в грі.",
      disconnectWalletConfirmBtn: "Так, відключити",
      disconnectWalletCancelBtn: "Скасувати",
      tonAmountTitle: "Виберіть суму поповнення:",
      tonRewardLabel: "Зарахування на баланс GRAM:",
      tonChoiceHeader: "Виберіть гаманець для оплати:",
      tonInstTitle: "Як оплатити через Telegram Wallet (@wallet):",
      tonInstStep1: "1. Натисніть на @wallet вище (коментар буде скопійовано).",
      tonInstStep2: "2. В ботові виберіть Надіслати ➔ На сторонній гаманець (TON).",
      tonAddrSub: "Адреса TON:",
      tonCopyLabel: "Копія",
      tonCopiedLabel: "Скопійовано",
      tonVerifyBtn: "Перевірити оплату",
      shopModalTitle: "Скринька переваг",
      shopModalSubtitle: "Купуйте покращення в грі за GRAM",
      shopBalanceSub: "Баланс у гаманці:",
      shopTopUpBtn: "+ Поповнити",
      shopActiveTitle: "Всі кольори відкриті: АКТИВНО",
      shopSectionDivider: "Бустери за криптовалюту GRAM",
      shopFeaturedTitle: "Всі кольори відкриті",
      shopFeaturedDesc: "Всі кольори у всіх пляшечках відкриті одразу з самого початку кожного рівня! Приховані шари з знаком «?» повністю прибрано.",
      shopBottlesTitle: "+15 Порожніх колб",
      shopBottlesDesc: "Запас додаткових порожніх колб для проходження складних рівнів.",
      shopHintsTitle: "+20 Підказок",
      shopHintsDesc: "Показує кращий наступний хід при складнощах.",
      shopUndosTitle: "+20 Відмін ходу",
      shopUndosDesc: "Повертає хід назад у будь-якій критичній ситуації.",
      dailyBoostersTitle: "Підказки щодня (30 днів)",
      dailyBoostersDesc: "Перше нарахування (+10 кожної підказки) видається одразу при купівлі! Далі — щодня рівно о 23:59 за Києвом протягом 30 днів.",
      dailyBoostersTag: "30 днів",
      dailyBoostersCounterLabel: "⏳ Залишилося днів:",
      dailyBoostersNextLabel: "⏰ Наступне нарахування:",
      dailyBoostersNextInfo: "⏰ Нарахування по 10 підказок о 23:59 (Київ)",
      dailyBoostersBtnBuy: (price) => `Купити за ${price} GRAM`,
      dailyBoostersBtnExtend: (price) => `Продовжити (+30 дн.) за ${price} GRAM`,
      dailyBoostersSuccessTitle: "✨ Набір на 30 днів активовано!",
      dailyBoostersSuccessMsg: "Ви успішно придбали функцію за 5 GRAM!\n\nПерше нарахування (+10 підказок кожного виду) вже нараховано на ваш баланс!\n\nПодальші нарахування відбуватимуться щодня рівно о 23:59 за Києвом протягом 30 днів.",
      dailyBoostersClaimTitle: "🎁 Щоденний набір підказок!",
      dailyBoostersClaimMsg: (amount, daysLeft) => `Настало 23:59 (Київ)!\n\nВам нараховано по ${amount} підказок кожного виду:\n• ↩️ Скасування ходу: +${amount}\n• 💡 Підказка: +${amount}\n• 🔮 Відкрити колір: +${amount}\n• 🧪 Порожня колба: +${amount}\n\nЗалишилося днів: ${daysLeft}`,
      shopBuyGram: (price) => `Купити за ${price} GRAM`,
      shopActivateGram: (price) => `Активувати (${price} GRAM)`,
      shopExtendGram: (price) => `Продовжити (+15 дн.) — ${price} GRAM`,
      resetPurchasesModalTitle: "Скидання покупок за TON",
      resetPurchasesWarningLead: "Увага! Будуть анульовані діючі покупки:",
      confirmResetPurchasesBtnLabel: "💎 Скинути покупки",
      resetSeasonModalTitle: "Скидання сезону",
      resetSeasonWarningLead: "Увага! Ця дія незворотна:",
      confirmResetSeasonBtnLabel: "🔥 Скинути все",
      shopActiveRemaining: (d, h, m) => `Залишилося: ${d} дн. ${h} год. ${m} хв.`,
      shopActiveExpiring: "Закінчується...",
      shopFeaturedRibbon: "ХІТ 🔥",
      shopDurationTag: "⏳ 15 днів",
      shopPriceLabel: "Ціна:",
      shopRevealsTitle: "+20 Відкрити кольори",
      shopRevealsDesc: "Відкриває приховані кольори у всіх колбах.",
      tonSpaceSub: "Додаток TON",
      tonWalletSub: "Telegram Гаманець",
      tonCopyMemoTitle: "Скопіювати Memo",
      tonConnecting: "Підключення...",
      tonConnectedPrefix: "Підключено:",
      tonConnectError: "Не вдалося підключити гаманець. Перевірте з'єднання або застосунок гаманця.",
      tonVerifyingBtn: "Перевірка платежу...",
      tonStepMinus: "Зменшити",
      tonStepPlus: "Збільшити",
      refEmptyText: "Поки ніхто не перейшов за вашим посиланням. Надішліть посилання друзям у Telegram!",
      refClaimSubtitle: "+5 до всіх бонусів",
      rewardClaimed: "Нагороду отримано",
      claimBonusBtn: "Забрати нагороду",
      adminPurchasesHeader: "💎 Керування покупками за TON (Тільки Admin)",
      adminResetSelfPurchasesBtn: "👑 Скинути тільки мій акаунт",
      resetPurchasesItem1: "🎨 Перевага «Всі фарби відкриті» буде вимкнена у всіх гравців",
      resetPurchasesItem2: "⏳ Час дії всіх активних покращень зі скриньки буде обнулено",
      resetPurchasesItem3: "💎 Баланси TON / GRAM на гаманцях гравців не зміняться",
      resetSeasonItem1: "💥 Глобальна таблиця лідерів буде повністю очищена",
      resetSeasonItem2: "📉 Всі гравці скидаються на Рівень 0",
      resetSeasonItem3: "🛡️ Баланс TON, покупки та реферали зберігаються",
      resetSeasonItem4: "🏆 Гравці з'являться в таблиці лише після перемоги в 1-му турі",
      adVideoSponsor: "РЕКЛАМНИЙ СПОНСОР",
      adVideoTitle: "Нові ігри в Telegram",
      adVideoDesc: "Грайте в топові Mini Apps без встановлення!",
      adVideoBtn: "Дивитися каталог",
      adVideoStatus: "Будь ласка, перегляньте рекламу до кінця для отримання бонусу",
      adVideoStatusSuccess: "🎉 Бонус нараховано!",
      adVideoTimerReward: "✅ Нагороду розблоковано!",
      adVideoTimerSec: (s) => `⏳ ${s} сек`,
      soundBtnTitle: "Звук",
      refreshLeaderboardTitle: "Оновити рейтинг",
      closeBtn: "Закрити",
      walletBtnTitle: "Гаманець TON",
      shopBtnTitle: "Скринька переваг",
      defaultPlayerName: "Гравець",
      infoModalTitle: "Інформація",
      insufficientFundsTitle: "Недостатньо GRAM!",
      insufficientFundsDesc: (p, b) => `Для покупки потрібно ${Number(p).toFixed(2)} GRAM. На вашому балансі: ${Number(b).toFixed(2)} GRAM.\n\nПоповніть баланс у TON гаманці, щоб активувати перевагу!`,
      topUpBalanceBtn: "Поповнити баланс",
      bonusAddedBottle: "Вам додано +1 порожню колбу в лічильник! Натисніть кнопку колби, щоб поставити її на поле.",
      bonusAddedHint: "Вам додано +1 підказку в лічильник! Натисніть кнопку підказки, щоб використати.",
      bonusAddedUndo: "Вам додано +1 відміну ходу в лічильник! Натисніть кнопку відміни, щоб використати.",
      bonusAddedReveal: "Вам додано +1 відкриття кольору в лічильник! Натисніть кнопку відкриття, щоб використати.",
      outOfBottlesPrompt: "У вас 0 порожніх колб. Подивіться коротку рекламу, щоб отримати порожню колбу в лічильник!",
      outOfHintsPrompt: "У вас 0 підказок. Подивіться коротку рекламу, щоб отримати підказку в лічильник!",
      outOfUndosPrompt: "У вас 0 відмін ходу. Подивіться коротку рекламу, щоб отримати відміну ходу в лічильник!",
      outOfRevealsPrompt: "У вас 0 відкриттів. Подивіться коротку рекламу, щоб отримати відкриття кольору в лічильник!",
      bonusBottleTitle: "Порожню колбу зараховано",
      bonusHintTitle: "Підказку зараховано",
      bonusUndoTitle: "Відміну ходу зараховано",
      bonusRevealTitle: "Відкриття кольору зараховано",
      purchaseSuccessTitle: "Успішно зараховано!",
      purchaseSuccessAllColorsMsg: "Функція активована на 15 днів!\n\nВсі приховані шари рідин у всіх колбах тепер видно одразу з 1-ї секунди кожного рівня!",
      purchaseSuccessRevealsMsg: (c) => `Вам успішно нараховано +20 відкриттів кольору (всього в наявності: ${c}).\n\nЛічильник на кнопці 🔮 «Відкрити кольори» оновлено!`,
      purchaseSuccessBottlesMsg: (c) => `Вам успішно нараховано +15 порожніх колб (всього в наявності: ${c}).\n\nЛічильник на кнопці 🧪 «Порожня колба» оновлено!`,
      purchaseSuccessHintsMsg: (c) => `Вам успішно нараховано +20 підказок (всього в наявності: ${c}).\n\nЛічильник на кнопці 💡 «Підказка» оновлено!`,
      purchaseSuccessUndosMsg: (c) => `Вам успішно нараховано +20 відмін ходу (всього в наявності: ${c}).\n\nЛічильник на кнопці ↩️ «Відміна» оновлено!`,
      adTabAds: "Бонуси",
      adTabGifts: "Подарунки",
      adTabGiftsHeader: "🎁 Подарунки",
      adTabGiftsDesc: "Отримуйте та надсилайте корисні подарунки іншим гравцям",
      giftsSubnavReceive: "📥 Отримати подарунки",
      giftsSubnavSend: "📤 Надіслати подарунок",
      giftsReceiveChecking: "Перевірка вхідних подарунків...",
      giftsReceiveEmptyTitle: "Немає нових подарунків",
      giftsReceiveEmptyDesc: "Коли інший гравець надішле вам подарунок, він з'явиться тут із кнопкою «Забрати».",
      giftsClaimBtn: "Забрати",
      giftClaimedDone: "Забрано!",
      giftReceivedCardTitle: (name, amount) => `🎁 Подарунок: ${name} (+${amount})`,
      giftReceivedCardDesc: "Вам надіслано корисний подарунок!",
      giftFromLabel: "Від",
      adminSenderOptionLabel: "👑 Від чийого імені надіслати:",
      adminSenderFromSelf: "Від свого імені",
      adminSenderFromGame: "Від Color Sort",
      giftReceivedTimeKyiv: (time) => `🕒 ${time} (Київ)`,
      giftsDailySentLabel: "Надіслано сьогодні:",
      giftsLimitFootnote: "Ліміт: максимум 10 подарунків на добу. Скидання о 23:59 (Київ).",
      giftsAdminUnlimitedFootnote: "👑 Режим адміністратора: надсилання подарунків без обмежень (безліміт).",
      giftsUnlimitedTag: "∞ (Безліміт)",
      giftsStepRecipientTitle: "👥 Виберіть одержувача з гравців:",
      giftsSearchPlaceholder: "🔍 Пошук за ім'ям або @username...",
      giftsSearchPlaceholderUser: "🔍 Пошук за ім'ям гравця...",
      giftsPlayersLoading: "Завантаження списку гравців...",
      giftsPlayersNotFound: "Гравців за запитом не знайдено",
      giftsPlayersEmpty: "Список гравців порожній",
      giftsSelectPlayerBtn: "Обрати",
      giftsBackToRecipientsBtn: "‹ Змінити гравця",
      giftsRecipientLabel: "Одержувач:",
      giftsStepItemTitle: "🎁 Виберіть подарунок для надсилання:",
      giftsInStockLabel: "В наявності:",
      giftsSendActionBtn: "Подарувати",
      giftItemUndo: "Скасування ходу",
      giftItemHint: "Підказка",
      giftItemReveal: "Відкрити колір",
      giftItemBottle: "Порожня колба",
      giftQtyModalTitle: "Скільки подарувати?",
      giftQtyRecipientDesc: "Одержувач:",
      giftQtyInStockLabel: "В наявності:",
      giftQtyAvailableTodayLabel: "Доступно сьогодні:",
      giftQtyPickerLabel: "Кількість для надсилання:",
      giftQtyPcs: "шт.",
      giftQtyConfirmBtn: (qty) => `Подарувати (${qty} шт.)`,
      giftQtyCancelBtn: "Скасувати",
      giftSelfSendError: "Ви не можете надіслати подарунок самому собі.",
      giftNoStockTitle: "У вас немає цього подарунка",
      giftNoStockDesc: (name) => `У вас 0 шт. «${name}». Не можна подарувати предмет, якого немає у вашому балансі.`,
      giftLimitExceededTitle: "Ліміт вичерпано",
      giftLimitExceededDesc: "Ви вже надіслали максимум 10 подарунків сьогодні.\n\nЛічильник скинеться сьогодні о 23:59 за часом Києва.",
      giftSentSuccessTitle: "Подарунок надіслано!",
      giftSentSuccessDesc: (icon, name, qty, recipient, left, dailyNotice) => `Ви успішно надіслали ${icon} «${name}» (${qty} шт.) гравцеві ${recipient}!\n\nЗ вашого балансу списано: ${qty} шт. (залишилося: ${left}).\n${dailyNotice}`,
      giftClaimedSuccessTitle: "Подарок отримано!",
      giftClaimedSuccessDesc: (icon, name, qty) => `Ви успішно забрали ${icon} «${name}» (+${qty})!\n\nПредмет додано до вашого балансу і готовий до використання.`,
      giftDailyNoticeAdmin: (count) => `Надіслано сьогодні: ${count} шт. (Безліміт для адміністратора).`,
      giftDailyNoticeUser: (count, max) => `Надіслано сьогодні: ${count} / ${max}.`,
      errorTitle: "Помилка",
      errorSendGift: "Не вдалося доставити подарунок:",
      errorClaimGift: "Не вдалося забрати подарунок:",
      profileAdminQuickTitle: "Панель Адміністратора",
      profileAdminQuickSub: "Керування бонусами, знімки, гаманці та новини",
      adminPanelCollapseBtn: "Згорнути",
      adminPanelBottomCollapseBtn: "Згорнути панель адміністратора",
      seasonResetKickTitle: "Скидання сезону!",
      seasonResetKickOkBtn: "Почати заново (0 рівень)",
      tonConnectWalletBtn: "👛 Підключити гаманець TON",
      tonDisconnectBtn: "Відключити",
      tonBalanceLabel: "Баланс у грі:",
      tonWithdrawBtn: "Вивести TON",
      tonDepositTitle: "Поповнити баланс",
      tonDepositDesc: "Надішліть TON на вказану адресу з вашим коментарем (Memo)",
      tonAddressLabel: "Адреса для переказу:",
      tonMemoLabel: "Ваш коментар (Memo) — ОБОВ'ЯЗКОВО:",
      tonDepositNotice: "⚠️ Обов'язково вкажіть Memo при відправці, інакше кошти не будуть зараховані автоматично.",
      copyBtn: "Копіювати",
      copiedNotice: "Скопійовано в буфер обміну!",
      refCopySuccess: "Посилання скопійовано! Надішліть його друзям.",
      refEmptyTitle: "Друзів поки немає",
    },
    en: {
      langName: "English",
      levelLabel: "Level",
      levelDisplayVal: (lvl) => `Level ${lvl}`,
      profileHint: "⚙️ Lang",
      profileTitle: "⚙️ Profile",
      profileTabLabel: "Profile",
      referralsTabLabel: "Referrals",
      adminTabLabel: "Admin",
      langSectionTitle: "Change Language",
      restartBtn: "Restart",
      undoBtn: "Undo",
      hintBtn: "Hint",
      revealBtn: "Reveal Colors",
      extraBottleBtn: "Empty Bottle",
      adBonusBtn: "Rewards",
      leaderboardTitle: "🏆 Leaderboard",
      leaderboardLive: "24/7 LIVE",
      leaderboardLoading: "⏳ Loading live players...",
      leaderboardEmptyTitle: "Leaderboard is forming",
      leaderboardEmptyDesc: "Complete a level via Telegram bot @sortcolors_bot to become #1 on the leaderboard!",
      youTag: "(You)",
      maxLevelLabel: (lvl) => `Max Level: ${lvl}`,
      levelPrefix: "Level",
      bottlesCountTag: (n) => `${n} bottles`,
      winTitle: (lvl) => `Level ${lvl} Completed! 🎉`,
      winSubtext: (lvl) => `All colors sorted! Advancing to Level ${lvl}...`,
      nextLevelBtn: "Next Level 🚀",
      restartTitle: "🔄 Restart Level?",
      restartDesc: "All progress on this level will be reset.",
      cancelBtn: "Cancel",
      confirmRestartBtn: "Restart",
      securityAlertTitle: "Color Sort Security System",
      securityAlertSubtitle: "Hacking activity detected",
      securityAlertRestartBtn: (lvl) => `Restart level ${lvl}`,
      serverReloadTitle: "Server Restart",
      serverReloadDesc: "Game security and anti-cheat update in progress.<br>Please reload the game to get the latest version.",
      serverReloadTimerLabel: "Auto-reloading in:",
      serverReloadBtn: "Re-enter Game",
      adModalTitle: "🎁 Rewards",
      adModalDesc: "Watch short video ads to claim free boosters",
      adModalBottleTitle: "Empty Bottle",
      adModalBottleDesc: "+1 empty bottle to stock",
      adModalHintsTitle: "+1 Hint",
      adModalHintsDesc: "1 precise move hint",
      adModalUndosTitle: "+1 Undo",
      adModalUndosDesc: "1 free move undo",
      adModalRevealTitle: "Reveal Colors",
      adModalRevealDesc: "Reveal all colors in 1 jar",
      noMovesTitle: "No moves",
      noMovesDesc: "You have not made any moves on this level to undo yet.",
      noHintDesc: "No moves available that reveal a new hidden color. Try rearranging colors or adding an empty bottle!",
      allColorsVisibleTitle: "All colors revealed",
      allColorsVisibleDesc: "All bottle colors are already revealed on this stage!",
      extraBottleTitle: "🎉 Success",
      extraBottleDesc: "Extra empty bottle added to the board!",
      extraBottleModalTitle: "Extra Bottle",
      extraBottleModalPrompt: "You have 0 extra bottles. Watch a short video ad to get an empty bottle on the board!",
      claimAdBtn: "▶ Watch Ad",
      adStarting: "⏳ Starting...",
      adClaimed: "✅ Received! (+1)",
      adUnavailableTitle: "Ad Unavailable",
      adUnavailableDesc: "Ads are currently unavailable. Please try again later!",
      adDismissedDesc: "Ad playback was interrupted. Bonus is awarded only for watching the full ad.",
      adminBadge: "👑 Admin",
      adminPanelTitle: "Admin Panel",
      adminPanelSub: "Alligator Access Only",
      adminBoostersTitle: "⚡ Free Admin Perks (No Ads):",
      adminAddBottle: "+5 Empty Bottles",
      adminAddBoardBottle: "+1 Bottle on Board",
      adminAddHints: "+5 Hints",
      adminAddUndos: "+5 Undos",
      adminAddReveals: "+5 Color Reveals",
      adminAddCoins: "+5 TON",
      adminAddLevels: "+5 Levels",
      adminAddAll: "Replenish ALL (+10 to all boosters)",
      adminBottleAddedMsg: (count) => `🧪 +5 Empty Bottles added (Total: ${count})`,
      adminBoardBottleAddedMsg: "🧪 Empty bottle added to the board!",
      adminHintsAddedMsg: (count) => `💡 +5 Hints added (Total: ${count})`,
      adminUndosAddedMsg: (count) => `↩️ +5 Undos added (Total: ${count})`,
      adminRevealsAddedMsg: (count) => `🔮 +5 Reveals added (Total: ${count})`,
      adminCoinsAddedMsg: (count) => `💎 +5 TON added (Balance: ${Number(count || 0).toFixed(2)} TON)`,
      adminLevelsAddedMsg: (lvl) => `🏆 +5 Levels added! (Current level: ${lvl})`,
      adminSetExactLevelTitle: "🎯 Set Exact Level (1-500)",
      adminSetExactLevelBtnLabel: "Set Level",
      adminExactLevelSuccessMsg: (lvl) => `🎯 Level ${lvl} successfully set!`,
      adminAllAddedMsg: "⚡ All boosters replenished (+10 to each)!",
      adminResetPurchasesTitle: "💎 Manage TON Purchases (Admin Only)",
      adminResetPurchasesDesc: "Annul active TON perks (e.g. All Colors Unlocked) without touching player wallet balances.",
      adminResetSelfPurchasesBtnLabel: "👑 Reset Only My Account",
      adminResetPurchasesBtnLabel: "🌐 Reset ALL Players Purchases",
      adminResetSeasonDesc: "Season reset clears the global leaderboard and resets all players to Level 0. TON balance, purchases and referrals are preserved.",
      adminResetSeasonBtnLabel: "🔥 Reset Season (Wipe Everything)",
      adminResetPurchasesSuccessTitle: "💎 Purchases Annulled!",
      adminResetPurchasesSuccessDesc: "All active GRAM perks from the chest have been annulled for all players. Wallet balances remain untouched.",
      adminResetSuccessTitle: "💥 Season Reset!",
      adminResetSuccessDesc: "All players have been reset to Level 0! Leaderboard is empty. TON balance, purchases and referrals are preserved.",
      adminTabActionsLabel: "Management",
      adminTabActionsDesc: "Boosts & Reset",
      adminTabHistoryLabel: "Leader Investigation",
      adminTabHistoryDesc: "23:59 Snapshots",
      adminTabCodeBackupLabel: "Code Backups",
      adminTabCodeBackupDesc: "Code Versions",
      adminCodeBackupTitle: "Game CODE Backups (Kyiv Time)",
      adminCodeBackupSub: "🛡️ Stable game code checkpoints are registered here. New versions are deployed by the developer. If a rollback is needed, specify the target date to the developer.",
      adminCodeBackupListTitle: "Registered game code versions (Kyiv):",
      adminCodeBackupEmptyText: "No code backups created yet",
      adminCodeBackupLoadingText: "Loading code versions...",
      adminCodeBackupDeleteBtnLabel: "Delete",
      adminHistoryTitle: "Leaderboard History",
      adminHistorySub: "Daily snapshots at 23:59 (Kyiv). Manual snapshots are saved separately.",
      adminHistoryListTitle: "Saved snapshots history:",
      adminHistoryTakeSnapshotLabel: "Take snapshot now",
      adminHistoryViewBtnLabel: "View",
      adminHistoryDeleteBtnLabel: "Delete",
      adminSnapshotAutoBadge: "🤖 Auto (23:59)",
      adminSnapshotManualBadge: "✋ Manual",
      adminViewerBackBtn: "← Back to snapshots list",
      adminHistoryEmptyText: "No saved snapshots",
      adminHistoryLoadingText: "Loading snapshots list...",
      adminHistoryColRank: "#",
      adminHistoryColPlayer: "Player",
      adminHistoryColTid: "Telegram ID",
      adminHistoryColLevel: "Level",
      adminHistoryTotalBadge: (count) => `👥 ${count} players`,
      adminHistorySearchPlaceholder: "Search by name, username or ID...",
      adminHistorySnapshotSuccess: "📸 Manual snapshot of current leaderboard saved successfully!",
      deleteSnapshotModalTitle: "Delete Snapshot",
      deleteSnapshotLead: "Are you sure you want to delete this leaderboard snapshot?",
      deleteSnapshotSuccess: "🗑️ Leaderboard snapshot deleted successfully!",
      adminTabWalletsLabel: "Wallet",
      adminTabWalletsDesc: "TON Players",
      adminWalletsTitle: "Player Wallets",
      adminWalletsSub: "Players who connected a TON wallet to the game",
      adminWalletsEmptyText: "No players with connected wallets",
      adminWalletsLoadingText: "Loading player wallets...",
      adminWalletsSearchPlaceholder: "Search by nickname, ID or address...",
      adminWalletViewBtnLabel: "View",
      adminWalletDetailsTitle: "👛 Player Wallet",
      adminWalletNoDeposits: "No confirmed deposits yet",
      adminWalletBackBtn: "← Back to wallets list",
      adminTabNewsLabel: "News",
      adminTabNewsDesc: "Bot Broadcasts",
      adminNewsHeaderTitle: "News & Player Broadcasts",
      adminNewsHeaderSub: "Send messages, images, news and game updates to players. Players will receive a Telegram bot notification with a button to launch the game!",
      adminNewsAudienceLabel: "Total Recipients (Players):",
      adminNewsTimeLabel: "Time (Kyiv):",
      adminNewsTitleLabel: "News / Message Title:",
      adminNewsMessageLabel: "Message Text for Players:",
      adminNewsImageLabel: "Attach Image (optional):",
      adminNewsUploadFileLabel: "Choose Photo from Device",
      adminNewsButtonLabel: "Telegram Button Text:",
      adminNewsTestSendLabel: "Test Send to Self (Admin)",
      adminNewsBroadcastLabel: "Publish & Broadcast to ALL Players",
      adminNewsHistoryTitle: "Broadcast History",
      adminNewsLoadingText: "Loading news history...",
      adminNewsEmptyText: "No broadcast history yet",
      adminTabMaintenanceLabel: "Maintenance",
      adminTabMaintenanceDesc: "Lock access",
      adminMaintenanceHeaderTitle: "Maintenance Mode Management",
      adminMaintenanceHeaderSub: "Lock game access for all users. When maintenance is enabled, players see the 'Maintenance ongoing' popup on startup. Only admins (Alligator & Maria) retain access.",
      adminMaintenanceStatusLabel: "Current access status:",
      adminMaintenanceStatusOpen: "🟢 Access open (All players can play)",
      adminMaintenanceStatusActive: "🔴 Maintenance active (Access locked for all)",
      adminMaintenanceToggleEnable: "Enable maintenance (Block all players)",
      adminMaintenanceToggleDisable: "Disable maintenance (Allow all players)",
      adminMaintenancePreviewBtnLabel: "Preview maintenance screen",
      adminMaintenanceMessageInputLabel: "Message on maintenance screen:",
      adminMaintenanceResetMsgLabel: "Default",
      adminMaintenanceSaveMsgLabel: "Save text",
      tgChannelTitle: "Telegram Channel",
      officialBadge: "Official",
      ourProject: "Our project",
      tgChannelBadge: "Our project",
      tgChannelSub: "News, updates and promo codes",
      tgChannelJoinBtn: "Join Channel",
      referralSectionTitle: "Color Sort",
      referralSectionSub: "For each invitee — 5 undos, 5 hints, 5 color reveals, and 5 empty jars",
      shareReferralTelegramBtn: "📢 Invite in Telegram",
      copyReferralLinkBtn: "📋 Copy Referral Link",
      referralClaimTitle: "Rewards Available!",
      claimAllReferralsBtn: "Claim All",
      refUnitLabel: "friends",
      referralsListHeader: "Invited Friends:",
      tonModalTitle: "TON Balance Top-Up",
      tonModalSubtitle: "Select amount and any convenient crypto wallet",
      tonBalanceSub: "Your current TON balance:",
      tonWalletStatusSub: "Wallet Status:",
      tonWalletDisconnected: "Disconnected",
      tonWalletConnected: "Connected",
      tonConnectHeading: "Wallet Connection",
      tonConnectSubtext: "Connect wallet for rewards and balance",
      tonConnectBtnLabel: "Connect TON Wallet",
      tonDisconnectBtnLabel: "Disconnect Wallet",
      disconnectWalletModalTitle: "Disconnect Wallet",
      disconnectWalletModalDesc: "Are you sure you want to disconnect your wallet?",
      disconnectWalletModalNote: "Your in-game TON / GRAM balance is fully preserved in the game.",
      disconnectWalletConfirmBtn: "Yes, disconnect",
      disconnectWalletCancelBtn: "Cancel",
      tonAmountTitle: "Select Top-Up Amount:",
      tonRewardLabel: "Credited to GRAM balance:",
      tonChoiceHeader: "Select Payment Wallet:",
      tonInstTitle: "How to pay via Telegram Wallet (@wallet):",
      tonInstStep1: "1. Tap @wallet above (memo is automatically copied).",
      tonInstStep2: "2. In bot select Send ➔ To external wallet (TON).",
      tonAddrSub: "TON Address:",
      tonCopyLabel: "Copy",
      tonCopiedLabel: "Copied",
      tonVerifyBtn: "Verify Payment",
      shopModalTitle: "Perks Chest Shop",
      shopModalSubtitle: "Buy in-game upgrades for GRAM",
      shopBalanceSub: "Wallet Balance:",
      shopTopUpBtn: "+ Top Up",
      shopActiveTitle: "All Colors Unlocked: ACTIVE",
      shopSectionDivider: "Boosters for GRAM cryptocurrency",
      shopFeaturedTitle: "All Colors Unlocked",
      shopFeaturedDesc: "All colors in all bottles are revealed immediately from the start of every level! Hidden question mark layers are removed.",
      shopBottlesTitle: "+15 Empty Bottles",
      shopBottlesDesc: "Stock of extra empty bottles for solving tricky levels.",
      shopHintsTitle: "+20 Hints",
      shopHintsDesc: "Shows the best next move when stuck.",
      shopUndosTitle: "+20 Undos",
      shopUndosDesc: "Rewinds a move back in any tricky situation.",
      dailyBoostersTitle: "Daily Hints Pack (30 Days)",
      dailyBoostersDesc: "First accrual (+10 of each booster) is granted immediately upon purchase! Then — every day strictly at 23:59 Kyiv time for 30 consecutive days.",
      dailyBoostersTag: "30 days",
      dailyBoostersCounterLabel: "⏳ Days remaining:",
      dailyBoostersNextLabel: "⏰ Next reward:",
      dailyBoostersNextInfo: "⏰ 10 of each booster awarded at 23:59 (Kyiv)",
      dailyBoostersBtnBuy: (price) => `Buy for ${price} GRAM`,
      dailyBoostersBtnExtend: (price) => `Extend (+30 d.) for ${price} GRAM`,
      dailyBoostersSuccessTitle: "✨ 30-Day Pack Activated!",
      dailyBoostersSuccessMsg: "You have successfully purchased the feature for 5 GRAM!\n\nThe first accrual (+10 of each booster) has already been added to your balance!\n\nSubsequent accruals will be awarded every day at 23:59 Kyiv time for 30 consecutive days.",
      dailyBoostersClaimTitle: "🎁 Daily Boosters Awarded!",
      dailyBoostersClaimMsg: (amount, daysLeft) => `It is 23:59 (Kyiv)!\n\nYou have received ${amount} of each booster:\n• ↩️ Undo: +${amount}\n• 💡 Hint: +${amount}\n• 🔮 Reveal color: +${amount}\n• 🧪 Empty bottle: +${amount}\n\nDays left: ${daysLeft}`,
      shopBuyGram: (price) => `Buy for ${price} GRAM`,
      shopActivateGram: (price) => `Activate (${price} GRAM)`,
      shopExtendGram: (price) => `Extend (+15 days) — ${price} GRAM`,
      resetPurchasesModalTitle: "TON Purchases Reset",
      resetPurchasesWarningLead: "Warning! Active purchases will be annulled:",
      confirmResetPurchasesBtnLabel: "💎 Reset Purchases",
      resetSeasonModalTitle: "Season Reset",
      resetSeasonWarningLead: "Warning! This action is irreversible:",
      confirmResetSeasonBtnLabel: "🔥 Wipe Everything",
      shopActiveRemaining: (d, h, m) => `Remaining: ${d}d ${h}h ${m}m`,
      shopActiveExpiring: "Expiring soon...",
      shopFeaturedRibbon: "HOT 🔥",
      shopDurationTag: "⏳ 15 days",
      shopPriceLabel: "Price:",
      shopRevealsTitle: "+20 Reveal Colors",
      shopRevealsDesc: "Reveals hidden colors in all bottles.",
      tonSpaceSub: "TON App",
      tonWalletSub: "Telegram Wallet",
      tonCopyMemoTitle: "Copy Memo",
      tonConnecting: "Connecting...",
      tonConnectedPrefix: "Connected:",
      tonConnectError: "Failed to connect wallet. Please check connection or wallet app.",
      tonVerifyingBtn: "Checking payment...",
      tonStepMinus: "Decrease",
      tonStepPlus: "Increase",
      refEmptyText: "No friends joined via your link yet. Send the link to friends on Telegram!",
      refClaimSubtitle: "+5 to all bonuses",
      rewardClaimed: "Reward claimed",
      claimBonusBtn: "Claim reward",
      adminPurchasesHeader: "💎 TON Purchases Management (Admin Only)",
      adminResetSelfPurchasesBtn: "👑 Reset only my account",
      resetPurchasesItem1: "🎨 \"All Colors Revealed\" perk will be deactivated for all players",
      resetPurchasesItem2: "⏳ Duration of all active chest upgrades will be reset to zero",
      resetPurchasesItem3: "💎 TON / GRAM wallet balances of players will remain unchanged",
      resetSeasonItem1: "💥 Global leaderboard will be completely cleared",
      resetSeasonItem2: "📉 All players will be reset to Level 0",
      resetSeasonItem3: "🛡️ TON balance, purchases and referrals are preserved",
      resetSeasonItem4: "🏆 Players will appear in the leaderboard only after winning round 1",
      adVideoSponsor: "AD SPONSOR",
      adVideoTitle: "New Games on Telegram",
      adVideoDesc: "Play top Mini Apps without installation!",
      adVideoBtn: "View Catalog",
      adVideoStatus: "Please watch the ad until the end to receive your bonus",
      adVideoStatusSuccess: "🎉 Bonus awarded!",
      adVideoTimerReward: "✅ Reward unlocked!",
      adVideoTimerSec: (s) => `⏳ ${s}s`,
      soundBtnTitle: "Sound",
      refreshLeaderboardTitle: "Refresh Ranking",
      closeBtn: "Close",
      walletBtnTitle: "TON Wallet",
      shopBtnTitle: "Perks Chest Shop",
      defaultPlayerName: "Player",
      infoModalTitle: "Information",
      insufficientFundsTitle: "Insufficient GRAM!",
      insufficientFundsDesc: (p, b) => `Required: ${Number(p).toFixed(2)} GRAM. Your balance: ${Number(b).toFixed(2)} GRAM.\n\nTop up your TON wallet balance to activate this perk!`,
      topUpBalanceBtn: "Top Up Balance",
      bonusAddedBottle: "+1 empty bottle added to your inventory! Tap the bottle button to place it on the board.",
      bonusAddedHint: "+1 hint added to your inventory! Tap the hint button to use it.",
      bonusAddedUndo: "+1 undo added to your inventory! Tap the undo button to use it.",
      bonusAddedReveal: "+1 reveal colors added to your inventory! Tap the reveal button to use it.",
      outOfBottlesPrompt: "You have 0 empty bottles. Watch a short ad to add an empty bottle to your inventory!",
      outOfHintsPrompt: "You have 0 hints. Watch a short ad to add a hint to your inventory!",
      outOfUndosPrompt: "You have 0 undos. Watch a short ad to add an undo to your inventory!",
      outOfRevealsPrompt: "You have 0 reveals. Watch a short ad to add color reveal to your inventory!",
      bonusBottleTitle: "Empty Bottle Added",
      bonusHintTitle: "Hint Added",
      bonusUndoTitle: "Undo Added",
      bonusRevealTitle: "Reveal Added",
      purchaseSuccessTitle: "Successfully Added!",
      purchaseSuccessAllColorsMsg: "Feature activated for 15 days!\n\nAll hidden liquid layers in all bottles are now visible right from the start of every level!",
      purchaseSuccessRevealsMsg: (c) => `+20 color reveals successfully added to your account (total: ${c}).\n\nCounter on the 🔮 "Reveal Colors" button updated!`,
      purchaseSuccessBottlesMsg: (c) => `+15 empty bottles successfully added to your account (total: ${c}).\n\nCounter on the 🧪 "Empty Bottle" button updated!`,
      purchaseSuccessHintsMsg: (c) => `+20 hints successfully added to your account (total: ${c}).\n\nCounter on the 💡 "Hint" button updated!`,
      purchaseSuccessUndosMsg: (c) => `+20 undos successfully added to your account (total: ${c}).\n\nCounter on the ↩️ "Undo" button updated!`,
      adTabAds: "Bonuses",
      adTabGifts: "Gifts",
      adTabGiftsHeader: "🎁 Gifts",
      adTabGiftsDesc: "Receive and send useful gifts to other players",
      giftsSubnavReceive: "📥 Receive gifts",
      giftsSubnavSend: "📤 Send gift",
      giftsReceiveChecking: "Checking incoming gifts...",
      giftsReceiveEmptyTitle: "No new gifts",
      giftsReceiveEmptyDesc: "When another player sends you a gift, it will appear here with a 'Claim' button.",
      giftsClaimBtn: "Claim",
      giftClaimedDone: "Claimed!",
      giftReceivedCardTitle: (name, amount) => `🎁 Gift: ${name} (+${amount})`,
      giftReceivedCardDesc: "You received a useful gift!",
      giftFromLabel: "From",
      adminSenderOptionLabel: "👑 Send gift as:",
      adminSenderFromSelf: "From myself",
      adminSenderFromGame: "From Color Sort",
      giftReceivedTimeKyiv: (time) => `🕒 ${time} (Kyiv)`,
      giftsDailySentLabel: "Sent today:",
      giftsLimitFootnote: "Limit: maximum 10 gifts per day. Reset at 23:59 (Kyiv).",
      giftsAdminUnlimitedFootnote: "👑 Admin mode: unlimited gift sending.",
      giftsUnlimitedTag: "∞ (Unlimited)",
      giftsStepRecipientTitle: "👥 Select recipient from players:",
      giftsSearchPlaceholder: "🔍 Find player (name or @username)...",
      giftsSearchPlaceholderUser: "🔍 Find player by name...",
      giftsPlayersLoading: "Loading players list...",
      giftsPlayersNotFound: "No players found matching search",
      giftsPlayersEmpty: "Players list is empty",
      giftsSelectPlayerBtn: "Select",
      giftsBackToRecipientsBtn: "‹ Change player",
      giftsRecipientLabel: "Recipient:",
      giftsStepItemTitle: "🎁 Choose gift to send:",
      giftsInStockLabel: "In stock:",
      giftsSendActionBtn: "Send gift",
      giftItemUndo: "Undo move",
      giftItemHint: "Hint",
      giftItemReveal: "Reveal color",
      giftItemBottle: "Empty bottle",
      giftQtyModalTitle: "How many to send?",
      giftQtyRecipientDesc: "Recipient:",
      giftQtyInStockLabel: "In stock:",
      giftQtyAvailableTodayLabel: "Available today:",
      giftQtyPickerLabel: "Quantity to send:",
      giftQtyPcs: "pcs",
      giftQtyConfirmBtn: (qty) => `Send (${qty} pcs)`,
      giftQtyCancelBtn: "Cancel",
      giftSelfSendError: "You cannot send a gift to yourself.",
      giftNoStockTitle: "You don't have this gift",
      giftNoStockDesc: (name) => `You have 0 pcs of "${name}". You cannot send an item you do not own.`,
      giftLimitExceededTitle: "Daily limit reached",
      giftLimitExceededDesc: "You have already sent the maximum of 10 gifts today.\n\nCounter resets today at 23:59 (Kyiv time).",
      giftSentSuccessTitle: "Gift sent!",
      giftSentSuccessDesc: (icon, name, qty, recipient, left, dailyNotice) => `Successfully sent ${icon} "${name}" (${qty} pcs) to ${recipient}!\n\nDeducted from balance: ${qty} pcs (remaining: ${left}).\n${dailyNotice}`,
      giftClaimedSuccessTitle: "Gift claimed!",
      giftClaimedSuccessDesc: (icon, name, qty) => `Successfully claimed ${icon} "${name}" (+${qty})!\n\nItem added to your balance and ready to use.`,
      giftDailyNoticeAdmin: (count) => `Sent today: ${count} pcs (Unlimited for administrator).`,
      giftDailyNoticeUser: (count, max) => `Sent today: ${count} / ${max}.`,
      errorTitle: "Error",
      errorSendGift: "Failed to deliver gift:",
      errorClaimGift: "Failed to claim gift:",
      profileAdminQuickTitle: "Admin Panel",
      profileAdminQuickSub: "Manage bonuses, snapshots, wallets and news",
      adminPanelCollapseBtn: "Collapse",
      adminPanelBottomCollapseBtn: "Collapse admin panel",
      seasonResetKickTitle: "Season Reset!",
      seasonResetKickOkBtn: "Start Over (Level 0)",
      tonConnectWalletBtn: "👛 Connect TON Wallet",
      tonDisconnectBtn: "Disconnect",
      tonBalanceLabel: "In-game balance:",
      tonWithdrawBtn: "Withdraw TON",
      tonDepositTitle: "Top Up Balance",
      tonDepositDesc: "Send TON to the specified address with your comment (Memo)",
      tonAddressLabel: "Transfer address:",
      tonMemoLabel: "Your comment (Memo) — REQUIRED:",
      tonDepositNotice: "⚠️ Be sure to include Memo when sending, otherwise funds will not be credited automatically.",
      copyBtn: "Copy",
      copiedNotice: "Copied to clipboard!",
      refCopySuccess: "Link copied! Send it to your friends.",
      refEmptyTitle: "No friends yet",
    },
    de: {
      langName: "Deutsch",
      levelLabel: "Stufe",
      levelDisplayVal: (lvl) => `Stufe ${lvl}`,
      profileHint: "⚙️ Sprache",
      profileTitle: "⚙️ Profil",
      profileTabLabel: "Profil",
      referralsTabLabel: "Empfehlungen",
      adminTabLabel: "Admin",
      langSectionTitle: "Sprache ändern",
      restartBtn: "Neustart",
      undoBtn: "Zurück",
      hintBtn: "Hinweis",
      revealBtn: "Farben aufdecken",
      extraBottleBtn: "Leere Flasche",
      adBonusBtn: "Boni",
      leaderboardTitle: "🏆 Bestenliste",
      leaderboardLive: "24/7 LIVE",
      leaderboardLoading: "⏳ Lade echte Spieler...",
      leaderboardEmptyTitle: "Bestenliste formiert sich",
      leaderboardEmptyDesc: "Beende ein Level über den Telegram Bot @sortcolors_bot, um die Nr. 1 zu werden!",
      youTag: "(Du)",
      maxLevelLabel: (lvl) => `Max. Stufe: ${lvl}`,
      levelPrefix: "Stufe",
      bottlesCountTag: (n) => `${n} Flaschen`,
      winTitle: (lvl) => `Stufe ${lvl} geschafft! 🎉`,
      winSubtext: (lvl) => `Alle Farben sortiert! Weiter zu Stufe ${lvl}...`,
      nextLevelBtn: "Nächste Stufe 🚀",
      restartTitle: "🔄 Von vorn beginnen?",
      restartDesc: "Der Fortschritt in diesem Level wird zurückgesetzt.",
      cancelBtn: "Abbrechen",
      confirmRestartBtn: "Neustart",
      securityAlertTitle: "Color Sort Sicherheitssystem",
      securityAlertSubtitle: "Hacking-Aktivität erkannt",
      securityAlertRestartBtn: (lvl) => `Level ${lvl} neu starten`,
      serverReloadTitle: "Server-Neustart",
      serverReloadDesc: "Sicherheits- und Anti-Cheat-Update wird angewendet.<br>Bitte starten Sie das Spiel neu, um die neueste Version zu laden.",
      serverReloadTimerLabel: "Automatischer Neustart in:",
      serverReloadBtn: "Spiel neu betreten",
      adModalTitle: "🎁 Belohnungen",
      adModalDesc: "Schau kurze Videos an, um kostenlose Boni zu erhalten",
      adModalBottleTitle: "Zusatz-Flasche",
      adModalBottleDesc: "+1 leere Flasche auf Vorrat",
      adModalHintsTitle: "+1 Hinweis",
      adModalHintsDesc: "1 präziser Hinweiszug",
      adModalUndosTitle: "+1 Zug zurück",
      adModalUndosDesc: "1 kostenloses Zurücknehmen",
      adModalRevealTitle: "Farben aufdecken",
      adModalRevealDesc: "Alle Farben in 1 Flasche aufdecken",
      noMovesTitle: "Keine Züge",
      noMovesDesc: "Du hast in diesem Level noch keine Züge gemacht.",
      noHintDesc: "Keine Züge verfügbar, die eine neue Farbe aufdecken. Versuchen Sie umzufüllen oder ein leeres Glas hinzuzufügen!",
      allColorsVisibleTitle: "Alle Farben sichtbar",
      allColorsVisibleDesc: "Alle Farben in den Flaschen sind bereits aufgedeckt!",
      extraBottleTitle: "🎉 Erfolg",
      extraBottleDesc: "Zusätzliche leere Flasche hinzugefügt!",
      extraBottleModalTitle: "Zusätzliche Flasche",
      extraBottleModalPrompt: "Du hast 0 zusätzliche Flaschen. Schau ein kurzes Video an, um eine leere Flasche aufs Feld zu bekommen!",
      claimAdBtn: "▶ Werbung ansehen",
      adStarting: "⏳ Startet...",
      adClaimed: "✅ Erhalten! (+1)",
      adUnavailableTitle: "Werbung nicht verfügbar",
      adUnavailableDesc: "Werbung ist derzeit nicht verfügbar. Bitte versuchen Sie es später noch einmal!",
      adDismissedDesc: "Die Wiedergabe wurde unterbrochen. Der Bonus wird nur für das vollständige Ansehen gutgeschrieben.",
      adminBadge: "👑 Admin",
      adminPanelTitle: "Admin-Panel",
      adminPanelSub: "Nur für Alligator verfügbar",
      adminBoostersTitle: "⚡ Kostenlose Admin-Vorteile (Keine Werbung):",
      adminAddBottle: "+5 Leere Flaschen",
      adminAddBoardBottle: "+1 Flasche aufs Feld",
      adminAddHints: "+5 Hinweise",
      adminAddUndos: "+5 Züge zurück",
      adminAddReveals: "+5 Aufdeckungen",
      adminAddCoins: "+5 TON",
      adminAddLevels: "+5 Stufen",
      adminAddAll: "ALLES auffüllen (+10 auf alle Boni)",
      adminBottleAddedMsg: (count) => `🧪 +5 Leere Flaschen hinzugefügt (Gesamt: ${count})`,
      adminBoardBottleAddedMsg: "🧪 Leere Flasche aufs Feld hinzugefügt!",
      adminHintsAddedMsg: (count) => `💡 +5 Hinweise hinzugefügt (Gesamt: ${count})`,
      adminUndosAddedMsg: (count) => `↩️ +5 Züge zurück hinzugefügt (Gesamt: ${count})`,
      adminRevealsAddedMsg: (count) => `🔮 +5 Aufdeckungen hinzugefügt (Gesamt: ${count})`,
      adminCoinsAddedMsg: (count) => `💎 +5 TON hinzugefügt (Guthaben: ${Number(count || 0).toFixed(2)} TON)`,
      adminLevelsAddedMsg: (lvl) => `🏆 +5 Stufen hinzugefügt! (Aktuelle Stufe: ${lvl})`,
      adminSetExactLevelTitle: "🎯 Genaue Stufe festlegen (1-500)",
      adminSetExactLevelBtnLabel: "Einstellen",
      adminExactLevelSuccessMsg: (lvl) => `🎯 Stufe ${lvl} erfolgreich festgelegt!`,
      adminAllAddedMsg: "⚡ Alle Boni aufgefüllt (+10 auf alle)!",
      adminResetPurchasesTitle: "💎 TON-Käufe verwalten (Nur Admin)",
      adminResetPurchasesDesc: "Aktive TON-Vorteile annullieren, ohne das Wallet-Guthaben der Spieler zu berühren.",
      adminResetSelfPurchasesBtnLabel: "👑 Nur mein Konto zurücksetzen",
      adminResetPurchasesBtnLabel: "🌐 Käufe aller Spieler zurücksetzen",
      adminResetSeasonDesc: "Saison-Reset setzt die Bestenliste zurück und alle Spieler auf Stufe 0. TON-Guthaben, Käufe und Empfehlungen bleiben erhalten.",
      adminResetSeasonBtnLabel: "🔥 Saison zurücksetzen (Alles auf 0)",
      adminResetPurchasesSuccessTitle: "💎 Käufe annulliert!",
      adminResetPurchasesSuccessDesc: "Alle aktiven GRAM-Vorteile aus der Truhe wurden für alle Spieler annulliert. Wallet-Guthaben bleiben unberührt.",
      adminResetSuccessTitle: "💥 Saison zurückgesetzt!",
      adminResetSuccessDesc: "Alle Spieler wurden auf Stufe 0 zurückgesetzt! Bestenliste ist leer. TON-Guthaben, Käufe und Empfehlungen bleiben erhalten.",
      adminTabActionsLabel: "Verwaltung",
      adminTabActionsDesc: "Kostenlose Booster und Saison-Zurücksetzung",
      adminTabHistoryLabel: "Ranglisten-Verlauf",
      adminTabHistoryDesc: "23:59 Snapshots (Kiew), manuelle Kopien & Archiv",
      adminHistoryTitle: "Ranglisten-Verlauf",
      adminHistorySub: "Tägliche Snapshots um 23:59 (Kiew). Manuelle Snapshots werden separat gespeichert.",
      adminHistoryListTitle: "Verlauf gespeicherter Snapshots:",
      adminHistoryTakeSnapshotLabel: "Snapshot jetzt erstellen",
      adminHistoryViewBtnLabel: "Anzeigen",
      adminHistoryDeleteBtnLabel: "Löschen",
      adminSnapshotAutoBadge: "🤖 Auto (23:59)",
      adminSnapshotManualBadge: "✋ Manuell",
      adminViewerBackBtn: "← Zurück zur Snapshot-Liste",
      adminHistoryEmptyText: "Keine gespeicherten Snapshots",
      adminHistoryLoadingText: "Lade Snapshot-Liste...",
      adminHistoryColRank: "#",
      adminHistoryColPlayer: "Spieler",
      adminHistoryColTid: "Telegram ID",
      adminHistoryColLevel: "Stufe",
      adminHistoryTotalBadge: (count) => `👥 ${count} Spieler`,
      adminHistorySearchPlaceholder: "Suche nach Name, Username oder ID...",
      adminHistorySnapshotSuccess: "📸 Manueller Snapshot der aktuellen Rangliste erfolgreich gespeichert!",
      deleteSnapshotModalTitle: "Snapshot löschen",
      deleteSnapshotLead: "Möchten Sie diesen Ranglisten-Snapshot wirklich löschen?",
      deleteSnapshotSuccess: "🗑️ Ranglisten-Snapshot erfolgreich gelöscht!",
      adminTabWalletsLabel: "Wallets",
      adminTabWalletsDesc: "Spieler mit verbundenem TON-Wallet",
      adminWalletsTitle: "Spieler-Wallets",
      adminWalletsSub: "Spieler mit verbundenem TON-Wallet",
      adminWalletsEmptyText: "Keine Spieler mit verbundenem Wallet",
      adminWalletsLoadingText: "Lade Spieler-Wallets...",
      adminWalletsSearchPlaceholder: "Suche nach Name, ID oder Adresse...",
      adminWalletViewBtnLabel: "Anzeigen",
      adminWalletDetailsTitle: "👛 Spieler-Wallet",
      adminWalletNoDeposits: "Noch keine bestätigten Einzahlungen",
      adminWalletBackBtn: "← Zurück zur Wallet-Liste",
      adminTabNewsLabel: "Neuigkeiten",
      adminTabNewsDesc: "Benachrichtigungen und Bilder an Spieler im Bot senden",
      adminNewsHeaderTitle: "Neuigkeiten & Spieler-Broadcasts",
      adminNewsHeaderSub: "Sende Nachrichten, Bilder und Updates an Spieler. Spieler erhalten eine Telegram-Bot-Benachrichtigung mit einem Button zum Starten des Spiels!",
      adminNewsAudienceLabel: "Empfänger gesamt (Spieler):",
      adminNewsTimeLabel: "Zeit (Kiew):",
      adminNewsTitleLabel: "Titel der Nachricht:",
      adminNewsMessageLabel: "Nachrichtentext an Spieler:",
      adminNewsImageLabel: "Bild anhängen (optional):",
      adminNewsUploadFileLabel: "Foto vom Gerät wählen",
      adminNewsButtonLabel: "Telegram-Button-Text:",
      adminNewsTestSendLabel: "Test an mich selbst (Admin)",
      adminNewsBroadcastLabel: "Veröffentlichen & an ALLE Spieler senden",
      adminNewsHistoryTitle: "Verlauf der gesendeten Nachrichten",
      adminNewsLoadingText: "Lade Nachrichtenverlauf...",
      adminNewsEmptyText: "Noch keine gesendeten Nachrichten",
      tgChannelTitle: "Telegram-Kanal",
      officialBadge: "Offiziell",
      ourProject: "Unser Projekt",
      tgChannelBadge: "Unser Projekt",
      tgChannelSub: "Neuigkeiten, Updates & Codes",
      tgChannelJoinBtn: "Kanal öffnen",
      referralSectionTitle: "Color Sort",
      referralSectionSub: "Für jeden Eingeladenen — 5 Züge zurück, 5 Hinweise, 5 Farbaufdeckungen und 5 leere Gläser",
      shareReferralTelegramBtn: "📢 In Telegram einladen",
      copyReferralLinkBtn: "📋 Link kopieren",
      referralClaimTitle: "Belohnungen verfügbar!",
      claimAllReferralsBtn: "Alles abholen",
      refUnitLabel: "Freunde",
      referralsListHeader: "Eingeladene Freunde:",
      tonModalTitle: "TON-Guthaben aufladen",
      tonModalSubtitle: "Wähle den Betrag und ein beliebiges Wallet",
      tonBalanceSub: "Dein aktuelles TON-Guthaben:",
      tonWalletStatusSub: "Wallet-Status:",
      tonWalletDisconnected: "Nicht verbunden",
      tonWalletConnected: "Verbunden",
      tonConnectHeading: "Wallet verbinden",
      tonConnectSubtext: "Wallet verbinden für Belohnungen und Guthaben",
      tonConnectBtnLabel: "TON-Wallet verbinden",
      tonDisconnectBtnLabel: "Wallet trennen",
      disconnectWalletModalTitle: "Wallet trennen",
      disconnectWalletModalDesc: "Möchten Sie die Wallet wirklich trennen?",
      disconnectWalletModalNote: "Ihr TON / GRAM-Spielguthaben bleibt im Spiel vollständig erhalten.",
      disconnectWalletConfirmBtn: "Ja, trennen",
      disconnectWalletCancelBtn: "Abbrechen",
      tonAmountTitle: "Einzahlungsbetrag auswählen:",
      tonRewardLabel: "Gutschrift auf GRAM-Konto:",
      tonChoiceHeader: "Zahlungswallet auswählen:",
      tonInstTitle: "Anleitung für Telegram Wallet (@wallet):",
      tonInstStep1: "1. Klicke oben auf @wallet (Memo wird kopiert).",
      tonInstStep2: "2. Im Bot wählen: Senden ➔ Externe Wallet (TON).",
      tonAddrSub: "TON-Adresse:",
      tonCopyLabel: "Kopieren",
      tonCopiedLabel: "Kopiert",
      tonVerifyBtn: "Zahlung prüfen",
      shopModalTitle: "Vorteils-Truhe",
      shopModalSubtitle: "Kaufe Spiel-Upgrades für GRAM",
      shopBalanceSub: "Wallet-Guthaben:",
      shopTopUpBtn: "+ Aufladen",
      shopActiveTitle: "Alle Farben aufgedeckt: AKTIV",
      shopSectionDivider: "Booster für GRAM-Kryptowährung",
      shopFeaturedTitle: "Alle Farben aufgedeckt",
      shopFeaturedDesc: "Alle Farben in allen Flaschen werden zu Beginn jedes Levels sofort aufgedeckt! Versteckte Fragezeichen-Schichten werden entfernt.",
      shopBottlesTitle: "+15 Leere Flaschen",
      shopBottlesDesc: "Vorrat an leeren Flaschen für schwierige Level.",
      shopHintsTitle: "+20 Hinweise",
      shopHintsDesc: "Zeigt den besten nächsten Zug bei Schwierigkeiten.",
      shopUndosTitle: "+20 Züge zurück",
      shopUndosDesc: "Macht einen Zug in jeder Situation rückgängig.",
      dailyBoostersTitle: "Tägliches Hinweis-Paket (30 Tage)",
      dailyBoostersDesc: "Erste Gutschrift (+10 von jedem Booster) erfolgt sofort beim Kauf! Danach jeden Tag pünktlich um 23:59 Uhr Kiewer Zeit für 30 Tage.",
      dailyBoostersTag: "30 Tage",
      dailyBoostersCounterLabel: "⏳ Verbleibende Tage:",
      dailyBoostersNextLabel: "⏰ Nächste Gutschrift:",
      dailyBoostersNextInfo: "⏰ Gutschrift von je 10 Hinweisen um 23:59 (Kiew)",
      dailyBoostersBtnBuy: (price) => `Kaufen für ${price} GRAM`,
      dailyBoostersBtnExtend: (price) => `Verlängern (+30 T.) für ${price} GRAM`,
      dailyBoostersSuccessTitle: "✨ 30-Tage-Paket aktiviert!",
      dailyBoostersSuccessMsg: "Sie haben das Paket erfolgreich für 5 GRAM gekauft!\n\nDie erste Gutschrift (+10 Booster jeder Art) wurde bereits Ihrem Guthaben gutgeschrieben!\n\nWeitere Gutschriften erfolgen jeden Tag um 23:59 Uhr Kiewer Zeit für 30 aufeinanderfolgende Tage.",
      dailyBoostersClaimTitle: "🎁 Tägliches Booster-Paket erhalten!",
      dailyBoostersClaimMsg: (amount, daysLeft) => `Es ist 23:59 (Kiew)!\n\nSie haben je ${amount} Booster jeder Art erhalten:\n• ↩️ Zug zurück: +${amount}\n• 💡 Hinweis: +${amount}\n• 🔮 Farbe aufdecken: +${amount}\n• 🧪 Leere Flasche: +${amount}\n\nVerbleibende Tage: ${daysLeft}`,
      shopBuyGram: (price) => `Kaufen für ${price} GRAM`,
      shopActivateGram: (price) => `Aktivieren (${price} GRAM)`,
      shopExtendGram: (price) => `Verlängern (+15 Tage) — ${price} GRAM`,
      resetPurchasesModalTitle: "TON-Käufe zurücksetzen",
      resetPurchasesWarningLead: "Achtung! Aktive Käufe werden annulliert:",
      confirmResetPurchasesBtnLabel: "💎 Käufe zurücksetzen",
      resetSeasonModalTitle: "Saison zurücksetzen",
      resetSeasonWarningLead: "Achtung! Diese Aktion kann nicht rückgängig gemacht werden:",
      confirmResetSeasonBtnLabel: "🔥 Alles zurücksetzen",
      shopActiveRemaining: (d, h, m) => `Verbleibend: ${d} T. ${h} Std. ${m} Min.`,
      shopActiveExpiring: "Läuft bald ab...",
      shopFeaturedRibbon: "HIT 🔥",
      shopDurationTag: "⏳ 15 Tage",
      shopPriceLabel: "Preis:",
      shopRevealsTitle: "+20 Farben aufdecken",
      shopRevealsDesc: "Deckt versteckte Farben in allen Flaschen auf.",
      tonSpaceSub: "TON-App",
      tonWalletSub: "Telegram-Wallet",
      tonCopyMemoTitle: "Memo kopieren",
      tonConnecting: "Verbinden...",
      tonConnectedPrefix: "Verbunden:",
      tonConnectError: "Fehler beim Verbinden der Wallet. Bitte Verbindung oder Wallet-App prüfen.",
      tonVerifyingBtn: "Zahlung prüfen...",
      tonStepMinus: "Verringern",
      tonStepPlus: "Erhöhen",
      refEmptyText: "Noch niemand über deinen Link beigetreten. Sende den Link an Freunde auf Telegram!",
      refClaimSubtitle: "+5 auf alle Boni",
      rewardClaimed: "Belohnung erhalten",
      claimBonusBtn: "Belohnung abholen",
      adminPurchasesHeader: "💎 TON-Kaufverwaltung (Nur Admin)",
      adminResetSelfPurchasesBtn: "👑 Nur mein Konto zurücksetzen",
      resetPurchasesItem1: "🎨 Der Vorteil „Alle Farben aufgedeckt“ wird für alle Spieler deaktiviert",
      resetPurchasesItem2: "⏳ Die Dauer aller aktiven Truhen-Upgrades wird auf null gesetzt",
      resetPurchasesItem3: "💎 TON / GRAM Wallet-Guthaben der Spieler bleiben unverändert",
      resetSeasonItem1: "💥 Die globale Bestenliste wird vollständig gelöscht",
      resetSeasonItem2: "📉 Alle Spieler werden auf Stufe 0 zurückgesetzt",
      resetSeasonItem3: "🛡️ TON-Guthaben, Käufe und Empfehlungen bleiben erhalten",
      resetSeasonItem4: "🏆 Spieler erscheinen erst nach dem Gewinn von Runde 1 in der Bestenliste",
      adVideoSponsor: "WERBESPONSOR",
      adVideoTitle: "Neue Spiele auf Telegram",
      adVideoDesc: "Spiele Top-Mini-Apps ohne Installation!",
      adVideoBtn: "Katalog ansehen",
      adVideoStatus: "Bitte schau die Werbung bis zum Ende an, um deinen Bonus zu erhalten",
      adVideoStatusSuccess: "🎉 Bonus gutgeschrieben!",
      adVideoTimerReward: "✅ Belohnung freigeschaltet!",
      adVideoTimerSec: (s) => `⏳ ${s} Sek.`,
      soundBtnTitle: "Ton",
      refreshLeaderboardTitle: "Rangliste aktualisieren",
      closeBtn: "Schließen",
      walletBtnTitle: "TON-Wallet",
      shopBtnTitle: "Vorteils-Truhe",
      defaultPlayerName: "Spieler",
      infoModalTitle: "Information",
      insufficientFundsTitle: "Nicht genug GRAM!",
      insufficientFundsDesc: (p, b) => `Erforderlich: ${Number(p).toFixed(2)} GRAM. Dein Guthaben: ${Number(b).toFixed(2)} GRAM.\n\nLade dein TON-Guthaben auf, um diesen Vorteil zu aktivieren!`,
      topUpBalanceBtn: "Guthaben aufladen",
      bonusAddedBottle: "+1 leere Flasche zu deinem Inventar hinzugefügt! Tippe auf die Flaschentaste, um sie aufzustellen.",
      bonusAddedHint: "+1 Tipp zu deinem Inventar hinzugefügt! Tippe auf die Tipp-Taste, um ihn zu nutzen.",
      bonusAddedUndo: "+1 Zug-Rückgängig zu deinem Inventar hinzugefügt! Tippe auf die Rückgängig-Taste, um sie zu nutzen.",
      bonusAddedReveal: "+1 Farben-Aufdecken zu deinem Inventar hinzugefügt! Tippe auf die Aufdecken-Taste, um sie zu nutzen.",
      outOfBottlesPrompt: "Du hast 0 leere Flaschen. Schau eine kurze Werbung an, um eine leere Flasche zu erhalten!",
      outOfHintsPrompt: "Du hast 0 Tipps. Schau eine kurze Werbung an, um einen Tipp zu erhalten!",
      outOfUndosPrompt: "Du hast 0 Züge-Rückgängig. Schau eine kurze Werbung an, um ein Rückgängig zu erhalten!",
      outOfRevealsPrompt: "Du hast 0 Aufdeckungen. Schau eine kurze Werbung an, um Farben aufzudecken!",
      bonusBottleTitle: "Leere Flasche gutgeschrieben",
      bonusHintTitle: "Tipp gutgeschrieben",
      bonusUndoTitle: "Rückgängig gutgeschrieben",
      bonusRevealTitle: "Farben-Aufdecken gutgeschrieben",
      purchaseSuccessTitle: "Erfolgreich hinzugefügt!",
      purchaseSuccessAllColorsMsg: "Funktion für 15 Tage aktiviert!\n\nAlle versteckten Flüssigkeitsschichten in allen Flaschen sind jetzt von Beginn jedes Levels an sichtbar!",
      purchaseSuccessRevealsMsg: (c) => `+20 Farben-Aufdeckungen erfolgreich hinzugefügt (gesamt: ${c}).\n\nZähler auf der Schaltfläche 🔮 „Farben aufdecken“ aktualisiert!`,
      purchaseSuccessBottlesMsg: (c) => `+15 leere Flaschen erfolgreich hinzugefügt (gesamt: ${c}).\n\nZähler auf der Schaltfläche 🧪 „Leere Flasche“ aktualisiert!`,
      purchaseSuccessHintsMsg: (c) => `+20 Tipps erfolgreich hinzugefügt (gesamt: ${c}).\n\nZähler auf der Schaltfläche 💡 „Tipp“ aktualisiert!`,
      purchaseSuccessUndosMsg: (c) => `+20 Züge rückgängig erfolgreich hinzugefügt (gesamt: ${c}).\n\nZähler auf der Schaltfläche ↩️ „Rückgängig“ aktualisiert!`,
      adTabAds: "Boni",
      adTabGifts: "Geschenke",
      adTabGiftsHeader: "🎁 Geschenke",
      adTabGiftsDesc: "Nützliche Geschenke erhalten und an andere Spieler senden",
      giftsSubnavReceive: "📥 Geschenke erhalten",
      giftsSubnavSend: "📤 Geschenk senden",
      giftsReceiveChecking: "Eingehende Geschenke prüfen...",
      giftsReceiveEmptyTitle: "Keine neuen Geschenke",
      giftsReceiveEmptyDesc: "Wenn Ihnen ein anderer Spieler ein Geschenk schickt, erscheint es hier mit der Schaltfläche „Abholen“.",
      giftsClaimBtn: "Abholen",
      giftClaimedDone: "Eingelöst!",
      giftReceivedCardTitle: (name, amount) => `🎁 Geschenk: ${name} (+${amount})`,
      giftReceivedCardDesc: "Sie haben ein nützliches Geschenk erhalten!",
      giftFromLabel: "Von",
      adminSenderOptionLabel: "👑 Geschenk senden als:",
      adminSenderFromSelf: "Von mir selbst",
      adminSenderFromGame: "Von Color Sort",
      giftReceivedTimeKyiv: (time) => `🕒 ${time} (Kiew)`,
      giftsDailySentLabel: "Heute gesendet:",
      giftsLimitFootnote: "Limit: maximal 10 Geschenke pro Tag. Zurücksetzen um 23:59 (Kiew).",
      giftsAdminUnlimitedFootnote: "👑 Admin-Modus: unbegrenzter Geschenkversand.",
      giftsUnlimitedTag: "∞ (Unbegrenzt)",
      giftsStepRecipientTitle: "👥 Empfänger aus Spielern wählen:",
      giftsSearchPlaceholder: "🔍 Spieler suchen (Name oder @Username)...",
      giftsSearchPlaceholderUser: "🔍 Spieler nach Namen suchen...",
      giftsPlayersLoading: "Spielerliste wird geladen...",
      giftsPlayersNotFound: "Keine Spieler gefunden",
      giftsPlayersEmpty: "Spielerliste ist leer",
      giftsSelectPlayerBtn: "Wählen",
      giftsBackToRecipientsBtn: "‹ Spieler wechseln",
      giftsRecipientLabel: "Empfänger:",
      giftsStepItemTitle: "🎁 Geschenk zum Senden wählen:",
      giftsInStockLabel: "Auf Lager:",
      giftsSendActionBtn: "Schenken",
      giftItemUndo: "Zug zurück",
      giftItemHint: "Hinweis",
      giftItemReveal: "Farbe aufdecken",
      giftItemBottle: "Leere Flasche",
      giftQtyModalTitle: "Wie viele schenken?",
      giftQtyRecipientDesc: "Empfänger:",
      giftQtyInStockLabel: "Auf Lager:",
      giftQtyAvailableTodayLabel: "Heute verfügbar:",
      giftQtyPickerLabel: "Menge zum Senden:",
      giftQtyPcs: "Stk.",
      giftQtyConfirmBtn: (qty) => `Schenken (${qty} Stk.)`,
      giftQtyCancelBtn: "Abbrechen",
      giftSelfSendError: "Sie können sich selbst kein Geschenk schicken.",
      giftNoStockTitle: "Sie haben dieses Geschenk nicht",
      giftNoStockDesc: (name) => `Sie haben 0 Stk. von „${name}“. Sie können keinen Gegenstand verschenken, den Sie nicht besitzen.`,
      giftLimitExceededTitle: "Tageslimit erreicht",
      giftLimitExceededDesc: "Sie haben heute bereits das Maximum von 10 Geschenken versendet.\n\nDer Zähler wird heute um 23:59 Uhr (Kiewer Zeit) zurückgesetzt.",
      giftSentSuccessTitle: "Geschenk gesendet!",
      giftSentSuccessDesc: (icon, name, qty, recipient, left, dailyNotice) => `Erfolgreich ${icon} „${name}“ (${qty} Stk.) an ${recipient} gesendet!\n\nVom Guthaben abgezogen: ${qty} Stk. (verbleibend: ${left}).\n${dailyNotice}`,
      giftClaimedSuccessTitle: "Geschenk erhalten!",
      giftClaimedSuccessDesc: (icon, name, qty) => `Erfolgreich ${icon} „${name}“ (+${qty}) abgeholt!\n\nGegenstand wurde Ihrem Inventar hinzugefügt und ist einsatzbereit.`,
      giftDailyNoticeAdmin: (count) => `Heute gesendet: ${count} Stk. (Unbegrenzt für Administrator).`,
      giftDailyNoticeUser: (count, max) => `Heute gesendet: ${count} / ${max}.`,
      errorTitle: "Fehler",
      errorSendGift: "Geschenk konnte nicht zugestellt werden:",
      errorClaimGift: "Geschenk konnte nicht abgeholt werden:",
      profileAdminQuickTitle: "Admin-Panel",
      profileAdminQuickSub: "Boni verwalten, Snapshots, Wallets und Neuigkeiten",
      adminPanelCollapseBtn: "Einklappen",
      adminPanelBottomCollapseBtn: "Admin-Panel einklappen",
      seasonResetKickTitle: "Saison-Reset!",
      seasonResetKickOkBtn: "Neu starten (Stufe 0)",
      adminTabCodeBackupLabel: "Sicherungen",
      adminTabCodeBackupDesc: "Code-Versionen",
      adminCodeBackupTitle: "SPIELCODE-Sicherungskopien (Kiewer Zeit)",
      adminCodeBackupSub: "🛡️ Hier sind Kontrollpunkte des funktionierenden Spielcodes erfasst.",
      adminCodeBackupListTitle: "Gespeicherte Versionen des Spielcodes (Kiew):",
      adminCodeBackupEmptyText: "Noch keine Codekopien erstellt",
      adminCodeBackupLoadingText: "Codeversionen werden geladen...",
      adminCodeBackupDeleteBtnLabel: "Löschen",
      tonConnectWalletBtn: "👛 TON-Wallet verbinden",
      tonDisconnectBtn: "Trennen",
      tonBalanceLabel: "Spielguthaben:",
      tonWithdrawBtn: "TON abheben",
      tonDepositTitle: "Guthaben aufladen",
      tonDepositDesc: "Senden Sie TON mit Ihrem Kommentar (Memo) an die angegebene Adresse",
      tonAddressLabel: "Adresse für die Überweisung:",
      tonMemoLabel: "Ihr Kommentar (Memo) — ERFORDERLICH:",
      tonDepositNotice: "⚠️ Geben Sie beim Senden unbedingt das Memo an, da das Geld sonst nicht automatisch gutgeschrieben wird.",
      copyBtn: "Kopieren",
      copiedNotice: "In die Zwischenablage kopiert!",
      refCopySuccess: "Link kopiert! Sende ihn an deine Freunde.",
      refEmptyTitle: "Noch keine Freunde",
    },
    lt: {
      langName: "Lietuvių",
      levelLabel: "Lygis",
      levelDisplayVal: (lvl) => `Lygis ${lvl}`,
      profileHint: "⚙️ Kalba",
      profileTitle: "⚙️ Profilis",
      profileTabLabel: "Profilis",
      referralsTabLabel: "Rekomendacijos",
      adminTabLabel: "Admin",
      langSectionTitle: "Pakeisti kalbą",
      restartBtn: "Iš naujo",
      undoBtn: "Atšaukti",
      hintBtn: "Užuomina",
      revealBtn: "Atskleisti spalvas",
      extraBottleBtn: "Tuščias buteliukas",
      adBonusBtn: "Premijos",
      leaderboardTitle: "🏆 Lyderių lentelė",
      leaderboardLive: "24/7 LIVE",
      leaderboardLoading: "⏳ Įkeliami žaidėjai...",
      leaderboardEmptyTitle: "Lentelė formuojama",
      leaderboardEmptyDesc: "Įveikite lygį per Telegram botą @sortcolors_bot ir tapkite lyderiu!",
      youTag: "(Jūs)",
      maxLevelLabel: (lvl) => `Maks. lygis: ${lvl}`,
      levelPrefix: "Lygis",
      bottlesCountTag: (n) => `${n} buteliukai`,
      winTitle: (lvl) => `Lygis ${lvl} įveiktas! 🎉`,
      winSubtext: (lvl) => `Visos spalvos surūšiuotos! Pereinama į lygį ${lvl}...`,
      nextLevelBtn: "Kitas lygis 🚀",
      restartTitle: "🔄 Pradėti iš naujo?",
      restartDesc: "Šio lygio progresas bus nustatytas iš naujo.",
      cancelBtn: "Atšaukti",
      confirmRestartBtn: "Iš naujo",
      securityAlertTitle: "Color Sort saugumo sistema",
      securityAlertSubtitle: "Pastebėta įsilaužimo veikla",
      securityAlertRestartBtn: (lvl) => `Pradėti ${lvl} lygį iš naujo`,
      serverReloadTitle: "Serverio perkrovimas",
      serverReloadDesc: "Vykdomas žaidimo saugumo ir apsaugos nuo sukčiavimo atnaujinimas.<br>Prašome paleisti žaidimą iš naujo, kad gautumėte naują versiją.",
      serverReloadTimerLabel: "Automatinis perkrovimas po:",
      serverReloadBtn: "Prisijungti iš naujo",
      adModalTitle: "🎁 Premijos",
      adModalDesc: "Žiūrėkite trumpus vaizdo įrašus ir gaukite nemokamas premijas",
      adModalBottleTitle: "Papildomas buteliukas",
      adModalBottleDesc: "+1 tuščias buteliukas į atsargas",
      adModalHintsTitle: "+1 užuomina",
      adModalHintsDesc: "1 tiksli užuomina",
      adModalUndosTitle: "+1 atšaukimas",
      adModalUndosDesc: "1 nemokamas atšaukimas",
      adModalRevealTitle: "Atskleisti spalvas",
      adModalRevealDesc: "Atskleisti 1 buteliuko spalvas",
      noMovesTitle: "Nėra ėjimų",
      noMovesDesc: "Šiame lygyje dar neatlikote nė vieno ėjimo.",
      noHintDesc: "Nėra pasiekiamų ėjimų, kurie atvertų naują paslėptą spalvą. Pabandykite perpilti spalvas arba pridėti tuščią kolbą!",
      allColorsVisibleTitle: "Visos spalvos matomos",
      allColorsVisibleDesc: "Visi buteliukų sluoksniai jau atidengti!",
      extraBottleTitle: "🎉 Pavyko",
      extraBottleDesc: "Papildomas tuščias buteliukas pridėtas!",
      extraBottleModalTitle: "Papildomas buteliukas",
      extraBottleModalPrompt: "Turite 0 papildomų buteliukų. Pažiūrėkite trumpą reklamą, kad gautumėte tuščią buteliuką!",
      claimAdBtn: "▶ Žiūrėti reklamą",
      adStarting: "⏳ Paleidžiama...",
      adClaimed: "✅ Gauta! (+1)",
      adUnavailableTitle: "Reklama nepasiekiama",
      adUnavailableDesc: "Reklama šiuo metu nepasiekiama. Prašome pabandyti vėliau!",
      adDismissedDesc: "Reklamos peržiūra buvo nutraukta. Premija suteikiama tik už pilną peržiūrą.",
      adminBadge: "👑 Admin",
      adminPanelTitle: "Administratoriaus skydelis",
      adminPanelSub: "Prieinama tik Aligatoriui",
      adminBoostersTitle: "⚡ Nemokamos administratoriaus funkcijos (Be reklamos):",
      adminAddBottle: "+5 Tušti buteliukai",
      adminAddBoardBottle: "+1 Buteliukas lentoje",
      adminAddHints: "+5 Užuominos",
      adminAddUndos: "+5 Atšaukimai",
      adminAddReveals: "+5 Atskleidimai",
      adminAddCoins: "+5 TON",
      adminAddLevels: "+5 Lygiai",
      adminAddAll: "Papildyti VISKĄ (+10 visiems)",
      adminBottleAddedMsg: (count) => `🧪 +5 Tušti buteliukai pridėti (Iš viso: ${count})`,
      adminBoardBottleAddedMsg: "🧪 Tuščias buteliukas pridėtas į lentą!",
      adminHintsAddedMsg: (count) => `💡 +5 Užuominos pridėtos (Iš viso: ${count})`,
      adminUndosAddedMsg: (count) => `↩️ +5 Atšaukimai pridėti (Iš viso: ${count})`,
      adminRevealsAddedMsg: (count) => `🔮 +5 Atskleidimai pridėti (Iš viso: ${count})`,
      adminCoinsAddedMsg: (count) => `💎 +5 TON pridėta (Likutis: ${Number(count || 0).toFixed(2)} TON)`,
      adminLevelsAddedMsg: (lvl) => `🏆 +5 Lygiai pridėti! (Dabartinis lygis: ${lvl})`,
      adminSetExactLevelTitle: "🎯 Nustatyti tikslų lygį (1-500)",
      adminSetExactLevelBtnLabel: "Nustatyti",
      adminExactLevelSuccessMsg: (lvl) => `🎯 Lygis ${lvl} sėkmingai nustatytas!`,
      adminAllAddedMsg: "⚡ Visi bonusai papildyti (+10 kiekvienam)!",
      adminResetPurchasesTitle: "💎 Valdyti TON pirkimus (Tik Admin)",
      adminResetPurchasesDesc: "Anuliuoti aktyvius TON pirkimus nepalietus žaidėjų piniginės balanso.",
      adminResetSelfPurchasesBtnLabel: "👑 Atstatyti tik mano paskyrą",
      adminResetPurchasesBtnLabel: "🌐 Atstatyti visų žaidėjų pirkimus",
      adminResetSeasonDesc: "Sezono atstatymas išvalo lyderių lentelę ir atstato visus žaidėjus į 0 lygį. TON balansas, pirkiniai ir pakviesti draugai išsaugomi.",
      adminResetSeasonBtnLabel: "🔥 Atstatyti sezoną (Viską į nulį)",
      adminResetPurchasesSuccessTitle: "💎 Pirkimai anuliuoti!",
      adminResetPurchasesSuccessDesc: "Visi aktyvūs GRAM privalumai iš skrynios anuliuoti. Piniginės balansai nepakito.",
      adminResetSuccessTitle: "💥 Sezonas atstatytas!",
      adminResetSuccessDesc: "Visi žaidėjai atstatyti į 0 lygį! Lyderių lentelė tuščia. TON balansas, pirkiniai ir pakviesti draugai išsaugomi.",
      adminTabActionsLabel: "Valdymas",
      adminTabActionsDesc: "Nemokami stiprintuvai ir sezono atstatymas",
      adminTabHistoryLabel: "Lyderių istorija",
      adminTabHistoryDesc: "23:59 kopijos (Kijevas), rankinės kopijos ir archyvas",
      adminHistoryTitle: "Lyderių istorija",
      adminHistorySub: "Kasdieniai kadrai 23:59 (Kijevas). Rankiniai kadrai išsaugomi atskirai.",
      adminHistoryListTitle: "Išsaugotų kopijų istorija:",
      adminHistoryTakeSnapshotLabel: "Daryti kopiją dabar",
      adminHistoryViewBtnLabel: "Peržiūrėti",
      adminHistoryDeleteBtnLabel: "Ištrinti",
      adminSnapshotAutoBadge: "🤖 Auto (23:59)",
      adminSnapshotManualBadge: "✋ Rankinis",
      adminViewerBackBtn: "← Atgal į kopijų sąrašą",
      adminHistoryEmptyText: "Išsaugotų kopijų nėra",
      adminHistoryLoadingText: "Įkeliamas kopijų sąrašas...",
      adminHistoryColRank: "#",
      adminHistoryColPlayer: "Žaidėjas",
      adminHistoryColTid: "Telegram ID",
      adminHistoryColLevel: "Lygis",
      adminHistoryTotalBadge: (count) => `👥 ${count} žaidėjai`,
      adminHistorySearchPlaceholder: "Ieškoti pagal vardą, username ar ID...",
      adminHistorySnapshotSuccess: "📸 Rankinė dabartinės lyderių lentelės kopija sėkmingai išsaugota!",
      deleteSnapshotModalTitle: "Kopijos ištrynimas",
      deleteSnapshotLead: "Ar tikrai norite ištrinti šią lyderių lentelės kopiją?",
      deleteSnapshotSuccess: "🗑️ Lyderių lentelės kopija sėkmingai ištrinta!",
      adminTabWalletsLabel: "Piniginės",
      adminTabWalletsDesc: "Žaidėjai su prijungta TON pinigine",
      adminWalletsTitle: "Žaidėjų piniginės",
      adminWalletsSub: "Žaidėjai, prijungę TON piniginę prie žaidimo",
      adminWalletsEmptyText: "Nėra žaidėjų su prijungta pinigine",
      adminWalletsLoadingText: "Įkeliamos žaidėjų piniginės...",
      adminWalletsSearchPlaceholder: "Ieškoti pagal vardą, ID ar adresą...",
      adminWalletViewBtnLabel: "Peržiūrėti",
      adminWalletDetailsTitle: "👛 Žaidėjo piniginė",
      adminWalletNoDeposits: "Patvirtintų papildymų kol kas nėra",
      adminWalletBackBtn: "← Atgal į piniginių sąrašą",
      adminTabNewsLabel: "Naujienos",
      adminTabNewsDesc: "Pranešimų ir nuotraukų siuntimas žaidėjams per botą",
      adminNewsHeaderTitle: "Naujienos ir žaidėjų pranešimai",
      adminNewsHeaderSub: "Siųskite žaidėjams pranešimus, nuotraukas ir atnaujinimus. Žaidėjai gaus Telegram pranešimą su mygtuku paleisti žaidimą!",
      adminNewsAudienceLabel: "Iš viso gavėjų (žaidėjų):",
      adminNewsTimeLabel: "Laikas (Kijevas):",
      adminNewsTitleLabel: "Naujienos / pranešimo antraštė:",
      adminNewsMessageLabel: "Pranešimo tekstas žaidėjams:",
      adminNewsImageLabel: "Pridėti nuotrauką (neprivaloma):",
      adminNewsUploadFileLabel: "Pasirinkti nuotrauką iš įrenginio",
      adminNewsButtonLabel: "Telegram mygtuko tekstas:",
      adminNewsTestSendLabel: "Bandomasis siuntimas sau (Adminui)",
      adminNewsBroadcastLabel: "Paskelbti ir išsiųsti VISIEMS žaidėjams",
      adminNewsHistoryTitle: "Išsiųstų naujienų istorija",
      adminNewsLoadingText: "Įkeliama naujienų istorija...",
      adminNewsEmptyText: "Išsiųstų naujienų dar nėra",
      tgChannelTitle: "Telegram kanalas",
      officialBadge: "Oficialus",
      ourProject: "Mūsų projektas",
      tgChannelBadge: "Mūsų projektas",
      tgChannelSub: "Naujienos, atnaujinimai ir kodai",
      tgChannelJoinBtn: "Atidaryti kanalą",
      referralSectionTitle: "Color Sort",
      referralSectionSub: "Už kiekvieną pakviestąjį — 5 atšaukimai, 5 užuominos, 5 spalvų atskleidimai ir 5 tušti indai",
      shareReferralTelegramBtn: "📢 Pakviesti į Telegram",
      copyReferralLinkBtn: "📋 Kopijuoti nuorodą",
      referralClaimTitle: "Apdovanojimai pasiekiami!",
      claimAllReferralsBtn: "Pasiimti viską",
      refUnitLabel: "draugų",
      referralsListHeader: "Pakviesti draugai:",
      tonModalTitle: "TON balanso papildymas",
      tonModalSubtitle: "Pasirinkite sumą ir patogią kriptovaliutų piniginę",
      tonBalanceSub: "Jūsų dabartinis TON balansas:",
      tonWalletStatusSub: "Piniginės būsena:",
      tonWalletDisconnected: "Neprijungta",
      tonWalletConnected: "Aktyvi",
      tonConnectHeading: "Piniginės prijungimas",
      tonConnectSubtext: "Prijunkite piniginę apdovanojimams ir balansui",
      tonConnectBtnLabel: "Prijungti TON piniginę",
      tonDisconnectBtnLabel: "Atjungti piniginę",
      disconnectWalletModalTitle: "Piniginės atjungimas",
      disconnectWalletModalDesc: "Ar tikrai norite atjungti piniginę?",
      disconnectWalletModalNote: "Jūsų žaidimo TON / GRAM balansas visiškai išlieka žaidime.",
      disconnectWalletConfirmBtn: "Taip, atjungti",
      disconnectWalletCancelBtn: "Atšaukti",
      tonAmountTitle: "Pasirinkite papildymo sumą:",
      tonRewardLabel: "Įskaitymas į GRAM balansą:",
      tonChoiceHeader: "Pasirinkite mokėjimo piniginę:",
      tonInstTitle: "Kaip mokėti per Telegram Wallet (@wallet):",
      tonInstStep1: "1. Spustelėkite @wallet viršuje (komentaras nukopijuojamas).",
      tonInstStep2: "2. Bote pasirinkite Siųsti ➔ Į išorinę piniginę (TON).",
      tonAddrSub: "TON adresas:",
      tonCopyLabel: "Kopijuoti",
      tonCopiedLabel: "Nukopijuota",
      tonVerifyBtn: "Patikrinti mokėjimą",
      shopModalTitle: "Privalumų skrynia",
      shopModalSubtitle: "Pirkite žaidimo patobulinimus už GRAM",
      shopBalanceSub: "Piniginės balansas:",
      shopTopUpBtn: "+ Papildyti",
      shopActiveTitle: "Visos spalvos atskleistos: AKTYVU",
      shopSectionDivider: "Busteriai už GRAM kriptovaliutą",
      shopFeaturedTitle: "Visos spalvos atskleistos",
      shopFeaturedDesc: "Visos spalvos visuose buteliukuose atskleidžiamos iškart nuo kiekvieno lygio pradžios! Paslėpti klausimo ženklo sluoksniai pašalinami.",
      shopBottlesTitle: "+15 Tušti buteliukai",
      shopBottlesDesc: "Papildomų tuščių buteliukų atsargos sunkiems lygiams įveikti.",
      shopHintsTitle: "+20 Užuominų",
      shopHintsDesc: "Rodo geriausią kitą ėjimą užstrigus.",
      shopUndosTitle: "+20 Atšaukimų",
      shopUndosDesc: "Grąžina ėjimą atgal bet kokioje situacijoje.",
      dailyBoostersTitle: "Kasdienis užuominų rinkinys (30 dienų)",
      dailyBoostersDesc: "Pirmas priskaitymas (+10 kiekvienos rūšies) suteikiamas iškart perkant! Vėliau — kasdien tiksliai 23:59 Kijevo laiku 30 dienų iš eilės.",
      dailyBoostersTag: "30 dienų",
      dailyBoostersCounterLabel: "⏳ Liko dienų:",
      dailyBoostersNextLabel: "⏰ Kitas priskaitymas:",
      dailyBoostersNextInfo: "⏰ Priskaičiavimas po 10 užuominų 23:59 (Kijevas)",
      dailyBoostersBtnBuy: (price) => `Pirkti už ${price} GRAM`,
      dailyBoostersBtnExtend: (price) => `Pratęsti (+30 d.) už ${price} GRAM`,
      dailyBoostersSuccessTitle: "✨ 30 dienų rinkinys aktyvuotas!",
      dailyBoostersSuccessMsg: "Sėkmingai įsigijote funkciją už 5 GRAM!\n\nPirmasis priskaitymas (+10 užuominų kiekvienos rūšies) jau priskaičiuotas!\n\nTolesni priskaitymai vyks kasdien tiksliai 23:59 Kijevo laiku 30 dienų iš eilės.",
      dailyBoostersClaimTitle: "🎁 Kasdienis rinkinys suteiktas!",
      dailyBoostersClaimMsg: (amount, daysLeft) => `Atėjo 23:59 (Kijevas)!\n\nJums suteikta po ${amount} kiekvienos rūšies užuominų:\n• ↩️ Atšaukimas: +${amount}\n• 💡 Užuomina: +${amount}\n• 🔮 Atskleidimas: +${amount}\n• 🧪 Buteliukas: +${amount}\n\nLiko dienų: ${daysLeft}`,
      shopBuyGram: (price) => `Pirkti už ${price} GRAM`,
      shopActivateGram: (price) => `Aktivuoti (${price} GRAM)`,
      shopExtendGram: (price) => `Pratęsti (+15 d.) — ${price} GRAM`,
      resetPurchasesModalTitle: "TON pirkimų atstatymas",
      resetPurchasesWarningLead: "Dėmesio! Aktyvūs pirkimai bus anuliuoti:",
      confirmResetPurchasesBtnLabel: "💎 Atstatyti pirkimus",
      resetSeasonModalTitle: "Sezono atstatymas",
      resetSeasonWarningLead: "Dėmesio! Šis veiksmas negrįžtamas:",
      confirmResetSeasonBtnLabel: "🔥 Atstatyti viską",
      shopActiveRemaining: (d, h, m) => `Liko: ${d} d. ${h} val. ${m} min.`,
      shopActiveExpiring: "Netrukus baigsis...",
      shopFeaturedRibbon: "TOP 🔥",
      shopDurationTag: "⏳ 15 dienų",
      shopPriceLabel: "Kaina:",
      shopRevealsTitle: "+20 Atskleisti spalvas",
      shopRevealsDesc: "Atskleidžia paslėptas spalvas visose kolbose.",
      tonSpaceSub: "TON programėlė",
      tonWalletSub: "Telegram piniginė",
      tonCopyMemoTitle: "Kopijuoti Memo",
      tonConnecting: "Jungiamasi...",
      tonConnectedPrefix: "Prijungta:",
      tonConnectError: "Nepavyko prijungti piniginės. Patikrinkite ryšį arba piniginės programėlę.",
      tonVerifyingBtn: "Tikrinamas mokėjimas...",
      tonStepMinus: "Sumažinti",
      tonStepPlus: "Padidinti",
      refEmptyText: "Dar niekas neprisijungė per jūsų nuorodą. Nusiųskite nuorodą draugams Telegram!",
      refClaimSubtitle: "+5 prie visų premijų",
      rewardClaimed: "Apdovanojimas gautas",
      claimBonusBtn: "Atsiimti apdovanojimą",
      adminPurchasesHeader: "💎 TON pirkimų valdymas (Tik Admin)",
      adminResetSelfPurchasesBtn: "👑 Atstatyti tik mano paskyrą",
      resetPurchasesItem1: "🎨 Privalumas „Visos spalvos atskleistos“ bus išjungtas visiems žaidėjams",
      resetPurchasesItem2: "⏳ Visų aktyvių skrynios patobulinimų galiojimo laikas bus anuliuotas",
      resetPurchasesItem3: "💎 Žaidėjų TON / GRAM piniginių balansai nesikeis",
      resetSeasonItem1: "💥 Pasaulinė lyderių lentelė bus visiškai išvalyta",
      resetSeasonItem2: "📉 Visi žaidėjai atstatomi į 0 lygį",
      resetSeasonItem3: "🛡️ TON balansas, pirkiniai ir pakviesti draugai išsaugomi",
      resetSeasonItem4: "🏆 Žaidėjai atsiras lentelėje tik laimėję 1-ąjį turą",
      adVideoSponsor: "REKLAMOS RĖMĖJAS",
      adVideoTitle: "Nauji žaidimai Telegram",
      adVideoDesc: "Žaiskite populiariausias Mini Apps be diegimo!",
      adVideoBtn: "Žiūrėti katalogą",
      adVideoStatus: "Prašome peržiūrėti reklamą iki galo, kad gautumėte premiją",
      adVideoStatusSuccess: "🎉 Premija suteikta!",
      adVideoTimerReward: "✅ Apdovanojimas atrakintas!",
      adVideoTimerSec: (s) => `⏳ ${s} sek.`,
      soundBtnTitle: "Garsas",
      refreshLeaderboardTitle: "Atnaujinti reitingą",
      closeBtn: "Uždaryti",
      walletBtnTitle: "TON piniginė",
      shopBtnTitle: "Privalumų skrynia",
      defaultPlayerName: "Žaidėjas",
      infoModalTitle: "Informacija",
      insufficientFundsTitle: "Nepakanka GRAM!",
      insufficientFundsDesc: (p, b) => `Pirkimui reikia ${Number(p).toFixed(2)} GRAM. Jūsų balansas: ${Number(b).toFixed(2)} GRAM.\n\nPapildykite TON piniginę, kad suaktyvintumėte privalumą!`,
      topUpBalanceBtn: "Papildyti balansą",
      bonusAddedBottle: "+1 tuščia kolba pridėta į jūsų inventorių! Paspauskite kolbos mygtuką, kad pastatytumėte ją aikštelėje.",
      bonusAddedHint: "+1 užuomina pridėta į jūsų inventorių! Paspauskite užuominos mygtuką, kad panaudotumėte.",
      bonusAddedUndo: "+1 ėjimo atšaukimas pridėtas į jūsų inventorių! Paspauskite atšaukimo mygtuką, kad panaudotumėte.",
      bonusAddedReveal: "+1 spalvų atskleidimas pridėtas į jūsų inventorių! Paspauskite atskleidimo mygtuką, kad panaudotumėte.",
      outOfBottlesPrompt: "Turite 0 tuščių kolbų. Pažiūrėkite trumpą reklamą, kad gautumėte tuščią kolbą į inventorių!",
      outOfHintsPrompt: "Turite 0 užuominų. Pažiūrėkite trumpą reklamą, kad gautumėte užuominą į inventorių!",
      outOfUndosPrompt: "Turite 0 ėjimų atšaukimų. Pažiūrėkite trumpą reklamą, kad gautumėte atšaukimą į inventorių!",
      outOfRevealsPrompt: "Turite 0 atskleidimų. Pažiūrėkite trumpą reklamą, kad gautumėte spalvų atskleidimą!",
      bonusBottleTitle: "Tuščia kolba pridėta",
      bonusHintTitle: "Užuomina pridėta",
      bonusUndoTitle: "Atšaukimas pridėtas",
      bonusRevealTitle: "Atskleidimas pridėtas",
      purchaseSuccessTitle: "Sėkmingai pridėta!",
      purchaseSuccessAllColorsMsg: "Funkcija suaktyvinta 15 dienų!\n\nVisi paslėpti skysčių sluoksniai visose kolbose dabar matomi iškart nuo kiekvieno lygio pradžios!",
      purchaseSuccessRevealsMsg: (c) => `+20 spalvų atskleidimų sėkmingai pridėta (iš viso: ${c}).\n\nMygtuko 🔮 „Atskleisti spalvas“ skaitiklis atnaujintas!`,
      purchaseSuccessBottlesMsg: (c) => `+15 tuščių kolbų sėkmingai pridėta (iš viso: ${c}).\n\nMygtuko 🧪 „Tuščia kolba“ skaitiklis atnaujintas!`,
      purchaseSuccessHintsMsg: (c) => `+20 užuominų sėkmingai pridėta (iš viso: ${c}).\n\nMygtuko 💡 „Užuomina“ skaitiklis atnaujintas!`,
      purchaseSuccessUndosMsg: (c) => `+20 ėjimų atšaukimų sėkmingai pridėta (iš viso: ${c}).\n\nMygtuko ↩️ „Atšaukti“ skaitiklis atnaujintas!`,
      adTabAds: "Premijos",
      adTabGifts: "Dovanos",
      adTabGiftsHeader: "🎁 Dovanos",
      adTabGiftsDesc: "Gaukite ir siųskite naudingas dovanas kitiems žaidėjams",
      giftsSubnavReceive: "📥 Gauti dovanas",
      giftsSubnavSend: "📤 Siųsti dovaną",
      giftsReceiveChecking: "Gaunamų dovanų tikrinimas...",
      giftsReceiveEmptyTitle: "Nėra naujų dovanų",
      giftsReceiveEmptyDesc: "Kai kitas žaidėjas atsiųs jums dovaną, ji atsiras čia su mygtuku „Atsiimti“.",
      giftsClaimBtn: "Atsiimti",
      giftClaimedDone: "Paimta!",
      giftReceivedCardTitle: (name, amount) => `🎁 Dovana: ${name} (+${amount})`,
      giftReceivedCardDesc: "Gavote naudingą dovaną!",
      giftFromLabel: "Nuo",
      adminSenderOptionLabel: "👑 Siųsti dovaną kaip:",
      adminSenderFromSelf: "Nuo savęs",
      adminSenderFromGame: "Nuo Color Sort",
      giftReceivedTimeKyiv: (time) => `🕒 ${time} (Kijevas)`,
      giftsDailySentLabel: "Išsiųsta šiandien:",
      giftsLimitFootnote: "Limitas: iki 10 dovanų per dieną. Atstatymas 23:59 (Kijevo laiku).",
      giftsAdminUnlimitedFootnote: "👑 Administratoriaus režimas: neribotas dovanų siuntimas.",
      giftsUnlimitedTag: "∞ (Neribota)",
      giftsStepRecipientTitle: "👥 Pasirinkite gavėją iš žaidėjų:",
      giftsSearchPlaceholder: "🔍 Ieškoti žaidėjo (vardas arba @username)...",
      giftsSearchPlaceholderUser: "🔍 Ieškoti žaidėjo...",
      giftsPlayersLoading: "Kraunamas žaidėjų sąrašas...",
      giftsPlayersNotFound: "Žaidėjų pagal užklausą nerasta",
      giftsPlayersEmpty: "Žaidėjų sąrašas tuščias",
      giftsSelectPlayerBtn: "Pasirinkti",
      giftsBackToRecipientsBtn: "‹ Pakeisti žaidėją",
      giftsRecipientLabel: "Gavėjas:",
      giftsStepItemTitle: "🎁 Pasirinkite siunčiamą dovaną:",
      giftsInStockLabel: "Turima:",
      giftsSendActionBtn: "Padovanoti",
      giftItemUndo: "Ėjimo atšaukimas",
      giftItemHint: "Užuomina",
      giftItemReveal: "Atskleisti spalvą",
      giftItemBottle: "Tuščia kolba",
      giftQtyModalTitle: "Kiek padovanoti?",
      giftQtyRecipientDesc: "Gavėjas:",
      giftQtyInStockLabel: "Turima:",
      giftQtyAvailableTodayLabel: "Šiandien galima:",
      giftQtyPickerLabel: "Siunčiamas kiekis:",
      giftQtyPcs: "vnt.",
      giftQtyConfirmBtn: (qty) => `Padovanoti (${qty} vnt.)`,
      giftQtyCancelBtn: "Atšaukti",
      giftSelfSendError: "Negalite siųsti dovanos sau.",
      giftNoStockTitle: "Neturite šios dovanos",
      giftNoStockDesc: (name) => `Turite 0 vnt. „${name}“. Negalima padovanoti daikto, kurio neturite balanse.`,
      giftLimitExceededTitle: "Dienos limitas išnaudotas",
      giftLimitExceededDesc: "Šiandien jau išsiuntėte maksimalų 10 dovanų skaičių.\n\nSkaitiklis bus atstatytas šiandien 23:59 Kijevo laiku.",
      giftSentSuccessTitle: "Dovana išsiųsta!",
      giftSentSuccessDesc: (icon, name, qty, recipient, left, dailyNotice) => `Sėkmingai išsiųsta ${icon} „${name}“ (${qty} vnt.) žaidėjui ${recipient}!\n\nIš balanso nuskaičiuota: ${qty} vnt. (liko: ${left}).\n${dailyNotice}`,
      giftClaimedSuccessTitle: "Dovana atsiimta!",
      giftClaimedSuccessDesc: (icon, name, qty) => `Sėkmingai atsiėmėte ${icon} „${name}“ (+${qty})!\n\nDaiktai pridėti į jūsų balansą ir paruošti naudoti.`,
      giftDailyNoticeAdmin: (count) => `Išsiųsta šiandien: ${count} vnt. (Neribota administratoriui).`,
      giftDailyNoticeUser: (count, max) => `Išsiųsta šiandien: ${count} / ${max}.`,
      errorTitle: "Klaida",
      errorSendGift: "Nepavyko pristatyti dovanos:",
      errorClaimGift: "Nepavyko atsiimti dovanos:",
      profileAdminQuickTitle: "Administratoriaus skydelis",
      profileAdminQuickSub: "Premijų valdymas, momentinės nuotraukos, piniginės ir naujienos",
      adminPanelCollapseBtn: "Suskleisti",
      adminPanelBottomCollapseBtn: "Suskleisti administratoriaus skydelį",
      seasonResetKickTitle: "Sezono atstatymas!",
      seasonResetKickOkBtn: "Pradėti iš naujo (0 lygis)",
      adminTabCodeBackupLabel: "Atsarginės kopijos",
      adminTabCodeBackupDesc: "Kodo versijos",
      adminCodeBackupTitle: "ŽAIDIMO KODO atsarginės kopijos (Kijevo laiku)",
      adminCodeBackupSub: "🛡️ Čia užfiksuoti veikiančio žaidimo kodo kontroliniai taškai.",
      adminCodeBackupListTitle: "Užfiksuotos žaidimo kodo versijos (Kijevas):",
      adminCodeBackupEmptyText: "Kodo kopijų dar nesukurta",
      adminCodeBackupLoadingText: "Kraunamos kodo versijos...",
      adminCodeBackupDeleteBtnLabel: "Ištrinti",
      tonConnectWalletBtn: "👛 Prijungti TON piniginę",
      tonDisconnectBtn: "Atsijungti",
      tonBalanceLabel: "Balansas žaidime:",
      tonWithdrawBtn: "Išsiimti TON",
      tonDepositTitle: "Papildyti balansą",
      tonDepositDesc: "Nusiųskite TON nurodytu adresu su savo komentaru (Memo)",
      tonAddressLabel: "Pervedimo adresas:",
      tonMemoLabel: "Jūsų komentaras (Memo) — BŪTINA:",
      tonDepositNotice: "⚠️ Būtinai nurodykite Memo siųsdami, kitaip lėšos nebus įskaitytos automatiškai.",
      copyBtn: "Kopijuoti",
      copiedNotice: "Nukopijuota į iškarpinę!",
      refCopySuccess: "Nuoroda nukopijuota! Nusiųskite ją draugams.",
      refEmptyTitle: "Draugų kol kas nėra",
    }
  };

  window.TRANSLATIONS = TRANSLATIONS;

  let currentLang = localStorage.getItem('color_sort_lang') || 'ru';
  if (!TRANSLATIONS[currentLang]) currentLang = 'ru';

  function t(key, ...args) {
    const dict = TRANSLATIONS[currentLang] || TRANSLATIONS.ru;
    const val = dict[key] !== undefined ? dict[key] : (TRANSLATIONS.ru[key] || '');
    if (typeof val === 'function') return val(...args);
    return val;
  }

  // 3. Get DOM references
  const gameBoard = document.getElementById('gameBoard');
  const particleCanvas = document.getElementById('particleCanvas');
  const levelDisplay = document.getElementById('levelDisplay');
  const coinsDisplay = document.getElementById('coinsDisplay');
  const hintsCountDisplay = document.getElementById('hintsCountDisplay');
  const undosCountDisplay = document.getElementById('undosCountDisplay');
  const userName = document.getElementById('userName');
  const userRank = document.getElementById('userRank');
  const userAvatar = document.getElementById('userAvatar');

  // Header and Profile Elements
  const userProfileBtn = document.getElementById('userProfileBtn');
  const profileModal = document.getElementById('profileModal');
  const closeProfileModalBtn = document.getElementById('closeProfileModalBtn');
  const profileCardAvatar = document.getElementById('profileCardAvatar');
  const profileCardName = document.getElementById('profileCardName');
  const profileCardLevel = document.getElementById('profileCardLevel');
  const profileModalTitle = document.getElementById('profileModalTitle');
  const profileSettingsHint = document.getElementById('profileSettingsHint');
  const langSectionTitle = document.getElementById('langSectionTitle');
  const levelBadgeLabel = document.getElementById('levelBadgeLabel');
  const telegramChannelCard = document.getElementById('telegramChannelCard');
  const telegramChannelLink = document.getElementById('telegramChannelLink');
  const telegramChannelJoinBtn = document.getElementById('telegramChannelJoinBtn');
  const tgChannelThumb = document.getElementById('tgChannelThumb');

  // Toolbar Labels
  const restartBtnLabel = document.getElementById('restartBtnLabel');
  const undoBtnLabel = document.getElementById('undoBtnLabel');
  const hintBtnLabel = document.getElementById('hintBtnLabel');
  const revealBtnLabel = document.getElementById('revealBtnLabel');
  const extraBottleBtnLabel = document.getElementById('extraBottleBtnLabel');
  const adBonusBtnLabel = document.getElementById('adBonusBtnLabel');

  // Start Screen Elements
  const startBadge = document.getElementById('startBadge');
  const startDesc = document.getElementById('startDesc');
  const startHint = document.getElementById('startHint');

  // Buttons
  const restartBtn = document.getElementById('restartBtn');
  const undoBtn = document.getElementById('undoBtn');
  const hintBtn = document.getElementById('hintBtn');
  const revealBottleBtn = document.getElementById('revealBottleBtn');
  const extraBottleBtn = document.getElementById('extraBottleBtn');
  const adBonusBtn = document.getElementById('adBonusBtn');
  const walletBtn = document.getElementById('walletBtn');
  const shopBtn = document.getElementById('shopBtn');
  const leaderboardBtn = document.getElementById('leaderboardBtn');
  const soundToggleBtn = document.getElementById('soundToggleBtn');
  const nextLevelBtn = document.getElementById('nextLevelBtn');

  // TON Wallet & Deposit Modal Elements
  const tonWalletModal = document.getElementById('tonWalletModal');
  const closeTonModalBtn = document.getElementById('closeTonModalBtn');
  const tonModalUserBalance = document.getElementById('tonModalUserBalance');
  const tonModalWalletStatus = document.getElementById('tonModalWalletStatus');
  const tonWalletStatusLabel = document.getElementById('tonWalletStatusLabel');
  const tonConnectBtn = document.getElementById('tonConnectBtn');
  const tonConnectBtnLabel = document.getElementById('tonConnectBtnLabel');
  const tonDisconnectBtn = document.getElementById('tonDisconnectBtn');
  const tonDisconnectBtnLabel = document.getElementById('tonDisconnectBtnLabel');
  const tonDisconnectConfirmModal = document.getElementById('tonDisconnectConfirmModal');
  const disconnectWalletModalTitle = document.getElementById('disconnectWalletModalTitle');
  const disconnectWalletModalDesc = document.getElementById('disconnectWalletModalDesc');
  const disconnectWalletModalNote = document.getElementById('disconnectWalletModalNote');
  const cancelDisconnectWalletBtn = document.getElementById('cancelDisconnectWalletBtn');
  const confirmDisconnectWalletBtn = document.getElementById('confirmDisconnectWalletBtn');
  const tonSelectedAmountBadge = document.getElementById('tonSelectedAmountBadge');
  const tonChipsRow = document.getElementById('tonChipsRow');
  const tonStepMinusBtn = document.getElementById('tonStepMinusBtn');
  const tonStepperDisplay = document.getElementById('tonStepperDisplay');
  const tonStepPlusBtn = document.getElementById('tonStepPlusBtn');
  const tonRewardGram = document.getElementById('tonRewardGram');
  const tonPayTonkeeperBtn = document.getElementById('tonPayTonkeeperBtn');
  const tonPayWalletBtn = document.getElementById('tonPayWalletBtn');
  const tonAddressDisplay = document.getElementById('tonAddressDisplay');
  const tonCopyAddrBtn = document.getElementById('tonCopyAddrBtn');
  const tonCopyAddrLabel = document.getElementById('tonCopyAddrLabel');
  const tonMemoDisplay = document.getElementById('tonMemoDisplay');
  const tonCopyMemoBtn = document.getElementById('tonCopyMemoBtn');
  const tonCopyMemoIcon = document.getElementById('tonCopyMemoIcon');
  const tonVerifyPaymentBtn = document.getElementById('tonVerifyPaymentBtn');
  const tonVerifyBtnLabel = document.getElementById('tonVerifyBtnLabel');

  // Chest / Upgrades Shop Modal Elements
  const shopModal = document.getElementById('shopModal');
  const closeShopModalBtn = document.getElementById('closeShopModalBtn');
  const shopUserBalance = document.getElementById('shopUserBalance');
  const shopTopUpBtn = document.getElementById('shopTopUpBtn');
  const shopActivePerkBanner = document.getElementById('shopActivePerkBanner');
  const shopActivePerkTitle = document.getElementById('shopActivePerkTitle');
  const shopActiveTimerText = document.getElementById('shopActiveTimerText');
  const buyAllColorsBtn = document.getElementById('buyAllColorsBtn');

  // Modals
  const leaderboardModal = document.getElementById('leaderboardModal');
  const leaderboardModalTitle = document.getElementById('leaderboardModalTitle');
  const leaderboardLiveBadge = document.getElementById('leaderboardLiveBadge');
  const closeLeaderboardBtn = document.getElementById('closeLeaderboardBtn');
  const leaderboardList = document.getElementById('leaderboardList');
  const modalUserPos = document.getElementById('modalUserPos');
  const modalUserName = document.getElementById('modalUserName');
  const modalUserLevel = document.getElementById('modalUserLevel');

  const winModal = document.getElementById('winModal');
  const winModalMovesCount = document.getElementById('winModalMovesCount');
  const winModalBoostersCount = document.getElementById('winModalBoostersCount');
  const winModalTimeElapsed = document.getElementById('winModalTimeElapsed');
  const adModal = document.getElementById('adModal');
  const closeAdModalBtn = document.getElementById('closeAdModalBtn');
  const adModalTitle = document.getElementById('adModalTitle');
  const adModalDesc = document.getElementById('adModalDesc');

  // App specific dynamic modals (may or may not exist in DOM natively)
  const loadingScreen = document.getElementById('loadingScreen');
  const restartModal = document.getElementById('restartModal');
  const restartModalTitle = document.getElementById('restartModalTitle');
  const restartModalDesc = document.getElementById('restartModalDesc');
  const cancelRestartBtn = document.getElementById('cancelRestartBtn');
  const confirmRestartBtn = document.getElementById('confirmRestartBtn');
  const infoModal = document.getElementById('infoModal');
  const securityAlertModal = document.getElementById('securityAlertModal');
  const securityAlertTitle = document.getElementById('securityAlertTitle');
  const securityAlertSubtitle = document.getElementById('securityAlertSubtitle');
  const securityAlertDesc = document.getElementById('securityAlertDesc');
  const securityAlertRestartBtn = document.getElementById('securityAlertRestartBtn');

  // Admin & Season Reset Elements
  const profileAdminBadge = document.getElementById('profileAdminBadge');
  const adminPanelSection = document.getElementById('adminPanelSection');
  const adminPanelTitle = document.getElementById('adminPanelTitle');
  const adminResetPurchasesBtn = document.getElementById('adminResetPurchasesBtn');
  const adminResetPurchasesBtnLabel = document.getElementById('adminResetPurchasesBtnLabel');
  const resetPurchasesModal = document.getElementById('resetPurchasesModal');
  const cancelResetPurchasesBtn = document.getElementById('cancelResetPurchasesBtn');
  const confirmResetPurchasesBtn = document.getElementById('confirmResetPurchasesBtn');
  const adminResetSeasonBtn = document.getElementById('adminResetSeasonBtn');
  const resetSeasonModal = document.getElementById('resetSeasonModal');
  const cancelResetSeasonBtn = document.getElementById('cancelResetSeasonBtn');
  const confirmResetSeasonBtn = document.getElementById('confirmResetSeasonBtn');
  const resetModalTitle = document.getElementById('resetModalTitle');

  // Admin Free Boosters Elements
  const adminBoostersTitle = document.getElementById('adminBoostersTitle');
  const adminAddBottleBtn = document.getElementById('adminAddBottleBtn');
  const adminAddBottleLabel = document.getElementById('adminAddBottleLabel');
  const adminAddHintsBtn = document.getElementById('adminAddHintsBtn');
  const adminAddHintsLabel = document.getElementById('adminAddHintsLabel');
  const adminAddUndosBtn = document.getElementById('adminAddUndosBtn');
  const adminAddUndosLabel = document.getElementById('adminAddUndosLabel');
  const adminAddRevealsBtn = document.getElementById('adminAddRevealsBtn');
  const adminAddRevealsLabel = document.getElementById('adminAddRevealsLabel');
  const adminAddCoinsBtn = document.getElementById('adminAddCoinsBtn');
  const adminAddCoinsLabel = document.getElementById('adminAddCoinsLabel');
  const adminAddLevelsBtn = document.getElementById('adminAddLevelsBtn');
  const adminAddLevelsLabel = document.getElementById('adminAddLevelsLabel');
  const adminAddAllBtn = document.getElementById('adminAddAllBtn');
  const adminAddAllLabel = document.getElementById('adminAddAllLabel');
  const adminSetExactLevelTitle = document.getElementById('adminSetExactLevelTitle');
  const adminSetExactLevelBtn = document.getElementById('adminSetExactLevelBtn');
  const adminSetExactLevelBtnLabel = document.getElementById('adminSetExactLevelBtnLabel');
  const adminExactLevelInput = document.getElementById('adminExactLevelInput');
  const adminExactLevelUserId = document.getElementById('adminExactLevelUserId');
  const adminFeedbackMsg = document.getElementById('adminFeedbackMsg');
  const adminResetSelfPurchasesBtn = document.getElementById('adminResetSelfPurchasesBtn');

  // Referral Program Elements
  const referralCountVal = document.getElementById('referralCountVal');
  const referralLinkTextDisplay = document.getElementById('referralLinkTextDisplay');
  const referralDirectStartBtn = document.getElementById('referralDirectStartBtn');
  const shareReferralTelegramBtn = document.getElementById('shareReferralTelegramBtn');
  const copyReferralLinkBtn = document.getElementById('copyReferralLinkBtn');
  const copyReferralBtnText = document.getElementById('copyReferralBtnText');
  const referralClaimBanner = document.getElementById('referralClaimBanner');
  const referralClaimTitle = document.getElementById('referralClaimTitle');
  const referralClaimSubtitle = document.getElementById('referralClaimSubtitle');
  const claimAllReferralsBtn = document.getElementById('claimAllReferralsBtn');
  const referralsListContainer = document.getElementById('referralsListContainer');

  const ALLIGATOR_TELEGRAM_ID = '5761685341';

  function isAlligatorAdmin(user) {
    if (!user) user = currentUser;
    const tid = String(user?.telegramId || user?.telegram_id || user?.id || localStorage.getItem('cs_last_telegram_id') || '').trim();
    const uname = String(user?.username || user?.userName || localStorage.getItem('cs_last_username') || '').toLowerCase().replace(/^@/, '').trim();
    const first = String(user?.firstName || user?.first_name || '').toUpperCase().trim();

    if (tid === ALLIGATOR_TELEGRAM_ID || tid === '5761685341') return true;
    if (uname === 'alligator' || uname === 'alligator0709' || uname.includes('alligator')) return true;
    if (first.includes('ALLIGATOR')) return true;
    if (typeof sessionAdminPin !== 'undefined' && sessionAdminPin === '1986') return true;
    if (typeof window !== 'undefined' && window.currentAdminPin === '1986') return true;
    if (localStorage.getItem('color_sort_admin_pin') === '1986') return true;
    return false;
  }

  function applyLanguage(lang) {
    if (!TRANSLATIONS[lang]) lang = 'ru';
    currentLang = lang;
    localStorage.setItem('color_sort_lang', lang);

    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === lang);
    });

    // Header & Toolbar
    if (levelBadgeLabel) levelBadgeLabel.textContent = t('levelLabel');
    if (profileSettingsHint) profileSettingsHint.textContent = t('profileHint');
    if (profileModalTitle) profileModalTitle.textContent = t('profileTitle');
    const profileTabTitleProfile = document.getElementById('profileTabTitleProfile');
    if (profileTabTitleProfile) profileTabTitleProfile.textContent = t('profileTabLabel');
    const profileTabTitleReferrals = document.getElementById('profileTabTitleReferrals');
    if (profileTabTitleReferrals) profileTabTitleReferrals.textContent = t('referralsTabLabel');
    const profileTabTitleAdmin = document.getElementById('profileTabTitleAdmin');
    if (profileTabTitleAdmin) profileTabTitleAdmin.textContent = t('adminTabLabel') || 'Админ';
    const profileTabBtnAdmin = document.getElementById('profileTabBtnAdmin');
    if (profileTabBtnAdmin) {
      profileTabBtnAdmin.title = t('adminTabLabel') || 'Панель Администратора';
      profileTabBtnAdmin.setAttribute('aria-label', t('adminTabLabel') || 'Панель Администратора');
    }
    if (langSectionTitle) langSectionTitle.textContent = t('langSectionTitle');
    if (restartBtnLabel) restartBtnLabel.textContent = t('restartBtn');
    if (undoBtnLabel) undoBtnLabel.textContent = t('undoBtn');
    if (hintBtnLabel) hintBtnLabel.textContent = t('hintBtn');
    if (revealBtnLabel) revealBtnLabel.textContent = t('revealBtn');
    if (extraBottleBtnLabel) extraBottleBtnLabel.textContent = t('extraBottleBtn');
    if (adBonusBtnLabel) adBonusBtnLabel.textContent = t('adBonusBtn');

    // Header Tooltips & Aria Labels
    const userProfileBtn = document.getElementById('userProfileBtn');
    if (userProfileBtn) {
      userProfileBtn.title = t('profileTitle');
      userProfileBtn.setAttribute('aria-label', t('profileTitle'));
    }
    const walletBtn = document.getElementById('walletBtn');
    if (walletBtn) {
      walletBtn.title = t('walletBtnTitle');
      walletBtn.setAttribute('aria-label', t('walletBtnTitle'));
    }
    const shopBtn = document.getElementById('shopBtn');
    if (shopBtn) {
      shopBtn.title = t('shopBtnTitle');
      shopBtn.setAttribute('aria-label', t('shopBtnTitle'));
    }
    const leaderboardBtn = document.getElementById('leaderboardBtn');
    if (leaderboardBtn) leaderboardBtn.title = t('leaderboardTitle');
    const soundToggleBtn = document.getElementById('soundToggleBtn');
    if (soundToggleBtn) soundToggleBtn.title = t('soundBtnTitle');

    // Close Buttons Tooltips
    const closeShopModalBtn = document.getElementById('closeShopModalBtn');
    if (closeShopModalBtn) closeShopModalBtn.title = t('closeBtn');
    const closeTonModalBtn = document.getElementById('closeTonModalBtn');
    if (closeTonModalBtn) closeTonModalBtn.title = t('closeBtn');
    const closeProfileModalBtn = document.getElementById('closeProfileModalBtn');
    if (closeProfileModalBtn) closeProfileModalBtn.title = t('closeBtn');
    const closeAdModalBtn = document.getElementById('closeAdModalBtn');
    if (closeAdModalBtn) closeAdModalBtn.title = t('closeBtn');
    const adVideoCloseBtn = document.getElementById('adVideoCloseBtn');
    if (adVideoCloseBtn) adVideoCloseBtn.title = t('closeBtn');
    const closeLeaderboardBtn = document.getElementById('closeLeaderboardBtn');
    if (closeLeaderboardBtn) closeLeaderboardBtn.title = t('closeBtn');
    const closeGiftQtyModalBtn = document.getElementById('closeGiftQtyModalBtn');
    if (closeGiftQtyModalBtn) closeGiftQtyModalBtn.title = t('closeBtn');
    const refreshLeaderboardBtn = document.getElementById('refreshLeaderboardBtn');
    if (refreshLeaderboardBtn) refreshLeaderboardBtn.title = t('refreshLeaderboardTitle');

    // TON Wallet Modal
    const tonModalTitle = document.getElementById('tonModalTitle');
    if (tonModalTitle) tonModalTitle.textContent = t('tonModalTitle');
    const tonModalSubtitle = document.getElementById('tonModalSubtitle');
    if (tonModalSubtitle) tonModalSubtitle.textContent = t('tonModalSubtitle');
    const tonBalanceSub = document.getElementById('tonBalanceSub');
    if (tonBalanceSub) tonBalanceSub.textContent = t('tonBalanceSub');
    const tonWalletStatusSub = document.getElementById('tonWalletStatusSub');
    if (tonWalletStatusSub) tonWalletStatusSub.textContent = t('tonWalletStatusSub');
    const tonConnectHeading = document.getElementById('tonConnectHeading');
    if (tonConnectHeading) tonConnectHeading.textContent = t('tonConnectHeading') || t('tonModalTitle');
    if (tonDisconnectBtnLabel) tonDisconnectBtnLabel.textContent = t('tonDisconnectBtnLabel');
    if (disconnectWalletModalTitle) disconnectWalletModalTitle.textContent = t('disconnectWalletModalTitle');
    if (disconnectWalletModalDesc) disconnectWalletModalDesc.textContent = t('disconnectWalletModalDesc');
    if (disconnectWalletModalNote) disconnectWalletModalNote.textContent = t('disconnectWalletModalNote');
    if (cancelDisconnectWalletBtn) cancelDisconnectWalletBtn.textContent = t('disconnectWalletCancelBtn');
    if (confirmDisconnectWalletBtn) confirmDisconnectWalletBtn.textContent = t('disconnectWalletConfirmBtn');
    const tonAmountTitle = document.getElementById('tonAmountTitle');
    if (tonAmountTitle) tonAmountTitle.textContent = t('tonAmountTitle');
    const tonRewardLabel = document.getElementById('tonRewardLabel');
    if (tonRewardLabel) tonRewardLabel.textContent = t('tonRewardLabel');
    const tonChoiceHeading = document.getElementById('tonChoiceHeading');
    if (tonChoiceHeading) tonChoiceHeading.textContent = t('tonChoiceHeader');
    const tonSpaceSub = document.getElementById('tonSpaceSub');
    if (tonSpaceSub) tonSpaceSub.textContent = t('tonSpaceSub');
    const tonWalletSub = document.getElementById('tonWalletSub');
    if (tonWalletSub) tonWalletSub.textContent = t('tonWalletSub');
    const tonInstHeading = document.getElementById('tonInstHeading');
    if (tonInstHeading) tonInstHeading.textContent = t('tonInstTitle');
    const tonInstStep1 = document.getElementById('tonInstStep1');
    if (tonInstStep1) tonInstStep1.innerHTML = t('tonInstStep1');
    const tonInstStep2 = document.getElementById('tonInstStep2');
    if (tonInstStep2) tonInstStep2.innerHTML = t('tonInstStep2');
    const tonAddrSub = document.getElementById('tonAddrSub');
    if (tonAddrSub) tonAddrSub.textContent = t('tonAddrSub');
    const tonCopyAddrLabel = document.getElementById('tonCopyAddrLabel');
    if (tonCopyAddrLabel) tonCopyAddrLabel.textContent = t('tonCopyLabel');
    const tonCopyMemoBtn = document.getElementById('tonCopyMemoBtn');
    if (tonCopyMemoBtn) tonCopyMemoBtn.title = t('tonCopyMemoTitle');
    const tonVerifyBtnLabel = document.getElementById('tonVerifyBtnLabel');
    if (tonVerifyBtnLabel) tonVerifyBtnLabel.textContent = t('tonVerifyBtn');
    const tonStepMinusBtn = document.getElementById('tonStepMinusBtn');
    if (tonStepMinusBtn) tonStepMinusBtn.setAttribute('aria-label', t('tonStepMinus'));
    const tonStepPlusBtn = document.getElementById('tonStepPlusBtn');
    if (tonStepPlusBtn) tonStepPlusBtn.setAttribute('aria-label', t('tonStepPlus'));

    // Shop Modal
    const shopModalTitle = document.getElementById('shopModalTitle');
    if (shopModalTitle) shopModalTitle.textContent = t('shopModalTitle');
    const shopModalSubtitle = document.getElementById('shopModalSubtitle');
    if (shopModalSubtitle) shopModalSubtitle.textContent = t('shopModalSubtitle');
    const shopBalanceSub = document.getElementById('shopBalanceSub');
    if (shopBalanceSub) shopBalanceSub.textContent = t('shopBalanceSub');
    const shopTopUpBtnLabel = document.getElementById('shopTopUpBtnLabel');
    if (shopTopUpBtnLabel) shopTopUpBtnLabel.textContent = t('shopTopUpBtn');
    const shopActivePerkTitle = document.getElementById('shopActivePerkTitle');
    if (shopActivePerkTitle) shopActivePerkTitle.textContent = t('shopActiveTitle');
    const shopFeaturedRibbon = document.getElementById('shopFeaturedRibbon');
    if (shopFeaturedRibbon) shopFeaturedRibbon.textContent = t('shopFeaturedRibbon');
    const shopItemFeaturedTitle = document.getElementById('shopItemFeaturedTitle');
    if (shopItemFeaturedTitle) shopItemFeaturedTitle.textContent = t('shopFeaturedTitle');
    const shopFeaturedDurationTag = document.getElementById('shopFeaturedDurationTag');
    if (shopFeaturedDurationTag) shopFeaturedDurationTag.textContent = t('shopDurationTag');
    const shopFeaturedDesc = document.getElementById('shopFeaturedDesc');
    if (shopFeaturedDesc) shopFeaturedDesc.textContent = t('shopFeaturedDesc');
    const shopFeaturedPriceLabel = document.getElementById('shopFeaturedPriceLabel');
    if (shopFeaturedPriceLabel) shopFeaturedPriceLabel.textContent = t('shopPriceLabel');
    const shopSectionDividerText = document.getElementById('shopSectionDividerText');
    if (shopSectionDividerText) shopSectionDividerText.textContent = t('shopSectionDivider');
    const dailyBoostersTitle = document.getElementById('dailyBoostersTitle');
    if (dailyBoostersTitle) dailyBoostersTitle.textContent = t('dailyBoostersTitle');
    const dailyBoostersDesc = document.getElementById('dailyBoostersDesc');
    if (dailyBoostersDesc) dailyBoostersDesc.textContent = t('dailyBoostersDesc');
    const dailyBoostersTag = document.getElementById('dailyBoostersTag');
    if (dailyBoostersTag) dailyBoostersTag.textContent = t('dailyBoostersTag');
    const dailyBoostersCounterLabel = document.getElementById('dailyBoostersCounterLabel');
    if (dailyBoostersCounterLabel) dailyBoostersCounterLabel.textContent = t('dailyBoostersCounterLabel');
    const dailyBoostersNextLabel = document.getElementById('dailyBoostersNextLabel');
    if (dailyBoostersNextLabel) dailyBoostersNextLabel.textContent = t('dailyBoostersNextLabel') || '⏰ Следующее начисление:';
    const shopBottlesTitle = document.getElementById('shopBottlesTitle');
    if (shopBottlesTitle) shopBottlesTitle.textContent = t('shopBottlesTitle');
    const shopBottlesDesc = document.getElementById('shopBottlesDesc');
    if (shopBottlesDesc) shopBottlesDesc.textContent = t('shopBottlesDesc');
    const shopHintsTitle = document.getElementById('shopHintsTitle');
    if (shopHintsTitle) shopHintsTitle.textContent = t('shopHintsTitle');
    const shopHintsDesc = document.getElementById('shopHintsDesc');
    if (shopHintsDesc) shopHintsDesc.textContent = t('shopHintsDesc');
    const shopUndosTitle = document.getElementById('shopUndosTitle');
    if (shopUndosTitle) shopUndosTitle.textContent = t('shopUndosTitle');
    const shopUndosDesc = document.getElementById('shopUndosDesc');
    if (shopUndosDesc) shopUndosDesc.textContent = t('shopUndosDesc');
    const shopRevealsTitle = document.getElementById('shopRevealsTitle');
    if (shopRevealsTitle) shopRevealsTitle.textContent = t('shopRevealsTitle');
    const shopRevealsDesc = document.getElementById('shopRevealsDesc');
    if (shopRevealsDesc) shopRevealsDesc.textContent = t('shopRevealsDesc');

    document.querySelectorAll('.shop-item-card:not(.shop-item-featured) .shop-buy-btn span').forEach(el => {
      el.textContent = t('shopBuyGram', 1);
    });

    // Profile Modal
    const profileCardLevel = document.getElementById('profileCardLevel');
    if (profileCardLevel && typeof currentUser !== 'undefined') {
      profileCardLevel.textContent = t('levelDisplayVal', Number(currentUser.maxLevel || 0));
    }
    const profileAdminBadge = document.getElementById('profileAdminBadge');
    if (profileAdminBadge) profileAdminBadge.title = t('adminBadge');

    // Telegram Channel Section (Cyber Farm & Color Sort)
    const tgTitles = document.querySelectorAll('.tg-channel-title-i18n');
    tgTitles.forEach(el => { el.textContent = t('tgChannelTitle') || 'Telegram–канал'; });
    const tgChannelTitle = document.getElementById('tgChannelTitle');
    if (tgChannelTitle) tgChannelTitle.textContent = t('tgChannelTitle') || 'Telegram–канал';

    const tgBadgeCyberFarm = document.getElementById('tgBadgeCyberFarm');
    if (tgBadgeCyberFarm) tgBadgeCyberFarm.textContent = (t('officialBadge') || 'ОФИЦИАЛЬНЫЙ').toUpperCase();

    const tgChannelBadge = document.getElementById('tgChannelBadge');
    if (tgChannelBadge) tgChannelBadge.textContent = (t('ourProject') || 'НАШ ПРОЕКТ').toUpperCase();

    const tgJoinTexts = document.querySelectorAll('.tg-channel-join-text');
    tgJoinTexts.forEach(el => { el.textContent = t('tgChannelJoinBtn') || 'Перейти в канал'; });
    const telegramChannelJoinBtnText = document.getElementById('telegramChannelJoinBtnText');
    if (telegramChannelJoinBtnText) telegramChannelJoinBtnText.textContent = t('tgChannelJoinBtn') || 'Перейти в канал';

    // Referral Section
    const referralSectionTitleEl = document.getElementById('referralSectionTitle');
    if (referralSectionTitleEl) referralSectionTitleEl.textContent = t('referralSectionTitle');
    const referralSectionSubEl = document.getElementById('referralSectionSub');
    if (referralSectionSubEl) referralSectionSubEl.textContent = t('referralSectionSub');
    const referralUnitLabel = document.getElementById('referralUnitLabel');
    if (referralUnitLabel) referralUnitLabel.textContent = t('refUnitLabel');
    const shareReferralTelegramBtn = document.getElementById('shareReferralTelegramBtn');
    if (shareReferralTelegramBtn) {
      const span = shareReferralTelegramBtn.querySelector('span');
      if (span) span.textContent = t('shareReferralTelegramBtn');
    }
    const copyReferralBtnText = document.getElementById('copyReferralBtnText');
    if (copyReferralBtnText) copyReferralBtnText.textContent = t('copyReferralLinkBtn');
    const copyReferralLinkBtn = document.getElementById('copyReferralLinkBtn');
    if (copyReferralLinkBtn) copyReferralLinkBtn.title = t('copyReferralLinkBtn');
    const referralClaimTitle = document.getElementById('referralClaimTitle');
    if (referralClaimTitle) referralClaimTitle.textContent = t('referralClaimTitle');
    const referralClaimSubtitle = document.getElementById('referralClaimSubtitle');
    if (referralClaimSubtitle) referralClaimSubtitle.textContent = t('refClaimSubtitle');
    const claimAllReferralsBtn = document.getElementById('claimAllReferralsBtn');
    if (claimAllReferralsBtn) claimAllReferralsBtn.textContent = t('claimAllReferralsBtn');
    const referralsListHeader = document.getElementById('referralsListHeader');
    if (referralsListHeader) referralsListHeader.textContent = t('referralsListHeader');
    const referralsEmptyText = document.getElementById('referralsEmptyText');
    if (referralsEmptyText) referralsEmptyText.textContent = t('refEmptyText');

    // Admin Panel
    const adminPanelTitle = document.getElementById('adminPanelTitle');
    if (adminPanelTitle) adminPanelTitle.textContent = t('adminPanelTitle');
    const adminPanelSub = document.getElementById('adminPanelSub');
    if (adminPanelSub) adminPanelSub.textContent = t('adminPanelSub');
    const adminBoostersTitle = document.getElementById('adminBoostersTitle');
    if (adminBoostersTitle) adminBoostersTitle.textContent = t('adminBoostersTitle');
    const adminAddBottleLabel = document.getElementById('adminAddBottleLabel');
    if (adminAddBottleLabel) adminAddBottleLabel.textContent = t('adminAddBottle');
    const adminAddHintsLabel = document.getElementById('adminAddHintsLabel');
    if (adminAddHintsLabel) adminAddHintsLabel.textContent = t('adminAddHints');
    const adminAddUndosLabel = document.getElementById('adminAddUndosLabel');
    if (adminAddUndosLabel) adminAddUndosLabel.textContent = t('adminAddUndos');
    const adminAddRevealsLabel = document.getElementById('adminAddRevealsLabel');
    if (adminAddRevealsLabel) adminAddRevealsLabel.textContent = t('adminAddReveals');
    const adminAddCoinsLabel = document.getElementById('adminAddCoinsLabel');
    if (adminAddCoinsLabel) adminAddCoinsLabel.textContent = t('adminAddCoins');
    const adminAddLevelsLabel = document.getElementById('adminAddLevelsLabel');
    if (adminAddLevelsLabel) adminAddLevelsLabel.textContent = t('adminAddLevels');
    const adminAddAllLabel = document.getElementById('adminAddAllLabel');
    if (adminAddAllLabel) adminAddAllLabel.textContent = t('adminAddAll');
    if (adminSetExactLevelTitle) adminSetExactLevelTitle.textContent = t('adminSetExactLevelTitle');
    if (adminSetExactLevelBtnLabel) adminSetExactLevelBtnLabel.textContent = t('adminSetExactLevelBtnLabel');
    const adminPurchasesHeader = document.getElementById('adminPurchasesHeader');
    if (adminPurchasesHeader) adminPurchasesHeader.textContent = t('adminPurchasesHeader');
    const adminResetPurchasesDesc = document.getElementById('adminResetPurchasesDesc');
    if (adminResetPurchasesDesc) adminResetPurchasesDesc.textContent = t('adminResetPurchasesDesc');
    const adminResetSelfPurchasesBtnLabel = document.getElementById('adminResetSelfPurchasesBtnLabel');
    if (adminResetSelfPurchasesBtnLabel) adminResetSelfPurchasesBtnLabel.textContent = t('adminResetSelfPurchasesBtn');
    const adminResetPurchasesBtnLabel = document.getElementById('adminResetPurchasesBtnLabel');
    if (adminResetPurchasesBtnLabel) adminResetPurchasesBtnLabel.textContent = t('adminResetPurchasesBtnLabel');
    const adminResetSeasonDesc = document.getElementById('adminResetSeasonDesc');
    if (adminResetSeasonDesc) adminResetSeasonDesc.textContent = t('adminResetSeasonDesc');
    const adminResetSeasonBtnLabel = document.getElementById('adminResetSeasonBtnLabel');
    if (adminResetSeasonBtnLabel) adminResetSeasonBtnLabel.textContent = t('adminResetSeasonBtnLabel');

    // Reset Purchases Modal
    const resetPurchasesModalTitle = document.getElementById('resetPurchasesModalTitle');
    if (resetPurchasesModalTitle) resetPurchasesModalTitle.textContent = t('resetPurchasesModalTitle');
    const resetPurchasesLead = document.getElementById('resetPurchasesLead');
    if (resetPurchasesLead) resetPurchasesLead.textContent = t('resetPurchasesWarningLead');
    const resetPurchasesItem1 = document.getElementById('resetPurchasesItem1');
    if (resetPurchasesItem1) resetPurchasesItem1.textContent = t('resetPurchasesItem1');
    const resetPurchasesItem2 = document.getElementById('resetPurchasesItem2');
    if (resetPurchasesItem2) resetPurchasesItem2.textContent = t('resetPurchasesItem2');
    const resetPurchasesItem3 = document.getElementById('resetPurchasesItem3');
    if (resetPurchasesItem3) resetPurchasesItem3.textContent = t('resetPurchasesItem3');
    const cancelResetPurchasesBtn = document.getElementById('cancelResetPurchasesBtn');
    if (cancelResetPurchasesBtn) cancelResetPurchasesBtn.textContent = t('cancelBtn');
    const confirmResetPurchasesBtn = document.getElementById('confirmResetPurchasesBtn');
    if (confirmResetPurchasesBtn) confirmResetPurchasesBtn.textContent = t('confirmResetPurchasesBtnLabel');

    // Reset Season Modal
    const resetModalTitle = document.getElementById('resetModalTitle');
    if (resetModalTitle) resetModalTitle.textContent = t('resetSeasonModalTitle');
    const resetSeasonLead = document.getElementById('resetSeasonLead');
    if (resetSeasonLead) resetSeasonLead.textContent = t('resetSeasonWarningLead');
    const resetSeasonItem1 = document.getElementById('resetSeasonItem1');
    if (resetSeasonItem1) resetSeasonItem1.textContent = t('resetSeasonItem1');
    const resetSeasonItem2 = document.getElementById('resetSeasonItem2');
    if (resetSeasonItem2) resetSeasonItem2.textContent = t('resetSeasonItem2');
    const resetSeasonItem3 = document.getElementById('resetSeasonItem3');
    if (resetSeasonItem3) resetSeasonItem3.textContent = t('resetSeasonItem3');
    const resetSeasonItem4 = document.getElementById('resetSeasonItem4');
    if (resetSeasonItem4) resetSeasonItem4.textContent = t('resetSeasonItem4');
    const cancelResetSeasonBtn = document.getElementById('cancelResetSeasonBtn');
    if (cancelResetSeasonBtn) cancelResetSeasonBtn.textContent = t('cancelBtn');
    const confirmResetSeasonBtn = document.getElementById('confirmResetSeasonBtn');
    if (confirmResetSeasonBtn) confirmResetSeasonBtn.textContent = t('confirmResetSeasonBtnLabel');

    // Admin Tabs & History translations
    const adminTabActionsLabel = document.getElementById('adminTabActionsLabel');
    if (adminTabActionsLabel) adminTabActionsLabel.textContent = t('adminTabActionsLabel');
    const adminTabActionsDesc = document.getElementById('adminTabActionsDesc');
    if (adminTabActionsDesc) adminTabActionsDesc.textContent = t('adminTabActionsDesc');
    const adminTabHistoryLabel = document.getElementById('adminTabHistoryLabel');
    if (adminTabHistoryLabel) adminTabHistoryLabel.textContent = t('adminTabHistoryLabel');
    const adminTabHistoryDesc = document.getElementById('adminTabHistoryDesc');
    if (adminTabHistoryDesc) adminTabHistoryDesc.textContent = t('adminTabHistoryDesc');
    const adminHistoryTitle = document.getElementById('adminHistoryTitle');
    if (adminHistoryTitle) adminHistoryTitle.textContent = t('adminHistoryTitle');
    const adminHistorySub = document.getElementById('adminHistorySub');
    if (adminHistorySub) adminHistorySub.textContent = t('adminHistorySub');
    const adminHistoryTakeSnapshotLabel = document.getElementById('adminHistoryTakeSnapshotLabel');
    if (adminHistoryTakeSnapshotLabel) adminHistoryTakeSnapshotLabel.textContent = t('adminHistoryTakeSnapshotLabel');
    const adminHistoryListTitle = document.getElementById('adminHistoryListTitle');
    if (adminHistoryListTitle) adminHistoryListTitle.textContent = t('adminHistoryListTitle');
    const adminHistoryEmptyText = document.getElementById('adminHistoryEmptyText');
    if (adminHistoryEmptyText) adminHistoryEmptyText.textContent = t('adminHistoryEmptyText');
    const adminHistoryLoadingText = document.getElementById('adminHistoryLoadingText');
    if (adminHistoryLoadingText) adminHistoryLoadingText.textContent = t('adminHistoryLoadingText');
    const adminViewerBackBtn = document.getElementById('adminViewerBackBtn');
    if (adminViewerBackBtn) adminViewerBackBtn.textContent = t('adminViewerBackBtn');
    const adminHistoryColRank = document.getElementById('adminHistoryColRank');
    if (adminHistoryColRank) adminHistoryColRank.textContent = t('adminHistoryColRank');
    const adminHistoryColPlayer = document.getElementById('adminHistoryColPlayer');
    if (adminHistoryColPlayer) adminHistoryColPlayer.textContent = t('adminHistoryColPlayer');
    const adminHistoryColTid = document.getElementById('adminHistoryColTid');
    if (adminHistoryColTid) adminHistoryColTid.textContent = t('adminHistoryColTid');
    const adminHistoryColLevel = document.getElementById('adminHistoryColLevel');
    if (adminHistoryColLevel) adminHistoryColLevel.textContent = t('adminHistoryColLevel');
    const adminHistorySearchInput = document.getElementById('adminHistorySearchInput');
    if (adminHistorySearchInput) adminHistorySearchInput.placeholder = t('adminHistorySearchPlaceholder');
    const deleteSnapshotModalTitle = document.getElementById('deleteSnapshotModalTitle');
    if (deleteSnapshotModalTitle) deleteSnapshotModalTitle.textContent = t('deleteSnapshotModalTitle');
    const deleteSnapshotLead = document.getElementById('deleteSnapshotLead');
    if (deleteSnapshotLead) deleteSnapshotLead.textContent = t('deleteSnapshotLead');

    // Admin Wallets Tab
    const adminTabWalletsLabel = document.getElementById('adminTabWalletsLabel');
    if (adminTabWalletsLabel) adminTabWalletsLabel.textContent = t('adminTabWalletsLabel');
    const adminTabWalletsDesc = document.getElementById('adminTabWalletsDesc');
    if (adminTabWalletsDesc) adminTabWalletsDesc.textContent = t('adminTabWalletsDesc');
    const adminWalletsTitle = document.getElementById('adminWalletsTitle');
    if (adminWalletsTitle) adminWalletsTitle.textContent = t('adminWalletsTitle');
    const adminWalletsSub = document.getElementById('adminWalletsSub');
    if (adminWalletsSub) adminWalletsSub.textContent = t('adminWalletsSub');
    const adminWalletsLoadingText = document.getElementById('adminWalletsLoadingText');
    if (adminWalletsLoadingText) adminWalletsLoadingText.textContent = t('adminWalletsLoadingText');
    const adminWalletsEmptyText = document.getElementById('adminWalletsEmptyText');
    if (adminWalletsEmptyText) adminWalletsEmptyText.textContent = t('adminWalletsEmptyText');
    const adminWalletsSearchInput = document.getElementById('adminWalletsSearchInput');
    if (adminWalletsSearchInput) adminWalletsSearchInput.placeholder = t('adminWalletsSearchPlaceholder');
    const adminWalletDetailsModalTitle = document.getElementById('adminWalletDetailsModalTitle');
    if (adminWalletDetailsModalTitle) adminWalletDetailsModalTitle.textContent = t('adminWalletDetailsTitle');
    const adminWalletDetailsBackBtn = document.getElementById('adminWalletDetailsBackBtn');
    if (adminWalletDetailsBackBtn) adminWalletDetailsBackBtn.textContent = t('adminWalletBackBtn');

    // Admin News Tab
    const adminTabNewsLabel = document.getElementById('adminTabNewsLabel');
    if (adminTabNewsLabel) adminTabNewsLabel.textContent = t('adminTabNewsLabel');
    const adminTabNewsDesc = document.getElementById('adminTabNewsDesc');
    if (adminTabNewsDesc) adminTabNewsDesc.textContent = t('adminTabNewsDesc');
    const adminNewsHeaderTitle = document.getElementById('adminNewsHeaderTitle');
    if (adminNewsHeaderTitle) adminNewsHeaderTitle.textContent = t('adminNewsHeaderTitle');
    const adminNewsHeaderSub = document.getElementById('adminNewsHeaderSub');
    if (adminNewsHeaderSub) adminNewsHeaderSub.textContent = t('adminNewsHeaderSub');
    const adminNewsAudienceLabel = document.getElementById('adminNewsAudienceLabel');
    if (adminNewsAudienceLabel) adminNewsAudienceLabel.textContent = t('adminNewsAudienceLabel');
    const adminNewsTimeLabel = document.getElementById('adminNewsTimeLabel');
    if (adminNewsTimeLabel) adminNewsTimeLabel.textContent = t('adminNewsTimeLabel');
    const adminNewsTitleLabel = document.getElementById('adminNewsTitleLabel');
    if (adminNewsTitleLabel) adminNewsTitleLabel.textContent = t('adminNewsTitleLabel');
    const adminNewsMessageLabel = document.getElementById('adminNewsMessageLabel');
    if (adminNewsMessageLabel) adminNewsMessageLabel.textContent = t('adminNewsMessageLabel');
    const adminNewsImageLabel = document.getElementById('adminNewsImageLabel');
    if (adminNewsImageLabel) adminNewsImageLabel.textContent = t('adminNewsImageLabel');
    const adminNewsUploadFileLabel = document.getElementById('adminNewsUploadFileLabel');
    if (adminNewsUploadFileLabel) adminNewsUploadFileLabel.textContent = t('adminNewsUploadFileLabel');
    const adminNewsButtonLabel = document.getElementById('adminNewsButtonLabel');
    if (adminNewsButtonLabel) adminNewsButtonLabel.textContent = t('adminNewsButtonLabel');
    const adminNewsTestSendLabel = document.getElementById('adminNewsTestSendLabel');
    if (adminNewsTestSendLabel) adminNewsTestSendLabel.textContent = t('adminNewsTestSendLabel');
    const adminNewsBroadcastLabel = document.getElementById('adminNewsBroadcastLabel');
    if (adminNewsBroadcastLabel) adminNewsBroadcastLabel.textContent = t('adminNewsBroadcastLabel');
    const adminNewsHistoryTitle = document.getElementById('adminNewsHistoryTitle');
    if (adminNewsHistoryTitle) adminNewsHistoryTitle.textContent = t('adminNewsHistoryTitle');
    const adminNewsLoadingText = document.getElementById('adminNewsLoadingText');
    if (adminNewsLoadingText) adminNewsLoadingText.textContent = t('adminNewsLoadingText');
    const adminNewsEmptyText = document.getElementById('adminNewsEmptyText');
    if (adminNewsEmptyText) adminNewsEmptyText.textContent = t('adminNewsEmptyText');

    // Admin Code Checkpoints Tab
    const adminTabCodeBackupLabel = document.getElementById('adminTabCodeBackupLabel');
    if (adminTabCodeBackupLabel) adminTabCodeBackupLabel.textContent = t('adminTabCodeBackupLabel');
    const adminTabCodeBackupDesc = document.getElementById('adminTabCodeBackupDesc');
    if (adminTabCodeBackupDesc) adminTabCodeBackupDesc.textContent = t('adminTabCodeBackupDesc');
    const adminCodeBackupEmptyText = document.getElementById('adminCodeBackupEmptyState');
    if (adminCodeBackupEmptyText && adminCodeBackupEmptyText.querySelector('span:last-child')) {
      adminCodeBackupEmptyText.querySelector('span:last-child').textContent = t('adminCodeBackupEmptyText');
    }
    const adminCodeBackupLoadingText = document.getElementById('adminCodeBackupLoadingSpinner');
    if (adminCodeBackupLoadingText && adminCodeBackupLoadingText.querySelector('span')) {
      adminCodeBackupLoadingText.querySelector('span').textContent = t('adminCodeBackupLoadingText');
    }
    const adminSaveCurrentVersionBtnText = document.getElementById('adminSaveCurrentVersionBtnText');
    if (adminSaveCurrentVersionBtnText) adminSaveCurrentVersionBtnText.textContent = t('adminSaveCurrentVersionBtn') || 'Сохранить текущую версию';
    const adminSaveVersionActionTitle = document.getElementById('adminSaveVersionActionTitle');
    if (adminSaveVersionActionTitle) adminSaveVersionActionTitle.textContent = t('adminSaveVersionActionTitle') || 'Фиксация рабочей версии кода';
    const adminSaveVersionActionSub = document.getElementById('adminSaveVersionActionSub');
    if (adminSaveVersionActionSub) adminSaveVersionActionSub.textContent = t('adminSaveVersionActionSub') || 'Сохранить текущее состояние игры в контрольные точки';

    // Admin Maintenance Tab
    const adminTabMaintenanceLabel = document.getElementById('adminTabMaintenanceLabel');
    if (adminTabMaintenanceLabel) adminTabMaintenanceLabel.textContent = t('adminTabMaintenanceLabel');
    const adminTabMaintenanceDesc = document.getElementById('adminTabMaintenanceDesc');
    if (adminTabMaintenanceDesc) adminTabMaintenanceDesc.textContent = t('adminTabMaintenanceDesc');
    const adminMaintenanceHeaderTitle = document.getElementById('adminMaintenanceHeaderTitle');
    if (adminMaintenanceHeaderTitle) adminMaintenanceHeaderTitle.textContent = t('adminMaintenanceHeaderTitle');
    const adminMaintenanceHeaderSub = document.getElementById('adminMaintenanceHeaderSub');
    if (adminMaintenanceHeaderSub) adminMaintenanceHeaderSub.textContent = t('adminMaintenanceHeaderSub');
    const adminMaintenanceStatusLabel = document.getElementById('adminMaintenanceStatusLabel');
    if (adminMaintenanceStatusLabel) adminMaintenanceStatusLabel.textContent = t('adminMaintenanceStatusLabel');
    const adminMaintenancePreviewBtnLabel = document.getElementById('adminMaintenancePreviewBtnLabel');
    if (adminMaintenancePreviewBtnLabel) adminMaintenancePreviewBtnLabel.textContent = t('adminMaintenancePreviewBtnLabel');
    const adminMaintenanceMessageInputLabel = document.getElementById('adminMaintenanceMessageInputLabel');
    if (adminMaintenanceMessageInputLabel) adminMaintenanceMessageInputLabel.textContent = t('adminMaintenanceMessageInputLabel');
    const adminMaintenanceResetMsgLabel = document.getElementById('adminMaintenanceResetMsgLabel');
    if (adminMaintenanceResetMsgLabel) adminMaintenanceResetMsgLabel.textContent = t('adminMaintenanceResetMsgLabel');
    const adminMaintenanceSaveMsgLabel = document.getElementById('adminMaintenanceSaveMsgLabel');
    if (adminMaintenanceSaveMsgLabel) adminMaintenanceSaveMsgLabel.textContent = t('adminMaintenanceSaveMsgLabel');

    // Leaderboard
    const leaderboardModalTitle = document.getElementById('leaderboardModalTitle');
    if (leaderboardModalTitle) leaderboardModalTitle.textContent = t('leaderboardTitle');
    const leaderboardLiveBadge = document.getElementById('leaderboardLiveBadge');
    if (leaderboardLiveBadge) leaderboardLiveBadge.textContent = t('leaderboardLive');
    const modalUserName = document.getElementById('modalUserName');
    if (modalUserName && typeof currentUser !== 'undefined') {
      modalUserName.textContent = `${currentUser.firstName || t('defaultPlayerName')} ${t('youTag')}`;
    }
    const modalUserLevel = document.getElementById('modalUserLevel');
    if (modalUserLevel && typeof currentUser !== 'undefined') {
      const displayLvl = Number(currentUser.maxLevel || 0);
      modalUserLevel.textContent = t('levelDisplayVal', displayLvl);
    }

    // Win Modal
    const winModalTitle = document.getElementById('winModalTitle');
    if (winModalTitle && typeof currentUser !== 'undefined') {
      winModalTitle.textContent = t('winTitle', currentUser.currentLevel || 1);
    }
    const winModalSubtext = document.getElementById('winModalSubtext');
    if (winModalSubtext && typeof currentUser !== 'undefined') {
      winModalSubtext.textContent = t('winSubtext', (currentUser.currentLevel || 1) + 1);
    }
    const nextLevelBtn = document.getElementById('nextLevelBtn');
    if (nextLevelBtn) nextLevelBtn.textContent = t('nextLevelBtn');

    // Restart Modal
    const restartModalTitle = document.getElementById('restartModalTitle');
    if (restartModalTitle) restartModalTitle.textContent = t('restartTitle');
    const restartModalDesc = document.getElementById('restartModalDesc');
    if (restartModalDesc) restartModalDesc.textContent = t('restartDesc');
    const cancelRestartBtn = document.getElementById('cancelRestartBtn');
    if (cancelRestartBtn) cancelRestartBtn.textContent = t('cancelBtn');
    const confirmRestartBtn = document.getElementById('confirmRestartBtn');
    if (confirmRestartBtn) confirmRestartBtn.textContent = t('confirmRestartBtn');

    // Security Alert Modal
    const secTitle = document.getElementById('securityAlertTitle');
    if (secTitle) secTitle.textContent = t('securityAlertTitle');
    const secSubtitle = document.getElementById('securityAlertSubtitle');
    if (secSubtitle) secSubtitle.textContent = t('securityAlertSubtitle');
    const secBtn = document.getElementById('securityAlertRestartBtn');
    if (secBtn && typeof currentUser !== 'undefined') {
      const curLvl = Number(currentUser.currentLevel || 1);
      secBtn.textContent = typeof t('securityAlertRestartBtn') === 'function'
        ? t('securityAlertRestartBtn')(curLvl)
        : `${t('securityAlertRestartBtn')} ${curLvl}`;
    }

    // Server Reload Kick Modal
    const srTitle = document.getElementById('serverReloadTitle');
    if (srTitle) srTitle.textContent = t('serverReloadTitle');
    const srDesc = document.getElementById('serverReloadDesc');
    if (srDesc) srDesc.innerHTML = t('serverReloadDesc');
    const srTimerLabel = document.getElementById('serverReloadTimerLabel');
    if (srTimerLabel) srTimerLabel.textContent = t('serverReloadTimerLabel');
    const srOkBtn = document.getElementById('serverReloadOkBtn');
    if (srOkBtn) srOkBtn.textContent = t('serverReloadBtn');

    // Ad Bonus Modal
    const adModalTitle = document.getElementById('adModalTitle');
    const adModalDesc = document.getElementById('adModalDesc');
    const adModalGiftsPane = document.getElementById('adModalGiftsContent');
    if (adModalGiftsPane && !adModalGiftsPane.classList.contains('hidden')) {
      if (adModalTitle) adModalTitle.textContent = t('adTabGiftsHeader');
      if (adModalDesc) adModalDesc.textContent = t('adTabGiftsDesc');
    } else {
      if (adModalTitle) adModalTitle.textContent = t('adModalTitle');
      if (adModalDesc) adModalDesc.textContent = t('adModalDesc');
    }
    const adModalBottleTitle = document.getElementById('adModalBottleTitle');
    if (adModalBottleTitle) adModalBottleTitle.textContent = t('adModalBottleTitle');
    const adModalBottleDesc = document.getElementById('adModalBottleDesc');
    if (adModalBottleDesc) {
      const countSpan = document.getElementById('adModalExtraBottlesCount');
      const countHtml = countSpan ? countSpan.outerHTML : '<span class="ad-user-count" id="adModalExtraBottlesCount"></span>';
      adModalBottleDesc.innerHTML = `${t('adModalBottleDesc')} ${countHtml}`;
    }
    const adModalHintsTitle = document.getElementById('adModalHintsTitle');
    if (adModalHintsTitle) adModalHintsTitle.textContent = t('adModalHintsTitle');
    const adModalHintsDesc = document.getElementById('adModalHintsDesc');
    if (adModalHintsDesc) {
      const countSpan = document.getElementById('adModalHintsCount');
      const countHtml = countSpan ? countSpan.outerHTML : '<span class="ad-user-count" id="adModalHintsCount"></span>';
      adModalHintsDesc.innerHTML = `${t('adModalHintsDesc')} ${countHtml}`;
    }
    const adModalUndosTitle = document.getElementById('adModalUndosTitle');
    if (adModalUndosTitle) adModalUndosTitle.textContent = t('adModalUndosTitle');
    const adModalUndosDesc = document.getElementById('adModalUndosDesc');
    if (adModalUndosDesc) {
      const countSpan = document.getElementById('adModalUndosCount');
      const countHtml = countSpan ? countSpan.outerHTML : '<span class="ad-user-count" id="adModalUndosCount"></span>';
      adModalUndosDesc.innerHTML = `${t('adModalUndosDesc')} ${countHtml}`;
    }
    const adModalRevealTitle = document.getElementById('adModalRevealTitle');
    if (adModalRevealTitle) adModalRevealTitle.textContent = t('adModalRevealTitle');
    const adModalRevealDesc = document.getElementById('adModalRevealDesc');
    if (adModalRevealDesc) {
      const countSpan = document.getElementById('adModalRevealsCount');
      const countHtml = countSpan ? countSpan.outerHTML : '<span class="ad-user-count" id="adModalRevealsCount"></span>';
      adModalRevealDesc.innerHTML = `${t('adModalRevealDesc')} ${countHtml}`;
    }

    document.querySelectorAll('#adModal .claim-ad-btn').forEach(btn => {
      if (!btn.disabled && !btn.textContent.includes('⏳') && !btn.textContent.includes('✅')) {
        btn.textContent = t('claimAdBtn');
      }
    });

    // Info Modal
    const infoModalTitle = document.getElementById('infoModalTitle');
    if (infoModalTitle) infoModalTitle.textContent = t('infoModalTitle');
    const infoModalOkBtn = document.getElementById('infoModalOkBtn');
    if (infoModalOkBtn) infoModalOkBtn.textContent = t('closeBtn');

    // Rewarded Video Ad Modal
    const adVideoSponsor = document.getElementById('adVideoSponsor');
    if (adVideoSponsor) adVideoSponsor.textContent = t('adVideoSponsor');
    const adVideoSponsorTitle = document.getElementById('adVideoSponsorTitle');
    if (adVideoSponsorTitle) adVideoSponsorTitle.textContent = t('adVideoTitle');
    const adVideoSponsorDesc = document.getElementById('adVideoSponsorDesc');
    if (adVideoSponsorDesc) adVideoSponsorDesc.textContent = t('adVideoDesc');
    const adVideoCtaBtn = document.getElementById('adVideoCtaBtn');
    if (adVideoCtaBtn) adVideoCtaBtn.textContent = t('adVideoBtn');
    const adVideoStatus = document.getElementById('adVideoStatus');
    if (adVideoStatus) adVideoStatus.textContent = t('adVideoStatus');

    // Ad Modal Tabs
    const adTabAdsBtn = document.getElementById('adTabAdsBtn');
    if (adTabAdsBtn) {
      const titleSpan = adTabAdsBtn.querySelector('.ad-tab-title');
      if (titleSpan) titleSpan.textContent = t('adTabAds');
    }
    const adTabGiftsBtn = document.getElementById('adTabGiftsBtn');
    if (adTabGiftsBtn) {
      const titleSpan = adTabGiftsBtn.querySelector('.ad-tab-title');
      if (titleSpan) titleSpan.textContent = t('adTabGifts');
    }

    // Admin Quick and Collapse Buttons
    const profileAdminQuickTitle = document.getElementById('profileAdminQuickTitle');
    if (profileAdminQuickTitle) profileAdminQuickTitle.textContent = t('profileAdminQuickTitle');
    const profileAdminQuickSub = document.getElementById('profileAdminQuickSub');
    if (profileAdminQuickSub) profileAdminQuickSub.textContent = t('profileAdminQuickSub');
    const adminPanelCollapseBtn = document.getElementById('adminPanelCollapseBtn');
    if (adminPanelCollapseBtn) {
      const span = adminPanelCollapseBtn.querySelector('span:first-child');
      if (span) span.textContent = t('adminPanelCollapseBtn');
    }
    const adminPanelBottomCollapseBtn = document.getElementById('adminPanelBottomCollapseBtn');
    if (adminPanelBottomCollapseBtn) {
      const span = adminPanelBottomCollapseBtn.querySelector('span:last-child');
      if (span) span.textContent = t('adminPanelBottomCollapseBtn');
    }
    const seasonResetKickOkBtn = document.getElementById('seasonResetKickOkBtn');
    if (seasonResetKickOkBtn) seasonResetKickOkBtn.textContent = t('seasonResetKickOkBtn');

    // Notify Gifts Module about language change
    if (window.GiftsModule && typeof window.GiftsModule.setLanguage === 'function') {
      window.GiftsModule.setLanguage(lang, t);
    }
  }

  // 4. App state
  let currentUser = {
    telegramId: userData.telegramId,
    firstName: userData.firstName,
    username: userData.username || '',
    maxLevel: 0,
    currentLevel: 1,
    stars: 0,
    coins: 100,
    hints: 0,
    undos: 0,
    reveals: 0,
    extraBottles: 0,
    ton_balance: 0.0,
    ton_wallet: '',
    memo_code: '',
    all_colors_until: 0,
    all_colors_purchased_at: 0,
    daily_boosters_days_left: 0,
    daily_boosters_last_date: '',
    daily_boosters_purchased_at: 0
  };

  // Immutable verified player baselines keyed strictly by Telegram ID (permanent and unchangeable)
  const IMMUTABLE_PLAYER_BASELINES = {
  '5761685341': { maxLevel: 50, firstName: 'ALLIGATOR', username: 'ALLIGATOR0709', hints: 10, undos: 20, reveals: 5, extraBottles: 10 },
  '7458436672': { maxLevel: 47, firstName: 'Руслан', username: 'ruslan_aliyevvv' },
  '8305679959': { maxLevel: 43, firstName: '.', username: '' },
  '8982516215': { maxLevel: 42, firstName: 'Qwerty', username: 'sinisterx3' },
  '5269257903': { maxLevel: 37, firstName: 'Kostya', username: 'Koctya007' },
  '296239050':  { maxLevel: 35, firstName: 'Sergey', username: 'sergiy121234' },
  '7116446051': { maxLevel: 27, firstName: 'Марія', username: 'Maria290355' },
  '1890528535': { maxLevel: 20, firstName: 'Кирилл', username: 'Cristiano717' },
  '5177916222': { maxLevel: 18, firstName: '⚔️ Gift Kombat Діана 🍀 Anthill', username: 'Diana13031303' },
  '1803189688': { maxLevel: 16, firstName: 'Andriejus', username: 'Tigras1986' },
  '1152401670': { maxLevel: 14, firstName: 'Natta', username: 'Smaile82' },
  '615300433':  { maxLevel: 10, firstName: 'ᅠ', username: 'velzevul999' },
  '6582657380': { maxLevel: 9, firstName: 'R', username: 'Romanchiiik0' },
  '1531426251': { maxLevel: 8, firstName: 'Алексей', username: 'Element1914' },
  '387353019':  { maxLevel: 8, firstName: 'Danil', username: 'danilfrais' },
  '5403252654': { maxLevel: 8, firstName: 'ВиталийTower🏰', username: 'Tuchkovit' },
  '7990014996': { maxLevel: 4, firstName: 'Samyrai', username: 'KaLLoooS' },
  '5991713296': { maxLevel: 4, firstName: 'Юлия', username: '' },
  '8743109762': { maxLevel: 4, firstName: 'Ірина', username: 'iriskaturgan1' },
  '1471767067': { maxLevel: 3, firstName: 'Александрович', username: '' },
  '5253063837': { maxLevel: 3, firstName: '♥️НАТ♥️', username: '' },
  '5502743854': { maxLevel: 3, firstName: 'Потерял', username: '' },
  '5709982730': { maxLevel: 3, firstName: 'Алексей PIXLANDS', username: '' },
  '6573295041': { maxLevel: 3, firstName: 'Smurf 😈hiroll777.space', username: 'SmSmurf7777' },
  '5839076186': { maxLevel: 1, firstName: 'Женя', username: '' },
  '7387508554': { maxLevel: 1, firstName: 'Дмитрий', username: '' },
  '743036609':  { maxLevel: 1, firstName: '@EcoForestTonBot🌿⚒️ MinerGram@klikadobot#TotalHashСвітлана', username: 'Svet11256' }
  };

  // Instant pre-population from localStorage for immediate, zero-delay baseline
  try {
    const rawLocal = localStorage.getItem(`color_sort_user_${userData.telegramId}`);
    if (rawLocal) {
      const parsedLocal = JSON.parse(rawLocal);
      currentUser = { ...currentUser, ...parsedLocal };
      const isLocalDummy = !parsedLocal.firstName || parsedLocal.firstName === 'Игрок' || parsedLocal.firstName === 'Player' || parsedLocal.firstName === '.';
      if (userData.firstName && (isLocalDummy || (userData.firstName !== 'Игрок' && userData.firstName !== 'Player'))) {
        currentUser.firstName = userData.firstName;
      }
      if (userData.username) {
        currentUser.username = userData.username;
      }
      if (currentUser.maxLevel > 0) {
        currentUser.currentLevel = Math.max(Number(currentUser.currentLevel || 1), Number(currentUser.maxLevel));
        currentUser.level = currentUser.maxLevel;
      }
    }
  } catch (e) {}

  // Enforce Telegram ID immutable baseline protection immediately at startup
  const startupBaseline = IMMUTABLE_PLAYER_BASELINES[String(userData.telegramId)];
  if (startupBaseline) {
    if (Number(currentUser.maxLevel || 0) < startupBaseline.maxLevel) {
      currentUser.maxLevel = startupBaseline.maxLevel;
      currentUser.level = startupBaseline.maxLevel;
      currentUser.currentLevel = startupBaseline.maxLevel;
      currentUser.stars = Math.max(Number(currentUser.stars || 0), startupBaseline.stars || 0);
    }
    if (startupBaseline.hints && Number(currentUser.hints || 0) < startupBaseline.hints) {
      currentUser.hints = startupBaseline.hints;
    }
    if (startupBaseline.undos && Number(currentUser.undos || 0) < startupBaseline.undos) {
      currentUser.undos = startupBaseline.undos;
    }
    if (startupBaseline.reveals && Number(currentUser.reveals || 0) < startupBaseline.reveals) {
      currentUser.reveals = startupBaseline.reveals;
    }
    if (startupBaseline.extraBottles && Number(currentUser.extraBottles || 0) < startupBaseline.extraBottles) {
      currentUser.extraBottles = startupBaseline.extraBottles;
      currentUser.extra_bottles = startupBaseline.extraBottles;
    }
    try {
      localStorage.setItem(`color_sort_user_${userData.telegramId}`, JSON.stringify(currentUser));
      localStorage.setItem(`color_sort_db_level_${userData.telegramId}`, String(startupBaseline.maxLevel));
      localStorage.setItem('cs_cached_display_level', String(startupBaseline.maxLevel));
    } catch (e) {}
  }

  window.isAllColorsActive = function () {
    if (!currentUser) return false;
    if (!currentUser.all_colors_until) return false;
    return Number(currentUser.all_colors_until) > Date.now();
  };

  window.isDailyBoostersActive = function () {
    if (!currentUser) return false;
    return Number(currentUser.daily_boosters_days_left || 0) > 0;
  };

  function getKyivDateTimeBrowser(dateInput = new Date()) {
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Kyiv',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    const parts = formatter.formatToParts(d);
    const obj = {};
    parts.forEach(p => obj[p.type] = p.value);
    const dateStr = `${obj.year}-${obj.month}-${obj.day}`;
    const timeStr = `${obj.hour}:${obj.minute}:${obj.second}`;
    return {
      dateStr,
      timeStr,
      year: parseInt(obj.year, 10),
      month: parseInt(obj.month, 10),
      day: parseInt(obj.day, 10),
      hour: parseInt(obj.hour, 10),
      minute: parseInt(obj.minute, 10),
      second: parseInt(obj.second, 10)
    };
  }

  function calculateDailyBoostersDaysLeft(purchasedAt, nowInput = new Date(), totalDays = 30) {
    const pAt = Number(purchasedAt || 0);
    if (!pAt) return null;
    const pKyiv = getKyivDateTimeBrowser(new Date(pAt));
    const nowKyiv = getKyivDateTimeBrowser(nowInput);
    const pParts = pKyiv.dateStr.split('-').map(Number);
    const nowParts = nowKyiv.dateStr.split('-').map(Number);
    const dP = Date.UTC(pParts[0], pParts[1] - 1, pParts[2]);
    const dNow = Date.UTC(nowParts[0], nowParts[1] - 1, nowParts[2]);
    const diffDays = Math.round((dNow - dP) / (24 * 3600 * 1000));
    let cutoffsPassed = Math.max(0, diffDays);
    if (nowKyiv.hour === 23 && nowKyiv.minute >= 59) {
      cutoffsPassed += 1;
    }
    return Math.max(0, totalDays - cutoffsPassed);
  }

  function getEffectiveDailyDays(user, nowInput = new Date()) {
    if (!user) return 0;
    const pAt = Number(user.daily_boosters_purchased_at || user.dailyBoostersPurchasedAt || 0);
    const rawDays = Number(user.daily_boosters_days_left !== undefined ? user.daily_boosters_days_left : (user.dailyBoostersDaysLeft || 0));
    if (pAt > 0) {
      const calcDays = calculateDailyBoostersDaysLeft(pAt, nowInput);
      if (calcDays !== null) {
        return Math.min(rawDays > 0 ? rawDays : calcDays, calcDays);
      }
    }
    return Math.max(0, rawDays);
  }

  function getTimeUntilNext2359Kyiv(nowInput = new Date()) {
    const kyiv = getKyivDateTimeBrowser(nowInput);
    const currentTotalMinutes = kyiv.hour * 60 + kyiv.minute;
    const targetTotalMinutes = 23 * 60 + 59; // 23:59 (1439 mins)
    let diffMinutes = targetTotalMinutes - currentTotalMinutes;
    if (diffMinutes < 0) {
      diffMinutes = 24 * 60;
    }
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    return { hours, minutes, totalMinutes: diffMinutes };
  }

  function formatHoursWord(h, lang = 'ru') {
    const abs = Math.abs(Number(h) || 0);
    const l = (lang || 'ru').toLowerCase();
    if (l === 'uk') {
      const mod10 = abs % 10;
      const mod100 = abs % 100;
      if (mod100 >= 11 && mod100 <= 19) return `${abs} годин`;
      if (mod10 === 1) return `${abs} година`;
      if (mod10 >= 2 && mod10 <= 4) return `${abs} години`;
      return `${abs} годин`;
    }
    const mod10 = abs % 10;
    const mod100 = abs % 100;
    if (mod100 >= 11 && mod100 <= 19) return `${abs} часов`;
    if (mod10 === 1) return `${abs} час`;
    if (mod10 >= 2 && mod10 <= 4) return `${abs} часа`;
    return `${abs} часов`;
  }

  function formatMinutesWord(m, lang = 'ru') {
    const abs = Math.abs(Number(m) || 0);
    const l = (lang || 'ru').toLowerCase();
    if (l === 'uk') {
      const mod10 = abs % 10;
      const mod100 = abs % 100;
      if (mod100 >= 11 && mod100 <= 19) return `${abs} хвилин`;
      if (mod10 === 1) return `${abs} хвилина`;
      if (mod10 >= 2 && mod10 <= 4) return `${abs} хвилини`;
      return `${abs} хвилин`;
    }
    const mod10 = abs % 10;
    const mod100 = abs % 100;
    if (mod100 >= 11 && mod100 <= 19) return `${abs} минут`;
    if (mod10 === 1) return `${abs} минута`;
    if (mod10 >= 2 && mod10 <= 4) return `${abs} минуты`;
    return `${abs} минут`;
  }

  function formatDailyDaysWord(d, lang = 'ru') {
    const abs = Math.abs(Number(d) || 0);
    const l = (lang || 'ru').toLowerCase();
    if (l === 'uk') {
      const mod10 = abs % 10;
      const mod100 = abs % 100;
      if (mod100 >= 11 && mod100 <= 19) return 'днів';
      if (mod10 === 1) return 'день';
      if (mod10 >= 2 && mod10 <= 4) return 'дні';
      return 'днів';
    }
    if (l === 'en') {
      return abs === 1 ? 'day' : 'days';
    }
    if (l === 'de') {
      return abs === 1 ? 'Tag' : 'Tage';
    }
    if (l === 'lt') {
      return 'dienų';
    }
    const mod10 = abs % 10;
    const mod100 = abs % 100;
    if (mod100 >= 11 && mod100 <= 19) return 'дней';
    if (mod10 === 1) return 'день';
    if (mod10 >= 2 && mod10 <= 4) return 'дня';
    return 'дней';
  }

  let currentLevelData = null;
  let justStartedGame = false;
  let modalJustClosed = false;
  let modalJustClosedTimer = null;

  function markModalClosed() {
    modalJustClosed = true;
    if (modalJustClosedTimer) clearTimeout(modalJustClosedTimer);
    modalJustClosedTimer = setTimeout(() => {
      modalJustClosed = false;
    }, 450);
  }

  const engine = window.GameEngine.Engine || window.GameEngine;
  const renderer = (window.GameRenderer && window.GameRenderer.GameRenderer) ? window.GameRenderer.GameRenderer : window.GameRenderer;
  const LG = (window.LevelGenerator && window.LevelGenerator.LevelGenerator) ? window.LevelGenerator.LevelGenerator : window.LevelGenerator;
  let isLevelGuardianRunning = false;

  // Universal Modal Helpers
  function openModal(el) {
    if (!el) return;
    el.classList.remove('hidden');
    el.style.display = 'flex';
  }

  function closeModal(el) {
    if (!el) return;
    if (el === shopModal || (el && el.id === 'shopModal')) {
      if (shopTimer) {
        clearInterval(shopTimer);
        shopTimer = null;
      }
    }
    if (el === adModal || (el && el.id === 'adModal') || (el && el.id === 'adBonusModal')) {
      if (window.GiftsModule && typeof window.GiftsModule.stopModalPolling === 'function') {
        window.GiftsModule.stopModalPolling();
      }
    }
    el.classList.add('hidden');
    el.style.display = 'none';
    markModalClosed();
  }

  // Custom Info Modal Helpers
  let infoModalActionCallback = null;

  function showInfoModal(icon, title, text, actionText = null, onAction = null) {
    const elIcon = document.getElementById('infoModalIcon');
    const elTitle = document.getElementById('infoModalTitle');
    const elText = document.getElementById('infoModalText');
    const elActionBtn = document.getElementById('infoModalActionBtn');
    const elOkBtn = document.getElementById('infoModalOkBtn');

    if (elIcon) elIcon.textContent = icon;
    if (elTitle) elTitle.textContent = title;
    if (elText) elText.textContent = text;

    infoModalActionCallback = onAction;
    if (elActionBtn) {
      if (actionText && typeof onAction === 'function') {
        elActionBtn.textContent = actionText;
        elActionBtn.classList.remove('hidden');
        if (elOkBtn) {
          elOkBtn.textContent = 'Закрыть';
          elOkBtn.style.width = 'auto';
        }
      } else {
        elActionBtn.classList.add('hidden');
        if (elOkBtn) {
          elOkBtn.textContent = 'OK';
          elOkBtn.style.width = '100%';
        }
      }
    }

    if (infoModal) openModal(infoModal);
    else alert(`${icon} ${title}\n${text}`);
  }

  if (infoModal) {
    infoModal.addEventListener('click', (e) => {
      if (e.target === infoModal) {
        closeModal(infoModal);
        infoModalActionCallback = null;
      }
    });
  }

  const infoModalOkBtn = document.getElementById('infoModalOkBtn');
  if (infoModalOkBtn && infoModal) {
    infoModalOkBtn.addEventListener('click', () => {
      closeModal(infoModal);
      infoModalActionCallback = null;
    });
  }

  const infoModalActionBtn = document.getElementById('infoModalActionBtn');
  if (infoModalActionBtn && infoModal) {
    infoModalActionBtn.addEventListener('click', async () => {
      closeModal(infoModal);
      if (typeof infoModalActionCallback === 'function') {
        const cb = infoModalActionCallback;
        infoModalActionCallback = null;
        await cb();
      }
    });
  }

  // --- Ad Reward Celebration Success Modal ---
  const adRewardSuccessModal = document.getElementById('adRewardSuccessModal');
  const adRewardSuccessBtn = document.getElementById('adRewardSuccessBtn');

  function showAdRewardSuccessModal(rewardType) {
    const iconEl = document.getElementById('adRewardSuccessIcon');
    const titleEl = document.getElementById('adRewardSuccessTitle');
    const itemEl = document.getElementById('adRewardSuccessItem');
    const descEl = document.getElementById('adRewardSuccessDesc');
    const btnEl = document.getElementById('adRewardSuccessBtn');

    const REWARD_MAP = {
      extra_bottle: {
        icon: '🧪',
        item: t('adSuccessBottle') || '+1 Пустая колба',
        desc: t('adSuccessBottleDesc') || 'Колбочка добавлена в ваш запас!'
      },
      extra_bottles: {
        icon: '🧪',
        item: t('adSuccessBottle') || '+1 Пустая колба',
        desc: t('adSuccessBottleDesc') || 'Колбочка добавлена в ваш запас!'
      },
      hints: {
        icon: '💡',
        item: t('adSuccessHint') || '+1 Подсказка',
        desc: t('adSuccessHintDesc') || 'Подсказка добавлена в ваш запас!'
      },
      undos: {
        icon: '↩️',
        item: t('adSuccessUndo') || '+1 Шаг назад',
        desc: t('adSuccessUndoDesc') || 'Отмена хода добавлена в ваш запас!'
      },
      reveal_bottle: {
        icon: '🔮',
        item: t('adSuccessReveal') || '+1 Открыть цвета',
        desc: t('adSuccessRevealDesc') || 'Открытие цветов добавлено в запас!'
      },
      reveals: {
        icon: '🔮',
        item: t('adSuccessReveal') || '+1 Открыть цвета',
        desc: t('adSuccessRevealDesc') || 'Открытие цветов добавлено в запас!'
      },
      coins: {
        icon: '🪙',
        item: '+150 Монет',
        desc: 'Монеты успешно добавлены на ваш баланс!'
      }
    };

    const info = REWARD_MAP[rewardType] || {
      icon: '🎁',
      item: 'Награда получена!',
      desc: 'Бонус успешно добавлен в ваш запас!'
    };

    if (iconEl) iconEl.textContent = info.icon;
    if (titleEl) titleEl.textContent = t('adSuccessTitle') || 'Поздравляем! 🎉';
    if (itemEl) itemEl.textContent = info.item;
    if (descEl) descEl.textContent = info.desc;
    if (btnEl) btnEl.textContent = t('adSuccessBtn') || 'Отлично!';

    if (adRewardSuccessModal) {
      openModal(adRewardSuccessModal);
    } else {
      showInfoModal(info.icon, 'Поздравляем! 🎉', `${info.item}\n${info.desc}`);
    }

    if (window.TelegramApp && window.TelegramApp.TelegramApp) {
      window.TelegramApp.TelegramApp.haptic('success');
    }
    if (window.SoundEngine && window.SoundEngine.SoundEngine) {
      window.SoundEngine.SoundEngine.playComplete();
    }
  }

  if (adRewardSuccessModal) {
    adRewardSuccessModal.addEventListener('click', (e) => {
      if (e.target === adRewardSuccessModal) {
        closeModal(adRewardSuccessModal);
        if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('light');
      }
    });
  }

  if (adRewardSuccessBtn && adRewardSuccessModal) {
    adRewardSuccessBtn.addEventListener('click', () => {
      closeModal(adRewardSuccessModal);
      if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('light');
      if (window.SoundEngine && window.SoundEngine.SoundEngine) window.SoundEngine.SoundEngine.playClick();
    });
  }

  // Server Communication & 24/7 Global Cloud Database
  const GLOBAL_CLOUD_BUCKET = '82kzJTUxZwwFNvg7kUSqgM';
  const GLOBAL_CLOUD_BASE = 'https://kvdb.io/' + GLOBAL_CLOUD_BUCKET;
  const API_BASE = (typeof window !== 'undefined' && window.COLOR_SORT_API_URL)
    ? window.COLOR_SORT_API_URL
    : (typeof window !== 'undefined' && (window.location.hostname.includes('github.io') || window.location.protocol === 'file:')
        ? 'https://colorsortgame.vercel.app'
        : '');
  const NEWS_API_BASE = API_BASE;
  let sessionAdminPin = null;

  function normalizeUserObject(user) {
    if (!user || typeof user !== 'object') return user;

    // Ensure telegramId and identity fields are mapped from SQLite snake_case
    if (!user.telegramId && (user.telegram_id || user.id)) {
      user.telegramId = String(user.telegram_id || user.id).trim();
    }
    if (user.telegramId) {
      user.telegramId = String(user.telegramId).trim();
      user.telegram_id = user.telegramId;
    }
    if (!user.firstName && (user.first_name || user.name)) {
      user.firstName = String(user.first_name || user.name).trim();
    }
    if (user.firstName) {
      user.firstName = String(user.firstName).trim();
      user.first_name = user.firstName;
    }
    if (!user.username && (user.userName || user.uname)) {
      user.username = String(user.userName || user.uname).trim();
    }
    if (user.username) {
      user.username = String(user.username).replace(/^@/, '').trim();
    }
    if (!user.photoUrl && user.photo_url) {
      user.photoUrl = user.photo_url;
    }
    if (user.photoUrl) {
      user.photo_url = user.photoUrl;
    }

    let bVal = 0;
    if (user.extraBottles !== undefined && user.extra_bottles !== undefined) {
      bVal = Math.max(Number(user.extraBottles || 0), Number(user.extra_bottles || 0));
    } else if (user.extraBottles !== undefined) {
      bVal = Number(user.extraBottles || 0);
    } else if (user.extra_bottles !== undefined) {
      bVal = Number(user.extra_bottles || 0);
    }
    user.extraBottles = Number(bVal || 0);
    user.extra_bottles = Number(bVal || 0);
    user.hints = Math.max(0, Number(user.hints || 0));
    user.undos = Math.max(0, Number(user.undos || 0));
    user.reveals = Math.max(0, Number(user.reveals || 0));

    // Anti-Cheat: sanitize excessive/hacked booster values for regular players (Admins exempted)
    const isAdmin = isAlligatorAdmin(user);
    if (!isAdmin) {
      if (user.hints > 50) user.hints = 0;
      if (user.undos > 50) user.undos = 0;
      if (user.reveals > 50) user.reveals = 0;
      if (user.extraBottles > 50) { user.extraBottles = 0; user.extra_bottles = 0; }
    }
    user.ton_balance = Number(user.ton_balance !== undefined ? user.ton_balance : (user.tonBalance !== undefined ? user.tonBalance : 0));
    user.ton_wallet = String(user.ton_wallet || user.tonWallet || '').trim();
    user.ton_wallet_type = String(user.ton_wallet_type || user.tonWalletType || '').trim();
    user.ton_deposits_total = Number(user.ton_deposits_total || 0);
    user.ton_deposits_count = Number(user.ton_deposits_count || 0);
    user.purchasesResetAt = Number(user.purchasesResetAt || user.purchases_reset_at || 0);
    user.daily_boosters_purchased_at = Number(user.daily_boosters_purchased_at || user.dailyBoostersPurchasedAt || 0);
    user.dailyBoostersPurchasedAt = user.daily_boosters_purchased_at;
    user.daily_boosters_days_left = getEffectiveDailyDays(user);
    user.dailyBoostersDaysLeft = user.daily_boosters_days_left;
    user.daily_boosters_last_date = String(user.daily_boosters_last_date || user.dailyBoostersLastDate || '').trim();
    // Map snake_case levels from server/db to camelCase
    if (user.max_level !== undefined && (user.maxLevel === undefined || Number(user.max_level) > Number(user.maxLevel))) {
      user.maxLevel = Number(user.max_level);
    }
    if (user.current_level !== undefined && (user.currentLevel === undefined || Number(user.current_level) > Number(user.currentLevel))) {
      user.currentLevel = Number(user.current_level);
    }
    if (user.maxLevel !== undefined && Number(user.maxLevel) > 0) {
      user.currentLevel = Math.max(Number(user.currentLevel || 1), Number(user.maxLevel));
      user.level = Math.max(Number(user.level || 0), Number(user.maxLevel));
    } else if (user.currentLevel !== undefined && Number(user.currentLevel) > 1) {
      user.maxLevel = Math.max(Number(user.maxLevel || 0), Number(user.currentLevel));
      user.level = user.maxLevel;
    }
    user.max_level = user.maxLevel;
    user.current_level = user.currentLevel;

    // Enforce immutable player baselines protection
    const baseEntry = IMMUTABLE_PLAYER_BASELINES[String(user.telegramId)];
    if (baseEntry) {
      if (baseEntry.maxLevel && Number(user.maxLevel || 0) < baseEntry.maxLevel) {
        user.maxLevel = baseEntry.maxLevel;
        user.max_level = baseEntry.maxLevel;
        user.currentLevel = Math.max(Number(user.currentLevel || 1), baseEntry.maxLevel);
        user.current_level = user.currentLevel;
        user.level = baseEntry.maxLevel;
      }
      if (baseEntry.hints && Number(user.hints || 0) < baseEntry.hints) {
        user.hints = baseEntry.hints;
      }
      if (baseEntry.undos && Number(user.undos || 0) < baseEntry.undos) {
        user.undos = baseEntry.undos;
      }
      if (baseEntry.reveals && Number(user.reveals || 0) < baseEntry.reveals) {
        user.reveals = baseEntry.reveals;
      }
      if (baseEntry.extraBottles && Number(user.extraBottles || 0) < baseEntry.extraBottles) {
        user.extraBottles = baseEntry.extraBottles;
        user.extra_bottles = baseEntry.extraBottles;
      }
    }
    return user;
  }

  function updateCloudBoosterDirectly(field, value) {
    if (!currentUser || !currentUser.telegramId) return;
    currentUser[field] = value;
    if (field === 'extraBottles') currentUser.extra_bottles = value;
    currentUser.updatedAt = Date.now();
    saveLocalUser();
    updateHeaderUI();

    const myId = String(currentUser.telegramId);
    if (!myId.startsWith('guest') && !myId.startsWith('dev')) {
      fetch(`${GLOBAL_CLOUD_BASE}/player_${encodeURIComponent(myId)}?_cb=${Date.now()}`)
        .then(r => r.ok ? r.json() : null)
        .then(cloudVal => {
          const payload = (cloudVal && typeof cloudVal === 'object') ? cloudVal : { telegramId: myId };
          payload[field] = value;
          if (field === 'extraBottles') {
            payload.extraBottles = value;
            payload.extra_bottles = value;
          }
          payload.updatedAt = currentUser.updatedAt;
          return fetch(`${GLOBAL_CLOUD_BASE}/player_${encodeURIComponent(myId)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
        }).catch(() => {});
    }
  }

  async function syncPlayerToCloud(user, options = {}) {
    if (!user || !user.telegramId) return;
    if (window.__seasonResetKicking || (typeof isSeasonResetKicked !== 'undefined' && isSeasonResetKicked)) {
      return;
    }
    normalizeUserObject(user);
    const id = String(user.telegramId);

    const localSeasonReset = Number(localStorage.getItem('color_sort_season_reset_at') || 0);

    // Secure authoritative sync: backend handles SQLite and KVDB authoritatively
    const syncPayload = {
      telegramId: id,
      firstName: user.firstName,
      username: user.username,
      photoUrl: user.photoUrl,
      currentLevel: user.currentLevel,
      ton_wallet: user.ton_wallet,
      ton_wallet_type: user.ton_wallet_type,
      seasonResetAt: localSeasonReset,
      purchasesResetAt: Number(user.purchasesResetAt || user.purchases_reset_at || 0)
    };

    // Forward snapshot directly to KVDB as well for 24/7 cross-device consistency
    if (!id.startsWith('guest') && !id.startsWith('dev')) {
      fetch(`${GLOBAL_CLOUD_BASE}/player_${encodeURIComponent(id)}?_cb=${Date.now()}`)
        .then(r => r.ok ? r.json() : null)
        .then(cloudVal => {
          const baseObj = (cloudVal && typeof cloudVal === 'object') ? cloudVal : { telegramId: id };
          baseObj.firstName = user.firstName || baseObj.firstName;
          baseObj.username = user.username || baseObj.username;
          baseObj.maxLevel = Math.max(Number(user.maxLevel || 0), Number(baseObj.maxLevel || 0));
          baseObj.max_level = baseObj.maxLevel;
          baseObj.level = baseObj.maxLevel;
          baseObj.currentLevel = user.currentLevel || baseObj.currentLevel;
          baseObj.current_level = baseObj.currentLevel;
          baseObj.hints = user.hints !== undefined ? user.hints : baseObj.hints;
          baseObj.undos = user.undos !== undefined ? user.undos : baseObj.undos;
          baseObj.reveals = user.reveals !== undefined ? user.reveals : baseObj.reveals;
          baseObj.extraBottles = user.extraBottles !== undefined ? user.extraBottles : baseObj.extraBottles;
          baseObj.extra_bottles = baseObj.extraBottles;
          baseObj.ton_balance = user.ton_balance !== undefined ? user.ton_balance : baseObj.ton_balance;
          baseObj.ton_wallet = user.ton_wallet || baseObj.ton_wallet;
          baseObj.memo_code = user.memo_code || baseObj.memo_code;
          baseObj.seasonResetAt = localSeasonReset;
          baseObj.updatedAt = user.updatedAt || Date.now();
          return fetch(`${GLOBAL_CLOUD_BASE}/player_${encodeURIComponent(id)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(baseObj)
          });
        }).catch(() => {});
    }

    try {
      const res = await apiCall('/api/user/sync', 'POST', syncPayload, {
        keepalive: options && options.keepalive ? true : undefined
      });
      if (res && res.success && res.user) {
        currentUser = normalizeUserObject(res.user);
        saveLocalUser();
        updateHeaderUI();
      }
    } catch (e) {}
  }

  function getTelegramInitData() {
    if (window.TelegramApp && window.TelegramApp.getInitData) {
      const d = window.TelegramApp.getInitData();
      if (d) return d;
    }
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) {
      return window.Telegram.WebApp.initData;
    }
    try {
      return localStorage.getItem('color_sort_last_init_data') || '';
    } catch (e) {
      return '';
    }
  }

  function getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const initData = getTelegramInitData();
    if (initData) {
      headers['x-telegram-init-data'] = initData;
      headers['Authorization'] = `tma ${initData}`;
    }
    return headers;
  }

  async function apiCall(endpoint, method = 'GET', body = null, extraOptions = {}) {
    if (!API_BASE && typeof window !== 'undefined' && window.location.hostname.includes('github.io')) {
      return null;
    }
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const headers = getAuthHeaders();
      if (typeof sessionAdminPin !== 'undefined' && sessionAdminPin) {
        headers['x-admin-pin'] = sessionAdminPin;
      }
      const initData = getTelegramInitData();
      const options = { 
        method, 
        headers,
        signal: controller.signal,
        ...extraOptions
      };
      if (body && typeof body === 'object') {
        const payload = { ...body };
        if (initData && !payload.initData) {
          payload.initData = initData;
        }
        if (typeof sessionAdminPin !== 'undefined' && sessionAdminPin && !payload.adminPin) {
          payload.adminPin = sessionAdminPin;
        }
        options.body = JSON.stringify(payload);
      } else if (body) {
        options.body = body;
      }
      
      const res = await fetch(API_BASE + endpoint, options);
      clearTimeout(timeoutId);
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        return {
          ok: false,
          status: res.status,
          success: false,
          error: errJson && errJson.error ? errJson.error : `HTTP ${res.status}`,
          unverified: errJson ? errJson.unverified : undefined
        };
      }
      const json = await res.json();
      if (json && json.maintenance && !isAllowedPlayer) {
        applyMaintenanceBlock(json.error || json.maintenanceMessage);
      }
      return json;
    } catch (e) {
      return null;
    }
  }

  // LocalStorage helper
  function saveLocalUser() {
    currentUser.updatedAt = Date.now();
    normalizeUserObject(currentUser);
    localStorage.setItem(`color_sort_user_${currentUser.telegramId}`, JSON.stringify(currentUser));
    if (Number(currentUser.maxLevel || 0) > 0) {
      localStorage.setItem(`color_sort_db_level_${currentUser.telegramId}`, String(currentUser.maxLevel));
      localStorage.setItem('cs_cached_display_level', String(currentUser.maxLevel));
    }
    if (Number(currentUser.daily_boosters_days_left || 0) > 0) {
      localStorage.setItem(`color_sort_daily_boosters_days_${currentUser.telegramId}`, String(currentUser.daily_boosters_days_left));
      localStorage.setItem(`color_sort_daily_boosters_date_${currentUser.telegramId}`, String(currentUser.daily_boosters_last_date || ''));
      localStorage.setItem(`color_sort_daily_boosters_at_${currentUser.telegramId}`, String(currentUser.daily_boosters_purchased_at || ''));
    }
    if (currentUser.ton_balance !== undefined && currentUser.ton_balance !== null) {
      localStorage.setItem(`color_sort_ton_balance_${currentUser.telegramId}`, String(currentUser.ton_balance));
    }
  }
  function loadLocalUser() {
    const data = localStorage.getItem(`color_sort_user_${currentUser.telegramId}`);
    if (data) {
      try {
        const parsed = JSON.parse(data);
        const savedFirst = currentUser.firstName;
        const savedUname = currentUser.username;
        currentUser = { ...currentUser, ...parsed };
        const isParsedDummy = !parsed.firstName || parsed.firstName === 'Игрок' || parsed.firstName === 'Player' || parsed.firstName === '.';
        if (savedFirst && (isParsedDummy || (savedFirst !== 'Игрок' && savedFirst !== 'Player'))) {
          currentUser.firstName = savedFirst;
        }
        if (savedUname) {
          currentUser.username = savedUname;
        }
        const cachedTonBal = localStorage.getItem(`color_sort_ton_balance_${currentUser.telegramId}`);
        if (cachedTonBal !== null && !isNaN(parseFloat(cachedTonBal))) {
          currentUser.ton_balance = Math.max(Number(currentUser.ton_balance || 0), parseFloat(cachedTonBal));
        }
        if (currentUser.maxLevel > 0) {
          currentUser.currentLevel = Math.max(Number(currentUser.currentLevel || 1), Number(currentUser.maxLevel));
          currentUser.level = currentUser.maxLevel;
        }
        currentUser._localLoaded = true;
      } catch (e) {}
    }

    // Always enforce cached level and immutable baseline, even if primary local object was empty
    const cachedDbLvl = Number(localStorage.getItem(`color_sort_db_level_${currentUser.telegramId}`) || 0);
    if (cachedDbLvl > 0 && (!currentUser.maxLevel || currentUser.maxLevel < cachedDbLvl)) {
      currentUser.maxLevel = cachedDbLvl;
      currentUser.level = cachedDbLvl;
      currentUser.currentLevel = cachedDbLvl;
    }
    const cachedDisplayLvl = Number(localStorage.getItem('cs_cached_display_level') || 0);
    if (cachedDisplayLvl > 0 && (!currentUser.maxLevel || currentUser.maxLevel < cachedDisplayLvl)) {
      currentUser.maxLevel = cachedDisplayLvl;
      currentUser.level = cachedDisplayLvl;
      currentUser.currentLevel = cachedDisplayLvl;
    }
    const userBaseline = IMMUTABLE_PLAYER_BASELINES[String(currentUser.telegramId)];
    if (userBaseline) {
      if (Number(currentUser.maxLevel || 0) < userBaseline.maxLevel) {
        currentUser.maxLevel = userBaseline.maxLevel;
        currentUser.level = userBaseline.maxLevel;
        currentUser.currentLevel = userBaseline.maxLevel;
        currentUser.stars = Math.max(Number(currentUser.stars || 0), userBaseline.stars || 0);
      }
      if (userBaseline.hints && Number(currentUser.hints || 0) < userBaseline.hints) {
        currentUser.hints = userBaseline.hints;
      }
      if (userBaseline.undos && Number(currentUser.undos || 0) < userBaseline.undos) {
        currentUser.undos = userBaseline.undos;
      }
      if (userBaseline.reveals && Number(currentUser.reveals || 0) < userBaseline.reveals) {
        currentUser.reveals = userBaseline.reveals;
      }
      if (userBaseline.extraBottles && Number(currentUser.extraBottles || 0) < userBaseline.extraBottles) {
        currentUser.extraBottles = userBaseline.extraBottles;
        currentUser.extra_bottles = userBaseline.extraBottles;
      }
      try {
        localStorage.setItem(`color_sort_user_${currentUser.telegramId}`, JSON.stringify(currentUser));
        localStorage.setItem(`color_sort_db_level_${currentUser.telegramId}`, String(userBaseline.maxLevel));
        localStorage.setItem('cs_cached_display_level', String(userBaseline.maxLevel));
      } catch (e) {}
    }
    if (currentUser.maxLevel > 0) {
      currentUser.currentLevel = Math.max(Number(currentUser.currentLevel || 1), Number(currentUser.maxLevel));
      currentUser.level = currentUser.maxLevel;
    }
    // Safety check for daily boosters backup keys
    const backupAt = Number(localStorage.getItem(`color_sort_daily_boosters_at_${currentUser.telegramId}`) || 0);
    if (backupAt && !currentUser.daily_boosters_purchased_at) {
      currentUser.daily_boosters_purchased_at = backupAt;
    }
    const backupDate = localStorage.getItem(`color_sort_daily_boosters_date_${currentUser.telegramId}`);
    if (backupDate && !currentUser.daily_boosters_last_date) {
      currentUser.daily_boosters_last_date = backupDate;
    }
    const effectiveDays = getEffectiveDailyDays(currentUser);
    currentUser.daily_boosters_days_left = effectiveDays;
    currentUser.dailyBoostersDaysLeft = effectiveDays;
    if (!currentUser.purchasesResetAt) {
      const storedReset = Number(localStorage.getItem(`color_sort_user_purchases_reset_${currentUser.telegramId}`) || localStorage.getItem('color_sort_gram_reset_at') || 0);
      currentUser.purchasesResetAt = storedReset;
      currentUser.purchases_reset_at = storedReset;
    }
    normalizeUserObject(currentUser);
  }

  function isValidReferralId(id) {
    if (!id) return false;
    const s = String(id).trim();
    if (s.startsWith('tg_user_') || s.startsWith('guest_') || s === 'undefined' || s === 'null') return false;
    return /^\d{4,16}$/.test(s);
  }

  async function processIncomingReferral() {
    const tg = window.Telegram && window.Telegram.WebApp;
    let refParam = null;

    // Source 1: Telegram WebApp initDataUnsafe
    if (tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param) {
      const m = String(tg.initDataUnsafe.start_param).match(/(?:ref_)?(\d+)/i);
      if (m) refParam = m[1];
    }

    // Source 2: Telegram WebApp raw initData string
    if (!refParam && tg && tg.initData) {
      try {
        const initParams = new URLSearchParams(tg.initData);
        const sp = initParams.get('start_param') || initParams.get('startapp') || initParams.get('ref');
        if (sp) {
          const m = String(sp).match(/(?:ref_)?(\d+)/i);
          if (m) refParam = m[1];
        }
      } catch (e) {}
    }

    // Source 3: URL search params (?startapp=ref_123 or ?start=ref_123 or ?tgWebAppStartParam=ref_123 or ?ref=123)
    if (!refParam && typeof window !== 'undefined' && window.location.search) {
      const urlParams = new URLSearchParams(window.location.search);
      const val = urlParams.get('startapp') || urlParams.get('start') || urlParams.get('tgWebAppStartParam') || urlParams.get('ref');
      if (val) {
        const m = String(val).match(/(?:ref_)?(\d+)/i);
        if (m) refParam = m[1];
      }
    }

    // Source 4: URL hash fragment (#tgWebAppData=...)
    if (!refParam && typeof window !== 'undefined' && window.location.hash) {
      try {
        const hashStr = window.location.hash.replace(/^#/, '');
        const hashParams = new URLSearchParams(hashStr);
        const tgData = hashParams.get('tgWebAppData');
        if (tgData) {
          const innerParams = new URLSearchParams(tgData);
          const sp = innerParams.get('start_param') || innerParams.get('startapp') || innerParams.get('ref');
          if (sp) {
            const m = String(sp).match(/(?:ref_)?(\d+)/i);
            if (m) refParam = m[1];
          }
        }
      } catch (e) {}
    }

    if (!currentUser || !currentUser.telegramId) return;
    const myId = String(currentUser.telegramId).trim();

    // Referrals are strictly reserved for genuine Telegram users (numeric Telegram IDs)
    if (!isValidReferralId(myId)) return;

    // 1. FAST LOCAL CHECK: If already permanently bound, do not re-bind
    const boundReferrer = localStorage.getItem('cs_bound_referrer_id');
    if (boundReferrer) {
      return;
    }

    const inviterId = String(refParam || '').trim();
    if (!isValidReferralId(inviterId) || inviterId === myId) return;

    const cleanUsername = String(currentUser.username || '').toLowerCase().replace(/^@/, '').trim();

    try {
      // 2. CLOUD REGISTRY CHECK: Query permanent binding by ID ("Кто чей пригласитель")
      let existingCloudReferrer = null;

      try {
        const resBind = await fetch(`${GLOBAL_CLOUD_BASE}/ref_registry_binding_${encodeURIComponent(myId)}`, {
          signal: (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') ? AbortSignal.timeout(3000) : undefined
        });
        if (resBind.ok) {
          const raw = await resBind.text();
          let bData = null;
          try { bData = JSON.parse(raw); } catch (e) {}
          if (bData && (bData.referrerId || bData.locked)) {
            existingCloudReferrer = bData.referrerId || 'locked';
          }
        }
      } catch (e) {}

      // Backwards-compatible check: legacy binding_ref_ key in KVDB
      if (!existingCloudReferrer) {
        try {
          const resOld = await fetch(`${GLOBAL_CLOUD_BASE}/binding_ref_${encodeURIComponent(myId)}`, {
            signal: (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') ? AbortSignal.timeout(2500) : undefined
          });
          if (resOld.ok) {
            const rawOld = await resOld.text();
            let bDataOld = null;
            try { bDataOld = JSON.parse(rawOld); } catch (e) {}
            if (bDataOld && bDataOld.referrerId) {
              existingCloudReferrer = bDataOld.referrerId;
            }
          }
        } catch (e) {}
      }

      // If user was already bound to a referrer in cloud, restore local state and return
      if (existingCloudReferrer && existingCloudReferrer !== 'locked') {
        localStorage.setItem('cs_bound_referrer_id', String(existingCloudReferrer));
        localStorage.setItem('cs_ref_permanently_locked', 'true');
        return;
      }

      // 3. Bind permanently to inviterId across all cloud and local storage
      localStorage.setItem('cs_bound_referrer_id', String(inviterId));
      localStorage.setItem('cs_ref_permanently_locked', 'true');

      const bindingPayload = {
        refereeId: myId,
        referrerId: inviterId,
        refereeName: currentUser.firstName || 'Игрок',
        refereeUsername: cleanUsername,
        boundAt: Date.now(),
        permanent: true
      };

      // A. Write permanent cloud registry binding by ID
      fetch(`${GLOBAL_CLOUD_BASE}/ref_registry_binding_${encodeURIComponent(myId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bindingPayload)
      }).catch(() => {});

      // Legacy key compatibility
      fetch(`${GLOBAL_CLOUD_BASE}/binding_ref_${encodeURIComponent(myId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bindingPayload)
      }).catch(() => {});

      // B. Write permanent cloud registry binding by Username (if provided)
      if (cleanUsername) {
        const unamePayload = {
          username: cleanUsername,
          refereeId: myId,
          referrerId: inviterId,
          boundAt: Date.now(),
          permanent: true
        };
        fetch(`${GLOBAL_CLOUD_BASE}/ref_registry_uname_${encodeURIComponent(cleanUsername)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(unamePayload)
        }).catch(() => {});
        fetch(`${GLOBAL_CLOUD_BASE}/binding_uname_${encodeURIComponent(cleanUsername)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(unamePayload)
        }).catch(() => {});
      }

      // C. Save referral item in inviter's friends list in KVDB Cloud ("Кто у кого реферал")
      const refItemPayload = {
        id: `ref_${inviterId}_${myId}`,
        referrerId: inviterId,
        referredId: myId,
        referredName: currentUser.firstName || 'Игрок',
        referredUsername: cleanUsername,
        rewardClaimed: 0,
        createdAt: Date.now()
      };
      fetch(`${GLOBAL_CLOUD_BASE}/ref_${encodeURIComponent(inviterId)}_${encodeURIComponent(myId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(refItemPayload)
      }).catch(() => {});

      // D. Register in server database (SQLite)
      apiCall('/api/referral/register', 'POST', {
        referrerId: inviterId,
        telegramId: myId,
        firstName: currentUser.firstName || 'Игрок',
        username: cleanUsername
      }).catch(() => {});

    } catch (err) {
      console.warn('[Referral Processing Notice]', err);
    }
  }

  // 5. Init renderer
  if (renderer && typeof renderer.initRenderer === 'function') {
    renderer.initRenderer(gameBoard, particleCanvas);
  }

  // 6. Fetch user from local storage first (instant baseline)
  loadLocalUser();
  updateHeaderUI();

  // 6.0 Synchronization Window Coordinator (gives 1.8s for live server & cloud sync)
  const startSyncStartTime = Date.now();
  const MIN_SYNC_DELAY_MS = 1800; // 1.8s delay requested by user to allow full server & cloud synchronization
  let isStartUnlocked = false;

  function unlockStartScreenWhenReady() {
    if (isStartUnlocked) return;
    isStartUnlocked = true;

    const targetLvl = Math.max(1, Number(currentUser.maxLevel || 1), Number(currentUser.currentLevel || 1));
    currentUser.currentLevel = targetLvl;
    currentUser.maxLevel = targetLvl;
    currentUser.level = targetLvl;

    if (LG && LG.generateLevel) {
      currentLevelData = LG.generateLevel(targetLvl);
      engine.startLevel(currentLevelData);
      if (renderer && renderer.renderBoard) {
        renderer.renderBoard(engine);
      }
    }
    updateHeaderUI();

    if (typeof window.__unlockStartScreen === 'function') {
      window.__unlockStartScreen(currentUser.maxLevel, currentUser.firstName);
    }
  }

  function scheduleStartUnlock(force = false) {
    if (isStartUnlocked) return;
    const elapsed = Date.now() - startSyncStartTime;
    const remaining = force ? 0 : Math.max(0, MIN_SYNC_DELAY_MS - elapsed);
    setTimeout(() => {
      unlockStartScreenWhenReady();
    }, remaining);
  }

  // Hard safeguard timeout: never keep start button disabled longer than 2.6s
  setTimeout(() => scheduleStartUnlock(true), 2600);

  // 6.1 Unconditionally fetch live cloud inventory & stats from KVDB (works 24/7 on GitHub Pages)
  if (currentUser.telegramId) {
    const myIdStr = String(currentUser.telegramId);
    fetch(`${GLOBAL_CLOUD_BASE}/player_${encodeURIComponent(myIdStr)}?_cb=${Date.now()}`)
      .then(res => res.ok ? res.json() : null)
      .then(cloudData => {
        if (cloudData && typeof cloudData === 'object') {
          const localReset = Number(localStorage.getItem('color_sort_season_reset_at') || 0);
          const cloudSeason = Number(cloudData.seasonResetAt || 0);
          const cloudRestore = Number(cloudData.snapshotRestoredAt || 0);

          // Restored snapshot records take absolute priority and are NEVER wiped on reload
          if (cloudSeason > Number(currentUser.seasonResetAt || 0)) {
            currentUser.seasonResetAt = cloudSeason;
          }

          const forceResetTs = Number(cloudData.forceResetAt || cloudData.accountResetAt || 0);
          const localForceResetTs = Number(localStorage.getItem(`color_sort_force_reset_${currentUser.telegramId}`) || currentUser.forceResetAt || currentUser.accountResetAt || 0);
          if (forceResetTs > 0 && forceResetTs > localForceResetTs) {
            localStorage.setItem(`color_sort_force_reset_${currentUser.telegramId}`, String(forceResetTs));
            currentUser.forceResetAt = forceResetTs;
            currentUser.accountResetAt = forceResetTs;
            currentUser.maxLevel = Number(cloudData.maxLevel !== undefined ? cloudData.maxLevel : 10);
            currentUser.level = Number(cloudData.level !== undefined ? cloudData.level : 10);
            currentUser.currentLevel = Number(cloudData.currentLevel !== undefined ? cloudData.currentLevel : 10);
            currentUser.stars = Number(cloudData.stars || 0);
            currentUser.hints = Number(cloudData.hints || 0);
            currentUser.undos = Number(cloudData.undos || 0);
            currentUser.reveals = Number(cloudData.reveals || 0);
            currentUser.extraBottles = Number(cloudData.extraBottles !== undefined ? cloudData.extraBottles : (cloudData.extra_bottles || 0));
            currentUser.extra_bottles = currentUser.extraBottles;
            currentUser.shuffles = Number(cloudData.shuffles || 0);
            currentUser.all_colors_until = Number(cloudData.all_colors_until || 0);
            currentUser.all_colors_purchased_at = 0;
            currentUser.daily_boosters_days_left = 0;
            currentUser.dailyBoostersDaysLeft = 0;
            currentUser.daily_boosters_last_date = '';
            currentUser.daily_boosters_purchased_at = 0;
            currentUser.ton_wallet = '';
            normalizeUserObject(currentUser);
            saveLocalUser();
            updateHeaderUI();
            loadCurrentLevel();
            return;
          }

          let changed = false;

          const localUpdatedAt = Number(currentUser.updatedAt || 0);
          const cloudUpdatedAt = Number(cloudData.updatedAt || 0);

          // If cloud data is strictly newer than our local state, sync cloud booster values directly
          if (cloudUpdatedAt > localUpdatedAt) {
            if (cloudData.hints !== undefined) {
              currentUser.hints = Number(cloudData.hints || 0);
              changed = true;
            }
            if (cloudData.undos !== undefined) {
              currentUser.undos = Number(cloudData.undos || 0);
              changed = true;
            }
            if (cloudData.reveals !== undefined) {
              currentUser.reveals = Number(cloudData.reveals || 0);
              changed = true;
            }
            const cloudB = cloudData.extra_bottles !== undefined ? cloudData.extra_bottles : cloudData.extraBottles;
            if (cloudB !== undefined) {
              currentUser.extraBottles = Number(cloudB || 0);
              currentUser.extra_bottles = currentUser.extraBottles;
              changed = true;
            }
          } else {
            // Local state is newer or equal (player spent boosters, sent gifts, etc.)
            // Maintain our local booster counts and ensure cloud receives them
            syncPlayerToCloud(currentUser);
          }
          if (cloudData.all_colors_until !== undefined) {
            const acu = Math.max(Number(currentUser.all_colors_until || 0), Number(cloudData.all_colors_until || 0));
            if (acu !== currentUser.all_colors_until) { currentUser.all_colors_until = acu; changed = true; }
          }
          if (cloudData.all_colors_purchased_at !== undefined) {
            const acp = Math.max(Number(currentUser.all_colors_purchased_at || 0), Number(cloudData.all_colors_purchased_at || 0));
            if (acp !== currentUser.all_colors_purchased_at) { currentUser.all_colors_purchased_at = acp; changed = true; }
          }
          if (cloudData.daily_boosters_purchased_at) {
            const cAt = Number(cloudData.daily_boosters_purchased_at || cloudData.dailyBoostersPurchasedAt || 0);
            if (cAt > Number(currentUser.daily_boosters_purchased_at || 0)) {
              currentUser.daily_boosters_purchased_at = cAt;
              currentUser.dailyBoostersPurchasedAt = cAt;
              changed = true;
            }
          }
          if (cloudData.daily_boosters_last_date) {
            const cDate = cloudData.daily_boosters_last_date || cloudData.dailyBoostersLastDate || '';
            const localDate = currentUser.daily_boosters_last_date || '';
            if (cDate > localDate || !localDate) {
              currentUser.daily_boosters_last_date = cDate;
              currentUser.dailyBoostersLastDate = cDate;
              changed = true;
            }
          }
          const effCloudDays = getEffectiveDailyDays(cloudData);
          if (effCloudDays > 0 || cloudData.daily_boosters_days_left !== undefined) {
            const finalDays = getEffectiveDailyDays({ ...currentUser, daily_boosters_days_left: effCloudDays });
            if (currentUser.daily_boosters_days_left !== finalDays) {
              currentUser.daily_boosters_days_left = finalDays;
              currentUser.dailyBoostersDaysLeft = finalDays;
              changed = true;
            }
          }

          if (cloudData.ton_balance !== undefined) {
            const cb = Number(cloudData.ton_balance || 0);
            if (!currentUser._localLoaded || currentUser.ton_balance === undefined || currentUser.ton_balance === null) {
              currentUser.ton_balance = cb;
              changed = true;
            } else if (cb > Number(currentUser.ton_balance || 0)) {
              currentUser.ton_balance = cb;
              changed = true;
            }
          }
          if (cloudData.ton_wallet && !currentUser.ton_wallet) {
            const isManuallyDisconnected = localStorage.getItem(`color_sort_wallet_disconnected_${myIdStr}`) === 'true';
            if (!isManuallyDisconnected) {
              currentUser.ton_wallet = cloudData.ton_wallet;
              changed = true;
            }
          }
          if (cloudData.memo_code && !currentUser.memo_code) {
            currentUser.memo_code = cloudData.memo_code;
            changed = true;
          }

          const cloudMax = Number(cloudData.maxLevel !== undefined ? cloudData.maxLevel : (cloudData.level !== undefined ? cloudData.level : (cloudData.max_level || 0)));
          const cloudCur = Number(cloudData.currentLevel || cloudData.current_level || (cloudMax > 0 ? cloudMax : 1));
          const cloudStars = Number(cloudData.stars || 0);

          // Authoritative Cloud Sync: Single unified database across all devices and rollbacks
          const cloudRestoreTs = Number(cloudData.snapshotRestoredAt || 0);
          const localRestoreTs = Number(localStorage.getItem(`color_sort_restored_at_${myIdStr}`) || currentUser.lastSnapshotRestoredAt || 0);
          const isNewSnapshotRestore = cloudRestoreTs > 0 && cloudRestoreTs > localRestoreTs;

          if (isNewSnapshotRestore) {
            currentUser.maxLevel = Math.max(Number(currentUser.maxLevel || 0), cloudMax);
            currentUser.level = currentUser.maxLevel;
            currentUser.currentLevel = Math.max(Number(currentUser.currentLevel || 1), cloudCur > 0 ? cloudCur : (currentUser.maxLevel > 0 ? currentUser.maxLevel : 1));
            currentUser.stars = Math.max(Number(currentUser.stars || 0), cloudStars);
            localStorage.setItem(`color_sort_db_level_${myIdStr}`, String(currentUser.maxLevel));
            localStorage.setItem(`color_sort_restored_at_${myIdStr}`, String(cloudRestoreTs));
            currentUser.lastSnapshotRestoredAt = cloudRestoreTs;
            changed = true;
          } else if (cloudMax > 0) {
            if (cloudMax > Number(currentUser.maxLevel || 0)) {
              currentUser.maxLevel = cloudMax;
              currentUser.level = cloudMax;
              changed = true;
            }
            if (cloudCur > Number(currentUser.currentLevel || 1)) {
              currentUser.currentLevel = cloudCur;
              changed = true;
            }
            if (cloudStars > Number(currentUser.stars || 0)) {
              currentUser.stars = cloudStars;
              changed = true;
            }
            if (currentUser.maxLevel > 0 && currentUser.currentLevel < currentUser.maxLevel) {
              currentUser.currentLevel = currentUser.maxLevel;
              changed = true;
            }
            localStorage.setItem(`color_sort_db_level_${myIdStr}`, String(currentUser.maxLevel));
            if (cloudRestoreTs > 0) {
              localStorage.setItem(`color_sort_restored_at_${myIdStr}`, String(cloudRestoreTs));
              currentUser.lastSnapshotRestoredAt = cloudRestoreTs;
            }
          }
          if (cloudSeason > 0 && cloudSeason > Number(currentUser.seasonResetAt || 0)) {
            currentUser.seasonResetAt = cloudSeason;
            currentUser.season_reset_at = cloudSeason;
            localStorage.setItem('color_sort_season_reset_at', String(cloudSeason));
            changed = true;
          }
          if (changed) {
            normalizeUserObject(currentUser);
            saveLocalUser();
            updateHeaderUI();
            if (typeof updateTonWalletUI === 'function') updateTonWalletUI();
            if (typeof updateShopUI === 'function') updateShopUI();
            if (!currentLevelData || currentLevelData.levelNumber !== currentUser.currentLevel) {
              loadCurrentLevel();
            }
          }
        }
      }).catch(() => {}).finally(() => {
        scheduleStartUnlock();
      });
  }

  // 6.2 Check global season reset in parallel
  checkGlobalSeasonReset();

  processIncomingReferral();
  applyLanguage(currentLang);
  if (userName) userName.textContent = currentUser.firstName;
  if (userAvatar) {
    userAvatar.src = userData.photoUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(userData.telegramId)}`;
  }

  // 7. Bind engine callbacks FIRST so initial level render is triggered immediately
  engine.onStateChange = () => {
    if (renderer && renderer.renderBoard) renderer.renderBoard(engine);
    updateHeaderUI();
  };

  engine.onBottleVanished = (bottleIdx) => {
    if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('success');
    console.log(`[Game] Банка #${bottleIdx} исчезла!`);
  };

  let isNextLevelLoading = false;

  function showSecurityAlert(message) {
    if (securityAlertDesc) {
      securityAlertDesc.textContent = message || 'Замечены подозрительные комбинации или накрутка уровня.';
      securityAlertDesc.style.display = 'block';
    }
    if (securityAlertModal) {
      openModal(securityAlertModal);
    } else {
      alert('🛑 Система безопасности Color Sort: ' + (message || 'Замечены невозможные действия.'));
      restartCurrentLevelSecurity();
    }
  }

  function verifyVictoryLocally(levelNumber, movesLog, boostersUsed, durationMs) {
    if (!LG || !LG.generateLevel) {
      return { verified: true };
    }
    const gen = LG.generateLevel(levelNumber);
    const bottles = JSON.parse(JSON.stringify(gen.bottles));
    const capacity = gen.capacity || 5;
    const colorCount = gen.colorCount || 5;

    const extraBottles = Math.max(0, Number(boostersUsed && (boostersUsed.extraBottles || boostersUsed.extra_bottles) || 0));
    const explicitInLog = (movesLog || []).filter(m => m && m.type === 'extra_bottle').length;
    for (let i = 0; i < Math.max(0, extraBottles - explicitInLog); i++) {
      bottles.push([]);
    }

    let validMoves = 0;
    if (Array.isArray(movesLog)) {
      for (let i = 0; i < movesLog.length; i++) {
        const m = movesLog[i];
        if (!m) continue;
        if (m.type === 'extra_bottle') {
          bottles.push([]);
          continue;
        }
        const from = m.from !== undefined ? m.from : m.fromIndex;
        const to = m.to !== undefined ? m.to : m.toIndex;
        if (from === undefined || to === undefined) continue;
        const fIdx = Number(from);
        const tIdx = Number(to);
        if (fIdx < 0 || fIdx >= bottles.length || tIdx < 0 || tIdx >= bottles.length) {
          return { verified: false, error: 'Ход #' + (i + 1) + ': колбочка вне игрового поля' };
        }
        const bFrom = bottles[fIdx];
        const bTo = bottles[tIdx];
        if (fIdx === tIdx || !bFrom || bFrom.length === 0 || !bTo || bTo.length >= capacity) {
          return { verified: false, error: 'Ход #' + (i + 1) + ': невозможный перелив' };
        }
        const topColor = bFrom[bFrom.length - 1];
        if (bTo.length > 0 && bTo[bTo.length - 1] !== topColor) {
          return { verified: false, error: 'Ход #' + (i + 1) + ': несовпадение цветов при переливании' };
        }
        let count = 0;
        for (let k = bFrom.length - 1; k >= 0; k--) {
          if (bFrom[k] === topColor) count++;
          else break;
        }
        const amount = Math.min(count, capacity - bTo.length);
        for (let k = 0; k < amount; k++) {
          bottles[fIdx].pop();
          bottles[tIdx].push(topColor);
        }
        validMoves++;
      }
    }

    const won = bottles.every(b => b.length === 0 || (b.length === capacity && b.every(c => c === b[0])));
    if (!won) {
      return { verified: false, error: 'Уровень не завершён: не все колбочки собраны по цветам' };
    }

    const lvl = Math.max(1, Number(levelNumber || 1));
    const minRealistic = lvl === 1 ? 6 : (lvl === 2 ? 8 : (lvl === 3 ? 10 : (lvl === 4 ? 12 : (lvl === 5 ? 14 : Math.max(15, Math.floor(colorCount * 1.3))))));
    if (validMoves < minRealistic) {
      return { verified: false, error: `Подозрительная активность: уровень ${levelNumber} завершён за ${validMoves} ходов (требуется от ${minRealistic})` };
    }

    return { verified: true };
  }

  async function advanceToNextLevel() {
    if (isNextLevelLoading) return;
    if (!pendingLevelVictory) {
      closeModal(winModal);
      return;
    }

    // Strict Anti-Cheat Check: board must be completely sorted
    if (!engine || !engine.isLevelWon()) {
      console.warn('[Anti-Cheat] Progression rejected: board is not solved!');
      closeModal(winModal);
      showSecurityAlert('Замечена попытка перейти на следующий уровень без завершения текущего.');
      return;
    }

    isNextLevelLoading = true;
    if (nextLevelBtn) {
      nextLevelBtn.disabled = true;
      nextLevelBtn.innerHTML = '<span class="pulse">⏳ Проверка ходов...</span>';
    }

    const victoryData = pendingLevelVictory;
    const completedToken = victoryData.sessionToken;
    const completedMoves = victoryData.moves;
    const levelCompleted = victoryData.levelNumber;
    const durationMs = victoryData.durationMs;
    const boostersUsed = victoryData.boostersUsed;
    const movesCount = victoryData.movesCount;

    let serverVerified = false;
    let verifiedUser = null;
    let rejectionError = null;

    try {
      const res = await apiCall('/api/game/complete-level', 'POST', {
        sessionToken: completedToken,
        levelNumber: levelCompleted,
        moves: completedMoves,
        boostersUsed,
        movesCount,
        durationMs
      });

      if (res && res.success) {
        serverVerified = true;
        if (res.user) verifiedUser = res.user;
      } else {
        // Fallback check for offline / network issues / serverless cold starts
        const localCheck = verifyVictoryLocally(levelCompleted, completedMoves, boostersUsed, durationMs);
        if (localCheck.verified || (engine && engine.isLevelWon())) {
          serverVerified = true;
          rejectionError = null;
        } else {
          rejectionError = localCheck.error || (res && res.error) || 'Замечены невозможные комбинации ходов или накрутка уровня.';
        }
      }
    } catch (e) {
      const localCheck = verifyVictoryLocally(levelCompleted, completedMoves, boostersUsed, durationMs);
      if (localCheck.verified || (engine && engine.isLevelWon())) {
        serverVerified = true;
        rejectionError = null;
      } else {
        rejectionError = localCheck.error || 'Ошибка проверки прохождения уровня.';
      }
    }

    // Admins are unconditionally authorized
    if (isAlligatorAdmin(currentUser)) {
      serverVerified = true;
      rejectionError = null;
    }

    if (rejectionError) {
      console.warn('[Anti-Cheat Progression Blocked]:', rejectionError);
      pendingLevelVictory = null;
      isNextLevelLoading = false;
      closeModal(winModal);
      showSecurityAlert(rejectionError);
      return;
    }

    if (serverVerified) {
      // Official progression authorized!
      if (verifiedUser) {
        currentUser = normalizeUserObject(verifiedUser);
      } else {
        currentUser.currentLevel = levelCompleted + 1;
        currentUser.maxLevel = Math.max(currentUser.maxLevel || 0, currentUser.currentLevel);
        currentUser.level = currentUser.maxLevel;
      }
      currentUser.seasonResetAt = Number(localStorage.getItem('color_sort_season_reset_at') || 0);
      currentUser.updatedAt = Date.now();
      saveLocalUser();
      updateHeaderUI();
      syncPlayerToCloud(currentUser);

      pendingLevelVictory = null;
      closeModal(winModal);
      await loadCurrentLevel();
      isNextLevelLoading = false;
    } else {
      isNextLevelLoading = false;
      if (nextLevelBtn) {
        nextLevelBtn.disabled = false;
        nextLevelBtn.innerHTML = 'Следующий уровень 🚀';
      }
    }
  }

  engine.onWin = ({ levelNumber, moves, boostersUsed }) => {
    if (window.__seasonResetKicking || (typeof isSeasonResetKicked !== 'undefined' && isSeasonResetKicked)) {
      return;
    }
    const localReset = Number(localStorage.getItem('color_sort_season_reset_at') || 0);
    const userReset = Number(currentUser.seasonResetAt || currentUser.season_reset_at || 0);
    if (localReset > 0 && userReset < localReset) {
      if (typeof triggerSeasonResetKick === 'function') {
        triggerSeasonResetKick(localReset);
      }
      return;
    }

    // Verify engine state strictly
    if (!engine || !engine.isLevelWon()) {
      console.warn('[Anti-Cheat] Premature onWin triggered without won board');
      return;
    }

    if (renderer && renderer.triggerWinConfetti) renderer.triggerWinConfetti();

    // Prepare pending victory details (do NOT advance currentUser level yet!)
    const now = Date.now();
    const durationMs = Math.max(1200, now - (currentLevelStartedAt || now));
    const totalBoostersUsed = (currentLevelBoostersUsed.hints || 0) +
                              (currentLevelBoostersUsed.undos || 0) +
                              (currentLevelBoostersUsed.reveals || 0) +
                              (currentLevelBoostersUsed.extraBottles || 0);

    const actualMovesCount = activeMovesLog.filter(m => m && m.from !== undefined).length || moves || engine.movesCount || 0;

    pendingLevelVictory = {
      levelNumber,
      sessionToken: activeGameSessionToken,
      moves: [...activeMovesLog],
      movesCount: actualMovesCount,
      boostersUsed: { ...currentLevelBoostersUsed },
      totalBoostersUsed,
      startedAt: currentLevelStartedAt,
      completedAt: now,
      durationMs
    };

    // Populate win modal elements
    const winTitle = document.getElementById('winModalTitle');
    const winSubtext = document.getElementById('winModalSubtext');
    if (winTitle) winTitle.textContent = t('winTitle', levelNumber) || 'Уровень пройден!';
    if (winSubtext) winSubtext.textContent = t('winSubtext', levelNumber + 1) || `Уровень ${levelNumber} успешно собран!`;
    if (winModalMovesCount) winModalMovesCount.textContent = actualMovesCount;
    if (winModalBoostersCount) winModalBoostersCount.textContent = totalBoostersUsed;
    if (winModalTimeElapsed) winModalTimeElapsed.textContent = `${Math.max(1, Math.round(durationMs / 1000))} сек.`;

    if (nextLevelBtn) {
      nextLevelBtn.disabled = false;
      nextLevelBtn.innerHTML = 'Следующий уровень 🚀';
    }

    if (typeof checkServerStatus === 'function') checkServerStatus(false);

    // Show victory modal without any auto-advance timer
    setTimeout(() => {
      openModal(winModal);
      if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('success');
    }, 400);
  };

  // Move tracking hook for server verification
  engine.onMove = ({ from, to, movesCount }) => {
    activeMovesLog.push({ from, to });
    if (activeGameSessionToken) {
      apiCall('/api/game/move', 'POST', {
        sessionToken: activeGameSessionToken,
        fromIndex: from,
        toIndex: to,
        from,
        to
      }).catch(() => {});
    }
  };

  // 8. Load level immediately
  async function loadCurrentLevel() {
    if (typeof checkServerStatus === 'function') checkServerStatus(false);
    
    // Always guarantee currentLevel and maxLevel match so bottle count strictly corresponds to level
    const targetLvl = Math.max(1, Number(currentUser.currentLevel || 1), Number(currentUser.maxLevel || 1));
    currentUser.currentLevel = targetLvl;
    if (Number(currentUser.maxLevel || 0) < targetLvl) {
      currentUser.maxLevel = targetLvl;
      currentUser.level = targetLvl;
    }

    if (levelDisplay) levelDisplay.textContent = Number(currentUser.maxLevel || targetLvl);
    if (LG && LG.generateLevel) {
      currentLevelData = LG.generateLevel(targetLvl);
      engine.startLevel(currentLevelData);

      // Start authoritative server game session
      currentLevelStartedAt = Date.now();
      currentLevelBoostersUsed = { hints: 0, undos: 0, reveals: 0, extraBottles: 0 };
      pendingLevelVictory = null;
      activeMovesLog = [];
      activeGameSessionToken = null;
      apiCall('/api/game/start-level', 'POST', {
        levelNumber: targetLvl
      }).then(res => {
        if (res && res.success && res.sessionToken) {
          activeGameSessionToken = res.sessionToken;
        }
      }).catch(() => {});

      // Explicitly render board to guarantee DOM is populated immediately
      if (renderer && renderer.renderBoard) {
        renderer.renderBoard(engine);
      }

      updateHeaderUI();
    }
  }
  loadCurrentLevel();
  updateHeaderUI();

  // Initialize Gifts Module safely
  if (window.GiftsModule) {
    try {
      window.GiftsModule.init(currentUser, {
        saveUser: saveLocalUser,
        updateUI: () => {
          updateHeaderUI();
          if (typeof updateTonWalletUI === 'function') updateTonWalletUI();
          if (typeof updateShopUI === 'function') updateShopUI();
        },
        updateTonWalletUI: updateTonWalletUI,
        updateShopUI: updateShopUI,
        syncPlayerToCloud: () => syncPlayerToCloud(currentUser),
        updateCloudBooster: updateCloudBoosterDirectly,
        showInfoModal: showInfoModal,
        isAdmin: (u) => isAlligatorAdmin(u || currentUser),
        getLeaderboardPlayers: async () => {
          try {
            return await loadLeaderboardData();
          } catch (e) {
            return [];
          }
        },
        lang: currentLang,
        t: t
      });
      // Real-time gift listener: check pending gifts immediately and every 12 seconds in the background
      if (typeof window.GiftsModule.checkPendingGifts === 'function') {
        window.GiftsModule.checkPendingGifts(false);
        setInterval(() => {
          try {
            if (window.GiftsModule && typeof window.GiftsModule.checkPendingGifts === 'function') {
              window.GiftsModule.checkPendingGifts(false);
            }
          } catch (e) {}
        }, 12000);
      }
    } catch (giftInitErr) {
      console.error('[GiftsModule] Safe initialization caught error:', giftInitErr);
    }
  }

  // Background Cloud Sync & Init (non-blocking for instant startup)
  apiCall('/api/user/init', 'POST', userData).then(serverUser => {
    if (serverUser && serverUser.success && serverUser.user) {
      const localReset = Number(localStorage.getItem('color_sort_season_reset_at') || 0);
      const serverReset = Number(serverUser.seasonResetAt || 0);
      if (serverReset > localReset) {
        localStorage.setItem('color_sort_season_reset_at', String(serverReset));
        currentUser.currentLevel = 1;
        currentUser.maxLevel = 0;
        currentUser.stars = 0;
        currentUser.coins = 0;
        // NOTE: hints, undos, reveals, extraBottles, all_colors_until, ton_wallet, ton_balance, memo_code and referrals are PRESERVED!
        currentUser.season_reset_at = serverReset;
        saveLocalUser();
        updateHeaderUI();
        updateShopUI();
        loadCurrentLevel();
      }
      const oldLevel = currentUser.currentLevel;

      const localUpdatedAt = Number(currentUser.updatedAt || 0);
      const serverUpdatedAt = serverUser.user.updated_at ? new Date(serverUser.user.updated_at).getTime() : Number(serverUser.user.updatedAt || 0);

      // Only adopt server booster counts if server state is strictly newer than local state
      if (serverUpdatedAt > localUpdatedAt) {
        if (serverUser.user.hints !== undefined) currentUser.hints = Number(serverUser.user.hints || 0);
        if (serverUser.user.undos !== undefined) currentUser.undos = Number(serverUser.user.undos || 0);
        if (serverUser.user.reveals !== undefined) currentUser.reveals = Number(serverUser.user.reveals || 0);
        const serverB = serverUser.user.extra_bottles !== undefined ? serverUser.user.extra_bottles : serverUser.user.extraBottles;
        if (serverB !== undefined) {
          currentUser.extraBottles = Number(serverB || 0);
          currentUser.extra_bottles = currentUser.extraBottles;
        }
      } else {
        // Local state is newer or equal (player spent/gifted boosters): push local state to server and cloud
        syncPlayerToCloud(currentUser);
      }
      if (serverUser.user.all_colors_until !== undefined) currentUser.all_colors_until = Math.max(currentUser.all_colors_until || 0, Number(serverUser.user.all_colors_until || 0));
      if (serverUser.user.all_colors_purchased_at !== undefined) currentUser.all_colors_purchased_at = Math.max(currentUser.all_colors_purchased_at || 0, Number(serverUser.user.all_colors_purchased_at || 0));
      if (serverUser.user.daily_boosters_days_left !== undefined) {
        if (serverUser.user.daily_boosters_last_date && serverUser.user.daily_boosters_last_date > (currentUser.daily_boosters_last_date || '')) {
          currentUser.daily_boosters_days_left = Number(serverUser.user.daily_boosters_days_left || 0);
          currentUser.daily_boosters_last_date = serverUser.user.daily_boosters_last_date;
        } else {
          currentUser.daily_boosters_days_left = Math.max(Number(currentUser.daily_boosters_days_left || 0), Number(serverUser.user.daily_boosters_days_left || 0));
        }
        currentUser.dailyBoostersDaysLeft = currentUser.daily_boosters_days_left;
      }
      if (serverUser.user.daily_boosters_last_date && !currentUser.daily_boosters_last_date) {
        currentUser.daily_boosters_last_date = serverUser.user.daily_boosters_last_date;
      }
      if (serverUser.user.daily_boosters_purchased_at && !currentUser.daily_boosters_purchased_at) {
        currentUser.daily_boosters_purchased_at = Number(serverUser.user.daily_boosters_purchased_at);
      }
      if (serverUser.user.ton_balance !== undefined) {
        const sb = Number(serverUser.user.ton_balance || 0);
        if (!currentUser._localLoaded || currentUser.ton_balance === undefined || currentUser.ton_balance === null) {
          currentUser.ton_balance = sb;
        } else if (sb > Number(currentUser.ton_balance || 0)) {
          currentUser.ton_balance = sb;
        }
      }
      if (serverUser.user.ton_wallet !== undefined) {
        const isManuallyDisconnected = localStorage.getItem(`color_sort_wallet_disconnected_${currentUser.telegramId}`) === 'true';
        if (!isManuallyDisconnected) {
          currentUser.ton_wallet = serverUser.user.ton_wallet || currentUser.ton_wallet;
        }
      }
      if (serverUser.user.memo_code !== undefined) currentUser.memo_code = serverUser.user.memo_code || currentUser.memo_code;
      if (serverUser.user.max_level !== undefined) {
        const srvMax = Number(serverUser.user.max_level || 0);
        const srvRestore = Number(serverUser.user.snapshotRestoredAt || serverUser.restoredAt || 0);
        const localRestore = Number(localStorage.getItem(`color_sort_restored_at_${currentUser.telegramId}`) || currentUser.lastSnapshotRestoredAt || 0);
        const isNewSrvRestore = srvRestore > 0 && srvRestore > localRestore;
        const baselineMax = (IMMUTABLE_PLAYER_BASELINES[String(currentUser.telegramId)]?.maxLevel || 0);
        const effectiveSrvMax = Math.max(srvMax, baselineMax);
        if (isNewSrvRestore) {
          currentUser.maxLevel = Math.max(Number(currentUser.maxLevel || 0), effectiveSrvMax);
          currentUser.level = currentUser.maxLevel;
          currentUser.lastSnapshotRestoredAt = srvRestore;
          localStorage.setItem(`color_sort_restored_at_${currentUser.telegramId}`, String(srvRestore));
          localStorage.setItem(`color_sort_db_level_${currentUser.telegramId}`, String(currentUser.maxLevel));
          if (currentUser.maxLevel === 0) {
            currentUser.currentLevel = 1;
            currentUser.stars = 0;
          }
        } else if (effectiveSrvMax > Number(currentUser.maxLevel || 0)) {
          currentUser.maxLevel = effectiveSrvMax;
          currentUser.level = effectiveSrvMax;
          localStorage.setItem(`color_sort_db_level_${currentUser.telegramId}`, String(effectiveSrvMax));
        }
      }
      if (serverUser.user.current_level !== undefined) {
        const srvCur = Number(serverUser.user.current_level || (currentUser.maxLevel > 0 ? currentUser.maxLevel : 1));
        currentUser.currentLevel = Math.max(1, srvCur, Number(currentUser.maxLevel || 1));
      }
      if (currentUser.maxLevel > 0 && currentUser.currentLevel < currentUser.maxLevel) {
        currentUser.currentLevel = currentUser.maxLevel;
      }
      if (serverUser.user.stars !== undefined) {
        currentUser.stars = Number(serverUser.user.stars || 0);
      }
      normalizeUserObject(currentUser);
      updateTonWalletUI();
      updateShopUI();
      saveLocalUser();
      updateHeaderUI();
      checkAndApplyClientDailyBoosters();
      if (!currentLevelData || currentLevelData.levelNumber !== currentUser.currentLevel || currentUser.currentLevel !== oldLevel) {
        loadCurrentLevel();
      }
    }
    checkGlobalSeasonReset();
  }).catch(() => {
    checkGlobalSeasonReset();
  }).finally(() => {
    scheduleStartUnlock();
  });

  // Pre-load leaderboard in background to ensure profile & leaderboard are 100% synchronized from boot
  setTimeout(() => {
    if (typeof loadLeaderboardData === 'function') {
      loadLeaderboardData().catch(() => {}).finally(() => {
        scheduleStartUnlock();
      });
    }
  }, 100);

  let isSeasonResetKicked = false;

  function triggerSeasonResetKick(resetTimestamp) {
    if (isSeasonResetKicked) return;
    isSeasonResetKicked = true;
    window.__seasonResetKicking = true;
    console.warn(`[Season Reset KICK] Admin season reset detected (${resetTimestamp})! Force kicking player to Level 0...`);

    // 1. Immediately halt audio and game inputs
    try {
      if (typeof audio !== 'undefined' && audio.stopAll) audio.stopAll();
      if (window.SoundEngine && window.SoundEngine.SoundEngine && window.SoundEngine.SoundEngine.stopAll) {
        window.SoundEngine.SoundEngine.stopAll();
      }
    } catch (e) {}
    if (engine) {
      engine.isAnimating = true; // Freeze game actions
    }

    // 2. Wipe player state strictly to Level 0 in RAM & LocalStorage
    currentUser.maxLevel = 0;
    currentUser.level = 0;
    currentUser.currentLevel = 1;
    currentUser.stars = 0;
    currentUser.coins = 0;
    // NOTE: hints, undos, reveals, extraBottles, all_colors_until, ton_wallet, ton_balance, memo_code and referrals are PRESERVED!
    currentUser.seasonResetAt = resetTimestamp;
    currentUser.season_reset_at = resetTimestamp;

    localStorage.setItem('color_sort_season_reset_at', String(resetTimestamp));
    saveLocalUser();
    updateHeaderUI();
    updateShopUI();
    updateTonWalletUI();

    // 3. Push Level 0 directly to Cloud DB immediately (preserving boosters)
    if (currentUser.telegramId) {
      const pid = String(currentUser.telegramId);
      if (!pid.startsWith('guest') && !pid.startsWith('dev') && /^\d+$/.test(pid)) {
        try {
          const payload = {
            telegramId: pid,
            firstName: currentUser.firstName || 'Игрок',
            username: currentUser.username || '',
            photoUrl: currentUser.photoUrl || '',
            maxLevel: 0,
            level: 0,
            currentLevel: 1,
            stars: 0,
            hints: Number(currentUser.hints || 0),
            undos: Number(currentUser.undos || 0),
            reveals: Number(currentUser.reveals || 0),
            extraBottles: Number(currentUser.extraBottles || 0),
            extra_bottles: Number(currentUser.extraBottles || 0),
            ton_balance: Number(currentUser.ton_balance || 0),
            ton_wallet: currentUser.ton_wallet || '',
            memo_code: currentUser.memo_code || '',
            all_colors_until: Number(currentUser.all_colors_until || 0),
            all_colors_purchased_at: Number(currentUser.all_colors_purchased_at || 0),
            seasonResetAt: resetTimestamp,
            updatedAt: Date.now()
          };
          fetch(`${GLOBAL_CLOUD_BASE}/player_${encodeURIComponent(pid)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            keepalive: true
          }).catch(() => {});
        } catch (e) {}
      }
    }

    // 4. Display the kick modal
    const kickModal = document.getElementById('seasonResetKickModal');
    if (kickModal) {
      kickModal.style.display = 'flex';
    }

    let timeLeft = 3;
    const timerEl = document.getElementById('seasonResetTimer');
    const kickOkBtn = document.getElementById('seasonResetKickOkBtn');

    function doReload() {
      window.location.reload(true);
    }

    if (kickOkBtn) {
      kickOkBtn.onclick = () => doReload();
    }

    const countdownInterval = setInterval(() => {
      timeLeft -= 1;
      if (timerEl) timerEl.textContent = String(timeLeft);
      if (timeLeft <= 0) {
        clearInterval(countdownInterval);
        doReload();
      }
    }, 1000);
  }

  // ==========================================
  // SERVER MAINTENANCE / RELOAD REALTIME KICK
  // ==========================================
  let isServerReloadKicked = false;

  function triggerServerReloadKick(reloadTimestamp) {
    if (isServerReloadKicked) return;
    isServerReloadKicked = true;
    console.warn(`[Server Reload KICK] Server reload broadcast detected (${reloadTimestamp})! Kicking active players for security update...`);

    // 1. Immediately halt audio and game inputs
    try {
      if (typeof audio !== 'undefined' && audio.stopAll) audio.stopAll();
      if (window.SoundEngine && window.SoundEngine.SoundEngine && window.SoundEngine.SoundEngine.stopAll) {
        window.SoundEngine.SoundEngine.stopAll();
      }
    } catch (e) {}
    if (engine) {
      engine.isAnimating = true; // Freeze game actions
    }

    // 2. Display the reload kick modal
    const reloadModal = document.getElementById('serverReloadModal');
    if (reloadModal) {
      reloadModal.style.display = 'flex';
    }

    let timeLeft = 3;
    const timerEl = document.getElementById('serverReloadTimer');
    const reloadOkBtn = document.getElementById('serverReloadOkBtn');

    function doReload() {
      localStorage.setItem('color_sort_server_reload_at', String(reloadTimestamp));
      const url = new URL(window.location.href);
      url.searchParams.set('_v', String(Date.now()));
      window.location.replace(url.toString());
    }

    if (reloadOkBtn) {
      reloadOkBtn.onclick = () => doReload();
    }

    const countdownInterval = setInterval(() => {
      timeLeft -= 1;
      if (timerEl) timerEl.textContent = `${timeLeft} сек`;
      if (timeLeft <= 0) {
        clearInterval(countdownInterval);
        doReload();
      }
    }, 1000);
  }

  // =========================================================================
  // BATTERY & CPU OPTIMIZATION: ZERO BACKGROUND POLLING DURING GAMEPLAY
  // No periodic intervals while solving levels.
  // Checks execute ONLY on actual events: app launch, level win, tab focus.
  // Strict 60-second cooldown guard prevents excessive network requests.
  // =========================================================================
  let lastServerStatusCheck = 0;
  const SERVER_CHECK_COOLDOWN_MS = 60000; // 60s minimum throttle

  async function checkServerStatus(force = false) {
    if (isServerReloadKicked || isSeasonResetKicked) return;
    const now = Date.now();
    if (!force && (now - lastServerStatusCheck < SERVER_CHECK_COOLDOWN_MS)) return;
    lastServerStatusCheck = now;

    try {
      await Promise.allSettled([
        checkServerReloadWatchdog(),
        checkLiveSeasonResetWatchdog()
      ]);
    } catch (e) {}
  }

  async function checkServerReloadWatchdog() {
    if (isServerReloadKicked) return;
    const now = Date.now();

    try {
      let reloadAt = 0;

      // 1. Check KVDB Cloud
      try {
        const res = await fetch(`${GLOBAL_CLOUD_BASE}/meta_server_reload_at?_cb=${now}`, {
          cache: 'no-store',
          signal: (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') ? AbortSignal.timeout(2000) : undefined
        });
        if (res.ok) {
          const rawText = await res.text();
          try {
            const data = JSON.parse(rawText);
            reloadAt = Number(data.reloadAt || data) || 0;
          } catch (e) {
            reloadAt = Number(rawText) || 0;
          }
        }
      } catch (e) {}

      // 2. Check API endpoint fallback
      if (!reloadAt) {
        try {
          const sRes = await apiCall('/api/config/server-reload');
          if (sRes && sRes.success && sRes.reloadAt) {
            reloadAt = Number(sRes.reloadAt) || 0;
          }
        } catch (e) {}
      }

      const localReloadAt = Number(localStorage.getItem('color_sort_server_reload_at') || 0);
      if (reloadAt > 0 && reloadAt > localReloadAt) {
        triggerServerReloadKick(reloadAt);
      }
    } catch (err) {}
  }

  async function checkLiveSeasonResetWatchdog() {
    if (isSeasonResetKicked) return;
    const now = Date.now();

    try {
      let resetAt = 0;
      try {
        const res = await fetch(`${GLOBAL_CLOUD_BASE}/meta_season_reset_at?_cb=${now}`, {
          cache: 'no-store',
          signal: (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') ? AbortSignal.timeout(2000) : undefined
        });
        if (res.status === 429) {
          return;
        }
        if (res.ok) {
          const rawText = await res.text();
          try {
            const data = JSON.parse(rawText);
            resetAt = Number(data.resetAt || data) || 0;
          } catch (e) {
            resetAt = Number(rawText) || 0;
          }
        }
      } catch (e) {}

      if (!resetAt) {
        try {
          const sRes = await apiCall('/api/config/season-status');
          if (sRes && sRes.success && sRes.seasonResetAt) {
            resetAt = Number(sRes.seasonResetAt) || 0;
          }
        } catch (e) {}
      }

      const localResetAt = Number(localStorage.getItem('color_sort_season_reset_at') || 0);
      const userSeasonReset = Number(currentUser.seasonResetAt || currentUser.season_reset_at || 0);
      const userUpdated = Number(currentUser.updatedAt || 0);

      if (resetAt > 0) {
        if (userUpdated >= resetAt || userSeasonReset >= resetAt) {
          currentUser.seasonResetAt = Math.max(userSeasonReset, resetAt);
          currentUser.season_reset_at = currentUser.seasonResetAt;
          localStorage.setItem('color_sort_season_reset_at', String(Math.max(localResetAt, resetAt)));
          return;
        }
        if (localResetAt > 0 && resetAt > localResetAt && userSeasonReset < resetAt && userUpdated < resetAt) {
          triggerSeasonResetKick(resetAt);
        } else if (localResetAt === 0) {
          localStorage.setItem('color_sort_season_reset_at', String(resetAt));
          currentUser.seasonResetAt = resetAt;
          currentUser.season_reset_at = resetAt;
        }
      }
    } catch (e) {}
  }

  async function checkGlobalSeasonReset() {
    return checkLiveSeasonResetWatchdog();
  }

  // Event-driven triggers: Boot (1 time) + Returning from background (throttled)
  setTimeout(() => checkServerStatus(true), 1500);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkServerStatus(false);
    }
  });

  window.addEventListener('focus', () => {
    checkServerStatus(false);
  });

  initAdsgram().catch(() => {});
  setTimeout(() => {
    initTonConnect();
  }, 100);

  function updateHeaderUI() {
    function setIfDiff(el, val) {
      if (!el) return;
      const strVal = String(val);
      if (el.textContent !== strVal) {
        el.textContent = strVal;
      }
    }

    if (levelBadgeLabel) setIfDiff(levelBadgeLabel, t('levelLabel'));
    const displayLevel = Math.max(1, Number(currentUser.maxLevel || 1), Number(currentUser.currentLevel || 1));
    setIfDiff(levelDisplay, displayLevel);
    setIfDiff(profileCardLevel, t('levelDisplayVal', displayLevel));
    try {
      localStorage.setItem('cs_cached_display_level', String(displayLevel));
    } catch (e) {}

    // Unconditional Level-Board Integrity Guardian:
    // Guarantees board flasks NEVER lag behind header level (e.g. showing Level 1 bottles when header is Level 50)
    if (!isLevelGuardianRunning && typeof LG !== 'undefined' && LG && LG.generateLevel && engine) {
      if (!currentLevelData || currentLevelData.levelNumber !== displayLevel || engine.currentLevel !== displayLevel) {
        isLevelGuardianRunning = true;
        try {
          console.warn(`[Level Guardian] Auto-repairing board desync: Header level is ${displayLevel}, but engine level is ${engine ? engine.currentLevel : 0}. Regenerating board for Level ${displayLevel}...`);
          currentUser.currentLevel = displayLevel;
          currentUser.maxLevel = displayLevel;
          currentUser.level = displayLevel;
          currentLevelData = LG.generateLevel(displayLevel);
          engine.startLevel(currentLevelData);
          if (renderer && renderer.renderBoard) {
            renderer.renderBoard(engine);
          }
        } finally {
          isLevelGuardianRunning = false;
        }
      }
    }

    setIfDiff(coinsDisplay, currentUser.coins || 0);
    setIfDiff(hintsCountDisplay, currentUser.hints || 0);
    setIfDiff(undosCountDisplay, currentUser.undos || 0);
    const movesDisplay = document.getElementById('movesDisplay');
    setIfDiff(movesDisplay, engine.movesCount || 0);

    // Badges on buttons in toolbar
    const undoBadge = document.getElementById('undoBadge');
    if (undoBadge) {
      const uCount = currentUser.undos || 0;
      setIfDiff(undoBadge, uCount);
      const isZero = uCount === 0;
      if (undoBadge.classList.contains('badge-zero') !== isZero) {
        undoBadge.classList.toggle('badge-zero', isZero);
      }
    }

    const hintBadge = document.getElementById('hintBadge');
    if (hintBadge) {
      const hCount = currentUser.hints || 0;
      setIfDiff(hintBadge, hCount);
      const isZero = hCount === 0;
      if (hintBadge.classList.contains('badge-zero') !== isZero) {
        hintBadge.classList.toggle('badge-zero', isZero);
      }
    }

    const revealBadge = document.getElementById('revealBadge');
    if (revealBadge) {
      const rCount = currentUser.reveals || 0;
      setIfDiff(revealBadge, rCount);
      const isZero = rCount === 0;
      if (revealBadge.classList.contains('badge-zero') !== isZero) {
        revealBadge.classList.toggle('badge-zero', isZero);
      }
    }

    const extraBottleBadge = document.getElementById('extraBottleBadge');
    if (extraBottleBadge) {
      const bCount = currentUser.extraBottles || 0;
      setIfDiff(extraBottleBadge, bCount);
      const isZero = bCount === 0;
      if (extraBottleBadge.classList.contains('badge-zero') !== isZero) {
        extraBottleBadge.classList.toggle('badge-zero', isZero);
      }
    }

    // Modal user counters
    const youStr = t('youTag') ? t('youTag').replace(/[()]/g, '') : 'у вас';
    const adModalHintsCount = document.getElementById('adModalHintsCount');
    if (adModalHintsCount) {
      setIfDiff(adModalHintsCount, `(${youStr}: ${currentUser.hints || 0})`);
    }
    const adModalUndosCount = document.getElementById('adModalUndosCount');
    if (adModalUndosCount) {
      setIfDiff(adModalUndosCount, `(${youStr}: ${currentUser.undos || 0})`);
    }
    const adModalRevealsCount = document.getElementById('adModalRevealsCount');
    if (adModalRevealsCount) {
      setIfDiff(adModalRevealsCount, `(${youStr}: ${currentUser.reveals || 0})`);
    }
    const adModalExtraBottlesCount = document.getElementById('adModalExtraBottlesCount');
    if (adModalExtraBottlesCount) {
      setIfDiff(adModalExtraBottlesCount, `(${youStr}: ${currentUser.extraBottles || 0})`);
    }

    if (window.GiftsModule) {
      window.GiftsModule.checkPendingGifts();
    }
  }

  // 9. Bind button events
  if (restartBtn) {
    restartBtn.addEventListener('click', (e) => {
      if (justStartedGame || modalJustClosed) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        return;
      }
      if (restartModal) {
        openModal(restartModal);
      } else if (confirm('Начать уровень заново?')) {
        engine.startLevel(currentLevelData);
        if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('light');
      }
    });
  }

  if (confirmRestartBtn && restartModal) {
    confirmRestartBtn.addEventListener('click', () => {
      closeModal(restartModal);
      engine.startLevel(currentLevelData);
      if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('light');
    });
  }
  if (cancelRestartBtn && restartModal) {
    cancelRestartBtn.addEventListener('click', () => {
      closeModal(restartModal);
    });
  }

  if (restartModal) {
    restartModal.addEventListener('click', (e) => {
      if (e.target === restartModal) {
        closeModal(restartModal);
      }
    });
  }

  function restartCurrentLevelSecurity() {
    if (securityAlertModal) closeModal(securityAlertModal);
    if (currentLevelData) {
      engine.startLevel(currentLevelData);
    } else {
      loadCurrentLevel();
    }
    if (renderer && renderer.renderBoard) renderer.renderBoard(engine);
    updateHeaderUI();
    if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('light');
  }

  if (securityAlertRestartBtn) {
    securityAlertRestartBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      restartCurrentLevelSecurity();
    });
  }

  if (securityAlertModal) {
    securityAlertModal.addEventListener('click', (e) => {
      if (e.target === securityAlertModal) {
        restartCurrentLevelSecurity();
      }
    });
  }

  if (undoBtn) {
    undoBtn.addEventListener('click', async (e) => {
      if (justStartedGame || modalJustClosed) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        return;
      }
      if (!engine.history || engine.history.length === 0) {
        showInfoModal('↩️', t('noMovesTitle'), t('noMovesDesc'));
        return;
      }

      if ((currentUser.undos || 0) <= 0) {
        showInfoModal(
          '↩️',
          'Отмена хода',
          'У вас 0 отмен хода. Посмотрите короткую рекламу, чтобы получить отмену хода в счётчик!',
          '▶ Смотреть рекламу (+1)',
          async () => {
            await watchRewardedAdForBonus('undos');
          }
        );
        return;
      }

      const success = engine.undo();
      if (success) {
        if (activeMovesLog.length > 0) activeMovesLog.pop();
        engine.boostersUsedInLevel = (engine.boostersUsedInLevel || 0) + 1;
        currentLevelBoostersUsed.undos = (currentLevelBoostersUsed.undos || 0) + 1;
        currentUser.undos = Math.max(0, (currentUser.undos || 0) - 1);
        updateHeaderUI();
        saveLocalUser();
        if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('medium');

        apiCall('/api/game/use-booster', 'POST', {
          sessionToken: activeGameSessionToken,
          boosterType: 'undos'
        }).then(res => {
          if (res && res.success && res.remaining !== undefined) {
            currentUser.undos = res.remaining;
            updateHeaderUI();
            saveLocalUser();
          }
        }).catch(() => {});
      }
    });
  }

  if (hintBtn) {
    hintBtn.addEventListener('click', async (e) => {
      if (justStartedGame || modalJustClosed) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        return;
      }
      if ((currentUser.hints || 0) <= 0) {
        showInfoModal(
          '💡',
          'Подсказка',
          'У вас 0 подсказок. Посмотрите короткую рекламу, чтобы получить подсказку хода в счётчик!',
          '▶ Смотреть рекламу (+1)',
          async () => {
            await watchRewardedAdForBonus('hints');
          }
        );
        return;
      }

      const hint = engine.getHint();
      if (hint) {
        engine.boostersUsedInLevel = (engine.boostersUsedInLevel || 0) + 1;
        currentLevelBoostersUsed.hints = (currentLevelBoostersUsed.hints || 0) + 1;
        currentUser.hints = Math.max(0, (currentUser.hints || 0) - 1);
        updateHeaderUI();
        saveLocalUser();
        if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('medium');

        apiCall('/api/game/use-booster', 'POST', {
          sessionToken: activeGameSessionToken,
          boosterType: 'hints'
        }).then(res => {
          if (res && res.success && res.remaining !== undefined) {
            currentUser.hints = res.remaining;
            updateHeaderUI();
            saveLocalUser();
          }
        }).catch(() => {});
      } else {
        const desc = engine.hasHiddenColors() ? t('noHintDesc') : t('allColorsVisibleDesc');
        showInfoModal('🤷', t('noMovesTitle'), desc || t('noHintDesc'));
      }
    });
  }

  if (revealBottleBtn) {
    revealBottleBtn.addEventListener('click', async (e) => {
      if (justStartedGame || modalJustClosed) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        return;
      }
      if (!engine.hasHiddenColors()) {
        showInfoModal('🧪', t('allColorsVisibleTitle'), t('allColorsVisibleDesc'));
        return;
      }

      if ((currentUser.reveals || 0) <= 0) {
        showInfoModal(
          '🧪',
          'Открыть цвета',
          'У вас 0 открытий. Посмотрите короткую рекламу, чтобы получить открытие цвета в счётчик!',
          '▶ Смотреть рекламу (+1)',
          async () => {
            await watchRewardedAdForBonus('reveal_bottle');
          }
        );
        return;
      }

      const res = engine.revealRandomBottle();
      if (res) {
        engine.boostersUsedInLevel = (engine.boostersUsedInLevel || 0) + 1;
        currentLevelBoostersUsed.reveals = (currentLevelBoostersUsed.reveals || 0) + 1;
        currentUser.reveals = Math.max(0, (currentUser.reveals || 0) - 1);
        if (renderer && renderer.highlightBottleReveal) renderer.highlightBottleReveal(res.bottleIndex);
        if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('success');
        if (window.SoundEngine && window.SoundEngine.SoundEngine) window.SoundEngine.SoundEngine.playComplete();
        updateHeaderUI();
        saveLocalUser();

        apiCall('/api/game/use-booster', 'POST', {
          sessionToken: activeGameSessionToken,
          boosterType: 'reveals'
        }).then(res => {
          if (res && res.success && res.remaining !== undefined) {
            currentUser.reveals = res.remaining;
            updateHeaderUI();
            saveLocalUser();
          }
        }).catch(() => {});
      }
    });
  }

  if (extraBottleBtn) {
    extraBottleBtn.addEventListener('click', async (e) => {
      if (justStartedGame || modalJustClosed) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        return;
      }
      if (engine.isWon || engine.isAnimating) return;

      if ((currentUser.extraBottles || 0) <= 0) {
        showInfoModal(
          '🧪',
          t('extraBottleModalTitle') || 'Пустая колба',
          t('outOfBottlesPrompt') || 'У вас 0 пустых колб. Посмотрите короткую рекламу, чтобы получить пустую колбу в счётчик!',
          t('claimAdBtn') || '▶ Смотреть рекламу (+1)',
          async () => {
            await watchRewardedAdForBonus('extra_bottle');
          }
        );
        return;
      }

      const added = engine.addExtraBottle();
      if (added) {
        activeMovesLog.push({ type: 'extra_bottle' });
        engine.boostersUsedInLevel = (engine.boostersUsedInLevel || 0) + 1;
        currentLevelBoostersUsed.extraBottles = (currentLevelBoostersUsed.extraBottles || 0) + 1;
        currentUser.extraBottles = Math.max(0, (currentUser.extraBottles || 0) - 1);
        currentUser.extra_bottles = currentUser.extraBottles;
        if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('success');
        if (window.SoundEngine && window.SoundEngine.SoundEngine) window.SoundEngine.SoundEngine.playComplete();
        updateHeaderUI();
        saveLocalUser();

        apiCall('/api/game/use-booster', 'POST', {
          sessionToken: activeGameSessionToken,
          boosterType: 'extra_bottles'
        }).then(res => {
          if (res && res.success && res.remaining !== undefined) {
            currentUser.extraBottles = res.remaining;
            currentUser.extra_bottles = res.remaining;
            updateHeaderUI();
            saveLocalUser();
          }
        }).catch(() => {});
      }
    });
  }



  if (nextLevelBtn) {
    nextLevelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      advanceToNextLevel();
    });
  }

  if (winModal) {
    winModal.addEventListener('click', (e) => {
      // Do NOT auto-advance when clicking outside/backdrop. Player must click the nextLevelBtn!
      e.stopPropagation();
    });
  }

  if (soundToggleBtn) {
    soundToggleBtn.addEventListener('click', () => {
      const SE = window.SoundEngine && window.SoundEngine.SoundEngine ? window.SoundEngine.SoundEngine : null;
      if (SE) {
        const isMuted = SE.toggleMute();
        soundToggleBtn.textContent = isMuted ? '🔇' : '🔊';
        if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('light');
      }
    });
  }

  async function loadLeaderboardData() {
    if (!leaderboardList) return;
    leaderboardList.innerHTML = `
      <li class="leaderboard-item" style="justify-content: center; opacity: 0.7; padding: 24px 0;">
        <span class="pulse">${t('leaderboardLoading')}</span>
      </li>
    `;

    const isRealUser = currentUser.telegramId && 
      !String(currentUser.telegramId).startsWith('guest') && 
      !String(currentUser.telegramId).startsWith('dev') &&
      /^\d+$/.test(String(currentUser.telegramId));

    let players = [];

    let hasLoadedFromServer = false;

    // 1. Fetch from Server API first (fast, reliable, SQLite backed, single source of truth)
    try {
      const serverData = await apiCall(`/api/leaderboard?telegramId=${encodeURIComponent(currentUser.telegramId || '')}`);
      if (serverData && serverData.success && Array.isArray(serverData.topPlayers) && serverData.topPlayers.length > 0) {
        serverData.topPlayers.forEach(sp => {
          players.push({
            telegramId: String(sp.telegram_id || sp.telegramId),
            firstName: sp.first_name || sp.firstName || 'Игрок',
            username: sp.username || '',
            photoUrl: sp.photo_url || sp.photoUrl || '',
            maxLevel: Number(sp.max_level !== undefined ? sp.max_level : (sp.maxLevel || 1)),
            level: Number(sp.max_level !== undefined ? sp.max_level : (sp.maxLevel || 1)),
            stars: Number(sp.stars || 0),
            isServer: true
          });
        });
        hasLoadedFromServer = true;
      }
    } catch (e) {
      console.warn('[Leaderboard] Server API fetch notice:', e.message);
    }

    // 2. Fallback to Cloud Database directly (for GitHub Pages static environment where /api is not available)
    if (!hasLoadedFromServer || players.length === 0) {
      try {
        const cloudRes = await fetch(`${GLOBAL_CLOUD_BASE}/?prefix=player_&values=true&format=json&_cb=${Date.now()}`, {
          cache: 'no-store',
          signal: (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') ? AbortSignal.timeout(3500) : undefined
        });
        if (cloudRes.ok) {
          const pairs = await cloudRes.json();
          if (Array.isArray(pairs)) {
            const cloudPlayers = pairs
              .map(([k, p]) => {
                if (typeof p === 'string') {
                  try { return JSON.parse(p); } catch (e) { return null; }
                }
                return p;
              })
              .filter(p => p && p.telegramId && !String(p.telegramId).startsWith('guest') && !String(p.telegramId).startsWith('dev') && /^\d+$/.test(String(p.telegramId)));

            cloudPlayers.forEach(cp => {
              const cpLvl = Number(cp.maxLevel !== undefined ? cp.maxLevel : (cp.level || cp.max_level || 0));
              players.push({
                telegramId: String(cp.telegramId),
                firstName: cp.firstName || cp.first_name || 'Игрок',
                username: cp.username || '',
                photoUrl: cp.photoUrl || cp.photo_url || '',
                maxLevel: cpLvl,
                level: cpLvl,
                stars: Number(cp.stars || 0),
                seasonResetAt: Number(cp.seasonResetAt || cp.season_reset_at || 0),
                updatedAt: Number(cp.updatedAt || 0)
              });
            });
          }
        }
      } catch (e) {
        console.warn('[Leaderboard] Cloud DB fetch notice:', e.message);
      }
    }

    // 3. Single source of truth: align current user's level across profile, game, and leaderboard
    const SEASON_RESET_FLOOR = 1789324758606;
    let effectiveSeasonReset = Math.max(Number(localStorage.getItem('color_sort_season_reset_at') || 0), SEASON_RESET_FLOOR);
    try {
      const metaRes = await fetch(`${GLOBAL_CLOUD_BASE}/meta_season_reset_at?_cb=${Date.now()}`, {
        cache: 'no-store',
        signal: (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') ? AbortSignal.timeout(2500) : undefined
      });
      if (metaRes.ok) {
        const metaText = await metaRes.text();
        let sReset = 0;
        try { const mJson = JSON.parse(metaText); sReset = Number(mJson.resetAt || mJson || 0); } catch(e) { sReset = Number(metaText || 0); }
        if (sReset > effectiveSeasonReset) {
          effectiveSeasonReset = sReset;
          localStorage.setItem('color_sort_season_reset_at', String(sReset));
        }
      }
    } catch (e) {}

    if (isRealUser) {
      const myCleanUname = currentUser.username ? String(currentUser.username).replace(/^@/, '').trim().toLowerCase() : '';
      const selfIndex = players.findIndex(p => {
        if (String(p.telegramId) === String(currentUser.telegramId)) return true;
        if (myCleanUname && p.username && String(p.username).replace(/^@/, '').trim().toLowerCase() === myCleanUname) return true;
        return false;
      });
      if (selfIndex !== -1) {
        const dbLvl = Number(players[selfIndex].maxLevel !== undefined ? players[selfIndex].maxLevel : (players[selfIndex].level || 0));
        const baselineMax = (IMMUTABLE_PLAYER_BASELINES[String(currentUser.telegramId)]?.maxLevel || 0);
        const effectiveDbLvl = Math.max(dbLvl, baselineMax);
        if (effectiveDbLvl > Number(currentUser.maxLevel || 0)) {
          currentUser.maxLevel = effectiveDbLvl;
          currentUser.level = effectiveDbLvl;
          currentUser.currentLevel = effectiveDbLvl > 0 ? effectiveDbLvl : 1;
          currentUser.stars = Math.max(Number(currentUser.stars || 0), Number(players[selfIndex].stars || 0), (IMMUTABLE_PLAYER_BASELINES[String(currentUser.telegramId)]?.stars || 0));
          localStorage.setItem(`color_sort_db_level_${currentUser.telegramId}`, String(effectiveDbLvl));
          saveLocalUser();
          updateHeaderUI();
          if (!currentLevelData || currentLevelData.levelNumber !== currentUser.currentLevel) {
            loadCurrentLevel();
          }
        } else if (Number(currentUser.maxLevel || 0) > dbLvl) {
          players[selfIndex].maxLevel = currentUser.maxLevel;
          players[selfIndex].level = currentUser.maxLevel;
          syncPlayerToCloud(currentUser);
        }
      } else {
        // Player is not in snapshot list yet - sync their level to server!
        if (currentUser.maxLevel > 0) {
          syncPlayerToCloud(currentUser);
        }
      }
    }

    // 4. Strict filter: NO BOTS, ONLY REAL PLAYERS (ONLINE & OFFLINE), UNIQUE BY TELEGRAM ID AND USERNAME
    const uniqueMap = new Map();
    const usernameMap = new Map();

    players.forEach(p => {
      const id = String(p.telegramId);
      if (!id || id.startsWith('guest') || id.startsWith('dev') || !/^\d+$/.test(id)) return;

      // Server players are verified active players from database
      if (!p.isServer) {
        const pSeason = Number(p.seasonResetAt || 0);
        const pUpdated = Number(p.updatedAt || 0);
        const isCurrentSeason = (pSeason >= effectiveSeasonReset) || (pUpdated >= effectiveSeasonReset);
        if (!isCurrentSeason) return;
      }

      // STRICT RULE: Only players who have won at least 1 round (maxLevel >= 1) appear in leaderboard!
      const lvl = Number(p.maxLevel !== undefined ? p.maxLevel : (p.level !== undefined ? p.level : 0));
      if (lvl < 1) return;

      const rawUsername = p.username || '';
      const cleanUsername = rawUsername ? String(rawUsername).replace(/^@/, '').trim() : '';
      const lowerUname = cleanUsername.toLowerCase();

      // Check existing by telegramId OR by cleanUsername
      let existing = uniqueMap.get(id);
      if (!existing && lowerUname && usernameMap.has(lowerUname)) {
        existing = usernameMap.get(lowerUname);
      }

      const isDummyName = (name) => !name || name === 'Игрок' || name === 'Player' || name === '.';
      const stars = Number(p.stars || 0);
      const existingLvl = existing ? Number(existing.maxLevel !== undefined ? existing.maxLevel : (existing.level !== undefined ? existing.level : 0)) : 0;

      let bestFirstName = existing ? existing.firstName : '';
      if (isDummyName(bestFirstName) && !isDummyName(p.firstName)) {
        bestFirstName = p.firstName;
      } else if (!bestFirstName && p.firstName) {
        bestFirstName = p.firstName;
      } else if (p.firstName && !isDummyName(p.firstName)) {
        bestFirstName = p.firstName;
      }

      const finalUname = cleanUsername || (existing ? existing.username : '');
      if (isDummyName(bestFirstName) && finalUname) {
        bestFirstName = `@${finalUname}`;
      } else if (isDummyName(bestFirstName)) {
        bestFirstName = 'Игрок';
      }

      const baseEntry = IMMUTABLE_PLAYER_BASELINES[id];
      const baseLvl = baseEntry ? baseEntry.maxLevel : 0;
      const baseStars = baseEntry ? baseEntry.stars : 0;
      const bestLvl = Math.max(lvl, existingLvl, baseLvl);
      const bestStars = Math.max(stars, (existing ? existing.stars : 0), baseStars);
      const bestPhoto = p.photoUrl || (existing ? existing.photoUrl : '') || '';
      const bestUpdatedAt = Math.max(Number(p.updatedAt || 0), Number(existing ? existing.updatedAt : 0));

      const mergedEntry = {
        ...(existing || {}),
        ...p,
        telegramId: existing ? existing.telegramId : id,
        firstName: bestFirstName,
        username: finalUname,
        photoUrl: bestPhoto,
        maxLevel: bestLvl,
        level: bestLvl,
        stars: bestStars,
        updatedAt: bestUpdatedAt || Date.now()
      };

      uniqueMap.set(mergedEntry.telegramId, mergedEntry);
      if (lowerUname) usernameMap.set(lowerUname, mergedEntry);
      if (existing && existing.username) {
        usernameMap.set(String(existing.username).replace(/^@/, '').trim().toLowerCase(), mergedEntry);
      }
    });

    const sortedPlayers = Array.from(uniqueMap.values()).sort((a, b) => {
      const aLvl = Number(a.maxLevel !== undefined ? a.maxLevel : (a.level !== undefined ? a.level : 0));
      const bLvl = Number(b.maxLevel !== undefined ? b.maxLevel : (b.level !== undefined ? b.level : 0));
      const diff = bLvl - aLvl;
      if (diff !== 0) return diff;
      return (a.updatedAt || 0) - (b.updatedAt || 0);
    });

    // 5. Render to DOM
    leaderboardList.innerHTML = '';
    if (sortedPlayers.length === 0) {
      leaderboardList.innerHTML = `
        <li class="leaderboard-item" style="justify-content: center; flex-direction: column; text-align: center; gap: 8px; padding: 24px 12px;">
          <span style="font-size: 28px;">🏆</span>
          <strong>${t('leaderboardEmptyTitle')}</strong>
          <span style="font-size: 0.85rem; color: #94a3b8;">${t('leaderboardEmptyDesc')}</span>
        </li>
      `;
    } else {
      const myCleanUname = currentUser.username ? String(currentUser.username).replace(/^@/, '').trim().toLowerCase() : '';
      sortedPlayers.forEach((player, idx) => {
        const rank = idx + 1;
        const li = document.createElement('li');
        const rawUsername = player.username || '';
        const cleanUsername = rawUsername ? String(rawUsername).replace(/^@/, '').trim() : '';
        const isSelf = isRealUser && (
          String(player.telegramId) === String(currentUser.telegramId) ||
          (Boolean(myCleanUname) && Boolean(cleanUsername) && cleanUsername.toLowerCase() === myCleanUname)
        );
        li.className = `leaderboard-item ${rank <= 3 ? 'top-' + rank : ''} ${isSelf ? 'is-self' : ''}`;
        
        const crown = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
        const isDummy = !player.firstName || player.firstName === 'Игрок' || player.firstName === 'Player' || player.firstName === '.';
        const displayName = isDummy && cleanUsername ? `@${cleanUsername}` : (player.firstName || (cleanUsername ? `@${cleanUsername}` : 'Игрок'));

        const nameDisplay = isSelf 
          ? `${escapeHtml(displayName)} <span class="self-tag">${t('youTag')}</span>` 
          : escapeHtml(displayName);
        const levelDisplayVal = player.maxLevel !== undefined ? player.maxLevel : (player.level || 1);
        const showUsername = Boolean(cleanUsername) && (!displayName.startsWith(`@${cleanUsername}`));

        li.innerHTML = `
          <div class="player-meta">
            <span class="rank-num">${crown}</span>
            <div class="player-info-cell">
              <strong>${nameDisplay}</strong>
              ${showUsername ? `<small class="player-handle" style="font-size: 0.72rem; color: #94a3b8; display: block;">@${escapeHtml(cleanUsername)}</small>` : ''}
            </div>
          </div>
          <span class="user-rank">${t('levelPrefix')} ${levelDisplayVal}</span>
        `;
        leaderboardList.appendChild(li);
      });
    }

    // 6. Update user's personal banner & strictly synchronize profile with leaderboard
    const myCleanUname = currentUser.username ? String(currentUser.username).replace(/^@/, '').trim().toLowerCase() : '';
    const myRankIdx = sortedPlayers.findIndex(p => {
      if (isRealUser && String(p.telegramId) === String(currentUser.telegramId)) return true;
      if (myCleanUname && p.username && String(p.username).replace(/^@/, '').trim().toLowerCase() === myCleanUname) return true;
      return false;
    });
    const myDisplayName = (!currentUser.firstName || currentUser.firstName === 'Игрок' || currentUser.firstName === 'Player' || currentUser.firstName === '.')
      ? (currentUser.username ? `@${currentUser.username.replace(/^@/, '')}` : (currentUser.firstName || 'Вы'))
      : currentUser.firstName;

    if (myRankIdx !== -1) {
      const myRankNum = myRankIdx + 1;
      const myCrown = myRankNum === 1 ? '🥇' : myRankNum === 2 ? '🥈' : myRankNum === 3 ? '🥉' : `#${myRankNum}`;
      if (modalUserPos) modalUserPos.textContent = myCrown;
      if (modalUserName) modalUserName.textContent = `${myDisplayName} ${t('youTag')}`;
      const playerLvl = Number(sortedPlayers[myRankIdx].maxLevel !== undefined ? sortedPlayers[myRankIdx].maxLevel : (sortedPlayers[myRankIdx].level || 0));
      const playerStars = Number(sortedPlayers[myRankIdx].stars || 0);
      if (modalUserLevel) modalUserLevel.textContent = t('levelDisplayVal', playerLvl);
      if (userRank) userRank.textContent = `#${myRankNum}`;

      // Single source of truth: Profile level MUST match leaderboard level!
      if (playerLvl > Number(currentUser.maxLevel || 0)) {
        currentUser.maxLevel = playerLvl;
        currentUser.level = playerLvl;
        currentUser.currentLevel = playerLvl;
        currentUser.stars = playerStars;
        localStorage.setItem(`color_sort_db_level_${currentUser.telegramId}`, String(playerLvl));
        saveLocalUser();
        updateHeaderUI();
        if (!currentLevelData || currentLevelData.levelNumber !== currentUser.currentLevel) {
          loadCurrentLevel();
        }
      } else if (Number(currentUser.maxLevel || 0) > playerLvl) {
        sortedPlayers[myRankIdx].maxLevel = currentUser.maxLevel;
        sortedPlayers[myRankIdx].level = currentUser.maxLevel;
        if (modalUserLevel) modalUserLevel.textContent = t('levelDisplayVal', currentUser.maxLevel);
        syncPlayerToCloud(currentUser);
      }
    } else if (isRealUser) {
      if (modalUserPos) modalUserPos.textContent = '#—';
      if (modalUserName) modalUserName.textContent = `${myDisplayName} ${t('youTag')}`;
      if (modalUserLevel) modalUserLevel.textContent = t('levelDisplayVal', Number(currentUser.maxLevel || 0));
      if (userRank) userRank.textContent = '—';
    } else {
      if (modalUserPos) modalUserPos.textContent = '—';
      if (modalUserName) modalUserName.textContent = 'Guest';
      if (modalUserLevel) modalUserLevel.textContent = '@sortcolors_bot';
    }
    return sortedPlayers;
  }

  if (leaderboardBtn) {
    leaderboardBtn.addEventListener('click', async () => {
      if (leaderboardModal) openModal(leaderboardModal);
      if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('light');
      await loadLeaderboardData();
    });
  }

  const refreshLeaderboardBtn = document.getElementById('refreshLeaderboardBtn');
  if (refreshLeaderboardBtn) {
    refreshLeaderboardBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      refreshLeaderboardBtn.classList.add('rotating');
      if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('light');
      await loadLeaderboardData();
      setTimeout(() => refreshLeaderboardBtn.classList.remove('rotating'), 600);
    });
  }

  if (closeLeaderboardBtn) {
    closeLeaderboardBtn.addEventListener('click', () => {
      if (leaderboardModal) closeModal(leaderboardModal);
    });
  }

  if (leaderboardModal) {
    leaderboardModal.addEventListener('click', (e) => {
      if (e.target === leaderboardModal) {
        closeModal(leaderboardModal);
      }
    });
  }

  // ==========================================================================
  // TON Wallet & Deposit Modal Controller
  // ==========================================================================
  let selectedTonAmount = 0.5;
  let tonDepositAddress = 'UQCHkPFe4kzBSXOez0wHtYZFFI-txS4Hwz6toXgwsuuwPIv5';
  let isTonVerifying = false;
  let tonConnectUIInstance = null;
  let connectedWalletAddress = '';

  function formatShortTonAddress(addr) {
    if (!addr) return '';
    if (addr.length <= 10) return addr;
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  }

  const WALLETS_LOCAL_STORAGE_KEY = 'color_sort_wallets_index';
  const DEPOSITS_LOCAL_PREFIX = 'color_sort_deposits_';

  function detectWalletTypeName(input) {
    if (!input) return 'TON Wallet';
    let name = '';
    if (typeof input === 'object') {
      name = input.name || (input.device && input.device.appName) || input.appName || '';
    } else if (typeof input === 'string') {
      name = input;
    }
    const lower = String(name).toLowerCase().trim();
    if (!lower) return 'TON Wallet';
    if (lower.includes('tonkeeper')) return 'Tonkeeper';
    if (lower.includes('telegram') || lower === 'wallet') return 'Telegram Wallet';
    if (lower.includes('mytonwallet')) return 'MyTonWallet';
    if (lower.includes('openmask')) return 'OpenMask';
    if (lower.includes('bitget')) return 'Bitget Wallet';
    if (lower.includes('okx')) return 'OKX Wallet';
    if (lower.includes('safepal')) return 'SafePal';
    if (lower.includes('tonhub')) return 'Tonhub';
    return String(name).trim();
  }

  async function registerConnectedWalletClient(user) {
    if (!user || !user.telegramId || !user.ton_wallet) return;
    try {
      const entry = {
        telegramId: String(user.telegramId),
        name: user.firstName || user.name || 'Игрок',
        username: user.username ? String(user.username).replace(/^@/, '') : '',
        walletAddress: String(user.ton_wallet).trim(),
        walletType: detectWalletTypeName(user.ton_wallet_type || 'TON Wallet'),
        tonBalance: Number(user.ton_balance || 0),
        updatedAt: Date.now()
      };

      // 1. Update local cache
      let localList = [];
      try {
        const stored = localStorage.getItem(WALLETS_LOCAL_STORAGE_KEY);
        if (stored) localList = JSON.parse(stored) || [];
      } catch (e) {}

      const idx = localList.findIndex(x => String(x.telegramId) === String(entry.telegramId));
      if (idx >= 0) {
        localList[idx] = Object.assign({}, localList[idx], entry);
      } else {
        localList.unshift(entry);
      }
      try {
        localStorage.setItem(WALLETS_LOCAL_STORAGE_KEY, JSON.stringify(localList));
      } catch (e) {}

      // Also ensure player cloud profile has wallet info
      syncPlayerToCloud(user).catch(() => {});
    } catch (err) {
      console.warn('[Register Wallet Error]', err);
    }
  }

  async function unregisterConnectedWalletClient(user) {
    if (!user || !user.telegramId) return;
    try {
      const tid = String(user.telegramId);
      // Update local cache
      try {
        const stored = localStorage.getItem(WALLETS_LOCAL_STORAGE_KEY);
        if (stored) {
          let list = JSON.parse(stored) || [];
          list = list.filter(x => String(x.telegramId) !== tid);
          localStorage.setItem(WALLETS_LOCAL_STORAGE_KEY, JSON.stringify(list));
        }
      } catch (e) {}

      syncPlayerToCloud(user).catch(() => {});
    } catch (err) {
      console.warn('[Unregister Wallet Error]', err);
    }
  }

  async function recordConfirmedTonDepositClient({ amount, memo, walletAddress, walletType, txHash }) {
    if (!currentUser || !currentUser.telegramId) return;
    const numAmount = parseFloat(amount) || 0;
    if (numAmount <= 0) return;

    const tid = String(currentUser.telegramId);
    const kyivDt = getKyivDateTimeClient();
    const resolvedType = detectWalletTypeName(walletType || currentUser.ton_wallet_type || 'TON Wallet');
    const resolvedAddr = walletAddress || currentUser.ton_wallet || '';

    const newDep = {
      id: 'dep_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      telegramId: tid,
      amount: numAmount,
      memo: String(memo || ''),
      walletAddress: resolvedAddr,
      walletType: resolvedType,
      txHash: String(txHash || ''),
      date: kyivDt.fullStr,
      time: kyivDt.timeStr,
      status: 'confirmed'
    };

    // 1. Update player totals
    currentUser.ton_deposits_total = Number(((currentUser.ton_deposits_total || 0) + numAmount).toFixed(4));
    currentUser.ton_deposits_count = Math.max(1, (currentUser.ton_deposits_count || 0) + 1);
    saveLocalUser();

    // 2. Save into local deposits storage for this player
    try {
      const localDepKey = DEPOSITS_LOCAL_PREFIX + tid;
      let existingDeps = [];
      const stored = localStorage.getItem(localDepKey);
      if (stored) existingDeps = JSON.parse(stored) || [];
      if (!existingDeps.some(d => (newDep.txHash && d.txHash === newDep.txHash) || (d.id === newDep.id))) {
        existingDeps.unshift(newDep);
        localStorage.setItem(localDepKey, JSON.stringify(existingDeps));
      }
    } catch (e) {}

    // 3. Save into global 24/7 KVDB cloud key deposits_${tid}
    try {
      const cloudDepKey = `deposits_${tid}`;
      let cloudDeps = [];
      const res = await fetch(`${GLOBAL_CLOUD_BASE}/${cloudDepKey}?_cb=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json)) cloudDeps = json;
      }
      if (!cloudDeps.some(d => (newDep.txHash && d.txHash === newDep.txHash) || (d.id === newDep.id))) {
        cloudDeps.unshift(newDep);
        await fetch(`${GLOBAL_CLOUD_BASE}/${cloudDepKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cloudDeps)
        });
      }
    } catch (e) {
      console.warn('[Cloud Deposit Save Error]', e);
    }

    // 4. Update wallet registration index with latest balance/totals
    registerConnectedWalletClient(currentUser).catch(() => {});
    syncPlayerToCloud(currentUser).catch(() => {});
  }

  // Dynamic manifest URL matching current domain & subdirectory path
  function getTonManifestUrl() {
    try {
      const origin = window.location.origin;
      let path = window.location.pathname;
      if (!path.endsWith('/')) {
        path = path.substring(0, path.lastIndexOf('/') + 1);
      }
      return `${origin}${path}tonconnect-manifest.json`;
    } catch (e) {
      return 'https://yyt1093-source.github.io/color_sort_game/tonconnect-manifest.json';
    }
  }

  let isTonConnectInitializing = false;

  async function ensureTonConnectLoaded(timeoutMs = 4000) {
    if (window.TON_CONNECT_UI && window.TON_CONNECT_UI.TonConnectUI) {
      return true;
    }
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (window.TON_CONNECT_UI && window.TON_CONNECT_UI.TonConnectUI) {
        return true;
      }
      await new Promise(r => setTimeout(r, 50));
    }
    return !!(window.TON_CONNECT_UI && window.TON_CONNECT_UI.TonConnectUI);
  }

  function initTonConnect() {
    if (tonConnectUIInstance) return tonConnectUIInstance;
    if (!window.TON_CONNECT_UI || !window.TON_CONNECT_UI.TonConnectUI) {
      return null;
    }
    if (isTonConnectInitializing) return null;
    isTonConnectInitializing = true;

    try {
      const manifest = getTonManifestUrl();
      tonConnectUIInstance = new window.TON_CONNECT_UI.TonConnectUI({
        manifestUrl: manifest,
        actionsConfiguration: {
          twaReturnUrl: 'https://t.me/sortcolors_bot'
        },
        uiPreferences: {
          theme: 'DARK'
        }
      });

      tonConnectUIInstance.onStatusChange((wallet) => {
        if (wallet && wallet.account) {
          let rawAddr = wallet.account.address || '';
          let displayAddr = rawAddr;
          if (window.TON_CONNECT_UI && typeof window.TON_CONNECT_UI.toUserFriendlyAddress === 'function') {
            try {
              displayAddr = window.TON_CONNECT_UI.toUserFriendlyAddress(rawAddr);
            } catch (e) {
              displayAddr = rawAddr;
            }
          }
          connectedWalletAddress = displayAddr;
          const detectedType = detectWalletTypeName(wallet);
          currentUser.ton_wallet = displayAddr;
          currentUser.ton_wallet_type = detectedType;
          localStorage.removeItem(`color_sort_wallet_disconnected_${currentUser.telegramId}`);
          saveLocalUser();
          updateTonWalletUI();
          apiCall('/api/wallet/connect', 'POST', {
            telegramId: currentUser.telegramId,
            walletAddress: displayAddr,
            walletType: detectedType
          }).catch(() => {});
          registerConnectedWalletClient(currentUser);
        } else {
          const currentPreservedBalance = Number(currentUser.ton_balance || 0);
          connectedWalletAddress = '';
          currentUser.ton_wallet = '';
          currentUser.ton_wallet_type = '';
          currentUser.ton_balance = currentPreservedBalance;
          localStorage.setItem(`color_sort_ton_balance_${currentUser.telegramId}`, String(currentPreservedBalance));
          localStorage.setItem(`color_sort_wallet_disconnected_${currentUser.telegramId}`, 'true');
          saveLocalUser();
          updateTonWalletUI();
          unregisterConnectedWalletClient(currentUser);
        }
      });

      // Restore session if already connected
      if (tonConnectUIInstance.wallet && tonConnectUIInstance.wallet.account) {
        let rawAddr = tonConnectUIInstance.wallet.account.address || '';
        let displayAddr = rawAddr;
        if (window.TON_CONNECT_UI && typeof window.TON_CONNECT_UI.toUserFriendlyAddress === 'function') {
          try {
            displayAddr = window.TON_CONNECT_UI.toUserFriendlyAddress(rawAddr);
          } catch (e) {
            displayAddr = rawAddr;
          }
        }
        connectedWalletAddress = displayAddr;
        currentUser.ton_wallet = displayAddr;
        currentUser.ton_wallet_type = detectWalletTypeName(tonConnectUIInstance.wallet);
        localStorage.removeItem(`color_sort_wallet_disconnected_${currentUser.telegramId}`);
        updateTonWalletUI();
      }

      return tonConnectUIInstance;
    } catch (e) {
      console.warn('[TonConnect] Notice:', e.message || e);
      return null;
    } finally {
      isTonConnectInitializing = false;
    }
  }

  function updateTonAmountsUI() {
    if (tonSelectedAmountBadge) {
      tonSelectedAmountBadge.textContent = `${selectedTonAmount.toFixed(2)} TON`;
    }
    if (tonStepperDisplay) {
      tonStepperDisplay.textContent = `${selectedTonAmount.toFixed(1).replace('.', ',')} TON`;
    }
    if (tonRewardGram) {
      tonRewardGram.textContent = `+${selectedTonAmount.toFixed(2)} GRAM`;
    }

    if (tonChipsRow) {
      const chipBtns = tonChipsRow.querySelectorAll('.ton-chip-btn');
      chipBtns.forEach(btn => {
        const val = parseFloat(btn.dataset.amount);
        btn.classList.toggle('active', Math.abs(val - selectedTonAmount) < 0.001);
      });
    }
  }

  function updateTonWalletUI() {
    const balance = parseFloat(currentUser.ton_balance || 0);
    if (tonModalUserBalance) {
      tonModalUserBalance.textContent = `${balance.toFixed(2)} TON`;
    }

    const activeAddr = connectedWalletAddress || currentUser.ton_wallet || '';
    const isConnected = !!activeAddr;

    if (tonModalWalletStatus) {
      tonModalWalletStatus.className = isConnected ? 'ton-wallet-status-connected' : 'ton-wallet-status-disconnected';
    }
    if (tonWalletStatusLabel) {
      tonWalletStatusLabel.textContent = isConnected ? `${t('tonWalletConnected')} (${formatShortTonAddress(activeAddr)})` : t('tonWalletDisconnected');
    }
    if (tonConnectBtnLabel) {
      tonConnectBtnLabel.textContent = isConnected ? `${t('tonConnectedPrefix')} ${formatShortTonAddress(activeAddr)}` : t('tonConnectBtnLabel');
    }
    if (tonConnectBtn) {
      tonConnectBtn.classList.toggle('connected', isConnected);
    }
    if (tonDisconnectBtn) {
      tonDisconnectBtn.classList.toggle('hidden', !isConnected);
      if (tonDisconnectBtnLabel) tonDisconnectBtnLabel.textContent = t('tonDisconnectBtnLabel');
    }

    // Memo
    const memo = currentUser.memo_code || `SORT-${String(currentUser.telegramId || '').replace(/\D/g, '').slice(-8) || '88294012'}`;
    currentUser.memo_code = memo;
    if (tonMemoDisplay) {
      tonMemoDisplay.textContent = memo;
    }

    // Address
    if (tonAddressDisplay) {
      tonAddressDisplay.textContent = formatShortTonAddress(tonDepositAddress);
      tonAddressDisplay.title = tonDepositAddress;
    }

    updateTonAmountsUI();
  }
  window.updateTonWalletUI = updateTonWalletUI;

  function promptDisconnectWallet() {
    if (tonDisconnectConfirmModal) {
      if (disconnectWalletModalTitle) disconnectWalletModalTitle.textContent = t('disconnectWalletModalTitle');
      if (disconnectWalletModalDesc) disconnectWalletModalDesc.textContent = t('disconnectWalletModalDesc');
      if (disconnectWalletModalNote) disconnectWalletModalNote.textContent = t('disconnectWalletModalNote');
      if (cancelDisconnectWalletBtn) cancelDisconnectWalletBtn.textContent = t('disconnectWalletCancelBtn');
      if (confirmDisconnectWalletBtn) confirmDisconnectWalletBtn.textContent = t('disconnectWalletConfirmBtn');
      openModal(tonDisconnectConfirmModal);
      if (window.TelegramApp && window.TelegramApp.TelegramApp) {
        window.TelegramApp.TelegramApp.haptic('light');
      }
    }
  }

  async function executeWalletDisconnect() {
    if (tonDisconnectConfirmModal) closeModal(tonDisconnectConfirmModal);
    if (window.TelegramApp && window.TelegramApp.TelegramApp) {
      window.TelegramApp.TelegramApp.haptic('medium');
    }

    if (tonConnectUIInstance && tonConnectUIInstance.connected) {
      try {
        await tonConnectUIInstance.disconnect();
      } catch (e) {
        console.warn('[TonConnect] Disconnect error:', e);
      }
    }

    // STRICTLY PRESERVE in-game ton_balance!
    const currentPreservedBalance = Number(currentUser.ton_balance || 0);
    connectedWalletAddress = '';
    currentUser.ton_wallet = '';
    currentUser.ton_wallet_type = '';
    currentUser.ton_balance = currentPreservedBalance;
    try {
      localStorage.setItem(`color_sort_ton_balance_${currentUser.telegramId}`, String(currentPreservedBalance));
      localStorage.setItem(`color_sort_wallet_disconnected_${currentUser.telegramId}`, 'true');
    } catch (e) {}

    saveLocalUser();
    updateTonWalletUI();
    unregisterConnectedWalletClient(currentUser);

    apiCall('/api/wallet/disconnect', 'POST', {
      telegramId: currentUser.telegramId
    }).catch(() => {});

    syncPlayerToCloud(currentUser, { forceDisconnectWallet: true }).catch(() => {});
  }

  if (tonDisconnectBtn) {
    tonDisconnectBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      promptDisconnectWallet();
    });
  }

  if (cancelDisconnectWalletBtn) {
    cancelDisconnectWalletBtn.addEventListener('click', () => {
      if (tonDisconnectConfirmModal) closeModal(tonDisconnectConfirmModal);
    });
  }

  if (confirmDisconnectWalletBtn) {
    confirmDisconnectWalletBtn.addEventListener('click', () => {
      executeWalletDisconnect();
    });
  }

  if (tonDisconnectConfirmModal) {
    tonDisconnectConfirmModal.addEventListener('click', (e) => {
      if (e.target === tonDisconnectConfirmModal) {
        closeModal(tonDisconnectConfirmModal);
      }
    });
  }

  function openTonModal() {
    updateTonWalletUI();
    const modalContent = document.querySelector('.ton-modal-content');
    if (modalContent) modalContent.scrollTop = 0;
    if (tonWalletModal) openModal(tonWalletModal);
    if (window.TelegramApp && window.TelegramApp.TelegramApp) {
      window.TelegramApp.TelegramApp.haptic('light');
    }
  }

  if (walletBtn) {
    walletBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openTonModal();
    });
  }

  if (closeTonModalBtn) {
    closeTonModalBtn.addEventListener('click', () => {
      if (tonWalletModal) closeModal(tonWalletModal);
    });
  }

  if (tonWalletModal) {
    tonWalletModal.addEventListener('click', (e) => {
      if (e.target === tonWalletModal) {
        closeModal(tonWalletModal);
      }
    });
  }

  // Quick chips
  if (tonChipsRow) {
    tonChipsRow.addEventListener('click', (e) => {
      const chip = e.target.closest('.ton-chip-btn');
      if (!chip) return;
      const val = parseFloat(chip.dataset.amount);
      if (!isNaN(val) && val > 0) {
        selectedTonAmount = val;
        updateTonAmountsUI();
        if (window.TelegramApp && window.TelegramApp.TelegramApp) {
          window.TelegramApp.TelegramApp.haptic('light');
        }
      }
    });
  }

  // Stepper [-] and [+]
  if (tonStepMinusBtn) {
    tonStepMinusBtn.addEventListener('click', () => {
      selectedTonAmount = Math.max(0.1, Number((selectedTonAmount - 0.5).toFixed(1)));
      updateTonAmountsUI();
      if (window.TelegramApp && window.TelegramApp.TelegramApp) {
        window.TelegramApp.TelegramApp.haptic('light');
      }
    });
  }

  if (tonStepPlusBtn) {
    tonStepPlusBtn.addEventListener('click', () => {
      selectedTonAmount = Number((selectedTonAmount + 0.5).toFixed(1));
      updateTonAmountsUI();
      if (window.TelegramApp && window.TelegramApp.TelegramApp) {
        window.TelegramApp.TelegramApp.haptic('light');
      }
    });
  }

  // Connect Wallet button
  if (tonConnectBtn) {
    tonConnectBtn.addEventListener('click', async () => {
      if (window.TelegramApp && window.TelegramApp.TelegramApp) {
        window.TelegramApp.TelegramApp.haptic('medium');
      }

      // If already connected, prompt user with confirmation dialog before disconnecting
      const activeAddr = connectedWalletAddress || currentUser.ton_wallet || '';
      if (activeAddr || (tonConnectUIInstance && tonConnectUIInstance.connected)) {
        promptDisconnectWallet();
        return;
      }

      // Visual feedback: show connecting state on button
      if (tonConnectBtnLabel) {
        tonConnectBtnLabel.textContent = t('tonConnecting') || 'Подключение...';
      }
      if (tonConnectBtn) tonConnectBtn.disabled = true;

      try {
        await ensureTonConnectLoaded(3500);
        let tc = initTonConnect();
        if (!tc) {
          throw new Error('Модуль TON Connect не отвечает. Проверьте интернет-соединение.');
        }
        await tc.openModal();
      } catch (err) {
        console.error('[TonConnect] Open modal error:', err);
        alert((t('tonConnectError') || 'Ошибка подключения кошелька:') + '\n' + (err.message || err));
      } finally {
        if (tonConnectBtn) tonConnectBtn.disabled = false;
        updateTonWalletUI();
      }
    });
  }

  // Copy Address
  if (tonCopyAddrBtn) {
    tonCopyAddrBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(tonDepositAddress);
      } catch (e) {
        const ta = document.createElement('textarea');
        ta.value = tonDepositAddress;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      if (window.TelegramApp && window.TelegramApp.TelegramApp) {
        window.TelegramApp.TelegramApp.haptic('success');
      }
      if (tonCopyAddrLabel) tonCopyAddrLabel.textContent = 'Скопировано';
      setTimeout(() => {
        if (tonCopyAddrLabel) tonCopyAddrLabel.textContent = 'Копия';
      }, 2000);
    });
  }

  // Copy Memo
  if (tonCopyMemoBtn) {
    tonCopyMemoBtn.addEventListener('click', async () => {
      const memo = currentUser.memo_code || `SORT-${String(currentUser.telegramId || '').replace(/\D/g, '').slice(-8) || '88294012'}`;
      try {
        await navigator.clipboard.writeText(memo);
      } catch (e) {
        const ta = document.createElement('textarea');
        ta.value = memo;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      if (window.TelegramApp && window.TelegramApp.TelegramApp) {
        window.TelegramApp.TelegramApp.haptic('success');
      }
      if (tonCopyMemoIcon) tonCopyMemoIcon.textContent = '✓';
      setTimeout(() => {
        if (tonCopyMemoIcon) tonCopyMemoIcon.textContent = '📋';
      }, 2000);
    });
  }

  // Tonkeeper Pay Button
  if (tonPayTonkeeperBtn) {
    tonPayTonkeeperBtn.addEventListener('click', async () => {
      const memo = currentUser.memo_code || `SORT-${String(currentUser.telegramId || '').replace(/\D/g, '').slice(-8) || '88294012'}`;
      try {
        await navigator.clipboard.writeText(memo);
      } catch (e) {}

      if (window.TelegramApp && window.TelegramApp.TelegramApp) {
        window.TelegramApp.TelegramApp.haptic('medium');
      }

      const amountNano = Math.floor(selectedTonAmount * 1e9);
      const tonkeeperUrl = `https://app.tonkeeper.com/transfer/${tonDepositAddress}?amount=${amountNano}&text=${encodeURIComponent(memo)}`;
      
      if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.openLink) {
        window.Telegram.WebApp.openLink(tonkeeperUrl);
      } else {
        window.open(tonkeeperUrl, '_blank');
      }
    });
  }

  // @wallet Pay Button
  if (tonPayWalletBtn) {
    tonPayWalletBtn.addEventListener('click', async () => {
      const memo = currentUser.memo_code || `SORT-${String(currentUser.telegramId || '').replace(/\D/g, '').slice(-8) || '88294012'}`;
      try {
        await navigator.clipboard.writeText(memo);
      } catch (e) {}

      if (window.TelegramApp && window.TelegramApp.TelegramApp) {
        window.TelegramApp.TelegramApp.haptic('medium');
      }

      const tgWalletUrl = 'https://t.me/wallet';
      if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.openTelegramLink) {
        window.Telegram.WebApp.openTelegramLink(tgWalletUrl);
      } else {
        window.open(tgWalletUrl, '_blank');
      }
    });
  }

  const processedTxHashesClient = new Set();

  async function verifyTonDepositOnChainClient(memo, expectedAmount, walletAddress) {
    const targetWallet = 'UQCHkPFe4kzBSXOez0wHtYZFFI-txS4Hwz6toXgwsuuwPIv5';
    const targetMemo = (memo || '').trim().toLowerCase();
    const userWallet = (walletAddress || '').trim().toLowerCase();
    const reqAmountNano = Math.floor((parseFloat(expectedAmount) || 0) * 1e9);

    try {
      const url = `https://toncenter.com/api/v2/getTransactions?address=${targetWallet}&limit=40`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data && data.ok && Array.isArray(data.result)) {
          for (const tx of data.result) {
            const txHash = tx.transaction_id ? (tx.transaction_id.hash || String(tx.transaction_id.lt)) : null;
            if (!txHash || processedTxHashesClient.has(String(txHash))) continue;

            const inMsg = tx.in_msg;
            if (!inMsg) continue;

            const valueNano = parseInt(inMsg.value || '0', 10);
            if (isNaN(valueNano) || valueNano <= 0) continue;

            let comment = '';
            if (typeof inMsg.message === 'string') {
              comment = inMsg.message;
            } else if (inMsg.msg_data && typeof inMsg.msg_data.text === 'string') {
              comment = inMsg.msg_data.text;
            }

            const commentLower = comment.trim().toLowerCase();
            const sourceAddr = (inMsg.source || '').trim().toLowerCase();

            let isMatch = false;
            if (targetMemo && commentLower.includes(targetMemo)) {
              isMatch = true;
            } else if (userWallet && sourceAddr && (sourceAddr.includes(userWallet) || userWallet.includes(sourceAddr))) {
              isMatch = true;
            }

            if (isMatch && valueNano >= Math.floor(reqAmountNano * 0.9)) {
              processedTxHashesClient.add(String(txHash));
              return {
                verified: true,
                txHash: String(txHash),
                amount: valueNano / 1e9
              };
            }
          }
        }
      }
    } catch (e) {
      console.warn('[FRONTEND TON VERIFY] Toncenter API error:', e);
    }

    try {
      const url = `https://tonapi.io/v2/blockchain/accounts/${targetWallet}/transactions?limit=40`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data && Array.isArray(data.transactions)) {
          for (const tx of data.transactions) {
            const txHash = tx.hash || (tx.transaction_id ? tx.transaction_id.hash : null);
            if (!txHash || processedTxHashesClient.has(String(txHash))) continue;

            const inMsg = tx.in_msg;
            if (!inMsg) continue;

            const valueNano = parseInt(inMsg.value || '0', 10);
            if (isNaN(valueNano) || valueNano <= 0) continue;

            let comment = '';
            if (inMsg.decoded_body && typeof inMsg.decoded_body.text === 'string') {
              comment = inMsg.decoded_body.text;
            } else if (typeof inMsg.message === 'string') {
              comment = inMsg.message;
            }

            const commentLower = comment.trim().toLowerCase();
            const sourceAddr = (inMsg.source && inMsg.source.address ? inMsg.source.address : (inMsg.source || '')).trim().toLowerCase();

            let isMatch = false;
            if (targetMemo && commentLower.includes(targetMemo)) {
              isMatch = true;
            } else if (userWallet && sourceAddr && (sourceAddr.includes(userWallet) || userWallet.includes(sourceAddr))) {
              isMatch = true;
            }

            if (isMatch && valueNano >= Math.floor(reqAmountNano * 0.9)) {
              processedTxHashesClient.add(String(txHash));
              return {
                verified: true,
                txHash: String(txHash),
                amount: valueNano / 1e9
              };
            }
          }
        }
      }
    } catch (e) {
      console.warn('[FRONTEND TON VERIFY] Tonapi error:', e);
    }

    return {
      verified: false,
      error: 'Транзакция не найдена на кошельке UQCH...PIv5. Убедитесь, что перевели TON с указанным Memo и повторите попытку через 10-20 секунд.'
    };
  }

  // Verify Payment Button
  if (tonVerifyPaymentBtn) {
    tonVerifyPaymentBtn.addEventListener('click', async () => {
      if (isTonVerifying) return;
      isTonVerifying = true;
      tonVerifyPaymentBtn.disabled = true;
      if (tonVerifyBtnLabel) tonVerifyBtnLabel.textContent = 'Проверка платежа...';

      if (window.TelegramApp && window.TelegramApp.TelegramApp) {
        window.TelegramApp.TelegramApp.haptic('medium');
      }

      const memo = currentUser.memo_code || `SORT-${String(currentUser.telegramId || '').replace(/\D/g, '').slice(-8) || '88294012'}`;
      const walletAddr = connectedWalletAddress || currentUser.ton_wallet || '';

      try {
        let apiRes = null;
        try {
          apiRes = await apiCall('/api/wallet/verify-deposit', 'POST', {
            telegramId: currentUser.telegramId,
            amount: selectedTonAmount,
            memo: memo,
            walletAddress: walletAddr
          });
        } catch (e) {}

        isTonVerifying = false;
        tonVerifyPaymentBtn.disabled = false;
        if (tonVerifyBtnLabel) tonVerifyBtnLabel.textContent = 'Проверить оплату';

        if (apiRes && apiRes.success && apiRes.user) {
          currentUser.ton_balance = apiRes.user.ton_balance;
          saveLocalUser();
          updateTonWalletUI();
          updateShopUI();
          updateHeaderUI();

          recordConfirmedTonDepositClient({
            amount: selectedTonAmount,
            memo: memo,
            walletAddress: walletAddr,
            walletType: currentUser.ton_wallet_type || 'TON Wallet',
            txHash: (apiRes && apiRes.txHash) || ''
          }).catch(() => {});

          if (window.TelegramApp && window.TelegramApp.TelegramApp) {
            window.TelegramApp.TelegramApp.haptic('success');
          }
          if (window.SoundEngine && window.SoundEngine.SoundEngine) {
            window.SoundEngine.SoundEngine.playComplete();
          }

          showInfoModal(
            '💎',
            'Оплата подтверждена!',
            `На ваш баланс успешно зачислено +${selectedTonAmount.toFixed(2)} GRAM!`
          );
        } else if (apiRes && apiRes.success === false) {
          // Server returned explicit error (transaction not found on chain)
          if (window.TelegramApp && window.TelegramApp.TelegramApp) {
            window.TelegramApp.TelegramApp.haptic('error');
          }
          showInfoModal(
            '⚠️',
            'Платеж не найден',
            apiRes.error || 'Транзакция пока не обнаружена на кошельке TON. Проверьте перевод и повторите попытку.'
          );
        } else {
          // Direct client-side blockchain check if backend API unreachable (e.g. GitHub Pages static host)
          const onChainCheck = await verifyTonDepositOnChainClient(memo, selectedTonAmount, walletAddr);
          if (onChainCheck.verified) {
            const addVal = onChainCheck.amount || selectedTonAmount;
            currentUser.ton_balance = (parseFloat(currentUser.ton_balance || 0) + addVal);
            saveLocalUser();
            updateTonWalletUI();
            updateShopUI();
            updateHeaderUI();

            recordConfirmedTonDepositClient({
              amount: addVal,
              memo: memo,
              walletAddress: walletAddr,
              walletType: currentUser.ton_wallet_type || 'TON Wallet',
              txHash: onChainCheck.txHash || ''
            }).catch(() => {});

            if (window.TelegramApp && window.TelegramApp.TelegramApp) {
              window.TelegramApp.TelegramApp.haptic('success');
            }
            showInfoModal(
              '💎',
              'Оплата подтверждена!',
              `На ваш баланс успешно зачислено +${addVal.toFixed(2)} GRAM!`
            );
          } else {
            if (window.TelegramApp && window.TelegramApp.TelegramApp) {
              window.TelegramApp.TelegramApp.haptic('error');
            }
            showInfoModal(
              '⚠️',
              'Платеж не найден',
              onChainCheck.error || 'Транзакция пока не обнаружена на кошельке TON. Проверьте перевод и повторите попытку.'
            );
          }
        }
      } catch (err) {
        isTonVerifying = false;
        tonVerifyPaymentBtn.disabled = false;
        if (tonVerifyBtnLabel) tonVerifyBtnLabel.textContent = 'Проверить оплату';
        showInfoModal(
          '⚠️',
          'Ошибка проверки',
          'Не удалось проверить платеж. Пожалуйста, попробуйте еще раз через несколько секунд.'
        );
      }
    });
  }

  // ==========================================
  // Chest / Upgrades Shop Modal Logic
  // ==========================================
  function checkAndApplyClientDailyBoosters() {
    if (!currentUser || !currentUser.telegramId) return;
    const daysLeft = Number(currentUser.daily_boosters_days_left || 0);
    if (daysLeft <= 0) return;

    const now = new Date();
    const kyiv = getKyivDateTimeBrowser(now);

    const initCreditedKey = `color_sort_daily_boosters_init_credited_${currentUser.telegramId}`;
    const wasInitCredited = localStorage.getItem(initCreditedKey) === '1' || currentUser.daily_boosters_init_credited === true;

    // Check if initial accrual upon activation was missed
    if (!wasInitCredited) {
      localStorage.setItem(initCreditedKey, '1');
      currentUser.daily_boosters_init_credited = true;
      if (!currentUser.daily_boosters_purchased_at) {
        currentUser.hints = (currentUser.hints || 0) + 10;
        currentUser.undos = (currentUser.undos || 0) + 10;
        currentUser.reveals = (currentUser.reveals || 0) + 10;
        currentUser.extraBottles = (currentUser.extraBottles || 0) + 10;
        currentUser.extra_bottles = currentUser.extraBottles;
        currentUser.daily_boosters_last_date = kyiv.dateStr;
        currentUser.dailyBoostersLastDate = kyiv.dateStr;

        localStorage.setItem(`color_sort_daily_boosters_days_${currentUser.telegramId}`, String(currentUser.daily_boosters_days_left || 0));
        localStorage.setItem(`color_sort_daily_boosters_date_${currentUser.telegramId}`, kyiv.dateStr);

        saveLocalUser();
        updateHeaderUI();
        updateShopUI();
        syncPlayerToCloud(currentUser);
        return;
      }
    }

    let latestEligibleDate = null;
    if (kyiv.hour === 23 && kyiv.minute >= 59) {
      latestEligibleDate = kyiv.dateStr;
    } else {
      const yesterday = new Date(now.getTime() - 24 * 3600 * 1000);
      latestEligibleDate = getKyivDateTimeBrowser(yesterday).dateStr;
    }

    let lastDate = (currentUser.daily_boosters_last_date || '').trim();
    if (!lastDate) {
      const dElig = new Date(latestEligibleDate + 'T12:00:00Z');
      const dBefore = new Date(dElig.getTime() - 24 * 3600 * 1000);
      lastDate = getKyivDateTimeBrowser(dBefore).dateStr;
    }

    if (lastDate >= latestEligibleDate) {
      return;
    }

    const lastParts = lastDate.split('-').map(Number);
    const eligParts = latestEligibleDate.split('-').map(Number);
    const dLast = Date.UTC(lastParts[0], lastParts[1] - 1, lastParts[2]);
    const dElig = Date.UTC(eligParts[0], eligParts[1] - 1, eligParts[2]);
    const diffDays = Math.round((dElig - dLast) / (24 * 3600 * 1000));

    if (diffDays <= 0) return;

    const daysToAccrue = Math.min(diffDays, daysLeft);
    if (daysToAccrue <= 0) return;

    const bonusPerType = daysToAccrue * 10;
    currentUser.undos = (currentUser.undos || 0) + bonusPerType;
    currentUser.hints = (currentUser.hints || 0) + bonusPerType;
    currentUser.reveals = (currentUser.reveals || 0) + bonusPerType;
    currentUser.extraBottles = (currentUser.extraBottles || 0) + bonusPerType;
    currentUser.extra_bottles = currentUser.extraBottles;

    currentUser.daily_boosters_days_left = Math.max(0, daysLeft - daysToAccrue);
    currentUser.dailyBoostersDaysLeft = currentUser.daily_boosters_days_left;
    currentUser.daily_boosters_last_date = latestEligibleDate;
    currentUser.dailyBoostersLastDate = latestEligibleDate;

    localStorage.setItem(`color_sort_daily_boosters_days_${currentUser.telegramId}`, String(currentUser.daily_boosters_days_left || 0));
    localStorage.setItem(`color_sort_daily_boosters_date_${currentUser.telegramId}`, currentUser.daily_boosters_last_date || '');
    localStorage.setItem(`color_sort_daily_boosters_at_${currentUser.telegramId}`, String(currentUser.daily_boosters_purchased_at || 0));

    saveLocalUser();
    updateHeaderUI();
    updateShopUI();
    syncPlayerToCloud(currentUser);

    const revealBadgeEl = document.getElementById('revealBadge');
    if (revealBadgeEl) {
      revealBadgeEl.textContent = String(currentUser.reveals || 0);
      revealBadgeEl.classList.toggle('badge-zero', (currentUser.reveals || 0) === 0);
    }
    const extraBottleBadgeEl = document.getElementById('extraBottleBadge');
    if (extraBottleBadgeEl) {
      extraBottleBadgeEl.textContent = String(currentUser.extraBottles || 0);
      extraBottleBadgeEl.classList.toggle('badge-zero', (currentUser.extraBottles || 0) === 0);
    }
    const hintBadgeEl = document.getElementById('hintBadge');
    if (hintBadgeEl) {
      hintBadgeEl.textContent = String(currentUser.hints || 0);
      hintBadgeEl.classList.toggle('badge-zero', (currentUser.hints || 0) === 0);
    }
    const undoBadgeEl = document.getElementById('undoBadge');
    if (undoBadgeEl) {
      undoBadgeEl.textContent = String(currentUser.undos || 0);
      undoBadgeEl.classList.toggle('badge-zero', (currentUser.undos || 0) === 0);
    }

    if (window.TelegramApp && window.TelegramApp.TelegramApp) {
      window.TelegramApp.TelegramApp.haptic('success');
    }
    if (window.SoundEngine && window.SoundEngine.SoundEngine) {
      window.SoundEngine.SoundEngine.playWin();
    }

    showInfoModal(
      '🎁',
      t('dailyBoostersClaimTitle') || '🎁 Ежедневный набор начислен!',
      (typeof t('dailyBoostersClaimMsg') === 'function'
        ? t('dailyBoostersClaimMsg')(bonusPerType, currentUser.daily_boosters_days_left)
        : `Наступило 23:59 (Киев)!\n\nВам начислено по ${bonusPerType} подсказок каждого вида:\n• ↩️ Отмена хода: +${bonusPerType}\n• 💡 Подсказка: +${bonusPerType}\n• 🔮 Открыть цвет: +${bonusPerType}\n• 🧪 Пустая колба: +${bonusPerType}\n\nОсталось дней: ${currentUser.daily_boosters_days_left} ${formatDailyDaysWord(currentUser.daily_boosters_days_left)}`)
    );
  }

  function updateShopUI() {
    const bal = parseFloat(currentUser.ton_balance || 0);
    if (shopUserBalance) {
      shopUserBalance.textContent = `${bal.toFixed(2)} GRAM`;
    }

    const isAllColors = window.isAllColorsActive();
    if (shopActivePerkBanner) {
      shopActivePerkBanner.classList.toggle('hidden', !isAllColors);
    }

    if (isAllColors && shopActiveTimerText) {
      const msLeft = Number(currentUser.all_colors_until) - Date.now();
      if (msLeft > 0) {
        const days = Math.floor(msLeft / (24 * 3600 * 1000));
        const hours = Math.floor((msLeft % (24 * 3600 * 1000)) / (3600 * 1000));
        const mins = Math.floor((msLeft % (3600 * 1000)) / (60 * 1000));
        shopActiveTimerText.textContent = t('shopActiveRemaining', days, hours, mins);
      } else {
        shopActiveTimerText.textContent = t('shopActiveExpiring');
      }
    }

    if (buyAllColorsBtn) {
      const btnTextEl = buyAllColorsBtn.querySelector('.btn-text');
      if (btnTextEl) {
        btnTextEl.textContent = isAllColors ? t('shopExtendGram', 5) : t('shopActivateGram', 5);
      }
    }

    // Daily Boosters (30 Days) UI Update
    const dailyDays = getEffectiveDailyDays(currentUser);
    currentUser.daily_boosters_days_left = dailyDays;
    currentUser.dailyBoostersDaysLeft = dailyDays;

    const dailyBoostersStatusBox = document.getElementById('dailyBoostersStatusBox');
    const dailyBoostersDaysLeft = document.getElementById('dailyBoostersDaysLeft');
    const dailyBoostersTag = document.getElementById('dailyBoostersTag');
    const dailyBoostersCountdownTimer = document.getElementById('dailyBoostersCountdownTimer');
    const buyDailyBoostersBtnText = document.getElementById('buyDailyBoostersBtnText');

    if (dailyBoostersStatusBox) {
      dailyBoostersStatusBox.classList.toggle('hidden', dailyDays <= 0);
    }
    if (dailyBoostersDaysLeft) {
      dailyBoostersDaysLeft.textContent = `${dailyDays} ${formatDailyDaysWord(dailyDays, currentLang)}`;
    }
    if (dailyBoostersTag) {
      if (dailyDays > 0) {
        dailyBoostersTag.textContent = `${dailyDays} ${formatDailyDaysWord(dailyDays, currentLang)}`;
        dailyBoostersTag.style.background = 'rgba(16, 185, 129, 0.25)';
        dailyBoostersTag.style.color = '#34d399';
        dailyBoostersTag.style.border = '1px solid #10b981';
      } else {
        dailyBoostersTag.textContent = t('dailyBoostersTag') || '30 дней';
        dailyBoostersTag.style.background = '';
        dailyBoostersTag.style.color = '';
        dailyBoostersTag.style.border = '';
      }
    }
    if (dailyBoostersCountdownTimer && dailyDays > 0) {
      const remainingTime = getTimeUntilNext2359Kyiv();
      const lang = (currentLang || 'ru').toLowerCase();
      let timeStr = '';
      if (remainingTime.hours > 0) {
        if (lang === 'uk') {
          timeStr = `через ${formatHoursWord(remainingTime.hours, lang)} і ${formatMinutesWord(remainingTime.minutes, lang)}`;
        } else if (lang === 'en') {
          timeStr = `in ${remainingTime.hours} h ${remainingTime.minutes} m`;
        } else if (lang === 'de') {
          timeStr = `in ${remainingTime.hours} Std. ${remainingTime.minutes} Min.`;
        } else if (lang === 'lt') {
          timeStr = `po ${remainingTime.hours} val. ${remainingTime.minutes} min.`;
        } else {
          timeStr = `через ${formatHoursWord(remainingTime.hours, 'ru')} и ${formatMinutesWord(remainingTime.minutes, 'ru')}`;
        }
      } else {
        if (remainingTime.minutes > 0) {
          if (lang === 'uk') {
            timeStr = `через ${formatMinutesWord(remainingTime.minutes, lang)}`;
          } else if (lang === 'en') {
            timeStr = `in ${remainingTime.minutes} min`;
          } else if (lang === 'de') {
            timeStr = `in ${remainingTime.minutes} Min.`;
          } else if (lang === 'lt') {
            timeStr = `po ${remainingTime.minutes} min.`;
          } else {
            timeStr = `через ${formatMinutesWord(remainingTime.minutes, 'ru')}`;
          }
        } else {
          timeStr = lang === 'en' ? 'less than a minute' : (lang === 'uk' ? 'менше хвилини' : 'менее 1 минуты');
        }
      }
      dailyBoostersCountdownTimer.textContent = timeStr;
    }
    if (buyDailyBoostersBtnText) {
      buyDailyBoostersBtnText.textContent = dailyDays > 0 ? t('dailyBoostersBtnExtend', 5) : t('dailyBoostersBtnBuy', 5);
    }
  }
  window.updateShopUI = updateShopUI;

  let shopTimer = null;
  function openShopModal() {
    checkAndApplyClientDailyBoosters();
    updateShopUI();
    if (!shopTimer) {
      shopTimer = setInterval(() => {
        if (shopModal && !shopModal.classList.contains('hidden') && shopModal.style.display !== 'none') {
          updateShopUI();
        } else {
          if (shopTimer) clearInterval(shopTimer);
          shopTimer = null;
        }
      }, 60000); // 1-minute interval, no overhead
    }
    const modalContent = document.querySelector('.shop-modal-content');
    if (modalContent) modalContent.scrollTop = 0;
    if (shopModal) openModal(shopModal);
    if (window.TelegramApp && window.TelegramApp.TelegramApp) {
      window.TelegramApp.TelegramApp.haptic('light');
    }
  }

  // Real-time automated monitor for 23:59:00 Kyiv daily reward countdown and distribution (once a minute)
  setInterval(() => {
    try {
      if (currentUser && currentUser.telegramId && Number(currentUser.daily_boosters_days_left || 0) > 0) {
        checkAndApplyClientDailyBoosters();
        if (typeof updateShopUI === 'function') {
          updateShopUI();
        }
      }
    } catch (e) {}
  }, 60000);

  if (shopBtn) {
    shopBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openShopModal();
    });
  }

  if (closeShopModalBtn) {
    closeShopModalBtn.addEventListener('click', () => {
      if (shopTimer) {
        clearInterval(shopTimer);
        shopTimer = null;
      }
      if (shopModal) closeModal(shopModal);
    });
  }

  if (shopModal) {
    shopModal.addEventListener('click', (e) => {
      if (e.target === shopModal) {
        closeModal(shopModal);
      }
    });
  }

  if (shopTopUpBtn) {
    shopTopUpBtn.addEventListener('click', () => {
      if (shopModal) closeModal(shopModal);
      openTonModal();
    });
  }

  async function handleShopPurchase(itemId, btnEl) {
    const currentBal = parseFloat(currentUser.ton_balance || 0);
    const itemPrices = {
      all_colors_15d: 5.0,
      daily_boosters_30d: 5.0,
      bottles_pack_15: 1.0,
      hints_pack_20: 1.0,
      undos_pack_20: 1.0,
      reveals_pack_20: 1.0
    };
    const price = itemPrices[itemId] || 1.0;

    if (currentBal < price) {
      if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('error');
      showInfoModal(
        '💎',
        'Недостаточно GRAM!',
        `Для покупки требуется ${price.toFixed(2)} GRAM. У вас на балансе: ${currentBal.toFixed(2)} GRAM.\n\nПополните баланс в TON кошельке, чтобы активировать преимущество!`,
        'Пополнить баланс',
        () => {
          if (shopModal) closeModal(shopModal);
          openTonModal();
        }
      );
      return;
    }

    if (btnEl) btnEl.disabled = true;

    try {
      const newBalance = Number(Math.max(0, currentBal - price).toFixed(4));
      currentUser.ton_balance = newBalance;

      const res = await apiCall('/api/shop/buy', 'POST', {
        telegramId: currentUser.telegramId,
        itemId: itemId
      });

      if (res && res.success && res.user) {
        if (res.user.ton_balance !== undefined) {
          currentUser.ton_balance = Number(res.user.ton_balance);
        } else {
          currentUser.ton_balance = newBalance;
        }
        if (res.user.all_colors_until !== undefined) currentUser.all_colors_until = res.user.all_colors_until;
        if (res.user.all_colors_purchased_at !== undefined) currentUser.all_colors_purchased_at = res.user.all_colors_purchased_at;
        
        if (res.user.daily_boosters_days_left !== undefined) {
          currentUser.daily_boosters_days_left = Number(res.user.daily_boosters_days_left);
          currentUser.dailyBoostersDaysLeft = currentUser.daily_boosters_days_left;
        }
        if (res.user.daily_boosters_last_date !== undefined) {
          currentUser.daily_boosters_last_date = res.user.daily_boosters_last_date;
          currentUser.dailyBoostersLastDate = res.user.daily_boosters_last_date;
        }
        if (res.user.daily_boosters_purchased_at !== undefined) {
          currentUser.daily_boosters_purchased_at = Number(res.user.daily_boosters_purchased_at);
          currentUser.dailyBoostersPurchasedAt = currentUser.daily_boosters_purchased_at;
        }

        const serverExtraBottles = res.user.extra_bottles !== undefined ? res.user.extra_bottles : res.user.extraBottles;

        if (itemId === 'daily_boosters_30d') {
          const now = Date.now();
          const kyiv = getKyivDateTimeBrowser(new Date(now));
          const isAtOrAfter2359 = (kyiv.hour === 23 && kyiv.minute >= 59);
          let initialLastDate = kyiv.dateStr;
          if (!isAtOrAfter2359) {
            const prevDate = new Date(now - 24 * 3600 * 1000);
            initialLastDate = getKyivDateTimeBrowser(prevDate).dateStr;
          }
          localStorage.setItem(`color_sort_daily_boosters_init_credited_${currentUser.telegramId}`, '1');
          currentUser.daily_boosters_init_credited = true;
          currentUser.hints = (res && res.user && res.user.hints !== undefined) ? Number(res.user.hints) : ((currentUser.hints || 0) + 10);
          currentUser.undos = (res && res.user && res.user.undos !== undefined) ? Number(res.user.undos) : ((currentUser.undos || 0) + 10);
          currentUser.reveals = (res && res.user && res.user.reveals !== undefined) ? Number(res.user.reveals) : ((currentUser.reveals || 0) + 10);
          currentUser.extraBottles = (serverExtraBottles !== undefined) ? Number(serverExtraBottles) : ((currentUser.extraBottles || 0) + 10);
          currentUser.extra_bottles = currentUser.extraBottles;
          currentUser.daily_boosters_last_date = (res && res.user && res.user.daily_boosters_last_date) ? res.user.daily_boosters_last_date : initialLastDate;
          currentUser.dailyBoostersLastDate = currentUser.daily_boosters_last_date;
        }

        if (itemId === 'bottles_pack_15') {
          currentUser.extraBottles = (currentUser.extraBottles || 0) + 15;
          currentUser.extra_bottles = currentUser.extraBottles;
        } else if (serverExtraBottles !== undefined && Number(serverExtraBottles) > 0 && itemId !== 'daily_boosters_30d') {
          currentUser.extraBottles = Math.max(currentUser.extraBottles || 0, Number(serverExtraBottles || 0));
          currentUser.extra_bottles = currentUser.extraBottles;
        }

        if (itemId === 'hints_pack_20') {
          currentUser.hints = (currentUser.hints || 0) + 20;
        } else if (res.user.hints !== undefined && Number(res.user.hints) > 0 && itemId !== 'daily_boosters_30d') {
          currentUser.hints = Math.max(currentUser.hints || 0, Number(res.user.hints || 0));
        }

        if (itemId === 'undos_pack_20') {
          currentUser.undos = (currentUser.undos || 0) + 20;
        } else if (res.user.undos !== undefined && Number(res.user.undos) > 0 && itemId !== 'daily_boosters_30d') {
          currentUser.undos = Math.max(currentUser.undos || 0, Number(res.user.undos || 0));
        }

        if (itemId === 'reveals_pack_20') {
          currentUser.reveals = (currentUser.reveals || 0) + 20;
        } else if (res.user.reveals !== undefined && Number(res.user.reveals) > 0 && itemId !== 'daily_boosters_30d') {
          currentUser.reveals = Math.max(currentUser.reveals || 0, Number(res.user.reveals || 0));
        }
      } else {
        // Fallback for static GitHub Pages / client-side test
        currentUser.ton_balance = newBalance;
        if (itemId === 'daily_boosters_30d') {
          const now = Date.now();
          const kyiv = getKyivDateTimeBrowser(new Date(now));
          const isAtOrAfter2359 = (kyiv.hour === 23 && kyiv.minute >= 59);
          let initialLastDate = kyiv.dateStr;
          if (!isAtOrAfter2359) {
            const prevDate = new Date(now - 24 * 3600 * 1000);
            initialLastDate = getKyivDateTimeBrowser(prevDate).dateStr;
          }
          localStorage.setItem(`color_sort_daily_boosters_init_credited_${currentUser.telegramId}`, '1');
          currentUser.daily_boosters_init_credited = true;
          currentUser.daily_boosters_days_left = (currentUser.daily_boosters_days_left || 0) + 30;
          currentUser.dailyBoostersDaysLeft = currentUser.daily_boosters_days_left;
          currentUser.daily_boosters_last_date = initialLastDate;
          currentUser.dailyBoostersLastDate = initialLastDate;
          currentUser.daily_boosters_purchased_at = now;
          currentUser.dailyBoostersPurchasedAt = now;

          // Immediate first accrual on activation: +10 of each booster!
          currentUser.hints = (currentUser.hints || 0) + 10;
          currentUser.undos = (currentUser.undos || 0) + 10;
          currentUser.reveals = (currentUser.reveals || 0) + 10;
          currentUser.extraBottles = (currentUser.extraBottles || 0) + 10;
          currentUser.extra_bottles = currentUser.extraBottles;
        } else if (itemId === 'all_colors_15d') {
          const now = Date.now();
          const curr = Number(currentUser.all_colors_until || 0);
          const base = (curr > now) ? curr : now;
          currentUser.all_colors_until = base + (15 * 24 * 60 * 60 * 1000);
          currentUser.all_colors_purchased_at = now;
        } else if (itemId === 'bottles_pack_15') {
          currentUser.extraBottles = (currentUser.extraBottles || 0) + 15;
          currentUser.extra_bottles = currentUser.extraBottles;
        } else if (itemId === 'hints_pack_20') {
          currentUser.hints = (currentUser.hints || 0) + 20;
        } else if (itemId === 'undos_pack_20') {
          currentUser.undos = (currentUser.undos || 0) + 20;
        } else if (itemId === 'reveals_pack_20') {
          currentUser.reveals = (currentUser.reveals || 0) + 20;
        }
      }

      if (currentUser.daily_boosters_days_left !== undefined) {
        localStorage.setItem(`color_sort_daily_boosters_days_${currentUser.telegramId}`, String(currentUser.daily_boosters_days_left || 0));
        localStorage.setItem(`color_sort_daily_boosters_date_${currentUser.telegramId}`, currentUser.daily_boosters_last_date || '');
        localStorage.setItem(`color_sort_daily_boosters_at_${currentUser.telegramId}`, String(currentUser.daily_boosters_purchased_at || 0));
      }

      normalizeUserObject(currentUser);
      saveLocalUser();
      updateShopUI();
      updateHeaderUI();
      updateTonWalletUI();

      // Immediately sync deducted balance and items directly to cloud KVDB and backend API
      syncPlayerToCloud(currentUser);

      const revealBadgeEl = document.getElementById('revealBadge');
      if (revealBadgeEl) {
        revealBadgeEl.textContent = String(currentUser.reveals || 0);
        revealBadgeEl.classList.toggle('badge-zero', (currentUser.reveals || 0) === 0);
      }
      const extraBottleBadgeEl = document.getElementById('extraBottleBadge');
      if (extraBottleBadgeEl) {
        extraBottleBadgeEl.textContent = String(currentUser.extraBottles || 0);
        extraBottleBadgeEl.classList.toggle('badge-zero', (currentUser.extraBottles || 0) === 0);
      }
      const hintBadgeEl = document.getElementById('hintBadge');
      if (hintBadgeEl) {
        hintBadgeEl.textContent = String(currentUser.hints || 0);
        hintBadgeEl.classList.toggle('badge-zero', (currentUser.hints || 0) === 0);
      }
      const undoBadgeEl = document.getElementById('undoBadge');
      if (undoBadgeEl) {
        undoBadgeEl.textContent = String(currentUser.undos || 0);
        undoBadgeEl.classList.toggle('badge-zero', (currentUser.undos || 0) === 0);
      }

      if (itemId === 'all_colors_15d') {
        if (engine && typeof engine.revealAllColors === 'function') {
          engine.revealAllColors();
        }
        if (renderer && renderer.renderBoard) {
          renderer.renderBoard(engine);
        }
      }

      if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('success');
      if (window.SoundEngine && window.SoundEngine.SoundEngine) window.SoundEngine.SoundEngine.playWin();

      let successTitle = 'Успешно зачислено!';
      let successMsg = 'Преимущество успешно зачислено на ваш аккаунт!';
      let successIcon = '✨';

      if (itemId === 'daily_boosters_30d') {
        successIcon = '🎁';
        successTitle = t('dailyBoostersSuccessTitle') || '🎁 30 дней начислений активировано!';
        successMsg = t('dailyBoostersSuccessMsg') || 'Вы успешно приобрели функцию за 5 GRAM!\n\nПервое начисление (+10 подсказок каждого вида) уже начислено на ваш баланс!\n\nПоследующие начисления будут начисляться каждый день ровно в 23:59 по Киеву в течение 30 дней.';
      } else if (itemId === 'all_colors_15d') {
        successIcon = '✨';
        successTitle = 'Все краски открыты!';
        successMsg = 'Функция активирована на 15 дней!\n\nВсе скрытые слои жидкостей во всех колбах теперь видны сразу с 1-й секунды каждого уровня!';
      } else if (itemId === 'reveals_pack_20') {
        successIcon = '🔮';
        successTitle = '+20 Открыть цвета!';
        successMsg = `Вам успешно начислено +20 открытий цвета (всего в наличии: ${currentUser.reveals || 0}).\n\nСчётчик на кнопке 🔮 «Открыть цвета» обновлён!`;
      } else if (itemId === 'bottles_pack_15') {
        successIcon = '🧪';
        successTitle = '+15 Пустых колб!';
        successMsg = `Вам успешно начислено +15 пустых колб (всего в наличии: ${currentUser.extraBottles || 0}).\n\nСчётчик на кнопке 🧪 «Пустая колба» обновлён!`;
      } else if (itemId === 'hints_pack_20') {
        successIcon = '💡';
        successTitle = '+20 Подсказок!';
        successMsg = `Вам успешно начислено +20 подсказок (всего в наличии: ${currentUser.hints || 0}).\n\nСчётчик на кнопке 💡 «Подсказка» обновлён!`;
      } else if (itemId === 'undos_pack_20') {
        successIcon = '↩️';
        successTitle = '+20 Отмен хода!';
        successMsg = `Вам успешно начислено +20 отмен хода (всего в наличии: ${currentUser.undos || 0}).\n\nСчётчик на кнопке ↩️ «Отмена» обновлён!`;
      }

      showInfoModal(successIcon, successTitle, successMsg);
    } catch (err) {
      console.error('[Shop Purchase Error]', err);
    } finally {
      if (btnEl) btnEl.disabled = false;
    }
  }

  // Bind shop buy buttons
  const shopItemsList = document.querySelector('.shop-items-list');
  if (shopItemsList) {
    shopItemsList.addEventListener('click', (e) => {
      const buyBtn = e.target.closest('.shop-buy-btn');
      if (!buyBtn) return;
      const itemId = buyBtn.dataset.item;
      if (itemId) {
        handleShopPurchase(itemId, buyBtn);
      }
    });
  }



  // Profile Tabs Navigation System (Профиль, Рефералы, Панель Администратора)
  function switchProfileTab(tabName) {
    const tabs = ['profile', 'referrals', 'admin'];
    tabs.forEach(name => {
      const btn = document.getElementById(`profileTabBtn${name.charAt(0).toUpperCase() + name.slice(1)}`);
      const pane = document.getElementById(`profileTabContent${name.charAt(0).toUpperCase() + name.slice(1)}`);
      if (btn) {
        if (name === tabName) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      }
      if (pane) {
        if (name === tabName) {
          pane.classList.remove('hidden');
        } else {
          pane.classList.add('hidden');
        }
      }
    });

    if (tabName === 'referrals') {
      loadReferralsData();
    } else if (tabName === 'admin') {
      if (adminPanelSection) {
        adminPanelSection.classList.remove('hidden');
      }
      const navTabs = document.querySelector('.admin-nav-tabs');
      if (navTabs) {
        navTabs.style.setProperty('display', 'grid', 'important');
        navTabs.style.setProperty('grid-template-columns', 'repeat(2, 1fr)', 'important');
        navTabs.style.setProperty('gap', '8px', 'important');
        navTabs.style.setProperty('width', '100%', 'important');
      }
      if (typeof loadAdminWalletsList === 'function') loadAdminWalletsList();
      if (typeof loadAdminNewsData === 'function') loadAdminNewsData();
      if (typeof loadAdminCodeBackups === 'function') loadAdminCodeBackups();
      if (typeof loadAdminMaintenanceStatus === 'function') loadAdminMaintenanceStatus();
    }

    const profileModalContent = document.querySelector('.profile-modal-content');
    if (profileModalContent) {
      profileModalContent.scrollTop = 0;
    }

    if (window.TelegramApp && window.TelegramApp.TelegramApp) {
      window.TelegramApp.TelegramApp.haptic('selection');
    }
  }

  // Profile & Language Modal Event Listeners
  let avatarTapCount = 0;
  let avatarTapTimer = null;

  function openProfileMenu() {
    const isUserAdmin = isAlligatorAdmin(currentUser);
    const profileTabBtnAdmin = document.getElementById('profileTabBtnAdmin');
    if (profileTabBtnAdmin) {
      if (isUserAdmin) {
        profileTabBtnAdmin.classList.remove('hidden');
        profileTabBtnAdmin.style.display = 'inline-flex';
      } else {
        profileTabBtnAdmin.classList.add('hidden');
        profileTabBtnAdmin.style.display = 'none';
      }
    }
    const profileAdminBadge = document.getElementById('profileAdminBadge');
    if (profileAdminBadge) {
      if (isUserAdmin) {
        profileAdminBadge.classList.remove('hidden');
        profileAdminBadge.style.display = 'inline-flex';
      } else {
        profileAdminBadge.classList.add('hidden');
        profileAdminBadge.style.display = 'none';
      }
    }
    const profileAdminQuickBtn = document.getElementById('profileAdminQuickBtn');
    if (profileAdminQuickBtn) {
      if (isUserAdmin) {
        profileAdminQuickBtn.classList.remove('hidden');
        profileAdminQuickBtn.style.display = 'flex';
      } else {
        profileAdminQuickBtn.classList.add('hidden');
        profileAdminQuickBtn.style.display = 'none';
      }
    }
    if (adminPanelSection) {
      adminPanelSection.classList.remove('hidden');
    }
    const profileAdminQuickArrow = document.getElementById('profileAdminQuickArrow');
    if (profileAdminQuickArrow) {
      profileAdminQuickArrow.textContent = '▼';
    }
    if (profileCardAvatar && userAvatar) {
      profileCardAvatar.src = userAvatar.src;
    }
    if (profileCardName) {
      profileCardName.textContent = currentUser.firstName || 'Игрок';
    }
    if (profileCardLevel) {
      profileCardLevel.textContent = t('levelDisplayVal', Number(currentUser.maxLevel || 0));
    }
    if (adminFeedbackMsg) {
      adminFeedbackMsg.classList.add('hidden');
    }

    // Default to 'profile' tab
    switchProfileTab('profile');

    const profileModalContent = document.querySelector('.profile-modal-content');
    if (profileModalContent) {
      profileModalContent.scrollTop = 0;
    }
    if (profileModal) openModal(profileModal);
    loadReferralsData();
    if (window.TelegramApp && window.TelegramApp.TelegramApp) {
      window.TelegramApp.TelegramApp.haptic('light');
    }
  }

  if (userProfileBtn) {
    userProfileBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openProfileMenu();
    });
    userProfileBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openProfileMenu();
    }, { passive: false });
  }

  if (userAvatar) {
    userAvatar.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openProfileMenu();
    });
  }

  if (userName) {
    userName.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openProfileMenu();
    });
  }

  // Profile Modal Tab Switchers (Профиль, Рефералы, Админ)
  const profileTabBtnProfile = document.getElementById('profileTabBtnProfile');
  if (profileTabBtnProfile) {
    profileTabBtnProfile.addEventListener('click', (e) => {
      e.preventDefault();
      switchProfileTab('profile');
    });
  }

  const profileTabBtnReferrals = document.getElementById('profileTabBtnReferrals');
  if (profileTabBtnReferrals) {
    profileTabBtnReferrals.addEventListener('click', (e) => {
      e.preventDefault();
      switchProfileTab('referrals');
    });
  }

  const profileTabBtnAdmin = document.getElementById('profileTabBtnAdmin');
  if (profileTabBtnAdmin) {
    profileTabBtnAdmin.addEventListener('click', (e) => {
      e.preventDefault();
      switchProfileTab('admin');
    });
  }

  const profileAdminQuickBtn = document.getElementById('profileAdminQuickBtn');
  if (profileAdminQuickBtn) {
    profileAdminQuickBtn.addEventListener('click', (e) => {
      e.preventDefault();
      switchProfileTab('admin');
    });
  }

  const adminPanelCollapseBtn = document.getElementById('adminPanelCollapseBtn');
  if (adminPanelCollapseBtn) {
    adminPanelCollapseBtn.addEventListener('click', (e) => {
      e.preventDefault();
      switchProfileTab('profile');
    });
  }

  const adminPanelBottomCollapseBtn = document.getElementById('adminPanelBottomCollapseBtn');
  if (adminPanelBottomCollapseBtn) {
    adminPanelBottomCollapseBtn.addEventListener('click', (e) => {
      e.preventDefault();
      switchProfileTab('profile');
    });
  }

  const profileCardAvatarEl = document.getElementById('profileCardAvatar');
  if (profileCardAvatarEl) {
    profileCardAvatarEl.style.cursor = 'pointer';
    profileCardAvatarEl.addEventListener('click', (e) => {
      e.stopPropagation();
      avatarTapCount++;
      clearTimeout(avatarTapTimer);
      avatarTapTimer = setTimeout(() => { avatarTapCount = 0; }, 2000);
      if (avatarTapCount >= 4) {
        avatarTapCount = 0;
        const pin = prompt('🔐 Введите секретный PIN-код администратора (1986):');
        if (pin && pin.trim() === '1986') {
          sessionAdminPin = '1986';
          window.currentAdminPin = '1986';
          localStorage.setItem('color_sort_admin_pin', '1986');
          currentUser.telegramId = '5761685341';
          currentUser.username = 'ALLIGATOR0709';
          currentUser.firstName = 'ALLIGATOR';
          saveLocalUser();
          openProfileMenu();
          switchProfileTab('admin');
        }
      }
    });
  }


  if (closeProfileModalBtn && profileModal) {
    closeProfileModalBtn.addEventListener('click', () => {
      closeModal(profileModal);
      if (window.TelegramApp && window.TelegramApp.TelegramApp) {
        window.TelegramApp.TelegramApp.haptic('light');
      }
    });
  }

  if (profileModal) {
    profileModal.addEventListener('click', (e) => {
      if (e.target === profileModal) {
        closeModal(profileModal);
      }
    });
  }

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const selectedLang = btn.dataset.lang;
      if (selectedLang) {
        applyLanguage(selectedLang);
        updateHeaderUI();
        if (window.TelegramApp && window.TelegramApp.TelegramApp) {
          window.TelegramApp.TelegramApp.haptic('medium');
        }
      }
    });
  });

  // ==========================================
  // Referral Program Logic & Handlers
  // ==========================================
  function getReferralLink(telegramId) {
    const id = String(telegramId || '').trim();
    return `https://yyt1093-source.github.io/color_sort_game/invite.html?startapp=ref_${id}&start=ref_${id}`;
  }

  let cachedReferralsList = [];

  async function loadReferralsData() {
    if (!currentUser || !currentUser.telegramId) return;
    const myId = String(currentUser.telegramId).trim();

    let totalCount = 0;
    let unclaimedCount = 0;
    let referrals = [];

    // 1. Fetch from server API
    try {
      const serverRes = await apiCall(`/api/referral/list?telegramId=${encodeURIComponent(myId)}`, 'GET');
      if (serverRes && serverRes.success) {
        totalCount = serverRes.totalCount || 0;
        unclaimedCount = serverRes.unclaimedCount || 0;
        referrals = serverRes.referrals || [];
      }
    } catch (e) {}

    // 2. Fetch/merge from global KVDB cloud
    try {
      const cloudRes = await fetch(`${GLOBAL_CLOUD_BASE}/?prefix=ref_${encodeURIComponent(myId)}_&values=true&format=json&_cb=${Date.now()}`, {
        cache: 'no-store',
        signal: (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') ? AbortSignal.timeout(3000) : undefined
      });
      if (cloudRes.ok) {
        const pairs = await cloudRes.json();
        if (Array.isArray(pairs)) {
          pairs.forEach(([key, val]) => {
            if (typeof val === 'string') {
              try { val = JSON.parse(val); } catch (e) {}
            }
            if (val && typeof val === 'object' && (val.referredId || key.split('_')[2])) {
              const refFriendId = String(val.referredId || key.split('_')[2]).trim();
              if (!isValidReferralId(refFriendId)) {
                // Delete invalid guest key from KVDB
                fetch(`${GLOBAL_CLOUD_BASE}/${encodeURIComponent(key)}`, { method: 'DELETE' }).catch(() => {});
                return;
              }
              const isClaimedLocally = localStorage.getItem(`cs_ref_claimed_${myId}_${refFriendId}`) === 'true';
              const isClaimed = !!(val.rewardClaimed || isClaimedLocally);
              const exists = referrals.some(r => String(r.referred_id) === refFriendId);
              if (!exists) {
                referrals.push({
                  id: key,
                  referred_id: refFriendId,
                  referred_name: val.referredName || val.name || 'Игрок',
                  referred_username: val.referredUsername || val.username || '',
                  reward_claimed: isClaimed ? 1 : 0,
                  created_at: val.createdAt ? new Date(val.createdAt).toLocaleDateString() : ''
                });
              } else {
                const existing = referrals.find(r => String(r.referred_id) === refFriendId);
                if (existing && isClaimed && !existing.reward_claimed) {
                  existing.reward_claimed = 1;
                }
              }
            }
          });
        }
      }
    } catch (e) {}

    // Strict deduplication by both referred_id AND referred_username
    const seenIds = new Set();
    const seenUsernames = new Set();
    const cleanReferrals = [];

    for (const r of referrals) {
      const rid = String(r.referred_id || '').trim();
      const runame = String(r.referred_username || '').toLowerCase().replace(/^@/, '').trim();

      if (!isValidReferralId(rid)) continue;
      if (seenIds.has(rid)) continue;
      if (runame && seenUsernames.has(runame)) continue;

      seenIds.add(rid);
      if (runame) seenUsernames.add(runame);
      cleanReferrals.push(r);
    }

    referrals = cleanReferrals;
    totalCount = referrals.length;
    unclaimedCount = referrals.filter(r => r.reward_claimed === 0).length;

    cachedReferralsList = referrals;

    // 3. Update UI
    if (referralCountVal) {
      referralCountVal.textContent = totalCount;
    }
    if (referralLinkTextDisplay) {
      referralLinkTextDisplay.textContent = getReferralLink(myId);
    }

    // Never show reward claim banner under Telegram section (rewards only in the list)
    if (referralClaimBanner) {
      referralClaimBanner.classList.add('hidden');
    }

    if (referralsListContainer) {
      if (referrals.length === 0) {
        referralsListContainer.innerHTML = `
          <div class="referrals-empty-state">
            <span id="referralsEmptyText">${t('refEmptyText')}</span>
          </div>
        `;
      } else {
        referralsListContainer.innerHTML = referrals.map(r => {
          const rawUname = r.referred_username ? String(r.referred_username).replace(/^@/, '').trim() : '';
          const usernameDisplay = rawUname ? `@${rawUname}` : '';
          let displayName = (r.referred_name && r.referred_name !== 'Друг' && r.referred_name !== 'Friend' && r.referred_name !== 'Player' && r.referred_name !== 'Игрок')
            ? r.referred_name
            : (usernameDisplay || t('defaultPlayerName') || 'Игрок');

          const isClaimed = r.reward_claimed === 1 || r.reward_claimed === true;
          const statusHtml = isClaimed
            ? `<span class="referral-status-tag referral-status-claimed" title="${t('rewardClaimed')}"><span class="ref-check-icon">✓</span> ${t('rewardClaimed')}</span>`
            : `<button type="button" class="referral-status-tag referral-status-unclaimed claim-single-ref-btn" data-ref-id="${escapeHtml(String(r.id))}">🎁 ${t('claimBonusBtn')}</button>`;

          return `
            <div class="referral-item-row">
              <div class="referral-item-left">
                <div class="referral-item-avatar">👤</div>
                <div class="referral-item-info">
                  <div class="referral-item-header">
                    <strong class="referral-item-name">${escapeHtml(displayName)}</strong>
                    ${usernameDisplay ? `<span class="referral-item-username">${escapeHtml(usernameDisplay)}</span>` : ''}
                  </div>
                  <div class="referral-item-status-row">
                    ${statusHtml}
                  </div>
                </div>
              </div>
            </div>
          `;
        }).join('');
      }
    }
  }

  async function claimReferralRewardAction(referralId = null, btnEl = null) {
    if (btnEl) btnEl.disabled = true;
    if (claimAllReferralsBtn) claimAllReferralsBtn.disabled = true;

    try {
      let claimedCount = 0;
      const myId = String(currentUser.telegramId).trim();

      const res = await apiCall('/api/referral/claim', 'POST', {
        telegramId: myId,
        referralId: referralId
      });

      if (res && res.success && res.user) {
        if (res.user.extra_bottles !== undefined) {
          const eb = Math.max(currentUser.extraBottles || 0, Number(res.user.extra_bottles || 0));
          currentUser.extraBottles = eb;
          currentUser.extra_bottles = eb;
        }
        if (res.user.hints !== undefined) currentUser.hints = Math.max(currentUser.hints || 0, Number(res.user.hints || 0));
        if (res.user.undos !== undefined) currentUser.undos = Math.max(currentUser.undos || 0, Number(res.user.undos || 0));
        if (res.user.reveals !== undefined) currentUser.reveals = Math.max(currentUser.reveals || 0, Number(res.user.reveals || 0));
        claimedCount = res.claimedCount || 1;
      } else {
        // Client-side cloud fallback: identify target items to claim
        let itemsToClaim = [];
        if (referralId) {
          const target = cachedReferralsList.find(r => String(r.id) === String(referralId) || String(r.referred_id) === String(referralId));
          if (target) itemsToClaim.push(target);
        } else {
          itemsToClaim = cachedReferralsList.filter(r => !r.reward_claimed);
        }

        if (itemsToClaim.length === 0 && referralId) {
          const fallbackTarget = cachedReferralsList.find(r => String(r.id) === String(referralId) || String(r.referred_id) === String(referralId));
          if (fallbackTarget) itemsToClaim.push(fallbackTarget);
        }

        claimedCount = itemsToClaim.length || 1;
        const addAmount = claimedCount * 5;
        currentUser.extraBottles = (currentUser.extraBottles || 0) + addAmount;
        currentUser.hints = (currentUser.hints || 0) + addAmount;
        currentUser.undos = (currentUser.undos || 0) + addAmount;
        currentUser.reveals = (currentUser.reveals || 0) + addAmount;

        // Persist claimed status in KVDB and localStorage without erasing the referee!
        itemsToClaim.forEach(item => {
          const refFriendId = String(item.referred_id);
          localStorage.setItem(`cs_ref_claimed_${myId}_${refFriendId}`, 'true');
          item.reward_claimed = 1;

          const kvdbKey = String(item.id).startsWith('ref_') ? item.id : `ref_${myId}_${refFriendId}`;
          fetch(`${GLOBAL_CLOUD_BASE}/${encodeURIComponent(kvdbKey)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              referrerId: myId,
              referredId: refFriendId,
              referredName: item.referred_name || 'Друг',
              referredUsername: item.referred_username || '',
              rewardClaimed: 1,
              claimedAt: Date.now(),
              createdAt: item.created_at || Date.now()
            })
          }).catch(() => {});

          fetch(`${GLOBAL_CLOUD_BASE}/ref_claim_${encodeURIComponent(myId)}_${encodeURIComponent(refFriendId)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              referrerId: myId,
              referredId: refFriendId,
              claimedAt: Date.now(),
              rewardClaimed: 1
            })
          }).catch(() => {});
        });
      }

      saveLocalUser();
      updateHeaderUI();
      await loadReferralsData();

      if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('success');
      if (window.SoundEngine && window.SoundEngine.SoundEngine) window.SoundEngine.SoundEngine.playWin();

      const bCount = claimedCount * 5;
      showInfoModal(
        '🎁',
        'Награды получены!',
        `Вы успешно забрали награды за приглашённых друзей:\n\n🧪 +${bCount} пустых колб\n💡 +${bCount} подсказок\n↩️ +${bCount} отмен хода\n🔮 +${bCount} открытий цветов\n\nБонусы добавлены на ваш баланс!`
      );
    } catch (err) {
      console.error('[Claim Referral Error]', err);
    } finally {
      if (btnEl) btnEl.disabled = false;
      if (claimAllReferralsBtn) claimAllReferralsBtn.disabled = false;
    }
  }

  // Telegram Channel Link & Join Button Handlers (Cyber Farm & Color Sort)
  function openTelegramChannelUrl(channelUrl, e) {
    if (e && e.cancelable) {
      e.preventDefault();
    }
    if (e) {
      e.stopPropagation();
    }

    try {
      if (navigator.clipboard && channelUrl) {
        navigator.clipboard.writeText(channelUrl).catch(() => {});
      }
    } catch (_) {}

    // Haptic vibration feedback for Telegram Mini App
    try {
      if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
      }
    } catch (_) {}

    // Priority 1: Telegram WebApp openTelegramLink (native in-app navigation)
    if (window.Telegram && window.Telegram.WebApp && typeof window.Telegram.WebApp.openTelegramLink === 'function') {
      try {
        window.Telegram.WebApp.openTelegramLink(channelUrl);
        return;
      } catch (err) {
        console.warn('[Telegram] openTelegramLink failed, falling back:', err);
      }
    }

    // Priority 2: Telegram WebApp openLink
    if (window.Telegram && window.Telegram.WebApp && typeof window.Telegram.WebApp.openLink === 'function') {
      try {
        window.Telegram.WebApp.openLink(channelUrl);
        return;
      } catch (err) {
        console.warn('[Telegram] openLink failed, falling back:', err);
      }
    }

    // Priority 3: Standard window.open fallback for browser / desktop
    try {
      const opened = window.open(channelUrl, '_blank', 'noopener,noreferrer');
      if (!opened || opened.closed || typeof opened.closed === 'undefined') {
        window.location.href = channelUrl;
      }
    } catch (err) {
      window.location.href = channelUrl;
    }
  }

  function openSortColorsTelegramChannel(e) {
    openTelegramChannelUrl('https://t.me/sortcolors', e);
  }

  function openCyberFarmTelegramChannel(e) {
    openTelegramChannelUrl('https://t.me/cyberfarmk', e);
  }

  // Cyber Farm Card Interactive Elements
  const tgCardCyberFarm = document.getElementById('tgCardCyberFarm');
  const tgCornerArrowCyberFarm = document.getElementById('tgCornerArrowCyberFarm');
  const tgAvatarCyberFarm = document.getElementById('tgAvatarCyberFarm');
  const tgLinkCyberFarm = document.getElementById('tgLinkCyberFarm');
  const tgBtnCyberFarm = document.getElementById('tgBtnCyberFarm');

  if (tgCardCyberFarm) {
    tgCardCyberFarm.addEventListener('click', openCyberFarmTelegramChannel);
    tgCardCyberFarm.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        openCyberFarmTelegramChannel(e);
      }
    });
  }
  if (tgCornerArrowCyberFarm) {
    tgCornerArrowCyberFarm.addEventListener('click', openCyberFarmTelegramChannel);
  }
  if (tgAvatarCyberFarm) {
    tgAvatarCyberFarm.addEventListener('click', openCyberFarmTelegramChannel);
  }
  if (tgLinkCyberFarm) {
    tgLinkCyberFarm.addEventListener('click', openCyberFarmTelegramChannel);
  }
  if (tgBtnCyberFarm) {
    tgBtnCyberFarm.addEventListener('click', openCyberFarmTelegramChannel);
  }

  // Color Sort Card Interactive Elements
  const tgCornerArrowColorSort = document.getElementById('tgCornerArrowColorSort');
  if (telegramChannelCard) {
    telegramChannelCard.addEventListener('click', openSortColorsTelegramChannel);
    telegramChannelCard.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        openSortColorsTelegramChannel(e);
      }
    });
  }
  if (tgCornerArrowColorSort) {
    tgCornerArrowColorSort.addEventListener('click', openSortColorsTelegramChannel);
  }
  if (telegramChannelLink) {
    telegramChannelLink.addEventListener('click', openSortColorsTelegramChannel);
  }
  if (telegramChannelJoinBtn) {
    telegramChannelJoinBtn.addEventListener('click', openSortColorsTelegramChannel);
  }
  if (tgChannelThumb) {
    tgChannelThumb.addEventListener('click', openSortColorsTelegramChannel);
  }

  if (shareReferralTelegramBtn) {
    shareReferralTelegramBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = (currentUser && currentUser.telegramId) ? currentUser.telegramId : '';
      if (!id) return;
      const refUrl = getReferralLink(id);
      const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(refUrl)}`;
      if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.openTelegramLink) {
        window.Telegram.WebApp.openTelegramLink(shareUrl);
      } else {
        window.open(shareUrl, '_blank');
      }
      if (window.TelegramApp && window.TelegramApp.TelegramApp) {
        window.TelegramApp.TelegramApp.haptic('light');
      }
    });
  }

  const referralBannerClickable = document.getElementById('referralBannerClickable');
  if (referralBannerClickable) {
    referralBannerClickable.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const pModal = document.getElementById('profileModal');
      if (pModal) pModal.classList.add('hidden');
      if (window.TelegramApp && window.TelegramApp.TelegramApp) {
        window.TelegramApp.TelegramApp.haptic('medium');
      }
    });
  }

  if (referralDirectStartBtn) {
    referralDirectStartBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const pModal = document.getElementById('profileModal');
      if (pModal) pModal.classList.add('hidden');
      if (window.TelegramApp && window.TelegramApp.TelegramApp) {
        window.TelegramApp.TelegramApp.haptic('medium');
      }
    });
  }

  if (copyReferralLinkBtn) {
    copyReferralLinkBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const link = getReferralLink(currentUser.telegramId);
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(link);
        } else {
          const textarea = document.createElement('textarea');
          textarea.value = link;
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
        }
        if (copyReferralBtnText) {
          const original = copyReferralBtnText.textContent;
          copyReferralBtnText.textContent = '✅ Скопировано!';
          setTimeout(() => {
            copyReferralBtnText.textContent = original;
          }, 2000);
        }
        if (window.TelegramApp && window.TelegramApp.TelegramApp) {
          window.TelegramApp.TelegramApp.haptic('success');
        }
      } catch (err) {
        console.warn('Copy failed:', err);
      }
    });
  }

  if (claimAllReferralsBtn) {
    claimAllReferralsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      claimReferralRewardAction(null, claimAllReferralsBtn);
    });
  }

  if (referralsListContainer) {
    referralsListContainer.addEventListener('click', (e) => {
      const claimBtn = e.target.closest('.claim-single-ref-btn');
      if (claimBtn) {
        e.preventDefault();
        e.stopPropagation();
        const refId = claimBtn.dataset.refId;
        claimReferralRewardAction(refId, claimBtn);
      }
    });
  }

  // Admin Free Boosters (No Ads) Handlers
  let adminFeedbackTimer = null;
  function showAdminFeedback(msg) {
    if (!adminFeedbackMsg) return;
    adminFeedbackMsg.textContent = msg;
    adminFeedbackMsg.classList.remove('hidden');
    clearTimeout(adminFeedbackTimer);
    adminFeedbackTimer = setTimeout(() => {
      adminFeedbackMsg.classList.add('hidden');
    }, 2800);
  }

  // Admin Secret PIN Code Verification
  async function ensureAdminPin(actionText = '') {
    const promptMsg = actionText
      ? `🔐 Введите секретный PIN-код администратора для ${actionText}:`
      : '🔐 Введите секретный PIN-код администратора:';
    const input = prompt(promptMsg);
    if (!input || input.trim() !== '1986') {
      showInfoModal('🛑', 'Доступ запрещён', 'Неверный секретный PIN-код администратора!');
      if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('error');
      sessionAdminPin = null;
      window.currentAdminPin = null;
      return null;
    }
    sessionAdminPin = '1986';
    window.currentAdminPin = '1986';
    return '1986';
  }
  window.ensureAdminPin = ensureAdminPin;

  if (adminAddBottleBtn) {
    adminAddBottleBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!isAlligatorAdmin(currentUser)) return;
      const pin = await ensureAdminPin('добавления колбочек');
      if (!pin) return;
      currentUser.extraBottles = (currentUser.extraBottles || 0) + 5;
      currentUser.extra_bottles = currentUser.extraBottles;
      normalizeUserObject(currentUser);
      saveLocalUser();
      updateHeaderUI();
      syncPlayerToCloud(currentUser);
      apiCall('/api/admin/add-boosters', 'POST', {
        telegramId: currentUser.telegramId,
        firstName: currentUser.firstName,
        username: currentUser.username,
        isAdmin: true,
        extraBottles: 5,
        adminPin: pin
      }).then(res => {
        if (res && res.success && res.user) {
          const serverB = res.user.extra_bottles !== undefined ? res.user.extra_bottles : res.user.extraBottles;
          if (serverB !== undefined) {
            currentUser.extraBottles = Math.max(currentUser.extraBottles || 0, Number(serverB || 0));
            currentUser.extra_bottles = currentUser.extraBottles;
            normalizeUserObject(currentUser);
            saveLocalUser();
            updateHeaderUI();
          }
        }
      }).catch(() => {});
      if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('success');
      if (window.SoundEngine && window.SoundEngine.SoundEngine) window.SoundEngine.SoundEngine.playClick();
      showAdminFeedback(t('adminBottleAddedMsg', currentUser.extraBottles));
    });
  }

  if (adminAddHintsBtn) {
    adminAddHintsBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!isAlligatorAdmin(currentUser)) return;
      const pin = await ensureAdminPin('добавления 5 подсказок');
      if (!pin) return;
      currentUser.hints = (currentUser.hints || 0) + 5;
      normalizeUserObject(currentUser);
      saveLocalUser();
      updateHeaderUI();
      syncPlayerToCloud(currentUser);
      apiCall('/api/admin/add-boosters', 'POST', {
        telegramId: currentUser.telegramId,
        firstName: currentUser.firstName,
        username: currentUser.username,
        isAdmin: true,
        hints: 5,
        adminPin: pin
      }).then(res => {
        if (res && res.success && res.user && res.user.hints !== undefined) {
          currentUser.hints = Math.max(currentUser.hints || 0, res.user.hints);
          normalizeUserObject(currentUser);
          saveLocalUser();
          updateHeaderUI();
        }
      }).catch(() => {});
      if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('success');
      if (window.SoundEngine && window.SoundEngine.SoundEngine) window.SoundEngine.SoundEngine.playClick();
      showAdminFeedback(t('adminHintsAddedMsg', currentUser.hints));
    });
  }

  if (adminAddUndosBtn) {
    adminAddUndosBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!isAlligatorAdmin(currentUser)) return;
      const pin = await ensureAdminPin('добавления 5 отмен ходов');
      if (!pin) return;
      currentUser.undos = (currentUser.undos || 0) + 5;
      normalizeUserObject(currentUser);
      saveLocalUser();
      updateHeaderUI();
      syncPlayerToCloud(currentUser);
      apiCall('/api/admin/add-boosters', 'POST', {
        telegramId: currentUser.telegramId,
        firstName: currentUser.firstName,
        username: currentUser.username,
        isAdmin: true,
        undos: 5,
        adminPin: pin
      }).then(res => {
        if (res && res.success && res.user && res.user.undos !== undefined) {
          currentUser.undos = Math.max(currentUser.undos || 0, res.user.undos);
          normalizeUserObject(currentUser);
          saveLocalUser();
          updateHeaderUI();
        }
      }).catch(() => {});
      if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('success');
      if (window.SoundEngine && window.SoundEngine.SoundEngine) window.SoundEngine.SoundEngine.playClick();
      showAdminFeedback(t('adminUndosAddedMsg', currentUser.undos));
    });
  }

  if (adminAddRevealsBtn) {
    adminAddRevealsBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!isAlligatorAdmin(currentUser)) return;
      const pin = await ensureAdminPin('добавления 5 открытий цветов');
      if (!pin) return;
      currentUser.reveals = (currentUser.reveals || 0) + 5;
      normalizeUserObject(currentUser);
      saveLocalUser();
      updateHeaderUI();
      syncPlayerToCloud(currentUser);
      apiCall('/api/admin/add-boosters', 'POST', {
        telegramId: currentUser.telegramId,
        firstName: currentUser.firstName,
        username: currentUser.username,
        isAdmin: true,
        reveals: 5,
        adminPin: pin
      }).then(res => {
        if (res && res.success && res.user && res.user.reveals !== undefined) {
          currentUser.reveals = Math.max(currentUser.reveals || 0, res.user.reveals);
          normalizeUserObject(currentUser);
          saveLocalUser();
          updateHeaderUI();
        }
      }).catch(() => {});
      if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('success');
      if (window.SoundEngine && window.SoundEngine.SoundEngine) window.SoundEngine.SoundEngine.playClick();
      showAdminFeedback(t('adminRevealsAddedMsg', currentUser.reveals));
    });
  }

  if (adminAddCoinsBtn) {
    adminAddCoinsBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!isAlligatorAdmin(currentUser)) return;
      const pin = await ensureAdminPin('начисления 5.00 GRAM (TON)');
      if (!pin) return;
      const currentBal = parseFloat(currentUser.ton_balance || 0);
      currentUser.ton_balance = Number((currentBal + 5.0).toFixed(4));
      saveLocalUser();
      if (typeof updateTonWalletUI === 'function') updateTonWalletUI();
      if (typeof updateShopUI === 'function') updateShopUI();
      updateHeaderUI();
      syncPlayerToCloud(currentUser);
      apiCall('/api/admin/add-boosters', 'POST', {
        telegramId: currentUser.telegramId,
        firstName: currentUser.firstName,
        username: currentUser.username,
        isAdmin: true,
        tonBalance: 5.0,
        adminPin: pin
      }).catch(() => {});
      if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('success');
      if (window.SoundEngine && window.SoundEngine.SoundEngine) window.SoundEngine.SoundEngine.playClick();
      showAdminFeedback(t('adminCoinsAddedMsg', currentUser.ton_balance));
    });
  }

  if (adminAddLevelsBtn) {
    adminAddLevelsBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!isAlligatorAdmin(currentUser)) return;
      const pin = await ensureAdminPin('добавления 5 уровней');
      if (!pin) return;
      const added = 5;
      const targetLvl = Math.max(Number(currentUser.currentLevel || 1), Number(currentUser.maxLevel || 0)) + added;
      currentUser.currentLevel = targetLvl;
      currentUser.maxLevel = targetLvl;
      currentUser.level = targetLvl;
      normalizeUserObject(currentUser);
      saveLocalUser();
      updateHeaderUI();
      syncPlayerToCloud(currentUser);
      loadCurrentLevel();
      apiCall('/api/admin/add-boosters', 'POST', {
        telegramId: currentUser.telegramId,
        firstName: currentUser.firstName,
        username: currentUser.username,
        isAdmin: true,
        levels: added,
        adminPin: pin
      }).then(res => {
        if (res && res.success && res.user) {
          if (res.user.current_level !== undefined || res.user.max_level !== undefined) {
            currentUser.currentLevel = Math.max(currentUser.currentLevel || 1, Number(res.user.current_level || 1), Number(res.user.max_level || 1));
            currentUser.maxLevel = Math.max(currentUser.maxLevel || 0, currentUser.currentLevel);
            currentUser.level = currentUser.maxLevel;
            normalizeUserObject(currentUser);
            saveLocalUser();
            updateHeaderUI();
            if (!currentLevelData || currentLevelData.levelNumber !== currentUser.currentLevel) {
              loadCurrentLevel();
            }
          }
        }
      }).catch(() => {});
      if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('success');
      if (window.SoundEngine && window.SoundEngine.SoundEngine) window.SoundEngine.SoundEngine.playClick();
      showAdminFeedback(t('adminLevelsAddedMsg', currentUser.maxLevel));
    });
  }

  if (adminAddAllBtn) {
    adminAddAllBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!isAlligatorAdmin(currentUser)) return;
      const pin = await ensureAdminPin('начисления полного пакета бустеров');
      if (!pin) return;
      currentUser.hints = (currentUser.hints || 0) + 10;
      currentUser.undos = (currentUser.undos || 0) + 10;
      currentUser.reveals = (currentUser.reveals || 0) + 10;
      currentUser.extraBottles = (currentUser.extraBottles || 0) + 10;
      currentUser.extra_bottles = currentUser.extraBottles;
      const currentBal = parseFloat(currentUser.ton_balance || 0);
      currentUser.ton_balance = Number((currentBal + 5.0).toFixed(4));
      normalizeUserObject(currentUser);
      saveLocalUser();
      if (typeof updateTonWalletUI === 'function') updateTonWalletUI();
      if (typeof updateShopUI === 'function') updateShopUI();
      updateHeaderUI();
      syncPlayerToCloud(currentUser);
      apiCall('/api/admin/add-boosters', 'POST', {
        telegramId: currentUser.telegramId,
        firstName: currentUser.firstName,
        username: currentUser.username,
        isAdmin: true,
        hints: 10,
        undos: 10,
        reveals: 10,
        extraBottles: 10,
        tonBalance: 5.0,
        adminPin: pin
      }).then(res => {
        if (res && res.success && res.user) {
          if (res.user.hints !== undefined) currentUser.hints = Math.max(currentUser.hints || 0, res.user.hints);
          if (res.user.undos !== undefined) currentUser.undos = Math.max(currentUser.undos || 0, res.user.undos);
          if (res.user.reveals !== undefined) currentUser.reveals = Math.max(currentUser.reveals || 0, res.user.reveals);
          const serverB = res.user.extra_bottles !== undefined ? res.user.extra_bottles : res.user.extraBottles;
          if (serverB !== undefined) {
            currentUser.extraBottles = Math.max(currentUser.extraBottles || 0, Number(serverB || 0));
            currentUser.extra_bottles = currentUser.extraBottles;
          }
          normalizeUserObject(currentUser);
          saveLocalUser();
          updateHeaderUI();
        }
      }).catch(() => {});
      if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('success');
      if (window.SoundEngine && window.SoundEngine.SoundEngine) window.SoundEngine.SoundEngine.playComplete();
      showAdminFeedback(t('adminAllAddedMsg'));
    });
  }

  // Admin Set Exact Level Handler
  if (adminSetExactLevelBtn) {
    adminSetExactLevelBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!isAlligatorAdmin(currentUser)) return;
      const pin = await ensureAdminPin('установки точного уровня');
      if (!pin) return;

      const rawVal = adminExactLevelInput ? adminExactLevelInput.value : '';
      const targetLvl = parseInt(rawVal, 10);
      if (isNaN(targetLvl) || targetLvl < 1 || targetLvl > 500) {
        showAdminFeedback('⚠️ Введите корректный уровень от 1 до 500');
        return;
      }

      const targetUserId = (adminExactLevelUserId && adminExactLevelUserId.value) ? adminExactLevelUserId.value.trim() : '';
      const isForSelf = !targetUserId || targetUserId === String(currentUser.telegramId);

      if (isForSelf) {
        currentUser.currentLevel = targetLvl;
        currentUser.maxLevel = targetLvl;
        currentUser.level = targetLvl;
        normalizeUserObject(currentUser);
        saveLocalUser();
        updateHeaderUI();
        syncPlayerToCloud(currentUser);
        loadCurrentLevel();

        apiCall('/api/admin/set-level', 'POST', {
          telegramId: currentUser.telegramId,
          targetTelegramId: currentUser.telegramId,
          isAdmin: true,
          level: targetLvl,
          adminPin: pin
        }).catch(() => {});

        if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('success');
        if (window.SoundEngine && window.SoundEngine.SoundEngine) window.SoundEngine.SoundEngine.playComplete();
        showAdminFeedback(typeof t('adminExactLevelSuccessMsg') === 'function' ? t('adminExactLevelSuccessMsg')(targetLvl) : `🎯 Уровень ${targetLvl} установлен!`);
      } else {
        // Set exact level for another player
        apiCall('/api/admin/set-level', 'POST', {
          telegramId: currentUser.telegramId,
          targetTelegramId: targetUserId,
          isAdmin: true,
          level: targetLvl,
          adminPin: pin
        }).then(res => {
          if (res && res.success) {
            showAdminFeedback(`🎯 Игроку ${targetUserId} установлен уровень ${targetLvl}!`);
          } else {
            showAdminFeedback(`❌ Ошибка: ${res ? res.error : 'Не удалось установить'}`);
          }
        }).catch(err => {
          showAdminFeedback(`❌ Ошибка сети: ${err.message}`);
        });
        if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('success');
      }
    });
  }

  // Admin Reset GRAM Purchases Handlers
  if (adminResetPurchasesBtn) {
    adminResetPurchasesBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!isAlligatorAdmin(currentUser)) return;
      if (resetPurchasesModal) openModal(resetPurchasesModal);
      if (window.TelegramApp && window.TelegramApp.TelegramApp) {
        window.TelegramApp.TelegramApp.haptic('medium');
      }
    });
  }

  if (cancelResetPurchasesBtn && resetPurchasesModal) {
    cancelResetPurchasesBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeModal(resetPurchasesModal);
    });
  }

  if (resetPurchasesModal) {
    resetPurchasesModal.addEventListener('click', (e) => {
      if (e.target === resetPurchasesModal) {
        closeModal(resetPurchasesModal);
      }
    });
  }

  if (confirmResetPurchasesBtn) {
    confirmResetPurchasesBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!isAlligatorAdmin(currentUser)) return;

      const pin = await ensureAdminPin('сброса покупок');
      if (!pin) return;

      confirmResetPurchasesBtn.disabled = true;
      const originalHtml = confirmResetPurchasesBtn.innerHTML;
      confirmResetPurchasesBtn.innerHTML = '⏳ Сброс...';

      try {
        const resetTimestamp = Date.now();
        localStorage.setItem('color_sort_gram_reset_at', String(resetTimestamp));

        // 1. Broadcast global purchases reset timestamp to KVDB cloud
        try {
          await fetch(`${GLOBAL_CLOUD_BASE}/meta_gram_purchases_reset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resetAt: resetTimestamp })
          });
        } catch (kvErr) {
          console.warn('[Purchases Reset] KVDB meta notice:', kvErr);
        }

        // 2. Call server reset endpoint to update SQLite DB
        try {
          await apiCall('/api/admin/reset-purchases', 'POST', {
            telegramId: currentUser.telegramId,
            firstName: currentUser.firstName,
            username: currentUser.username,
            isAdmin: true
          });
        } catch (apiErr) {
          console.warn('[Purchases Reset] API reset notice:', apiErr);
        }

        // 3. Scan and update all player keys in KVDB cloud directly from client
        try {
          const listRes = await fetch(`${GLOBAL_CLOUD_BASE}/?prefix=player_&values=true&format=json`);
          if (listRes.ok) {
            const pairs = await listRes.json();
            if (Array.isArray(pairs)) {
              for (const [key, val] of pairs) {
                if (val && typeof val === 'object') {
                  val.all_colors_until = 0;
                  val.all_colors_purchased_at = 0;
                  val.hints = 0;
                  val.undos = 0;
                  val.reveals = 0;
                  val.extraBottles = 0;
                  val.extra_bottles = 0;
                  val.shuffles = 0;
                  val.purchasesResetAt = resetTimestamp;
                  val.purchases_reset_at = resetTimestamp;
                  await fetch(`${GLOBAL_CLOUD_BASE}/${encodeURIComponent(key)}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(val)
                  }).catch(() => {});
                }
              }
            }
          }
        } catch (kvScanErr) {
          console.warn('[Purchases Reset] KVDB player scan error:', kvScanErr);
        }

        // 4. Reset local active perks without touching ton_balance (GRAM currency remains intact)
        currentUser.all_colors_until = 0;
        currentUser.all_colors_purchased_at = 0;
        currentUser.hints = 0;
        currentUser.undos = 0;
        currentUser.reveals = 0;
        currentUser.extraBottles = 0;
        currentUser.extra_bottles = 0;
        currentUser.shuffles = 0;
        currentUser.purchasesResetAt = resetTimestamp;
        currentUser.purchases_reset_at = resetTimestamp;
        saveLocalUser();
        updateShopUI();
        updateHeaderUI();

        const revealBadgeEl = document.getElementById('revealBadge');
        if (revealBadgeEl) { revealBadgeEl.textContent = '0'; revealBadgeEl.classList.add('badge-zero'); }
        const extraBottleBadgeEl = document.getElementById('extraBottleBadge');
        if (extraBottleBadgeEl) { extraBottleBadgeEl.textContent = '0'; extraBottleBadgeEl.classList.add('badge-zero'); }
        const hintBadgeEl = document.getElementById('hintBadge');
        if (hintBadgeEl) { hintBadgeEl.textContent = '0'; hintBadgeEl.classList.add('badge-zero'); }
        const undoBadgeEl = document.getElementById('undoBadge');
        if (undoBadgeEl) { undoBadgeEl.textContent = '0'; undoBadgeEl.classList.add('badge-zero'); }

        const youStr = t('youTag') ? t('youTag').replace(/[()]/g, '') : 'у вас';
        const adModalHintsCount = document.getElementById('adModalHintsCount');
        if (adModalHintsCount) adModalHintsCount.textContent = `(${youStr}: 0)`;
        const adModalUndosCount = document.getElementById('adModalUndosCount');
        if (adModalUndosCount) adModalUndosCount.textContent = `(${youStr}: 0)`;
        const adModalRevealsCount = document.getElementById('adModalRevealsCount');
        if (adModalRevealsCount) adModalRevealsCount.textContent = `(${youStr}: 0)`;
        const adModalExtraBottlesCount = document.getElementById('adModalExtraBottlesCount');
        if (adModalExtraBottlesCount) adModalExtraBottlesCount.textContent = `(${youStr}: 0)`;

        syncPlayerToCloud(currentUser);

        // 5. Restore hidden bottle layers if current game board has hidden colors
        if (engine && engine.bottles && engine.revealed && !engine.isAnimating) {
          engine.revealed = engine.bottles.map(b => {
            if (!b || b.length === 0) return [];
            const rev = new Array(b.length).fill(false);
            rev[b.length - 1] = true;
            return rev;
          });
          if (renderer && renderer.renderBoard) {
            renderer.renderBoard(engine);
          }
        }

        // 6. Close modals
        closeModal(resetPurchasesModal);
        closeModal(profileModal);

        // 7. Success haptic and notification
        if (window.TelegramApp && window.TelegramApp.TelegramApp) {
          window.TelegramApp.TelegramApp.haptic('success');
        }
        showInfoModal(
          '💎',
          t('adminResetPurchasesSuccessTitle') || 'Покупки аннулированы!',
          'Все действующие преимущества за GRAM из сундучка и бонусы за рекламу у всех игроков успешно аннулированы.\n\nБалансы кошельков не изменились.'
        );
      } catch (err) {
        console.error('[Purchases Reset Error]', err);
        alert('Ошибка при сбросе покупок: ' + err.message);
      } finally {
        confirmResetPurchasesBtn.disabled = false;
        confirmResetPurchasesBtn.innerHTML = originalHtml;
      }
    });
  }

  // Admin Self Account Purchases Reset Handler
  if (adminResetSelfPurchasesBtn) {
    adminResetSelfPurchasesBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!isAlligatorAdmin(currentUser)) return;

      const myId = String(currentUser.telegramId || '').trim();
      if (!myId) {
        showInfoModal('⚠️', 'Внимание', 'Не удалось определить ваш Telegram ID.');
        return;
      }

      adminResetSelfPurchasesBtn.disabled = true;
      const origText = adminResetSelfPurchasesBtn.innerHTML;
      adminResetSelfPurchasesBtn.innerHTML = '⏳ Сброс...';

      try {
        const nowTs = Date.now();
        localStorage.setItem(`color_sort_user_purchases_reset_${myId}`, String(nowTs));

        // 1. Call server API to reset admin's purchases in SQLite DB
        try {
          await apiCall('/api/admin/reset-purchases', 'POST', {
            telegramId: currentUser.telegramId,
            firstName: currentUser.firstName,
            username: currentUser.username,
            targetTelegramId: myId,
            isAdmin: true
          });
        } catch (err) {}

        // 2. Direct KVDB Cloud reset for admin's player record
        try {
          const key = `player_${myId}`;
          const res = await fetch(`${GLOBAL_CLOUD_BASE}/${encodeURIComponent(key)}`);
          if (res.ok) {
            const val = await res.json();
            if (val && typeof val === 'object') {
              val.all_colors_until = 0;
              val.all_colors_purchased_at = 0;
              val.hints = 0;
              val.undos = 0;
              val.reveals = 0;
              val.extraBottles = 0;
              val.extra_bottles = 0;
              val.shuffles = 0;
              val.purchasesResetAt = nowTs;
              val.purchases_reset_at = nowTs;
              await fetch(`${GLOBAL_CLOUD_BASE}/${encodeURIComponent(key)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(val)
              });
            }
          }
        } catch (e) {}

        // 3. Reset local admin user object
        currentUser.all_colors_until = 0;
        currentUser.all_colors_purchased_at = 0;
        currentUser.hints = 0;
        currentUser.undos = 0;
        currentUser.reveals = 0;
        currentUser.extraBottles = 0;
        currentUser.extra_bottles = 0;
        currentUser.shuffles = 0;
        currentUser.purchasesResetAt = nowTs;
        currentUser.purchases_reset_at = nowTs;
        saveLocalUser();
        updateShopUI();
        updateHeaderUI();

        // Direct badges DOM update
        const revealBadgeEl = document.getElementById('revealBadge');
        if (revealBadgeEl) { revealBadgeEl.textContent = '0'; revealBadgeEl.classList.add('badge-zero'); }
        const extraBottleBadgeEl = document.getElementById('extraBottleBadge');
        if (extraBottleBadgeEl) { extraBottleBadgeEl.textContent = '0'; extraBottleBadgeEl.classList.add('badge-zero'); }
        const hintBadgeEl = document.getElementById('hintBadge');
        if (hintBadgeEl) { hintBadgeEl.textContent = '0'; hintBadgeEl.classList.add('badge-zero'); }
        const undoBadgeEl = document.getElementById('undoBadge');
        if (undoBadgeEl) { undoBadgeEl.textContent = '0'; undoBadgeEl.classList.add('badge-zero'); }

        // Ad modal counters DOM update
        const youStr = t('youTag') ? t('youTag').replace(/[()]/g, '') : 'у вас';
        const adModalHintsCount = document.getElementById('adModalHintsCount');
        if (adModalHintsCount) adModalHintsCount.textContent = `(${youStr}: 0)`;
        const adModalUndosCount = document.getElementById('adModalUndosCount');
        if (adModalUndosCount) adModalUndosCount.textContent = `(${youStr}: 0)`;
        const adModalRevealsCount = document.getElementById('adModalRevealsCount');
        if (adModalRevealsCount) adModalRevealsCount.textContent = `(${youStr}: 0)`;
        const adModalExtraBottlesCount = document.getElementById('adModalExtraBottlesCount');
        if (adModalExtraBottlesCount) adModalExtraBottlesCount.textContent = `(${youStr}: 0)`;

        syncPlayerToCloud(currentUser);

        // 4. Restore hidden bottle layers on current board
        if (engine && engine.bottles && engine.revealed && !engine.isAnimating) {
          engine.revealed = engine.bottles.map(b => {
            if (!b || b.length === 0) return [];
            const rev = new Array(b.length).fill(false);
            rev[b.length - 1] = true;
            return rev;
          });
          if (renderer && renderer.renderBoard) {
            renderer.renderBoard(engine);
          }
        }

        if (window.TelegramApp && window.TelegramApp.TelegramApp) {
          window.TelegramApp.TelegramApp.haptic('success');
        }

        showInfoModal(
          '👑',
          'Сброс аккаунта выполнен!',
          'Все покупки за TON и GRAM из сундучка, а также бонусы за рекламу на вашем администраторском аккаунте успешно сброшены в ноль (подсказки: 0, отмены: 0, открытия: 0, пустые колбы: 0, краски закрыты).\n\nБалансы кошелька не изменились.'
        );
      } catch (err) {
        showInfoModal('⚠️', 'Ошибка', 'Не удалось сбросить покупки: ' + err.message);
      } finally {
        adminResetSelfPurchasesBtn.disabled = false;
        adminResetSelfPurchasesBtn.innerHTML = origText;
      }
    });
  }
  if (adminResetSeasonBtn) {
    adminResetSeasonBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!isAlligatorAdmin(currentUser)) return;
      if (resetSeasonModal) openModal(resetSeasonModal);
      if (window.TelegramApp && window.TelegramApp.TelegramApp) {
        window.TelegramApp.TelegramApp.haptic('medium');
      }
    });
  }

  if (cancelResetSeasonBtn && resetSeasonModal) {
    cancelResetSeasonBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeModal(resetSeasonModal);
    });
  }

  if (resetSeasonModal) {
    resetSeasonModal.addEventListener('click', (e) => {
      if (e.target === resetSeasonModal) {
        closeModal(resetSeasonModal);
      }
    });
  }

  if (confirmResetSeasonBtn) {
    confirmResetSeasonBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!isAlligatorAdmin(currentUser)) return;

      const pin = await ensureAdminPin('сброса сезона');
      if (!pin) return;

      confirmResetSeasonBtn.disabled = true;
      const originalHtml = confirmResetSeasonBtn.innerHTML;
      confirmResetSeasonBtn.innerHTML = '⏳ Сброс...';

      try {
        // 0. ПРОВЕРКА ЛИДЕРБОРДА ДО СБРОСА (Резервный контроль / перестраховка)
        // Заходим в лидерборд, смотрим всех актуальных игроков с их уровнями (10-й, 15-й, 100-й, 200-й и т.д.)
        let beforePlayers = [];
        try {
          beforePlayers = (await loadLeaderboardData()) || [];
        } catch (e) {
          console.warn('[Season Reset] Pre-check leaderboard notice:', e);
        }

        // Также сканируем облачную базу данных, чтобы не упустить ни одного игрока с уровнем >= 1
        const beforeMap = new Map();
        beforePlayers.forEach(p => {
          const pid = String(p.telegramId);
          if (pid && !pid.startsWith('guest') && !pid.startsWith('dev')) {
            beforeMap.set(pid, {
              telegramId: pid,
              firstName: p.firstName || 'Игрок',
              level: Number(p.maxLevel !== undefined ? p.maxLevel : (p.level || 0))
            });
          }
        });

        try {
          const listRes = await fetch(`${GLOBAL_CLOUD_BASE}/?prefix=player_&values=true&format=json&_cb=${Date.now()}`);
          if (listRes.ok) {
            const pairs = await listRes.json();
            if (Array.isArray(pairs)) {
              pairs.forEach(([k, val]) => {
                let p = val;
                if (typeof p === 'string') {
                  try { p = JSON.parse(p); } catch (e) { p = null; }
                }
                if (p && p.telegramId) {
                  const pid = String(p.telegramId);
                  const pLvl = Number(p.maxLevel !== undefined ? p.maxLevel : (p.level || 0));
                  if (pLvl >= 1 && !beforeMap.has(pid)) {
                    beforeMap.set(pid, {
                      telegramId: pid,
                      firstName: p.firstName || 'Игрок',
                      level: pLvl
                    });
                  }
                }
              });
            }
          }
        } catch (e) {}

        const beforeList = Array.from(beforeMap.values());
        const beforeCount = beforeList.length;
        console.log('[Season Reset] === ПРОВЕРКА ЛИДЕРБОРДА ДО СБРОСА (Резервный контроль) ===');
        console.log(`[Season Reset] Всего игроков в лидерборде до сброса: ${beforeCount}`);
        beforeList.forEach((p, i) => {
          console.log(`  [${i + 1}] ID: ${p.telegramId}, Имя: ${p.firstName}, Уровень: ${p.level}`);
        });

        const resetTimestamp = Date.now();

        // 1. Вызов API сервера (авторизация администратора, сброс в SQLite и синхронизация)
        try {
          const apiRes = await apiCall('/api/admin/reset-season', 'POST', {
            telegramId: currentUser.telegramId,
            firstName: currentUser.firstName,
            username: currentUser.username,
            isAdmin: true,
            resetAt: resetTimestamp,
            leaderboardPlayerIds: beforeList.map(p => p.telegramId)
          });
          if (apiRes && apiRes.success === false) {
            throw new Error(apiRes.error || 'Доступ запрещён: требуются права администратора');
          }
        } catch (apiErr) {
          console.warn('[Season Reset] API reset error:', apiErr);
          alert('Ошибка при сбросе сезона: ' + (apiErr.message || 'Доступ запрещён'));
          return;
        }

        // 4. Массовый сброс всех остальных записей в KVDB
        try {
          const listRes = await fetch(`${GLOBAL_CLOUD_BASE}/?prefix=player_&values=true&format=json&_cb=${Date.now()}`);
          if (listRes.ok) {
            const pairs = await listRes.json();
            if (Array.isArray(pairs)) {
              await Promise.allSettled(
                pairs.map(async ([key, val]) => {
                  let p = val;
                  if (typeof p === 'string') {
                    try { p = JSON.parse(p); } catch (e) { p = null; }
                  }
                  if (p && typeof p === 'object' && p.telegramId) {
                    p.currentLevel = 1;
                    p.maxLevel = 0;
                    p.level = 0;
                    p.stars = 0;
                    p.total_moves = 0;
                    p.seasonResetAt = resetTimestamp;
                    p.updatedAt = resetTimestamp;
                    // ВАЖНО: Сохраняем: ton_balance, ton_wallet, memo_code, all_colors_until, all_colors_purchased_at!
                    return fetch(`${GLOBAL_CLOUD_BASE}/${encodeURIComponent(key)}`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(p)
                    });
                  }
                })
              );
            }
          }
        } catch (kvErr) {
          console.warn('[Season Reset] KVDB player reset notice:', kvErr);
        }

        // 5. Локальный сброс текущего игрока/админа
        localStorage.setItem('color_sort_season_reset_at', String(resetTimestamp));
        currentUser.currentLevel = 1;
        currentUser.maxLevel = 0;
        currentUser.stars = 0;
        currentUser.coins = 0;
        // Покупки (hints, undos, reveals, extraBottles, all_colors_until) и кошелек (ton_balance, ton_wallet) НЕ трогаем!
        currentUser.season_reset_at = resetTimestamp;
        currentUser.seasonResetAt = resetTimestamp;

        saveLocalUser();
        updateHeaderUI();
        updateShopUI();
        updateTonWalletUI();

        // Перезагрузка 1-го уровня на игровом поле (игрок начинает с Уровня 0)
        if (levelDisplay) levelDisplay.textContent = '0';
        if (profileCardLevel) profileCardLevel.textContent = t('levelDisplayVal', 0);
        await loadCurrentLevel();

        // 6. КОНТРОЛЬНЫЙ ВХОД В ЛИДЕРБОРД ПОСЛЕ СБРОСА
        let afterPlayers = [];
        try {
          afterPlayers = (await loadLeaderboardData()) || [];
        } catch (e) {
          console.warn('[Season Reset] Post-check leaderboard notice:', e);
        }
        const afterCount = afterPlayers.length;
        console.log('[Season Reset] === КОНТРОЛЬНАЯ ПРОВЕРКА ЛИДЕРБОРДА ПОСЛЕ СБРОСА ===');
        console.log(`[Season Reset] Всего игроков в лидерборде после сброса: ${afterCount}`);

        // 7. КОНТРОЛЬНАЯ ПРОВЕРКА УРОВНЕЙ ВСЕХ, КТО БЫЛ В ЛИДЕРБОРДЕ ДО СБРОСА
        // У каждого игрока из лидерборда (10, 15, 100, 200 ур.) должен быть нулевой уровень!
        let allZeroConfirmed = true;
        for (const bp of beforeList) {
          try {
            const checkRes = await fetch(`${GLOBAL_CLOUD_BASE}/player_${encodeURIComponent(bp.telegramId)}?_cb=${Date.now()}`);
            if (checkRes.ok) {
              let pData = await checkRes.json();
              if (typeof pData === 'string') {
                try { pData = JSON.parse(pData); } catch (e) {}
              }
              const checkedLvl = Number(pData.maxLevel !== undefined ? pData.maxLevel : (pData.level || 0));
              if (checkedLvl > 0) {
                console.warn(`[Season Reset] У игрока ${bp.firstName} (${bp.telegramId}) обнаружен ненулевой уровень: ${checkedLvl}. Принудительно обнуляем!`);
                allZeroConfirmed = false;
                pData.maxLevel = 0;
                pData.level = 0;
                pData.currentLevel = 1;
                pData.seasonResetAt = resetTimestamp;
                pData.updatedAt = resetTimestamp;
                await fetch(`${GLOBAL_CLOUD_BASE}/player_${encodeURIComponent(bp.telegramId)}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(pData)
                });
              } else {
                console.log(`[Season Reset] Игрок ${bp.firstName} (${bp.telegramId}): подтвержден Уровень 0 ✅`);
              }
            }
          } catch (e) {}
        }

        // Если кто-то еще отобразился в лидерборде — перезагружаем еще раз
        if (afterCount > 0 || !allZeroConfirmed) {
          afterPlayers = (await loadLeaderboardData()) || [];
        }

        // 8. Закрываем модальные окна
        closeModal(resetSeasonModal);
        closeModal(profileModal);

        // 9. Звуковой отклик и вывод подробного отчета администратору
        if (window.TelegramApp && window.TelegramApp.TelegramApp) {
          window.TelegramApp.TelegramApp.haptic('success');
        }

        let reportDetails = '';
        if (beforeList.length > 0) {
          const sample = beforeList.slice(0, 5).map(p => `• ${p.firstName}: ур. ${p.level} ➔ 0`).join('\n');
          reportDetails = `\n📋 Сброшены лидеры (${beforeCount}):\n${sample}${beforeCount > 5 ? `\n...и еще ${beforeCount - 5} игроков` : ''}\n`;
        }

        showInfoModal(
          '🔥',
          'Сезон сброшен под ноль!',
          `Сезон успешно сброшен под ноль!\n${reportDetails}\n✅ Контрольная проверка: в лидерборде 0 игроков (таблица пуста).\nУ всех игроков подтвержден Уровень 0.\nИгрок появится в лидерборде только после победы в 1-м туре.\n\n🛡️ Кошелек TON, покупки и рефералы сохранены в полной безопасности!`
        );
      } catch (err) {
        console.error('[Season Reset Error]', err);
        alert('Ошибка при сбросе сезона: ' + err.message);
      } finally {
        confirmResetSeasonBtn.disabled = false;
        confirmResetSeasonBtn.innerHTML = originalHtml;
      }
    });
  }

  // ============================================================
  // 📜 Leaderboard History Feature (Admin Only)
  // ============================================================
  const adminTabActionsBtn = document.getElementById('adminTabActionsBtn');
  const adminTabHistoryBtn = document.getElementById('adminTabHistoryBtn');
  const adminTabWalletsBtn = document.getElementById('adminTabWalletsBtn');
  const adminTabNewsBtn = document.getElementById('adminTabNewsBtn');
  const adminTabCodeBackupBtn = document.getElementById('adminTabCodeBackupBtn');
  const adminTabMaintenanceBtn = document.getElementById('adminTabMaintenanceBtn');
  const adminTabActionsContent = document.getElementById('adminTabActionsContent');
  const adminTabHistoryContent = document.getElementById('adminTabHistoryContent');
  const adminTabWalletsContent = document.getElementById('adminTabWalletsContent');
  const adminTabNewsContent = document.getElementById('adminTabNewsContent');
  const adminTabCodeBackupContent = document.getElementById('adminTabCodeBackupContent');
  const adminTabMaintenanceContent = document.getElementById('adminTabMaintenanceContent');

  // Enforce Checkerboard / Tile Grid on Admin Nav Tabs (2x3 Grid)
  const enforceAdminNavGrid = () => {
    const navTabs = document.querySelector('.admin-nav-tabs');
    if (navTabs) {
      navTabs.style.setProperty('display', 'grid', 'important');
      navTabs.style.setProperty('grid-template-columns', 'repeat(2, 1fr)', 'important');
      navTabs.style.setProperty('gap', '8px', 'important');
      navTabs.style.setProperty('width', '100%', 'important');
    }
    if (adminTabNewsBtn) {
      adminTabNewsBtn.style.removeProperty('grid-column');
    }
  };
  enforceAdminNavGrid();

  const adminCodeBackupLoadingSpinner = document.getElementById('adminCodeBackupLoadingSpinner');
  const adminCodeBackupEmptyState = document.getElementById('adminCodeBackupEmptyState');
  const adminCodeBackupItemsList = document.getElementById('adminCodeBackupItemsList');
  const adminSaveCurrentVersionBtn = document.getElementById('adminSaveCurrentVersionBtn');
  const adminSaveVersionModal = document.getElementById('adminSaveVersionModal');
  const adminSaveVersionCloseBtn = document.getElementById('adminSaveVersionCloseBtn');
  const adminSaveVersionCancelBtn = document.getElementById('adminSaveVersionCancelBtn');
  const adminSaveVersionConfirmBtn = document.getElementById('adminSaveVersionConfirmBtn');
  const adminSaveVersionTitleInput = document.getElementById('adminSaveVersionTitleInput');
  const adminSaveVersionTagInput = document.getElementById('adminSaveVersionTagInput');
  const adminSaveVersionNoteInput = document.getElementById('adminSaveVersionNoteInput');

  const adminHistoryTakeSnapshotBtn = document.getElementById('adminHistoryTakeSnapshotBtn');
  const adminHistoryRefreshDatesBtn = document.getElementById('adminHistoryRefreshDatesBtn');
  const adminHistoryLoadingSpinner = document.getElementById('adminHistoryLoadingSpinner');
  const adminHistoryEmptyState = document.getElementById('adminHistoryEmptyState');
  const adminHistoryItemsList = document.getElementById('adminHistoryItemsList');

  // Viewer Modal Elements
  const adminHistoryViewerModal = document.getElementById('adminHistoryViewerModal');
  const adminViewerDateTitle = document.getElementById('adminViewerDateTitle');
  const adminViewerTotalBadge = document.getElementById('adminViewerTotalBadge');
  const adminViewerTypeBadge = document.getElementById('adminViewerTypeBadge');
  const adminViewerCloseBtn = document.getElementById('adminViewerCloseBtn');
  const adminViewerBackBtn = document.getElementById('adminViewerBackBtn');
  const adminViewerLoadingSpinner = document.getElementById('adminViewerLoadingSpinner');
  const adminViewerEmptyState = document.getElementById('adminViewerEmptyState');
  const adminHistorySearchInput = document.getElementById('adminHistorySearchInput');
  const adminHistoryClearSearchBtn = document.getElementById('adminHistoryClearSearchBtn');
  const adminHistoryTableWrap = document.getElementById('adminHistoryTableWrap');
  const adminHistoryTableBody = document.getElementById('adminHistoryTableBody');

  // Delete Confirmation Modal Elements
  const deleteSnapshotModal = document.getElementById('deleteSnapshotModal');
  const deleteSnapshotInfo = document.getElementById('deleteSnapshotInfo');
  const cancelDeleteSnapshotBtn = document.getElementById('cancelDeleteSnapshotBtn');
  const confirmDeleteSnapshotBtn = document.getElementById('confirmDeleteSnapshotBtn');

  // Restore Confirmation Modal Elements
  const restoreSnapshotModal = document.getElementById('restoreSnapshotModal');
  const restoreSnapshotInfo = document.getElementById('restoreSnapshotInfo');
  const cancelRestoreSnapshotBtn = document.getElementById('cancelRestoreSnapshotBtn');
  const confirmRestoreSnapshotBtn = document.getElementById('confirmRestoreSnapshotBtn');
  const adminViewerRestoreBtn = document.getElementById('adminViewerRestoreBtn');
  let pendingRestoreSnapshot = null;

  let activeSnapshotData = null;
  let activeSnapshotPlayers = [];
  let pendingDeleteSnapshot = null;
  let cachedSnapshotsList = [];

  const SNAPSHOTS_INDEX_KEY = 'meta_leaderboard_snapshots_index';
  const SNAPSHOTS_DELETED_KEY = 'meta_leaderboard_deleted_snapshots';
  const SNAPSHOTS_LOCAL_STORAGE_KEY = 'color_sort_snapshots_index';
  const SNAPSHOTS_DELETED_LOCAL_KEY = 'color_sort_deleted_snapshots';
  const SNAPSHOT_LOCAL_PREFIX = 'color_sort_snapshot_';

  function getKyivDateTimeClient() {
    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Kyiv',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      const parts = formatter.formatToParts(now);
      const p = (type) => (parts.find(x => x.type === type) || {}).value || '00';
      const dateStr = `${p('year')}-${p('month')}-${p('day')}`;
      const timeStr = `${p('hour')}:${p('minute')}:${p('second')}`;
      return { dateStr, timeStr, fullStr: `${dateStr} ${timeStr}`, ts: now.getTime() };
    } catch (e) {
      const d = new Date();
      const dateStr = d.toISOString().split('T')[0];
      const timeStr = d.toTimeString().split(' ')[0];
      return { dateStr, timeStr, fullStr: `${dateStr} ${timeStr}`, ts: d.getTime() };
    }
  }

  function getAdminAuthQuery() {
    const params = new URLSearchParams();
    if (currentUser) {
      if (currentUser.telegramId) params.append('telegramId', currentUser.telegramId);
      if (currentUser.firstName) params.append('firstName', currentUser.firstName);
      if (currentUser.username) params.append('username', currentUser.username);
    }
    const initData = getTelegramInitData();
    if (initData) {
      params.append('initData', initData);
    }
    return params.toString();
  }

  function formatSnapshotDisplay(dateStr, timeStr) {
    if (!dateStr) return '';
    const parts = String(dateStr).split('-');
    const formattedDate = parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : dateStr;
    const formattedTime = timeStr ? String(timeStr).substring(0, 5) : '23:59';
    return `${formattedDate} — ${formattedTime}`;
  }

  function switchAdminTab(tabName) {
    if (tabName === 'history') {
      if (adminTabActionsBtn) adminTabActionsBtn.classList.remove('active');
      if (adminTabHistoryBtn) adminTabHistoryBtn.classList.add('active');
      if (adminTabWalletsBtn) adminTabWalletsBtn.classList.remove('active');
      if (adminTabNewsBtn) adminTabNewsBtn.classList.remove('active');
      if (adminTabCodeBackupBtn) adminTabCodeBackupBtn.classList.remove('active');
      if (adminTabMaintenanceBtn) adminTabMaintenanceBtn.classList.remove('active');
      if (adminTabActionsContent) adminTabActionsContent.classList.add('hidden');
      if (adminTabHistoryContent) adminTabHistoryContent.classList.remove('hidden');
      if (adminTabWalletsContent) adminTabWalletsContent.classList.add('hidden');
      if (adminTabNewsContent) adminTabNewsContent.classList.add('hidden');
      if (adminTabCodeBackupContent) adminTabCodeBackupContent.classList.add('hidden');
      if (adminTabMaintenanceContent) adminTabMaintenanceContent.classList.add('hidden');
      loadAdminHistoryList();
    } else if (tabName === 'wallets') {
      if (adminTabActionsBtn) adminTabActionsBtn.classList.remove('active');
      if (adminTabHistoryBtn) adminTabHistoryBtn.classList.remove('active');
      if (adminTabWalletsBtn) adminTabWalletsBtn.classList.add('active');
      if (adminTabNewsBtn) adminTabNewsBtn.classList.remove('active');
      if (adminTabCodeBackupBtn) adminTabCodeBackupBtn.classList.remove('active');
      if (adminTabMaintenanceBtn) adminTabMaintenanceBtn.classList.remove('active');
      if (adminTabActionsContent) adminTabActionsContent.classList.add('hidden');
      if (adminTabHistoryContent) adminTabHistoryContent.classList.add('hidden');
      if (adminTabWalletsContent) adminTabWalletsContent.classList.remove('hidden');
      if (adminTabNewsContent) adminTabNewsContent.classList.add('hidden');
      if (adminTabCodeBackupContent) adminTabCodeBackupContent.classList.add('hidden');
      if (adminTabMaintenanceContent) adminTabMaintenanceContent.classList.add('hidden');
      loadAdminWalletsList();
    } else if (tabName === 'news') {
      if (adminTabActionsBtn) adminTabActionsBtn.classList.remove('active');
      if (adminTabHistoryBtn) adminTabHistoryBtn.classList.remove('active');
      if (adminTabWalletsBtn) adminTabWalletsBtn.classList.remove('active');
      if (adminTabNewsBtn) adminTabNewsBtn.classList.add('active');
      if (adminTabCodeBackupBtn) adminTabCodeBackupBtn.classList.remove('active');
      if (adminTabMaintenanceBtn) adminTabMaintenanceBtn.classList.remove('active');
      if (adminTabActionsContent) adminTabActionsContent.classList.add('hidden');
      if (adminTabHistoryContent) adminTabHistoryContent.classList.add('hidden');
      if (adminTabWalletsContent) adminTabWalletsContent.classList.add('hidden');
      if (adminTabNewsContent) adminTabNewsContent.classList.remove('hidden');
      if (adminTabCodeBackupContent) adminTabCodeBackupContent.classList.add('hidden');
      if (adminTabMaintenanceContent) adminTabMaintenanceContent.classList.add('hidden');
      loadAdminNewsData();
    } else if (tabName === 'code_backup') {
      if (adminTabActionsBtn) adminTabActionsBtn.classList.remove('active');
      if (adminTabHistoryBtn) adminTabHistoryBtn.classList.remove('active');
      if (adminTabWalletsBtn) adminTabWalletsBtn.classList.remove('active');
      if (adminTabNewsBtn) adminTabNewsBtn.classList.remove('active');
      if (adminTabCodeBackupBtn) adminTabCodeBackupBtn.classList.add('active');
      if (adminTabMaintenanceBtn) adminTabMaintenanceBtn.classList.remove('active');
      if (adminTabActionsContent) adminTabActionsContent.classList.add('hidden');
      if (adminTabHistoryContent) adminTabHistoryContent.classList.add('hidden');
      if (adminTabWalletsContent) adminTabWalletsContent.classList.add('hidden');
      if (adminTabNewsContent) adminTabNewsContent.classList.add('hidden');
      if (adminTabCodeBackupContent) adminTabCodeBackupContent.classList.remove('hidden');
      if (adminTabMaintenanceContent) adminTabMaintenanceContent.classList.add('hidden');
      loadAdminCodeBackups();
      setTimeout(() => {
        if (adminTabCodeBackupContent) {
          adminTabCodeBackupContent.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 40);
    } else if (tabName === 'maintenance') {
      if (adminTabActionsBtn) adminTabActionsBtn.classList.remove('active');
      if (adminTabHistoryBtn) adminTabHistoryBtn.classList.remove('active');
      if (adminTabWalletsBtn) adminTabWalletsBtn.classList.remove('active');
      if (adminTabNewsBtn) adminTabNewsBtn.classList.remove('active');
      if (adminTabCodeBackupBtn) adminTabCodeBackupBtn.classList.remove('active');
      if (adminTabMaintenanceBtn) adminTabMaintenanceBtn.classList.add('active');
      if (adminTabActionsContent) adminTabActionsContent.classList.add('hidden');
      if (adminTabHistoryContent) adminTabHistoryContent.classList.add('hidden');
      if (adminTabWalletsContent) adminTabWalletsContent.classList.add('hidden');
      if (adminTabNewsContent) adminTabNewsContent.classList.add('hidden');
      if (adminTabCodeBackupContent) adminTabCodeBackupContent.classList.add('hidden');
      if (adminTabMaintenanceContent) adminTabMaintenanceContent.classList.remove('hidden');
      if (typeof loadAdminMaintenanceStatus === 'function') {
        loadAdminMaintenanceStatus();
      }
      setTimeout(() => {
        if (adminTabMaintenanceContent) {
          adminTabMaintenanceContent.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 40);
    } else {
      if (adminTabActionsBtn) adminTabActionsBtn.classList.add('active');
      if (adminTabHistoryBtn) adminTabHistoryBtn.classList.remove('active');
      if (adminTabWalletsBtn) adminTabWalletsBtn.classList.remove('active');
      if (adminTabNewsBtn) adminTabNewsBtn.classList.remove('active');
      if (adminTabCodeBackupBtn) adminTabCodeBackupBtn.classList.remove('active');
      if (adminTabMaintenanceBtn) adminTabMaintenanceBtn.classList.remove('active');
      if (adminTabActionsContent) adminTabActionsContent.classList.remove('hidden');
      if (adminTabHistoryContent) adminTabHistoryContent.classList.add('hidden');
      if (adminTabWalletsContent) adminTabWalletsContent.classList.add('hidden');
      if (adminTabNewsContent) adminTabNewsContent.classList.add('hidden');
      if (adminTabCodeBackupContent) adminTabCodeBackupContent.classList.add('hidden');
      if (adminTabMaintenanceContent) adminTabMaintenanceContent.classList.add('hidden');
    }
  }

  if (adminTabActionsBtn) {
    adminTabActionsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      switchAdminTab('actions');
    });
  }

  if (adminTabHistoryBtn) {
    adminTabHistoryBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      switchAdminTab('history');
    });
  }

  if (adminTabWalletsBtn) {
    adminTabWalletsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      switchAdminTab('wallets');
    });
  }

  if (adminTabNewsBtn) {
    adminTabNewsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      switchAdminTab('news');
    });
  }

  if (adminTabMaintenanceBtn) {
    const handleMaintenanceTabClick = (e) => {
      if (e) {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
      }
      switchAdminTab('maintenance');
    };
    adminTabMaintenanceBtn.addEventListener('click', handleMaintenanceTabClick);
    adminTabMaintenanceBtn.addEventListener('touchend', handleMaintenanceTabClick, { passive: false });
  }

  if (adminTabCodeBackupBtn) {
    const handleCodeBackupTabClick = (e) => {
      if (e) {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
      }
      switchAdminTab('code_backup');
    };
    adminTabCodeBackupBtn.addEventListener('click', handleCodeBackupTabClick);
    adminTabCodeBackupBtn.addEventListener('touchend', handleCodeBackupTabClick, { passive: false });
  }

  const adminNavTabsContainer = document.querySelector('.admin-nav-tabs');
  if (adminNavTabsContainer) {
    const handleNavTabsEvent = (e) => {
      const btn = e.target.closest('.admin-nav-tab');
      if (!btn) return;
      const tab = btn.getAttribute('data-tab');
      if (tab) {
        if (e && e.cancelable) e.preventDefault();
        if (e) e.stopPropagation();
        switchAdminTab(tab);
      }
    };
    adminNavTabsContainer.addEventListener('click', handleNavTabsEvent);
    adminNavTabsContainer.addEventListener('touchend', handleNavTabsEvent, { passive: false });
  }

  // Cloud & LocalStorage snapshot index retrieval
  async function fetchSnapshotsIndex() {
    let list = [];
    const deletedSet = new Set();

    // 0. Load local tombstones
    try {
      const localDel = localStorage.getItem(SNAPSHOTS_DELETED_LOCAL_KEY);
      if (localDel) {
        const parsed = JSON.parse(localDel);
        if (Array.isArray(parsed)) parsed.forEach(id => deletedSet.add(String(id)));
      }
    } catch (e) {}

    // 1. Fetch global 24/7 KVDB cloud deleted tombstones
    try {
      const delRes = await fetch(`${GLOBAL_CLOUD_BASE}/${SNAPSHOTS_DELETED_KEY}?_cb=${Date.now()}`, {
        cache: 'no-store'
      });
      if (delRes.ok) {
        const cloudDel = await delRes.json();
        if (Array.isArray(cloudDel)) {
          cloudDel.forEach(id => deletedSet.add(String(id)));
          try {
            localStorage.setItem(SNAPSHOTS_DELETED_LOCAL_KEY, JSON.stringify(Array.from(deletedSet)));
          } catch (e) {}
        }
      }
    } catch (e) {
      console.warn('[Leaderboard History] Cloud deleted tombstones fetch notice:', e.message);
    }

    // 2. Fetch global 24/7 KVDB cloud index
    try {
      const res = await fetch(`${GLOBAL_CLOUD_BASE}/${SNAPSHOTS_INDEX_KEY}?_cb=${Date.now()}`, {
        cache: 'no-store'
      });
      if (res.ok) {
        const cloudData = await res.json();
        if (Array.isArray(cloudData) && cloudData.length > 0) {
          list = cloudData.filter(s => s && s.id && !deletedSet.has(String(s.id)));
        }
      }
    } catch (e) {
      console.warn('[Leaderboard History] Cloud index fetch notice:', e.message);
    }

    // 3. Clean up localStorage cache: remove any deleted snapshots from local storage
    try {
      const local = localStorage.getItem(SNAPSHOTS_LOCAL_STORAGE_KEY);
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const cleanedLocal = parsed.filter(s => s && s.id && !deletedSet.has(String(s.id)));
          if (cleanedLocal.length !== parsed.length) {
            localStorage.setItem(SNAPSHOTS_LOCAL_STORAGE_KEY, JSON.stringify(cleanedLocal));
          }
          // If cloud fetch was empty or failed, use clean local items
          if (list.length === 0 && cleanedLocal.length > 0) {
            list = cleanedLocal;
          }
        }
      }
    } catch (e) {}

    // 4. Fallback seeds ONLY if list is still empty AND seeds were not explicitly deleted
    if (!Array.isArray(list) || list.length === 0) {
      const defaultSeeds = [
        { id: 6, snapshot_date: '2026-09-10', snapshot_time: '23:55:00', snapshot_type: 'auto', total_players: 110, created_at_ts: 1788988500000 },
        { id: 5, snapshot_date: '2026-09-06', snapshot_time: '23:55:00', snapshot_type: 'auto', total_players: 15, created_at_ts: 1788642900000 },
        { id: 4, snapshot_date: '2026-09-04', snapshot_time: '23:55:00', snapshot_type: 'auto', total_players: 85, created_at_ts: 1788470100000 },
        { id: 3, snapshot_date: '2026-07-11', snapshot_time: '23:55:00', snapshot_type: 'auto', total_players: 94, created_at_ts: 1783716900000 },
        { id: 2, snapshot_date: '2026-07-10', snapshot_time: '23:55:00', snapshot_type: 'auto', total_players: 90, created_at_ts: 1783630500000 },
        { id: 1, snapshot_date: '2026-07-10', snapshot_time: '12:00:00', snapshot_type: 'manual', total_players: 85, created_at_ts: 1783587600000 }
      ];
      list = defaultSeeds.filter(s => !deletedSet.has(String(s.id)));
    }

    // 5. Try server API if available (filter against deletedSet)
    try {
      const authQuery = getAdminAuthQuery();
      const srvData = await apiCall(`/api/admin/leaderboard-history/dates?${authQuery}`);
      if (srvData && srvData.success && Array.isArray(srvData.dates) && srvData.dates.length > 0) {
        const srvValid = srvData.dates.filter(s => s && s.id && !deletedSet.has(String(s.id)));
        const map = new Map();
        srvValid.forEach(s => map.set(String(s.id), s));
        list.forEach(s => {
          if (!map.has(String(s.id))) map.set(String(s.id), s);
        });
        list = Array.from(map.values());
      }
    } catch (e) {}

    // 6. Strict Deduplication: by ID AND by (date + time + type) to prevent ANY duplication
    const seenIds = new Set();
    const seenSlots = new Set();
    const deduped = [];

    for (const s of list) {
      if (!s || !s.id || deletedSet.has(String(s.id))) continue;
      const sid = String(s.id);
      const slotKey = `${s.snapshot_date || ''}_${s.snapshot_time || ''}_${s.snapshot_type || ''}`;

      if (seenIds.has(sid)) continue;
      if (slotKey && slotKey !== '__' && seenSlots.has(slotKey)) continue;

      seenIds.add(sid);
      if (slotKey && slotKey !== '__') seenSlots.add(slotKey);
      deduped.push(s);
    }

    list = deduped;

    list.sort((a, b) => {
      const tsA = Number(a.created_at_ts || (a.snapshot_date ? new Date(`${a.snapshot_date}T${a.snapshot_time || '00:00:00'}`).getTime() : a.id));
      const tsB = Number(b.created_at_ts || (b.snapshot_date ? new Date(`${b.snapshot_date}T${b.snapshot_time || '00:00:00'}`).getTime() : b.id));
      if (tsB !== tsA) return tsB - tsA;
      return Number(b.id) - Number(a.id);
    });

    try {
      localStorage.setItem(SNAPSHOTS_LOCAL_STORAGE_KEY, JSON.stringify(list));
    } catch (e) {}

    return list;
  }

  // Cloud & LocalStorage snapshot by ID retrieval
  async function fetchSnapshotById(snapshotId) {
    // 1. Check local cache
    try {
      const cached = localStorage.getItem(`${SNAPSHOT_LOCAL_PREFIX}${snapshotId}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.id && Array.isArray(parsed.players)) {
          return parsed;
        }
      }
    } catch (e) {}

    // 2. Fetch from KVDB cloud
    try {
      const res = await fetch(`${GLOBAL_CLOUD_BASE}/leaderboard_snapshot_${encodeURIComponent(snapshotId)}?_cb=${Date.now()}`, {
        cache: 'no-store'
      });
      if (res.ok) {
        const snap = await res.json();
        if (snap && snap.id) {
          try {
            localStorage.setItem(`${SNAPSHOT_LOCAL_PREFIX}${snapshotId}`, JSON.stringify(snap));
          } catch (e) {}
          return snap;
        }
      }
    } catch (e) {}

    // 3. Fetch from server API if available
    try {
      const authQuery = getAdminAuthQuery();
      const srv = await apiCall(`/api/admin/leaderboard-history?id=${encodeURIComponent(snapshotId)}&${authQuery}`);
      if (srv && srv.success && srv.snapshot) {
        return srv.snapshot;
      }
    } catch (e) {}

    return null;
  }

  // Save new snapshot to KVDB cloud and localStorage
  async function saveSnapshot(snapshot) {
    // 1. Save full snapshot to local cache
    try {
      localStorage.setItem(`${SNAPSHOT_LOCAL_PREFIX}${snapshot.id}`, JSON.stringify(snapshot));
    } catch (e) {}

    // 2. Save full snapshot to KVDB cloud
    try {
      await fetch(`${GLOBAL_CLOUD_BASE}/leaderboard_snapshot_${encodeURIComponent(snapshot.id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snapshot)
      });
    } catch (e) {
      console.warn('[Leaderboard History] Cloud snapshot save notice:', e);
    }

    // 3. Update snapshots index
    let curIndex = await fetchSnapshotsIndex();
    const meta = {
      id: snapshot.id,
      snapshot_date: snapshot.snapshot_date,
      snapshot_time: snapshot.snapshot_time,
      snapshot_type: snapshot.snapshot_type || 'manual',
      total_players: snapshot.total_players,
      created_at: snapshot.created_at,
      created_at_ts: snapshot.created_at_ts
    };
    curIndex = [meta, ...curIndex.filter(x => String(x.id) !== String(snapshot.id))];

    try {
      localStorage.setItem(SNAPSHOTS_LOCAL_STORAGE_KEY, JSON.stringify(curIndex));
    } catch (e) {}

    try {
      await fetch(`${GLOBAL_CLOUD_BASE}/${SNAPSHOTS_INDEX_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(curIndex)
      });
    } catch (e) {}

    // 4. Also notify server API if available
    try {
      apiCall('/api/admin/leaderboard-history/snapshot', 'POST', {
        snapshotType: snapshot.snapshot_type,
        additionalPlayers: snapshot.players
      }).catch(() => {});
    } catch (e) {}

    return snapshot;
  }

  // Delete snapshot from KVDB cloud and localStorage
  async function deleteSnapshot(snapshotId) {
    const sId = String(snapshotId);

    // 1. Delete from local cache
    try {
      localStorage.removeItem(`${SNAPSHOT_LOCAL_PREFIX}${sId}`);
      localStorage.removeItem(`color_sort_snapshot_players_${sId}`);
    } catch (e) {}

    // 2. Track in local deleted tombstones
    try {
      let localDel = [];
      const raw = localStorage.getItem(SNAPSHOTS_DELETED_LOCAL_KEY);
      if (raw) {
        try { localDel = JSON.parse(raw); } catch (e) {}
      }
      if (!Array.isArray(localDel)) localDel = [];
      if (!localDel.includes(sId)) localDel.push(sId);
      localStorage.setItem(SNAPSHOTS_DELETED_LOCAL_KEY, JSON.stringify(localDel));
    } catch (e) {}

    // 3. Explicitly DELETE full snapshot from KVDB cloud (AWAITED to immediately free memory)
    try {
      await fetch(`${GLOBAL_CLOUD_BASE}/leaderboard_snapshot_${encodeURIComponent(sId)}`, {
        method: 'DELETE',
        keepalive: true
      });
    } catch (e) {
      console.warn('[Leaderboard History] Cloud snapshot delete notice:', e);
    }

    // 4. Update index in localStorage and KVDB cloud
    let curIndex = await fetchSnapshotsIndex();
    curIndex = curIndex.filter(x => String(x.id) !== sId);

    try {
      localStorage.setItem(SNAPSHOTS_LOCAL_STORAGE_KEY, JSON.stringify(curIndex));
    } catch (e) {}

    try {
      await fetch(`${GLOBAL_CLOUD_BASE}/${SNAPSHOTS_INDEX_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(curIndex),
        keepalive: true
      });
    } catch (e) {}

    // 5. Update global deleted tombstones list in KVDB Cloud so no background cron or sync ever resurrects it!
    try {
      const delRes = await fetch(`${GLOBAL_CLOUD_BASE}/${SNAPSHOTS_DELETED_KEY}?_cb=${Date.now()}`);
      let cloudDelList = [];
      if (delRes.ok) {
        try { cloudDelList = await delRes.json(); } catch (e) {}
      }
      if (!Array.isArray(cloudDelList)) cloudDelList = [];
      if (!cloudDelList.includes(sId)) {
        cloudDelList.push(sId);
      }
      await fetch(`${GLOBAL_CLOUD_BASE}/${SNAPSHOTS_DELETED_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cloudDelList),
        keepalive: true
      });
    } catch (e) {}

    // 6. Also call server API if available
    try {
      apiCall('/api/admin/leaderboard-history/delete', 'POST', { id: snapshotId }).catch(() => {});
    } catch (e) {}

    return true;
  }

  // Take current leaderboard snapshot
  async function createCurrentLeaderboardSnapshot(snapshotType = 'manual', overrideDate = null, overrideTime = null) {
    const playersMap = new Map();

    // 1. Load all registered players directly from KVDB Cloud
    try {
      const cloudRes = await fetch(`${GLOBAL_CLOUD_BASE}/?prefix=player_&values=true&format=json&_cb=${Date.now()}`, {
        cache: 'no-store'
      });
      if (cloudRes.ok) {
        const pairs = await cloudRes.json();
        if (Array.isArray(pairs)) {
          pairs.forEach(([k, p]) => {
            let parsed = p;
            if (typeof parsed === 'string') {
              try { parsed = JSON.parse(parsed); } catch (e) { parsed = null; }
            }
            if (parsed && (parsed.telegramId || parsed.telegram_id)) {
              const pid = String(parsed.telegramId || parsed.telegram_id);
              if (pid && !pid.startsWith('guest') && !pid.startsWith('dev') && /^\d+$/.test(pid)) {
                playersMap.set(pid, {
                  telegram_id: pid,
                  name: parsed.firstName || parsed.first_name || parsed.name || 'Игрок',
                  username: parsed.username ? String(parsed.username).replace(/^@/, '') : '',
                  level: Math.max(0, Number(parsed.maxLevel !== undefined ? parsed.maxLevel : (parsed.level || 0)))
                });
              }
            }
          });
        }
      }
    } catch (e) {
      console.warn('[Leaderboard Snapshot] KVDB fetch notice:', e);
    }

    // 2. Also merge players from local leaderboard data if available
    try {
      const lbPlayers = await loadLeaderboardData();
      if (Array.isArray(lbPlayers)) {
        lbPlayers.forEach(p => {
          const pid = String(p.telegramId || p.telegram_id || '');
          if (pid && !pid.startsWith('guest') && !pid.startsWith('dev') && /^\d+$/.test(pid)) {
            const existing = playersMap.get(pid);
            const lvl = Math.max(0, Number(p.maxLevel !== undefined ? p.maxLevel : (p.level || 0)));
            if (!existing || lvl > existing.level) {
              playersMap.set(pid, {
                telegram_id: pid,
                name: p.firstName || p.first_name || p.name || 'Игрок',
                username: p.username ? String(p.username).replace(/^@/, '') : (existing ? existing.username : ''),
                level: lvl
              });
            }
          }
        });
      }
    } catch (e) {}

    // 3. Ensure current user (Admin) is always included with their current level
    if (currentUser && currentUser.telegramId) {
      const myPid = String(currentUser.telegramId);
      if (!myPid.startsWith('guest') && !myPid.startsWith('dev') && /^\d+$/.test(myPid)) {
        const myLvl = Math.max(0, Number(currentUser.maxLevel !== undefined ? currentUser.maxLevel : (currentUser.level || 0)));
        const existing = playersMap.get(myPid);
        if (!existing || myLvl > existing.level) {
          playersMap.set(myPid, {
            telegram_id: myPid,
            name: currentUser.firstName || 'Игрок',
            username: currentUser.username ? String(currentUser.username).replace(/^@/, '') : (existing ? existing.username : ''),
            level: myLvl
          });
        }
      }
    }

    const sortedPlayers = Array.from(playersMap.values())
      .sort((a, b) => b.level - a.level || a.name.localeCompare(b.name))
      .map((p, idx) => ({ rank: idx + 1, ...p }));

    const kyivNow = getKyivDateTimeClient();
    const snapDate = overrideDate || kyivNow.dateStr;
    const snapTime = overrideTime || kyivNow.timeStr;
    const newId = Date.now();
    const snapshot = {
      id: newId,
      snapshot_date: snapDate,
      snapshot_time: snapTime,
      snapshot_type: snapshotType,
      total_players: sortedPlayers.length,
      created_at: `${snapDate} ${snapTime}`,
      created_at_ts: kyivNow.ts,
      players: sortedPlayers
    };

    await saveSnapshot(snapshot);
    return snapshot;
  }

  // 🕒 23:59 Kyiv Daily Auto-Snapshot Catch-up Guard (Client / Cloud)
  async function checkAndTriggerAutoSnapshotCatchup() {
    try {
      const kyiv = getKyivDateTimeClient();
      let targetDate = kyiv.dateStr;
      
      const isPost2359Today = (kyiv.timeStr >= '23:59:00');
      const isEarlyMorning = (kyiv.timeStr < '06:00:00');
      
      if (!isPost2359Today && !isEarlyMorning) {
        return; // Target time (23:59) not yet reached today
      }

      if (isEarlyMorning) {
        const yesterday = new Date(Date.now() - 24 * 3600 * 1000);
        try {
          const yParts = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Europe/Kyiv',
            year: 'numeric', month: '2-digit', day: '2-digit'
          }).formatToParts(yesterday);
          const yP = (type) => (yParts.find(x => x.type === type) || {}).value || '00';
          targetDate = `${yP('year')}-${yP('month')}-${yP('day')}`;
        } catch (e) {
          targetDate = yesterday.toISOString().split('T')[0];
        }
      }

      // Check if 23:59 or 23:55 auto snapshot already exists for targetDate
      const index = await fetchSnapshotsIndex();
      const hasAuto = Array.isArray(index) && index.some(
        s => s.snapshot_date === targetDate && (s.snapshot_type === 'auto' || s.snapshot_time === '23:59:00' || s.snapshot_time === '23:55:00')
      );

      if (hasAuto) {
        return; // Already recorded
      }

      console.log(`[Auto-Cron Guard] ⏰ Auto 23:59 snapshot for ${targetDate} missing. Creating auto snapshot...`);
      await createCurrentLeaderboardSnapshot('auto', targetDate, '23:59:00');
      console.log(`[Auto-Cron Guard] ✅ Auto 23:59 snapshot for ${targetDate} saved to KVDB Cloud!`);
    } catch (err) {
      console.warn('[Auto-Cron Guard Notice]', err.message);
    }
  }

  async function loadAdminHistoryList() {
    if (!adminHistoryItemsList) return;
    checkAndTriggerAutoSnapshotCatchup().catch(() => {});
    try {
      if (adminHistoryLoadingSpinner) adminHistoryLoadingSpinner.classList.remove('hidden');
      if (adminHistoryEmptyState) adminHistoryEmptyState.classList.add('hidden');
      adminHistoryItemsList.innerHTML = '';

      cachedSnapshotsList = await fetchSnapshotsIndex();
      if (adminHistoryLoadingSpinner) adminHistoryLoadingSpinner.classList.add('hidden');

      if (!Array.isArray(cachedSnapshotsList) || cachedSnapshotsList.length === 0) {
        if (adminHistoryEmptyState) adminHistoryEmptyState.classList.remove('hidden');
        return;
      }

      if (adminHistoryEmptyState) adminHistoryEmptyState.classList.add('hidden');

      cachedSnapshotsList.forEach(s => {
        const card = document.createElement('div');
        card.className = 'admin-snapshot-card';
        card.dataset.id = s.id;

        const dtFormatted = formatSnapshotDisplay(s.snapshot_date, s.snapshot_time);
        const isManual = s.snapshot_type === 'manual';
        const badgeTypeClass = isManual ? 'manual' : 'auto';
        const badgeTypeLabel = isManual
          ? (typeof t === 'function' ? t('adminSnapshotManualBadge') : '✋ Ручной')
          : (typeof t === 'function' ? t('adminSnapshotAutoBadge') : '🤖 Авто (23:59)');
        const count = s.total_players !== undefined ? s.total_players : 0;
        const countLabel = typeof t === 'function' ? t('adminHistoryTotalBadge', count) : `👥 ${count} игроков`;
        const viewLabel = typeof t === 'function' ? t('adminHistoryViewBtnLabel') : 'Просмотреть';
        const deleteLabel = typeof t === 'function' ? t('adminHistoryDeleteBtnLabel') : 'Удалить';

        card.innerHTML = `
          <div class="admin-snapshot-info">
            <div class="admin-snapshot-datetime">📅 ${dtFormatted}</div>
            <div class="admin-snapshot-meta">
              <span class="admin-snapshot-badge players">${countLabel}</span>
              <span class="admin-snapshot-badge ${badgeTypeClass}">${badgeTypeLabel}</span>
            </div>
          </div>
          <div class="admin-snapshot-actions">
            <button type="button" class="btn-snapshot-action btn-snapshot-restore" data-id="${s.id}" title="Загрузить в лидерборд" style="background: rgba(37, 99, 235, 0.2); border-color: rgba(59, 130, 246, 0.4); color: #60a5fa;">
              <span>📥</span>
              <span>Загрузить</span>
            </button>
            <button type="button" class="btn-snapshot-action btn-snapshot-view" data-id="${s.id}" title="${viewLabel}">
              <span>👁️</span>
              <span>${viewLabel}</span>
            </button>
            <button type="button" class="btn-snapshot-action btn-snapshot-delete" data-id="${s.id}" title="${deleteLabel}">
              <span>🗑️</span>
              <span>${deleteLabel}</span>
            </button>
          </div>
        `;

        adminHistoryItemsList.appendChild(card);
      });
    } catch (err) {
      console.error('[Admin History List Error]', err);
      if (adminHistoryLoadingSpinner) adminHistoryLoadingSpinner.classList.add('hidden');
      if (adminHistoryEmptyState) adminHistoryEmptyState.classList.remove('hidden');
    }
  }

  // Delegated click handling on list buttons (Restore / View / Delete)
  if (adminHistoryItemsList) {
    adminHistoryItemsList.addEventListener('click', (e) => {
      const restoreBtn = e.target.closest('.btn-snapshot-restore');
      const viewBtn = e.target.closest('.btn-snapshot-view');
      const deleteBtn = e.target.closest('.btn-snapshot-delete');

      if (restoreBtn) {
        e.stopPropagation();
        const id = restoreBtn.dataset.id;
        const snapshot = cachedSnapshotsList.find(s => String(s.id) === String(id));
        if (snapshot) {
          openRestoreSnapshotDialog(snapshot);
        } else if (id) {
          openRestoreSnapshotDialog({ id, snapshot_date: '—', snapshot_time: '—', total_players: '?' });
        }
        return;
      }

      if (viewBtn) {
        e.stopPropagation();
        const id = viewBtn.dataset.id;
        if (id) openSnapshotViewer(id);
        return;
      }

      if (deleteBtn) {
        e.stopPropagation();
        const id = deleteBtn.dataset.id;
        const snapshot = cachedSnapshotsList.find(s => String(s.id) === String(id));
        if (snapshot) {
          openDeleteSnapshotDialog(snapshot);
        } else if (id) {
          openDeleteSnapshotDialog({ id, snapshot_date: '—', snapshot_time: '—', total_players: '?' });
        }
        return;
      }
    });
  }

  async function openSnapshotViewer(snapshotId) {
    if (!adminHistoryViewerModal) return;
    openModal(adminHistoryViewerModal);

    if (adminViewerLoadingSpinner) adminViewerLoadingSpinner.classList.remove('hidden');
    if (adminViewerEmptyState) adminViewerEmptyState.classList.add('hidden');
    if (adminHistoryTableWrap) adminHistoryTableWrap.classList.add('hidden');
    if (adminHistorySearchInput) adminHistorySearchInput.value = '';
    if (adminHistoryClearSearchBtn) adminHistoryClearSearchBtn.classList.add('hidden');

    try {
      const snap = await fetchSnapshotById(snapshotId);
      if (adminViewerLoadingSpinner) adminViewerLoadingSpinner.classList.add('hidden');

      if (!snap) {
        if (adminViewerEmptyState) adminViewerEmptyState.classList.remove('hidden');
        return;
      }

      activeSnapshotData = snap;
      activeSnapshotPlayers = Array.isArray(activeSnapshotData.players) ? activeSnapshotData.players : [];

      const dtFormatted = formatSnapshotDisplay(activeSnapshotData.snapshot_date, activeSnapshotData.snapshot_time);
      if (adminViewerDateTitle) {
        adminViewerDateTitle.textContent = `📅 ${dtFormatted}`;
      }

      const totalCount = activeSnapshotData.total_players !== undefined ? activeSnapshotData.total_players : activeSnapshotPlayers.length;
      if (adminViewerTotalBadge) {
        adminViewerTotalBadge.textContent = typeof t === 'function' ? t('adminHistoryTotalBadge', totalCount) : `👥 ${totalCount} игроков`;
      }

      const isManual = activeSnapshotData.snapshot_type === 'manual';
      if (adminViewerTypeBadge) {
        adminViewerTypeBadge.textContent = isManual
          ? (typeof t === 'function' ? t('adminSnapshotManualBadge') : '✋ Ручной')
          : (typeof t === 'function' ? t('adminSnapshotAutoBadge') : '🤖 Авто (23:59)');
        adminViewerTypeBadge.className = `admin-viewer-badge-type ${isManual ? 'manual' : 'auto'}`;
      }

      renderAdminHistoryPlayers(activeSnapshotPlayers);
      if (adminHistoryTableWrap) adminHistoryTableWrap.classList.remove('hidden');
    } catch (err) {
      console.error('[Admin Viewer Error]', err);
      if (adminViewerLoadingSpinner) adminViewerLoadingSpinner.classList.add('hidden');
      if (adminViewerEmptyState) adminViewerEmptyState.classList.remove('hidden');
    }
  }

  function renderAdminHistoryPlayers(players) {
    if (!adminHistoryTableBody) return;
    adminHistoryTableBody.innerHTML = '';

    if (!players || players.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 4;
      td.style.textAlign = 'center';
      td.style.padding = '18px';
      td.style.color = '#94a3b8';
      td.textContent = 'В этом снимке нет игроков';
      tr.appendChild(td);
      adminHistoryTableBody.appendChild(tr);
      return;
    }

    players.forEach(p => {
      const tr = document.createElement('tr');

      // Rank
      const tdRank = document.createElement('td');
      tdRank.className = `admin-rank-cell ${p.rank <= 3 ? `admin-rank-${p.rank}` : ''}`;
      let rankText = `#${p.rank}`;
      if (p.rank === 1) rankText = '1 🥇';
      else if (p.rank === 2) rankText = '2 🥈';
      else if (p.rank === 3) rankText = '3 🥉';
      tdRank.textContent = rankText;
      tr.appendChild(tdRank);

      // Player Name & Username
      const tdPlayer = document.createElement('td');
      tdPlayer.className = 'admin-player-name';
      const nameSpan = document.createElement('span');
      nameSpan.textContent = p.name || p.first_name || 'Игрок';
      tdPlayer.appendChild(nameSpan);
      if (p.username) {
        const unameSpan = document.createElement('span');
        unameSpan.className = 'admin-player-uname';
        unameSpan.textContent = `@${p.username.replace(/^@/, '')}`;
        tdPlayer.appendChild(unameSpan);
      }
      tr.appendChild(tdPlayer);

      // Telegram ID
      const tdTid = document.createElement('td');
      tdTid.className = 'admin-player-tid';
      tdTid.textContent = p.telegram_id || '—';
      tr.appendChild(tdTid);

      // Level
      const tdLevel = document.createElement('td');
      tdLevel.style.textAlign = 'right';
      const lvlBadge = document.createElement('span');
      lvlBadge.className = 'admin-level-badge';
      lvlBadge.textContent = p.level !== undefined ? p.level : (p.max_level || 0);
      tdLevel.appendChild(lvlBadge);
      tr.appendChild(tdLevel);

      adminHistoryTableBody.appendChild(tr);
    });
  }

  // Filter search inside snapshot viewer
  if (adminHistorySearchInput) {
    adminHistorySearchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      if (adminHistoryClearSearchBtn) {
        adminHistoryClearSearchBtn.classList.toggle('hidden', !q);
      }
      if (!activeSnapshotPlayers) return;
      if (!q) {
        renderAdminHistoryPlayers(activeSnapshotPlayers);
        return;
      }
      const filtered = activeSnapshotPlayers.filter(p => {
        const name = (p.name || p.first_name || '').toLowerCase();
        const uname = (p.username || '').toLowerCase();
        const tid = String(p.telegram_id || '').toLowerCase();
        return name.includes(q) || uname.includes(q) || tid.includes(q);
      });
      renderAdminHistoryPlayers(filtered);
    });
  }

  if (adminHistoryClearSearchBtn) {
    adminHistoryClearSearchBtn.addEventListener('click', () => {
      if (adminHistorySearchInput) adminHistorySearchInput.value = '';
      adminHistoryClearSearchBtn.classList.add('hidden');
      renderAdminHistoryPlayers(activeSnapshotPlayers);
    });
  }

  // Viewer Modal Close & Back buttons
  if (adminViewerCloseBtn) {
    adminViewerCloseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (adminHistoryViewerModal) closeModal(adminHistoryViewerModal);
    });
  }

  if (adminViewerBackBtn) {
    adminViewerBackBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (adminHistoryViewerModal) closeModal(adminHistoryViewerModal);
    });
  }

  if (adminHistoryViewerModal) {
    adminHistoryViewerModal.addEventListener('click', (e) => {
      if (e.target === adminHistoryViewerModal) {
        closeModal(adminHistoryViewerModal);
      }
    });
  }

  // Delete snapshot dialog
  function openDeleteSnapshotDialog(snapshot) {
    if (!snapshot) return;
    pendingDeleteSnapshot = snapshot;
    if (deleteSnapshotInfo) {
      const dt = formatSnapshotDisplay(snapshot.snapshot_date, snapshot.snapshot_time);
      const isManual = snapshot.snapshot_type === 'manual';
      const typeLabel = isManual ? 'Ручной' : (snapshot.snapshot_time ? `Авто ${String(snapshot.snapshot_time).substring(0, 5)}` : 'Авто 23:59');
      const count = snapshot.total_players !== undefined ? snapshot.total_players : '?';
      deleteSnapshotInfo.textContent = `📅 ${dt} (${typeLabel}) — ${count} игроков`;
    }
    if (deleteSnapshotModal) {
      openModal(deleteSnapshotModal);
      if (window.TelegramApp && window.TelegramApp.TelegramApp) {
        window.TelegramApp.TelegramApp.haptic('warning');
      }
    }
  }

  if (cancelDeleteSnapshotBtn) {
    cancelDeleteSnapshotBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      pendingDeleteSnapshot = null;
      if (deleteSnapshotModal) closeModal(deleteSnapshotModal);
    });
  }

  if (deleteSnapshotModal) {
    deleteSnapshotModal.addEventListener('click', (e) => {
      if (e.target === deleteSnapshotModal) {
        pendingDeleteSnapshot = null;
        closeModal(deleteSnapshotModal);
      }
    });
  }

  if (confirmDeleteSnapshotBtn) {
    confirmDeleteSnapshotBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!isAlligatorAdmin(currentUser)) return;
      if (!pendingDeleteSnapshot || !pendingDeleteSnapshot.id) {
        if (deleteSnapshotModal) closeModal(deleteSnapshotModal);
        return;
      }

      const snapshotIdToDelete = pendingDeleteSnapshot.id;
      const snapshotFormatted = formatSnapshotDisplay(pendingDeleteSnapshot.snapshot_date, pendingDeleteSnapshot.snapshot_time);

      confirmDeleteSnapshotBtn.disabled = true;
      const origHtml = confirmDeleteSnapshotBtn.innerHTML;
      confirmDeleteSnapshotBtn.innerHTML = '⏳ Удаление...';

      try {
        await deleteSnapshot(snapshotIdToDelete);

        if (deleteSnapshotModal) closeModal(deleteSnapshotModal);

        // If viewer modal was viewing this exact deleted snapshot, close it
        if (activeSnapshotData && String(activeSnapshotData.id) === String(snapshotIdToDelete)) {
          if (adminHistoryViewerModal) closeModal(adminHistoryViewerModal);
          activeSnapshotData = null;
          activeSnapshotPlayers = [];
        }

        if (window.TelegramApp && window.TelegramApp.TelegramApp) {
          window.TelegramApp.TelegramApp.haptic('success');
        }

        showInfoModal(
          '🗑️',
          'Снимок удалён',
          `Снимок за ${snapshotFormatted} успешно удалён из архива!\nДанные и уровни игроков в игре сохранены.`
        );

        pendingDeleteSnapshot = null;
        await loadAdminHistoryList();
      } catch (err) {
        console.error('[Delete Snapshot Error]', err);
        showInfoModal('⚠️', 'Ошибка', 'Ошибка удаления снимка: ' + (err.message || err));
      } finally {
        confirmDeleteSnapshotBtn.disabled = false;
        confirmDeleteSnapshotBtn.innerHTML = origHtml;
      }
    });
  }

  // ==========================================================================
  // Leaderboard Snapshot Restore Controller
  // ==========================================================================
  function openRestoreSnapshotDialog(snapshot) {
    if (!snapshot) return;
    pendingRestoreSnapshot = snapshot;
    if (restoreSnapshotInfo) {
      const dt = formatSnapshotDisplay(snapshot.snapshot_date, snapshot.snapshot_time);
      const isManual = snapshot.snapshot_type === 'manual';
      const typeLabel = isManual ? 'Ручной' : (snapshot.snapshot_time ? `Авто ${String(snapshot.snapshot_time).substring(0, 5)}` : 'Авто 23:59');
      const count = snapshot.total_players !== undefined ? snapshot.total_players : '?';
      restoreSnapshotInfo.textContent = `📅 ${dt} (${typeLabel}) — ${count} игроков`;
    }
    if (restoreSnapshotModal) {
      openModal(restoreSnapshotModal);
      if (window.TelegramApp && window.TelegramApp.TelegramApp) {
        window.TelegramApp.TelegramApp.haptic('warning');
      }
    }
  }

  if (cancelRestoreSnapshotBtn) {
    cancelRestoreSnapshotBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      pendingRestoreSnapshot = null;
      if (restoreSnapshotModal) closeModal(restoreSnapshotModal);
    });
  }

  if (restoreSnapshotModal) {
    restoreSnapshotModal.addEventListener('click', (e) => {
      if (e.target === restoreSnapshotModal) {
        pendingRestoreSnapshot = null;
        closeModal(restoreSnapshotModal);
      }
    });
  }

  if (adminViewerRestoreBtn) {
    adminViewerRestoreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (activeSnapshotData) {
        openRestoreSnapshotDialog(activeSnapshotData);
      }
    });
  }

  async function restoreSnapshot(snapshotId) {
    if (!snapshotId) throw new Error('ID снимка не указан');
    const idStr = String(snapshotId);

    // 1. Try server API first
    let apiSuccess = false;
    let apiResult = null;
    try {
      const res = await apiCall('/api/admin/leaderboard-history/restore', 'POST', {
        id: idStr,
        snapshotId: idStr,
        telegramId: currentUser.telegramId,
        authData: getTelegramInitData()
      });
      if (res && res.success) {
        apiSuccess = true;
        apiResult = res;
      }
    } catch (e) {
      console.warn('[Restore Snapshot] Server API notice:', e.message);
    }

    // 2. Direct Cloud KVDB sync (ensures GitHub Pages / static client works 100%)
    try {
      const snapRes = await fetch(`${GLOBAL_CLOUD_BASE}/leaderboard_snapshot_${idStr}?_cb=${Date.now()}`);
      if (snapRes.ok) {
        const snapData = await snapRes.json();
        if (snapData && Array.isArray(snapData.players) && snapData.players.length > 0) {
          const nowTs = Date.now();
          const snapPlayers = snapData.players;
          const snapMap = new Map();

          snapPlayers.forEach((p, idx) => {
            const tid = String(p.telegram_id || p.telegramId || '').trim();
            if (!tid) return;
            const lvl = Number(p.level !== undefined ? p.level : (p.max_level || p.maxLevel || 1));
            const stars = Number(p.stars || 0);
            const name = p.name || p.first_name || p.firstName || 'Игрок';
            const username = p.username || '';
            snapMap.set(tid, { tid, lvl, stars, name, username, rank: p.rank || (idx + 1) });
          });

          // Write meta_leaderboard_restored_at and meta_active_snapshot_id
          await fetch(`${GLOBAL_CLOUD_BASE}/meta_leaderboard_restored_at`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              restoredAt: nowTs,
              snapshotId: idStr,
              snapshotDate: snapData.snapshot_date,
              snapshotTime: snapData.snapshot_time,
              totalPlayers: snapMap.size
            })
          });

          await fetch(`${GLOBAL_CLOUD_BASE}/meta_active_snapshot_id`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(idStr)
          });

          // Fetch all player_* keys to update/wipe
          const playersRes = await fetch(`${GLOBAL_CLOUD_BASE}/?prefix=player_&values=true&format=json&_cb=${nowTs}`);
          let existingPairs = [];
          if (playersRes.ok) {
            try { existingPairs = await playersRes.json(); } catch(e) {}
          }

          const seenTids = new Set();
          for (const [key, rawVal] of existingPairs) {
            let val = rawVal;
            if (typeof val === 'string') {
              try { val = JSON.parse(val); } catch(e) { val = null; }
            }
            if (!val || !val.telegramId) continue;
            const tid = String(val.telegramId).trim();
            seenTids.add(tid);

            if (snapMap.has(tid)) {
              const sp = snapMap.get(tid);
              const curLvl = Number(val.maxLevel !== undefined ? val.maxLevel : (val.level || 0));
              const finalRestoreLvl = Math.max(sp.lvl, curLvl, (IMMUTABLE_PLAYER_BASELINES[tid]?.maxLevel || 0));
              const finalRestoreStars = Math.max(Number(sp.stars || 0), Number(val.stars || 0), (IMMUTABLE_PLAYER_BASELINES[tid]?.stars || 0));
              const updatedPayload = {
                ...val,
                telegramId: tid,
                firstName: val.firstName || sp.name,
                username: val.username || sp.username,
                maxLevel: finalRestoreLvl,
                max_level: finalRestoreLvl,
                level: finalRestoreLvl,
                currentLevel: Math.max(Number(val.currentLevel || 1), finalRestoreLvl),
                current_level: Math.max(Number(val.current_level || 1), finalRestoreLvl),
                stars: finalRestoreStars,
                snapshotRestoredAt: nowTs,
                updatedAt: nowTs
              };
              await fetch(`${GLOBAL_CLOUD_BASE}/player_${encodeURIComponent(tid)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedPayload)
              });
            }
            // Players not in snapshot are preserved as active real players without being reset
          }

          // Insert any snapshot players not in KVDB yet
          for (const [tid, sp] of snapMap.entries()) {
            if (!seenTids.has(tid)) {
              const newPayload = {
                telegramId: tid,
                firstName: sp.name,
                username: sp.username,
                maxLevel: sp.lvl,
                max_level: sp.lvl,
                level: sp.lvl,
                currentLevel: sp.lvl,
                current_level: sp.lvl,
                stars: sp.stars,
                snapshotRestoredAt: nowTs,
                updatedAt: nowTs
              };
              await fetch(`${GLOBAL_CLOUD_BASE}/player_${encodeURIComponent(tid)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newPayload)
              });
            }
          }

          // Strictly synchronize current user in RAM & LocalStorage
          const myTid = String(currentUser.telegramId).trim();
          if (snapMap.has(myTid)) {
            const mySnap = snapMap.get(myTid);
            currentUser.maxLevel = mySnap.lvl;
            currentUser.level = mySnap.lvl;
            currentUser.currentLevel = mySnap.lvl;
            currentUser.stars = mySnap.stars;
            currentUser.lastSnapshotRestoredAt = nowTs;
            localStorage.setItem('color_sort_restored_at_' + myTid, String(nowTs));
            localStorage.setItem('color_sort_db_level_' + myTid, String(mySnap.lvl));
            saveLocalUser();
            updateHeaderUI();
            loadCurrentLevel();
          } else {
            currentUser.maxLevel = 0;
            currentUser.level = 0;
            currentUser.currentLevel = 1;
            currentUser.stars = 0;
            currentUser.lastSnapshotRestoredAt = nowTs;
            localStorage.setItem('color_sort_restored_at_' + myTid, String(nowTs));
            localStorage.setItem('color_sort_db_level_' + myTid, '0');
            saveLocalUser();
            updateHeaderUI();
            loadCurrentLevel();
          }

          return { success: true, totalPlayers: snapMap.size, date: snapData.snapshot_date, time: snapData.snapshot_time };
        }
      }
    } catch (kvErr) {
      console.warn('[Restore Snapshot] KVDB direct sync warning:', kvErr.message);
    }

    if (!apiSuccess) {
      throw new Error('Не удалось восстановить снимок лидерборда ни через API, ни через облачную базу данных.');
    }

    return apiResult;
  }

  if (confirmRestoreSnapshotBtn) {
    confirmRestoreSnapshotBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!isAlligatorAdmin(currentUser)) return;
      if (!pendingRestoreSnapshot || !pendingRestoreSnapshot.id) {
        if (restoreSnapshotModal) closeModal(restoreSnapshotModal);
        return;
      }

      const snapshotIdToRestore = pendingRestoreSnapshot.id;
      const snapshotFormatted = formatSnapshotDisplay(pendingRestoreSnapshot.snapshot_date, pendingRestoreSnapshot.snapshot_time);

      confirmRestoreSnapshotBtn.disabled = true;
      const origHtml = confirmRestoreSnapshotBtn.innerHTML;
      confirmRestoreSnapshotBtn.innerHTML = '⏳ Восстановление...';

      try {
        const res = await restoreSnapshot(snapshotIdToRestore);

        if (restoreSnapshotModal) closeModal(restoreSnapshotModal);
        if (adminHistoryViewerModal) closeModal(adminHistoryViewerModal);

        if (window.TelegramApp && window.TelegramApp.TelegramApp) {
          window.TelegramApp.TelegramApp.haptic('success');
        }

        showInfoModal(
          '📥',
          'Лидерборд восстановлен!',
          `Снимок за ${snapshotFormatted} успешно загружен в активный лидерборд!\nВсего игроков в актуальном рейтинге: ${res.totalPlayers || '?'}.\nПредыдущие и лишние записи полностью удалены.`
        );

        pendingRestoreSnapshot = null;
        await loadLeaderboardData();
        await loadAdminHistoryList();
        updateHeaderUI();
        if (typeof updateProfileUI === 'function') updateProfileUI();
        loadCurrentLevel();
      } catch (err) {
        console.error('[Restore Snapshot Error]', err);
        showInfoModal('⚠️', 'Ошибка восстановления', 'Не удалось загрузить снимок: ' + (err.message || err));
      } finally {
        confirmRestoreSnapshotBtn.disabled = false;
        confirmRestoreSnapshotBtn.innerHTML = origHtml;
      }
    });
  }

  if (adminHistoryRefreshDatesBtn) {
    adminHistoryRefreshDatesBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      loadAdminHistoryList();
      if (window.TelegramApp && window.TelegramApp.TelegramApp) {
        window.TelegramApp.TelegramApp.haptic('light');
      }
    });
  }

  // 📸 Top Button: "Сделать снимок сейчас" (Ручной/тестовый снимок)
  if (adminHistoryTakeSnapshotBtn) {
    adminHistoryTakeSnapshotBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!isAlligatorAdmin(currentUser)) {
        showInfoModal('⚠️', 'Доступ ограничен', 'Только администратор может делать снимки лидерборда.');
        return;
      }

      adminHistoryTakeSnapshotBtn.disabled = true;
      const origHtml = adminHistoryTakeSnapshotBtn.innerHTML;
      adminHistoryTakeSnapshotBtn.innerHTML = '⏳ Сохранение...';

      try {
        const snap = await createCurrentLeaderboardSnapshot('manual');

        if (window.TelegramApp && window.TelegramApp.TelegramApp) {
          window.TelegramApp.TelegramApp.haptic('success');
        }

        const dtFormatted = formatSnapshotDisplay(snap.snapshot_date, snap.snapshot_time);

        showInfoModal(
          '📸',
          'Ручной снимок сохранён!',
          `Снимок за ${dtFormatted} успешно сохранён!\nВсего игроков в снимке: ${snap.total_players}\n\n🤖 Автоматический снимок в 23:59 (Киев) будет сохранён по расписанию отдельно.`
        );

        await loadAdminHistoryList();
      } catch (err) {
        console.error('[Take Snapshot Error]', err);
        showInfoModal('⚠️', 'Ошибка', 'Не удалось сделать снимок: ' + (err.message || err));
      } finally {
        adminHistoryTakeSnapshotBtn.disabled = false;
        adminHistoryTakeSnapshotBtn.innerHTML = origHtml;
      }
    });
  }

  // ============================================================
  // 👛 Connected Wallets Feature (Admin Only - Alligator)
  // ============================================================
  const adminWalletsCountBadge = document.getElementById('adminWalletsCountBadge');
  const adminWalletsSearchInput = document.getElementById('adminWalletsSearchInput');
  const adminWalletsClearSearchBtn = document.getElementById('adminWalletsClearSearchBtn');
  const adminWalletsRefreshBtn = document.getElementById('adminWalletsRefreshBtn');
  const adminWalletsLoadingSpinner = document.getElementById('adminWalletsLoadingSpinner');
  const adminWalletsEmptyState = document.getElementById('adminWalletsEmptyState');
  const adminWalletsItemsList = document.getElementById('adminWalletsItemsList');

  // Details Modal Elements
  const adminWalletDetailsModal = document.getElementById('adminWalletDetailsModal');
  const adminWalletDetailsCloseBtn = document.getElementById('adminWalletDetailsCloseBtn');
  const adminWalletDetailsBackBtn = document.getElementById('adminWalletDetailsBackBtn');
  const adminWalletDetailName = document.getElementById('adminWalletDetailName');
  const adminWalletDetailUsername = document.getElementById('adminWalletDetailUsername');
  const adminWalletDetailTid = document.getElementById('adminWalletDetailTid');
  const adminWalletCopyTidBtn = document.getElementById('adminWalletCopyTidBtn');
  const adminWalletDetailWalletType = document.getElementById('adminWalletDetailWalletType');
  const adminWalletDetailTypeBadge = document.getElementById('adminWalletDetailTypeBadge');
  const adminWalletDetailAddress = document.getElementById('adminWalletDetailAddress');
  const adminWalletCopyAddressBtn = document.getElementById('adminWalletCopyAddressBtn');
  const adminWalletCopyAddressIcon = document.getElementById('adminWalletCopyAddressIcon');
  const adminWalletCopyAddressLabel = document.getElementById('adminWalletCopyAddressLabel');
  const adminWalletDetailTotalAmount = document.getElementById('adminWalletDetailTotalAmount');
  const adminWalletDetailDepositsCount = document.getElementById('adminWalletDetailDepositsCount');
  const adminWalletDepositsLoadingSpinner = document.getElementById('adminWalletDepositsLoadingSpinner');
  const adminWalletDepositsEmptyState = document.getElementById('adminWalletDepositsEmptyState');
  const adminWalletDepositsTableWrap = document.getElementById('adminWalletDepositsTableWrap');
  const adminWalletDepositsTableBody = document.getElementById('adminWalletDepositsTableBody');

  let cachedWalletsList = [];
  let activeViewingWalletPlayer = null;

  function escapeWalletHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getWalletCountWord(n) {
    const num = Math.abs(Number(n) || 0) % 100;
    const n1 = num % 10;
    if (num > 10 && num < 20) return 'кошельков';
    if (n1 > 1 && n1 < 5) return 'кошелька';
    if (n1 === 1) return 'кошелёк';
    return 'кошельков';
  }

  function getDepositCountWord(n) {
    const num = Math.abs(Number(n) || 0) % 100;
    const n1 = num % 10;
    if (num > 10 && num < 20) return 'пополнений';
    if (n1 > 1 && n1 < 5) return 'пополнения';
    if (n1 === 1) return 'пополнение';
    return 'пополнений';
  }

  function copyTextToClipboard(text, onDone) {
    if (!text) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(String(text)).then(() => {
          if (typeof onDone === 'function') onDone();
        }).catch(() => {
          fallbackCopyText(text, onDone);
        });
      } else {
        fallbackCopyText(text, onDone);
      }
    } catch (e) {
      fallbackCopyText(text, onDone);
    }
  }

  function fallbackCopyText(text, onDone) {
    try {
      const ta = document.createElement('textarea');
      ta.value = String(text);
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      if (typeof onDone === 'function') onDone();
    } catch (e) {
      console.warn('[Copy Fallback Error]', e);
    }
  }

  // Load connected wallets from KVDB Cloud, local cache, and backend server
  async function loadAdminWalletsList() {
    if (!isAlligatorAdmin(currentUser)) return;
    if (adminWalletsLoadingSpinner) adminWalletsLoadingSpinner.classList.remove('hidden');
    if (adminWalletsEmptyState) adminWalletsEmptyState.classList.add('hidden');
    if (adminWalletsItemsList) adminWalletsItemsList.innerHTML = '';

    const walletsMap = new Map();

    // 1. Read from local cache first for instant responsiveness
    try {
      const stored = localStorage.getItem(WALLETS_LOCAL_STORAGE_KEY);
      if (stored) {
        const localList = JSON.parse(stored);
        if (Array.isArray(localList)) {
          localList.forEach(w => {
            if (w && w.telegramId && (w.walletAddress || w.ton_wallet)) {
              walletsMap.set(String(w.telegramId), {
                telegramId: String(w.telegramId),
                name: w.name || w.firstName || 'Игрок',
                username: w.username || '',
                walletAddress: String(w.walletAddress || w.ton_wallet).trim(),
                walletType: detectWalletTypeName(w.walletType || w.ton_wallet_type),
                tonBalance: Number(w.tonBalance || w.ton_balance || 0),
                updatedAt: w.updatedAt || 0
              });
            }
          });
        }
      }
    } catch (e) {}


    // 3. Scan KVDB cloud for any player profiles with connected wallets
    try {
      const res = await fetch(`${GLOBAL_CLOUD_BASE}/?prefix=player_&values=true&format=json&_cb=${Date.now()}`, {
        cache: 'no-store'
      });
      if (res.ok) {
        const entries = await res.json();
        if (Array.isArray(entries)) {
          entries.forEach(item => {
            const p = item && (item.value || item);
            if (p && p.telegramId && (p.ton_wallet || p.tonWallet)) {
              const tid = String(p.telegramId);
              const existing = walletsMap.get(tid) || {};
              walletsMap.set(tid, Object.assign({}, existing, {
                telegramId: tid,
                name: p.firstName || p.name || existing.name || 'Игрок',
                username: p.username || existing.username || '',
                walletAddress: String(p.ton_wallet || p.tonWallet).trim(),
                walletType: detectWalletTypeName(p.ton_wallet_type || p.tonWalletType || existing.walletType),
                tonBalance: Number(p.ton_balance !== undefined ? p.ton_balance : (existing.tonBalance || 0)),
                updatedAt: Date.now()
              }));
            }
          });
        }
      }
    } catch (e) {}

    // 4. Try backend API if running
    try {
      const apiRes = await apiCall(`/api/admin/connected-wallets?${getAdminAuthQuery()}`, 'GET');
      if (apiRes && apiRes.success && Array.isArray(apiRes.wallets)) {
        apiRes.wallets.forEach(w => {
          if (w && w.telegram_id && w.ton_wallet) {
            const tid = String(w.telegram_id);
            const existing = walletsMap.get(tid) || {};
            walletsMap.set(tid, Object.assign({}, existing, {
              telegramId: tid,
              name: w.first_name || existing.name || 'Игрок',
              username: w.username || existing.username || '',
              walletAddress: String(w.ton_wallet).trim(),
              walletType: detectWalletTypeName(w.ton_wallet_type || existing.walletType),
              tonBalance: Number(w.ton_balance !== undefined ? w.ton_balance : (existing.tonBalance || 0)),
              updatedAt: Date.now()
            }));
          }
        });
      }
    } catch (e) {}

    // 5. Ensure currentUser is included if wallet connected
    if (currentUser && currentUser.telegramId && currentUser.ton_wallet) {
      const tid = String(currentUser.telegramId);
      const existing = walletsMap.get(tid) || {};
      walletsMap.set(tid, Object.assign({}, existing, {
        telegramId: tid,
        name: currentUser.firstName || 'Игрок',
        username: currentUser.username || '',
        walletAddress: String(currentUser.ton_wallet).trim(),
        walletType: detectWalletTypeName(currentUser.ton_wallet_type || existing.walletType),
        tonBalance: Number(currentUser.ton_balance || 0),
        updatedAt: Date.now()
      }));
    }

    cachedWalletsList = Array.from(walletsMap.values());
    try {
      localStorage.setItem(WALLETS_LOCAL_STORAGE_KEY, JSON.stringify(cachedWalletsList));
    } catch (e) {}

    if (adminWalletsLoadingSpinner) adminWalletsLoadingSpinner.classList.add('hidden');
    renderAdminWalletsList(cachedWalletsList);
  }

  // Render the uncluttered main list: Nickname, TID, Wallet Address, and "Просмотреть" button
  function renderAdminWalletsList(list) {
    if (!adminWalletsItemsList) return;
    adminWalletsItemsList.innerHTML = '';

    const query = (adminWalletsSearchInput ? adminWalletsSearchInput.value : '').trim().toLowerCase();
    const filtered = (list || []).filter(item => {
      if (!query) return true;
      const n = (item.name || '').toLowerCase();
      const u = (item.username || '').toLowerCase();
      const tid = String(item.telegramId || '').toLowerCase();
      const a = (item.walletAddress || '').toLowerCase();
      return n.includes(query) || u.includes(query) || tid.includes(query) || a.includes(query);
    });

    const totalCount = filtered.length;
    if (adminWalletsCountBadge) {
      adminWalletsCountBadge.textContent = `👛 ${totalCount} ${getWalletCountWord(totalCount)}`;
    }

    if (totalCount === 0) {
      if (adminWalletsEmptyState) adminWalletsEmptyState.classList.remove('hidden');
      return;
    }

    if (adminWalletsEmptyState) adminWalletsEmptyState.classList.add('hidden');

    const viewBtnLabel = typeof t === 'function' ? t('adminWalletViewBtnLabel') : 'Просмотреть';

    filtered.forEach(player => {
      const card = document.createElement('div');
      card.className = 'admin-wallet-card';

      const displayName = escapeWalletHtml(player.name || 'Игрок');
      const displayUsername = player.username ? `@${escapeWalletHtml(player.username.replace(/^@/, ''))}` : '';
      const tidStr = String(player.telegramId || '—');
      const fullAddr = String(player.walletAddress || '').trim();
      const shortAddr = formatShortTonAddress(fullAddr);

      card.innerHTML = `
        <div class="admin-wallet-info">
          <div class="admin-wallet-name-row">
            <span class="admin-wallet-name">👤 ${displayName}</span>
            ${displayUsername ? `<span class="admin-wallet-username">${displayUsername}</span>` : ''}
          </div>
          <div class="admin-wallet-meta-row">
            <span class="admin-wallet-tid">ID: ${tidStr}</span>
            <span class="admin-wallet-address-pill" title="${escapeWalletHtml(fullAddr)}">👛 ${shortAddr}</span>
          </div>
        </div>
        <div class="admin-wallet-actions">
          <button type="button" class="admin-wallet-view-btn btn-wallet-view" data-tid="${tidStr}" title="${viewBtnLabel}">
            <span>👁️</span>
            <span>${viewBtnLabel}</span>
          </button>
        </div>
      `;

      adminWalletsItemsList.appendChild(card);
    });
  }

  // Delegated click handler on main list: "Просмотреть"
  if (adminWalletsItemsList) {
    adminWalletsItemsList.addEventListener('click', (e) => {
      const viewBtn = e.target.closest('.btn-wallet-view');
      if (!viewBtn) return;
      e.stopPropagation();
      const tid = viewBtn.dataset.tid;
      const player = cachedWalletsList.find(p => String(p.telegramId) === String(tid));
      if (player) {
        openAdminWalletDetails(player);
      } else if (tid) {
        openAdminWalletDetails({
          telegramId: tid,
          name: 'Игрок',
          username: '',
          walletAddress: '',
          walletType: 'TON Wallet'
        });
      }
    });
  }

  // Search input and clear button for wallets list
  if (adminWalletsSearchInput) {
    adminWalletsSearchInput.addEventListener('input', () => {
      const val = adminWalletsSearchInput.value.trim();
      if (adminWalletsClearSearchBtn) {
        adminWalletsClearSearchBtn.classList.toggle('hidden', val.length === 0);
      }
      renderAdminWalletsList(cachedWalletsList);
    });
  }

  if (adminWalletsClearSearchBtn) {
    adminWalletsClearSearchBtn.addEventListener('click', () => {
      if (adminWalletsSearchInput) adminWalletsSearchInput.value = '';
      adminWalletsClearSearchBtn.classList.add('hidden');
      renderAdminWalletsList(cachedWalletsList);
    });
  }

  // Refresh button
  if (adminWalletsRefreshBtn) {
    adminWalletsRefreshBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      loadAdminWalletsList();
      if (window.TelegramApp && window.TelegramApp.TelegramApp) {
        window.TelegramApp.TelegramApp.haptic('light');
      }
    });
  }

  // Open detailed modal for selected player (LAZY LOADING DEPOSITS)
  async function openAdminWalletDetails(player) {
    if (!adminWalletDetailsModal || !player) return;
    activeViewingWalletPlayer = player;

    openModal(adminWalletDetailsModal);
    if (window.TelegramApp && window.TelegramApp.TelegramApp) {
      window.TelegramApp.TelegramApp.haptic('light');
    }

    // 1. Populate player header & card info immediately
    const dispName = player.name || player.firstName || 'Игрок';
    const dispUsername = player.username ? `@${player.username.replace(/^@/, '')}` : '';
    const tidStr = String(player.telegramId || '—');
    const fullAddr = String(player.walletAddress || player.ton_wallet || '—').trim();
    const resolvedType = detectWalletTypeName(player.walletType || player.ton_wallet_type);

    if (adminWalletDetailName) adminWalletDetailName.textContent = dispName;
    if (adminWalletDetailUsername) adminWalletDetailUsername.textContent = dispUsername;
    if (adminWalletDetailTid) adminWalletDetailTid.textContent = tidStr;
    if (adminWalletDetailWalletType) adminWalletDetailWalletType.textContent = resolvedType;
    if (adminWalletDetailTypeBadge) adminWalletDetailTypeBadge.textContent = `💎 ${resolvedType}`;
    if (adminWalletDetailAddress) adminWalletDetailAddress.textContent = fullAddr;

    // Reset copy button states
    if (adminWalletCopyAddressLabel) adminWalletCopyAddressLabel.textContent = 'Копировать';
    if (adminWalletCopyAddressIcon) adminWalletCopyAddressIcon.textContent = '📋';

    // 2. Set financial metrics to loading
    if (adminWalletDetailTotalAmount) adminWalletDetailTotalAmount.textContent = '⏳...';
    if (adminWalletDetailDepositsCount) adminWalletDetailDepositsCount.textContent = '⏳...';

    // 3. Set deposits table to loading state
    if (adminWalletDepositsLoadingSpinner) adminWalletDepositsLoadingSpinner.classList.remove('hidden');
    if (adminWalletDepositsEmptyState) adminWalletDepositsEmptyState.classList.add('hidden');
    if (adminWalletDepositsTableWrap) adminWalletDepositsTableWrap.classList.add('hidden');
    if (adminWalletDepositsTableBody) adminWalletDepositsTableBody.innerHTML = '';

    // 4. Lazy-load confirmed deposits for this player on demand
    const depositsMap = new Map();

    // A. Read local deposits for this player
    try {
      const localDepKey = DEPOSITS_LOCAL_PREFIX + tidStr;
      const stored = localStorage.getItem(localDepKey);
      if (stored) {
        const arr = JSON.parse(stored);
        if (Array.isArray(arr)) {
          arr.forEach(d => {
            const key = d.txHash || d.id || `${d.date}_${d.amount}`;
            depositsMap.set(key, d);
          });
        }
      }
    } catch (e) {}

    // B. Fetch 24/7 KVDB cloud deposits key deposits_${tid}
    try {
      const cloudDepKey = `deposits_${tidStr}`;
      const res = await fetch(`${GLOBAL_CLOUD_BASE}/${cloudDepKey}?_cb=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const cloudArr = await res.json();
        if (Array.isArray(cloudArr)) {
          cloudArr.forEach(d => {
            const key = d.txHash || d.id || `${d.date}_${d.amount}`;
            depositsMap.set(key, d);
          });
        }
      }
    } catch (e) {
      console.warn('[Lazy Load Cloud Deposits Error]', e);
    }

    // C. Fetch from backend API if available
    try {
      const apiRes = await apiCall(`/api/admin/player-deposits?telegramId=${encodeURIComponent(tidStr)}&${getAdminAuthQuery()}`, 'GET');
      if (apiRes && apiRes.success && Array.isArray(apiRes.deposits)) {
        apiRes.deposits.forEach(d => {
          const key = d.tx_hash || d.id || `${d.created_at}_${d.amount}`;
          depositsMap.set(key, {
            id: d.id,
            telegramId: tidStr,
            amount: parseFloat(d.amount) || 0,
            memo: d.memo || '',
            walletAddress: d.wallet_address || '',
            walletType: detectWalletTypeName(d.wallet_type || resolvedType),
            txHash: d.tx_hash || '',
            date: d.created_at || d.date || '—',
            status: d.status || 'confirmed'
          });
        });
      }
    } catch (e) {}

    const allDeposits = Array.from(depositsMap.values());
    const confirmedDeposits = allDeposits.filter(d => !d.status || d.status === 'confirmed');

    // Calculate sum and count
    const totalDeposited = confirmedDeposits.reduce((acc, d) => acc + (parseFloat(d.amount) || 0), 0);
    const depositsCount = confirmedDeposits.length;

    if (adminWalletDetailTotalAmount) {
      adminWalletDetailTotalAmount.textContent = `${totalDeposited.toFixed(2)} TON`;
    }
    if (adminWalletDetailDepositsCount) {
      adminWalletDetailDepositsCount.textContent = `${depositsCount} ${getDepositCountWord(depositsCount)}`;
    }

    if (adminWalletDepositsLoadingSpinner) adminWalletDepositsLoadingSpinner.classList.add('hidden');

    if (confirmedDeposits.length === 0) {
      if (adminWalletDepositsEmptyState) adminWalletDepositsEmptyState.classList.remove('hidden');
      if (adminWalletDepositsTableWrap) adminWalletDepositsTableWrap.classList.add('hidden');
      return;
    }

    if (adminWalletDepositsEmptyState) adminWalletDepositsEmptyState.classList.add('hidden');
    if (adminWalletDepositsTableWrap) adminWalletDepositsTableWrap.classList.remove('hidden');

    // Sort newest deposits first
    confirmedDeposits.sort((a, b) => {
      const tA = new Date(a.date || a.created_at || 0).getTime();
      const tB = new Date(b.date || b.created_at || 0).getTime();
      return tB - tA;
    });

    confirmedDeposits.forEach(dep => {
      const tr = document.createElement('tr');
      const dt = dep.date || dep.created_at || '—';
      const amt = (parseFloat(dep.amount) || 0).toFixed(2);
      const memoText = dep.memo ? escapeWalletHtml(dep.memo) : '—';
      const hashText = dep.txHash ? ` (${formatShortTonAddress(dep.txHash)})` : '';

      tr.innerHTML = `
        <td>
          <div style="font-size: 0.78rem; font-weight: 600; color: #f1f5f9;">📅 ${dt}</div>
        </td>
        <td style="text-align: right;">
          <span style="font-weight: 800; color: #38bdf8; font-family: monospace;">+${amt} TON</span>
        </td>
        <td style="text-align: center;">
          <span class="admin-deposit-status-confirmed">✅ Подтверждено</span>
        </td>
        <td>
          <span style="font-size: 0.72rem; color: #94a3b8; word-break: break-all;">${memoText}${hashText}</span>
        </td>
      `;
      adminWalletDepositsTableBody.appendChild(tr);
    });
  }

  // Copy Telegram ID
  if (adminWalletCopyTidBtn) {
    adminWalletCopyTidBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!activeViewingWalletPlayer) return;
      const tid = String(activeViewingWalletPlayer.telegramId || '');
      copyTextToClipboard(tid, () => {
        if (window.TelegramApp && window.TelegramApp.TelegramApp) {
          window.TelegramApp.TelegramApp.haptic('success');
        }
        adminWalletCopyTidBtn.textContent = '✓';
        setTimeout(() => { adminWalletCopyTidBtn.textContent = '📋'; }, 1500);
      });
    });
  }

  // Copy Full Wallet Address
  if (adminWalletCopyAddressBtn) {
    adminWalletCopyAddressBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!activeViewingWalletPlayer) return;
      const addr = String(activeViewingWalletPlayer.walletAddress || activeViewingWalletPlayer.ton_wallet || '');
      copyTextToClipboard(addr, () => {
        if (window.TelegramApp && window.TelegramApp.TelegramApp) {
          window.TelegramApp.TelegramApp.haptic('success');
        }
        if (adminWalletCopyAddressLabel) adminWalletCopyAddressLabel.textContent = '✓ Скопировано!';
        if (adminWalletCopyAddressIcon) adminWalletCopyAddressIcon.textContent = '✓';
        setTimeout(() => {
          if (adminWalletCopyAddressLabel) adminWalletCopyAddressLabel.textContent = 'Копировать';
          if (adminWalletCopyAddressIcon) adminWalletCopyAddressIcon.textContent = '📋';
        }, 2000);
      });
    });
  }

  // Close / Back buttons on Details Modal
  if (adminWalletDetailsCloseBtn) {
    adminWalletDetailsCloseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (adminWalletDetailsModal) closeModal(adminWalletDetailsModal);
      activeViewingWalletPlayer = null;
    });
  }

  if (adminWalletDetailsBackBtn) {
    adminWalletDetailsBackBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (adminWalletDetailsModal) closeModal(adminWalletDetailsModal);
      activeViewingWalletPlayer = null;
    });
  }

  if (adminWalletDetailsModal) {
    adminWalletDetailsModal.addEventListener('click', (e) => {
      if (e.target === adminWalletDetailsModal) {
        closeModal(adminWalletDetailsModal);
        activeViewingWalletPlayer = null;
      }
    });
  }

  // ============================================================
  // 📢 Admin News & Telegram Broadcast System (Admin Only)
  // ============================================================
  const adminNewsAudienceCount = document.getElementById('adminNewsAudienceCount');
  const adminNewsKyivTime = document.getElementById('adminNewsKyivTime');
  const adminNewsRefreshBtn = document.getElementById('adminNewsRefreshBtn');
  const adminNewsTitleInput = document.getElementById('adminNewsTitleInput');
  const adminNewsMessageInput = document.getElementById('adminNewsMessageInput');
  const adminNewsFileInput = document.getElementById('adminNewsFileInput');
  const adminNewsUploadFileBtn = document.getElementById('adminNewsUploadFileBtn');
  const adminNewsImageUrlInput = document.getElementById('adminNewsImageUrlInput');
  const adminNewsPreviewBox = document.getElementById('adminNewsPreviewBox');
  const adminNewsPreviewImg = document.getElementById('adminNewsPreviewImg');
  const adminNewsPreviewFileName = document.getElementById('adminNewsPreviewFileName');
  const adminNewsRemoveImageBtn = document.getElementById('adminNewsRemoveImageBtn');
  const adminNewsButtonTextInput = document.getElementById('adminNewsButtonTextInput');
  const adminNewsTestSendBtn = document.getElementById('adminNewsTestSendBtn');
  const adminNewsBroadcastBtn = document.getElementById('adminNewsBroadcastBtn');
  const adminNewsStatusMsg = document.getElementById('adminNewsStatusMsg');
  const adminNewsLoadingSpinner = document.getElementById('adminNewsLoadingSpinner');
  const adminNewsEmptyState = document.getElementById('adminNewsEmptyState');
  const adminNewsItemsList = document.getElementById('adminNewsItemsList');

  let newsImageBase64 = null;
  let newsImageFileName = '';
  let cachedNewsAudienceCount = 0;
  let statusMsgTimer = null;

  function showNewsStatus(text, type = 'success') {
    if (!adminNewsStatusMsg) return;
    if (statusMsgTimer) clearTimeout(statusMsgTimer);

    adminNewsStatusMsg.textContent = text;
    adminNewsStatusMsg.className = 'admin-feedback-msg';
    if (type === 'error') {
      adminNewsStatusMsg.style.background = 'rgba(239, 68, 68, 0.15)';
      adminNewsStatusMsg.style.borderColor = 'rgba(239, 68, 68, 0.4)';
      adminNewsStatusMsg.style.color = '#f87171';
    } else {
      adminNewsStatusMsg.style.background = 'rgba(16, 185, 129, 0.15)';
      adminNewsStatusMsg.style.borderColor = 'rgba(52, 211, 153, 0.4)';
      adminNewsStatusMsg.style.color = '#34d399';
    }
    adminNewsStatusMsg.classList.remove('hidden');

    statusMsgTimer = setTimeout(() => {
      adminNewsStatusMsg.classList.add('hidden');
    }, 7000);
  }

  function removeNewsSelectedImage() {
    newsImageBase64 = null;
    newsImageFileName = '';
    if (adminNewsFileInput) adminNewsFileInput.value = '';
    if (adminNewsImageUrlInput) adminNewsImageUrlInput.value = '';
    if (adminNewsPreviewBox) adminNewsPreviewBox.classList.add('hidden');
    if (adminNewsPreviewImg) adminNewsPreviewImg.src = '';
    if (adminNewsPreviewFileName) adminNewsPreviewFileName.textContent = '';
  }

  // Image Upload Listeners
  if (adminNewsUploadFileBtn && adminNewsFileInput) {
    adminNewsUploadFileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      adminNewsFileInput.click();
    });
  }

  if (adminNewsFileInput) {
    adminNewsFileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        alert('Пожалуйста, выберите файл изображения (JPG, PNG, WEBP).');
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        alert('Размер файла превышает 5 МБ. Пожалуйста, выберите изображение меньшего размера.');
        return;
      }

      newsImageFileName = file.name;
      const reader = new FileReader();
      reader.onload = () => {
        newsImageBase64 = reader.result;
        if (adminNewsPreviewImg) adminNewsPreviewImg.src = reader.result;
        if (adminNewsPreviewFileName) adminNewsPreviewFileName.textContent = file.name;
        if (adminNewsPreviewBox) adminNewsPreviewBox.classList.remove('hidden');
        if (adminNewsImageUrlInput) adminNewsImageUrlInput.value = '';
      };
      reader.readAsDataURL(file);
    });
  }

  if (adminNewsImageUrlInput) {
    adminNewsImageUrlInput.addEventListener('input', () => {
      const val = adminNewsImageUrlInput.value.trim();
      if (val && /^https?:\/\//i.test(val)) {
        newsImageBase64 = null;
        newsImageFileName = 'URL Картинка';
        if (adminNewsFileInput) adminNewsFileInput.value = '';
        if (adminNewsPreviewImg) adminNewsPreviewImg.src = val;
        if (adminNewsPreviewFileName) adminNewsPreviewFileName.textContent = 'Ссылка на изображение';
        if (adminNewsPreviewBox) adminNewsPreviewBox.classList.remove('hidden');
      } else if (!val && !newsImageBase64) {
        if (adminNewsPreviewBox) adminNewsPreviewBox.classList.add('hidden');
      }
    });
  }

  if (adminNewsRemoveImageBtn) {
    adminNewsRemoveImageBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeNewsSelectedImage();
    });
  }

  // Load News History and Audience Stats
  async function loadAdminNewsData() {
    if (!isAlligatorAdmin(currentUser)) return;

    if (adminNewsLoadingSpinner) adminNewsLoadingSpinner.classList.remove('hidden');
    if (adminNewsEmptyState) adminNewsEmptyState.classList.add('hidden');
    if (adminNewsItemsList) adminNewsItemsList.innerHTML = '';

    try {
      const authQuery = getAdminAuthQuery();
      const apiUrl = (NEWS_API_BASE || API_BASE || '') + `/api/admin/news?action=list&${authQuery}`;

      let data = null;
      try {
        const res = await fetch(apiUrl, { headers: getAuthHeaders(), cache: 'no-store' });
        if (res.ok) {
          data = await res.json();
        }
      } catch (e) {
        console.warn('[AdminNews] API fetch error:', e.message);
      }

      // Fallback: If API returned null (e.g. GitHub Pages static), fetch directly from KVDB
      if (!data || !data.success) {
        try {
          const [kvRes, delRes] = await Promise.all([
            fetch(`${GLOBAL_CLOUD_BASE}/color_sort_news_list_v1?_cb=${Date.now()}`, { cache: 'no-store' }),
            fetch(`${GLOBAL_CLOUD_BASE}/color_sort_deleted_news_ids?_cb=${Date.now()}`, { cache: 'no-store' }).catch(() => null)
          ]);
          if (kvRes.ok) {
            let history = await kvRes.json();
            if (Array.isArray(history)) {
              if (delRes && delRes.ok) {
                const deletedIds = await delRes.json().catch(() => []);
                if (Array.isArray(deletedIds) && deletedIds.length > 0) {
                  history = history.filter(item => item && item.id && !deletedIds.includes(item.id));
                }
              }
              data = {
                success: true,
                history,
                totalPlayersCount: cachedNewsAudienceCount || 35,
                kyivTimeNow: new Date().toLocaleTimeString('ru-RU', { timeZone: 'Europe/Kiev' }) + ' (Киев)'
              };
            }
          }
        } catch (kvErr) {}
      }

      if (data && data.success) {
        cachedNewsAudienceCount = Number(data.totalPlayersCount || 0);
        if (adminNewsAudienceCount) {
          adminNewsAudienceCount.textContent = `${cachedNewsAudienceCount} игроков`;
        }
        if (adminNewsKyivTime && data.kyivTimeNow) {
          adminNewsKyivTime.textContent = data.kyivTimeNow;
        }

        renderAdminNewsItems(data.history || []);
      } else {
        if (adminNewsEmptyState) adminNewsEmptyState.classList.remove('hidden');
      }
    } catch (err) {
      console.warn('[AdminNews] Load error:', err);
      if (adminNewsEmptyState) adminNewsEmptyState.classList.remove('hidden');
    } finally {
      if (adminNewsLoadingSpinner) adminNewsLoadingSpinner.classList.add('hidden');
    }
  }

  function renderAdminNewsItems(items) {
    if (!adminNewsItemsList) return;
    adminNewsItemsList.innerHTML = '';

    if (!items || items.length === 0) {
      if (adminNewsEmptyState) adminNewsEmptyState.classList.remove('hidden');
      return;
    }

    if (adminNewsEmptyState) adminNewsEmptyState.classList.add('hidden');

    items.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'admin-news-card';

      let statusBadge = '';
      if (item.isTest) {
        statusBadge = '<span class="admin-news-badge admin-news-badge-test">🧪 Тестовая отправка</span>';
      } else if (item.status === 'sent') {
        statusBadge = `<span class="admin-news-badge admin-news-badge-sent">✅ Разослано (${item.deliveredCount || 0}/${item.targetCount || 0})</span>`;
      } else if (item.status === 'partially_sent') {
        statusBadge = `<span class="admin-news-badge admin-news-badge-partial">⚠️ Частично (${item.deliveredCount || 0}/${item.targetCount || 0})</span>`;
      } else {
        statusBadge = '<span class="admin-news-badge admin-news-badge-failed">❌ Сбой отправки</span>';
      }

      const imgHtml = (item.imageUrl && item.imageUrl !== '[Прикрепленное фото]' && /^https?:\/\//i.test(item.imageUrl))
        ? `<div style="margin-top: 4px;"><img src="${escapeHtml(item.imageUrl)}" style="max-height: 80px; border-radius: 6px; object-fit: cover;" alt="Фото"></div>`
        : '';

      const titleHtml = item.title ? `<div class="admin-news-card-title">${escapeHtml(item.title)}</div>` : '';
      const msgHtml = item.message ? `<div class="admin-news-card-msg">${escapeHtml(item.message)}</div>` : '';

      card.innerHTML = `
        <div class="admin-news-card-header">
          <div class="admin-news-card-badges">
            ${statusBadge}
            <span class="admin-news-card-date">${escapeHtml(item.kyivFormattedDate || '')}</span>
          </div>
          <button type="button" class="admin-news-delete-btn" data-id="${escapeHtml(item.id)}" title="Удалить новость везде (из бота Telegram у всех игроков и из игры)" style="padding: 4px 9px; background: rgba(239, 68, 68, 0.25); border: 1px solid #ef4444; border-radius: 6px; color: #fca5a5; font-size: 0.72rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">🗑️ Удалить везде</button>
        </div>
        ${titleHtml}
        ${msgHtml}
        ${imgHtml}
        <div class="admin-news-card-footer">
          <span class="admin-news-card-stats">👤 Автор: ${escapeHtml(item.author || 'Admin')}</span>
          ${item.buttonText ? `<span style="font-size: 0.68rem; color: #38bdf8;">🔘 Кнопка: «${escapeHtml(item.buttonText)}»</span>` : ''}
        </div>
      `;

      const deleteBtn = card.querySelector('.admin-news-delete-btn');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          deleteBtn.disabled = true;
          deleteBtn.innerHTML = '<span>⏳</span> <span>Удаляю...</span>';
          deleteAdminNewsItem(item.id, item.title || 'Новость', item.messages || []);
        });
      }

      adminNewsItemsList.appendChild(card);
    });
  }

  // Delete News Item everywhere: from Telegram bot for all players, history, and UI
  async function deleteAdminNewsItem(id, titleName, messages) {
    // 1. Instantly remove card from UI for instantaneous responsiveness
    try {
      const deleteButtons = adminNewsItemsList ? adminNewsItemsList.querySelectorAll(`.admin-news-delete-btn[data-id="${id}"]`) : [];
      deleteButtons.forEach(btn => {
        const card = btn.closest('.admin-news-card');
        if (card) card.remove();
      });
      if (adminNewsItemsList && adminNewsItemsList.children.length === 0 && adminNewsEmptyState) {
        adminNewsEmptyState.classList.remove('hidden');
      }
    } catch (e) {}

    showNewsStatus(`⏳ Удаление новости «${titleName}» у всех игроков в боте Telegram...`, 'info');

    try {
      const payload = {
        action: 'delete',
        id,
        messages: Array.isArray(messages) ? messages : [],
        telegramId: currentUser ? currentUser.telegramId : '5761685341',
        adminTid: currentUser ? currentUser.telegramId : '5761685341',
        username: currentUser ? currentUser.username : 'ALLIGATOR0709',
        adminUsername: currentUser ? currentUser.username : 'ALLIGATOR0709'
      };

      // 2. Server call FIRST to recall Telegram bot messages for all players
      const initData = getTelegramInitData();
      if (initData && !payload.initData) payload.initData = initData;
      const res = await fetch((NEWS_API_BASE || API_BASE || '') + '/api/admin/news', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      let tgMsgInfo = '';
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Сбой сервера (${res.status})`);
      }

      const data = await res.json();
      tgMsgInfo = (data && data.deletedFromTgCount !== undefined)
        ? ` (отозвано сообщений в боте: ${data.deletedFromTgCount})`
        : '';

      // 3. Clean up Cloud KVDB and record deleted ID in blacklist
      try {
        const [kvRes, delRes] = await Promise.all([
          fetch(`${GLOBAL_CLOUD_BASE}/color_sort_news_list_v1?_cb=${Date.now()}`),
          fetch(`${GLOBAL_CLOUD_BASE}/color_sort_deleted_news_ids?_cb=${Date.now()}`).catch(() => null)
        ]);
        if (kvRes.ok) {
          const list = await kvRes.json();
          if (Array.isArray(list)) {
            const filtered = list.filter(n => n && n.id !== id);
            await fetch(`${GLOBAL_CLOUD_BASE}/color_sort_news_list_v1`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(filtered)
            });
          }
        }
        let delList = [];
        if (delRes && delRes.ok) {
          delList = await delRes.json().catch(() => []);
          if (!Array.isArray(delList)) delList = [];
        }
        if (!delList.includes(id)) {
          delList.push(id);
          await fetch(`${GLOBAL_CLOUD_BASE}/color_sort_deleted_news_ids`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(delList)
          });
        }
      } catch (kvErr) {}

      showNewsStatus(`🗑️ Новость «${titleName}» полностью удалена везде: у всех игроков в боте${tgMsgInfo} и из интерфейса!`, 'success');
      loadAdminNewsData();
    } catch (e) {
      showNewsStatus('❌ Ошибка при удалении: ' + e.message, 'error');
      loadAdminNewsData();
    }
  }

  // Send Broadcast (Test to admin or Full to all players)
  async function sendAdminNews(isTestOnly) {
    if (!isAlligatorAdmin(currentUser)) {
      alert('Доступ запрещён: требуются права администратора');
      return;
    }
    if (!isTestOnly) {
      const pin = await ensureAdminPin('рассылки новости всем игрокам');
      if (!pin) return;
    }

    const title = adminNewsTitleInput ? adminNewsTitleInput.value.trim() : '';
    const message = adminNewsMessageInput ? adminNewsMessageInput.value.trim() : '';
    const buttonText = (adminNewsButtonTextInput && adminNewsButtonTextInput.value.trim()) || '🚀 Играть в Color Sort';

    if (!title && !message) {
      alert('Пожалуйста, введите заголовок или текст сообщения.');
      return;
    }

    if (!isTestOnly) {
      const countStr = cachedNewsAudienceCount > 0 ? ` (${cachedNewsAudienceCount} чел.)` : '';
      const confirmSend = window.confirm(
        `📢 ПОДТВЕРДИТЕ РАССЫЛКУ:\n\nВы собираетесь разослать это уведомление ВСЕМ игрокам${countStr} в Telegram-боте Color Sort!\n\nКаждый игрок получит уведомление в Telegram с кнопкой запуска игры. Продолжить?`
      );
      if (!confirmSend) return;
    }

    const testBtnOrigText = adminNewsTestSendBtn ? adminNewsTestSendBtn.innerHTML : '';
    const broadBtnOrigText = adminNewsBroadcastBtn ? adminNewsBroadcastBtn.innerHTML : '';

    if (adminNewsTestSendBtn) adminNewsTestSendBtn.disabled = true;
    if (adminNewsBroadcastBtn) adminNewsBroadcastBtn.disabled = true;

    if (isTestOnly && adminNewsTestSendBtn) {
      adminNewsTestSendBtn.innerHTML = '<span>⏳</span> <span>Отправка тестового сообщения...</span>';
    } else if (!isTestOnly && adminNewsBroadcastBtn) {
      adminNewsBroadcastBtn.innerHTML = '<span>⏳</span> <span>Рассылка игрокам...</span>';
    }

    try {
      const payload = {
        action: 'broadcast',
        telegramId: currentUser ? currentUser.telegramId : '5761685341',
        adminTid: currentUser ? currentUser.telegramId : '5761685341',
        username: currentUser ? currentUser.username : '',
        adminUsername: currentUser ? currentUser.username : '',
        firstName: currentUser ? currentUser.firstName : '',
        adminFirstName: currentUser ? currentUser.firstName : '',
        title,
        message,
        buttonText,
        isTestOnly
      };

      if (newsImageBase64) {
        payload.imageBase64 = newsImageBase64;
      } else if (adminNewsImageUrlInput && adminNewsImageUrlInput.value.trim()) {
        payload.imageUrl = adminNewsImageUrlInput.value.trim();
      }

      const initData = getTelegramInitData();
      if (initData && !payload.initData) payload.initData = initData;
      const res = await fetch((NEWS_API_BASE || API_BASE || '') + '/api/admin/news', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showNewsStatus(
          isTestOnly
            ? '✅ Тестовое уведомление доставлено в ваш Telegram!'
            : `🎉 Уведомление успешно разослано! Доставлено: ${data.deliveredCount || 0} из ${data.totalTargeted || 0}`,
          'success'
        );

        if (!isTestOnly) {
          // Clear inputs after successful public broadcast
          if (adminNewsTitleInput) adminNewsTitleInput.value = '';
          if (adminNewsMessageInput) adminNewsMessageInput.value = '';
          removeNewsSelectedImage();
        }

        // Refresh news history
        await loadAdminNewsData();
      } else {
        showNewsStatus(`❌ Ошибка: ${data.error || 'Не удалось отправить уведомление'}`, 'error');
      }
    } catch (err) {
      showNewsStatus(`❌ Ошибка сети: ${err.message || 'Сбой запроса'}`, 'error');
    } finally {
      if (adminNewsTestSendBtn) {
        adminNewsTestSendBtn.disabled = false;
        adminNewsTestSendBtn.innerHTML = testBtnOrigText;
      }
      if (adminNewsBroadcastBtn) {
        adminNewsBroadcastBtn.disabled = false;
        adminNewsBroadcastBtn.innerHTML = broadBtnOrigText;
      }
    }
  }

  // Bind Buttons
  if (adminNewsRefreshBtn) {
    adminNewsRefreshBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      loadAdminNewsData();
      if (window.TelegramApp && window.TelegramApp.TelegramApp) {
        window.TelegramApp.TelegramApp.haptic('light');
      }
    });
  }

  if (adminNewsTestSendBtn) {
    adminNewsTestSendBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      sendAdminNews(true);
    });
  }

  if (adminNewsBroadcastBtn) {
    adminNewsBroadcastBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      sendAdminNews(false);
    });
  }

  // ============================================================
  // 💾 Admin Code Checkpoints Feature
  // ============================================================
  const DEFAULT_CODE_CHECKPOINTS = [
    {
      id: 'colorsort_checkpoint_20261006_002800',
      createdAtTimestamp: 1791235680000,
      kyivFormattedDate: '06.10.2026, 00:28:00 (Киев)',
      title: 'Версия v1.1.2 — Закрытый доступ на техработы (только Alligator и Maria), окно синхронизации 2с и восстановление лидерборда',
      note: 'Метка Git: v1.1.2-maintenance-mode-sync-checkpoint. Включен глобальный режим технических работ с полноэкранным уведомлением для всех игроков. Доступ в игру открыт строго для Alligator (5761685341) и Maria (7116446051). Интегрирована 2-секундная пауза синхронизации при перезагрузке (три точки) без сброса на 1 уровень. Восстановлен актуальный снимок базы данных (#1791149202825, 26 игроков). Все тесты пройдены 100%.',
      tag: 'v1.1.2-maintenance-mode-sync-checkpoint'
    },
    {
      id: 'colorsort_checkpoint_20261005_164500',
      createdAtTimestamp: 1791207900000,
      kyivFormattedDate: '05.10.2026, 16:45:00 (Киев)',
      title: 'Версия v1.1.0 — Античит с 5-го уровня, окно безопасности, оптимизация энергопотребления (0 фоновых пингов) и резервная копия админ-панели',
      note: 'Метка Git: v1.1.0-admin-anticheat-opt-checkpoint. Защита от прохождения без подсказок начиная с 5-го уровня (красное модальное окно «Система безопасности Color Sort / Замечены хакерские действия»). Полностью удалены фоновые интервалы поллинга во время игры (0 лишних запросов, экономия батареи и процессора, стабильные 60 FPS). Событийная проверка статуса сервера с 60-сек тайм-аутом. Бесшумные обновления без рассылки сообщений игрокам. Все 50/50 уровней проверены.',
      tag: 'v1.1.0-admin-anticheat-opt-checkpoint'
    },
    {
      id: 'colorsort_checkpoint_20261005_093116',
      createdAtTimestamp: 1791181876093,
      kyivFormattedDate: '05.10.2026, 09:31:16 (Киев)',
      title: 'Версия v1.0.9 — Отправитель подарков, выбор авторства для админа, новый дизайн карточек и мгновенный забор',
      note: 'Метка Git: v1.0.9-gifts-sender-admin-mode-instant-claim. Отображение отправителя у входящих подарков («От: ...»). Панель выбора авторства для администратора («От Alligator» либо «От Color Sort»). Полностью переработана карточка подарка: центрированная иконка сверху, блок описания по центру и широкая кнопка «Забрать» внизу. Устранена задержка при заборе подарков — моментальный отклик и защита от рассинхронизации. Все тесты пройдены.',
      tag: 'v1.0.9-gifts-sender-admin-mode-instant-claim'
    },
    {
      id: 'colorsort_checkpoint_20261003_171000',
      createdAtTimestamp: 1791036600000,
      kyivFormattedDate: '03.10.2026, 17:10:00 (Киев)',
      title: 'Версия v1.0.8 — Восстановление модалок лидерборда и рекламы, уровень игроков в подарках (без кнопки)',
      note: 'Метка Git: v1.0.8-leaderboard-ad-modals-gifts-level-badge. Устранена вложенность модальных окон в public/index.html — кнопки Лидерборда и Рекламы открываются мгновенно и безотказно. В списке получателей подарков убрана кнопка «Выбрать» / «Отправить», а текущий уровень игрока из лидерборда аккуратно отображается в правом углу каждой строки с кликабельным выбором карточки. Полная приватность юзернеймов и анонимность подарков для игроков сохранена. Все тесты пройдены.',
      tag: 'v1.0.8-leaderboard-ad-modals-gifts-level-badge'
    },
    {
      id: 'colorsort_checkpoint_20261003_162500',
      createdAtTimestamp: 1791033900000,
      kyivFormattedDate: '03.10.2026, 16:25:00 (Киев)',
      title: 'Версия v1.0.7 — Анонимные подарки и приватность игроков (доступ юзернеймов только админу)',
      note: 'Метка Git: v1.0.7-anonymous-gifts-admin-usernames. Лидерборд полностью восстановлен на GitHub Pages и Vercel. Юзернеймы (@username) и Telegram ID скрыты у всех обычных игроков и доступны строго администратору (Alligator / Romanchik / ?admin=true). Получение подарков сделано 100% анонимным («Вам прислан полезный подарок!» без раскрытия отправителя). Полные данные аудита отправителей сохранены в базе для администратора.',
      tag: 'v1.0.7-anonymous-gifts-admin-usernames'
    },
    {
      id: 'colorsort_checkpoint_20261003_033500',
      createdAtTimestamp: 1790987700000,
      kyivFormattedDate: '03.10.2026, 03:35:00 (Киев)',
      title: 'Версия v1.0.6 — Стабильная рабочая версия (мгновенный старт, touchstart, чистые колбочки)',
      note: 'Метка Git: v1.0.6-stable-instant-start-checkpoint. Полностью устранён зависающий экран заставки, убрана проблемная шкала 99%. Экран старта и кнопка START открываются мгновенно, добавлены обработчики touchstart для сверхбыстрого отклика на смартфонах в Telegram WebApp. Колбочки чистые, без полос над красками. Снимки лидерборда в 23:59 по Киеву. Безлимитные подарки администратора. 100% тестов пройдены.',
      tag: 'v1.0.6-stable-instant-start-checkpoint'
    },
    {
      id: 'colorsort_checkpoint_20261003_004200',
      createdAtTimestamp: 1790977320000,
      kyivFormattedDate: '03.10.2026, 00:42:00 (Киев)',
      title: 'Версия v1.0.4 — Мгновенный полноэкранный запуск и чистые колбочки',
      note: 'Метка Git: v1.0.4-fullscreen-clean-checkpoint. Мгновенный запуск на весь экран в Telegram без задержек и дёрганья (ранняя инициализация в <head>, viewport-fit=cover, стабильная фиксация 100% высоты). Полностью убрана белая переливающаяся полоска над краской в колбочках. Снимки лидерборда в 23:59 по Киеву. Безлимитные подарки для администратора.',
      tag: 'v1.0.4-fullscreen-clean-checkpoint'
    },
    {
      id: 'colorsort_checkpoint_20261003_001500',
      createdAtTimestamp: 1790975700000,
      kyivFormattedDate: '03.10.2026, 00:15:00 (Киев)',
      title: 'Версия v1.0.3 — Плавная загрузка, чистый экран старта и стабильная работа',
      note: 'Метка Git: v1.0.3-smooth-loading-checkpoint. Устранено дёрганье экрана старта, убрана дублирующая кнопка и пустое место внизу. Оптимизирована нагрузка на телефон (0% лишней нагрузки на CPU/GPU). Снимки лидерборда в 23:59 по Киеву. Безлимитные подарки для администратора.',
      tag: 'v1.0.3-smooth-loading-checkpoint'
    },
    {
      id: 'colorsort_checkpoint_20261002_210400',
      createdAtTimestamp: 1790964240000,
      kyivFormattedDate: '02.10.2026, 21:04:00 (Киев)',
      title: 'Версия v1.0.2 — Рабочая версия панели администратора',
      note: 'Метка Git: v1.0.2-admin-panel-checkpoint. Полностью рабочая панель администратора: плиточный интерфейс, резервные копии, управление уровнями, исследование лидера, кошельки, новости. Очищен лидерборд.',
      tag: 'v1.0.2-admin-panel-checkpoint'
    },
    {
      id: 'colorsort_checkpoint_20261002_184800',
      createdAtTimestamp: 1790956080000,
      kyivFormattedDate: '02.10.2026, 18:48:00 (Киев)',
      title: 'Версия v1.0.1 — Плиточная панель (шахматный порядок)',
      note: 'Метка Git: v1.0.1-tile-grid-checkpoint. Шахматная панель администратора: Резервные копии, Управление, Исследование лидера, Кошелек, Новости. Все функции работают идеально.',
      tag: 'v1.0.1-tile-grid-checkpoint'
    },
    {
      id: 'colorsort_checkpoint_20261002_174000',
      createdAtTimestamp: 1790952000000,
      kyivFormattedDate: '02.10.2026, 17:40:00 (Киев)',
      title: 'Версия v1.0.0 — Стабильная рабочая версия Color Sort',
      note: 'Метка Git: v1.0.0-working-checkpoint. Все уровни, лидерборд, кошельки, бустеры и новости проверены и работают стабильно.',
      tag: 'v1.0.0-working-checkpoint'
    }
  ];

  async function loadAdminCodeBackups() {
    if (adminCodeBackupLoadingSpinner) adminCodeBackupLoadingSpinner.classList.add('hidden');
    if (adminCodeBackupEmptyState) adminCodeBackupEmptyState.classList.add('hidden');

    // 0. Render immediately from local cache or default seeds (0ms delay)
    let initialList = null;
    try {
      const stored = localStorage.getItem('colorsort_code_checkpoints_cache');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) initialList = parsed;
      }
    } catch (e) {}

    if (!initialList || initialList.length === 0) {
      initialList = [...DEFAULT_CODE_CHECKPOINTS];
    }
    renderAdminCodeBackupsList(initialList);

    // 1. Try server API / KVDB in background to synchronize any updates
    let freshBackups = null;
    try {
      const authQuery = getAdminAuthQuery();
      const apiUrl = (NEWS_API_BASE || API_BASE || '') + `/api/admin/code-backups?${authQuery}`;
      const res = await fetch(apiUrl, { headers: getAuthHeaders(), cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && Array.isArray(data.backups) && data.backups.length > 0) {
          freshBackups = data.backups;
        }
      }
    } catch (err) {
      console.warn('[Admin Code Backups] API load notice:', err.message);
    }

    if (!freshBackups) {
      try {
        const kvdbRes = await fetch(`https://kvdb.io/82kzJTUxZwwFNvg7kUSqgM/colorsort_code_checkpoints?_cb=${Date.now()}`, { cache: 'no-store' });
        if (kvdbRes.ok) {
          const kvData = await kvdbRes.json();
          if (Array.isArray(kvData) && kvData.length > 0) {
            freshBackups = kvData;
          }
        }
      } catch (kvErr) {
        console.warn('[Admin Code Backups] KVDB fallback notice:', kvErr.message);
      }
    }

    if (freshBackups && freshBackups.length > 0) {
      try {
        localStorage.setItem('colorsort_code_checkpoints_cache', JSON.stringify(freshBackups));
      } catch (e) {}
      renderAdminCodeBackupsList(freshBackups);
    }
  }

  function renderAdminCodeBackupsList(backups) {
    if (!adminCodeBackupItemsList) return;
    adminCodeBackupItemsList.innerHTML = '';

    backups.forEach((b, idx) => {
      const card = document.createElement('div');
      card.className = 'admin-snapshot-card';
      card.id = `code-backup-item-${b.id}`;
      card.style.borderLeft = idx === 0 ? '3px solid #10b981' : '3px solid #38bdf8';
      card.style.padding = '12px 14px';

      const tagHtml = b.tag ? `
        <span class="admin-snapshot-badge" style="background: rgba(59, 130, 246, 0.2); border: 1px solid rgba(59, 130, 246, 0.4); color: #60a5fa; font-weight: 600;">
          🏷️ ${escapeHtml(b.tag)}
        </span>
      ` : '';

      const noteHtml = b.note ? `
        <div style="font-size: 0.78rem; color: #94a3b8; line-height: 1.35; margin-top: 4px;">
          📝 ${escapeHtml(b.note)}
        </div>
      ` : '';

      card.innerHTML = `
        <div class="admin-snapshot-info" style="flex: 1;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <span style="font-size: 1.1rem;">💾</span>
            <span class="admin-snapshot-datetime" style="color: #67e8f9; font-size: 0.95rem;">${escapeHtml(b.title || 'Контрольная точка')}</span>
          </div>
          <div class="admin-snapshot-meta" style="gap: 6px;">
            <span class="admin-snapshot-badge" style="background: rgba(16, 185, 129, 0.2); border: 1px solid rgba(16, 185, 129, 0.4); color: #34d399; font-weight: 700;">
              🕒 ${escapeHtml(b.kyivFormattedDate || '')}
            </span>
            ${tagHtml}
          </div>
          ${noteHtml}
        </div>
        <div class="admin-snapshot-actions">
          <button type="button" class="btn-snapshot-delete delete-code-backup-btn" data-id="${escapeHtml(b.id)}" data-date="${escapeHtml(b.kyivFormattedDate || '')}" title="Удалить версию">
            🗑️ <span>${t('adminCodeBackupDeleteBtnLabel') || 'Удалить'}</span>
          </button>
        </div>
      `;

      const deleteBtn = card.querySelector('.delete-code-backup-btn');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const targetId = deleteBtn.getAttribute('data-id');
          const targetDate = deleteBtn.getAttribute('data-date') || '';

          const pin = window.prompt(`Введите PIN-код для подтверждения удаления контрольной точки от ${targetDate} (1111):`);
          if (!pin) return;
          if (pin.trim() !== '1111') {
            alert('Неверный PIN-код!');
            return;
          }

          deleteBtn.disabled = true;
          deleteBtn.style.opacity = '0.5';

          let deletedOk = false;
          try {
            const authParams = {
              telegramId: currentUser ? currentUser.telegramId : undefined,
              firstName: currentUser ? currentUser.firstName : undefined,
              username: currentUser ? currentUser.username : undefined
            };
            const apiUrl = (NEWS_API_BASE || API_BASE || '') + '/api/admin/code-backups';
            const initData = getTelegramInitData();
            const res = await fetch(apiUrl, {
              method: 'POST',
              headers: getAuthHeaders(),
              body: JSON.stringify({ action: 'delete', id: targetId, initData, ...authParams })
            });
            if (res.ok) {
              const resData = await res.json();
              if (resData && resData.success) deletedOk = true;
            }
          } catch (delErr) {
            console.warn('[Code Backup Delete] API notice:', delErr.message);
          }

          if (!deletedOk) {
            // Direct KVDB fallback
            try {
              const kvdbGet = await fetch(`https://kvdb.io/82kzJTUxZwwFNvg7kUSqgM/colorsort_code_checkpoints?_cb=${Date.now()}`, { cache: 'no-store' });
              if (kvdbGet.ok) {
                let list = await kvdbGet.json();
                if (Array.isArray(list)) {
                  list = list.filter(item => item.id !== targetId);
                  await fetch('https://kvdb.io/82kzJTUxZwwFNvg7kUSqgM/colorsort_code_checkpoints', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(list)
                  });
                  deletedOk = true;
                }
              }
            } catch (kvErr) {
              console.error('[Code Backup Delete] KVDB fallback error:', kvErr);
            }
          }

          if (deletedOk) {
            await loadAdminCodeBackups();
          } else {
            alert('Не удалось удалить контрольную точку');
            deleteBtn.disabled = false;
            deleteBtn.style.opacity = '1';
          }
        });
      }

      adminCodeBackupItemsList.appendChild(card);
    });
  }

  function formatKyivDateTimeStr(ts) {
    try {
      const d = new Date(ts || Date.now());
      const datePart = d.toLocaleDateString('ru-RU', {
        timeZone: 'Europe/Kyiv',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      const timePart = d.toLocaleTimeString('ru-RU', {
        timeZone: 'Europe/Kyiv',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      return `${datePart}, ${timePart} (Киев)`;
    } catch (e) {
      const d = new Date();
      return `${d.toLocaleDateString()}, ${d.toLocaleTimeString()} (Киев)`;
    }
  }

  function formatKyivCheckpointId(ts) {
    try {
      const now = new Date(ts || Date.now());
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Kyiv',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      const parts = formatter.formatToParts(now);
      const p = (type) => (parts.find(x => x.type === type) || {}).value || '00';
      return `colorsort_checkpoint_${p('year')}${p('month')}${p('day')}_${p('hour')}${p('minute')}${p('second')}`;
    } catch (e) {
      return `colorsort_checkpoint_${Date.now()}`;
    }
  }

  const DEFAULT_SAVE_VERSION_TITLE = 'Версия v1.0.9 — Отправитель подарков, выбор авторства для админа, новый дизайн карточек и мгновенный забор (Киев)';
  const DEFAULT_SAVE_VERSION_TAG = 'v1.0.9-gifts-sender-admin-mode-instant-claim';
  const DEFAULT_SAVE_VERSION_NOTE = 'Метка Git: v1.0.9-gifts-sender-admin-mode-instant-claim. Отображение отправителя у входящих подарков («От: ...»). Панель выбора авторства для администратора («От Alligator» либо «От Color Sort»). Полностью переработана карточка подарка: центрированная иконка сверху, блок описания по центру и широкая кнопка «Забрать» внизу. Устранена задержка при заборе подарков — моментальный отклик и защита от рассинхронизации. Все тесты пройдены.';

  if (adminSaveCurrentVersionBtn) {
    adminSaveCurrentVersionBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (adminSaveVersionTitleInput) adminSaveVersionTitleInput.value = DEFAULT_SAVE_VERSION_TITLE;
      if (adminSaveVersionTagInput) adminSaveVersionTagInput.value = DEFAULT_SAVE_VERSION_TAG;
      if (adminSaveVersionNoteInput) adminSaveVersionNoteInput.value = DEFAULT_SAVE_VERSION_NOTE;
      if (adminSaveVersionConfirmBtn) {
        adminSaveVersionConfirmBtn.disabled = false;
        adminSaveVersionConfirmBtn.innerHTML = '<span>💾</span> <span>Зафиксировать версию</span>';
      }
      if (adminSaveVersionModal) openModal(adminSaveVersionModal);
      if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('light');
    });
  }

  if (adminSaveVersionCloseBtn) {
    adminSaveVersionCloseBtn.addEventListener('click', () => {
      if (adminSaveVersionModal) closeModal(adminSaveVersionModal);
    });
  }

  if (adminSaveVersionCancelBtn) {
    adminSaveVersionCancelBtn.addEventListener('click', () => {
      if (adminSaveVersionModal) closeModal(adminSaveVersionModal);
    });
  }

  if (adminSaveVersionModal) {
    adminSaveVersionModal.addEventListener('click', (e) => {
      if (e.target === adminSaveVersionModal) {
        closeModal(adminSaveVersionModal);
      }
    });
  }

  if (adminSaveVersionConfirmBtn) {
    adminSaveVersionConfirmBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const title = (adminSaveVersionTitleInput ? adminSaveVersionTitleInput.value.trim() : '') || DEFAULT_SAVE_VERSION_TITLE;
      const tag = (adminSaveVersionTagInput ? adminSaveVersionTagInput.value.trim() : '') || DEFAULT_SAVE_VERSION_TAG;
      const note = (adminSaveVersionNoteInput ? adminSaveVersionNoteInput.value.trim() : '') || DEFAULT_SAVE_VERSION_NOTE;

      const now = Date.now();
      const kyivFormattedDate = formatKyivDateTimeStr(now);
      const checkpointId = formatKyivCheckpointId(now);

      const newCheckpoint = {
        id: checkpointId,
        createdAtTimestamp: now,
        kyivFormattedDate: kyivFormattedDate,
        title: title,
        note: note,
        tag: tag
      };

      adminSaveVersionConfirmBtn.disabled = true;
      adminSaveVersionConfirmBtn.innerHTML = '<span class="spinner" style="display:inline-block; width:12px; height:12px; margin-right:4px;"></span> <span>Сохранение...</span>';

      let savedOk = false;

      // 1. Try server API
      try {
        const authParams = {
          telegramId: currentUser ? currentUser.telegramId : undefined,
          firstName: currentUser ? currentUser.firstName : undefined,
          username: currentUser ? currentUser.username : undefined
        };
        const apiUrl = (NEWS_API_BASE || API_BASE || '') + '/api/admin/code-backups';
        const initData = getTelegramInitData();
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ action: 'create', ...newCheckpoint, initData, ...authParams })
        });
        if (res.ok) {
          const resData = await res.json();
          if (resData && resData.success) savedOk = true;
        }
      } catch (err) {
        console.warn('[Code Backup Create] API notice:', err.message);
      }

      // 2. Direct KVDB synchronization
      try {
        const kvdbGet = await fetch(`https://kvdb.io/82kzJTUxZwwFNvg7kUSqgM/colorsort_code_checkpoints?_cb=${Date.now()}`, { cache: 'no-store' });
        let list = [];
        if (kvdbGet.ok) {
          list = await kvdbGet.json();
        }
        if (!Array.isArray(list) || list.length === 0) list = [...DEFAULT_CODE_CHECKPOINTS];
        list = [newCheckpoint, ...list.filter(item => item.id !== newCheckpoint.id)];
        await fetch('https://kvdb.io/82kzJTUxZwwFNvg7kUSqgM/colorsort_code_checkpoints', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(list)
        });
        savedOk = true;
      } catch (kvErr) {
        console.warn('[Code Backup Create] KVDB notice:', kvErr);
      }

      // 3. Update local cache immediately
      try {
        let cached = JSON.parse(localStorage.getItem('colorsort_code_checkpoints_cache') || '[]');
        if (!Array.isArray(cached) || cached.length === 0) cached = [...DEFAULT_CODE_CHECKPOINTS];
        cached = [newCheckpoint, ...cached.filter(item => item.id !== newCheckpoint.id)];
        localStorage.setItem('colorsort_code_checkpoints_cache', JSON.stringify(cached));
        renderAdminCodeBackupsList(cached);
      } catch (e) {}

      if (adminSaveVersionModal) closeModal(adminSaveVersionModal);
      if (adminSaveVersionConfirmBtn) {
        adminSaveVersionConfirmBtn.disabled = false;
        adminSaveVersionConfirmBtn.innerHTML = '<span>💾</span> <span>Зафиксировать версию</span>';
      }

      // Feedback
      if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('success');
      if (window.SoundEngine && window.SoundEngine.SoundEngine) window.SoundEngine.SoundEngine.playComplete();

      showInfoModal('💾', 'Версия зафиксирована!', `Контрольная точка «${title}» успешно сохранена в панели администратора.`);

      await loadAdminCodeBackups();
    });
  }

  // ==========================================
  // ADMIN MAINTENANCE MODE CONTROLLER
  // ==========================================
  let isMaintenanceActive = false;
  let isTogglingMaintenance = false;

  const adminMaintenanceStatusDot = document.getElementById('adminMaintenanceStatusDot');
  const adminMaintenanceStatusText = document.getElementById('adminMaintenanceStatusText');
  const adminMaintenanceRefreshBtn = document.getElementById('adminMaintenanceRefreshBtn');
  const adminMaintenanceToggleBtn = document.getElementById('adminMaintenanceToggleBtn');
  const adminMaintenanceToggleIcon = document.getElementById('adminMaintenanceToggleIcon');
  const adminMaintenanceToggleLabel = document.getElementById('adminMaintenanceToggleLabel');
  const adminMaintenancePreviewBtn = document.getElementById('adminMaintenancePreviewBtn');
  const adminMaintenanceMessageInput = document.getElementById('adminMaintenanceMessageInput');
  const adminMaintenanceResetMsgBtn = document.getElementById('adminMaintenanceResetMsgBtn');
  const adminMaintenanceSaveMsgBtn = document.getElementById('adminMaintenanceSaveMsgBtn');
  const adminMaintenanceFeedbackMsg = document.getElementById('adminMaintenanceFeedbackMsg');
  const maintenancePreviewCloseBtn = document.getElementById('maintenancePreviewCloseBtn');

  const DEFAULT_MAINTENANCE_MSG = 'В настоящее время в игре проводятся плановые технические работы. Доступ временно ограничен.';

  function updateAdminMaintenanceUI(active, message) {
    isMaintenanceActive = !!active;

    if (adminMaintenanceStatusDot) {
      adminMaintenanceStatusDot.style.background = isMaintenanceActive ? '#ef4444' : '#10b981';
      adminMaintenanceStatusDot.style.boxShadow = isMaintenanceActive ? '0 0 10px #ef4444' : '0 0 10px #10b981';
    }

    if (adminMaintenanceStatusText) {
      if (isMaintenanceActive) {
        adminMaintenanceStatusText.textContent = t('adminMaintenanceStatusActive') || '🔴 Тех. работы активны (Вход заблокирован для всех)';
        adminMaintenanceStatusText.style.color = '#f87171';
      } else {
        adminMaintenanceStatusText.textContent = t('adminMaintenanceStatusOpen') || '🟢 Доступ открыт (Все игроки могут играть)';
        adminMaintenanceStatusText.style.color = '#34d399';
      }
    }

    if (adminMaintenanceToggleBtn) {
      if (isMaintenanceActive) {
        adminMaintenanceToggleBtn.style.background = 'linear-gradient(135deg, #059669 0%, #10b981 100%)';
        if (adminMaintenanceToggleIcon) adminMaintenanceToggleIcon.textContent = '✅';
        if (adminMaintenanceToggleLabel) adminMaintenanceToggleLabel.textContent = t('adminMaintenanceToggleDisable') || 'Выключить тех. работы (Открыть доступ всем)';
      } else {
        adminMaintenanceToggleBtn.style.background = 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)';
        if (adminMaintenanceToggleIcon) adminMaintenanceToggleIcon.textContent = '🛑';
        if (adminMaintenanceToggleLabel) adminMaintenanceToggleLabel.textContent = t('adminMaintenanceToggleEnable') || 'Включить тех. работы (Заблокировать вход всем)';
      }
    }

    if (message && adminMaintenanceMessageInput && !adminMaintenanceMessageInput.matches(':focus')) {
      adminMaintenanceMessageInput.value = message;
    }
  }

  async function loadAdminMaintenanceStatus() {
    try {
      if (adminMaintenanceFeedbackMsg) adminMaintenanceFeedbackMsg.classList.add('hidden');
      let active = false;
      let message = DEFAULT_MAINTENANCE_MSG;
      let gotStatus = false;

      const res = await apiCall('/api/admin/maintenance');
      if (res && res.success) {
        active = !!res.active;
        message = res.message || message;
        gotStatus = true;
      }

      // Cross-check with KVDB cloud for 100% reliability
      try {
        const cloudRes = await fetch(`${GLOBAL_CLOUD_BASE}/system_maintenance?_cb=${Date.now()}`);
        if (cloudRes.ok) {
          const cloudData = await cloudRes.json();
          if (cloudData && typeof cloudData === 'object') {
            if (!gotStatus || cloudData.active) {
              active = !!cloudData.active;
              message = cloudData.message || message;
            }
          }
        }
      } catch (e) {}

      updateAdminMaintenanceUI(active, message);
    } catch (e) {
      console.warn('[Admin Maintenance] Status fetch failed:', e);
    }
  }

  async function setAdminMaintenanceMode(newActive, customMsg) {
    if (isTogglingMaintenance) return;

    // Verify / prompt for admin PIN
    const pin = await ensureAdminPin(newActive ? 'включения тех. работ' : 'выключения тех. работ');
    if (!pin) return;

    isTogglingMaintenance = true;
    if (adminMaintenanceToggleBtn) {
      adminMaintenanceToggleBtn.disabled = true;
      adminMaintenanceToggleBtn.style.opacity = '0.7';
    }

    try {
      const msg = customMsg !== undefined ? customMsg : (adminMaintenanceMessageInput ? adminMaintenanceMessageInput.value : '');
      const res = await apiCall('/api/admin/maintenance', 'POST', {
        active: newActive,
        message: msg,
        adminPin: pin
      });

      // Synchronize directly with KVDB cloud storage so ALL players across all servers are blocked immediately
      try {
        await fetch(`${GLOBAL_CLOUD_BASE}/system_maintenance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            active: newActive,
            message: msg,
            updatedAt: Date.now()
          })
        });
      } catch (e) {}

      if (res && res.success) {
        updateAdminMaintenanceUI(res.active, res.message);
        if (adminMaintenanceFeedbackMsg) {
          adminMaintenanceFeedbackMsg.className = 'admin-feedback-msg success';
          adminMaintenanceFeedbackMsg.textContent = res.active 
            ? '⚠️ Технические работы активированы! Вход в игру заблокирован для всех игроков.'
            : '✅ Технические работы выключены! Доступ открыт, игроки могут заходить в игру.';
          adminMaintenanceFeedbackMsg.classList.remove('hidden');
        }
        if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('success');
      } else {
        // Fallback: if server error occurred but KVDB was updated
        updateAdminMaintenanceUI(newActive, msg);
        if (adminMaintenanceFeedbackMsg) {
          adminMaintenanceFeedbackMsg.className = 'admin-feedback-msg success';
          adminMaintenanceFeedbackMsg.textContent = newActive 
            ? '⚠️ Технические работы активированы в облаке! Вход заблокирован для игроков.'
            : '✅ Технические работы выключены в облаке!';
          adminMaintenanceFeedbackMsg.classList.remove('hidden');
        }
      }
    } catch (err) {
      if (adminMaintenanceFeedbackMsg) {
        adminMaintenanceFeedbackMsg.className = 'admin-feedback-msg error';
        adminMaintenanceFeedbackMsg.textContent = '❌ Не удалось изменить статус: ' + (err.message || 'Ошибка сети');
        adminMaintenanceFeedbackMsg.classList.remove('hidden');
      }
      if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('error');
    } finally {
      isTogglingMaintenance = false;
      if (adminMaintenanceToggleBtn) {
        adminMaintenanceToggleBtn.disabled = false;
        adminMaintenanceToggleBtn.style.opacity = '1';
      }
    }
  }

  if (adminMaintenanceToggleBtn) {
    adminMaintenanceToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      setAdminMaintenanceMode(!isMaintenanceActive);
    });
  }

  if (adminMaintenanceRefreshBtn) {
    adminMaintenanceRefreshBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      loadAdminMaintenanceStatus();
      if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('light');
    });
  }

  if (adminMaintenanceSaveMsgBtn) {
    adminMaintenanceSaveMsgBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const newMsg = adminMaintenanceMessageInput ? adminMaintenanceMessageInput.value.trim() : '';
      if (!newMsg) return;
      await setAdminMaintenanceMode(isMaintenanceActive, newMsg);
      if (adminMaintenanceFeedbackMsg) {
        adminMaintenanceFeedbackMsg.className = 'admin-feedback-msg success';
        adminMaintenanceFeedbackMsg.textContent = '✅ Текст сообщения для игроков успешно сохранён!';
        adminMaintenanceFeedbackMsg.classList.remove('hidden');
      }
    });
  }

  if (adminMaintenanceResetMsgBtn) {
    adminMaintenanceResetMsgBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (adminMaintenanceMessageInput) {
        adminMaintenanceMessageInput.value = DEFAULT_MAINTENANCE_MSG;
      }
    });
  }

  if (adminMaintenancePreviewBtn) {
    adminMaintenancePreviewBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const maintScreen = document.getElementById('maintenanceScreen');
      if (maintScreen) {
        const textEl = document.getElementById('maintenanceText');
        if (textEl && adminMaintenanceMessageInput) {
          textEl.textContent = adminMaintenanceMessageInput.value.trim() || DEFAULT_MAINTENANCE_MSG;
        }
        if (maintenancePreviewCloseBtn) {
          maintenancePreviewCloseBtn.classList.remove('hidden');
        }
        maintScreen.style.display = 'flex';
        if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('light');
      }
    });
  }

  if (maintenancePreviewCloseBtn) {
    maintenancePreviewCloseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const maintScreen = document.getElementById('maintenanceScreen');
      if (maintScreen) {
        maintScreen.style.display = 'none';
      }
      maintenancePreviewCloseBtn.classList.add('hidden');
      if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('light');
    });
  }

  function resetAdModalButtons() {
    document.querySelectorAll('#adModal .claim-ad-btn').forEach(btn => {
      btn.textContent = t('claimAdBtn') || '▶ Смотреть рекламу';
      btn.disabled = false;
    });
  }

  const adTabAdsBtn = document.getElementById('adTabAdsBtn');
  const adTabGiftsBtn = document.getElementById('adTabGiftsBtn');
  const adModalAdsContent = document.getElementById('adModalAdsContent');
  const adModalGiftsContent = document.getElementById('adModalGiftsContent');

  function switchAdModalTab(tab) {
    if (tab === 'gifts') {
      if (adTabGiftsBtn) adTabGiftsBtn.classList.add('active');
      if (adTabAdsBtn) adTabAdsBtn.classList.remove('active');
      if (adModalGiftsContent) adModalGiftsContent.classList.remove('hidden');
      if (adModalAdsContent) adModalAdsContent.classList.add('hidden');
      if (adModalTitle) adModalTitle.textContent = t('adTabGiftsHeader') || '🎁 Подарки';
      if (adModalDesc) adModalDesc.textContent = t('adTabGiftsDesc') || 'Получайте и отправляйте полезные подарки другим игрокам';
      if (window.GiftsModule) window.GiftsModule.refresh();
    } else {
      if (adTabAdsBtn) adTabAdsBtn.classList.add('active');
      if (adTabGiftsBtn) adTabGiftsBtn.classList.remove('active');
      if (adModalAdsContent) adModalAdsContent.classList.remove('hidden');
      if (adModalGiftsContent) adModalGiftsContent.classList.add('hidden');
      if (adModalTitle) adModalTitle.textContent = t('adModalTitle') || '🎁 Реклама';
      if (adModalDesc) adModalDesc.textContent = t('adModalDesc') || 'Посмотрите короткие видео и получите бесплатные бонусы';
    }
  }

  if (adTabAdsBtn) {
    adTabAdsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      switchAdModalTab('ads');
    });
  }

  if (adTabGiftsBtn) {
    adTabGiftsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      switchAdModalTab('gifts');
    });
  }

  if (adBonusBtn) {
    adBonusBtn.addEventListener('click', (e) => {
      if (justStartedGame || modalJustClosed) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        return;
      }
      if (adModal) {
        resetAdModalButtons();
        const grid = adModal.querySelector('.ad-options-grid');
        if (grid) grid.scrollTop = 0;

        // If player has pending gifts, open directly on Gifts tab!
        if (window.GiftsModule && window.GiftsModule.hasPendingGifts()) {
          switchAdModalTab('gifts');
        } else {
          switchAdModalTab('ads');
        }

        openModal(adModal);
      }
      if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('light');
    });
  }

  // Intercept any ghost clicks on toolbar during start transition and right after modal close
  const toolbarContainer = document.querySelector('.toolbar');
  if (toolbarContainer) {
    const blockGhostClick = (e) => {
      if (justStartedGame || modalJustClosed) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    toolbarContainer.addEventListener('click', blockGhostClick, true);
    toolbarContainer.addEventListener('touchend', blockGhostClick, true);
    toolbarContainer.addEventListener('pointerup', blockGhostClick, true);
  }

  if (closeAdModalBtn) {
    closeAdModalBtn.addEventListener('click', () => {
      if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('light');
      if (window.SoundEngine && window.SoundEngine.SoundEngine) window.SoundEngine.SoundEngine.playClick();
      if (adModal) {
        closeModal(adModal);
        resetAdModalButtons();
      }
    });
  }

  if (adModal) {
    adModal.addEventListener('click', (e) => {
      if (e.target === adModal) {
        if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('light');
        closeModal(adModal);
        resetAdModalButtons();
      }
    });
  }

  // Ad Claim Buttons
  document.querySelectorAll('.claim-ad-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const card = e.target.closest('.ad-card');
      const rewardType = card ? card.dataset.reward : null;
      if (!rewardType) return;

      btn.disabled = true;
      const originalText = t('claimAdBtn') || '▶ Смотреть рекламу';
      btn.textContent = t('adStarting') || '⏳ Запуск...';

      let success = false;
      try {
        success = await watchRewardedAdForBonus(rewardType);
      } catch (err) {
        console.error('[Ad Error]', err);
      }

      if (success) {
        btn.textContent = t('adClaimed') || '✅ Получено! (+1)';
        setTimeout(() => {
          btn.textContent = t('claimAdBtn') || originalText;
          btn.disabled = false;
        }, 1400);
      } else {
        btn.textContent = originalText;
        btn.disabled = false;
      }
    });
  });

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[m]);
  }

  // 10. Start Screen Handler (Полноэкранная заставка при входе)
  const startScreen = document.getElementById('startScreen');
  const startGameBtn = document.getElementById('startGameBtn');

  if (startGameBtn) {
    let isStarting = false;
    const handleStart = (e) => {
      if (e && e.cancelable) {
        e.preventDefault();
      }
      if (window.__maintenanceBlocked) return;
      // If server & cloud data is still synchronizing, wait for sync to finish
      if (window.__startSyncReady === false) {
        window.__userWantsStart = true;
        return;
      }
      if (isStarting) return;
      isStarting = true;

      justStartedGame = true;
      setTimeout(() => {
        justStartedGame = false;
      }, 250);

      // Immediately disable pointer events on start screen to prevent click delays
      if (startScreen) {
        startScreen.style.pointerEvents = 'none';
        startScreen.classList.add('start-screen-hidden');
        setTimeout(() => {
          startScreen.style.display = 'none';
          if (startScreen.parentNode) {
            startScreen.parentNode.removeChild(startScreen);
          }
        }, 180);
      }

      // Force-hide all modals so nothing pops up over the game
      document.querySelectorAll('.modal-overlay, .ad-video-overlay').forEach(modal => {
        modal.classList.add('hidden');
        modal.style.display = 'none';
      });

      if (window.SoundEngine && window.SoundEngine.SoundEngine) {
        window.SoundEngine.SoundEngine.initAudio();
        window.SoundEngine.SoundEngine.playClick();
      }
      if (window.TelegramApp && window.TelegramApp.TelegramApp) {
        window.TelegramApp.TelegramApp.haptic('medium');
      }

      // Guarantee current level strictly matches maxLevel and currentLevel
      const targetLvl = Math.max(1, Number(currentUser.maxLevel || 1), Number(currentUser.currentLevel || 1));
      currentUser.currentLevel = targetLvl;
      currentUser.maxLevel = Math.max(Number(currentUser.maxLevel || 0), targetLvl);
      currentUser.level = currentUser.maxLevel;

      if (!currentLevelData || currentLevelData.levelNumber !== targetLvl || (engine && engine.currentLevel !== targetLvl)) {
        if (LG && LG.generateLevel) {
          currentLevelData = LG.generateLevel(targetLvl);
          engine.startLevel(currentLevelData);
        }
      }

      // Guarantee game board is populated and fully rendered
      if (renderer && renderer.renderBoard) {
        renderer.renderBoard(engine);
      }
      updateHeaderUI();
    };

    window.__triggerStartGame = handleStart;

    startGameBtn.addEventListener('pointerdown', handleStart);
    startGameBtn.addEventListener('click', handleStart);
    startGameBtn.addEventListener('touchend', handleStart, { passive: true });
    if (startScreen) {
      startScreen.addEventListener('click', (e) => {
        if (!isStarting && e.target === startScreen) handleStart(e);
      });
    }

    if (window.__startDismissed) {
      handleStart();
    }
  }

  const handleAppExitOrHide = () => {
    try {
      if (currentUser && currentUser.telegramId) {
        saveLocalUser();
        const id = String(currentUser.telegramId);
        if (id && !id.startsWith('guest') && !id.startsWith('dev') && /^\d+$/.test(id)) {
          const payload = {
            telegramId: id,
            firstName: currentUser.firstName || 'Игрок',
            username: currentUser.username || '',
            photoUrl: currentUser.photoUrl || '',
            maxLevel: Number(currentUser.maxLevel || 0),
            level: Number(currentUser.maxLevel || 0),
            currentLevel: Number(currentUser.currentLevel || 1),
            stars: Number(currentUser.stars || 0),
            hints: Number(currentUser.hints || 0),
            undos: Number(currentUser.undos || 0),
            reveals: Number(currentUser.reveals || 0),
            extraBottles: Number(currentUser.extraBottles || 0),
            extra_bottles: Number(currentUser.extraBottles || 0),
            ton_balance: Number(currentUser.ton_balance || 0),
            ton_wallet: currentUser.ton_wallet || '',
            ton_wallet_type: currentUser.ton_wallet_type || '',
            ton_deposits_total: Number(currentUser.ton_deposits_total || 0),
            ton_deposits_count: Number(currentUser.ton_deposits_count || 0),
            all_colors_until: Number(currentUser.all_colors_until || 0),
            all_colors_purchased_at: Number(currentUser.all_colors_purchased_at || 0),
            daily_boosters_days_left: Number(currentUser.daily_boosters_days_left || 0),
            dailyBoostersDaysLeft: Number(currentUser.daily_boosters_days_left || 0),
            daily_boosters_last_date: currentUser.daily_boosters_last_date || '',
            dailyBoostersLastDate: currentUser.daily_boosters_last_date || '',
            daily_boosters_purchased_at: Number(currentUser.daily_boosters_purchased_at || 0),
            dailyBoostersPurchasedAt: Number(currentUser.daily_boosters_purchased_at || 0),
            seasonResetAt: Number(localStorage.getItem('color_sort_season_reset_at') || 0),
            purchasesResetAt: Number(currentUser.purchasesResetAt || 0),
            updatedAt: Date.now()
          };
          apiCall('/api/user/sync', 'POST', payload, { keepalive: true }).catch(() => {});
        }
      }
    } catch (e) {}
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      handleAppExitOrHide();
    }
  });
  window.addEventListener('pagehide', handleAppExitOrHide);
  window.addEventListener('beforeunload', handleAppExitOrHide);

}

if (document.body && document.getElementById('gameBoard')) {
  initColorSortApp();
} else if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initColorSortApp);
} else {
  initColorSortApp();
}
