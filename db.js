const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

// Use /tmp directory on Vercel serverless, or local folder in development
const dbDir = process.env.VERCEL ? '/tmp' : __dirname;
const dbPath = path.join(dbDir, 'game_database.sqlite');
const db = new DatabaseSync(dbPath);

// Initialize schema
function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      telegram_id TEXT PRIMARY KEY,
      first_name TEXT NOT NULL,
      username TEXT,
      photo_url TEXT,
      max_level INTEGER DEFAULT 1,
      current_level INTEGER DEFAULT 1,
      stars INTEGER DEFAULT 0,
      coins INTEGER DEFAULT 100,
      hints INTEGER DEFAULT 0,
      undos INTEGER DEFAULT 0,
      reveals INTEGER DEFAULT 0,
      extra_bottles INTEGER DEFAULT 0,
      shuffles INTEGER DEFAULT 0,
      total_moves INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ad_rewards_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id TEXT,
      reward_type TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ton_deposits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id TEXT,
      amount REAL NOT NULL,
      memo TEXT NOT NULL,
      wallet_address TEXT,
      coins_bonus INTEGER DEFAULT 0,
      status TEXT DEFAULT 'completed',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS shop_purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id TEXT,
      item_id TEXT NOT NULL,
      item_name TEXT NOT NULL,
      price_gram REAL NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS referrals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      referrer_id TEXT NOT NULL,
      referred_id TEXT NOT NULL UNIQUE,
      referred_name TEXT,
      referred_username TEXT,
      reward_claimed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      claimed_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_leaderboard ON users(max_level DESC, stars DESC);
    CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
  `);
  
  // Try to add total_moves, reveals, extra_bottles and shuffles if they don't exist (for existing databases)
  try {
    db.exec(`ALTER TABLE users ADD COLUMN total_moves INTEGER DEFAULT 0;`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN reveals INTEGER DEFAULT 0;`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN extra_bottles INTEGER DEFAULT 0;`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN shuffles INTEGER DEFAULT 0;`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN ton_balance REAL DEFAULT 0.0;`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN ton_wallet TEXT DEFAULT '';`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN memo_code TEXT DEFAULT '';`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN all_colors_until INTEGER DEFAULT 0;`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN all_colors_purchased_at INTEGER DEFAULT 0;`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN referrer_id TEXT DEFAULT NULL;`);
  } catch (e) {}
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS referral_bindings (
        referred_id TEXT PRIMARY KEY,
        referrer_id TEXT NOT NULL,
        bound_at TEXT DEFAULT (datetime('now'))
      );
    `);
  } catch (e) {}
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (e) {}
}

initDatabase();

function generateMemoCode(telegramId) {
  const digits = String(telegramId).replace(/\D/g, '');
  const suffix = digits.length >= 6 ? digits.slice(-8) : Math.floor(10000000 + Math.random() * 90000000);
  return `SORT-${suffix}`;
}

/**
 * Get or create user by Telegram ID
 */
function getUser(telegramId, defaultUserData = {}) {
  const stmt = db.prepare('SELECT * FROM users WHERE telegram_id = ?');
  let user = stmt.get(String(telegramId));
  
  if (user) {
    let needsUpdate = false;
    let memoCode = user.memo_code;
    if (!memoCode) {
      memoCode = generateMemoCode(telegramId);
      needsUpdate = true;
    }

    if (defaultUserData.first_name || defaultUserData.username || defaultUserData.photo_url || needsUpdate) {
      const updateStmt = db.prepare(`
        UPDATE users 
        SET first_name = COALESCE(?, first_name),
            username = COALESCE(?, username),
            photo_url = COALESCE(?, photo_url),
            memo_code = COALESCE(?, memo_code),
            updated_at = datetime('now')
        WHERE telegram_id = ?
      `);
      updateStmt.run(
        defaultUserData.first_name || null,
        defaultUserData.username || null,
        defaultUserData.photo_url || null,
        memoCode,
        String(telegramId)
      );
      user = stmt.get(String(telegramId));
    }
    return user;
  }

  const memo = generateMemoCode(telegramId);
  const insertStmt = db.prepare(`
    INSERT INTO users (telegram_id, first_name, username, photo_url, max_level, current_level, stars, coins, hints, undos, reveals, extra_bottles, shuffles, total_moves, ton_balance, ton_wallet, memo_code, all_colors_until)
    VALUES (?, ?, ?, ?, 1, 1, 0, 100, 0, 0, 0, 0, 0, 0, 0.0, '', ?, 0)
  `);
  
  insertStmt.run(
    String(telegramId),
    defaultUserData.first_name || 'Player',
    defaultUserData.username || '',
    defaultUserData.photo_url || '',
    memo
  );

  return stmt.get(String(telegramId));
}

/**
 * Update user game progress
 */
function updateUserProgress(telegramId, { currentLevel, maxLevel, starsAdded, coinsAdded, hintsUsed = 0, undosUsed = 0, revealsUsed = 0, extraBottlesUsed = 0, shufflesUsed = 0, totalMoves = 0, firstName, username, photoUrl, hints, undos, reveals, extraBottles, extra_bottles, shuffles }) {
  const user = getUser(telegramId, { first_name: firstName, username, photo_url: photoUrl });
  if (!user) return null;

  const newMaxLevel = Math.max(user.max_level, maxLevel || currentLevel || user.max_level);
  const newCurrentLevel = currentLevel || user.current_level;
  const newStars = user.stars + (starsAdded || 0);
  const newCoins = Math.max(0, user.coins + (coinsAdded || 0));

  let newHints = Math.max(0, user.hints - hintsUsed);
  if (hints !== undefined && hints !== null) {
    newHints = Math.max(newHints, Number(hints || 0));
  }

  let newUndos = Math.max(0, user.undos - undosUsed);
  if (undos !== undefined && undos !== null) {
    newUndos = Math.max(newUndos, Number(undos || 0));
  }

  let newReveals = Math.max(0, (user.reveals || 0) - revealsUsed);
  if (reveals !== undefined && reveals !== null) {
    newReveals = Math.max(newReveals, Number(reveals || 0));
  }

  let newExtraBottles = Math.max(0, (user.extra_bottles || 0) - extraBottlesUsed);
  const targetBottles = extraBottles !== undefined ? extraBottles : extra_bottles;
  if (targetBottles !== undefined && targetBottles !== null) {
    newExtraBottles = Math.max(newExtraBottles, Number(targetBottles || 0));
  }

  let newShuffles = Math.max(0, (user.shuffles || 0) - shufflesUsed);
  if (shuffles !== undefined && shuffles !== null) {
    newShuffles = Math.max(newShuffles, Number(shuffles || 0));
  }

  const newTotalMoves = user.total_moves + (totalMoves || 0);

  const stmt = db.prepare(`
    UPDATE users
    SET current_level = ?,
        max_level = ?,
        stars = ?,
        coins = ?,
        hints = ?,
        undos = ?,
        reveals = ?,
        extra_bottles = ?,
        shuffles = ?,
        total_moves = ?,
        first_name = COALESCE(?, first_name),
        username = COALESCE(?, username),
        photo_url = COALESCE(?, photo_url),
        updated_at = datetime('now')
    WHERE telegram_id = ?
  `);

  stmt.run(newCurrentLevel, newMaxLevel, newStars, newCoins, newHints, newUndos, newReveals, newExtraBottles, newShuffles, newTotalMoves, firstName || null, username || null, photoUrl || null, String(telegramId));
  return getUser(telegramId);
}

/**
 * Add items / bonus rewards to user
 */
function addBonus(telegramId, { coins = 0, hints = 0, undos = 0, reveals = 0, extra_bottles = 0, extraBottles = 0, shuffles = 0, ton_balance = 0, tonBalance = 0 }) {
  const user = getUser(telegramId);
  if (!user) return null;

  const bottlesToAdd = extra_bottles || extraBottles || 0;
  const tonToAdd = ton_balance || tonBalance || 0;
  const stmt = db.prepare(`
    UPDATE users
    SET coins = coins + ?,
        hints = hints + ?,
        undos = undos + ?,
        reveals = COALESCE(reveals, 0) + ?,
        extra_bottles = COALESCE(extra_bottles, 0) + ?,
        shuffles = COALESCE(shuffles, 0) + ?,
        ton_balance = COALESCE(ton_balance, 0) + ?,
        updated_at = datetime('now')
    WHERE telegram_id = ?
  `);

  stmt.run(coins, hints, undos, reveals, bottlesToAdd, shuffles, tonToAdd, String(telegramId));
  return getUser(telegramId);
}

/**
 * Log ad reward and grant bonus
 */
function logAdReward(telegramId, rewardType) {
  const insertStmt = db.prepare(`
    INSERT INTO ad_rewards_log (telegram_id, reward_type)
    VALUES (?, ?)
  `);
  insertStmt.run(String(telegramId), rewardType);

  let bonus = { coins: 0, hints: 0, undos: 0, reveals: 0, extra_bottles: 0, shuffles: 0 };
  if (rewardType === 'hints') bonus.hints = 1;
  else if (rewardType === 'undos') bonus.undos = 1;
  else if (rewardType === 'reveal_bottle' || rewardType === 'reveals') bonus.reveals = 1;
  else if (rewardType === 'extra_bottle' || rewardType === 'extra_bottles') bonus.extra_bottles = 1;
  else if (rewardType === 'shuffle_colors' || rewardType === 'shuffles') bonus.shuffles = 1;
  else if (rewardType === 'coins') bonus.coins = 150;
  else bonus.coins = 100;

  return addBonus(telegramId, bonus);
}

/**
 * Get today's ad rewards count for a user
 */
function getAdRewardsCount(telegramId) {
  const stmt = db.prepare(`
    SELECT COUNT(*) as count 
    FROM ad_rewards_log 
    WHERE telegram_id = ? AND date(created_at) = date('now')
  `);
  const result = stmt.get(String(telegramId));
  return result ? result.count : 0;
}

/**
 * Get global leaderboard + user's rank
 */
function getLeaderboard(telegramId, limit = 50) {
  // Only real Telegram human players who have completed at least 1 level in the current season (strictly NO bots or guests)
  const topStmt = db.prepare(`
    SELECT telegram_id, first_name, username, photo_url, max_level, stars, total_moves
    FROM users
    WHERE (max_level > 1 OR stars > 0)
      AND telegram_id NOT LIKE 'guest%' AND telegram_id NOT LIKE 'dev%'
    ORDER BY max_level DESC, stars DESC
    LIMIT ?
  `);
  
  const topPlayers = topStmt.all(limit);

  let userRank = null;
  const isRealUser = telegramId && !String(telegramId).startsWith('guest') && !String(telegramId).startsWith('dev');
  if (isRealUser) {
    const user = getUser(telegramId);
    if (user && (user.max_level > 1 || user.stars > 0)) {
      const rankStmt = db.prepare(`
        SELECT COUNT(*) as rank
        FROM users
        WHERE (max_level > 1 OR stars > 0)
          AND (telegram_id NOT LIKE 'guest%' AND telegram_id NOT LIKE 'dev%')
          AND (max_level > ? OR (max_level = ? AND stars > ?))
      `);
      const rankResult = rankStmt.get(user.max_level, user.max_level, user.stars);
      userRank = {
        rank: (rankResult ? rankResult.rank : 0) + 1,
        max_level: user.max_level,
        stars: user.stars,
        total_moves: user.total_moves,
        first_name: user.first_name,
        username: user.username,
        photo_url: user.photo_url
      };
    }
  }

  return {
    topPlayers,
    userRank
  };
}

function getAllTelegramIds() {
  try {
    const rows = db.prepare('SELECT telegram_id FROM users').all();
    return rows.map(r => r.telegram_id);
  } catch (e) {
    return [];
  }
}

function getSeasonResetTimestamp() {
  try {
    const row = db.prepare(`SELECT value FROM system_settings WHERE key = 'season_reset_at'`).get();
    return row ? Number(row.value) : 0;
  } catch (e) {
    return 0;
  }
}

function resetSeason(resetTimestamp = Date.now()) {
  try {
    // Reset player scores, levels, boosters, and perks to 0/1, but PRESERVE user accounts, wallets, and referral records!
    db.exec(`
      UPDATE users 
      SET current_level = 1,
          max_level = 1,
          stars = 0,
          coins = 0,
          hints = 0,
          undos = 0,
          reveals = 0,
          extra_bottles = 0,
          shuffles = 0,
          total_moves = 0,
          all_colors_until = 0,
          all_colors_purchased_at = 0,
          updated_at = datetime('now');
    `);
    db.exec('DELETE FROM ad_rewards_log;');

    try {
      db.prepare(`
        INSERT INTO system_settings (key, value)
        VALUES ('season_reset_at', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
      `).run(String(resetTimestamp));
    } catch (e) {}

    // Referrals table is strictly preserved!
    return { success: true, resetAt: resetTimestamp };
  } catch (err) {
    console.error('[DB Reset Season Error]', err);
    return { success: false, error: err.message };
  }
}

function updateTonWallet(telegramId, walletAddress) {
  const stmt = db.prepare(`
    UPDATE users
    SET ton_wallet = ?,
        updated_at = datetime('now')
    WHERE telegram_id = ?
  `);
  stmt.run(walletAddress || '', String(telegramId));
  return getUser(telegramId);
}

function recordTonDeposit(telegramId, amount, memo, walletAddress) {
  const depositAmount = parseFloat(amount) || 0;
  if (depositAmount <= 0) return null;

  const insertStmt = db.prepare(`
    INSERT INTO ton_deposits (telegram_id, amount, memo, wallet_address, coins_bonus, status)
    VALUES (?, ?, ?, ?, 0, 'completed')
  `);
  insertStmt.run(String(telegramId), depositAmount, memo || '', walletAddress || '');

  const updateStmt = db.prepare(`
    UPDATE users
    SET ton_balance = COALESCE(ton_balance, 0) + ?,
        ton_wallet = CASE WHEN ? != '' THEN ? ELSE ton_wallet END,
        updated_at = datetime('now')
    WHERE telegram_id = ?
  `);
  updateStmt.run(depositAmount, walletAddress || '', walletAddress || '', String(telegramId));

  return {
    user: getUser(telegramId),
    deposit: {
      amount: depositAmount,
      memo
    }
  };
}

/**
 * Buy an upgrade or booster pack from the Shop for GRAM coins
 */
function buyShopItem(telegramId, itemId) {
  const user = getUser(telegramId);
  if (!user) return null;

  const SHOP_ITEMS = {
    all_colors_15d: {
      name: 'Все краски открыты (15 дней)',
      price: 5.0,
      durationDays: 15
    },
    bottles_pack_15: {
      name: '+15 Пустых колб',
      price: 1.0,
      extraBottles: 15
    },
    hints_pack_20: {
      name: '+20 Подсказок',
      price: 1.0,
      hints: 20
    },
    undos_pack_20: {
      name: '+20 Отмен хода',
      price: 1.0,
      undos: 20
    },
    reveals_pack_20: {
      name: '+20 Открыть цвета',
      price: 1.0,
      reveals: 20
    }
  };

  const item = SHOP_ITEMS[itemId];
  if (!item) return null;

  const currentBalance = parseFloat(user.ton_balance || 0);
  if (currentBalance < item.price) {
    return {
      success: false,
      error: 'insufficient_balance',
      message: `Недостаточно GRAM! Требуется ${item.price.toFixed(2)} GRAM, у вас ${currentBalance.toFixed(2)} GRAM. Пополните кошелёк!`,
      needed: item.price,
      balance: currentBalance
    };
  }

  // Deduct price from ton_balance
  const newBalance = Number((currentBalance - item.price).toFixed(4));

  if (itemId === 'all_colors_15d') {
    const now = Date.now();
    const currentExpiry = Number(user.all_colors_until || 0);
    const baseTime = (currentExpiry > now) ? currentExpiry : now;
    const newExpiry = baseTime + (15 * 24 * 60 * 60 * 1000);

    const updateStmt = db.prepare(`
      UPDATE users
      SET ton_balance = ?,
          all_colors_until = ?,
          all_colors_purchased_at = ?,
          updated_at = datetime('now')
      WHERE telegram_id = ?
    `);
    updateStmt.run(newBalance, newExpiry, now, String(telegramId));
  } else if (item.extraBottles) {
    const updateStmt = db.prepare(`
      UPDATE users
      SET ton_balance = ?,
          extra_bottles = COALESCE(extra_bottles, 0) + ?,
          updated_at = datetime('now')
      WHERE telegram_id = ?
    `);
    updateStmt.run(newBalance, item.extraBottles, String(telegramId));
  } else if (item.hints) {
    const updateStmt = db.prepare(`
      UPDATE users
      SET ton_balance = ?,
          hints = COALESCE(hints, 0) + ?,
          updated_at = datetime('now')
      WHERE telegram_id = ?
    `);
    updateStmt.run(newBalance, item.hints, String(telegramId));
  } else if (item.undos) {
    const updateStmt = db.prepare(`
      UPDATE users
      SET ton_balance = ?,
          undos = COALESCE(undos, 0) + ?,
          updated_at = datetime('now')
      WHERE telegram_id = ?
    `);
    updateStmt.run(newBalance, item.undos, String(telegramId));
  } else if (item.reveals) {
    const updateStmt = db.prepare(`
      UPDATE users
      SET ton_balance = ?,
          reveals = COALESCE(reveals, 0) + ?,
          updated_at = datetime('now')
      WHERE telegram_id = ?
    `);
    updateStmt.run(newBalance, item.reveals, String(telegramId));
  }

  // Log purchase
  try {
    const logStmt = db.prepare(`
      INSERT INTO shop_purchases (telegram_id, item_id, item_name, price_gram)
      VALUES (?, ?, ?, ?)
    `);
    logStmt.run(String(telegramId), itemId, item.name, item.price);
  } catch (e) {}

  return {
    success: true,
    message: `Преимущество «${item.name}» успешно активировано!`,
    item,
    user: getUser(telegramId)
  };
}

/**
 * Admin: Reset all active GRAM purchases in the chest for all players.
 * Annuls active advantages (all_colors_until) without touching wallet currency balances (ton_balance).
 */
function resetGramPurchases() {
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT DEFAULT (datetime('now')));`);
    db.exec(`UPDATE users SET all_colors_until = 0, all_colors_purchased_at = 0, hints = 0, undos = 0, reveals = 0, extra_bottles = 0, shuffles = 0;`);
    db.exec(`DELETE FROM shop_purchases;`);
    const nowTs = Date.now();
    db.prepare(`
      INSERT INTO system_settings (key, value) VALUES ('gram_reset_timestamp', ?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')
    `).run(String(nowTs));
    return { success: true, resetAt: nowTs };
  } catch (err) {
    console.error('[DB Reset Gram Purchases Error]', err);
    return { success: false, error: err.message };
  }
}

