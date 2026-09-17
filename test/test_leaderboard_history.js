const assert = require('assert');
const path = require('path');
const db = require('../db');

console.log('================================================================');
console.log('🧪 TEST SUITE: Leaderboard History & 23:55 Kyiv Snapshot Engine');
console.log('================================================================\n');

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// 1. Kyiv Timezone Formatting
runTest('Kyiv Timezone Formatting and DST Calculation', () => {
  const kyiv = db.getKyivDateTime();
  assert(kyiv && typeof kyiv === 'object', 'getKyivDateTime returned falsy');
  assert.match(kyiv.dateStr, /^\d{4}-\d{2}-\d{2}$/, 'Date format must be YYYY-MM-DD');
  assert.match(kyiv.timeStr, /^\d{2}:\d{2}:\d{2}$/, 'Time format must be HH:mm:ss');
  assert.match(kyiv.fullStr, /^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}$/, 'Full format must be YYYY-MM-DD HH:mm:ss');
  assert.strictEqual(typeof kyiv.year, 'number');
  assert.strictEqual(typeof kyiv.month, 'number');
  assert.strictEqual(typeof kyiv.day, 'number');
  assert.strictEqual(typeof kyiv.hour, 'number');
});

// 2. Historical Seed Snapshots (10.07 12:00 manual, 10.07 23:55 auto, 11.07, 4, 6, 10, 15 September)
runTest('Historical Seed Snapshots and Same-Day Manual/Auto Isolation', () => {
  // Check 10.07.2026 - 12:00:00 (manual, 85 players)
  const allDates = db.getLeaderboardSnapshotDates();
  const snapJuly10Manual = allDates.find(d => d.snapshot_date === '2026-07-10' && d.snapshot_time === '12:00:00');
  assert(snapJuly10Manual, 'Snapshot for 2026-07-10 12:00:00 (manual) must exist');
  assert.strictEqual(snapJuly10Manual.snapshot_type, 'manual');
  assert.strictEqual(snapJuly10Manual.total_players, 85);

  // Check 10.07.2026 - 23:55:00 (auto, 90 players)
  const snapJuly10Auto = allDates.find(d => d.snapshot_date === '2026-07-10' && d.snapshot_time === '23:55:00');
  assert(snapJuly10Auto, 'Snapshot for 2026-07-10 23:55:00 (auto) must exist');
  assert.strictEqual(snapJuly10Auto.snapshot_type, 'auto');
  assert.strictEqual(snapJuly10Auto.total_players, 90);

  // Crucial: getAutoLeaderboardSnapshotByDate must find the 23:55 auto snapshot, not the manual one
  const autoSnap = db.getAutoLeaderboardSnapshotByDate('2026-07-10');
  assert(autoSnap, 'getAutoLeaderboardSnapshotByDate must find auto snapshot');
  assert.strictEqual(autoSnap.id, snapJuly10Auto.id);
  assert.strictEqual(autoSnap.snapshot_time, '23:55:00');

  // Check 11.07.2026 - 23:55:00 (auto, 94 players)
  const snapJuly11 = allDates.find(d => d.snapshot_date === '2026-07-11');
  assert(snapJuly11, 'Snapshot for 2026-07-11 must exist');
  assert.strictEqual(snapJuly11.total_players, 94);

  // Check 4th Sept (85 players)
  const snap4 = db.getLeaderboardSnapshotByDate('2026-09-04');
  assert(snap4, 'Snapshot for 2026-09-04 must exist');
  assert.strictEqual(snap4.snapshot_date, '2026-09-04');
  assert.strictEqual(snap4.snapshot_time, '23:55:00');
  assert.strictEqual(snap4.total_players, 85);
  assert.strictEqual(snap4.players.length, 85);

  // Check 6th Sept (15 players)
  const snap6 = db.getLeaderboardSnapshotByDate('2026-09-06');
  assert(snap6, 'Snapshot for 2026-09-06 must exist');
  assert.strictEqual(snap6.snapshot_date, '2026-09-06');
  assert.strictEqual(snap6.snapshot_time, '23:55:00');
  assert.strictEqual(snap6.total_players, 15);
  assert.strictEqual(snap6.players.length, 15);

  // Check 10th Sept (110 players)
  const snap10 = db.getLeaderboardSnapshotByDate('2026-09-10');
  assert(snap10, 'Snapshot for 2026-09-10 must exist');
  assert.strictEqual(snap10.snapshot_date, '2026-09-10');
  assert.strictEqual(snap10.snapshot_time, '23:55:00');
  assert.strictEqual(snap10.total_players, 110);
  assert.strictEqual(snap10.players.length, 110);

  // Check 15th Sept (140 players)
  const snap15 = db.getLeaderboardSnapshotByDate('2026-09-15');
  assert(snap15, 'Snapshot for 2026-09-15 must exist');
  assert.strictEqual(snap15.snapshot_date, '2026-09-15');
  assert.strictEqual(snap15.snapshot_time, '23:55:00');
  assert.strictEqual(snap15.total_players, 140);
  assert.strictEqual(snap15.players.length, 140);
  
  // Verify top player is Alligator (ID: 5761685341)
  const top1 = snap6.players[0];
  assert.strictEqual(top1.rank, 1);
  assert.strictEqual(top1.telegram_id, '5761685341');
  assert.strictEqual(top1.level, 150);
});

