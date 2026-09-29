const fs = require('fs');

const html = fs.readFileSync('public/index.html', 'utf8');
const start = html.indexOf('id="profileModal"');
const end = html.indexOf('id="resetPurchasesModal"');

if (start === -1 || end === -1) {
  console.error('Modal boundaries not found!');
  process.exit(1);
}

const modalSlice = html.substring(start, end);
const opens = (modalSlice.match(/<div\b/g) || []).length;
const closes = (modalSlice.match(/<\/div>/g) || []).length;

console.log(`ProfileModal div balance: opens=${opens}, closes=${closes}`);

if (opens !== closes) {
  console.error(`Div count mismatch: ${opens} open vs ${closes} close`);
  process.exit(1);
}

// Verify that profileTabsNav contains ONLY 2 tabs (no admin tab)
const navStart = html.indexOf('id="profileTabsNav"');
const navEnd = html.indexOf('</div>', navStart);
const navSlice = html.substring(navStart, navEnd);

if (navSlice.includes('profileTabBtnAdmin') || navSlice.includes('🛡️')) {
  console.error('ERROR: profileTabsNav still contains admin shield button!');
  process.exit(1);
}
console.log('✅ profileTabsNav correctly has ONLY 2 tabs (Profile & Referrals)!');

const requiredIds = [
  'profileTabsNav',
  'profileTabBtnProfile',
  'profileTabBtnReferrals',
  'profileTabContentProfile',
  'profileTabContentReferrals',
  'profileAdminQuickBtn',
  'langGrid',
  'tgCardCyberFarm',
  'telegramChannelCard',
  'shareReferralTelegramBtn',
  'copyReferralLinkBtn',
  'referralsListContainer',
  'adminPanelSection'
];

let allFound = true;
for (const id of requiredIds) {
  if (!modalSlice.includes(`id="${id}"`)) {
    console.error(`Missing required ID in profile modal: ${id}`);
    allFound = false;
  }
}

if (!allFound) {
  process.exit(1);
}

console.log('✅ HTML validation passed successfully!');
