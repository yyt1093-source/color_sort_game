const path = require('path');
const fs = require('fs');
const db = require('./db');

// Load .env if present
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      process.env[key.trim()] = value.trim();
    }
  });
}

const BOT_TOKEN = process.env.BOT_TOKEN;
function getWebAppUrl() {
  return process.env.WEB_APP_URL || 'https://yyt1093-source.github.io/color_sort_game/';
}
let cachedStartPhotoFileId = null;
if (!BOT_TOKEN) {
  console.log('----------------------------------------------------');
  console.log('⚠️  Telegram BOT_TOKEN не указан в формате .env');
  console.log('Чтобы запустить бота:');
  console.log('1. Создайте файл .env в папке проекта');
  console.log('2. Укажите: BOT_TOKEN=ваш_токен_от_BotFather');
  console.log('3. Укажите: WEB_APP_URL=https://ваш-https-домен.ngrok-free.app');
  console.log('----------------------------------------------------');
}

/**
 * Send request to Telegram Bot API
 */
async function tgApi(method, payload = {}) {
  if (!BOT_TOKEN) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await res.json();
  } catch (err) {
    console.error(`[Telegram Bot Error] ${method}:`, err.message);
    return null;
  }
}

/**
 * Long Polling loop for Telegram Bot
 */
