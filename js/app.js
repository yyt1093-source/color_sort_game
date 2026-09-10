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
      extraBottleDesc: 'Дополнительная пустая банка добавлена на поле!',
      claimAdBtn: '▶ Смотреть рекламу',
      adStarting: '⏳ Запуск...',
      adClaimed: '✅ Получено! (+1)',
      adminBadge: '👑 Админ',
      adminBoostersTitle: '⚡ Бесплатные функции (Без рекламы):',
      adminAddBottle: '+1 Банка на поле',
      adminAddHints: '+5 Подсказок',
      adminAddUndos: '+5 Отмен хода',
      adminAddReveals: '+5 Открытий',
      adminAddAll: 'Пополнить ВСЁ сразу (+10 ко всем бонусам)',
      adminBottleAddedMsg: '🧪 Пустая банка добавлена на поле!',
      adminHintsAddedMsg: (count) => `💡 +5 Подсказок добавлено (Всего: ${count})`,
      adminUndosAddedMsg: (count) => `↩️ +5 Отмен хода добавлено (Всего: ${count})`,
      adminRevealsAddedMsg: (count) => `🔮 +5 Открытий добавлено (Всего: ${count})`,
      adminAllAddedMsg: '⚡ Все функции пополнены (+10) и банка добавлена!',
      adminResetSuccessTitle: '💥 Сезон сброшен!',
      adminResetSuccessDesc: 'Все данные игроков, уровни, достижения и глобальный лидерборд сброшены под ноль!',
      donateBtnLabel: 'Донат',
      donateModalTitle: '💎 Поддержка игры',
      donateModalDesc: 'Подключите TON кошелек и поддержите разработку игры!',
      walletConnected: 'Кошелек подключен',
      walletNotConnected: 'Кошелек не подключен',
      connectWalletBtn: 'Подключить',
      disconnectWalletBtn: 'Отключить',
      donateChooseAmount: 'Выберите сумму доната',
      donateCustomAmount: 'Своя сумма (TON):',
      sendDonateBtn: (amount) => `Поддержать на ${amount} TON`,
      connectToSendBtn: 'Подключить кошелек для доната',
      donateManualTitle: 'Прямой перевод по адресу кошелька:',
      copyAddrBtn: 'Копировать',
      copyAddrSuccess: '✅ Скопировано!',
      donateSuccess: '🎉 Огромное спасибо за поддержку игры! 💖',
      donateCancel: 'Транзакция отменена.',
      donateError: 'Ошибка при отправке доната. Попробуйте еще раз.'
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
      extraBottleDesc: 'Додаткова порожня колба додана на поле!',
      claimAdBtn: '▶ Дивитися рекламу',
      adStarting: '⏳ Запуск...',
      adClaimed: '✅ Отримано! (+1)',
      adminBadge: '👑 Адмін',
      adminBoostersTitle: '⚡ Безкоштовні функції (Без реклами):',
      adminAddBottle: '+1 Колба на полі',
      adminAddHints: '+5 Підказок',
      adminAddUndos: '+5 Відмін ходу',
      adminAddReveals: '+5 Відкриттів',
      adminAddAll: 'Поповнити ВСЕ одразу (+10 до всіх бонусів)',
      adminBottleAddedMsg: '🧪 Порожня колба додана на поле!',
      adminHintsAddedMsg: (count) => `💡 +5 Підказок додано (Всього: ${count})`,
      adminUndosAddedMsg: (count) => `↩️ +5 Відмін ходу додано (Всього: ${count})`,
      adminRevealsAddedMsg: (count) => `🔮 +5 Відкриттів додано (Всього: ${count})`,
      adminAllAddedMsg: '⚡ Всі функції поповнено (+10) та колба на полі!',
      adminResetSuccessTitle: '💥 Сезон скинуто!',
      adminResetSuccessDesc: 'Всі данные гравців, рівні, досягнення та глобальний лідерборд скинуті під нуль!',
      donateBtnLabel: 'Донат',
      donateModalTitle: '💎 Підтримка гри',
      donateModalDesc: 'Підключіть TON гаманець та підтримайте розробку гри!',
      walletConnected: 'Гаманець підключено',
      walletNotConnected: 'Гаманець не підключено',
      connectWalletBtn: 'Підключити',
      disconnectWalletBtn: 'Відключити',
      donateChooseAmount: 'Оберіть суму донату',
      donateCustomAmount: 'Своя сума (TON):',
      sendDonateBtn: (amount) => `Підтримати на ${amount} TON`,
      connectToSendBtn: 'Підключити гаманець для донату',
      donateManualTitle: 'Прямий переказ за адресою гаманця:',
      copyAddrBtn: 'Копіювати',
      copyAddrSuccess: '✅ Скопійовано!',
      donateSuccess: '🎉 Величезне дякуємо за підтримку гри! 💖',
      donateCancel: 'Транзакцію скасовано.',
      donateError: 'Помилка при відправці донату. Спробуйте ще раз.'
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
      extraBottleDesc: 'Extra empty bottle added to the board!',
      claimAdBtn: '▶ Watch Ad',
      adStarting: '⏳ Starting...',
      adClaimed: '✅ Received! (+1)',
      adminBadge: '👑 Admin',
      adminBoostersTitle: '⚡ Free Admin Perks (No Ads):',
      adminAddBottle: '+1 Bottle on Board',
      adminAddHints: '+5 Hints',
      adminAddUndos: '+5 Undos',
      adminAddReveals: '+5 Color Reveals',
      adminAddAll: 'Replenish ALL (+10 to all boosters)',
      adminBottleAddedMsg: '🧪 Empty bottle added to the board!',
      adminHintsAddedMsg: (count) => `💡 +5 Hints added (Total: ${count})`,
      adminUndosAddedMsg: (count) => `↩️ +5 Undos added (Total: ${count})`,
      adminRevealsAddedMsg: (count) => `🔮 +5 Reveals added (Total: ${count})`,
      adminAllAddedMsg: '⚡ All boosters replenished (+10) and bottle added!',
      adminResetSuccessTitle: '💥 Season Reset!',
      adminResetSuccessDesc: 'All player data, levels, achievements, and the global leaderboard have been wiped to zero!',
      donateBtnLabel: 'Donate',
      donateModalTitle: '💎 Support the Game',
      donateModalDesc: 'Connect your TON wallet and support game development!',
      walletConnected: 'Wallet connected',
      walletNotConnected: 'Wallet not connected',
      connectWalletBtn: 'Connect',
      disconnectWalletBtn: 'Disconnect',
      donateChooseAmount: 'Select donation amount',
      donateCustomAmount: 'Custom amount (TON):',
      sendDonateBtn: (amount) => `Support with ${amount} TON`,
      connectToSendBtn: 'Connect wallet to donate',
      donateManualTitle: 'Direct transfer to wallet address:',
      copyAddrBtn: 'Copy',
      copyAddrSuccess: '✅ Copied!',
      donateSuccess: '🎉 Thank you so much for supporting the game! 💖',
      donateCancel: 'Transaction was cancelled.',
      donateError: 'Failed to send donation. Please try again.'
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
      extraBottleDesc: 'Zusätzliche leere Flasche hinzugefügt!',
      claimAdBtn: '▶ Werbung ansehen',
      adStarting: '⏳ Startet...',
      adClaimed: '✅ Erhalten! (+1)',
      adminBadge: '👑 Admin',
      adminBoostersTitle: '⚡ Kostenlose Admin-Vorteile (Keine Werbung):',
      adminAddBottle: '+1 Flasche aufs Feld',
      adminAddHints: '+5 Hinweise',
      adminAddUndos: '+5 Züge zurück',
      adminAddReveals: '+5 Aufdeckungen',
      adminAddAll: 'ALLES auffüllen (+10 auf alle Boni)',
      adminBottleAddedMsg: '🧪 Leere Flasche aufs Feld hinzugefügt!',
      adminHintsAddedMsg: (count) => `💡 +5 Hinweise hinzugefügt (Gesamt: ${count})`,
      adminUndosAddedMsg: (count) => `↩️ +5 Züge zurück hinzugefügt (Gesamt: ${count})`,
      adminRevealsAddedMsg: (count) => `🔮 +5 Aufdeckungen hinzugefügt (Gesamt: ${count})`,
      adminAllAddedMsg: '⚡ Alle Boni aufgefüllt (+10) und Flasche hinzugefügt!',
      adminResetSuccessTitle: '💥 Saison zurückgesetzt!',
      adminResetSuccessDesc: 'Alle Spielerdaten, Stufen, Erfolge und die Bestenliste wurden auf 0 zurückgesetzt!',
      donateBtnLabel: 'Spenden',
      donateModalTitle: '💎 Spiel unterstützen',
      donateModalDesc: 'Verbinde deine TON-Wallet und unterstütze die Entwicklung!',
      walletConnected: 'Wallet verbunden',
      walletNotConnected: 'Wallet nicht verbunden',
      connectWalletBtn: 'Verbinden',
      disconnectWalletBtn: 'Trennen',
      donateChooseAmount: 'Spendenbetrag wählen',
      donateCustomAmount: 'Eigener Betrag (TON):',
      sendDonateBtn: (amount) => `Mit ${amount} TON unterstützen`,
      connectToSendBtn: 'Wallet verbinden zum Spenden',
      donateManualTitle: 'Direkte Überweisung an Wallet-Adresse:',
      copyAddrBtn: 'Kopieren',
      copyAddrSuccess: '✅ Kopiert!',
      donateSuccess: '🎉 Vielen Dank für deine Unterstützung! 💖',
      donateCancel: 'Transaktion abgebrochen.',
      donateError: 'Fehler beim Senden der Spende. Bitte versuche es erneut.'
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
      extraBottleDesc: 'Papildomas tuščias buteliukas pridėtas!',
      claimAdBtn: '▶ Žiūrėti reklamą',
      adStarting: '⏳ Paleidžiama...',
      adClaimed: '✅ Gauta! (+1)',
      adminBadge: '👑 Admin',
      adminBoostersTitle: '⚡ Nemokamos administratoriaus funkcijos (Be reklamos):',
      adminAddBottle: '+1 Buteliukas lentoje',
      adminAddHints: '+5 Užuominos',
      adminAddUndos: '+5 Atšaukimai',
      adminAddReveals: '+5 Atskleidimai',
      adminAddAll: 'Papildyti VISKĄ (+10 visiems)',
      adminBottleAddedMsg: '🧪 Tuščias buteliukas pridėtas į lentą!',
      adminHintsAddedMsg: (count) => `💡 +5 Užuominos pridėtos (Iš viso: ${count})`,
      adminUndosAddedMsg: (count) => `↩️ +5 Atšaukimai pridėti (Iš viso: ${count})`,
      adminRevealsAddedMsg: (count) => `🔮 +5 Atskleidimai pridėti (Iš viso: ${count})`,
      adminAllAddedMsg: '⚡ Viskas papildyta (+10) ir buteliukas pridėtas!',
      adminResetSuccessTitle: '💥 Sezonas atstatytas!',
      adminResetSuccessDesc: 'Visi žaidėjų duomenys, lygiai, pasiekimai ir lyderių lentelė buvo atstatyti į nulį!',
      donateBtnLabel: 'Parama',
      donateModalTitle: '💎 Žaidimo parama',
      donateModalDesc: 'Prijunkite TON piniginę ir palaikykite žaidimo kūrimą!',
      walletConnected: 'Piniginė prijungta',
      walletNotConnected: 'Piniginė neprijungta',
      connectWalletBtn: 'Prijungti',
      disconnectWalletBtn: 'Atjungti',
      donateChooseAmount: 'Pasirinkite paramos sumą',
      donateCustomAmount: 'Savo suma (TON):',
      sendDonateBtn: (amount) => `Paremkite ${amount} TON`,
      connectToSendBtn: 'Prijungti piniginę paramai',
      donateManualTitle: 'Tiesioginis pervedimas į piniginės adresą:',
      copyAddrBtn: 'Kopijuoti',
      copyAddrSuccess: '✅ Nukopijuota!',
      donateSuccess: '🎉 Nuoširdžiai ačiū už žaidimo palaikymą! 💖',
      donateCancel: 'Mokėjimas atšauktas.',
      donateError: 'Klaida siunčiant paramą. Bandykite dar kartą.'
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

  // Donate & Wallet Elements
  const donateBtn = document.getElementById('donateBtn');
  const donateBtnLabel = document.getElementById('donateBtnLabel');
  const donateModal = document.getElementById('donateModal');
  const donateModalTitle = document.getElementById('donateModalTitle');
  const donateModalDesc = document.getElementById('donateModalDesc');
  const closeDonateModalBtn = document.getElementById('closeDonateModalBtn');
  const donateWalletCard = document.getElementById('donateWalletCard');
  const walletStatusIcon = document.getElementById('walletStatusIcon');
  const walletStatusLabel = document.getElementById('walletStatusLabel');
  const walletAddressPreview = document.getElementById('walletAddressPreview');
  const connectWalletBtn = document.getElementById('connectWalletBtn');
  const connectWalletBtnText = document.getElementById('connectWalletBtnText');
  const disconnectWalletBtn = document.getElementById('disconnectWalletBtn');
  const donateChooseAmountLabel = document.getElementById('donateChooseAmountLabel');
  const donateChipsGrid = document.getElementById('donateChipsGrid');
  const donateCustomLabel = document.getElementById('donateCustomLabel');
  const donateCustomInput = document.getElementById('donateCustomInput');
  const donateAmountMinusBtn = document.getElementById('donateAmountMinusBtn');
  const donateAmountPlusBtn = document.getElementById('donateAmountPlusBtn');
  const sendDonateBtn = document.getElementById('sendDonateBtn');
  const sendDonateBtnText = document.getElementById('sendDonateBtnText');
  const donateFeedbackMsg = document.getElementById('donateFeedbackMsg');
  const donateManualTitle = document.getElementById('donateManualTitle');
  const donateAddressText = document.getElementById('donateAddressText');
  const copyDonateAddressBtn = document.getElementById('copyDonateAddressBtn');
  const copyAddrBtnIcon = document.getElementById('copyAddrBtnIcon');
  const copyAddrBtnLabel = document.getElementById('copyAddrBtnLabel');

  // App specific dynamic modals (may or may not exist in DOM natively)
  const loadingScreen = document.getElementById('loadingScreen');
  const restartModal = document.getElementById('restartModal');
  const restartModalTitle = document.getElementById('restartModalTitle');
  const restartModalDesc = document.getElementById('restartModalDesc');
  const cancelRestartBtn = document.getElementById('cancelRestartBtn');
  const confirmRestartBtn = document.getElementById('confirmRestartBtn');
  const infoModal = document.getElementById('infoModal');

  // Admin & Season Reset Elements
  const profileAdminBadge = document.getElementById('profileAdminBadge');
  const adminPanelSection = document.getElementById('adminPanelSection');
  const adminPanelTitle = document.getElementById('adminPanelTitle');
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
  const adminAddAllBtn = document.getElementById('adminAddAllBtn');
  const adminAddAllLabel = document.getElementById('adminAddAllLabel');
  const adminFeedbackMsg = document.getElementById('adminFeedbackMsg');

  const ALLIGATOR_TELEGRAM_ID = '5761685341';

  function isAlligatorAdmin(user) {
    if (!user) return false;
    const tid = String(user.telegramId || '').trim();
    const fname = String(user.firstName || '').toLowerCase().trim();
    const uname = String(user.username || '').toLowerCase().trim();
    const localOverride = localStorage.getItem('cs_alligator_admin') === 'true';

    return tid === ALLIGATOR_TELEGRAM_ID ||
           fname === 'alligator' || fname === 'аллигатор' ||
           uname === 'alligator' || uname === 'аллигатор' ||
           fname.includes('alligator') || fname.includes('аллигатор') ||
           uname.includes('alligator') || uname.includes('аллигатор') ||
           localOverride;
  }

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

    document.querySelectorAll('#adModal .claim-ad-btn').forEach(btn => {
      if (!btn.disabled && !btn.textContent.includes('⏳') && !btn.textContent.includes('✅')) {
        btn.textContent = t('claimAdBtn');
      }
    });

    if (adminBoostersTitle) adminBoostersTitle.textContent = t('adminBoostersTitle');
    if (adminAddBottleLabel) adminAddBottleLabel.textContent = t('adminAddBottle');
    if (adminAddHintsLabel) adminAddHintsLabel.textContent = t('adminAddHints');
    if (adminAddUndosLabel) adminAddUndosLabel.textContent = t('adminAddUndos');
    if (adminAddRevealsLabel) adminAddRevealsLabel.textContent = t('adminAddReveals');
    if (adminAddAllLabel) adminAddAllLabel.textContent = t('adminAddAll');

    if (donateBtnLabel) donateBtnLabel.textContent = t('donateBtnLabel');
    if (donateModalTitle) donateModalTitle.textContent = t('donateModalTitle');
    if (donateModalDesc) donateModalDesc.textContent = t('donateModalDesc');
    if (donateChooseAmountLabel) donateChooseAmountLabel.textContent = t('donateChooseAmount');
    if (donateCustomLabel) donateCustomLabel.textContent = t('donateCustomAmount');
    if (donateManualTitle) donateManualTitle.textContent = t('donateManualTitle');
    if (copyAddrBtnLabel && !copyAddrBtnLabel.textContent.includes('✅')) copyAddrBtnLabel.textContent = t('copyAddrBtn');
    if (typeof updateDonateUI === 'function') updateDonateUI();
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

  // 6. Baseline local user & UI
  loadLocalUser(); // Load from local first as baseline
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

  // 8. Load level immediately (synchronous & local, 0ms latency)
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

  // 9. Start Screen Controller (registered immediately so START works 100% of the time)
  let isStarting = false;
  const handleStart = (e) => {
    if (e) {
      try {
        e.preventDefault();
        e.stopPropagation();
      } catch (err) {}
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
      try {
        window.SoundEngine.SoundEngine.initAudio();
        window.SoundEngine.SoundEngine.playClick();
      } catch (err) {}
    }
    if (window.TelegramApp && window.TelegramApp.TelegramApp) {
      try {
        window.TelegramApp.TelegramApp.haptic('medium');
      } catch (err) {}
    }

    const s = document.getElementById('startScreen');
    if (s) {
      s.classList.add('start-screen-hidden');
      s.style.display = 'none';
      if (s.parentNode) {
        try { s.parentNode.removeChild(s); } catch (err) {}
      }
    }

    // Guarantee game board is populated and fully rendered
    if (!engine.bottles || engine.bottles.length === 0) {
      loadCurrentLevel();
    }
    if (renderer && renderer.renderBoard) {
      renderer.renderBoard(engine);
    }
    updateHeaderUI();
  };

  window.__triggerGameStart = handleStart;
  window.dismissStartScreen = handleStart;

  const startGameBtn = document.getElementById('startGameBtn');
  if (startGameBtn) {
    startGameBtn.addEventListener('click', handleStart);
    startGameBtn.addEventListener('touchend', handleStart, { passive: false });
    startGameBtn.addEventListener('pointerdown', handleStart);
  }

  // If start button was already pressed before app.js loaded
  if (window.__gameStarted) {
    handleStart();
  }

  // 10. Background Network Inits (Non-blocking: server user, adsgram, ton connect)
  (async () => {
    try {
      const serverUser = await apiCall('/api/user/init', 'POST', userData);
      if (serverUser && serverUser.success && serverUser.user) {
        currentUser = { ...currentUser, ...serverUser.user };
        saveLocalUser();
        updateHeaderUI();
      }
    } catch (e) {}

    try {
      syncPlayerToCloud(currentUser);
    } catch (e) {}

    try {
      await initAdsgram();
    } catch (e) {}

    try {
      initTonConnect();
    } catch (e) {}
  })();

  function updateHeaderUI() {
    function setIfDiff(el, val) {
      if (!el) return;
      const strVal = String(val);
      if (el.textContent !== strVal) {
        el.textContent = strVal;
      }
    }

    if (levelBadgeLabel) setIfDiff(levelBadgeLabel, t('levelLabel'));
    setIfDiff(levelDisplay, currentUser.currentLevel || 1);
    setIfDiff(profileCardLevel, t('levelDisplayVal', currentUser.currentLevel || 1));
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

    // Modal user counters
    const adModalHintsCount = document.getElementById('adModalHintsCount');
    if (adModalHintsCount) {
      setIfDiff(adModalHintsCount, `(у вас: ${currentUser.hints || 0})`);
    }
    const adModalUndosCount = document.getElementById('adModalUndosCount');
    if (adModalUndosCount) {
      setIfDiff(adModalUndosCount, `(у вас: ${currentUser.undos || 0})`);
    }
    const adModalRevealsCount = document.getElementById('adModalRevealsCount');
    if (adModalRevealsCount) {
      setIfDiff(adModalRevealsCount, `(у вас: ${currentUser.reveals || 0})`);
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
  function openProfileMenu() {
    const isAdmin = isAlligatorAdmin(currentUser);
    if (profileAdminBadge) {
      profileAdminBadge.classList.toggle('hidden', !isAdmin);
    }
    if (adminPanelSection) {
      adminPanelSection.classList.toggle('hidden', !isAdmin);
    }
    if (profileCardAvatar && userAvatar) {
      profileCardAvatar.src = userAvatar.src;
    }
    if (profileCardName) {
      profileCardName.textContent = currentUser.firstName || 'Игрок';
    }
    if (profileCardLevel) {
      profileCardLevel.textContent = t('levelDisplayVal', currentUser.currentLevel || 1);
    }
    if (adminFeedbackMsg) {
      adminFeedbackMsg.classList.add('hidden');
    }
    const adminDonateWalletInput = document.getElementById('adminDonateWalletInput');
    if (adminDonateWalletInput) {
      adminDonateWalletInput.value = DONATE_RECIPIENT_ADDRESS;
    }
    const profileModalContent = document.querySelector('.profile-modal-content');
    if (profileModalContent) {
      profileModalContent.scrollTop = 0;
    }
    if (profileModal) openModal(profileModal);
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

  // ==================== TON Connect & Donate Controller ====================
  let tonConnectUI = null;
  let isWalletConnected = false;
  let userWalletAddress = '';
  let selectedDonateAmount = 0.5;
  let donateFeedbackTimer = null;
  let DONATE_RECIPIENT_ADDRESS = localStorage.getItem('cs_donate_wallet') || 'EQBvW8Z5huBkMJYdnfHCTvMzNkVx0842_TONFARMER_OFFICIAL_DEPLOYED';

  if (donateAddressText) {
    donateAddressText.textContent = DONATE_RECIPIENT_ADDRESS;
  }

  function formatShortAddress(addr) {
    if (!addr) return '';
    const clean = String(addr).trim();
    if (clean.length <= 12) return clean;
    return `${clean.slice(0, 4)}...${clean.slice(-4)}`;
  }

  function showDonateFeedback(msg, isSuccess = true) {
    if (!donateFeedbackMsg) return;
    donateFeedbackMsg.textContent = msg;
    donateFeedbackMsg.className = `donate-feedback-msg ${isSuccess ? 'success' : 'error'}`;
    donateFeedbackMsg.classList.remove('hidden');
    clearTimeout(donateFeedbackTimer);
    donateFeedbackTimer = setTimeout(() => {
      donateFeedbackMsg.classList.add('hidden');
    }, 4000);
  }

  function updateDonateUI() {
    // 1. Update wallet status card
    if (isWalletConnected && userWalletAddress) {
      if (donateWalletCard) donateWalletCard.classList.add('connected');
      if (walletStatusIcon) walletStatusIcon.textContent = '🟢';
      if (walletStatusLabel) walletStatusLabel.textContent = t('walletConnected');
      if (walletAddressPreview) {
        walletAddressPreview.textContent = formatShortAddress(userWalletAddress);
        walletAddressPreview.classList.remove('hidden');
      }
      if (connectWalletBtn) connectWalletBtn.classList.add('hidden');
      if (disconnectWalletBtn) disconnectWalletBtn.classList.remove('hidden');
      if (sendDonateBtnText) sendDonateBtnText.textContent = t('sendDonateBtn', selectedDonateAmount);
    } else {
      if (donateWalletCard) donateWalletCard.classList.remove('connected');
      if (walletStatusIcon) walletStatusIcon.textContent = '👛';
      if (walletStatusLabel) walletStatusLabel.textContent = t('walletNotConnected');
      if (walletAddressPreview) {
        walletAddressPreview.textContent = '—';
        walletAddressPreview.classList.add('hidden');
      }
      if (connectWalletBtn) connectWalletBtn.classList.remove('hidden');
      if (connectWalletBtnText) connectWalletBtnText.textContent = t('connectWalletBtn');
      if (disconnectWalletBtn) disconnectWalletBtn.classList.add('hidden');
      if (sendDonateBtnText) sendDonateBtnText.textContent = t('connectToSendBtn');
    }

    // 2. Custom input sync
    if (donateCustomInput && Number(donateCustomInput.value) !== selectedDonateAmount) {
      donateCustomInput.value = selectedDonateAmount;
    }
  }

  function handleWalletStatusChange(wallet) {
    console.log('[TON Connect] Wallet status changed:', wallet);
    if (wallet && wallet.account && wallet.account.address) {
      isWalletConnected = true;
      userWalletAddress = wallet.account.address;
    } else {
      isWalletConnected = false;
      userWalletAddress = '';
    }
    updateDonateUI();
  }

  function initTonConnect() {
    try {
      if (typeof window.TON_CONNECT_UI !== 'undefined' && window.TON_CONNECT_UI.TonConnectUI) {
        let manifestUrl;
        try {
          manifestUrl = new URL('tonconnect-manifest.json', window.location.href).href;
        } catch (e) {
          manifestUrl = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '/') + 'tonconnect-manifest.json';
        }
        tonConnectUI = new window.TON_CONNECT_UI.TonConnectUI({
          manifestUrl: manifestUrl,
          buttonRootId: 'tonConnectBtnContainer',
          uiPreferences: {
            theme: 'DARK'
          }
        });

        tonConnectUI.onStatusChange(handleWalletStatusChange);

        if (tonConnectUI.wallet) {
          handleWalletStatusChange(tonConnectUI.wallet);
        } else {
          updateDonateUI();
        }
        console.log('[TON Connect] Initialized successfully with manifest:', manifestUrl);
      } else {
        console.warn('[TON Connect] TON_CONNECT_UI not found on window yet. Retrying in background...');
        updateDonateUI();
        if (!window.__tonConnectRetryCount) window.__tonConnectRetryCount = 0;
        if (window.__tonConnectRetryCount < 10) {
          window.__tonConnectRetryCount++;
          setTimeout(initTonConnect, 1000);
        }
      }
    } catch (e) {
      console.warn('[TON Connect] Initialization error:', e);
      updateDonateUI();
    }
  }

  // Open & Close Donate Modal
  function openDonateModal() {
    if (donateModal) {
      updateDonateUI();
      openModal(donateModal);
      if (window.TelegramApp && window.TelegramApp.TelegramApp) {
        window.TelegramApp.TelegramApp.haptic('light');
      }
    }
  }

  if (donateBtn) {
    donateBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openDonateModal();
    });
  }

  if (closeDonateModalBtn && donateModal) {
    closeDonateModalBtn.addEventListener('click', () => {
      closeModal(donateModal);
      if (window.TelegramApp && window.TelegramApp.TelegramApp) {
        window.TelegramApp.TelegramApp.haptic('light');
      }
    });
  }

  if (donateModal) {
    donateModal.addEventListener('click', (e) => {
      if (e.target === donateModal) {
        closeModal(donateModal);
      }
    });
  }

  // Wallet Connect / Disconnect buttons
  if (connectWalletBtn) {
    connectWalletBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('medium');
      if (tonConnectUI) {
        try {
          await tonConnectUI.openModal();
        } catch (err) {
          console.warn('[TON Connect] openModal error:', err);
        }
      } else {
        alert(t('donateModalDesc'));
      }
    });
  }

  if (disconnectWalletBtn) {
    disconnectWalletBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('light');
      if (tonConnectUI && tonConnectUI.connected) {
        try {
          await tonConnectUI.disconnect();
          isWalletConnected = false;
          userWalletAddress = '';
          updateDonateUI();
        } catch (err) {
          console.warn('[TON Connect] disconnect error:', err);
        }
      }
    });
  }

  // Donation Amount Selection (Chips & Custom)
  function setDonationAmount(val) {
    const num = Math.max(0.1, Math.round(Number(val) * 10) / 10);
    selectedDonateAmount = num;

    document.querySelectorAll('.donate-chip').forEach(chip => {
      const chipAmt = Number(chip.dataset.amount);
      chip.classList.toggle('active', chipAmt === selectedDonateAmount);
    });

    if (donateCustomInput) {
      donateCustomInput.value = selectedDonateAmount;
    }

    if (isWalletConnected) {
      if (sendDonateBtnText) sendDonateBtnText.textContent = t('sendDonateBtn', selectedDonateAmount);
    }
  }

  document.querySelectorAll('.donate-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const amt = parseFloat(chip.dataset.amount);
      if (!isNaN(amt)) {
        if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('selection');
        setDonationAmount(amt);
      }
    });
  });

  if (donateAmountMinusBtn) {
    donateAmountMinusBtn.addEventListener('click', () => {
      if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('selection');
      setDonationAmount(Math.max(0.1, selectedDonateAmount - 0.5));
    });
  }

  if (donateAmountPlusBtn) {
    donateAmountPlusBtn.addEventListener('click', () => {
      if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('selection');
      setDonationAmount(selectedDonateAmount + 0.5);
    });
  }

  if (donateCustomInput) {
    donateCustomInput.addEventListener('input', () => {
      const val = parseFloat(donateCustomInput.value);
      if (!isNaN(val) && val > 0) {
        setDonationAmount(val);
      }
    });
  }

  // Send Donation Handler
  if (sendDonateBtn) {
    sendDonateBtn.addEventListener('click', async () => {
      if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('medium');

      // If wallet not connected yet, trigger connection modal first
      if (!isWalletConnected) {
        if (tonConnectUI) {
          try {
            await tonConnectUI.openModal();
          } catch (err) {
            console.warn('[TON Connect] openModal error:', err);
          }
        }
        return;
      }

      // If connected, execute transaction
      if (selectedDonateAmount <= 0) {
        showDonateFeedback('Укажите сумму доната больше 0', false);
        return;
      }

      sendDonateBtn.classList.add('processing');
      if (sendDonateBtnText) sendDonateBtnText.textContent = '⏳ Подтверждение...';

      try {
        const nanoAmount = (Math.floor(selectedDonateAmount * 1e9)).toString();
        const transaction = {
          validUntil: Math.floor(Date.now() / 1000) + 600, // 10 min
          messages: [
            {
              address: DONATE_RECIPIENT_ADDRESS,
              amount: nanoAmount,
            }
          ]
        };

        console.log('[TON Connect] Sending transaction:', transaction);
        const result = await tonConnectUI.sendTransaction(transaction);
        console.log('[TON Connect] Transaction result:', result);

        if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('success');
        if (window.SoundEngine && window.SoundEngine.SoundEngine) window.SoundEngine.SoundEngine.playComplete();
        if (renderer && typeof renderer.spawnConfetti === 'function') renderer.spawnConfetti();

        showDonateFeedback(t('donateSuccess'), true);
      } catch (err) {
        console.warn('[TON Connect] Transaction error or cancelled:', err);
        const isUserCancel = err && (String(err).includes('cancel') || String(err).includes('User rejected') || String(err).includes('Reject'));
        showDonateFeedback(isUserCancel ? t('donateCancel') : t('donateError'), false);
      } finally {
        sendDonateBtn.classList.remove('processing');
        updateDonateUI();
      }
    });
  }

  // Copy Donate Address Handler
  if (copyDonateAddressBtn) {
    copyDonateAddressBtn.addEventListener('click', async () => {
      if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('light');
      try {
        await navigator.clipboard.writeText(DONATE_RECIPIENT_ADDRESS);
        if (copyAddrBtnIcon) copyAddrBtnIcon.textContent = '✅';
        if (copyAddrBtnLabel) copyAddrBtnLabel.textContent = t('copyAddrSuccess');
        setTimeout(() => {
          if (copyAddrBtnIcon) copyAddrBtnIcon.textContent = '📋';
          if (copyAddrBtnLabel) copyAddrBtnLabel.textContent = t('copyAddrBtn');
        }, 2000);
      } catch (err) {
        console.warn('Failed to copy address to clipboard', err);
      }
    });
  }

  // Direct Wallet Deep-links Handlers
  const openTonkeeperBtn = document.getElementById('openTonkeeperBtn');
  if (openTonkeeperBtn) {
    openTonkeeperBtn.addEventListener('click', () => {
      if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('medium');
      const nano = Math.floor(selectedDonateAmount * 1e9);
      const url = `https://app.tonkeeper.com/transfer/${DONATE_RECIPIENT_ADDRESS}?amount=${nano}`;
      window.open(url, '_blank');
    });
  }

  const openTelegramWalletBtn = document.getElementById('openTelegramWalletBtn');
  if (openTelegramWalletBtn) {
    openTelegramWalletBtn.addEventListener('click', () => {
      if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('medium');
      window.open('https://t.me/wallet', '_blank');
    });
  }

  // Admin Donation Wallet Save Handler
  const adminSaveWalletBtn = document.getElementById('adminSaveWalletBtn');
  const adminWalletSavedMsg = document.getElementById('adminWalletSavedMsg');
  if (adminSaveWalletBtn) {
    adminSaveWalletBtn.addEventListener('click', () => {
      const adminDonateWalletInput = document.getElementById('adminDonateWalletInput');
      if (adminDonateWalletInput && adminDonateWalletInput.value.trim()) {
        const val = adminDonateWalletInput.value.trim();
        DONATE_RECIPIENT_ADDRESS = val;
        localStorage.setItem('cs_donate_wallet', val);
        if (donateAddressText) donateAddressText.textContent = val;
        if (adminWalletSavedMsg) {
          adminWalletSavedMsg.classList.remove('hidden');
          setTimeout(() => adminWalletSavedMsg.classList.add('hidden'), 2500);
        }
        if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('success');
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

  if (adminAddBottleBtn) {
    adminAddBottleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!isAlligatorAdmin(currentUser)) return;
      engine.addExtraBottle();
      if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('success');
      if (window.SoundEngine && window.SoundEngine.SoundEngine) window.SoundEngine.SoundEngine.playComplete();
      showAdminFeedback(t('adminBottleAddedMsg'));
    });
  }

  if (adminAddHintsBtn) {
    adminAddHintsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!isAlligatorAdmin(currentUser)) return;
      currentUser.hints = (currentUser.hints || 0) + 5;
      saveLocalUser();
      updateHeaderUI();
      if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('success');
      if (window.SoundEngine && window.SoundEngine.SoundEngine) window.SoundEngine.SoundEngine.playClick();
      showAdminFeedback(t('adminHintsAddedMsg', currentUser.hints));
    });
  }

  if (adminAddUndosBtn) {
    adminAddUndosBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!isAlligatorAdmin(currentUser)) return;
      currentUser.undos = (currentUser.undos || 0) + 5;
      saveLocalUser();
      updateHeaderUI();
      if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('success');
      if (window.SoundEngine && window.SoundEngine.SoundEngine) window.SoundEngine.SoundEngine.playClick();
      showAdminFeedback(t('adminUndosAddedMsg', currentUser.undos));
    });
  }

  if (adminAddRevealsBtn) {
    adminAddRevealsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!isAlligatorAdmin(currentUser)) return;
      currentUser.reveals = (currentUser.reveals || 0) + 5;
      saveLocalUser();
      updateHeaderUI();
      if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('success');
      if (window.SoundEngine && window.SoundEngine.SoundEngine) window.SoundEngine.SoundEngine.playClick();
      showAdminFeedback(t('adminRevealsAddedMsg', currentUser.reveals));
    });
  }

  if (adminAddAllBtn) {
    adminAddAllBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!isAlligatorAdmin(currentUser)) return;
      engine.addExtraBottle();
      currentUser.hints = (currentUser.hints || 0) + 10;
      currentUser.undos = (currentUser.undos || 0) + 10;
      currentUser.reveals = (currentUser.reveals || 0) + 10;
      currentUser.coins = (currentUser.coins || 0) + 500;
      saveLocalUser();
      updateHeaderUI();
      if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('success');
      if (window.SoundEngine && window.SoundEngine.SoundEngine) window.SoundEngine.SoundEngine.playComplete();
      showAdminFeedback(t('adminAllAddedMsg'));
    });
  }

  // Admin Season Reset Handlers
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

      confirmResetSeasonBtn.disabled = true;
      const originalHtml = confirmResetSeasonBtn.innerHTML;
      confirmResetSeasonBtn.innerHTML = '⏳ Сброс...';

      try {
        // 1. Wipe all player records from Global 24/7 Cloud Database (KVDB)
        try {
          const listRes = await fetch(`${GLOBAL_CLOUD_BASE}/?prefix=player_&format=json`);
          if (listRes.ok) {
            const keys = await listRes.json();
            if (Array.isArray(keys)) {
              await Promise.allSettled(
                keys.map(k => fetch(`${GLOBAL_CLOUD_BASE}/${encodeURIComponent(k)}`, { method: 'DELETE' }))
              );
            }
          }
          const pairsRes = await fetch(`${GLOBAL_CLOUD_BASE}/?prefix=player_&values=true&format=json`);
          if (pairsRes.ok) {
            const pairs = await pairsRes.json();
            if (Array.isArray(pairs)) {
              await Promise.allSettled(
                pairs.map(([k]) => fetch(`${GLOBAL_CLOUD_BASE}/${encodeURIComponent(k)}`, { method: 'DELETE' }))
              );
            }
          }
        } catch (kvErr) {
          console.warn('[Season Reset] KVDB wipe notice:', kvErr);
        }

        // 2. Call server reset endpoint if connected
        try {
          await apiCall('/api/admin/reset-season', 'POST', {
            telegramId: currentUser.telegramId,
            firstName: currentUser.firstName,
            username: currentUser.username
          });
        } catch (apiErr) {
          console.warn('[Season Reset] API reset notice:', apiErr);
        }

        // 3. Reset player progress to Level 1, 0 boosters, 0 stars, 0 coins
        currentUser.currentLevel = 1;
        currentUser.maxLevel = 1;
        currentUser.stars = 0;
        currentUser.coins = 0;
        currentUser.hints = 0;
        currentUser.undos = 0;
        currentUser.reveals = 0;
        saveLocalUser();
        updateHeaderUI();

        // 4. Restart Level 1 on the game board
        await loadCurrentLevel();

        // 5. Close modals
        closeModal(resetSeasonModal);
        closeModal(profileModal);

        // 6. Reload leaderboard to show empty/initial state
        await loadLeaderboardData();

        // 7. Success haptic and notification
        if (window.TelegramApp && window.TelegramApp.TelegramApp) {
          window.TelegramApp.TelegramApp.haptic('success');
        }
        showInfoModal(
          '💥',
          t('adminResetSuccessTitle') || 'Сезон сброшен!',
          t('adminResetSuccessDesc') || 'Все данные игроков, уровни, достижения и глобальный лидерборд сброшены под ноль!'
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

  // Developer / Local testing helper: 5 rapid clicks on large avatar in profile card to toggle Alligator Admin Mode
  let devAvatarTapCount = 0;
  let devAvatarTapTimer = null;
  if (profileCardAvatar) {
    profileCardAvatar.addEventListener('click', (e) => {
      e.stopPropagation();
      devAvatarTapCount++;
      clearTimeout(devAvatarTapTimer);
      devAvatarTapTimer = setTimeout(() => { devAvatarTapCount = 0; }, 1800);
      if (devAvatarTapCount >= 5) {
        devAvatarTapCount = 0;
        const current = localStorage.getItem('cs_alligator_admin') === 'true';
        if (!current) {
          localStorage.setItem('cs_alligator_admin', 'true');
          currentUser.firstName = 'ALLIGATOR';
          saveLocalUser();
          openProfileMenu();
          if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('success');
          alert('👑 Права администратора (Аллигатор) активированы!');
        } else {
          localStorage.removeItem('cs_alligator_admin');
          currentUser.firstName = userData.firstName || 'Игрок';
          saveLocalUser();
          openProfileMenu();
          alert('Права администратора отключены.');
        }
      }
    });
  }

  function resetAdModalButtons() {
    document.querySelectorAll('#adModal .claim-ad-btn').forEach(btn => {
      btn.textContent = t('claimAdBtn') || '▶ Смотреть рекламу';
      btn.disabled = false;
    });
  }

  if (adBonusBtn) {
    adBonusBtn.addEventListener('click', (e) => {
      if (justStartedGame) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        return;
      }
      if (adModal) {
        resetAdModalButtons();
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

      let adWatched = false;
      try {
        adWatched = await showRewardedAd();
      } catch (err) {
        console.error('[Ad Error]', err);
      }

      if (adWatched) {
        try {
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
        } catch (apiErr) {
          console.warn('[Ad API Error, fallback to local]', apiErr);
          if (rewardType === 'hints') currentUser.hints = (currentUser.hints || 0) + 1;
          else if (rewardType === 'undos') currentUser.undos = (currentUser.undos || 0) + 1;
          else if (rewardType === 'reveal_bottle' || rewardType === 'reveals') currentUser.reveals = (currentUser.reveals || 0) + 1;
        }

        saveLocalUser();
        updateHeaderUI();

        if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('success');

        if (rewardType === 'extra_bottle') {
          engine.addExtraBottle();
        }

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

});

