const assert = require('assert');
const db = require('../db');

console.log('🧪 RUNNING ADMIN PURCHASES & AD REWARDS RESET TEST SUITE');

// 1. Setup two test players with TON purchases, ad rewards, and boosters
const p1Id = 'player_admin_test_1_' + Date.now();
const p2Id = 'player_admin_test_2_' + Date.now();

const p1 = db.getUser(p1Id, { first_name: 'Alligator Admin', username: 'alligator' });
const p2 = db.getUser(p2Id, { first_name: 'Regular Player', username: 'player2' });

// Add TON balance, wallet, and boosters to player 1
db.addBonus(p1Id, {
  hints: 20,
  undos: 15,
  reveals: 10,
  extraBottles: 8,
  tonBalance: 12.5
});
db.updateTonWallet(p1Id, 'EQB_ALLIGATOR_WALLET_TEST');
db.buyShopItem(p1Id, 'all_colors_15d', 'gram');
db.logAdReward(p1Id, 'extra_bottle');
db.logAdReward(p1Id, 'hints');

// Add TON balance, wallet, and boosters to player 2
db.addBonus(p2Id, {
  hints: 30,
  undos: 25,
  reveals: 5,
  extraBottles: 12,
  tonBalance: 5.0
});
db.updateTonWallet(p2Id, 'EQB_PLAYER2_WALLET_TEST');
db.buyShopItem(p2Id, 'all_colors_15d', 'gram');
db.logAdReward(p2Id, 'extra_bottle');
db.logAdReward(p2Id, 'undos');

// Verify pre-conditions for Player 1
const p1Before = db.getUser(p1Id);
assert.strictEqual(p1Before.hints, 21, 'Player 1 should have 21 hints (20 bonus + 1 ad)');
assert.strictEqual(p1Before.undos, 15, 'Player 1 should have 15 undos');
assert.strictEqual(p1Before.reveals, 10, 'Player 1 should have 10 reveals');
assert.strictEqual(p1Before.extra_bottles, 9, 'Player 1 should have 9 extra bottles (8 bonus + 1 ad)');
assert.strictEqual(p1Before.ton_balance, 7.5, 'Player 1 should have 7.5 TON left after 5.0 GRAM purchase');
assert.strictEqual(p1Before.ton_wallet, 'EQB_ALLIGATOR_WALLET_TEST', 'Player 1 should have TON wallet');
assert.ok(p1Before.all_colors_until > Date.now(), 'Player 1 should have active all_colors perk');
assert.strictEqual(db.getAdRewardsCount(p1Id), 2, 'Player 1 should have 2 logged ad rewards');

// Verify pre-conditions for Player 2
const p2Before = db.getUser(p2Id);
assert.strictEqual(p2Before.hints, 30, 'Player 2 should have 30 hints');
assert.strictEqual(p2Before.undos, 26, 'Player 2 should have 26 undos (25 bonus + 1 ad)');
assert.strictEqual(p2Before.extra_bottles, 13, 'Player 2 should have 13 extra bottles (12 bonus + 1 ad)');
assert.ok(p2Before.all_colors_until > Date.now(), 'Player 2 should have active all_colors perk');
assert.strictEqual(db.getAdRewardsCount(p2Id), 2, 'Player 2 should have 2 logged ad rewards');

console.log('✅ Pre-conditions verified for both test players');

// 2. TEST: Reset only my account (Player 1)
console.log('\n--- Test 1: Reset only my account (resetGramPurchasesSingle) ---');
const singleResetRes = db.resetGramPurchasesSingle(p1Id);
assert.strictEqual(singleResetRes.success, true, 'Single reset should return success: true');
assert.strictEqual(singleResetRes.targetTelegramId, p1Id, 'Single reset should match targetTelegramId');
assert.ok(singleResetRes.resetAt > 0, 'Single reset should provide resetAt timestamp');
assert.ok(singleResetRes.user, 'Single reset should return updated user');

const p1AfterSingle = db.getUser(p1Id);
assert.strictEqual(p1AfterSingle.hints, 0, 'Player 1 hints must be 0 after reset');
assert.strictEqual(p1AfterSingle.undos, 0, 'Player 1 undos must be 0 after reset');
assert.strictEqual(p1AfterSingle.reveals, 0, 'Player 1 reveals must be 0 after reset');
assert.strictEqual(p1AfterSingle.extra_bottles, 0, 'Player 1 extra_bottles must be 0 after reset');
assert.strictEqual(p1AfterSingle.all_colors_until, 0, 'Player 1 all_colors_until must be 0 after reset');
assert.strictEqual(p1AfterSingle.all_colors_purchased_at, 0, 'Player 1 all_colors_purchased_at must be 0 after reset');
assert.strictEqual(p1AfterSingle.ton_balance, 7.5, 'Player 1 TON balance must remain INTACT (not reset)');
assert.strictEqual(p1AfterSingle.ton_wallet, 'EQB_ALLIGATOR_WALLET_TEST', 'Player 1 TON wallet must remain INTACT');
assert.strictEqual(db.getAdRewardsCount(p1Id), 0, 'Player 1 ad rewards log must be cleared');