/**
 * Admin: Reset active TON/GRAM purchases and purchased perks for a single specific player by Telegram ID.
 */
function resetGramPurchasesSingle(targetTelegramId) {
  const id = String(targetTelegramId || '').trim();
  if (!id) return { success: false, error: 'Telegram ID не указан' };

  try {
    const stmt = db.prepare(`
      UPDATE users
      SET all_colors_until = 0,
          all_colors_purchased_at = 0,
          hints = 0,
          undos = 0,
          reveals = 0,
          extra_bottles = 0,
          shuffles = 0,
          updated_at = datetime('now')
      WHERE telegram_id = ?
    `);
    const info = stmt.run(id);
    db.prepare(`DELETE FROM shop_purchases WHERE telegram_id = ?`).run(id);

    return {
      success: true,
      targetTelegramId: id,
      updated: info.changes > 0
    };
  } catch (err) {
    console.error('[DB Reset Single Player Error]', err);
    return { success: false, error: err.message };
  }
}

/**
 * Referral System Methods
 */

function registerReferral(referrerId, referredId, referredName = '', referredUsername = '') {
  const refId = String(referrerId || '').trim();
  const newId = String(referredId || '').trim();
  if (!refId || !newId || refId === newId) return null;

  try {
    // 1. Check permanent referral bindings table
    const existingBinding = db.prepare('SELECT referred_id, referrer_id FROM referral_bindings WHERE referred_id = ?').get(newId);
    if (existingBinding) {
      return { success: false, error: 'already_referred', alreadyReferred: true, referrerId: existingBinding.referrer_id };
    }

    // 2. Check referrals table
    const existing = db.prepare('SELECT id, referrer_id FROM referrals WHERE referred_id = ?').get(newId);
    if (existing) {
      return { success: false, error: 'already_referred', alreadyReferred: true, referrerId: existing.referrer_id };
    }

    // 3. Check users table: existing players cannot be referred later
    const existingUser = db.prepare('SELECT telegram_id, referrer_id, max_level FROM users WHERE telegram_id = ?').get(newId);
    if (existingUser) {
      if (existingUser.referrer_id) {
        return { success: false, error: 'already_referred', alreadyReferred: true, referrerId: existingUser.referrer_id };
      }
      if (Number(existingUser.max_level || 1) > 1) {
        return { success: false, error: 'existing_player', message: 'Игрок уже начал игру ранее' };
      }
    }

    // 4. Save permanent binding
    db.prepare('INSERT OR IGNORE INTO referral_bindings (referred_id, referrer_id) VALUES (?, ?)').run(newId, refId);

    // 5. Insert referral record
    const stmt = db.prepare(`
      INSERT INTO referrals (referrer_id, referred_id, referred_name, referred_username, reward_claimed)
      VALUES (?, ?, ?, ?, 0)
    `);
    const result = stmt.run(refId, newId, referredName || 'Друг', referredUsername || '');

    // 6. Update user's referrer_id if user already exists
    try {
      db.prepare('UPDATE users SET referrer_id = ? WHERE telegram_id = ?').run(refId, newId);
    } catch (e) {}

    return {
      success: true,
      referral: {
        id: result.lastInsertRowid,
        referrer_id: refId,
        referred_id: newId,
        referred_name: referredName || 'Друг',
        referred_username: referredUsername || '',
        reward_claimed: 0
      }
    };
  } catch (err) {
    console.error('[DB Register Referral Error]', err);
    return null;
  }
}

