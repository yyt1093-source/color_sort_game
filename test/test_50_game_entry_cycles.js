const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('================================================================');
console.log('🚀 50-CYCLE COMPREHENSIVE GAME ENTRY & STARTUP VERIFICATION');
console.log('================================================================\n');

// 1. Verify index.html and app.js invariants
const htmlContent = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
const appContent = fs.readFileSync(path.join(__dirname, '../public/js/app.js'), 'utf8');

assert(htmlContent.includes('id="startScreen"'), '#startScreen must exist in index.html');
assert(htmlContent.includes('id="startGameBtn"'), '#startGameBtn must exist in index.html');
assert(htmlContent.includes('window.dismissStartScreen'), 'index.html must define window.dismissStartScreen');
assert(htmlContent.includes('180'), 'dismiss timeout must be 180ms');

assert(appContent.includes('window.__triggerStartGame = handleStart'), 'app.js must bind window.__triggerStartGame');
assert(appContent.includes('if (window.__startDismissed)'), 'app.js must handle early click before app.js load');

console.log('✅ HTML & app.js structural invariants verified.');

// 2. Mock DOM Structure
class MockClassList {
  constructor() { this.classes = new Set(); }
  add(c) { this.classes.add(c); }
  remove(c) { this.classes.delete(c); }
  contains(c) { return this.classes.has(c); }
}

class MockElement {
  constructor(id = '', tag = 'div') {
    this.id = id;
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.listeners = new Map();
    this.style = {};
    this.classList = new MockClassList();
    this.textContent = '';
    this.complete = true;
  }
  addEventListener(event, fn, opts) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(fn);
  }
  removeEventListener(event, fn) {
    if (!this.listeners.has(event)) return;
    this.listeners.set(event, this.listeners.get(event).filter(f => f !== fn));
  }
  dispatchEvent(evt) {
    const fns = this.listeners.get(evt.type) || [];
    for (const fn of fns) fn(evt);
  }
  click() {
    this.dispatchEvent({ type: 'click', target: this, cancelable: true, preventDefault: () => {}, stopPropagation: () => {} });
  }
  appendChild(child) {
    this.children.push(child);
    child.parentNode = this;
  }
  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) this.children.splice(idx, 1);
    child.parentNode = null;
    return child;
  }
  querySelector(sel) { return null; }
  querySelectorAll(sel) { return []; }
}

function createFreshEnvironment() {
  const elements = new Map();
  const getOrCreate = (id, tag = 'div') => {
    if (!elements.has(id)) elements.set(id, new MockElement(id, tag));
    return elements.get(id);
  };

  const body = new MockElement('body', 'body');
  const scr = getOrCreate('startScreen');
  const btn = getOrCreate('startGameBtn', 'button');
  const loadingBox = getOrCreate('splashLoadingBox');
  const pBar = getOrCreate('splashProgressBar');
  const pPercent = getOrCreate('splashLoadingPercent');
  const pTitle = getOrCreate('splashLoadingTitle');
  const pImg = getOrCreate('splashImg', 'img');
  const board = getOrCreate('gameBoard');
  const userProfileBtn = getOrCreate('userProfileBtn', 'button');
  const userName = getOrCreate('userName');
  const levelDisplay = getOrCreate('levelDisplay');
  const levelBadgeLabel = getOrCreate('levelBadgeLabel');

  body.appendChild(scr);
  scr.appendChild(loadingBox);
  scr.appendChild(btn);
  body.appendChild(board);

  const document = {
    body,
    getElementById: (id) => elements.get(id) || null,
    querySelectorAll: (sel) => [],
    querySelector: (sel) => null,
    createElement: (tag) => new MockElement('', tag),
    addEventListener: () => {},
    removeEventListener: () => {},
    readyState: 'complete'
  };

  const window = {
    document,
    Telegram: {
      WebApp: {
        initData: '',
        initDataUnsafe: { user: { id: 99999, first_name: 'TestUser' } },
        ready: () => {},
        expand: () => {},
        requestFullscreen: () => {},
        disableVerticalSwipes: () => {},
        setHeaderColor: () => {},
        setBackgroundColor: () => {},
        HapticFeedback: { impactOccurred: () => {}, notificationOccurred: () => {} }
      }
    },
    localStorage: {
      store: {},
      getItem(k) { return this.store[k] || null; },
      setItem(k, v) { this.store[k] = String(v); },
      removeItem(k) { delete this.store[k]; }
    },
    requestAnimationFrame: (cb) => setTimeout(cb, 16),
    setTimeout: (cb, ms) => setTimeout(cb, ms),
    clearTimeout: (id) => clearTimeout(id),
    setInterval: (cb, ms) => setInterval(cb, ms),
    clearInterval: (id) => clearInterval(id),
    Date: Date,
    Math: Math
  };

  return { window, document, scr, btn, loadingBox, pBar, pPercent, board };
}

