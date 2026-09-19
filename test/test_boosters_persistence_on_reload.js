const assert = require('assert');
const db = require('../db');

console.log('🧪 RUNNING BOOSTERS PERSISTENCE ON RELOAD & RE-ENTRY TEST SUITE');

// 1. Setup a test player
const pId = 'persistence_test_player_' + Date.now();
const p = db.getUser(pId, { first_name: 'Persistence Tester', username: 'tester' });

// Add TON balance to allow purchases
db.addBonus(pId, { tonBalance: 10.0 });
assert.strictEqual(db.getUser(pId).ton_balance, 10.0);

// 2. Buy shop items (Chest upgrades for GRAM)
console.log('\n--- Step 1: Buying chest items (hints, extra bottles, reveals, undos) ---');
const buyHints = db.buyShopItem(pId, 'hints_pack_20');
assert.strictEqual(buyHints.success, true);
assert.strictEqual(buyHints.user.hints, 20);

const buyBottles = db.buyShopItem(pId, 'bottles_pack_15');
assert.strictEqual(buyBottles.success, true);
assert.strictEqual(buyBottles.user.extra_bottles, 15);

const buyReveals = db.buyShopItem(pId, 'reveals_pack_20');
assert.strictEqual(buyReveals.success, true);
assert.strictEqual(buyReveals.user.reveals, 20);

const buyUndos = db.buyShopItem(pId, 'undos_pack_20');
assert.strictEqual(buyUndos.success, true);
assert.strictEqual(buyUndos.user.undos, 20);

// 3. Earn ad rewards (+1 hint, +1 extra_bottle)
console.log('\n--- Step 2: Earning ad rewards ---');
db.logAdReward(pId, 'hints');
db.logAdReward(pId, 'extra_bottle');

const userAfterEarn = db.getUser(pId);
assert.strictEqual(userAfterEarn.hints, 21, 'User should have 21 hints (20 shop + 1 ad)');
assert.strictEqual(userAfterEarn.extra_bottles, 16, 'User should have 16 extra bottles (15 shop + 1 ad)');
assert.strictEqual(userAfterEarn.reveals, 20, 'User should have 20 reveals');
assert.strictEqual(userAfterEarn.undos, 20, 'User should have 20 undos');
console.log('✅ Boosters successfully acquired and verified in DB');

// 4. Simulate Client App Logic on Reload / Re-entry
console.log('\n--- Step 3: Simulating Page Reload / Re-entry ---');

// Simulated local storage user
let currentUser = {
  telegramId: pId,
  hints: userAfterEarn.hints,
  extraBottles: userAfterEarn.extra_bottles,
  extra_bottles: userAfterEarn.extra_bottles,
  reveals: userAfterEarn.reveals,
  undos: userAfterEarn.undos,
  purchasesResetAt: userAfterEarn.purchases_reset_at || 0,
  all_colors_until: 0,
  all_colors_purchased_at: 0
};

// Simulation of /api/user/init response with historical purchasesResetAt (e.g. from an earlier admin reset)
const serverPurchasesReset = db.getPurchasesResetTimestamp ? db.getPurchasesResetTimestamp() : 0;
const serverUser = {
  success: true,
  purchasesResetAt: serverPurchasesReset,
  user: db.getUser(pId)
};

// Apply the fixed /api/user/init client-side sync logic (safe merge, no destructive resets)
if (serverUser.user.hints !== undefined) currentUser.hints = Math.max(currentUser.hints || 0, Number(serverUser.user.hints || 0));
if (serverUser.user.undos !== undefined) currentUser.undos = Math.max(currentUser.undos || 0, Number(serverUser.user.undos || 0));
if (serverUser.user.reveals !== undefined) currentUser.reveals = Math.max(currentUser.reveals || 0, Number(serverUser.user.reveals || 0));
const serverB = serverUser.user.extra_bottles !== undefined ? serverUser.user.extra_bottles : serverUser.user.extraBottles;
if (serverB !== undefined) {
  const maxB = Math.max(currentUser.extraBottles || 0, currentUser.extra_bottles || 0, Number(serverB || 0));
  currentUser.extraBottles = maxB;
  currentUser.extra_bottles = maxB;
}

// Verify that boosters DID NOT disappear on reload
assert.strictEqual(currentUser.hints, 21, 'Hints MUST NOT disappear on reload!');
assert.strictEqual(currentUser.extraBottles, 16, 'Extra bottles MUST NOT disappear on reload!');
assert.strictEqual(currentUser.reveals, 20, 'Reveals MUST NOT disappear on reload!');
assert.strictEqual(currentUser.undos, 20, 'Undos MUST NOT disappear on reload!');
console.log('✅ Boosters successfully preserved across reload simulation!');

// 5. Simulate Gameplay Booster Consumption (Using 1 hint, 1 bottle, 1 reveal, 1 undo)
console.log('\n--- Step 4: Simulating Gameplay Consumption (Only deduct when used) ---');
// Use 1 hint
currentUser.hints = Math.max(0, (currentUser.hints || 0) - 1);
db.updateUserProgress(pId, { hintsUsed: 1, hints: currentUser.hints });

// Use 1 extra bottle
currentUser.extraBottles = Math.max(0, (currentUser.extraBottles || 0) - 1);
currentUser.extra_bottles = currentUser.extraBottles;
db.updateUserProgress(pId, { extraBottlesUsed: 1, extraBottles: currentUser.extraBottles });

// Use 1 reveal
currentUser.reveals = Math.max(0, (currentUser.reveals || 0) - 1);
db.updateUserProgress(pId, { revealsUsed: 1, reveals: currentUser.reveals });

// Use 1 undo
currentUser.undos = Math.max(0, (currentUser.undos || 0) - 1);
db.updateUserProgress(pId, { undosUsed: 1, undos: currentUser.undos });

const userAfterUse = db.getUser(pId);
assert.strictEqual(userAfterUse.hints, 20, 'Hints should be exactly 20 after 1 use');
assert.strictEqual(userAfterUse.extra_bottles, 15, 'Extra bottles should be exactly 15 after 1 use');
assert.strictEqual(userAfterUse.reveals, 19, 'Reveals should be exactly 19 after 1 use');
assert.strictEqual(userAfterUse.undos, 19, 'Undos should be exactly 19 after 1 use');
console.log('✅ Boosters only deducted when used!');

// 6. Simulate a Second Reload after usage
console.log('\n--- Step 5: Second Reload after usage ---');
const serverUser2 = {
  success: true,
  purchasesResetAt: serverPurchasesReset,
  user: db.getUser(pId)
};

if (serverUser2.user.hints !== undefined) currentUser.hints = Math.max(currentUser.hints || 0, Number(serverUser2.user.hints || 0));
const serverB2 = serverUser2.user.extra_bottles !== undefined ? serverUser2.user.extra_bottles : serverUser2.user.extraBottles;
if (serverB2 !== undefined) {
  currentUser.extraBottles = Math.max(currentUser.extraBottles || 0, Number(serverB2 || 0));
}

assert.strictEqual(currentUser.hints, 20, 'Hints must remain 20 on second reload');
assert.strictEqual(currentUser.extraBottles, 15, 'Extra bottles must remain 15 on second reload');
console.log('✅ Boosters correctly maintained after second reload!');

console.log('\n🎉 ALL BOOSTERS PERSISTENCE TESTS PASSED SUCCESSFULLY!');
