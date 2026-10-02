/**
 * Gifts Module for Color Sort Game
 * Independent module for sending and receiving gifts between players.
 */
(function(window) {
  'use strict';

  const GLOBAL_CLOUD_BUCKET = '82kzJTUxZwwFNvg7kUSqgM';
  const GLOBAL_CLOUD_BASE = 'https://kvdb.io/' + GLOBAL_CLOUD_BUCKET;
  const MAX_DAILY_GIFTS = 10;

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

  let cachedInbox = [];
  let cachedPlayers = [];
  let selectedRecipient = null;
  let isSending = false;
  let isClaiming = false;
  let activeSubnav = 'receive'; // 'receive' or 'send'
  let pollingInterval = null;

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

  function incrementDailyStats(userId) {
    const today = getKyivDateTime().dateStr;
    const key = `colorsort_gifts_daily_${userId}`;
    const stats = getDailyStats(userId);
    stats.count += 1;
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

  // KVDB Cloud Endpoints for Gifts
  async function fetchCloudInbox(userId) {
    if (!userId) return [];
    try {
      const res = await fetch(`${GLOBAL_CLOUD_BASE}/gifts_inbox_${encodeURIComponent(userId)}?_cb=${Date.now()}`, {
        cache: 'no-store'
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) return data;
      }
    } catch (err) {
      console.warn('[GiftsModule] Cloud inbox fetch notice:', err.message);
    }
    // Fallback to local storage
    try {
      const local = localStorage.getItem(`colorsort_gifts_inbox_${userId}`);
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [];
  }

  async function saveCloudInbox(userId, inbox) {
    if (!userId) return;
    try {
      localStorage.setItem(`colorsort_gifts_inbox_${userId}`, JSON.stringify(inbox));
    } catch (e) {}
    try {
      await fetch(`${GLOBAL_CLOUD_BASE}/gifts_inbox_${encodeURIComponent(userId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inbox)
      });
    } catch (err) {
      console.warn('[GiftsModule] Cloud inbox save notice:', err.message);
    }
  }

  // Check Pending Gifts & Update Pulsing Indicators
  async function checkPendingGifts() {
    if (!currentUserRef || !currentUserRef.telegramId) return [];
    const userId = String(currentUserRef.telegramId);
    const inbox = await fetchCloudInbox(userId);
    cachedInbox = inbox;
    const unclaimed = inbox.filter(g => !g.claimed);

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

    const unclaimed = (cachedInbox || []).filter(g => !g.claimed);
    updateIndicatorStyles(unclaimed.length);

    if (unclaimed.length === 0) {
      listEl.innerHTML = '';
      if (emptyEl) emptyEl.classList.remove('hidden');
      return;
    }

    if (emptyEl) emptyEl.classList.add('hidden');
    listEl.innerHTML = '';

    unclaimed.forEach(gift => {
      const card = document.createElement('div');
      card.className = 'gift-received-card';
      card.id = `gift-card-${gift.id}`;

      let dateFormatted = '';
      if (gift.createdAt) {
        try {
          const d = new Date(gift.createdAt);
          dateFormatted = d.toLocaleString('ru-RU', {
            timeZone: 'Europe/Kyiv',
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          });
        } catch (e) {}
      }

      card.innerHTML = `
        <div class="gift-received-left">
          <span class="gift-received-icon">${gift.giftIcon || '🎁'}</span>
          <div class="gift-received-texts">
            <strong class="gift-received-title">🎁 Подарок: ${escapeHtml(gift.giftName || 'Бонус')} (+${gift.amount || 1})</strong>
            <span class="gift-received-desc">Вам прислан полезный подарок!</span>
            ${dateFormatted ? `<span class="gift-received-date">🕒 ${dateFormatted} (Киев)</span>` : ''}
          </div>
        </div>
        <button type="button" class="btn-claim-gift" data-gift-id="${escapeHtml(gift.id)}">Забрать</button>
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

    try {
      const field = gift.giftType;
      const addAmount = Number(gift.amount) || 1;

      // 1. Add to player balance
      if (field === 'extraBottles') {
        const cur = Math.max(Number(currentUserRef.extraBottles || 0), Number(currentUserRef.extra_bottles || 0));
        currentUserRef.extraBottles = cur + addAmount;
        currentUserRef.extra_bottles = currentUserRef.extraBottles;
      } else {
        currentUserRef[field] = (Number(currentUserRef[field]) || 0) + addAmount;
      }

      // 2. Mark gift as claimed in local inbox immediately
      const userId = String(currentUserRef.telegramId);
      const giftIdx = cachedInbox.findIndex(g => String(g.id) === String(gift.id));
      if (giftIdx !== -1) {
        cachedInbox[giftIdx].claimed = true;
        cachedInbox[giftIdx].claimedAt = Date.now();
      }
      try {
        localStorage.setItem(`colorsort_gifts_inbox_${userId}`, JSON.stringify(cachedInbox));
      } catch (e) {}

      // 3. Immediately refresh views and indicator animations
      renderReceiveView();
      renderSendView();

      // 4. Save local and cloud player progress
      if (typeof saveUserCallback === 'function') saveUserCallback();
      if (typeof updateUICallback === 'function') updateUICallback();
      if (typeof updateCloudBoosterCallback === 'function') {
        updateCloudBoosterCallback(field, currentUserRef[field]);
      }

      // 5. Sound & Haptics
      if (window.SoundEngine && window.SoundEngine.SoundEngine) {
        window.SoundEngine.SoundEngine.playComplete();
      }
      if (window.TelegramApp && window.TelegramApp.TelegramApp) {
        window.TelegramApp.TelegramApp.haptic('success');
      }

      // 6. Success Modal
      showNotification(
        gift.giftIcon || '🎁',
        'Подарок получен!',
        `Вы успешно забрали ${gift.giftIcon || ''} «${gift.giftName || 'Бонус'}» (+${addAmount})!\n\nПредмет добавлен в ваш баланс и готов к использованию.`
      );

      // 7. Save cloud inbox
      await saveCloudInbox(userId, cachedInbox);
    } catch (err) {
      console.error('[GiftsModule] Claim gift error:', err);
      showNotification('⚠️', 'Ошибка', 'Не удалось забрать подарок: ' + err.message);
    } finally {
      isClaiming = false;
    }
  }

  function renderSendView() {
    const dailyDisplay = document.getElementById('giftsDailyCountDisplay');
    const stepRecipient = document.getElementById('giftsStepRecipient');
    const stepItem = document.getElementById('giftsStepItem');

    if (!currentUserRef) return;
    const userId = String(currentUserRef.telegramId);
    const stats = getDailyStats(userId);

    if (dailyDisplay) {
      dailyDisplay.textContent = `${stats.count} / ${MAX_DAILY_GIFTS}`;
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
    } else {
      if (stepRecipient) stepRecipient.classList.remove('hidden');
      if (stepItem) stepItem.classList.add('hidden');
      loadAndRenderPlayersList();
    }
  }

  async function loadAndRenderPlayersList(searchQuery = '') {
    const listEl = document.getElementById('giftsPlayersList');
    const loadingEl = document.getElementById('giftsPlayersLoading');
    if (!listEl) return;

    if (cachedPlayers.length === 0) {
      if (loadingEl) loadingEl.classList.remove('hidden');
      try {
        if (typeof getLeaderboardPlayersCallback === 'function') {
          const players = await getLeaderboardPlayersCallback();
          if (Array.isArray(players) && players.length > 0) {
            cachedPlayers = players;
          }
        }
      } catch (e) {}

      // Fallback: Fetch from cloud if callback returned empty
      if (cachedPlayers.length === 0) {
        try {
          const res = await fetch(`${GLOBAL_CLOUD_BASE}/?prefix=player_&values=true&format=json&_cb=${Date.now()}`);
          if (res.ok) {
            const pairs = await res.json();
            if (Array.isArray(pairs)) {
              cachedPlayers = pairs
                .map(([k, p]) => p)
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
    let filtered = cachedPlayers.filter(p => String(p.telegramId) !== myId);

    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(p => {
        const name = (p.firstName || p.first_name || p.name || '').toLowerCase();
        return name.includes(q);
      });
    }

    listEl.innerHTML = '';
    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div style="text-align: center; color: #94a3b8; font-size: 0.85rem; padding: 18px 8px;">
          ${searchQuery ? 'Игроки по запросу не найдены' : 'Список игроков пуст'}
        </div>
      `;
      return;
    }

    filtered.forEach((player, idx) => {
      const rank = idx + 1;
      const rankBadge = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
      const name = player.firstName || player.first_name || player.name || 'Игрок';
      const lvl = player.maxLevel !== undefined ? player.maxLevel : (player.level || 1);

      const row = document.createElement('div');
      row.className = 'gift-player-row';
      row.innerHTML = `
        <div class="gift-player-left">
          <span class="gift-player-rank">${rankBadge}</span>
          <strong class="gift-player-name">${escapeHtml(name)}</strong>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="gift-player-lvl">Уровень ${lvl}</span>
          <button type="button" class="gift-player-select-btn">Выбрать</button>
        </div>
      `;

      row.addEventListener('click', () => {
        selectedRecipient = {
          telegramId: String(player.telegramId),
          displayName: name,
          level: lvl
        };
        renderSendView();
      });

      listEl.appendChild(row);
    });
  }

  async function sendGift(giftType) {
    if (isSending || !currentUserRef || !selectedRecipient) return;

    const myId = String(currentUserRef.telegramId);
    const targetId = String(selectedRecipient.telegramId);
    const targetName = selectedRecipient.displayName;

    if (myId === targetId) {
      showNotification('⚠️', 'Ошибка', 'Вы не можете отправить подарок самому себе.');
      return;
    }

    // 1. Check daily limit
    const dailyStats = getDailyStats(myId);
    if (dailyStats.count >= MAX_DAILY_GIFTS) {
      showNotification(
        '⏳',
        'Лимит исчерпан',
        'Вы уже отправили максимум 10 подарков сегодня.\n\nСчётчик сбросится сегодня в 23:59 по времени Киева.'
      );
      return;
    }

    // 2. Check balance of the item
    const config = GIFT_CONFIG[giftType];
    if (!config) return;
    const currentBal = getUserBoosterCount(config.boosterField);

    if (currentBal <= 0) {
      showNotification('❌', 'У вас нет этого подарка', `У вас 0 шт. «${config.name}». Нельзя подарить предмет, которого нет в вашем балансе.`);
      return;
    }

    isSending = true;

    try {
      // 3. Deduct from sender balance
      if (config.boosterField === 'extraBottles') {
        currentUserRef.extraBottles = Math.max(0, currentBal - 1);
        currentUserRef.extra_bottles = currentUserRef.extraBottles;
      } else {
        currentUserRef[config.boosterField] = Math.max(0, currentBal - 1);
      }

      // 4. Increment daily counter
      const newDailyCount = incrementDailyStats(myId);

      // 5. Save sender progress locally and to cloud
      if (typeof saveUserCallback === 'function') saveUserCallback();
      if (typeof updateUICallback === 'function') updateUICallback();
      if (typeof updateCloudBoosterCallback === 'function') {
        updateCloudBoosterCallback(config.boosterField, currentUserRef[config.boosterField]);
      }

      // 6. Push gift to recipient's inbox in KVDB
      // NOTE: Sender information is intentionally NOT included, as requested:
      // "И не нужно показывать кто прислал подарок, просто уведомление о подарке."
      const newGift = {
        id: 'gift_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
        giftType: giftType,
        giftName: config.name,
        giftIcon: config.icon,
        amount: 1,
        createdAt: Date.now(),
        claimed: false
      };

      const recipientInbox = await fetchCloudInbox(targetId);
      recipientInbox.push(newGift);
      await saveCloudInbox(targetId, recipientInbox);

      // 7. Sound & Haptics
      if (window.TelegramApp && window.TelegramApp.TelegramApp) {
        window.TelegramApp.TelegramApp.haptic('success');
      }

      // 8. Success Feedback
      showNotification(
        '🎁',
        'Подарок отправлен!',
        `Вы успешно отправили ${config.icon} «${config.name}» игроку ${targetName}!\n\nС вашего баланса списан 1 предмет (осталось: ${getUserBoosterCount(config.boosterField)}).\nОтправлено сегодня: ${newDailyCount} / ${MAX_DAILY_GIFTS}.`
      );

      // Return to recipient selection list
      selectedRecipient = null;
      renderSendView();
    } catch (err) {
      console.error('[GiftsModule] Send gift error:', err);
      showNotification('⚠️', 'Ошибка отправки', 'Не удалось доставить подарок: ' + err.message);
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

    // Send Gift buttons in catalog
    const sendButtons = document.querySelectorAll('.gift-send-btn');
    sendButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const type = btn.getAttribute('data-gift-type');
        if (type) {
          sendGift(type);
        }
      });
    });
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

      bindEvents();

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
        displayName: recipient.displayName || recipient.firstName || recipient.name || 'Игрок',
        level: recipient.level || recipient.maxLevel || 1
      };
      const sendBtn = document.getElementById('giftsSubnavSendBtn');
      if (sendBtn && !sendBtn.classList.contains('active')) {
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
