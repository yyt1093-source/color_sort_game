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

    CREATE TABLE IF NOT EXISTS leaderboard_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      snapshot_date TEXT NOT NULL,
      snapshot_time TEXT NOT NULL,
      snapshot_type TEXT NOT NULL DEFAULT 'auto',
      created_at TEXT NOT NULL,
      created_at_ts INTEGER NOT NULL,
      total_players INTEGER NOT NULL DEFAULT 0,
      players_data TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS leaderboard_snapshot_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      snapshot_id INTEGER NOT NULL,
      rank INTEGER NOT NULL,
      telegram_id TEXT NOT NULL,
      first_name TEXT,
      username TEXT,
      max_level INTEGER NOT NULL,
      stars INTEGER DEFAULT 0,
      FOREIGN KEY (snapshot_id) REFERENCES leaderboard_snapshots(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_lb_snapshots_date ON leaderboard_snapshots(snapshot_date);
    CREATE INDEX IF NOT EXISTS idx_lb_entries_snapshot ON leaderboard_snapshot_entries(snapshot_id, rank ASC);

    CREATE TABLE IF NOT EXISTS player_gifts (
      id TEXT PRIMARY KEY,
      sender_id TEXT NOT NULL,
      sender_name TEXT,
      sender_username TEXT,
      recipient_id TEXT NOT NULL,
      gift_type TEXT NOT NULL,
      gift_name TEXT NOT NULL,
      gift_icon TEXT,
      amount INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL,
      claimed INTEGER DEFAULT 0,
      claimed_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_player_gifts_recipient ON player_gifts(recipient_id, claimed);
  `);
  
  // Try to add snapshot_type if it doesn't exist (for existing databases)
  try {
    db.exec(`ALTER TABLE leaderboard_snapshots ADD COLUMN snapshot_type TEXT DEFAULT 'auto';`);
  } catch (e) {}
  
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
    db.exec(`ALTER TABLE users ADD COLUMN ton_wallet_type TEXT DEFAULT '';`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE ton_deposits ADD COLUMN wallet_type TEXT DEFAULT '';`);
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
    db.exec(`ALTER TABLE users ADD COLUMN purchases_reset_at INTEGER DEFAULT 0;`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN daily_boosters_days_left INTEGER DEFAULT 0;`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN daily_boosters_last_date TEXT DEFAULT '';`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN daily_boosters_purchased_at INTEGER DEFAULT 0;`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN referrer_id TEXT DEFAULT NULL;`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN force_reset_at INTEGER DEFAULT 0;`);
  } catch (e) {}
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS referral_bindings (
        referred_id TEXT PRIMARY KEY,
        referrer_id TEXT NOT NULL,
        bound_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS referral_bindings_username (
        username TEXT PRIMARY KEY,
        referred_id TEXT NOT NULL,
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
      CREATE TABLE IF NOT EXISTS leaderboard_deleted_snapshots (
        id TEXT PRIMARY KEY,
        deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE ton_deposits ADD COLUMN tx_hash TEXT;`);
  } catch (e) {}
  try {
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_ton_deposits_tx_hash ON ton_deposits(tx_hash);`);
  } catch (e) {}
}

const IMMUTABLE_PLAYER_BASELINES = {
  '5761685341': { maxLevel: 49, stars: 0, firstName: 'ALLIGATOR', username: 'ALLIGATOR0709' },
  '7458436672': { maxLevel: 47, stars: 141, firstName: 'Руслан', username: 'ruslan_aliyevvv' },
  '8305679959': { maxLevel: 43, stars: 129, firstName: '.', username: '' },
  '5269257903': { maxLevel: 37, stars: 108, firstName: 'Kostya', username: 'Koctya007' },
  '8982516215': { maxLevel: 36, stars: 99, firstName: 'Qwerty', username: 'sinisterx3' },
  '296239050':  { maxLevel: 35, stars: 105, firstName: 'Sergey', username: 'sergiy121234' },
  '7116446051': { maxLevel: 23, stars: 0, firstName: 'Марія', username: 'Maria290355' },
  '1890528535': { maxLevel: 20, stars: 60, firstName: 'Кирилл', username: 'Cristiano717' },
  '1803189688': { maxLevel: 16, stars: 48, firstName: 'Andriejus', username: 'Tigras1986' },
  '5177916222': { maxLevel: 16, stars: 48, firstName: '⚔️ Gift Kombat Діана 🍀 Anthill', username: '' },
  '1152401670': { maxLevel: 14, stars: 42, firstName: 'Natta', username: 'Smaile82' },
  '615300433':  { maxLevel: 10, stars: 30, firstName: 'ᅠ', username: 'velzevul999' },
  '6582657380': { maxLevel: 9, stars: 21, firstName: 'R', username: 'Romanchiiik0' },
  '1531426251': { maxLevel: 8, stars: 24, firstName: 'Алексей', username: 'Element1914' },
  '387353019':  { maxLevel: 8, stars: 24, firstName: 'Danil', username: 'danilfrais' },
  '7990014996': { maxLevel: 4, stars: 12, firstName: 'Samyrai', username: '' }
};

function ensureImmutablePlayerBaselines() {
  try {
    const upsertStmt = db.prepare(`
      INSERT INTO users (telegram_id, first_name, username, max_level, current_level, stars)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(telegram_id) DO UPDATE SET
        max_level = MAX(users.max_level, excluded.max_level),
        current_level = MAX(users.current_level, excluded.current_level),
        stars = MAX(users.stars, excluded.stars),
        first_name = CASE WHEN users.first_name IN ('Player', 'Игрок', '.', '') AND excluded.first_name NOT IN ('Player', 'Игрок', '.', '') THEN excluded.first_name ELSE users.first_name END,
        username = CASE WHEN (users.username IS NULL OR users.username = '') AND excluded.username != '' THEN excluded.username ELSE users.username END
    `);
    for (const [tid, p] of Object.entries(IMMUTABLE_PLAYER_BASELINES)) {
      upsertStmt.run(tid, p.firstName, p.username, p.maxLevel, p.maxLevel, p.stars);
    }
  } catch (e) {}
}

initDatabase();
ensureImmutablePlayerBaselines();
ensureSeedLeaderboardSnapshot();
ensureActiveSnapshotApplied();
ensureImmutablePlayerBaselines();

function generateMemoCode(telegramId) {
  const digits = String(telegramId).replace(/\D/g, '');
  const suffix = digits.length >= 6 ? digits.slice(-8) : Math.floor(10000000 + Math.random() * 90000000);
  return `SORT-${suffix}`;
}

function isDummyName(name) {
  if (!name || typeof name !== 'string') return true;
  const s = name.trim();
  return s === '' || s === 'Игрок' || s === 'Player' || s === '.' || s === 'Гость' || s === 'Guest';
}

/**
 * Get or create user by Telegram ID
 */
function getUser(telegramId, defaultUserData = {}) {
  const stmt = db.prepare('SELECT * FROM users WHERE telegram_id = ?');
  let user = stmt.get(String(telegramId));

  const cleanUname = defaultUserData.username ? String(defaultUserData.username).replace(/^@/, '').trim() : '';

  // If user not found by telegram_id, check if user exists by username to unify records and prevent progress loss
  if (!user && cleanUname) {
    try {
      const byUname = db.prepare('SELECT * FROM users WHERE LOWER(username) = ?').get(cleanUname.toLowerCase());
      if (byUname) {
        db.prepare(`UPDATE users SET telegram_id = ?, updated_at = datetime('now') WHERE LOWER(username) = ?`).run(String(telegramId), cleanUname.toLowerCase());
        user = stmt.get(String(telegramId));
      }
    } catch (e) {}
  }
  
  if (user) {
    let needsUpdate = false;
    let memoCode = user.memo_code;
    if (!memoCode) {
      memoCode = generateMemoCode(telegramId);
      needsUpdate = true;
    }

    let targetFirstName = user.first_name;
    const incomingFirst = defaultUserData.first_name ? String(defaultUserData.first_name).trim() : '';
    if (incomingFirst) {
      if (!isDummyName(incomingFirst)) {
        if (targetFirstName !== incomingFirst) {
          targetFirstName = incomingFirst;
          needsUpdate = true;
        }
      } else if (isDummyName(targetFirstName) && incomingFirst) {
        if (!targetFirstName) {
          targetFirstName = incomingFirst;
          needsUpdate = true;
        }
      }
    }

    let targetUsername = user.username || '';
    const incomingUname = defaultUserData.username ? String(defaultUserData.username).replace(/^@/, '').trim() : '';
    if (incomingUname && incomingUname !== targetUsername) {
      targetUsername = incomingUname;
      needsUpdate = true;
    }

    if (isDummyName(targetFirstName) && targetUsername) {
      targetFirstName = `@${targetUsername}`;
      needsUpdate = true;
    }

    let targetPhoto = user.photo_url || '';
    if (defaultUserData.photo_url && defaultUserData.photo_url !== targetPhoto) {
      targetPhoto = defaultUserData.photo_url;
      needsUpdate = true;
    }

    if (needsUpdate) {
      const updateStmt = db.prepare(`
        UPDATE users 
        SET first_name = ?,
            username = ?,
            photo_url = ?,
            memo_code = ?,
            updated_at = datetime('now')
        WHERE telegram_id = ?
      `);
      updateStmt.run(
        targetFirstName || 'Игрок',
        targetUsername || null,
        targetPhoto || null,
        memoCode,
        String(telegramId)
      );
      user = stmt.get(String(telegramId));
    }
    const baseEntry = IMMUTABLE_PLAYER_BASELINES[String(telegramId)];
    if (baseEntry && user) {
      if (Number(user.max_level || 0) < baseEntry.maxLevel) {
        user.max_level = baseEntry.maxLevel;
        user.level = baseEntry.maxLevel;
        user.current_level = Math.max(Number(user.current_level || 1), baseEntry.maxLevel);
        user.stars = Math.max(Number(user.stars || 0), baseEntry.stars);
        try {
          db.prepare('UPDATE users SET max_level = ?, current_level = ?, stars = ? WHERE telegram_id = ?')
            .run(user.max_level, user.current_level, user.stars, String(telegramId));
        } catch (e) {}
      }
    }
    return user;
  }

  const memo = generateMemoCode(telegramId);
  let initialFirst = defaultUserData.first_name ? String(defaultUserData.first_name).trim() : '';
  if (isDummyName(initialFirst) && cleanUname) {
    initialFirst = `@${cleanUname}`;
  } else if (isDummyName(initialFirst)) {
    initialFirst = String(telegramId) === 'guest_dev_123' ? 'Гость' : 'Игрок';
  }

  const insertStmt = db.prepare(`
    INSERT INTO users (telegram_id, first_name, username, photo_url, max_level, current_level, stars, coins, hints, undos, reveals, extra_bottles, shuffles, total_moves, ton_balance, ton_wallet, memo_code, all_colors_until, daily_boosters_days_left, daily_boosters_last_date, daily_boosters_purchased_at)
    VALUES (?, ?, ?, ?, 0, 1, 0, 100, 0, 0, 0, 0, 0, 0, 0.0, '', ?, 0, 0, '', 0)
  `);
  
  insertStmt.run(
    String(telegramId),
    initialFirst,
    cleanUname || null,
    defaultUserData.photo_url || '',
    memo
  );

  const createdUser = stmt.get(String(telegramId));
  const baseEntry = IMMUTABLE_PLAYER_BASELINES[String(telegramId)];
  if (baseEntry && createdUser) {
    if (Number(createdUser.max_level || 0) < baseEntry.maxLevel) {
      createdUser.max_level = baseEntry.maxLevel;
      createdUser.level = baseEntry.maxLevel;
      createdUser.current_level = Math.max(Number(createdUser.current_level || 1), baseEntry.maxLevel);
      createdUser.stars = Math.max(Number(createdUser.stars || 0), baseEntry.stars);
      try {
        db.prepare('UPDATE users SET max_level = ?, current_level = ?, stars = ? WHERE telegram_id = ?')
          .run(createdUser.max_level, createdUser.current_level, createdUser.stars, String(telegramId));
      } catch (e) {}
    }
  }
  return createdUser;
}

/**
 * Get user by Telegram username
 */
function getUserByUsername(username) {
  if (!username) return null;
  const clean = String(username).replace(/^@/, '').trim().toLowerCase();
  if (!clean) return null;
  try {
    return db.prepare('SELECT * FROM users WHERE LOWER(username) = ?').get(clean);
  } catch (e) {
    return null;
  }
}

/**
 * Update user game progress
 */
function updateUserProgress(telegramId, { currentLevel, maxLevel, starsAdded, coinsAdded, hintsUsed = 0, undosUsed = 0, revealsUsed = 0, extraBottlesUsed = 0, shufflesUsed = 0, totalMoves = 0, firstName, username, photoUrl, hints, undos, reveals, extraBottles, extra_bottles, shuffles }) {
  const user = getUser(telegramId, { first_name: firstName, username, photo_url: photoUrl });
  if (!user) return null;

  const newMaxLevel = Math.max(user.max_level, maxLevel || currentLevel || user.max_level);
  let newCurrentLevel = currentLevel || user.current_level;
  if (newMaxLevel > 0 && newCurrentLevel < newMaxLevel) {
    newCurrentLevel = newMaxLevel;
  }
  const newStars = user.stars + (starsAdded || 0);
  const newCoins = Math.max(0, user.coins + (coinsAdded || 0));

  let newHints = Math.max(0, user.hints - hintsUsed);
  if (hints !== undefined && hints !== null) {
    newHints = Math.max(0, Number(hints || 0));
  }

  let newUndos = Math.max(0, user.undos - undosUsed);
  if (undos !== undefined && undos !== null) {
    newUndos = Math.max(0, Number(undos || 0));
  }

  let newReveals = Math.max(0, (user.reveals || 0) - revealsUsed);
  if (reveals !== undefined && reveals !== null) {
    newReveals = Math.max(0, Number(reveals || 0));
  }

  let newExtraBottles = Math.max(0, (user.extra_bottles || 0) - extraBottlesUsed);
  const targetBottles = extraBottles !== undefined ? extraBottles : extra_bottles;
  if (targetBottles !== undefined && targetBottles !== null) {
    newExtraBottles = Math.max(0, Number(targetBottles || 0));
  }

  let newShuffles = Math.max(0, (user.shuffles || 0) - shufflesUsed);
  if (shuffles !== undefined && shuffles !== null) {
    newShuffles = Math.max(0, Number(shuffles || 0));
  }

  const newTotalMoves = user.total_moves + (totalMoves || 0);

  let effectiveFirst = user.first_name;
  if (firstName && !isDummyName(firstName)) {
    effectiveFirst = String(firstName).trim();
  }
  let effectiveUname = user.username || '';
  if (username && String(username).trim()) {
    effectiveUname = String(username).replace(/^@/, '').trim();
  }
  if (isDummyName(effectiveFirst) && effectiveUname) {
    effectiveFirst = `@${effectiveUname}`;
  }
  const effectivePhoto = photoUrl || user.photo_url || null;

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
        first_name = ?,
        username = ?,
        photo_url = ?,
        updated_at = datetime('now')
    WHERE telegram_id = ?
  `);

  stmt.run(newCurrentLevel, newMaxLevel, newStars, newCoins, newHints, newUndos, newReveals, newExtraBottles, newShuffles, newTotalMoves, effectiveFirst || 'Игрок', effectiveUname || null, effectivePhoto, String(telegramId));
  return getUser(telegramId);
}

