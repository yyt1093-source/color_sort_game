const fs = require('fs');
const path = require('path');
const db = require('./db');

// Bot Token and WebApp URL for Color Sort
const BOT_TOKEN = process.env.BOT_TOKEN || '8837816458:AAGeBFs-ZOF56yro_QhZ7b-Wr6v8RaR6x0c';
const WEB_APP_URL = process.env.WEB_APP_URL || 'https://yyt1093-source.github.io/color_sort_game/';

const KVDB_BUCKET = process.env.KVDB_BUCKET || '82kzJTUxZwwFNvg7kUSqgM';
const KVDB_NEWS_KEY = 'color_sort_news_list_v1';
const KVDB_NEWS_URL = `https://kvdb.io/${KVDB_BUCKET}/${KVDB_NEWS_KEY}`;

// Disk storage paths (Writable /tmp on Vercel Serverless, or local data/ in dev)
const TMP_DIR = process.env.TEMP || process.env.TMPDIR || '/tmp';
const TMP_NEWS_DIR = path.join(TMP_DIR, 'color_sort_news');
const TMP_NEWS_FILE = path.join(TMP_NEWS_DIR, 'news_history.json');

try {
  if (!fs.existsSync(TMP_NEWS_DIR)) {
    fs.mkdirSync(TMP_NEWS_DIR, { recursive: true });
  }
} catch (e) {}

