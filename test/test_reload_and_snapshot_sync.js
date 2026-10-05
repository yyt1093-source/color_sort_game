const assert = require('assert');
const db = require('../db');

console.log('================================================================');
console.log('🧪 TEST: Reload, Snapshot Sync, and Profile-to-Leaderboard Unity');
console.log('================================================================\n');

// 1. Verify Active Snapshot
const activeId = db.getActiveSnapshotId();
console.log('1. Active Snapshot ID:', activeId);
assert(activeId, 'Active snapshot ID must be set');

const snap = db.getLeaderboardSnapshotById(activeId);
assert(snap, 'Snapshot record must exist');
console.log(`   Snapshot Date: ${snap.snapshot_date} ${snap.snapshot_time}, Total players: ${snap.total_players}`);

// 2. Verify Maria in SQLite and Active Snapshot
const snapMaria = snap.players.find(p => String(p.telegramId || p.telegram_id) === '7116446051');
assert(snapMaria, 'Maria must exist in restored snapshot');
console.log('2. Maria in snapshot:', snapMaria.name, 'Level:', snapMaria.level, 'Rank:', snapMaria.rank);
assert.strictEqual(Number(snapMaria.level), 15, 'Maria level must be 15');

const dbMaria = db.getUser('7116446051');
assert(dbMaria, 'Maria must exist in database');
console.log('3. Maria in SQLite database: Name:', dbMaria.first_name, 'MaxLevel:', dbMaria.max_level, 'CurrentLevel:', dbMaria.current_level);
assert.strictEqual(Number(dbMaria.max_level), 15, 'Maria max_level must be 15 in database');
assert.strictEqual(Number(dbMaria.current_level), 15, 'Maria current_level must be 15 in database');

// 3. Verify Leaderboard Output for Maria
const lb = db.getLeaderboard('7116446051', 50);
console.log('4. Maria Leaderboard Rank:', lb.userRank ? lb.userRank.rank : 'N/A', 'Level:', lb.userRank ? lb.userRank.max_level : 'N/A');
assert(lb.userRank, 'Maria must have rank in leaderboard');
assert.strictEqual(Number(lb.userRank.max_level), 15, 'Maria leaderboard level must strictly be 15');
assert.strictEqual(Number(lb.userRank.rank), 10, 'Maria leaderboard rank must strictly be 10');

// 4. Verify Alligator and Top 3 Players
const alligator = lb.topPlayers.find(p => String(p.telegram_id) === '5761685341');
assert(alligator, 'Alligator must be in leaderboard');
assert.strictEqual(Number(alligator.max_level), 48, 'Alligator level must be 48');
console.log('5. Rank 1 Alligator Level:', alligator.max_level);

console.log('\n================================================================');
console.log('🎉 ALL RELOAD & SYNC INTEGRATION TESTS PASSED 100%!');
console.log('================================================================');
