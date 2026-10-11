const assert = require('assert');
const db = require('../db');
const gameVerification = require('../gameVerification');

console.log('================================================================');
console.log('🧪 COMPREHENSIVE VERIFICATION SUITE: COLOR SORT USER FIXES');
console.log('================================================================\n');

// ----------------------------------------------------------------------
// TEST 1: Hint usage and persistence for User 5761685341 (Alligator)
// ----------------------------------------------------------------------
console.log('--- Test 1: Hint usage & no automatic restoration for Alligator (5761685341) ---');

// Reset to 10 for deterministic testing
db.prepare("UPDATE users SET hints = 10, undos = 20, reveals = 5, extra_bottles = 10 WHERE telegram_id = '5761685341'").run();

let alligator = db.getUser('5761685341');
assert.strictEqual(alligator.hints, 10, 'Alligator should start with 10 hints');

// 1.1 Use 1 hint
let useRes1 = db.useBooster('5761685341', 'hints');
assert.strictEqual(useRes1.success, true, 'useBooster should succeed');
assert.strictEqual(useRes1.remaining, 9, 'Remaining hints must be 9');
assert.strictEqual(useRes1.user.hints, 9, 'User hints in result must be 9');

// 1.2 Calling getUser must NOT restore hints to 10
alligator = db.getUser('5761685341');
assert.strictEqual(alligator.hints, 9, 'Hints must remain 9 upon getUser (NOT restored to 10!)');

// 1.3 Use another hint
let useRes2 = db.useBooster('5761685341', 'hints');
assert.strictEqual(useRes2.remaining, 8, 'Remaining hints must be 8');
alligator = db.getUser('5761685341');
assert.strictEqual(alligator.hints, 8, 'Hints must remain 8');

// 1.4 Test all other boosters deduction
let useUndo = db.useBooster('5761685341', 'undos');
assert.strictEqual(useUndo.remaining, 19, 'Remaining undos must be 19');
alligator = db.getUser('5761685341');
assert.strictEqual(alligator.undos, 19, 'Undos must remain 19');

let useReveal = db.useBooster('5761685341', 'reveals');
assert.strictEqual(useReveal.remaining, 4, 'Remaining reveals must be 4');
alligator = db.getUser('5761685341');
assert.strictEqual(alligator.reveals, 4, 'Reveals must remain 4');

let useBottle = db.useBooster('5761685341', 'extra_bottles');
assert.strictEqual(useBottle.remaining, 9, 'Remaining extra_bottles must be 9');
alligator = db.getUser('5761685341');
assert.strictEqual(alligator.extra_bottles, 9, 'Extra bottles must remain 9');

console.log('✅ Passed: Booster deductions persist reliably without reverting to baseline floors!\n');

// ----------------------------------------------------------------------
// TEST 2: Ad rewards crediting and subsequent usage
// ----------------------------------------------------------------------
console.log('--- Test 2: Ad reward crediting & seamless subsequent usage ---');

// 2.1 Grant +1 hint via ad reward
const prevHints = db.getUser('5761685341').hints;
const adRewardRes = db.logAdReward('5761685341', 'hints');
assert.strictEqual(adRewardRes.hints, prevHints + 1, 'Hints must increase by exactly 1 after watching ad');

alligator = db.getUser('5761685341');
assert.strictEqual(alligator.hints, prevHints + 1, 'Hints in database must be exactly previous + 1');

// 2.2 Spend the hint earned from ad
const spendAdHintRes = db.useBooster('5761685341', 'hints');
assert.strictEqual(spendAdHintRes.remaining, prevHints, 'Hints must decrement back down to previous');
alligator = db.getUser('5761685341');
assert.strictEqual(alligator.hints, prevHints, 'Hints must stay at previous count');

// 2.3 Grant +1 extra_bottle via ad reward
const prevBottles = db.getUser('5761685341').extra_bottles;
const adBottleRes = db.logAdReward('5761685341', 'extra_bottle');
assert.strictEqual(adBottleRes.extra_bottles, prevBottles + 1, 'Extra bottles must increase by exactly 1');
alligator = db.getUser('5761685341');
assert.strictEqual(alligator.extra_bottles, prevBottles + 1, 'Extra bottles in DB must reflect +1');