// Kyiv Time helper: e.g. "29.09.2026, 18:30:15 (Киев)"
function formatKyivTime(ts = Date.now()) {
  const d = new Date(ts);
  const formattedDate = d.toLocaleDateString('ru-RU', {
    timeZone: 'Europe/Kiev',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  const formattedTime = d.toLocaleTimeString('ru-RU', {
    timeZone: 'Europe/Kiev',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  return `${formattedDate}, ${formattedTime} (Киев)`;
}

// In-memory cache for news items
if (!globalThis.colorSortNewsHistoryCache) {
  globalThis.colorSortNewsHistoryCache = null;
}

function readDiskNews() {
  // 1. Check /tmp
  try {
    if (fs.existsSync(TMP_NEWS_FILE)) {
      const data = fs.readFileSync(TMP_NEWS_FILE, 'utf-8');
      if (data && data.trim()) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return parsed;
      }
    }
  } catch (e) {}

  // 2. Check local data/news_history.json
  try {
    const localData = path.resolve(__dirname, 'data', 'news_history.json');
    if (fs.existsSync(localData)) {
      const content = fs.readFileSync(localData, 'utf-8');
      if (content && content.trim()) {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) return parsed;
      }
    }
  } catch (e) {}

  return [];
}

function writeDiskNews(items) {
  try {
    fs.writeFileSync(TMP_NEWS_FILE, JSON.stringify(items, null, 2), 'utf-8');
  } catch (e) {}

  try {
    const localDataDir = path.resolve(__dirname, 'data');
    if (!fs.existsSync(localDataDir)) {
      fs.mkdirSync(localDataDir, { recursive: true });
    }
    fs.writeFileSync(path.resolve(localDataDir, 'news_history.json'), JSON.stringify(items, null, 2), 'utf-8');
  } catch (e) {}
}

async function fetchNewsHistory() {
  if (globalThis.colorSortNewsHistoryCache && Array.isArray(globalThis.colorSortNewsHistoryCache)) {
    return globalThis.colorSortNewsHistoryCache;
  }

  // 1. Try Cloud KVDB
  try {
    const res = await fetch(`${KVDB_NEWS_URL}?_cb=${Date.now()}`, {
      method: 'GET',
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        globalThis.colorSortNewsHistoryCache = data;
        writeDiskNews(data);
        return data;
      }
    }
  } catch (e) {}

  // 2. Fallback to Disk
  const diskItems = readDiskNews();
  globalThis.colorSortNewsHistoryCache = diskItems;
  return diskItems;
}

async function saveNewsHistory(items) {
  globalThis.colorSortNewsHistoryCache = items;
  writeDiskNews(items);

  try {
    const res = await fetch(KVDB_NEWS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(items)
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

// Admin Authorization check
function checkIsAdmin(reqData) {
  if (!reqData) return false;
  const { telegramId, adminTelegramId, adminTid, adminId, firstName, adminFirstName, username, adminUsername } = reqData;

  const tid = String(adminTelegramId || adminTid || adminId || telegramId || '').trim();
  const fname = String(adminFirstName || firstName || '').toLowerCase().trim();
  const uname = String(adminUsername || username || '').toLowerCase().replace(/^@/, '').trim();

  // Primary admin check: ID 5761685341 (Alligator) or username / first name containing alligator / romanchik
  if (tid === '5761685341') return true;
  if (uname === 'alligator' || uname === 'аллигатор' || uname.includes('alligator') || uname.includes('аллигатор')) return true;
  if (fname === 'alligator' || fname === 'аллигатор' || fname.includes('alligator') || fname.includes('аллигатор')) return true;
  if (uname.includes('romanchik') || uname.includes('романчик') || fname.includes('romanchik') || fname.includes('романчик')) return true;

  return false;
}

// Escape HTML for Telegram Bot API
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Gather all real unique target player Telegram IDs from SQLite and Cloud KVDB
async function getTargetPlayerIds(adminTid = '') {
  const set = new Set();

  // 1. From SQLite users table
  try {
    if (typeof db.getAllTelegramIds === 'function') {
      const sqliteIds = db.getAllTelegramIds();
      if (Array.isArray(sqliteIds)) {
        sqliteIds.forEach(id => {
          const s = String(id).trim();
          if (/^\d{5,15}$/.test(s)) {
            set.add(s);
          }
        });
      }
    }
  } catch (e) {
    console.warn('[newsService] SQLite getAllTelegramIds warning:', e.message);
  }

  // 2. From Cloud KVDB
  try {
    const bucket = process.env.KVDB_BUCKET || '82kzJTUxZwwFNvg7kUSqgM';
    const res = await fetch(`https://kvdb.io/${bucket}/?prefix=player_&format=json&_cb=${Date.now()}`);
    if (res.ok) {
      const keys = await res.json();
      if (Array.isArray(keys)) {
        keys.forEach(k => {
          const tid = String(k).replace(/^player_/, '').trim();
          if (/^\d{5,15}$/.test(tid)) {
            set.add(tid);
          }
        });
      }
    }
  } catch (e) {
    console.warn('[newsService] KVDB player fetch warning:', e.message);
  }

  // 3. Ensure admin ID is present
  const adminIdStr = String(adminTid || '5761685341').trim();
  if (/^\d{5,15}$/.test(adminIdStr)) {
    set.add(adminIdStr);
  }

  return Array.from(set);
}

// Send photo helper: supports URL, Base64, and cached Telegram file_id
async function sendTelegramPhoto(chatId, photoSource, caption, buttonText) {
  const replyMarkup = {
    inline_keyboard: [
      [
        {
          text: buttonText || '🚀 Играть в Color Sort',
          web_app: { url: WEB_APP_URL }
        }
      ]
    ]
  };

  // 1. Fast path: if we have a cached Telegram file_id
  if (photoSource.fileId) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          photo: photoSource.fileId,
          caption: caption.slice(0, 1024),
          parse_mode: 'HTML',
          reply_markup: replyMarkup
        })
      });
      const data = await res.json();
      if (data.ok) return { ok: true, fileId: photoSource.fileId };

      if (data.description && data.description.includes("can't parse entities")) {
        const retryRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            photo: photoSource.fileId,
            caption: caption.slice(0, 1024),
            reply_markup: replyMarkup
          })
        });
        const retryData = await retryRes.json();
        return { ok: retryData.ok, fileId: photoSource.fileId, error: retryData.description };
      }
      return { ok: false, error: data.description };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // 2. Base64 Image upload via FormData
  if (photoSource.base64 && photoSource.base64.startsWith('data:image/')) {
    try {
      const [meta, base64Data] = photoSource.base64.split(';base64,');
      const mime = (meta.split(':')[1] || 'image/jpeg').trim();
      const buffer = Buffer.from(base64Data, 'base64');
      const blob = new Blob([buffer], { type: mime });
      const formData = new FormData();
      formData.append('chat_id', chatId);
      formData.append('photo', blob, 'color_sort_news.jpg');
      formData.append('caption', caption.slice(0, 1024));
      formData.append('parse_mode', 'HTML');
      formData.append('reply_markup', JSON.stringify(replyMarkup));

      const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.ok) {
        const capturedFileId = data.result?.photo?.slice(-1)[0]?.file_id;
        return { ok: true, fileId: capturedFileId };
      }
      return { ok: false, error: data.description };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  // 3. Regular Image URL
  if (photoSource.url) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          photo: photoSource.url,
          caption: caption.slice(0, 1024),
          parse_mode: 'HTML',
          reply_markup: replyMarkup
        })
      });
      const data = await res.json();
      if (data.ok) {
        const capturedFileId = data.result?.photo?.slice(-1)[0]?.file_id;
        return { ok: true, fileId: capturedFileId };
      }
      if (data.description && data.description.includes("can't parse entities")) {
        const retryRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            photo: photoSource.url,
            caption: caption.slice(0, 1024),
            reply_markup: replyMarkup
          })
        });
        const retryData = await retryRes.json();
        const capturedFileId = retryData.result?.photo?.slice(-1)[0]?.file_id;
        return { ok: retryData.ok, fileId: capturedFileId, error: retryData.description };
      }
      return { ok: false, error: data.description };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  return { ok: false, error: 'No valid photo source provided' };
}

