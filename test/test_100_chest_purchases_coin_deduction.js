const assert = require('assert');
const path = require('path');
const fs = require('fs');
const db = require('../db');

// Mock KVDB Store
const kvdbStore = new Map();
global.fetch = async (url, options = {}) => {
  const urlStr = String(url);
  const method = (options.method || 'GET').toUpperCase();

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

async function run100ChestPurchasesCoinDeductionTest() {
  console.log('🧪 ========================================================');
  console.log('🧪 TEST: 100 CONSECUTIVE CHEST PURCHASES & COIN DEDUCTIONS');
  console.log('🧪 ========================================================\n');

  const testPlayerId = '777888999';
  
  // Clean start in SQLite
  db.getUser(testPlayerId, { first_name: 'DeductionTester', username: 'deduct_tester' });
  
  // Starting balance: 100.00 GRAM
  const initialBalance = 100.0;
  const existingU = db.getUser(testPlayerId);
  const curBal = Number(existingU.ton_balance || 0);
  db.addBonus(testPlayerId, { ton_balance: initialBalance - curBal });

  // Client initial user state
  let currentUser = {
    telegramId: testPlayerId,
    firstName: 'DeductionTester',
    username: 'deduct_tester',
    hints: 0,
    undos: 0,
    reveals: 0,
    extraBottles: 0,
    extra_bottles: 0,
    ton_balance: initialBalance,
    updatedAt: Date.now(),
    _localLoaded: true
  };

  // Seed localStorage and KVDB
  localStorage.setItem(`color_sort_user_${testPlayerId}`, JSON.stringify(currentUser));
  kvdbStore.set(`player_${testPlayerId}`, {
    ...currentUser,
    updatedAt: Date.now()
  });

  const shopItems = [
    { id: 'bottles_pack_15', name: '+15 Bottles', price: 1.0, field: 'extraBottles', amount: 15 },
    { id: 'hints_pack_20', name: '+20 Hints', price: 1.0, field: 'hints', amount: 20 },
    { id: 'undos_pack_20', name: '+20 Undos', price: 1.0, field: 'undos', amount: 20 },
    { id: 'reveals_pack_20', name: '+20 Reveals', price: 1.0, field: 'reveals', amount: 20 }
  ];

  let expectedBalance = initialBalance;
  let expectedBoosters = {
    extraBottles: 0,
    hints: 0,
    undos: 0,
    reveals: 0
  };

  console.log(`Starting Balance: ${expectedBalance.toFixed(2)} GRAM`);
  console.log('Running 100 consecutive purchase & coin deduction cycles...\n');

  for (let cycle = 1; cycle <= 100; cycle++) {
    const item = shopItems[(cycle - 1) % shopItems.length];
    const prevBalance = expectedBalance;
    expectedBalance = Number((expectedBalance - item.price).toFixed(4));
    expectedBoosters[item.field] += item.amount;

    // 1. Simulate db.buyShopItem (Server DB deduction)
    const dbResult = db.buyShopItem(testPlayerId, item.id);
    assert(dbResult, `Cycle ${cycle}: db.buyShopItem returned null`);
    assert(dbResult.success, `Cycle ${cycle}: db.buyShopItem failed: ${dbResult.message || dbResult.error}`);
    assert.strictEqual(
      Number(dbResult.user.ton_balance).toFixed(2),
      expectedBalance.toFixed(2),
      `Cycle ${cycle}: Server balance mismatch! Expected ${expectedBalance.toFixed(2)}, got ${Number(dbResult.user.ton_balance).toFixed(2)}`
    );

    // 2. Simulate Client handleShopPurchase
    const currentBal = parseFloat(currentUser.ton_balance || 0);
    assert(currentBal >= item.price, `Cycle ${cycle}: Client had insufficient balance: ${currentBal}`);
    const newClientBal = Number(Math.max(0, currentBal - item.price).toFixed(4));
    currentUser.ton_balance = newClientBal;

    if (item.id === 'bottles_pack_15') {
      currentUser.extraBottles = (currentUser.extraBottles || 0) + 15;
      currentUser.extra_bottles = currentUser.extraBottles;
    } else if (item.id === 'hints_pack_20') {
      currentUser.hints = (currentUser.hints || 0) + 20;
    } else if (item.id === 'undos_pack_20') {
      currentUser.undos = (currentUser.undos || 0) + 20;
    } else if (item.id === 'reveals_pack_20') {
      currentUser.reveals = (currentUser.reveals || 0) + 20;
    }

    assert.strictEqual(
      currentUser.ton_balance.toFixed(2),
      expectedBalance.toFixed(2),
      `Cycle ${cycle}: Client ton_balance mismatch! Expected ${expectedBalance.toFixed(2)}, got ${currentUser.ton_balance.toFixed(2)}`
    );

    // 3. Client saveLocalUser
    currentUser.updatedAt = Date.now();
    localStorage.setItem(`color_sort_user_${testPlayerId}`, JSON.stringify(currentUser));

    // 4. Client syncPlayerToCloud (Simulate sync to KVDB)
    const existingCloud = kvdbStore.get(`player_${testPlayerId}`) || {};
    const finalHints = Math.max(Number(currentUser.hints || 0), Number(existingCloud.hints || 0));
    const finalUndos = Math.max(Number(currentUser.undos || 0), Number(existingCloud.undos || 0));
    const finalReveals = Math.max(Number(currentUser.reveals || 0), Number(existingCloud.reveals || 0));
    const finalBottles = Math.max(Number(currentUser.extraBottles || 0), Number(existingCloud.extraBottles || existingCloud.extra_bottles || 0));
    const finalBalance = Number(currentUser.ton_balance !== undefined ? currentUser.ton_balance : (existingCloud.ton_balance || 0));

    const cloudPayload = {
      telegramId: testPlayerId,
      hints: finalHints,
      undos: finalUndos,
      reveals: finalReveals,
      extraBottles: finalBottles,
      extra_bottles: finalBottles,
      ton_balance: finalBalance,
      updatedAt: Date.now()
    };
    kvdbStore.set(`player_${testPlayerId}`, cloudPayload);

    // 5. SIMULATE APP EXIT & RESTART (Test persistence & immunity to Math.max restore)
    // Reload local user
    const localRaw = localStorage.getItem(`color_sort_user_${testPlayerId}`);
    assert(localRaw, `Cycle ${cycle}: local storage data missing`);
    let reloadedUser = JSON.parse(localRaw);
    reloadedUser._localLoaded = true;

    // Simulate startup KVDB check
    const cloudData = kvdbStore.get(`player_${testPlayerId}`);
    if (cloudData && cloudData.ton_balance !== undefined) {
      const cb = Number(cloudData.ton_balance || 0);
      if (!reloadedUser._localLoaded || reloadedUser.ton_balance === undefined || reloadedUser.ton_balance === null) {
        reloadedUser.ton_balance = cb;
      } else if (cloudData.updatedAt && reloadedUser.updatedAt && cloudData.updatedAt > reloadedUser.updatedAt) {
        reloadedUser.ton_balance = cb;
      }
    }

    // Verify after reload: balance must NEVER be restored to prevBalance!
    assert.strictEqual(
      reloadedUser.ton_balance.toFixed(2),
      expectedBalance.toFixed(2),
      `Cycle ${cycle}: AFTER RELOAD: Balance restored to previous value! Expected ${expectedBalance.toFixed(2)}, got ${reloadedUser.ton_balance.toFixed(2)}`
    );

    // Verify boosters intact
    assert.strictEqual(reloadedUser.hints, expectedBoosters.hints, `Cycle ${cycle}: Hints count incorrect!`);
    assert.strictEqual(reloadedUser.undos, expectedBoosters.undos, `Cycle ${cycle}: Undos count incorrect!`);
    assert.strictEqual(reloadedUser.reveals, expectedBoosters.reveals, `Cycle ${cycle}: Reveals count incorrect!`);
    assert.strictEqual(reloadedUser.extraBottles, expectedBoosters.extraBottles, `Cycle ${cycle}: Extra bottles count incorrect!`);

    currentUser = reloadedUser;

    if (cycle % 10 === 0 || cycle === 1 || cycle === 100) {
      console.log(`  ✓ Cycle ${cycle.toString().padStart(3)}: Bought ${item.name.padEnd(12)} -> Balance: ${currentUser.ton_balance.toFixed(2)} GRAM (-${item.price.toFixed(2)}) | Boosters: [Bottles: ${currentUser.extraBottles}, Hints: ${currentUser.hints}, Undos: ${currentUser.undos}, Reveals: ${currentUser.reveals}]`);
    }
  }

  // 6. Verify final state after 100 cycles
  console.log('\n--- Final Verification after 100 purchases ---');
  console.log(`Final Balance: ${currentUser.ton_balance.toFixed(2)} GRAM (Expected: 0.00 GRAM)`);
  console.log(`Final Boosters: Bottles: ${currentUser.extraBottles} (expected ${expectedBoosters.extraBottles}), Hints: ${currentUser.hints} (expected ${expectedBoosters.hints}), Undos: ${currentUser.undos} (expected ${expectedBoosters.undos}), Reveals: ${currentUser.reveals} (expected ${expectedBoosters.reveals})`);
  
  assert.strictEqual(currentUser.ton_balance.toFixed(2), '0.00', 'Final balance after 100 purchases must be exactly 0.00 GRAM');
  assert.strictEqual(currentUser.extraBottles, 15 * 25, 'Final bottles must be exactly 375');
  assert.strictEqual(currentUser.hints, 20 * 25, 'Final hints must be exactly 500');
  assert.strictEqual(currentUser.undos, 20 * 25, 'Final undos must be exactly 500');
  assert.strictEqual(currentUser.reveals, 20 * 25, 'Final reveals must be exactly 500');

  // 7. Verify 101st purchase with 0.00 GRAM fails with insufficient_balance
  console.log('\n--- Step 7: Testing 101st purchase with 0.00 GRAM ---');
  const failResult = db.buyShopItem(testPlayerId, 'bottles_pack_15');
  assert(failResult && !failResult.success, 'Purchase with 0 balance must fail');
  assert.strictEqual(failResult.error, 'insufficient_balance', 'Error code must be insufficient_balance');
  console.log(`  ✓ 101st purchase correctly rejected with 0.00 GRAM: "${failResult.message}"`);

  // 8. Add +5.00 GRAM and test purchase again
  console.log('\n--- Step 8: Adding +5.00 GRAM and verifying subsequent purchase ---');
  db.addBonus(testPlayerId, { ton_balance: 5.0 });
  const userAfterBonus = db.getUser(testPlayerId);
  assert.strictEqual(Number(userAfterBonus.ton_balance).toFixed(2), '5.00', 'Balance after +5 GRAM bonus must be 5.00');

  const buyAfterBonus = db.buyShopItem(testPlayerId, 'bottles_pack_15');
  assert(buyAfterBonus && buyAfterBonus.success, 'Purchase after adding 5.00 GRAM must succeed');
  assert.strictEqual(Number(buyAfterBonus.user.ton_balance).toFixed(2), '4.00', 'Balance after purchase must be exactly 4.00 GRAM');
  assert.strictEqual(Number(buyAfterBonus.user.extra_bottles), 375 + 15, 'Bottles must increase by +15 to 390');
  console.log(`  ✓ Added +5.00 GRAM -> Bought +15 Bottles -> New Balance: ${Number(buyAfterBonus.user.ton_balance).toFixed(2)} GRAM (Bottles: ${buyAfterBonus.user.extra_bottles})`);

  console.log('\n🎉 ALL 100 CONSECUTIVE CHEST PURCHASES & COIN DEDUCTION TESTS PASSED PERFECTLY!\n');
}

run100ChestPurchasesCoinDeductionTest().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
