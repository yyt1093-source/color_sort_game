/**
 * Game Session & Move Verification Engine for Color Sort
 * Server-authoritative anti-cheat validation
 */
const crypto = require('crypto');
const levelGenerator = require('./public/js/levelGenerator');

// In-memory active game sessions
const sessions = new Map(); // token -> session
const playerActiveSession = new Map(); // telegramId -> token

// Active ad watching tokens
const activeAdTokens = new Map(); // adToken -> { telegramId, rewardType, startedAt, claimed }

// Clean expired sessions periodically (older than 2 hours)
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (now - session.lastMoveAt > 2 * 60 * 60 * 1000) {
      sessions.delete(token);
      if (playerActiveSession.get(session.telegramId) === token) {
        playerActiveSession.delete(session.telegramId);
      }
    }
  }
  for (const [adToken, tokenData] of activeAdTokens.entries()) {
    if (now - tokenData.startedAt > 10 * 60 * 1000) { // 10 minutes
      activeAdTokens.delete(adToken);
    }
  }
}, 5 * 60 * 1000);

function isBottleCompleted(bottle, capacity = 5) {
  if (!bottle || bottle.length !== capacity) return false;
  const first = bottle[0];
  return bottle.every(c => c === first);
}

function isLevelWon(bottles, capacity = 5) {
  if (!bottles || bottles.length === 0) return true;
  return bottles.every(b => b.length === 0 || isBottleCompleted(b, capacity));
}

function canPour(bottles, fromIdx, toIdx, capacity = 5) {
  if (fromIdx === toIdx) return false;
  const bFrom = bottles[fromIdx];
  const bTo = bottles[toIdx];

  if (!bFrom || bFrom.length === 0) return false;
  if (!bTo || bTo.length >= capacity || isBottleCompleted(bTo, capacity)) return false;

  const topColor = bFrom[bFrom.length - 1];
  if (bTo.length === 0) return true;
  return bTo[bTo.length - 1] === topColor;
}

function getTransferAmount(bottles, fromIdx, toIdx, capacity = 5) {
  const bFrom = bottles[fromIdx];
  const bTo = bottles[toIdx];
  const topColor = bFrom[bFrom.length - 1];

  let count = 0;
  for (let i = bFrom.length - 1; i >= 0; i--) {
    if (bFrom[i] === topColor) count++;
    else break;
  }
  return Math.min(count, capacity - bTo.length);
}

function executePour(bottles, fromIdx, toIdx, capacity = 5) {
  if (!canPour(bottles, fromIdx, toIdx, capacity)) return null;
  const amount = getTransferAmount(bottles, fromIdx, toIdx, capacity);
  if (amount <= 0) return null;

  const color = bottles[fromIdx][bottles[fromIdx].length - 1];
  for (let i = 0; i < amount; i++) {
    bottles[fromIdx].pop();
    bottles[toIdx].push(color);
  }
  return { amount, color };
}

/**
 * Start a new game session on the server
 */
function startSession(telegramId, levelNumber, userMaxLevel) {
  const idStr = String(telegramId);
  const targetLevel = Math.max(1, Number(levelNumber || 1));
  const maxAllowed = Math.max(1, Number(userMaxLevel || 1));

  // Player can only play levels up to maxLevel (or maxLevel + 1 if replaying or current)
  if (targetLevel > maxAllowed + 1) {
    return {
      success: false,
      error: `Недопустимый уровень ${targetLevel}. Ваш максимальный уровень: ${maxAllowed}.`
    };
  }

  const generated = levelGenerator.generateLevel(targetLevel);
  const token = crypto.randomBytes(24).toString('hex');

  const session = {
    token,
    telegramId: idStr,
    levelNumber: targetLevel,
    capacity: generated.capacity || 5,
    colorCount: generated.colorCount,
    initialBottles: JSON.parse(JSON.stringify(generated.bottles)),
    currentBottles: JSON.parse(JSON.stringify(generated.bottles)),
    moves: [],
    boostersUsed: { hints: 0, undos: 0, reveals: 0, extraBottles: 0 },
    history: [], // stack of bottle snapshots for undos
    startedAt: Date.now(),
    lastMoveAt: Date.now(),
    isWon: false
  };

  sessions.set(token, session);
  playerActiveSession.set(idStr, token);

  return {
    success: true,
    sessionToken: token,
    levelNumber: targetLevel,
    bottles: session.currentBottles,
    capacity: session.capacity
  };
}