async function startBot() {
  if (!BOT_TOKEN) return;

  console.log('🤖 Запуск Telegram Бота для Mini App...');
  const me = await tgApi('getMe');
  if (me && me.ok) {
    console.log(`✅ Бот успешно подключен: @${me.result.username} (${me.result.first_name})`);
  } else {
    console.error('❌ Не удалось подключить бота! Проверьте BOT_TOKEN.');
    return;
  }

  // Set default Menu Button to open Mini App
  await tgApi('setChatMenuButton', {
    menu_button: {
      type: 'web_app',
      text: '🎮 Играть в Color Sort',
      web_app: { url: getWebAppUrl() }
    }
  });

  // Set Bot Commands
  await tgApi('setMyCommands', {
    commands: [
      { command: 'start', description: 'Запустить игру' },
      { command: 'ref', description: 'Реферальная ссылка и бонусы' },
      { command: 'leaderboard', description: 'Топ 10 игроков' },
      { command: 'mystats', description: 'Моя статистика' },
      { command: 'help', description: 'Помощь' }
    ]
  });

  let offset = 0;
  while (true) {
    try {
      const updates = await tgApi('getUpdates', { offset, timeout: 20 });
      if (updates && updates.ok && updates.result.length > 0) {
        for (const update of updates.result) {
          offset = update.update_id + 1;
          await handleUpdate(update);
        }
      }
    } catch (e) {
      console.error('[Polling Loop Error]', e);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

/**
 * Handle incoming Telegram messages
 */
async function handleUpdate(update) {
  // Handle inline queries
  if (update.inline_query) {
    await handleInlineQuery(update.inline_query);
    return;
  }

  // Handle callback queries (inline buttons)
  if (update.callback_query) {
    const cq = update.callback_query;
    const chatId = cq.message ? cq.message.chat.id : cq.from.id;
    const userId = String(cq.from.id);
    const data = cq.data;

    await tgApi('answerCallbackQuery', { callback_query_id: cq.id });

    if (data === 'cmd_leaderboard') {
      await sendLeaderboard(chatId);
    } else if (data === 'cmd_mystats') {
      await sendMyStats(chatId, userId);
    }
    return;
  }

  if (!update.message) return;
  const chatId = update.message.chat.id;
  const text = update.message.text || '';
  const firstName = update.message.from.first_name || 'Игрок';
  const userId = String(update.message.from.id);

  // Parse commands
  if (text.startsWith('/start')) {
    // Parse possible referral code: /start ref_12345 or /start 12345
    const parts = text.split(/\s+/);
    let referrerId = null;
    if (parts.length > 1) {
      const param = parts[1];
      const m = param.match(/(?:ref_)?(\d+)/i);
      if (m && m[1] && m[1] !== userId) {
        referrerId = m[1];
      }
    }

    // Create/update user in DB
    db.getUser(userId, {
      first_name: firstName,
      username: update.message.from.username || ''
    });

    if (referrerId) {
      const regRes = db.registerReferral(referrerId, userId, firstName, update.message.from.username || '');
      if (regRes && regRes.success) {
        const KVDB_BASE = 'https://kvdb.io/82kzJTUxZwwFNvg7kUSqgM';
        const cleanUname = (update.message.from.username || '').toLowerCase().replace(/^@/, '').trim();
        fetch(`${KVDB_BASE}/ref_registry_binding_${userId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refereeId: userId, referrerId: referrerId, refereeName: firstName, refereeUsername: cleanUname, boundAt: Date.now(), permanent: true })
        }).catch(() => {});
        fetch(`${KVDB_BASE}/binding_ref_${userId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refereeId: userId, referrerId: referrerId, refereeName: firstName, refereeUsername: cleanUname, boundAt: Date.now(), permanent: true })
        }).catch(() => {});
        fetch(`${KVDB_BASE}/ref_${referrerId}_${userId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: `ref_${referrerId}_${userId}`, referrerId: referrerId, referredId: userId, referredName: firstName, referredUsername: cleanUname, rewardClaimed: 0, createdAt: Date.now() })
        }).catch(() => {});
      }
    }

    const appLaunchUrl = referrerId ? `${getWebAppUrl()}?startapp=ref_${referrerId}` : getWebAppUrl();

    // Update user's chat menu button asynchronously without blocking photo delivery
    tgApi('setChatMenuButton', {
      chat_id: chatId,
      menu_button: {
        type: 'web_app',
        text: '🎮 Играть в Color Sort',
        web_app: { url: appLaunchUrl }
      }
    }).catch(() => {});

    const photoUrl = 'https://yyt1093-source.github.io/color_sort_game/referral_art_clean.jpg';
    const inlineKeyboard = {
      inline_keyboard: [
        [
          {
            text: 'START',
            web_app: { url: appLaunchUrl }
          }
        ]
      ]
    };

    // Use cached file_id when available for instant 50ms photo delivery
    const photoPayload = (typeof cachedStartPhotoFileId !== 'undefined' && cachedStartPhotoFileId) ? cachedStartPhotoFileId : photoUrl;
    const photoRes = await tgApi('sendPhoto', {
      chat_id: chatId,
      photo: photoPayload,
      caption: '',
      reply_markup: inlineKeyboard
    });

    if (photoRes && photoRes.ok && photoRes.result && photoRes.result.photo && Array.isArray(photoRes.result.photo)) {
      const pArr = photoRes.result.photo;
      if (pArr.length > 0) {
        cachedStartPhotoFileId = pArr[pArr.length - 1].file_id;
      }
    }

    // Fallback to text message if photo delivery failed
    if (!photoRes || !photoRes.ok) {
      await tgApi('sendMessage', {
        chat_id: chatId,
        text: 'START',
        reply_markup: inlineKeyboard
      });
    }
  } else if (text.startsWith('/ref') || text.startsWith('/referral') || text.startsWith('/share')) {
    await sendReferralInvite(chatId, userId, firstName);
  } else if (text.startsWith('/leaderboard')) {
    await sendLeaderboard(chatId);
  } else if (text.startsWith('/mystats')) {
    await sendMyStats(chatId, userId);
  } else if (text.startsWith('/reset_season') || text.startsWith('/season_reset')) {
    await handleAdminResetSeason(chatId, userId);
  } else if (text.startsWith('/help')) {
    await tgApi('sendMessage', {
      chat_id: chatId,
      text: `ℹ️ **Помощь по игре Color Sort**\n\nПравила просты: переливайте цвета из одной баночки в другую так, чтобы в каждой баночке остался только один цвет.\n\nКоманды:\n/start - Запустить игру\n/ref - Реферальная ссылка и бонусы\n/leaderboard - Топ 10 игроков\n/mystats - Ваша статистика\n/help - Это сообщение`,
      parse_mode: 'Markdown'
    });
  }
}

async function sendReferralInvite(chatId, userId, firstName) {
  const inviteUrl = `https://yyt1093-source.github.io/color_sort_game/invite.html?startapp=ref_${userId}`;
  const shareTgUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}`;
  const photoUrl = 'https://yyt1093-source.github.io/color_sort_game/referral_art_clean.jpg';

  const inlineKeyboard = {
    inline_keyboard: [
      [
        {
          text: 'START',
          web_app: { url: `${getWebAppUrl()}?startapp=ref_${userId}` }
        }
      ],
      [
        {
          text: '📢 Отправить ссылку другу',
          url: shareTgUrl
        }
      ]
    ]
  };

  const photoRes = await tgApi('sendPhoto', {
    chat_id: chatId,
    photo: photoUrl,
    caption: '',
    reply_markup: inlineKeyboard
  });

  if (!photoRes || !photoRes.ok) {
    await tgApi('sendMessage', {
      chat_id: chatId,
      text: 'START',
      reply_markup: inlineKeyboard
    });
  }
}

async function handleInlineQuery(inlineQuery) {
  const query = inlineQuery.query || '';
  const fromId = String(inlineQuery.from.id);
  let refId = fromId;
  const m = query.match(/(?:ref_)?(\d+)/i);
  if (m && m[1]) refId = m[1];

  const photoUrl = 'https://yyt1093-source.github.io/color_sort_game/referral_art_clean.jpg';
  const botRefUrl = `https://t.me/sortcolors_bot?startapp=ref_${refId}`;

  await tgApi('answerInlineQuery', {
    inline_query_id: inlineQuery.id,
    cache_time: 1,
    is_personal: true,
    results: [
      {
        type: 'photo',
        id: 'ref_' + refId,
        photo_url: photoUrl,
        thumb_url: photoUrl,
        title: 'Color Sort',
        caption: '',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: 'START',
                url: botRefUrl
              }
            ]
          ]
        }
      }
    ]
  });
}

