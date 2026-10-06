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
    let u = (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) ? tg.initDataUnsafe.user : null;

    // Fallback 1: Parse from tg.initData, window.location.hash, or window.location.search
    if (!u) {
      try {
        const rawInit = (tg && tg.initData) || 
                        (typeof window !== 'undefined' && window.location.hash ? window.location.hash.replace(/^#/, '') : '') || 
                        (typeof window !== 'undefined' && window.location.search ? window.location.search.replace(/^\?/, '') : '');
        if (rawInit) {
          const params = new URLSearchParams(rawInit);
          const tgWebAppData = params.get('tgWebAppData') || rawInit;
          const innerParams = new URLSearchParams(tgWebAppData);
          const userStr = innerParams.get('user') || params.get('user');
          if (userStr) {
            try {
              u = JSON.parse(decodeURIComponent(userStr));
            } catch (e1) {
              try {
                u = JSON.parse(decodeURIComponent(decodeURIComponent(userStr)));
              } catch (e2) {}
            }
          }
        }
      } catch (e) {}
    }

    if (u && u.id) {
      const id = String(u.id);
      const cleanUname = u.username ? String(u.username).replace(/^@/, '').trim() : '';
      const isDummyFirst = !u.first_name || u.first_name === 'Игрок' || u.first_name === 'Player' || u.first_name.trim() === '.';
      const effectiveFirst = !isDummyFirst ? u.first_name : (cleanUname ? `@${cleanUname}` : (u.first_name || 'Игрок'));

      try {
        localStorage.setItem('cs_last_telegram_id', id);
        if (effectiveFirst) localStorage.setItem('cs_last_first_name', effectiveFirst);
        if (cleanUname) localStorage.setItem('cs_last_username', cleanUname);
        if (u.photo_url) localStorage.setItem('cs_last_photo_url', u.photo_url);
      } catch (e) {}
      return {
        telegramId: id,
        firstName: effectiveFirst,
        username: cleanUname,
        photoUrl: u.photo_url || `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${id}`
      };
    }

    // Fallback 2: Check cached Telegram ID from localStorage so reloads never downgrade to guest
    const cachedId = localStorage.getItem('cs_last_telegram_id');
    if (cachedId && /^\d+$/.test(cachedId)) {
      const cachedFirst = localStorage.getItem('cs_last_first_name');
      const cachedUname = localStorage.getItem('cs_last_username') || '';
      const cleanCachedUname = cachedUname ? String(cachedUname).replace(/^@/, '').trim() : '';
      const isDummy = !cachedFirst || cachedFirst === 'Игрок' || cachedFirst === 'Player' || cachedFirst.trim() === '.';
      const effectiveFirst = !isDummy ? cachedFirst : (cleanCachedUname ? `@${cleanCachedUname}` : 'Игрок');
      return {
        telegramId: cachedId,
        firstName: effectiveFirst,
        username: cleanCachedUname,
        photoUrl: localStorage.getItem('cs_last_photo_url') || `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${cachedId}`
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
