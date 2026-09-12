const db = require('../db');
const assert = require('assert');

console.log('================================================================');
console.log('🧪 TESTING FULL ACCUMULATION FLOW: ADMIN -> AD -> CHEST -> AD');
console.log('================================================================');

const testId = 'test_user_full_flow_' + Date.now();
let user = db.getUser(testId, { first_name: 'FlowTester' });
assert(user, 'User creation failed');

// 1. Admin adds 5 bottles & 5 hints
console.log('1. Admin granting +5 extra bottles & +5 hints...');
user = db.addBonus(testId, { hints: 5, extraBottles: 5 });
assert.strictEqual(user.hints, 5, 'Hints should be 5 after admin grant');
assert.strictEqual(user.extra_bottles, 5, 'Extra bottles should be 5 after admin grant');
console.log('   Current: Hints =', user.hints, ', Extra Bottles =', user.extra_bottles);

// 2. User watches 1 ad for extra_bottle
console.log('2. Watching ad for extra_bottle...');
user = db.logAdReward(testId, 'extra_bottle');
assert.strictEqual(user.extra_bottles, 6, 'Extra bottles should accumulate to 6 (5 + 1)');
assert.strictEqual(user.hints, 5, 'Hints should remain 5');
console.log('   Current: Hints =', user.hints, ', Extra Bottles =', user.extra_bottles);

// 3. User buys 15 extra bottles & 20 hints in Chest (Shop)
console.log('3. Purchasing +15 Extra Bottles & +20 Hints in Chest...');
// Give 5.0 GRAM first so user can afford shop items
db.addBonus(testId, { ton_balance: 5.0 });
const shopRes1 = db.buyShopItem(testId, 'bottles_pack_15');
assert(shopRes1 && shopRes1.success, 'Shop purchase bottles_pack_15 failed');
user = shopRes1.user;
assert.strictEqual(user.extra_bottles, 21, 'Extra bottles should accumulate to 21 (6 + 15)');

const shopRes2 = db.buyShopItem(testId, 'hints_pack_20');
assert(shopRes2 && shopRes2.success, 'Shop purchase hints_pack_20 failed');
user = shopRes2.user;
assert.strictEqual(user.hints, 25, 'Hints should accumulate to 25 (5 + 20)');
console.log('   Current: Hints =', user.hints, ', Extra Bottles =', user.extra_bottles);

// 4. Client syncs progress with absolute totals
console.log('4. Client sending /api/user/sync with absolute totals...');
user = db.updateUserProgress(testId, {
  hints: user.hints,
  extraBottles: user.extra_bottles,
  currentLevel: 2
});
assert.strictEqual(user.extra_bottles, 21, 'Sync must preserve 21 extra bottles');
assert.strictEqual(user.hints, 25, 'Sync must preserve 25 hints');

// 5. User watches ad after chest purchase
console.log('5. Watching ad after chest purchase...');
user = db.logAdReward(testId, 'extra_bottle');
assert.strictEqual(user.extra_bottles, 22, 'Extra bottles should accumulate to 22 (21 + 1)');
assert.strictEqual(user.hints, 25, 'Hints should remain 25');

user = db.logAdReward(testId, 'hints');
assert.strictEqual(user.hints, 26, 'Hints should accumulate to 26 (25 + 1)');
assert.strictEqual(user.extra_bottles, 22, 'Extra bottles should remain 22');

console.log('================================================================');
console.log('🎉 FULL ACCUMULATION FLOW TEST PASSED 100%!');
console.log('================================================================');