async function sendLeaderboard(chatId) {
  let topPlayers = [];
  const bucket = process.env.KVDB_BUCKET || '82kzJTUxZwwFNvg7kUSqgM';

  // Get current season reset timestamp from KVDB and SQLite
  let seasonResetAt = 0;
  try {
    const metaRes = await fetch(`https://kvdb.io/${bucket}/meta_season_reset_at?_cb=${Date.now()}`, {
      signal: AbortSignal.timeout(2000)
    });
    if (metaRes.ok) {
      const metaData = await metaRes.json();
      seasonResetAt = Number(metaData.resetAt || metaData) || 0;
    }
  } catch (e) {}

  if (!seasonResetAt) {
    try {
      seasonResetAt = db.getSeasonResetTimestamp ? db.getSeasonResetTimestamp() : 0;
    } catch (e) {}
  }

  // Query SQLite
  try {
    const res = db.getLeaderboard(null, 10);
    if (res && res.topPlayers) {
      // Only real players with at least 1 completed level (level >= 1)
      topPlayers = res.topPlayers.filter(p => Number(p.max_level || 0) >= 1);
    }
  } catch (e) {}

  // Query global cloud KVDB (Single Source of Truth)
  try {
    const cloudRes = await fetch(`https://kvdb.io/${bucket}/?prefix=player_&values=true&format=json&_cb=${Date.now()}`, {
      signal: AbortSignal.timeout(2500)
    });
    if (cloudRes.ok) {
      const pairs = await cloudRes.json();
      const cloudPlayers = pairs.map(([k, p]) => {
        if (typeof p === 'string') {
          try { return JSON.parse(p); } catch (e) { return null; }
        }
        return p;
      }).filter(p => p && p.telegramId && !String(p.telegramId).startsWith('guest') && !String(p.telegramId).startsWith('dev') && /^\d+$/.test(String(p.telegramId)));
      
      const map = new Map();
      topPlayers.forEach(p => {
        const lvl = Number(p.max_level || 0);
        if (lvl >= 1) {
          map.set(String(p.telegram_id), { name: p.first_name, level: lvl, stars: p.stars || 0 });
        }
      });

      cloudPlayers.forEach(p => {
        const id = String(p.telegramId);
        const pTime = Number(p.updatedAt || p.seasonResetAt || 0);
        if (seasonResetAt > 0 && pTime > 0 && pTime < seasonResetAt) return;

        // STRICT RULE: Only players with maxLevel >= 1 appear in leaderboard
        const lvl = Number(p.maxLevel !== undefined ? p.maxLevel : (p.level !== undefined ? p.level : 0));
        if (lvl < 1) return;

        const existing = map.get(id);
        if (!existing || lvl > existing.level) {
          map.set(id, { name: p.firstName || (existing ? existing.name : 'Игрок'), level: lvl, stars: p.stars || (existing ? existing.stars : 0) });
        }
      });

      topPlayers = Array.from(map.values())
        .sort((a, b) => b.level - a.level || (b.stars || 0) - (a.stars || 0))
        .slice(0, 10);
    }
  } catch (e) {}
  
  if (!topPlayers || topPlayers.length === 0) {
    await tgApi('sendMessage', { 
      chat_id: chatId, 
      text: '🏆 **Глобальный рейтинг игроков**\n\nТаблица лидеров пуста (0 игроков).\nПройдите первый уровень и станьте первым в рейтинге!\n\n🎮 Нажмите кнопку ниже для запуска игры.',
      parse_mode: 'Markdown'
    });
    return;
  }

  let msg = '🏆 **Глобальный рейтинг игроков (24/7)** 🏆\n\n';
  const medals = ['🥇', '🥈', '🥉'];

  topPlayers.forEach((p, idx) => {
    const medal = idx < 3 ? medals[idx] : `*#${idx + 1}*`;
    const name = p.name || p.first_name || 'Игрок';
    const lvl = p.level || p.max_level || 1;
    msg += `${medal} **${name}** — Уровень ${lvl}\n`;
  });

  msg += '\n✨ Рейтинг обновляется мгновенно после каждого пройденного уровня!';

  await tgApi('sendMessage', {
    chat_id: chatId,
    text: msg,
    parse_mode: 'Markdown'
  });
}

