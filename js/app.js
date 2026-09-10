/**
 * Main Application Controller for Color Sort Telegram Mini App
 */
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[App] Initializing Color Sort Game...');

  // 1. Init Telegram
  const TG = window.TelegramApp && window.TelegramApp.TelegramApp ? window.TelegramApp.TelegramApp : null;
  if (TG) TG.initTelegram();
  const userData = TG ? TG.getUserData() : {
    telegramId: 'guest_' + Math.floor(Math.random() * 10000),
    firstName: 'Игрок',
    photoUrl: ''
  };

  // 2. Init Adsgram
  let AdController = null;
  let adsgramBlockId = '47079';

  async function initAdsgram() {
    try {
      const cfg = await apiCall('/api/config');
      if (cfg && cfg.adsgramBlockId) {
        adsgramBlockId = String(cfg.adsgramBlockId).trim();
      }
    } catch (e) {}

    try {
      if (window.Adsgram && adsgramBlockId) {
        AdController = window.Adsgram.init({
          blockId: adsgramBlockId,
          debug: false
        });
        console.log('[Adsgram] Инициализирован с Block ID:', adsgramBlockId);
      } else if (window.Adsgram) {
        console.log('[Adsgram] SDK загружен, ожидается настройка Block ID в .env');
      }
    } catch (e) {
      console.warn('[Adsgram] Ошибка инициализации:', e);
    }
  }

  function playRewardedAdModal() {
    return new Promise((resolve) => {
      const adModalEl = document.getElementById('rewardedVideoModal');
      if (!adModalEl) {
        setTimeout(() => resolve(true), 2500);
        return;
      }

      adModalEl.classList.remove('hidden');
      adModalEl.style.display = 'flex';
      const timerText = document.getElementById('adVideoTimer');
      const progressBar = document.getElementById('adVideoProgress');
      const closeBtn = document.getElementById('adVideoCloseBtn');
      const statusText = document.getElementById('adVideoStatus');

      let secondsLeft = 5;
      if (closeBtn) {
        closeBtn.disabled = true;
        closeBtn.style.opacity = '0.35';
      }
      if (timerText) timerText.textContent = `⏳ ${secondsLeft} сек`;
      if (progressBar) progressBar.style.width = '0%';
      if (statusText) statusText.textContent = 'Пожалуйста, просмотрите рекламу до конца для получения бонуса';

      const interval = setInterval(() => {
        secondsLeft--;
        const pct = Math.round(((5 - Math.max(0, secondsLeft)) / 5) * 100);
        if (progressBar) progressBar.style.width = `${pct}%`;

        if (secondsLeft > 0) {
          if (timerText) timerText.textContent = `⏳ ${secondsLeft} сек`;
        } else {
          clearInterval(interval);
          if (timerText) timerText.textContent = '✅ Награда разблокирована!';
          if (statusText) statusText.textContent = '🎉 Бонус начислен!';
          if (closeBtn) {
            closeBtn.disabled = false;
            closeBtn.style.opacity = '1';
            closeBtn.style.background = 'rgba(16, 185, 129, 0.4)';
          }

          if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('success');
          if (window.SoundEngine && window.SoundEngine.SoundEngine) window.SoundEngine.SoundEngine.playComplete();

          setTimeout(() => {
            adModalEl.classList.add('hidden');
            adModalEl.style.display = 'none';
            resolve(true);
          }, 800);
        }
      }, 1000);

      if (closeBtn) {
        closeBtn.onclick = () => {
          if (secondsLeft > 0) {
            if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('warning');
            alert('Досмотрите видео до конца, чтобы получить бонус!');
          } else {
            clearInterval(interval);
            adModalEl.classList.add('hidden');
            adModalEl.style.display = 'none';
            resolve(true);
          }
        };
      }
    });
  }

  async function showRewardedAd() {
    // 1. Попытка показа через официальный Adsgram SDK (Block ID: 47079)
    if (AdController) {
      try {
        console.log('[Adsgram] Запрос показа рекламы через SDK (Block ID: 47079)...');
        const res = await AdController.show();
        console.log('[Adsgram] Ответ SDK:', res);
        if (res === undefined || res === null || res === true || res.done === true || !res.error) {
          return true;
        }
      } catch (err) {
        console.warn('[Adsgram] SDK ошибка / нет рекламы (Pending review):', err);
      }
    }

    // 2. Полноэкранный плеер Rewarded Video с таймером 5 сек
    console.log('[Ad Player] Показ полноэкранного рекламного видео...');
    return await playRewardedAdModal();
  }

  // --- Translations (i18n) for 5 Languages: RU, UK, EN, DE, LT ---
  const TRANSLATIONS = {
    ru: {
      langName: 'Русский',
      levelLabel: 'Уровень',
      levelDisplayVal: (lvl) => `Уровень ${lvl}`,
      profileHint: '⚙️ Язык',
      profileTitle: '⚙️ Профиль и Язык',
      langSectionTitle: 'Сменить язык',
      restartBtn: 'Сначала',
      undoBtn: 'Отмена',
      hintBtn: 'Подсказка',
      revealBtn: 'Убрать все цвета',
      adBonusBtn: 'Реклама',
      leaderboardTitle: '🏆 Таблица лидеров',
      leaderboardLive: '24/7 LIVE',
      leaderboardLoading: '⏳ Загрузка живых игроков...',
      leaderboardEmptyTitle: 'Рейтинг пока формируется',
      leaderboardEmptyDesc: 'Пройдите уровень через Telegram бота @sortcolors_bot, чтобы стать первым в глобальной таблице!',
      youTag: '(Вы)',
      maxLevelLabel: (lvl) => `Макс. уровень: ${lvl}`,
      levelPrefix: 'Уровень',
      startBadge: '🧪 ГОЛОВОЛОМКА В TELEGRAM',
      startDesc: 'Сортируй жидкости по баночкам и проходи увлекательные уровни!',
      startHint: 'Нажмите, чтобы начать игру',
      winTitle: (lvl) => `Уровень ${lvl} пройден! 🎉`,
      winSubtext: (lvl) => `Все цвета успешно собраны! Переходим к уровню ${lvl}...`,
      nextLevelBtn: 'Следующий уровень 🚀',
      restartTitle: '🔄 Начать заново?',
      restartDesc: 'Весь прогресс на этом уровне будет сброшен.',
      cancelBtn: 'Отмена',
      confirmRestartBtn: 'Рестарт',
      adModalTitle: '🎁 Реклама',
      adModalDesc: 'Посмотрите короткие видео и получите бесплатные бонусы',
      noMovesTitle: 'Нет ходов',
      noMovesDesc: 'Вы ещё не сделали ни одного хода на этом уровне для отмены.',
      noHintDesc: 'Подсказка не найдена на текущем этапе.',
      allColorsVisibleTitle: 'Все цвета видны',
      allColorsVisibleDesc: 'В баночках на этом этапе уже открыты все цвета!',
      extraBottleTitle: '🎉 Успех',
      extraBottleDesc: 'Дополнительная пустая банка добавлена на поле!'
    },
    uk: {
      langName: 'Українська',
      levelLabel: 'Рівень',
      levelDisplayVal: (lvl) => `Рівень ${lvl}`,
      profileHint: '⚙️ Мова',
      profileTitle: '⚙️ Профіль та Мова',
      langSectionTitle: 'Змінити мову',
      restartBtn: 'Спочатку',
      undoBtn: 'Відміна',
      hintBtn: 'Підказка',
      revealBtn: 'Відкрити кольори',
      adBonusBtn: 'Реклама',
      leaderboardTitle: '🏆 Таблиця лідерів',
      leaderboardLive: '24/7 LIVE',
      leaderboardLoading: '⏳ Завантаження гравців...',
      leaderboardEmptyTitle: 'Рейтинг формується',
      leaderboardEmptyDesc: 'Пройдіть рівень через Telegram бота @sortcolors_bot, щоб стати першим у глобальній таблиці!',
      youTag: '(Ви)',
      maxLevelLabel: (lvl) => `Макс. рівень: ${lvl}`,
      levelPrefix: 'Рівень',
      startBadge: '🧪 ГОЛОВОЛОМКА В TELEGRAM',
      startDesc: 'Сортуй рідини по колбочках та проходь захоплюючі рівні!',
      startHint: 'Натисніть, щоб почати гру',
      winTitle: (lvl) => `Рівень ${lvl} пройдено! 🎉`,
      winSubtext: (lvl) => `Всі кольори успішно зібрані! Переходимо до рівня ${lvl}...`,
      nextLevelBtn: 'Наступний рівень 🚀',
      restartTitle: '🔄 Почати заново?',
      restartDesc: 'Весь прогрес на цьому рівні буде скинуто.',
      cancelBtn: 'Скасувати',
      confirmRestartBtn: 'Рестарт',
      adModalTitle: '🎁 Реклама',
      adModalDesc: 'Подивіться коротке відео та отримайте безкоштовні бонуси',
      noMovesTitle: 'Немає ходів',
      noMovesDesc: 'Ви ще не зробили жодного ходу на цьому рівні для скасування.',
      noHintDesc: 'Підказку не знайдено на поточному етапі.',
      allColorsVisibleTitle: 'Всі кольори видно',
      allColorsVisibleDesc: 'У баночках на цьому етапі вже відкриті всі кольори!',
      extraBottleTitle: '🎉 Успіх',
      extraBottleDesc: 'Додаткова порожня колба додана на поле!'
    },
    en: {
      langName: 'English',
      levelLabel: 'Level',
      levelDisplayVal: (lvl) => `Level ${lvl}`,
      profileHint: '⚙️ Lang',
      profileTitle: '⚙️ Profile & Language',
      langSectionTitle: 'Change Language',
      restartBtn: 'Restart',
      undoBtn: 'Undo',
      hintBtn: 'Hint',
      revealBtn: 'Reveal Colors',
      adBonusBtn: 'Rewards',
      leaderboardTitle: '🏆 Leaderboard',
      leaderboardLive: '24/7 LIVE',
      leaderboardLoading: '⏳ Loading live players...',
      leaderboardEmptyTitle: 'Leaderboard is forming',
      leaderboardEmptyDesc: 'Complete a level via Telegram bot @sortcolors_bot to become #1 on the leaderboard!',
      youTag: '(You)',
      maxLevelLabel: (lvl) => `Max Level: ${lvl}`,
      levelPrefix: 'Level',
      startBadge: '🧪 TELEGRAM PUZZLE',
      startDesc: 'Sort colored liquids into jars and solve fun puzzle levels!',
      startHint: 'Tap to start the game',
      winTitle: (lvl) => `Level ${lvl} Completed! 🎉`,
      winSubtext: (lvl) => `All colors sorted! Advancing to Level ${lvl}...`,
      nextLevelBtn: 'Next Level 🚀',
      restartTitle: '🔄 Restart Level?',
      restartDesc: 'All progress on this level will be reset.',
      cancelBtn: 'Cancel',
      confirmRestartBtn: 'Restart',
      adModalTitle: '🎁 Rewards',
      adModalDesc: 'Watch short video ads to claim free boosters',
      noMovesTitle: 'No moves',
      noMovesDesc: 'You have not made any moves on this level to undo yet.',
      noHintDesc: 'No moves found at this stage.',
      allColorsVisibleTitle: 'All colors revealed',
      allColorsVisibleDesc: 'All bottle colors are already revealed on this stage!',
      extraBottleTitle: '🎉 Success',
      extraBottleDesc: 'Extra empty bottle added to the board!'
    },
    de: {
      langName: 'Deutsch',
      levelLabel: 'Stufe',
      levelDisplayVal: (lvl) => `Stufe ${lvl}`,
      profileHint: '⚙️ Sprache',
      profileTitle: '⚙️ Profil & Sprache',
      langSectionTitle: 'Sprache ändern',
      restartBtn: 'Neustart',
      undoBtn: 'Zurück',
      hintBtn: 'Hinweis',
      revealBtn: 'Aufdecken',
      adBonusBtn: 'Boni',
      leaderboardTitle: '🏆 Bestenliste',
      leaderboardLive: '24/7 LIVE',
      leaderboardLoading: '⏳ Lade echte Spieler...',
      leaderboardEmptyTitle: 'Bestenliste formiert sich',
      leaderboardEmptyDesc: 'Beende ein Level über den Telegram Bot @sortcolors_bot, um die Nr. 1 zu werden!',
      youTag: '(Du)',
      maxLevelLabel: (lvl) => `Max. Stufe: ${lvl}`,
      levelPrefix: 'Stufe',
      startBadge: '🧪 TELEGRAM RÄTSEL',
      startDesc: 'Sortiere Flüssigkeiten in Gläser und löse spannende Puzzle-Level!',
      startHint: 'Tippe, um das Spiel zu starten',
      winTitle: (lvl) => `Stufe ${lvl} geschafft! 🎉`,
      winSubtext: (lvl) => `Alle Farben sortiert! Weiter zu Stufe ${lvl}...`,
      nextLevelBtn: 'Nächste Stufe 🚀',
      restartTitle: '🔄 Von vorn beginnen?',
      restartDesc: 'Der Fortschritt in diesem Level wird zurückgesetzt.',
      cancelBtn: 'Abbrechen',
      confirmRestartBtn: 'Neustart',
      adModalTitle: '🎁 Belohnungen',
      adModalDesc: 'Schau kurze Videos an, um kostenlose Boni zu erhalten',
      noMovesTitle: 'Keine Züge',
      noMovesDesc: 'Du hast in diesem Level noch keine Züge gemacht.',
      noHintDesc: 'Keine Züge im aktuellen Zustand gefunden.',
      allColorsVisibleTitle: 'Alle Farben sichtbar',
      allColorsVisibleDesc: 'Alle Farben in den Flaschen sind bereits aufgedeckt!',
      extraBottleTitle: '🎉 Erfolg',
      extraBottleDesc: 'Zusätzliche leere Flasche hinzugefügt!'
    },
    lt: {
      langName: 'Lietuvių',
      levelLabel: 'Lygis',
      levelDisplayVal: (lvl) => `Lygis ${lvl}`,
      profileHint: '⚙️ Kalba',
      profileTitle: '⚙️ Profilis ir Kalba',
      langSectionTitle: 'Pakeisti kalbą',
      restartBtn: 'Iš naujo',
      undoBtn: 'Atšaukti',
      hintBtn: 'Užuomina',
      revealBtn: 'Atskleisti',
      adBonusBtn: 'Premijos',
      leaderboardTitle: '🏆 Lyderių lentelė',
      leaderboardLive: '24/7 LIVE',
      leaderboardLoading: '⏳ Įkeliami žaidėjai...',
      leaderboardEmptyTitle: 'Lentelė formuojama',
      leaderboardEmptyDesc: 'Įveikite lygį per Telegram botą @sortcolors_bot ir tapkite lyderiu!',
      youTag: '(Jūs)',
      maxLevelLabel: (lvl) => `Maks. lygis: ${lvl}`,
      levelPrefix: 'Lygis',
      startBadge: '🧪 TELEGRAM DĖLIONĖ',
      startDesc: 'Rūšiuokite skysčius į buteliukus ir įveikite smagius lygius!',
      startHint: 'Bakstelėkite, kad pradėtumėte',
      winTitle: (lvl) => `Lygis ${lvl} įveiktas! 🎉`,
      winSubtext: (lvl) => `Visos spalvos surūšiuotos! Pereinama į lygį ${lvl}...`,
      nextLevelBtn: 'Kitas lygis 🚀',
      restartTitle: '🔄 Pradėti iš naujo?',
      restartDesc: 'Šio lygio progresas bus nustatytas iš naujo.',
      cancelBtn: 'Atšaukti',
      confirmRestartBtn: 'Iš naujo',
      adModalTitle: '🎁 Premijos',
      adModalDesc: 'Žiūrėkite trumpus vaizdo įrašus ir gaukite nemokamas premijas',
      noMovesTitle: 'Nėra ėjimų',
      noMovesDesc: 'Šiame lygyje dar neatlikote nė vieno ėjimo.',
      noHintDesc: 'Šiame etape ėjimų nerasta.',
      allColorsVisibleTitle: 'Visos spalvos matomos',
      allColorsVisibleDesc: 'Visi buteliukų sluoksniai jau atidengti!',
      extraBottleTitle: '🎉 Pavyko',
      extraBottleDesc: 'Papildomas tuščias buteliukas pridėtas!'
    }
  };

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

  // Toolbar Labels
  const restartBtnLabel = document.getElementById('restartBtnLabel');
  const undoBtnLabel = document.getElementById('undoBtnLabel');
  const hintBtnLabel = document.getElementById('hintBtnLabel');
  const revealBtnLabel = document.getElementById('revealBtnLabel');
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
  const adBonusBtn = document.getElementById('adBonusBtn');
  const leaderboardBtn = document.getElementById('leaderboardBtn');
  const soundToggleBtn = document.getElementById('soundToggleBtn');
  const nextLevelBtn = document.getElementById('nextLevelBtn');

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

  function applyLanguage(lang) {
    if (!TRANSLATIONS[lang]) lang = 'ru';
    currentLang = lang;
    localStorage.setItem('color_sort_lang', lang);

    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === lang);
    });

    if (levelBadgeLabel) levelBadgeLabel.textContent = t('levelLabel');
    if (profileSettingsHint) profileSettingsHint.textContent = t('profileHint');
    if (profileModalTitle) profileModalTitle.textContent = t('profileTitle');
    if (langSectionTitle) langSectionTitle.textContent = t('langSectionTitle');
    if (restartBtnLabel) restartBtnLabel.textContent = t('restartBtn');
    if (undoBtnLabel) undoBtnLabel.textContent = t('undoBtn');
    if (hintBtnLabel) hintBtnLabel.textContent = t('hintBtn');
    if (revealBtnLabel) revealBtnLabel.textContent = t('revealBtn');
    if (adBonusBtnLabel) adBonusBtnLabel.textContent = t('adBonusBtn');

    if (leaderboardModalTitle) leaderboardModalTitle.textContent = t('leaderboardTitle');
    if (leaderboardLiveBadge) leaderboardLiveBadge.textContent = t('leaderboardLive');

    if (startBadge) startBadge.textContent = t('startBadge');
    if (startDesc) startDesc.textContent = t('startDesc');
    if (startHint) startHint.textContent = t('startHint');

    if (restartModalTitle) restartModalTitle.textContent = t('restartTitle');
    if (restartModalDesc) restartModalDesc.textContent = t('restartDesc');
    if (cancelRestartBtn) cancelRestartBtn.textContent = t('cancelBtn');
    if (confirmRestartBtn) confirmRestartBtn.textContent = t('confirmRestartBtn');
    if (adModalTitle) adModalTitle.textContent = t('adModalTitle');
    if (adModalDesc) adModalDesc.textContent = t('adModalDesc');
    if (nextLevelBtn) nextLevelBtn.textContent = t('nextLevelBtn');

    if (profileCardLevel && typeof currentUser !== 'undefined') {
      profileCardLevel.textContent = t('levelDisplayVal', currentUser.currentLevel || 1);
    }
  }

  // 4. App state
  let currentUser = {
    telegramId: userData.telegramId,
    firstName: userData.firstName,
    maxLevel: 1,
    currentLevel: 1,
    stars: 0,
    coins: 100,
    hints: 0,
    undos: 0,
    reveals: 0
  };
  let currentLevelData = null;
  let justStartedGame = false;
  const engine = window.GameEngine.Engine || window.GameEngine;
  const renderer = (window.GameRenderer && window.GameRenderer.GameRenderer) ? window.GameRenderer.GameRenderer : window.GameRenderer;

  // Universal Modal Helpers
  function openModal(el) {
    if (!el) return;
    el.classList.remove('hidden');
    el.style.display = 'flex';
  }

  function closeModal(el) {
    if (!el) return;
    el.classList.add('hidden');
    el.style.display = 'none';
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

  // Server Communication & 24/7 Global Cloud Database
  const GLOBAL_CLOUD_BUCKET = '82kzJTUxZwwFNvg7kUSqgM';
  const GLOBAL_CLOUD_BASE = 'https://kvdb.io/' + GLOBAL_CLOUD_BUCKET;
  const API_BASE = (typeof window !== 'undefined' && window.COLOR_SORT_API_URL)
    ? window.COLOR_SORT_API_URL
    : '';

  async function syncPlayerToCloud(user) {
    if (!user || !user.telegramId) return;
    const id = String(user.telegramId);
    const isRealTelegramUser = !id.startsWith('guest') && !id.startsWith('dev') && /^\d+$/.test(id);

    // 1. Send live signal to single global 24/7 cloud database
    if (isRealTelegramUser) {
      try {
        const payload = {
          telegramId: id,
          firstName: user.firstName || 'Игрок',
          username: user.username || '',
          photoUrl: user.photoUrl || '',
          maxLevel: Number(user.maxLevel || user.currentLevel || 1),
          level: Number(user.maxLevel || user.currentLevel || 1),
          stars: Number(user.stars || 0),
          updatedAt: Date.now()
        };
        fetch(`${GLOBAL_CLOUD_BASE}/player_${id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).catch(err => console.warn('[Cloud DB Sync]', err));
      } catch (e) {}
    }

    // 2. Also send to Express API if available
    apiCall('/api/user/sync', 'POST', {
      telegramId: user.telegramId,
      firstName: user.firstName,
      username: user.username,
      photoUrl: user.photoUrl,
      currentLevel: user.currentLevel,
      maxLevel: user.maxLevel,
      starsAdded: 0,
      coinsAdded: 0
    }).catch(() => {});
  }

  async function apiCall(endpoint, method = 'GET', body = null) {
    if (!API_BASE && typeof window !== 'undefined' && window.location.hostname.includes('github.io')) {
      return null;
    }
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const options = { 
        method, 
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal
      };
      if (body) options.body = JSON.stringify(body);
      
      const tg = window.Telegram && window.Telegram.WebApp;
      if (tg && tg.initData) {
        options.headers['x-telegram-init-data'] = tg.initData;
      }
      
      const res = await fetch(API_BASE + endpoint, options);
      clearTimeout(timeoutId);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  // LocalStorage helper
  function saveLocalUser() {
    localStorage.setItem(`color_sort_user_${currentUser.telegramId}`, JSON.stringify(currentUser));
  }
  function loadLocalUser() {
    const data = localStorage.getItem(`color_sort_user_${currentUser.telegramId}`);
    if (data) {
      try {
        const parsed = JSON.parse(data);
        currentUser = { ...currentUser, ...parsed };
      } catch (e) {}
    }
    const migrated = localStorage.getItem('cs_zero_boosters_v5');
    if (!migrated) {
      currentUser.hints = 0;
      currentUser.undos = 0;
      currentUser.reveals = 0;
      localStorage.setItem('cs_zero_boosters_v5', 'true');
      saveLocalUser();
    }
  }

  // 5. Init renderer
  if (renderer && typeof renderer.initRenderer === 'function') {
    renderer.initRenderer(gameBoard, particleCanvas);
  }

  // 6. Fetch user from server
  loadLocalUser(); // Load from local first as baseline
  applyLanguage(currentLang);
  if (userName) userName.textContent = currentUser.firstName;
  if (userAvatar) {
    userAvatar.src = userData.photoUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(userData.telegramId)}`;
  }

  const serverUser = await apiCall('/api/user/init', 'POST', userData);
  if (serverUser && serverUser.success && serverUser.user) {
    currentUser = { ...currentUser, ...serverUser.user };
  }
  saveLocalUser();
  syncPlayerToCloud(currentUser);
  updateHeaderUI();
  await initAdsgram();

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
  let winAutoAdvanceTimer = null;

  async function advanceToNextLevel() {
    if (isNextLevelLoading) return;
    isNextLevelLoading = true;
    if (winAutoAdvanceTimer) {
      clearTimeout(winAutoAdvanceTimer);
      winAutoAdvanceTimer = null;
    }
    closeModal(winModal);
    await loadCurrentLevel();
    isNextLevelLoading = false;
  }

  engine.onWin = ({ levelNumber, moves }) => {
    if (renderer && renderer.triggerWinConfetti) renderer.triggerWinConfetti();
    
    // Simple victory progression: advance level without coins, stars, or experience
    currentUser.currentLevel = levelNumber + 1;
    currentUser.maxLevel = Math.max(currentUser.maxLevel, currentUser.currentLevel);
    
    saveLocalUser();

    // Update win modal message
    const winTitle = document.getElementById('winModalTitle');
    const winSubtext = document.getElementById('winModalSubtext');
    if (winTitle) winTitle.textContent = t('winTitle', levelNumber);
    if (winSubtext) winSubtext.textContent = t('winSubtext', currentUser.currentLevel);

    // Мгновенная отправка сигнала на глобальный единственный сервер (24/7 Cloud DB + API)
    syncPlayerToCloud(currentUser);

    // Show victory modal
    setTimeout(() => {
      openModal(winModal);
      if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('success');
    }, 450);

    // Auto-advance safeguard after 3.2s so player is never stuck
    if (winAutoAdvanceTimer) clearTimeout(winAutoAdvanceTimer);
    winAutoAdvanceTimer = setTimeout(() => {
      advanceToNextLevel();
    }, 3200);
  };

  // 8. Load level
  const LG = (window.LevelGenerator && window.LevelGenerator.LevelGenerator) ? window.LevelGenerator.LevelGenerator : window.LevelGenerator;

  async function loadCurrentLevel() {
    if (levelDisplay) levelDisplay.textContent = currentUser.currentLevel;
    if (LG && LG.generateLevel) {
      currentLevelData = LG.generateLevel(currentUser.currentLevel);
      engine.startLevel(currentLevelData);

      // Explicitly render board to guarantee DOM is populated immediately
      if (renderer && renderer.renderBoard) {
        renderer.renderBoard(engine);
      }

      updateHeaderUI();
    }
  }
  await loadCurrentLevel();

  function updateHeaderUI() {
    if (levelBadgeLabel) levelBadgeLabel.textContent = t('levelLabel');
    if (levelDisplay) levelDisplay.textContent = currentUser.currentLevel || 1;
    if (profileCardLevel) profileCardLevel.textContent = t('levelDisplayVal', currentUser.currentLevel || 1);
    if (coinsDisplay) coinsDisplay.textContent = currentUser.coins || 0;
    if (hintsCountDisplay) hintsCountDisplay.textContent = currentUser.hints || 0;
    if (undosCountDisplay) undosCountDisplay.textContent = currentUser.undos || 0;
    const movesDisplay = document.getElementById('movesDisplay');
    if (movesDisplay) movesDisplay.textContent = engine.movesCount || 0;

    // Badges on buttons in toolbar
    const undoBadge = document.getElementById('undoBadge');
    if (undoBadge) {
      const uCount = currentUser.undos || 0;
      undoBadge.textContent = uCount;
      undoBadge.classList.toggle('badge-zero', uCount === 0);
      undoBadge.classList.remove('pulse');
      void undoBadge.offsetWidth;
      undoBadge.classList.add('pulse');
    }

    const hintBadge = document.getElementById('hintBadge');
    if (hintBadge) {
      const hCount = currentUser.hints || 0;
      hintBadge.textContent = hCount;
      hintBadge.classList.toggle('badge-zero', hCount === 0);
      hintBadge.classList.remove('pulse');
      void hintBadge.offsetWidth;
      hintBadge.classList.add('pulse');
    }

    const revealBadge = document.getElementById('revealBadge');
    if (revealBadge) {
      const rCount = currentUser.reveals || 0;
      revealBadge.textContent = rCount;
      revealBadge.classList.toggle('badge-zero', rCount === 0);
      revealBadge.classList.remove('pulse');
      void revealBadge.offsetWidth;
      revealBadge.classList.add('pulse');
    }

    // Modal user counters
    const adModalHintsCount = document.getElementById('adModalHintsCount');
    if (adModalHintsCount) {
      adModalHintsCount.textContent = `(у вас: ${currentUser.hints || 0})`;
    }
    const adModalUndosCount = document.getElementById('adModalUndosCount');
    if (adModalUndosCount) {
      adModalUndosCount.textContent = `(у вас: ${currentUser.undos || 0})`;
    }
    const adModalRevealsCount = document.getElementById('adModalRevealsCount');
    if (adModalRevealsCount) {
      adModalRevealsCount.textContent = `(у вас: ${currentUser.reveals || 0})`;
    }
  }

  // 9. Bind button events
  if (restartBtn) {
    restartBtn.addEventListener('click', (e) => {
      if (justStartedGame) {
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

  if (undoBtn) {
    undoBtn.addEventListener('click', async (e) => {
      if (justStartedGame) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        return;
      }
      if (!engine.history || engine.history.length === 0) {
        showInfoModal('↩️', 'Нет ходов', 'Вы ещё не сделали ни одного хода на этом уровне для отмены.');
        return;
      }

      if (currentUser.undos <= 0) {
        showInfoModal(
          '↩️',
          'Отмена хода',
          'У вас 0 отмен хода. Посмотрите короткую рекламу, чтобы получить отмену хода!',
          '▶ Смотреть рекламу (+1)',
          async () => {
            const adWatched = await showRewardedAd();
            if (adWatched) {
              const data = await apiCall('/api/ad-reward', 'POST', {
                telegramId: currentUser.telegramId,
                rewardType: 'undos'
              });
              if (data && data.success && data.user) {
                currentUser = { ...currentUser, ...data.user };
              } else {
                currentUser.undos = (currentUser.undos || 0) + 1;
              }
              const success = engine.undo();
              if (success) {
                currentUser.undos = Math.max(0, (currentUser.undos || 0) - 1);
                if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('medium');
                await apiCall('/api/user/sync', 'POST', {
                  telegramId: currentUser.telegramId,
                  undosUsed: 1
                });
              }
              saveLocalUser();
              updateHeaderUI();
            }
          }
        );
        return;
      }

      const success = engine.undo();
      if (success) {
        currentUser.undos = Math.max(0, (currentUser.undos || 0) - 1);
        updateHeaderUI();
        saveLocalUser();
        if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('medium');
        await apiCall('/api/user/sync', 'POST', {
          telegramId: currentUser.telegramId,
          undosUsed: 1
        });
      }
    });
  }

  if (hintBtn) {
    hintBtn.addEventListener('click', async (e) => {
      if (justStartedGame) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        return;
      }
      if (currentUser.hints <= 0) {
        showInfoModal(
          '💡',
          'Подсказка',
          'У вас 0 подсказок. Посмотрите короткую рекламу, чтобы получить подсказку хода!',
          '▶ Смотреть рекламу (+1)',
          async () => {
            const adWatched = await showRewardedAd();
            if (adWatched) {
              const data = await apiCall('/api/ad-reward', 'POST', {
                telegramId: currentUser.telegramId,
                rewardType: 'hints'
              });
              if (data && data.success && data.user) {
                currentUser = { ...currentUser, ...data.user };
              } else {
                currentUser.hints = (currentUser.hints || 0) + 1;
              }
              const hint = engine.getHint();
              if (hint) {
                currentUser.hints = Math.max(0, (currentUser.hints || 0) - 1);
                if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('medium');
                await apiCall('/api/user/sync', 'POST', {
                  telegramId: currentUser.telegramId,
                  hintsUsed: 1
                });
              }
              saveLocalUser();
              updateHeaderUI();
            }
          }
        );
        return;
      }

      const hint = engine.getHint();
      if (hint) {
        currentUser.hints = Math.max(0, (currentUser.hints || 0) - 1);
        updateHeaderUI();
        saveLocalUser();
        if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('medium');
        await apiCall('/api/user/sync', 'POST', {
          telegramId: currentUser.telegramId,
          hintsUsed: 1
        });
      } else {
        showInfoModal('🤷', 'Нет ходов', 'Подсказка не найдена на текущем этапе.');
      }
    });
  }

  if (revealBottleBtn) {
    revealBottleBtn.addEventListener('click', async (e) => {
      if (justStartedGame) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        return;
      }
      if (!engine.hasHiddenColors()) {
        showInfoModal('🧪', 'Все цвета видны', 'В баночках на этом этапе уже открыты все цвета!');
        return;
      }

      if (currentUser.reveals <= 0) {
        showInfoModal(
          '🧪',
          'Убрать все цвета',
          'У вас 0 открытий. Посмотрите короткую рекламу, чтобы открыть все цвета в одной случайной баночке!',
          '▶ Смотреть рекламу (+1)',
          async () => {
            const adWatched = await showRewardedAd();
            if (adWatched) {
              const data = await apiCall('/api/ad-reward', 'POST', {
                telegramId: currentUser.telegramId,
                rewardType: 'reveal_bottle'
              });
              if (data && data.success && data.user) {
                currentUser = { ...currentUser, ...data.user };
              } else {
                currentUser.reveals = (currentUser.reveals || 0) + 1;
              }
              const res = engine.revealRandomBottle();
              if (res) {
                currentUser.reveals = Math.max(0, (currentUser.reveals || 0) - 1);
                if (renderer && renderer.highlightBottleReveal) renderer.highlightBottleReveal(res.bottleIndex);
                if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('success');
                if (window.SoundEngine && window.SoundEngine.SoundEngine) window.SoundEngine.SoundEngine.playComplete();
                await apiCall('/api/user/sync', 'POST', {
                  telegramId: currentUser.telegramId,
                  revealsUsed: 1
                });
              }
              saveLocalUser();
              updateHeaderUI();
            }
          }
        );
        return;
      }

      const res = engine.revealRandomBottle();
      if (res) {
        currentUser.reveals = Math.max(0, (currentUser.reveals || 0) - 1);
        if (renderer && renderer.highlightBottleReveal) renderer.highlightBottleReveal(res.bottleIndex);
        if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('success');
        if (window.SoundEngine && window.SoundEngine.SoundEngine) window.SoundEngine.SoundEngine.playComplete();
        updateHeaderUI();
        saveLocalUser();
        await apiCall('/api/user/sync', 'POST', {
          telegramId: currentUser.telegramId,
          revealsUsed: 1
        });
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
      // Tapping anywhere on the win modal backdrop or card advances to the next level
      advanceToNextLevel();
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

    // 1. Fetch from single global 24/7 cloud database (never sleeps, works with PC off)
    try {
      const cloudRes = await fetch(`${GLOBAL_CLOUD_BASE}/?prefix=player_&values=true&format=json`, {
        signal: AbortSignal.timeout(3500)
      });
      if (cloudRes.ok) {
        const pairs = await cloudRes.json();
        if (Array.isArray(pairs)) {
          players = pairs
            .map(([k, p]) => p)
            .filter(p => p && p.telegramId && !String(p.telegramId).startsWith('guest') && !String(p.telegramId).startsWith('dev') && /^\d+$/.test(String(p.telegramId)));
        }
      }
    } catch (e) {
      console.warn('[Leaderboard] Cloud DB fetch notice:', e.message);
    }

    // 2. Also try Express API if available
    try {
      const serverData = await apiCall(`/api/leaderboard?telegramId=${encodeURIComponent(currentUser.telegramId)}`);
      if (serverData && serverData.success && Array.isArray(serverData.topPlayers)) {
        serverData.topPlayers.forEach(sp => {
          if (!players.some(p => String(p.telegramId) === String(sp.telegram_id))) {
            players.push({
              telegramId: sp.telegram_id,
              firstName: sp.first_name,
              username: sp.username,
              photoUrl: sp.photo_url,
              maxLevel: sp.max_level,
              level: sp.max_level,
              stars: sp.stars || 0
            });
          }
        });
      }
    } catch (e) {}

    // 3. Ensure current user is included if they are a real Telegram player
    if (isRealUser) {
      const selfIndex = players.findIndex(p => String(p.telegramId) === String(currentUser.telegramId));
      const currentMaxLvl = Math.max(currentUser.maxLevel || 1, currentUser.currentLevel || 1);
      if (selfIndex === -1) {
        players.push({
          telegramId: String(currentUser.telegramId),
          firstName: currentUser.firstName || 'Игрок',
          username: currentUser.username || '',
          photoUrl: currentUser.photoUrl || '',
          maxLevel: currentMaxLvl,
          level: currentMaxLvl,
          stars: currentUser.stars || 0
        });
      } else if (currentMaxLvl > (players[selfIndex].maxLevel || players[selfIndex].level || 1)) {
        players[selfIndex].maxLevel = currentMaxLvl;
        players[selfIndex].level = currentMaxLvl;
      }
    }

    // 4. Strict filter: NO BOTS, ONLY REAL PLAYERS, UNIQUE BY TELEGRAM ID
    const uniqueMap = new Map();
    players.forEach(p => {
      const id = String(p.telegramId);
      if (!id || id.startsWith('guest') || id.startsWith('dev') || !/^\d+$/.test(id)) return;
      const lvl = Number(p.maxLevel || p.level || 1);
      const existing = uniqueMap.get(id);
      if (!existing || lvl > (existing.maxLevel || existing.level || 1)) {
        uniqueMap.set(id, {
          ...p,
          telegramId: id,
          firstName: p.firstName || (existing ? existing.firstName : 'Игрок'),
          maxLevel: lvl,
          level: lvl
        });
      }
    });

    const sortedPlayers = Array.from(uniqueMap.values()).sort((a, b) => {
      const diff = (b.maxLevel || b.level || 1) - (a.maxLevel || a.level || 1);
      if (diff !== 0) return diff;
      return (b.stars || 0) - (a.stars || 0);
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
      sortedPlayers.forEach((player, idx) => {
        const rank = idx + 1;
        const li = document.createElement('li');
        const isSelf = isRealUser && String(player.telegramId) === String(currentUser.telegramId);
        li.className = `leaderboard-item ${rank <= 3 ? 'top-' + rank : ''} ${isSelf ? 'is-self' : ''}`;
        
        const crown = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
        const nameDisplay = isSelf 
          ? `${escapeHtml(player.firstName || 'Игрок')} <span class="self-tag">${t('youTag')}</span>` 
          : escapeHtml(player.firstName || 'Игрок');
        const levelDisplayVal = player.maxLevel || player.level || 1;

        li.innerHTML = `
          <div class="player-meta">
            <span class="rank-num">${crown}</span>
            <div class="player-info-cell">
              <strong>${nameDisplay}</strong>
              ${player.username ? `<small class="player-handle">@${escapeHtml(player.username)}</small>` : ''}
            </div>
          </div>
          <span class="user-rank">${t('levelPrefix')} ${levelDisplayVal}</span>
        `;
        leaderboardList.appendChild(li);
      });
    }

    // 6. Update user's personal banner
    const myRankIdx = sortedPlayers.findIndex(p => String(p.telegramId) === String(currentUser.telegramId));
    if (myRankIdx !== -1) {
      const myRankNum = myRankIdx + 1;
      const myCrown = myRankNum === 1 ? '🥇' : myRankNum === 2 ? '🥈' : myRankNum === 3 ? '🥉' : `#${myRankNum}`;
      if (modalUserPos) modalUserPos.textContent = myCrown;
      if (modalUserName) modalUserName.textContent = `${currentUser.firstName || 'Вы'} ${t('youTag')}`;
      if (modalUserLevel) modalUserLevel.textContent = t('maxLevelLabel', sortedPlayers[myRankIdx].maxLevel || currentUser.maxLevel);
      if (userRank) userRank.textContent = `#${myRankNum}`;
    } else if (isRealUser) {
      if (modalUserPos) modalUserPos.textContent = '#—';
      if (modalUserName) modalUserName.textContent = `${currentUser.firstName || 'Вы'} ${t('youTag')}`;
      if (modalUserLevel) modalUserLevel.textContent = `${t('levelPrefix')}: ${currentUser.maxLevel || 1}`;
    } else {
      if (modalUserPos) modalUserPos.textContent = '—';
      if (modalUserName) modalUserName.textContent = 'Guest';
      if (modalUserLevel) modalUserLevel.textContent = '@sortcolors_bot';
    }
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

  // Profile & Language Modal Event Listeners
  if (userProfileBtn) {
    userProfileBtn.addEventListener('click', () => {
      if (profileCardAvatar && userAvatar) {
        profileCardAvatar.src = userAvatar.src;
      }
      if (profileCardName) {
        profileCardName.textContent = currentUser.firstName || 'Игрок';
      }
      if (profileCardLevel) {
        profileCardLevel.textContent = t('levelDisplayVal', currentUser.currentLevel || 1);
      }
      if (profileModal) openModal(profileModal);
      if (window.TelegramApp && window.TelegramApp.TelegramApp) {
        window.TelegramApp.TelegramApp.haptic('light');
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

  if (adBonusBtn) {
    adBonusBtn.addEventListener('click', (e) => {
      if (justStartedGame) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        return;
      }
      if (adModal) {
        openModal(adModal);
      }
      if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('light');
    });
  }

  // Intercept any ghost clicks on toolbar during start transition
  const toolbarContainer = document.querySelector('.toolbar');
  if (toolbarContainer) {
    const blockGhostClick = (e) => {
      if (justStartedGame) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    toolbarContainer.addEventListener('click', blockGhostClick, true);
    toolbarContainer.addEventListener('touchend', blockGhostClick, true);
  }

  if (closeAdModalBtn) {
    closeAdModalBtn.addEventListener('click', () => {
      if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('light');
      if (window.SoundEngine && window.SoundEngine.SoundEngine) window.SoundEngine.SoundEngine.playClick();
      if (adModal) closeModal(adModal);
    });
  }

  if (adModal) {
    adModal.addEventListener('click', (e) => {
      if (e.target === adModal) {
        if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('light');
        closeModal(adModal);
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
      const originalText = '▶ Смотреть рекламу';
      btn.textContent = '⏳ Запуск...';

      let adWatched = false;
      try {
        adWatched = await showRewardedAd();
      } catch (err) {
        console.error('[Ad Error]', err);
      }

      if (adWatched) {
        const data = await apiCall('/api/ad-reward', 'POST', {
          telegramId: currentUser.telegramId,
          rewardType
        });

        if (data && data.success && data.user) {
          currentUser = { ...currentUser, ...data.user };
        } else {
          // Offline fallback
          if (rewardType === 'hints') currentUser.hints = (currentUser.hints || 0) + 1;
          else if (rewardType === 'undos') currentUser.undos = (currentUser.undos || 0) + 1;
          else if (rewardType === 'reveal_bottle' || rewardType === 'reveals') currentUser.reveals = (currentUser.reveals || 0) + 1;
        }

        saveLocalUser();
        updateHeaderUI();

        if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('success');

        if (rewardType === 'extra_bottle') {
          engine.addExtraBottle();
          if (adModal) closeModal(adModal);
          showInfoModal('🎉', 'Успех', 'Дополнительная пустая банка добавлена на поле!');
        } else {
          btn.textContent = '✅ Получено! (+1)';
          setTimeout(() => {
            btn.textContent = originalText;
            btn.disabled = false;
          }, 1400);
          return;
        }
      } else {
        btn.textContent = originalText;
      }

      btn.disabled = false;
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
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (isStarting) return;
      isStarting = true;

      justStartedGame = true;
      setTimeout(() => {
        justStartedGame = false;
      }, 1500);

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

      if (startScreen) {
        startScreen.classList.add('start-screen-hidden');
        setTimeout(() => {
          startScreen.style.display = 'none';
          if (startScreen.parentNode) {
            startScreen.parentNode.removeChild(startScreen);
          }
        }, 450);
      }

      // Guarantee game board is populated and fully rendered
      if (renderer && renderer.renderBoard) {
        renderer.renderBoard(engine);
      }
      updateHeaderUI();
    };

    startGameBtn.addEventListener('click', handleStart);
    startGameBtn.addEventListener('touchend', handleStart, { passive: false });
  }

});

