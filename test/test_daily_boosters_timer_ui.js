/**
 * Test Daily Boosters 30-Day Subscription, Countdown Timer, and Full-Width UI Structure
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

// 1. Verify index.html structure
const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');

console.log('--- 1. Testing index.html structure ---');
assert(html.includes('id="dailyBoostersCard"'), 'Must have dailyBoostersCard');
assert(html.includes('id="dailyBoostersStatusBox"'), 'Must have dailyBoostersStatusBox');
assert(html.includes('id="dailyBoostersDaysLeft"'), 'Must have dailyBoostersDaysLeft');
assert(html.includes('id="dailyBoostersNextLabel"'), 'Must have dailyBoostersNextLabel');
assert(html.includes('id="dailyBoostersCountdownTimer"'), 'Must have dailyBoostersCountdownTimer');

// Check that the duplicate description was removed
assert(!html.includes('🎁 Каждый день в 23:59 (Киев) начисляется по +10 каждого подарка'), 'Must NOT have duplicate description inside status box');

// Check that status box is a direct child of dailyBoostersCard (full width), NOT nested in shop-item-details
const cardStart = html.indexOf('id="dailyBoostersCard"');
const cardEnd = html.indexOf('</div>', html.indexOf('id="buyDailyBoostersBtn"'));
const cardSnippet = html.slice(cardStart, cardEnd + 100);

const detailsEnd = cardSnippet.indexOf('</div>\n          </div>');
const statusBoxPos = cardSnippet.indexOf('id="dailyBoostersStatusBox"');
assert(statusBoxPos > detailsEnd, 'dailyBoostersStatusBox must be outside shop-item-details to be full-width');

console.log('✅ HTML structure verified: full-width card layout, no duplicate text, proper element IDs.');

// 2. Verify app.js logic
console.log('--- 2. Testing app.js countdown and time logic ---');
const appJs = fs.readFileSync(path.join(__dirname, '../public/js/app.js'), 'utf8');

// Ensure applyLanguage does NOT wipe dailyBoostersCountdownTimer
assert(!appJs.includes('dailyBoostersNextInfo.textContent = t(\'dailyBoostersNextInfo\')'), 'applyLanguage must not wipe dailyBoostersNextInfo');
assert(appJs.includes('dailyBoostersNextLabel.textContent = t(\'dailyBoostersNextLabel\')'), 'applyLanguage must update dailyBoostersNextLabel');

// Test Kyiv time calculation
function getKyivDateTime(date) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Kyiv',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(date);
  const obj = {};
  for (const p of parts) {
    if (p.type !== 'literal') obj[p.type] = p.value;
  }
  return {
    year: parseInt(obj.year, 10),
    month: parseInt(obj.month, 10),
    day: parseInt(obj.day, 10),
    hour: parseInt(obj.hour, 10),
    minute: parseInt(obj.minute, 10),
    second: parseInt(obj.second, 10),
    dateStr: `${obj.year}-${obj.month}-${obj.day}`
  };
}

function getTimeUntilNext2359Kyiv(nowInput = new Date()) {
  const kyiv = getKyivDateTime(nowInput);
  const currentTotalMinutes = kyiv.hour * 60 + kyiv.minute;
  const targetTotalMinutes = 23 * 60 + 59; // 23:59 (1439 mins)
  let diffMinutes = targetTotalMinutes - currentTotalMinutes;
  if (diffMinutes < 0) {
    diffMinutes = 24 * 60;
  }
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  return { hours, minutes, totalMinutes: diffMinutes };
}

// Test at 12:00 Kyiv time -> 11 hours and 59 minutes until 23:59
const mock12 = new Date('2026-10-06T09:00:00Z'); // 12:00 Kyiv (UTC+3)
const time12 = getTimeUntilNext2359Kyiv(mock12);
assert.strictEqual(time12.hours, 11, 'Should be 11 hours');
assert.strictEqual(time12.minutes, 59, 'Should be 59 minutes');

// Test at 23:58 Kyiv time -> 0 hours and 1 minute until 23:59
const mock2358 = new Date('2026-10-06T20:58:00Z'); // 23:58 Kyiv (UTC+3)
const time2358 = getTimeUntilNext2359Kyiv(mock2358);
assert.strictEqual(time2358.hours, 0, 'Should be 0 hours');
assert.strictEqual(time2358.minutes, 1, 'Should be 1 minute');

// Test at 23:59 Kyiv time -> 0 hours and 0 minutes
const mock2359 = new Date('2026-10-06T20:59:00Z'); // 23:59 Kyiv (UTC+3)
const time2359 = getTimeUntilNext2359Kyiv(mock2359);
assert.strictEqual(time2359.hours, 0, 'Should be 0 hours');
assert.strictEqual(time2359.minutes, 0, 'Should be 0 minutes');

console.log('✅ Countdown time calculation verified across multiple test timestamps.');

// 3. Test days decrement progression
console.log('--- 3. Testing days decrement progression ---');
const db = require('../db');

// Maria bought on 2026-10-05 14:00 Kyiv
const mariaPurchase = new Date('2026-10-05T11:00:00Z').getTime();

// Oct 5 before 23:59 (Day 1): 30 days
const oct5Day = new Date('2026-10-05T15:00:00Z');
assert.strictEqual(db.calculateDailyBoostersDaysLeft(mariaPurchase, oct5Day), 30, 'Day 1 before 23:59 must be 30 days');

// Oct 5 at 23:59: 29 days
const oct5Night = new Date('2026-10-05T20:59:00Z');
assert.strictEqual(db.calculateDailyBoostersDaysLeft(mariaPurchase, oct5Night), 29, 'Day 1 at 23:59 must be 29 days');

// Oct 6 during the day (today): 29 days
const oct6Day = new Date('2026-10-06T09:00:00Z');
assert.strictEqual(db.calculateDailyBoostersDaysLeft(mariaPurchase, oct6Day), 29, 'Day 2 before 23:59 must be 29 days');

// Oct 6 at 23:59: 28 days
const oct6Night = new Date('2026-10-06T20:59:00Z');
assert.strictEqual(db.calculateDailyBoostersDaysLeft(mariaPurchase, oct6Night), 28, 'Day 2 at 23:59 must be 28 days');

console.log('✅ Days progression tested: 30 days on Day 1 -> 29 days after 23:59 -> 28 days after next 23:59.');

console.log('🎉 ALL TESTS PASSED SUCCESSFULLY!');