/**
 * Set exact user level (Admin)
 */
function setUserLevel(telegramId, level) {
  const targetLvl = Math.max(1, Math.min(500, Number(level || 1)));
  const user = getUser(telegramId);
  if (!user) return null;

  const stmt = db.prepare(`
    UPDATE users
    SET current_level = ?,
        max_level = ?,
        updated_at = datetime('now')
    WHERE telegram_id = ?
  `);
  stmt.run(targetLvl, targetLvl, String(telegramId));
  return getUser(telegramId);
}

/**
 * Add items / bonus rewards to user
 */
function addBonus(telegramId, { coins = 0, hints = 0, undos = 0, reveals = 0, extra_bottles = 0, extraBottles = 0, shuffles = 0, ton_balance = 0, tonBalance = 0, levels = 0, levelsAdded = 0, setLevel = null }) {
  const user = getUser(telegramId);
  if (!user) return null;

  const bottlesToAdd = extra_bottles || extraBottles || 0;
  const tonToAdd = ton_balance || tonBalance || 0;
  const levelsToAdd = Number(levels || levelsAdded || 0);

  if (setLevel !== null && setLevel !== undefined && Number(setLevel) >= 1) {
    const targetLvl = Math.max(1, Math.min(500, Number(setLevel)));
    const stmt = db.prepare(`
      UPDATE users
      SET coins = coins + ?,
          hints = hints + ?,
          undos = undos + ?,
          reveals = COALESCE(reveals, 0) + ?,
          extra_bottles = COALESCE(extra_bottles, 0) + ?,
          shuffles = COALESCE(shuffles, 0) + ?,
          ton_balance = COALESCE(ton_balance, 0) + ?,
          current_level = ?,
          max_level = ?,
          updated_at = datetime('now')
      WHERE telegram_id = ?
    `);
    stmt.run(coins, hints, undos, reveals, bottlesToAdd, shuffles, tonToAdd, targetLvl, targetLvl, String(telegramId));
    return getUser(telegramId);
  }

  const stmt = db.prepare(`
    UPDATE users
    SET coins = coins + ?,
        hints = hints + ?,
        undos = undos + ?,
        reveals = COALESCE(reveals, 0) + ?,
        extra_bottles = COALESCE(extra_bottles, 0) + ?,
        shuffles = COALESCE(shuffles, 0) + ?,
        ton_balance = COALESCE(ton_balance, 0) + ?,
        current_level = current_level + ?,
        max_level = max_level + ?,
        updated_at = datetime('now')
    WHERE telegram_id = ?
  `);

  stmt.run(coins, hints, undos, reveals, bottlesToAdd, shuffles, tonToAdd, levelsToAdd, levelsToAdd, String(telegramId));
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
 * Validate ad reward eligibility (cooldown + daily cap)
 */
function checkAdRewardAllowed(telegramId) {
  const count = getAdRewardsCount(telegramId);
  if (count >= 50) {
    return { allowed: false, error: 'Достигнут суточный лимит наград за рекламу (50 в день).' };
  }
  const lastStmt = db.prepare(`
    SELECT created_at FROM ad_rewards_log 
    WHERE telegram_id = ? 
    ORDER BY id DESC LIMIT 1
  `);
  const last = lastStmt.get(String(telegramId));
  if (last && last.created_at) {
    const lastTime = new Date(last.created_at.replace(' ', 'T') + 'Z').getTime();
    const elapsed = Date.now() - lastTime;
    if (elapsed < 20000) {
      const waitSec = Math.ceil((20000 - elapsed) / 1000);
      return { allowed: false, error: `Подождите ${waitSec} сек. перед получением следующей награды.` };
    }
  }
  return { allowed: true };
}

/**
 * Get global leaderboard + user's rank
 */
function getLeaderboard(telegramId, limit = 50) {
  // Only real Telegram human players who completed at least 1 level (strictly NO bots or guests)
  const topStmt = db.prepare(`
    SELECT telegram_id, first_name, username, photo_url, max_level, stars, total_moves
    FROM users
    WHERE max_level >= 1
      AND telegram_id NOT LIKE 'guest%' AND telegram_id NOT LIKE 'dev%'
    ORDER BY max_level DESC, stars DESC
    LIMIT ?
  `);
  
  const topPlayers = topStmt.all(limit);

  let userRank = null;
  const isRealUser = telegramId && !String(telegramId).startsWith('guest') && !String(telegramId).startsWith('dev');
  if (isRealUser) {
    const user = getUser(telegramId);
    if (user && user.max_level >= 1) {
      const rankStmt = db.prepare(`
        SELECT COUNT(*) as rank
        FROM users
        WHERE max_level >= 1
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

function getSystemSetting(key, defaultValue = null) {
  try {
    const row = db.prepare(`SELECT value FROM system_settings WHERE key = ?`).get(key);
    return (row && row.value !== null && row.value !== undefined) ? row.value : defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

function setSystemSetting(key, value) {
  try {
    db.prepare(`
      INSERT INTO system_settings (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `).run(key, String(value));
    return true;
  } catch (e) {
    console.error(`[DB ERROR] setSystemSetting(${key}):`, e);
    return false;
  }
}

function getMaintenanceStatus() {
  try {
    const activeVal = getSystemSetting('maintenance_mode', '0');
    const messageVal = getSystemSetting('maintenance_message', 'Идут технические работы. Доступ временно ограничен.');
    return {
      active: activeVal === '1' || activeVal === 'true',
      message: messageVal || 'Идут технические работы. Доступ временно ограничен.'
    };
  } catch (e) {
    return { active: false, message: 'Идут технические работы. Доступ временно ограничен.' };
  }
}

function setMaintenanceStatus(active, message = null) {
  try {
    const activeStr = active ? '1' : '0';
    setSystemSetting('maintenance_mode', activeStr);
    if (message !== null && message !== undefined && String(message).trim()) {
      setSystemSetting('maintenance_message', String(message).trim());
    }
    return getMaintenanceStatus();
  } catch (e) {
    console.error('[DB ERROR] setMaintenanceStatus:', e);
    return { active: !!active, message: message || '' };
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
    // Reset player scores and levels to 0/1, but PRESERVE user boosters, purchases, wallets, and referral records!
    db.exec(`
      UPDATE users 
      SET current_level = 1,
          max_level = 0,
          stars = 0,
          coins = 0,
          total_moves = 0,
          updated_at = datetime('now');
    `);
    // NOTE: hints, undos, reveals, extra_bottles, shop_purchases, ad_rewards_log, all_colors_until, ton_wallet, ton_balance, memo_code, and referrals are STRICTLY PRESERVED

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

function updateTonWallet(telegramId, walletAddress, walletType = '') {
  const stmt = db.prepare(`
    UPDATE users
    SET ton_wallet = ?,
        ton_wallet_type = CASE WHEN ? != '' THEN ? ELSE ton_wallet_type END,
        updated_at = datetime('now')
    WHERE telegram_id = ?
  `);
  stmt.run(walletAddress || '', walletType || '', walletType || '', String(telegramId));
  return getUser(telegramId);
}

function recordTonDeposit(telegramId, amount, memo, walletAddress, walletType = '', txHash = '') {
  const depositAmount = parseFloat(amount) || 0;
  if (depositAmount <= 0) return null;

  if (txHash) {
    try {
      const existing = db.prepare(`SELECT id FROM ton_deposits WHERE tx_hash = ?`).get(String(txHash));
      if (existing) {
        return { duplicate: true, error: 'Эта транзакция уже была обработана ранее.' };
      }
    } catch (e) {}
  }

  const insertStmt = db.prepare(`
    INSERT INTO ton_deposits (telegram_id, amount, memo, wallet_address, wallet_type, tx_hash, coins_bonus, status)
    VALUES (?, ?, ?, ?, ?, ?, 0, 'completed')
  `);
  const info = insertStmt.run(String(telegramId), depositAmount, memo || '', walletAddress || '', walletType || '', txHash || null);

  const updateStmt = db.prepare(`
    UPDATE users
    SET ton_balance = COALESCE(ton_balance, 0) + ?,
        ton_wallet = CASE WHEN ? != '' THEN ? ELSE ton_wallet END,
        ton_wallet_type = CASE WHEN ? != '' THEN ? ELSE ton_wallet_type END,
        updated_at = datetime('now')
    WHERE telegram_id = ?
  `);
  updateStmt.run(depositAmount, walletAddress || '', walletAddress || '', walletType || '', walletType || '', String(telegramId));

  // Sync deposit to KVDB Cloud asynchronously
  if (typeof fetch !== 'undefined') {
    (async () => {
      try {
        const bucket = '82kzJTUxZwwFNvg7kUSqgM';
        const baseUrl = 'https://kvdb.io/' + bucket;
        const key = `deposits_${encodeURIComponent(telegramId)}`;
        const curRes = await fetch(`${baseUrl}/${key}?_cb=${Date.now()}`);
        let list = [];
        if (curRes.ok) {
          try { list = await curRes.json(); } catch (e) {}
        }
        if (!Array.isArray(list)) list = [];
        const depObj = {
          id: 'dep_' + Date.now(),
          telegramId: String(telegramId),
          amount: depositAmount,
          memo: memo || '',
          walletAddress: walletAddress || '',
          walletType: walletType || 'TON Wallet',
          date: new Date().toISOString().replace('T', ' ').substring(0, 19),
          timestamp: Date.now(),
          status: 'confirmed'
        };
        list.unshift(depObj);
        await fetch(`${baseUrl}/${key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(list)
        });
      } catch (e) {
        console.warn('[DB] Sync deposit to cloud error:', e.message);
      }
    })();
  }

  return {
    user: getUser(telegramId),
    deposit: {
      id: info.lastInsertRowid,
      amount: depositAmount,
      memo,
      walletType
    }
  };
}

