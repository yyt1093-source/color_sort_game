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

  // 2. Init Adsgram
  let AdController = null;
  let adsgramBlockId = '47788';

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
        console.log('[Adsgram] Инициализирован в боевом режиме с Block ID:', adsgramBlockId);
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

      adModalEl.style.zIndex = '99999999';
      adModalEl.classList.remove('hidden');
      adModalEl.style.display = 'flex';

      const timelineFill = document.getElementById('adVideoTimeline');
      const progressFill = document.getElementById('adVideoProgress');
      const percentText = document.getElementById('adVideoTimer');
      const closeBtn = document.getElementById('adVideoCloseBtn');
      const soundBtn = document.getElementById('adSoundToggle');

      let isMuted = false;
      if (soundBtn) {
        soundBtn.onclick = () => {
          isMuted = !isMuted;
          soundBtn.textContent = isMuted ? '🔇' : '🔊';
        };
      }

      let totalDurationMs = 6000;
      let startTime = Date.now();
      let finished = false;

      if (timelineFill) timelineFill.style.width = '0%';
      if (progressFill) progressFill.style.width = '0%';
      if (percentText) percentText.textContent = '0%';

      if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('light');

      const timerId = setInterval(() => {
        if (finished) return;
        const elapsed = Date.now() - startTime;
        const ratio = Math.min(1, elapsed / totalDurationMs);
        const percent = Math.round(ratio * 100);

        if (timelineFill) timelineFill.style.width = `${percent}%`;
        if (progressFill) progressFill.style.width = `${percent}%`;
        if (percentText) percentText.textContent = `${percent}%`;

        if (ratio >= 1) {
          finished = true;
          clearInterval(timerId);
          if (percentText) percentText.textContent = '100% ✅';

          if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('success');
          if (window.SoundEngine && window.SoundEngine.SoundEngine) window.SoundEngine.SoundEngine.playComplete();

          setTimeout(() => {
            adModalEl.classList.add('hidden');
            adModalEl.style.display = 'none';
            resolve(true);
          }, 600);
        }
      }, 50);

      if (closeBtn) {
        closeBtn.onclick = () => {
          if (!finished) {
            if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('warning');
            showInfoModal('📢', 'Реклама', 'Пожалуйста, дождитесь окончания ролика для получения награды!');
          } else {
            clearInterval(timerId);
            adModalEl.classList.add('hidden');
            adModalEl.style.display = 'none';
            resolve(true);
          }
        };
      }
    });
  }

  async function showRewardedAd() {
    const adModal = document.getElementById('adModal');
    const wasAdModalOpen = adModal && !adModal.classList.contains('hidden') && adModal.style.display !== 'none';

    // Временно скрываем модальное окно выбора бонусов, чтобы видеоплеер Adsgram занял весь экран
    if (wasAdModalOpen) {
      adModal.classList.add('hidden');
      adModal.style.display = 'none';
    }

    try {
      // 1. Показ через официальный Adsgram SDK (Block ID: 47788, боевой режим debug: false)
      if (!AdController && window.Adsgram && adsgramBlockId) {
        try {
          AdController = window.Adsgram.init({
            blockId: adsgramBlockId,
            debug: false
          });
          console.log('[Adsgram] Инициализация перед показом с Block ID:', adsgramBlockId, 'debug: false');
        } catch (e) {
          console.warn('[Adsgram] Ошибка инициализации перед показом:', e);
        }
      }

      if (AdController) {
        try {
          console.log(`[Adsgram] Запуск официального видеоплеера Adsgram (Block ID: ${adsgramBlockId})...`);
          const res = await AdController.show();
          console.log('[Adsgram] Ответ SDK:', res);
          // Adsgram возвращает done: true ТОЛЬКО при успешном просмотре до конца
          if (res && (res.done === true || res === true)) {
            return true;
          }
          console.warn('[Adsgram] Ролик закрыт пользователем до завершения:', res);
          return false;
        } catch (err) {
          console.warn('[Adsgram] SDK ошибка / нет рекламы:', err);
          const errDesc = (err && err.description) ? err.description : '';
          // Если запуск внутри Telegram, выводим реальное сообщение от Adsgram
          if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) {
            showInfoModal('📢', 'Adsgram', errDesc || 'В данный момент реклама недоступна в вашем регионе. Попробуйте чуть позже!');
            return false;
          }
        }
      }

      // 2. Резервный режим только для локальной разработки вне Telegram
      if (!window.Telegram || !window.Telegram.WebApp || !window.Telegram.WebApp.initData) {
        console.log('[Ad Player] Локальный режим разработки (вне Telegram)...');
        return await playRewardedAdModal();
      }
      return false;
    } finally {
      // Восстанавливаем окно выбора бонусов, чтобы игрок видел свой результат
      if (wasAdModalOpen && adModal) {
        adModal.classList.remove('hidden');
        adModal.style.display = 'flex';
      }
    }
  }

  // --- Translations (i18n) for 5 Languages: RU, UK, EN, DE, LT ---
    const TRANSLATIONS = {
    ru: {
      langName: "Русский",
      levelLabel: "Уровень",
      levelDisplayVal: (lvl) => `Уровень ${lvl}`,
      profileHint: "⚙️ Язык",
      profileTitle: "⚙️ Профиль и Язык",
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
      adminTabActionsDesc: "Бесплатные функции, бустеры и сброс сезона",
      adminTabHistoryLabel: "История лидерборда",
      adminTabHistoryDesc: "Снимки в 23:55 (Киев), ручные копии и архив",
      adminHistoryTitle: "История лидерборда",
      adminHistorySub: "Ежедневные снимки в 23:55 (Киев). Ручные снимки сохраняются отдельно.",
      adminHistoryListTitle: "История сохранённых снимков:",
      adminHistoryTakeSnapshotLabel: "Сделать снимок сейчас",
      adminHistoryViewBtnLabel: "Просмотреть",
      adminHistoryDeleteBtnLabel: "Удалить",
      adminSnapshotAutoBadge: "🤖 Авто (23:55)",
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
      adminTabWalletsLabel: "Кошельки",
      adminTabWalletsDesc: "Список игроков, подключивших TON кошелёк",
      adminWalletsTitle: "Кошельки игроков",
      adminWalletsSub: "Игроки, подключившие TON кошелёк к игре",
      adminWalletsEmptyText: "Нет игроков с подключённым кошельком",
      adminWalletsLoadingText: "Загрузка кошельков игроков...",
      adminWalletsSearchPlaceholder: "Поиск по нику, ID или адресу...",
      adminWalletViewBtnLabel: "Просмотреть",
      adminWalletDetailsTitle: "👛 Кошелёк игрока",
      adminWalletNoDeposits: "Подтверждённых пополнений пока нет",
      adminWalletBackBtn: "← Назад к списку кошельков",
      tgChannelTitle: "Telegram-канал",
      tgChannelBadge: "Официальный",
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
      tonConnectBtnLabel: "Подключить TON Кошелёк",
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
    },
    uk: {
      langName: "Українська",
      levelLabel: "Рівень",
      levelDisplayVal: (lvl) => `Рівень ${lvl}`,
      profileHint: "⚙️ Мова",
      profileTitle: "⚙️ Профіль та Мова",
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
      adminTabActionsDesc: "Безкоштовні функції, бустери та скидання сезону",
      adminTabHistoryLabel: "Історія лідерборду",
      adminTabHistoryDesc: "Знімки о 23:55 (Київ), ручні копії та архів",
      adminHistoryTitle: "Історія лідерборду",
      adminHistorySub: "Щоденні знімки о 23:55 (Київ). Ручні знімки зберігаються окремо.",
      adminHistoryListTitle: "Історія збережених знімків:",
      adminHistoryTakeSnapshotLabel: "Зробити знімок зараз",
      adminHistoryViewBtnLabel: "Переглянути",
      adminHistoryDeleteBtnLabel: "Видалити",
      adminSnapshotAutoBadge: "🤖 Авто (23:55)",
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
      adminTabWalletsLabel: "Гаманці",
      adminTabWalletsDesc: "Список гравців, які підключили TON гаманець",
      adminWalletsTitle: "Гаманці гравців",
      adminWalletsSub: "Гравці, які підключили TON гаманець до гри",
      adminWalletsEmptyText: "Немає гравців з підключеним гаманцем",
      adminWalletsLoadingText: "Завантаження гаманців гравців...",
      adminWalletsSearchPlaceholder: "Пошук за ніком, ID або адресою...",
      adminWalletViewBtnLabel: "Проглянути",
      adminWalletDetailsTitle: "👛 Гаманець гравця",
      adminWalletNoDeposits: "Підтверджених поповнень поки немає",
      adminWalletBackBtn: "← Назад до списку гаманців",
      tgChannelTitle: "Telegram-канал",
      tgChannelBadge: "Офіційний",
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
      tonConnectBtnLabel: "Підключити TON Гаманець",
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
    },
    en: {
      langName: "English",
      levelLabel: "Level",
      levelDisplayVal: (lvl) => `Level ${lvl}`,
      profileHint: "⚙️ Lang",
      profileTitle: "⚙️ Profile & Language",
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
      adminTabActionsDesc: "Free boosts, rewards and season reset",
      adminTabHistoryLabel: "Leaderboard History",
      adminTabHistoryDesc: "Kyiv 23:55 snapshots, manual backups & archive",
      adminHistoryTitle: "Leaderboard History",
      adminHistorySub: "Daily snapshots at 23:55 (Kyiv). Manual snapshots are saved separately.",
      adminHistoryListTitle: "Saved snapshots history:",
      adminHistoryTakeSnapshotLabel: "Take snapshot now",
      adminHistoryViewBtnLabel: "View",
      adminHistoryDeleteBtnLabel: "Delete",
      adminSnapshotAutoBadge: "🤖 Auto (23:55)",
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
      adminTabWalletsLabel: "Wallets",
      adminTabWalletsDesc: "Players who connected a TON wallet",
      adminWalletsTitle: "Player Wallets",
      adminWalletsSub: "Players who connected a TON wallet to the game",
      adminWalletsEmptyText: "No players with connected wallets",
      adminWalletsLoadingText: "Loading player wallets...",
      adminWalletsSearchPlaceholder: "Search by nickname, ID or address...",
      adminWalletViewBtnLabel: "View",
      adminWalletDetailsTitle: "👛 Player Wallet",
      adminWalletNoDeposits: "No confirmed deposits yet",
      adminWalletBackBtn: "← Back to wallets list",
      tgChannelTitle: "Telegram Channel",
      tgChannelBadge: "Official",
      tgChannelSub: "News, updates and promo codes",
      tgChannelJoinBtn: "Open Channel",
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
      tonConnectBtnLabel: "Connect TON Wallet",
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
    },
    de: {
      langName: "Deutsch",
      levelLabel: "Stufe",
      levelDisplayVal: (lvl) => `Stufe ${lvl}`,
      profileHint: "⚙️ Sprache",
      profileTitle: "⚙️ Profil & Sprache",
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
      adminTabHistoryDesc: "23:55 Snapshots (Kiew), manuelle Kopien & Archiv",
      adminHistoryTitle: "Ranglisten-Verlauf",
      adminHistorySub: "Tägliche Snapshots um 23:55 (Kiew). Manuelle Snapshots werden separat gespeichert.",
      adminHistoryListTitle: "Verlauf gespeicherter Snapshots:",
      adminHistoryTakeSnapshotLabel: "Snapshot jetzt erstellen",
      adminHistoryViewBtnLabel: "Anzeigen",
      adminHistoryDeleteBtnLabel: "Löschen",
      adminSnapshotAutoBadge: "🤖 Auto (23:55)",
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
      tgChannelTitle: "Telegram-Kanal",
      tgChannelBadge: "Offiziell",
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
      tonConnectBtnLabel: "TON-Wallet verbinden",
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
    },
    lt: {
      langName: "Lietuvių",
      levelLabel: "Lygis",
      levelDisplayVal: (lvl) => `Lygis ${lvl}`,
      profileHint: "⚙️ Kalba",
      profileTitle: "⚙️ Profilis ir Kalba",
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
      adminTabHistoryDesc: "23:55 kopijos (Kijevas), rankinės kopijos ir archyvas",
      adminHistoryTitle: "Lyderių istorija",
      adminHistorySub: "Kasdieniai kadrai 23:55 (Kijevas). Rankiniai kadrai išsaugomi atskirai.",
      adminHistoryListTitle: "Išsaugotų kopijų istorija:",
      adminHistoryTakeSnapshotLabel: "Daryti kopiją dabar",
      adminHistoryViewBtnLabel: "Peržiūrėti",
      adminHistoryDeleteBtnLabel: "Ištrinti",
      adminSnapshotAutoBadge: "🤖 Auto (23:55)",
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
      tgChannelTitle: "Telegram kanalas",
      tgChannelBadge: "Oficialus",
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
      tonConnectBtnLabel: "Prijungti TON piniginę",
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
    const uname = String(user.username || '').toLowerCase().replace(/^@/, '').trim();
    const fname = String(user.firstName || '').toLowerCase().trim();

    // The admin panel is strictly reserved for one administrator: Alligator
    // Telegram ID: 5761685341 or username/nickname "alligator" / "аллигатор"
    if (tid === ALLIGATOR_TELEGRAM_ID) return true;
    if (uname === 'alligator' || uname === 'аллигатор') return true;
    if (fname === 'alligator' || fname === 'аллигатор') return true;

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

    // Telegram Channel Section
    const tgChannelTitle = document.getElementById('tgChannelTitle');
    if (tgChannelTitle) tgChannelTitle.textContent = t('tgChannelTitle');
    const tgChannelBadge = document.getElementById('tgChannelBadge');
    if (tgChannelBadge) tgChannelBadge.textContent = t('tgChannelBadge');
    const tgChannelSub = document.getElementById('tgChannelSub');
    if (tgChannelSub) tgChannelSub.textContent = t('tgChannelSub');
    const telegramChannelJoinBtnText = document.getElementById('telegramChannelJoinBtnText');
    if (telegramChannelJoinBtnText) telegramChannelJoinBtnText.textContent = t('tgChannelJoinBtn');

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

    // Ad Bonus Modal
    const adModalTitle = document.getElementById('adModalTitle');
    if (adModalTitle) adModalTitle.textContent = t('adModalTitle');
    const adModalDesc = document.getElementById('adModalDesc');
    if (adModalDesc) adModalDesc.textContent = t('adModalDesc');
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
  }

  // 4. App state
  let currentUser = {
    telegramId: userData.telegramId,
    firstName: userData.firstName,
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
    user.ton_wallet = String(user.ton_wallet || user.tonWallet || '').trim();
    user.ton_wallet_type = String(user.ton_wallet_type || user.tonWalletType || '').trim();
    user.ton_deposits_total = Number(user.ton_deposits_total || 0);
    user.ton_deposits_count = Number(user.ton_deposits_count || 0);
    return user;
  }

  async function syncPlayerToCloud(user, options = {}) {
    if (!user || !user.telegramId) return;
    if (window.__seasonResetKicking || (typeof isSeasonResetKicked !== 'undefined' && isSeasonResetKicked)) {
      return;
    }
    normalizeUserObject(user);
    const id = String(user.telegramId);
    const isRealTelegramUser = !id.startsWith('guest') && !id.startsWith('dev') && /^\d+$/.test(id);

    const localSeasonReset = Number(localStorage.getItem('color_sort_season_reset_at') || 0);
    const userSeasonReset = Number(user.seasonResetAt || user.season_reset_at || 0);
    let maxLvl = Number(user.maxLevel !== undefined ? user.maxLevel : 0);
    let curLvl = Number(user.currentLevel || 1);
    let stars = Number(user.stars || 0);

    // If user's season timestamp is older than current season reset, force 0 progress!
    if (localSeasonReset > 0 && userSeasonReset < localSeasonReset) {
      maxLvl = 0;
      curLvl = 1;
      stars = 0;
      user.maxLevel = 0;
      user.level = 0;
      user.currentLevel = 1;
      user.stars = 0;
      user.seasonResetAt = localSeasonReset;
      user.season_reset_at = localSeasonReset;
    }

    // 1. Send live signal to single global 24/7 cloud database for all real players
    if (id && isRealTelegramUser) {
      try {
        const payload = {
          telegramId: id,
          firstName: user.firstName || 'Игрок',
          username: user.username || '',
          photoUrl: user.photoUrl || '',
          maxLevel: maxLvl,
          level: maxLvl,
          currentLevel: curLvl,
          stars: stars,
          hints: Number(user.hints || 0),
          undos: Number(user.undos || 0),
          reveals: Number(user.reveals || 0),
          extraBottles: Number(user.extraBottles || 0),
          extra_bottles: Number(user.extraBottles || 0),
          ton_balance: Number(user.ton_balance || 0),
          ton_wallet: user.ton_wallet || '',
          ton_wallet_type: user.ton_wallet_type || '',
          ton_deposits_total: Number(user.ton_deposits_total || 0),
          ton_deposits_count: Number(user.ton_deposits_count || 0),
          all_colors_until: Number(user.all_colors_until || 0),
          all_colors_purchased_at: Number(user.all_colors_purchased_at || 0),
          seasonResetAt: localSeasonReset,
          updatedAt: Date.now()
        };
        fetch(`${GLOBAL_CLOUD_BASE}/player_${encodeURIComponent(id)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: options && options.keepalive ? true : undefined
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
      maxLevel: maxLvl,
      hints: user.hints,
      undos: user.undos,
      reveals: user.reveals,
      extraBottles: user.extraBottles,
      extra_bottles: user.extraBottles,
      ton_balance: user.ton_balance,
      ton_wallet: user.ton_wallet,
      ton_wallet_type: user.ton_wallet_type,
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

  // 6.1 Check global season reset immediately before trusting local data or merging cloud data
  checkGlobalSeasonReset().then(wasReset => {
    if (wasReset) {
      console.log('[Startup] Season was reset globally. Starting clean from Level 1.');
      return;
    }

    // Also fetch live cloud inventory & stats from KVDB (works 24/7 on GitHub Pages)
    if (currentUser.telegramId) {
      fetch(`${GLOBAL_CLOUD_BASE}/player_${encodeURIComponent(currentUser.telegramId)}?_cb=${Date.now()}`)
        .then(res => res.ok ? res.json() : null)
        .then(cloudData => {
          if (cloudData && typeof cloudData === 'object') {
            const localReset = Number(localStorage.getItem('color_sort_season_reset_at') || 0);
            const cloudSeason = Number(cloudData.seasonResetAt || 0);
            const cloudTime = Number(cloudData.updatedAt || cloudData.seasonResetAt || 0);
            if (localReset > 0 && (cloudSeason < localReset || (cloudTime > 0 && cloudTime < localReset))) {
              // Stale record from previous season - reset local state to clean Level 0 and sync
              currentUser.currentLevel = 1;
              currentUser.maxLevel = 0;
              currentUser.level = 0;
              currentUser.stars = 0;
              currentUser.seasonResetAt = localReset;
              saveLocalUser();
              syncPlayerToCloud(currentUser);
              updateHeaderUI();
              loadCurrentLevel();
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
              if (b !== currentUser.extraBottles) { currentUser.extraBottles = b; currentUser.extra_bottles = b; changed = true; }
            }
            if (cloudData.ton_balance !== undefined) {
              const tb = Math.max(Number(currentUser.ton_balance || 0), Number(cloudData.ton_balance || 0));
              if (tb !== currentUser.ton_balance) { currentUser.ton_balance = tb; changed = true; }
            }
            if (cloudData.ton_wallet && !currentUser.ton_wallet) {
              currentUser.ton_wallet = cloudData.ton_wallet;
              changed = true;
            }
            if (cloudData.memo_code && !currentUser.memo_code) {
              currentUser.memo_code = cloudData.memo_code;
              changed = true;
            }
            if (cloudData.all_colors_until !== undefined) {
              const acu = Math.max(Number(currentUser.all_colors_until || 0), Number(cloudData.all_colors_until || 0));
              if (acu !== currentUser.all_colors_until) { currentUser.all_colors_until = acu; changed = true; }
            }
            if (cloudData.all_colors_purchased_at !== undefined) {
              const acp = Math.max(Number(currentUser.all_colors_purchased_at || 0), Number(cloudData.all_colors_purchased_at || 0));
              if (acp !== currentUser.all_colors_purchased_at) { currentUser.all_colors_purchased_at = acp; changed = true; }
            }

            const cloudMax = Number(cloudData.maxLevel !== undefined ? cloudData.maxLevel : (cloudData.level !== undefined ? cloudData.level : 0));
            // If cloud has reset this account to Level 0, or cloud season is newer than user's season:
            if ((cloudSeason > 0 && cloudSeason > Number(currentUser.seasonResetAt || 0)) ||
                (cloudMax === 0 && (currentUser.maxLevel || 0) > 0 && cloudSeason >= localReset)) {
              console.log('[Startup] Cloud forced season reset to Level 0');
              currentUser.maxLevel = 0;
              currentUser.level = 0;
              currentUser.currentLevel = 1;
              currentUser.stars = 0;
              currentUser.seasonResetAt = cloudSeason || localReset;
              localStorage.setItem('color_sort_season_reset_at', String(cloudSeason || localReset));
              changed = true;
              loadCurrentLevel();
            } else if ((cloudData.level !== undefined || cloudData.maxLevel !== undefined) && (localReset === 0 || cloudSeason >= localReset)) {
              if (cloudMax > (currentUser.maxLevel || 0)) {
                currentUser.maxLevel = cloudMax;
                changed = true;
              }
              const cloudCur = Number(cloudData.currentLevel || (cloudMax > 0 ? cloudMax + 1 : 1));
              if (cloudCur > (currentUser.currentLevel || 1)) {
                currentUser.currentLevel = cloudCur;
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

    if (renderer && renderer.triggerWinConfetti) renderer.triggerWinConfetti();
    
    // Simple victory progression: advance level without coins, stars, or experience
    currentUser.currentLevel = levelNumber + 1;
    currentUser.maxLevel = Math.max(currentUser.maxLevel || 0, levelNumber);
    currentUser.seasonResetAt = Number(localStorage.getItem('color_sort_season_reset_at') || 0);
    
    saveLocalUser();
    updateHeaderUI();

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
    if (levelDisplay) levelDisplay.textContent = Number(currentUser.maxLevel || 0);
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
        currentUser.currentLevel = 1;
        currentUser.maxLevel = 0;
        currentUser.stars = 0;
        currentUser.coins = 0;
        currentUser.hints = 0;
        currentUser.undos = 0;
        currentUser.reveals = 0;
        currentUser.extraBottles = 0;
        currentUser.extra_bottles = 0;
        // NOTE: all_colors_until, ton_wallet, ton_balance, memo_code and referrals are PRESERVED!
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
      if (serverUser.user.max_level !== undefined) currentUser.maxLevel = Number(serverUser.user.max_level || 0);
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
    currentUser.hints = 0;
    currentUser.undos = 0;
    currentUser.reveals = 0;
    currentUser.extraBottles = 0;
    currentUser.extra_bottles = 0;
    // NOTE: all_colors_until, ton_wallet, ton_balance, memo_code and referrals are PRESERVED!
    currentUser.seasonResetAt = resetTimestamp;
    currentUser.season_reset_at = resetTimestamp;

    localStorage.setItem('color_sort_season_reset_at', String(resetTimestamp));
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

    // 3. Push Level 0 directly to Cloud DB immediately
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
            hints: 0,
            undos: 0,
            reveals: 0,
            extraBottles: 0,
            extra_bottles: 0,
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

  let lastWatchdogCheck = 0;
  async function checkLiveSeasonResetWatchdog() {
    if (isSeasonResetKicked) return;
    const now = Date.now();
    if (now - lastWatchdogCheck < 25000) return;
    lastWatchdogCheck = now;

    try {
      const res = await fetch(`${GLOBAL_CLOUD_BASE}/meta_season_reset_at?_cb=${now}`, {
        cache: 'no-store',
        signal: (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') ? AbortSignal.timeout(2500) : undefined
      });
      if (res.status === 429) {
        lastWatchdogCheck = now + 45000; // Back off on rate limit
        return;
      }
      if (res.ok) {
        const rawText = await res.text();
        let resetAt = 0;
        try {
          const data = JSON.parse(rawText);
          resetAt = Number(data.resetAt || data) || 0;
        } catch (e) {
          resetAt = Number(rawText) || 0;
        }

        const localResetAt = Number(localStorage.getItem('color_sort_season_reset_at') || 0);
        const userSeasonReset = Number(currentUser.seasonResetAt || currentUser.season_reset_at || 0);

        if (resetAt > 0 && (resetAt > localResetAt || userSeasonReset < resetAt)) {
          triggerSeasonResetKick(resetAt);
        }
      }
    } catch (e) {}
  }

  async function checkGlobalSeasonReset() {
    let wasReset = false;
    try {
      let resetAt = 0;

      // 1. Fetch from KVDB Cloud with cache buster!
      try {
        const res = await fetch(`${GLOBAL_CLOUD_BASE}/meta_season_reset_at?_cb=${Date.now()}`, {
          cache: 'no-store',
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
      const userSeasonReset = Number(currentUser.seasonResetAt || currentUser.season_reset_at || 0);

      if (resetAt > 0 && (resetAt > localResetAt || userSeasonReset < resetAt)) {
        console.log(`[Season Reset] Global season reset detected (server: ${resetAt}, local: ${localResetAt}). Wiping all player progress!`);
        triggerSeasonResetKick(resetAt);
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

  // Realtime active watchdog while playing (every 30 seconds, throttled)
  setInterval(checkLiveSeasonResetWatchdog, 30000);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkLiveSeasonResetWatchdog();
      checkGlobalSeasonReset();
    }
  });

  window.addEventListener('focus', () => {
    checkLiveSeasonResetWatchdog();
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
    setIfDiff(levelDisplay, Number(currentUser.maxLevel || 0));
    setIfDiff(profileCardLevel, t('levelDisplayVal', Number(currentUser.maxLevel || 0)));

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
            const adWatched = await showRewardedAd();
            if (adWatched) {
              currentUser.undos = (currentUser.undos || 0) + 1;
              normalizeUserObject(currentUser);
              saveLocalUser();
              updateHeaderUI();
              syncPlayerToCloud(currentUser);
              showInfoModal('🎁', t('bonusUndoTitle'), t('bonusAddedUndo'));
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
              showInfoModal('🎁', t('bonusHintTitle'), t('bonusAddedHint'));
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
            const adWatched = await showRewardedAd();
            if (adWatched) {
              currentUser.reveals = (currentUser.reveals || 0) + 1;
              normalizeUserObject(currentUser);
              saveLocalUser();
              updateHeaderUI();
              syncPlayerToCloud(currentUser);
              showInfoModal('🎁', t('bonusRevealTitle'), t('bonusAddedReveal'));
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
          t('outOfBottlesPrompt') || 'У вас 0 пустых колб. Посмотрите короткую рекламу, чтобы получить пустую колбу в счётчик!',
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
              showInfoModal('🎁', t('bonusBottleTitle'), t('bonusAddedBottle'));
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
      const cloudRes = await fetch(`${GLOBAL_CLOUD_BASE}/?prefix=player_&values=true&format=json&_cb=${Date.now()}`, {
        cache: 'no-store',
        signal: (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') ? AbortSignal.timeout(3500) : undefined
      });
      if (cloudRes.ok) {
        const pairs = await cloudRes.json();
        if (Array.isArray(pairs)) {
          players = pairs
            .map(([k, p]) => {
              if (typeof p === 'string') {
                try { return JSON.parse(p); } catch (e) { return null; }
              }
              return p;
            })
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

    // 3. Ensure current user is included in the unified leaderboard ONLY if maxLevel >= 1
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

    const currentMaxLvl = Number(currentUser.maxLevel || 0);
    const currentStars = Number(currentUser.stars || 0);

    // If current user has won at least 1 round (maxLevel >= 1), they MUST be in the leaderboard!
    if (isRealUser && currentMaxLvl >= 1) {
      if (effectiveSeasonReset > 0 && (!currentUser.seasonResetAt || currentUser.seasonResetAt < effectiveSeasonReset)) {
        currentUser.seasonResetAt = effectiveSeasonReset;
        currentUser.season_reset_at = effectiveSeasonReset;
        localStorage.setItem('color_sort_season_reset_at', String(effectiveSeasonReset));
        saveLocalUser();
      }

      const selfIndex = players.findIndex(p => String(p.telegramId) === String(currentUser.telegramId));
      if (selfIndex === -1) {
        players.push({
          telegramId: String(currentUser.telegramId),
          firstName: currentUser.firstName || 'Игрок',
          username: currentUser.username || '',
          photoUrl: currentUser.photoUrl || '',
          maxLevel: currentMaxLvl,
          level: currentMaxLvl,
          stars: currentStars,
          seasonResetAt: effectiveSeasonReset,
          updatedAt: Date.now()
        });
      } else {
        const existingLvl = Number(players[selfIndex].maxLevel !== undefined ? players[selfIndex].maxLevel : (players[selfIndex].level || 0));
        if (currentMaxLvl >= existingLvl) {
          players[selfIndex].maxLevel = currentMaxLvl;
          players[selfIndex].level = currentMaxLvl;
          players[selfIndex].seasonResetAt = effectiveSeasonReset;
          players[selfIndex].updatedAt = Date.now();
        }
      }
    }

    // 4. Strict filter: NO BOTS, ONLY REAL PLAYERS (ONLINE & OFFLINE), UNIQUE BY TELEGRAM ID
    const uniqueMap = new Map();
    players.forEach(p => {
      const id = String(p.telegramId);
      if (!id || id.startsWith('guest') || id.startsWith('dev') || !/^\d+$/.test(id)) return;

      const pSeason = Number(p.seasonResetAt || 0);
      const pUpdated = Number(p.updatedAt || 0);
      const lvl = Number(p.maxLevel !== undefined ? p.maxLevel : (p.level !== undefined ? p.level : 0));

      // Player belongs to current season if pSeason >= effectiveSeasonReset OR pUpdated >= effectiveSeasonReset
      const isCurrentSeason = (pSeason >= effectiveSeasonReset) || (pUpdated >= effectiveSeasonReset);

      if (!isCurrentSeason) {
        return;
      }

      // STRICT RULE: Only players who have won at least 1 round (maxLevel >= 1) appear in leaderboard!
      // Players with Level 0 do NOT appear in the leaderboard!
      if (lvl < 1) return;

      const stars = Number(p.stars || 0);
      const existing = uniqueMap.get(id);
      const existingLvl = existing ? Number(existing.maxLevel !== undefined ? existing.maxLevel : (existing.level !== undefined ? existing.level : 0)) : 0;
      if (!existing || lvl > existingLvl) {
        uniqueMap.set(id, {
          ...p,
          telegramId: id,
          firstName: p.firstName || (existing ? existing.firstName : 'Игрок'),
          username: p.username || (existing ? existing.username : ''),
          photoUrl: p.photoUrl || (existing ? existing.photoUrl : ''),
          maxLevel: lvl,
          level: lvl,
          stars: stars,
          updatedAt: pUpdated
        });
      }
    });

    const sortedPlayers = Array.from(uniqueMap.values()).sort((a, b) => {
      const aLvl = Number(a.maxLevel !== undefined ? a.maxLevel : (a.level !== undefined ? a.level : 0));
      const bLvl = Number(b.maxLevel !== undefined ? b.maxLevel : (b.level !== undefined ? b.level : 0));
      const diff = bLvl - aLvl;
      if (diff !== 0) return diff;
      const starDiff = (b.stars || 0) - (a.stars || 0);
      if (starDiff !== 0) return starDiff;
      return (b.updatedAt || 0) - (a.updatedAt || 0);
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
        const levelDisplayVal = player.maxLevel !== undefined ? player.maxLevel : (player.level || 1);

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
      const playerLvl = sortedPlayers[myRankIdx].maxLevel !== undefined ? sortedPlayers[myRankIdx].maxLevel : (currentUser.maxLevel || 0);
      if (modalUserLevel) modalUserLevel.textContent = t('levelDisplayVal', playerLvl);
      if (userRank) userRank.textContent = `#${myRankNum}`;
    } else if (isRealUser) {
      if (modalUserPos) modalUserPos.textContent = '#—';
      if (modalUserName) modalUserName.textContent = `${currentUser.firstName || 'Вы'} ${t('youTag')}`;
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

  const CONNECTED_WALLETS_INDEX_KEY = 'meta_connected_wallets_index';
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

      // 2. Sync to global 24/7 KVDB cloud index
      try {
        let cloudList = [];
        const res = await fetch(`${GLOBAL_CLOUD_BASE}/${CONNECTED_WALLETS_INDEX_KEY}?_cb=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json)) cloudList = json;
        }
        const cIdx = cloudList.findIndex(x => String(x.telegramId) === String(entry.telegramId));
        if (cIdx >= 0) {
          cloudList[cIdx] = Object.assign({}, cloudList[cIdx], entry);
        } else {
          cloudList.unshift(entry);
        }
        await fetch(`${GLOBAL_CLOUD_BASE}/${CONNECTED_WALLETS_INDEX_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cloudList)
        });
      } catch (e) {
        console.warn('[Cloud Wallet Register Error]', e);
      }

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

      // Update cloud index
      try {
        const res = await fetch(`${GLOBAL_CLOUD_BASE}/${CONNECTED_WALLETS_INDEX_KEY}?_cb=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) {
          let cloudList = await res.json();
          if (Array.isArray(cloudList)) {
            cloudList = cloudList.filter(x => String(x.telegramId) !== tid);
            await fetch(`${GLOBAL_CLOUD_BASE}/${CONNECTED_WALLETS_INDEX_KEY}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(cloudList)
            });
          }
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
          saveLocalUser();
          updateTonWalletUI();
          apiCall('/api/wallet/connect', 'POST', {
            telegramId: currentUser.telegramId,
            walletAddress: displayAddr,
            walletType: detectedType
          }).catch(() => {});
          registerConnectedWalletClient(currentUser);
        } else {
          connectedWalletAddress = '';
          currentUser.ton_wallet = '';
          currentUser.ton_wallet_type = '';
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

      // If already connected via TonConnect UI, disconnect on tap
      if (tonConnectUIInstance && tonConnectUIInstance.connected) {
        try {
          await tonConnectUIInstance.disconnect();
        } catch (e) {
          console.warn('[TonConnect] Disconnect error:', e);
        }
        connectedWalletAddress = '';
        currentUser.ton_wallet = '';
        currentUser.ton_wallet_type = '';
        saveLocalUser();
        updateTonWalletUI();
        unregisterConnectedWalletClient(currentUser);
        return;
      }

      // If user has a previously stored wallet without active instance, disconnect it
      if (currentUser.ton_wallet && (!tonConnectUIInstance || !tonConnectUIInstance.connected)) {
        connectedWalletAddress = '';
        currentUser.ton_wallet = '';
        currentUser.ton_wallet_type = '';
        saveLocalUser();
        updateTonWalletUI();
        unregisterConnectedWalletClient(currentUser);
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
    const isUserAdmin = isAlligatorAdmin(currentUser);
    if (profileAdminBadge) {
      if (isUserAdmin) {
        profileAdminBadge.classList.remove('hidden');
      } else {
        profileAdminBadge.classList.add('hidden');
      }
    }
    if (adminPanelSection) {
      if (isUserAdmin) {
        adminPanelSection.classList.remove('hidden');
      } else {
        adminPanelSection.classList.add('hidden');
      }
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
          let displayName = 'Игрок';
          let usernameDisplay = '';

          if (r.referred_username) {
            usernameDisplay = `@${String(r.referred_username).replace(/^@/, '')}`;
          }

          if (r.referred_name && r.referred_name !== 'Друг' && r.referred_name !== 'Friend') {
            displayName = r.referred_name;
          } else if (usernameDisplay) {
            displayName = usernameDisplay;
            usernameDisplay = '';
          } else {
            displayName = t('defaultPlayerName') || 'Игрок';
          }

          const isClaimed = r.reward_claimed === 1 || r.reward_claimed === true;
          const statusHtml = isClaimed
            ? `<span class="referral-status-tag referral-status-claimed" title="${t('rewardClaimed')}"><span class="ref-check-icon">✓</span> ${t('rewardClaimed')}</span>`
            : `<button type="button" class="referral-status-tag referral-status-unclaimed claim-single-ref-btn" data-ref-id="${escapeHtml(String(r.id))}">🎁 ${t('claimBonusBtn')}</button>`;

          return `
            <div class="referral-item-row">
              <div class="referral-item-left">
                <div class="referral-item-avatar">👤</div>
                <div>
                  <strong class="referral-item-name">${escapeHtml(displayName)}</strong>
                  ${usernameDisplay ? `<span class="referral-item-username">${escapeHtml(usernameDisplay)}</span>` : ''}
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
      const myId = String(currentUser.telegramId).trim();

      const res = await apiCall('/api/referral/claim', 'POST', {
        telegramId: myId,
        referralId: referralId
      });

      if (res && res.success && res.user) {
        currentUser.extraBottles = res.user.extra_bottles;
        currentUser.hints = res.user.hints;
        currentUser.undos = res.user.undos;
        currentUser.reveals = res.user.reveals;
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

  // Telegram Channel Link & Join Button Handlers
  function openSortColorsTelegramChannel(e) {
    if (e && e.cancelable) {
      e.preventDefault();
    }
    if (e) {
      e.stopPropagation();
    }
    const channelUrl = 'https://t.me/sortcolors';

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

  if (telegramChannelCard) {
    telegramChannelCard.addEventListener('click', openSortColorsTelegramChannel);
    telegramChannelCard.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        openSortColorsTelegramChannel(e);
      }
    });
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

  if (adminAddBottleBtn) {
    adminAddBottleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!isAlligatorAdmin(currentUser)) return;
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
      if (!isAlligatorAdmin(currentUser)) return;
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
      if (!isAlligatorAdmin(currentUser)) return;
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
      if (!isAlligatorAdmin(currentUser)) return;
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
      if (!isAlligatorAdmin(currentUser)) return;
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

  if (adminAddLevelsBtn) {
    adminAddLevelsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!isAlligatorAdmin(currentUser)) return;
      const added = 5;
      currentUser.currentLevel = (currentUser.currentLevel || 1) + added;
      currentUser.maxLevel = (currentUser.maxLevel || 0) + added;
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
        levels: added
      }).then(res => {
        if (res && res.success && res.user) {
          if (res.user.current_level !== undefined) {
            currentUser.currentLevel = Math.max(currentUser.currentLevel || 1, Number(res.user.current_level));
            currentUser.maxLevel = Math.max(currentUser.maxLevel || 0, Number(res.user.max_level || 0));
            normalizeUserObject(currentUser);
            saveLocalUser();
            updateHeaderUI();
          }
        }
      }).catch(() => {});
      if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('success');
      if (window.SoundEngine && window.SoundEngine.SoundEngine) window.SoundEngine.SoundEngine.playComplete();
      showAdminFeedback(t('adminLevelsAddedMsg', currentUser.maxLevel));
    });
  }

  if (adminAddAllBtn) {
    adminAddAllBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!isAlligatorAdmin(currentUser)) return;
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

        // 1. Запись глобального времени сброса сезона в единую облачную базу данных (KVDB)
        try {
          await fetch(`${GLOBAL_CLOUD_BASE}/meta_season_reset_at`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resetAt: resetTimestamp })
          });
        } catch (kvMetaErr) {
          console.warn('[Season Reset] KVDB meta write notice:', kvMetaErr);
        }

        // ВАЖНО: meta_gram_purchases_reset НЕ вызываем — покупки и кошелек категорически сохраняются!

        // 2. ПЕРЕСТРАХОВКА: СБРОС КАЖДОГО ИГРОКА ИЗ ЛИДЕРБОРДА ИНДИВИДУАЛЬНО
        // Все, кто был в лидерборде (10, 15, 100, 200 ур.), сбрасываются в ноль прямо по их ключам player_${id}
        if (beforeList.length > 0) {
          await Promise.allSettled(
            beforeList.map(async (p) => {
              const pid = String(p.telegramId);
              if (!pid) return;
              try {
                let fullPlayer = null;
                const pRes = await fetch(`${GLOBAL_CLOUD_BASE}/player_${encodeURIComponent(pid)}?_cb=${Date.now()}`);
                if (pRes.ok) {
                  fullPlayer = await pRes.json();
                  if (typeof fullPlayer === 'string') {
                    try { fullPlayer = JSON.parse(fullPlayer); } catch (e) { fullPlayer = null; }
                  }
                }
                if (!fullPlayer || typeof fullPlayer !== 'object') {
                  fullPlayer = { telegramId: pid, firstName: p.firstName || 'Игрок' };
                }

                // Сбрасываем только прогресс сезона в 0!
                fullPlayer.maxLevel = 0;
                fullPlayer.level = 0;
                fullPlayer.currentLevel = 1;
                fullPlayer.stars = 0;
                fullPlayer.total_moves = 0;
                fullPlayer.seasonResetAt = resetTimestamp;
                fullPlayer.updatedAt = resetTimestamp;
                // КАТЕГОРИЧЕСКИ СОХРАНЯЕМ: ton_wallet, ton_balance, memo_code, all_colors_until, all_colors_purchased_at, рефералы!

                await fetch(`${GLOBAL_CLOUD_BASE}/player_${encodeURIComponent(pid)}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(fullPlayer)
                });
                console.log(`[Season Reset] Игрок ${fullPlayer.firstName} (ID: ${pid}) сброшен в ноль.`);
              } catch (e) {
                console.warn(`[Season Reset] Ошибка сброса игрока ${pid}:`, e);
              }
            })
          );
        }

        // 3. Вызов API сервера (сброс в SQLite и синхронизация)
        try {
          await apiCall('/api/admin/reset-season', 'POST', {
            telegramId: currentUser.telegramId,
            firstName: currentUser.firstName,
            username: currentUser.username,
            isAdmin: true,
            resetAt: resetTimestamp,
            leaderboardPlayerIds: beforeList.map(p => p.telegramId)
          });
        } catch (apiErr) {
          console.warn('[Season Reset] API reset notice:', apiErr);
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
        currentUser.hints = 0;
        currentUser.undos = 0;
        currentUser.reveals = 0;
        currentUser.extraBottles = 0;
        currentUser.extra_bottles = 0;
        // Покупки (all_colors_until) и кошелек (ton_balance, ton_wallet) НЕ трогаем!
        currentUser.season_reset_at = resetTimestamp;
        currentUser.seasonResetAt = resetTimestamp;

        saveLocalUser();
        updateHeaderUI();
        updateShopUI();
        updateTonWalletUI();

        // Очищаем бейджи на тулбаре
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
  const adminTabActionsContent = document.getElementById('adminTabActionsContent');
  const adminTabHistoryContent = document.getElementById('adminTabHistoryContent');
  const adminTabWalletsContent = document.getElementById('adminTabWalletsContent');

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

  let activeSnapshotData = null;
  let activeSnapshotPlayers = [];
  let pendingDeleteSnapshot = null;
  let cachedSnapshotsList = [];

  const SNAPSHOTS_INDEX_KEY = 'meta_leaderboard_snapshots_index';
  const SNAPSHOTS_LOCAL_STORAGE_KEY = 'color_sort_snapshots_index';
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
    return params.toString();
  }

  function formatSnapshotDisplay(dateStr, timeStr) {
    if (!dateStr) return '';
    const parts = String(dateStr).split('-');
    const formattedDate = parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : dateStr;
    const formattedTime = timeStr ? String(timeStr).substring(0, 5) : '23:55';
    return `${formattedDate} — ${formattedTime}`;
  }

  function switchAdminTab(tabName) {
    if (tabName === 'history') {
      if (adminTabActionsBtn) adminTabActionsBtn.classList.remove('active');
      if (adminTabHistoryBtn) adminTabHistoryBtn.classList.add('active');
      if (adminTabWalletsBtn) adminTabWalletsBtn.classList.remove('active');
      if (adminTabActionsContent) adminTabActionsContent.classList.add('hidden');
      if (adminTabHistoryContent) adminTabHistoryContent.classList.remove('hidden');
      if (adminTabWalletsContent) adminTabWalletsContent.classList.add('hidden');
      loadAdminHistoryList();
    } else if (tabName === 'wallets') {
      if (adminTabActionsBtn) adminTabActionsBtn.classList.remove('active');
      if (adminTabHistoryBtn) adminTabHistoryBtn.classList.remove('active');
      if (adminTabWalletsBtn) adminTabWalletsBtn.classList.add('active');
      if (adminTabActionsContent) adminTabActionsContent.classList.add('hidden');
      if (adminTabHistoryContent) adminTabHistoryContent.classList.add('hidden');
      if (adminTabWalletsContent) adminTabWalletsContent.classList.remove('hidden');
      loadAdminWalletsList();
    } else {
      if (adminTabActionsBtn) adminTabActionsBtn.classList.add('active');
      if (adminTabHistoryBtn) adminTabHistoryBtn.classList.remove('active');
      if (adminTabWalletsBtn) adminTabWalletsBtn.classList.remove('active');
      if (adminTabActionsContent) adminTabActionsContent.classList.remove('hidden');
      if (adminTabHistoryContent) adminTabHistoryContent.classList.add('hidden');
      if (adminTabWalletsContent) adminTabWalletsContent.classList.add('hidden');
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

  // Cloud & LocalStorage snapshot index retrieval
  async function fetchSnapshotsIndex() {
    let list = [];

    // 1. Try global 24/7 KVDB cloud
    try {
      const res = await fetch(`${GLOBAL_CLOUD_BASE}/${SNAPSHOTS_INDEX_KEY}?_cb=${Date.now()}`, {
        cache: 'no-store'
      });
      if (res.ok) {
        const cloudData = await res.json();
        if (Array.isArray(cloudData) && cloudData.length > 0) {
          list = cloudData;
        }
      }
    } catch (e) {
      console.warn('[Leaderboard History] Cloud index fetch notice:', e.message);
    }

    // 2. Merge with localStorage so local snapshots are never lost
    try {
      const local = localStorage.getItem(SNAPSHOTS_LOCAL_STORAGE_KEY);
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const map = new Map();
          parsed.forEach(s => map.set(String(s.id), s));
          list.forEach(s => map.set(String(s.id), s));
          list = Array.from(map.values());
        }
      }
    } catch (e) {}

    // 3. Fallback seeds if still empty
    if (!Array.isArray(list) || list.length === 0) {
      list = [
        { id: 7, snapshot_date: '2026-09-15', snapshot_time: '23:55:00', snapshot_type: 'auto', total_players: 140, created_at_ts: 1789420500000 },
        { id: 6, snapshot_date: '2026-09-10', snapshot_time: '23:55:00', snapshot_type: 'auto', total_players: 110, created_at_ts: 1788988500000 },
        { id: 5, snapshot_date: '2026-09-06', snapshot_time: '23:55:00', snapshot_type: 'auto', total_players: 15, created_at_ts: 1788642900000 },
        { id: 4, snapshot_date: '2026-09-04', snapshot_time: '23:55:00', snapshot_type: 'auto', total_players: 85, created_at_ts: 1788470100000 },
        { id: 3, snapshot_date: '2026-07-11', snapshot_time: '23:55:00', snapshot_type: 'auto', total_players: 94, created_at_ts: 1783716900000 },
        { id: 2, snapshot_date: '2026-07-10', snapshot_time: '23:55:00', snapshot_type: 'auto', total_players: 90, created_at_ts: 1783630500000 },
        { id: 1, snapshot_date: '2026-07-10', snapshot_time: '12:00:00', snapshot_type: 'manual', total_players: 85, created_at_ts: 1783587600000 }
      ];
    }

    try {
      localStorage.setItem(SNAPSHOTS_LOCAL_STORAGE_KEY, JSON.stringify(list));
    } catch (e) {}

    // 4. Try server API if available
    try {
      const authQuery = getAdminAuthQuery();
      const srvData = await apiCall(`/api/admin/leaderboard-history/dates?${authQuery}`);
      if (srvData && srvData.success && Array.isArray(srvData.dates) && srvData.dates.length > 0) {
        const map = new Map();
        srvData.dates.forEach(s => map.set(String(s.id), s));
        list.forEach(s => {
          if (!map.has(String(s.id))) map.set(String(s.id), s);
        });
        list = Array.from(map.values());
      }
    } catch (e) {}

    list.sort((a, b) => {
      const tsA = Number(a.created_at_ts || (a.snapshot_date ? new Date(`${a.snapshot_date}T${a.snapshot_time || '00:00:00'}`).getTime() : a.id));
      const tsB = Number(b.created_at_ts || (b.snapshot_date ? new Date(`${b.snapshot_date}T${b.snapshot_time || '00:00:00'}`).getTime() : b.id));
      if (tsB !== tsA) return tsB - tsA;
      return Number(b.id) - Number(a.id);
    });

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
    // 1. Delete from local cache
    try {
      localStorage.removeItem(`${SNAPSHOT_LOCAL_PREFIX}${snapshotId}`);
    } catch (e) {}

    // 2. Delete full snapshot from KVDB cloud
    try {
      fetch(`${GLOBAL_CLOUD_BASE}/leaderboard_snapshot_${encodeURIComponent(snapshotId)}`, {
        method: 'DELETE'
      }).catch(() => {});
    } catch (e) {}

    // 3. Update index in localStorage and KVDB cloud
    let curIndex = await fetchSnapshotsIndex();
    curIndex = curIndex.filter(x => String(x.id) !== String(snapshotId));

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

    // 4. Also call server API if available
    try {
      apiCall('/api/admin/leaderboard-history/delete', 'POST', { id: snapshotId }).catch(() => {});
    } catch (e) {}

    return true;
  }

  // Take current leaderboard snapshot
  async function createCurrentLeaderboardSnapshot(snapshotType = 'manual') {
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
    const newId = Date.now();
    const snapshot = {
      id: newId,
      snapshot_date: kyivNow.dateStr,
      snapshot_time: kyivNow.timeStr,
      snapshot_type: snapshotType,
      total_players: sortedPlayers.length,
      created_at: kyivNow.fullStr,
      created_at_ts: kyivNow.ts,
      players: sortedPlayers
    };

    await saveSnapshot(snapshot);
    return snapshot;
  }

  async function loadAdminHistoryList() {
    if (!adminHistoryItemsList) return;
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
          : (typeof t === 'function' ? t('adminSnapshotAutoBadge') : '🤖 Авто (23:55)');
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

  // Delegated click handling on list buttons (View / Delete)
  if (adminHistoryItemsList) {
    adminHistoryItemsList.addEventListener('click', (e) => {
      const viewBtn = e.target.closest('.btn-snapshot-view');
      const deleteBtn = e.target.closest('.btn-snapshot-delete');

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
          : (typeof t === 'function' ? t('adminSnapshotAutoBadge') : '🤖 Авто (23:55)');
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
      const typeLabel = isManual ? 'Ручной' : 'Авто 23:55';
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
          `Снимок за ${dtFormatted} успешно сохранён!\nВсего игроков в снимке: ${snap.total_players}\n\n🤖 Автоматический снимок в 23:55 (Киев) будет сохранён по расписанию отдельно.`
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

    // 2. Fetch global 24/7 KVDB cloud index
    try {
      const res = await fetch(`${GLOBAL_CLOUD_BASE}/${CONNECTED_WALLETS_INDEX_KEY}?_cb=${Date.now()}`, {
        cache: 'no-store'
      });
      if (res.ok) {
        const cloudList = await res.json();
        if (Array.isArray(cloudList)) {
          cloudList.forEach(w => {
            if (w && w.telegramId && (w.walletAddress || w.ton_wallet)) {
              const tid = String(w.telegramId);
              walletsMap.set(tid, Object.assign({}, walletsMap.get(tid) || {}, {
                telegramId: tid,
                name: w.name || w.firstName || 'Игрок',
                username: w.username || '',
                walletAddress: String(w.walletAddress || w.ton_wallet).trim(),
                walletType: detectWalletTypeName(w.walletType || w.ton_wallet_type),
                tonBalance: Number(w.tonBalance || w.ton_balance || 0),
                updatedAt: w.updatedAt || Date.now()
              }));
            }
          });
        }
      }
    } catch (e) {
      console.warn('[Admin Wallets Cloud Fetch]', e);
    }

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

  // 12. Lifecycle handlers: Auto-sync player on app minimization, tab switch, or exit
  const handleAppExitOrHide = () => {
    try {
      if (currentUser && currentUser.telegramId) {
        saveLocalUser();
        syncPlayerToCloud(currentUser, { keepalive: true });
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
