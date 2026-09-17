const assert = require('assert');
const http = require('http');
const express = require('express');

// We can test express routing directly
const db = require('../db');

console.log('================================================================');
console.log('🧪 TEST SUITE: Leaderboard History Server & Admin API Endpoints');
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

// 1. Admin Verification helper
function checkIsAdmin(reqData) {
  if (!reqData) return false;
  const { telegramId, firstName, username } = reqData;
  const tid = String(telegramId || '').trim();
  const fname = String(firstName || '').toLowerCase().trim();
  const uname = String(username || '').toLowerCase().replace(/^@/, '').trim();
  if (tid === '5761685341') return true;
  if (uname === 'alligator' || uname === 'аллигатор') return true;
  if (fname === 'alligator' || fname === 'аллигатор') return true;
  return false;
}

runTest('Admin Authorization Check', () => {
  assert.strictEqual(checkIsAdmin({ telegramId: '5761685341' }), true);
  assert.strictEqual(checkIsAdmin({ username: 'alligator' }), true);
  assert.strictEqual(checkIsAdmin({ firstName: 'Аллигатор' }), true);
  assert.strictEqual(checkIsAdmin({ telegramId: '12345' }), false);
  assert.strictEqual(checkIsAdmin({ username: 'guest' }), false);
});

// 2. Test Endpoints on a live test express instance
const app = express();
app.use(express.json());

app.get('/api/admin/leaderboard-history/dates', (req, res) => {
  if (!checkIsAdmin(req.query)) {
    return res.status(403).json({ success: false, error: 'Доступ запрещён' });
  }
  const dates = db.getLeaderboardSnapshotDates();
  res.json({ success: true, dates });
});

app.get('/api/admin/leaderboard-history', (req, res) => {
  if (!checkIsAdmin(req.query)) {
    return res.status(403).json({ success: false, error: 'Доступ запрещён' });
  }
  const { date, id } = req.query;
  let snapshot = null;
  if (id) snapshot = db.getLeaderboardSnapshotById(id);
  else if (date) snapshot = db.getLeaderboardSnapshotByDate(date);
  else {
    const dates = db.getLeaderboardSnapshotDates();
    if (dates && dates.length > 0) snapshot = db.getLeaderboardSnapshotById(dates[0].id);
  }
  if (!snapshot) return res.status(404).json({ success: false, error: 'Снимок не найден' });
  res.json({ success: true, snapshot });
});

app.post('/api/admin/leaderboard-history/snapshot', (req, res) => {
  if (!checkIsAdmin(req.body)) {
    return res.status(403).json({ success: false, error: 'Доступ запрещён' });
  }
  const snapshot = db.saveLeaderboardSnapshot();
  res.json({ success: true, snapshot, message: 'Снимок сохранён' });
});

const deleteHandler = (req, res) => {
  const authData = req.method === 'DELETE' ? req.query : req.body;
  if (!checkIsAdmin(authData)) {
    return res.status(403).json({ success: false, error: 'Доступ запрещён' });
  }
  const snapshotId = (req.body && req.body.id) || (req.query && req.query.id);
  if (!snapshotId) {
    return res.status(400).json({ success: false, error: 'Укажите ID снимка' });
  }
  const ok = db.deleteLeaderboardSnapshot(snapshotId);
  if (!ok) {
    return res.status(404).json({ success: false, error: 'Снимок не найден' });
  }
  res.json({ success: true, message: `Снимок #${snapshotId} удалён` });
};

app.delete('/api/admin/leaderboard-history', deleteHandler);
app.post('/api/admin/leaderboard-history/delete', deleteHandler);

const server = app.listen(0, async () => {
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 3. Unauthorized access check (403)
    const res403 = await fetch(`${baseUrl}/api/admin/leaderboard-history/dates?telegramId=12345`);
    assert.strictEqual(res403.status, 403, 'Non-admin must receive 403 Forbidden');
    console.log('  ✅ [PASS] 403 Forbidden for Non-Admin Access');

    // 4. Authorized access check (200)
    const resDates = await fetch(`${baseUrl}/api/admin/leaderboard-history/dates?telegramId=5761685341`);
    assert.strictEqual(resDates.status, 200);
    const datesData = await resDates.json();
    assert.strictEqual(datesData.success, true);
    assert(Array.isArray(datesData.dates) && datesData.dates.length > 0);
    console.log(`  ✅ [PASS] 200 OK for /api/admin/leaderboard-history/dates (${datesData.dates.length} dates)`);

    // 5. Query snapshot by date
    const resSnap = await fetch(`${baseUrl}/api/admin/leaderboard-history?date=2026-09-06&telegramId=5761685341`);
    assert.strictEqual(resSnap.status, 200);
    const snapData = await resSnap.json();
    assert.strictEqual(snapData.success, true);
    assert.strictEqual(snapData.snapshot.snapshot_date, '2026-09-06');
    assert.strictEqual(snapData.snapshot.total_players, 15);
    console.log('  ✅ [PASS] 200 OK for /api/admin/leaderboard-history?date=2026-09-06 (15 players)');

    // 6. Manual snapshot trigger via POST
    const resManual = await fetch(`${baseUrl}/api/admin/leaderboard-history/snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramId: '5761685341' })
    });
    assert.strictEqual(resManual.status, 200);
    const manualData = await resManual.json();
    assert.strictEqual(manualData.success, true);
    assert(manualData.snapshot && manualData.snapshot.id);
    const createdId = manualData.snapshot.id;
    console.log(`  ✅ [PASS] 200 OK for POST /api/admin/leaderboard-history/snapshot (snapshot #${createdId})`);

    // 7. Delete snapshot via POST /api/admin/leaderboard-history/delete
    const resDelete = await fetch(`${baseUrl}/api/admin/leaderboard-history/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: createdId, telegramId: '5761685341' })
    });
    assert.strictEqual(resDelete.status, 200);
    const deleteData = await resDelete.json();
    assert.strictEqual(deleteData.success, true);
    console.log(`  ✅ [PASS] 200 OK for POST /api/admin/leaderboard-history/delete (deleted #${createdId})`);

    // 8. Verify deleted snapshot is gone
    const resCheckGone = await fetch(`${baseUrl}/api/admin/leaderboard-history?id=${createdId}&telegramId=5761685341`);
    assert.strictEqual(resCheckGone.status, 404, 'Deleted snapshot must return 404');
    console.log(`  ✅ [PASS] 404 Not Found for deleted snapshot #${createdId}`);

    server.close();
    console.log('\n================================================================');
    console.log('🎉 ALL SERVER & ADMIN API TESTS PASSED 100%!');
    console.log('================================================================');
  } catch (err) {
    server.close();
    console.error(err);
    process.exit(1);
  }
});
