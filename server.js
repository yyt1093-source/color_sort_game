const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('./db');
const { startBot } = require('./bot');

// Load .env file if available
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

const app = express();
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;

app.set('trust proxy', true);
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  console.log(`[HTTP ${req.method}] ${req.url}`);
  next();
});
app.use(express.static(path.join(__dirname, 'public')));

// In-memory rate limiter for API routes (300 requests per minute per player)
const rateLimiter = new Map();
app.use('/api', (req, res, next) => {
  const forwarded = req.headers['x-forwarded-for'];
  const realIp = forwarded ? forwarded.split(',')[0].trim() : (req.ip || req.connection.remoteAddress);
  const clientKey = (req.body && req.body.telegramId) || (req.query && req.query.telegramId) || realIp || 'client';
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 300;
  
  if (!rateLimiter.has(clientKey)) {
    rateLimiter.set(clientKey, { count: 1, resetTime: now + windowMs });
  } else {
    const limitInfo = rateLimiter.get(clientKey);
    if (now > limitInfo.resetTime) {
      limitInfo.count = 1;
      limitInfo.resetTime = now + windowMs;
    } else {
      limitInfo.count++;
      if (limitInfo.count > maxRequests) {
        return res.status(429).json({ success: false, error: 'Слишком много запросов. Попробуйте позже.' });
      }
    }
  }
  next();
});

// Middleware to log API calls
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`[API] ${req.method} ${req.path}`);
  }
  next();
});

// Telegram initData validation function
function validateTelegramData(initData, botToken) {
  if (!initData || !botToken) return false;
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return false;
    
    params.delete('hash');
    const sortedKeys = Array.from(params.keys()).sort();
    const dataCheckString = sortedKeys.map(key => `${key}=${params.get(key)}`).join('\n');
    
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    
    return calculatedHash === hash;
  } catch (err) {
    console.error('Validation error:', err);
    return false;
  }
}

// Auth middleware
const authMiddleware = (req, res, next) => {
  const initData = req.headers['x-telegram-init-data'];
  const isLocalDev = process.env.NODE_ENV !== 'production' || 
    req.hostname === 'localhost' || 
    req.ip === '127.0.0.1' || 
    req.ip === '::1' || 
    req.ip === '::ffff:127.0.0.1';
  
  if (!BOT_TOKEN || isLocalDev) {
    if (initData && BOT_TOKEN) {
      if (!validateTelegramData(initData, BOT_TOKEN)) {
        console.warn('[AUTH] Dev mode: provided initData did not match hash');
      }
    }
    return next();
  }
  
  if (!initData || !validateTelegramData(initData, BOT_TOKEN)) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid initData' });
  }
  
  next();
};

// Use auth middleware on all protected API routes
app.use('/api/user', authMiddleware);
app.use('/api/ad-reward', authMiddleware);

/**
 * Public client config (Adsgram block ID, etc.)
 */
app.get('/api/config', (req, res) => {
  res.json({
    success: true,
    adsgramBlockId: process.env.ADSGRAM_BLOCK_ID || ''
  });
});

/**
 * Get or Init User Progress
 */
