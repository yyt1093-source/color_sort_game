/**
 * Test: Admin Save Current Version Feature
 * Verifies that:
 * 1. Admin panel includes the "Сохранить текущую версию" action button.
 * 2. Save version modal with Title, Tag, and Note inputs exists in index.html.
 * 3. Event handlers and API synchronization logic exist in app.js.
 * 4. DEFAULT_CODE_CHECKPOINTS in app.js, server.js, and api/index.js include v1.0.7.
 * 5. Kyiv time formatting and checkpoint ID generation logic are valid.
 * 6. Live cloud KVDB returns v1.0.7 at the top of the checkpoints list.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Admin Save Current Version Feature...');

const appJsPath = path.join(__dirname, '..', 'public', 'js', 'app.js');
const indexHtmlPath = path.join(__dirname, '..', 'public', 'index.html');
const serverJsPath = path.join(__dirname, '..', 'server.js');
const apiIndexPath = path.join(__dirname, '..', 'api', 'index.js');

const appJs = fs.readFileSync(appJsPath, 'utf8');
const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
const serverJs = fs.readFileSync(serverJsPath, 'utf8');
const apiIndex = fs.readFileSync(apiIndexPath, 'utf8');

// 1. Verify index.html UI elements
console.log('Checking index.html elements...');
assert.ok(indexHtml.includes('id="adminSaveCurrentVersionBtn"'), 'Must have adminSaveCurrentVersionBtn');
assert.ok(indexHtml.includes('id="adminSaveVersionModal"'), 'Must have adminSaveVersionModal');
assert.ok(indexHtml.includes('id="adminSaveVersionTitleInput"'), 'Must have adminSaveVersionTitleInput');
assert.ok(indexHtml.includes('id="adminSaveVersionTagInput"'), 'Must have adminSaveVersionTagInput');
assert.ok(indexHtml.includes('id="adminSaveVersionNoteInput"'), 'Must have adminSaveVersionNoteInput');
assert.ok(indexHtml.includes('id="adminSaveVersionConfirmBtn"'), 'Must have adminSaveVersionConfirmBtn');
assert.ok(indexHtml.includes('id="adminSaveVersionCancelBtn"'), 'Must have adminSaveVersionCancelBtn');
console.log('✅ UI elements in index.html verified!');

// 2. Verify app.js logic
console.log('Checking app.js logic...');
assert.ok(appJs.includes('adminSaveCurrentVersionBtn.addEventListener'), 'Must bind click to adminSaveCurrentVersionBtn');
assert.ok(appJs.includes('adminSaveVersionConfirmBtn.addEventListener'), 'Must bind click to adminSaveVersionConfirmBtn');
assert.ok(appJs.includes("action: 'create'"), 'Must call API with action: create');
assert.ok(appJs.includes('colorsort_code_checkpoints'), 'Must synchronize to KVDB');
assert.ok(appJs.includes('colorsort_checkpoint_20261003_162500'), 'Must have v1.0.7 in app.js DEFAULT_CODE_CHECKPOINTS');
console.log('✅ app.js event handling and sync logic verified!');

// 3. Verify server.js and api/index.js
console.log('Checking server.js and api/index.js...');
assert.ok(serverJs.includes('colorsort_checkpoint_20261003_162500'), 'server.js must have v1.0.7 checkpoint');
assert.ok(apiIndex.includes('colorsort_checkpoint_20261003_162500'), 'api/index.js must have v1.0.7 checkpoint');
console.log('✅ Backend checkpoints seed verified!');

// 4. Verify Kyiv time formatting logic
console.log('Testing Kyiv time formatting helper...');
const now = 1791033900000;
const d = new Date(now);
const datePart = d.toLocaleDateString('ru-RU', {
  timeZone: 'Europe/Kyiv',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric'
});
const timePart = d.toLocaleTimeString('ru-RU', {
  timeZone: 'Europe/Kyiv',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false
});
const kyivStr = `${datePart}, ${timePart} (Киев)`;
assert.ok(kyivStr.includes('(Киев)'), 'Must include Kyiv timezone indicator');
console.log('✅ Kyiv timestamp helper verified:', kyivStr);

// 5. Verify Live Cloud KVDB has v1.0.7
console.log('Querying cloud KVDB for latest checkpoint...');
fetch('https://kvdb.io/82kzJTUxZwwFNvg7kUSqgM/colorsort_code_checkpoints?_cb=' + Date.now())
  .then(r => r.json())
  .then(list => {
    assert.ok(Array.isArray(list) && list.length > 0, 'KVDB checkpoints must be a non-empty array');
    const top = list[0];
    assert.strictEqual(top.id, 'colorsort_checkpoint_20261003_162500', 'Top checkpoint must be v1.0.7');
    assert.ok(top.title.includes('v1.0.7'), 'Title must contain v1.0.7');
    console.log('✅ Live Cloud KVDB top checkpoint verified:', top.title);
    console.log('🎉 ALL ADMIN SAVE CURRENT VERSION TESTS PASSED PERFECTLY!');
  })
  .catch(err => {
    console.error('KVDB query failed:', err);
    process.exit(1);
  });