// Ensure Player 2 was NOT affected by single reset of Player 1
const p2AfterSingle = db.getUser(p2Id);
assert.strictEqual(p2AfterSingle.hints, 30, 'Player 2 hints must NOT be touched by Player 1 reset');
assert.strictEqual(p2AfterSingle.undos, 26, 'Player 2 undos must NOT be touched by Player 1 reset');
assert.strictEqual(p2AfterSingle.extra_bottles, 13, 'Player 2 extra_bottles must NOT be touched by Player 1 reset');
assert.ok(p2AfterSingle.all_colors_until > Date.now(), 'Player 2 all_colors must NOT be touched by Player 1 reset');
assert.strictEqual(db.getAdRewardsCount(p2Id), 2, 'Player 2 ad rewards log must NOT be touched by Player 1 reset');

console.log('✅ Test 1 (resetGramPurchasesSingle) PASSED: Only Player 1 was reset to 0, assets preserved, Player 2 untouched');

// 3. TEST: Reset for ALL players in the game (resetGramPurchases)
console.log('\n--- Test 2: Reset for ALL players (resetGramPurchases) ---');
// Give Player 1 some new boosters
db.addBonus(p1Id, { hints: 5, undos: 5, extraBottles: 3 });
const p1Refilled = db.getUser(p1Id);
assert.strictEqual(p1Refilled.hints, 5, 'Player 1 should have 5 hints');

const globalResetRes = db.resetGramPurchases();
assert.strictEqual(globalResetRes.success, true, 'Global reset should return success: true');
assert.ok(globalResetRes.resetAt > 0, 'Global reset should return resetAt');

const globalTs = db.getPurchasesResetTimestamp();
assert.strictEqual(globalTs, globalResetRes.resetAt, 'getPurchasesResetTimestamp must match resetAt');

// Check Player 1 after global reset
const p1AfterGlobal = db.getUser(p1Id);
assert.strictEqual(p1AfterGlobal.hints, 0, 'Player 1 hints must be 0 after global reset');
assert.strictEqual(p1AfterGlobal.undos, 0, 'Player 1 undos must be 0 after global reset');
assert.strictEqual(p1AfterGlobal.reveals, 0, 'Player 1 reveals must be 0 after global reset');
assert.strictEqual(p1AfterGlobal.extra_bottles, 0, 'Player 1 extra_bottles must be 0 after global reset');
assert.strictEqual(p1AfterGlobal.all_colors_until, 0, 'Player 1 all_colors_until must be 0 after global reset');
assert.strictEqual(p1AfterGlobal.ton_balance, 7.5, 'Player 1 TON balance must remain INTACT');

// Check Player 2 after global reset
const p2AfterGlobal = db.getUser(p2Id);
assert.strictEqual(p2AfterGlobal.hints, 0, 'Player 2 hints must be 0 after global reset');
assert.strictEqual(p2AfterGlobal.undos, 0, 'Player 2 undos must be 0 after global reset');
assert.strictEqual(p2AfterGlobal.reveals, 0, 'Player 2 reveals must be 0 after global reset');
assert.strictEqual(p2AfterGlobal.extra_bottles, 0, 'Player 2 extra_bottles must be 0 after global reset');
assert.strictEqual(p2AfterGlobal.all_colors_until, 0, 'Player 2 all_colors_until must be 0 after global reset');
assert.strictEqual(p2AfterGlobal.all_colors_purchased_at, 0, 'Player 2 all_colors_purchased_at must be 0 after global reset');
assert.strictEqual(p2AfterGlobal.ton_balance, 0, 'Player 2 TON balance must remain INTACT');
assert.strictEqual(p2AfterGlobal.ton_wallet, 'EQB_PLAYER2_WALLET_TEST', 'Player 2 TON wallet must remain INTACT');
assert.strictEqual(db.getAdRewardsCount(p2Id), 0, 'Player 2 ad rewards log must be cleared');

console.log('✅ Test 2 (resetGramPurchases) PASSED: ALL players reset to 0, assets preserved, ad log cleared');

// 4. TEST: updateUserProgress allows setting boosters to 0 explicitly
console.log('\n--- Test 3: updateUserProgress explicit zero assignment ---');
db.addBonus(p1Id, { hints: 10 });
assert.strictEqual(db.getUser(p1Id).hints, 10);
db.updateUserProgress(p1Id, { hints: 0, undos: 0, reveals: 0, extraBottles: 0 });
assert.strictEqual(db.getUser(p1Id).hints, 0, 'updateUserProgress with hints: 0 must set hints to 0');

console.log('✅ Test 3 (updateUserProgress) PASSED');

console.log('\n🎉 ALL ADMIN PURCHASES RESET TESTS PASSED SUCCESSFULLY!');