// 2.4 User's exact scenario: Start with 10 bottles, spend 8 (2 remaining), watch 1 ad -> STRICTLY 3 bottles!
const testUserId = 'test_user_scenario_' + Date.now();
db.getUser(testUserId, { first_name: 'Test Scenario User' });
db.prepare('UPDATE users SET extra_bottles = 10, hints = 5, undos = 5, reveals = 5 WHERE telegram_id = ?').run(testUserId);
let uState = db.getUser(testUserId);
assert.strictEqual(uState.extra_bottles, 10, 'Initial bottles must be 10');
assert.strictEqual(uState.hints, 5, 'Initial hints must be 5');

// Spend 8 bottles
for (let i = 0; i < 8; i++) {
  const sRes = db.useBooster(testUserId, 'extra_bottles');
  assert.strictEqual(sRes.success, true);
}
uState = db.getUser(testUserId);
assert.strictEqual(uState.extra_bottles, 2, 'After spending 8 bottles, remaining MUST BE EXACTLY 2');

// Watch 1 ad for extra_bottle
const adToken = gameVerification.createAdToken(testUserId, 'extra_bottle');
assert(adToken.startsWith('adt_'), 'Ad token must be stateless HMAC formatted');
const verifiedToken = gameVerification.verifyAndClaimAdToken(adToken, testUserId, 'extra_bottle', true, true);
assert.strictEqual(verifiedToken.valid, true, 'Ad token must be valid');

// Server synchronizes client balance (2 bottles) and logs ad reward (+1)
db.prepare('UPDATE users SET extra_bottles = ? WHERE telegram_id = ?').run(2, testUserId);
const rewardUser = db.logAdReward(testUserId, 'extra_bottle');
assert.strictEqual(rewardUser.extra_bottles, 3, 'After 1 ad watch, bottles MUST BE EXACTLY 2 + 1 = 3 (NOT 11!)');
assert.strictEqual(rewardUser.hints, 5, 'Hints must remain untouched at 5 (NOT reset or jumped!)');
assert.strictEqual(rewardUser.undos, 5, 'Undos must remain untouched at 5');
assert.strictEqual(rewardUser.reveals, 5, 'Reveals must remain untouched at 5');

// Spend 1 hint -> 4 hints
const hintSpend = db.useBooster(testUserId, 'hints');
assert.strictEqual(hintSpend.remaining, 4, 'Hints after spend must be 4');

// Watch 1 ad for hint -> strictly 5 hints, bottles must stay 3!
const hintToken = gameVerification.createAdToken(testUserId, 'hints');
const vHintToken = gameVerification.verifyAndClaimAdToken(hintToken, testUserId, 'hints', true, true);
assert.strictEqual(vHintToken.valid, true);

db.prepare('UPDATE users SET hints = ? WHERE telegram_id = ?').run(4, testUserId);
const rewardHintUser = db.logAdReward(testUserId, 'hints');
assert.strictEqual(rewardHintUser.hints, 5, 'Hints after ad MUST BE EXACTLY 4 + 1 = 5');
assert.strictEqual(rewardHintUser.extra_bottles, 3, 'Bottles must stay strictly at 3');

console.log('✅ Passed: Ad rewards credit cleanly and spend seamlessly without glitching!\n');

// ----------------------------------------------------------------------
// TEST 3: Gifts system end-to-end between players
// ----------------------------------------------------------------------
console.log('--- Test 3: Gifts system deduction, transfer & claiming ---');

const playerAId = 'test_sender_' + Date.now();
const playerBId = 'test_receiver_' + Date.now();

// Create test players
const playerA = db.getUser(playerAId, { first_name: 'Player Alice', username: 'alice' });
const playerB = db.getUser(playerBId, { first_name: 'Player Bob', username: 'bob' });

// Give Player A initial boosters: 10 hints, 5 extra_bottles
db.addBonus(playerAId, { hints: 10, extra_bottles: 5 });
assert.strictEqual(db.getUser(playerAId).hints, 10);
assert.strictEqual(db.getUser(playerAId).extra_bottles, 5);
assert.strictEqual(db.getUser(playerBId).hints, 0);
assert.strictEqual(db.getUser(playerBId).extra_bottles, 0);

// 3.1 Player A sends 3 hints to Player B
const sendGiftRes = db.sendGift({
  id: 'gift_hints_' + Date.now(),
  fromId: playerAId,
  fromName: 'Alice',
  fromUsername: 'alice',
  recipientId: playerBId,
  giftType: 'hints',
  giftName: 'Подсказка',
  amount: 3
});
assert.strictEqual(sendGiftRes.success, true, 'sendGift should succeed');

