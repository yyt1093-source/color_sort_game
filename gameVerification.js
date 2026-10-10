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
const playerActiveAdTokens = new Map(); // telegramId -> adToken

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

function getMinRealisticMoves(levelNumber, colorCount) {
  const lvl = Math.max(1, Number(levelNumber || 1));
  const c = Math.max(5, Number(colorCount || 5));
  if (lvl === 1) return 6;
  if (lvl === 2) return 8;
  if (lvl === 3) return 10;
  if (lvl === 4) return 12;
  if (lvl === 5) return 14;
  // Levels > 5: difficulty increases significantly (9+ colors, hidden layers)
  return Math.max(15, Math.floor(c * 1.3));
}

/**
 * Verify level completion (checks victory condition & move log replay)
 */
function verifyLevelCompletion(token, telegramId, clientMovesLog = null, metadata = null) {
  const tid = String(telegramId);
  let session = token ? sessions.get(token) : null;
  if (session && session.telegramId !== tid) {
    return { verified: false, error: 'Доступ запрещён: неверный ID игрока' };
  }

  let levelNumber = session ? session.levelNumber : (metadata && metadata.levelNumber ? Number(metadata.levelNumber) : null);
  if (!levelNumber) {
    return { verified: false, error: 'Игровая сессия не найдена или не указан номер уровня' };
  }

  let capacity = session ? session.capacity : 5;
  let colorCount = session ? session.colorCount : 5;
  let initialBottles = session ? session.initialBottles : null;
  let boostersUsed = session ? session.boostersUsed : {
    hints: 0,
    undos: 0,
    reveals: 0,
    extraBottles: 0
  };

  // Reconstruct level if session expired or missing due to serverless cold start
  if (!initialBottles) {
    try {
      const generated = levelGenerator.generateLevel(levelNumber);
      capacity = generated.capacity || 5;
      colorCount = generated.colorCount || 5;
      initialBottles = JSON.parse(JSON.stringify(generated.bottles));
    } catch (e) {
      return { verified: false, error: 'Не удалось сгенерировать уровень для проверки' };
    }
  }

  // Merge client boosters metadata if provided
  if (metadata && metadata.boostersUsed && typeof metadata.boostersUsed === 'object') {
    const metaBoost = metadata.boostersUsed;
    boostersUsed.hints = Math.max(boostersUsed.hints || 0, Number(metaBoost.hints || 0));
    boostersUsed.undos = Math.max(boostersUsed.undos || 0, Number(metaBoost.undos || 0));
    boostersUsed.reveals = Math.max(boostersUsed.reveals || 0, Number(metaBoost.reveals || 0));
    boostersUsed.extraBottles = Math.max(boostersUsed.extraBottles || 0, Number(metaBoost.extraBottles || metaBoost.extra_bottles || 0));
  }

  let finalWon = false;
  let validMovesCount = 0;

  // Option 1: Session state check if moves were tracked in real-time
  if (session && (session.isWon || isLevelWon(session.currentBottles, session.capacity))) {
    finalWon = true;
    validMovesCount = session.moves.length;
  }

  // Option 2: Replay moves log (authoritative check from initial bottles)
  if (Array.isArray(clientMovesLog) && clientMovesLog.length > 0) {
    const replayBottles = JSON.parse(JSON.stringify(initialBottles));
    
    // Check how many extra bottles are explicitly in the move log vs reported in boostersUsed
    const explicitExtraInLog = clientMovesLog.filter(m => m && m.type === 'extra_bottle').length;
    const extraToAddAtStart = Math.max(0, (boostersUsed.extraBottles || 0) - explicitExtraInLog);
    for (let i = 0; i < extraToAddAtStart; i++) {
      replayBottles.push([]);
    }

    let replayValid = true;
    let replayError = null;
    let replayedPours = 0;

    for (let i = 0; i < clientMovesLog.length; i++) {
      const m = clientMovesLog[i];
      if (!m) continue;

      if (m.type === 'extra_bottle') {
        replayBottles.push([]);
        continue;
      }

      const from = m.from !== undefined ? m.from : m.fromIndex;
      const to = m.to !== undefined ? m.to : m.toIndex;
      if (from === undefined || to === undefined) continue;

      const fromIdx = Number(from);
      const toIdx = Number(to);

      if (fromIdx < 0 || fromIdx >= replayBottles.length || toIdx < 0 || toIdx >= replayBottles.length) {
        replayValid = false;
        replayError = `Ход #${i + 1}: неверный индекс колбочки (${fromIdx + 1} -> ${toIdx + 1})`;
        break;
      }

      if (!canPour(replayBottles, fromIdx, toIdx, capacity)) {
        replayValid = false;
        replayError = `Ход #${i + 1}: невозможный перелив из колбочки ${fromIdx + 1} в ${toIdx + 1}`;
        break;
      }

      executePour(replayBottles, fromIdx, toIdx, capacity);
      replayedPours++;
    }

    if (replayValid && isLevelWon(replayBottles, capacity)) {
      finalWon = true;
      validMovesCount = replayedPours;
      if (session) {
        session.currentBottles = replayBottles;
        session.isWon = true;
      }
    } else if (!replayValid) {
      return {
        verified: false,
        error: replayError || 'Ошибка воспроизведения ходов: недопустимая комбинация переливаний'
      };
    }
  }

  if (!finalWon) {
    return {
      verified: false,
      error: 'Уровень не завершён: не все цвета собраны в полные колбочки'
    };
  }

  // Realistic minimum moves check based on level difficulty
  const minRealisticMoves = getMinRealisticMoves(levelNumber, colorCount);
  const totalMoves = Math.max(validMovesCount, (session ? session.moves.length : 0), (metadata ? Number(metadata.movesCount || 0) : 0));

  if (totalMoves < minRealisticMoves) {
    return {
      verified: false,
      error: `Подозрительная активность: уровень ${levelNumber} завершён за ${totalMoves} ходов (минимально требуется от ${minRealisticMoves} ходов)`
    };
  }

  // Realistic completion time check (anti-bot safeguard)
  const durationMs = metadata && metadata.durationMs ? Number(metadata.durationMs) : (session ? Date.now() - session.startedAt : 0);
  if (durationMs > 0) {
    if (durationMs < 2000 || (totalMoves > 0 && durationMs / totalMoves < 40)) {
      return {
        verified: false,
        error: 'Подозрительная активность: нереалистичная скорость переливаний (защита от ботов)'
      };
    }
  }

  const result = {
    verified: true,
    levelNumber,
    movesCount: totalMoves,
    boostersUsed
  };

  // Clean up session
  if (token) {
    sessions.delete(token);
    if (playerActiveSession.get(tid) === token) {
      playerActiveSession.delete(tid);
    }
  }

  return result;
}

