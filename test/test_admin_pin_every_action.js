const assert = require('assert');
const http = require('http');
const crypto = require('crypto');
const db = require('../db');
const app = require('../server');

const PORT = 3105;
const BOT_TOKEN = process.env.BOT_TOKEN || '8837816458:AAGeBFs-ZOF56yro_QhZ7b-Wr6v8RaR6x0c';

function makeInitData(userObj) {
  const authDate = Math.floor(Date.now() / 1000);
  const userJson = JSON.stringify(userObj);
  const params = {
    auth_date: String(authDate),
    query_id: 'AAHdF6IQAAAAAN0XohDhrOrc',
    user: userJson
  };
  const sortedKeys = Object.keys(params).sort();
  const dataCheckString = sortedKeys.map(k => `${k}=${params[k]}`).join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  const searchParams = new URLSearchParams();
  for (const k of sortedKeys) {
    searchParams.set(k, params[k]);
  }
  searchParams.set('hash', hash);
  return searchParams.toString();
}

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const reqOptions = {
      hostname: 'localhost',
      port: PORT,
      path,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    };

    const req = http.request(reqOptions, (res) => {
      let rawData = '';
      res.on('data', chunk => { rawData += chunk; });
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(rawData); } catch (e) { parsed = rawData; }
        resolve({ status: res.statusCode, headers: res.headers, data: parsed });
      });
    });

    req.on('error', reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

async function runPinSecurityTest() {
  console.log('================================================================');
  console.log('🔐 DEDICATED AUDIT: PIN 1986 ENFORCEMENT ON ALL ADMIN ACTIONS');
  console.log('================================================================\n');

  const server = app.listen(PORT, async () => {
    try {
      const adminTid = '5761685341';
      const adminInitData = makeInitData({ id: Number(adminTid), first_name: 'ALLIGATOR', username: 'ALLIGATOR0709' });
      const targetTid = '777_test_' + Date.now();
      db.getUser(targetTid, { first_name: 'TestTarget' });

      // 1. /api/gifts/send for TON without PIN -> 403
      console.log('1. Testing TON gift sending without PIN 1986...');
      const tonNoPin = await request('/api/gifts/send', {
        method: 'POST',
        headers: { 'x-telegram-init-data': adminInitData },
        body: { recipientId: targetTid, giftType: 'ton', amount: 5.0 }
      });
      assert.strictEqual(tonNoPin.status, 403, 'TON gift without PIN must be 403');
      console.log('   ✅ TON gift without PIN rejected (403 Forbidden).');

      // 2. /api/gifts/send for TON with wrong PIN -> 403
      console.log('2. Testing TON gift sending with WRONG PIN...');
      const tonWrongPin = await request('/api/gifts/send', {
        method: 'POST',
        headers: { 'x-telegram-init-data': adminInitData, 'x-admin-pin': '9999' },
        body: { recipientId: targetTid, giftType: 'ton', amount: 5.0 }
      });
      assert.strictEqual(tonWrongPin.status, 403, 'TON gift with wrong PIN must be 403');
      console.log('   ✅ TON gift with wrong PIN rejected (403 Forbidden).');

      // 3. /api/gifts/send for TON WITH PIN 1986 -> 200
      console.log('3. Testing TON gift sending with CORRECT PIN 1986...');
      const tonValid = await request('/api/gifts/send', {
        method: 'POST',
        headers: { 'x-telegram-init-data': adminInitData, 'x-admin-pin': '1986' },
        body: { recipientId: targetTid, giftType: 'ton', amount: 5.0, adminPin: '1986' }
      });
      assert.strictEqual(tonValid.status, 200, 'TON gift with PIN 1986 must succeed');
      assert.strictEqual(tonValid.data.success, true);
      console.log('   ✅ TON gift with PIN 1986 successfully delivered (200 OK).');

      // 4. /api/gifts/send for admin booster gift without PIN -> 403
      console.log('4. Testing Admin booster gift without PIN 1986...');
      const adminGiftNoPin = await request('/api/gifts/send', {
        method: 'POST',
        headers: { 'x-telegram-init-data': adminInitData },
        body: { recipientId: targetTid, giftType: 'hints', amount: 5, senderType: 'colorsort' }
      });
      assert.strictEqual(adminGiftNoPin.status, 403, 'Admin gift without PIN must be 403');
      console.log('   ✅ Admin booster gift without PIN rejected (403 Forbidden).');

      // 5. /api/gifts/send for admin booster gift WITH PIN 1986 -> 200
      console.log('5. Testing Admin booster gift WITH PIN 1986...');
      const adminGiftValid = await request('/api/gifts/send', {
        method: 'POST',
        headers: { 'x-telegram-init-data': adminInitData, 'x-admin-pin': '1986' },
        body: { recipientId: targetTid, giftType: 'hints', amount: 5, senderType: 'colorsort', adminPin: '1986' }
      });
      assert.strictEqual(adminGiftValid.status, 200);
      assert.strictEqual(adminGiftValid.data.success, true);
      console.log('   ✅ Admin booster gift with PIN 1986 successfully delivered (200 OK).');

      // 6. /api/admin/add-boosters without PIN -> 403
      console.log('6. Testing /api/admin/add-boosters without PIN...');
      const boostNoPin = await request('/api/admin/add-boosters', {
        method: 'POST',
        headers: { 'x-telegram-init-data': adminInitData },
        body: { telegramId: targetTid, hints: 5, tonBalance: 5.0 }
      });
      assert.strictEqual(boostNoPin.status, 403);
      console.log('   ✅ /api/admin/add-boosters without PIN rejected (403 Forbidden).');

      // 7. /api/admin/add-boosters with PIN 1986 -> 200
      console.log('7. Testing /api/admin/add-boosters WITH PIN 1986...');
      const boostValid = await request('/api/admin/add-boosters', {
        method: 'POST',
        headers: { 'x-telegram-init-data': adminInitData, 'x-admin-pin': '1986' },
        body: { telegramId: targetTid, hints: 5, tonBalance: 5.0, adminPin: '1986' }
      });
      assert.strictEqual(boostValid.status, 200);
      assert.strictEqual(boostValid.data.success, true);
      console.log('   ✅ /api/admin/add-boosters with PIN 1986 succeeded (200 OK).');

      // 8. /api/admin/set-level without PIN -> 403
      console.log('8. Testing /api/admin/set-level without PIN...');
      const lvlNoPin = await request('/api/admin/set-level', {
        method: 'POST',
        headers: { 'x-telegram-init-data': adminInitData },
        body: { targetTelegramId: targetTid, level: 10 }
      });
      assert.strictEqual(lvlNoPin.status, 403);
      console.log('   ✅ /api/admin/set-level without PIN rejected (403 Forbidden).');

      // 9. /api/admin/set-level WITH PIN 1986 -> 200
      console.log('9. Testing /api/admin/set-level WITH PIN 1986...');
      const lvlValid = await request('/api/admin/set-level', {
        method: 'POST',
        headers: { 'x-telegram-init-data': adminInitData, 'x-admin-pin': '1986' },
        body: { targetTelegramId: targetTid, level: 10, adminPin: '1986' }
      });
      assert.strictEqual(lvlValid.status, 200);
      assert.strictEqual(lvlValid.data.success, true);
      console.log('   ✅ /api/admin/set-level with PIN 1986 succeeded (200 OK).');

      console.log('\n================================================================');
      console.log('🎉 ALL 9/9 ADMIN PIN SECURITY TESTS PASSED WITH 100% SUCCESS!');
      console.log('================================================================\n');

      server.close();
      process.exit(0);
    } catch (e) {
      console.error('❌ Test failed:', e);
      if (server) server.close();
      process.exit(1);
    }
  });
}

runPinSecurityTest();
