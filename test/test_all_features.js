const assert = require('assert');
const db = require('../db');
const { Solver } = require('../public/js/solver');
const { LevelGenerator } = require('../public/js/levelGenerator');

console.log('================================================================');
console.log('🧪 RUNNING FULL GLOBAL SUITE: Color Sort Game & Database Engine');
console.log('================================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(testName, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✅ [PASS] ${testName}`);
  } catch (err) {
    console.error(`  ❌ [FAIL] ${testName}: ${err.message}`);
  }
}

// ------------------------------------------------------------------
// SECTION 1: Level Generator & Solver (50 Levels)
// ------------------------------------------------------------------
console.log('--- SECTION 1: Level Generator & Solver Guarantee (Levels 1..50) ---');
let solvableCount = 0;
for (let lvl = 1; lvl <= 50; lvl++) {
  const levelData = LevelGenerator.generateLevel(lvl);
  const solution = Solver.solve(levelData.bottles, levelData.capacity);
  const hint = Solver.getHint(levelData.bottles, levelData.capacity);
  if (solution && hint && typeof hint.from === 'number' && typeof hint.to === 'number') {
    solvableCount++;
  }
}
runTest('Infinite Generator Guarantee (50/50 levels 100% solvable)', () => {
  assert.strictEqual(solvableCount, 50, 'All 50 generated levels must be 100% solvable with valid hints');
});

// ------------------------------------------------------------------
// SECTION 2: Database & User Progress
// ------------------------------------------------------------------
console.log('\n--- SECTION 2: Database User Accounts & Progress ---');

const testId = 'test_user_' + Date.now();

runTest('Create/Get User Account', () => {
  const user = db.getUser(testId, { first_name: 'ТестовыйИгрок', username: 'testplayer' });
  assert.ok(user, 'User object should be created');
  assert.strictEqual(user.first_name, 'ТестовыйИгрок');
  assert.strictEqual(user.max_level, 1);
  assert.strictEqual(user.current_level, 1);
  assert.ok(user.memo_code.startsWith('SORT-'), 'Memo code should be generated');
});

runTest('Update User Progress after Level Completion', () => {
  const updated = db.updateUserProgress(testId, {
    currentLevel: 2,
    maxLevel: 2,
    starsAdded: 3,
    coinsAdded: 50
  });
  assert.strictEqual(updated.current_level, 2);
  assert.strictEqual(updated.max_level, 2);
  assert.strictEqual(updated.stars, 3);
});

// ------------------------------------------------------------------
// SECTION 3: Boosters & Ad Rewards Logging
// ------------------------------------------------------------------
console.log('\n--- SECTION 3: Boosters, Admin Grants & Ad Rewards ---');

runTest('Add Bonus Perks (Admin / Rewards)', () => {
  const bonusUser = db.addBonus(testId, {
    hints: 5,
    undos: 5,
    reveals: 5,
    extraBottles: 5,
    tonBalance: 10.0
  });
  assert.strictEqual(bonusUser.hints, 5);
  assert.strictEqual(bonusUser.undos, 5);
  assert.strictEqual(bonusUser.reveals, 5);
  assert.strictEqual(bonusUser.extra_bottles, 5);
  assert.strictEqual(bonusUser.ton_balance, 10.0);
});

runTest('Log Rewarded Ads', () => {
  const adUser = db.logAdReward(testId, 'hints');
  assert.strictEqual(adUser.hints, 6, 'Ad reward should increment hint stock');
  const count = db.getAdRewardsCount(testId);
  assert.strictEqual(count, 1, 'Today ad reward count should be 1');
});

// ------------------------------------------------------------------
// SECTION 4: Shop & TON Purchases
// ------------------------------------------------------------------
console.log('\n--- SECTION 4: Shop Purchases & GRAM Balances ---');

runTest('Shop Purchase: All Colors 15 Days (5 GRAM)', () => {
  const result = db.buyShopItem(testId, 'all_colors_15d');
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.user.ton_balance, 5.0);
  assert.ok(result.user.all_colors_until > Date.now(), 'Active perk expiration date should be in future');
});

