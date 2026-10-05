/**
 * Gifts Module for Color Sort Game
 * Independent module for sending and receiving gifts between players.
 */
(function(window) {
  'use strict';

  const GLOBAL_CLOUD_BUCKET = '82kzJTUxZwwFNvg7kUSqgM';
  const GLOBAL_CLOUD_BASE = 'https://kvdb.io/' + GLOBAL_CLOUD_BUCKET;
  const MAX_DAILY_GIFTS = 10;

  function getApiBase() {
    if (typeof window !== 'undefined' && window.COLOR_SORT_API_URL) {
      return window.COLOR_SORT_API_URL;
    }
    if (typeof window !== 'undefined' && (window.location.hostname.includes('github.io') || window.location.protocol === 'file:')) {
      return 'https://colorsortgame.vercel.app';
    }
    return '';
  }

  async function giftApiCall(endpoint, method = 'GET', body = null) {
    const base = getApiBase();
    try {
      const options = {
        method,
        headers: { 'Content-Type': 'application/json' },
        signal: (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') ? AbortSignal.timeout(3500) : undefined
      };
      if (body) options.body = JSON.stringify(body);
      const res = await fetch(base + endpoint, options);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  // 4 allowed gift types and their config
  const GIFT_CONFIG = {
    undos: {
      type: 'undos',
      name: 'Отмена хода',
      icon: '↩️',
      boosterField: 'undos'
    },
    hints: {
      type: 'hints',
      name: 'Подсказка',
      icon: '💡',
      boosterField: 'hints'
    },
    reveals: {
      type: 'reveals',
      name: 'Открыть цвет',
      icon: '🔮',
      boosterField: 'reveals'
    },
    extraBottles: {
      type: 'extraBottles',
      name: 'Пустая колба',
      icon: '🧪',
      boosterField: 'extraBottles'
    }
  };

  let currentUserRef = null;
  let saveUserCallback = null;
  let updateUICallback = null;
  let updateCloudBoosterCallback = null;
  let showInfoModalCallback = null;
  let getLeaderboardPlayersCallback = null;
  let isAdminCheckCallback = null;

  let currentLang = 'ru';
  let tCallback = null;

  function t(key, ...args) {
    if (typeof tCallback === 'function') {
      try {
        const res = tCallback(key, ...args);
        if (res !== undefined && res !== null && res !== '') return res;
      } catch (e) {}
    }
    if (window.TRANSLATIONS) {
      const dict = window.TRANSLATIONS[currentLang] || window.TRANSLATIONS.ru || {};
      const val = dict[key] !== undefined ? dict[key] : ((window.TRANSLATIONS.ru && window.TRANSLATIONS.ru[key]) || '');
      if (typeof val === 'function') return val(...args);
      if (val !== undefined && val !== null && val !== '') return val;
    }
    return key;
  }

  function getGiftName(type) {
    if (type === 'undos') return t('giftItemUndo') || 'Отмена хода';
    if (type === 'hints') return t('giftItemHint') || 'Подсказка';
    if (type === 'reveals') return t('giftItemReveal') || 'Открыть цвет';
    if (type === 'extraBottles') return t('giftItemBottle') || 'Пустая колба';
    return (GIFT_CONFIG[type] && GIFT_CONFIG[type].name) || type;
  }

  let cachedInbox = [];
  let cachedPlayers = [];
  let selectedRecipient = null;
  let isSending = false;
  let isClaiming = false;
  let activeSubnav = 'receive'; // 'receive' or 'send'
  let pollingInterval = null;
  let pendingGiftType = null;
  let pendingMaxQty = 1;
  let currentGiftQty = 1;

  // Time & Daily Limit Helpers
  function getKyivDateTime() {
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

  function getDailyStats(userId) {
    const today = getKyivDateTime().dateStr;
    const key = `colorsort_gifts_daily_${userId}`;
    let stats = { date: today, count: 0 };
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.date === today) {
          stats.count = Number(parsed.count) || 0;
        }
      }
    } catch (e) {}
    return stats;
  }

  function incrementDailyStats(userId, amount = 1) {
    const today = getKyivDateTime().dateStr;
    const key = `colorsort_gifts_daily_${userId}`;
    const stats = getDailyStats(userId);
    stats.count += Number(amount) || 1;
    stats.date = today;
    try {
      localStorage.setItem(key, JSON.stringify(stats));
    } catch (e) {}
    return stats.count;
  }

  function getUserBoosterCount(field) {
    if (!currentUserRef) return 0;
    if (field === 'extraBottles') {
      return Math.max(Number(currentUserRef.extraBottles || 0), Number(currentUserRef.extra_bottles || 0));
    }
    return Number(currentUserRef[field] || 0);
  }

  // Persistent Claimed Gift IDs tracking to eliminate delays and prevent stale network overwrite
  const CLAIMED_GIFTS_KEY = 'colorsort_claimed_gift_ids';

  function getClaimedGiftIds(userId) {
    if (!userId) return new Set();
    try {
      const raw = localStorage.getItem(`${CLAIMED_GIFTS_KEY}_${userId}`);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return new Set(arr.map(String));
      }
    } catch (e) {}
    return new Set();
  }

  function markGiftIdAsClaimed(userId, giftId) {
    if (!userId || !giftId) return;
    try {
      const set = getClaimedGiftIds(userId);
      set.add(String(giftId));
      const arr = Array.from(set);
      const trimmed = arr.length > 500 ? arr.slice(-500) : arr;
      localStorage.setItem(`${CLAIMED_GIFTS_KEY}_${userId}`, JSON.stringify(trimmed));
    } catch (e) {}
  }

  function isGiftIdClaimed(userId, giftId) {
    if (!userId || !giftId) return false;
    const set = getClaimedGiftIds(userId);
    return set.has(String(giftId));
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function showNotification(icon, title, text) {
    if (typeof showInfoModalCallback === 'function') {
      showInfoModalCallback(icon, title, text);
    } else {
      alert(`${icon} ${title}\n${text}`);
    }
  }

  function isUserAdmin(user) {
    if (typeof isAdminCheckCallback === 'function') {
      try {
        if (isAdminCheckCallback(user)) return true;
      } catch (e) {}
    }
    if (!user) return false;
    if (user.isAdmin === true) return true;

    const tid = String(user.telegramId || '').trim();
    const uname = String(user.username || '').toLowerCase().replace(/^@/, '').trim();
    const fname = String(user.firstName || '').toLowerCase().trim();

    if (tid === '5761685341') return true;
    if (uname.includes('alligator') || uname.includes('аллигатор')) return true;
    if (uname.includes('romanchik') || uname.includes('романчик')) return true;
    if (fname.includes('alligator') || fname.includes('аллигатор')) return true;
    if (fname.includes('romanchik') || fname.includes('романчик')) return true;

    try {
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('admin') === 'true') return true;
        if (localStorage.getItem('color_sort_admin_mode') === 'true') return true;
      }
    } catch (e) {}

    return false;
  }

  // Cloud & Server Endpoints for Gifts
  async function fetchCloudInbox(userId) {
    if (!userId) return [];
    let inbox = [];
    const seenIds = new Set();
    const claimedSet = getClaimedGiftIds(userId);

    const markIfClaimed = (g) => {
      if (!g || !g.id) return;
      if (claimedSet.has(String(g.id)) || g.claimed) {
        g.claimed = true;
        g.claimedAt = g.claimedAt || Date.now();
        // ensure persistent set has it too
        markGiftIdAsClaimed(userId, g.id);
      }
    };

    // 1. Try server API first (fast, reliable SQLite storage, no 429 rate limit)
    try {
      const serverRes = await giftApiCall(`/api/gifts/inbox?telegramId=${encodeURIComponent(userId)}`);
      if (serverRes && serverRes.success && Array.isArray(serverRes.gifts)) {
        serverRes.gifts.forEach(g => {
          if (g && g.id && !seenIds.has(String(g.id))) {
            seenIds.add(String(g.id));
            markIfClaimed(g);
            inbox.push(g);
          }
        });
      }
    } catch (e) {}

    // 2. Also check KVDB cloud storage
    try {
      const res = await fetch(`${GLOBAL_CLOUD_BASE}/gifts_inbox_${encodeURIComponent(userId)}?_cb=${Date.now()}`, {
        cache: 'no-store',
        signal: (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') ? AbortSignal.timeout(2500) : undefined
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          data.forEach(g => {
            if (g && g.id && !seenIds.has(String(g.id))) {
              seenIds.add(String(g.id));
              markIfClaimed(g);
              inbox.push(g);
            }
          });
        }
      }
    } catch (err) {}

    // 3. Fallback / merge local storage
    try {
      const local = localStorage.getItem(`colorsort_gifts_inbox_${userId}`);
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed)) {
          parsed.forEach(g => {
            if (g && g.id && !seenIds.has(String(g.id))) {
              seenIds.add(String(g.id));
              markIfClaimed(g);
              inbox.push(g);
            }
          });
        }
      }
    } catch (e) {}

    // Sort newest first
    inbox.sort((a, b) => (Number(b.createdAt || 0) - Number(a.createdAt || 0)));

    try {
      localStorage.setItem(`colorsort_gifts_inbox_${userId}`, JSON.stringify(inbox));
    } catch (e) {}
    return inbox;
  }

  async function saveCloudInbox(userId, inbox) {
    if (!userId) return;
    try {
      localStorage.setItem(`colorsort_gifts_inbox_${userId}`, JSON.stringify(inbox));
    } catch (e) {}
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      await fetch(`${GLOBAL_CLOUD_BASE}/gifts_inbox_${encodeURIComponent(userId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inbox),
        signal: controller.signal
      });
      clearTimeout(timeout);
    } catch (err) {}
  }

  // Check Pending Gifts & Update Pulsing Indicators
  async function checkPendingGifts() {
    if (!currentUserRef || !currentUserRef.telegramId) return [];
    const userId = String(currentUserRef.telegramId);
    const inbox = await fetchCloudInbox(userId);
    cachedInbox = inbox;
    const unclaimed = inbox.filter(g => !g.claimed && !isGiftIdClaimed(userId, g.id));

    updateIndicatorStyles(unclaimed.length);
    return unclaimed;
  }

  function updateIndicatorStyles(unclaimedCount) {
    const adBonusBtn = document.getElementById('adBonusBtn');
    const adGiftsTabIcon = document.getElementById('adGiftsTabIcon');
    const adGiftsTabBadge = document.getElementById('adGiftsTabBadge');
    const giftsReceiveBadge = document.getElementById('giftsReceiveBadge');

    if (unclaimedCount > 0) {
      // 1. Shimmer/pulsate contour of Ad button in footer
      if (adBonusBtn) {
        adBonusBtn.classList.add('has-pending-gift');
      }
      // 2. Pulsate Gift tab icon inside Ad modal
      if (adGiftsTabIcon) {
        adGiftsTabIcon.classList.add('gift-tab-icon-pulse');
      }
      // 3. Badges
      if (adGiftsTabBadge) {
        adGiftsTabBadge.textContent = String(unclaimedCount);
        adGiftsTabBadge.classList.remove('hidden');
      }
      if (giftsReceiveBadge) {
        giftsReceiveBadge.textContent = String(unclaimedCount);
        giftsReceiveBadge.classList.remove('hidden');
      }
    } else {
      if (adBonusBtn) {
        adBonusBtn.classList.remove('has-pending-gift');
      }
      if (adGiftsTabIcon) {
        adGiftsTabIcon.classList.remove('gift-tab-icon-pulse');
      }
      if (adGiftsTabBadge) {
        adGiftsTabBadge.classList.add('hidden');
      }
      if (giftsReceiveBadge) {
        giftsReceiveBadge.classList.add('hidden');
      }
    }
  }

  // Render Functions
  function renderReceiveView() {
    const listEl = document.getElementById('giftsReceiveList');
    const emptyEl = document.getElementById('giftsReceiveEmpty');
    const loadingEl = document.getElementById('giftsReceiveLoading');
    if (!listEl) return;

    if (loadingEl) loadingEl.classList.add('hidden');

    const userId = currentUserRef ? String(currentUserRef.telegramId) : '';
    const unclaimed = (cachedInbox || []).filter(g => !g.claimed && !isGiftIdClaimed(userId, g.id));
    updateIndicatorStyles(unclaimed.length);

    if (unclaimed.length === 0) {
      listEl.innerHTML = '';
      if (emptyEl) {
        emptyEl.classList.remove('hidden');
        const headline = emptyEl.querySelector('.gifts-empty-headline');
        if (headline) headline.textContent = t('giftsReceiveEmptyTitle');
        const sub = emptyEl.querySelector('.gifts-empty-sub');
        if (sub) sub.textContent = t('giftsReceiveEmptyDesc');
      }
      return;
    }

    if (emptyEl) emptyEl.classList.add('hidden');
    renderReceivedGifts(cachedInbox);
  }

  function renderReceivedGifts(inbox) {
    const listEl = document.getElementById('giftsReceiveList');
    if (!listEl) return;
    listEl.innerHTML = '';

    const userId = currentUserRef ? String(currentUserRef.telegramId) : '';
    const unclaimed = (inbox || []).filter(g => !g.claimed && !isGiftIdClaimed(userId, g.id));

    unclaimed.forEach(gift => {
      const card = document.createElement('div');
      card.className = 'gift-received-card';
      card.id = `gift-card-${gift.id}`;

      let dateFormatted = '';
      if (gift.createdAt) {
        try {
          const d = new Date(gift.createdAt);
          const langLocale = currentLang === 'uk' ? 'uk-UA' : (currentLang === 'en' ? 'en-US' : (currentLang === 'de' ? 'de-DE' : (currentLang === 'lt' ? 'lt-LT' : 'ru-RU')));
          dateFormatted = d.toLocaleString(langLocale, {
            timeZone: 'Europe/Kyiv',
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          });
        } catch (e) {}
      }

      const localizedName = getGiftName(gift.giftType);
      const amount = gift.amount || 1;
      const titleText = t('giftReceivedCardTitle', localizedName, amount);

      // Determine sender display: Show to ALL players (and admin)
      const isColorSort = (gift.senderType === 'colorsort') || 
                          (String(gift.fromName || '').trim().toLowerCase() === 'color sort') ||
                          (String(gift.fromUsername || '').trim().toLowerCase() === 'colorsortgame');

      let senderDisplayName = '';
      if (isColorSort) {
        senderDisplayName = 'Color Sort';
      } else {
        const namePart = (gift.fromName && gift.fromName !== 'Игрок' && gift.fromName !== 'Player') 
          ? String(gift.fromName).trim() 
          : '';
        const userPart = gift.fromUsername 
          ? `@${String(gift.fromUsername).replace(/^@/, '').trim()}` 
          : '';

        if (namePart && userPart && namePart.toLowerCase() !== userPart.toLowerCase().replace('@', '')) {
          senderDisplayName = `${namePart} (${userPart})`;
        } else if (namePart) {
          senderDisplayName = namePart;
        } else if (userPart) {
          senderDisplayName = userPart;
        } else {
          senderDisplayName = t('defaultPlayerName') || 'Игрок';
        }
      }

      const isAdmin = isUserAdmin(currentUserRef);
      let adminExtra = '';
      if (isAdmin && gift.fromId) {
        adminExtra = ` <small style="color:#94a3b8; font-size:0.72rem;">(ID: ${escapeHtml(gift.fromId)})</small>`;
      }

      const timeText = dateFormatted ? t('giftReceivedTimeKyiv', dateFormatted) : '';
      const claimBtnText = t('giftsClaimBtn') || 'Забрать';

      card.innerHTML = `
        <div class="gift-received-top">
          <span class="gift-received-icon">${gift.giftIcon || '🎁'}</span>
        </div>
        <div class="gift-received-body">
          <strong class="gift-received-title">${escapeHtml(titleText)}</strong>
          <div class="gift-received-desc-block">
            <span class="gift-received-sender">${t('giftFromLabel') || 'От'}: <strong>${escapeHtml(senderDisplayName)}</strong>${adminExtra}</span>
            ${timeText ? `<span class="gift-received-date">${escapeHtml(timeText)}</span>` : ''}
          </div>
        </div>
        <button type="button" class="btn-claim-gift" data-gift-id="${escapeHtml(gift.id)}">${escapeHtml(claimBtnText)}</button>
      `;

      const claimBtn = card.querySelector('.btn-claim-gift');
      if (claimBtn) {
        claimBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          claimGift(gift);
        });
      }

      listEl.appendChild(card);
    });
  }

  async function claimGift(gift) {
    if (isClaiming || !currentUserRef || !gift) return;
    isClaiming = true;
    const userId = String(currentUserRef.telegramId);
    const giftIdStr = String(gift.id);

    try {
      // 1. Mark permanently in local persistent set immediately (no delay, no stale network overwrite)
      markGiftIdAsClaimed(userId, giftIdStr);

      // 2. Immediate visual button update on card
      const card = document.getElementById(`gift-card-${gift.id}`);
      const claimBtn = card ? card.querySelector('.btn-claim-gift') : null;
      if (claimBtn) {
        claimBtn.disabled = true;
        claimBtn.textContent = '✓ ' + (t('giftClaimedDone') || 'Забрано!');
        claimBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
        claimBtn.style.color = '#ffffff';
      }

      // 3. Mark gift as claimed in local cachedInbox immediately
      const giftIdx = cachedInbox.findIndex(g => String(g.id) === giftIdStr);
      if (giftIdx !== -1) {
        cachedInbox[giftIdx].claimed = true;
        cachedInbox[giftIdx].claimedAt = Date.now();
      }
      try {
        localStorage.setItem(`colorsort_gifts_inbox_${userId}`, JSON.stringify(cachedInbox));
      } catch (e) {}

      // 4. Update indicators and badge counts immediately
      const remainingUnclaimed = cachedInbox.filter(g => !g.claimed && !isGiftIdClaimed(userId, g.id));
      updateIndicatorStyles(remainingUnclaimed.length);

      // 5. Add to player balance
      const field = gift.giftType;
      const addAmount = Number(gift.amount) || 1;
      if (field === 'extraBottles') {
        const cur = Math.max(Number(currentUserRef.extraBottles || 0), Number(currentUserRef.extra_bottles || 0));
        currentUserRef.extraBottles = cur + addAmount;
        currentUserRef.extra_bottles = currentUserRef.extraBottles;
      } else {
        currentUserRef[field] = (Number(currentUserRef[field]) || 0) + addAmount;
      }

      // 6. Save player progress
      if (typeof saveUserCallback === 'function') saveUserCallback();
      if (typeof updateUICallback === 'function') updateUICallback();
      if (typeof updateCloudBoosterCallback === 'function') {
        updateCloudBoosterCallback(field, currentUserRef[field]);
      }

      // 7. Sound & Haptics
      if (window.SoundEngine && window.SoundEngine.SoundEngine) {
        window.SoundEngine.SoundEngine.playComplete();
      }
      if (window.TelegramApp && window.TelegramApp.TelegramApp) {
        window.TelegramApp.TelegramApp.haptic('success');
      }

      // 8. Smoothly fade out card and remove from list
      if (card) {
        card.style.transition = 'all 0.25s ease';
        card.style.opacity = '0';
        card.style.transform = 'scale(0.96)';
        setTimeout(() => {
          if (card.parentNode) card.parentNode.removeChild(card);
          const listEl = document.getElementById('giftsReceiveList');
          if (listEl && listEl.children.length === 0) {
            renderReceiveView();
          }
        }, 260);
      } else {
        renderReceiveView();
      }

      // 9. Success Modal
      const localizedName = getGiftName(gift.giftType);
      showNotification(
        gift.giftIcon || '🎁',
        t('giftClaimedSuccessTitle'),
        t('giftClaimedSuccessDesc', gift.giftIcon || '🎁', localizedName, addAmount)
      );

      // 10. Background sync to server and KVDB
      giftApiCall('/api/gifts/claim', 'POST', {
        giftId: giftIdStr,
        recipientId: userId
      }).catch(() => {});

      await saveCloudInbox(userId, cachedInbox);
    } catch (err) {
      console.error('[GiftsModule] Claim gift error:', err);
      showNotification('⚠️', t('errorTitle'), (t('errorClaimGift') || 'Не удалось забрать подарок:') + ' ' + err.message);
    } finally {
      isClaiming = false;
    }
  }

  // Admin Sender Identity: 'self' (e.g. Alligator) or 'colorsort' (Game Color Sort)
  let adminSenderMode = 'self';

  function updateAdminSenderToggleUI() {
    const btnSelf = document.getElementById('btnSenderAdminSelf');
    const btnGame = document.getElementById('btnSenderColorSort');
    const selfLabel = document.getElementById('adminSenderSelfLabel');

    if (selfLabel && currentUserRef) {
      let adminName = 'Alligator';
      if (currentUserRef.username) {
        adminName = `@${String(currentUserRef.username).replace(/^@/, '')}`;
      } else if (currentUserRef.firstName && currentUserRef.firstName !== 'Игрок') {
        adminName = currentUserRef.firstName;
      }
      selfLabel.textContent = `${t('giftFromLabel') || 'От'} ${adminName}`;
    }

    if (btnSelf) btnSelf.classList.toggle('active', adminSenderMode === 'self');
    if (btnGame) btnGame.classList.toggle('active', adminSenderMode === 'colorsort');

    // Also update sender preview in quantity modal if it is rendered
    const previewEl = document.getElementById('giftQtySenderPreviewName');
    const previewRow = document.getElementById('giftQtySenderPreviewRow');
    if (previewRow && previewEl) {
      const isAdmin = isUserAdmin(currentUserRef);
      if (isAdmin) {
        previewRow.classList.remove('hidden');
        previewEl.textContent = adminSenderMode === 'colorsort'
          ? 'Color Sort'
          : (currentUserRef.username ? `@${String(currentUserRef.username).replace(/^@/, '')}` : (currentUserRef.firstName || 'Alligator'));
      } else {
        previewRow.classList.add('hidden');
      }
    }
  }

  function renderSendView() {
    const dailyDisplay = document.getElementById('giftsDailyCountDisplay');
    const dailyFootnote = document.querySelector('.limit-footnote');
    const stepRecipient = document.getElementById('giftsStepRecipient');
    const stepItem = document.getElementById('giftsStepItem');

    if (!currentUserRef) return;
    const userId = String(currentUserRef.telegramId);
    const stats = getDailyStats(userId);
    const isAdmin = isUserAdmin(currentUserRef);

    if (dailyDisplay) {
      if (isAdmin) {
        dailyDisplay.textContent = `${stats.count} / ${t('giftsUnlimitedTag')}`;
      } else {
        dailyDisplay.textContent = `${stats.count} / ${MAX_DAILY_GIFTS}`;
      }
    }

    if (dailyFootnote) {
      if (isAdmin) {
        dailyFootnote.textContent = t('giftsAdminUnlimitedFootnote');
        dailyFootnote.style.color = '#38bdf8';
      } else {
        dailyFootnote.textContent = t('giftsLimitFootnote');
        dailyFootnote.style.color = '';
      }
    }

    // Refresh balances on the gift catalog cards
    const balUndos = document.getElementById('giftBalUndos');
    const balHints = document.getElementById('giftBalHints');
    const balReveals = document.getElementById('giftBalReveals');
    const balBottles = document.getElementById('giftBalBottles');

    const uCount = getUserBoosterCount('undos');
    const hCount = getUserBoosterCount('hints');
    const rCount = getUserBoosterCount('reveals');
    const bCount = getUserBoosterCount('extraBottles');

    if (balUndos) balUndos.textContent = uCount;
    if (balHints) balHints.textContent = hCount;
    if (balReveals) balReveals.textContent = rCount;
    if (balBottles) balBottles.textContent = bCount;

    // Toggle card empty classes
    const cardUndos = document.querySelector('.gift-choice-card[data-gift-type="undos"]');
    const cardHints = document.querySelector('.gift-choice-card[data-gift-type="hints"]');
    const cardReveals = document.querySelector('.gift-choice-card[data-gift-type="reveals"]');
    const cardBottles = document.querySelector('.gift-choice-card[data-gift-type="extraBottles"]');

    if (cardUndos) cardUndos.classList.toggle('is-empty', uCount === 0);
    if (cardHints) cardHints.classList.toggle('is-empty', hCount === 0);
    if (cardReveals) cardReveals.classList.toggle('is-empty', rCount === 0);
    if (cardBottles) cardBottles.classList.toggle('is-empty', bCount === 0);

    if (selectedRecipient) {
      if (stepRecipient) stepRecipient.classList.add('hidden');
      if (stepItem) stepItem.classList.remove('hidden');
      const targetNameEl = document.getElementById('giftsTargetPlayerName');
      if (targetNameEl) {
        targetNameEl.textContent = selectedRecipient.displayName;
      }
      const adminChoiceBox = document.getElementById('adminSenderChoiceBox');
      if (adminChoiceBox) {
        if (isAdmin) {
          adminChoiceBox.classList.remove('hidden');
          updateAdminSenderToggleUI();
        } else {
          adminChoiceBox.classList.add('hidden');
        }
      }
    } else {
      if (stepRecipient) stepRecipient.classList.remove('hidden');
      if (stepItem) stepItem.classList.add('hidden');
      const searchInput = document.getElementById('giftsPlayerSearchInput');
      if (searchInput) {
        searchInput.placeholder = isAdmin ? t('giftsSearchPlaceholder') : (t('giftsSearchPlaceholderUser') || '🔍 Найти игрока...');
      }
      loadAndRenderPlayersList();
    }
  }

  async function loadAndRenderPlayersList(searchQuery = '') {
    const listEl = document.getElementById('giftsPlayersList');
    const loadingEl = document.getElementById('giftsPlayersLoading');
    if (!listEl) return;

    if (cachedPlayers.length === 0) {
      if (loadingEl) loadingEl.classList.remove('hidden');

      // 1. Try callback from parent app
      try {
        if (typeof getLeaderboardPlayersCallback === 'function') {
          const players = await getLeaderboardPlayersCallback();
          if (Array.isArray(players) && players.length > 0) {
            cachedPlayers = players;
          }
        }
      } catch (e) {}

      // 2. Fallback: Fetch directly from server API
      if (cachedPlayers.length === 0) {
        try {
          const serverRes = await giftApiCall('/api/leaderboard');
          if (serverRes && serverRes.success && Array.isArray(serverRes.topPlayers) && serverRes.topPlayers.length > 0) {
            cachedPlayers = serverRes.topPlayers.map(sp => ({
              telegramId: String(sp.telegram_id),
              firstName: sp.first_name,
              username: sp.username || '',
              photoUrl: sp.photo_url || '',
              maxLevel: Number(sp.max_level || 1),
              level: Number(sp.max_level || 1),
              stars: Number(sp.stars || 0)
            }));
          }
        } catch (e) {}
      }

      // 3. Fallback: Fetch from cloud KVDB
      if (cachedPlayers.length === 0) {
        try {
          const res = await fetch(`${GLOBAL_CLOUD_BASE}/?prefix=player_&values=true&format=json&_cb=${Date.now()}`, {
            signal: (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') ? AbortSignal.timeout(3000) : undefined
          });
          if (res.ok) {
            const pairs = await res.json();
            if (Array.isArray(pairs)) {
              cachedPlayers = pairs
                .map(([k, p]) => {
                  if (typeof p === 'string') {
                    try { return JSON.parse(p); } catch (e) { return null; }
                  }
                  return p;
                })
                .filter(p => p && p.telegramId && !String(p.telegramId).startsWith('guest') && !String(p.telegramId).startsWith('dev') && /^\d+$/.test(String(p.telegramId)))
                .sort((a, b) => (Number(b.maxLevel || b.level || 1) - Number(a.maxLevel || a.level || 1)));
            }
          }
        } catch (err) {}
      }
      if (loadingEl) loadingEl.classList.add('hidden');
    }

    const myId = currentUserRef ? String(currentUserRef.telegramId) : '';
    // Exclude current user and filter by search query
    let filtered = cachedPlayers.filter(p => String(p.telegramId || p.telegram_id) !== myId);

    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase().replace(/^@/, '');
      filtered = filtered.filter(p => {
        const name = (p.firstName || p.first_name || p.name || '').toLowerCase();
        const uname = (p.username || p.user_name || '').toLowerCase().replace(/^@/, '');
        const tid = String(p.telegramId || p.telegram_id || '');
        return name.includes(q) || uname.includes(q) || tid.includes(q);
      });
    }

    listEl.innerHTML = '';
    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div style="text-align: center; color: #94a3b8; font-size: 0.85rem; padding: 18px 8px;">
          ${searchQuery ? t('giftsPlayersNotFound') : t('giftsPlayersEmpty')}
        </div>
      `;
      return;
    }

    const isAdmin = isUserAdmin(currentUserRef);

    filtered.forEach((player, idx) => {
      const name = player.firstName || player.first_name || player.name || t('defaultPlayerName') || 'Игрок';
      const rawUsername = player.username || player.user_name || '';
      const cleanUsername = rawUsername ? String(rawUsername).replace(/^@/, '').trim() : '';
      const usernameDisplay = (isAdmin && cleanUsername) ? `@${cleanUsername}` : '';
      const lvl = player.maxLevel !== undefined ? player.maxLevel : (player.level || 1);
      const crown = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;

      const row = document.createElement('div');
      row.className = 'gift-player-row';
      row.innerHTML = `
        <div class="gift-player-left" style="display: flex; align-items: center; gap: 8px;">
          <span class="gift-player-rank" style="font-size: 0.95rem; font-weight: 700; width: 26px; text-align: center;">${crown}</span>
          <div style="display: flex; flex-direction: column; gap: 1px;">
            <strong class="gift-player-name" style="font-size: 0.9rem; font-weight: 700; color: #f8fafc;">${escapeHtml(name)}</strong>
            ${usernameDisplay ? `<small class="player-handle" style="font-size: 0.75rem; color: #38bdf8; font-weight: 600; display: block;">${escapeHtml(usernameDisplay)}</small>` : ''}
          </div>
        </div>
        <div class="gift-player-right" style="display: flex; align-items: center;">
          <span class="gift-player-lvl" style="font-size: 0.8rem; font-weight: 700; color: #38bdf8; background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.25); padding: 3px 8px; border-radius: 8px; white-space: nowrap;">${t('levelPrefix') || 'Ур.'} ${lvl}</span>
        </div>
      `;

      row.addEventListener('click', () => {
        selectedRecipient = {
          telegramId: String(player.telegramId || player.telegram_id),
          displayName: usernameDisplay ? `${name} (${usernameDisplay})` : name,
          firstName: name,
          username: cleanUsername,
          level: lvl
        };
        renderSendView();
      });

      listEl.appendChild(row);
    });
  }

  function openQuantityModal(giftType) {
    if (!currentUserRef || !selectedRecipient) return;

    const myId = String(currentUserRef.telegramId);
    const targetId = String(selectedRecipient.telegramId);

    if (myId === targetId) {
      showNotification('⚠️', t('errorTitle'), t('giftSelfSendError'));
      return;
    }

    const config = GIFT_CONFIG[giftType];
    if (!config) return;

    const currentBal = getUserBoosterCount(config.boosterField);
    if (currentBal <= 0) {
      showNotification('❌', t('giftNoStockTitle'), t('giftNoStockDesc', getGiftName(giftType)));
      return;
    }

    const isAdmin = isUserAdmin(currentUserRef);
    const dailyStats = getDailyStats(myId);
    const remainingDaily = MAX_DAILY_GIFTS - dailyStats.count;

    // Regular players: max 10 gifts/day. Administrator: UNLIMITED!
    if (!isAdmin && remainingDaily <= 0) {
      showNotification(
        '⏳',
        t('giftLimitExceededTitle'),
        t('giftLimitExceededDesc')
      );
      return;
    }

    pendingGiftType = giftType;
    pendingMaxQty = isAdmin ? Math.max(1, currentBal) : Math.min(currentBal, remainingDaily);
    currentGiftQty = 1;

    const modal = document.getElementById('giftQuantityModal');
    if (!modal) return;

    const headerIcon = document.getElementById('giftQtyHeaderIcon');
    const recipientName = document.getElementById('giftQtyRecipientName');
    const bigIcon = document.getElementById('giftQtyBigIcon');
    const itemName = document.getElementById('giftQtyItemName');
    const balVal = document.getElementById('giftQtyBalValue');
    const limitVal = document.getElementById('giftQtyLimitValue');

    if (headerIcon) headerIcon.textContent = config.icon;
    if (recipientName) recipientName.textContent = selectedRecipient.displayName || t('defaultPlayerName');
    if (bigIcon) bigIcon.textContent = config.icon;
    if (itemName) itemName.textContent = getGiftName(giftType);
    if (balVal) balVal.textContent = String(currentBal);
    if (limitVal) {
      limitVal.textContent = isAdmin ? t('giftsUnlimitedTag') : String(remainingDaily);
    }

    // Refresh dynamic stat labels inside modal
    const statsElements = modal.querySelectorAll('.gift-qty-stat');
    if (statsElements.length >= 2) {
      statsElements[0].innerHTML = `${t('giftQtyInStockLabel')} <b id="giftQtyBalValue">${currentBal}</b> ${t('giftQtyPcs') || 'шт.'}`;
      const limitText = isAdmin ? t('giftsUnlimitedTag') : String(remainingDaily);
      statsElements[1].innerHTML = `${t('giftQtyAvailableTodayLabel')} <b id="giftQtyLimitValue">${limitText}</b> ${t('giftQtyPcs') || 'шт.'}`;
    }

    // Admin sender preview row in modal
    const senderPreviewEl = document.getElementById('giftQtySenderPreviewName');
    const senderPreviewRow = document.getElementById('giftQtySenderPreviewRow');
    if (senderPreviewRow && senderPreviewEl) {
      if (isAdmin) {
        senderPreviewRow.classList.remove('hidden');
        let selfName = 'Alligator';
        if (currentUserRef.username) {
          selfName = `@${String(currentUserRef.username).replace(/^@/, '')}`;
        } else if (currentUserRef.firstName && currentUserRef.firstName !== 'Игрок') {
          selfName = currentUserRef.firstName;
        }
        senderPreviewEl.textContent = adminSenderMode === 'colorsort' ? 'Color Sort' : selfName;
      } else {
        senderPreviewRow.classList.add('hidden');
      }
    }

    updateQtyStepperUI();
    modal.classList.remove('hidden');
  }

  function closeQuantityModal() {
    const modal = document.getElementById('giftQuantityModal');
    if (modal) modal.classList.add('hidden');
    pendingGiftType = null;
  }

  function updateQtyStepperUI() {
    const display = document.getElementById('giftQtyValDisplay');
    const confirmBtn = document.getElementById('giftQtyConfirmBtn');
    const minusBtn = document.getElementById('giftQtyMinusBtn');
    const plusBtn = document.getElementById('giftQtyPlusBtn');

    if (display) display.textContent = String(currentGiftQty);
    if (confirmBtn) confirmBtn.textContent = t('giftQtyConfirmBtn', currentGiftQty);

    if (minusBtn) minusBtn.disabled = (currentGiftQty <= 1);
    if (plusBtn) plusBtn.disabled = (currentGiftQty >= pendingMaxQty);
  }

  async function executeSendGift(giftType, quantity) {
    if (isSending || !currentUserRef || !selectedRecipient) return;

    const myId = String(currentUserRef.telegramId);
    const targetId = String(selectedRecipient.telegramId);
    const targetName = selectedRecipient.displayName;

    const config = GIFT_CONFIG[giftType];
    if (!config) return;

    const currentBal = getUserBoosterCount(config.boosterField);
    const dailyStats = getDailyStats(myId);
    const remainingDaily = MAX_DAILY_GIFTS - dailyStats.count;
    const isAdmin = isUserAdmin(currentUserRef);

    const sendQty = isAdmin
      ? Math.max(1, Math.min(Number(quantity) || 1, currentBal))
      : Math.max(1, Math.min(Number(quantity) || 1, currentBal, remainingDaily));

    if (currentBal < sendQty) {
      showNotification('❌', t('giftNoStockTitle'), t('giftNoStockDesc', getGiftName(giftType)));
      return;
    }
    if (!isAdmin && remainingDaily < sendQty) {
      showNotification('⏳', t('giftLimitExceededTitle'), t('giftLimitExceededDesc'));
      return;
    }

    isSending = true;

    try {
      // 1. Deduct from sender balance
      if (config.boosterField === 'extraBottles') {
        const cur = Math.max(Number(currentUserRef.extraBottles || 0), Number(currentUserRef.extra_bottles || 0));
        currentUserRef.extraBottles = Math.max(0, cur - sendQty);
        currentUserRef.extra_bottles = currentUserRef.extraBottles;
      } else {
        currentUserRef[config.boosterField] = Math.max(0, (Number(currentUserRef[config.boosterField]) || 0) - sendQty);
      }

      // 2. Increment daily counter by sent quantity
      const newDailyCount = incrementDailyStats(myId, sendQty);

      // 3. Save sender progress locally and to cloud
      if (typeof saveUserCallback === 'function') saveUserCallback();
      if (typeof updateUICallback === 'function') updateUICallback();
      if (typeof updateCloudBoosterCallback === 'function') {
        updateCloudBoosterCallback(config.boosterField, currentUserRef[config.boosterField]);
      }

      // 4. Push gift to recipient's inbox (Server API + Cloud KVDB)
      let senderName = '';
      let senderUsername = '';
      let senderType = 'player';

      if (isAdmin) {
        if (adminSenderMode === 'colorsort') {
          senderName = 'Color Sort';
          senderUsername = 'ColorSortGame';
          senderType = 'colorsort';
        } else {
          senderName = (currentUserRef.firstName && currentUserRef.firstName !== 'Игрок')
            ? currentUserRef.firstName
            : (currentUserRef.username || 'Alligator');
          senderUsername = currentUserRef.username ? String(currentUserRef.username).replace(/^@/, '').trim() : 'Alligator';
          senderType = 'admin';
        }
      } else {
        senderName = (currentUserRef.firstName && currentUserRef.firstName !== 'Игрок')
          ? currentUserRef.firstName
          : (t('defaultPlayerName') || 'Игрок');
        senderUsername = currentUserRef.username ? String(currentUserRef.username).replace(/^@/, '').trim() : '';
        senderType = 'player';
      }

      const newGift = {
        id: 'gift_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
        giftType: giftType,
        giftName: getGiftName(giftType),
        giftIcon: config.icon,
        amount: sendQty,
        recipientId: targetId,
        fromId: myId,
        fromName: senderName,
        fromUsername: senderUsername,
        senderType: senderType,
        createdAt: Date.now(),
        claimed: false
      };

      // Send to server API
      giftApiCall('/api/gifts/send', 'POST', newGift).catch(() => {});

      // Sync to cloud KVDB and local storage
      const recipientInbox = await fetchCloudInbox(targetId);
      recipientInbox.push(newGift);
      await saveCloudInbox(targetId, recipientInbox);

      // 5. Sound & Haptics
      if (window.TelegramApp && window.TelegramApp.TelegramApp) {
        window.TelegramApp.TelegramApp.haptic('success');
      }

      // 6. Success Feedback
      const dailyNotice = isAdmin
        ? t('giftDailyNoticeAdmin', newDailyCount)
        : t('giftDailyNoticeUser', newDailyCount, MAX_DAILY_GIFTS);

      showNotification(
        '🎁',
        t('giftSentSuccessTitle'),
        t('giftSentSuccessDesc', config.icon, getGiftName(giftType), sendQty, targetName, getUserBoosterCount(config.boosterField), dailyNotice)
      );

      // Return to recipient selection list
      selectedRecipient = null;
      renderSendView();
    } catch (err) {
      console.error('[GiftsModule] Send gift error:', err);
      showNotification('⚠️', t('errorTitle'), (t('errorSendGift') || 'Не удалось доставить подарок:') + ' ' + err.message);
    } finally {
      isSending = false;
    }
  }

  // Bind UI Events
  function bindEvents() {
    // Subnav buttons: Получить / Отправить
    const receiveBtn = document.getElementById('giftsSubnavReceiveBtn');
    const sendBtn = document.getElementById('giftsSubnavSendBtn');
    const receiveView = document.getElementById('giftsReceiveView');
    const sendView = document.getElementById('giftsSendView');

    if (receiveBtn && sendBtn) {
      receiveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        activeSubnav = 'receive';
        receiveBtn.classList.add('active');
        sendBtn.classList.remove('active');
        if (receiveView) receiveView.classList.remove('hidden');
        if (sendView) sendView.classList.add('hidden');
        checkPendingGifts().then(() => renderReceiveView());
      });

      sendBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        activeSubnav = 'send';
        sendBtn.classList.add('active');
        receiveBtn.classList.remove('active');
        if (sendView) sendView.classList.remove('hidden');
        if (receiveView) receiveView.classList.add('hidden');
        renderSendView();
      });
    }

    // Back to recipients list
    const backBtn = document.getElementById('giftsBackToRecipientsBtn');
    if (backBtn) {
      backBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedRecipient = null;
        renderSendView();
      });
    }

    // Player search input
    const searchInput = document.getElementById('giftsPlayerSearchInput');
    const clearSearchBtn = document.getElementById('giftsClearSearchBtn');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        const val = searchInput.value;
        if (clearSearchBtn) {
          clearSearchBtn.classList.toggle('hidden', !val.trim());
        }
        loadAndRenderPlayersList(val);
      });
    }

    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (searchInput) searchInput.value = '';
        clearSearchBtn.classList.add('hidden');
        loadAndRenderPlayersList('');
      });
    }

    // Send Gift buttons in catalog -> Open quantity selection modal
    const sendButtons = document.querySelectorAll('.gift-send-btn');
    sendButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const type = btn.getAttribute('data-gift-type');
        if (type) {
          openQuantityModal(type);
        }
      });
    });

    // Quantity Modal Controls (minus, plus, confirm, cancel, close)
    const qtyMinusBtn = document.getElementById('giftQtyMinusBtn');
    const qtyPlusBtn = document.getElementById('giftQtyPlusBtn');
    const qtyConfirmBtn = document.getElementById('giftQtyConfirmBtn');
    const qtyCancelBtn = document.getElementById('giftQtyCancelBtn');
    const closeQtyModalBtn = document.getElementById('closeGiftQtyModalBtn');

    if (qtyMinusBtn) {
      qtyMinusBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (currentGiftQty > 1) {
          currentGiftQty--;
          updateQtyStepperUI();
          if (window.TelegramApp && window.TelegramApp.TelegramApp) {
            window.TelegramApp.TelegramApp.haptic('selection');
          }
        }
      });
    }

    if (qtyPlusBtn) {
      qtyPlusBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (currentGiftQty < pendingMaxQty) {
          currentGiftQty++;
          updateQtyStepperUI();
          if (window.TelegramApp && window.TelegramApp.TelegramApp) {
            window.TelegramApp.TelegramApp.haptic('selection');
          }
        } else {
          if (window.TelegramApp && window.TelegramApp.TelegramApp) {
            window.TelegramApp.TelegramApp.haptic('warning');
          }
        }
      });
    }

    if (qtyConfirmBtn) {
      qtyConfirmBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (pendingGiftType) {
          const typeToSend = pendingGiftType;
          const qtyToSend = currentGiftQty;
          closeQuantityModal();
          executeSendGift(typeToSend, qtyToSend);
        }
      });
    }

    if (qtyCancelBtn) {
      qtyCancelBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeQuantityModal();
      });
    }

    if (closeQtyModalBtn) {
      closeQtyModalBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeQuantityModal();
      });
    }

    // Admin Sender Mode Toggles (From Alligator / From Color Sort)
    const btnSenderSelf = document.getElementById('btnSenderAdminSelf');
    const btnSenderColorSort = document.getElementById('btnSenderColorSort');
    if (btnSenderSelf) {
      btnSenderSelf.addEventListener('click', (e) => {
        e.stopPropagation();
        adminSenderMode = 'self';
        updateAdminSenderToggleUI();
        if (window.TelegramApp && window.TelegramApp.TelegramApp) {
          window.TelegramApp.TelegramApp.haptic('selection');
        }
      });
    }
    if (btnSenderColorSort) {
      btnSenderColorSort.addEventListener('click', (e) => {
        e.stopPropagation();
        adminSenderMode = 'colorsort';
        updateAdminSenderToggleUI();
        if (window.TelegramApp && window.TelegramApp.TelegramApp) {
          window.TelegramApp.TelegramApp.haptic('selection');
        }
      });
    }
  }

  function setLanguage(lang, translateFn) {
    if (lang) currentLang = lang;
    if (typeof translateFn === 'function') tCallback = translateFn;

    // 1. Subnav buttons
    const receiveBtn = document.getElementById('giftsSubnavReceiveBtn');
    if (receiveBtn) {
      const unclaimed = (cachedInbox || []).filter(g => !g.claimed).length;
      receiveBtn.innerHTML = `<span>${t('giftsSubnavReceive')}</span><span class="gifts-counter-badge ${unclaimed > 0 ? '' : 'hidden'}" id="giftsReceiveBadge">${unclaimed}</span>`;
    }
    const sendBtn = document.getElementById('giftsSubnavSendBtn');
    if (sendBtn) {
      sendBtn.innerHTML = `<span>${t('giftsSubnavSend')}</span>`;
    }

    // Admin sender choice strings
    const adminChoiceTitle = document.querySelector('#adminSenderChoiceBox .admin-sender-choice-title span');
    if (adminChoiceTitle) adminChoiceTitle.textContent = t('adminSenderOptionLabel') || '👑 От чьего имени отправить:';

    const adminSenderGameLabel = document.getElementById('adminSenderGameLabel');
    if (adminSenderGameLabel) adminSenderGameLabel.textContent = t('adminSenderFromGame') || 'От Color Sort';

    updateAdminSenderToggleUI();

    // 2. Receive view static strings
    const rLoading = document.getElementById('giftsReceiveLoading');
    if (rLoading && rLoading.querySelector('span')) {
      rLoading.querySelector('span').textContent = t('giftsReceiveChecking');
    }
    const rHeadline = document.querySelector('#giftsReceiveEmpty .gifts-empty-headline');
    if (rHeadline) rHeadline.textContent = t('giftsReceiveEmptyTitle');
    const rSub = document.querySelector('#giftsReceiveEmpty .gifts-empty-sub');
    if (rSub) rSub.textContent = t('giftsReceiveEmptyDesc');

    // 3. Send view static strings
    const limitLabel = document.querySelector('.gifts-limit-header .limit-label');
    if (limitLabel) limitLabel.textContent = t('giftsDailySentLabel');

    const recipientStepTitle = document.querySelector('#giftsStepRecipient .gifts-step-title');
    if (recipientStepTitle) recipientStepTitle.textContent = t('giftsStepRecipientTitle');

    const searchInput = document.getElementById('giftsPlayerSearchInput');
    if (searchInput) {
      const isAdmin = isUserAdmin(currentUserRef);
      searchInput.placeholder = isAdmin ? t('giftsSearchPlaceholder') : (t('giftsSearchPlaceholderUser') || '🔍 Найти игрока...');
    }

    const pLoading = document.getElementById('giftsPlayersLoading');
    if (pLoading && pLoading.querySelector('span')) {
      pLoading.querySelector('span').textContent = t('giftsPlayersLoading');
    }

    const backBtn = document.getElementById('giftsBackToRecipientsBtn');
    if (backBtn) backBtn.textContent = t('giftsBackToRecipientsBtn');

    const recLabel = document.querySelector('.recipient-badge-box .recipient-label');
    if (recLabel) recLabel.textContent = t('giftsRecipientLabel');

    const itemStepTitle = document.querySelector('#giftsStepItem .gifts-step-title');
    if (itemStepTitle) itemStepTitle.textContent = t('giftsStepItemTitle');

    // Catalog items
    const titleUndos = document.querySelector('.gift-choice-card[data-gift-type="undos"] .gift-choice-title');
    if (titleUndos) titleUndos.textContent = t('giftItemUndo');
    const titleHints = document.querySelector('.gift-choice-card[data-gift-type="hints"] .gift-choice-title');
    if (titleHints) titleHints.textContent = t('giftItemHint');
    const titleReveals = document.querySelector('.gift-choice-card[data-gift-type="reveals"] .gift-choice-title');
    if (titleReveals) titleReveals.textContent = t('giftItemReveal');
    const titleBottles = document.querySelector('.gift-choice-card[data-gift-type="extraBottles"] .gift-choice-title');
    if (titleBottles) titleBottles.textContent = t('giftItemBottle');

    document.querySelectorAll('.gift-choice-card').forEach(card => {
      const type = card.getAttribute('data-gift-type');
      const bEl = card.querySelector('.gift-choice-balance b');
      const bVal = bEl ? bEl.textContent : '0';
      const balSpan = card.querySelector('.gift-choice-balance');
      const bId = type === 'undos' ? 'giftBalUndos' : (type === 'hints' ? 'giftBalHints' : (type === 'reveals' ? 'giftBalReveals' : 'giftBalBottles'));
      if (balSpan) {
        balSpan.innerHTML = `${t('giftsInStockLabel')} <b id="${bId}">${bVal}</b>`;
      }
      const sBtn = card.querySelector('.gift-send-btn');
      if (sBtn) sBtn.textContent = t('giftsSendActionBtn');
    });

    // 4. Quantity Modal
    const qtyTitle = document.getElementById('giftQtyModalTitle');
    if (qtyTitle) qtyTitle.textContent = t('giftQtyModalTitle');

    const qtyRecDesc = document.getElementById('giftQtyRecipientDesc');
    if (qtyRecDesc) {
      const name = selectedRecipient ? escapeHtml(selectedRecipient.displayName) : (t('defaultPlayerName') || '—');
      qtyRecDesc.innerHTML = `${t('giftQtyRecipientDesc')} <strong id="giftQtyRecipientName">${name}</strong>`;
    }

    const pickerLabel = document.querySelector('.gift-qty-picker-label');
    if (pickerLabel) pickerLabel.textContent = t('giftQtyPickerLabel');

    const qtyCancel = document.getElementById('giftQtyCancelBtn');
    if (qtyCancel) qtyCancel.textContent = t('giftQtyCancelBtn');
    const closeQtyBtn = document.getElementById('closeGiftQtyModalBtn');
    if (closeQtyBtn) closeQtyBtn.title = t('closeBtn') || 'Закрыть';

    if (pendingGiftType) {
      const itemEl = document.getElementById('giftQtyItemName');
      if (itemEl) itemEl.textContent = getGiftName(pendingGiftType);
    }
    updateQtyStepperUI();

    // 5. Re-render active view
    if (activeSubnav === 'receive') {
      renderReceiveView();
    } else {
      renderSendView();
    }
  }

  // Public Interface
  const GiftsModule = {
    init(user, callbacks = {}) {
      currentUserRef = user;
      saveUserCallback = callbacks.saveUser;
      updateUICallback = callbacks.updateUI;
      updateCloudBoosterCallback = callbacks.updateCloudBooster;
      showInfoModalCallback = callbacks.showInfoModal;
      getLeaderboardPlayersCallback = callbacks.getLeaderboardPlayers;
      isAdminCheckCallback = callbacks.isAdmin;
      if (callbacks.lang) currentLang = callbacks.lang;
      if (typeof callbacks.t === 'function') tCallback = callbacks.t;

      bindEvents();
      setLanguage(currentLang, tCallback);

      // Initial check
      checkPendingGifts();

      // Poll periodically (every 25 seconds)
      if (pollingInterval) clearInterval(pollingInterval);
      pollingInterval = setInterval(() => {
        checkPendingGifts();
      }, 25000);
    },

    setUser(user) {
      currentUserRef = user;
      checkPendingGifts();
    },

    setLanguage,

    refresh() {
      if (activeSubnav === 'receive') {
        checkPendingGifts().then(() => renderReceiveView());
      } else {
        renderSendView();
      }
    },

    checkPendingGifts,

    openReceiveTab() {
      const receiveBtn = document.getElementById('giftsSubnavReceiveBtn');
      if (receiveBtn) receiveBtn.click();
    },

    openSendTab() {
      const sendBtn = document.getElementById('giftsSubnavSendBtn');
      if (sendBtn) sendBtn.click();
    },

    openSendForRecipient(recipient) {
      if (!recipient) return;
      selectedRecipient = {
        telegramId: String(recipient.telegramId),
        displayName: recipient.displayName || recipient.firstName || recipient.name || (t('defaultPlayerName') || 'Игрок'),
        level: recipient.level || recipient.maxLevel || 1
      };
      const sendBtn = document.getElementById('giftsSubnavSendBtn');
      if (sendBtn && typeof sendBtn.click === 'function' && !sendBtn.classList.contains('active')) {
        sendBtn.click();
      } else {
        renderSendView();
      }
    },

    hasPendingGifts() {
      return (cachedInbox || []).some(g => !g.claimed);
    }
  };

  window.GiftsModule = GiftsModule;
})(window);
