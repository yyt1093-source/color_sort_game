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
    // Create/update user in DB
    db.getUser(userId, {
      first_name: firstName,
      username: update.message.from.username || ''
    });

    // Ensure user's chat menu button is updated directly
    await tgApi('setChatMenuButton', {
      chat_id: chatId,
      menu_button: {
        type: 'web_app',
        text: '🎮 Играть в Color Sort',
        web_app: { url: getWebAppUrl() }
      }
    });

    await tgApi('sendMessage', {
      chat_id: chatId,
      text: `Привет, ${firstName}! 👋\n\nДобро пожаловать в 🧪 **Color Sort** — увлекательную головоломку с переливанием жидкостей!\n\n✨ **Особенности игры:**\n• Бесконечные уровни ♾️\n• Глобальный рейтинг игроков 🏆\n• Бесплатные бонусы 🎁\n• Сохранение прогресса 💾\n\nНажмите кнопку ниже, чтобы начать играть! 👇`,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '🎮 Играть сейчас',
              web_app: { url: getWebAppUrl() }
            }
          ],
          [
            {
              text: '🏆 Лидерборд',
              callback_data: 'cmd_leaderboard'
            },
            {
              text: '📊 Моя стата',
              callback_data: 'cmd_mystats'
            }
          ]
        ]
      }
    });
  } else if (text.startsWith('/leaderboard')) {
    await sendLeaderboard(chatId);
  } else if (text.startsWith('/mystats')) {
    await sendMyStats(chatId, userId);
  } else if (text.startsWith('/help')) {
    await tgApi('sendMessage', {
      chat_id: chatId,
      text: `ℹ️ **Помощь по игре Color Sort**\n\nПравила просты: переливайте цвета из одной баночки в другую так, чтобы в каждой баночке остался только один цвет.\n\nКоманды:\n/start - Запустить игру\n/leaderboard - Топ 10 игроков\n/mystats - Ваша статистика\n/help - Это сообщение`,
      parse_mode: 'Markdown'
    });
  }
}

async function sendLeaderboard(chatId) {
  let topPlayers = [];

  // Query SQLite
  try {
    const res = db.getLeaderboard(null, 10);
    if (res && res.topPlayers) topPlayers = res.topPlayers;
  } catch (e) {}

  // Query global cloud KVDB
  try {
    const bucket = process.env.KVDB_BUCKET || '82kzJTUxZwwFNvg7kUSqgM';
    const cloudRes = await fetch(`https://kvdb.io/${bucket}/?prefix=player_&values=true&format=json`, {
      signal: AbortSignal.timeout(2500)
    });
    if (cloudRes.ok) {
      const pairs = await cloudRes.json();
      const cloudPlayers = pairs.map(([k, p]) => p).filter(p => p && p.telegramId && !String(p.telegramId).startsWith('guest') && !String(p.telegramId).startsWith('dev'));
      
      const map = new Map();
      topPlayers.forEach(p => map.set(String(p.telegram_id), { name: p.first_name, level: p.max_level, stars: p.stars || 0 }));
      cloudPlayers.forEach(p => {
        const id = String(p.telegramId);
        const lvl = Number(p.maxLevel || p.level || 1);
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
      text: '🏆 **Глобальный рейтинг игроков**\n\nПока ни один игрок не зафиксировал победу в глобальной базе данных. Пройдите первый уровень и станьте лидером!\n\n🎮 Нажмите кнопку ниже для запуска игры.',
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

  const msg = `📊 **Ваша статистика**\n\n` +
    `👤 Игрок: ${user.first_name}\n` +
    `📈 Макс. уровень: ${user.max_level}\n` +
    `Текущий уровень: ${user.current_level}\n` +
    `⭐ Звезды: ${user.stars}\n` +
    `💰 Монеты: ${user.coins}\n` +
    `🔄 Ходов: ${user.total_moves}\n` +
    `💡 Подсказок: ${user.hints}\n` +
    `🔙 Отмен хода: ${user.undos}\n`;

  await tgApi('sendMessage', {
    chat_id: chatId,
    text: msg,
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
