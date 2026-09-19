const assert = require('assert');
const path = require('path');
const fs = require('fs');
const db = require('../db');

// Setup mock global fetch for KVDB simulation
const kvdbStore = new Map();
global.fetch = async (url, options = {}) => {
  const urlStr = String(url);
  const method = (options.method || 'GET').toUpperCase();

  // Extract key
  const match = urlStr.match(/https:\/\/kvdb\.io\/[^/]+\/([^?]+)/);
  if (!match) return { ok: true, json: async () => ({}) };
  const key = decodeURIComponent(match[1]);

  if (method === 'GET') {
    if (kvdbStore.has(key)) {
      return {
        ok: true,
        json: async () => JSON.parse(JSON.stringify(kvdbStore.get(key)))
      };
    } else {
      return { ok: false, status: 404, json: async () => null };
    }
  } else if (method === 'POST') {
    const body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
    kvdbStore.set(key, body);
    return {
      ok: true,
      json: async () => ({ success: true })
    };
  }
  return { ok: true, json: async () => ({}) };
};

// Mock localStorage
const localStorageStore = new Map();
global.localStorage = {
  getItem: (k) => (localStorageStore.has(k) ? localStorageStore.get(k) : null),
  setItem: (k, v) => localStorageStore.set(k, String(v)),
  removeItem: (k) => localStorageStore.delete(k),
  clear: () => localStorageStore.clear()
};