// Send text message helper with auto-entity fallback
async function sendTelegramMessage(chatId, text, buttonText) {
  const replyMarkup = {
    inline_keyboard: [
      [
        {
          text: buttonText || '🚀 Играть в Color Sort',
          web_app: { url: WEB_APP_URL }
        }
      ]
    ]
  };

  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text.slice(0, 4096),
        parse_mode: 'HTML',
        reply_markup: replyMarkup
      })
    });
    const data = await res.json();
    if (data.ok) return { ok: true };

    if (data.description && data.description.includes("can't parse entities")) {
      const retryRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: text.slice(0, 4096),
          reply_markup: replyMarkup
        })
      });
      const retryData = await retryRes.json();
      return { ok: retryData.ok, error: retryData.description };
    }

    return { ok: false, error: data.description };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Unified Request Handler for /api/admin/news
async function handleRequest(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const query = req.query || {};
    const body = req.body || {};
    const action = String(body.action || query.action || 'list').toLowerCase();

    // PUBLIC ACTION: In-game news list (if needed)
    if (action === 'public_list') {
      const history = await fetchNewsHistory();
      const publicItems = history
        .filter(item => !item.isTest)
        .slice(0, 15)
        .map(item => ({
          id: item.id,
          title: item.title,
          message: item.message,
          imageUrl: item.imageUrl,
          buttonText: item.buttonText,
          createdAt: item.createdAt,
          kyivFormattedDate: item.kyivFormattedDate
        }));
      return res.status(200).json({ success: true, news: publicItems });
    }

    // ADMIN AUTH CHECK FOR ALL OTHER ACTIONS
    const authData = {
      telegramId: body.telegramId || query.telegramId,
      adminTelegramId: body.adminTelegramId || query.adminTelegramId,
      adminTid: body.adminTid || query.adminTid || body.telegramId || query.telegramId,
      adminId: body.adminId || query.adminId,
      firstName: body.firstName || query.firstName,
      adminFirstName: body.adminFirstName || query.adminFirstName,
      username: body.username || query.username,
      adminUsername: body.adminUsername || query.adminUsername
    };

    if (!checkIsAdmin(authData)) {
      return res.status(403).json({
        success: false,
        error: 'Доступ запрещён. Требуются права администратора.'
      });
    }

    const adminTid = String(authData.adminTid || '5761685341').trim();
    const adminUsername = String(authData.adminUsername || '').trim();

    // ACTION: List news history + subscriber audience stats
    if (action === 'list') {
      const [history, playerIds] = await Promise.all([
        fetchNewsHistory(),
        getTargetPlayerIds(adminTid)
      ]);

      return res.status(200).json({
        success: true,
        history,
        totalPlayersCount: playerIds.length,
        kyivTimeNow: formatKyivTime()
      });
    }

    // ACTION: Delete news item from history
    if (action === 'delete') {
      const deleteId = String(body.id || query.id || '').trim();
      if (!deleteId) {
        return res.status(400).json({ success: false, error: 'ID новости не указан.' });
      }

      const history = await fetchNewsHistory();
      const updated = history.filter(item => item.id !== deleteId);
      await saveNewsHistory(updated);

      return res.status(200).json({ success: true, message: 'Новость успешно удалена из истории.' });
    }

    // ACTION: Broadcast news to Telegram
    if (action === 'broadcast') {
      const title = String(body.title || '').trim();
      const message = String(body.message || '').trim();
      const imageUrl = String(body.imageUrl || '').trim();
      const imageBase64 = String(body.imageBase64 || '').trim();
      const buttonText = String(body.buttonText || '').trim() || '🚀 Играть в Color Sort';
      const isTestOnly = Boolean(body.isTestOnly || body.isTest);

      if (!message && !title) {
        return res.status(400).json({ success: false, error: 'Введите текст или заголовок новости.' });
      }

      // Collect target recipients
      let targetTids = [];

      if (isTestOnly) {
        // STRICT TEST MODE: Only send to the admin's personal Telegram ID
        const targetId = adminTid && /^\d{5,15}$/.test(adminTid) ? adminTid : '5761685341';
        targetTids = [targetId];
      } else {
        // FULL BROADCAST: Fetch all real players
        targetTids = await getTargetPlayerIds(adminTid);
      }

      if (targetTids.length === 0) {
        return res.status(400).json({ success: false, error: 'Список получателей пуст.' });
      }

      // Format Telegram message caption/body
      const cleanTitleText = title ? `📢 <b>${escapeHtml(title)}</b>\n\n` : '';
      const formattedText = `${cleanTitleText}${message}\n\n<i>🎮 Color Sort Puzzle</i>`;

      let deliveredCount = 0;
      let failedCount = 0;
      let cachedPhotoFileId = undefined;

      const hasPhoto = Boolean(imageUrl || imageBase64);

      for (let i = 0; i < targetTids.length; i++) {
        const targetChatId = targetTids[i];

        try {
          if (hasPhoto) {
            const photoSource = {
              url: imageUrl || undefined,
              fileId: cachedPhotoFileId,
              base64: imageBase64 || undefined
            };

            const photoRes = await sendTelegramPhoto(targetChatId, photoSource, formattedText, buttonText);
            if (photoRes.ok) {
              deliveredCount++;
              if (photoRes.fileId && !cachedPhotoFileId) {
                cachedPhotoFileId = photoRes.fileId;
              }
            } else {
              // Fallback to text message if photo failed
              const textRes = await sendTelegramMessage(targetChatId, formattedText, buttonText);
              if (textRes.ok) {
                deliveredCount++;
              } else {
                failedCount++;
              }
            }
          } else {
            const textRes = await sendTelegramMessage(targetChatId, formattedText, buttonText);
            if (textRes.ok) {
              deliveredCount++;
            } else {
              failedCount++;
            }
          }
        } catch (sendErr) {
          failedCount++;
        }

        // Throttle 35ms between requests
        if (i < targetTids.length - 1) {
          await sleep(35);
        }
      }

      // Record in news history
      const newsItem = {
        id: `news_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        title: title || 'Новость Color Sort',
        message,
        imageUrl: imageUrl || (imageBase64 ? '[Прикрепленное фото]' : undefined),
        buttonText,
        createdAt: Date.now(),
        kyivFormattedDate: formatKyivTime(),
        author: adminUsername ? `@${adminUsername.replace(/^@/, '')}` : (adminTid || 'Администратор'),
        targetCount: targetTids.length,
        deliveredCount,
        failedCount,
        status: deliveredCount === targetTids.length ? 'sent' : deliveredCount > 0 ? 'partially_sent' : 'failed',
        isTest: isTestOnly
      };

      const history = await fetchNewsHistory();
      history.unshift(newsItem);
      // Keep up to 50 latest items
      const trimmed = history.slice(0, 50);
      await saveNewsHistory(trimmed);

      return res.status(200).json({
        success: true,
        message: isTestOnly
          ? `Тестовое уведомление отправлено в ваш Telegram! (Доставлено: ${deliveredCount})`
          : `Уведомление успешно разослано игрокам! Доставлено: ${deliveredCount} из ${targetTids.length}`,
        deliveredCount,
        failedCount,
        totalTargeted: targetTids.length,
        newsItem
      });
    }

    return res.status(400).json({ success: false, error: 'Неизвестное действие (action).' });
  } catch (err) {
    console.error('[newsService] Error:', err);
    return res.status(500).json({
      success: false,
      error: `Ошибка сервера: ${err.message || 'Неизвестная ошибка'}`
    });
  }
}

module.exports = {
  BOT_TOKEN,
  WEB_APP_URL,
  formatKyivTime,
  fetchNewsHistory,
  saveNewsHistory,
  checkIsAdmin,
  getTargetPlayerIds,
  sendTelegramPhoto,
  sendTelegramMessage,
  handleRequest
};
