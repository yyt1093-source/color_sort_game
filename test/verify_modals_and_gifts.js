const fs = require('fs');
const assert = require('assert');

console.log('--- Verifying HTML Structure & Modals ---');
const html = fs.readFileSync('public/index.html', 'utf8');

// Check that resetSeasonModal closes before adminSaveVersionModal
const resetSeasonIdx = html.indexOf('id="resetSeasonModal"');
const adminSaveVersionIdx = html.indexOf('id="adminSaveVersionModal"');
const leaderboardIdx = html.indexOf('id="leaderboardModal"');
const adModalIdx = html.indexOf('id="adModal"');

assert(resetSeasonIdx !== -1, 'resetSeasonModal not found');
assert(adminSaveVersionIdx !== -1, 'adminSaveVersionModal not found');
assert(leaderboardIdx !== -1, 'leaderboardModal not found');
assert(adModalIdx !== -1, 'adModal not found');

assert(resetSeasonIdx < adminSaveVersionIdx, 'resetSeasonModal should come before adminSaveVersionModal');
assert(adminSaveVersionIdx < leaderboardIdx, 'adminSaveVersionModal should come before leaderboardModal');
assert(leaderboardIdx < adModalIdx, 'leaderboardModal should come before adModal');

// Check tag balance between resetSeasonIdx and adminSaveVersionIdx
const betweenResetAndAdmin = html.substring(resetSeasonIdx, adminSaveVersionIdx);
const divsOpened = (betweenResetAndAdmin.match(/<div(\s|>)/g) || []).length;
const divsClosed = (betweenResetAndAdmin.match(/<\/div>/g) || []).length;

console.log(`resetSeasonModal section: opened divs = ${divsOpened}, closed divs = ${divsClosed}`);
assert.strictEqual(divsOpened, divsClosed, 'resetSeasonModal must have an equal number of opening and closing div tags!');

// Verify full HTML tag balance
const voidTags = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
const tagRegex = /<\/?([a-zA-Z0-9\-]+)([^>]*)>/g;
let stack = [];
let match;
while ((match = tagRegex.exec(html)) !== null) {
  const full = match[0];
  const tag = match[1].toLowerCase();
  const isClosing = full.startsWith('</');
  const isSelf = voidTags.has(tag) || full.endsWith('/>');
  if (isSelf) continue;
  if (isClosing) {
    assert(stack.length > 0, `Unexpected closing tag </${tag}>`);
    const top = stack.pop();
    assert.strictEqual(top, tag, `Mismatched tags: expected </${top}> but found </${tag}>`);
  } else {
    stack.push(tag);
  }
}
assert.strictEqual(stack.length, 0, 'All HTML tags must be properly closed!');
console.log('✓ HTML tags are 100% balanced and all modals are independent siblings!');

console.log('\n--- Verifying gifts.js Player Rendering ---');
const giftsJs = fs.readFileSync('public/js/gifts.js', 'utf8');

// Ensure select button is removed from player list
assert(!giftsJs.includes('gift-player-select-btn'), 'gifts.js should not contain gift-player-select-btn');
assert(!giftsJs.includes('giftsSelectPlayerBtn'), 'gifts.js should not call giftsSelectPlayerBtn');

// Ensure level badge is rendered in .gift-player-right
assert(giftsJs.includes('gift-player-right'), 'gifts.js must contain .gift-player-right container');
assert(giftsJs.includes('gift-player-lvl'), 'gifts.js must render .gift-player-lvl badge');
assert(giftsJs.includes('${lvl}'), 'gifts.js must render player level value');

console.log('✓ gifts.js player list rendering verified: select button removed, level displayed in right corner!');
console.log('\nALL VERIFICATIONS PASSED SUCCESSFULLY!');
