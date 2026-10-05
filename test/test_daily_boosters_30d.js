const assert = require('assert');
const db = require('../db');

async function runTests() {
  console.log('--- STARTING 30-DAY DAILY BOOSTERS TEST SUITE ---');

  const testTelegramId = '999888777111';

  // 1. Setup user
  console.log('[Test 1] User registration & balance preparation...');
  let user = db.getUser(testTelegramId, 'TestPlayer');
  assert(user, 'User should be returned');
  
  // Set initial balance to 10 GRAM and reset boosters
  db.db.prepare(`
    UPDATE users
    SET ton_balance = 10.0,
        undos = 0,
        hints = 0,
        reveals = 0,
        extra_bottles = 0,
        daily_boosters_days_left = 0,
        daily_boosters_last_date = '',
        daily_boosters_purchased_at = 0
    WHERE telegram_id = ?
  `).run(testTelegramId);

  user = db.getUser(testTelegramId);
  assert.strictEqual(user.ton_balance, 10.0, 'Initial balance must be 10.0 GRAM');
  assert.strictEqual(user.daily_boosters_days_left, 0, 'daily_boosters_days_left must be 0 initially');
  console.log('✅ Test 1 Passed');

  // 2. Buy daily_boosters_30d
  console.log('[Test 2] Purchasing daily_boosters_30d for 5 GRAM...');
  const purchaseRes = db.buyShopItem(testTelegramId, 'daily_boosters_30d');
  assert.strictEqual(purchaseRes.success, true, 'Purchase must succeed');
  assert.strictEqual(purchaseRes.user.ton_balance, 5.0, 'Balance after purchase must be 5.0 GRAM');
  assert.strictEqual(purchaseRes.user.daily_boosters_days_left, 30, 'daily_boosters_days_left must be 30');
  assert(purchaseRes.user.daily_boosters_purchased_at > 0, 'daily_boosters_purchased_at must be recorded');
  assert(purchaseRes.user.daily_boosters_last_date.length > 0, 'daily_boosters_last_date must be initialized');
  console.log('✅ Test 2 Passed: Purchase deducted 5 GRAM and activated 30 days subscription');

  // 3. Simulating 23:59 Kyiv accrual on day 1
  console.log('[Test 3] Simulating Kyiv 23:59 accrual on day 1...');
  // Force a specific date/time: 2026-10-06 23:59:05 Kyiv time (UTC: 2026-10-06 20:59:05 during EEST / UTC+3)
  const simDateDay1 = new Date('2026-10-06T20:59:10.000Z'); // 23:59:10 in Kyiv (UTC+3)
  
  // Set last_date to yesterday (2026-10-05) to ensure day 1 is eligible
  db.db.prepare('UPDATE users SET daily_boosters_last_date = ? WHERE telegram_id = ?').run('2026-10-05', testTelegramId);

  const accrualDay1 = db.accrueDailyBoostersForUser(testTelegramId, simDateDay1);
  assert.strictEqual(accrualDay1.accrued, true, 'Accrual should succeed for day 1');
  assert.strictEqual(accrualDay1.dueCount, 1, 'Exactly 1 day should be accrued');
  assert.strictEqual(accrualDay1.user.daily_boosters_days_left, 29, 'Days left should be 29');
  assert.strictEqual(accrualDay1.user.undos, 10, 'Undos should be +10');
  assert.strictEqual(accrualDay1.user.hints, 10, 'Hints should be +10');
  assert.strictEqual(accrualDay1.user.reveals, 10, 'Reveals should be +10');
  assert.strictEqual(accrualDay1.user.extra_bottles, 10, 'Extra bottles should be +10');
  assert.strictEqual(accrualDay1.user.daily_boosters_last_date, '2026-10-06', 'Last date must be 2026-10-06');
  console.log('✅ Test 3 Passed: 10 of each booster credited, days left: 29');

  // 4. Idempotency test (same day at 23:59:30)
  console.log('[Test 4] Verifying idempotency (no duplicate accrual on same day)...');
  const simDateDay1Repeat = new Date('2026-10-06T20:59:30.000Z');
  const accrualRepeat = db.accrueDailyBoostersForUser(testTelegramId, simDateDay1Repeat);
  assert.strictEqual(accrualRepeat.accrued, false, 'Repeat accrual must return false');
  assert.strictEqual(accrualRepeat.user.daily_boosters_days_left, 29, 'Days left must remain 29');
  assert.strictEqual(accrualRepeat.user.undos, 10, 'Undos must still be 10');
  console.log('✅ Test 4 Passed: Accrual is strictly idempotent');

  // 5. Catch-up on missed days (simulating 3 days offline)
  console.log('[Test 5] Simulating player offline for 3 days and catch-up accrual...');
  // Player was last accrued on 2026-10-06. Fast-forward to 2026-10-09 23:59:15 Kyiv time
  const simDateDay4 = new Date('2026-10-09T20:59:15.000Z'); // 3 days diff (Oct 7, 8, 9)
  const accrualCatchup = db.accrueDailyBoostersForUser(testTelegramId, simDateDay4);
  assert.strictEqual(accrualCatchup.accrued, true, 'Catchup accrual should succeed');
  assert.strictEqual(accrualCatchup.dueCount, 3, 'Should catch up 3 days');
  assert.strictEqual(accrualCatchup.user.daily_boosters_days_left, 26, 'Days left should decrement from 29 to 26');
  assert.strictEqual(accrualCatchup.user.undos, 40, 'Undos should be 10 + 30 = 40');
  assert.strictEqual(accrualCatchup.user.hints, 40, 'Hints should be 10 + 30 = 40');
  assert.strictEqual(accrualCatchup.user.reveals, 40, 'Reveals should be 10 + 30 = 40');
  assert.strictEqual(accrualCatchup.user.extra_bottles, 40, 'Extra bottles should be 10 + 30 = 40');
  assert.strictEqual(accrualCatchup.user.daily_boosters_last_date, '2026-10-09', 'Last date must be 2026-10-09');
  console.log('✅ Test 5 Passed: Catch-up successfully awarded 3 days (+30 each), days left: 26');

  // 6. Immunity to Season Reset
  console.log('[Test 6] Testing immunity against Season Reset (db.resetSeason)...');
  db.db.prepare('UPDATE users SET max_level = 42, current_level = 42, stars = 120 WHERE telegram_id = ?').run(testTelegramId);
  const seasonResetRes = db.resetSeason();
  assert(seasonResetRes.success, 'Season reset must succeed');
  const userAfterSeasonReset = db.getUser(testTelegramId);
  assert.strictEqual(userAfterSeasonReset.max_level, 0, 'max_level should be reset to 0');
  assert.strictEqual(userAfterSeasonReset.stars, 0, 'Stars should be reset to 0');
  assert.strictEqual(userAfterSeasonReset.daily_boosters_days_left, 26, 'daily_boosters_days_left MUST NOT be reset!');
  assert.strictEqual(userAfterSeasonReset.daily_boosters_last_date, '2026-10-09', 'daily_boosters_last_date MUST NOT be reset!');
  assert.strictEqual(userAfterSeasonReset.undos, 40, 'Undos must NOT be touched by season reset');
  assert.strictEqual(userAfterSeasonReset.hints, 40, 'Hints must NOT be touched by season reset');
  assert.strictEqual(userAfterSeasonReset.reveals, 40, 'Reveals must NOT be touched by season reset');
  assert.strictEqual(userAfterSeasonReset.extra_bottles, 40, 'Extra bottles must NOT be touched by season reset');
  console.log('✅ Test 6 Passed: Daily booster subscription & inventory are completely immune to season resets');

  // 7. Immunity to Admin GRAM Purchases Reset
  console.log('[Test 7] Testing immunity against Admin GRAM purchases reset...');
  const resetPurchasesRes = db.resetGramPurchases(testTelegramId);
  assert(resetPurchasesRes.success, 'resetGramPurchases must succeed');
  const userAfterAdminReset = db.getUser(testTelegramId);
  assert.strictEqual(userAfterAdminReset.daily_boosters_days_left, 26, 'daily_boosters_days_left MUST NOT be wiped by resetGramPurchases');
  
  // Verify that daily_boosters_30d purchase record was preserved in shop_purchases
  const purchases = db.db.prepare('SELECT * FROM shop_purchases WHERE telegram_id = ? AND item_id = ?').all(testTelegramId, 'daily_boosters_30d');
  assert(purchases.length > 0, 'daily_boosters_30d purchase record MUST be preserved in shop_purchases');
  console.log('✅ Test 7 Passed: Daily boosters are protected from admin GRAM resets');

  // 8. Extension / Stacking (+30 days)
  console.log('[Test 8] Testing extending subscription by another 30 days...');
  db.db.prepare('UPDATE users SET ton_balance = 10.0 WHERE telegram_id = ?').run(testTelegramId);
  const extendRes = db.buyShopItem(testTelegramId, 'daily_boosters_30d');
  assert.strictEqual(extendRes.success, true, 'Extension purchase must succeed');
  assert.strictEqual(extendRes.user.ton_balance, 5.0, 'Balance must be 5.0 GRAM');
  assert.strictEqual(extendRes.user.daily_boosters_days_left, 56, 'Days left must extend: 26 + 30 = 56');
  console.log('✅ Test 8 Passed: Successfully stacked +30 days (total: 56 days)');

  // 9. Batch accrual test (db.accrueDailyBoostersForAll)
  console.log('[Test 9] Testing global cron runner db.accrueDailyBoostersForAll()...');
  // Advance 1 day to 2026-10-10 23:59:00 Kyiv
  const simDateDay5 = new Date('2026-10-10T20:59:00.000Z');
  const globalAccruals = db.accrueDailyBoostersForAll(simDateDay5);
  const foundUser = globalAccruals.find(u => u.telegramId === testTelegramId);
  assert(foundUser, 'Test user should be included in global accrual');
  assert.strictEqual(foundUser.dueCount, 1, 'Global accrual should accrue 1 day');
  assert.strictEqual(foundUser.newDaysLeft, 55, 'Days left should decrement to 55');
  
  const userAfterGlobal = db.getUser(testTelegramId);
  assert.strictEqual(userAfterGlobal.daily_boosters_days_left, 55, 'User in DB must have 55 days left');
  assert.strictEqual(userAfterGlobal.undos, 10, 'Undos should now be 10 (0 from admin reset + 10 from new day)');
  console.log('✅ Test 9 Passed: Global cron accrual processed all eligible players seamlessly');

  // Clean up test user
  db.db.prepare('DELETE FROM shop_purchases WHERE telegram_id = ?').run(testTelegramId);
  db.db.prepare('DELETE FROM users WHERE telegram_id = ?').run(testTelegramId);
  console.log('--- ALL 9 TESTS PASSED FLAWLESSLY! ---');
}

runTests().catch(err => {
  console.error('❌ Test Failed:', err);
  process.exit(1);
});
