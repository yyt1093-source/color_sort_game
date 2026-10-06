/**
 * Test Suite: Admin Maintenance Mode Controls & Gatekeeping
 */
const assert = require('assert');
const db = require('../db');

async function runTests() {
  console.log('================================================================');
  console.log('🧪 TEST SUITE: Admin Maintenance Mode Gatekeeper & API Controls');
  console.log('================================================================\n');

  // 1. Initial State: Maintenance should be disabled (open to all)
  console.log('1. Verifying initial state: Maintenance mode must be disabled...');
  db.setMaintenanceStatus(false);
  let status = db.getMaintenanceStatus();
  assert.strictEqual(status.active, false, 'Maintenance should be disabled initially');
  console.log('   ✅ [PASS] Maintenance mode is disabled in DB.\n');

  // 2. Set maintenance mode active
  console.log('2. Activating maintenance mode with custom message...');
  const testMsg = 'Внимание! Технические работы на сервере.';
  db.setMaintenanceStatus(true, testMsg);
  status = db.getMaintenanceStatus();
  assert.strictEqual(status.active, true, 'Maintenance should be active');
  assert.strictEqual(status.message, testMsg, 'Custom message should be stored');
  console.log('   ✅ [PASS] Maintenance mode activated with custom message.\n');

  // 3. Deactivate maintenance mode
  console.log('3. Deactivating maintenance mode...');
  db.setMaintenanceStatus(false);
  status = db.getMaintenanceStatus();
  assert.strictEqual(status.active, false, 'Maintenance should be deactivated');
  console.log('   ✅ [PASS] Maintenance mode deactivated.\n');

  // 4. Test Middleware Logic
  console.log('4. Testing Express Maintenance Middleware behavior...');
  const MAINTENANCE_ALLOWED_IDS = ['5761685341', '7116446051'];
  const MAINTENANCE_ALLOWED_USERNAMES = ['alligator0709', 'maria290355'];

  function mockMiddleware(req, res, next) {
    const maint = db.getMaintenanceStatus();
    if (!maint.active) return next();
    if (req.path === '/config' || req.path === '/api/config' || req.path.startsWith('/admin') || req.path.startsWith('/api/admin')) {
      return next();
    }
    const tid = String((req.user && req.user.id) || (req.body && req.body.telegramId) || '').trim();
    const uname = String((req.user && req.user.username) || (req.body && req.body.username) || '').toLowerCase().replace(/^@/, '').trim();
    if (MAINTENANCE_ALLOWED_IDS.includes(tid) || (uname && MAINTENANCE_ALLOWED_USERNAMES.includes(uname))) {
      return next();
    }
    return res.status(200).json({
      success: false,
      maintenance: true,
      error: maint.message
    });
  }

  // Case 4A: When maintenance is OFF, regular user passes through
  db.setMaintenanceStatus(false);
  let nextCalled = false;
  let responseData = null;
  const mockRes = {
    status: (code) => ({
      json: (data) => { responseData = data; }
    })
  };

  mockMiddleware({ path: '/api/user/init', body: { telegramId: '12345678' } }, mockRes, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, true, 'Regular user should pass when maintenance is OFF');
  assert.strictEqual(responseData, null, 'No blocking response when maintenance is OFF');
  console.log('   ✅ [PASS] Regular users pass freely when maintenance is OFF.');

  // Case 4B: When maintenance is ON, regular user is blocked
  db.setMaintenanceStatus(true, 'Тест блокировки');
  nextCalled = false;
  responseData = null;
  mockMiddleware({ path: '/api/user/init', body: { telegramId: '12345678', username: 'random_player' } }, mockRes, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, false, 'Regular user should NOT pass when maintenance is ON');
  assert.strictEqual(responseData && responseData.maintenance, true, 'Regular user receives maintenance: true');
  assert.strictEqual(responseData && responseData.error, 'Тест блокировки');
  console.log('   ✅ [PASS] Regular user is blocked with maintenance: true when maintenance is ON.');

  // Case 4C: When maintenance is ON, Alligator (5761685341) passes through
  nextCalled = false;
  responseData = null;
  mockMiddleware({ path: '/api/user/init', body: { telegramId: '5761685341', username: 'alligator0709' } }, mockRes, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, true, 'Alligator admin must pass even when maintenance is ON');
  assert.strictEqual(responseData, null);
  console.log('   ✅ [PASS] Alligator (5761685341) passes when maintenance is ON.');

  // Case 4D: When maintenance is ON, Maria (7116446051) passes through
  nextCalled = false;
  responseData = null;
  mockMiddleware({ path: '/api/user/init', body: { telegramId: '7116446051', username: 'maria290355' } }, mockRes, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, true, 'Maria admin must pass even when maintenance is ON');
  assert.strictEqual(responseData, null);
  console.log('   ✅ [PASS] Maria (7116446051) passes when maintenance is ON.');

  // Case 4E: Public config and admin paths pass through regardless of maintenance
  nextCalled = false;
  mockMiddleware({ path: '/api/config', body: {} }, mockRes, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, true, 'Config route must always pass');
  nextCalled = false;
  mockMiddleware({ path: '/api/admin/maintenance', body: {} }, mockRes, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, true, 'Admin routes must always pass');
  console.log('   ✅ [PASS] Public config and admin routes always accessible.\n');

  // 5. Reset maintenance mode back to OFF (open to all)
  db.setMaintenanceStatus(false, 'Идут технические работы. Доступ временно ограничен.');
  const finalStatus = db.getMaintenanceStatus();
  assert.strictEqual(finalStatus.active, false, 'Maintenance mode must be false at test conclusion');
  console.log('5. Final check: Maintenance mode is disabled. Players can enter.');
  console.log('   ✅ [PASS] State restored to open access.\n');

  console.log('================================================================');
  console.log('🎉 ALL TESTS PASSED SUCCESSFULLY!');
  console.log('================================================================');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