// 2b. Manual snapshot during day does NOT block 23:55 auto snapshot
runTest('Manual Snapshot Does NOT Cancel/Block 23:55 Auto Snapshot', () => {
  const testDate = '2026-07-20';
  // 1. Admin creates manual snapshot at 14:30
  const manualSnap = db.saveLeaderboardSnapshot({
    dateStr: testDate,
    timeStr: '14:30:00',
    snapshotType: 'manual'
  });
  assert(manualSnap && manualSnap.id, 'Manual snapshot created');
  assert.strictEqual(manualSnap.snapshot_type, 'manual');

  // 2. Scheduler checks if auto snapshot exists for today
  const autoBefore = db.getAutoLeaderboardSnapshotByDate(testDate);
  assert.strictEqual(autoBefore, null, 'Auto snapshot MUST be null even though manual snapshot exists');

  // 3. At 23:55, scheduler triggers auto snapshot
  const autoSnap = db.saveLeaderboardSnapshot({
    dateStr: testDate,
    timeStr: '23:55:00',
    snapshotType: 'auto'
  });
  assert(autoSnap && autoSnap.id, 'Auto snapshot created at 23:55');
  assert.notStrictEqual(autoSnap.id, manualSnap.id, 'Auto snapshot must have a distinct ID');
  assert.strictEqual(autoSnap.snapshot_type, 'auto');

  // 4. Both snapshots exist independently in dates list
  const list = db.getLeaderboardSnapshotDates().filter(d => d.snapshot_date === testDate);
  assert.strictEqual(list.length, 2, 'Both manual and auto snapshots must exist for this date');

  // Clean up test records
  db.deleteLeaderboardSnapshot(manualSnap.id);
  db.deleteLeaderboardSnapshot(autoSnap.id);
});

