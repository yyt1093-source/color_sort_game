const assert = require('assert');
const db = require('../db');

console.log('🧪 RUNNING SEASON RESET & LEADERBOARD FLOW TEST');

// Clean start
const resetTs = Date.now();
db.resetSeason(resetTs);

// 1. Initial check: Leaderboard must be 100% empty
const emptyLb = db.getLeaderboard('', 50);
console.log('Leaderboard count after reset:', emptyLb.topPlayers.length);
assert.strictEqual(emptyLb.topPlayers.length, 0, 'Leaderboard MUST be completely empty (0 players) after season reset');

// 2. Create a player with TON balance and referrals
const player1Id = 'player_flow_' + Date.now();
const player1 = db.getUser(player1Id, { first_name: 'Игрок 1', username: 'player1' });
assert.strictEqual(player1.max_level, 0, 'New player must start with max_level = 0');
assert.strictEqual(player1.current_level, 1, 'New player must start on current_level = 1');

// Deposit TON and save wallet
db.addBonus(player1Id, { tonBalance: 12.5 });
db.updateTonWallet(player1Id, 'EQB_TON_WALLET_TEST_ADDRESS_12345');
const player1Updated = db.getUser(player1Id);
assert.strictEqual(player1Updated.ton_balance, 12.5);
assert.strictEqual(player1Updated.ton_wallet, 'EQB_TON_WALLET_TEST_ADDRESS_12345');
assert.ok(player1Updated.memo_code.startsWith('SORT-'));

// 3. Before player1 wins round 1, they MUST NOT appear in the leaderboard!
const lbBeforeWin = db.getLeaderboard(player1Id, 50);
assert.strictEqual(lbBeforeWin.topPlayers.length, 0, 'Player with max_level = 0 MUST NOT appear in leaderboard');
assert.strictEqual(lbBeforeWin.userRank, null, 'User rank must be null before passing round 1');

// 4. Player1 wins round 1!
db.updateUserProgress(player1Id, { currentLevel: 2, maxLevel: 1, starsAdded: 3, coinsAdded: 50 });
const player1AfterWin = db.getUser(player1Id);
assert.strictEqual(player1AfterWin.max_level, 1, 'Player max_level must now be 1');
assert.strictEqual(player1AfterWin.current_level, 2, 'Player current_level must now be 2');

// 5. Now player1 MUST appear in the leaderboard at Level 1!
const lbAfterWin = db.getLeaderboard(player1Id, 50);
assert.strictEqual(lbAfterWin.topPlayers.length, 1, 'Leaderboard must now have 1 player');
assert.strictEqual(lbAfterWin.topPlayers[0].telegram_id, player1Id);
assert.strictEqual(lbAfterWin.topPlayers[0].max_level, 1);
assert.strictEqual(lbAfterWin.userRank.rank, 1);

// 6. Reset Season again!
const secondResetTs = Date.now() + 1000;
db.resetSeason(secondResetTs);

// 7. Verify leaderboard is once again 100% empty!
const lbAfterSecondReset = db.getLeaderboard(player1Id, 50);
assert.strictEqual(lbAfterSecondReset.topPlayers.length, 0, 'Leaderboard must be completely empty after season reset');
assert.strictEqual(lbAfterSecondReset.userRank, null);

// 8. Verify player1's TON wallet, TON balance, and memo code are INTACT!
const player1AfterReset = db.getUser(player1Id);
assert.strictEqual(player1AfterReset.max_level, 0, 'Player max_level must be reset to 0');
assert.strictEqual(player1AfterReset.current_level, 1, 'Player current_level must be reset to 1');
assert.strictEqual(player1AfterReset.stars, 0, 'Stars must be 0');
assert.strictEqual(player1AfterReset.ton_balance, 12.5, 'TON balance MUST NOT be reset!');
assert.strictEqual(player1AfterReset.ton_wallet, 'EQB_TON_WALLET_TEST_ADDRESS_12345', 'TON wallet MUST NOT be reset!');
assert.strictEqual(player1AfterReset.memo_code, player1Updated.memo_code, 'Memo code MUST NOT be reset!');

console.log('✅ ALL SEASON RESET & LEADERBOARD FLOW TESTS PASSED!');