function getReferrals(referrerId) {
  const refId = String(referrerId || '').trim();
  if (!refId) return { totalCount: 0, unclaimedCount: 0, referrals: [] };

  try {
    const rows = db.prepare(`
      SELECT id, referred_id, referred_name, referred_username, reward_claimed, created_at, claimed_at
      FROM referrals
      WHERE referrer_id = ?
      ORDER BY id DESC
    `).all(refId);

    const totalCount = rows.length;
    const unclaimedCount = rows.filter(r => r.reward_claimed === 0).length;

    return {
      totalCount,
      unclaimedCount,
      referrals: rows
    };
  } catch (err) {
    console.error('[DB Get Referrals Error]', err);
    return { totalCount: 0, unclaimedCount: 0, referrals: [] };
  }
}

function claimReferralReward(referrerId, referralId = null) {
  const refId = String(referrerId || '').trim();
  const user = getUser(refId);
  if (!user) return null;

  try {
    let unclaimedRows = [];
    if (referralId) {
      const row = db.prepare('SELECT * FROM referrals WHERE id = ? AND referrer_id = ? AND reward_claimed = 0').get(Number(referralId), refId);
      if (row) unclaimedRows.push(row);
    } else {
      unclaimedRows = db.prepare('SELECT * FROM referrals WHERE referrer_id = ? AND reward_claimed = 0').all(refId);
    }

    if (unclaimedRows.length === 0) {
      return {
        success: false,
        error: 'no_unclaimed_rewards',
        user
      };
    }

    const count = unclaimedRows.length;
    // Each referral rewards: +5 empty bottles, +5 hints, +5 undos, +5 reveals
    const extraBottlesToAdd = count * 5;
    const hintsToAdd = count * 5;
    const undosToAdd = count * 5;
    const revealsToAdd = count * 5;

    const ids = unclaimedRows.map(r => r.id);
    const placeholders = ids.map(() => '?').join(',');
    db.prepare(`
      UPDATE referrals
      SET reward_claimed = 1,
          claimed_at = datetime('now')
      WHERE id IN (${placeholders})
    `).run(...ids);

    db.prepare(`
      UPDATE users
      SET extra_bottles = COALESCE(extra_bottles, 0) + ?,
          hints = COALESCE(hints, 0) + ?,
          undos = COALESCE(undos, 0) + ?,
          reveals = COALESCE(reveals, 0) + ?,
          updated_at = datetime('now')
      WHERE telegram_id = ?
    `).run(extraBottlesToAdd, hintsToAdd, undosToAdd, revealsToAdd, refId);

    const updatedUser = getUser(refId);

    return {
      success: true,
      claimedCount: count,
      bonusesAdded: {
        extraBottles: extraBottlesToAdd,
        hints: hintsToAdd,
        undos: undosToAdd,
        reveals: revealsToAdd
      },
      user: updatedUser,
      referrals: getReferrals(refId).referrals
    };
  } catch (err) {
    console.error('[DB Claim Referral Error]', err);
    return null;
  }
}

module.exports = {
  getUser,
  updateUserProgress,
  addBonus,
  logAdReward,
  getAdRewardsCount,
  getLeaderboard,
  getAllTelegramIds,
  resetSeason,
  getSeasonResetTimestamp,
  resetGramPurchases,
  resetGramPurchasesSingle,
  updateTonWallet,
  recordTonDeposit,
  buyShopItem,
  registerReferral,
  getReferrals,
  claimReferralReward
};
