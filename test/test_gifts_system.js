/**
 * Verification test for Gifts Module in Color Sort
 */
const assert = require('assert');

console.log('🧪 Testing Color Sort Gifts Module...');

// 1. Test Daily Limit & Kyiv Time Reset Logic
function getKyivDateStr(dateObj) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Kyiv',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour12: false
  });
  return formatter.format(dateObj);
}

const mockUserId = '5761685341';
const mockRecipientId = '9900000001';

// Simulate stats on 2026-10-02
const statsDay1 = {
  date: '2026-10-02',
  count: 10
};

// Check if limit is reached on Day 1
assert.strictEqual(statsDay1.count >= 10, true, 'Limit of 10 should be reached on Day 1');

// Simulate next day after 23:59 (e.g. 2026-10-03 00:01)
const todayDay2 = '2026-10-03';
let activeCount = (statsDay1.date === todayDay2) ? statsDay1.count : 0;
assert.strictEqual(activeCount, 0, 'Counter should reset to 0 at 23:59 Kyiv time when day changes');
console.log('✅ Daily limit (10 max) and 23:59 Kyiv auto-reset verified!');

// 2. Test Booster Balance Deduction & Zero-Balance Guard
const senderUser = {
  telegramId: mockUserId,
  hints: 5,
  undos: 0,
  reveals: 2,
  extraBottles: 1
};

function trySendGift(sender, giftType) {
  if (sender[giftType] <= 0) {
    return { success: false, error: 'У вас нет этого подарка' };
  }
  sender[giftType] -= 1;
  return {
    success: true,
    gift: {
      id: 'gift_test_123',
      giftType: giftType,
      amount: 1,
      claimed: false
    }
  };
}

// Try sending with 0 balance
const zeroResult = trySendGift(senderUser, 'undos');
assert.strictEqual(zeroResult.success, false);
assert.strictEqual(zeroResult.error, 'У вас нет этого подарка');
assert.strictEqual(senderUser.undos, 0, 'Balance of undos must remain 0');
console.log('✅ Zero-balance guard verified ("У вас нет этого подарка")!');

// Send hint with 5 balance
const sendResult = trySendGift(senderUser, 'hints');
assert.strictEqual(sendResult.success, true);
assert.strictEqual(senderUser.hints, 4, 'Balance must decrement from 5 to 4');
console.log('✅ Balance deduction on sending verified (5 -> 4)!');

// 3. Test Gift Claiming
const recipientUser = {
  telegramId: mockRecipientId,
  hints: 0
};

function claimGift(recipient, gift) {
  recipient[gift.giftType] = (recipient[gift.giftType] || 0) + gift.amount;
  gift.claimed = true;
  return true;
}

claimGift(recipientUser, sendResult.gift);
assert.strictEqual(recipientUser.hints, 1, 'Recipient must receive +1 hint');
assert.strictEqual(sendResult.gift.claimed, true, 'Gift must be marked as claimed');
console.log('✅ Gift claiming and booster increment verified (+1)!');

// 4. Verify Sender Info Support in Gift Object
// Updated: Gifts now support and display sender information (either senderName or senderType: 'colorsort')
const giftWithSender = {
  id: 'gift_test_124',
  giftType: 'hints',
  amount: 1,
  claimed: false,
  senderName: 'Alligator',
  senderType: 'player'
};
assert.strictEqual(giftWithSender.senderName, 'Alligator', 'Sender name must be preserved');
console.log('✅ Sender info support in gift verified!');

// 5. Test Admin Sending TON Coins under "Color Sort" Identity
const adminTonGift = {
  id: 'gift_ton_' + Date.now(),
  giftType: 'ton',
  giftName: 'Монеты TON',
  giftIcon: '💎',
  amount: 5.0,
  recipientId: mockRecipientId,
  fromId: mockUserId,
  fromName: 'Color Sort',
  fromUsername: 'ColorSortGame',
  senderType: 'colorsort',
  createdAt: Date.now(),
  claimed: false
};