runTest('Shop Purchase with Insufficient Balance', () => {
  const poorId = 'poor_user_' + Date.now();
  db.getUser(poorId); // balance = 0
  const result = db.buyShopItem(poorId, 'all_colors_15d');
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.error, 'insufficient_balance');
});

runTest('Record TON Deposit', () => {
  const depositRes = db.recordTonDeposit(testId, 2.5, 'SORT-12345', 'UQTestWalletAddress');
  assert.ok(depositRes, 'Deposit result should exist');
  assert.strictEqual(depositRes.user.ton_balance, 7.5);
});

// ------------------------------------------------------------------
// SECTION 5: Admin Resets (Single Account, All Accounts, Season Reset)
// ------------------------------------------------------------------
console.log('\n--- SECTION 5: Admin Resets (Single Account, All Purchases, Season) ---');

runTest('Admin Reset Single Account Purchases', () => {
  const resetRes = db.resetGramPurchasesSingle(testId);
  assert.strictEqual(resetRes.success, true);
  const user = db.getUser(testId);
  assert.strictEqual(user.all_colors_until, 0);
  assert.strictEqual(user.hints, 0);
  assert.strictEqual(user.extra_bottles, 0);
  assert.strictEqual(user.ton_balance, 7.5, 'TON wallet balance MUST be preserved during perk reset!');
});

runTest('Admin Reset ALL GRAM Purchases', () => {
  const resetAllRes = db.resetGramPurchases();
  assert.strictEqual(resetAllRes.success, true);
  const user = db.getUser(testId);
  assert.strictEqual(user.all_colors_until, 0);
});

runTest('Admin Season Reset (Zero Stats, Preserves Accounts)', () => {
  const seasonRes = db.resetSeason();
  assert.strictEqual(seasonRes.success, true);
  const user = db.getUser(testId);
  assert.strictEqual(user.current_level, 1);
  assert.strictEqual(user.max_level, 1);
  assert.strictEqual(user.stars, 0);
  assert.strictEqual(user.coins, 0);
  assert.strictEqual(user.hints, 0);
  assert.strictEqual(user.extra_bottles, 0);
});

// ------------------------------------------------------------------
// SECTION 6: Referral Program
// ------------------------------------------------------------------
console.log('\n--- SECTION 6: Referral Program (+5 to All Boosters) ---');

const refOwnerId = 'ref_owner_' + Date.now();
const refFriendId = 'ref_friend_' + Date.now();

runTest('Register Referral', () => {
  db.getUser(refOwnerId, { first_name: 'Пригласивший' });
  const regRes = db.registerReferral(refOwnerId, refFriendId, 'ДругВступивший', 'friend_uname');
  assert.strictEqual(regRes.success, true);
});

runTest('Claim Referral Rewards (+5 to All Boosters)', () => {
  const claimRes = db.claimReferralReward(refOwnerId);
  assert.strictEqual(claimRes.success, true);
  assert.strictEqual(claimRes.bonusesAdded.extraBottles, 5);
  assert.strictEqual(claimRes.bonusesAdded.hints, 5);
  assert.strictEqual(claimRes.bonusesAdded.undos, 5);
  assert.strictEqual(claimRes.bonusesAdded.reveals, 5);
  assert.strictEqual(claimRes.user.hints, 5);
  assert.strictEqual(claimRes.user.extra_bottles, 5);
});

// ------------------------------------------------------------------
// SUMMARY RESULTS
// ------------------------------------------------------------------
console.log('\n================================================================');
console.log(`📊 TEST SUITE RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
console.log('================================================================');

if (passedTests === totalTests) {
  console.log('🎉 ALL FEATURE TESTS PASSED 100%! SYSTEM FULLY VERIFIED.');
  process.exit(0);
} else {
  console.error('⚠️ SOME TESTS FAILED!');
  process.exit(1);
}
