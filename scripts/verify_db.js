const db = require('../db.js');

const init = db.prepare("SELECT value FROM system_settings WHERE key = 'leaderboard_seed_initialized'").get();
console.log('leaderboard_seed_initialized:', init);

const active = db.prepare("SELECT value FROM system_settings WHERE key = 'active_snapshot_id'").get();
console.log('active_snapshot_id:', active);

const restored = db.prepare("SELECT value FROM system_settings WHERE key = 'leaderboard_restored_at'").get();
console.log('leaderboard_restored_at:', restored);

const users = db.prepare("SELECT COUNT(*) as cnt FROM users WHERE max_level >= 1").get();
console.log('Active players in SQLite users table:', users.cnt);