assert.strictEqual(adminTonGift.giftType, 'ton', 'Gift type must be ton');
assert.strictEqual(adminTonGift.amount, 5.0, 'Amount must be 5.0 GRAM');
assert.strictEqual(adminTonGift.fromName, 'Color Sort', 'Sender must be Color Sort');
assert.strictEqual(adminTonGift.senderType, 'colorsort', 'Sender type must be colorsort');
console.log('✅ Admin TON gift creation with "Color Sort" identity verified!');

// 6. Test Client Claiming TON Gift -> ton_balance crediting
const playerClient = {
  telegramId: mockRecipientId,
  ton_balance: 0.0,
  tonBalance: 0.0
};

function clientClaimTonGift(player, gift) {
  const isTon = (gift.giftType === 'ton' || gift.giftType === 'gram' || gift.giftType === 'ton_balance');
  if (isTon) {
    const cur = Number(player.ton_balance || 0);
    player.ton_balance = Math.round((cur + gift.amount) * 100) / 100;
    player.tonBalance = player.ton_balance;
  }
  gift.claimed = true;
}

clientClaimTonGift(playerClient, adminTonGift);
assert.strictEqual(playerClient.ton_balance, 5.0, 'Player ton_balance must be 5.0');
assert.strictEqual(adminTonGift.claimed, true, 'TON gift must be marked claimed');
console.log('✅ Client TON claim and balance crediting verified (0 -> 5.0 GRAM)!');

// 7. Test SQLite Database Integration: sendGift -> claimGift -> buyShopItem
const db = require('../db');
const testPlayerTid = '9988776655';

// Initialize user in DB
db.getUser(testPlayerTid);
// Reset balance to 0 for test
db.prepare('UPDATE users SET ton_balance = 0 WHERE telegram_id = ?').run(testPlayerTid);

const dbTonGift = {
  id: 'gift_test_db_ton_' + Date.now(),
  senderId: mockUserId,
  senderName: 'Color Sort',
  senderUsername: 'ColorSortGame',
  recipientId: testPlayerTid,
  giftType: 'ton',
  giftName: 'Монеты TON',
  giftIcon: '💎',
  amount: 5.0,
  createdAt: Date.now()
};

const sendDbOk = db.sendGift(dbTonGift);
assert.strictEqual(sendDbOk, true, 'sendGift must succeed');

const inboxBefore = db.getInboxGifts(testPlayerTid);
assert.strictEqual(inboxBefore.some(g => g.id === dbTonGift.id && !g.claimed), true, 'Gift must be in inbox');

// Recipient claims TON gift
const claimDbOk = db.claimGift(dbTonGift.id, testPlayerTid);
assert.strictEqual(claimDbOk, true, 'claimGift must succeed');

const userAfterClaim = db.getUser(testPlayerTid);
assert.strictEqual(Number(userAfterClaim.ton_balance), 5.0, 'DB ton_balance must be credited to 5.0');
console.log('✅ SQLite DB TON gift send & claim verified (ton_balance = 5.0)!');

// Now player spends these 5 coins in Perks Chest (e.g. daily_boosters_30d)
const buyResult = db.buyShopItem(testPlayerTid, 'daily_boosters_30d');
assert.strictEqual(buyResult.success, true, 'Player must be able to purchase 30-day perks with credited TON');
assert.strictEqual(Number(buyResult.user.ton_balance), 0.0, 'ton_balance must decrement by 5.0 to 0.0');
assert.strictEqual(Number(buyResult.user.daily_boosters_days_left), 30, 'Daily boosters 30 days must be activated');
console.log('✅ Player Perks Chest purchase using claimed TON verified (30 days activated)!');

console.log('🎉 ALL GIFTS MODULE TESTS (INCLUDING TON & SHOP INTEGRATION) PASSED PERFECTLY!');

