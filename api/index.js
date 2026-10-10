const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { startBot } = require('../bot');
const newsService = require('../newsService');
const gameVerification = require('../gameVerification');

const app = express();

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// Middleware to log API calls
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`[Vercel API] ${req.method} ${req.path}`);
  }
  next();
});

const {
  BOT_TOKEN,
  ADMIN_TELEGRAM_IDS,
  validateTelegramInitData,
  authMiddleware,
  adminAuthMiddleware,
  checkIsAdmin
} = require('../auth');

// Maintenance Mode: Configurable via Admin Panel & DB
const MAINTENANCE_ALLOWED_IDS = ['5761685341', '7116446051'];
const MAINTENANCE_ALLOWED_USERNAMES = ['alligator0709', 'maria290355'];

// Immutable verified player baselines keyed strictly by Telegram ID (permanent and unchangeable)
const IMMUTABLE_PLAYER_BASELINES = {
  '5761685341': { maxLevel: 50, firstName: 'ALLIGATOR', username: 'ALLIGATOR0709', hints: 10, undos: 20, reveals: 5, extraBottles: 10 },
  '7458436672': { maxLevel: 47, firstName: 'Руслан', username: 'ruslan_aliyevvv' },
  '8305679959': { maxLevel: 43, firstName: '.', username: '' },
  '8982516215': { maxLevel: 42, firstName: 'Qwerty', username: 'sinisterx3' },
  '5269257903': { maxLevel: 37, firstName: 'Kostya', username: 'Koctya007' },
  '296239050':  { maxLevel: 35, firstName: 'Sergey', username: 'sergiy121234' },
  '7116446051': { maxLevel: 27, firstName: 'Марія', username: 'Maria290355' },
  '1890528535': { maxLevel: 20, firstName: 'Кирилл', username: 'Cristiano717' },
  '5177916222': { maxLevel: 18, firstName: '⚔️ Gift Kombat Діана 🍀 Anthill', username: 'Diana13031303' },
  '1803189688': { maxLevel: 16, firstName: 'Andriejus', username: 'Tigras1986' },
  '1152401670': { maxLevel: 14, firstName: 'Natta', username: 'Smaile82' },
  '615300433':  { maxLevel: 10, firstName: 'ᅠ', username: 'velzevul999' },
  '6582657380': { maxLevel: 9, firstName: 'R', username: 'Romanchiiik0' },
  '1531426251': { maxLevel: 8, firstName: 'Алексей', username: 'Element1914' },
  '387353019':  { maxLevel: 8, firstName: 'Danil', username: 'danilfrais' },
  '5403252654': { maxLevel: 8, firstName: 'ВиталийTower🏰', username: 'Tuchkovit' },
  '7990014996': { maxLevel: 4, firstName: 'Samyrai', username: 'KaLLoooS' },
  '5991713296': { maxLevel: 4, firstName: 'Юлия', username: '' },
  '8743109762': { maxLevel: 4, firstName: 'Ірина', username: 'iriskaturgan1' },
  '1471767067': { maxLevel: 3, firstName: 'Александрович', username: '' },
  '5253063837': { maxLevel: 3, firstName: '♥️НАТ♥️', username: '' },
  '5502743854': { maxLevel: 3, firstName: 'Потерял', username: '' },
  '5709982730': { maxLevel: 3, firstName: 'Алексей PIXLANDS', username: '' },
  '6573295041': { maxLevel: 3, firstName: 'Smurf 😈hiroll777.space', username: 'SmSmurf7777' },
  '5839076186': { maxLevel: 1, firstName: 'Женя', username: '' },
  '7387508554': { maxLevel: 1, firstName: 'Дмитрий', username: '' },
  '743036609':  { maxLevel: 1, firstName: '@EcoForestTonBot🌿⚒️ MinerGram@klikadobot#TotalHashСвітлана', username: 'Svet11256' }
};

function maintenanceMiddleware(req, res, next) {
  const maint = db.getMaintenanceStatus();
  if (!maint.active) return next();
  if (req.path === '/config' || req.path === '/api/config' || req.path.startsWith('/admin') || req.path.startsWith('/api/admin')) {
    return next();
  }

  const tid = String((req.user && req.user.id) || (req.body && req.body.telegramId) || (req.query && req.query.telegramId) || '').trim();
  const uname = String((req.user && req.user.username) || (req.body && req.body.username) || (req.query && req.query.username) || '').toLowerCase().replace(/^@/, '').trim();

  if (MAINTENANCE_ALLOWED_IDS.includes(tid) || (uname && MAINTENANCE_ALLOWED_USERNAMES.includes(uname)) || checkIsAdmin(req)) {
    return next();
  }

  return res.status(200).json({
    success: false,
    maintenance: true,
    error: maint.message || 'Идут технические работы. Доступ временно ограничен.'
  });
}

app.use('/api', maintenanceMiddleware);

// Protect user-state routes with authentication & authorization
app.use('/api/user', authMiddleware);
app.use('/api/ad-reward', authMiddleware);
app.use('/api/wallet', authMiddleware);
app.use('/api/shop', authMiddleware);
app.use('/api/referral', authMiddleware);
app.use('/api/gifts', authMiddleware);

// Protect all administrative routes with strict admin authorization
app.use('/api/admin', adminAuthMiddleware);

/**
 * Public client config (Adsgram block ID, TON deposit address, etc.)
 */
app.get('/api/config', (req, res) => {
  const maint = db.getMaintenanceStatus();
  res.json({
    success: true,
    maintenance: maint.active,
    maintenanceMessage: maint.message,
    allowedIds: MAINTENANCE_ALLOWED_IDS,
    adsgramBlockId: process.env.ADSGRAM_BLOCK_ID || '47788',
    tonDepositAddress: process.env.TON_DEPOSIT_ADDRESS || 'UQCHkPFe4kzBSXOez0wHtYZFFI-txS4Hwz6toXgwsuuwPIv5'
  });
});

/**
 * Get or Init User Progress
 */
