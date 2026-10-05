/**
 * Telegram WebApp Integration Helper
 */
(function (exports) {
  let tg = null;

  function initTelegram() {
    if (window.Telegram && window.Telegram.WebApp) {
      tg = window.Telegram.WebApp;
      if (tg.setHeaderColor) {
        try { tg.setHeaderColor('#070913'); } catch (e) {}
      }
      if (tg.setBackgroundColor) {
        try { tg.setBackgroundColor('#070913'); } catch (e) {}
      }
      tg.expand();
      try {
        if (tg.requestFullscreen) {
          tg.requestFullscreen();
        }
      } catch (e) {
        console.warn('[Telegram WebApp] requestFullscreen failed', e);
      }

      if (tg.disableVerticalSwipes) {
        try { tg.disableVerticalSwipes(); } catch (e) {}
      }

      tg.ready();

      document.body.classList.add('tg-theme');

      if (tg.enableClosingConfirmation) {
        try { tg.enableClosingConfirmation(); } catch (e) {}
      }
      if (tg.initData) {
        try { localStorage.setItem('color_sort_last_init_data', tg.initData); } catch (e) {}
      }
      console.log('[Telegram WebApp] Initialized successfully.', tg.initDataUnsafe);
    } else {
      console.warn('[Telegram WebApp] Telegram SDK not detected. Running in standard web browser mode.');
    }
  }

  function getUserData() {
    if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
      const u = tg.initDataUnsafe.user;
      const id = String(u.id);
      return {
        telegramId: id,
        firstName: u.first_name || 'Игрок',
        username: u.username || '',
        photoUrl: u.photo_url || `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${id}`
      };
    }
    let guestId = localStorage.getItem('cs_guest_id');
    if (!guestId) {
      guestId = 'tg_user_' + Math.floor(Math.random() * 899999 + 100000);
      localStorage.setItem('cs_guest_id', guestId);
    }
    return {
      telegramId: guestId,
      firstName: 'Игрок',
      username: '',
      photoUrl: `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${guestId}`
    };
  }

  function haptic(type = 'light') {
    if (tg && tg.HapticFeedback) {
      try {
        if (['light', 'medium', 'heavy'].includes(type)) {
          tg.HapticFeedback.impactOccurred(type);
        } else if (['success', 'error', 'warning'].includes(type)) {
          tg.HapticFeedback.notificationOccurred(type);
        } else if (type === 'selection') {
          tg.HapticFeedback.selectionChanged();
        }
      } catch (e) {
        console.error('[Haptic Error]', e);
      }
    }
  }

  function showAlert(message) {
    if (tg && tg.showAlert) {
      tg.showAlert(message);
    } else {
      alert(message);
    }
  }

  function showBackButton(callback) {
    if (tg && tg.BackButton) {
      tg.BackButton.show();
      tg.BackButton.onClick(callback);
    }
  }

  function hideBackButton() {
    if (tg && tg.BackButton) {
      tg.BackButton.hide();
    }
  }

  function isInTelegram() {
    return !!(window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData);
  }

  function getInitData() {
    if (tg && tg.initData) {
      return tg.initData;
    }
    try {
      return localStorage.getItem('color_sort_last_init_data') || '';
    } catch (e) {
      return '';
    }
  }

  const telegramAPI = {
    initTelegram,
    getUserData,
    getInitData,
    haptic,
    showAlert,
    requestFullscreen: () => {
      if (tg && tg.requestFullscreen) {
        try { tg.requestFullscreen(); } catch (e) {}
      }
    },
    showBackButton,
    hideBackButton,
    isInTelegram
  };
  Object.assign(exports, telegramAPI);
  exports.TelegramApp = telegramAPI;
  try { initTelegram(); } catch (e) {}
})(typeof exports !== 'undefined' ? exports : (window.TelegramApp = {}));