/**
 * Record and validate a single move
 */
function applyMove(token, telegramId, fromIdx, toIdx) {
  const session = sessions.get(token);
  if (!session) {
    return { success: false, error: 'Игровая сессия не найдена или истекла' };
  }
  if (session.telegramId !== String(telegramId)) {
    return { success: false, error: 'Доступ запрещён: неверный ID игрока' };
  }
  if (session.isWon) {
    return { success: true, movesCount: session.moves.length, isWon: true, currentBottles: session.currentBottles };
  }

  fromIdx = Number(fromIdx);
  toIdx = Number(toIdx);

  if (!canPour(session.currentBottles, fromIdx, toIdx, session.capacity)) {
    return { success: false, error: 'Недопустимый ход (невозможно перелить цвет)' };
  }

  // Save previous state for undo
  session.history.push({
    bottles: JSON.parse(JSON.stringify(session.currentBottles)),
    movesCount: session.moves.length
  });

  const pourRes = executePour(session.currentBottles, fromIdx, toIdx, session.capacity);
  if (!pourRes) {
    return { success: false, error: 'Ошибка выполнения хода' };
  }

  session.moves.push({
    from: fromIdx,
    to: toIdx,
    amount: pourRes.amount,
    color: pourRes.color,
    timestamp: Date.now()
  });

  session.lastMoveAt = Date.now();
  session.isWon = isLevelWon(session.currentBottles, session.capacity);

  return {
    success: true,
    movesCount: session.moves.length,
    isWon: session.isWon,
    currentBottles: session.currentBottles
  };
}

/**
 * Record booster usage in session
 */
function applyBooster(token, telegramId, boosterType) {
  const session = sessions.get(token);
  if (!session) {
    return { success: false, error: 'Игровая сессия не найдена' };
  }
  if (session.telegramId !== String(telegramId)) {
    return { success: false, error: 'Доступ запрещён' };
  }

  const normalized = String(boosterType || '').toLowerCase();
  if (normalized === 'extra_bottle' || normalized === 'extrabottle' || normalized === 'extra_bottles' || normalized === 'extrabottles') {
    session.currentBottles.push([]);
    session.boostersUsed.extraBottles++;
    return { success: true, currentBottles: session.currentBottles };
  }

  if (normalized === 'undo' || normalized === 'undos') {
    if (session.history.length === 0) {
      return { success: false, error: 'Нет ходов для отмены' };
    }
    const lastState = session.history.pop();
    session.currentBottles = lastState.bottles;
    session.moves.pop();
    session.boostersUsed.undos++;
    session.isWon = isLevelWon(session.currentBottles, session.capacity);
    return { success: true, currentBottles: session.currentBottles, movesCount: session.moves.length };
  }

  if (normalized === 'hint' || normalized === 'hints') {
    session.boostersUsed.hints++;
    return { success: true };
  }

  if (normalized === 'reveal' || normalized === 'reveals' || normalized === 'reveal_bottle') {
    session.boostersUsed.reveals++;
    return { success: true };
  }

  return { success: false, error: 'Неизвестный тип бустера' };
}

/**
 * Verify level completion (checks victory condition & move log replay)
 */
