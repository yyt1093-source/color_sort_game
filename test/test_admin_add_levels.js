const fs = require('fs');
const path = require('path');
const assert = require('assert');
const db = require('../db');

console.log('🧪 Testing Admin "+5 Levels" Functionality...');

// 1. Test database addBonus with levels
const testId = 'test_admin_level_user_' + Date.now();
let user = db.getUser(testId, { first_name: 'TestAdmin' });
assert.strictEqual(Number(user.current_level), 1, 'Initial current_level should be 1');
assert.strictEqual(Number(user.max_level), 0, 'Initial max_level should be 0');

user = db.addBonus(testId, { levels: 5 });
assert.strictEqual(Number(user.current_level), 6, 'current_level should be 6 after +5 levels');
assert.strictEqual(Number(user.max_level), 5, 'max_level should be 5 after +5 levels');

user = db.addBonus(testId, { levels: 5 });
assert.strictEqual(Number(user.current_level), 11, 'current_level should be 11 after another +5 levels');
assert.strictEqual(Number(user.max_level), 10, 'max_level should be 10 after another +5 levels');
console.log('  ✅ [PASS] db.addBonus successfully increments current_level and max_level');

// 2. Test index.html UI elements
const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
assert(html.includes('id="adminAddLevelsBtn"'), 'index.html must contain adminAddLevelsBtn');
assert(html.includes('id="adminAddLevelsLabel"'), 'index.html must contain adminAddLevelsLabel');
assert(html.includes('+5 Уровней'), 'index.html must have "+5 Уровней" text');
console.log('  ✅ [PASS] index.html contains adminAddLevelsBtn and label');

// 3. Test app.js logic and i18n
const appJs = fs.readFileSync(path.join(__dirname, '../public/js/app.js'), 'utf8');
assert(appJs.includes('adminAddLevelsBtn'), 'app.js must reference adminAddLevelsBtn');
assert(appJs.includes('adminAddLevels:'), 'app.js must have adminAddLevels i18n key');
assert(appJs.includes('adminLevelsAddedMsg:'), 'app.js must have adminLevelsAddedMsg i18n key');
assert(appJs.includes('loadCurrentLevel()'), 'adminAddLevelsBtn handler must reload level board');
console.log('  ✅ [PASS] app.js contains adminAddLevels handler, i18n and level reload');

// 4. Test server.js and api/index.js routes
const serverJs = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
assert(serverJs.includes('levels: Number(levels || 0)'), 'server.js must parse and forward levels parameter');
const apiJs = fs.readFileSync(path.join(__dirname, '../api/index.js'), 'utf8');
assert(apiJs.includes('levels: Number(levels || 0)'), 'api/index.js must parse and forward levels parameter');
console.log('  ✅ [PASS] server.js and api/index.js support levels in /api/admin/add-boosters');

console.log('🎉 All Admin "+5 Levels" tests passed successfully!');
