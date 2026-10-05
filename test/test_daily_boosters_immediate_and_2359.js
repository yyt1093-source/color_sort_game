/**
 * Verification test for Daily Boosters (30 Days) in Color Sort:
 * 1. Immediate first accrual (+10 to all boosters) upon purchase/activation for 5.00 GRAM.
 * 2. No duplicate accrual on the same day at 23:59 Kyiv.
 * 3. Next accrual happens strictly after 23:59 on the NEXT day (+10 to all boosters, 29 days left).
 * 4. Subsequent daily accruals happen once per day at 23:59 Kyiv for 30 total periods.
 */

const assert = require('assert');
const db = require('../db');

console.log('🧪 Running Daily Boosters Immediate + 23:59 Kyiv Test Suite...');

const testTid = '777000111222';

// 1. Setup user with 10.00 GRAM balance and 0 boosters
db.getUser(testTid);
db.prepare(`
  UPDATE users 
  SET ton_balance = 10.00,
      hints = 0,
      undos = 0,
      reveals = 0,
      extra_bottles = 0,
      daily_boosters_days_left = 0,
      daily_boosters_last_date = '',
      daily_boosters_purchased_at = 0
  WHERE telegram_id = ?
`).run(testTid);

const userBefore = db.getUser(testTid);
assert.strictEqual(Number(userBefore.ton_balance), 10.00);
assert.strictEqual(Number(userBefore.hints), 0);
assert.strictEqual(Number(userBefore.undos), 0);
assert.strictEqual(Number(userBefore.reveals), 0);
assert.strictEqual(Number(userBefore.extra_bottles), 0);
assert.strictEqual(Number(userBefore.daily_boosters_days_left), 0);

// 2. Buy Daily Boosters (30 days) for 5.00 GRAM
const buyResult = db.buyShopItem(testTid, 'daily_boosters_30d');
assert.strictEqual(buyResult.success, true, 'Purchase must succeed');

const userAfterBuy = db.getUser(testTid);
// Balance deducted by 5.00 GRAM
assert.strictEqual(Number(userAfterBuy.ton_balance), 5.00, 'Balance must be 5.00 GRAM');
// Days left = 30
assert.strictEqual(Number(userAfterBuy.daily_boosters_days_left), 30, 'Days left must be 30');

// IMMEDIATE ACCRUAL VERIFICATION:
// Player MUST receive +10 hints, +10 undos, +10 reveals, +10 bottles right upon activation!
assert.strictEqual(Number(userAfterBuy.hints), 10, 'Hints must be 10 immediately upon activation');
assert.strictEqual(Number(userAfterBuy.undos), 10, 'Undos must be 10 immediately upon activation');
assert.strictEqual(Number(userAfterBuy.reveals), 10, 'Reveals must be 10 immediately upon activation');
assert.strictEqual(Number(userAfterBuy.extra_bottles), 10, 'Extra bottles must be 10 immediately upon activation');

const kyivToday = db.getKyivDateTime(new Date());
assert.strictEqual(userAfterBuy.daily_boosters_last_date, kyivToday.dateStr, 'Last date must be marked as today in Kyiv time');

console.log('✅ Step 1 PASS: First accrual (+10 of all 4 boosters) credited immediately upon purchase!');

// 3. Test same day at 23:59:00 Kyiv
// Because today was already credited upon activation, tonight at 23:59 MUST NOT give a duplicate accrual!
const tonight2359 = new Date();
const parts = kyivToday.dateStr.split('-');
const tonightDate = new Date(`${parts[0]}-${parts[1]}-${parts[2]}T23:59:15+03:00`);

const tonightCheck = db.accrueDailyBoostersForUser(testTid, tonightDate);
assert.strictEqual(tonightCheck.accrued, false, 'Must NOT accrue a second time on the activation day at 23:59');

const userTonight = db.getUser(testTid);
assert.strictEqual(Number(userTonight.hints), 10, 'Hints must remain 10 tonight (no duplicate)');
assert.strictEqual(Number(userTonight.daily_boosters_days_left), 30, 'Days left must remain 30');

console.log('✅ Step 2 PASS: No duplicate accrual on activation day at 23:59 Kyiv!');

// 4. Test NEXT DAY after 23:59 Kyiv (e.g. 23:59 on the next day)
// Player MUST receive the 2nd daily accrual (+10 of all 4 boosters) and days left becomes 29!
const tomorrowDate = new Date(tonightDate.getTime() + 24 * 3600 * 1000 + 10000); // next day at 23:59:25 Kyiv
const tomorrowCheck = db.accrueDailyBoostersForUser(testTid, tomorrowDate);
assert.strictEqual(tomorrowCheck.accrued, true, 'Must accrue next day after 23:59 Kyiv');
assert.strictEqual(tomorrowCheck.dueCount, 1, 'Due count must be 1');
assert.strictEqual(tomorrowCheck.newDaysLeft, 29, 'New days left must be 29');

const userTomorrow = db.getUser(testTid);
assert.strictEqual(Number(userTomorrow.hints), 20, 'Hints must now be 20 (+10)');
assert.strictEqual(Number(userTomorrow.undos), 20, 'Undos must now be 20 (+10)');
assert.strictEqual(Number(userTomorrow.reveals), 20, 'Reveals must now be 20 (+10)');
assert.strictEqual(Number(userTomorrow.extra_bottles), 20, 'Extra bottles must now be 20 (+10)');
assert.strictEqual(Number(userTomorrow.daily_boosters_days_left), 29, 'Days left must be 29');

console.log('✅ Step 3 PASS: Next accrual occurs after 23:59 on next day (+10 each, 29 days left)!');

// 5. Test Day 3 after 23:59 Kyiv
const day3Date = new Date(tomorrowDate.getTime() + 24 * 3600 * 1000);
const day3Check = db.accrueDailyBoostersForUser(testTid, day3Date);
assert.strictEqual(day3Check.accrued, true);
assert.strictEqual(day3Check.newDaysLeft, 28);

const userDay3 = db.getUser(testTid);
assert.strictEqual(Number(userDay3.hints), 30, 'Hints must now be 30 (+10)');
assert.strictEqual(Number(userDay3.daily_boosters_days_left), 28, 'Days left must be 28');

console.log('✅ Step 4 PASS: Day 3 accrual occurs at 23:59 (+10 each, 28 days left)!');

console.log('🎉 ALL DAILY BOOSTERS TESTS PASSED 100%!');