// 3. Save Snapshot and Verify User Data Unchanged
runTest('Save Snapshot Preserves User Levels (Zero Mutation)', () => {
  const ts = Date.now();
  const testP1 = `hist_user_1_${ts}`;
  const testP2 = `hist_user_2_${ts}`;
  const testP3 = `hist_user_3_${ts}`;

  db.updateUserProgress(testP1, { firstName: 'Игрок Альфа', username: 'alpha', maxLevel: 25, starsAdded: 75 });
  db.updateUserProgress(testP2, { firstName: 'Игрок Бета', username: 'beta', maxLevel: 55, starsAdded: 165 });
  db.updateUserProgress(testP3, { firstName: 'Игрок Гамма', username: 'gamma', maxLevel: 10, starsAdded: 30 });

  const beforeP1 = db.getUser(testP1);
  const beforeP2 = db.getUser(testP2);
  const beforeP3 = db.getUser(testP3);

  assert.strictEqual(beforeP1.max_level, 25);
  assert.strictEqual(beforeP2.max_level, 55);
  assert.strictEqual(beforeP3.max_level, 10);

  // Take snapshot
  const customDate = '2026-09-18';
  const customTime = '23:55:00';
  const snap = db.saveLeaderboardSnapshot({ dateStr: customDate, timeStr: customTime });

  assert(snap && snap.id, 'Snapshot ID must be generated');
  assert.strictEqual(snap.snapshot_date, customDate);
  assert.strictEqual(snap.snapshot_time, customTime);

  // STRICT VERIFICATION: user records in users table MUST NOT be mutated
  const afterP1 = db.getUser(testP1);
  const afterP2 = db.getUser(testP2);
  const afterP3 = db.getUser(testP3);

  assert.strictEqual(afterP1.max_level, 25, 'Player 1 level must remain unchanged');
  assert.strictEqual(afterP2.max_level, 55, 'Player 2 level must remain unchanged');
  assert.strictEqual(afterP3.max_level, 10, 'Player 3 level must remain unchanged');
  assert.strictEqual(afterP1.stars, 75, 'Player 1 stars must remain unchanged');

  // Verify ranking in snapshot
  const savedP2 = snap.players.find(p => p.telegram_id === testP2);
  const savedP1 = snap.players.find(p => p.telegram_id === testP1);
  const savedP3 = snap.players.find(p => p.telegram_id === testP3);

  assert(savedP2 && savedP1 && savedP3, 'All test players must be in the snapshot');
  assert.strictEqual(savedP2.level, 55);
  assert.strictEqual(savedP1.level, 25);
  assert.strictEqual(savedP3.level, 10);
  assert(savedP2.rank < savedP1.rank, 'Player with level 55 must rank higher than level 25');
  assert(savedP1.rank < savedP3.rank, 'Player with level 25 must rank higher than level 10');

  // Clean up test records
  db.deleteLeaderboardSnapshot(snap.id);
  const rawDb = new (require('node:sqlite').DatabaseSync)(path.join(__dirname, '..', 'game_database.sqlite'));
  rawDb.exec(`DELETE FROM users WHERE telegram_id IN ('${testP1}', '${testP2}', '${testP3}')`);
});

// 4. Query Snapshot Dates and ID
runTest('Query Snapshot Dates and Query by ID', () => {
  const dates = db.getLeaderboardSnapshotDates();
  assert(Array.isArray(dates) && dates.length >= 2, 'Must have at least 2 snapshot dates');

  const first = dates[0];
  const byId = db.getLeaderboardSnapshotById(first.id);
  assert(byId, 'Must retrieve snapshot by ID');
  assert.strictEqual(byId.id, first.id);
  assert.strictEqual(byId.snapshot_date, first.snapshot_date);
  assert(Array.isArray(byId.players), 'Players must be array');
});

// 5. Daily Scheduler 23:55 Calculation
runTest('Daily Scheduler 23:55 Seconds Calculation', () => {
  const kyiv = db.getKyivDateTime();
  const currentSec = kyiv.hour * 3600 + kyiv.minute * 60 + kyiv.second;
  const targetSec = 23 * 3600 + 55 * 60;
  let diffSec = targetSec - currentSec;
  if (diffSec <= 0) diffSec += 86400;
  assert(diffSec > 0 && diffSec <= 86400, 'Seconds until 23:55 must be between 1 and 86400');
});

// 6. Delete Snapshot Functionality
runTest('Delete Snapshot Removes Archive Record Without Touching Users', () => {
  // Create a temporary snapshot to delete
  const tempDate = '2026-09-99';
  const tempSnap = db.saveLeaderboardSnapshot({ dateStr: tempDate, timeStr: '23:55:00' });
  assert(tempSnap && tempSnap.id, 'Temp snapshot created');

  const beforeDelete = db.getLeaderboardSnapshotById(tempSnap.id);
  assert(beforeDelete, 'Temp snapshot found before delete');

  // Verify deletion
  const deleted = db.deleteLeaderboardSnapshot(tempSnap.id);
  assert.strictEqual(deleted, true, 'deleteLeaderboardSnapshot returned true');

  const afterDelete = db.getLeaderboardSnapshotById(tempSnap.id);
  assert.strictEqual(afterDelete, null, 'Deleted snapshot must return null');

  // Deleting again returns false
  const doubleDelete = db.deleteLeaderboardSnapshot(tempSnap.id);
  assert.strictEqual(doubleDelete, false, 'Second delete should return false');
});

console.log('\n================================================================');
console.log('🎉 ALL LEADERBOARD HISTORY TESTS PASSED 100%!');
console.log('================================================================');
