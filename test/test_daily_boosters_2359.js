const assert = require('assert');
const db = require('../db');

console.log('🧪 Starting Comprehensive Daily Boosters 23:59 Kyiv Test Suite...');

const testTid = 'test_daily_booster_player_' + Date.now();

// 1. Setup fresh player
db.getUser(testTid);
db.prepare(`
  UPDATE users 
  SET ton_balance = 5.0, hints = 0, undos = 0, reveals = 0, extra_bottles = 0, daily_boosters_days_left = 0, daily_boosters_last_date = '', daily_boosters_purchased_at = 0
  WHERE telegram_id = ?
`).run(testTid);

// 2. Buy daily_boosters_30d at 12:00 Kyiv time on Day 1 (e.g. 2026-10-05 12:00:00)
// Simulating purchase before 23:59 Kyiv
const buyResult = db.buyShopItem(testTid, 'daily_boosters_30d');
assert.strictEqual(buyResult.success, true, 'Purchase must succeed');
assert.strictEqual(buyResult.user.hints, 10, 'Day 1 immediate grant: hints = 10');
assert.strictEqual(buyResult.user.undos, 10, 'Day 1 immediate grant: undos = 10');
assert.strictEqual(buyResult.user.reveals, 10, 'Day 1 immediate grant: reveals = 10');
assert.strictEqual(buyResult.user.extra_bottles, 10, 'Day 1 immediate grant: extra_bottles = 10');
assert.strictEqual(buyResult.user.daily_boosters_days_left, 30, 'Day 1 counter: 30 days left');

const kyivDay1 = db.getKyivDateTime();
// If today's time is before 23:59, initialLastDate must be yesterday so 23:59 tonight will accrue!
const isBefore2359 = !(kyivDay1.hour === 23 && kyivDay1.minute >= 59);
if (isBefore2359) {
  assert.notStrictEqual(buyResult.user.daily_boosters_last_date, kyivDay1.dateStr, 'initialLastDate must be yesterday if purchased before 23:59');
}
console.log('✅ Step 1: Immediate Day 1 purchase & initial 30 days verified.');

// 3. Test Day 1 23:59:00 Kyiv accrual
// Simulate time: Day 1 at 23:59:00 Kyiv
// We construct a Date representing 23:59:00 on the purchase day
const day1Evening = new Date(kyivDay1.dateStr + 'T23:59:00+03:00');
const day1Accrual = db.accrueDailyBoostersForUser(testTid, day1Evening);
assert.strictEqual(day1Accrual.accrued, true, 'Day 1 at 23:59 must trigger accrual');
assert.strictEqual(day1Accrual.newDaysLeft, 29, 'After 23:59 on Day 1, counter must decrement to 29');
assert.strictEqual(day1Accrual.user.hints, 20, 'Hints must increase to 20 (+10)');
assert.strictEqual(day1Accrual.user.undos, 20, 'Undos must increase to 20 (+10)');
assert.strictEqual(day1Accrual.user.reveals, 20, 'Reveals must increase to 20 (+10)');
assert.strictEqual(day1Accrual.user.extra_bottles, 20, 'Extra bottles must increase to 20 (+10)');
assert.strictEqual(day1Accrual.user.daily_boosters_last_date, kyivDay1.dateStr, 'Last date must be Day 1');
console.log('✅ Step 2: Day 1 23:59 Kyiv accrual verified (20 of each, 29 days left).');

// 4. Test during Day 2 before 23:59:00 (e.g. 14:00 Kyiv)
// Should NOT accrue again
const day2Midday = new Date(day1Evening.getTime() + 14 * 3600 * 1000); // Day 2 ~14:00
const day2MiddayCheck = db.accrueDailyBoostersForUser(testTid, day2Midday);
assert.strictEqual(day2MiddayCheck.accrued, false, 'Midday on Day 2 must not accrue');
const userDay2 = db.getUser(testTid);
assert.strictEqual(userDay2.daily_boosters_days_left, 29, 'Counter must remain 29 during Day 2');
assert.strictEqual(userDay2.hints, 20, 'Balance must remain 20');
console.log('✅ Step 3: Day 2 midday check passed (no double accrual, displays 29 days).');

// 5. Test Day 2 23:59:00 Kyiv accrual
const day2Evening = new Date(day1Evening.getTime() + 24 * 3600 * 1000); // Day 2 23:59:00
const day2Accrual = db.accrueDailyBoostersForUser(testTid, day2Evening);
assert.strictEqual(day2Accrual.accrued, true, 'Day 2 23:59 must trigger accrual');
assert.strictEqual(day2Accrual.newDaysLeft, 28, 'After 23:59 on Day 2, counter must decrement to 28');
assert.strictEqual(day2Accrual.user.hints, 30, 'Hints must increase to 30 (+10)');
assert.strictEqual(day2Accrual.user.undos, 30, 'Undos must increase to 30 (+10)');
assert.strictEqual(day2Accrual.user.reveals, 30, 'Reveals must increase to 30 (+10)');
assert.strictEqual(day2Accrual.user.extra_bottles, 30, 'Extra bottles must increase to 30 (+10)');
console.log('✅ Step 4: Day 2 23:59 Kyiv accrual verified (30 of each, 28 days left).');

// 6. Test Maria\'s account state in SQLite
const maria = db.getUser('7116446051');
assert.strictEqual(maria.hints, 19, 'Maria hints must be 19');
assert.strictEqual(maria.undos, 20, 'Maria undos must be 20');
assert.strictEqual(maria.reveals, 20, 'Maria reveals must be 20');
assert.strictEqual(maria.extra_bottles, 26, 'Maria extra_bottles must be 26');
assert.strictEqual(maria.daily_boosters_days_left, 29, 'Maria daily_boosters_days_left must be 29');
assert.strictEqual(maria.daily_boosters_last_date, '2026-10-05', 'Maria daily_boosters_last_date must be 2026-10-05');
console.log('✅ Step 5: Maria account verified in DB (19 hints, 20 undos, 20 reveals, 26 bottles, 29 days left).');

// 7. Test accrueDailyBoostersForAll with cloud players list
const mockCloudPlayers = [
  {
    telegramId: testTid,
    daily_boosters_days_left: 28,
    daily_boosters_last_date: db.getKyivDateTime(day2Evening).dateStr,
    daily_boosters_purchased_at: Date.now()
  }
];
const day3Evening = new Date(day2Evening.getTime() + 24 * 3600 * 1000); // Day 3 23:59:00
const allAccrual = db.accrueDailyBoostersForAll(day3Evening, mockCloudPlayers);
const foundAccrued = allAccrual.find(a => a.telegramId === testTid);
assert.ok(foundAccrued, 'testTid must be accrued in accrueDailyBoostersForAll');
assert.strictEqual(foundAccrued.newDaysLeft, 27, 'Days left must decrement to 27 on Day 3');
assert.strictEqual(foundAccrued.user.hints, 40, 'Hints must be 40 on Day 3');
console.log('✅ Step 6: accrueDailyBoostersForAll batch processing verified.');

console.log('🎉 ALL DAILY BOOSTERS 23:59 KYIV TESTS PASSED WITH 100% SUCCESS!');
