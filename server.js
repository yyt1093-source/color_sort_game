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
  const initData = req.headers['x-telegram-init-data'] || req.body?.initData;
  const isLocalDev = process.env.NODE_ENV !== 'production' || 
    req.hostname === 'localhost' || 
    req.ip === '127.0.0.1' || 
    req.ip === '::1' || 
    req.ip === '::ffff:127.0.0.1';
  
  if (!BOT_TOKEN || isLocalDev || req.body?.telegramId || req.query?.telegramId) {
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
app.use('/api/wallet', authMiddleware);
app.use('/api/shop', authMiddleware);

/**
 * Public client config (Adsgram block ID, TON deposit address, etc.)
 */
app.get('/api/config', (req, res) => {
  res.json({
    success: true,
    adsgramBlockId: process.env.ADSGRAM_BLOCK_ID || '',
    tonDepositAddress: process.env.TON_DEPOSIT_ADDRESS || 'UQCHkPFe4kzBSXOez0wHtYZFFI-txS4Hwz6toXgwsuuwPIv5'
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

    const seasonResetAt = db.getSeasonResetTimestamp ? db.getSeasonResetTimestamp() : 0;
    res.json({ success: true, user, seasonResetAt });
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
    const { telegramId, firstName, username, photoUrl, currentLevel, maxLevel, starsAdded, coinsAdded, hintsUsed, undosUsed, revealsUsed, extraBottlesUsed, shufflesUsed, totalMoves, hints, undos, reveals, extraBottles, extra_bottles, shuffles } = req.body;

    const id = telegramId || 'guest_dev_123';
    const updatedUser = db.updateUserProgress(id, {
      firstName,
      username,
      photoUrl,
      currentLevel,
      maxLevel,
      starsAdded,
      coinsAdded,
      hintsUsed,
      undosUsed,
      revealsUsed,
      extraBottlesUsed,
      shufflesUsed,
      totalMoves,
      hints,
      undos,
      reveals,
      extraBottles: extraBottles !== undefined ? extraBottles : extra_bottles,
      shuffles
    });

    // Also forward sync to global cloud bucket if real player
    if (id && !String(id).startsWith('guest') && !String(id).startsWith('dev')) {
      const bucket = process.env.KVDB_BUCKET || '82kzJTUxZwwFNvg7kUSqgM';
      fetch(`https://kvdb.io/${bucket}/player_${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId: String(id),
          firstName: updatedUser.first_name || firstName || 'Игрок',
          username: updatedUser.username || username || '',
          photoUrl: updatedUser.photo_url || photoUrl || '',
          maxLevel: updatedUser.max_level || maxLevel || currentLevel || 1,
          stars: updatedUser.stars || 0,
          hints: updatedUser.hints || 0,
          undos: updatedUser.undos || 0,
          reveals: updatedUser.reveals || 0,
          extraBottles: updatedUser.extra_bottles || 0,
          extra_bottles: updatedUser.extra_bottles || 0,
          ton_balance: updatedUser.ton_balance || 0,
          all_colors_until: updatedUser.all_colors_until || 0,
          all_colors_purchased_at: updatedUser.all_colors_purchased_at || 0,
          updatedAt: Date.now()
        }),
        signal: AbortSignal.timeout(3000)
      }).catch(e => console.warn('[Cloud KVDB Sync Error]:', e.message));
    }

    res.json({ success: true, user: updatedUser });
  } catch (err) {
    console.error('[API ERROR] /api/user/sync:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Get Global Leaderboard
 */
app.get('/api/leaderboard', async (req, res) => {
  try {
    const telegramId = req.query.telegramId || '';
    const leaderboard = db.getLeaderboard(telegramId, 50);

    // Merge from global cloud KVDB so offline/online players are unified
    try {
      const bucket = process.env.KVDB_BUCKET || '82kzJTUxZwwFNvg7kUSqgM';
      const cloudRes = await fetch(`https://kvdb.io/${bucket}/?prefix=player_&values=true&format=json`, {
        signal: AbortSignal.timeout(2500)
      });
      if (cloudRes.ok) {
        const pairs = await cloudRes.json();
        const cloudPlayers = pairs.map(([k, p]) => p).filter(p => p && p.telegramId && !String(p.telegramId).startsWith('guest') && !String(p.telegramId).startsWith('dev'));
        
        const playersMap = new Map();
        leaderboard.topPlayers.forEach(p => {
          playersMap.set(String(p.telegram_id), {
            telegram_id: String(p.telegram_id),
            first_name: p.first_name,
            username: p.username,
            photo_url: p.photo_url,
            max_level: p.max_level,
            stars: p.stars || 0
          });
        });
        cloudPlayers.forEach(cp => {
          const id = String(cp.telegramId);
          const existing = playersMap.get(id);
          const cpMaxLevel = Number(cp.maxLevel || cp.level || 1);
          if (!existing || cpMaxLevel > existing.max_level) {
            playersMap.set(id, {
              telegram_id: id,
              first_name: cp.firstName || (existing ? existing.first_name : 'Игрок'),
              username: cp.username || (existing ? existing.username : ''),
              photo_url: cp.photoUrl || (existing ? existing.photo_url : ''),
              max_level: cpMaxLevel,
              stars: cp.stars || (existing ? existing.stars : 0)
            });
          }
        });
        
        const mergedList = Array.from(playersMap.values())
          .sort((a, b) => b.max_level - a.max_level || (b.stars || 0) - (a.stars || 0))
          .slice(0, 50);

        leaderboard.topPlayers = mergedList;
        if (telegramId && !String(telegramId).startsWith('guest') && !String(telegramId).startsWith('dev')) {
          const userIdx = mergedList.findIndex(p => p.telegram_id === String(telegramId));
          if (userIdx !== -1) {
            leaderboard.userRank = {
              rank: userIdx + 1,
              max_level: mergedList[userIdx].max_level,
              first_name: mergedList[userIdx].first_name
            };
          }
        }
      }
    } catch (kvErr) {}

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
      reveal_bottle: 'Открыть цвета'
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

/**
 * Save connected TON wallet address
 */
app.post('/api/wallet/connect', (req, res) => {
  try {
    const { telegramId, walletAddress } = req.body;
    const id = telegramId || 'guest_dev_123';
    const updatedUser = db.updateTonWallet(id, walletAddress);
    res.json({ success: true, user: updatedUser });
  } catch (err) {
    console.error('[API ERROR] /api/wallet/connect:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

const processedTxHashesServer = new Set();

async function verifyTonDepositOnChain(memo, expectedAmount, walletAddress) {
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
          if (!txHash || processedTxHashesServer.has(String(txHash))) continue;

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
            processedTxHashesServer.add(String(txHash));
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
    console.warn('[TON VERIFY] Toncenter API error:', e.message);
  }

  try {
    const url = `https://tonapi.io/v2/blockchain/accounts/${targetWallet}/transactions?limit=40`;
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      if (data && Array.isArray(data.transactions)) {
        for (const tx of data.transactions) {
          const txHash = tx.hash || (tx.transaction_id ? tx.transaction_id.hash : null);
          if (!txHash || processedTxHashesServer.has(String(txHash))) continue;

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
            processedTxHashesServer.add(String(txHash));
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
    console.warn('[TON VERIFY] Tonapi error:', e.message);
  }

  return {
    verified: false,
    error: 'Транзакция не найдена на кошельке UQCHkPFe4kzBSXOez0wHtYZFFI-txS4Hwz6toXgwsuuwPIv5. Убедитесь, что перевели TON с указанным Memo и повторите попытку.'
  };
}

/**
 * Verify and record TON deposit
 */
app.post('/api/wallet/verify-deposit', async (req, res) => {
  try {
    const { telegramId, amount, memo, walletAddress } = req.body;
    const id = telegramId || 'guest_dev_123';
    const depositAmount = parseFloat(amount) || 0;
    if (depositAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Некорректная сумма пополнения' });
    }

    const check = await verifyTonDepositOnChain(memo, depositAmount, walletAddress);
    if (!check.verified) {
      return res.status(400).json({ success: false, error: check.error || 'Транзакция не найдена на кошельке.' });
    }

    const creditedAmount = check.amount || depositAmount;
    const result = db.recordTonDeposit(id, creditedAmount, memo, walletAddress);
    if (!result) {
      return res.status(500).json({ success: false, error: 'Ошибка обработки пополнения' });
    }

    res.json({
      success: true,
      message: `Успешно начислено ${creditedAmount.toFixed(2)} GRAM!`,
      user: result.user,
      deposit: result.deposit
    });
  } catch (err) {
    console.error('[API ERROR] /api/wallet/verify-deposit:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Buy Shop Item with GRAM
 */
app.post('/api/shop/buy', (req, res) => {
  try {
    const { telegramId, itemId } = req.body;
    const id = telegramId || 'guest_dev_123';

    if (!itemId) {
      return res.status(400).json({ success: false, error: 'Не указан ID товара' });
    }

    const result = db.buyShopItem(id, itemId);
    if (!result) {
      return res.status(404).json({ success: false, error: 'Товар не найден или ошибка пользователя' });
    }

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (err) {
    console.error('[API ERROR] /api/shop/buy:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

function checkIsAdmin(reqBody) {
  if (!reqBody) return false;
  const { telegramId, firstName, username } = reqBody;

  const tid = String(telegramId || '').trim();
  const fname = String(firstName || '').toLowerCase().trim();
  const uname = String(username || '').toLowerCase().trim();

  // The admin panel is strictly reserved for Alligator only (ID: 5761685341 or alligator name)
  if (tid === '5761685341') return true;
  if (fname.includes('alligator') || fname.includes('аллигатор') || uname.includes('alligator') || uname.includes('аллигатор')) return true;

  return false;
}

/**
 * Admin Season Reset (Admin Only)
 */
app.post('/api/admin/reset-season', async (req, res) => {
  try {
    const reqBody = req.body || {};
    if (!checkIsAdmin(reqBody)) {
      return res.status(403).json({ success: false, error: 'Доступ запрещён: необходимы права администратора' });
    }

    const resetTimestamp = Number(reqBody.resetAt) || Date.now();
    const result = db.resetSeason(resetTimestamp);
    let updatedUser = null;
    if (reqBody.telegramId) {
      updatedUser = db.getUser(reqBody.telegramId);
    }

    // Wipe KVDB records on the server asynchronously
    resetKvdbSeasonServer(resetTimestamp).catch(err => console.warn('[KVDB Season Reset Server Error]', err));

    res.json({ success: true, ...result, resetAt: resetTimestamp, user: updatedUser });
  } catch (err) {
    console.error('[API ERROR] /api/admin/reset-season:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Get current season status
 */
app.get('/api/config/season-status', (req, res) => {
  try {
    const seasonResetAt = db.getSeasonResetTimestamp ? db.getSeasonResetTimestamp() : 0;
    res.json({ success: true, seasonResetAt });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

async function resetKvdbSeasonServer(resetTimestamp) {
  const bucket = process.env.KVDB_BUCKET || '82kzJTUxZwwFNvg7kUSqgM';
  const baseUrl = `https://kvdb.io/${bucket}`;

  try {
    await fetch(`${baseUrl}/meta_season_reset_at`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resetAt: resetTimestamp })
    });
    await fetch(`${baseUrl}/meta_gram_purchases_reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resetAt: resetTimestamp })
    });
  } catch (e) {
    console.warn('[SERVER KVDB RESET] Meta notice error:', e.message);
  }

  try {
    const listRes = await fetch(`${baseUrl}/?prefix=player_&format=json`);
    if (listRes.ok) {
      const keys = await listRes.json();
      if (Array.isArray(keys)) {
        await Promise.allSettled(
          keys.map(k => fetch(`${baseUrl}/${encodeURIComponent(k)}`, { method: 'DELETE' }))
        );
      }
    }
  } catch (e) {
    console.warn('[SERVER KVDB RESET] Player keys wipe error:', e.message);
  }
}

async function resetKvdbGramPurchasesServer(resetTimestamp) {
  const bucket = process.env.KVDB_BUCKET || '82kzJTUxZwwFNvg7kUSqgM';
  const baseUrl = `https://kvdb.io/${bucket}`;

  try {
    await fetch(`${baseUrl}/meta_gram_purchases_reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resetAt: resetTimestamp })
    });
  } catch (e) {
    console.warn('[SERVER KVDB RESET] Meta notice error:', e.message);
  }

  try {
    const listRes = await fetch(`${baseUrl}/?prefix=player_&values=true&format=json`);
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
            await fetch(`${baseUrl}/${encodeURIComponent(key)}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(val)
            }).catch(() => {});
          }
        }
      }
    }
  } catch (e) {
    console.warn('[SERVER KVDB RESET] Player keys update error:', e.message);
  }
}

/**
 * Admin Add Boosters & Perks (Admin Only)
 */
app.post('/api/admin/add-boosters', (req, res) => {
  try {
    if (!checkIsAdmin(req.body || {})) {
      return res.status(403).json({ success: false, error: 'Доступ запрещён: необходимы права администратора' });
    }

    const { telegramId, hints = 0, undos = 0, reveals = 0, extraBottles = 0, tonBalance = 0 } = req.body || {};
    const id = telegramId || 'guest_dev_123';

    const updatedUser = db.addBonus(id, {
      hints: Number(hints || 0),
      undos: Number(undos || 0),
      reveals: Number(reveals || 0),
      extraBottles: Number(extraBottles || 0),
      ton_balance: Number(tonBalance || 0)
    });

    if (id && !String(id).startsWith('guest') && !String(id).startsWith('dev')) {
      const bucket = process.env.KVDB_BUCKET || '82kzJTUxZwwFNvg7kUSqgM';
      const baseUrl = `https://kvdb.io/${bucket}`;
      fetch(`${baseUrl}/${encodeURIComponent('player_' + id)}`)
        .then(r => r.ok ? r.json() : null)
        .then(val => {
          if (val && typeof val === 'object') {
            val.hints = (val.hints || 0) + Number(hints || 0);
            val.undos = (val.undos || 0) + Number(undos || 0);
            val.reveals = (val.reveals || 0) + Number(reveals || 0);
            val.extraBottles = (val.extraBottles || 0) + Number(extraBottles || 0);
            val.ton_balance = (val.ton_balance || 0) + Number(tonBalance || 0);
            val.updatedAt = Date.now();
            fetch(`${baseUrl}/${encodeURIComponent('player_' + id)}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(val)
            }).catch(() => {});
          }
        }).catch(() => {});
    }

    res.json({ success: true, user: updatedUser });
  } catch (err) {
    console.error('[API ERROR] /api/admin/add-boosters:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Admin Reset All GRAM Purchases (Alligator Only)
 */
app.post('/api/admin/reset-purchases', async (req, res) => {
  try {
    if (!checkIsAdmin(req.body || {})) {
      return res.status(403).json({ success: false, error: 'Доступ запрещён: необходимы права администратора' });
    }

    const { targetTelegramId } = req.body || {};
    const targetId = String(targetTelegramId || '').trim();

    if (targetId) {
      const result = db.resetGramPurchasesSingle(targetId);
      const bucket = process.env.KVDB_BUCKET || '82kzJTUxZwwFNvg7kUSqgM';
      const baseUrl = `https://kvdb.io/${bucket}`;
      fetch(`${baseUrl}/${encodeURIComponent('player_' + targetId)}`)
        .then(r => r.ok ? r.json() : null)
        .then(val => {
          if (val && typeof val === 'object') {
            val.all_colors_until = 0;
            val.all_colors_purchased_at = 0;
            val.hints = 0;
            val.undos = 0;
            val.reveals = 0;
            val.extraBottles = 0;
            val.shuffles = 0;
            fetch(`${baseUrl}/${encodeURIComponent('player_' + targetId)}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(val)
            }).catch(() => {});
          }
        }).catch(() => {});

      return res.json({
        success: true,
        targetTelegramId: targetId,
        message: `Покупки за TON игрока ID ${targetId} успешно аннулированы!`
      });
    }

    const result = db.resetGramPurchases();
    const resetTs = result.resetAt || Date.now();

    // Async KVDB cloud cleanup for all players
    resetKvdbGramPurchasesServer(resetTs).catch(() => {});

    res.json({
      success: true,
      resetAt: resetTs,
      message: 'Покупки за TON ВСЕХ игроков успешно аннулированы!'
    });
  } catch (err) {
    console.error('[API ERROR] /api/admin/reset-purchases:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Register a new referral
 */
app.post('/api/referral/register', (req, res) => {
  try {
    const { referrerId, telegramId, firstName, username } = req.body || {};
    if (!referrerId || !telegramId) {
      return res.status(400).json({ success: false, error: 'Не указан referrerId или telegramId' });
    }

    const result = db.registerReferral(referrerId, telegramId, firstName, username);
    if (!result) {
      return res.status(400).json({ success: false, error: 'Не удалось зарегистрировать реферала' });
    }

    res.json(result);
  } catch (err) {
    console.error('[API ERROR] /api/referral/register:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Get referrals list and status for a user
 */
app.get('/api/referral/list', (req, res) => {
  try {
    const telegramId = req.query.telegramId || 'guest_dev_123';
    const result = db.getReferrals(telegramId);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[API ERROR] /api/referral/list:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Claim referral rewards (+5 to all boosters per friend)
 */
app.post('/api/referral/claim', (req, res) => {
  try {
    const { telegramId, referralId } = req.body || {};
    const id = telegramId || 'guest_dev_123';

    const result = db.claimReferralReward(id, referralId);
    if (!result) {
      return res.status(400).json({ success: false, error: 'Ошибка получения награды' });
    }

    res.json(result);
  } catch (err) {
    console.error('[API ERROR] /api/referral/claim:', err);
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
  if (process.env.WEB_APP_URL && process.env.WEB_APP_URL.includes('github.io')) {
    console.log(`🚀 Постоянная облачная ссылка активна: ${process.env.WEB_APP_URL}`);
    try {
      const { updateBotMenuButton } = require('./bot');
      updateBotMenuButton(process.env.WEB_APP_URL);
    } catch (e) {}
    return;
  }

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

