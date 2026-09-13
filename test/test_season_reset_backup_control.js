const assert = require('assert');
const db = require('../db');

console.log('🧪 RUNNING EXTENDED SEASON RESET BACKUP CONTROL & PRESERVATION TEST');

// 1. Setup multiple players with various high levels (e.g. 10, 15, 100, 200)
const p1Id = 'player_top_10_' + Date.now();
const p2Id = 'player_top_15_' + Date.now();
const p3Id = 'player_top_100_' + Date.now();
const p4Id = 'player_top_200_' + Date.now();
const friendId = 'friend_real_' + Date.now();

db.getUser(p1Id, { first_name: 'Игрок 10' });
db.getUser(p2Id, { first_name: 'Игрок 15' });
db.getUser(p3Id, { first_name: 'Игрок 100' });
db.getUser(p4Id, { first_name: 'Игрок 200' });

db.updateUserProgress(p1Id, { currentLevel: 11, maxLevel: 10, starsAdded: 30 });
db.updateUserProgress(p2Id, { currentLevel: 16, maxLevel: 15, starsAdded: 45 });
db.updateUserProgress(p3Id, { currentLevel: 101, maxLevel: 100, starsAdded: 300 });
db.updateUserProgress(p4Id, { currentLevel: 201, maxLevel: 200, starsAdded: 600 });

// Set TON wallets, TON balances and active purchases
db.addBonus(p1Id, { tonBalance: 10.0 });
db.updateTonWallet(p1Id, 'EQB_WALLET_1');
db.buyShopItem(p1Id, 'all_colors_15d', 'gram');

db.addBonus(p4Id, { tonBalance: 30.0 });
db.updateTonWallet(p4Id, 'EQB_WALLET_4');
db.buyShopItem(p4Id, 'all_colors_15d', 'gram');

// Setup referral
const friendUname = 'friend_uname_' + Date.now();
const regRes = db.registerReferral(p4Id, friendId, 'Друг', friendUname);
assert.strictEqual(regRes && regRes.success, true, 'Referral registration must succeed');

// 2. PRE-CHECK LEADERBOARD: Inspect active players and their levels
const lbBefore = db.getLeaderboard(null, 50);
console.log('Active players before reset in leaderboard:', lbBefore.topPlayers.length);
assert.ok(lbBefore.topPlayers.length >= 4, 'Leaderboard must contain all 4 test players');

const beforeMap = new Map();
lbBefore.topPlayers.forEach(p => {
  beforeMap.set(String(p.telegram_id), Number(p.max_level));
});
assert.strictEqual(beforeMap.get(p4Id), 200, 'Player 4 must be level 200');
assert.strictEqual(beforeMap.get(p3Id), 100, 'Player 3 must be level 100');
assert.strictEqual(beforeMap.get(p2Id), 15, 'Player 2 must be level 15');
assert.strictEqual(beforeMap.get(p1Id), 10, 'Player 1 must be level 10');

// 3. EXECUTE SEASON RESET
const resetTimestamp = Date.now();
const resetResult = db.resetSeason(resetTimestamp);
assert.strictEqual(resetResult.success, true, 'Season reset must return success: true');

// 4. POST-CHECK LEADERBOARD: Must be completely empty (0 players)
const lbAfter = db.getLeaderboard(null, 50);
console.log('Active players after reset in leaderboard:', lbAfter.topPlayers.length);
assert.strictEqual(lbAfter.topPlayers.length, 0, 'Leaderboard must have exactly 0 players after season reset');

// 5. POST-CHECK INDIVIDUAL PLAYERS: All must be reset to level 0 (0 wins), starting at current_level 1
[p1Id, p2Id, p3Id, p4Id].forEach(pid => {
  const p = db.getUser(pid);
  assert.strictEqual(p.max_level, 0, `Player ${pid} max_level must be strictly 0`);
  assert.strictEqual(p.current_level, 1, `Player ${pid} current_level must be reset to 1`);
  assert.strictEqual(p.stars, 0, `Player ${pid} stars must be reset to 0`);
});

// 6. ASSET PRESERVATION CHECK: TON Wallet, TON Balance, Purchases, Referrals MUST NOT be deleted
const p1Final = db.getUser(p1Id);
assert.ok(p1Final.ton_balance > 0, 'Player 1 TON balance must remain positive');
assert.strictEqual(p1Final.ton_wallet, 'EQB_WALLET_1', 'Player 1 TON wallet must remain intact');
assert.ok(p1Final.all_colors_until > Date.now(), 'Player 1 All Colors purchase MUST be preserved');

const p4Final = db.getUser(p4Id);
assert.ok(p4Final.ton_balance > 0, 'Player 4 TON balance must remain positive');
assert.strictEqual(p4Final.ton_wallet, 'EQB_WALLET_4', 'Player 4 TON wallet must remain intact');
assert.ok(p4Final.all_colors_until > Date.now(), 'Player 4 All Colors purchase MUST be preserved');

const refList = db.getReferrals(p4Id);
assert.ok(refList && refList.totalCount >= 1, 'Referral network must be strictly preserved');

// 7. BEATING LEVEL 1: Player beats 1st level and enters leaderboard with Level 1
db.updateUserProgress(p1Id, { currentLevel: 2, maxLevel: 1, starsAdded: 3 });
const p1AfterWin = db.getUser(p1Id);
assert.strictEqual(p1AfterWin.max_level, 1, 'max_level must now be 1');
assert.strictEqual(p1AfterWin.current_level, 2, 'current_level must now be 2');

const lbAfterWin = db.getLeaderboard(p1Id, 50);
assert.strictEqual(lbAfterWin.topPlayers.length, 1, 'Leaderboard must contain 1 player');
assert.strictEqual(lbAfterWin.topPlayers[0].telegram_id, p1Id);
assert.strictEqual(lbAfterWin.topPlayers[0].max_level, 1);
assert.strictEqual(lbAfterWin.userRank.rank, 1);

console.log('✅ ALL EXTENDED SEASON RESET BACKUP CONTROL & PRESERVATION TESTS PASSED 100%!');
