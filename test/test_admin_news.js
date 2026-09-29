const assert = require('assert');
const newsService = require('../newsService');

async function runTests() {
  console.log('🧪 Starting Color Sort News & Telegram Broadcast Test Suite...\n');

  // Test 1: Admin Authorization
  console.log('Test 1: Admin authorization check...');
  const stranger = { telegramId: '999999999', username: 'random_user', firstName: 'Ivan' };
  assert.strictEqual(newsService.checkIsAdmin(stranger), false, 'Stranger should not be admin');

  const alligatorTid = { telegramId: '5761685341', username: '', firstName: '' };
  assert.strictEqual(newsService.checkIsAdmin(alligatorTid), true, 'Alligator TID 5761685341 should be admin');

  const alligatorUname = { telegramId: '12345', username: 'alligator', firstName: 'John' };
  assert.strictEqual(newsService.checkIsAdmin(alligatorUname), true, 'Username alligator should be admin');

  const alligatorRuUname = { telegramId: '12345', username: 'аллигатор', firstName: 'John' };
  assert.strictEqual(newsService.checkIsAdmin(alligatorRuUname), true, 'Russian username аллигатор should be admin');
  console.log('✅ Test 1 Passed: Authorization checks working perfectly.\n');

  // Test 2: Kyiv Time Helper
  console.log('Test 2: Kyiv time formatting...');
  const timeStr = newsService.formatKyivTime();
  assert.ok(timeStr.includes('(Киев)'), 'Should contain (Киев)');
  console.log(`✅ Test 2 Passed: Time string: "${timeStr}"\n`);

  // Test 3: Audience gathering
  console.log('Test 3: Target player IDs gathering...');
  const playerIds = await newsService.getTargetPlayerIds('5761685341');
  assert.ok(Array.isArray(playerIds), 'Target player IDs should be an array');
  assert.ok(playerIds.includes('5761685341'), 'Target players should include admin 5761685341');
  console.log(`✅ Test 3 Passed: Successfully resolved ${playerIds.length} players.\n`);

  // Test 4: Unauthorized API request
  console.log('Test 4: Unauthorized request rejection...');
  let unauthCode = null;
  let unauthBody = null;
  const mockUnauthReq = {
    method: 'GET',
    query: { action: 'list', telegramId: '1234567', username: 'stranger' },
    body: {}
  };
  const mockUnauthRes = {
    setHeader: () => {},
    status: (code) => {
      unauthCode = code;
      return {
        json: (b) => { unauthBody = b; return b; }
      };
    }
  };
  await newsService.handleRequest(mockUnauthReq, mockUnauthRes);
  assert.strictEqual(unauthCode, 403, 'Should return 403 for unauthorized users');
  assert.strictEqual(unauthBody.success, false, 'Success should be false');
  console.log('✅ Test 4 Passed: 403 Forbidden correctly returned.\n');

  // Test 5: Authorized API request: action 'list'
  console.log('Test 5: Authorized request action "list"...');
  let listCode = null;
  let listBody = null;
  const mockAuthReq = {
    method: 'GET',
    query: { action: 'list', adminTid: '5761685341', adminUsername: 'alligator' },
    body: {}
  };
  const mockAuthRes = {
    setHeader: () => {},
    status: (code) => {
      listCode = code;
      return {
        json: (b) => { listBody = b; return b; }
      };
    }
  };
  await newsService.handleRequest(mockAuthReq, mockAuthRes);
  assert.strictEqual(listCode, 200, 'Should return 200 OK');
  assert.strictEqual(listBody.success, true, 'Success should be true');
  assert.ok(Array.isArray(listBody.history), 'History should be an array');
  assert.ok(typeof listBody.totalPlayersCount === 'number', 'totalPlayersCount should be number');
  console.log(`✅ Test 5 Passed: List returned ${listBody.history.length} news items and ${listBody.totalPlayersCount} total players.\n`);

  // Test 6: SAFETY VERIFICATION - STRICT TEST ONLY BROADCAST
  // The user explicitly requested: "Протестируй это всё, но игрокам на данный момент ничего не рассылай"
  console.log('Test 6: SAFETY VERIFICATION - Test Broadcast strictly targets admin TID 5761685341 only...');
  let testBroadcastCode = null;
  let testBroadcastBody = null;
  const mockTestBroadcastReq = {
    method: 'POST',
    query: {},
    body: {
      action: 'broadcast',
      adminTid: '5761685341',
      adminUsername: 'alligator',
      title: '🧪 Тестовое обновление Color Sort',
      message: 'Тестовая проверка системы уведомлений для панели администратора.',
      buttonText: '🚀 Играть в Color Sort',
      isTestOnly: true // STRICTLY TEST ONLY
    }
  };
  const mockTestBroadcastRes = {
    setHeader: () => {},
    status: (code) => {
      testBroadcastCode = code;
      return {
        json: (b) => { testBroadcastBody = b; return b; }
      };
    }
  };

  await newsService.handleRequest(mockTestBroadcastReq, mockTestBroadcastRes);
  assert.strictEqual(testBroadcastCode, 200, 'Should return 200 OK for test broadcast');
  assert.strictEqual(testBroadcastBody.success, true, 'Test broadcast should succeed');
  assert.strictEqual(testBroadcastBody.totalTargeted, 1, 'Total targeted MUST be exactly 1 (the admin)');
  assert.strictEqual(testBroadcastBody.newsItem.isTest, true, 'newsItem.isTest MUST be true');
  console.log(`✅ Test 6 Passed: Test broadcast executed safely to admin only! Target count: ${testBroadcastBody.totalTargeted}, Delivered: ${testBroadcastBody.deliveredCount}.\n`);

  // Test 7: Delete news item from history
  console.log('Test 7: Deleting news item from history...');
  const createdId = testBroadcastBody.newsItem.id;
  let deleteCode = null;
  let deleteBody = null;
  const mockDeleteReq = {
    method: 'POST',
    query: {},
    body: {
      action: 'delete',
      id: createdId,
      adminTid: '5761685341',
      adminUsername: 'alligator'
    }
  };
  const mockDeleteRes = {
    setHeader: () => {},
    status: (code) => {
      deleteCode = code;
      return {
        json: (b) => { deleteBody = b; return b; }
      };
    }
  };

  await newsService.handleRequest(mockDeleteReq, mockDeleteRes);
  assert.strictEqual(deleteCode, 200, 'Should return 200 OK for delete');
  assert.strictEqual(deleteBody.success, true, 'Delete should succeed');

  // Verify deletion from list
  const historyAfter = await newsService.fetchNewsHistory();
  const exists = historyAfter.some(item => item.id === createdId);
  assert.strictEqual(exists, false, 'Deleted item must no longer exist in history');
  console.log('✅ Test 7 Passed: Successfully deleted news item from history.\n');

  console.log('🎉 ALL TESTS PASSED! News and notification broadcast system for Color Sort is 100% verified and production-ready!');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
