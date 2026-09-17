#!/usr/bin/env node
/**
 * CLI Tool for Antigravity: Query saved leaderboard snapshot for a specific date.
 * 
 * Usage:
 *   node scripts/get_leaderboard_history.js "6 сентября"
 *   node scripts/get_leaderboard_history.js "2026-09-06"
 *   node scripts/get_leaderboard_history.js "06.09.2026"
 *   node scripts/get_leaderboard_history.js "сегодня"
 *   node scripts/get_leaderboard_history.js "вчера"
 *   node scripts/get_leaderboard_history.js list
 *   node scripts/get_leaderboard_history.js --snapshot
 */

const path = require('path');
const db = require(path.join(__dirname, '..', 'db.js'));

const MONTHS_MAP = {
  'января': 1, 'январь': 1, 'jan': 1, 'january': 1,
  'февраля': 2, 'февраль': 2, 'feb': 2, 'february': 2,
  'марта': 3, 'март': 3, 'mar': 3, 'march': 3,
  'апреля': 4, 'апрель': 4, 'apr': 4, 'april': 4,
  'мая': 5, 'май': 5, 'may': 5,
  'июня': 6, 'июнь': 6, 'jun': 6, 'june': 6,
  'июля': 7, 'июль': 7, 'jul': 7, 'july': 7,
  'августа': 8, 'август': 8, 'aug': 8, 'august': 8,
  'сентября': 9, 'сентябрь': 9, 'sep': 9, 'september': 9,
  'октября': 10, 'октябрь': 10, 'oct': 10, 'october': 10,
  'ноября': 11, 'ноябрь': 11, 'nov': 11, 'november': 11,
  'декабря': 12, 'декабрь': 12, 'dec': 12, 'december': 12
};

const ORDINAL_NUMBERS = {
  'двадцать первое': 21, 'двадцать первого': 21,
  'двадцать второе': 22, 'двадцать второго': 22,
  'двадцать третье': 23, 'двадцать третьего': 23,
  'двадцать четвертое': 24, 'двадцать четвёртое': 24, 'двадцать четвертого': 24, 'двадцать четвёртого': 24,
  'двадцать пятое': 25, 'двадцать пятого': 25,
  'двадцать шестое': 26, 'двадцать шестого': 26,
  'двадцать седьмое': 27, 'двадцать седьмого': 27,
  'двадцать восьмое': 28, 'двадцать восьмого': 28,
  'двадцать девятое': 29, 'двадцать девятого': 29,
  'тридцать первое': 31, 'тридцать первого': 31,
  'тридцатое': 30, 'тридцатого': 30,
  'первое': 1, 'первого': 1, 'первый': 1,
  'второе': 2, 'второго': 2, 'второй': 2,
  'третье': 3, 'третьего': 3, 'третий': 3,
  'четвертое': 4, 'четвёртое': 4, 'четвертого': 4, 'четвёртого': 4, 'четвертый': 4, 'четвёртый': 4,
  'пятое': 5, 'пятого': 5, 'пятый': 5,
  'шестое': 6, 'шестого': 6, 'шестой': 6,
  'седьмое': 7, 'седьмого': 7, 'седьмой': 7,
  'восьмое': 8, 'восьмого': 8, 'восьмой': 8,
  'девятое': 9, 'девятого': 9, 'девятый': 9,
  'десятое': 10, 'десятого': 10, 'десятый': 10,
  'одиннадцатое': 11, 'одиннадцатого': 11, 'одиннадцатый': 11,
  'двенадцатое': 12, 'двенадцатого': 12, 'двенадцатый': 12,
  'тринадцатое': 13, 'тринадцатого': 13, 'тринадцатый': 13,
  'четырнадцатое': 14, 'четырнадцатого': 14, 'четырнадцатый': 14,
  'пятнадцатое': 15, 'пятнадцатого': 15, 'пятнадцатый': 15,
  'шестнадцатое': 16, 'шестнадцатого': 16, 'шестнадцатый': 16,
  'семнадцатое': 17, 'семнадцатого': 17, 'семнадцатый': 17,
  'восемнадцатое': 18, 'восемнадцатого': 18, 'восемнадцатый': 18,
  'девятнадцатое': 19, 'девятнадцатого': 19, 'девятнадцатый': 19,
  'двадцатое': 20, 'двадцатого': 20, 'двадцатый': 20
};