app.post('/api/user/init', async (req, res) => {
  try {
    const { telegramId, firstName, username, photoUrl } = req.body;

    const id = telegramId || 'guest_dev_123';
    let user = db.getUser(id, {
      first_name: firstName || null,
      username: username || '',
      photo_url: photoUrl || ''
    });

    if (id && !String(id).startsWith('guest') && !String(id).startsWith('dev') && user) {
      const bucket = process.env.KVDB_BUCKET || '82kzJTUxZwwFNvg7kUSqgM';
      try {
        const kvRes = await fetch(`https://kvdb.io/${bucket}/player_${encodeURIComponent(id)}?_cb=${Date.now()}`);
        if (kvRes.ok) {
          const kvData = await kvRes.json();
          if (kvData && typeof kvData === 'object') {
            const forceResetTs = Number(kvData.forceResetAt || kvData.accountResetAt || 0);
            if (forceResetTs > 0 && forceResetTs > Number(user.force_reset_at || 0)) {
              user.max_level = Number(kvData.max_level !== undefined ? kvData.max_level : (kvData.maxLevel !== undefined ? kvData.maxLevel : 10));
              user.current_level = Number(kvData.current_level !== undefined ? kvData.current_level : (kvData.currentLevel !== undefined ? kvData.currentLevel : 10));
              user.stars = Number(kvData.stars || 0);
              user.hints = Number(kvData.hints || 0);
              user.undos = Number(kvData.undos || 0);
              user.reveals = Number(kvData.reveals || 0);
              const kvB = kvData.extra_bottles !== undefined ? kvData.extra_bottles : (kvData.extraBottles || 0);
              user.extra_bottles = Number(kvB || 0);
              user.extraBottles = user.extra_bottles;
              user.shuffles = 0;
              user.all_colors_until = 0;
              user.all_colors_purchased_at = 0;
              user.daily_boosters_days_left = 0;
              user.dailyBoostersDaysLeft = 0;
              user.daily_boosters_last_date = '';
              user.daily_boosters_purchased_at = 0;
              user.ton_wallet = '';
              user.force_reset_at = forceResetTs;
              try {
                db.prepare(`
                  UPDATE users 
                  SET max_level = ?, current_level = ?, stars = ?, hints = ?, undos = ?, reveals = ?, extra_bottles = ?, ton_balance = ?, all_colors_until = ?, all_colors_purchased_at = ?, daily_boosters_days_left = ?, daily_boosters_last_date = ?, daily_boosters_purchased_at = ?, force_reset_at = ?
                  WHERE telegram_id = ?
                `).run(user.max_level, user.current_level, user.stars, user.hints, user.undos, user.reveals, user.extra_bottles, Number(user.ton_balance || 0), user.all_colors_until, user.all_colors_purchased_at, 0, '', 0, forceResetTs, String(id));
              } catch (e) {}
            } else {
              const kvRestore = Number(kvData.snapshotRestoredAt || 0);
              const kvMaxLvl = kvData.max_level !== undefined ? kvData.max_level : kvData.maxLevel;
              const kvUpdated = Number(kvData.updatedAt || 0);
              const isRestoredSnapshotState = kvRestore > 0 && kvUpdated <= kvRestore;
              if (isRestoredSnapshotState) {
                user.max_level = Number(kvMaxLvl || 0);
                user.snapshotRestoredAt = kvRestore;
              } else if (kvMaxLvl !== undefined) {
                user.max_level = Math.max(Number(user.max_level || 0), Number(kvMaxLvl || 0));
                if (kvRestore > 0) user.snapshotRestoredAt = kvRestore;
              }
              const kvCurLvl = kvData.current_level !== undefined ? kvData.current_level : kvData.currentLevel;
              if (isRestoredSnapshotState) {
                user.current_level = Number(kvCurLvl || (user.max_level > 0 ? user.max_level : 1));
              } else if (kvCurLvl !== undefined) {
                user.current_level = Math.max(Number(user.current_level || 1), Number(kvCurLvl || 1));
              }
              if (user.max_level > 0 && user.current_level < user.max_level) {
                user.current_level = user.max_level;
              }
              if (kvData.stars !== undefined) {
                user.stars = isRestoredSnapshotState ? Number(kvData.stars || 0) : Math.max(Number(user.stars || 0), Number(kvData.stars || 0));
              }
              const clampBooster = (val) => String(id) === '5761685341' ? Math.max(0, Number(val || 0)) : Math.min(Math.max(0, Number(val || 0)), 10000);
              const dbUpdated = user.updated_at ? new Date(user.updated_at).getTime() : 0;
              if (kvUpdated > dbUpdated) {
                if (kvData.hints !== undefined) user.hints = clampBooster(kvData.hints);
                if (kvData.undos !== undefined) user.undos = clampBooster(kvData.undos);
                if (kvData.reveals !== undefined) user.reveals = clampBooster(kvData.reveals);
                const kvB = kvData.extra_bottles !== undefined ? kvData.extra_bottles : kvData.extraBottles;
                if (kvB !== undefined) {
                  user.extra_bottles = clampBooster(kvB);
                  user.extraBottles = user.extra_bottles;
                }
              }
              const finalB = user.extra_bottles !== undefined ? user.extra_bottles : (user.extraBottles || 0);
              user.extraBottles = finalB;
              user.all_colors_until = Math.max(Number(user.all_colors_until || 0), Number(kvData.all_colors_until || 0));
              user.all_colors_purchased_at = Math.max(Number(user.all_colors_purchased_at || 0), Number(kvData.all_colors_purchased_at || 0));
              if (kvData.daily_boosters_days_left !== undefined || kvData.dailyBoostersDaysLeft !== undefined) {
                const kDays = Number(kvData.daily_boosters_days_left !== undefined ? kvData.daily_boosters_days_left : kvData.dailyBoostersDaysLeft);
                const curDays = Number(user.daily_boosters_days_left || 0);
                if (kDays > curDays) {
                  user.daily_boosters_days_left = kDays;
                  if (kvData.daily_boosters_last_date || kvData.dailyBoostersLastDate) {
                    user.daily_boosters_last_date = kvData.daily_boosters_last_date || kvData.dailyBoostersLastDate;
                  }
                }
              }
              const kDate = kvData.daily_boosters_last_date || kvData.dailyBoostersLastDate || '';
              if (kDate && (!user.daily_boosters_last_date || kDate > user.daily_boosters_last_date)) {
                user.daily_boosters_last_date = kDate;
              }
              const kAt = Number(kvData.daily_boosters_purchased_at || kvData.dailyBoostersPurchasedAt || 0);
              if (kAt && (!user.daily_boosters_purchased_at || kAt > user.daily_boosters_purchased_at)) {
                user.daily_boosters_purchased_at = kAt;
              }
              if (user.daily_boosters_purchased_at > 0 && typeof db.calculateDailyBoostersDaysLeft === 'function') {
                const calcDays = db.calculateDailyBoostersDaysLeft(user.daily_boosters_purchased_at);
                if (calcDays !== null) {
                  user.daily_boosters_days_left = Math.min(Number(user.daily_boosters_days_left || calcDays), calcDays);
                }
              }
              if (kvData.ton_wallet && !user.ton_wallet) user.ton_wallet = kvData.ton_wallet;
              if (kvData.memo_code && !user.memo_code) user.memo_code = kvData.memo_code;

              try {
                db.prepare(`
                  UPDATE users 
                  SET max_level = ?, current_level = ?, stars = ?, hints = ?, undos = ?, reveals = ?, extra_bottles = ?, all_colors_until = ?, all_colors_purchased_at = ?, daily_boosters_days_left = ?, daily_boosters_last_date = ?, daily_boosters_purchased_at = ?
                  WHERE telegram_id = ?
                `).run(user.max_level, user.current_level, user.stars, user.hints, user.undos, user.reveals, finalB, user.all_colors_until, user.all_colors_purchased_at, Number(user.daily_boosters_days_left || 0), user.daily_boosters_last_date || '', Number(user.daily_boosters_purchased_at || 0), String(id));
              } catch (e) {}
            }
          }
        }
      } catch (e) {}
    }

    // Check and apply any due daily boosters accrual for this user
    try {
      const accrueRes = db.accrueDailyBoostersForUser(id, new Date());
      if (accrueRes && accrueRes.accrued && accrueRes.user) {
        user = accrueRes.user;
        const bucket = process.env.KVDB_BUCKET || '82kzJTUxZwwFNvg7kUSqgM';
        if (id && !String(id).startsWith('guest') && !String(id).startsWith('dev')) {
          try {
            const r = await fetch(`https://kvdb.io/${bucket}/player_${encodeURIComponent(id)}?_cb=${Date.now()}`);
            let kvUser = r.ok ? await r.json() : null;
            if (!kvUser) kvUser = { telegramId: String(id) };
            kvUser.hints = user.hints;
            kvUser.undos = user.undos;
            kvUser.reveals = user.reveals;
            kvUser.extraBottles = user.extra_bottles;
            kvUser.extra_bottles = user.extra_bottles;
            kvUser.daily_boosters_days_left = user.daily_boosters_days_left;
            kvUser.daily_boosters_last_date = user.daily_boosters_last_date;
            kvUser.updatedAt = Date.now();
            await fetch(`https://kvdb.io/${bucket}/player_${encodeURIComponent(id)}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(kvUser)
            });
          } catch (e) {}
        }
      }
    } catch (e) {}

    if (user && user.max_level > 0 && (!user.current_level || user.current_level < user.max_level)) {
      user.current_level = user.max_level;
      try {
        db.prepare('UPDATE users SET current_level = ? WHERE telegram_id = ?').run(user.max_level, String(id));
      } catch (e) {}
    }

    const baseP = IMMUTABLE_PLAYER_BASELINES[String(id)];
    if (baseP && user) {
      if (Number(user.max_level || 0) < baseP.maxLevel) {
        user.max_level = baseP.maxLevel;
        user.level = baseP.maxLevel;
        user.current_level = Math.max(Number(user.current_level || 1), baseP.maxLevel);
        user.stars = Math.max(Number(user.stars || 0), baseP.stars);
        try {
          db.prepare('UPDATE users SET max_level = ?, current_level = ?, stars = ? WHERE telegram_id = ?')
            .run(user.max_level, user.current_level, user.stars, String(id));
        } catch (e) {}
      }
    }

    const seasonResetAt = db.getSeasonResetTimestamp ? db.getSeasonResetTimestamp() : 0;
    const purchasesResetAt = db.getPurchasesResetTimestamp ? db.getPurchasesResetTimestamp() : 0;
    res.json({ success: true, user, seasonResetAt, purchasesResetAt });
  } catch (err) {
    console.error('[API ERROR] /api/user/init:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Sync Progress (Strict Anti-Cheat: Boosters and Levels CANNOT be injected or increased by client)
 */
app.post('/api/user/sync', authMiddleware, (req, res) => {
  try {
    let { firstName, username, photoUrl, currentLevel, hintsUsed, undosUsed, revealsUsed, extraBottlesUsed, shufflesUsed, totalMoves } = req.body || {};
    const id = req.telegramId || 'guest_dev_123';

    let existingUser = db.getUser ? db.getUser(id, { first_name: firstName, username, photo_url: photoUrl }) : null;
    if (!existingUser) {
      existingUser = db.getUser(id, { first_name: firstName, username, photo_url: photoUrl });
    }

    // STRICT ANTI-CHEAT: maxLevel can NEVER be increased via sync!
    const safeCurrentLevel = currentLevel
      ? Math.min(existingUser.max_level, Math.max(1, Number(currentLevel)))
      : existingUser.current_level;

    const updatedUser = db.updateUserProgress(id, {
      firstName,
      username,
      photoUrl,
      currentLevel: safeCurrentLevel,
      maxLevel: existingUser.max_level,
      hintsUsed: Math.max(0, Number(hintsUsed || 0)),
      undosUsed: Math.max(0, Number(undosUsed || 0)),
      revealsUsed: Math.max(0, Number(revealsUsed || 0)),
      extraBottlesUsed: Math.max(0, Number(extraBottlesUsed || 0)),
      shufflesUsed: Math.max(0, Number(shufflesUsed || 0)),
      totalMoves: Math.max(0, Number(totalMoves || 0)),
      allowLevelIncrease: false // Levels can ONLY increase via /api/game/complete-level
    });

    // Also check and apply daily boosters if due
    try {
      db.accrueDailyBoostersForUser(id, new Date());
    } catch (e) {}

    // Forward authoritative server state to KVDB for real players
    if (id && !String(id).startsWith('guest') && !String(id).startsWith('dev')) {
      const bucket = process.env.KVDB_BUCKET || '82kzJTUxZwwFNvg7kUSqgM';
      fetch(`https://kvdb.io/${bucket}/player_${encodeURIComponent(id)}?_cb=${Date.now()}`)
        .then(r => r.ok ? r.json() : null)
        .then(existing => {
          const val = existing && typeof existing === 'object' ? existing : { telegramId: id };
          val.hints = updatedUser.hints;
          val.undos = updatedUser.undos;
          val.reveals = updatedUser.reveals;
          val.extraBottles = updatedUser.extra_bottles;
          val.extra_bottles = updatedUser.extra_bottles;
          val.maxLevel = updatedUser.max_level;
          val.max_level = updatedUser.max_level;
          val.level = updatedUser.max_level;
          val.currentLevel = updatedUser.current_level;
          val.current_level = updatedUser.current_level;
          val.stars = 0;
          val.updatedAt = Date.now();
          return fetch(`https://kvdb.io/${bucket}/player_${encodeURIComponent(id)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(val)
          });
        }).catch(() => {});
    }

    res.json({ success: true, user: updatedUser });
  } catch (err) {
    console.error('[API ERROR] /api/user/sync:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Game Session: Start Level (Server Authoritative)
 */
app.post('/api/game/start-level', authMiddleware, (req, res) => {
  try {
    const { levelNumber } = req.body || {};
    const id = req.telegramId || 'guest_dev_123';
    const user = db.getUser(id);
    const result = gameVerification.startSession(id, levelNumber, user ? user.max_level : 1);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err) {
    console.error('[API ERROR] /api/game/start-level:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Game Session: Record & Verify Move (Poured Paint)
 */
app.post('/api/game/move', authMiddleware, (req, res) => {
  try {
    const { sessionToken, fromIndex, toIndex, from, to } = req.body || {};
    const fromIdx = fromIndex !== undefined ? fromIndex : from;
    const toIdx = toIndex !== undefined ? toIndex : to;
    const id = req.telegramId || 'guest_dev_123';
    const result = gameVerification.applyMove(sessionToken, id, fromIdx, toIdx);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err) {
    console.error('[API ERROR] /api/game/move:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Game Session: Use Booster (Atomically deducted on server)
 */
app.post('/api/game/use-booster', authMiddleware, async (req, res) => {
  try {
    const { sessionToken, boosterType } = req.body || {};
    const id = req.telegramId || 'guest_dev_123';

    // 1. Atomically check and deduct booster on server
    const deductRes = db.useBooster(id, boosterType);
    if (!deductRes.success) {
      return res.status(400).json({ success: false, error: deductRes.error || 'Недостаточно бустеров' });
    }

    // 2. Apply booster effect in active game session
    let sessionRes = { success: true };
    if (sessionToken) {
      sessionRes = gameVerification.applyBooster(sessionToken, id, boosterType);
    }

    // 3. Forward sync to KVDB directly from server
    if (id && !String(id).startsWith('guest') && !String(id).startsWith('dev')) {
      const bucket = process.env.KVDB_BUCKET || '82kzJTUxZwwFNvg7kUSqgM';
      fetch(`https://kvdb.io/${bucket}/player_${encodeURIComponent(id)}?_cb=${Date.now()}`)
        .then(r => r.ok ? r.json() : null)
        .then(val => {
          if (val && typeof val === 'object') {
            val.hints = deductRes.user.hints;
            val.undos = deductRes.user.undos;
            val.reveals = deductRes.user.reveals;
            val.extraBottles = deductRes.user.extra_bottles;
            val.extra_bottles = deductRes.user.extra_bottles;
            val.updatedAt = Date.now();
            return fetch(`https://kvdb.io/${bucket}/player_${encodeURIComponent(id)}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(val)
            });
          }
        }).catch(() => {});
    }

    res.json({
      success: true,
      boosterType,
      remaining: deductRes.remaining,
      user: deductRes.user,
      currentBottles: sessionRes.currentBottles
    });
  } catch (err) {
    console.error('[API ERROR] /api/game/use-booster:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Game Session: Verify & Complete Level (Anti-Cheat Server Verification)
 */
app.post('/api/game/complete-level', authMiddleware, async (req, res) => {
  try {
    const { sessionToken, moves, levelNumber, boostersUsed, movesCount, durationMs } = req.body || {};
    const id = req.telegramId || 'guest_dev_123';

    // Verify session victory on server
    const verifyRes = gameVerification.verifyLevelCompletion(sessionToken, id, moves, {
      levelNumber,
      boostersUsed,
      movesCount,
      durationMs
    });
    if (!verifyRes.verified) {
      return res.status(400).json({
        success: false,
        unverified: true,
        error: verifyRes.error || 'Проверка прохождения уровня на сервере не удалась'
      });
    }

    // Advance level on server
    const updatedUser = db.completeLevel(id, verifyRes.levelNumber);

    // Sync to KVDB from server
    if (id && !String(id).startsWith('guest') && !String(id).startsWith('dev')) {
      const bucket = process.env.KVDB_BUCKET || '82kzJTUxZwwFNvg7kUSqgM';
      fetch(`https://kvdb.io/${bucket}/player_${encodeURIComponent(id)}?_cb=${Date.now()}`)
        .then(r => r.ok ? r.json() : null)
        .then(val => {
          const baseObj = (val && typeof val === 'object') ? val : { telegramId: id };
          baseObj.maxLevel = updatedUser.max_level;
          baseObj.max_level = updatedUser.max_level;
          baseObj.level = updatedUser.max_level;
          baseObj.currentLevel = updatedUser.current_level;
          baseObj.current_level = updatedUser.current_level;
          baseObj.hints = updatedUser.hints;
          baseObj.undos = updatedUser.undos;
          baseObj.reveals = updatedUser.reveals;
          baseObj.extraBottles = updatedUser.extra_bottles;
          baseObj.extra_bottles = updatedUser.extra_bottles;
          baseObj.stars = 0;
          baseObj.updatedAt = Date.now();
          return fetch(`https://kvdb.io/${bucket}/player_${encodeURIComponent(id)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(baseObj)
          });
        }).catch(() => {});
    }

    res.json({
      success: true,
      levelCompleted: verifyRes.levelNumber,
      newLevel: updatedUser.max_level,
      user: updatedUser
    });
  } catch (err) {
    console.error('[API ERROR] /api/game/complete-level:', err);
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
    let seasonResetAt = db.getSeasonResetTimestamp ? db.getSeasonResetTimestamp() : 0;
    let restoredAt = db.getLeaderboardRestoredTimestamp ? db.getLeaderboardRestoredTimestamp() : 0;
    const bucket = process.env.KVDB_BUCKET || '82kzJTUxZwwFNvg7kUSqgM';

    // Query global cloud KVDB meta_season_reset_at & meta_leaderboard_restored_at
    try {
      const metaRes = await fetch(`https://kvdb.io/${bucket}/meta_season_reset_at?_cb=${Date.now()}`, {
        signal: AbortSignal.timeout(1500)
      });
      if (metaRes.ok) {
        const metaData = await metaRes.json();
        const kvResetAt = Number(metaData.resetAt || metaData) || 0;
        if (kvResetAt > seasonResetAt) seasonResetAt = kvResetAt;
      }
    } catch (e) {}

    try {
      const restRes = await fetch(`https://kvdb.io/${bucket}/meta_leaderboard_restored_at?_cb=${Date.now()}`, {
        signal: AbortSignal.timeout(1500)
      });
      if (restRes.ok) {
        const restData = await restRes.json();
        const kvRestAt = Number(restData.restoredAt || 0);
        if (kvRestAt > restoredAt) restoredAt = kvRestAt;
      }
    } catch (e) {}

    // Merge from global cloud KVDB so offline/online players are unified
    try {
      const cloudRes = await fetch(`https://kvdb.io/${bucket}/?prefix=player_&values=true&format=json&_cb=${Date.now()}`, {
        signal: AbortSignal.timeout(2500)
      });
      if (cloudRes.ok) {
        const pairs = await cloudRes.json();
        const cloudPlayers = pairs
          .map(([k, p]) => {
            if (typeof p === 'string') {
              try { return JSON.parse(p); } catch (e) { return null; }
            }
            return p;
          })
          .filter(p => p && p.telegramId && !String(p.telegramId).startsWith('guest') && !String(p.telegramId).startsWith('dev'));
        
        const playersMap = new Map();
        const usernameMap = new Map();

        leaderboard.topPlayers.forEach(p => {
          const tid = String(p.telegram_id);
          const rawU = p.username || '';
          const cleanU = rawU ? String(rawU).replace(/^@/, '').trim().toLowerCase() : '';
          const entry = {
            telegram_id: tid,
            first_name: p.first_name,
            username: rawU ? String(rawU).replace(/^@/, '').trim() : '',
            photo_url: p.photo_url,
            max_level: Number(p.max_level || 0),
            stars: 0
          };
          playersMap.set(tid, entry);
          if (cleanU) usernameMap.set(cleanU, entry);
        });

        cloudPlayers.forEach(cp => {
          const id = String(cp.telegramId);
          const cpCleanUname = cp.username ? String(cp.username).replace(/^@/, '').trim() : '';
          const lowerUname = cpCleanUname ? cpCleanUname.toLowerCase() : '';

          const cpSeason = Number(cp.seasonResetAt || 0);
          const cpMaxLevel = Number(cp.maxLevel || cp.level || cp.max_level || 0);

          const cpUpdated = Number(cp.updatedAt || 0);
          // Exclude cloud players from old season only if neither seasonResetAt nor updatedAt matches current season
          if (seasonResetAt > 0 && cpSeason < seasonResetAt && cpUpdated < seasonResetAt) return;
          if (cpMaxLevel < 1) return;

          const isDummyName = (name) => !name || name === 'Игрок' || name === 'Player' || name === '.';

          // Match by telegram_id OR by username!
          let existing = playersMap.get(id);
          if (!existing && lowerUname && usernameMap.has(lowerUname)) {
            existing = usernameMap.get(lowerUname);
          }

          if (!existing) {
            let cpFirst = cp.firstName;
            if (isDummyName(cpFirst) && cpCleanUname) {
              cpFirst = `@${cpCleanUname}`;
            } else if (isDummyName(cpFirst)) {
              cpFirst = 'Игрок';
            }
            const newEntry = {
              telegram_id: id,
              first_name: cpFirst,
              username: cpCleanUname,
              photo_url: cp.photoUrl || '',
              max_level: cpMaxLevel,
              stars: 0
            };
            playersMap.set(id, newEntry);
            if (lowerUname) usernameMap.set(lowerUname, newEntry);

            try {
              db.prepare(`
                INSERT INTO users (telegram_id, first_name, username, max_level, current_level, stars)
                VALUES (?, ?, ?, ?, ?, 0)
                ON CONFLICT(telegram_id) DO UPDATE SET 
                  max_level = MAX(users.max_level, excluded.max_level), 
                  stars = 0,
                  first_name = CASE WHEN users.first_name IN ('Player', 'Игрок', '.', '') AND excluded.first_name NOT IN ('Player', 'Игрок', '.', '') THEN excluded.first_name ELSE users.first_name END,
                  username = CASE WHEN (users.username IS NULL OR users.username = '') AND excluded.username != '' THEN excluded.username ELSE users.username END
              `).run(id, cpFirst, cpCleanUname, cpMaxLevel, cpMaxLevel);
            } catch(e) {}
          } else {
            let updatedDb = false;
            let finalName = existing.first_name;
            let finalUname = existing.username || '';

            if (isDummyName(existing.first_name) && !isDummyName(cp.firstName)) {
              finalName = cp.firstName;
              existing.first_name = finalName;
              updatedDb = true;
            } else if (isDummyName(existing.first_name) && cpCleanUname) {
              finalName = `@${cpCleanUname}`;
              existing.first_name = finalName;
              updatedDb = true;
            }

            if (!finalUname && cpCleanUname) {
              finalUname = cpCleanUname;
              existing.username = finalUname;
              if (lowerUname) usernameMap.set(lowerUname, existing);
              updatedDb = true;
            }

            // Always take maximum level! Never downgrade!
            if (cpMaxLevel > existing.max_level) {
              existing.max_level = cpMaxLevel;
              existing.stars = 0;
              updatedDb = true;
            }

            if (updatedDb) {
              try {
                db.prepare(`
                  UPDATE users 
                  SET max_level = ?, current_level = ?, stars = 0, first_name = ?, username = ?
                  WHERE telegram_id = ? OR (username IS NOT NULL AND LOWER(username) = ?)
                `).run(existing.max_level, existing.max_level, finalName, finalUname, existing.telegram_id, lowerUname || '');
              } catch(e) {}
            }
          }
        });

        // Strictly guarantee immutable verified baselines by Telegram ID
        Object.entries(IMMUTABLE_PLAYER_BASELINES).forEach(([tid, baseP]) => {
          let existing = playersMap.get(tid);
          if (existing) {
            existing.max_level = Math.max(existing.max_level, baseP.maxLevel);
            existing.stars = 0;
            if (!existing.first_name || isDummyName(existing.first_name)) existing.first_name = baseP.firstName;
            if (!existing.username && baseP.username) existing.username = baseP.username;
          } else {
            playersMap.set(tid, {
              telegram_id: tid,
              first_name: baseP.firstName,
              username: baseP.username,
              photo_url: '',
              max_level: baseP.maxLevel,
              stars: 0
            });
          }
        });

        const mergedList = Array.from(playersMap.values())
          .map(p => ({ ...p, stars: 0 }))
          .sort((a, b) => b.max_level - a.max_level)
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
 * Ad Watching: Request verification token before starting ad
 */
app.post('/api/ad-reward/start', authMiddleware, (req, res) => {
  try {
    const { rewardType } = req.body || {};
    const id = req.telegramId || 'guest_dev_123';

    const check = db.checkAdRewardAllowed(id);
    if (!check.allowed) {
      return res.status(429).json({ success: false, error: check.error });
    }

    const adToken = gameVerification.createAdToken(id, rewardType || 'hints');
    res.json({ success: true, adToken });
  } catch (err) {
    console.error('[API ERROR] /api/ad-reward/start:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Claim Ad Reward (Verified Rewarded Ads Bonus)
 */
app.post('/api/ad-reward', authMiddleware, async (req, res) => {
  try {
    const { rewardType, adToken } = req.body || {};
    const id = req.telegramId || 'guest_dev_123';

    // Verify ad token if provided (token replay & duration check)
    if (adToken) {
      const isLocal = Boolean(req.isGuest || req.hostname === 'localhost' || (req.ip && (req.ip.includes('127.0.0.1') || req.ip.includes('::1'))));
      const tokenCheck = gameVerification.verifyAndClaimAdToken(adToken, id, rewardType, isLocal);
      if (!tokenCheck.valid) {
        return res.status(400).json({ success: false, error: tokenCheck.error });
      }
    }

    const check = db.checkAdRewardAllowed ? db.checkAdRewardAllowed(id) : { allowed: true };
    if (!check.allowed) {
      return res.status(429).json({ success: false, error: check.error });
    }

    let updatedUser = db.logAdReward(id, rewardType);

    // Forward authoritative server values to KVDB cloud for real players without overwriting existing boosters
    if (id && !String(id).startsWith('guest') && !String(id).startsWith('dev') && updatedUser) {
      const bucket = process.env.KVDB_BUCKET || '82kzJTUxZwwFNvg7kUSqgM';
      try {
        const r = await fetch(`https://kvdb.io/${bucket}/player_${encodeURIComponent(id)}?_cb=${Date.now()}`);
        let val = r.ok ? await r.json() : null;
        if (!val || typeof val !== 'object') val = { telegramId: String(id) };

        val.hints = Math.max(Number(val.hints || 0), Number(updatedUser.hints || 0));
        val.undos = Math.max(Number(val.undos || 0), Number(updatedUser.undos || 0));
        val.reveals = Math.max(Number(val.reveals || 0), Number(updatedUser.reveals || 0));
        const srvBottles = Math.max(Number(val.extraBottles || 0), Number(val.extra_bottles || 0), Number(updatedUser.extra_bottles || 0));
        val.extraBottles = srvBottles;
        val.extra_bottles = srvBottles;

        const maxLvl = Math.max(Number(val.maxLevel || val.max_level || 1), Number(updatedUser.max_level || updatedUser.maxLevel || 1));
        const curLvl = Math.max(Number(val.currentLevel || val.current_level || 1), Number(updatedUser.current_level || updatedUser.currentLevel || 1), maxLvl);
        val.maxLevel = maxLvl;
        val.max_level = maxLvl;
        val.currentLevel = curLvl;
        val.current_level = curLvl;
        val.level = maxLvl;
        val.updatedAt = Date.now();

        await fetch(`https://kvdb.io/${bucket}/player_${encodeURIComponent(id)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(val),
          signal: AbortSignal.timeout(2000)
        }).catch(() => {});

        updatedUser.hints = val.hints;
        updatedUser.undos = val.undos;
        updatedUser.reveals = val.reveals;
        updatedUser.extraBottles = val.extraBottles;
        updatedUser.extra_bottles = val.extraBottles;
        updatedUser.maxLevel = val.maxLevel;
        updatedUser.max_level = val.maxLevel;
        updatedUser.currentLevel = val.currentLevel;
        updatedUser.current_level = val.currentLevel;
        updatedUser.level = val.maxLevel;

        try {
          db.prepare('UPDATE users SET hints = ?, undos = ?, reveals = ?, extra_bottles = ?, max_level = ?, current_level = ? WHERE telegram_id = ?')
            .run(val.hints, val.undos, val.reveals, val.extraBottles, val.maxLevel, val.currentLevel, String(id));
        } catch (e) {}
      } catch (e) {}
    }

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
      rewardType,
      user: updatedUser
    });
  } catch (err) {
    console.error('[API ERROR] /api/ad-reward:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/ad-reward/claim', authMiddleware, async (req, res) => {
  const { rewardType, adToken } = req.body || {};
  const id = req.telegramId || 'guest_dev_123';

  if (adToken) {
    const isLocal = Boolean(req.isGuest || req.hostname === 'localhost' || (req.ip && (req.ip.includes('127.0.0.1') || req.ip.includes('::1'))));
    const tokenCheck = gameVerification.verifyAndClaimAdToken(adToken, id, rewardType, isLocal);
    if (!tokenCheck.valid) {
      return res.status(400).json({ success: false, error: tokenCheck.error });
    }
  }

  const check = db.checkAdRewardAllowed ? db.checkAdRewardAllowed(id) : { allowed: true };
  if (!check.allowed) {
    return res.status(429).json({ success: false, error: check.error });
  }

  let updatedUser = db.logAdReward(id, rewardType);

  if (id && !String(id).startsWith('guest') && !String(id).startsWith('dev') && updatedUser) {
    const bucket = process.env.KVDB_BUCKET || '82kzJTUxZwwFNvg7kUSqgM';
    try {
      const r = await fetch(`https://kvdb.io/${bucket}/player_${encodeURIComponent(id)}?_cb=${Date.now()}`);
      let val = r.ok ? await r.json() : null;
      if (!val || typeof val !== 'object') val = { telegramId: String(id) };

      val.hints = Math.max(Number(val.hints || 0), Number(updatedUser.hints || 0));
      val.undos = Math.max(Number(val.undos || 0), Number(updatedUser.undos || 0));
      val.reveals = Math.max(Number(val.reveals || 0), Number(updatedUser.reveals || 0));
      const srvBottles = Math.max(Number(val.extraBottles || 0), Number(val.extra_bottles || 0), Number(updatedUser.extra_bottles || 0));
      val.extraBottles = srvBottles;
      val.extra_bottles = srvBottles;

      const maxLvl = Math.max(Number(val.maxLevel || val.max_level || 1), Number(updatedUser.max_level || updatedUser.maxLevel || 1));
      const curLvl = Math.max(Number(val.currentLevel || val.current_level || 1), Number(updatedUser.current_level || updatedUser.currentLevel || 1), maxLvl);
      val.maxLevel = maxLvl;
      val.max_level = maxLvl;
      val.currentLevel = curLvl;
      val.current_level = curLvl;
      val.level = maxLvl;
      val.updatedAt = Date.now();

      await fetch(`https://kvdb.io/${bucket}/player_${encodeURIComponent(id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(val),
        signal: AbortSignal.timeout(2000)
      }).catch(() => {});

      updatedUser.hints = val.hints;
      updatedUser.undos = val.undos;
      updatedUser.reveals = val.reveals;
      updatedUser.extraBottles = val.extraBottles;
      updatedUser.extra_bottles = val.extraBottles;
      updatedUser.maxLevel = val.maxLevel;
      updatedUser.max_level = val.maxLevel;
      updatedUser.currentLevel = val.currentLevel;
      updatedUser.current_level = val.currentLevel;
      updatedUser.level = val.maxLevel;

      try {
        db.prepare('UPDATE users SET hints = ?, undos = ?, reveals = ?, extra_bottles = ?, max_level = ?, current_level = ? WHERE telegram_id = ?')
          .run(val.hints, val.undos, val.reveals, val.extraBottles, val.maxLevel, val.currentLevel, String(id));
      } catch (e) {}
    } catch (e) {}
  }

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
    rewardType,
    user: updatedUser
  });
});

/**
 * Save connected TON wallet address
 */
app.post('/api/wallet/connect', (req, res) => {
  try {
    const { telegramId, walletAddress, walletType } = req.body;
    const id = telegramId || 'guest_dev_123';
    const updatedUser = db.updateTonWallet(id, walletAddress, walletType);
    res.json({ success: true, user: updatedUser });
  } catch (err) {
    console.error('[API ERROR] /api/wallet/connect:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Disconnect TON wallet while strictly preserving ton_balance
 */
app.post('/api/wallet/disconnect', (req, res) => {
  try {
    const { telegramId } = req.body;
    const id = telegramId || 'guest_dev_123';
    const updatedUser = db.updateTonWallet(id, '', '');
    res.json({ success: true, user: updatedUser });
  } catch (err) {
    console.error('[API ERROR] /api/wallet/disconnect:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

const processedTxHashesApi = new Set();

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
          if (!txHash || processedTxHashesApi.has(String(txHash))) continue;

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
            processedTxHashesApi.add(String(txHash));
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
          if (!txHash || processedTxHashesApi.has(String(txHash))) continue;

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
            processedTxHashesApi.add(String(txHash));
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
 * Verify and record TON deposit (Requires Telegram Auth & Blockchain Verification)
 */
app.post('/api/wallet/verify-deposit', authMiddleware, async (req, res) => {
  try {
    const { amount, memo, walletAddress, walletType } = req.body || {};
    const id = req.telegramId || 'guest_dev_123';
    const depositAmount = parseFloat(amount) || 0;
    if (depositAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Некорректная сумма пополнения' });
    }

    const check = await verifyTonDepositOnChain(memo, depositAmount, walletAddress);
    if (!check.verified) {
      return res.status(400).json({ success: false, error: check.error || 'Транзакция не найдена на кошельке.' });
    }

    const creditedAmount = check.amount || depositAmount;
    const result = db.recordTonDeposit(id, creditedAmount, memo, walletAddress, walletType || '', check.txHash);
    if (!result) {
      return res.status(500).json({ success: false, error: 'Ошибка обработки пополнения' });
    }
    if (result.duplicate) {
      return res.status(400).json({ success: false, error: result.error || 'Эта транзакция уже была обработана' });
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
app.post('/api/shop/buy', async (req, res) => {
  try {
    const { telegramId, itemId } = req.body || {};
    const id = req.telegramId || telegramId || 'guest_dev_123';

    if (!itemId) {
      return res.status(400).json({ success: false, error: 'Не указан ID товара' });
    }

    // If real player on serverless, sync ton_balance and boosters from KVDB first so purchase check passes
    if (id && !String(id).startsWith('guest') && !String(id).startsWith('dev')) {
      const bucket = process.env.KVDB_BUCKET || '82kzJTUxZwwFNvg7kUSqgM';
      try {
        const kvRes = await fetch(`https://kvdb.io/${bucket}/player_${encodeURIComponent(id)}?_cb=${Date.now()}`);
        if (kvRes.ok) {
          const kvData = await kvRes.json();
          if (kvData && typeof kvData === 'object') {
            const cur = db.getUser(id);
            if (cur) {
              const clampBooster = (val) => String(id) === '5761685341' ? Math.max(0, Number(val || 0)) : Math.min(Math.max(0, Number(val || 0)), 10000);
              const maxH = clampBooster(Math.max(Number(cur.hints || 0), Number(kvData.hints || 0)));
              const maxU = clampBooster(Math.max(Number(cur.undos || 0), Number(kvData.undos || 0)));
              const maxR = clampBooster(Math.max(Number(cur.reveals || 0), Number(kvData.reveals || 0)));
              const kvB = kvData.extra_bottles !== undefined ? kvData.extra_bottles : kvData.extraBottles;
              const maxB = clampBooster(Math.max(Number(cur.extra_bottles || 0), Number(kvB || 0)));
              db.prepare(`
                UPDATE users
                SET hints = ?, undos = ?, reveals = ?, extra_bottles = ?
                WHERE telegram_id = ?
              `).run(maxH, maxU, maxR, maxB, String(id));
            }
          }
        }
      } catch (e) {}
    }

    const result = db.buyShopItem(id, itemId);
    if (!result) {
      return res.status(404).json({ success: false, error: 'Товар не найден или ошибка пользователя' });
    }

    if (!result.success) {
      return res.status(400).json(result);
    }

    if (id && !String(id).startsWith('guest') && !String(id).startsWith('dev') && result.user) {
      const bucket = process.env.KVDB_BUCKET || '82kzJTUxZwwFNvg7kUSqgM';
      try {
        const r = await fetch(`https://kvdb.io/${bucket}/player_${encodeURIComponent(id)}?_cb=${Date.now()}`);
        let val = r.ok ? await r.json() : null;
        if (!val || typeof val !== 'object') val = { telegramId: String(id) };

        if (itemId === 'bottles_pack_15') {
          val.extraBottles = (Number(val.extraBottles || val.extra_bottles) || 0) + 15;
          val.extra_bottles = val.extraBottles;
        } else if (itemId === 'hints_pack_20') {
          val.hints = (Number(val.hints) || 0) + 20;
        } else if (itemId === 'undos_pack_20') {
          val.undos = (Number(val.undos) || 0) + 20;
        } else if (itemId === 'reveals_pack_20') {
          val.reveals = (Number(val.reveals) || 0) + 20;
        } else if (itemId === 'daily_boosters_30d') {
          val.daily_boosters_days_left = result.user.daily_boosters_days_left;
          val.daily_boosters_last_date = result.user.daily_boosters_last_date;
          val.daily_boosters_purchased_at = result.user.daily_boosters_purchased_at;
          val.hints = (Number(val.hints) || 0) + 10;
          val.undos = (Number(val.undos) || 0) + 10;
          val.reveals = (Number(val.reveals) || 0) + 10;
          val.extraBottles = (Number(val.extraBottles || val.extra_bottles) || 0) + 10;
          val.extra_bottles = val.extraBottles;
        } else if (itemId === 'all_colors_15d') {
          const now = Date.now();
          const curr = Number(val.all_colors_until || 0);
          const base = (curr > now) ? curr : now;
          val.all_colors_until = base + (15 * 24 * 60 * 60 * 1000);
          val.all_colors_purchased_at = now;
        }
        val.ton_balance = result.user.ton_balance !== undefined ? result.user.ton_balance : (val.ton_balance || 0);
        val.updatedAt = Date.now();
        await fetch(`https://kvdb.io/${bucket}/player_${encodeURIComponent(id)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(val)
        });

        // Ensure result.user has accurate values
        result.user.hints = Math.max(Number(result.user.hints || 0), Number(val.hints || 0));
        result.user.undos = Math.max(Number(result.user.undos || 0), Number(val.undos || 0));
        result.user.reveals = Math.max(Number(result.user.reveals || 0), Number(val.reveals || 0));
        const finalB = Math.max(Number(result.user.extra_bottles || 0), Number(val.extraBottles || val.extra_bottles || 0));
        result.user.extra_bottles = finalB;
        result.user.extraBottles = finalB;
      } catch (e) {}
    }

    res.json(result);
  } catch (err) {
    console.error('[API ERROR] /api/shop/buy:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// checkIsAdmin is imported from ../auth

/**
 * Admin Season Reset (Admin Only)
 */
app.post('/api/admin/reset-season', async (req, res) => {
  try {
    const reqBody = req.body || {};
    if (!checkIsAdmin(reqBody)) {
      return res.status(403).json({ success: false, error: 'Доступ запрещён: необходимы права администратора' });
    }

    // 1. Pre-check: inspect leaderboard before reset
    const beforeData = db.getLeaderboard ? db.getLeaderboard(null, 100) : { topPlayers: [] };
    const beforePlayers = (beforeData && beforeData.topPlayers) ? beforeData.topPlayers : [];
    console.log(`[API /reset-season] Контроль ДО сброса: ${beforePlayers.length} игроков в лидерборде.`);

    const resetTimestamp = Number(reqBody.resetAt) || Date.now();
    const result = db.resetSeason(resetTimestamp);
    let updatedUser = null;
    if (reqBody.telegramId) {
      updatedUser = db.getUser(reqBody.telegramId);
    }

    // Combine player IDs from req.body and SQLite leaderboard
    const targetPlayerIds = Array.from(new Set([
      ...(Array.isArray(reqBody.leaderboardPlayerIds) ? reqBody.leaderboardPlayerIds.map(String) : []),
      ...beforePlayers.map(p => String(p.telegram_id))
    ]));

    // Wipe KVDB records on the server with pre-check target list
    resetKvdbSeasonServer(resetTimestamp, targetPlayerIds).catch(err => console.warn('[KVDB Season Reset Server Error]', err));

    // 2. Post-check: verify leaderboard after reset
    const afterData = db.getLeaderboard ? db.getLeaderboard(null, 100) : { topPlayers: [] };
    const afterPlayers = (afterData && afterData.topPlayers) ? afterData.topPlayers : [];
    console.log(`[API /reset-season] Контроль ПОСЛЕ сброса: ${afterPlayers.length} игроков в лидерборде.`);

    res.json({
      success: true,
      ...result,
      resetAt: resetTimestamp,
      user: updatedUser,
      beforeCount: beforePlayers.length,
      afterCount: afterPlayers.length,
      verified: afterPlayers.length === 0
    });
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

let serverReloadTimestamp = Date.now();
app.get('/api/config/server-reload', (req, res) => {
  res.json({ success: true, reloadAt: serverReloadTimestamp });
});

async function resetKvdbSeasonServer(resetTimestamp, targetPlayerIds = []) {
  const bucket = process.env.KVDB_BUCKET || '82kzJTUxZwwFNvg7kUSqgM';
  const baseUrl = `https://kvdb.io/${bucket}`;

  try {
    // 1. Write season reset timestamp to KVDB (purchases are NOT reset!)
    await fetch(`${baseUrl}/meta_season_reset_at`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resetAt: resetTimestamp })
    });
  } catch (e) {
    console.warn('[SERVER KVDB RESET] Meta notice error:', e.message);
  }

  // 2. Targeted reset of known leaderboard players (redundancy control)
  if (Array.isArray(targetPlayerIds) && targetPlayerIds.length > 0) {
    await Promise.allSettled(
      targetPlayerIds.map(async (pid) => {
        try {
          const pRes = await fetch(`${baseUrl}/player_${encodeURIComponent(pid)}?_cb=${Date.now()}`);
          let p = null;
          if (pRes.ok) {
            p = await pRes.json();
            if (typeof p === 'string') {
              try { p = JSON.parse(p); } catch (e) { p = null; }
            }
          }
          if (!p || typeof p !== 'object') p = { telegramId: pid };
          p.currentLevel = 1;
          p.maxLevel = 0;
          p.level = 0;
          p.stars = 0;
          p.total_moves = 0;
          p.seasonResetAt = resetTimestamp;
          p.updatedAt = resetTimestamp;
          // STRICTLY PRESERVED: ton_balance, ton_wallet, memo_code, all_colors_until, all_colors_purchased_at
          return fetch(`${baseUrl}/player_${encodeURIComponent(pid)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(p)
          });
        } catch (e) {}
      })
    );
  }

  // 3. Mass reset of all other player records
  try {
    const listRes = await fetch(`${baseUrl}/?prefix=player_&values=true&format=json&_cb=${Date.now()}`);
    if (listRes.ok) {
      const pairs = await listRes.json();
      if (Array.isArray(pairs)) {
        await Promise.allSettled(
          pairs.map(async ([key, val]) => {
            let p = val;
            if (typeof p === 'string') {
              try { p = JSON.parse(p); } catch (e) { p = null; }
            }
            if (p && typeof p === 'object' && p.telegramId) {
              p.currentLevel = 1;
              p.maxLevel = 0;
              p.level = 0;
              p.stars = 0;
              p.total_moves = 0;
              p.seasonResetAt = resetTimestamp;
              p.updatedAt = resetTimestamp;
              // STRICTLY PRESERVED: ton_balance, ton_wallet, memo_code, all_colors_until, all_colors_purchased_at
              return fetch(`${baseUrl}/${encodeURIComponent(key)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(p)
              });
            }
          })
        );
      }
    }
  } catch (e) {
    console.warn('[SERVER KVDB RESET] Player keys reset error:', e.message);
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
            val.extra_bottles = 0;
            val.shuffles = 0;
            val.purchasesResetAt = resetTimestamp;
            val.purchases_reset_at = resetTimestamp;
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
 * Admin Free Boosters Grant (Admin Only)
 */
app.post('/api/admin/add-boosters', (req, res) => {
  try {
    if (!checkIsAdmin(req) && !checkIsAdmin(req.body || {})) {
      return res.status(403).json({ success: false, error: 'Доступ запрещён: необходимы права администратора' });
    }

    const { telegramId, hints = 0, undos = 0, reveals = 0, extraBottles = 0, tonBalance = 0, levels = 0, setLevel = null } = req.body || {};
    const id = telegramId || 'guest_dev_123';

    const updatedUser = db.addBonus(id, {
      hints: Number(hints || 0),
      undos: Number(undos || 0),
      reveals: Number(reveals || 0),
      extraBottles: Number(extraBottles || 0),
      ton_balance: Number(tonBalance || 0),
      levels: Number(levels || 0),
      setLevel: setLevel !== null && setLevel !== undefined ? Number(setLevel) : null
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
            val.extra_bottles = val.extraBottles;
            val.ton_balance = (val.ton_balance || 0) + Number(tonBalance || 0);
            if (setLevel !== null && setLevel !== undefined && Number(setLevel) >= 1) {
              const exactLvl = Math.max(1, Math.min(500, Number(setLevel)));
              val.currentLevel = exactLvl;
              val.current_level = exactLvl;
              val.maxLevel = exactLvl;
              val.max_level = exactLvl;
              val.level = exactLvl;
            } else if (Number(levels || 0) > 0) {
              val.currentLevel = (val.currentLevel || 1) + Number(levels || 0);
              val.current_level = val.currentLevel;
              val.maxLevel = (val.maxLevel || 0) + Number(levels || 0);
              val.max_level = val.maxLevel;
              val.level = val.maxLevel;
            }
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
 * Admin Set Exact Player Level (Admin Only)
 */
app.post('/api/admin/set-level', async (req, res) => {
  try {
    if (!checkIsAdmin(req) && !checkIsAdmin(req.body || {})) {
      return res.status(403).json({ success: false, error: 'Доступ запрещён: необходимы права администратора' });
    }

    const { targetTelegramId, telegramId, level } = req.body || {};
    const id = String(targetTelegramId || telegramId || '').trim();
    if (!id) {
      return res.status(400).json({ success: false, error: 'Telegram ID is required' });
    }

    const newLvl = Math.max(1, Math.min(500, Number(level || 1)));
    const updatedUser = db.setUserLevel ? db.setUserLevel(id, newLvl) : null;

    if (id && !String(id).startsWith('guest') && !String(id).startsWith('dev')) {
      const bucket = process.env.KVDB_BUCKET || '82kzJTUxZwwFNvg7kUSqgM';
      const baseUrl = `https://kvdb.io/${bucket}`;
      fetch(`${baseUrl}/${encodeURIComponent('player_' + id)}?_cb=${Date.now()}`)
        .then(r => r.ok ? r.json() : null)
        .then(val => {
          const baseObj = (val && typeof val === 'object') ? val : { telegramId: id };
          baseObj.maxLevel = newLvl;
          baseObj.max_level = newLvl;
          baseObj.level = newLvl;
          baseObj.currentLevel = newLvl;
          baseObj.current_level = newLvl;
          baseObj.updatedAt = Date.now();
          fetch(`${baseUrl}/${encodeURIComponent('player_' + id)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(baseObj)
          }).catch(() => {});
        }).catch(() => {});
    }

    res.json({ success: true, user: updatedUser, level: newLvl });
  } catch (err) {
    console.error('[API ERROR] /api/admin/set-level:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Admin Reset All GRAM Purchases (Admin Only)
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
      const resetTs = result.resetAt || Date.now();
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
            val.extra_bottles = 0;
            val.shuffles = 0;
            val.purchasesResetAt = resetTs;
            val.purchases_reset_at = resetTs;
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
        resetAt: resetTs,
        user: result.user,
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
 * Admin: Get all available leaderboard snapshot dates
 */
app.get('/api/admin/leaderboard-history/dates', (req, res) => {
  try {
    if (!checkIsAdmin(req.query)) {
      return res.status(403).json({ success: false, error: 'Доступ запрещён: необходимы права администратора' });
    }
    const dates = db.getLeaderboardSnapshotDates();
    res.json({ success: true, dates });
  } catch (err) {
    console.error('[API ERROR] /api/admin/leaderboard-history/dates:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Admin: Get saved leaderboard snapshot by date or ID
 */
app.get('/api/admin/leaderboard-history', (req, res) => {
  try {
    if (!checkIsAdmin(req.query)) {
      return res.status(403).json({ success: false, error: 'Доступ запрещён: необходимы права администратора' });
    }
    const { date, id } = req.query;
    let snapshot = null;
    if (id) {
      snapshot = db.getLeaderboardSnapshotById(id);
    } else if (date) {
      snapshot = db.getLeaderboardSnapshotByDate(date);
    } else {
      const dates = db.getLeaderboardSnapshotDates();
      if (dates && dates.length > 0) {
        snapshot = db.getLeaderboardSnapshotById(dates[0].id);
      }
    }

    if (!snapshot) {
      return res.status(404).json({ success: false, error: 'Снимок за указанную дату не найден' });
    }

    res.json({ success: true, snapshot });
  } catch (err) {
    console.error('[API ERROR] /api/admin/leaderboard-history:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Admin: Take immediate snapshot of leaderboard (manual snapshot)
 */
app.post('/api/admin/leaderboard-history/snapshot', async (req, res) => {
  try {
    if (!checkIsAdmin(req.body)) {
      return res.status(403).json({ success: false, error: 'Доступ запрещён: необходимы права администратора' });
    }

    let kvdbPlayers = [];
    try {
      const bucket = process.env.KVDB_BUCKET || '82kzJTUxZwwFNvg7kUSqgM';
      const cloudRes = await fetch(`https://kvdb.io/${bucket}/?prefix=player_&values=true&format=json&_cb=${Date.now()}`, {
        signal: AbortSignal.timeout(2000)
      });
      if (cloudRes.ok) {
        const pairs = await cloudRes.json();
        kvdbPlayers = pairs.map(([k, p]) => typeof p === 'string' ? JSON.parse(p) : p).filter(Boolean);
      }
    } catch (e) {}

    const snapshot = db.saveLeaderboardSnapshot({ additionalPlayers: kvdbPlayers, snapshotType: 'manual' });
    res.json({ success: true, snapshot, message: 'Ручной снимок лидерборда успешно сохранён!' });
  } catch (err) {
    console.error('[API ERROR] /api/admin/leaderboard-history/snapshot:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Admin: Delete leaderboard snapshot by ID
 */
app.delete('/api/admin/leaderboard-history', (req, res) => {
  try {
    const authData = req.body && Object.keys(req.body).length > 0 ? req.body : req.query;
    if (!checkIsAdmin(authData)) {
      return res.status(403).json({ success: false, error: 'Доступ запрещён: необходимы права администратора' });
    }
    const id = (req.query && req.query.id) || (req.body && req.body.id);
    if (!id) {
      return res.status(400).json({ success: false, error: 'Не указан ID снимка' });
    }
    const deleted = db.deleteLeaderboardSnapshot(id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Снимок не найден или уже удалён' });
    }
    res.json({ success: true, message: `Снимок #${id} успешно удалён!` });
  } catch (err) {
    console.error('[API ERROR] DELETE /api/admin/leaderboard-history:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/leaderboard-history/delete', (req, res) => {
  try {
    if (!checkIsAdmin(req.body)) {
      return res.status(403).json({ success: false, error: 'Доступ запрещён: необходимы права администратора' });
    }
    const id = req.body && req.body.id;
    if (!id) {
      return res.status(400).json({ success: false, error: 'Не указан ID снимка' });
    }
    const deleted = db.deleteLeaderboardSnapshot(id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Снимок не найден или уже удалён' });
    }
    res.json({ success: true, message: `Снимок #${id} успешно удалён!` });
  } catch (err) {
    console.error('[API ERROR] POST /api/admin/leaderboard-history/delete:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Admin: Restore leaderboard snapshot to active database (roll back or restore backup)
 */
app.post('/api/admin/leaderboard-history/restore', async (req, res) => {
  try {
    if (!checkIsAdmin(req.body)) {
      return res.status(403).json({ success: false, error: 'Доступ запрещён: необходимы права администратора' });
    }
    const id = req.body && (req.body.id || req.body.snapshotId);
    if (!id) {
      return res.status(400).json({ success: false, error: 'Не указан ID снимка для восстановления' });
    }
    const result = await db.restoreLeaderboardSnapshot(id);
    res.json({
      success: true,
      message: `Снимок #${id} успешно загружен в активный лидерборд! Синхронизировано ${result.totalPlayers} игроков.`,
      ...result
    });
  } catch (err) {
    console.error('[API ERROR] POST /api/admin/leaderboard-history/restore:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Admin: Get all players who connected a TON wallet
 */
app.get('/api/admin/connected-wallets', (req, res) => {
  try {
    if (!checkIsAdmin(req.query)) {
      return res.status(403).json({ success: false, error: 'Доступ запрещён: необходимы права администратора' });
    }
    const wallets = db.getConnectedWallets();
    res.json({ success: true, wallets });
  } catch (err) {
    console.error('[API ERROR] /api/admin/connected-wallets:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Admin: Get confirmed deposits for a specific player (Lazy-loaded)
 */
app.get('/api/admin/player-deposits', (req, res) => {
  try {
    if (!checkIsAdmin(req.query)) {
      return res.status(403).json({ success: false, error: 'Доступ запрещён: необходимы права администратора' });
    }
    const targetTelegramId = req.query.telegramId || req.query.playerTid || req.query.playerTelegramId;
    if (!targetTelegramId) {
      return res.status(400).json({ success: false, error: 'Параметр telegramId обязателен' });
    }
    const deposits = db.getPlayerDeposits(targetTelegramId);
    const totalAmount = Number(deposits.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0).toFixed(4));
    const totalCount = deposits.length;
    res.json({ success: true, deposits, totalAmount, totalCount });
  } catch (err) {
    console.error('[API ERROR] /api/admin/player-deposits:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Admin: News & Telegram Notifications Broadcast
 */
app.all('/api/admin/news', (req, res) => newsService.handleRequest(req, res));

/**
 * Cron trigger for daily leaderboard snapshot & daily boosters (23:59 Kyiv)
 */
app.get('/api/cron/leaderboard-snapshot', async (req, res) => {
  try {
    const kyiv = db.getKyivDateTime();
    const snapshot = db.saveLeaderboardSnapshot({ timeStr: '23:59:00', snapshotType: 'auto' });

    let boosterResults = [];
    try {
      const bucket = process.env.KVDB_BUCKET || '82kzJTUxZwwFNvg7kUSqgM';
      const cloudPlayersRes = await fetch(`https://kvdb.io/${bucket}/?prefix=player_&values=true&format=json&_cb=${Date.now()}`);
      let cloudPlayers = [];
      if (cloudPlayersRes.ok) {
        const raw = await cloudPlayersRes.json();
        if (Array.isArray(raw)) {
          cloudPlayers = raw.map(([k, v]) => typeof v === 'string' ? JSON.parse(v) : v).filter(Boolean);
        }
      }
      boosterResults = db.accrueDailyBoostersForAll(new Date(), cloudPlayers);
      for (const bItem of boosterResults) {
        if (bItem.user && !String(bItem.telegramId).startsWith('guest') && !String(bItem.telegramId).startsWith('dev')) {
          const tid = String(bItem.telegramId);
          try {
            const r = await fetch(`https://kvdb.io/${bucket}/player_${encodeURIComponent(tid)}?_cb=${Date.now()}`);
            let kvUser = r.ok ? await r.json() : null;
            if (!kvUser) kvUser = { telegramId: tid };
            kvUser.hints = bItem.user.hints;
            kvUser.undos = bItem.user.undos;
            kvUser.reveals = bItem.user.reveals;
            kvUser.extraBottles = bItem.user.extra_bottles;
            kvUser.extra_bottles = bItem.user.extra_bottles;
            kvUser.daily_boosters_days_left = bItem.user.daily_boosters_days_left;
            kvUser.daily_boosters_last_date = bItem.user.daily_boosters_last_date;
            kvUser.updatedAt = Date.now();
            await fetch(`https://kvdb.io/${bucket}/player_${encodeURIComponent(tid)}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(kvUser)
            });
          } catch (syncErr) {
            console.error('[CRON KVDB SYNC ERROR]:', tid, syncErr.message);
          }
        }
      }
    } catch (bErr) {
      console.error('[API CRON BOOSTER ERROR]:', bErr.message);
    }

    res.json({
      success: true,
      snapshot,
      boostersAccrued: boosterResults.length,
      message: `Снимок лидерборда за ${kyiv.fullStr} сохранён, начислено бонусов игрокам: ${boosterResults.length}`
    });
  } catch (err) {
    console.error('[API CRON ERROR] /api/cron/leaderboard-snapshot:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Dedicated cron trigger for daily boosters distribution (23:59 Kyiv)
 */
app.get('/api/cron/daily-boosters', async (req, res) => {
  try {
    const bucket = process.env.KVDB_BUCKET || '82kzJTUxZwwFNvg7kUSqgM';
    const cloudPlayersRes = await fetch(`https://kvdb.io/${bucket}/?prefix=player_&values=true&format=json&_cb=${Date.now()}`);
    let cloudPlayers = [];
    if (cloudPlayersRes.ok) {
      const raw = await cloudPlayersRes.json();
      if (Array.isArray(raw)) {
        cloudPlayers = raw.map(([k, v]) => typeof v === 'string' ? JSON.parse(v) : v).filter(Boolean);
      }
    }
    const boosterResults = db.accrueDailyBoostersForAll(new Date(), cloudPlayers);
    for (const bItem of boosterResults) {
      if (bItem.user && !String(bItem.telegramId).startsWith('guest') && !String(bItem.telegramId).startsWith('dev')) {
        const tid = String(bItem.telegramId);
        try {
          const r = await fetch(`https://kvdb.io/${bucket}/player_${encodeURIComponent(tid)}?_cb=${Date.now()}`);
          let kvUser = r.ok ? await r.json() : null;
          if (!kvUser) kvUser = { telegramId: tid };
          kvUser.hints = bItem.user.hints;
          kvUser.undos = bItem.user.undos;
          kvUser.reveals = bItem.user.reveals;
          kvUser.extraBottles = bItem.user.extra_bottles;
          kvUser.extra_bottles = bItem.user.extra_bottles;
          kvUser.daily_boosters_days_left = bItem.user.daily_boosters_days_left;
          kvUser.daily_boosters_last_date = bItem.user.daily_boosters_last_date;
          kvUser.updatedAt = Date.now();
          await fetch(`https://kvdb.io/${bucket}/player_${encodeURIComponent(tid)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(kvUser)
          });
        } catch (syncErr) {
          console.error('[CRON KVDB SYNC ERROR]:', tid, syncErr.message);
        }
      }
    }
    res.json({ success: true, count: boosterResults.length, results: boosterResults });
  } catch (err) {
    console.error('[API CRON ERROR] /api/cron/daily-boosters:', err);
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

/**
 * Gifts System Endpoints
 */
app.get('/api/gifts/inbox', (req, res) => {
  try {
    const telegramId = req.query.telegramId;
    if (!telegramId) return res.json({ success: true, gifts: [] });
    const gifts = db.getInboxGifts(telegramId);
    res.json({ success: true, gifts });
  } catch (err) {
    console.error('[API ERROR] /api/gifts/inbox:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/gifts/send', async (req, res) => {
  try {
    const gift = req.body;
    if (!gift || !gift.recipientId || !gift.giftType) {
      return res.status(400).json({ success: false, error: 'Invalid gift data' });
    }
    if (req.telegramId) {
      gift.fromId = req.telegramId;
      gift.senderId = req.telegramId;
    }
    const isTon = String(gift.giftType || '').toLowerCase() === 'ton' || String(gift.giftType || '').toLowerCase() === 'gram';
    const isAdminGift = isTon || String(gift.senderType || '').toLowerCase() === 'colorsort' || String(gift.senderType || '').toLowerCase() === 'admin';
    if (isAdminGift) {
      const pin = req.headers['x-admin-pin'] || gift.adminPin || gift.adminCode;
      if (String(pin).trim() !== '1986') {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Для отправки TON или подарков от имени администратора требуется секретный PIN-код'
        });
      }
    }
    const result = db.sendGift(gift);
    if (!result || !result.success) {
      return res.status(400).json(result || { success: false, error: 'Ошибка отправки подарка' });
    }

    // 1. Instantly mirror gift to Recipient KVDB cloud inbox so all serverless instances & browsers see it in real-time
    const bucket = process.env.KVDB_BUCKET || '82kzJTUxZwwFNvg7kUSqgM';
    const recipientId = String(gift.recipientId);
    if (recipientId && !recipientId.startsWith('guest') && !recipientId.startsWith('dev')) {
      fetch(`https://kvdb.io/${bucket}/gifts_inbox_${encodeURIComponent(recipientId)}?_cb=${Date.now()}`)
        .then(r => r.ok ? r.json() : [])
        .then(existing => {
          const list = Array.isArray(existing) ? existing : [];
          if (!list.some(g => String(g.id) === String(gift.id))) {
            list.unshift(gift);
          }
          return fetch(`https://kvdb.io/${bucket}/gifts_inbox_${encodeURIComponent(recipientId)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(list.slice(0, 50))
          });
        }).catch(() => {});
    }

    // 2. If sender booster was deducted, immediately sync deducted booster balance to sender's KVDB record
    const senderId = String(gift.fromId || gift.senderId);
    if (senderId && !senderId.startsWith('guest') && !senderId.startsWith('dev') && !isTon) {
      const senderUser = db.getUser(senderId);
      if (senderUser) {
        fetch(`https://kvdb.io/${bucket}/player_${encodeURIComponent(senderId)}?_cb=${Date.now()}`)
          .then(r => r.ok ? r.json() : null)
          .then(cloudVal => {
            if (cloudVal && typeof cloudVal === 'object') {
              cloudVal.hints = senderUser.hints;
              cloudVal.undos = senderUser.undos;
              cloudVal.reveals = senderUser.reveals;
              cloudVal.extraBottles = senderUser.extra_bottles;
              cloudVal.extra_bottles = senderUser.extra_bottles;
              cloudVal.updatedAt = Date.now();
              return fetch(`https://kvdb.io/${bucket}/player_${encodeURIComponent(senderId)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(cloudVal)
              });
            }
          }).catch(() => {});
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[API ERROR] /api/gifts/send:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/gifts/claim', async (req, res) => {
  try {
    const { giftId, recipientId } = req.body || {};
    const actualRecipient = req.telegramId || recipientId;
    if (!giftId || !actualRecipient) {
      return res.status(400).json({ success: false, error: 'Missing parameters' });
    }
    const claimed = db.claimGift(giftId, actualRecipient);
    if (!claimed) {
      return res.status(400).json({ success: false, error: 'Подарок уже получен или не найден' });
    }
    const user = db.getUser(actualRecipient);

    // Sync claimed status to KVDB inbox and update player balance in KVDB
    const bucket = process.env.KVDB_BUCKET || '82kzJTUxZwwFNvg7kUSqgM';
    const recId = String(actualRecipient);
    if (recId && !recId.startsWith('guest') && !recId.startsWith('dev')) {
      // 1. Mark claimed in KVDB inbox
      fetch(`https://kvdb.io/${bucket}/gifts_inbox_${encodeURIComponent(recId)}?_cb=${Date.now()}`)
        .then(r => r.ok ? r.json() : [])
        .then(list => {
          if (Array.isArray(list)) {
            let changed = false;
            list.forEach(g => {
              if (String(g.id) === String(giftId)) {
                g.claimed = true;
                g.claimedAt = Date.now();
                changed = true;
              }
            });
            if (changed) {
              return fetch(`https://kvdb.io/${bucket}/gifts_inbox_${encodeURIComponent(recId)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(list.slice(0, 50))
              });
            }
          }
        }).catch(() => {});

      // 2. Sync recipient's updated boosters and TON balance to player KVDB record
      if (user) {
        fetch(`https://kvdb.io/${bucket}/player_${encodeURIComponent(recId)}?_cb=${Date.now()}`)
          .then(r => r.ok ? r.json() : null)
          .then(cloudVal => {
            const baseObj = (cloudVal && typeof cloudVal === 'object') ? cloudVal : { telegramId: recId };
            baseObj.hints = user.hints;
            baseObj.undos = user.undos;
            baseObj.reveals = user.reveals;
            baseObj.extraBottles = user.extra_bottles;
            baseObj.extra_bottles = user.extra_bottles;
            baseObj.ton_balance = user.ton_balance;
            baseObj.updatedAt = Date.now();
            return fetch(`https://kvdb.io/${bucket}/player_${encodeURIComponent(recId)}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(baseObj)
            });
          }).catch(() => {});
      }
    }

    res.json({ success: true, user });
  } catch (err) {
    console.error('[API ERROR] /api/gifts/claim:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Admin: Code Checkpoints / Backups Registry
 */
app.get('/api/admin/code-backups', async (req, res) => {
  try {
    const bucket = process.env.KVDB_BUCKET || '82kzJTUxZwwFNvg7kUSqgM';
    const kvdbKey = 'colorsort_code_checkpoints';
    let checkpoints = [];

    try {
      const resp = await fetch(`https://kvdb.io/${bucket}/${kvdbKey}?_cb=${Date.now()}`, {
        signal: AbortSignal.timeout(3000)
      });
      if (resp.ok) {
        const text = await resp.text();
        if (text && text.trim()) {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed) && parsed.length > 0) {
            checkpoints = parsed;
          }
        }
      }
    } catch (e) {
      console.warn('[CodeBackups] KVDB read error:', e.message);
    }

    if (checkpoints.length === 0) {
      checkpoints = [
        {
          id: 'colorsort_checkpoint_20261005_164500',
          createdAtTimestamp: 1791207900000,
          kyivFormattedDate: '05.10.2026, 16:45:00 (Киев)',
          title: 'Версия v1.1.0 — Античит с 5-го уровня, окно безопасности, оптимизация энергопотребления (0 фоновых пингов) и резервная копия админ-панели',
          note: 'Метка Git: v1.1.0-admin-anticheat-opt-checkpoint. Защита от прохождения без подсказок начиная с 5-го уровня (красное модальное окно «Система безопасности Color Sort / Замечены хакерские действия»). Полностью удалены фоновые интервалы поллинга во время игры (0 лишних запросов, экономия батареи и процессора, стабильные 60 FPS). Событийная проверка статуса сервера с 60-сек тайм-аутом. Бесшумные обновления без рассылки сообщений игрокам. Все 50/50 уровней проверены.',
          tag: 'v1.1.0-admin-anticheat-opt-checkpoint'
        },
        {
          id: 'colorsort_checkpoint_20261005_093116',
          createdAtTimestamp: 1791181876093,
          kyivFormattedDate: '05.10.2026, 09:31:16 (Киев)',
          title: 'Версия v1.0.9 — Отправитель подарков, выбор авторства для админа, новый дизайн карточек и мгновенный забор',
          note: 'Метка Git: v1.0.9-gifts-sender-admin-mode-instant-claim. Отображение отправителя у входящих подарков («От: ...»). Панель выбора авторства для администратора («От Alligator» либо «От Color Sort»). Полностью переработана карточка подарка: центрированная иконка сверху, блок описания по центру и широкая кнопка «Забрать» внизу. Устранена задержка при заборе подарков — моментальный отклик и защита от рассинхронизации. Все тесты пройдены.',
          tag: 'v1.0.9-gifts-sender-admin-mode-instant-claim'
        },
        {
          id: 'colorsort_checkpoint_20261003_171000',
          createdAtTimestamp: 1791036600000,
          kyivFormattedDate: '03.10.2026, 17:10:00 (Киев)',
          title: 'Версия v1.0.8 — Восстановление модалок лидерборда и рекламы, уровень игроков в подарках (без кнопки)',
          note: 'Метка Git: v1.0.8-leaderboard-ad-modals-gifts-level-badge. Устранена вложенность модальных окон в public/index.html — кнопки Лидерборда и Рекламы открываются мгновенно и безотказно. В списке получателей подарков убрана кнопка «Выбрать» / «Отправить», а текущий уровень игрока из лидерборда аккуратно отображается в правом углу каждой строки с кликабельным выбором карточки. Полная приватность юзернеймов и анонимность подарков для игроков сохранена. Все тесты пройдены.',
          tag: 'v1.0.8-leaderboard-ad-modals-gifts-level-badge'
        },
        {
          id: 'colorsort_checkpoint_20261003_162500',
          createdAtTimestamp: 1791033900000,
          kyivFormattedDate: '03.10.2026, 16:25:00 (Киев)',
          title: 'Версия v1.0.7 — Анонимные подарки и приватность игроков (доступ юзернеймов только админу)',
          note: 'Метка Git: v1.0.7-anonymous-gifts-admin-usernames. Лидерборд полностью восстановлен на GitHub Pages и Vercel. Юзернеймы (@username) и Telegram ID скрыты у всех обычных игроков и доступны строго администратору (Alligator / Romanchik / ?admin=true). Получение подарков сделано 100% анонимным («Вам прислан полезный подарок!» без раскрытия отправителя). Полные данные аудита отправителей сохранены в базе для администратора.',
          tag: 'v1.0.7-anonymous-gifts-admin-usernames'
        },
        {
          id: 'colorsort_checkpoint_20261003_033500',
          createdAtTimestamp: 1790987700000,
          kyivFormattedDate: '03.10.2026, 03:35:00 (Киев)',
          title: 'Версия v1.0.6 — Стабильная рабочая версия (мгновенный старт, touchstart, чистые колбочки)',
          note: 'Метка Git: v1.0.6-stable-instant-start-checkpoint. Полностью устранён зависающий экран заставки, убрана проблемная шкала 99%. Экран старта и кнопка START открываются мгновенно, добавлены обработчики touchstart для сверхбыстрого отклика на смартфонах в Telegram WebApp. Колбочки чистые, без полос над красками. Снимки лидерборда в 23:59 по Киеву. Безлимитные подарки администратора. 100% тестов пройдены.',
          tag: 'v1.0.6-stable-instant-start-checkpoint'
        },
        {
          id: 'colorsort_checkpoint_20261003_004200',
          createdAtTimestamp: 1790977320000,
          kyivFormattedDate: '03.10.2026, 00:42:00 (Киев)',
          title: 'Версия v1.0.4 — Мгновенный полноэкранный запуск и чистые колбочки',
          note: 'Метка Git: v1.0.4-fullscreen-clean-checkpoint. Мгновенный запуск на весь экран в Telegram без задержек и дёрганья (ранняя инициализация в <head>, viewport-fit=cover, стабильная фиксация 100% высоты). Полностью убрана белая переливающаяся полоска над краской в колбочках. Снимки лидерборда в 23:59 по Киеву. Безлимитные подарки для администратора.',
          tag: 'v1.0.4-fullscreen-clean-checkpoint'
        },
        {
          id: 'colorsort_checkpoint_20261003_001500',
          createdAtTimestamp: 1790975700000,
          kyivFormattedDate: '03.10.2026, 00:15:00 (Киев)',
          title: 'Версия v1.0.3 — Плавная загрузка, чистый экран старта и стабильная работа',
          note: 'Метка Git: v1.0.3-smooth-loading-checkpoint. Устранено дёрганье экрана старта, убрана дублирующая кнопка и пустое место внизу. Оптимизирована нагрузка на телефон (0% лишней нагрузки на CPU/GPU). Снимки лидерборда в 23:59 по Киеву. Безлимитные подарки для администратора.',
          tag: 'v1.0.3-smooth-loading-checkpoint'
        },
        {
          id: 'colorsort_checkpoint_20261002_210400',
          createdAtTimestamp: 1790964240000,
          kyivFormattedDate: '02.10.2026, 21:04:00 (Киев)',
          title: 'Версия v1.0.2 — Рабочая версия панели администратора',
          note: 'Метка Git: v1.0.2-admin-panel-checkpoint. Полностью рабочая панель администратора: плиточный интерфейс, резервные копии, управление уровнями, исследование лидера, кошельки, новости. Очищен лидерборд.',
          tag: 'v1.0.2-admin-panel-checkpoint'
        },
        {
          id: 'colorsort_checkpoint_20261002_184800',
          createdAtTimestamp: 1790956080000,
          kyivFormattedDate: '02.10.2026, 18:48:00 (Киев)',
          title: 'Версия v1.0.1 — Плиточная панель (шахматный порядок)',
          note: 'Метка Git: v1.0.1-tile-grid-checkpoint. Шахматная панель администратора: Резервные копии, Управление, Исследование лидера, Кошелек, Новости. Все функции работают идеально.',
          tag: 'v1.0.1-tile-grid-checkpoint'
        },
        {
          id: 'colorsort_checkpoint_20261002_174000',
          createdAtTimestamp: 1790952000000,
          kyivFormattedDate: '02.10.2026, 17:40:00 (Киев)',
          title: 'Версия v1.0.0 — Стабильная рабочая версия Color Sort',
          note: 'Метка Git: v1.0.0-working-checkpoint. Все уровни, лидерборд, кошельки, бустеры и новости проверены и работают стабильно.',
          tag: 'v1.0.0-working-checkpoint'
        }
      ];
      // Seed KVDB
      fetch(`https://kvdb.io/${bucket}/${kvdbKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checkpoints)
      }).catch(() => {});
    }

    res.json({ success: true, backups: checkpoints });
  } catch (err) {
    console.error('[API ERROR] /api/admin/code-backups:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/code-backups', async (req, res) => {
  try {
    const adminCheck = checkIsAdmin({ ...req.query, ...req.body });
    if (!adminCheck) {
      return res.status(403).json({ success: false, error: 'Доступ запрещён' });
    }

    const action = String(req.body?.action || req.query?.action || '').toLowerCase();
    const bucket = process.env.KVDB_BUCKET || '82kzJTUxZwwFNvg7kUSqgM';
    const kvdbKey = 'colorsort_code_checkpoints';

    let checkpoints = [];
    try {
      const resp = await fetch(`https://kvdb.io/${bucket}/${kvdbKey}?_cb=${Date.now()}`, {
        signal: AbortSignal.timeout(3000)
      });
      if (resp.ok) {
        const text = await resp.text();
        if (text && text.trim()) {
          checkpoints = JSON.parse(text) || [];
        }
      }
    } catch (e) {}

    if (action === 'delete') {
      const targetId = String(req.body?.id || req.query?.id || '');
      checkpoints = checkpoints.filter(c => c.id !== targetId);
      await fetch(`https://kvdb.io/${bucket}/${kvdbKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checkpoints)
      });
      return res.json({ success: true, message: 'Контрольная точка удалена', backups: checkpoints });
    }

    if (action === 'create' || action === 'save') {
      const newCheckpoint = {
        id: String(req.body?.id || `colorsort_checkpoint_${Date.now()}`),
        createdAtTimestamp: Number(req.body?.createdAtTimestamp || Date.now()),
        kyivFormattedDate: String(req.body?.kyivFormattedDate || ''),
        title: String(req.body?.title || 'Новая контрольная точка кода'),
        note: req.body?.note ? String(req.body?.note) : undefined,
        tag: req.body?.tag ? String(req.body?.tag) : undefined
      };
      checkpoints = [newCheckpoint, ...checkpoints.filter(c => c.id !== newCheckpoint.id)];
      await fetch(`https://kvdb.io/${bucket}/${kvdbKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checkpoints)
      });
      return res.json({ success: true, message: 'Контрольная точка сохранена', backups: checkpoints });
    }

    return res.status(400).json({ success: false, error: 'Неизвестное действие' });
  } catch (err) {
    console.error('[API ERROR] /api/admin/code-backups:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Admin: Get Maintenance Mode Status
 */
app.get('/api/admin/maintenance', (req, res) => {
  try {
    const maint = db.getMaintenanceStatus();
    res.json({
      success: true,
      active: maint.active,
      message: maint.message,
      allowedIds: MAINTENANCE_ALLOWED_IDS,
      allowedUsernames: MAINTENANCE_ALLOWED_USERNAMES
    });
  } catch (err) {
    console.error('[API ERROR] GET /api/admin/maintenance:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Admin: Toggle or Update Maintenance Mode
 */
app.post('/api/admin/maintenance', async (req, res) => {
  try {
    const { active, message } = req.body || {};
    const updated = db.setMaintenanceStatus(!!active, message);
    console.log(`[ADMIN] Maintenance mode updated: active=${updated.active}, message="${updated.message}"`);
    res.json({
      success: true,
      active: updated.active,
      message: updated.message
    });
  } catch (err) {
    console.error('[API ERROR] POST /api/admin/maintenance:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Serve static frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

module.exports = app;
