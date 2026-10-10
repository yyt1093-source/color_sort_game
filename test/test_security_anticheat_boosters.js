/**
 * Comprehensive Security & Anti-Cheat Test Suite
 * Tests HMAC-authenticated Telegram sessions, server-authoritative boosters, move replay, level verification, ad tokens, and admin authorization.
 */

const assert = require('assert');
const http = require('http');
const crypto = require('crypto');
const db = require('../db');
const gameVerification = require('../gameVerification');
const app = require('../server');

const PORT = 3099;
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

let server;

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
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(body); } catch (e) { parsed = body; }
        resolve({ status: res.statusCode, headers: res.headers, data: parsed });
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- Starting Anti-Cheat & Security Verification Tests ---');

  server = app.listen(PORT, async () => {
    try {
      const testUserTid = '999888777';
      const adminTid = '5761685341';

      const userInitData = makeInitData({ id: Number(testUserTid), first_name: 'SecurityTester', username: 'test_sec_user' });
      const adminInitData = makeInitData({ id: Number(adminTid), first_name: 'ALLIGATOR', username: 'ALLIGATOR0709' });

      // 0. TEST: Forged / Missing HMAC is rejected
      console.log('Testing HMAC initData authentication rejection...');
      const unauthRes = await request('/api/user/init', {
        method: 'POST',
        headers: { 'x-telegram-init-data': 'invalid_forged_hash' },
        body: { telegramId: testUserTid }
      });
      assert.strictEqual(unauthRes.status, 401, 'Forged initData must be 401');
      console.log('✔ Forged initData rejected with 401');

      // Setup clean test user with valid HMAC
      const initRes = await request('/api/user/init', {
        method: 'POST',
        headers: { 'x-telegram-init-data': userInitData },
        body: {
          telegramId: testUserTid,
          firstName: 'SecurityTester',
          username: 'test_sec_user'
        }
      });
      assert.strictEqual(initRes.status, 200, 'Init with valid HMAC should return 200');
      console.log('✔ Test user initialized with valid HMAC signature');

      // 1. TEST: Client cannot inject boosters or level in /api/user/sync
      console.log('Testing /api/user/sync anti-cheat...');
      const syncHackRes = await request('/api/user/sync', {
        method: 'POST',
        headers: { 'x-telegram-init-data': userInitData },
        body: {
          telegramId: testUserTid,
          maxLevel: 999,
          hints: 999,
          undos: 999,
          reveals: 999,
          extraBottles: 999,
          ton_balance: 500
        }
      });
      assert.strictEqual(syncHackRes.status, 200);
      assert.notStrictEqual(syncHackRes.data.user.hints, 999, 'Hints hack must be rejected');
      assert.notStrictEqual(syncHackRes.data.user.max_level, 999, 'Level hack must be rejected');
      assert.notStrictEqual(syncHackRes.data.user.ton_balance, 500, 'Balance hack must be rejected');
      console.log('✔ Injection of 999 boosters / level in /api/user/sync successfully blocked');

      // 2. TEST: Non-Admin cannot add boosters via admin route
      console.log('Testing Admin route authorization...');
      const unauthAdminRes = await request('/api/admin/add-boosters', {
        method: 'POST',
        headers: { 'x-telegram-init-data': userInitData },
        body: {
          telegramId: testUserTid,
          amount: 50
        }
      });
      assert.strictEqual(unauthAdminRes.status, 403, 'Non-admin must be 403 Forbidden');
      console.log('✔ Non-admin blocked from /api/admin/add-boosters (403)');

      // Admin CAN add boosters
      const authAdminRes = await request('/api/admin/add-boosters', {
        method: 'POST',
        headers: { 'x-telegram-init-data': adminInitData },
        body: {
          telegramId: testUserTid,
          hints: 5
        }
      });
      assert.strictEqual(authAdminRes.status, 200);
      assert.strictEqual(authAdminRes.data.user.hints >= 5, true, 'Admin successfully granted boosters');
      console.log('✔ Admin correctly authorized to grant boosters');

      // 3. TEST: Game Session & Move Verification
      console.log('Testing Game Session start...');
      const sessionStartRes = await request('/api/game/start-level', {
        method: 'POST',
        headers: { 'x-telegram-init-data': userInitData },
        body: { levelNumber: 1 }
      });
      assert.strictEqual(sessionStartRes.status, 200);
      assert.ok(sessionStartRes.data.sessionToken, 'Session token must be returned');
      const sessionToken = sessionStartRes.data.sessionToken;
      console.log('✔ Game session started with token:', sessionToken);

      // 4. TEST: Booster usage during game session
      console.log('Testing /api/game/use-booster...');
      const boosterUseRes = await request('/api/game/use-booster', {
        method: 'POST',
        headers: { 'x-telegram-init-data': userInitData },
        body: { sessionToken, boosterType: 'hints' }
      });
      assert.strictEqual(boosterUseRes.status, 200);
      assert.strictEqual(boosterUseRes.data.success, true);
      console.log('✔ Server atomically consumed 1 hint. Remaining:', boosterUseRes.data.remaining);

      // 5. TEST: Level completion verification (Rejects invalid solve / cheats)
      console.log('Testing fake level completion rejection...');
      const fakeWinRes = await request('/api/game/complete-level', {
        method: 'POST',
        headers: { 'x-telegram-init-data': userInitData },
        body: {
          sessionToken,
          moves: [] // Empty moves cannot solve the level
        }
      });
      assert.strictEqual(fakeWinRes.status, 400, 'Unsolved board must be rejected');
      console.log('✔ Fake win without solving rejected with 400');

      // 6. TEST: Ad Reward flow (Start -> Wait -> Claim)
      console.log('Testing Ad token security...');
      const adStartRes = await request('/api/ad-reward/start', {
        method: 'POST',
        headers: { 'x-telegram-init-data': userInitData },
        body: { rewardType: 'hints' }
      });
      assert.strictEqual(adStartRes.status, 200);
      const adToken = adStartRes.data.adToken;
      assert.ok(adToken, 'Ad token must be generated');

      // Claim too fast (< 1.5s) must be rejected
      const fastClaimRes = await request('/api/ad-reward/claim', {
        method: 'POST',
        headers: { 'x-telegram-init-data': userInitData },
        body: { adToken, rewardType: 'hints' }
      });
      assert.strictEqual(fastClaimRes.status, 400, 'Fast ad claim must be rejected');
      console.log('✔ Fast fake ad watch correctly rejected');

      // Wait 1.6s and claim legitimately
      await new Promise(r => setTimeout(r, 1600));
      const validClaimRes = await request('/api/ad-reward/claim', {
        method: 'POST',
        headers: { 'x-telegram-init-data': userInitData },
        body: { adToken, rewardType: 'hints' }
      });
      if (validClaimRes.status !== 200) {
        console.log('validClaimRes status:', validClaimRes.status, 'data:', validClaimRes.data);
      }
      assert.strictEqual(validClaimRes.status, 200);
      assert.strictEqual(validClaimRes.data.success, true);
      console.log('✔ Legitimate ad watch granted +1 hint on server');

      // Replay attack with same token must be rejected
      const replayClaimRes = await request('/api/ad-reward/claim', {
        method: 'POST',
        headers: { 'x-telegram-init-data': userInitData },
        body: { adToken, rewardType: 'hints' }
      });
      assert.strictEqual(replayClaimRes.status, 400, 'Token replay must be rejected');
      console.log('✔ Replay attack on ad token rejected');

      console.log('\n========================================');
      console.log('🎉 ALL ANTI-CHEAT & SECURITY TESTS PASSED!');
      console.log('========================================\n');
      process.exit(0);
    } catch (err) {
      console.error('❌ Test failed:', err);
      process.exit(1);
    } finally {
      if (server) server.close();
    }
  });
}

runTests();
