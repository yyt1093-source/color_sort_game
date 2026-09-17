#!/usr/bin/env node
/**
 * Automated 23:55 Kyiv Daily Leaderboard Snapshot Runner
 * 
 * Capabilities:
 * - Fetches all real players from KVDB Cloud (24/7 global storage) & local SQLite
 * - Enforces strict ranking and immutability (levels are never altered)
 * - Saves snapshot to local SQLite (leaderboard_snapshots & entries)
 * - Pushes snapshot and updated index to KVDB Cloud (meta_leaderboard_snapshots_index)
 * - Bi-directional sync between SQLite and KVDB Cloud
 * - Can be run via Windows Task Scheduler, GitHub Actions, or manually
 * 
 * Usage:
 *   node scripts/cron_leaderboard_snapshot.js             # Runs for target 23:55
 *   node scripts/cron_leaderboard_snapshot.js --catchup   # Catches up missed 23:55 snapshot
 *   node scripts/cron_leaderboard_snapshot.js --force     # Forces snapshot even if already exists
 *   node scripts/cron_leaderboard_snapshot.js --date 2026-09-17 # Specific date
 */

const fs = require('fs');
const path = require('path');
const db = require(path.join(__dirname, '..', 'db.js'));

const KVDB_BUCKET = process.env.KVDB_BUCKET || '82kzJTUxZwwFNvg7kUSqgM';
const GLOBAL_CLOUD_BASE = `https://kvdb.io/${KVDB_BUCKET}`;
const SNAPSHOTS_INDEX_KEY = 'meta_leaderboard_snapshots_index';
const SNAPSHOTS_DELETED_KEY = 'meta_leaderboard_deleted_snapshots';

const logDir = path.join(__dirname, '..', 'logs');
const logFile = path.join(logDir, 'cron_leaderboard.log');

