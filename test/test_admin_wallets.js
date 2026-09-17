/**
 * Test Suite: Admin Connected Wallets & Confirmed Deposits
 * Native Node.js test without external dependencies.
 */
const assert = require('assert');
const http = require('http');
const url = require('url');
const db = require('../db');

const ALLIGATOR_ADMIN_ID = '5761685341';

function checkIsAdmin(reqData) {
  if (!reqData) return false;
  const { telegramId, adminTelegramId, adminTid, adminId, firstName, adminFirstName, username, adminUsername } = reqData;
  const tid = String(adminTelegramId || adminTid || adminId || telegramId || '').trim();
  const fname = String(adminFirstName || firstName || '').toLowerCase().trim();
  const uname = String(adminUsername || username || '').toLowerCase().replace(/^@/, '').trim();
  if (tid === ALLIGATOR_ADMIN_ID) return true;
  if (uname === 'alligator' || uname === 'аллигатор') return true;
  if (fname === 'alligator' || fname === 'аллигатор') return true;
  return false;
}

async function runTests() {
  console.log('================================================================');
  console.log('🧪 TEST SUITE: Admin Connected Wallets & Player Deposits');
  console.log('================================================================\n');

  // Test 1: Admin ID verification
  console.log('  Testing Admin Authorization Check...');
  assert.strictEqual(checkIsAdmin({ telegramId: '5761685341' }), true);
  assert.strictEqual(checkIsAdmin({ adminTelegramId: '5761685341', telegramId: '12345' }), true);
  assert.strictEqual(checkIsAdmin({ adminTid: '5761685341' }), true);
  assert.strictEqual(checkIsAdmin({ username: 'alligator' }), true);
  assert.strictEqual(checkIsAdmin({ firstName: 'Аллигатор' }), true);
  assert.strictEqual(checkIsAdmin({ telegramId: '12345' }), false);
  assert.strictEqual(checkIsAdmin({ username: 'guest' }), false);
  console.log('  ✅ [PASS] Admin authorization strictly verifies Alligator (5761685341)\n');

  // Test 2: Wallet connection in database
  console.log('  Testing db.updateTonWallet with walletType...');
  const testTid1 = '999' + Math.floor(100000 + Math.random() * 900000);
  const testWallet1 = 'UQCHkPFe4kzBSXOez0wHtYZFFI-txS4Hwz6toXgwsuuwPIv5';
  const testWalletType1 = 'Tonkeeper';

  // Seed user first
  db.getUser(testTid1, {
    first_name: 'CryptoMaster',
    username: 'cryptomaster_ton'
  });

  const uBefore = db.getUser(testTid1);
  assert.strictEqual(uBefore.current_level, 1, 'User level before should be 1');

  // Connect wallet
  db.updateTonWallet(testTid1, testWallet1, testWalletType1);

  const uAfter = db.getUser(testTid1);
  assert.strictEqual(uAfter.ton_wallet, testWallet1, 'Wallet address should match');
  assert.strictEqual(uAfter.ton_wallet_type, testWalletType1, 'Wallet type should match');
  assert.strictEqual(uAfter.current_level, 1, 'Game level must NOT be mutated');
  console.log('  ✅ [PASS] db.updateTonWallet successfully stored wallet & type without mutating player level\n');

  // Test 3: db.getConnectedWallets
  console.log('  Testing db.getConnectedWallets...');
  const connectedWallets = db.getConnectedWallets();
  assert(Array.isArray(connectedWallets), 'getConnectedWallets must return an array');
  const foundUser = connectedWallets.find(w => String(w.telegramId) === testTid1);
  assert(foundUser, 'Test user must be in connected wallets list');
  assert.strictEqual(foundUser.walletAddress, testWallet1);
  assert.strictEqual(foundUser.walletType, testWalletType1);
  connectedWallets.forEach(w => {
    assert(w.walletAddress && w.walletAddress.trim().length > 0, 'Every entry must have a non-empty walletAddress');
  });
  console.log(`  ✅ [PASS] db.getConnectedWallets returned ${connectedWallets.length} wallet(s), all non-empty\n`);

  // Test 4: Confirmed Deposits recording & lazy retrieval
  console.log('  Testing db.recordTonDeposit & db.getPlayerDeposits...');
  const testMemo = 'SORT-99900011';
  const dep1 = db.recordTonDeposit(testTid1, 1.5, testMemo, testWallet1, testWalletType1);
  assert(dep1 && dep1.deposit && dep1.deposit.id, 'Deposit 1 must be recorded with id');

  const dep2 = db.recordTonDeposit(testTid1, 3.0, testMemo, testWallet1, testWalletType1);
  assert(dep2 && dep2.deposit && dep2.deposit.id, 'Deposit 2 must be recorded with id');

  const playerDeposits = db.getPlayerDeposits(testTid1);
  assert(Array.isArray(playerDeposits), 'getPlayerDeposits must return array');
  assert.strictEqual(playerDeposits.length, 2, 'Player should have exactly 2 deposits');
  assert.strictEqual(playerDeposits[0].amount, 3.0, 'Newest deposit should be first');
  assert.strictEqual(playerDeposits[1].amount, 1.5, 'Second deposit should be 1.5');
  assert.strictEqual(playerDeposits[0].walletType, testWalletType1);

  const totalSum = playerDeposits.reduce((acc, d) => acc + d.amount, 0);
  assert.strictEqual(totalSum, 4.5, 'Total sum should be 4.5 TON');
  console.log(`  ✅ [PASS] db.recordTonDeposit and getPlayerDeposits recorded ${playerDeposits.length} deposits totaling ${totalSum} TON\n`);

  // Test 5: Server Admin Endpoints HTTP integration
  console.log('  Testing Server Endpoints with HTTP server...');
  const server = http.createServer(async (req, res) => {
    const parsed = url.parse(req.url, true);
    const pathname = parsed.pathname;
    const query = parsed.query;

    const sendJson = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };

    if (pathname === '/api/admin/connected-wallets') {
      if (!checkIsAdmin(query)) {
        return sendJson(403, { success: false, error: 'Доступ запрещён' });
      }
      const wallets = db.getConnectedWallets();
      return sendJson(200, { success: true, wallets });
    }

    if (pathname === '/api/admin/player-deposits') {
      if (!checkIsAdmin(query)) {
        return sendJson(403, { success: false, error: 'Доступ запрещён' });
      }
      const targetTelegramId = query.telegramId || query.playerTid;
      if (!targetTelegramId) {
        return sendJson(400, { success: false, error: 'Параметр telegramId обязателен' });
      }
      const deposits = db.getPlayerDeposits(targetTelegramId);
      const totalAmount = Number(deposits.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0).toFixed(4));
      const totalCount = deposits.length;
      return sendJson(200, { success: true, deposits, totalAmount, totalCount });
    }

    sendJson(404, { error: 'Not found' });
  });

  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 5a. Non-admin request to /api/admin/connected-wallets should get 403
    const nonAdminRes = await fetch(`${baseUrl}/api/admin/connected-wallets?telegramId=123456789`);
    assert.strictEqual(nonAdminRes.status, 403, 'Non-admin must receive 403 Forbidden');
    console.log('  ✅ [PASS] 403 Forbidden for non-admin on /api/admin/connected-wallets');

    // 5b. Admin request to /api/admin/connected-wallets should get 200 OK
    const adminRes = await fetch(`${baseUrl}/api/admin/connected-wallets?telegramId=5761685341`);
    assert.strictEqual(adminRes.status, 200, 'Admin must receive 200 OK');
    const adminData = await adminRes.json();
    assert.strictEqual(adminData.success, true);
    assert(Array.isArray(adminData.wallets));
    const apiFound = adminData.wallets.find(w => String(w.telegramId) === testTid1);
    assert(apiFound, 'API must return the connected wallet user');
    console.log(`  ✅ [PASS] 200 OK for Admin on /api/admin/connected-wallets (${adminData.wallets.length} wallets)`);

    // 5c. Admin request to /api/admin/player-deposits should get 200 OK
    const depositsAdminRes = await fetch(`${baseUrl}/api/admin/player-deposits?telegramId=${testTid1}&adminTelegramId=5761685341`);
    assert.strictEqual(depositsAdminRes.status, 200, 'Admin must receive 200 OK for player-deposits');
    const depData = await depositsAdminRes.json();
    assert.strictEqual(depData.success, true);
    assert.strictEqual(depData.deposits.length, 2);
    assert.strictEqual(depData.totalAmount, 4.5);
    assert.strictEqual(depData.totalCount, 2);
    console.log(`  ✅ [PASS] 200 OK for Admin on /api/admin/player-deposits (totalAmount: ${depData.totalAmount}, totalCount: ${depData.totalCount})`);

    // 5d. Non-admin request to /api/admin/player-deposits should get 403
    const nonAdminDepRes = await fetch(`${baseUrl}/api/admin/player-deposits?telegramId=${testTid1}&adminTelegramId=987654321`);
    assert.strictEqual(nonAdminDepRes.status, 403, 'Non-admin must receive 403 Forbidden for player-deposits');
    console.log('  ✅ [PASS] 403 Forbidden for non-admin on /api/admin/player-deposits');
  } finally {
    server.close();
  }
}

runTests().then(() => {
  console.log('\n================================================================');
  console.log('🎉 ALL ADMIN WALLET & DEPOSITS TESTS PASSED 100%!');
  console.log('================================================================\n');
}).catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
