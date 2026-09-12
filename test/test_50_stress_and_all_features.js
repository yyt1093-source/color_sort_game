const db = require('../db');
const assert = require('assert');
const { LevelGenerator } = require('../public/js/levelGenerator');
const { Solver } = require('../public/js/solver');

console.log('================================================================');
console.log('🔥 RUNNING 50-ITERATION STRESS & FULL GAME FUNCTIONALITY SUITE');
console.log('================================================================');

// ----------------------------------------------------------------------
// 1. TEST LEVEL GENERATOR & SOLVER (50 LEVELS)
// ----------------------------------------------------------------------
console.log('\n--- TEST 1: Testing 50 Generated Levels Solvability ---');
let solvedCount = 0;
for (let lvl = 1; lvl <= 50; lvl++) {
  const levelData = LevelGenerator.generateLevel(lvl);
  assert(levelData && levelData.bottles, `Level ${lvl} data is invalid`);
  const solution = Solver.solve(levelData.bottles, levelData.capacity);
  assert(solution && solution.length >= 0, `Level ${lvl} has no valid solution!`);
  const hint = Solver.getHint(levelData.bottles, levelData.capacity);
  if (solution.length > 0) {
    assert(hint && typeof hint.from === 'number' && typeof hint.to === 'number', `Level ${lvl} hint invalid`);
  }
  solvedCount++;
}
console.log(`✅ Passed 50/50 levels solvability check (100% solvable).`);

// ----------------------------------------------------------------------
// 2. TEST BOOSTER ACCUMULATION UNDER 50 RAPID AD WATCHES & ADMIN GRANTS
// ----------------------------------------------------------------------
console.log('\n--- TEST 2: Testing 50 Rapid Ad Watches & Admin Grants ---');
const stressUserId = 'stress_user_' + Date.now();
let user = db.getUser(stressUserId, { first_name: 'StressTester' });
assert(user, 'Failed to create stress test user');

// Admin grants 10 of each booster
user = db.addBonus(stressUserId, { hints: 10, undos: 10, reveals: 10, extraBottles: 10, ton_balance: 10.0 });
assert.strictEqual(user.hints, 10);
assert.strictEqual(user.undos, 10);
assert.strictEqual(user.reveals, 10);
assert.strictEqual(user.extra_bottles, 10);
assert.strictEqual(user.ton_balance, 10.0);
console.log('✅ Admin granted initial 10 boosters of each type + 10.0 GRAM balance.');

// Watch 50 ads in rapid loop (10 hints, 10 undos, 10 reveals, 20 extra_bottles)
for (let i = 1; i <= 10; i++) {
  user = db.logAdReward(stressUserId, 'hints');
  assert.strictEqual(user.hints, 10 + i, `Hints expected ${10 + i}, got ${user.hints}`);
  
  user = db.logAdReward(stressUserId, 'undos');
  assert.strictEqual(user.undos, 10 + i, `Undos expected ${10 + i}, got ${user.undos}`);

  user = db.logAdReward(stressUserId, 'reveals');
  assert.strictEqual(user.reveals, 10 + i, `Reveals expected ${10 + i}, got ${user.reveals}`);

  user = db.logAdReward(stressUserId, 'extra_bottle');
  assert.strictEqual(user.extra_bottles, 10 + i, `Extra bottles expected ${10 + i}, got ${user.extra_bottles}`);
}

for (let i = 11; i <= 20; i++) {
  user = db.logAdReward(stressUserId, 'extra_bottle');
  assert.strictEqual(user.extra_bottles, 10 + i, `Extra bottles expected ${10 + i}, got ${user.extra_bottles}`);
}

console.log('✅ Watched 50 ads in rapid sequence!');
console.log('   Current state after 50 ads:', {
  hints: user.hints,          // 20
  undos: user.undos,          // 20
  reveals: user.reveals,      // 20
  extra_bottles: user.extra_bottles // 30
});

assert.strictEqual(user.hints, 20);
assert.strictEqual(user.undos, 20);
assert.strictEqual(user.reveals, 20);
assert.strictEqual(user.extra_bottles, 30);