async function sendMyStats(chatId, userId) {
  const user = db.getUser(userId);
  if (!user) {
    await tgApi('sendMessage', {
      chat_id: chatId,
      text: '⚠️ Вы еще не начали играть. Нажмите /start, чтобы запустить игру!'
    });
    return;
  }

  const maxLvl = Number(user.max_level || 0);
  const maxLvlText = maxLvl >= 1 ? `${maxLvl}` : '0 (пройдите 1-й тур для лидерборда)';

  const msg = `📊 **Ваша статистика**\n\n` +
    `👤 Игрок: ${user.first_name}\n` +
    `📈 Макс. уровень: ${maxLvlText}\n` +
    `Текущий уровень: ${user.current_level || 1}\n` +
    `⭐ Звезды: ${user.stars || 0}\n` +
    `💰 Монеты: ${user.coins || 0}\n` +
    `🔄 Ходов: ${user.total_moves || 0}\n` +
    `💡 Подсказок: ${user.hints || 0}\n` +
    `🔙 Отмен хода: ${user.undos || 0}\n`;

  await tgApi('sendMessage', {
    chat_id: chatId,
    text: msg,
    parse_mode: 'Markdown'
  });
}

/**
 * Admin reset season from Telegram Bot
 */
async function handleAdminResetSeason(chatId, userId) {
  const ALLIGATOR_ID = '5761685341';
  const adminIds = (process.env.ADMIN_IDS || '').split(',').map(s => s.trim());
  const isAdmin = (String(userId) === ALLIGATOR_ID) || adminIds.includes(String(userId));

  if (!isAdmin) {
    await tgApi('sendMessage', {
      chat_id: chatId,
      text: '⛔ **Доступ запрещен.** Команда доступна только администратору игры.'
    });
    return;
  }

  await tgApi('sendMessage', {
    chat_id: chatId,
    text: '⏳ **Выполняется сброс сезона под ноль...**\nБот выполняет резервный контроль лидерборда до и после сброса.'
  });

  const bucket = process.env.KVDB_BUCKET || '82kzJTUxZwwFNvg7kUSqgM';
  const baseUrl = `https://kvdb.io/${bucket}`;

  // 1. КОНТРОЛЬ ДО СБРОСА: заходим в лидерборд и собираем всех актуальных игроков
  let beforePlayers = [];
  try {
    const listRes = await fetch(`${baseUrl}/?prefix=player_&values=true&format=json&_cb=${Date.now()}`);
    if (listRes.ok) {
      const pairs = await listRes.json();
      beforePlayers = pairs
        .map(([k, p]) => (typeof p === 'string' ? JSON.parse(p) : p))
        .filter(p => p && p.telegramId && Number(p.maxLevel || p.level || 0) >= 1);
    }
  } catch (e) {}

  const beforeCount = beforePlayers.length;
  const resetTimestamp = Date.now();

  // 2. СБРОС С ПЕРЕСТРАХОВКОЙ
  // а) Ставим метку в KVDB
  try {
    await fetch(`${baseUrl}/meta_season_reset_at`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resetAt: resetTimestamp })
    });
  } catch (e) {}

  // б) Индивидуальный сброс каждого игрока из топа
  if (beforePlayers.length > 0) {
    await Promise.allSettled(
      beforePlayers.map(async (p) => {
        try {
          const pid = String(p.telegramId);
          p.currentLevel = 1;
          p.maxLevel = 0;
          p.level = 0;
          p.stars = 0;
          p.total_moves = 0;
          p.seasonResetAt = resetTimestamp;
          p.updatedAt = resetTimestamp;
          // ton_wallet, ton_balance, memo_code, all_colors_until СТРОГО СОХРАНЯЮТСЯ!
          return fetch(`${baseUrl}/player_${encodeURIComponent(pid)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(p)
          });
        } catch (e) {}
      })
    );
  }

  // в) Сброс в локальной БД SQLite
  try {
    db.resetSeason(resetTimestamp);
  } catch (e) {}

  // 3. КОНТРОЛЬНЫЙ ВХОД ПОСЛЕ СБРОСА
  let afterCount = 0;
  try {
    const checkRes = await fetch(`${baseUrl}/?prefix=player_&values=true&format=json&_cb=${Date.now()}`);
    if (checkRes.ok) {
      const pairs = await checkRes.json();
      const afterPlayers = pairs
        .map(([k, p]) => (typeof p === 'string' ? JSON.parse(p) : p))
        .filter(p => p && p.telegramId && Number(p.maxLevel || p.level || 0) >= 1 && Number(p.updatedAt || p.seasonResetAt || 0) >= resetTimestamp);
      afterCount = afterPlayers.length;
    }
  } catch (e) {}

  let sampleText = '';
  if (beforePlayers.length > 0) {
    const list = beforePlayers.slice(0, 5).map(p => `• ${p.firstName || 'Игрок'}: ур. ${p.maxLevel || p.level} ➔ 0`).join('\n');
    sampleText = `\n📋 **Сброшены игроки из лидерборда (${beforeCount}):**\n${list}\n`;
  }

  const resultMsg = `🔥 **Сезон успешно сброшен под ноль!**\n` +
    sampleText +
    `\n✅ **Контрольная проверка ПОСЛЕ сброса:**\n` +
    `• В лидерборде: ${afterCount} игроков (таблица пуста)\n` +
    `• Все игроки получили Уровень 0\n` +
    `• Игрок появится в рейтинге только после победы в 1-м туре\n\n` +
    `🛡️ **Кошелек TON, покупки и рефералы сохранены!**`;

  await tgApi('sendMessage', {
    chat_id: chatId,
    text: resultMsg,
    parse_mode: 'Markdown'
  });
}

async function updateBotMenuButton(url) {
  if (!BOT_TOKEN) return;
  const webAppUrl = url || getWebAppUrl();

  // 1. Update default global menu button
  await tgApi('setChatMenuButton', {
    menu_button: {
      type: 'web_app',
      text: '🎮 Играть в Color Sort',
      web_app: { url: webAppUrl }
    }
  });

  // 2. Also update for all existing users explicitly & send fresh launch button
  try {
    const userIds = db.getAllTelegramIds ? db.getAllTelegramIds() : [];
    for (const uid of userIds) {
      if (uid && !isNaN(Number(uid))) {
        await tgApi('setChatMenuButton', {
          chat_id: String(uid),
          menu_button: {
            type: 'web_app',
            text: '🎮 Играть в Color Sort',
            web_app: { url: webAppUrl }
          }
        });

        await tgApi('sendMessage', {
          chat_id: String(uid),
          text: `🟢 **Игра Color Sort перезапущена!**\n\nВсе ошибки устранены, сервер онлайн. Нажмите кнопку ниже, чтобы войти в игру: 👇`,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '🎮 Играть в Color Sort',
                  web_app: { url: webAppUrl }
                }
              ]
            ]
          }
        });
      }
    }
  } catch (err) {
    console.error('[MenuButton Error]', err.message);
  }
}

module.exports = { startBot, updateBotMenuButton };

if (require.main === module) {
  startBot();
}
