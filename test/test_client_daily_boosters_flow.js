// test/test_client_daily_boosters_flow.js
const assert = require('assert');

console.log('🧪 ========================================================');
console.log('🧪 Starting Client Simulation: Daily Boosters Flow');
console.log('🧪 ========================================================');

// Mock localStorage
const mockStorage = {};
const localStorage = {
  getItem: (k) => (k in mockStorage ? mockStorage[k] : null),
  setItem: (k, v) => { mockStorage[k] = String(v); },
  removeItem: (k) => { delete mockStorage[k]; }
};

// Helper mirroring getKyivDateTimeBrowser from app.js
function getKyivDateTimeBrowser(dateObj = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Kyiv',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(dateObj);
  const partMap = {};
  for (const p of parts) {
    if (p.type !== 'literal') partMap[p.type] = p.value;
  }
  const dateStr = `${partMap.year}-${partMap.month}-${partMap.day}`;
  const hour = parseInt(partMap.hour, 10);
  const minute = parseInt(partMap.minute, 10);
  const second = parseInt(partMap.second, 10);
  return { dateStr, hour, minute, second };
}

// Logic mirroring checkAndApplyClientDailyBoosters from app.js
function runClientDailyBoostersCheck(currentUser, mockDate = new Date()) {
  if (!currentUser || !currentUser.telegramId) return;
  const daysLeft = Number(currentUser.daily_boosters_days_left || 0);
  if (daysLeft <= 0) return;

  const now = mockDate;
  const kyiv = getKyivDateTimeBrowser(now);

  const initCreditedKey = `color_sort_daily_boosters_init_credited_${currentUser.telegramId}`;
  const wasInitCredited = localStorage.getItem(initCreditedKey) === '1' || currentUser.daily_boosters_init_credited === true;

  // Check if initial accrual upon activation was missed
  if (!wasInitCredited) {
    localStorage.setItem(initCreditedKey, '1');
    currentUser.daily_boosters_init_credited = true;
    currentUser.hints = (currentUser.hints || 0) + 10;
    currentUser.undos = (currentUser.undos || 0) + 10;
    currentUser.reveals = (currentUser.reveals || 0) + 10;
    currentUser.extraBottles = (currentUser.extraBottles || 0) + 10;
    currentUser.extra_bottles = currentUser.extraBottles;
    currentUser.daily_boosters_last_date = kyiv.dateStr;
    currentUser.dailyBoostersLastDate = kyiv.dateStr;

    localStorage.setItem(`color_sort_daily_boosters_days_${currentUser.telegramId}`, String(currentUser.daily_boosters_days_left || 0));
    localStorage.setItem(`color_sort_daily_boosters_date_${currentUser.telegramId}`, kyiv.dateStr);
    return { creditedInitial: true };
  }

  let latestEligibleDate = null;
  if (kyiv.hour === 23 && kyiv.minute >= 59) {
    latestEligibleDate = kyiv.dateStr;
  } else {
    const yesterday = new Date(now.getTime() - 24 * 3600 * 1000);
    latestEligibleDate = getKyivDateTimeBrowser(yesterday).dateStr;
  }

  const lastDate = (currentUser.daily_boosters_last_date || '').trim();
  if (!lastDate) {
    currentUser.daily_boosters_last_date = kyiv.dateStr;
    currentUser.dailyBoostersLastDate = kyiv.dateStr;
    return { credited: false, reason: 'init_last_date' };
  }

  if (lastDate >= latestEligibleDate) {
    return { credited: false, reason: 'already_up_to_date' };
  }

  const lastParts = lastDate.split('-').map(Number);
  const eligParts = latestEligibleDate.split('-').map(Number);
  const dLast = Date.UTC(lastParts[0], lastParts[1] - 1, lastParts[2]);
  const dElig = Date.UTC(eligParts[0], eligParts[1] - 1, eligParts[2]);
  const diffDays = Math.round((dElig - dLast) / (24 * 3600 * 1000));

  if (diffDays <= 0) return { credited: false };

  const daysToAccrue = Math.min(diffDays, daysLeft);
  if (daysToAccrue <= 0) return { credited: false };

  const bonusPerType = daysToAccrue * 10;
  currentUser.undos = (currentUser.undos || 0) + bonusPerType;
  currentUser.hints = (currentUser.hints || 0) + bonusPerType;
  currentUser.reveals = (currentUser.reveals || 0) + bonusPerType;
  currentUser.extraBottles = (currentUser.extraBottles || 0) + bonusPerType;
  currentUser.extra_bottles = currentUser.extraBottles;

  currentUser.daily_boosters_days_left = Math.max(0, daysLeft - daysToAccrue);
  currentUser.dailyBoostersDaysLeft = currentUser.daily_boosters_days_left;
  currentUser.daily_boosters_last_date = latestEligibleDate;
  currentUser.dailyBoostersLastDate = latestEligibleDate;

  return { credited: true, bonusPerType, newDaysLeft: currentUser.daily_boosters_days_left };
}

// Logic mirroring client purchase in app.js
function runClientPurchase(currentUser, now = new Date()) {
  const kyiv = getKyivDateTimeBrowser(now);
  const price = 5.0;
  currentUser.ton_balance = Math.max(0, currentUser.ton_balance - price);
  currentUser.daily_boosters_days_left = (currentUser.daily_boosters_days_left || 0) + 30;
  currentUser.dailyBoostersDaysLeft = currentUser.daily_boosters_days_left;
  currentUser.daily_boosters_last_date = kyiv.dateStr;
  currentUser.dailyBoostersLastDate = kyiv.dateStr;
  currentUser.daily_boosters_purchased_at = now.getTime();
  currentUser.dailyBoostersPurchasedAt = now.getTime();

  localStorage.setItem(`color_sort_daily_boosters_init_credited_${currentUser.telegramId}`, '1');
  currentUser.daily_boosters_init_credited = true;

  // Immediate first accrual
  currentUser.hints = (currentUser.hints || 0) + 10;
  currentUser.undos = (currentUser.undos || 0) + 10;
  currentUser.reveals = (currentUser.reveals || 0) + 10;
  currentUser.extraBottles = (currentUser.extraBottles || 0) + 10;
  currentUser.extra_bottles = currentUser.extraBottles;
}