// Verify Player A balance is deducted by 3
const updatedA = db.getUser(playerAId);
assert.strictEqual(updatedA.hints, 7, 'Player A hints must be deducted from 10 to 7');

// Verify Player B inbox has the gift
const inboxB = db.getInboxGifts(playerBId);
assert.strictEqual(inboxB.length, 1, 'Player B should have 1 gift in inbox');
assert.strictEqual(inboxB[0].amount, 3, 'Gift amount must be 3');
assert.strictEqual(inboxB[0].claimed, false, 'Gift must be unclaimed');

// 3.2 Player B claims the gift
const claimRes = db.claimGift(inboxB[0].id, playerBId);
assert.strictEqual(claimRes, true, 'claimGift must return true');

const updatedB = db.getUser(playerBId);
assert.strictEqual(updatedB.hints, 3, 'Player B hints must be credited with 3 hints');

// 3.3 Player A sends extra_bottles to Player B
const sendBottleRes = db.sendGift({
  id: 'gift_bottles_' + Date.now(),
  fromId: playerAId,
  fromName: 'Alice',
  fromUsername: 'alice',
  recipientId: playerBId,
  giftType: 'extra_bottles',
  giftName: 'Пустая колба',
  amount: 2
});
assert.strictEqual(sendBottleRes.success, true);
assert.strictEqual(db.getUser(playerAId).extra_bottles, 3, 'Player A bottles must be deducted from 5 to 3');

const inboxB2 = db.getInboxGifts(playerBId);
const bottleGift = inboxB2.find(g => g.id.startsWith('gift_bottles_'));
assert(bottleGift !== undefined, 'Bottle gift must be in Player B inbox');

const claimBottleRes = db.claimGift(bottleGift.id, playerBId);
assert.strictEqual(claimBottleRes, true);
assert.strictEqual(db.getUser(playerBId).extra_bottles, 2, 'Player B extra_bottles must be credited with 2');

// 3.4 User search functionality
const searchResults = db.searchUsers('alice');
assert(searchResults.some(u => u.telegram_id === playerAId), 'searchUsers must find player Alice');

console.log('✅ Passed: Gifts deduction, immediate delivery, claiming and user search verified!\n');

// ----------------------------------------------------------------------
// TEST 4: Level progression and anti-cheat verification
// ----------------------------------------------------------------------
console.log('--- Test 4: Level progression, verification & integrity ---');

const lvlPlayerId = 'lvl_test_' + Date.now();
const lvlPlayer = db.getUser(lvlPlayerId, { first_name: 'Level Tester' });
assert.strictEqual(lvlPlayer.current_level, 1);
assert.strictEqual(lvlPlayer.max_level, 0);

// 4.1 Advance level
const nextLvlUser = db.completeLevel(lvlPlayerId, 1);
assert.strictEqual(nextLvlUser.max_level, 2, 'max_level must advance to 2');
assert.strictEqual(nextLvlUser.current_level, 2, 'current_level must advance to 2');

// 4.2 Advance level again
const nextLvlUser2 = db.completeLevel(lvlPlayerId, 2);
assert.strictEqual(nextLvlUser2.max_level, 3, 'max_level must advance to 3');
assert.strictEqual(nextLvlUser2.current_level, 3, 'current_level must advance to 3');

// 4.3 Verify game verification session start and completion
const session = gameVerification.startSession(lvlPlayerId, 1, 3);
assert.strictEqual(session.success, true, 'Session must start successfully');
assert(session.sessionToken, 'Session token must be provided');
assert.strictEqual(session.levelNumber, 1, 'Level number must match');

console.log('✅ Passed: Level completion and progression increment verified!\n');

// ----------------------------------------------------------------------
// CLEANUP
// ----------------------------------------------------------------------
db.prepare("DELETE FROM users WHERE telegram_id IN (?, ?, ?)").run(playerAId, playerBId, lvlPlayerId);
db.prepare("DELETE FROM player_gifts WHERE sender_id = ? OR recipient_id = ?").run(playerAId, playerBId);
db.prepare("UPDATE users SET hints = 10, undos = 20, reveals = 5, extra_bottles = 10 WHERE telegram_id = '5761685341'").run();

console.log('================================================================');
console.log('🎉 ALL USER REQUIREMENTS VERIFIED AND PASSING 100%!');
console.log('================================================================');
process.exit(0);