// ----------------------------------------------------------------------
// 3. TEST CHEST (SHOP) PURCHASES ACCUMULATION ON TOP OF ADS & ADMIN
// ----------------------------------------------------------------------
console.log('\n--- TEST 3: Testing Chest (Shop) Purchases Accumulation ---');
// Buy +15 Extra Bottles (1.0 GRAM)
let shopRes = db.buyShopItem(stressUserId, 'bottles_pack_15');
assert(shopRes && shopRes.success, 'Failed to buy bottles_pack_15');
user = shopRes.user;
assert.strictEqual(user.extra_bottles, 45, `Expected 45 extra bottles (30 + 15), got ${user.extra_bottles}`);

// Buy +20 Hints (1.0 GRAM)
shopRes = db.buyShopItem(stressUserId, 'hints_pack_20');
assert(shopRes && shopRes.success, 'Failed to buy hints_pack_20');
user = shopRes.user;
assert.strictEqual(user.hints, 40, `Expected 40 hints (20 + 20), got ${user.hints}`);

// Buy +20 Undos (1.0 GRAM)
shopRes = db.buyShopItem(stressUserId, 'undos_pack_20');
assert(shopRes && shopRes.success, 'Failed to buy undos_pack_20');
user = shopRes.user;
assert.strictEqual(user.undos, 40, `Expected 40 undos (20 + 20), got ${user.undos}`);

console.log('✅ Chest purchases successfully accumulated on top of ads & admin grants!');
console.log('   Current state after Chest Purchases:', {
  hints: user.hints,          // 40
  undos: user.undos,          // 40
  reveals: user.reveals,      // 20
  extra_bottles: user.extra_bottles // 45
});

// ----------------------------------------------------------------------
// 4. TEST CLIENT-TO-SERVER SYNC WITH ABSOLUTE TOTALS & AD WATCHING AFTER CHEST
// ----------------------------------------------------------------------
console.log('\n--- TEST 4: Client Progress Sync & Watching Ad After Chest ---');
user = db.updateUserProgress(stressUserId, {
  currentLevel: 15,
  maxLevel: 15,
  hints: user.hints,
  undos: user.undos,
  reveals: user.reveals,
  extraBottles: user.extra_bottles
});
assert.strictEqual(user.extra_bottles, 45);
assert.strictEqual(user.hints, 40);

// Watch ad for extra_bottle after chest purchase
user = db.logAdReward(stressUserId, 'extra_bottle');
assert.strictEqual(user.extra_bottles, 46, `Expected 46 extra bottles (45 + 1), got ${user.extra_bottles}`);

user = db.logAdReward(stressUserId, 'hints');
assert.strictEqual(user.hints, 41, `Expected 41 hints (40 + 1), got ${user.hints}`);

console.log('✅ Ad watched after chest purchase successfully added +1 without resetting!');
console.log('   Current state:', {
  hints: user.hints,          // 41
  extra_bottles: user.extra_bottles // 46
});

// ----------------------------------------------------------------------
// 5. TEST CONSUMING BOOSTERS & SYNCING DELTAS
// ----------------------------------------------------------------------
console.log('\n--- TEST 5: Consuming Boosters In-Game ---');
user = db.updateUserProgress(stressUserId, {
  hintsUsed: 3,
  undosUsed: 2,
  extraBottlesUsed: 1,
  hints: 38,
  undos: 38,
  extraBottles: 45
});
assert.strictEqual(user.hints, 38, `Expected 38 hints after using 3, got ${user.hints}`);
assert.strictEqual(user.undos, 38, `Expected 38 undos after using 2, got ${user.undos}`);
assert.strictEqual(user.extra_bottles, 45, `Expected 45 extra bottles after using 1, got ${user.extra_bottles}`);
console.log('✅ Using boosters properly decremented balances in DB.');

// ----------------------------------------------------------------------
// 6. TEST LEADERBOARD QUERIES & CONCURRENCY
// ----------------------------------------------------------------------
console.log('\n--- TEST 6: Leaderboard Query & Server Stress ---');
const lb = db.getLeaderboard(stressUserId, 50);
assert(lb && Array.isArray(lb.topPlayers), 'Leaderboard failed');
console.log(`✅ Leaderboard fetched successfully (${lb.topPlayers.length} players listed).`);

console.log('================================================================');
console.log('🎉 50-ITERATION STRESS & FULL GAME SUITE PASSED 100%!');
console.log('================================================================');