// TEST 1: Purchase flow
console.log('\n--- Test 1: Immediate accrual on client purchase ---');
const player = {
  telegramId: 'simulated_player_123',
  ton_balance: 10.0,
  hints: 0,
  undos: 0,
  reveals: 0,
  extraBottles: 0,
  daily_boosters_days_left: 0
};

const purchaseTime = new Date('2026-10-05T12:00:00+03:00');
runClientPurchase(player, purchaseTime);

assert.strictEqual(player.ton_balance, 5.0, 'Balance must be 5.0');
assert.strictEqual(player.hints, 10, 'Hints must be 10 immediately');
assert.strictEqual(player.undos, 10, 'Undos must be 10 immediately');
assert.strictEqual(player.reveals, 10, 'Reveals must be 10 immediately');
assert.strictEqual(player.extraBottles, 10, 'Bottles must be 10 immediately');
assert.strictEqual(player.daily_boosters_days_left, 30, 'Days left must be 30');
assert.strictEqual(player.daily_boosters_last_date, '2026-10-05', 'Last date must be 2026-10-05');
console.log('✅ PASS: Immediate accrual on client purchase successful');

// TEST 2: Client app relaunch same day (13:00)
console.log('\n--- Test 2: Client app relaunch 1 hour later ---');
const checkSameDay1300 = runClientDailyBoostersCheck(player, new Date('2026-10-05T13:00:00+03:00'));
assert.strictEqual(checkSameDay1300.credited, false, 'Must not credit at 13:00');
assert.strictEqual(player.hints, 10, 'Hints must remain 10');
assert.strictEqual(player.daily_boosters_days_left, 30, 'Days left must remain 30');
console.log('✅ PASS: No double crediting on app relaunch');

// TEST 3: Same day at 23:59:10
console.log('\n--- Test 3: Same day at 23:59:10 (No duplicate) ---');
const checkSameDay2359 = runClientDailyBoostersCheck(player, new Date('2026-10-05T23:59:10+03:00'));
assert.strictEqual(checkSameDay2359.credited, false, 'Must not credit again on day 1 at 23:59');
assert.strictEqual(player.hints, 10, 'Hints must remain 10');
console.log('✅ PASS: Same day 23:59 duplicate prevented');

// TEST 4: Day 2 at 18:00 (before 23:59)
console.log('\n--- Test 4: Day 2 at 18:00 Kyiv ---');
const checkDay2_1800 = runClientDailyBoostersCheck(player, new Date('2026-10-06T18:00:00+03:00'));
assert.strictEqual(checkDay2_1800.credited, false, 'Must not credit before 23:59 on Day 2');
assert.strictEqual(player.hints, 10, 'Hints must remain 10');
console.log('✅ PASS: Day 2 afternoon check passed');

// TEST 5: Day 2 at 23:59:05 (Second accrual triggers!)
console.log('\n--- Test 5: Day 2 at 23:59:05 Kyiv (Accrual triggers) ---');
const checkDay2_2359 = runClientDailyBoostersCheck(player, new Date('2026-10-06T23:59:05+03:00'));
assert.strictEqual(checkDay2_2359.credited, true, 'Must credit on Day 2 at 23:59');
assert.strictEqual(player.hints, 20, 'Hints must now be 20');
assert.strictEqual(player.undos, 20, 'Undos must now be 20');
assert.strictEqual(player.reveals, 20, 'Reveals must now be 20');
assert.strictEqual(player.extraBottles, 20, 'Bottles must now be 20');
assert.strictEqual(player.daily_boosters_days_left, 29, 'Days left must now be 29');
assert.strictEqual(player.daily_boosters_last_date, '2026-10-06', 'Last date updated to 2026-10-06');
console.log('✅ PASS: Day 2 23:59 accrual awarded +10 each, days left = 29');

// TEST 6: Missed activation recovery
console.log('\n--- Test 6: Missed activation compensation ---');
const missedPlayer = {
  telegramId: 'missed_player_999',
  ton_balance: 5.0,
  hints: 0,
  undos: 0,
  reveals: 0,
  extraBottles: 0,
  daily_boosters_days_left: 30,
  daily_boosters_last_date: '2026-10-04'
};
// Player bought before patch, initCredited is false
const recoveryCheck = runClientDailyBoostersCheck(missedPlayer, new Date('2026-10-05T10:00:00+03:00'));
assert.strictEqual(recoveryCheck.creditedInitial, true, 'Must credit initial missed boosters');
assert.strictEqual(missedPlayer.hints, 10, 'Recovered player gets +10 hints');
assert.strictEqual(missedPlayer.undos, 10, 'Recovered player gets +10 undos');
assert.strictEqual(missedPlayer.reveals, 10, 'Recovered player gets +10 reveals');
assert.strictEqual(missedPlayer.extraBottles, 10, 'Recovered player gets +10 bottles');
console.log('✅ PASS: Missed activation compensation functions perfectly');

console.log('\n🎉 ALL CLIENT FLOW TESTS PASSED (100% SUCCESS)!');
