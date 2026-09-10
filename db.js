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

    CREATE INDEX IF NOT EXISTS idx_leaderboard ON users(max_level DESC, stars DESC);
  `);
  
  // Try to add total_moves, reveals and shuffles if they don't exist (for existing databases)
  try {
    db.exec(`ALTER TABLE users ADD COLUMN total_moves INTEGER DEFAULT 0;`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN reveals INTEGER DEFAULT 0;`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN shuffles INTEGER DEFAULT 0;`);
  } catch (e) {}
  try {
    db.exec(`UPDATE users SET hints = 0, undos = 0, reveals = 0, shuffles = 0;`);
  } catch (e) {}
}

initDatabase();

/**
 * Get or create user by Telegram ID
 */
function getUser(telegramId, defaultUserData = {}) {
  const stmt = db.prepare('SELECT * FROM users WHERE telegram_id = ?');
  const user = stmt.get(String(telegramId));
  
  if (user) {
    if (defaultUserData.first_name || defaultUserData.username || defaultUserData.photo_url) {
      const updateStmt = db.prepare(`
        UPDATE users 
        SET first_name = COALESCE(?, first_name),
            username = COALESCE(?, username),
            photo_url = COALESCE(?, photo_url),
            updated_at = datetime('now')
        WHERE telegram_id = ?
      `);
      updateStmt.run(
        defaultUserData.first_name || null,
        defaultUserData.username || null,
        defaultUserData.photo_url || null,
        String(telegramId)
      );
      return stmt.get(String(telegramId));
    }
    return user;
  }

  const insertStmt = db.prepare(`
    INSERT INTO users (telegram_id, first_name, username, photo_url, max_level, current_level, stars, coins, hints, undos, reveals, shuffles, total_moves)
    VALUES (?, ?, ?, ?, 1, 1, 0, 100, 0, 0, 0, 0, 0)
  `);
  
  insertStmt.run(
    String(telegramId),
    defaultUserData.first_name || 'Player',
    defaultUserData.username || '',
    defaultUserData.photo_url || ''
  );

  return stmt.get(String(telegramId));
}

/**
 * Update user game progress
 */
function updateUserProgress(telegramId, { currentLevel, maxLevel, starsAdded, coinsAdded, hintsUsed = 0, undosUsed = 0, revealsUsed = 0, shufflesUsed = 0, totalMoves = 0, firstName, username, photoUrl }) {
  const user = getUser(telegramId, { first_name: firstName, username, photo_url: photoUrl });
  if (!user) return null;

  const newMaxLevel = Math.max(user.max_level, maxLevel || currentLevel || user.max_level);
  const newCurrentLevel = currentLevel || user.current_level;
  const newStars = user.stars + (starsAdded || 0);
  const newCoins = Math.max(0, user.coins + (coinsAdded || 0));
  const newHints = Math.max(0, user.hints - hintsUsed);
  const newUndos = Math.max(0, user.undos - undosUsed);
  const newReveals = Math.max(0, (user.reveals || 0) - revealsUsed);
  const newShuffles = Math.max(0, (user.shuffles || 0) - shufflesUsed);
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
        shuffles = ?,
        total_moves = ?,
        first_name = COALESCE(?, first_name),
        username = COALESCE(?, username),
        photo_url = COALESCE(?, photo_url),
        updated_at = datetime('now')
    WHERE telegram_id = ?
  `);

  stmt.run(newCurrentLevel, newMaxLevel, newStars, newCoins, newHints, newUndos, newReveals, newShuffles, newTotalMoves, firstName || null, username || null, photoUrl || null, String(telegramId));
  return getUser(telegramId);
}

/**
 * Add items / bonus rewards to user
 */
function addBonus(telegramId, { coins = 0, hints = 0, undos = 0, reveals = 0, shuffles = 0 }) {
  const user = getUser(telegramId);
  if (!user) return null;

  const stmt = db.prepare(`
    UPDATE users
    SET coins = coins + ?,
        hints = hints + ?,
        undos = undos + ?,
        reveals = COALESCE(reveals, 0) + ?,
        shuffles = COALESCE(shuffles, 0) + ?,
        updated_at = datetime('now')
    WHERE telegram_id = ?
  `);

  stmt.run(coins, hints, undos, reveals, shuffles, String(telegramId));
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

  let bonus = { coins: 0, hints: 0, undos: 0, reveals: 0, shuffles: 0 };
  if (rewardType === 'hints') bonus.hints = 1;
  else if (rewardType === 'undos') bonus.undos = 1;
  else if (rewardType === 'reveal_bottle' || rewardType === 'reveals') bonus.reveals = 1;
  else if (rewardType === 'shuffle_colors' || rewardType === 'shuffles') bonus.shuffles = 1;
  else if (rewardType === 'coins') bonus.coins = 150;
  else if (rewardType === 'extra_bottle') bonus.coins = 50;
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
  // Only real Telegram human players (strictly NO bots or guests)
  const topStmt = db.prepare(`
    SELECT telegram_id, first_name, username, photo_url, max_level, stars, total_moves
    FROM users
    WHERE telegram_id NOT LIKE 'guest%' AND telegram_id NOT LIKE 'dev%'
    ORDER BY max_level DESC, stars DESC
    LIMIT ?
  `);
  
  const topPlayers = topStmt.all(limit);

  let userRank = null;
  const isRealUser = telegramId && !String(telegramId).startsWith('guest') && !String(telegramId).startsWith('dev');
  if (isRealUser) {
    const user = getUser(telegramId);
    if (user) {
      const rankStmt = db.prepare(`
        SELECT COUNT(*) as rank
        FROM users
        WHERE (telegram_id NOT LIKE 'guest%' AND telegram_id NOT LIKE 'dev%')
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

function resetSeason() {
  try {
    db.exec('DELETE FROM users;');
    db.exec('DELETE FROM ad_rewards_log;');
    return { success: true };
  } catch (err) {
    console.error('[DB Reset Season Error]', err);
    return { success: false, error: err.message };
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
  resetSeason
};
