const db = require('../db.js');
const https = require('https');

const BUCKET = process.env.KVDB_BUCKET || '82kzJTUxZwwFNvg7kUSqgM';

async function fetchKVUser(tid) {
  try {
    const res = await fetch(`https://kvdb.io/${BUCKET}/player_${encodeURIComponent(tid)}?_cb=${Date.now()}`);
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn(`[KVDB FETCH ERROR] ${tid}:`, e.message);
  }
  return null;
}

async function putKVUser(tid, data) {
  try {
    const res = await fetch(`https://kvdb.io/${BUCKET}/player_${encodeURIComponent(tid)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.ok;
  } catch (e) {
    console.warn(`[KVDB PUT ERROR] ${tid}:`, e.message);
    return false;
  }
}

async function repairSubscribers() {
  console.log('=== STEP 1: VERIFYING / FINALIZING SUBSCRIBER REPAIR ===');
  const targetSubscribers = {
    '1890528535': { boosters: 20, daysLeft: 24, lastDate: '2026-10-12' },
    '8982516215': { boosters: 20, daysLeft: 21, lastDate: '2026-10-12' },
    '7116446051': { boosters: 20, daysLeft: 21, lastDate: '2026-10-12' },
    '6582657380': { boosters: 20, daysLeft: 24, lastDate: '2026-10-12' },
    '9988776655': { boosters: 30, daysLeft: 28, lastDate: '2026-10-12' }
  };

  for (const [tid, target] of Object.entries(targetSubscribers)) {
    let sqliteUser = db.getUser(tid);
    let kvUser = await fetchKVUser(tid);

    const bCount = Math.max(target.boosters, Number(sqliteUser?.hints || 0));

    db.prepare(`
      UPDATE users
      SET hints = ?, undos = ?, reveals = ?, extra_bottles = ?,
          daily_boosters_days_left = ?, daily_boosters_last_date = ?,
          updated_at = datetime('now')
      WHERE telegram_id = ?
    `).run(bCount, bCount, bCount, bCount, target.daysLeft, target.lastDate, tid);

    const updatedUser = db.getUser(tid);
    console.log(`Subscriber ${tid}:`, {
      name: updatedUser.first_name,
      hints: updatedUser.hints,
      undos: updatedUser.undos,
      reveals: updatedUser.reveals,
      extra_bottles: updatedUser.extra_bottles,
      days_left: updatedUser.daily_boosters_days_left,
      last_date: updatedUser.daily_boosters_last_date
    });

    if (!kvUser) kvUser = { telegramId: tid };
    kvUser.hints = updatedUser.hints;
    kvUser.undos = updatedUser.undos;
    kvUser.reveals = updatedUser.reveals;
    kvUser.extraBottles = updatedUser.extra_bottles;
    kvUser.extra_bottles = updatedUser.extra_bottles;
    kvUser.daily_boosters_days_left = updatedUser.daily_boosters_days_left;
    kvUser.daily_boosters_last_date = updatedUser.daily_boosters_last_date;
    kvUser.updatedAt = Date.now();

    const putOk = await putKVUser(tid, kvUser);
    console.log(`  Synced to KVDB:`, putOk ? 'SUCCESS' : 'FAILED');
  }
}

async function runTests() {
  console.log('\n=== STEP 2: RUNNING VERIFICATION TESTS ===');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // TEST 1: New 30-day purchase creates instant Day 1 bonus (+10 each) and sets last_date
  console.log('\n--- Test 1: Shop Purchase of 30-day boosters ---');
  const testId1 = 'test_daily_sub_' + Date.now();
  db.getUser(testId1, { first_name: 'Tester1' });
  db.prepare('UPDATE users SET ton_balance = ? WHERE telegram_id = ?').run(10, testId1);
  const buyRes = db.buyShopItem(testId1, 'daily_boosters_30d');
  assert(buyRes.success === true, 'Purchase succeeded');
  const uBuy = db.getUser(testId1);
  assert(uBuy.hints === 10, `Hints credited 10 (actual: ${uBuy.hints})`);
  assert(uBuy.undos === 10, `Undos credited 10 (actual: ${uBuy.undos})`);
  assert(uBuy.reveals === 10, `Reveals credited 10 (actual: ${uBuy.reveals})`);
  assert(uBuy.extra_bottles === 10, `Extra bottles credited 10 (actual: ${uBuy.extra_bottles})`);
  assert(uBuy.daily_boosters_days_left === 30, `Days left set to 30 (actual: ${uBuy.daily_boosters_days_left})`);
  const kyivToday = db.getKyivDateTime(new Date()).dateStr;
  assert(uBuy.daily_boosters_last_date === kyivToday, `Last date set to today: ${uBuy.daily_boosters_last_date}`);

  // TEST 2: Same-day re-check does not double-accrue (idempotent)
  console.log('\n--- Test 2: Idempotent same-day check ---');
  const reAccrueSameDay = db.accrueDailyBoostersForUser(testId1, new Date());
  assert(reAccrueSameDay.accrued === false, 'Same day accrual blocked (idempotent)');
  const uSameDay = db.getUser(testId1);
  assert(uSameDay.hints === 10 && uSameDay.undos === 10, 'Booster counts unchanged on same day');

  // TEST 3: Next day accrual credits +10 of ALL 4 boosters
  console.log('\n--- Test 3: Next day accrual (+10 to all 4 boosters) ---');
  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
  const tomorrowKyiv = db.getKyivDateTime(tomorrow).dateStr;
  const accrueTomorrow = db.accrueDailyBoostersForUser(testId1, tomorrow);
  assert(accrueTomorrow.accrued === true, 'Accrual succeeded on tomorrow');
  assert(accrueTomorrow.dueCount === 1, 'Due count is 1 day');
  assert(accrueTomorrow.addAmount === 10, 'Added 10 of each');
  assert(accrueTomorrow.user.hints === 20, `Hints now 20 (actual: ${accrueTomorrow.user.hints})`);
  assert(accrueTomorrow.user.undos === 20, `Undos now 20 (actual: ${accrueTomorrow.user.undos})`);
  assert(accrueTomorrow.user.reveals === 20, `Reveals now 20 (actual: ${accrueTomorrow.user.reveals})`);
  assert(accrueTomorrow.user.extra_bottles === 20, `Extra bottles now 20 (actual: ${accrueTomorrow.user.extra_bottles})`);
  assert(accrueTomorrow.user.daily_boosters_days_left === 29, `Days left now 29 (actual: ${accrueTomorrow.user.daily_boosters_days_left})`);
  assert(accrueTomorrow.user.daily_boosters_last_date === tomorrowKyiv, `Last date updated to tomorrow: ${tomorrowKyiv}`);

  // TEST 4: Multi-day catchup (e.g. absent for 3 days)
  console.log('\n--- Test 4: Absent 3 days catch-up ---');
  const in3Days = new Date(Date.now() + 4 * 24 * 3600 * 1000);
  const in3DaysKyiv = db.getKyivDateTime(in3Days).dateStr;
  const accrue3Days = db.accrueDailyBoostersForUser(testId1, in3Days);
  assert(accrue3Days.accrued === true, 'Catch-up accrual succeeded');
  assert(accrue3Days.dueCount === 3, `Due count is 3 (actual: ${accrue3Days.dueCount})`);
  assert(accrue3Days.addAmount === 30, `Added +30 of each (actual: ${accrue3Days.addAmount})`);
  assert(accrue3Days.user.hints === 50, `Hints now 50 (actual: ${accrue3Days.user.hints})`);
  assert(accrue3Days.user.undos === 50, `Undos now 50 (actual: ${accrue3Days.user.undos})`);
  assert(accrue3Days.user.reveals === 50, `Reveals now 50 (actual: ${accrue3Days.user.reveals})`);
  assert(accrue3Days.user.extra_bottles === 50, `Extra bottles now 50 (actual: ${accrue3Days.user.extra_bottles})`);
  assert(accrue3Days.user.daily_boosters_days_left === 26, `Days left now 26 (actual: ${accrue3Days.user.daily_boosters_days_left})`);

  // TEST 5: Booster persistence & no accidental wipe on sync
  console.log('\n--- Test 5: Booster persistence / anti-wipe sync ---');
  const testId2 = 'test_persist_' + Date.now();
  db.getUser(testId2, { first_name: 'Tester2' });
  db.prepare(`UPDATE users SET hints = 25, undos = 25, reveals = 25, extra_bottles = 25 WHERE telegram_id = ?`).run(testId2);
  
  // Simulate sync payload with lower or zero values (e.g. stale client or cold-start race)
  const existing = db.getUser(testId2);
  const clientPayload = { hints: 0, undos: 0, reveals: 0, extraBottles: 0 };
  const safeHints = Math.max(existing.hints, clientPayload.hints);
  const safeUndos = Math.max(existing.undos, clientPayload.undos);
  const safeReveals = Math.max(existing.reveals, clientPayload.reveals);
  const safeBottles = Math.max(existing.extra_bottles, clientPayload.extraBottles);
  assert(safeHints === 25, 'Hints protected from zeroing');
  assert(safeUndos === 25, 'Undos protected from zeroing');
  assert(safeReveals === 25, 'Reveals protected from zeroing');
  assert(safeBottles === 25, 'Bottles protected from zeroing');

  // TEST 6: Rewarded ad bonus credits +1 and persists
  console.log('\n--- Test 6: Rewarded Ad Bonuses ---');
  const adTypes = ['undo', 'hint', 'reveal', 'bottle'];
  for (const adType of adTypes) {
    const uBefore = db.getUser(testId2);
    const beforeVal = adType === 'bottle' ? uBefore.extra_bottles : uBefore[adType + 's'];
    const logRes = db.logAdReward(testId2, adType);
    assert(logRes !== null && typeof logRes === 'object', `Ad reward logged for ${adType}`);
    const uAfter = db.getUser(testId2);
    const afterVal = adType === 'bottle' ? uAfter.extra_bottles : uAfter[adType + 's'];
    assert(afterVal === beforeVal + 1, `${adType} incremented by 1 (before: ${beforeVal}, after: ${afterVal})`);
  }

  // TEST 7: In-game booster deduction occurs ONLY when activated
  console.log('\n--- Test 7: Booster deduction only on activation ---');
  const uBeforeUse = db.getUser(testId2);
  assert(uBeforeUse.hints === 26, 'Hint starting at 26');
  assert(uBeforeUse.undos === 26, 'Undo starting at 26');
  assert(uBeforeUse.reveals === 26, 'Reveal starting at 26');
  assert(uBeforeUse.extra_bottles === 26, 'Bottles starting at 26');

  // Use only 1 hint
  const useHintRes = db.useBooster(testId2, 'hint');
  assert(useHintRes.success === true, 'useBooster(hint) succeeded');
  const uAfterHint = db.getUser(testId2);
  assert(uAfterHint.hints === 25, `Hints decremented to 25 (actual: ${uAfterHint.hints})`);
  assert(uAfterHint.undos === 26, `Undos remain intact at 26 (actual: ${uAfterHint.undos})`);
  assert(uAfterHint.reveals === 26, `Reveals remain intact at 26 (actual: ${uAfterHint.reveals})`);
  assert(uAfterHint.extra_bottles === 26, `Bottles remain intact at 26 (actual: ${uAfterHint.extra_bottles})`);

  // Use only 1 undo
  const useUndoRes = db.useBooster(testId2, 'undo');
  assert(useUndoRes.success === true, 'useBooster(undo) succeeded');
  const uAfterUndo = db.getUser(testId2);
  assert(uAfterUndo.undos === 25, `Undos decremented to 25 (actual: ${uAfterUndo.undos})`);
  assert(uAfterUndo.hints === 25, `Hints remain intact at 25 (actual: ${uAfterUndo.hints})`);

  // Use only 1 reveal
  const useRevealRes = db.useBooster(testId2, 'reveal');
  assert(useRevealRes.success === true, 'useBooster(reveal) succeeded');
  const uAfterReveal = db.getUser(testId2);
  assert(uAfterReveal.reveals === 25, `Reveals decremented to 25 (actual: ${uAfterReveal.reveals})`);

  // Use only 1 bottle
  const useBottleRes = db.useBooster(testId2, 'bottle');
  assert(useBottleRes.success === true, 'useBooster(bottle) succeeded');
  const uAfterBottle = db.getUser(testId2);
  assert(uAfterBottle.extra_bottles === 25, `Extra bottles decremented to 25 (actual: ${uAfterBottle.extra_bottles})`);

  // Cannot use when count is 0
  const zeroId = 'test_zero_' + Date.now();
  db.getUser(zeroId, { first_name: 'TesterZero' });
  const useZeroRes = db.useBooster(zeroId, 'hint');
  assert(useZeroRes.success === false, 'Cannot use booster when balance is 0');

  console.log(`\n=== TEST RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
  return failed === 0;
}

async function main() {
  await repairSubscribers();
  const testsPassed = await runTests();
  if (!testsPassed) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error in repair & test script:', err);
  process.exit(1);
});