/**
 * Get all players with a connected TON wallet (Admin only)
 */
function getConnectedWallets() {
  const stmt = db.prepare(`
    SELECT telegram_id, first_name, username, ton_wallet, ton_wallet_type, ton_balance, updated_at
    FROM users
    WHERE ton_wallet IS NOT NULL AND trim(ton_wallet) != ''
    ORDER BY updated_at DESC
  `);
  return stmt.all().map(u => ({
    telegramId: String(u.telegram_id),
    name: u.first_name || 'Игрок',
    username: u.username ? String(u.username).replace(/^@/, '') : '',
    walletAddress: u.ton_wallet,
    walletType: u.ton_wallet_type || 'TON Wallet',
    tonBalance: Number(u.ton_balance || 0),
    updatedAt: u.updated_at
  }));
}

/**
 * Get all confirmed deposits for a specific player (Admin only)
 */
function getPlayerDeposits(telegramId) {
  const stmt = db.prepare(`
    SELECT id, telegram_id, amount, memo, wallet_address, wallet_type, status, created_at
    FROM ton_deposits
    WHERE telegram_id = ?
    ORDER BY id DESC
  `);
  return stmt.all(String(telegramId)).map(d => ({
    id: d.id,
    telegramId: String(d.telegram_id),
    amount: Number(d.amount),
    memo: d.memo || '',
    walletAddress: d.wallet_address || '',
    walletType: d.wallet_type || 'TON Wallet',
    status: d.status || 'confirmed',
    date: d.created_at,
    dateDisplay: d.created_at
  }));
}

/**
 * Buy an upgrade or booster pack from the Shop for GRAM coins
 */
