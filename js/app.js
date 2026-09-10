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
  const closeLeaderboardBtn = document.getElementById('closeLeaderboardBtn');
  const leaderboardList = document.getElementById('leaderboardList');
  const modalUserPos = document.getElementById('modalUserPos');
  const modalUserName = document.getElementById('modalUserName');
  const modalUserLevel = document.getElementById('modalUserLevel');

  const winModal = document.getElementById('winModal');
  const adModal = document.getElementById('adModal');
  const closeAdModalBtn = document.getElementById('closeAdModalBtn');

  // App specific dynamic modals (may or may not exist in DOM natively)
  const loadingScreen = document.getElementById('loadingScreen');
  const restartModal = document.getElementById('restartModal');
  const infoModal = document.getElementById('infoModal');

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

  // Custom Modal Helpers
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

    if (infoModal) infoModal.classList.remove('hidden');
    else alert(`${icon} ${title}\n${text}`);
  }

  const infoModalOkBtn = document.getElementById('infoModalOkBtn');
  if (infoModalOkBtn && infoModal) {
    infoModalOkBtn.addEventListener('click', () => {
      infoModal.classList.add('hidden');
      infoModalActionCallback = null;
    });
  }

  const infoModalActionBtn = document.getElementById('infoModalActionBtn');
  if (infoModalActionBtn && infoModal) {
    infoModalActionBtn.addEventListener('click', async () => {
      infoModal.classList.add('hidden');
      if (typeof infoModalActionCallback === 'function') {
        const cb = infoModalActionCallback;
        infoModalActionCallback = null;
        await cb();
      }
    });
  }

  // Server Communication (with offline fallback for GitHub Pages & standalone play)
  const API_BASE = (typeof window !== 'undefined' && window.location.hostname.includes('github.io'))
    ? 'https://color-sort-game.onrender.com'
    : ''; 
  async function apiCall(endpoint, method = 'GET', body = null) {
    try {
      const options = { method, headers: { 'Content-Type': 'application/json' } };
      if (body) options.body = JSON.stringify(body);
      
      const tg = window.Telegram && window.Telegram.WebApp;
      if (tg && tg.initData) {
        options.headers['x-telegram-init-data'] = tg.initData;
      }
      
      const res = await fetch(API_BASE + endpoint, options);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.warn('[API] Оффлайн режим:', e);
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
  if (userName) userName.textContent = currentUser.firstName;
  if (userAvatar) {
    userAvatar.src = userData.photoUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(userData.telegramId)}`;
  }

  const serverUser = await apiCall('/api/user/init', 'POST', userData);
  if (serverUser && serverUser.success && serverUser.user) {
    currentUser = { ...currentUser, ...serverUser.user };
  }
  saveLocalUser();
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

  engine.onWin = async ({ levelNumber, moves }) => {
    if (renderer && renderer.triggerWinConfetti) renderer.triggerWinConfetti();
    
    // Simple victory progression: advance level without coins, stars, or experience
    currentUser.currentLevel = levelNumber + 1;
    currentUser.maxLevel = Math.max(currentUser.maxLevel, currentUser.currentLevel);
    
    saveLocalUser();
    updateHeaderUI();

    // Sync to server
    await apiCall('/api/user/sync', 'POST', {
      telegramId: currentUser.telegramId,
      currentLevel: currentUser.currentLevel,
      maxLevel: currentUser.maxLevel,
      starsAdded: 0,
      coinsAdded: 0
    });

    setTimeout(() => {
      if (winModal) winModal.classList.remove('hidden');
    }, 600);
  };

  // 8. Load level
  const LG = (window.LevelGenerator && window.LevelGenerator.LevelGenerator) ? window.LevelGenerator.LevelGenerator : window.LevelGenerator;
  const levelTypeBadge = document.getElementById('levelTypeBadge');

  async function loadCurrentLevel() {
    if (levelDisplay) levelDisplay.textContent = currentUser.currentLevel;
    if (LG && LG.generateLevel) {
      currentLevelData = LG.generateLevel(currentUser.currentLevel);
      engine.startLevel(currentLevelData);

      // Update level archetype badge
      if (levelTypeBadge && currentLevelData.config) {
        const cfg = currentLevelData.config;
        levelTypeBadge.className = 'level-type-tag';
        if (cfg.isChallenge) {
          levelTypeBadge.textContent = '🔥 БОСС';
          levelTypeBadge.classList.add('boss');
        } else if (cfg.isIntro) {
          levelTypeBadge.textContent = '✨ ВВОД';
          levelTypeBadge.classList.add('intro');
        } else {
          levelTypeBadge.textContent = `⚡ ${cfg.emptyJars === 1 ? '1 Пустая' : cfg.emptyJars + ' Пустые'}`;
        }
      }

      // Explicitly render board to guarantee DOM is populated immediately
      if (renderer && renderer.renderBoard) {
        renderer.renderBoard(engine);
      }

      updateHeaderUI();
    }
  }
  await loadCurrentLevel();

  function updateHeaderUI() {
    if (levelDisplay) levelDisplay.textContent = currentUser.currentLevel || 1;
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
        restartModal.classList.remove('hidden');
      } else if (confirm('Начать уровень заново?')) {
        engine.startLevel(currentLevelData);
        if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('light');
      }
    });
  }

  const confirmRestartBtn = document.getElementById('confirmRestartBtn');
  const cancelRestartBtn = document.getElementById('cancelRestartBtn');
  if (confirmRestartBtn && restartModal) {
    confirmRestartBtn.addEventListener('click', () => {
      restartModal.classList.add('hidden');
      engine.startLevel(currentLevelData);
      if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('light');
    });
  }
  if (cancelRestartBtn && restartModal) {
    cancelRestartBtn.addEventListener('click', () => {
      restartModal.classList.add('hidden');
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
    nextLevelBtn.addEventListener('click', async () => {
      if (winModal) winModal.classList.add('hidden');
      await loadCurrentLevel();
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

  if (leaderboardBtn) {
    leaderboardBtn.addEventListener('click', async () => {
      if (leaderboardModal) leaderboardModal.classList.remove('hidden');
      if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('light');

      if (leaderboardList) leaderboardList.innerHTML = '<li class="leaderboard-item">Загрузка рейтинга...</li>';

      const data = await apiCall(`/api/leaderboard?telegramId=${encodeURIComponent(currentUser.telegramId)}`);
      
      if (data && data.success && leaderboardList) {
        leaderboardList.innerHTML = '';
        data.topPlayers.forEach((player, idx) => {
          const rank = idx + 1;
          const li = document.createElement('li');
          li.className = `leaderboard-item ${rank <= 3 ? 'top-' + rank : ''}`;
          
          const crown = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
          li.innerHTML = `
            <div class="player-meta">
              <span class="rank-num">${crown}</span>
              <strong>${escapeHtml(player.first_name)}</strong>
            </div>
            <span class="user-rank">Уровень ${player.max_level}</span>
          `;
          leaderboardList.appendChild(li);
        });

        if (data.userRank) {
          if (modalUserPos) modalUserPos.textContent = `#${data.userRank.rank}`;
          if (modalUserName) modalUserName.textContent = `${data.userRank.first_name} (Вы)`;
          if (modalUserLevel) modalUserLevel.textContent = `Макс. уровень: ${data.userRank.max_level}`;
          if (userRank) userRank.textContent = `Ранг: #${data.userRank.rank}`;
        }
      } else if (leaderboardList) {
        leaderboardList.innerHTML = '<li class="leaderboard-item">Ошибка загрузки рейтинга. (Оффлайн режим)</li>';
      }
    });
  }

  if (closeLeaderboardBtn) {
    closeLeaderboardBtn.addEventListener('click', () => {
      if (leaderboardModal) leaderboardModal.classList.add('hidden');
    });
  }

  if (adBonusBtn) {
    adBonusBtn.addEventListener('click', (e) => {
      if (justStartedGame) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        return;
      }
      if (adModal) {
        adModal.classList.remove('hidden');
        adModal.style.display = 'flex';
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
        adModal.classList.add('hidden');
        adModal.style.display = 'none';
      }
    });
  }

  if (adModal) {
    adModal.addEventListener('click', (e) => {
      if (e.target === adModal) {
        if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('light');
        adModal.classList.add('hidden');
        adModal.style.display = 'none';
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
          if (adModal) adModal.classList.add('hidden');
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

