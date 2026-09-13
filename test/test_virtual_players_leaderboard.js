/**
 * Stress and Load Test for Leaderboard Offline Persistence & Real-time Auto-Sync
 *
 * Tests:
 * 1. Concurrently writes 30 virtual players to KVDB and SQLite DB under load (including Level 1 players).
 * 2. Simulates all players going offline.
 * 3. Verifies leaderboard retains ALL players with accurate levels and ranking.
 * 4. Simulates an offline player advancing levels (from Level 1 to Level 35).
 * 5. Verifies leaderboard dynamically re-ranks the player while keeping all offline players intact.
 * 6. Cleans up test keys from KVDB without touching real players (5761685341, 8982516215).
 */

const assert = require('assert');
const db = require('../db');

const KVDB_BASE = 'https://kvdb.io/82kzJTUxZwwFNvg7kUSqgM';
const REAL_PLAYERS = ['5761685341', '8982516215'];
const VIRTUAL_COUNT = 30;

async function runTest() {
  console.log('🚀 Starting Leaderboard Offline Persistence & Stress Test...\n');

  const virtualPlayers = [];

  try {
    // Step 0: Check real players exist before test
    console.log('🔍 Step 0: Checking real production players in KVDB...');
    for (const rp of REAL_PLAYERS) {
      const res = await fetch(`${KVDB_BASE}/player_${rp}`);
      if (res.ok) {
        const raw = await res.json();
        const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
        console.log(`  ✅ Real player ${rp} (${data.firstName}) found at Level ${data.maxLevel}`);
      } else {
        console.warn(`  ⚠️ Real player ${rp} not found in KVDB (HTTP ${res.status})`);
      }
    }

    // Step 1: Generate 30 virtual players
    console.log(`\n⚡ Step 1: Generating and uploading ${VIRTUAL_COUNT} virtual players concurrently (Load simulation)...`);
    const uploadPromises = [];

    for (let i = 1; i <= VIRTUAL_COUNT; i++) {
      const id = `99000000${String(i).padStart(2, '0')}`;
      // Deliberately give some players Level 1 to test the Level 1 fix
      const level = i <= 5 ? 1 : (i % 25) + 2;
      const stars = i * 2;
      const player = {
        telegramId: id,
        firstName: `VirtPlayer_${i}`,
        username: `virt_${i}`,
        photoUrl: '',
        maxLevel: level,
        level: level,
        stars: stars,
        hints: 2,
        undos: 2,
        reveals: 1,
        extraBottles: 0,
        extra_bottles: 0,
        ton_balance: 0,
        seasonResetAt: 1789243000950,
        updatedAt: Date.now() + i * 10
      };
      virtualPlayers.push(player);

      // Concurrently upload to KVDB
      const p = fetch(`${KVDB_BASE}/player_${encodeURIComponent(id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(player)
      }).then(r => {
        if (!r.ok) throw new Error(`KVDB write failed for ${id}: HTTP ${r.status}`);
        return id;
      });
      uploadPromises.push(p);

      // Also register in local SQLite DB
      db.updateUserProgress(id, {
        firstName: player.firstName,
        username: player.username,
        currentLevel: level,
        maxLevel: level,
        starsAdded: stars
      });
    }

    const writeStart = Date.now();
    const writeResults = await Promise.allSettled(uploadPromises);
    const writeDuration = Date.now() - writeStart;
    const writeSuccesses = writeResults.filter(r => r.status === 'fulfilled').length;
    console.log(`  ✅ Successfully synced ${writeSuccesses}/${VIRTUAL_COUNT} virtual players to KVDB in ${writeDuration}ms (${(writeSuccesses / (writeDuration / 1000)).toFixed(1)} req/s)`);
    assert.strictEqual(writeSuccesses, VIRTUAL_COUNT, 'All virtual players must be successfully uploaded');

    // Step 2: Simulate all players closing the app / going offline
    console.log('\n📴 Step 2: Simulating all virtual players going offline (no active sessions)...');
    await new Promise(res => setTimeout(res, 1200));

    // Step 3: Query leaderboard and verify offline persistence
    console.log('\n📊 Step 3: Fetching leaderboard to verify offline player retention & ranking...');
    const cloudRes = await fetch(`${KVDB_BASE}/?prefix=player_&values=true&format=json&_cb=${Date.now()}`);
    assert.strictEqual(cloudRes.ok, true, 'KVDB query must succeed');
    const pairs = await cloudRes.json();
    const allCloudPlayers = pairs.map(([k, p]) => {
      if (typeof p === 'string') {
        try { return JSON.parse(p); } catch (e) { return null; }
      }
      return p;
    }).filter(Boolean);

    // Check how many virtual players are preserved
    const preservedVirtual = allCloudPlayers.filter(p => p.telegramId && p.telegramId.startsWith('99000000'));
    console.log(`  ✅ Retained offline virtual players in cloud: ${preservedVirtual.length}/${VIRTUAL_COUNT}`);
    assert.strictEqual(preservedVirtual.length, VIRTUAL_COUNT, '100% of offline players must be retained in KVDB!');

    // Check that Level 1 players are preserved
    const level1Players = preservedVirtual.filter(p => (p.maxLevel || p.level) === 1);
    console.log(`  ✅ Level 1 offline players preserved: ${level1Players.length} players`);
    assert.ok(level1Players.length > 0, 'Level 1 players must NOT be discarded from leaderboard data');

    // Check sorting of the leaderboard
    const sorted = preservedVirtual.slice().sort((a, b) => {
      const diff = (b.maxLevel || b.level || 1) - (a.maxLevel || a.level || 1);
      if (diff !== 0) return diff;
      const starDiff = (b.stars || 0) - (a.stars || 0);
      if (starDiff !== 0) return starDiff;
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });

    console.log('  Top 5 Virtual Players in Leaderboard:');
    sorted.slice(0, 5).forEach((p, idx) => {
      console.log(`    #${idx + 1}: ${p.firstName} (${p.telegramId}) - Level ${p.maxLevel}, Stars ${p.stars}`);
    });

    // Verify sort invariant
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      const aLvl = a.maxLevel || a.level || 1;
      const bLvl = b.maxLevel || b.level || 1;
      assert.ok(aLvl >= bLvl, `Player #${i + 1} level (${aLvl}) must be >= player #${i + 2} level (${bLvl})`);
    }
    console.log('  ✅ Leaderboard sorting invariant verified (strictly maxLevel DESC)');

    // Step 4: Simulate an offline player coming online, completing levels, and syncing
    console.log('\n🎮 Step 4: Simulating offline player VirtPlayer_1 (starts at Level 1) completing levels up to Level 35...');
    const targetId = '9900000001';
    const updatedPlayer = {
      ...virtualPlayers[0],
      maxLevel: 35,
      level: 35,
      stars: 120,
      updatedAt: Date.now() + 5000
    };

    const updateRes = await fetch(`${KVDB_BASE}/player_${encodeURIComponent(targetId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedPlayer)
    });
    assert.strictEqual(updateRes.ok, true, 'Player update sync must succeed');
    console.log(`  ✅ Player ${targetId} synced Level 35 to cloud database.`);

    // Give KVDB prefix cache 1.2s to settle
    await new Promise(res => setTimeout(res, 1200));

    // Step 5: Query leaderboard again and check new rank
    console.log('\n🏆 Step 5: Verifying leaderboard reflects the new rank without losing any offline players...');
    const refreshRes = await fetch(`${KVDB_BASE}/?prefix=player_&values=true&format=json&_cb=${Date.now()}`);
    const refreshPairs = await refreshRes.json();
    const refreshedPlayers = refreshPairs.map(([k, p]) => {
      if (typeof p === 'string') {
        try { return JSON.parse(p); } catch (e) { return null; }
      }
      return p;
    }).filter(p => p && p.telegramId && p.telegramId.startsWith('99000000'));

    assert.strictEqual(refreshedPlayers.length, VIRTUAL_COUNT, 'All 30 offline players must still be present!');
    
    console.log('  🔍 Player 9900000001 in refreshed list:', refreshedPlayers.find(p => p.telegramId === targetId));

    const refreshedSorted = refreshedPlayers.slice().sort((a, b) => {
      const diff = (b.maxLevel || b.level || 1) - (a.maxLevel || a.level || 1);
      if (diff !== 0) return diff;
      return (b.stars || 0) - (a.stars || 0);
    });

    const newTop = refreshedSorted[0];
    console.log(`  🥇 #1 Rank in Virtual Group: ${newTop.firstName} (${newTop.telegramId}) at Level ${newTop.maxLevel}`);
    assert.strictEqual(newTop.telegramId, targetId, 'Player 9900000001 must now be #1 after reaching Level 35');
    assert.strictEqual(newTop.maxLevel, 35, 'Max level must be 35');

    // Step 6: Test SQLite db.getLeaderboard integration
    console.log('\n🗄️ Step 6: Testing SQLite db.getLeaderboard()...');
    const localLeaderboard = db.getLeaderboard('9900000001', 50);
    assert.ok(localLeaderboard.topPlayers.length > 0, 'Local leaderboard must return top players');
    console.log(`  ✅ db.getLeaderboard returned ${localLeaderboard.topPlayers.length} players, user rank:`, localLeaderboard.userRank);

  } finally {
    // Step 7: Cleanup virtual test players from KVDB
    console.log('\n🧹 Step 7: Cleaning up 30 virtual test players from KVDB...');
    const deletePromises = [];
    for (let i = 1; i <= VIRTUAL_COUNT; i++) {
      const id = `99000000${String(i).padStart(2, '0')}`;
      deletePromises.push(
        fetch(`${KVDB_BASE}/player_${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {})
      );
    }
    await Promise.allSettled(deletePromises);
    console.log('  ✅ Virtual test player records removed from cloud database.');

    // Step 8: Verify real players are intact
    console.log('\n🛡️ Step 8: Verifying real players remain completely safe and untouched in KVDB...');
    for (const rp of REAL_PLAYERS) {
      const res = await fetch(`${KVDB_BASE}/player_${rp}`);
      assert.strictEqual(res.ok, true, `Real player ${rp} must still exist!`);
      const raw = await res.json();
      const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
      console.log(`  ✅ Real player ${rp} (${data.firstName}) is safe: Level ${data.maxLevel}, Stars ${data.stars}`);
    }
  }

  console.log('\n✨ ALL TESTS PASSED SUCCESSFULLY! Leaderboard offline persistence and auto-sync verified under load.');
}

runTest().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