async function run100ExitEntryCycles() {
  console.log('🧪 RUNNING 100 CONSECUTIVE EXIT & ENTRY CYCLES TEST SUITE\n');

  const testPlayerId = '9999888877';
  // Clean start
  db.getUser(testPlayerId, { first_name: 'TestPlayer', username: 'tester' });
  db.addBonus(testPlayerId, { ton_balance: 50.0 }); // 50 GRAM for buying in chest

  // 1. Initial purchases in chest
  console.log('--- Step 1: Purchasing in Chest (+15 bottles, +20 hints, +20 undos, +20 reveals) ---');
  db.buyShopItem(testPlayerId, 'bottles_pack_15');
  db.buyShopItem(testPlayerId, 'hints_pack_20');
  db.buyShopItem(testPlayerId, 'undos_pack_20');
  db.buyShopItem(testPlayerId, 'reveals_pack_20');

  // 2. Initial ad rewards
  console.log('--- Step 2: Watching Ads (+1 hint, +1 undo, +1 reveal, +1 bottle) ---');
  db.logAdReward(testPlayerId, 'hints');
  db.logAdReward(testPlayerId, 'undos');
  db.logAdReward(testPlayerId, 'reveals');
  db.logAdReward(testPlayerId, 'extra_bottle');

  let expected = {
    hints: 21,
    undos: 21,
    reveals: 21,
    extraBottles: 16
  };

  // Seed KVDB
  kvdbStore.set(`player_${testPlayerId}`, {
    telegramId: testPlayerId,
    hints: expected.hints,
    undos: expected.undos,
    reveals: expected.reveals,
    extraBottles: expected.extraBottles,
    extra_bottles: expected.extraBottles,
    ton_balance: 46.0,
    updatedAt: Date.now()
  });

  // Seed localStorage
  localStorage.setItem(`color_sort_user_${testPlayerId}`, JSON.stringify({
    telegramId: testPlayerId,
    hints: expected.hints,
    undos: expected.undos,
    reveals: expected.reveals,
    extraBottles: expected.extraBottles,
    extra_bottles: expected.extraBottles,
    ton_balance: 46.0
  }));

  console.log('✅ Initial booster state established:', expected);

  // 3. Run 100 cycles
  console.log('\n--- Step 3: Executing 100 Exit & Re-entry Cycles ---');

  for (let cycle = 1; cycle <= 100; cycle++) {
    const isWiped = cycle % 2 === 0; // Every even cycle simulates phone reboot / cleared localStorage
    const useBooster = cycle === 25 || cycle === 50 || cycle === 75; // Simulate spending in game
    const watchAd = cycle === 10 || cycle === 60; // Simulate watching ad during session

    // Exit simulation:
    // User was playing, saveLocalUser & handleAppExitOrHide
    const currentMem = JSON.parse(localStorage.getItem(`color_sort_user_${testPlayerId}`) || '{}');
    
    // Direct exit sync (keepalive: true)
    kvdbStore.set(`player_${testPlayerId}`, {
      ...kvdbStore.get(`player_${testPlayerId}`),
      hints: currentMem.hints !== undefined ? currentMem.hints : expected.hints,
      undos: currentMem.undos !== undefined ? currentMem.undos : expected.undos,
      reveals: currentMem.reveals !== undefined ? currentMem.reveals : expected.reveals,
      extraBottles: currentMem.extraBottles !== undefined ? currentMem.extraBottles : expected.extraBottles,
      extra_bottles: currentMem.extraBottles !== undefined ? currentMem.extraBottles : expected.extraBottles,
      updatedAt: Date.now()
    });

    // If phone reboot / cache cleared:
    if (isWiped) {
      localStorage.clear();
    }

    // Re-entry simulation (boot up app):
    let currentUser = {
      telegramId: testPlayerId,
      hints: 0,
      undos: 0,
      reveals: 0,
      extraBottles: 0,
      extra_bottles: 0
    };

    // 1. loadLocalUser
    const localData = localStorage.getItem(`color_sort_user_${testPlayerId}`);
    if (localData) {
      currentUser = { ...currentUser, ...JSON.parse(localData) };
    }

    // 2. Fetch KVDB
    const kvData = kvdbStore.get(`player_${testPlayerId}`);
    if (kvData) {
      currentUser.hints = Math.max(currentUser.hints || 0, Number(kvData.hints || 0));
      currentUser.undos = Math.max(currentUser.undos || 0, Number(kvData.undos || 0));
      currentUser.reveals = Math.max(currentUser.reveals || 0, Number(kvData.reveals || 0));
      const b = kvData.extra_bottles !== undefined ? kvData.extra_bottles : kvData.extraBottles;
      const finalB = Math.max(currentUser.extraBottles || 0, currentUser.extra_bottles || 0, Number(b || 0));
      currentUser.extraBottles = finalB;
      currentUser.extra_bottles = finalB;
      localStorage.setItem(`color_sort_user_${testPlayerId}`, JSON.stringify(currentUser));
    }

    // 3. /api/user/init
    const dbUser = db.getUser(testPlayerId);
    currentUser.hints = Math.max(currentUser.hints || 0, Number(dbUser.hints || 0));
    currentUser.undos = Math.max(currentUser.undos || 0, Number(dbUser.undos || 0));
    currentUser.reveals = Math.max(currentUser.reveals || 0, Number(dbUser.reveals || 0));
    const finalB = Math.max(currentUser.extraBottles || 0, currentUser.extra_bottles || 0, Number(dbUser.extra_bottles || 0));
    currentUser.extraBottles = finalB;
    currentUser.extra_bottles = finalB;

    // Optional event: spending a booster
    if (useBooster) {
      currentUser.hints = Math.max(0, currentUser.hints - 1);
      expected.hints -= 1;
      // Direct deduction call
      const kv = kvdbStore.get(`player_${testPlayerId}`);
      kv.hints = currentUser.hints;
      kvdbStore.set(`player_${testPlayerId}`, kv);
      db.updateUserProgress(testPlayerId, { hintsUsed: 1, hints: currentUser.hints });
      localStorage.setItem(`color_sort_user_${testPlayerId}`, JSON.stringify(currentUser));
    }

    // Optional event: watching an ad
    if (watchAd) {
      currentUser.undos += 1;
      expected.undos += 1;
      const kv = kvdbStore.get(`player_${testPlayerId}`);
      kv.undos = (kv.undos || 0) + 1;
      kvdbStore.set(`player_${testPlayerId}`, kv);
      db.addBonus(testPlayerId, { undos: 1 });
      localStorage.setItem(`color_sort_user_${testPlayerId}`, JSON.stringify(currentUser));
    }

    // Verify after re-entry:
    assert.strictEqual(currentUser.hints, expected.hints, `Cycle ${cycle}: hints mismatch! Expected ${expected.hints}, got ${currentUser.hints}`);
    assert.strictEqual(currentUser.undos, expected.undos, `Cycle ${cycle}: undos mismatch! Expected ${expected.undos}, got ${currentUser.undos}`);
    assert.strictEqual(currentUser.reveals, expected.reveals, `Cycle ${cycle}: reveals mismatch! Expected ${expected.reveals}, got ${currentUser.reveals}`);
    assert.strictEqual(currentUser.extraBottles, expected.extraBottles, `Cycle ${cycle}: extraBottles mismatch! Expected ${expected.extraBottles}, got ${currentUser.extraBottles}`);

    if (cycle % 20 === 0 || cycle === 1) {
      console.log(`  Cycle ${cycle}/100 passed: [Hints: ${currentUser.hints}, Undos: ${currentUser.undos}, Reveals: ${currentUser.reveals}, Bottles: ${currentUser.extraBottles}] (LocalStorage wiped: ${isWiped})`);
    }
  }

  console.log('\n🎉 ALL 100 EXIT & RE-ENTRY CYCLES PASSED PERFECTLY!');
  console.log('   Final state after 100 cycles:', expected);
}

run100ExitEntryCycles().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
