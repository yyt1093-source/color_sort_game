const db = require('../db');

const KVDB_BUCKET = process.env.KVDB_BUCKET || '82kzJTUxZwwFNvg7kUSqgM';
const GLOBAL_CLOUD_BASE = 'https://kvdb.io/' + KVDB_BUCKET;
const SNAPSHOT_KEY = 'leaderboard_snapshot_1790542571957';

async function restore() {
  console.log('🔄 Начинаем восстановление игроков из снимка 29.09 (23:55)...');

  // 1. Загрузка снимка из KVDB
  const snapRes = await fetch(`${GLOBAL_CLOUD_BASE}/${SNAPSHOT_KEY}?_cb=${Date.now()}`);
  if (!snapRes.ok) {
    throw new Error(`Не удалось загрузить снимок ${SNAPSHOT_KEY} из KVDB: HTTP ${snapRes.status}`);
  }

  const snapData = await snapRes.json();
  const players = snapData.players || [];
  console.log(`📋 В снимке найдено ${players.length} игроков за ${snapData.snapshot_date} ${snapData.snapshot_time}`);

  // 2. Восстановление каждого игрока в KVDB
  let restoredKvdbCount = 0;
  for (const sp of players) {
    const tid = String(sp.telegram_id).trim();
    const targetLevel = Number(sp.level || 0);
    const targetStars = Number(sp.stars || 0);

    // Загружаем текущие данные игрока, чтобы не потерять кошельки и бонусы
    let existing = {};
    try {
      const pRes = await fetch(`${GLOBAL_CLOUD_BASE}/player_${encodeURIComponent(tid)}?_cb=${Date.now()}`);
      if (pRes.ok) {
        existing = await pRes.json();
        if (typeof existing === 'string') existing = JSON.parse(existing);
      }
    } catch (e) {}

    // Обновляем прогресс, сохраняя все балансы и бустеры
    const updated = {
      ...existing,
      telegramId: tid,
      firstName: sp.name || existing.firstName || 'Игрок',
      username: sp.username || existing.username || '',
      maxLevel: targetLevel,
      level: targetLevel,
      currentLevel: Math.max(targetLevel + 1, Number(existing.currentLevel || 1)),
      stars: targetStars,
      hints: Number(existing.hints || 0),
      undos: Number(existing.undos || 0),
      reveals: Number(existing.reveals || 0),
      extraBottles: Number(existing.extraBottles || existing.extra_bottles || 0),
      extra_bottles: Number(existing.extraBottles || existing.extra_bottles || 0),
      ton_balance: Number(existing.ton_balance || 0),
      ton_wallet: existing.ton_wallet || '',
      ton_wallet_type: existing.ton_wallet_type || '',
      ton_deposits_total: Number(existing.ton_deposits_total || 0),
      ton_deposits_count: Number(existing.ton_deposits_count || 0),
      memo_code: existing.memo_code || `SORT-${tid.slice(-8)}`,
      all_colors_until: Number(existing.all_colors_until || 0),
      all_colors_purchased_at: Number(existing.all_colors_purchased_at || 0),
      seasonResetAt: Number(existing.seasonResetAt || 1789817419697),
      updatedAt: Date.now()
    };

    // Сохраняем в KVDB
    const saveRes = await fetch(`${GLOBAL_CLOUD_BASE}/player_${encodeURIComponent(tid)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    });

    if (saveRes.ok) {
      restoredKvdbCount++;
      console.log(`✅ [KVDB] Игрок ${sp.name} (${tid}): уровень восстановлен на ${targetLevel} (Stars: ${targetStars})`);
    } else {
      console.error(`❌ [KVDB] Ошибка сохранения ${tid}: HTTP ${saveRes.status}`);
    }

    // Небольшая пауза между запросами к KVDB
    await new Promise(r => setTimeout(r, 60));
  }

  // 3. Восстановление в локальной базе SQLite (game_database.sqlite)
  console.log('\n📦 Обновление локальной базы данных SQLite...');
  let restoredSqliteCount = 0;
  for (const sp of players) {
    const tid = String(sp.telegram_id).trim();
    const targetLevel = Number(sp.level || 0);
    const targetStars = Number(sp.stars || 0);

    try {
      db.prepare(`
        INSERT INTO users (telegram_id, first_name, username, max_level, current_level, stars, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(telegram_id) DO UPDATE SET
          first_name = excluded.first_name,
          max_level = excluded.max_level,
          current_level = excluded.current_level,
          stars = excluded.stars,
          updated_at = datetime('now')
      `).run(tid, sp.name || 'Игрок', sp.username || '', targetLevel, targetLevel + 1, targetStars);
      restoredSqliteCount++;
    } catch (e) {
      console.warn(`[SQLite warning] ${tid}:`, e.message);
    }
  }

  // 4. Добавление снимка в leaderboard_snapshots таблицы SQLite, если его там нет
  try {
    const existingSnap = db.prepare(`SELECT id FROM leaderboard_snapshots WHERE snapshot_date = '2026-09-29'`).get();
    if (!existingSnap) {
      db.prepare(`
        INSERT INTO leaderboard_snapshots (id, snapshot_date, snapshot_time, snapshot_type, created_at, created_at_ts, total_players, players_data)
        VALUES (?, '2026-09-29', '23:55:00', 'auto', '2026-09-29 23:55:00', 1790690918007, ?, ?)
      `).run(1790542571957, players.length, JSON.stringify(players));

      for (const sp of players) {
        db.prepare(`
          INSERT INTO leaderboard_snapshot_entries (snapshot_id, rank, telegram_id, first_name, username, max_level, stars)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(1790542571957, sp.rank, String(sp.telegram_id), sp.name, sp.username || '', sp.level, sp.stars || 0);
      }
      console.log('✅ Снимок 29.09 успешно сохранён в SQLite историю лидерборда!');
    } else {
      console.log('ℹ️ Снимок 29.09 уже зарегистрирован в SQLite.');
    }
  } catch (e) {
    console.warn('[SQLite snapshot error]', e.message);
  }

  console.log(`\n🎉 Восстановление успешно завершено!`);
  console.log(`- В облачной базе KVDB обновлено: ${restoredKvdbCount} игроков`);
  console.log(`- В локальной базе SQLite обновлено: ${restoredSqliteCount} игроков`);
}

restore().catch(err => {
  console.error('❌ Фатальная ошибка восстановления:', err);
  process.exit(1);
});
