const db = require('../db');
const assert = require('assert');

console.log('================================================================');
console.log('🧪 TESTING BOOSTER ACCUMULATION & AD REWARD PERSISTENCE');
console.log('================================================================');

// 1. Create test user
const testId = 'test_user_ad_accumulation_' + Date.now();
let user = db.getUser(testId, { first_name: 'TestAccumulator' });
assert(user, 'User creation failed');

console.log('Initial user hints:', user.hints, 'extra_bottles:', user.extra_bottles);

// 2. Add +5 from admin
user = db.addBonus(testId, { hints: 5, undos: 5, reveals: 5, extraBottles: 5 });
assert.strictEqual(user.hints, 5, 'Hints should be 5 after admin grant');
assert.strictEqual(user.extra_bottles, 5, 'Extra bottles should be 5 after admin grant');
console.log('✅ Admin +5 grant passed. Hints:', user.hints, 'Bottles:', user.extra_bottles);

// 3. Watch 10 ads in a row (5 hints, 5 extra_bottles)
for (let i = 1; i <= 5; i++) {
  user = db.logAdReward(testId, 'hints');
  assert.strictEqual(user.hints, 5 + i, `Hints should accumulate to ${5 + i}`);
  
  user = db.logAdReward(testId, 'extra_bottle');
  assert.strictEqual(user.extra_bottles, 5 + i, `Extra bottles should accumulate to ${5 + i}`);
}

console.log('✅ Watched 10 ads in a row.');
console.log('Final accumulated Hints:', user.hints, '(Expected: 10)');
console.log('Final accumulated Extra Bottles:', user.extra_bottles, '(Expected: 10)');

assert.strictEqual(user.hints, 10, 'Hints must be 10 after 5 ad views on top of 5 admin');
assert.strictEqual(user.extra_bottles, 10, 'Extra bottles must be 10 after 5 ad views on top of 5 admin');

// 4. Simulate user consuming 3 hints
user = db.addBonus(testId, { hints: -3 });
assert.strictEqual(user.hints, 7, 'Hints should be 7 after using 3');
console.log('✅ Used 3 hints manually. Remaining Hints:', user.hints, '(Expected: 7)');

console.log('================================================================');
console.log('🎉 BOOSTER ACCUMULATION TEST PASSED 100%!');
console.log('================================================================');