app.post('/api/user/init', (req, res) => {
  try {
    const { telegramId, firstName, username, photoUrl } = req.body;

    const id = telegramId || 'guest_dev_123';
    const user = db.getUser(id, {
      first_name: firstName || (id === 'guest_dev_123' ? 'Гость' : 'Игрок'),
      username: username || '',
      photo_url: photoUrl || ''
    });

    res.json({ success: true, user });
  } catch (err) {
    console.error('[API ERROR] /api/user/init:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Sync Progress after Level Completion or Move
 */
app.post('/api/user/sync', (req, res) => {
  try {
    const { telegramId, currentLevel, maxLevel, starsAdded, coinsAdded, hintsUsed, undosUsed, revealsUsed, totalMoves } = req.body;

    const id = telegramId || 'guest_dev_123';
    const updatedUser = db.updateUserProgress(id, {
      currentLevel,
      maxLevel,
      starsAdded,
      coinsAdded,
      hintsUsed,
      undosUsed,
      revealsUsed,
      totalMoves
    });

    res.json({ success: true, user: updatedUser });
  } catch (err) {
    console.error('[API ERROR] /api/user/sync:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Get Global Leaderboard
 */
app.get('/api/leaderboard', (req, res) => {
  try {
    const telegramId = req.query.telegramId || 'guest_dev_123';
    const leaderboard = db.getLeaderboard(telegramId, 50);

    res.json({ success: true, ...leaderboard });
  } catch (err) {
    console.error('[API ERROR] /api/leaderboard:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Claim Ad Reward (Rewarded Ads Bonus)
 */
app.post('/api/ad-reward', (req, res) => {
  try {
    const { telegramId, rewardType } = req.body;
    const id = telegramId || 'guest_dev_123';

    // Rate limiting: max 50 rewards per user per day
    const rewardsToday = db.getAdRewardsCount(id);
    if (rewardsToday >= 50) {
      return res.status(429).json({ success: false, error: 'Достигнут дневной лимит просмотра рекламы (50/50).' });
    }

    const updatedUser = db.logAdReward(id, rewardType);

    const rewardNames = {
      hints: '+1 подсказка',
      undos: '+1 отмена хода',
      extra_bottle: 'Дополнительная колбочка',
      reveal_bottle: 'Убрать все цвета'
    };
    const rewardName = rewardNames[rewardType] || rewardType;

    res.json({
      success: true,
      message: `Бонус ${rewardName} успешно начислен!`,
      user: updatedUser
    });
  } catch (err) {
    console.error('[API ERROR] /api/ad-reward:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Global error handling middleware (e.g. malformed JSON)
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ success: false, error: 'Некорректный JSON запрос' });
  }
  console.error('[Unhandled Server Error]', err.message);
  res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
});

// Serve frontend for any other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Periodically clean up rateLimiter
setInterval(() => {
  const now = Date.now();
  for (const [ip, info] of rateLimiter.entries()) {
    if (now > info.resetTime) {
      rateLimiter.delete(ip);
    }
  }
}, 60 * 1000);

let activeTunnelProc = null;

function initTunnel() {
  if (process.env.AUTO_TUNNEL === 'false') return;

  const { spawn } = require('child_process');
  console.log('🌐 Подключение стабильного HTTPS туннеля (localhost.run)...');

  const args = [
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'ServerAliveInterval=15',
    '-o', 'ServerAliveCountMax=4',
    '-o', 'ExitOnForwardFailure=yes',
    '-R', `80:127.0.0.1:${PORT}`,
    'nokey@localhost.run'
  ];

  if (activeTunnelProc) {
    try { activeTunnelProc.kill(); } catch (e) {}
    activeTunnelProc = null;
  }

  activeTunnelProc = spawn('ssh', args, { stdio: ['ignore', 'pipe', 'pipe'] });

  function handleOutput(chunk) {
    const text = chunk.toString();
    const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.lhr\.life/);
    if (match) {
      const url = match[0];
      process.env.WEB_APP_URL = url;
      console.log(`🚀 Публичная ссылка для Telegram: ${url}`);
      try {
        const { updateBotMenuButton } = require('./bot');
        updateBotMenuButton(url).then(() => {
          console.log('✅ Кнопка меню бота обновлена со ссылкой:', url);
        });
      } catch (botErr) {}
    }
  }

  activeTunnelProc.stdout.on('data', handleOutput);
  activeTunnelProc.stderr.on('data', handleOutput);

  activeTunnelProc.on('close', (code) => {
    console.log(`⚠️ Туннель закрылся (код ${code}), переподключение через 3 сек...`);
    setTimeout(initTunnel, 3000);
  });

  activeTunnelProc.on('error', (err) => {
    console.log('⚠️ Ошибка запуска туннеля:', err.message, 'переподключение через 3 сек...');
    setTimeout(initTunnel, 3000);
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`================================================`);
  console.log(`🧪 Color Sort Telegram Mini App Server Running!`);
  console.log(`🔗 Web URL: http://localhost:${PORT}`);
  console.log(`================================================`);

  // Start bot immediately
  if (process.env.BOT_TOKEN) {
    startBot();
  }

  // Connect tunnel asynchronously in background
  initTunnel();
});