/**
 * Ad Watching Verification
 */
function createAdToken(telegramId, rewardType) {
  const tid = String(telegramId);
  const prevToken = playerActiveAdTokens.get(tid);
  if (prevToken) {
    activeAdTokens.delete(prevToken);
  }

  const adToken = crypto.randomBytes(24).toString('hex');
  activeAdTokens.set(adToken, {
    telegramId: tid,
    rewardType: String(rewardType),
    startedAt: Date.now(),
    claimed: false
  });
  playerActiveAdTokens.set(tid, adToken);
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
  const minRequiredMs = isLocalDev ? 1500 : 14000; // 14 seconds minimum for 15s short video
  if (elapsed < minRequiredMs) {
    return {
      valid: false,
      error: `Реклама ещё не досмотрена до конца (прошло ${Math.round(elapsed / 1000)} сек. из необходимых 15 сек.).`
    };
  }

  tokenData.claimed = true;
  activeAdTokens.delete(String(adToken));
  playerActiveAdTokens.delete(String(telegramId));
  return { valid: true };
}

module.exports = {
  startSession,
  applyMove,
  applyBooster,
  verifyLevelCompletion,
  getMinRealisticMoves,
  createAdToken,
  verifyAndClaimAdToken,
  isLevelWon,
  canPour,
  executePour
};