function verifyLevelCompletion(token, telegramId, clientMovesLog = null) {
  const session = sessions.get(token);
  if (!session) {
    return { verified: false, error: 'Игровая сессия не найдена или уже завершена' };
  }
  if (session.telegramId !== String(telegramId)) {
    return { verified: false, error: 'Доступ запрещён' };
  }

  let finalWon = false;

  // Option 1: Validate session current bottles
  if (session.isWon || isLevelWon(session.currentBottles, session.capacity)) {
    finalWon = true;
  }

  // Option 2: Replay moves log if provided (for network resiliency)
  if (!finalWon && Array.isArray(clientMovesLog) && clientMovesLog.length > 0) {
    const replayBottles = JSON.parse(JSON.stringify(session.initialBottles));
    // Add extra bottles if used
    for (let i = 0; i < (session.boostersUsed.extraBottles || 0); i++) {
      replayBottles.push([]);
    }

    let replayValid = true;
    for (const m of clientMovesLog) {
      if (m.type === 'extra_bottle') {
        replayBottles.push([]);
        continue;
      }
      if (m.from !== undefined && m.to !== undefined) {
        if (!canPour(replayBottles, m.from, m.to, session.capacity)) {
          replayValid = false;
          break;
        }
        executePour(replayBottles, m.from, m.to, session.capacity);
      }
    }

    if (replayValid && isLevelWon(replayBottles, session.capacity)) {
      finalWon = true;
      session.currentBottles = replayBottles;
      session.isWon = true;
    }
  }

  if (!finalWon) {
    return {
      verified: false,
      error: 'Уровень не завершён: колбочки ещё не отсортированы по цветам'
    };
  }

  // Check move count sanity: a level cannot be solved in 0 or 1 moves
  const totalMoves = session.moves.length || (Array.isArray(clientMovesLog) ? clientMovesLog.length : 0);
  if (totalMoves < 3) {
    return {
      verified: false,
      error: 'Подозрительная активность: уровень завершён без достаточного количества ходов'
    };
  }

  // Anti-Cheat: Level >= 5 requires at least 1 booster
  const totalBoosters = (session.boostersUsed.hints || 0) +
                        (session.boostersUsed.undos || 0) +
                        (session.boostersUsed.reveals || 0) +
                        (session.boostersUsed.extraBottles || 0);
  if (session.levelNumber >= 5 && totalBoosters <= 0) {
    return {
      verified: false,
      error: 'Система безопасности: начиная с 5 уровня прохождение без подсказок или бустеров заблокировано'
    };
  }

  const result = {
    verified: true,
    levelNumber: session.levelNumber,
    movesCount: totalMoves,
    boostersUsed: session.boostersUsed
  };

  // Clean up session
  sessions.delete(token);
  if (playerActiveSession.get(String(telegramId)) === token) {
    playerActiveSession.delete(String(telegramId));
  }

  return result;
}

/**
 * Ad Watching Verification
 */
function createAdToken(telegramId, rewardType) {
  const adToken = crypto.randomBytes(24).toString('hex');
  activeAdTokens.set(adToken, {
    telegramId: String(telegramId),
    rewardType: String(rewardType),
    startedAt: Date.now(),
    claimed: false
  });
  return adToken;
}

function verifyAndClaimAdToken(adToken, telegramId, rewardType, isLocalDev = false) {
  if (!adToken) {
    return { valid: false, error: 'Отсутствует токен просмотра рекламы' };
  }
  const tokenData = activeAdTokens.get(String(adToken));
  if (!tokenData) {
    return { valid: false, error: 'Недействительный или просроченный токен рекламы' };
  }
  if (tokenData.telegramId !== String(telegramId)) {
    return { valid: false, error: 'Токен рекламы принадлежит другому пользователю' };
  }
  if (tokenData.claimed) {
    return { valid: false, error: 'Этот токен рекламы уже был использован' };
  }
  if (tokenData.rewardType !== String(rewardType)) {
    return { valid: false, error: 'Несоответствие типа награды токену' };
  }

  const elapsed = Date.now() - tokenData.startedAt;
  const minRequiredMs = isLocalDev ? 1500 : 8000; // Real ads are at least 8-15s
  if (elapsed < minRequiredMs) {
    return {
      valid: false,
      error: `Реклама не досмотрена до конца (прошло ${Math.round(elapsed / 1000)} сек.).`
    };
  }

  tokenData.claimed = true;
  activeAdTokens.delete(String(adToken));
  return { valid: true };
}

module.exports = {
  startSession,
  applyMove,
  applyBooster,
  verifyLevelCompletion,
  createAdToken,
  verifyAndClaimAdToken,
  isLevelWon,
  canPour,
  executePour
};
