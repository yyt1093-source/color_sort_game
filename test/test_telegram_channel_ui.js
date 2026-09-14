const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('🧪 Testing Telegram Channel Card Implementation...');

// 1. Check index.html
const htmlPath = path.join(__dirname, '../public/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

assert(html.includes('id="telegramChannelCard"'), 'telegramChannelCard must exist in index.html');
assert(html.includes('id="tgChannelTitle"'), 'tgChannelTitle must exist in index.html');
assert(html.includes('href="https://t.me/sortcolors"'), 'Link to https://t.me/sortcolors must exist');
assert(html.includes('src="referral_art_clean.jpg"'), 'referral_art_clean.jpg jar image must exist');
assert(html.includes('id="telegramChannelJoinBtn"'), 'telegramChannelJoinBtn must exist in index.html');
assert(html.includes('id="telegramChannelLink"'), 'telegramChannelLink must exist in index.html');
assert(html.includes('id="tgChannelThumb"'), 'tgChannelThumb must exist in index.html');
console.log('  ✅ [PASS] index.html structure verified');

// 2. Check style.css
const cssPath = path.join(__dirname, '../public/style.css');
const css = fs.readFileSync(cssPath, 'utf8');
assert(css.includes('.telegram-channel-box'), '.telegram-channel-box must be in style.css');
assert(css.includes('.tg-channel-thumb'), '.tg-channel-thumb must be in style.css');
assert(css.includes('.tg-channel-link-btn'), '.tg-channel-link-btn must be in style.css');
assert(css.includes('.tg-join-channel-btn'), '.tg-join-channel-btn must be in style.css');
console.log('  ✅ [PASS] style.css rules verified');

// 3. Check app.js
const appJsPath = path.join(__dirname, '../public/js/app.js');
const appJs = fs.readFileSync(appJsPath, 'utf8');
assert(appJs.includes('openSortColorsTelegramChannel'), 'openSortColorsTelegramChannel must exist in app.js');
assert(appJs.includes('https://t.me/sortcolors'), 'https://t.me/sortcolors must exist in app.js');
assert(appJs.includes('tgChannelTitle'), 'tgChannelTitle must be in app.js');
assert(appJs.includes('tgChannelBadge'), 'tgChannelBadge must be in app.js');
assert(appJs.includes('tgChannelSub'), 'tgChannelSub must be in app.js');
assert(appJs.includes('tgChannelJoinBtn'), 'tgChannelJoinBtn must be in app.js');
assert(appJs.includes('openTelegramLink(channelUrl)'), 'openTelegramLink must be called for telegram');
console.log('  ✅ [PASS] app.js handlers and i18n verified');

console.log('🎉 All Telegram Channel Card tests passed successfully!');
