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
      if (cfg && cfg.tonDepositAddress) {
        tonDepositAddress = String(cfg.tonDepositAddress).trim();
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
        closeBtn.disabled = false;
        closeBtn.style.opacity = '0.7';
      }
      if (timerText) timerText.textContent = `⏳ ${secondsLeft} сек`;
      if (progressBar) {
        progressBar.style.transition = 'width 0.6s ease-out';
        progressBar.style.width = '0%';
      }
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
            showInfoModal('📢', 'Реклама', 'Пожалуйста, досмотрите видео до конца, чтобы получить бонус!');
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
      revealBtn: 'Открыть цвета',
      extraBottleBtn: 'Пустая колба',
      adBonusBtn: 'Реклама',
      leaderboardTitle: '🏆 Таблица лидеров',
      leaderboardLive: '24/7 LIVE',
      leaderboardLoading: '⏳ Загрузка живых игроков...',
      leaderboardEmptyTitle: 'Рейтинг пока формируется',
      leaderboardEmptyDesc: 'Пройдите уровень через Telegram бота @sortcolors_bot, чтобы стать первым в глобальной таблице!',
      youTag: '(Вы)',
      maxLevelLabel: (lvl) => `Макс. уровень: ${lvl}`,
      levelPrefix: 'Уровень',
      winTitle: (lvl) => `Уровень ${lvl} пройден! 🎉`,
      winSubtext: (lvl) => `Все цвета успешно собраны! Переходим к уровню ${lvl}...`,
      nextLevelBtn: 'Следующий уровень 🚀',
      restartTitle: '🔄 Начать заново?',
      restartDesc: 'Весь прогресс на этом уровне будет сброшен.',
      cancelBtn: 'Отмена',
      confirmRestartBtn: 'Рестарт',
      adModalTitle: '🎁 Реклама',
      adModalDesc: 'Посмотрите короткие видео и получите бесплатные бонусы',
      adModalBottleTitle: 'Пустая колба',
      adModalBottleDesc: '+1 пустая колба в запас',
      adModalHintsTitle: '+1 подсказка',
      adModalHintsDesc: '1 точная подсказка хода',
      adModalUndosTitle: '+1 отмена хода',
      adModalUndosDesc: '1 бесплатная отмена хода',
      adModalRevealTitle: 'Открыть цвета',
      adModalRevealDesc: 'Открыть 1 баночку со всеми цветами',
      noMovesTitle: 'Нет ходов',
      noMovesDesc: 'Вы ещё не сделали ни одного хода на этом уровне для отмены.',
      noHintDesc: 'Подсказка не найдена на текущем этапе.',
      allColorsVisibleTitle: 'Все цвета видны',
      allColorsVisibleDesc: 'В баночках на этом этапе уже открыты все цвета!',
      extraBottleTitle: '🎉 Успех',
      extraBottleDesc: 'Пустая колба добавлена на поле!',
      extraBottleModalTitle: 'Пустая колба',
      extraBottleModalPrompt: 'У вас 0 пустых колб. Посмотрите короткую рекламу, чтобы получить пустую колбу на поле!',
      claimAdBtn: '▶ Смотреть рекламу',
      adStarting: '⏳ Запуск...',
      adClaimed: '✅ Получено! (+1)',
      adminBadge: '👑 Админ',
      adminPanelTitle: 'Панель Администратора',
      adminPanelSub: 'Доступно только Аллигатору',
      adminBoostersTitle: '⚡ Бесплатные функции (Без рекламы):',
      adminAddBottle: '+5 Пустых колб',
      adminAddBoardBottle: '+1 Колба на поле',
      adminAddHints: '+5 Подсказок',
      adminAddUndos: '+5 Отмен хода',
      adminAddReveals: '+5 Открытий',
      adminAddCoins: '+5 TON',
      adminAddAll: 'Пополнить ВСЁ сразу (+10 ко всем бонусам)',
      adminBottleAddedMsg: (count) => `🧪 +5 Пустых колб добавлено (Всего: ${count})`,
      adminBoardBottleAddedMsg: '🧪 Пустая колба добавлена на поле!',
      adminHintsAddedMsg: (count) => `💡 +5 Подсказок добавлено (Всего: ${count})`,
      adminUndosAddedMsg: (count) => `↩️ +5 Отмен хода добавлено (Всего: ${count})`,
      adminRevealsAddedMsg: (count) => `🔮 +5 Открытий добавлено (Всего: ${count})`,
      adminCoinsAddedMsg: (count) => `💎 +5 TON добавлено (Баланс: ${Number(count || 0).toFixed(2)} TON)`,
      adminAllAddedMsg: '⚡ Все бонусы пополнены (+10 к каждому)!',
      adminResetPurchasesTitle: '💎 Управление покупками за TON (Только Admin)',
      adminResetPurchasesDesc: 'Аннулировать действующие покупки преимуществ за TON (например, «Все краски открыты») без списания баланса с кошельков игроков.',
      adminResetSelfPurchasesBtnLabel: '👑 Сбросить только мой аккаунт',
      adminResetPurchasesBtnLabel: '🌐 Сбросить ВСЕМ игрокам в игре',
      adminResetSeasonDesc: 'Сброс сезона полностью удаляет всю информацию, обнуляет глобальный лидерборд, уровни, монеты и награды всех игроков.',
      adminResetSeasonBtnLabel: '🔥 Сбросить сезон (Всё в ноль)',
      adminResetPurchasesSuccessTitle: '💎 Покупки аннулированы!',
      adminResetPurchasesSuccessDesc: 'Все действующие преимущества за GRAM из сундучка у всех игроков успешно аннулированы. Балансы кошельков не изменились.',
      adminResetSuccessTitle: '💥 Сезон сброшен!',
      adminResetSuccessDesc: 'Все данные игроков, уровни, достижения и глобальный лидерборд сброшены под ноль!',
      referralSectionTitle: 'Color Sort',
      referralSectionSub: 'За каждого приглашённого — 5 отмен хода, 5 подсказок, 5 открытий цвета и 5 пустых баночек',
      shareReferralTelegramBtn: '📢 Пригласить в Telegram',
      copyReferralLinkBtn: '📋 Скопировать ссылку',
      referralClaimTitle: 'Доступны награды!',
      claimAllReferralsBtn: 'Забрать всё',
      refUnitLabel: 'друзей',
      referralsListHeader: 'Приглашённые друзья:',
      tonModalTitle: 'Пополнение баланса TON',
      tonModalSubtitle: 'Выберите сумму и любой удобный криптокошелек',
      tonBalanceSub: 'Ваш текущий баланс TON:',
      tonWalletStatusSub: 'Статус кошелька:',
      tonWalletDisconnected: 'Не подключен',
      tonWalletConnected: 'Активен',
      tonConnectBtnLabel: 'Подключить TON Кошелёк',
      tonAmountTitle: 'Выберите сумму пополнения:',
      tonRewardLabel: 'Зачисление на баланс GRAM:',
      tonChoiceHeader: 'Выберите кошелёк для оплаты:',
      tonInstTitle: 'Как оплатить через Telegram Wallet (@wallet):',
      tonInstStep1: '1. Нажмите на @wallet выше (комментарий автоматически скопируется).',
      tonInstStep2: '2. В боте выберите Отправить ➔ На сторонний кошелёк (TON).',
      tonAddrSub: 'Адрес TON:',
      tonCopyLabel: 'Копия',
      tonCopiedLabel: 'Скопировано',
      tonVerifyBtn: 'Проверить оплату',
      shopModalTitle: 'Сундучок преимуществ',
      shopModalSubtitle: 'Покупайте улучшения в игре за GRAM',
      shopBalanceSub: 'Баланс в кошельке:',
      shopTopUpBtn: '+ Пополнить',
      shopActiveTitle: 'Все краски открыты: АКТИВНО',
      shopSectionDivider: 'Бустеры за криптовалюту GRAM',
      shopFeaturedTitle: 'Все краски открыты',
      shopFeaturedDesc: 'Все цвета во всех бутылочках открыты сразу с самого начала каждого уровня! Скрытые слои с вопросом «?» полностью убраны.',
      shopBottlesTitle: '+15 Пустых колб',
      shopBottlesDesc: 'Запас дополнительных пустых колб для прохождения сложных уровней.',
      shopHintsTitle: '+20 Подсказок',
      shopHintsDesc: 'Показывает лучший следующий ход при затруднении.',
      shopUndosTitle: '+20 Отмен хода',
      shopUndosDesc: 'Возвращает ход назад в любой критической ситуации.',
      shopBuyGram: (price) => `Купить за ${price} GRAM`,
      shopActivateGram: (price) => `Активировать (${price} GRAM)`,
      shopExtendGram: (price) => `Продлить (+15 дн.) — ${price} GRAM`,
      resetPurchasesModalTitle: 'Сброс покупок за TON',
      resetPurchasesWarningLead: 'Внимание! Будут аннулированы действующие покупки:',
      confirmResetPurchasesBtnLabel: '💎 Сбросить покупки',
      resetSeasonModalTitle: 'Сброс сезона',
      resetSeasonWarningLead: 'Внимание! Это действие необратимо:',
      confirmResetSeasonBtnLabel: '🔥 Сбросить всё'
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
      extraBottleBtn: 'Порожня колба',
      adBonusBtn: 'Реклама',
      leaderboardTitle: '🏆 Таблиця лідерів',
      leaderboardLive: '24/7 LIVE',
      leaderboardLoading: '⏳ Завантаження гравців...',
      leaderboardEmptyTitle: 'Рейтинг формується',
      leaderboardEmptyDesc: 'Пройдіть рівень через Telegram бота @sortcolors_bot, щоб стати першим у глобальній таблиці!',
      youTag: '(Ви)',
      maxLevelLabel: (lvl) => `Макс. рівень: ${lvl}`,
      levelPrefix: 'Рівень',
      winTitle: (lvl) => `Рівень ${lvl} пройдено! 🎉`,
      winSubtext: (lvl) => `Всі кольори успішно зібрані! Переходимо до рівня ${lvl}...`,
      nextLevelBtn: 'Наступний рівень 🚀',
      restartTitle: '🔄 Почати заново?',
      restartDesc: 'Весь прогрес на цьому рівні буде скинуто.',
      cancelBtn: 'Скасувати',
      confirmRestartBtn: 'Рестарт',
      adModalTitle: '🎁 Реклама',
      adModalDesc: 'Подивіться коротке відео та отримайте безкоштовні бонуси',
      adModalBottleTitle: 'Порожня колба',
      adModalBottleDesc: '+1 порожня колба в запас',
      adModalHintsTitle: '+1 підказка',
      adModalHintsDesc: '1 точна підказка ходу',
      adModalUndosTitle: '+1 відміна ходу',
      adModalUndosDesc: '1 безкоштовна відміна ходу',
      adModalRevealTitle: 'Відкрити кольори',
      adModalRevealDesc: 'Відкрити 1 баночку з усіма кольорами',
      noMovesTitle: 'Немає ходів',
      noMovesDesc: 'Ви ще не зробили жодного ходу на цьому рівні для скасування.',
      noHintDesc: 'Підказку не знайдено на поточному етапі.',
      allColorsVisibleTitle: 'Всі кольори видно',
      allColorsVisibleDesc: 'У баночках на цьому етапі вже відкриті всі кольори!',
      extraBottleTitle: '🎉 Успіх',
      extraBottleDesc: 'Додаткова порожня колба додана на поле!',
      extraBottleModalTitle: 'Додаткова колба',
      extraBottleModalPrompt: 'У вас 0 додаткових колб. Подивіться коротку рекламу, щоб отримати порожню колбу на полі!',
      claimAdBtn: '▶ Дивитися рекламу',
      adStarting: '⏳ Запуск...',
      adClaimed: '✅ Отримано! (+1)',
      adminBadge: '👑 Адмін',
      adminPanelTitle: 'Панель Адміністратора',
      adminPanelSub: 'Доступно тільки Алігатору',
      adminBoostersTitle: '⚡ Безкоштовні функції (Без реклами):',
      adminAddBottle: '+5 Порожніх колб',
      adminAddBoardBottle: '+1 Колба на полі',
      adminAddHints: '+5 Підказок',
      adminAddUndos: '+5 Відмін ходу',
      adminAddReveals: '+5 Відкриттів',
      adminAddCoins: '+5 TON',
      adminAddAll: 'Поповнити ВСЕ одразу (+10 до всіх бонусів)',
      adminBottleAddedMsg: (count) => `🧪 +5 Порожніх колб додано (Всього: ${count})`,
      adminBoardBottleAddedMsg: '🧪 Порожня колба додана на полі!',
      adminHintsAddedMsg: (count) => `💡 +5 Підказок додано (Всього: ${count})`,
      adminUndosAddedMsg: (count) => `↩️ +5 Відмін ходу додано (Всього: ${count})`,
      adminRevealsAddedMsg: (count) => `🔮 +5 Відкриттів додано (Всього: ${count})`,
      adminCoinsAddedMsg: (count) => `💎 +5 TON додано (Баланс: ${Number(count || 0).toFixed(2)} TON)`,
      adminAllAddedMsg: '⚡ Всі бонуси поповнено (+10 до кожного)!',
      adminResetPurchasesTitle: '💎 Управління покупками за TON (Тільки Admin)',
      adminResetPurchasesDesc: 'Анулювати діючі покупки переваг за TON без списання балансу з гаманців гравців.',
      adminResetSelfPurchasesBtnLabel: '👑 Скинути тільки мій акаунт',
      adminResetPurchasesBtnLabel: '🌐 Скинути ВСІМ гравцям в грі',
      adminResetSeasonDesc: 'Скидання сезону повністю видаляє всю інформацію, обнуляє глобальний лідерборд, рівні та монети всіх гравців.',
      adminResetSeasonBtnLabel: '🔥 Скинути сезон (Все в нуль)',
      adminResetPurchasesSuccessTitle: '💎 Покупки анульовано!',
      adminResetPurchasesSuccessDesc: 'Всі діючі переваги за GRAM із скриньки у всіх гравців успішно анульовані. Баланси гаманців не змінилися.',
      adminResetSuccessTitle: '💥 Сезон скинуто!',
      adminResetSuccessDesc: 'Всі дані гравців, рівні, досягнення та глобальний лідерборд скинуті під нуль!',
      referralSectionTitle: 'Color Sort',
      referralSectionSub: 'За кожного запрошеного — 5 відмін ходу, 5 підказок, 5 відкриттів кольору та 5 порожніх баночок',
      shareReferralTelegramBtn: '📢 Запросити в Telegram',
      copyReferralLinkBtn: '📋 Скопіювати посилання',
      referralClaimTitle: 'Доступні нагороди!',
      claimAllReferralsBtn: 'Забрати все',
      refUnitLabel: 'друзів',
      referralsListHeader: 'Запрошені друзі:',
      tonModalTitle: 'Поповнення балансу TON',
      tonModalSubtitle: 'Виберіть суму та будь-який зручний криптогаманець',
      tonBalanceSub: 'Ваш поточний баланс TON:',
      tonWalletStatusSub: 'Статус гаманця:',
      tonWalletDisconnected: 'Не підключений',
      tonWalletConnected: 'Активний',
      tonConnectBtnLabel: 'Підключити TON Гаманець',
      tonAmountTitle: 'Виберіть суму поповнення:',
      tonRewardLabel: 'Зарахування на баланс GRAM:',
      tonChoiceHeader: 'Виберіть гаманець для оплати:',
      tonInstTitle: 'Як оплатити через Telegram Wallet (@wallet):',
      tonInstStep1: '1. Натисніть на @wallet вище (коментар буде скопійовано).',
      tonInstStep2: '2. В ботові виберіть Надіслати ➔ На сторонній гаманець (TON).',
      tonAddrSub: 'Адреса TON:',
      tonCopyLabel: 'Копія',
      tonCopiedLabel: 'Скопійовано',
      tonVerifyBtn: 'Перевірити оплату',
      shopModalTitle: 'Скринька переваг',
      shopModalSubtitle: 'Купуйте покращення в грі за GRAM',
      shopBalanceSub: 'Баланс у гаманці:',
      shopTopUpBtn: '+ Поповнити',
      shopActiveTitle: 'Всі кольори відкриті: АКТИВНО',
      shopSectionDivider: 'Бустери за криптовалюту GRAM',
      shopFeaturedTitle: 'Всі кольори відкриті',
      shopFeaturedDesc: 'Всі кольори у всіх пляшечках відкриті одразу з самого початку кожного рівня! Приховані шари з знаком «?» повністю прибрано.',
      shopBottlesTitle: '+15 Порожніх колб',
      shopBottlesDesc: 'Запас додаткових порожніх колб для проходження складних рівнів.',
      shopHintsTitle: '+20 Підказок',
      shopHintsDesc: 'Показує кращий наступний хід при складнощах.',
      shopUndosTitle: '+20 Відмін ходу',
      shopUndosDesc: 'Повертає хід назад у будь-якій критичній ситуації.',
      shopBuyGram: (price) => `Купити за ${price} GRAM`,
      shopActivateGram: (price) => `Активувати (${price} GRAM)`,
      shopExtendGram: (price) => `Продовжити (+15 дн.) — ${price} GRAM`,
      resetPurchasesModalTitle: 'Скидання покупок за TON',
      resetPurchasesWarningLead: 'Увага! Будуть анульовані діючі покупки:',
      confirmResetPurchasesBtnLabel: '💎 Скинути покупки',
      resetSeasonModalTitle: 'Скидання сезону',
      resetSeasonWarningLead: 'Увага! Ця дія незворотна:',
      confirmResetSeasonBtnLabel: '🔥 Скинути все'
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
      extraBottleBtn: 'Empty Bottle',
      adBonusBtn: 'Rewards',
      leaderboardTitle: '🏆 Leaderboard',
      leaderboardLive: '24/7 LIVE',
      leaderboardLoading: '⏳ Loading live players...',
      leaderboardEmptyTitle: 'Leaderboard is forming',
      leaderboardEmptyDesc: 'Complete a level via Telegram bot @sortcolors_bot to become #1 on the leaderboard!',
      youTag: '(You)',
      maxLevelLabel: (lvl) => `Max Level: ${lvl}`,
      levelPrefix: 'Level',
      winTitle: (lvl) => `Level ${lvl} Completed! 🎉`,
      winSubtext: (lvl) => `All colors sorted! Advancing to Level ${lvl}...`,
      nextLevelBtn: 'Next Level 🚀',
      restartTitle: '🔄 Restart Level?',
      restartDesc: 'All progress on this level will be reset.',
      cancelBtn: 'Cancel',
      confirmRestartBtn: 'Restart',
      adModalTitle: '🎁 Rewards',
      adModalDesc: 'Watch short video ads to claim free boosters',
      adModalBottleTitle: 'Empty Bottle',
      adModalBottleDesc: '+1 empty bottle to stock',
      adModalHintsTitle: '+1 Hint',
      adModalHintsDesc: '1 precise move hint',
      adModalUndosTitle: '+1 Undo',
      adModalUndosDesc: '1 free move undo',
      adModalRevealTitle: 'Reveal Colors',
      adModalRevealDesc: 'Reveal all colors in 1 jar',
      noMovesTitle: 'No moves',
      noMovesDesc: 'You have not made any moves on this level to undo yet.',
      noHintDesc: 'No moves found at this stage.',
      allColorsVisibleTitle: 'All colors revealed',
      allColorsVisibleDesc: 'All bottle colors are already revealed on this stage!',
      extraBottleTitle: '🎉 Success',
      extraBottleDesc: 'Extra empty bottle added to the board!',
      extraBottleModalTitle: 'Extra Bottle',
      extraBottleModalPrompt: 'You have 0 extra bottles. Watch a short video ad to get an empty bottle on the board!',
      claimAdBtn: '▶ Watch Ad',
      adStarting: '⏳ Starting...',
      adClaimed: '✅ Received! (+1)',
      adminBadge: '👑 Admin',
      adminPanelTitle: 'Admin Panel',
      adminPanelSub: 'Alligator Access Only',
      adminBoostersTitle: '⚡ Free Admin Perks (No Ads):',
      adminAddBottle: '+5 Empty Bottles',
      adminAddBoardBottle: '+1 Bottle on Board',
      adminAddHints: '+5 Hints',
      adminAddUndos: '+5 Undos',
      adminAddReveals: '+5 Color Reveals',
      adminAddCoins: '+5 TON',
      adminAddAll: 'Replenish ALL (+10 to all boosters)',
      adminBottleAddedMsg: (count) => `🧪 +5 Empty Bottles added (Total: ${count})`,
      adminBoardBottleAddedMsg: '🧪 Empty bottle added to the board!',
      adminHintsAddedMsg: (count) => `💡 +5 Hints added (Total: ${count})`,
      adminUndosAddedMsg: (count) => `↩️ +5 Undos added (Total: ${count})`,
      adminRevealsAddedMsg: (count) => `🔮 +5 Reveals added (Total: ${count})`,
      adminCoinsAddedMsg: (count) => `💎 +5 TON added (Balance: ${Number(count || 0).toFixed(2)} TON)`,
      adminAllAddedMsg: '⚡ All boosters replenished (+10 to each)!',
      adminResetPurchasesTitle: '💎 Manage TON Purchases (Admin Only)',
      adminResetPurchasesDesc: 'Annul active TON perks (e.g. All Colors Unlocked) without touching player wallet balances.',
      adminResetSelfPurchasesBtnLabel: '👑 Reset Only My Account',
      adminResetPurchasesBtnLabel: '🌐 Reset ALL Players Purchases',
      adminResetSeasonDesc: 'Season reset completely wipes all player data, scores, levels, coins, and global leaderboard.',
      adminResetSeasonBtnLabel: '🔥 Reset Season (Wipe Everything)',
      adminResetPurchasesSuccessTitle: '💎 Purchases Annulled!',
      adminResetPurchasesSuccessDesc: 'All active GRAM perks from the chest have been annulled for all players. Wallet balances remain untouched.',
      adminResetSuccessTitle: '💥 Season Reset!',
      adminResetSuccessDesc: 'All player data, levels, achievements, and the global leaderboard have been wiped to zero!',
      referralSectionTitle: 'Color Sort',
      referralSectionSub: 'For each invitee — 5 undos, 5 hints, 5 color reveals, and 5 empty jars',
      shareReferralTelegramBtn: '📢 Invite in Telegram',
      copyReferralLinkBtn: '📋 Copy Referral Link',
      referralClaimTitle: 'Rewards Available!',
      claimAllReferralsBtn: 'Claim All',
      refUnitLabel: 'friends',
      referralsListHeader: 'Invited Friends:',
      tonModalTitle: 'TON Balance Top-Up',
      tonModalSubtitle: 'Select amount and any convenient crypto wallet',
      tonBalanceSub: 'Your current TON balance:',
      tonWalletStatusSub: 'Wallet Status:',
      tonWalletDisconnected: 'Disconnected',
      tonWalletConnected: 'Connected',
      tonConnectBtnLabel: 'Connect TON Wallet',
      tonAmountTitle: 'Select Top-Up Amount:',
      tonRewardLabel: 'Credited to GRAM balance:',
      tonChoiceHeader: 'Select Payment Wallet:',
      tonInstTitle: 'How to pay via Telegram Wallet (@wallet):',
      tonInstStep1: '1. Tap @wallet above (memo is automatically copied).',
      tonInstStep2: '2. In bot select Send ➔ To external wallet (TON).',
      tonAddrSub: 'TON Address:',
      tonCopyLabel: 'Copy',
      tonCopiedLabel: 'Copied',
      tonVerifyBtn: 'Verify Payment',
      shopModalTitle: 'Perks Chest Shop',
      shopModalSubtitle: 'Buy in-game upgrades for GRAM',
      shopBalanceSub: 'Wallet Balance:',
      shopTopUpBtn: '+ Top Up',
      shopActiveTitle: 'All Colors Unlocked: ACTIVE',
      shopSectionDivider: 'Boosters for GRAM cryptocurrency',
      shopFeaturedTitle: 'All Colors Unlocked',
      shopFeaturedDesc: 'All colors in all bottles are revealed immediately from the start of every level! Hidden question mark layers are removed.',
      shopBottlesTitle: '+15 Empty Bottles',
      shopBottlesDesc: 'Stock of extra empty bottles for solving tricky levels.',
      shopHintsTitle: '+20 Hints',
      shopHintsDesc: 'Shows the best next move when stuck.',
      shopUndosTitle: '+20 Undos',
      shopUndosDesc: 'Rewinds a move back in any tricky situation.',
      shopBuyGram: (price) => `Buy for ${price} GRAM`,
      shopActivateGram: (price) => `Activate (${price} GRAM)`,
      shopExtendGram: (price) => `Extend (+15 days) — ${price} GRAM`,
      resetPurchasesModalTitle: 'TON Purchases Reset',
      resetPurchasesWarningLead: 'Warning! Active purchases will be annulled:',
      confirmResetPurchasesBtnLabel: '💎 Reset Purchases',
      resetSeasonModalTitle: 'Season Reset',
      resetSeasonWarningLead: 'Warning! This action is irreversible:',
      confirmResetSeasonBtnLabel: '🔥 Wipe Everything'
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
      revealBtn: 'Farben aufdecken',
      extraBottleBtn: 'Leere Flasche',
      adBonusBtn: 'Boni',
      leaderboardTitle: '🏆 Bestenliste',
      leaderboardLive: '24/7 LIVE',
      leaderboardLoading: '⏳ Lade echte Spieler...',
      leaderboardEmptyTitle: 'Bestenliste formiert sich',
      leaderboardEmptyDesc: 'Beende ein Level über den Telegram Bot @sortcolors_bot, um die Nr. 1 zu werden!',
      youTag: '(Du)',
      maxLevelLabel: (lvl) => `Max. Stufe: ${lvl}`,
      levelPrefix: 'Stufe',
      winTitle: (lvl) => `Stufe ${lvl} geschafft! 🎉`,
      winSubtext: (lvl) => `Alle Farben sortiert! Weiter zu Stufe ${lvl}...`,
      nextLevelBtn: 'Nächste Stufe 🚀',
      restartTitle: '🔄 Von vorn beginnen?',
      restartDesc: 'Der Fortschritt in diesem Level wird zurückgesetzt.',
      cancelBtn: 'Abbrechen',
      confirmRestartBtn: 'Neustart',
      adModalTitle: '🎁 Belohnungen',
      adModalDesc: 'Schau kurze Videos an, um kostenlose Boni zu erhalten',
      adModalBottleTitle: 'Zusatz-Flasche',
      adModalBottleDesc: '+1 leere Flasche auf Vorrat',
      adModalHintsTitle: '+1 Hinweis',
      adModalHintsDesc: '1 präziser Hinweiszug',
      adModalUndosTitle: '+1 Zug zurück',
      adModalUndosDesc: '1 kostenloses Zurücknehmen',
      adModalRevealTitle: 'Farben aufdecken',
      adModalRevealDesc: 'Alle Farben in 1 Flasche aufdecken',
      noMovesTitle: 'Keine Züge',
      noMovesDesc: 'Du hast in diesem Level noch keine Züge gemacht.',
      noHintDesc: 'Keine Züge im aktuellen Zustand gefunden.',
      allColorsVisibleTitle: 'Alle Farben sichtbar',
      allColorsVisibleDesc: 'Alle Farben in den Flaschen sind bereits aufgedeckt!',
      extraBottleTitle: '🎉 Erfolg',
      extraBottleDesc: 'Zusätzliche leere Flasche hinzugefügt!',
      extraBottleModalTitle: 'Zusätzliche Flasche',
      extraBottleModalPrompt: 'Du hast 0 zusätzliche Flaschen. Schau ein kurzes Video an, um eine leere Flasche aufs Feld zu bekommen!',
      claimAdBtn: '▶ Werbung ansehen',
      adStarting: '⏳ Startet...',
      adClaimed: '✅ Erhalten! (+1)',
      adminBadge: '👑 Admin',
      adminPanelTitle: 'Admin-Panel',
      adminPanelSub: 'Nur für Alligator verfügbar',
      adminBoostersTitle: '⚡ Kostenlose Admin-Vorteile (Keine Werbung):',
      adminAddBottle: '+5 Leere Flaschen',
      adminAddBoardBottle: '+1 Flasche aufs Feld',
      adminAddHints: '+5 Hinweise',
      adminAddUndos: '+5 Züge zurück',
      adminAddReveals: '+5 Aufdeckungen',
      adminAddCoins: '+5 TON',
      adminAddAll: 'ALLES auffüllen (+10 auf alle Boni)',
      adminBottleAddedMsg: (count) => `🧪 +5 Leere Flaschen hinzugefügt (Gesamt: ${count})`,
      adminBoardBottleAddedMsg: '🧪 Leere Flasche aufs Feld hinzugefügt!',
      adminHintsAddedMsg: (count) => `💡 +5 Hinweise hinzugefügt (Gesamt: ${count})`,
      adminUndosAddedMsg: (count) => `↩️ +5 Züge zurück hinzugefügt (Gesamt: ${count})`,
      adminRevealsAddedMsg: (count) => `🔮 +5 Aufdeckungen hinzugefügt (Gesamt: ${count})`,
      adminCoinsAddedMsg: (count) => `💎 +5 TON hinzugefügt (Guthaben: ${Number(count || 0).toFixed(2)} TON)`,
      adminAllAddedMsg: '⚡ Alle Boni aufgefüllt (+10 auf alle)!',
      adminResetPurchasesTitle: '💎 TON-Käufe verwalten (Nur Admin)',
      adminResetPurchasesDesc: 'Aktive TON-Vorteile annullieren, ohne das Wallet-Guthaben der Spieler zu berühren.',
      adminResetSelfPurchasesBtnLabel: '👑 Nur mein Konto zurücksetzen',
      adminResetPurchasesBtnLabel: '🌐 Käufe aller Spieler zurücksetzen',
      adminResetSeasonDesc: 'Saison-Zurücksetzung löscht alle Spielerdaten, Ergebnisse, Stufen und die Bestenliste.',
      adminResetSeasonBtnLabel: '🔥 Saison zurücksetzen (Alles auf 0)',
      adminResetPurchasesSuccessTitle: '💎 Käufe annulliert!',
      adminResetPurchasesSuccessDesc: 'Alle aktiven GRAM-Vorteile aus der Truhe wurden für alle Spieler annulliert. Wallet-Guthaben bleiben unberührt.',
      adminResetSuccessTitle: '💥 Saison zurückgesetzt!',
      adminResetSuccessDesc: 'Alle Spielerdaten, Stufen, Erfolge und die Bestenliste wurden auf 0 zurückgesetzt!',
      referralSectionTitle: 'Color Sort',
      referralSectionSub: 'Für jeden Eingeladenen — 5 Züge zurück, 5 Hinweise, 5 Farbaufdeckungen und 5 leere Gläser',
      shareReferralTelegramBtn: '📢 In Telegram einladen',
      copyReferralLinkBtn: '📋 Link kopieren',
      referralClaimTitle: 'Belohnungen verfügbar!',
      claimAllReferralsBtn: 'Alles abholen',
      refUnitLabel: 'Freunde',
      referralsListHeader: 'Eingeladene Freunde:',
      tonModalTitle: 'TON-Guthaben aufladen',
      tonModalSubtitle: 'Wähle den Betrag und ein beliebiges Wallet',
      tonBalanceSub: 'Dein aktuelles TON-Guthaben:',
      tonWalletStatusSub: 'Wallet-Status:',
      tonWalletDisconnected: 'Nicht verbunden',
      tonWalletConnected: 'Verbunden',
      tonConnectBtnLabel: 'TON-Wallet verbinden',
      tonAmountTitle: 'Einzahlungsbetrag auswählen:',
      tonRewardLabel: 'Gutschrift auf GRAM-Konto:',
      tonChoiceHeader: 'Zahlungswallet auswählen:',
      tonInstTitle: 'Anleitung für Telegram Wallet (@wallet):',
      tonInstStep1: '1. Klicke oben auf @wallet (Memo wird kopiert).',
      tonInstStep2: '2. Im Bot wählen: Senden ➔ Externe Wallet (TON).',
      tonAddrSub: 'TON-Adresse:',
      tonCopyLabel: 'Kopieren',
      tonCopiedLabel: 'Kopiert',
      tonVerifyBtn: 'Zahlung prüfen',
      shopModalTitle: 'Vorteils-Truhe',
      shopModalSubtitle: 'Kaufe Spiel-Upgrades für GRAM',
      shopBalanceSub: 'Wallet-Guthaben:',
      shopTopUpBtn: '+ Aufladen',
      shopActiveTitle: 'Alle Farben aufgedeckt: AKTIV',
      shopSectionDivider: 'Booster für GRAM-Kryptowährung',
      shopFeaturedTitle: 'Alle Farben aufgedeckt',
      shopFeaturedDesc: 'Alle Farben in allen Flaschen werden zu Beginn jedes Levels sofort aufgedeckt! Versteckte Fragezeichen-Schichten werden entfernt.',
      shopBottlesTitle: '+15 Leere Flaschen',
      shopBottlesDesc: 'Vorrat an leeren Flaschen für schwierige Level.',
      shopHintsTitle: '+20 Hinweise',
      shopHintsDesc: 'Zeigt den besten nächsten Zug bei Schwierigkeiten.',
      shopUndosTitle: '+20 Züge zurück',
      shopUndosDesc: 'Macht einen Zug in jeder Situation rückgängig.',
      shopBuyGram: (price) => `Kaufen für ${price} GRAM`,
      shopActivateGram: (price) => `Aktivieren (${price} GRAM)`,
      shopExtendGram: (price) => `Verlängern (+15 Tage) — ${price} GRAM`,
      resetPurchasesModalTitle: 'TON-Käufe zurücksetzen',
      resetPurchasesWarningLead: 'Achtung! Aktive Käufe werden annulliert:',
      confirmResetPurchasesBtnLabel: '💎 Käufe zurücksetzen',
      resetSeasonModalTitle: 'Saison zurücksetzen',
      resetSeasonWarningLead: 'Achtung! Diese Aktion kann nicht rückgängig gemacht werden:',
      confirmResetSeasonBtnLabel: '🔥 Alles zurücksetzen'
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
      revealBtn: 'Atskleisti spalvas',
      extraBottleBtn: 'Tuščias buteliukas',
      adBonusBtn: 'Premijos',
      leaderboardTitle: '🏆 Lyderių lentelė',
      leaderboardLive: '24/7 LIVE',
      leaderboardLoading: '⏳ Įkeliami žaidėjai...',
      leaderboardEmptyTitle: 'Lentelė formuojama',
      leaderboardEmptyDesc: 'Įveikite lygį per Telegram botą @sortcolors_bot ir tapkite lyderiu!',
      youTag: '(Jūs)',
      maxLevelLabel: (lvl) => `Maks. lygis: ${lvl}`,
      levelPrefix: 'Lygis',
      winTitle: (lvl) => `Lygis ${lvl} įveiktas! 🎉`,
      winSubtext: (lvl) => `Visos spalvos surūšiuotos! Pereinama į lygį ${lvl}...`,
      nextLevelBtn: 'Kitas lygis 🚀',
      restartTitle: '🔄 Pradėti iš naujo?',
      restartDesc: 'Šio lygio progresas bus nustatytas iš naujo.',
      cancelBtn: 'Atšaukti',
      confirmRestartBtn: 'Iš naujo',
      adModalTitle: '🎁 Premijos',
      adModalDesc: 'Žiūrėkite trumpus vaizdo įrašus ir gaukite nemokamas premijas',
      adModalBottleTitle: 'Papildomas buteliukas',
      adModalBottleDesc: '+1 tuščias buteliukas į atsargas',
      adModalHintsTitle: '+1 užuomina',
      adModalHintsDesc: '1 tiksli užuomina',
      adModalUndosTitle: '+1 atšaukimas',
      adModalUndosDesc: '1 nemokamas atšaukimas',
      adModalRevealTitle: 'Atskleisti spalvas',
      adModalRevealDesc: 'Atskleisti 1 buteliuko spalvas',
      noMovesTitle: 'Nėra ėjimų',
      noMovesDesc: 'Šiame lygyje dar neatlikote nė vieno ėjimo.',
      noHintDesc: 'Šiame etape ėjimų nerasta.',
      allColorsVisibleTitle: 'Visos spalvos matomos',
      allColorsVisibleDesc: 'Visi buteliukų sluoksniai jau atidengti!',
      extraBottleTitle: '🎉 Pavyko',
      extraBottleDesc: 'Papildomas tuščias buteliukas pridėtas!',
      extraBottleModalTitle: 'Papildomas buteliukas',
      extraBottleModalPrompt: 'Turite 0 papildomų buteliukų. Pažiūrėkite trumpą reklamą, kad gautumėte tuščią buteliuką!',
      claimAdBtn: '▶ Žiūrėti reklamą',
      adStarting: '⏳ Paleidžiama...',
      adClaimed: '✅ Gauta! (+1)',
      adminBadge: '👑 Admin',
      adminPanelTitle: 'Administratoriaus skydelis',
      adminPanelSub: 'Prieinama tik Aligatoriui',
      adminBoostersTitle: '⚡ Nemokamos administratoriaus funkcijos (Be reklamos):',
      adminAddBottle: '+5 Tušti buteliukai',
      adminAddBoardBottle: '+1 Buteliukas lentoje',
      adminAddHints: '+5 Užuominos',
      adminAddUndos: '+5 Atšaukimai',
      adminAddReveals: '+5 Atskleidimai',
      adminAddCoins: '+5 TON',
      adminAddAll: 'Papildyti VISKĄ (+10 visiems)',
      adminBottleAddedMsg: (count) => `🧪 +5 Tušti buteliukai pridėti (Iš viso: ${count})`,
      adminBoardBottleAddedMsg: '🧪 Tuščias buteliukas pridėtas į lentą!',
      adminHintsAddedMsg: (count) => `💡 +5 Užuominos pridėtos (Iš viso: ${count})`,
      adminUndosAddedMsg: (count) => `↩️ +5 Atšaukimai pridėti (Iš viso: ${count})`,
      adminRevealsAddedMsg: (count) => `🔮 +5 Atskleidimai pridėti (Iš viso: ${count})`,
      adminCoinsAddedMsg: (count) => `💎 +5 TON pridėta (Likutis: ${Number(count || 0).toFixed(2)} TON)`,
      adminAllAddedMsg: '⚡ Visi bonusai papildyti (+10 kiekvienam)!',
      adminResetPurchasesTitle: '💎 Valdyti TON pirkimus (Tik Admin)',
      adminResetPurchasesDesc: 'Anuliuoti aktyvius TON pirkimus nepalietus žaidėjų piniginės balanso.',
      adminResetSelfPurchasesBtnLabel: '👑 Atstatyti tik mano paskyrą',
      adminResetPurchasesBtnLabel: '🌐 Atstatyti visų žaidėjų pirkimus',
      adminResetSeasonDesc: 'Sezono atstatymas ištrina visus žaidėjų duomenis, lygius ir lyderių lentelę.',
      adminResetSeasonBtnLabel: '🔥 Atstatyti sezoną (Viską į nulį)',
      adminResetPurchasesSuccessTitle: '💎 Pirkimai anuliuoti!',
      adminResetPurchasesSuccessDesc: 'Visi aktyvūs GRAM privalumai iš skrynios anuliuoti. Piniginės balansai nepakito.',
      adminResetSuccessTitle: '💥 Sezonas atstatytas!',
      adminResetSuccessDesc: 'Visi žaidėjų duomenys, lygiai, pasiekimai ir lyderių lentelė buvo atstatyti į nulį!',
      referralSectionTitle: 'Color Sort',
      referralSectionSub: 'Už kiekvieną pakviestąjį — 5 atšaukimai, 5 užuominos, 5 spalvų atskleidimai ir 5 tušti indai',
      shareReferralTelegramBtn: '📢 Pakviesti į Telegram',
      copyReferralLinkBtn: '📋 Kopijuoti nuorodą',
      referralClaimTitle: 'Apdovanojimai pasiekiami!',
      claimAllReferralsBtn: 'Pasiimti viską',
      refUnitLabel: 'draugų',
      referralsListHeader: 'Pakviesti draugai:',
      tonModalTitle: 'TON balanso papildymas',
      tonModalSubtitle: 'Pasirinkite sumą ir patogią kriptovaliutų piniginę',
      tonBalanceSub: 'Jūsų dabartinis TON balansas:',
      tonWalletStatusSub: 'Piniginės būsena:',
      tonWalletDisconnected: 'Neprijungta',
      tonWalletConnected: 'Aktyvi',
      tonConnectBtnLabel: 'Prijungti TON piniginę',
      tonAmountTitle: 'Pasirinkite papildymo sumą:',
      tonRewardLabel: 'Įskaitymas į GRAM balansą:',
      tonChoiceHeader: 'Pasirinkite mokėjimo piniginę:',
      tonInstTitle: 'Kaip mokėti per Telegram Wallet (@wallet):',
      tonInstStep1: '1. Spustelėkite @wallet viršuje (komentaras nukopijuojamas).',
      tonInstStep2: '2. Bote pasirinkite Siųsti ➔ Į išorinę piniginę (TON).',
      tonAddrSub: 'TON adresas:',
      tonCopyLabel: 'Kopijuoti',
      tonCopiedLabel: 'Nukopijuota',
      tonVerifyBtn: 'Patikrinti mokėjimą',
      shopModalTitle: 'Privalumų skrynia',
      shopModalSubtitle: 'Pirkite žaidimo patobulinimus už GRAM',
      shopBalanceSub: 'Piniginės balansas:',
      shopTopUpBtn: '+ Papildyti',
      shopActiveTitle: 'Visos spalvos atskleistos: AKTYVU',
      shopSectionDivider: 'Busteriai už GRAM kriptovaliutą',
      shopFeaturedTitle: 'Visos spalvos atskleistos',
      shopFeaturedDesc: 'Visos spalvos visuose buteliukuose atskleidžiamos iškart nuo kiekvieno lygio pradžios! Paslėpti klausimo ženklo sluoksniai pašalinami.',
      shopBottlesTitle: '+15 Tušti buteliukai',
      shopBottlesDesc: 'Papildomų tuščių buteliukų atsargos sunkiems lygiams įveikti.',
      shopHintsTitle: '+20 Užuominų',
      shopHintsDesc: 'Rodo geriausią kitą ėjimą užstrigus.',
      shopUndosTitle: '+20 Atšaukimų',
      shopUndosDesc: 'Grąžina ėjimą atgal bet kokioje situacijoje.',
      shopBuyGram: (price) => `Pirkti už ${price} GRAM`,
      shopActivateGram: (price) => `Aktivuoti (${price} GRAM)`,
      shopExtendGram: (price) => `Pratęsti (+15 d.) — ${price} GRAM`,
      resetPurchasesModalTitle: 'TON pirkimų atstatymas',
      resetPurchasesWarningLead: 'Dėmesio! Aktyvūs pirkimai bus anuliuoti:',
      confirmResetPurchasesBtnLabel: '💎 Atstatyti pirkimus',
      resetSeasonModalTitle: 'Sezono atstatymas',
      resetSeasonWarningLead: 'Dėmesio! Šis veiksmas negrįžtamas:',
      confirmResetSeasonBtnLabel: '🔥 Atstatyti viską'
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
  const adminAddBoardBottleBtn = document.getElementById('adminAddBoardBottleBtn');
  const adminAddBoardBottleLabel = document.getElementById('adminAddBoardBottleLabel');
  const adminAddHintsBtn = document.getElementById('adminAddHintsBtn');
  const adminAddHintsLabel = document.getElementById('adminAddHintsLabel');
  const adminAddUndosBtn = document.getElementById('adminAddUndosBtn');
  const adminAddUndosLabel = document.getElementById('adminAddUndosLabel');
  const adminAddRevealsBtn = document.getElementById('adminAddRevealsBtn');
  const adminAddRevealsLabel = document.getElementById('adminAddRevealsLabel');
  const adminAddCoinsBtn = document.getElementById('adminAddCoinsBtn');
  const adminAddCoinsLabel = document.getElementById('adminAddCoinsLabel');
  const adminAddAllBtn = document.getElementById('adminAddAllBtn');
  const adminAddAllLabel = document.getElementById('adminAddAllLabel');
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
    if (!user) return false;
    const tid = String(user.telegramId || '').trim();
    const fname = String(user.firstName || '').toLowerCase().trim();
    const uname = String(user.username || '').toLowerCase().trim();
    const localOverride = localStorage.getItem('cs_alligator_admin') === 'true' || localStorage.getItem('cs_admin') === 'true';

    if (localOverride) return true;
    if (tid === ALLIGATOR_TELEGRAM_ID) return true;

    const adminKeywords = ['alligator', 'аллигатор', 'tatar', 'татар', 'admin', 'админ', 'boss', 'босс', 'master', 'owner'];
    if (adminKeywords.some(k => fname.includes(k) || uname.includes(k))) return true;

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
    if (langSectionTitle) langSectionTitle.textContent = t('langSectionTitle');
    if (restartBtnLabel) restartBtnLabel.textContent = t('restartBtn');
    if (undoBtnLabel) undoBtnLabel.textContent = t('undoBtn');
    if (hintBtnLabel) hintBtnLabel.textContent = t('hintBtn');
    if (revealBtnLabel) revealBtnLabel.textContent = t('revealBtn');
    if (extraBottleBtnLabel) extraBottleBtnLabel.textContent = t('extraBottleBtn');
    if (adBonusBtnLabel) adBonusBtnLabel.textContent = t('adBonusBtn');

    // Leaderboard
    if (leaderboardModalTitle) leaderboardModalTitle.textContent = t('leaderboardTitle');
    if (leaderboardLiveBadge) leaderboardLiveBadge.textContent = t('leaderboardLive');

    if (startHint) startHint.textContent = t('startHint');

    if (restartModalTitle) restartModalTitle.textContent = t('restartTitle');
    if (restartModalDesc) restartModalDesc.textContent = t('restartDesc');
    if (cancelRestartBtn) cancelRestartBtn.textContent = t('cancelBtn');
    if (confirmRestartBtn) confirmRestartBtn.textContent = t('confirmRestartBtn');
    if (adModalTitle) adModalTitle.textContent = t('adModalTitle');
    if (adModalDesc) adModalDesc.textContent = t('adModalDesc');
    const adModalBottleTitle = document.getElementById('adModalBottleTitle');
    if (adModalBottleTitle) adModalBottleTitle.textContent = t('adModalBottleTitle') || 'Пустая колба';
    const adModalBottleDesc = document.getElementById('adModalBottleDesc');
    if (adModalBottleDesc) {
      const countSpan = document.getElementById('adModalExtraBottlesCount');
      const countHtml = countSpan ? countSpan.outerHTML : '<span class="ad-user-count" id="adModalExtraBottlesCount"></span>';
      adModalBottleDesc.innerHTML = `${t('adModalBottleDesc') || '+1 пустая колба в запас'} ${countHtml}`;
    }
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
    if (adminAddBoardBottleLabel) adminAddBoardBottleLabel.textContent = t('adminAddBoardBottle');
    if (adminAddHintsLabel) adminAddHintsLabel.textContent = t('adminAddHints');
    if (adminAddUndosLabel) adminAddUndosLabel.textContent = t('adminAddUndos');
    if (adminAddRevealsLabel) adminAddRevealsLabel.textContent = t('adminAddReveals');
    if (adminAddCoinsLabel) adminAddCoinsLabel.textContent = t('adminAddCoins');
    if (adminAddAllLabel) adminAddAllLabel.textContent = t('adminAddAll');
    if (adminResetPurchasesBtnLabel) adminResetPurchasesBtnLabel.textContent = t('adminResetPurchasesBtnLabel') || 'Сбросить все покупки за GRAM';

    const referralSectionTitleEl = document.getElementById('referralSectionTitle');
    if (referralSectionTitleEl) referralSectionTitleEl.textContent = t('referralSectionTitle');
    const referralSectionSubEl = document.getElementById('referralSectionSub');
    if (referralSectionSubEl) referralSectionSubEl.textContent = t('referralSectionSub');
    if (shareReferralTelegramBtn) {
      const span = shareReferralTelegramBtn.querySelector('span');
      if (span) span.textContent = t('shareReferralTelegramBtn');
    }
    if (copyReferralBtnText) copyReferralBtnText.textContent = t('copyReferralLinkBtn');
    if (referralClaimTitle) referralClaimTitle.textContent = t('referralClaimTitle');
    if (claimAllReferralsBtn) claimAllReferralsBtn.textContent = t('claimAllReferralsBtn');
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
    reveals: 0,
    extraBottles: 0,
    ton_balance: 0.0,
    ton_wallet: '',
    memo_code: '',
    all_colors_until: 0,
    all_colors_purchased_at: 0
  };

  window.isAllColorsActive = function () {
    if (!currentUser) return false;

    const localResetAt = Number(localStorage.getItem('color_sort_gram_reset_at') || 0);
    const purchasedAt = Number(currentUser.all_colors_purchased_at || 0);

    if (localResetAt > 0 && (purchasedAt < localResetAt || !purchasedAt)) {
      if (currentUser.all_colors_until) {
        currentUser.all_colors_until = 0;
        currentUser.all_colors_purchased_at = 0;
        saveLocalUser();
      }
      return false;
    }

    if (!currentUser.all_colors_until) return false;
    return Number(currentUser.all_colors_until) > Date.now();
  };

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

  function normalizeUserObject(user) {
    if (!user || typeof user !== 'object') return user;
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
    user.ton_balance = Number(user.ton_balance !== undefined ? user.ton_balance : (user.tonBalance !== undefined ? user.tonBalance : 0));
    return user;
  }

  async function syncPlayerToCloud(user) {
    if (!user || !user.telegramId) return;
    normalizeUserObject(user);
    const id = String(user.telegramId);
    const isRealTelegramUser = !id.startsWith('guest') && !id.startsWith('dev') && /^\d+$/.test(id);

    const localSeasonReset = Number(localStorage.getItem('color_sort_season_reset_at') || 0);
    const lvl = Number(user.maxLevel || user.currentLevel || 1);
    const stars = Number(user.stars || 0);

    // 1. Send live signal to single global 24/7 cloud database ONLY if player has progress in this season
    if (id && (lvl > 1 || stars > 0)) {
      try {
        const payload = {
          telegramId: id,
          firstName: user.firstName || 'Игрок',
          username: user.username || '',
          photoUrl: user.photoUrl || '',
          maxLevel: lvl,
          level: lvl,
          stars: stars,
          hints: Number(user.hints || 0),
          undos: Number(user.undos || 0),
          reveals: Number(user.reveals || 0),
          extraBottles: Number(user.extraBottles || 0),
          extra_bottles: Number(user.extraBottles || 0),
          ton_balance: Number(user.ton_balance || 0),
          all_colors_until: Number(user.all_colors_until || 0),
          all_colors_purchased_at: Number(user.all_colors_purchased_at || 0),
          seasonResetAt: localSeasonReset,
          updatedAt: Date.now()
        };
        fetch(`${GLOBAL_CLOUD_BASE}/player_${encodeURIComponent(id)}`, {
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
      hints: user.hints,
      undos: user.undos,
      reveals: user.reveals,
      extraBottles: user.extraBottles,
      extra_bottles: user.extraBottles,
      ton_balance: user.ton_balance,
      seasonResetAt: localSeasonReset,
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
    normalizeUserObject(currentUser);
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
    normalizeUserObject(currentUser);
  }

  function processIncomingReferral() {
    const tg = window.Telegram && window.Telegram.WebApp;
    let refParam = null;
    if (tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param) {
      const m = String(tg.initDataUnsafe.start_param).match(/(?:ref_)?(\d+)/i);
      if (m) refParam = m[1];
    }
    if (!refParam && typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const val = urlParams.get('startapp') || urlParams.get('tgWebAppStartParam') || urlParams.get('ref');
      if (val) {
        const m = String(val).match(/(?:ref_)?(\d+)/i);
        if (m) refParam = m[1];
      }
    }

    if (refParam && String(refParam) !== String(currentUser.telegramId)) {
      const alreadySent = localStorage.getItem(`cs_ref_sent_${refParam}`);
      if (!alreadySent) {
        localStorage.setItem(`cs_ref_sent_${refParam}`, 'true');
        apiCall('/api/referral/register', 'POST', {
          referrerId: refParam,
          telegramId: currentUser.telegramId,
          firstName: currentUser.firstName || 'Друг',
          username: currentUser.username || ''
        }).catch(() => {});

        try {
          fetch(`${GLOBAL_CLOUD_BASE}/ref_${refParam}_${currentUser.telegramId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              referrerId: refParam,
              referredId: currentUser.telegramId,
              referredName: currentUser.firstName || 'Друг',
              referredUsername: currentUser.username || '',
              rewardClaimed: 0,
              createdAt: Date.now()
            })
          }).catch(() => {});
        } catch (e) {}
      }
    }
  }

  // 5. Init renderer
  if (renderer && typeof renderer.initRenderer === 'function') {
    renderer.initRenderer(gameBoard, particleCanvas);
  }

  // 6. Fetch user from local storage first (instant baseline)
  loadLocalUser();

  // 6.1 Check global season reset immediately before trusting local data or merging cloud data
  checkGlobalSeasonReset().then(wasReset => {
    if (wasReset) {
      console.log('[Startup] Season was reset globally. Starting clean from Level 1.');
      return;
    }

    // Also fetch live cloud inventory & stats from KVDB (works 24/7 on GitHub Pages)
    if (currentUser.telegramId) {
      fetch(`${GLOBAL_CLOUD_BASE}/player_${encodeURIComponent(currentUser.telegramId)}`)
        .then(res => res.ok ? res.json() : null)
        .then(cloudData => {
          if (cloudData && typeof cloudData === 'object') {
            const localReset = Number(localStorage.getItem('color_sort_season_reset_at') || 0);
            const cloudTime = Number(cloudData.seasonResetAt || cloudData.updatedAt || 0);
            if (localReset > 0 && cloudTime > 0 && cloudTime < localReset) {
              // Stale record from previous season
              fetch(`${GLOBAL_CLOUD_BASE}/player_${encodeURIComponent(currentUser.telegramId)}`, { method: 'DELETE' }).catch(() => {});
              return;
            }
            let changed = false;
            if (cloudData.hints !== undefined) {
              const h = Math.max(currentUser.hints || 0, Number(cloudData.hints || 0));
              if (h !== currentUser.hints) { currentUser.hints = h; changed = true; }
            }
            if (cloudData.undos !== undefined) {
              const u = Math.max(currentUser.undos || 0, Number(cloudData.undos || 0));
              if (u !== currentUser.undos) { currentUser.undos = u; changed = true; }
            }
            if (cloudData.reveals !== undefined) {
              const r = Math.max(currentUser.reveals || 0, Number(cloudData.reveals || 0));
              if (r !== currentUser.reveals) { currentUser.reveals = r; changed = true; }
            }
            const cloudB = cloudData.extra_bottles !== undefined ? cloudData.extra_bottles : cloudData.extraBottles;
            if (cloudB !== undefined) {
              const b = Math.max(currentUser.extraBottles || 0, currentUser.extra_bottles || 0, Number(cloudB || 0));
              if (b !== currentUser.extraBottles) {
                currentUser.extraBottles = b;
                currentUser.extra_bottles = b;
                changed = true;
              }
            }
            if (cloudData.ton_balance !== undefined) {
              const tb = Math.max(Number(currentUser.ton_balance || 0), Number(cloudData.ton_balance || 0));
              if (tb !== currentUser.ton_balance) { currentUser.ton_balance = tb; changed = true; }
            }
            if (cloudData.all_colors_until !== undefined) {
              const ac = Math.max(Number(currentUser.all_colors_until || 0), Number(cloudData.all_colors_until || 0));
              if (ac !== currentUser.all_colors_until) { currentUser.all_colors_until = ac; changed = true; }
            }
            if (cloudData.all_colors_purchased_at !== undefined) {
              const acp = Math.max(Number(currentUser.all_colors_purchased_at || 0), Number(cloudData.all_colors_purchased_at || 0));
              if (acp !== currentUser.all_colors_purchased_at) { currentUser.all_colors_purchased_at = acp; changed = true; }
            }
            if (cloudData.level !== undefined || cloudData.maxLevel !== undefined) {
              const lvl = Math.max(currentUser.currentLevel || 1, Number(cloudData.level || cloudData.maxLevel || 1));
              if (lvl > (currentUser.currentLevel || 1)) {
                currentUser.currentLevel = lvl;
                currentUser.maxLevel = Math.max(currentUser.maxLevel || 1, lvl);
                changed = true;
                loadCurrentLevel();
              }
            }
            if (changed) {
              normalizeUserObject(currentUser);
              saveLocalUser();
              updateHeaderUI();
              if (typeof updateTonWalletUI === 'function') updateTonWalletUI();
              if (typeof updateShopUI === 'function') updateShopUI();
            }
          }
        }).catch(() => {});
    }
  });

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

  // 8. Load level immediately
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
  loadCurrentLevel();
  updateHeaderUI();

  // Background Cloud Sync & Init (non-blocking for instant startup)
  apiCall('/api/user/init', 'POST', userData).then(serverUser => {
    if (serverUser && serverUser.success && serverUser.user) {
      const localReset = Number(localStorage.getItem('color_sort_season_reset_at') || 0);
      const serverReset = Number(serverUser.seasonResetAt || 0);
      if (serverReset > localReset) {
        localStorage.setItem('color_sort_season_reset_at', String(serverReset));
        localStorage.setItem('color_sort_gram_reset_at', String(serverReset));
        currentUser.currentLevel = 1;
        currentUser.maxLevel = 1;
        currentUser.stars = 0;
        currentUser.coins = 0;
        currentUser.hints = 0;
        currentUser.undos = 0;
        currentUser.reveals = 0;
        currentUser.extraBottles = 0;
        currentUser.extra_bottles = 0;
        currentUser.all_colors_until = 0;
        currentUser.all_colors_purchased_at = 0;
        currentUser.season_reset_at = serverReset;
        saveLocalUser();
        updateHeaderUI();
        updateShopUI();
        loadCurrentLevel();
        return;
      }
      const oldLevel = currentUser.currentLevel;
      if (serverUser.user.hints !== undefined) currentUser.hints = Math.max(currentUser.hints || 0, serverUser.user.hints || 0);
      if (serverUser.user.undos !== undefined) currentUser.undos = Math.max(currentUser.undos || 0, serverUser.user.undos || 0);
      if (serverUser.user.reveals !== undefined) currentUser.reveals = Math.max(currentUser.reveals || 0, serverUser.user.reveals || 0);
      const serverB = serverUser.user.extra_bottles !== undefined ? serverUser.user.extra_bottles : serverUser.user.extraBottles;
      if (serverB !== undefined) {
        const maxB = Math.max(currentUser.extraBottles || 0, currentUser.extra_bottles || 0, Number(serverB || 0));
        currentUser.extraBottles = maxB;
        currentUser.extra_bottles = maxB;
      }
      if (serverUser.user.ton_balance !== undefined) currentUser.ton_balance = Math.max(currentUser.ton_balance || 0, serverUser.user.ton_balance || 0);
      if (serverUser.user.ton_wallet !== undefined) currentUser.ton_wallet = serverUser.user.ton_wallet || currentUser.ton_wallet;
      if (serverUser.user.memo_code !== undefined) currentUser.memo_code = serverUser.user.memo_code || currentUser.memo_code;
      if (serverUser.user.all_colors_until !== undefined) currentUser.all_colors_until = Math.max(currentUser.all_colors_until || 0, serverUser.user.all_colors_until || 0);
      if (serverUser.user.all_colors_purchased_at !== undefined) currentUser.all_colors_purchased_at = Math.max(currentUser.all_colors_purchased_at || 0, serverUser.user.all_colors_purchased_at || 0);
      if (serverUser.user.current_level !== undefined) currentUser.currentLevel = Number(serverUser.user.current_level || 1);
      if (serverUser.user.max_level !== undefined) currentUser.maxLevel = Number(serverUser.user.max_level || 1);
      normalizeUserObject(currentUser);
      updateTonWalletUI();
      updateShopUI();
      saveLocalUser();
      updateHeaderUI();
      if (currentUser.currentLevel !== oldLevel) {
        loadCurrentLevel();
      }
    }
    syncPlayerToCloud(currentUser);
    checkGlobalSeasonReset();
  }).catch(() => {
    checkGlobalSeasonReset();
  });

  async function checkGlobalSeasonReset() {
    let wasReset = false;
    try {
      let resetAt = 0;

      // 1. Fetch from KVDB Cloud
      try {
        const res = await fetch(`${GLOBAL_CLOUD_BASE}/meta_season_reset_at`, {
          signal: (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) ? AbortSignal.timeout(3500) : undefined
        });
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

      // 2. Fallback to server config
      if (!resetAt) {
        try {
          const sRes = await apiCall('/api/config/season-status');
          if (sRes && sRes.success && sRes.seasonResetAt) {
            resetAt = Number(sRes.seasonResetAt) || 0;
          }
        } catch (e) {}
      }

      const localResetAt = Number(localStorage.getItem('color_sort_season_reset_at') || 0);

      if (resetAt > 0 && resetAt > localResetAt) {
        console.log(`[Season Reset] Global season reset detected (server: ${resetAt}, local: ${localResetAt}). Wiping all player progress!`);
        localStorage.setItem('color_sort_season_reset_at', String(resetAt));
        localStorage.setItem('color_sort_gram_reset_at', String(resetAt));

        currentUser.currentLevel = 1;
        currentUser.maxLevel = 1;
        currentUser.stars = 0;
        currentUser.coins = 0;
        currentUser.hints = 0;
        currentUser.undos = 0;
        currentUser.reveals = 0;
        currentUser.extraBottles = 0;
        currentUser.extra_bottles = 0;
        currentUser.all_colors_until = 0;
        currentUser.all_colors_purchased_at = 0;
        currentUser.season_reset_at = resetAt;

        saveLocalUser();
        updateHeaderUI();
        updateShopUI();
        updateTonWalletUI();

        // Clear toolbar badges explicitly
        const revealBadgeEl = document.getElementById('revealBadge');
        if (revealBadgeEl) {
          revealBadgeEl.textContent = '0';
          revealBadgeEl.classList.add('badge-zero');
        }
        const extraBottleBadgeEl = document.getElementById('extraBottleBadge');
        if (extraBottleBadgeEl) {
          extraBottleBadgeEl.textContent = '0';
          extraBottleBadgeEl.classList.add('badge-zero');
        }
        const hintBadgeEl = document.getElementById('hintBadge');
        if (hintBadgeEl) {
          hintBadgeEl.textContent = '0';
          hintBadgeEl.classList.add('badge-zero');
        }
        const undoBadgeEl = document.getElementById('undoBadge');
        if (undoBadgeEl) {
          undoBadgeEl.textContent = '0';
          undoBadgeEl.classList.add('badge-zero');
        }

        // Reload Level 1 on board
        if (typeof loadCurrentLevel === 'function') {
          await loadCurrentLevel();
        }

        // Delete old KVDB cloud player record to avoid re-syncing old data
        if (currentUser.telegramId) {
          fetch(`${GLOBAL_CLOUD_BASE}/player_${encodeURIComponent(currentUser.telegramId)}`, {
            method: 'DELETE'
          }).catch(() => {});
        }

        wasReset = true;
      }
    } catch (err) {
      console.warn('[Season Reset Check Error]', err);
    }

    // Also check purchases reset if season was not reset
    if (!wasReset) {
      try {
        await checkGlobalPurchasesReset();
      } catch (e) {}
    }

    return wasReset;
  }

  async function checkGlobalPurchasesReset() {
    try {
      const res = await fetch(`${GLOBAL_CLOUD_BASE}/meta_gram_purchases_reset`, {
        signal: (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) ? AbortSignal.timeout(3000) : undefined
      });
      if (res.ok) {
        const rawText = await res.text();
        let resetAt = 0;
        try {
          const data = JSON.parse(rawText);
          resetAt = Number(data.resetAt || data) || 0;
        } catch (e) {
          resetAt = Number(rawText) || 0;
        }

        const localResetAt = Number(localStorage.getItem('color_sort_gram_reset_at') || 0);
        if (resetAt > 0 && resetAt > localResetAt) {
          localStorage.setItem('color_sort_gram_reset_at', String(resetAt));
          const lastPurchased = Number(currentUser.all_colors_purchased_at || 0);
          if (currentUser.all_colors_until && (!lastPurchased || lastPurchased < resetAt)) {
            currentUser.all_colors_until = 0;
            currentUser.all_colors_purchased_at = 0;
            saveLocalUser();
            updateShopUI();
            if (engine && engine.bottles && engine.revealed && !engine.isAnimating) {
              engine.revealed = engine.bottles.map(b => {
                if (!b || b.length === 0) return [];
                const rev = new Array(b.length).fill(false);
                rev[b.length - 1] = true;
                return rev;
              });
              if (renderer && renderer.renderBoard) renderer.renderBoard(engine);
            }
          }
        }
      }
    } catch (e) {}
  }

  // Periodic season & purchases reset check (every 15 seconds)
  setInterval(async () => {
    const wasReset = await checkGlobalSeasonReset();
    if (wasReset) {
      showInfoModal(
        '🌟',
        'Начался новый сезон!',
        'Все уровни, рейтинг и достижения игроков были сброшены под ноль.\nУдачи в покорении вершины таблицы лидеров!'
      );
    }
  }, 15000);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkGlobalSeasonReset();
    }
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

  if (undoBtn) {
    undoBtn.addEventListener('click', async (e) => {
      if (justStartedGame || modalJustClosed) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        return;
      }
      if (!engine.history || engine.history.length === 0) {
        showInfoModal('↩️', 'Нет ходов', 'Вы ещё не сделали ни одного хода на этом уровне для отмены.');
        return;
      }

      if ((currentUser.undos || 0) <= 0) {
        showInfoModal(
          '↩️',
          'Отмена хода',
          'У вас 0 отмен хода. Посмотрите короткую рекламу, чтобы получить отмену хода в счётчик!',
          '▶ Смотреть рекламу (+1)',
          async () => {
            const adWatched = await showRewardedAd();
            if (adWatched) {
              currentUser.undos = (currentUser.undos || 0) + 1;
              normalizeUserObject(currentUser);
              saveLocalUser();
              updateHeaderUI();
              syncPlayerToCloud(currentUser);
              showInfoModal('🎁', 'Отмена хода зачислена', 'Вам добавлена +1 отмена хода в счётчик! Нажмите кнопку отмены, чтобы использовать.');
              apiCall('/api/ad-reward', 'POST', {
                telegramId: currentUser.telegramId,
                rewardType: 'undos'
              }).then(res => {
                if (res && res.success && res.user && res.user.undos !== undefined) {
                  currentUser.undos = Math.max(currentUser.undos || 0, res.user.undos);
                  normalizeUserObject(currentUser);
                  saveLocalUser();
                  updateHeaderUI();
                }
              }).catch(() => {});
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
          undosUsed: 1,
          undos: currentUser.undos
        });
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
            const adWatched = await showRewardedAd();
            if (adWatched) {
              currentUser.hints = (currentUser.hints || 0) + 1;
              normalizeUserObject(currentUser);
              saveLocalUser();
              updateHeaderUI();
              syncPlayerToCloud(currentUser);
              showInfoModal('🎁', 'Подсказка зачислена', 'Вам добавлена +1 подсказка в счётчик! Нажмите кнопку подсказки, чтобы использовать.');
              apiCall('/api/ad-reward', 'POST', {
                telegramId: currentUser.telegramId,
                rewardType: 'hints'
              }).then(res => {
                if (res && res.success && res.user && res.user.hints !== undefined) {
                  currentUser.hints = Math.max(currentUser.hints || 0, res.user.hints);
                  normalizeUserObject(currentUser);
                  saveLocalUser();
                  updateHeaderUI();
                }
              }).catch(() => {});
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
          hintsUsed: 1,
          hints: currentUser.hints
        });
      } else {
        showInfoModal('🤷', 'Нет ходов', 'Текущее расположение заблокировано. Используйте отмену хода ↩️ или начните уровень сначала 🔄.');
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
        showInfoModal('🧪', 'Все цвета видны', 'В баночках на этом этапе уже открыты все цвета!');
        return;
      }

      if ((currentUser.reveals || 0) <= 0) {
        showInfoModal(
          '🧪',
          'Открыть цвета',
          'У вас 0 открытий. Посмотрите короткую рекламу, чтобы получить открытие цвета в счётчик!',
          '▶ Смотреть рекламу (+1)',
          async () => {
            const adWatched = await showRewardedAd();
            if (adWatched) {
              currentUser.reveals = (currentUser.reveals || 0) + 1;
              normalizeUserObject(currentUser);
              saveLocalUser();
              updateHeaderUI();
              syncPlayerToCloud(currentUser);
              showInfoModal('🎁', 'Открытие цвета зачислено', 'Вам добавлено +1 открытие цвета в счётчик! Нажмите кнопку открытия, чтобы использовать.');
              apiCall('/api/ad-reward', 'POST', {
                telegramId: currentUser.telegramId,
                rewardType: 'reveal_bottle'
              }).then(res => {
                if (res && res.success && res.user && res.user.reveals !== undefined) {
                  currentUser.reveals = Math.max(currentUser.reveals || 0, res.user.reveals);
                  normalizeUserObject(currentUser);
                  saveLocalUser();
                  updateHeaderUI();
                }
              }).catch(() => {});
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
          revealsUsed: 1,
          reveals: currentUser.reveals
        });
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
          t('extraBottleModalPrompt') || 'У вас 0 пустых колб. Посмотрите короткую рекламу, чтобы получить пустую колбу в счётчик!',
          t('claimAdBtn') || '▶ Смотреть рекламу (+1)',
          async () => {
            const adWatched = await showRewardedAd();
            if (adWatched) {
              currentUser.extraBottles = (currentUser.extraBottles || 0) + 1;
              currentUser.extra_bottles = currentUser.extraBottles;
              normalizeUserObject(currentUser);
              saveLocalUser();
              updateHeaderUI();
              syncPlayerToCloud(currentUser);
              showInfoModal('🎁', 'Пустая колба зачислена', 'Вам добавлена +1 пустая колба в счётчик! Нажмите кнопку колбы, чтобы поставить её на поле.');
              apiCall('/api/ad-reward', 'POST', {
                telegramId: currentUser.telegramId,
                rewardType: 'extra_bottle'
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
            }
          }
        );
        return;
      }

      const added = engine.addExtraBottle();
      if (added) {
        currentUser.extraBottles = Math.max(0, (currentUser.extraBottles || 0) - 1);
        currentUser.extra_bottles = currentUser.extraBottles;
        if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('success');
        if (window.SoundEngine && window.SoundEngine.SoundEngine) window.SoundEngine.SoundEngine.playComplete();
        updateHeaderUI();
        saveLocalUser();
        await apiCall('/api/user/sync', 'POST', {
          telegramId: currentUser.telegramId,
          extraBottlesUsed: 1,
          extraBottles: currentUser.extraBottles,
          extra_bottles: currentUser.extraBottles
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

    // 3. Ensure current user is included ONLY IF they have actually completed at least Level 1 in current season
    const currentMaxLvl = Math.max(currentUser.maxLevel || 1, currentUser.currentLevel || 1);
    const currentStars = Number(currentUser.stars || 0);

    if (isRealUser && (currentMaxLvl > 1 || currentStars > 0)) {
      const selfIndex = players.findIndex(p => String(p.telegramId) === String(currentUser.telegramId));
      if (selfIndex === -1) {
        players.push({
          telegramId: String(currentUser.telegramId),
          firstName: currentUser.firstName || 'Игрок',
          username: currentUser.username || '',
          photoUrl: currentUser.photoUrl || '',
          maxLevel: currentMaxLvl,
          level: currentMaxLvl,
          stars: currentStars
        });
      } else if (currentMaxLvl > (players[selfIndex].maxLevel || players[selfIndex].level || 1)) {
        players[selfIndex].maxLevel = currentMaxLvl;
        players[selfIndex].level = currentMaxLvl;
      }
    }

    // 4. Strict filter: NO BOTS, ONLY REAL PLAYERS, UNIQUE BY TELEGRAM ID, WHO COMPLETED AT LEAST 1 LEVEL IN CURRENT SEASON
    const localSeasonReset = Number(localStorage.getItem('color_sort_season_reset_at') || 0);
    const uniqueMap = new Map();
    players.forEach(p => {
      const id = String(p.telegramId);
      if (!id || id.startsWith('guest') || id.startsWith('dev') || !/^\d+$/.test(id)) return;

      // Ignore records from before current season reset
      if (localSeasonReset > 0) {
        const pTime = Number(p.seasonResetAt || p.updatedAt || 0);
        if (pTime > 0 && pTime < localSeasonReset) return;
      }

      const lvl = Number(p.maxLevel || p.level || 1);
      const stars = Number(p.stars || 0);
      // Strictly ignore anyone who hasn't completed Level 1
      if (lvl <= 1 && stars <= 0) return;

      const existing = uniqueMap.get(id);
      if (!existing || lvl > (existing.maxLevel || existing.level || 1)) {
        uniqueMap.set(id, {
          ...p,
          telegramId: id,
          firstName: p.firstName || (existing ? existing.firstName : 'Игрок'),
          maxLevel: lvl,
          level: lvl,
          stars: stars
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

  function initTonConnect() {
    try {
      if (window.TON_CONNECT_UI && window.TON_CONNECT_UI.TonConnectUI) {
        tonConnectUIInstance = new window.TON_CONNECT_UI.TonConnectUI({
          manifestUrl: window.location.origin + '/tonconnect-manifest.json'
        });
        tonConnectUIInstance.onStatusChange((wallet) => {
          if (wallet && wallet.account) {
            connectedWalletAddress = wallet.account.address || '';
            currentUser.ton_wallet = connectedWalletAddress;
            saveLocalUser();
            updateTonWalletUI();
            apiCall('/api/wallet/connect', 'POST', {
              telegramId: currentUser.telegramId,
              walletAddress: connectedWalletAddress
            }).catch(() => {});
          } else {
            connectedWalletAddress = '';
            currentUser.ton_wallet = '';
            saveLocalUser();
            updateTonWalletUI();
          }
        });
      }
    } catch (e) {
      console.warn('[TonConnect] Notice:', e.message);
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
      tonWalletStatusLabel.textContent = isConnected ? `Активен (${formatShortTonAddress(activeAddr)})` : 'Не подключен';
    }
    if (tonConnectBtnLabel) {
      tonConnectBtnLabel.textContent = isConnected ? `Подключён: ${formatShortTonAddress(activeAddr)}` : 'Подключить TON Кошелёк';
    }
    if (tonConnectBtn) {
      tonConnectBtn.classList.toggle('connected', isConnected);
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
      if (tonConnectUIInstance) {
        if (tonConnectUIInstance.connected) {
          await tonConnectUIInstance.disconnect();
          connectedWalletAddress = '';
          currentUser.ton_wallet = '';
          saveLocalUser();
          updateTonWalletUI();
        } else {
          tonConnectUIInstance.openModal();
        }
      } else {
        // Direct / fallback wallet connection toggle
        if (currentUser.ton_wallet) {
          connectedWalletAddress = '';
          currentUser.ton_wallet = '';
          saveLocalUser();
          updateTonWalletUI();
        } else {
          const dummyWallet = 'EQ' + Array.from({length: 46}, () => Math.floor(Math.random() * 36).toString(36)).join('');
          connectedWalletAddress = dummyWallet;
          currentUser.ton_wallet = dummyWallet;
          saveLocalUser();
          updateTonWalletUI();
          apiCall('/api/wallet/connect', 'POST', {
            telegramId: currentUser.telegramId,
            walletAddress: dummyWallet
          }).catch(() => {});
        }
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
        shopActiveTimerText.textContent = `Осталось: ${days} дн. ${hours} ч. ${mins} мин.`;
      } else {
        shopActiveTimerText.textContent = 'Истекает...';
      }
    }

    if (buyAllColorsBtn) {
      const btnTextEl = buyAllColorsBtn.querySelector('.btn-text');
      if (btnTextEl) {
        btnTextEl.textContent = isAllColors ? 'Продлить (+15 дн.) — 5 GRAM' : 'Активировать (5 GRAM)';
      }
    }
  }

  function openShopModal() {
    updateShopUI();
    const modalContent = document.querySelector('.shop-modal-content');
    if (modalContent) modalContent.scrollTop = 0;
    if (shopModal) openModal(shopModal);
    if (window.TelegramApp && window.TelegramApp.TelegramApp) {
      window.TelegramApp.TelegramApp.haptic('light');
    }
  }

  if (shopBtn) {
    shopBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openShopModal();
    });
  }

  if (closeShopModalBtn) {
    closeShopModalBtn.addEventListener('click', () => {
      if (shopModal) closeModal(shopModal);
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
      const res = await apiCall('/api/shop/buy', 'POST', {
        telegramId: currentUser.telegramId,
        itemId: itemId
      });

      if (res && res.success && res.user) {
        currentUser.ton_balance = res.user.ton_balance !== undefined ? res.user.ton_balance : currentUser.ton_balance;
        if (res.user.all_colors_until !== undefined) currentUser.all_colors_until = res.user.all_colors_until;
        if (res.user.all_colors_purchased_at !== undefined) currentUser.all_colors_purchased_at = res.user.all_colors_purchased_at;
        
        const serverB = res.user.extra_bottles !== undefined ? res.user.extra_bottles : res.user.extraBottles;
        if (serverB !== undefined) {
          currentUser.extraBottles = Number(serverB || 0);
          currentUser.extra_bottles = currentUser.extraBottles;
        } else if (itemId === 'bottles_pack_15') {
          currentUser.extraBottles = (currentUser.extraBottles || 0) + 15;
          currentUser.extra_bottles = currentUser.extraBottles;
        }

        if (res.user.hints !== undefined) {
          currentUser.hints = Number(res.user.hints || 0);
        } else if (itemId === 'hints_pack_20') {
          currentUser.hints = (currentUser.hints || 0) + 20;
        }

        if (res.user.undos !== undefined) {
          currentUser.undos = Number(res.user.undos || 0);
        } else if (itemId === 'undos_pack_20') {
          currentUser.undos = (currentUser.undos || 0) + 20;
        }

        if (res.user.reveals !== undefined) {
          currentUser.reveals = Number(res.user.reveals || 0);
        } else if (itemId === 'reveals_pack_20') {
          currentUser.reveals = (currentUser.reveals || 0) + 20;
        }
      } else {
        // Fallback for static GitHub Pages / client-side test
        currentUser.ton_balance = Number((currentBal - price).toFixed(4));
        if (itemId === 'all_colors_15d') {
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

      normalizeUserObject(currentUser);
      saveLocalUser();
      updateShopUI();
      updateHeaderUI();
      updateTonWalletUI();
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

      if (itemId === 'all_colors_15d') {
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

  // Update shop timer periodically if active
  setInterval(() => {
    if (window.isAllColorsActive && window.isAllColorsActive()) {
      if (shopActiveTimerText && shopModal && !shopModal.classList.contains('hidden')) {
        updateShopUI();
      }
    }
  }, 10000);

  // Profile & Language Modal Event Listeners
  function openProfileMenu() {
    if (profileAdminBadge) {
      profileAdminBadge.classList.remove('hidden');
    }
    if (adminPanelSection) {
      adminPanelSection.classList.remove('hidden');
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
    return `https://t.me/sortcolors_bot?startapp=ref_${id}`;
  }

  async function loadReferralsData() {
    if (!currentUser || !currentUser.telegramId) return;
    const myId = String(currentUser.telegramId);

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
      const cloudRes = await fetch(`${GLOBAL_CLOUD_BASE}/?prefix=ref_${encodeURIComponent(myId)}_&values=true&format=json`, {
        signal: (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) ? AbortSignal.timeout(2500) : undefined
      });
      if (cloudRes.ok) {
        const pairs = await cloudRes.json();
        if (Array.isArray(pairs)) {
          pairs.forEach(([key, val]) => {
            if (val && val.referredId) {
              const exists = referrals.some(r => String(r.referred_id) === String(val.referredId));
              if (!exists) {
                referrals.push({
                  id: key,
                  referred_id: val.referredId,
                  referred_name: val.referredName || 'Друг',
                  referred_username: val.referredUsername || '',
                  reward_claimed: val.rewardClaimed ? 1 : 0,
                  created_at: val.createdAt ? new Date(val.createdAt).toLocaleDateString() : ''
                });
                totalCount++;
                if (!val.rewardClaimed) unclaimedCount++;
              }
            }
          });
        }
      }
    } catch (e) {}

    // 3. Update UI
    if (referralCountVal) {
      referralCountVal.textContent = totalCount;
    }
    if (referralLinkTextDisplay) {
      referralLinkTextDisplay.textContent = getReferralLink(myId);
    }

    if (referralClaimBanner) {
      if (unclaimedCount > 0) {
        referralClaimBanner.classList.remove('hidden');
        if (referralClaimSubtitle) {
          const totalBoosterCount = unclaimedCount * 5;
          referralClaimSubtitle.textContent = `+${totalBoosterCount} колб, +${totalBoosterCount} подсказок, +${totalBoosterCount} отмен, +${totalBoosterCount} открытий!`;
        }
      } else {
        referralClaimBanner.classList.add('hidden');
      }
    }

    if (referralsListContainer) {
      if (referrals.length === 0) {
        referralsListContainer.innerHTML = `
          <div class="referrals-empty-state">
            <span>Пока никто не зашёл по вашей ссылке.<br>Отправьте ссылку друзьям в Telegram!</span>
          </div>
        `;
      } else {
        referralsListContainer.innerHTML = referrals.map(r => {
          const name = r.referred_name || 'Друг';
          const username = r.referred_username ? `@${r.referred_username}` : '';
          const isClaimed = r.reward_claimed === 1;
          const statusHtml = isClaimed
            ? `<span class="referral-status-tag referral-status-claimed">✅ Награда получена</span>`
            : `<button type="button" class="referral-status-tag referral-status-unclaimed claim-single-ref-btn" data-ref-id="${escapeHtml(String(r.id))}">🎁 Забрать +5</button>`;

          return `
            <div class="referral-item-row">
              <div class="referral-item-left">
                <div class="referral-item-avatar">👤</div>
                <div>
                  <strong class="referral-item-name">${escapeHtml(name)}</strong>
                  ${username ? `<span class="referral-item-username">${escapeHtml(username)}</span>` : ''}
                </div>
              </div>
              <div class="referral-item-right">
                ${statusHtml}
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

      const res = await apiCall('/api/referral/claim', 'POST', {
        telegramId: currentUser.telegramId,
        referralId: referralId
      });

      if (res && res.success && res.user) {
        currentUser.extraBottles = res.user.extra_bottles;
        currentUser.hints = res.user.hints;
        currentUser.undos = res.user.undos;
        currentUser.reveals = res.user.reveals;
        claimedCount = res.claimedCount || 1;
      } else {
        claimedCount = 1;
        currentUser.extraBottles = (currentUser.extraBottles || 0) + 5;
        currentUser.hints = (currentUser.hints || 0) + 5;
        currentUser.undos = (currentUser.undos || 0) + 5;
        currentUser.reveals = (currentUser.reveals || 0) + 5;

        // In KVDB, mark record claimed if present
        if (referralId && String(referralId).startsWith('ref_')) {
          try {
            fetch(`${GLOBAL_CLOUD_BASE}/${encodeURIComponent(referralId)}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ rewardClaimed: 1, claimedAt: Date.now() })
            }).catch(() => {});
          } catch (e) {}
        }
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

  if (shareReferralTelegramBtn) {
    shareReferralTelegramBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = currentUser.telegramId;
      const webUrl = `https://yyt1093-source.github.io/color_sort_game/?v=7&startapp=ref_${id}`;
      // Share only the web URL without extra text so Telegram displays only the card with Color Sort and START button
      const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(webUrl)}`;
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

  if (adminAddBottleBtn) {
    adminAddBottleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
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
        extraBottles: 5
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
    adminAddHintsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
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
        hints: 5
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
    adminAddUndosBtn.addEventListener('click', (e) => {
      e.stopPropagation();
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
        undos: 5
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
    adminAddRevealsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
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
        reveals: 5
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
    adminAddCoinsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
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
        tonBalance: 5.0
      }).catch(() => {});
      if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('success');
      if (window.SoundEngine && window.SoundEngine.SoundEngine) window.SoundEngine.SoundEngine.playClick();
      showAdminFeedback(t('adminCoinsAddedMsg', currentUser.ton_balance));
    });
  }

  if (adminAddAllBtn) {
    adminAddAllBtn.addEventListener('click', (e) => {
      e.stopPropagation();
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
        tonBalance: 5.0
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

  // Admin Reset GRAM Purchases Handlers
  if (adminResetPurchasesBtn) {
    adminResetPurchasesBtn.addEventListener('click', (e) => {
      e.stopPropagation();
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
                  val.shuffles = 0;
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
        currentUser.shuffles = 0;
        saveLocalUser();
        updateShopUI();
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

        // 6. Success haptic and notification
        if (window.TelegramApp && window.TelegramApp.TelegramApp) {
          window.TelegramApp.TelegramApp.haptic('success');
        }
        showInfoModal(
          '💎',
          t('adminResetPurchasesSuccessTitle') || 'Покупки аннулированы!',
          t('adminResetPurchasesSuccessDesc') || 'Все действующие преимущества за GRAM из сундучка у всех игроков успешно аннулированы.\n\nБалансы кошельков не изменились.'
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

      const myId = String(currentUser.telegramId || '').trim();
      if (!myId) {
        showInfoModal('⚠️', 'Внимание', 'Не удалось определить ваш Telegram ID.');
        return;
      }

      adminResetSelfPurchasesBtn.disabled = true;
      const origText = adminResetSelfPurchasesBtn.innerHTML;
      adminResetSelfPurchasesBtn.innerHTML = '⏳ Сброс...';

      try {
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
              val.shuffles = 0;
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
        currentUser.shuffles = 0;
        saveLocalUser();
        updateShopUI();
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
          'Действующие покупки за TON на вашем администраторском аккаунте успешно аннулированы.\n\nБалансы кошелька не изменились.'
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

      confirmResetSeasonBtn.disabled = true;
      const originalHtml = confirmResetSeasonBtn.innerHTML;
      confirmResetSeasonBtn.innerHTML = '⏳ Сброс...';

      try {
        const resetTimestamp = Date.now();

        // 1. Write global season reset timestamp to KVDB Cloud Database so ALL other clients (online or offline) detect it!
        try {
          await fetch(`${GLOBAL_CLOUD_BASE}/meta_season_reset_at`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resetAt: resetTimestamp })
          });
        } catch (kvMetaErr) {
          console.warn('[Season Reset] KVDB meta write notice:', kvMetaErr);
        }

        // Also update meta_gram_purchases_reset to clear all purchases globally
        try {
          await fetch(`${GLOBAL_CLOUD_BASE}/meta_gram_purchases_reset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resetAt: resetTimestamp })
          });
        } catch (e) {}

        // 2. Call server reset endpoint (if Express backend running)
        try {
          await apiCall('/api/admin/reset-season', 'POST', {
            telegramId: currentUser.telegramId,
            firstName: currentUser.firstName,
            username: currentUser.username,
            isAdmin: true,
            resetAt: resetTimestamp
          });
        } catch (apiErr) {
          console.warn('[Season Reset] API reset notice:', apiErr);
        }

        // 3. Wipe ALL player records from KVDB Cloud (strictly ALL players so no ghost players remain)
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
        } catch (kvErr) {
          console.warn('[Season Reset] KVDB wipe notice:', kvErr);
        }

        // 4. Update admin's own local storage & currentUser state to completely fresh Level 1 state
        localStorage.setItem('color_sort_season_reset_at', String(resetTimestamp));
        localStorage.setItem('color_sort_gram_reset_at', String(resetTimestamp));
        localStorage.removeItem(`color_sort_user_${currentUser.telegramId}`);

        currentUser.currentLevel = 1;
        currentUser.maxLevel = 1;
        currentUser.stars = 0;
        currentUser.coins = 0;
        currentUser.hints = 0;
        currentUser.undos = 0;
        currentUser.reveals = 0;
        currentUser.extraBottles = 0;
        currentUser.extra_bottles = 0;
        currentUser.all_colors_until = 0;
        currentUser.all_colors_purchased_at = 0;
        currentUser.season_reset_at = resetTimestamp;

        saveLocalUser();
        updateHeaderUI();
        updateShopUI();
        updateTonWalletUI();

        // Clear all toolbar badges explicitly to 0
        const revealBadgeEl = document.getElementById('revealBadge');
        if (revealBadgeEl) {
          revealBadgeEl.textContent = '0';
          revealBadgeEl.classList.add('badge-zero');
        }
        const extraBottleBadgeEl = document.getElementById('extraBottleBadge');
        if (extraBottleBadgeEl) {
          extraBottleBadgeEl.textContent = '0';
          extraBottleBadgeEl.classList.add('badge-zero');
        }
        const hintBadgeEl = document.getElementById('hintBadge');
        if (hintBadgeEl) {
          hintBadgeEl.textContent = '0';
          hintBadgeEl.classList.add('badge-zero');
        }
        const undoBadgeEl = document.getElementById('undoBadge');
        if (undoBadgeEl) {
          undoBadgeEl.textContent = '0';
          undoBadgeEl.classList.add('badge-zero');
        }

        // 5. Restart Level 1 on the game board and ensure board is fresh Level 1
        if (levelDisplay) levelDisplay.textContent = '1';
        if (profileCardLevel) profileCardLevel.textContent = t('levelDisplayVal', 1);
        await loadCurrentLevel();

        // 6. Close modals
        closeModal(resetSeasonModal);
        closeModal(profileModal);

        // 7. Reload leaderboard to show completely empty state
        await loadLeaderboardData();

        // 8. Success haptic and notification
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
      if (justStartedGame || modalJustClosed) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        return;
      }
      if (adModal) {
        resetAdModalButtons();
        const grid = adModal.querySelector('.ad-options-grid');
        if (grid) grid.scrollTop = 0;
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

      let adWatched = false;
      try {
        adWatched = await showRewardedAd();
      } catch (err) {
        console.error('[Ad Error]', err);
      }

      if (adWatched) {
        if (rewardType === 'hints') currentUser.hints = (currentUser.hints || 0) + 1;
        else if (rewardType === 'undos') currentUser.undos = (currentUser.undos || 0) + 1;
        else if (rewardType === 'reveal_bottle' || rewardType === 'reveals') currentUser.reveals = (currentUser.reveals || 0) + 1;
        else if (rewardType === 'extra_bottle' || rewardType === 'extra_bottles') {
          currentUser.extraBottles = (currentUser.extraBottles || 0) + 1;
          currentUser.extra_bottles = currentUser.extraBottles;
        }

        normalizeUserObject(currentUser);
        saveLocalUser();
        updateHeaderUI();
        syncPlayerToCloud(currentUser);

        apiCall('/api/ad-reward', 'POST', {
          telegramId: currentUser.telegramId,
          rewardType
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
      if (isStarting) return;
      isStarting = true;

      justStartedGame = true;
      setTimeout(() => {
        justStartedGame = false;
      }, 300);

      // Immediately disable pointer events on start screen to prevent click delays
      if (startScreen) {
        startScreen.style.pointerEvents = 'none';
        startScreen.classList.add('start-screen-hidden');
        setTimeout(() => {
          startScreen.style.display = 'none';
          if (startScreen.parentNode) {
            startScreen.parentNode.removeChild(startScreen);
          }
        }, 350);
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

      // Guarantee game board is populated and fully rendered
      if (renderer && renderer.renderBoard) {
        renderer.renderBoard(engine);
      }
      updateHeaderUI();
    };

    startGameBtn.addEventListener('pointerdown', handleStart);
    startGameBtn.addEventListener('click', handleStart);
    startGameBtn.addEventListener('touchend', handleStart, { passive: true });
    if (startScreen) {
      startScreen.addEventListener('click', (e) => {
        if (!isStarting && e.target === startScreen) handleStart(e);
      });
    }
  }

});

