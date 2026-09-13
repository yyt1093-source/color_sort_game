const fs = require('fs');
const html = fs.readFileSync('public/invite.html', 'utf8');

console.log('--- Testing public/invite.html ---');
const checks = [
  { name: 'og:image points to referral_art_clean.jpg', pass: html.includes('content="https://yyt1093-source.github.io/color_sort_game/referral_art_clean.jpg"') },
  { name: 'twitter:card is summary_large_image', pass: html.includes('name="twitter:card" content="summary_large_image"') },
  { name: 'twitter:image is referral_art_clean.jpg', pass: html.includes('name="twitter:image" content="https://yyt1093-source.github.io/color_sort_game/referral_art_clean.jpg"') },
  { name: 'og:width 1024', pass: html.includes('content="1024"') },
  { name: 'Inline banner image present', pass: html.includes('src="referral_art_clean.jpg"') },
  { name: 'Telegram bot redirection code present', pass: html.includes('window.location.replace(botUrl)') },
  { name: 'Sortcolors bot target URL present', pass: html.includes('https://t.me/sortcolors_bot') },
  { name: 'Direct play button present', pass: html.includes('id="tgBtn"') }
];

let allPassed = true;
for (const c of checks) {
  console.log((c.pass ? '✅ [PASS] ' : '❌ [FAIL] ') + c.name);
  if (!c.pass) allPassed = false;
}

// Test URL param extraction logic in invite.html
function simulateRedirect(queryString) {
  const urlParams = new URLSearchParams(queryString);
  const refParam = urlParams.get('startapp') || urlParams.get('ref') || urlParams.get('tgWebAppStartParam') || '';
  let startParam = '';
  if (refParam) {
    const m = String(refParam).match(/(?:ref_)?(\d+)/i);
    startParam = m ? ('ref_' + m[1]) : refParam;
  }
  return 'https://t.me/sortcolors_bot' + (startParam ? ('?startapp=' + encodeURIComponent(startParam)) : '');
}

const testCases = [
  { qs: '?startapp=ref_12345678', expected: 'https://t.me/sortcolors_bot?startapp=ref_12345678' },
  { qs: '?ref=12345678', expected: 'https://t.me/sortcolors_bot?startapp=ref_12345678' },
  { qs: '?tgWebAppStartParam=ref_998877', expected: 'https://t.me/sortcolors_bot?startapp=ref_998877' },
  { qs: '', expected: 'https://t.me/sortcolors_bot' }
];

console.log('\n--- Testing Redirect Simulation ---');
for (const tc of testCases) {
  const res = simulateRedirect(tc.qs);
  const pass = res === tc.expected;
  console.log((pass ? '✅ [PASS] ' : '❌ [FAIL] ') + `${tc.qs} -> ${res}`);
  if (!pass) allPassed = false;
}

if (!allPassed) process.exit(1);
console.log('\n🎉 All invite.html verification checks and redirect test cases passed!');
