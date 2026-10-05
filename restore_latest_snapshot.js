const fs = require('fs');
const path = require('path');
const db = require('./db');

const BUCKET = process.env.KVDB_BUCKET || '82kzJTUxZwwFNvg7kUSqgM';
const GLOBAL_CLOUD_BASE = 'https://kvdb.io/' + BUCKET;

async function run() {
  console.log('================================================================');
  console.log('🔄 RESTORING LATEST LEADERBOARD BACKUP SAVE FROM ADMIN PANEL');
  console.log('================================================================\n');

  // 1. Fetch the latest valid snapshot payload (ID: 1791149202825 for 05.10.2026)
  const targetSnapshotId = '1791149202825';
  console.log(`📡 Fetching snapshot ${targetSnapshotId} from KVDB...`);
  const snapRes = await fetch(`${GLOBAL_CLOUD_BASE}/leaderboard_snapshot_${targetSnapshotId}?_cb=${Date.now()}`);
  if (!snapRes.ok) {
    throw new Error(`Failed to fetch snapshot ${targetSnapshotId}: HTTP ${snapRes.status}`);
  }
  const snapshotData = await snapRes.json();
  console.log(`✅ Snapshot loaded successfully!`);
  console.log(`   Date: ${snapshotData.snapshot_date} | Time: ${snapshotData.snapshot_time} | Type: ${snapshotData.snapshot_type}`);
  console.log(`   Total players in snapshot: ${snapshotData.players ? snapshotData.players.length : 0}\n`);

  if (!snapshotData.players || snapshotData.players.length === 0) {
    throw new Error('Snapshot contains 0 players!');
  }

  // 2. Clean up meta_leaderboard_snapshots_index in KVDB (remove empty test snapshots 11 and 7)
  console.log('🧹 Cleaning up meta_leaderboard_snapshots_index in KVDB...');
  try {
    const idxRes = await fetch(`${GLOBAL_CLOUD_BASE}/meta_leaderboard_snapshots_index?_cb=${Date.now()}`);
    if (idxRes.ok) {
      let indexList = await idxRes.json();
      if (Array.isArray(indexList)) {
        const originalCount = indexList.length;
        // Keep valid snapshots with total_players > 0 or existing
        indexList = indexList.filter(s => s && s.id && String(s.id) !== '11' && String(s.id) !== '7');
        // Ensure snapshot 1791149202825 is at the top of the index
        const snapMeta = {
          id: snapshotData.id,
          snapshot_date: snapshotData.snapshot_date,
          snapshot_time: snapshotData.snapshot_time,
          snapshot_type: snapshotData.snapshot_type || 'auto',
          total_players: snapshotData.players.length,
          created_at: snapshotData.created_at || '2026-10-05 23:59:00',
          created_at_ts: snapshotData.created_at_ts || 1791175556787
        };
        indexList = [snapMeta, ...indexList.filter(s => String(s.id) !== String(targetSnapshotId))];
        await fetch(`${GLOBAL_CLOUD_BASE}/meta_leaderboard_snapshots_index`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(indexList)
        });
        console.log(`✅ Cleaned KVDB snapshot index: ${originalCount} -> ${indexList.length} items (latest is ${snapshotData.id})`);
      }
    }
  } catch (err) {
    console.warn('⚠️ Warning updating KVDB snapshot index:', err.message);
  }

  // 3. Insert or update snapshot in SQLite database
  console.log('\n💾 Inserting/updating snapshot into SQLite database...');
  try {
    db.db.prepare(`DELETE FROM leaderboard_snapshot_entries WHERE snapshot_id = ?`).run(Number(targetSnapshotId));
    db.db.prepare(`DELETE FROM leaderboard_snapshots WHERE id = ?`).run(Number(targetSnapshotId));

    db.db.prepare(`
      INSERT OR REPLACE INTO leaderboard_snapshots 
      (id, snapshot_date, snapshot_time, snapshot_type, created_at, created_at_ts, total_players, players_data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      Number(targetSnapshotId),
      snapshotData.snapshot_date,
      snapshotData.snapshot_time,
      snapshotData.snapshot_type || 'auto',
      snapshotData.created_at || '2026-10-05 23:59:00',
      snapshotData.created_at_ts || 1791175556787,
      snapshotData.players.length,
      JSON.stringify(snapshotData.players)
    );

    const insertEntry = db.db.prepare(`
      INSERT INTO leaderboard_snapshot_entries
      (snapshot_id, rank, telegram_id, first_name, username, max_level, stars)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    snapshotData.players.forEach((p, idx) => {
      insertEntry.run(
        Number(targetSnapshotId),
        p.rank || (idx + 1),
        String(p.telegram_id),
        p.name || 'Игрок',
        p.username || '',
        Number(p.level || 1),
        Number(p.stars || 0)
      );
    });
    db.db.prepare(`
      INSERT INTO system_settings (key, value)
      VALUES ('active_snapshot_id', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `).run(String(targetSnapshotId));

    db.db.prepare(`
      INSERT INTO system_settings (key, value)
      VALUES ('leaderboard_restored_at', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `).run(String(snapshotData.created_at_ts || Date.now()));

    console.log(`✅ Saved snapshot ${targetSnapshotId} and ${snapshotData.players.length} entries into SQLite!`);
  } catch (dbErr) {
    console.error('❌ Error saving snapshot to SQLite:', dbErr.message);
  }

  // 4. Update player levels in SQLite and KVDB for all 26 players
  console.log('\n🏆 Updating players to their exact levels from this snapshot:');
  const now = Date.now();
  let updatedCount = 0;

  // Zero out users not in snapshot from active leaderboard
  const snapTids = new Set(snapshotData.players.map(p => String(p.telegram_id)));
  const allDbUsers = db.db.prepare(`SELECT telegram_id, max_level FROM users`).all();
  for (const u of allDbUsers) {
    if (!snapTids.has(String(u.telegram_id)) && Number(u.max_level || 0) > 0) {
      db.db.prepare(`UPDATE users SET max_level = 0, current_level = 1, stars = 0 WHERE telegram_id = ?`).run(u.telegram_id);
    }
  }

  for (const p of snapshotData.players) {
    const tid = String(p.telegram_id);
    const snapLvl = Number(p.level || 1);
    const snapStars = Number(p.stars || 0);
    const snapName = p.name || 'Игрок';
    const snapUsername = p.username || '';

    // A. SQLite Update
    let localUser = db.getUser(tid);
    if (!localUser) {
      localUser = db.getUser(tid); // creates default if not exists
    }
    const currentLocalMax = localUser ? Number(localUser.max_level || 0) : 0;
    const finalLevel = Math.max(currentLocalMax, snapLvl);

    db.db.prepare(`
      UPDATE users 
      SET max_level = ?, current_level = ?, first_name = COALESCE(NULLIF(first_name, ''), ?), username = COALESCE(NULLIF(username, ''), ?), updated_at = datetime('now')
      WHERE telegram_id = ?
    `).run(finalLevel, finalLevel, snapName, snapUsername, tid);

    // B. KVDB Update
    let kvUser = null;
    try {
      const kvRes = await fetch(`${GLOBAL_CLOUD_BASE}/player_${tid}?_cb=${now}`);
      if (kvRes.ok) {
        kvUser = await kvRes.json();
      }
    } catch (e) {}

    const kvCurrentMax = kvUser ? Number(kvUser.maxLevel || kvUser.level || 0) : 0;
    const targetCloudLevel = Math.max(kvCurrentMax, snapLvl);

    const updatedKvPayload = {
      ...(kvUser || {}),
      telegramId: tid,
      firstName: (kvUser && kvUser.firstName) ? kvUser.firstName : snapName,
      username: (kvUser && kvUser.username) ? kvUser.username : snapUsername,
      maxLevel: targetCloudLevel,
      level: targetCloudLevel,
      currentLevel: targetCloudLevel,
      stars: Math.max(kvUser ? Number(kvUser.stars || 0) : 0, snapStars),
      updatedAt: now
    };

    // Keep wallet, ton balance, and boosters untouched
    if (kvUser) {
      if (kvUser.ton_balance !== undefined) updatedKvPayload.ton_balance = kvUser.ton_balance;
      if (kvUser.ton_wallet !== undefined) updatedKvPayload.ton_wallet = kvUser.ton_wallet;
      if (kvUser.memo_code !== undefined) updatedKvPayload.memo_code = kvUser.memo_code;
      if (kvUser.all_colors_until !== undefined) updatedKvPayload.all_colors_until = kvUser.all_colors_until;
      if (kvUser.daily_boosters_days_left !== undefined) updatedKvPayload.daily_boosters_days_left = kvUser.daily_boosters_days_left;
      if (kvUser.hints !== undefined) updatedKvPayload.hints = kvUser.hints;
      if (kvUser.undos !== undefined) updatedKvPayload.undos = kvUser.undos;
      if (kvUser.reveals !== undefined) updatedKvPayload.reveals = kvUser.reveals;
      if (kvUser.extraBottles !== undefined) updatedKvPayload.extraBottles = kvUser.extraBottles;
      if (kvUser.extra_bottles !== undefined) updatedKvPayload.extra_bottles = kvUser.extra_bottles;
    }

    try {
      await fetch(`${GLOBAL_CLOUD_BASE}/player_${tid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedKvPayload)
      });
      updatedCount++;
      console.log(`  ✅ #${p.rank.toString().padStart(2, ' ')} | TID: ${tid} | Level: ${targetCloudLevel.toString().padStart(2, ' ')} | ${snapName} (@${snapUsername || '—'})`);
    } catch (postErr) {
      console.error(`  ❌ Failed to update KVDB for ${tid}:`, postErr.message);
    }
  }

  console.log(`\n🎉 Successfully restored and synchronized ${updatedCount}/${snapshotData.players.length} players!`);
}

run().catch(err => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
