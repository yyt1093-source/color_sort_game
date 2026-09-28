const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('🧪 Testing Telegram Channel Cards Implementation (Cyber Farm & Color Sort)...');

// 1. Check index.html
const htmlPath = path.join(__dirname, '../public/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

// Color Sort Card assertions
assert(html.includes('id="telegramChannelCard"'), 'telegramChannelCard must exist in index.html');
assert(html.includes('role="button"'), 'telegramChannelCard must have role="button"');
assert(html.includes('id="tgChannelTitle"'), 'tgChannelTitle must exist in index.html');
assert(html.includes('href="https://t.me/sortcolors"'), 'Link to https://t.me/sortcolors must exist');
assert(html.includes('src="assets/sortcolors.jpg"'), 'assets/sortcolors.jpg image must exist in index.html');
assert(html.includes('id="telegramChannelJoinBtn"'), 'telegramChannelJoinBtn must exist in index.html');
assert(html.includes('id="telegramChannelLink"'), 'telegramChannelLink must exist in index.html');
assert(html.includes('id="tgChannelThumb"'), 'tgChannelThumb must exist in index.html');

// Cyber Farm Card assertions
assert(html.includes('id="tgCardCyberFarm"'), 'tgCardCyberFarm must exist in index.html');
assert(html.includes('href="https://t.me/cyberfarmk"'), 'Link to https://t.me/cyberfarmk must exist');
assert(html.includes('src="assets/cyberfarm.jpg"'), 'assets/cyberfarm.jpg image must exist in index.html');
assert(html.includes('id="tgBadgeCyberFarm"'), 'tgBadgeCyberFarm must exist in index.html');
assert(html.includes('id="tgBtnCyberFarm"'), 'tgBtnCyberFarm must exist in index.html');
assert(html.includes('id="tgLinkCyberFarm"'), 'tgLinkCyberFarm must exist in index.html');

assert(/js\/app\.js\?v=\d+/.test(html), 'app.js script tag with cache-busting version must exist');
console.log('  ✅ [PASS] index.html structure verified');

// 2. Check style.css
const cssPath = path.join(__dirname, '../public/style.css');
const css = fs.readFileSync(cssPath, 'utf8');
assert(css.includes('.telegram-channel-box'), '.telegram-channel-box must be in style.css');
assert(css.includes('cursor: pointer'), 'telegram-channel-box must have cursor: pointer');
assert(css.includes('flex-shrink: 0'), 'telegram-channel-box must have flex-shrink: 0 to prevent squashing');
assert(css.includes('.tg-channel-header-row'), '.tg-channel-header-row must be in style.css');
assert(css.includes('.tg-channel-card-title'), '.tg-channel-card-title must be in style.css');
assert(css.includes('.tg-channel-corner-arrow'), '.tg-channel-corner-arrow must be in style.css');
assert(css.includes('.tg-channel-avatar-wrap'), '.tg-channel-avatar-wrap must be in style.css');
assert(css.includes('.tg-channel-link-pill'), '.tg-channel-link-pill must be in style.css');
assert(css.includes('.tg-channel-cta-btn'), '.tg-channel-cta-btn must be in style.css');
console.log('  ✅ [PASS] style.css rules verified');

// 3. Check assets exist on disk
const cfImg = path.join(__dirname, '../public/assets/cyberfarm.jpg');
const csImg = path.join(__dirname, '../public/assets/sortcolors.jpg');
assert(fs.existsSync(cfImg), 'public/assets/cyberfarm.jpg must exist on disk');
assert(fs.statSync(cfImg).size > 10000, 'public/assets/cyberfarm.jpg must have valid size');
assert(fs.existsSync(csImg), 'public/assets/sortcolors.jpg must exist on disk');
assert(fs.statSync(csImg).size > 10000, 'public/assets/sortcolors.jpg must have valid size');
console.log('  ✅ [PASS] image assets verified on disk');

// 4. Check app.js
const appJsPath = path.join(__dirname, '../public/js/app.js');
const appJs = fs.readFileSync(appJsPath, 'utf8');
assert(appJs.includes('openSortColorsTelegramChannel'), 'openSortColorsTelegramChannel must exist in app.js');
assert(appJs.includes('openCyberFarmTelegramChannel'), 'openCyberFarmTelegramChannel must exist in app.js');
assert(appJs.includes('openTelegramChannelUrl'), 'openTelegramChannelUrl must exist in app.js');
assert(appJs.includes('telegramChannelCard.addEventListener'), 'telegramChannelCard must have click event listener');
assert(appJs.includes('tgCardCyberFarm.addEventListener'), 'tgCardCyberFarm must have click event listener');
assert(appJs.includes('https://t.me/sortcolors'), 'https://t.me/sortcolors must exist in app.js');
assert(appJs.includes('https://t.me/cyberfarmk'), 'https://t.me/cyberfarmk must exist in app.js');
assert(appJs.includes('officialBadge'), 'officialBadge must be in app.js');
assert(appJs.includes('ourProject'), 'ourProject must be in app.js');
assert(appJs.includes('openTelegramLink(channelUrl)'), 'openTelegramLink must be called for telegram');
console.log('  ✅ [PASS] app.js handlers and i18n verified');

console.log('🎉 All Telegram Channel Card tests passed successfully!');
