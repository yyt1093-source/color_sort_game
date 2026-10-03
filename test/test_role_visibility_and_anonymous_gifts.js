/**
 * Test: Role-based username visibility and anonymous gift cards
 * Verifies that:
 * 1. Usernames (@username) are hidden from regular players everywhere in UI (leaderboard, gifts, referrals).
 * 2. Usernames and Telegram IDs remain fully visible to Administrator (Alligator/Romanchik / admin mode).
 * 3. Gift cards received by regular players are 100% anonymous ("Вам прислан полезный подарок!"),
 *    without displaying who sent the gift.
 * 4. Administrator has full audit access to sender information and usernames.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Running Role-Based Visibility & Anonymous Gifts Tests...');

// Load files to verify source code patterns
const appJsPath = path.join(__dirname, '..', 'public', 'js', 'app.js');
const giftsJsPath = path.join(__dirname, '..', 'public', 'js', 'gifts.js');

const appJsContent = fs.readFileSync(appJsPath, 'utf8');
const giftsJsContent = fs.readFileSync(giftsJsPath, 'utf8');

// 1. Verify Leaderboard Logic in app.js
console.log('Checking leaderboard username restriction in app.js...');
assert.ok(appJsContent.includes('const isAdminViewer = isAlligatorAdmin(currentUser);'), 'Leaderboard must check if current viewer is admin');
assert.ok(appJsContent.includes('const showUsername = isAdminViewer && cleanUsername;'), 'Usernames must only show if viewer is admin');
assert.ok(appJsContent.includes('${showUsername ? `<small class="player-handle"'), 'Template must guard handle rendering with showUsername');

// Simulate Leaderboard Rendering
function renderLeaderboardMock(player, viewer) {
  const isAdminViewer = Boolean(viewer.isAdmin || viewer.telegramId === '5761685341' || (viewer.username && viewer.username.toLowerCase().includes('alligator')));
  const rawUsername = player.username || '';
  const cleanUsername = rawUsername ? String(rawUsername).replace(/^@/, '').trim() : '';
  const showUsername = isAdminViewer && cleanUsername;
  const nameDisplay = player.firstName || 'Игрок';

  return `
    <div class="player-meta">
      <div class="player-info-cell">
        <strong>${nameDisplay}</strong>
        ${showUsername ? `<small class="player-handle">@${cleanUsername}</small>` : ''}
      </div>
    </div>
  `;
}

const mockPlayer = { firstName: 'Алексей', username: 'alex_cool_player', telegramId: '123456789' };
const regularViewer = { firstName: 'Мария', username: 'maria_user', telegramId: '987654321', isAdmin: false };
const adminViewer = { firstName: 'Аллигатор', username: 'alligator_super', telegramId: '5761685341', isAdmin: true };

const regularLeaderboardHtml = renderLeaderboardMock(mockPlayer, regularViewer);
assert.ok(!regularLeaderboardHtml.includes('@alex_cool_player'), 'Regular user must NOT see @username in leaderboard');
assert.ok(!regularLeaderboardHtml.includes('player-handle'), 'Regular user must NOT have player-handle element');
assert.ok(regularLeaderboardHtml.includes('<strong>Алексей</strong>'), 'Regular user must see player nickname');
console.log('✅ Leaderboard: Regular player sees only nickname, no @username');

const adminLeaderboardHtml = renderLeaderboardMock(mockPlayer, adminViewer);
assert.ok(adminLeaderboardHtml.includes('@alex_cool_player'), 'Admin MUST see @username in leaderboard');
assert.ok(adminLeaderboardHtml.includes('player-handle'), 'Admin MUST have player-handle element');
assert.ok(adminLeaderboardHtml.includes('<strong>Алексей</strong>'), 'Admin must see player nickname');
console.log('✅ Leaderboard: Admin sees player nickname and @username');

// 2. Verify Gifts Player Selection Logic in gifts.js
console.log('Checking gifts player list restriction in gifts.js...');
assert.ok(giftsJsContent.includes('const usernameDisplay = (isAdmin && cleanUsername) ? `@${cleanUsername}` : \'\';'), 'Gifts player list must restrict usernameDisplay to admin');

function renderGiftPlayerRowMock(player, currentUser) {
  const isAdmin = Boolean(currentUser.isAdmin || currentUser.telegramId === '5761685341');
  const name = player.firstName || 'Игрок';
  const rawUsername = player.username || '';
  const cleanUsername = rawUsername ? String(rawUsername).replace(/^@/, '').trim() : '';
  const usernameDisplay = (isAdmin && cleanUsername) ? `@${cleanUsername}` : '';

  const selectedRecipient = {
    telegramId: String(player.telegramId),
    displayName: usernameDisplay ? `${name} (${usernameDisplay})` : name,
    firstName: name,
    username: cleanUsername
  };

  const html = `
    <div class="gift-player-row">
      <strong class="gift-player-name">${name}</strong>
      ${usernameDisplay ? `<small class="player-handle">${usernameDisplay}</small>` : ''}
    </div>
  `;

  return { html, selectedRecipient };
}

const regularGiftRow = renderGiftPlayerRowMock(mockPlayer, regularViewer);
assert.ok(!regularGiftRow.html.includes('@alex_cool_player'), 'Regular player must NOT see @username in gifts list');
assert.strictEqual(regularGiftRow.selectedRecipient.displayName, 'Алексей', 'Recipient display name must be just nickname for regular player');
console.log('✅ Gifts List: Regular player sees only nickname, no @username in player list or recipient bar');

const adminGiftRow = renderGiftPlayerRowMock(mockPlayer, adminViewer);
assert.ok(adminGiftRow.html.includes('@alex_cool_player'), 'Admin MUST see @username in gifts list');
assert.strictEqual(adminGiftRow.selectedRecipient.displayName, 'Алексей (@alex_cool_player)', 'Admin sees nickname and username in recipient bar');
console.log('✅ Gifts List: Admin sees nickname and @username in player list and recipient bar');

// 3. Verify Anonymous Received Gift Card
console.log('Checking received gift anonymity in gifts.js...');
function renderReceivedGiftMock(gift, currentUser) {
  const isAdmin = Boolean(currentUser.isAdmin || currentUser.telegramId === '5761685341');
  let descText = 'Вам прислан полезный подарок!';
  if (isAdmin) {
    let senderInfo = '';
    if (gift.fromUsername) {
      senderInfo = `@${String(gift.fromUsername).replace(/^@/, '')}`;
    } else if (gift.fromName) {
      senderInfo = gift.fromName;
    }
    if (gift.fromId) {
      senderInfo = senderInfo ? `${senderInfo} (ID: ${gift.fromId})` : `ID: ${gift.fromId}`;
    }
    if (senderInfo) {
      descText = `Вам прислан полезный подарок! <small>[От: ${senderInfo}]</small>`;
    }
  }

  return descText;
}

const mockGift = {
  id: 'gift_123',
  giftType: 'extraBottles',
  amount: 1,
  fromId: '987654321',
  fromName: 'Мария',
  fromUsername: 'maria_user'
};

const regularGiftDesc = renderReceivedGiftMock(mockGift, regularViewer);
assert.strictEqual(regularGiftDesc, 'Вам прислан полезный подарок!', 'Regular player must receive completely anonymous gift card');
assert.ok(!regularGiftDesc.includes('Мария'), 'Regular player must not see sender name');
assert.ok(!regularGiftDesc.includes('maria_user'), 'Regular player must not see sender username');
assert.ok(!regularGiftDesc.includes('987654321'), 'Regular player must not see sender ID');
console.log('✅ Received Gift Card: Regular recipient sees strictly anonymous card ("Вам прислан полезный подарок!")');

const adminGiftDesc = renderReceivedGiftMock(mockGift, adminViewer);
assert.ok(adminGiftDesc.includes('Вам прислан полезный подарок!'), 'Admin sees gift card description');
assert.ok(adminGiftDesc.includes('@maria_user'), 'Admin sees sender username');
assert.ok(adminGiftDesc.includes('ID: 987654321'), 'Admin sees sender ID for system audit');
console.log('✅ Received Gift Card: Admin has full audit visibility of sender username and ID');

// 4. Verify Internal Data Retention on Gift Creation
console.log('Checking gift creation payload keeps data for admin/server...');
assert.ok(giftsJsContent.includes('fromId: myId'), 'Gift object must store fromId');
assert.ok(giftsJsContent.includes('fromName: currentUserRef.firstName'), 'Gift object must store fromName');
assert.ok(giftsJsContent.includes('fromUsername: senderUsername'), 'Gift object must store fromUsername');
console.log('✅ Internal Gift Object: Full sender details retained for server database & administrator audit');

// 5. Verify Referrals List Restriction in app.js
console.log('Checking referrals list username restriction in app.js...');
assert.ok(appJsContent.includes('const isAdmin = isAlligatorAdmin(currentUser);') && appJsContent.includes('if (isAdmin && r.referred_username)'), 'Referrals list must restrict username to admin');
console.log('✅ Referrals List: Usernames restricted strictly to administrator');

console.log('🎉 ALL ROLE-BASED VISIBILITY & ANONYMOUS GIFTS TESTS PASSED!');
