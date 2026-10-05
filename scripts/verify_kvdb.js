const BUCKET = '82kzJTUxZwwFNvg7kUSqgM';

async function checkKvdb() {
  const res = await fetch(`https://kvdb.io/${BUCKET}/?prefix=player_&values=true&format=json&_cb=${Date.now()}`);
  const pairs = await res.json();
  console.log('Total player_* keys in KVDB:', pairs.length);

  const players = pairs.map(([k, raw]) => {
    const val = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return val;
  }).filter(p => p && p.telegramId && !String(p.telegramId).startsWith('guest') && !String(p.telegramId).startsWith('dev') && /^\d+$/.test(String(p.telegramId)));

  console.log('Valid players count:', players.length);
  
  const activePlayers = players.filter(p => Number(p.maxLevel || p.level || 0) >= 1);
  console.log('Players with maxLevel >= 1:', activePlayers.length);

  activePlayers.sort((a, b) => Number(b.maxLevel || b.level || 0) - Number(a.maxLevel || a.level || 0));
  activePlayers.forEach((p, idx) => {
    console.log(`  #${(idx+1).toString().padStart(2, ' ')} | TID: ${p.telegramId} | Lvl: ${(p.maxLevel||p.level||0).toString().padStart(2, ' ')} | ${p.firstName} (@${p.username||''})`);
  });
}
checkKvdb();
