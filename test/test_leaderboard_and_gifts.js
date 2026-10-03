const assert = require('assert');
const db = require('../db');

console.log('--- TEST 1: DB Schema & Leaderboard Query ---');
const leaderboard = db.getLeaderboard('', 50);
console.log('Leaderboard success:', !!leaderboard);
console.log('Top players count:', leaderboard.topPlayers ? leaderboard.topPlayers.length : 0);
assert(leaderboard && Array.isArray(leaderboard.topPlayers), 'Leaderboard should return topPlayers array');
if (leaderboard.topPlayers.length > 0) {
  const p = leaderboard.topPlayers[0];
  console.log('Sample player:', {
    telegram_id: p.telegram_id,
    first_name: p.first_name,
    username: p.username,
    max_level: p.max_level
  });
}

console.log('\n--- TEST 2: Gifts DB System (Send, Get, Claim) ---');
const testSenderId = '7458436672'; // Ruslan
const testRecipientId = '5761685341'; // Alligator
const testGiftId = 'gift_test_' + Date.now();

const sendResult = db.sendGift({
  id: testGiftId,
  fromId: testSenderId,
  fromName: 'Руслан',
  fromUsername: 'ruslan_aliyevvv',
  recipientId: testRecipientId,
  giftType: 'hints',
  giftName: 'Подсказка',
  giftIcon: '💡',
  amount: 2
});
assert.strictEqual(sendResult, true, 'sendGift should return true');

const inboxBefore = db.getInboxGifts(testRecipientId);
console.log('Inbox count for recipient:', inboxBefore.length);
const foundGift = inboxBefore.find(g => g.id === testGiftId);
assert(foundGift, 'Gift must be found in recipient inbox');
console.log('Found gift:', foundGift);
assert.strictEqual(foundGift.fromUsername, 'ruslan_aliyevvv', 'Sender username must match');
assert.strictEqual(foundGift.fromName, 'Руслан', 'Sender name must match');
assert.strictEqual(foundGift.claimed, false, 'Gift should initially be unclaimed');

// Test Claim
const claimResult = db.claimGift(testGiftId, testRecipientId);
assert.strictEqual(claimResult, true, 'claimGift should return true');

const inboxAfter = db.getInboxGifts(testRecipientId);
const claimedGift = inboxAfter.find(g => g.id === testGiftId);
assert(claimedGift, 'Gift must still exist in recipient inbox');
assert.strictEqual(claimedGift.claimed, true, 'Gift should now be claimed');
console.log('Claimed gift verified successfully!');

console.log('\n--- TEST 3: Season Filter Simulation ---');
const SEASON_RESET_FLOOR = 1789324758606;
let effectiveSeasonReset = SEASON_RESET_FLOOR;

const serverTopPlayers = [
  { telegram_id: '7458436672', first_name: 'Руслан', username: 'ruslan_aliyevvv', max_level: 46, stars: 0 },
  { telegram_id: '5761685341', first_name: 'ALLIGATOR', username: 'ALLIGATOR0709', max_level: 30, stars: 0 }
];

// Replicate new app.js mapping
const players = [];
serverTopPlayers.forEach(sp => {
  players.push({
    telegramId: String(sp.telegram_id),
    firstName: sp.first_name,
    username: sp.username || '',
    maxLevel: Number(sp.max_level || 1),
    level: Number(sp.max_level || 1),
    stars: Number(sp.stars || 0),
    isServer: true
  });
});

const uniqueMap = new Map();
players.forEach(p => {
  const id = String(p.telegramId);
  if (!id || id.startsWith('guest') || id.startsWith('dev') || !/^\d+$/.test(id)) return;

  // Server players are verified active players from database
  if (!p.isServer) {
    const pSeason = Number(p.seasonResetAt || 0);
    const pUpdated = Number(p.updatedAt || 0);
    const isCurrentSeason = (pSeason >= effectiveSeasonReset) || (pUpdated >= effectiveSeasonReset);
    if (!isCurrentSeason) return;
  }

  const lvl = Number(p.maxLevel !== undefined ? p.maxLevel : (p.level !== undefined ? p.level : 0));
  if (lvl < 1) return;

  uniqueMap.set(id, p);
});

assert.strictEqual(uniqueMap.size, 2, 'All server players must be retained in leaderboard!');
console.log('Leaderboard retains players correctly: size =', uniqueMap.size);

console.log('\n--- ALL UNIT & INTEGRATION TESTS PASSED! ---');