function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}`;
  console.log(line);
  try {
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(logFile, line + '\n', 'utf8');
  } catch (e) {}
}

async function fetchJson(url, options = {}) {
  try {
    const res = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

async function postJson(url, data) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(8000)
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

/**
 * Get all players from KVDB Cloud
 */
async function getCloudPlayers() {
  const url = `${GLOBAL_CLOUD_BASE}/?prefix=player_&values=true&format=json&_cb=${Date.now()}`;
  const data = await fetchJson(url);
  if (!Array.isArray(data)) return [];
  return data
    .map(([k, v]) => {
      let p = v;
      if (typeof p === 'string') {
        try { p = JSON.parse(p); } catch (e) { p = null; }
      }
      return p;
    })
    .filter(Boolean);
}

/**
 * Sync snapshots bi-directionally between SQLite and KVDB Cloud
 */
async function syncSnapshots() {
  log('🔄 Starting bi-directional snapshot sync between SQLite and KVDB Cloud...');
  
  // 1. Fetch cloud tombstones and local SQLite tombstones
  let cloudDeleted = await fetchJson(`${GLOBAL_CLOUD_BASE}/${SNAPSHOTS_DELETED_KEY}?_cb=${Date.now()}`);
  if (!Array.isArray(cloudDeleted)) cloudDeleted = [];
  const localDeleted = db.getDeletedSnapshotIds ? db.getDeletedSnapshotIds() : [];
  const deletedSet = new Set([...cloudDeleted.map(String), ...localDeleted.map(String)]);

  // 2. Clean up any deleted snapshots still residing in SQLite
  for (const delId of deletedSet) {
    const existsLocally = db.getLeaderboardSnapshotById(delId);
    if (existsLocally) {
      log(`🗑️ Purging deleted snapshot #${delId} from local SQLite...`);
      db.deleteLeaderboardSnapshot(delId);
    }
  }

  // 3. Fetch cloud index
  let cloudIndex = await fetchJson(`${GLOBAL_CLOUD_BASE}/${SNAPSHOTS_INDEX_KEY}?_cb=${Date.now()}`);
  if (!Array.isArray(cloudIndex)) cloudIndex = [];
  cloudIndex = cloudIndex.filter(s => s && s.id && !deletedSet.has(String(s.id)));

  // 4. Fetch local SQLite snapshot list (excluding deleted)
  const localDates = db.getLeaderboardSnapshotDates().filter(l => !deletedSet.has(String(l.id)));

  const cloudMap = new Map();
  cloudIndex.forEach(s => cloudMap.set(String(s.id), s));

  // 5. Upload any local snapshots missing from Cloud (strictly ignore deleted!)
  for (const localMeta of localDates) {
    if (deletedSet.has(String(localMeta.id))) continue;
    const localSnap = db.getLeaderboardSnapshotById(localMeta.id);
    if (!localSnap) continue;

    const existsInCloud = cloudMap.has(String(localMeta.id));
    if (!existsInCloud) {
      log(`☁️ Uploading local snapshot #${localMeta.id} (${localMeta.snapshot_date} ${localMeta.snapshot_time}) to KVDB Cloud...`);
      await postJson(`${GLOBAL_CLOUD_BASE}/leaderboard_snapshot_${localMeta.id}`, localSnap);
      cloudMap.set(String(localMeta.id), {
        id: localMeta.id,
        snapshot_date: localMeta.snapshot_date,
        snapshot_time: localMeta.snapshot_time,
        snapshot_type: localMeta.snapshot_type,
        total_players: localMeta.total_players,
        created_at: localMeta.created_at,
        created_at_ts: localMeta.created_at_ts
      });
    }
  }

  // 6. Download any cloud snapshots missing from SQLite (strictly ignore deleted!)
  for (const cloudMeta of cloudIndex) {
    if (deletedSet.has(String(cloudMeta.id))) continue;
    const existsLocally = localDates.some(l => String(l.id) === String(cloudMeta.id));
    if (!existsLocally) {
      log(`📥 Downloading cloud snapshot #${cloudMeta.id} (${cloudMeta.snapshot_date} ${cloudMeta.snapshot_time}) into local SQLite...`);
      const fullCloudSnap = await fetchJson(`${GLOBAL_CLOUD_BASE}/leaderboard_snapshot_${cloudMeta.id}`);
      if (fullCloudSnap && Array.isArray(fullCloudSnap.players)) {
        try {
          db.insertExternalLeaderboardSnapshot(fullCloudSnap);
        } catch (e) {
          log(`⚠️ Failed to insert cloud snapshot #${cloudMeta.id} into SQLite: ${e.message}`);
        }
      }
    }
  }

  // 7. Update merged cloud index sorted newest to oldest with strict deduplication
  const seenIds = new Set();
  const seenSlots = new Set();
  const dedupedCloudList = [];

  for (const s of cloudMap.values()) {
    if (!s || !s.id || deletedSet.has(String(s.id))) continue;
    const sid = String(s.id);
    const slotKey = `${s.snapshot_date || ''}_${s.snapshot_time || ''}_${s.snapshot_type || ''}`;

    if (seenIds.has(sid)) continue;
    if (slotKey && slotKey !== '__' && seenSlots.has(slotKey)) continue;

    seenIds.add(sid);
    if (slotKey && slotKey !== '__') seenSlots.add(slotKey);
    dedupedCloudList.push(s);
  }

  dedupedCloudList.sort((a, b) => {
    const tsA = Number(a.created_at_ts || (a.snapshot_date ? new Date(`${a.snapshot_date}T${a.snapshot_time || '00:00:00'}`).getTime() : a.id));
    const tsB = Number(b.created_at_ts || (b.snapshot_date ? new Date(`${b.snapshot_date}T${b.snapshot_time || '00:00:00'}`).getTime() : b.id));
    if (tsB !== tsA) return tsB - tsA;
    return Number(b.id) - Number(a.id);
  });

  await postJson(`${GLOBAL_CLOUD_BASE}/${SNAPSHOTS_INDEX_KEY}`, dedupedCloudList);

  // Sync tombstones back to cloud
  if (deletedSet.size > 0) {
    await postJson(`${GLOBAL_CLOUD_BASE}/${SNAPSHOTS_DELETED_KEY}`, Array.from(deletedSet));
  }

  log(`✅ Snapshot sync complete! Total synchronized snapshots: ${dedupedCloudList.length}`);
  return dedupedCloudList;
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const isForce = args.includes('--force');
  const isCatchup = args.includes('--catchup');
  
  let targetDate = null;
  const dateIdx = args.indexOf('--date');
  if (dateIdx !== -1 && args[dateIdx + 1]) {
    targetDate = args[dateIdx + 1].trim();
  }

  const kyiv = db.getKyivDateTime();
  log(`================================================================`);
  log(`🕒 [Daily Snapshot Cron] Kyiv Time: ${kyiv.fullStr}`);
  log(`================================================================`);

  if (!targetDate) {
    if (isCatchup) {
      // If run between 00:00 and 06:00 Kyiv time, yesterday's 23:55 is the one to catch up!
      if (kyiv.hour < 6) {
        const yesterday = new Date(Date.now() - 24 * 3600 * 1000);
        targetDate = db.getKyivDateTime(yesterday).dateStr;
        log(`ℹ️ Catch-up mode (early morning ${kyiv.timeStr}): targeting yesterday's date: ${targetDate}`);
      } else {
        targetDate = kyiv.dateStr;
      }
    } else {
      // Default: today's date
      targetDate = kyiv.dateStr;
    }
  }

  const targetTime = '23:55:00';
  log(`🎯 Target snapshot: Date = ${targetDate}, Time = ${targetTime}, Type = auto`);

  // First, run bi-directional sync to have complete view
  await syncSnapshots();

  // Check if an auto snapshot already exists for targetDate
  const existingLocalAuto = db.getAutoLeaderboardSnapshotByDate(targetDate);
  const cloudIndex = await fetchJson(`${GLOBAL_CLOUD_BASE}/${SNAPSHOTS_INDEX_KEY}?_cb=${Date.now()}`);
  const existingCloudAuto = Array.isArray(cloudIndex) && cloudIndex.some(
    s => s.snapshot_date === targetDate && (s.snapshot_type === 'auto' || s.snapshot_time === targetTime)
  );

  if ((existingLocalAuto || existingCloudAuto) && !isForce) {
    log(`ℹ️ Automatic snapshot for ${targetDate} already exists:`);
    if (existingLocalAuto) log(`   • SQLite: Snapshot #${existingLocalAuto.id} (${existingLocalAuto.snapshot_date} ${existingLocalAuto.snapshot_time})`);
    if (existingCloudAuto) log(`   • KVDB Cloud: Found matching 23:55 auto snapshot`);
    log(`⏩ Skipping creation (use --force to overwrite).`);
    return;
  }

  if (isForce) {
    log(`⚠️ Flag --force passed: will create/overwrite auto snapshot for ${targetDate}`);
  }

  log(`🚀 Collecting players from KVDB Cloud and local SQLite...`);
  const cloudPlayers = await getCloudPlayers();
  log(`   • Found ${cloudPlayers.length} players in KVDB Cloud.`);

  // Save to SQLite with target date and 23:55:00
  const snapshot = db.saveLeaderboardSnapshot({
    additionalPlayers: cloudPlayers,
    dateStr: targetDate,
    timeStr: targetTime,
    snapshotType: 'auto'
  });

  log(`✅ Saved snapshot #${snapshot.id} to SQLite: ${snapshot.total_players} players.`);

  // Explicitly upload to KVDB Cloud and await confirmation
  const snapUrl = `${GLOBAL_CLOUD_BASE}/leaderboard_snapshot_${snapshot.id}`;
  const uploaded = await postJson(snapUrl, snapshot);
  if (uploaded) {
    log(`☁️ Successfully uploaded snapshot #${snapshot.id} to KVDB Cloud!`);
  } else {
    log(`⚠️ Warning: Failed to upload snapshot #${snapshot.id} to KVDB Cloud.`);
  }

  // Update cloud index
  let curIndex = await fetchJson(`${GLOBAL_CLOUD_BASE}/${SNAPSHOTS_INDEX_KEY}?_cb=${Date.now()}`);
  if (!Array.isArray(curIndex)) curIndex = [];

  const meta = {
    id: snapshot.id,
    snapshot_date: snapshot.snapshot_date,
    snapshot_time: snapshot.snapshot_time,
    snapshot_type: snapshot.snapshot_type,
    total_players: snapshot.total_players,
    created_at: snapshot.created_at,
    created_at_ts: snapshot.created_at_ts
  };

  // Replace any existing entry for this id or this date/auto
  curIndex = [
    meta,
    ...curIndex.filter(x => String(x.id) !== String(snapshot.id) && !(x.snapshot_date === targetDate && x.snapshot_type === 'auto'))
  ];

  curIndex.sort((a, b) => {
    const tsA = Number(a.created_at_ts || (a.snapshot_date ? new Date(`${a.snapshot_date}T${a.snapshot_time || '00:00:00'}`).getTime() : a.id));
    const tsB = Number(b.created_at_ts || (b.snapshot_date ? new Date(`${b.snapshot_date}T${b.snapshot_time || '00:00:00'}`).getTime() : b.id));
    if (tsB !== tsA) return tsB - tsA;
    return Number(b.id) - Number(a.id);
  });

  await postJson(`${GLOBAL_CLOUD_BASE}/${SNAPSHOTS_INDEX_KEY}`, curIndex);
  log(`📋 Cloud meta_leaderboard_snapshots_index updated! (${curIndex.length} total snapshots)`);

  log(`🎉 DAILY LEADERBOARD SNAPSHOT COMPLETED SUCCESSFULLY!\n`);
}

main().catch(err => {
  log(`❌ CRITICAL ERROR in daily snapshot runner: ${err.stack || err.message}`);
  process.exit(1);
});