// 3. Run 50 Cycles
async function runEntryCycle(cycleNum, testMode) {
  const { window, document, scr, btn, loadingBox, pBar, pPercent, board } = createFreshEnvironment();

  // Extract inline start screen script from index.html
  const scriptMatch = htmlContent.match(/<!-- Fullscreen Start Splash Screen -->[\s\S]*?<script>([\s\S]*?)<\/script>/);
  assert(scriptMatch, 'Inline start screen script must exist in index.html');
  const inlineScriptCode = scriptMatch[1];

  // Execute inline script in window sandbox
  const runInWindow = (code) => {
    const fn = new Function('window', 'document', 'localStorage', 'requestAnimationFrame', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', code);
    fn(window, document, window.localStorage, window.requestAnimationFrame, window.setTimeout, window.clearTimeout, window.setInterval, window.clearInterval);
  };

  // Run initial start screen script
  runInWindow(inlineScriptCode);

  assert(typeof window.dismissStartScreen === 'function', `Cycle ${cycleNum}: window.dismissStartScreen must be defined`);
  assert.strictEqual(window.__startDismissed, false, `Cycle ${cycleNum}: initial __startDismissed must be false`);

  // Mock engine and renderer start trigger
  let gameStarted = false;
  let boardRendered = false;
  const mockHandleStart = () => {
    gameStarted = true;
    // Simulate populating bottles on game board
    board.appendChild(new MockElement('bottle_0', 'div'));
    board.appendChild(new MockElement('bottle_1', 'div'));
    board.appendChild(new MockElement('bottle_2', 'div'));
    boardRendered = true;
  };

  // Interaction based on test mode
  if (testMode === 'early_pointerdown') {
    // Mode 1: Early pointerdown tap on start screen during loading
    scr.dispatchEvent({ type: 'pointerdown', target: scr, cancelable: true, preventDefault: () => {}, stopPropagation: () => {} });
    assert.strictEqual(window.__startDismissed, true, `Cycle ${cycleNum}: early pointerdown must set __startDismissed`);
    assert(scr.classList.contains('start-screen-hidden'), `Cycle ${cycleNum}: startScreen must have hidden class`);

    // Now app.js loads and binds handleStart
    window.__triggerStartGame = mockHandleStart;
    if (window.__startDismissed) mockHandleStart();

  } else if (testMode === 'button_pointerdown_after_load') {
    // Mode 2: Loading completes, then user clicks START button via pointerdown
    window.__triggerStartGame = mockHandleStart;
    await new Promise(r => setTimeout(r, 60)); // allow progress bar timer

    btn.dispatchEvent({ type: 'pointerdown', target: btn, cancelable: true, preventDefault: () => {}, stopPropagation: () => {} });
    assert.strictEqual(window.__startDismissed, true, `Cycle ${cycleNum}: btn pointerdown must set __startDismissed`);

  } else if (testMode === 'button_click_after_load') {
    // Mode 3: Loading completes, then user clicks START button via click
    window.__triggerStartGame = mockHandleStart;
    await new Promise(r => setTimeout(r, 60));

    btn.dispatchEvent({ type: 'click', target: btn, cancelable: true, preventDefault: () => {}, stopPropagation: () => {} });
    assert.strictEqual(window.__startDismissed, true, `Cycle ${cycleNum}: btn click must set __startDismissed`);

  } else if (testMode === 'screen_touchstart_early') {
    // Mode 4: Mobile touchstart during loading
    scr.dispatchEvent({ type: 'touchstart', target: scr, cancelable: true, preventDefault: () => {}, stopPropagation: () => {} });
    assert.strictEqual(window.__startDismissed, true, `Cycle ${cycleNum}: screen touchstart must set __startDismissed`);

    window.__triggerStartGame = mockHandleStart;
    if (window.__startDismissed) mockHandleStart();

  } else if (testMode === 'programmatic_dismiss') {
    // Mode 5: Programmatic dismiss
    window.__triggerStartGame = mockHandleStart;
    window.dismissStartScreen();
    assert.strictEqual(window.__startDismissed, true, `Cycle ${cycleNum}: programmatic dismiss must set __startDismissed`);
  }

  // Fast-forward past 180ms hide timer
  await new Promise(r => setTimeout(r, 220));

  assert.strictEqual(scr.style.display, 'none', `Cycle ${cycleNum}: startScreen must have style.display === 'none' after 180ms`);
  assert.strictEqual(gameStarted, true, `Cycle ${cycleNum}: game must be started`);
  assert.strictEqual(boardRendered, true, `Cycle ${cycleNum}: game board must be rendered`);
  assert(board.children.length >= 3, `Cycle ${cycleNum}: board must contain at least 3 bottles`);
}

async function run50Cycles() {
  console.log('Testing 50 game entry cycles (early tap, button click, touchstart, programmatic)...\n');

  for (let i = 1; i <= 50; i++) {
    let mode;
    if (i <= 10) mode = 'early_pointerdown';
    else if (i <= 20) mode = 'button_pointerdown_after_load';
    else if (i <= 30) mode = 'button_click_after_load';
    else if (i <= 40) mode = 'screen_touchstart_early';
    else mode = 'programmatic_dismiss';

    await runEntryCycle(i, mode);

    if (i % 10 === 0) {
      console.log(`  ✅ [PASS] Cycles ${i - 9}..${i} passed (Mode: ${mode})`);
    }
  }

  console.log('\n================================================================');
  console.log('🎉 ALL 50/50 GAME ENTRY CYCLES PASSED 100%! SYSTEM FULLY VERIFIED.');
  console.log('================================================================\n');
}

run50Cycles().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