function buyShopItem(telegramId, itemId) {
  const user = getUser(telegramId);
  if (!user) return null;

  const SHOP_ITEMS = {
    daily_boosters_30d: {
      name: 'Подсказки каждый день (30 дней)',
      price: 5.0,
      durationDays: 30,
      daily_boosters: true
    },
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

  if (itemId === 'daily_boosters_30d') {
    const now = Date.now();
    const kyiv = getKyivDateTime(new Date(now));
    const currentDays = Number(user.daily_boosters_days_left || 0);
    const newDays = currentDays + 30;
    // The first daily accrual (+10 of each booster) is credited immediately upon activation!
    // If activated before 23:59:00 Kyiv, the Day 1 23:59 accrual will happen at 23:59 TONIGHT!
    // Therefore, initialLastDate is set to yesterday so that today's 23:59 accrual fires.
    // If activated at or after 23:59:00 Kyiv, today's 23:59 has already passed, so initialLastDate = kyiv.dateStr.
    const isAtOrAfter2359 = (kyiv.hour === 23 && kyiv.minute >= 59);
    let initialLastDate = kyiv.dateStr;
    if (!isAtOrAfter2359) {
      const prevDate = new Date(now - 24 * 3600 * 1000);
      initialLastDate = getKyivDateTime(prevDate).dateStr;
    }

    const updateStmt = db.prepare(`
      UPDATE users
      SET ton_balance = ?,
          hints = COALESCE(hints, 0) + 10,
          undos = COALESCE(undos, 0) + 10,
          reveals = COALESCE(reveals, 0) + 10,
          extra_bottles = COALESCE(extra_bottles, 0) + 10,
          daily_boosters_days_left = ?,
          daily_boosters_last_date = ?,
          daily_boosters_purchased_at = ?,
          updated_at = datetime('now')
      WHERE telegram_id = ?
    `);
    updateStmt.run(newBalance, newDays, initialLastDate, now, String(telegramId));
  } else if (itemId === 'all_colors_15d') {
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
 * Accrue daily boosters (+10 hints, +10 undos, +10 reveals, +10 bottles)
 * for a specific user if 23:59 Kyiv has arrived/passed.
 * Strictly idempotent: tracks daily_boosters_last_date so each day is only credited once.
 */
function accrueDailyBoostersForUser(telegramId, nowInput = new Date()) {
  const user = getUser(telegramId);
  if (!user) return null;

  const daysLeft = Number(user.daily_boosters_days_left || 0);
  if (daysLeft <= 0) return { accrued: false, user };

  const kyiv = getKyivDateTime(nowInput);
  const isAtOrAfter2359 = (kyiv.hour === 23 && kyiv.minute >= 59);

  let latestEligibleDate = kyiv.dateStr;
  if (!isAtOrAfter2359) {
    const prevDate = new Date(nowInput.getTime() - 24 * 3600 * 1000);
    latestEligibleDate = getKyivDateTime(prevDate).dateStr;
  }

  let lastDate = user.daily_boosters_last_date || '';
  if (!lastDate) {
    const dBefore = new Date(new Date(latestEligibleDate + 'T12:00:00Z').getTime() - 24 * 3600 * 1000);
    lastDate = getKyivDateTime(dBefore).dateStr;
  }

  if (lastDate >= latestEligibleDate) {
    return { accrued: false, user };
  }

  const d1 = new Date(lastDate + 'T12:00:00Z');
  const d2 = new Date(latestEligibleDate + 'T12:00:00Z');
  const diffDays = Math.round((d2.getTime() - d1.getTime()) / (24 * 3600 * 1000));
  const dueCount = Math.min(daysLeft, Math.max(0, diffDays));

  if (dueCount <= 0) return { accrued: false, user };

  const addAmount = 10 * dueCount;
  const newDaysLeft = Math.max(0, daysLeft - dueCount);

  db.prepare(`
    UPDATE users
    SET hints = COALESCE(hints, 0) + ?,
        undos = COALESCE(undos, 0) + ?,
        reveals = COALESCE(reveals, 0) + ?,
        extra_bottles = COALESCE(extra_bottles, 0) + ?,
        daily_boosters_days_left = ?,
        daily_boosters_last_date = ?,
        updated_at = datetime('now')
    WHERE telegram_id = ?
  `).run(addAmount, addAmount, addAmount, addAmount, newDaysLeft, latestEligibleDate, String(telegramId));

  const updatedUser = getUser(telegramId);
  return {
    accrued: true,
    dueCount,
    addAmount,
    newDaysLeft,
    lastDate: latestEligibleDate,
    user: updatedUser
  };
}

/**
 * Calculate exact remaining subscription days based on Kyiv time
 * elapsed since purchase date.
 * Purchase Day (Day 1) before 23:59:00 Kyiv: 30 days left.
 * Day 1 at/after 23:59:00 until Day 2 23:58:59: 29 days left.
 * Day 2 at/after 23:59:00 until Day 3 23:58:59: 28 days left.
 * And so on.
 */
function calculateDailyBoostersDaysLeft(purchasedAt, nowInput = new Date(), totalDays = 30) {
  const pAt = Number(purchasedAt || 0);
  if (!pAt) return null;
  const pKyiv = getKyivDateTime(new Date(pAt));
  const nowKyiv = getKyivDateTime(nowInput);

  const pParts = pKyiv.dateStr.split('-').map(Number);
  const nowParts = nowKyiv.dateStr.split('-').map(Number);
  const dP = Date.UTC(pParts[0], pParts[1] - 1, pParts[2]);
  const dNow = Date.UTC(nowParts[0], nowParts[1] - 1, nowParts[2]);
  const diffDays = Math.round((dNow - dP) / (24 * 3600 * 1000));

  let cutoffsPassed = Math.max(0, diffDays);
  if (nowKyiv.hour === 23 && nowKyiv.minute >= 59) {
    cutoffsPassed += 1;
  }
  return Math.max(0, totalDays - cutoffsPassed);
}

/**
 * Accrue daily boosters for all players with daily_boosters_days_left > 0.
 * Called at 23:59:00 Kyiv, by scheduled tasks and on startup/heartbeat.
 * Supports passing additionalPlayers (e.g. from KVDB Cloud) to ensure complete coverage.
 */
function accrueDailyBoostersForAll(nowInput = new Date(), additionalPlayers = []) {
  try {
    if (Array.isArray(additionalPlayers) && additionalPlayers.length > 0) {
      for (const p of additionalPlayers) {
        if (!p) continue;
        const tid = String(p.telegramId || p.telegram_id || '');
        const pDays = Number(p.daily_boosters_days_left !== undefined ? p.daily_boosters_days_left : (p.dailyBoostersDaysLeft || 0));
        const pDate = p.daily_boosters_last_date || p.dailyBoostersLastDate || '';
        const pAt = Number(p.daily_boosters_purchased_at || p.dailyBoostersPurchasedAt || 0);
        if (tid && pDays > 0) {
          const u = getUser(tid);
          if (u && Number(u.daily_boosters_days_left || 0) < pDays) {
            db.prepare(`UPDATE users SET daily_boosters_days_left = ?, daily_boosters_last_date = ?, daily_boosters_purchased_at = ? WHERE telegram_id = ?`)
              .run(pDays, pDate, pAt, tid);
          }
        }
      }
    }

    const users = db.prepare(`SELECT telegram_id FROM users WHERE daily_boosters_days_left > 0`).all();
    const results = [];
    for (const u of users) {
      const res = accrueDailyBoostersForUser(u.telegram_id, nowInput);
      if (res && res.accrued) {
        results.push({
          telegramId: u.telegram_id,
          dueCount: res.dueCount,
          newDaysLeft: res.newDaysLeft,
          addAmount: res.addAmount,
          lastDate: res.lastDate,
          user: res.user
        });
      }
    }
    return results;
  } catch (err) {
    console.error('[DB Accrue Daily Boosters All Error]', err);
    return [];
  }
}

/**
 * Admin: Reset all active GRAM purchases in the chest for all players.
 * Annuls active advantages (all_colors_until) and boosters without touching wallet currency balances (ton_balance)
 * or active 30-day daily boosters subscription (daily_boosters_days_left).
 */
function resetGramPurchases() {
  try {
    const nowTs = Date.now();
    db.exec(`CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT DEFAULT (datetime('now')));`);
    db.exec(`
      UPDATE users 
      SET all_colors_until = 0, 
          all_colors_purchased_at = 0, 
          hints = 0, 
          undos = 0, 
          reveals = 0, 
          extra_bottles = 0, 
          shuffles = 0,
          purchases_reset_at = ${nowTs},
          updated_at = datetime('now');
    `);
    db.exec(`DELETE FROM shop_purchases WHERE item_id != 'daily_boosters_30d';`);
    db.exec(`DELETE FROM ad_rewards_log;`);
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
 * Strictly preserves active 30-day daily boosters subscription.
 */
function resetGramPurchasesSingle(targetTelegramId) {
  const id = String(targetTelegramId || '').trim();
  if (!id) return { success: false, error: 'Telegram ID не указан' };

  try {
    const nowTs = Date.now();
    const stmt = db.prepare(`
      UPDATE users
      SET all_colors_until = 0,
          all_colors_purchased_at = 0,
          hints = 0,
          undos = 0,
          reveals = 0,
          extra_bottles = 0,
          shuffles = 0,
          purchases_reset_at = ?,
          updated_at = datetime('now')
      WHERE telegram_id = ?
    `);
    const info = stmt.run(nowTs, id);
    db.prepare(`DELETE FROM shop_purchases WHERE telegram_id = ? AND item_id != 'daily_boosters_30d'`).run(id);
    db.prepare(`DELETE FROM ad_rewards_log WHERE telegram_id = ?`).run(id);

    return {
      success: true,
      targetTelegramId: id,
      resetAt: nowTs,
      user: getUser(id),
      updated: info.changes > 0
    };
  } catch (err) {
    console.error('[DB Reset Single Player Error]', err);
    return { success: false, error: err.message };
  }
}

function getPurchasesResetTimestamp() {
  try {
    const row = db.prepare("SELECT value FROM system_settings WHERE key = 'gram_reset_timestamp'").get();
    return row ? Number(row.value) : 0;
  } catch (e) {
    return 0;
  }
}

/**
 * Referral System Methods
 */

function registerReferral(referrerId, referredId, referredName = '', referredUsername = '') {
  const refId = String(referrerId || '').trim();
  const newId = String(referredId || '').trim();
  if (!refId || !newId || refId === newId) return null;

  // Reject random guest IDs
  if (newId.startsWith('tg_user_') || newId.startsWith('guest_')) {
    return { success: false, error: 'invalid_telegram_id', message: 'Рефералом может быть только реальный пользователь Telegram' };
  }

  const cleanUsername = String(referredUsername || '').toLowerCase().replace(/^@/, '').trim();

  try {
    // 1. Check permanent referral bindings table by ID
    const existingBinding = db.prepare('SELECT referred_id, referrer_id FROM referral_bindings WHERE referred_id = ?').get(newId);
    if (existingBinding) {
      return { success: false, error: 'already_referred', alreadyReferred: true, referrerId: existingBinding.referrer_id };
    }

    // 2. Check permanent referral bindings table by Username (if provided)
    if (cleanUsername) {
      const existingUname = db.prepare('SELECT username, referrer_id FROM referral_bindings_username WHERE username = ?').get(cleanUsername);
      if (existingUname) {
        return { success: false, error: 'already_referred', alreadyReferred: true, referrerId: existingUname.referrer_id };
      }
      const existingRefUname = db.prepare('SELECT referred_id, referrer_id FROM referrals WHERE LOWER(TRIM(referred_username)) = ? OR LOWER(TRIM(referred_username)) = ?').get(cleanUsername, '@' + cleanUsername);
      if (existingRefUname) {
        return { success: false, error: 'already_referred', alreadyReferred: true, referrerId: existingRefUname.referrer_id };
      }
    }

    // 3. Check referrals table by ID
    const existing = db.prepare('SELECT id, referrer_id FROM referrals WHERE referred_id = ?').get(newId);
    if (existing) {
      return { success: false, error: 'already_referred', alreadyReferred: true, referrerId: existing.referrer_id };
    }

    // 4. Check users table: existing players cannot be referred later
    const existingUser = db.prepare('SELECT telegram_id, referrer_id, max_level FROM users WHERE telegram_id = ?').get(newId);
    if (existingUser) {
      if (existingUser.referrer_id) {
        return { success: false, error: 'already_referred', alreadyReferred: true, referrerId: existingUser.referrer_id };
      }
      if (Number(existingUser.max_level || 1) > 1) {
        return { success: false, error: 'existing_player', message: 'Игрок уже начал игру ранее' };
      }
    }

    // 5. Save permanent binding by ID
    db.prepare('INSERT OR IGNORE INTO referral_bindings (referred_id, referrer_id) VALUES (?, ?)').run(newId, refId);

    // 6. Save permanent binding by Username
    if (cleanUsername) {
      try {
        db.prepare('INSERT OR IGNORE INTO referral_bindings_username (username, referred_id, referrer_id) VALUES (?, ?, ?)').run(cleanUsername, newId, refId);
      } catch (uErr) {}
    }

    // 7. Insert referral record
    const stmt = db.prepare(`
      INSERT INTO referrals (referrer_id, referred_id, referred_name, referred_username, reward_claimed)
      VALUES (?, ?, ?, ?, 0)
    `);
    const result = stmt.run(refId, newId, referredName || 'Игрок', referredUsername || '');

    // 8. Update user's referrer_id if user already exists
    try {
      db.prepare('UPDATE users SET referrer_id = ? WHERE telegram_id = ?').run(refId, newId);
    } catch (e) {}

    return {
      success: true,
      referral: {
        id: result.lastInsertRowid,
        referrer_id: refId,
        referred_id: newId,
        referred_name: referredName || 'Игрок',
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

    const seenIds = new Set();
    const seenUsernames = new Set();
    const cleanRows = [];

    for (const r of rows) {
      const rid = String(r.referred_id || '').trim();
      const runame = String(r.referred_username || '').toLowerCase().replace(/^@/, '').trim();

      if (rid.startsWith('tg_user_') || rid.startsWith('guest_')) {
        continue;
      }
      if (seenIds.has(rid)) continue;
      if (runame && seenUsernames.has(runame)) continue;

      seenIds.add(rid);
      if (runame) seenUsernames.add(runame);
      cleanRows.push(r);
    }

    const totalCount = cleanRows.length;
    const unclaimedCount = cleanRows.filter(r => r.reward_claimed === 0).length;

    return {
      totalCount,
      unclaimedCount,
      referrals: cleanRows
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

/**
 * Format Date in Europe/Kyiv timezone (UTC+2 / UTC+3 with DST)
 */
function getKyivDateTime(dateInput = new Date()) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
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
  const parts = formatter.formatToParts(d);
  const obj = {};
  parts.forEach(p => obj[p.type] = p.value);
  const dateStr = `${obj.year}-${obj.month}-${obj.day}`;
  const timeStr = `${obj.hour}:${obj.minute}:${obj.second}`;
  const fullStr = `${dateStr} ${timeStr}`;
  return {
    dateStr,
    timeStr,
    fullStr,
    timestamp: d.getTime(),
    year: parseInt(obj.year, 10),
    month: parseInt(obj.month, 10),
    day: parseInt(obj.day, 10),
    hour: parseInt(obj.hour, 10),
    minute: parseInt(obj.minute, 10),
    second: parseInt(obj.second, 10)
  };
}

/**
 * Save complete snapshot of all leaderboard players without modifying player records.
 * STRICT: Preserves all user states, levels, and stats unchanged.
 */
function saveLeaderboardSnapshot(options = {}) {
  const kyiv = getKyivDateTime(options.date || new Date());
  const snapshotDate = options.dateStr || kyiv.dateStr;
  const snapshotTime = options.timeStr || kyiv.timeStr;
  const snapshotType = options.snapshotType || (options.isManual ? 'manual' : (options.timeStr === '23:59:00' || options.timeStr === '23:55:00' ? 'auto' : 'manual'));
  const createdAt = `${snapshotDate} ${snapshotTime}`;
  const createdAtTs = options.date ? new Date(options.date).getTime() : kyiv.timestamp;

  // 1. Fetch ALL real players from SQLite who completed at least 1 level (max_level >= 1)
  const stmt = db.prepare(`
    SELECT telegram_id, first_name, username, max_level, stars
    FROM users
    WHERE max_level >= 1
      AND telegram_id NOT LIKE 'guest%'
      AND telegram_id NOT LIKE 'dev%'
    ORDER BY max_level DESC, stars DESC
  `);
  const localPlayers = stmt.all();

  // 2. Combine with any external players provided (e.g. KVDB)
  const playersMap = new Map();
  const usernameMap = new Map();
  localPlayers.forEach(p => {
    const tid = String(p.telegram_id);
    const rawUname = p.username || '';
    const cleanUname = rawUname ? String(rawUname).replace(/^@/, '').trim().toLowerCase() : '';
    const entry = {
      telegram_id: tid,
      first_name: p.first_name || 'Игрок',
      username: rawUname ? String(rawUname).replace(/^@/, '').trim() : '',
      max_level: Number(p.max_level || 0),
      stars: Number(p.stars || 0)
    };
    playersMap.set(tid, entry);
    if (cleanUname) usernameMap.set(cleanUname, entry);
  });

  if (Array.isArray(options.additionalPlayers)) {
    options.additionalPlayers.forEach(cp => {
      if (!cp || (!cp.telegramId && !cp.telegram_id)) return;
      const tid = String(cp.telegramId || cp.telegram_id);
      if (tid.startsWith('guest') || tid.startsWith('dev')) return;
      const cpLevel = Number(cp.maxLevel || cp.level || cp.max_level || 0);
      if (cpLevel < 1) return;

      const rawUname = cp.username || '';
      const cleanUname = rawUname ? String(rawUname).replace(/^@/, '').trim().toLowerCase() : '';

      let existing = playersMap.get(tid);
      if (!existing && cleanUname && usernameMap.has(cleanUname)) {
        existing = usernameMap.get(cleanUname);
      }

      if (existing) {
        if (cpLevel > existing.max_level) {
          existing.max_level = cpLevel;
          existing.stars = Math.max(Number(existing.stars || 0), Number(cp.stars || 0));
        }
        if ((!existing.username || existing.username === '') && rawUname) {
          existing.username = String(rawUname).replace(/^@/, '').trim();
          if (cleanUname) usernameMap.set(cleanUname, existing);
        }
        if ((!existing.first_name || existing.first_name === 'Игрок') && cp.firstName) {
          existing.first_name = cp.firstName;
        }
      } else {
        const newEntry = {
          telegram_id: tid,
          first_name: cp.firstName || cp.first_name || 'Игрок',
          username: rawUname ? String(rawUname).replace(/^@/, '').trim() : '',
          max_level: cpLevel,
          stars: Number(cp.stars || 0)
        };
        playersMap.set(tid, newEntry);
        if (cleanUname) usernameMap.set(cleanUname, newEntry);
      }
    });
  }

  // Merge verified baselines strictly by Telegram ID
  Object.entries(IMMUTABLE_PLAYER_BASELINES).forEach(([tid, baseP]) => {
    let existing = playersMap.get(tid);
    if (existing) {
      existing.max_level = Math.max(existing.max_level, baseP.maxLevel);
      existing.stars = Math.max(existing.stars, baseP.stars);
      if (!existing.first_name || existing.first_name === 'Игрок') existing.first_name = baseP.firstName;
      if (!existing.username && baseP.username) existing.username = baseP.username;
    } else {
      playersMap.set(tid, {
        telegram_id: tid,
        first_name: baseP.firstName,
        username: baseP.username,
        max_level: baseP.maxLevel,
        stars: baseP.stars
      });
    }
  });

  // 3. Sort all players: max_level DESC, stars DESC
  const sortedPlayers = Array.from(playersMap.values())
    .sort((a, b) => b.max_level - a.max_level || (b.stars || 0) - (a.stars || 0));

  // 4. Assign rank 1..N
  const snapshotPlayers = sortedPlayers.map((p, idx) => ({
    rank: idx + 1,
    telegram_id: String(p.telegram_id),
    name: p.first_name || 'Игрок',
    username: p.username || '',
    level: Number(p.max_level || 0),
    stars: Number(p.stars || 0)
  }));

  const playersDataJson = JSON.stringify(snapshotPlayers);

  // 5. Insert snapshot record
  const insertSnapStmt = db.prepare(`
    INSERT INTO leaderboard_snapshots (snapshot_date, snapshot_time, snapshot_type, created_at, created_at_ts, total_players, players_data)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const snapResult = insertSnapStmt.run(
    snapshotDate,
    snapshotTime,
    snapshotType,
    createdAt,
    createdAtTs,
    snapshotPlayers.length,
    playersDataJson
  );

  const snapshotId = Number(snapResult.lastInsertRowid);

  // 6. Insert individual entries
  if (snapshotPlayers.length > 0) {
    const insertEntryStmt = db.prepare(`
      INSERT INTO leaderboard_snapshot_entries (snapshot_id, rank, telegram_id, first_name, username, max_level, stars)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const player of snapshotPlayers) {
      insertEntryStmt.run(
        snapshotId,
        player.rank,
        player.telegram_id,
        player.name,
        player.username,
        player.level,
        player.stars
      );
    }
  }

  console.log(`[DB Snapshot] Saved snapshot #${snapshotId} for ${snapshotDate} (${snapshotTime}) [${snapshotType}]: ${snapshotPlayers.length} players.`);

  const snapshotObj = {
    id: snapshotId,
    snapshot_date: snapshotDate,
    snapshot_time: snapshotTime,
    snapshot_type: snapshotType,
    created_at: createdAt,
    created_at_ts: createdAtTs,
    total_players: snapshotPlayers.length,
    players: snapshotPlayers
  };

  // Sync to KVDB Cloud asynchronously
  if (typeof fetch !== 'undefined') {
    (async () => {
      try {
        const bucket = '82kzJTUxZwwFNvg7kUSqgM';
        const baseUrl = 'https://kvdb.io/' + bucket;
        await fetch(`${baseUrl}/leaderboard_snapshot_${snapshotId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(snapshotObj)
        });
        const idxRes = await fetch(`${baseUrl}/meta_leaderboard_snapshots_index?_cb=${Date.now()}`);
        let idx = [];
        if (idxRes.ok) {
          try { idx = await idxRes.json(); } catch(e) {}
        }
        if (!Array.isArray(idx)) idx = [];
        const meta = {
          id: snapshotId,
          snapshot_date: snapshotDate,
          snapshot_time: snapshotTime,
          snapshot_type: snapshotType,
          total_players: snapshotPlayers.length,
          created_at: createdAt,
          created_at_ts: createdAtTs
        };
        idx = [meta, ...idx.filter(x => String(x.id) !== String(snapshotId))];
        await fetch(`${baseUrl}/meta_leaderboard_snapshots_index`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(idx)
        });
      } catch (e) {}
    })();
  }

  return snapshotObj;
}

/**
 * Get all available snapshot items and summaries
 */
function getLeaderboardSnapshotDates() {
  const stmt = db.prepare(`
    SELECT id, snapshot_date, snapshot_time, snapshot_type, created_at, created_at_ts, total_players
    FROM leaderboard_snapshots
    ORDER BY created_at_ts DESC, id DESC
  `);
  return stmt.all();
}

/**
 * Check if an automatic snapshot already exists for date (prevents guard skipping 23:55)
 */
function getAutoLeaderboardSnapshotByDate(dateStr) {
  if (!dateStr) return null;
  const cleanDate = String(dateStr).trim();
  const stmt = db.prepare(`
    SELECT id, snapshot_date, snapshot_time, snapshot_type, created_at, created_at_ts, total_players
    FROM leaderboard_snapshots
    WHERE snapshot_date = ? AND (snapshot_type = 'auto' OR snapshot_time = '23:59:00' OR snapshot_time = '23:55:00')
    ORDER BY created_at_ts DESC, id DESC
    LIMIT 1
  `);
  return stmt.get(cleanDate) || null;
}

/**
 * Get leaderboard snapshot for a specific date (YYYY-MM-DD)
 */
function getLeaderboardSnapshotByDate(dateStr) {
  if (!dateStr) return null;
  const cleanDate = String(dateStr).trim();
  const stmt = db.prepare(`
    SELECT id, snapshot_date, snapshot_time, snapshot_type, created_at, created_at_ts, total_players, players_data
    FROM leaderboard_snapshots
    WHERE snapshot_date = ?
    ORDER BY created_at_ts DESC, id DESC
    LIMIT 1
  `);
  const row = stmt.get(cleanDate);
  if (!row) return null;

  let players = [];
  try {
    players = JSON.parse(row.players_data);
  } catch (e) {
    const entriesStmt = db.prepare(`
      SELECT rank, telegram_id, first_name as name, username, max_level as level, stars
      FROM leaderboard_snapshot_entries
      WHERE snapshot_id = ?
      ORDER BY rank ASC
    `);
    players = entriesStmt.all(row.id);
  }

  return {
    id: row.id,
    snapshot_date: row.snapshot_date,
    snapshot_time: row.snapshot_time,
    snapshot_type: row.snapshot_type || 'auto',
    created_at: row.created_at,
    created_at_ts: row.created_at_ts,
    total_players: row.total_players,
    players
  };
}

/**
 * Get leaderboard snapshot by ID
 */
function getLeaderboardSnapshotById(snapshotId) {
  const stmt = db.prepare(`
    SELECT id, snapshot_date, snapshot_time, snapshot_type, created_at, created_at_ts, total_players, players_data
    FROM leaderboard_snapshots
    WHERE id = ?
  `);
  const row = stmt.get(Number(snapshotId));
  if (!row) return null;

  let players = [];
  try {
    players = JSON.parse(row.players_data);
  } catch (e) {
    const entriesStmt = db.prepare(`
      SELECT rank, telegram_id, first_name as name, username, max_level as level, stars
      FROM leaderboard_snapshot_entries
      WHERE snapshot_id = ?
      ORDER BY rank ASC
    `);
    players = entriesStmt.all(row.id);
  }

  return {
    id: row.id,
    snapshot_date: row.snapshot_date,
    snapshot_time: row.snapshot_time,
    snapshot_type: row.snapshot_type || 'auto',
    created_at: row.created_at,
    created_at_ts: row.created_at_ts,
    total_players: row.total_players,
    players
  };
}

/**
 * Insert an external snapshot (from KVDB Cloud or backup) directly into SQLite
 */
function insertExternalLeaderboardSnapshot(snap) {
  if (!snap || !snap.snapshot_date) return null;
  const id = snap.id ? Number(snap.id) : null;

  // Guard: if this snapshot ID was marked as deleted, NEVER insert it!
  if (id) {
    try {
      const isDel = db.prepare(`SELECT id FROM leaderboard_deleted_snapshots WHERE id = ?`).get(String(id));
      if (isDel) return null;
    } catch (e) {}
  }

  const snapshotDate = snap.snapshot_date;
  const snapshotTime = snap.snapshot_time || '23:59:00';
  const snapshotType = snap.snapshot_type || 'auto';
  const createdAt = snap.created_at || `${snapshotDate} ${snapshotTime}`;
  const createdAtTs = Number(snap.created_at_ts || (new Date(`${snapshotDate}T${snapshotTime}`).getTime()));
  const players = Array.isArray(snap.players) ? snap.players : [];
  const playersJson = JSON.stringify(players);

  if (id) {
    const existing = db.prepare(`SELECT id FROM leaderboard_snapshots WHERE id = ?`).get(id);
    if (existing) return existing;
  }

  let finalId;
  if (id) {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO leaderboard_snapshots (id, snapshot_date, snapshot_time, snapshot_type, created_at, created_at_ts, total_players, players_data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, snapshotDate, snapshotTime, snapshotType, createdAt, createdAtTs, players.length, playersJson);
    finalId = id;
  } else {
    const stmt = db.prepare(`
      INSERT INTO leaderboard_snapshots (snapshot_date, snapshot_time, snapshot_type, created_at, created_at_ts, total_players, players_data)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const res = stmt.run(snapshotDate, snapshotTime, snapshotType, createdAt, createdAtTs, players.length, playersJson);
    finalId = Number(res.lastInsertRowid);
  }

  if (players.length > 0) {
    const insertEntry = db.prepare(`
      INSERT INTO leaderboard_snapshot_entries (snapshot_id, rank, telegram_id, first_name, username, max_level, stars)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const p of players) {
      insertEntry.run(
        finalId,
        p.rank || 1,
        String(p.telegram_id || p.telegramId || ''),
        p.name || p.first_name || p.firstName || 'Игрок',
        p.username || '',
        Number(p.level !== undefined ? p.level : (p.max_level || p.maxLevel || 0)),
        Number(p.stars || 0)
      );
    }
  }

  return {
    id: finalId,
    snapshot_date: snapshotDate,
    snapshot_time: snapshotTime,
    snapshot_type: snapshotType,
    created_at: createdAt,
    created_at_ts: createdAtTs,
    total_players: players.length,
    players
  };
}

/**
 * Delete a leaderboard snapshot and its entries everywhere
 */
function deleteLeaderboardSnapshot(snapshotId) {
  try {
    const id = Number(snapshotId);
    if (!id) return false;

    // Record tombstone in SQLite so it can NEVER be re-seeded or resurrected
    try {
      db.prepare(`INSERT OR IGNORE INTO leaderboard_deleted_snapshots (id) VALUES (?)`).run(String(id));
    } catch (e) {}

    db.prepare(`DELETE FROM leaderboard_snapshot_entries WHERE snapshot_id = ?`).run(id);
    const res = db.prepare(`DELETE FROM leaderboard_snapshots WHERE id = ?`).run(id);

    if (typeof fetch !== 'undefined') {
      (async () => {
        try {
          const bucket = process.env.KVDB_BUCKET || '82kzJTUxZwwFNvg7kUSqgM';
          const baseUrl = 'https://kvdb.io/' + bucket;
          // 1. Delete full snapshot key from KVDB
          await fetch(`${baseUrl}/leaderboard_snapshot_${id}`, { method: 'DELETE' });
          // 2. Remove from meta_leaderboard_snapshots_index
          const idxRes = await fetch(`${baseUrl}/meta_leaderboard_snapshots_index?_cb=${Date.now()}`);
          if (idxRes.ok) {
            const idx = await idxRes.json();
            if (Array.isArray(idx)) {
              const filtered = idx.filter(x => String(x.id) !== String(id));
              await fetch(`${baseUrl}/meta_leaderboard_snapshots_index`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(filtered)
              });
            }
          }
          // 3. Register in meta_leaderboard_deleted_snapshots tombstone list
          const delRes = await fetch(`${baseUrl}/meta_leaderboard_deleted_snapshots?_cb=${Date.now()}`);
          let delList = [];
          if (delRes.ok) {
            try { delList = await delRes.json(); } catch (e) {}
          }
          if (!Array.isArray(delList)) delList = [];
          if (!delList.includes(String(id))) {
            delList.push(String(id));
            await fetch(`${baseUrl}/meta_leaderboard_deleted_snapshots`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(delList)
            });
          }
        } catch (e) {}
      })();
    }

    return res.changes > 0;
  } catch (err) {
    console.error('[DB Delete Snapshot Error]', err);
    return false;
  }
}

function getDeletedSnapshotIds() {
  try {
    const rows = db.prepare(`SELECT id FROM leaderboard_deleted_snapshots`).all();
    return rows.map(r => String(r.id));
  } catch (e) {
    return [];
  }
}

/**
 * Restore a leaderboard snapshot as the active leaderboard:
 * 1. Resets all players NOT in the snapshot to max_level = 0, current_level = 1, stars = 0 (completely wiping them from active leaderboard).
 * 2. Updates/inserts all players IN the snapshot to their exact snapshot level, stars, and rank.
 * 3. Sets system_settings 'leaderboard_restored_at' and 'active_snapshot_id'.
 * 4. Synchronizes to KVDB cloud (meta_leaderboard_restored_at, meta_active_snapshot_id, and player_* keys).
 * 5. Preserves user TON balances, wallets, memo codes, and boosters untouched.
 */
async function restoreLeaderboardSnapshot(snapshotId) {
  if (!snapshotId) throw new Error('snapshotId is required');
  const idStr = String(snapshotId);

  // 1. Fetch snapshot from SQLite or KVDB
  let snapshot = getLeaderboardSnapshotById(idStr);
  if (!snapshot || !Array.isArray(snapshot.players) || snapshot.players.length === 0) {
    try {
      const bucket = process.env.KVDB_BUCKET || '82kzJTUxZwwFNvg7kUSqgM';
      const snapRes = await fetch(`https://kvdb.io/${bucket}/leaderboard_snapshot_${idStr}?_cb=${Date.now()}`);
      if (snapRes.ok) {
        const snapJson = await snapRes.json();
        if (snapJson && Array.isArray(snapJson.players) && snapJson.players.length > 0) {
          snapshot = insertExternalLeaderboardSnapshot(snapJson);
        }
      }
    } catch (e) {}
  }

  if (!snapshot || !Array.isArray(snapshot.players) || snapshot.players.length === 0) {
    throw new Error(`Снимок #${snapshotId} не найден или не содержит данных игроков.`);
  }

  const nowTs = Date.now();
  const snapPlayers = snapshot.players;
  const snapMap = new Map();

  for (const p of snapPlayers) {
    const tid = String(p.telegram_id || p.telegramId || '').trim();
    if (!tid) continue;
    const lvl = Number(p.level !== undefined ? p.level : (p.max_level || p.maxLevel || 1));
    const stars = Number(p.stars || 0);
    const name = p.name || p.first_name || p.firstName || 'Игрок';
    const username = p.username || '';
    const rank = Number(p.rank || 0);
    snapMap.set(tid, { tid, lvl, stars, name, username, rank });
  }

  // 2. Transactional SQLite update
  db.exec('BEGIN TRANSACTION');
  try {
    // A. Total clean wipe: completely zero out all current levels, stars, and moves across all players
    db.prepare(`
      UPDATE users 
      SET max_level = 0, current_level = 1, stars = 0, total_moves = 0, updated_at = datetime('now')
    `).run();

    // B. Set exact level and stars for snapshot players
    const updateUserStmt = db.prepare(`
      UPDATE users 
      SET max_level = ?, current_level = ?, stars = ?,
          first_name = COALESCE(NULLIF(?, ''), first_name),
          username = COALESCE(NULLIF(?, ''), username),
          updated_at = datetime('now')
      WHERE telegram_id = ?
    `);

    const insertUserStmt = db.prepare(`
      INSERT INTO users (telegram_id, first_name, username, max_level, current_level, stars)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const [tid, sp] of snapMap.entries()) {
      const existing = db.prepare(`SELECT telegram_id FROM users WHERE telegram_id = ?`).get(tid);
      if (existing) {
        updateUserStmt.run(sp.lvl, sp.lvl, sp.stars, sp.name, sp.username, tid);
      } else {
        insertUserStmt.run(tid, sp.name, sp.username, sp.lvl, sp.lvl, sp.stars);
      }
    }

    db.prepare(`
      INSERT INTO system_settings (key, value)
      VALUES ('leaderboard_restored_at', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `).run(String(nowTs));

    db.prepare(`
      INSERT INTO system_settings (key, value)
      VALUES ('active_snapshot_id', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `).run(idStr);

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  // 3. Synchronize to KVDB
  try {
    const bucket = process.env.KVDB_BUCKET || '82kzJTUxZwwFNvg7kUSqgM';
    const baseUrl = `https://kvdb.io/${bucket}`;

    const restoreMeta = {
      restoredAt: nowTs,
      snapshotId: idStr,
      snapshotDate: snapshot.snapshot_date,
      snapshotTime: snapshot.snapshot_time,
      totalPlayers: snapMap.size
    };

    await fetch(`${baseUrl}/meta_leaderboard_restored_at`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(restoreMeta)
    });

    await fetch(`${baseUrl}/meta_active_snapshot_id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(idStr)
    });

    const cloudRes = await fetch(`${baseUrl}/?prefix=player_&values=true&format=json&_cb=${nowTs}`);
    let existingPairs = [];
    if (cloudRes.ok) {
      try { existingPairs = await cloudRes.json(); } catch (e) {}
    }

    const seenTids = new Set();
    for (const [key, rawVal] of existingPairs) {
      let val = rawVal;
      if (typeof val === 'string') {
        try { val = JSON.parse(val); } catch (e) { val = null; }
      }
      if (!val || !val.telegramId) continue;
      const tid = String(val.telegramId).trim();
      seenTids.add(tid);

      if (snapMap.has(tid)) {
        const sp = snapMap.get(tid);
        const updatedPayload = {
          ...val,
          telegramId: tid,
          firstName: val.firstName || sp.name,
          username: val.username || sp.username,
          maxLevel: sp.lvl,
          max_level: sp.lvl,
          level: sp.lvl,
          currentLevel: sp.lvl,
          current_level: sp.lvl,
          stars: sp.stars,
          snapshotRestoredAt: nowTs,
          updatedAt: nowTs
        };
        await fetch(`${baseUrl}/player_${encodeURIComponent(tid)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedPayload)
        });
      } else {
        const resetPayload = {
          ...val,
          telegramId: tid,
          maxLevel: 0,
          max_level: 0,
          level: 0,
          currentLevel: 1,
          current_level: 1,
          stars: 0,
          snapshotRestoredAt: nowTs,
          updatedAt: nowTs
        };
        await fetch(`${baseUrl}/player_${encodeURIComponent(tid)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(resetPayload)
        });
      }
    }

    for (const [tid, sp] of snapMap.entries()) {
      if (!seenTids.has(tid)) {
        const newPlayerPayload = {
          telegramId: tid,
          firstName: sp.name,
          username: sp.username,
          maxLevel: sp.lvl,
          max_level: sp.lvl,
          level: sp.lvl,
          currentLevel: sp.lvl,
          current_level: sp.lvl,
          stars: sp.stars,
          snapshotRestoredAt: nowTs,
          updatedAt: nowTs
        };
        await fetch(`${baseUrl}/player_${encodeURIComponent(tid)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newPlayerPayload)
        });
      }
    }

    try {
      await fetch(`${baseUrl}/meta_active_snapshot_players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Array.from(snapMap.values()))
      });
    } catch(e) {}
  } catch (kvErr) {
    console.warn('[DB Restore Snapshot] KVDB sync error:', kvErr.message);
  }

  return {
    success: true,
    snapshotId: idStr,
    restoredAt: nowTs,
    date: snapshot.snapshot_date,
    time: snapshot.snapshot_time,
    totalPlayers: snapMap.size
  };
}

function getLeaderboardRestoredTimestamp() {
  try {
    const row = db.prepare(`SELECT value FROM system_settings WHERE key = 'leaderboard_restored_at'`).get();
    return row ? Number(row.value) : 0;
  } catch (e) {
    return 0;
  }
}

function getActiveSnapshotId() {
  try {
    const row = db.prepare(`SELECT value FROM system_settings WHERE key = 'active_snapshot_id'`).get();
    return row ? String(row.value) : '';
  } catch (e) {
    return '';
  }
}

/**
 * Seed historical snapshots for 2026-09-04 (85 players), 2026-09-06 (15 players),
 * 2026-09-10 (110 players), and 2026-09-15 (140 players) at 23:55 Kyiv time
 */
function ensureSeedLeaderboardSnapshot() {
  try {
    db.prepare(`UPDATE leaderboard_snapshots SET snapshot_time = '23:55:00' WHERE snapshot_time = '00:00:00'`).run();
  } catch (e) {}

  // Guard: if seed was already run once, NEVER re-seed deleted snapshots!
  try {
    const initialized = db.prepare(`SELECT value FROM system_settings WHERE key = 'leaderboard_seed_initialized'`).get();
    if (initialized && initialized.value === 'true') {
      return;
    }
  } catch (e) {}

  const seedConfigs = [
    { id: 1, date: '2026-07-10', time: '12:00:00', type: 'manual', count: 85, maxLvl: 30, ts: 1783587600000 },
    { id: 2, date: '2026-07-10', time: '23:55:00', type: 'auto', count: 90, maxLvl: 35, ts: 1783630500000 },
    { id: 3, date: '2026-07-11', time: '23:55:00', type: 'auto', count: 94, maxLvl: 38, ts: 1783716900000 },
    { id: 4, date: '2026-09-04', time: '23:55:00', type: 'auto', count: 85, maxLvl: 40, ts: 1788470100000 },
    { id: 5, date: '2026-09-06', time: '23:55:00', type: 'auto', count: 15, maxLvl: 45, ts: 1788642900000 },
    { id: 6, date: '2026-09-10', time: '23:55:00', type: 'auto', count: 110, maxLvl: 48, ts: 1788988500000 }
  ];

  const firstNames = ['Alligator', 'Александр', 'Мария', 'Дмитрий', 'Елена', 'Сергей', 'Анна', 'Максим', 'Ольга', 'Богдан', 'Катерина', 'Владимир', 'Татьяна', 'Денис', 'Игорь', 'Наталья', 'Виктор', 'Юлия', 'Артем', 'Светлана', 'Роман', 'Алина', 'Павел', 'Виктория', 'Михаил'];

  for (const cfg of seedConfigs) {
    try {
      if (cfg.id) {
        const isDel = db.prepare(`SELECT id FROM leaderboard_deleted_snapshots WHERE id = ?`).get(String(cfg.id));
        if (isDel) continue;
      }
      const checkStmt = db.prepare(`SELECT id FROM leaderboard_snapshots WHERE snapshot_date = ? AND snapshot_time = ? LIMIT 1`);
      if (checkStmt.get(cfg.date, cfg.time)) continue; // Already exists

      const players = [];
      let currentLevel = cfg.maxLvl;

      for (let i = 1; i <= cfg.count; i++) {
        if (i > 1 && i % 2 === 0 && currentLevel > 2) {
          currentLevel = Math.max(1, currentLevel - Math.floor((cfg.maxLvl / cfg.count) * 1.5 || 1));
        }
        const name = i === 1 ? 'Alligator' : firstNames[(i - 1) % firstNames.length] + (i > firstNames.length ? ` #${i}` : '');
        const uname = i === 1 ? 'alligator' : (i % 3 === 0 ? '' : `player_${i}`);
        const tid = i === 1 ? '5761685341' : String(5800000000 + i * 137);
        players.push({
          rank: i,
          telegram_id: tid,
          name,
          username: uname,
          level: currentLevel,
          stars: currentLevel * 3
        });
      }

      const insertSnapStmt = db.prepare(`
        INSERT INTO leaderboard_snapshots (snapshot_date, snapshot_time, snapshot_type, created_at, created_at_ts, total_players, players_data)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const snapRes = insertSnapStmt.run(cfg.date, cfg.time, cfg.type, `${cfg.date} ${cfg.time}`, cfg.ts, players.length, JSON.stringify(players));
      const snapId = Number(snapRes.lastInsertRowid);

      const insertEntryStmt = db.prepare(`
        INSERT INTO leaderboard_snapshot_entries (snapshot_id, rank, telegram_id, first_name, username, max_level, stars)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const sp of players) {
        insertEntryStmt.run(snapId, sp.rank, sp.telegram_id, sp.name, sp.username, sp.level, sp.stars);
      }
      console.log(`[DB Snapshot] Seeded historical snapshot for ${cfg.date} — ${cfg.time} [${cfg.type}] with ${players.length} players.`);
    } catch (err) {
      console.warn(`[DB Snapshot] Failed to seed ${cfg.date} snapshot:`, err.message);
    }
  }

  try {
    db.prepare(`
      INSERT INTO system_settings (key, value)
      VALUES ('leaderboard_seed_initialized', 'true')
      ON CONFLICT(key) DO UPDATE SET value = 'true', updated_at = CURRENT_TIMESTAMP
    `).run();
  } catch (e) {}
}

function ensureActiveSnapshotApplied() {
  try {
    let activeId = getActiveSnapshotId();
    if (!activeId) {
      const realSnap = db.prepare(`SELECT id FROM leaderboard_snapshots WHERE id = '1791149202825' OR id > 1000000000 ORDER BY created_at_ts DESC, id DESC LIMIT 1`).get();
      if (realSnap && realSnap.id) {
        activeId = String(realSnap.id);
        db.prepare(`
          INSERT INTO system_settings (key, value)
          VALUES ('active_snapshot_id', ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
        `).run(activeId);
      }
    }
    if (!activeId) return;
    const snap = getLeaderboardSnapshotById(activeId);
    if (!snap || !snap.players || snap.players.length === 0) return;

    const uCount = db.prepare(`SELECT COUNT(*) as c FROM users WHERE max_level >= 1`).get();
    if (uCount && uCount.c <= 1) {
      db.prepare(`UPDATE users SET max_level = 0, current_level = 1, stars = 0, total_moves = 0, updated_at = datetime('now')`).run();
      const updateUserStmt = db.prepare(`
        UPDATE users 
        SET max_level = MAX(users.max_level, ?), current_level = MAX(users.current_level, ?), stars = MAX(users.stars, ?),
            first_name = COALESCE(NULLIF(?, ''), first_name),
            username = COALESCE(NULLIF(?, ''), username),
            updated_at = datetime('now')
        WHERE telegram_id = ?
      `);
      const insertUserStmt = db.prepare(`
        INSERT INTO users (telegram_id, first_name, username, max_level, current_level, stars)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const sp of snap.players) {
        const tid = String(sp.telegramId || sp.telegram_id || '').trim();
        if (!tid) continue;
        const lvl = Number(sp.level !== undefined ? sp.level : (sp.max_level || 1));
        const stars = Number(sp.stars || 0);
        const name = sp.name || sp.first_name || 'Игрок';
        const uname = sp.username || '';
        const base = IMMUTABLE_PLAYER_BASELINES[tid];
        const finalLvl = Math.max(lvl, base ? base.maxLevel : 0);
        const finalStars = Math.max(stars, base ? base.stars : 0);
        const existing = db.prepare(`SELECT telegram_id FROM users WHERE telegram_id = ?`).get(tid);
        if (existing) {
          updateUserStmt.run(finalLvl, finalLvl, finalStars, name, uname, tid);
        } else {
          insertUserStmt.run(tid, name, uname, finalLvl, finalLvl, finalStars);
        }
      }
      ensureImmutablePlayerBaselines();
    }
  } catch (e) {}
}

function sendGift(giftData) {
  const senderId = String(giftData.fromId || giftData.senderId || giftData.sender_id || '');
  const recipientId = String(giftData.recipientId || giftData.targetId || giftData.recipient_id || '');
  const giftType = String(giftData.giftType || giftData.gift_type || '').toLowerCase();
  const amount = Number(giftData.amount || 1);

  if (!senderId || !recipientId || amount <= 0) return { success: false, error: 'Неверные данные подарка' };

  const isAdmin = senderId === '5761685341';
  if (!isAdmin) {
    // Check sender has enough boosters/balance
    const sender = getUser(senderId);
    if (!sender) return { success: false, error: 'Отправитель не найден' };

    let boosterCol = null;
    if (giftType === 'hints') boosterCol = 'hints';
    else if (giftType === 'undos') boosterCol = 'undos';
    else if (giftType === 'reveals') boosterCol = 'reveals';
    else if (giftType === 'extrabottles' || giftType === 'extra_bottles') boosterCol = 'extra_bottles';
    else if (giftType === 'ton' || giftType === 'gram') {
      return { success: false, error: 'Только администратор может дарить TON/GRAM' };
    }

    if (boosterCol) {
      const currentBal = Number(sender[boosterCol] || 0);
      if (currentBal < amount) {
        return { success: false, error: 'Недостаточно предметов для подарка' };
      }
      db.prepare(`UPDATE users SET ${boosterCol} = ${boosterCol} - ?, updated_at = datetime('now') WHERE telegram_id = ?`).run(amount, senderId);
    }
  }

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO player_gifts 
    (id, sender_id, sender_name, sender_username, recipient_id, gift_type, gift_name, gift_icon, amount, created_at, claimed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    String(giftData.id || ('gift_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8))),
    senderId,
    String(giftData.fromName || giftData.senderName || giftData.sender_name || ''),
    String(giftData.fromUsername || giftData.senderUsername || giftData.sender_username || ''),
    recipientId,
    giftType,
    String(giftData.giftName || giftData.gift_name || ''),
    String(giftData.giftIcon || giftData.gift_icon || '🎁'),
    amount,
    Number(giftData.createdAt || giftData.created_at || Date.now()),
    giftData.claimed ? 1 : 0
  );
  return { success: true };
}

function getInboxGifts(recipientId) {
  const stmt = db.prepare(`
    SELECT id, sender_id as fromId, sender_name as fromName, sender_username as senderUsername,
           recipient_id as recipientId, gift_type as giftType, gift_name as giftName, gift_icon as giftIcon,
           amount, created_at as createdAt, claimed, claimed_at as claimedAt
    FROM player_gifts
    WHERE recipient_id = ?
    ORDER BY created_at DESC
  `);
  const rows = stmt.all(String(recipientId));
  return rows.map(r => ({
    ...r,
    fromUsername: r.senderUsername || '',
    claimed: Boolean(r.claimed)
  }));
}

function claimGift(giftId, recipientId) {
  try {
    const gift = db.prepare(`SELECT * FROM player_gifts WHERE id = ? AND recipient_id = ?`).get(String(giftId), String(recipientId));
    const stmt = db.prepare(`
      UPDATE player_gifts
      SET claimed = 1, claimed_at = ?
      WHERE id = ? AND recipient_id = ?
    `);
    stmt.run(Date.now(), String(giftId), String(recipientId));

    if (gift) {
      const type = String(gift.gift_type || '').toLowerCase();
      const amount = Number(gift.amount || 1);
      if (type === 'ton' || type === 'gram' || type === 'ton_balance') {
        db.prepare(`
          UPDATE users
          SET ton_balance = COALESCE(ton_balance, 0) + ?,
              updated_at = datetime('now')
          WHERE telegram_id = ?
        `).run(amount, String(recipientId));
      } else if (type === 'undos') {
        db.prepare(`UPDATE users SET undos = COALESCE(undos, 0) + ?, updated_at = datetime('now') WHERE telegram_id = ?`).run(amount, String(recipientId));
      } else if (type === 'hints') {
        db.prepare(`UPDATE users SET hints = COALESCE(hints, 0) + ?, updated_at = datetime('now') WHERE telegram_id = ?`).run(amount, String(recipientId));
      } else if (type === 'reveals') {
        db.prepare(`UPDATE users SET reveals = COALESCE(reveals, 0) + ?, updated_at = datetime('now') WHERE telegram_id = ?`).run(amount, String(recipientId));
      } else if (type === 'extrabottles' || type === 'extra_bottles') {
        db.prepare(`UPDATE users SET extra_bottles = COALESCE(extra_bottles, 0) + ?, updated_at = datetime('now') WHERE telegram_id = ?`).run(amount, String(recipientId));
      }
    }
    return true;
  } catch (err) {
    console.error('[DB Claim Gift Error]', err);
    return false;
  }
}

module.exports = {
  db,
  prepare: (sql) => db.prepare(sql),
  exec: (sql) => db.exec(sql),
  getUser,
  getUserByUsername,
  updateUserProgress,
  getLeaderboard,
  logAdReward,
  getAdRewardsCount,
  checkAdRewardAllowed,
  resetSeason,
  getSeasonResetTimestamp,
  getPurchasesResetTimestamp,
  resetGramPurchases,
  resetGramPurchasesSingle,
  updateTonWallet,
  recordTonDeposit,
  buyShopItem,
  registerReferral,
  getReferrals,
  claimReferralReward,
  getKyivDateTime,
  saveLeaderboardSnapshot,
  deleteLeaderboardSnapshot,
  restoreLeaderboardSnapshot,
  getLeaderboardRestoredTimestamp,
  getActiveSnapshotId,
  getDeletedSnapshotIds,
  getLeaderboardSnapshotDates,
  getAutoLeaderboardSnapshotByDate,
  getLeaderboardSnapshotByDate,
  getLeaderboardSnapshotById,
  insertExternalLeaderboardSnapshot,
  ensureSeedLeaderboardSnapshot,
  getConnectedWallets,
  getPlayerDeposits,
  sendGift,
  getInboxGifts,
  claimGift,
  addBonus,
  setUserLevel,
  accrueDailyBoostersForUser,
  accrueDailyBoostersForAll,
  calculateDailyBoostersDaysLeft,
  getSystemSetting,
  setSystemSetting,
  getMaintenanceStatus,
  setMaintenanceStatus
};
