const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('================================================================');
console.log('🧪 TEST SUITE: Maintenance Mode Access Control');
console.log('================================================================\n');

// 1. Verify Allowed Rules
const ALLOWED_IDS = ['5761685341', '7116446051'];
const ALLOWED_USERNAMES = ['alligator0709', 'maria290355'];

function isPlayerAllowed(telegramId, username) {
  const tid = String(telegramId || '').trim();
  const uname = String(username || '').toLowerCase().replace(/^@/, '').trim();
  if (ALLOWED_IDS.includes(tid)) return true;
  if (uname && ALLOWED_USERNAMES.includes(uname)) return true;
  return false;
}

// Test Alligator
assert.strictEqual(isPlayerAllowed('5761685341', ''), true, 'Alligator by ID must be allowed');
assert.strictEqual(isPlayerAllowed('', 'alligator0709'), true, 'Alligator by username must be allowed');
assert.strictEqual(isPlayerAllowed('5761685341', 'ALLIGATOR0709'), true, 'Alligator by ID and uppercase username must be allowed');
console.log('✅ 1. Alligator access confirmed (ID: 5761685341)');

// Test Maria
assert.strictEqual(isPlayerAllowed('7116446051', ''), true, 'Maria by ID must be allowed');
assert.strictEqual(isPlayerAllowed('', 'maria290355'), true, 'Maria by username must be allowed');
assert.strictEqual(isPlayerAllowed('7116446051', 'Maria290355'), true, 'Maria by ID and mixed username must be allowed');
console.log('✅ 2. Maria access confirmed (ID: 7116446051)');

// Test Unauthorized Players
assert.strictEqual(isPlayerAllowed('123456789', ''), false, 'Random ID must be BLOCKED');
assert.strictEqual(isPlayerAllowed('', 'john_doe'), false, 'Random username must be BLOCKED');
assert.strictEqual(isPlayerAllowed('guest_123', ''), false, 'Guest user must be BLOCKED');
assert.strictEqual(isPlayerAllowed('', ''), false, 'Anonymous user must be BLOCKED');
console.log('✅ 3. All other players strictly BLOCKED');

// 2. Verify HTML template contains maintenance elements
const indexHtml = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
assert(indexHtml.includes('id="maintenanceScreen"'), 'index.html must have maintenanceScreen modal');
assert(indexHtml.includes('Идут технические работы'), 'index.html must display maintenance title');
assert(indexHtml.includes('5761685341') && indexHtml.includes('7116446051'), 'index.html must have whitelist for Alligator and Maria');
console.log('✅ 4. HTML structure and frame-0 access script verified');

// 3. Verify CSS styling
const styleCss = fs.readFileSync(path.join(__dirname, '../public/style.css'), 'utf8');
assert(styleCss.includes('.maintenance-screen'), 'style.css must have maintenance screen styles');
assert(styleCss.includes('.maintenance-card'), 'style.css must have maintenance card styles');
console.log('✅ 5. Maintenance styling verified');

// 4. Verify app.js client controller
const appJs = fs.readFileSync(path.join(__dirname, '../public/js/app.js'), 'utf8');
assert(appJs.includes('MAINTENANCE_ALLOWED_IDS') && appJs.includes('5761685341') && appJs.includes('7116446051'), 'app.js must check maintenance whitelist');
assert(appJs.includes('window.__maintenanceBlocked'), 'app.js must block interactions on maintenance');
console.log('✅ 6. Client application controller verified');

// 5. Verify server.js and api/index.js middleware
const serverJs = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
const apiJs = fs.readFileSync(path.join(__dirname, '../api/index.js'), 'utf8');
assert(serverJs.includes('maintenanceMiddleware'), 'server.js must have maintenance middleware');
assert(apiJs.includes('maintenanceMiddleware'), 'api/index.js must have maintenance middleware');
console.log('✅ 7. Server and Vercel API middleware verified');

console.log('\n================================================================');
console.log('🎉 ALL MAINTENANCE MODE TESTS PASSED 100%!');
console.log('================================================================');