function parseNaturalDate(input) {
  if (!input) return null;
  let raw = String(input).trim().toLowerCase();
  const kyiv = db.getKyivDateTime();

  // Strip common conversational prefixes
  raw = raw.replace(/^(?:выдай(?: мне)?|покажи(?: мне)?|открой(?: мне)?|найди|дай|список|лидерборд|снимок|таблиц[уа]|результаты)\s+/i, '').trim();

  if (raw === 'сегодня' || raw === 'today' || raw === 'now') {
    return kyiv.dateStr;
  }

  if (raw === 'вчера' || raw === 'yesterday') {
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000);
    return db.getKyivDateTime(yesterday).dateStr;
  }

  // ISO format YYYY-MM-DD
  const isoMatch = raw.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = String(isoMatch[2]).padStart(2, '0');
    const d = String(isoMatch[3]).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // DD.MM.YYYY or DD.MM
  const dotMatch = raw.match(/(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?/);
  if (dotMatch) {
    const d = String(dotMatch[1]).padStart(2, '0');
    const m = String(dotMatch[2]).padStart(2, '0');
    let y = dotMatch[3];
    if (!y) y = String(kyiv.year);
    else if (y.length === 2) y = '20' + y;
    return `${y}-${m}-${d}`;
  }

  // "6 сентября", "6 сентября 2026", "6-го сентября", "за 6 сентября"
  const wordMonthMatch = raw.match(/(?:^|\s)(?:за\s+)?(\d{1,2})(?:-?го|-?е|-?й)?\s+([а-яa-z]+)(?:\s+(\d{2,4}))?/);
  if (wordMonthMatch) {
    const d = String(wordMonthMatch[1]).padStart(2, '0');
    const monthWord = wordMonthMatch[2].toLowerCase();
    let y = wordMonthMatch[3];
    if (!y) y = String(kyiv.year);
    else if (y.length === 2) y = '20' + y;

    const monthNum = MONTHS_MAP[monthWord];
    if (monthNum) {
      const m = String(monthNum).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  // Check ordinal words: "за десятое число", "десятое число", "четвертый день", "пятнадцатое"
  for (const [key, dayVal] of Object.entries(ORDINAL_NUMBERS)) {
    const reg = new RegExp(`(?:^|\\s)(?:за\\s+)?${key}(?:\\s*(?:число|числа|день))?(?:\\s|$)`, 'i');
    if (reg.test(raw)) {
      const d = String(dayVal).padStart(2, '0');
      const m = String(kyiv.month).padStart(2, '0');
      return `${kyiv.year}-${m}-${d}`;
    }
  }

  // Day number with "за", "число" or "день": "за 4 число", "за 10", "15 число", "4 день"
  const dayDigitMatch = raw.match(/(?:^|\s)(?:за\s+)?(\d{1,2})(?:-?(?:е|го|й|oe|th))?\s*(?:число|числа|день)(?:\s|$)/) ||
                        raw.match(/(?:^|\s)за\s+(\d{1,2})(?:-?(?:е|го|й|oe|th))?(?:\s|$)/) ||
                        raw.match(/^(\d{1,2})$/);
  if (dayDigitMatch) {
    const num = parseInt(dayDigitMatch[1], 10);
    if (num >= 1 && num <= 31) {
      const d = String(num).padStart(2, '0');
      const m = String(kyiv.month).padStart(2, '0');
      return `${kyiv.year}-${m}-${d}`;
    }
  }

  return null;
}

function printSnapshotTable(snapshot) {
  const players = snapshot.players || [];
  console.log(`========================================================================================`);
  console.log(`🏆 СНИМОК ЛИДЕРБОРДА ЗА: ${snapshot.snapshot_date}`);
  console.log(`⏰ Время фиксации: ${snapshot.snapshot_time} (Киевское время)`);
  console.log(`👥 Всего участников в лидерборде: ${snapshot.total_players}`);
  console.log(`========================================================================================`);
  console.log(``);

  if (players.length === 0) {
    console.log(`В этом снимке нет игроков.`);
    return;
  }

  console.log(`| Место | Игрок                 | Username            | Telegram ID    | Уровень |`);
  console.log(`|:-----:|:----------------------|:--------------------|:---------------|:-------:|`);

  players.forEach(p => {
    let rankBadge = `#${p.rank}`;
    if (p.rank === 1) rankBadge = `1 🥇`;
    else if (p.rank === 2) rankBadge = `2 🥈`;
    else if (p.rank === 3) rankBadge = `3 🥉`;

    const name = String(p.name || p.first_name || 'Игрок').padEnd(21, ' ');
    const uname = (p.username ? `@${p.username.replace(/^@/, '')}` : '—').padEnd(19, ' ');
    const tid = String(p.telegram_id || '—').padEnd(14, ' ');
    const lvl = String(p.level !== undefined ? p.level : (p.max_level || 0)).padStart(4, ' ');

    console.log(`| ${rankBadge.padEnd(5, ' ')} | ${name} | ${uname} | ${tid} |  ${lvl}   |`);
  });

  console.log(``);
  console.log(`ℹ️ Снимок зафиксирован без изменения данных игроков. Все текущие уровни сохранены.`);
}

function printAvailableDates() {
  const dates = db.getLeaderboardSnapshotDates();
  console.log(`📋 Доступные даты снимков в архиве (${dates.length}):`);
  if (dates.length === 0) {
    console.log(`  (Снимки ещё не сохранялись)`);
    return;
  }
  dates.forEach(d => {
    console.log(`  • ${d.snapshot_date} в ${d.snapshot_time} (Киев) — ${d.total_players} игроков`);
  });
}

async function main() {
  const args = process.argv.slice(2);
  const inputArg = args.join(' ').trim();

  // Flag: take snapshot immediately
  if (args.includes('--snapshot') || args.includes('-s') || inputArg === 'сохранить' || inputArg === 'сделать снимок') {
    const snap = db.saveLeaderboardSnapshot();
    console.log(`✅ Снимок лидерборда за ${snap.snapshot_date} (${snap.snapshot_time} Киев) успешно создан!`);
    console.log(`👥 Сохранено участников: ${snap.total_players}`);
    return;
  }

  // Flag: list available dates
  if (!inputArg || inputArg === 'list' || inputArg === 'список' || inputArg === 'даты') {
    printAvailableDates();
    return;
  }

  const dateStr = parseNaturalDate(inputArg);
  if (!dateStr) {
    console.log(`⚠️ Не удалось распознать дату: "${inputArg}"`);
    console.log(`💡 Примеры допустимых форматов: "6 сентября", "2026-09-06", "06.09.2026", "сегодня", "вчера", "list"`);
    printAvailableDates();
    process.exit(1);
  }

  const snapshot = db.getLeaderboardSnapshotByDate(dateStr);

  if (!snapshot) {
    console.log(`❌ Снимок лидерборда за ${dateStr} ("${inputArg}") не найден.`);
    console.log(``);
    printAvailableDates();
    process.exit(1);
  }

  if (args.includes('--json')) {
    console.log(JSON.stringify(snapshot, null, 2));
    return;
  }

  printSnapshotTable(snapshot);
}

main().catch(err => {
  console.error('Ошибка:', err);
  process.exit(1);
});
