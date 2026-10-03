const fs = require('fs');

async function main() {
  const bucket = '82kzJTUxZwwFNvg7kUSqgM';
  const kvdbKey = 'colorsort_code_checkpoints';
  console.log('Fetching current checkpoints from KVDB...');
  
  let checkpoints = [];
  try {
    const res = await fetch(`https://kvdb.io/${bucket}/${kvdbKey}?_cb=${Date.now()}`);
    console.log('GET status:', res.status);
    if (res.ok) {
      const text = await res.text();
      if (text && text.trim()) {
        checkpoints = JSON.parse(text);
      }
    }
  } catch (e) {
    console.error('Error fetching KVDB:', e.message);
  }

  console.log(`Current checkpoints count in KVDB: ${checkpoints.length}`);
  if (checkpoints.length > 0) {
    console.log('Top checkpoint:', checkpoints[0].title);
  }

  const newCheckpoint = {
    id: 'colorsort_checkpoint_20261003_171000',
    createdAtTimestamp: 1791036600000,
    kyivFormattedDate: '03.10.2026, 17:10:00 (Киев)',
    title: 'Версия v1.0.8 — Восстановление модалок лидерборда и рекламы, уровень игроков в подарках (без кнопки)',
    note: 'Метка Git: v1.0.8-leaderboard-ad-modals-gifts-level-badge. Устранена вложенность модальных окон в public/index.html — кнопки Лидерборда и Рекламы открываются мгновенно и безотказно. В списке получателей подарков убрана кнопка «Выбрать» / «Отправить», а текущий уровень игрока из лидерборда аккуратно отображается в правом углу каждой строки с кликабельным выбором карточки. Полная приватность юзернеймов и анонимность подарков для игроков сохранена. Все тесты пройдены.',
    tag: 'v1.0.8-leaderboard-ad-modals-gifts-level-badge'
  };

  // Add newCheckpoint at the beginning if not already present
  checkpoints = [newCheckpoint, ...checkpoints.filter(c => c.id !== newCheckpoint.id && c.tag !== newCheckpoint.tag)];

  console.log(`Updated checkpoints count: ${checkpoints.length}`);

  const postRes = await fetch(`https://kvdb.io/${bucket}/${kvdbKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(checkpoints)
  });

  console.log('POST status:', postRes.status);
  if (postRes.ok) {
    console.log('✓ Successfully saved checkpoint v1.0.8 to KVDB cloud storage!');
  } else {
    console.error('Failed to post to KVDB:', await postRes.text());
  }
}

main().catch(console.error);
