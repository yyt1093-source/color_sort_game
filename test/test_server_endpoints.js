const assert = require('assert');
const http = require('http');
const url = require('url');

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

// 2. Test Endpoints using native Node.js http server
const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;
  const query = parsed.query;

  const readBody = () => new Promise(resolve => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch (e) { resolve({}); }
    });
  });

  const sendJson = (status, data) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  };

  // GET /api/admin/leaderboard-history/dates
  if (req.method === 'GET' && pathname === '/api/admin/leaderboard-history/dates') {
    if (!checkIsAdmin(query)) {
      return sendJson(403, { success: false, error: 'Доступ запрещён' });
    }
    const dates = db.getLeaderboardSnapshotDates();
    return sendJson(200, { success: true, dates });
  }

  // GET /api/admin/leaderboard-history
  if (req.method === 'GET' && pathname === '/api/admin/leaderboard-history') {
    if (!checkIsAdmin(query)) {
      return sendJson(403, { success: false, error: 'Доступ запрещён' });
    }
    const { date, id } = query;
    let snapshot = null;
    if (id) snapshot = db.getLeaderboardSnapshotById(id);
    else if (date) snapshot = db.getLeaderboardSnapshotByDate(date);
    else {
      const dates = db.getLeaderboardSnapshotDates();
      if (dates && dates.length > 0) snapshot = db.getLeaderboardSnapshotById(dates[0].id);
    }
    if (!snapshot) return sendJson(404, { success: false, error: 'Снимок не найден' });
    return sendJson(200, { success: true, snapshot });
  }

  // POST /api/admin/leaderboard-history/snapshot
  if (req.method === 'POST' && pathname === '/api/admin/leaderboard-history/snapshot') {
    const body = await readBody();
    if (!checkIsAdmin(body)) {
      return sendJson(403, { success: false, error: 'Доступ запрещён' });
    }
    const snapshot = db.saveLeaderboardSnapshot({ snapshotType: body.snapshotType || 'manual' });
    return sendJson(200, { success: true, snapshot, message: 'Снимок сохранён' });
  }

  // POST or DELETE /api/admin/leaderboard-history/delete
  if ((req.method === 'POST' && pathname === '/api/admin/leaderboard-history/delete') ||
      (req.method === 'DELETE' && pathname === '/api/admin/leaderboard-history')) {
    const body = await readBody();
    const authData = req.method === 'DELETE' ? query : body;
    if (!checkIsAdmin(authData)) {
      return sendJson(403, { success: false, error: 'Доступ запрещён' });
    }
    const snapshotId = (body && body.id) || (query && query.id);
    if (!snapshotId) {
      return sendJson(400, { success: false, error: 'Укажите ID снимка' });
    }
    const ok = db.deleteLeaderboardSnapshot(snapshotId);
    if (!ok) {
      return sendJson(404, { success: false, error: 'Снимок не найден' });
    }
    return sendJson(200, { success: true, message: `Снимок #${snapshotId} удалён` });
  }

  sendJson(404, { error: 'Not Found' });
});

server.listen(0, async () => {
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
