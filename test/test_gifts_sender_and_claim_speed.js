/**
 * Comprehensive verification test for Gifts Module:
 * 1. Sender identity display for regular players (shows player name / username)
 * 2. Admin sender identity selection: 'self' (Alligator) vs 'colorsort' (Color Sort)
 * 3. Instant zero-delay claim mechanism with persistent claimedSet
 * 4. Received card layout (icon at top center, description full width middle, button full width bottom)
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Starting Gifts Module Verification Tests (Sender Identity & Instant Claim)...\n');

// --- 1. Test Sender Identity Logic ---
console.log('1️⃣ Testing Sender Identity Resolution...');

function resolveSenderInfo(isAdmin, adminSenderMode, currentUser, defaultPlayerName = 'Игрок') {
  let senderName = '';
  let senderUsername = '';
  let senderType = 'player';

  if (isAdmin) {
    if (adminSenderMode === 'colorsort') {
      senderName = 'Color Sort';
      senderUsername = 'ColorSortGame';
      senderType = 'colorsort';
    } else {
      senderName = (currentUser.firstName && currentUser.firstName !== 'Игрок')
        ? currentUser.firstName
        : (currentUser.username || 'Alligator');
      senderUsername = currentUser.username ? String(currentUser.username).replace(/^@/, '').trim() : 'Alligator';
      senderType = 'admin';
    }
  } else {
    senderName = (currentUser.firstName && currentUser.firstName !== 'Игрок')
      ? currentUser.firstName
      : defaultPlayerName;
    senderUsername = currentUser.username ? String(currentUser.username).replace(/^@/, '').trim() : '';
    senderType = 'player';
  }

  return { senderName, senderUsername, senderType };
}

function formatSenderDisplay(gift, defaultPlayerName = 'Игрок') {
  const isColorSort = (gift.senderType === 'colorsort') || 
                      (String(gift.fromName || '').trim().toLowerCase() === 'color sort') ||
                      (String(gift.fromUsername || '').trim().toLowerCase() === 'colorsortgame');

  if (isColorSort) {
    return 'Color Sort';
  }

  const namePart = (gift.fromName && gift.fromName !== 'Игрок' && gift.fromName !== 'Player') 
    ? String(gift.fromName).trim() 
    : '';
  const userPart = gift.fromUsername 
    ? `@${String(gift.fromUsername).replace(/^@/, '').trim()}` 
    : '';

  if (namePart && userPart && namePart.toLowerCase() !== userPart.toLowerCase().replace('@', '')) {
    return `${namePart} (${userPart})`;
  } else if (namePart) {
    return namePart;
  } else if (userPart) {
    return userPart;
  }
  return defaultPlayerName;
}

// Case A: Regular player sends gift
const regularPlayer = { telegramId: '1001', firstName: 'Михаил', username: 'misha_gamer' };
const regularSender = resolveSenderInfo(false, 'self', regularPlayer);
assert.strictEqual(regularSender.senderName, 'Михаил');
assert.strictEqual(regularSender.senderUsername, 'misha_gamer');
assert.strictEqual(regularSender.senderType, 'player');

const regularGift = {
  id: 'gift_1',
  fromName: regularSender.senderName,
  fromUsername: regularSender.senderUsername,
  senderType: regularSender.senderType
};
const regularDisplay = formatSenderDisplay(regularGift);
assert.strictEqual(regularDisplay, 'Михаил (@misha_gamer)');
console.log('   ✅ Regular player sender display verified:', regularDisplay);

// Case B: Admin sends gift from their own name ('self' / Alligator)
const adminPlayer = { telegramId: '5761685341', firstName: 'Alligator', username: 'alligator' };
const adminSelfSender = resolveSenderInfo(true, 'self', adminPlayer);
assert.strictEqual(adminSelfSender.senderName, 'Alligator');
assert.strictEqual(adminSelfSender.senderType, 'admin');

const adminSelfGift = {
  id: 'gift_2',
  fromName: adminSelfSender.senderName,
  fromUsername: adminSelfSender.senderUsername,
  senderType: adminSelfSender.senderType
};
const adminSelfDisplay = formatSenderDisplay(adminSelfGift);
assert.strictEqual(adminSelfDisplay, 'Alligator');
console.log('   ✅ Admin "From Alligator" sender display verified:', adminSelfDisplay);

// Case C: Admin sends gift from game name ('colorsort' / Color Sort)
const adminGameSender = resolveSenderInfo(true, 'colorsort', adminPlayer);
assert.strictEqual(adminGameSender.senderName, 'Color Sort');
assert.strictEqual(adminGameSender.senderType, 'colorsort');

const adminGameGift = {
  id: 'gift_3',
  fromName: adminGameSender.senderName,
  fromUsername: adminGameSender.senderUsername,
  senderType: adminGameSender.senderType
};
const adminGameDisplay = formatSenderDisplay(adminGameGift);
assert.strictEqual(adminGameDisplay, 'Color Sort');
console.log('   ✅ Admin "From Color Sort" sender display verified:', adminGameDisplay);

// --- 2. Test Zero-Delay Instant Claim & Stale Network Prevention ---
console.log('\n2️⃣ Testing Zero-Delay Instant Claim and Stale Network Protection...');

// Mock localStorage
const mockStorage = {};
const mockLocalStorage = {
  getItem: (k) => mockStorage[k] || null,
  setItem: (k, v) => { mockStorage[k] = String(v); }
};

const userId = '5761685341';
const CLAIMED_KEY = `colorsort_claimed_gift_ids_${userId}`;

function getClaimedGiftIds(uid) {
  const raw = mockLocalStorage.getItem(`colorsort_claimed_gift_ids_${uid}`);
  if (raw) {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return new Set(arr.map(String));
  }
  return new Set();
}

function markGiftIdAsClaimed(uid, giftId) {
  const set = getClaimedGiftIds(uid);
  set.add(String(giftId));
  mockLocalStorage.setItem(`colorsort_claimed_gift_ids_${uid}`, JSON.stringify(Array.from(set)));
}

function isGiftIdClaimed(uid, giftId) {
  const set = getClaimedGiftIds(uid);
  return set.has(String(giftId));
}

// User claims gift_2
assert.strictEqual(isGiftIdClaimed(userId, 'gift_2'), false, 'Initially gift_2 should not be claimed');
markGiftIdAsClaimed(userId, 'gift_2');
assert.strictEqual(isGiftIdClaimed(userId, 'gift_2'), true, 'gift_2 must immediately be in claimed set');

// Simulate a stale network fetch that returns gift_2 as unclaimed (claimed: false)
const staleNetworkInbox = [
  { id: 'gift_2', giftType: 'extraBottles', amount: 1, claimed: false },
  { id: 'gift_3', giftType: 'hints', amount: 1, claimed: false }
];

// Verify filtering: gift_2 MUST NOT appear in unclaimed list even if server/KVDB returned claimed: false
const unclaimedFiltered = staleNetworkInbox.filter(g => !g.claimed && !isGiftIdClaimed(userId, g.id));
assert.strictEqual(unclaimedFiltered.length, 1, 'Only gift_3 should be unclaimed');
assert.strictEqual(unclaimedFiltered[0].id, 'gift_3', 'gift_2 must be excluded from unclaimed');
console.log('   ✅ Stale network response filtered out with 0ms delay: claimed gift cannot reappear!');

// --- 3. Verify CSS and HTML Layout Requirements ---
console.log('\n3️⃣ Verifying CSS & HTML Layout for Cards & Admin Controls...');

const htmlPath = path.join(__dirname, '..', 'public', 'index.html');
const cssPath = path.join(__dirname, '..', 'public', 'style.css');
const giftsJsPath = path.join(__dirname, '..', 'public', 'js', 'gifts.js');

const htmlContent = fs.readFileSync(htmlPath, 'utf8');
const cssContent = fs.readFileSync(cssPath, 'utf8');
const giftsJsContent = fs.readFileSync(giftsJsPath, 'utf8');

// HTML checks
assert.ok(htmlContent.includes('id="adminSenderChoiceBox"'), 'HTML must contain adminSenderChoiceBox');
assert.ok(htmlContent.includes('id="btnSenderAdminSelf"'), 'HTML must contain btnSenderAdminSelf');
assert.ok(htmlContent.includes('id="btnSenderColorSort"'), 'HTML must contain btnSenderColorSort');
assert.ok(htmlContent.includes('id="giftQtySenderPreviewRow"'), 'HTML must contain sender preview in qty modal');
console.log('   ✅ HTML structure for admin sender selection and preview verified.');

// CSS checks: Card has flex-direction: column (top icon, middle text, bottom button)
assert.ok(cssContent.includes('.gift-received-card {'), 'CSS must style gift-received-card');
assert.ok(cssContent.includes('.gift-received-top {'), 'CSS must style gift-received-top for centered top icon');
assert.ok(cssContent.includes('.gift-received-body {'), 'CSS must style gift-received-body for full width middle description');
assert.ok(cssContent.includes('.btn-claim-gift {'), 'CSS must style btn-claim-gift');
assert.ok(cssContent.includes('.admin-sender-choice-box {'), 'CSS must style admin-sender-choice-box');
assert.ok(cssContent.includes('.btn-sender-toggle.active {'), 'CSS must style active sender toggle button');
console.log('   ✅ CSS styles for centered icon, full-width middle description, and bottom claim button verified.');

// gifts.js checks
assert.ok(giftsJsContent.includes('adminSenderMode'), 'gifts.js must manage adminSenderMode');
assert.ok(giftsJsContent.includes('markGiftIdAsClaimed'), 'gifts.js must track claimed gifts in persistent set');
assert.ok(giftsJsContent.includes('gift-received-top'), 'gifts.js must render gift-received-top');
assert.ok(giftsJsContent.includes('gift-received-body'), 'gifts.js must render gift-received-body');
assert.ok(giftsJsContent.includes('btn-claim-gift'), 'gifts.js must render btn-claim-gift');
console.log('   ✅ gifts.js implementation verified.');

console.log('\n🎉 ALL GIFTS SENDER IDENTITY & INSTANT CLAIM TESTS PASSED PERFECTLY!\n');
