const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { startBot } = require('../bot');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Middleware to log API calls
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`[Vercel API] ${req.method} ${req.path}`);
  }
  next();
});

/**
 * Get or Init User Progress
 */
app.post('/api/user/init', (req, res) => {
  try {
    const { telegramId, firstName, username, photoUrl } = req.body;

    const id = telegramId || 'guest_dev_123';
    const user = db.getUser(id, {
      first_name: firstName || (id === 'guest_dev_123' ? 'Гость' : 'Игрок'),
      username: username || '',
      photo_url: photoUrl || ''
    });

    res.json({ success: true, user });
  } catch (err) {
    console.error('[API ERROR] /api/user/init:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Sync Progress after Level Completion or Move
 */
app.post('/api/user/sync', (req, res) => {
  try {
    const { telegramId, firstName, username, photoUrl, currentLevel, maxLevel, starsAdded, coinsAdded, hintsUsed, undosUsed, revealsUsed, extraBottlesUsed, shufflesUsed, totalMoves } = req.body;

    const id = telegramId || 'guest_dev_123';
    const updatedUser = db.updateUserProgress(id, {
      firstName,
      username,
      photoUrl,
      currentLevel,
      maxLevel,
      starsAdded,
      coinsAdded,
      hintsUsed,
      undosUsed,
      revealsUsed,
      extraBottlesUsed,
      shufflesUsed,
      totalMoves
    });

    res.json({ success: true, user: updatedUser });
  } catch (err) {
    console.error('[API ERROR] /api/user/sync:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Get Global Leaderboard
 */
app.get('/api/leaderboard', (req, res) => {
  try {
    const telegramId = req.query.telegramId || 'guest_dev_123';
    const leaderboard = db.getLeaderboard(telegramId, 50);

    res.json({ success: true, ...leaderboard });
  } catch (err) {
    console.error('[API ERROR] /api/leaderboard:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Claim Ad Reward (Rewarded Ads Bonus)
 */
app.post('/api/ad-reward', (req, res) => {
  try {
    const { telegramId, rewardType } = req.body;
    const id = telegramId || 'guest_dev_123';

    let bonus = { coins: 0, hints: 0, undos: 0, reveals: 0, extra_bottles: 0, shuffles: 0 };
    if (rewardType === 'hints') bonus.hints = 1;
    else if (rewardType === 'undos') bonus.undos = 1;
    else if (rewardType === 'reveal_bottle' || rewardType === 'reveals') bonus.reveals = 1;
    else if (rewardType === 'extra_bottle' || rewardType === 'extra_bottles') bonus.extra_bottles = 1;
    else if (rewardType === 'shuffle_colors' || rewardType === 'shuffles') bonus.shuffles = 1;
    else if (rewardType === 'coins') bonus.coins = 150;
    else bonus.coins = 100;

    const updatedUser = db.addBonus(id, bonus);

    res.json({
      success: true,
      message: `Бонус ${rewardType} успешно начислен!`,
      user: updatedUser
    });
  } catch (err) {
    console.error('[API ERROR] /api/ad-reward:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Admin Season Reset (Alligator Only)
 */
app.post('/api/admin/reset-season', (req, res) => {
  try {
    const { telegramId, firstName, username } = req.body || {};
    const tid = String(telegramId || '').trim();
    const fname = String(firstName || '').toLowerCase().trim();
    const uname = String(username || '').toLowerCase().trim();

    const isAlligator = tid === '5761685341' ||
      fname === 'alligator' || fname === 'аллигатор' ||
      uname === 'alligator' || uname === 'аллигатор';

    if (!isAlligator) {
      return res.status(403).json({ success: false, error: 'Доступ запрещён: права администратора только у Аллигатора' });
    }

    const result = db.resetSeason();
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[API ERROR] /api/admin/reset-season:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Serve static frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

module.exports = app;
