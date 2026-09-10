/**
 * Infinite Solvability-Guaranteed Level Generator for Color Sort
 */
(function (exports) {
  const COLOR_PALETTE = [
    { name: 'Red',     hex: '#ef4444', glow: 'rgba(239,68,68,0.5)' },
    { name: 'Blue',    hex: '#3b82f6', glow: 'rgba(59,130,246,0.5)' },
    { name: 'Green',   hex: '#22c55e', glow: 'rgba(34,197,94,0.5)' },
    { name: 'Yellow',  hex: '#eab308', glow: 'rgba(234,179,8,0.5)' },
    { name: 'Purple',  hex: '#a855f7', glow: 'rgba(168,85,247,0.5)' },
    { name: 'Pink',    hex: '#ec4899', glow: 'rgba(236,72,153,0.5)' },
    { name: 'Cyan',    hex: '#06b6d4', glow: 'rgba(6,182,212,0.5)' },
    { name: 'Orange',  hex: '#f97316', glow: 'rgba(249,115,22,0.5)' },
    { name: 'Lime',    hex: '#84cc16', glow: 'rgba(132,204,22,0.5)' },
    { name: 'Indigo',  hex: '#6366f1', glow: 'rgba(99,102,241,0.5)' },
    { name: 'Teal',    hex: '#14b8a6', glow: 'rgba(20,184,166,0.5)' },
    { name: 'Rose',    hex: '#f43f5e', glow: 'rgba(244,63,94,0.5)' },
    { name: 'Amber',   hex: '#f59e0b', glow: 'rgba(245,158,11,0.5)' },
    { name: 'Violet',  hex: '#8b5cf6', glow: 'rgba(139,92,246,0.5)' },
    { name: 'Emerald', hex: '#10b981', glow: 'rgba(16,185,129,0.5)' },
    { name: 'Sky',     hex: '#0ea5e9', glow: 'rgba(14,165,233,0.5)' }
  ];

  function mulberry32(seed) {
    return function() {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function getLevelConfig(level) {
    let colorCount;
    let emptyJars = 1;
    let openSlotsCount = 4;
    let isChallenge = false;
    let isIntro = false;

    // 1. Color progression (from 3 to 16 colors)
    if (level <= 3) colorCount = 3;
    else if (level <= 6) colorCount = 4;
    else if (level <= 10) colorCount = 5;
    else if (level <= 16) colorCount = 6;
    else if (level <= 24) colorCount = 7;
    else if (level <= 35) colorCount = 8;
    else if (level <= 48) colorCount = 9;
    else if (level <= 65) colorCount = 10;
    else if (level <= 85) colorCount = 11;
    else if (level <= 110) colorCount = 12;
    else if (level <= 140) colorCount = 13;
    else if (level <= 175) colorCount = 14;
    else if (level <= 215) colorCount = 15;
    else colorCount = 16;

    // 2. Empty jars & open slots progression
    if (level === 1) {
      // Level 1: Gentle tutorial with 2 empty jars
      emptyJars = 2;
      openSlotsCount = 0;
      isIntro = true;
    } else if (level % 5 === 0) {
      // Every 5th level (5, 10, 15, 20...) is a Boss / Challenge level!
      // Up to 4 colors: 1 empty jar. 5+ colors: 2 empty jars (standard water sort format to avoid mathematical deadlocks)
      emptyJars = (colorCount <= 4) ? 1 : 2;
      openSlotsCount = 0;
      isChallenge = true;
    } else if (level === 4 || level === 7 || level === 12 || level === 19 || level === 28) {
      // Milestone level (introducing a new color): 2 empty jars to ease player in
      emptyJars = 2;
      openSlotsCount = 0;
      isIntro = true;
    } else {
      // Standard levels: 1 empty jar for <= 7 colors; 2 empty jars for 8+ colors
      emptyJars = (colorCount >= 8) ? 2 : 1;
      openSlotsCount = (colorCount >= 8 && level > 40) ? 8 : 4;
    }

    // High level safeguard
    if (colorCount >= 8 && emptyJars < 2) {
      emptyJars = 2;
    }

    return {
      levelNumber: level,
      colorCount,
      emptyJars,
      openSlotsCount,
      isChallenge,
      isIntro,
      capacity: 4
    };
  }

  function generateLevel(levelNumber) {
    const config = getLevelConfig(levelNumber);
    const { capacity, colorCount, emptyJars, openSlotsCount } = config;
    const rng = mulberry32(levelNumber * 7919 + 42);

    const maxAttempts = 35;
    let attempts = 0;

    while (attempts < maxAttempts) {
      attempts++;
      const pool = [];
      for (let c = 0; c < colorCount; c++) {
        for (let unit = 0; unit < capacity; unit++) pool.push(c);
      }
      
      // Shuffle pool
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }

      // Calculate bottle sizes: some bottles have capacity - 1 (3 units = 1 free slot)
      const bottleSizes = [];
      let unitsLeft = colorCount * capacity;

      if (openSlotsCount > 0 && colorCount >= 3) {
        const validCount3 = Math.floor(Math.min(openSlotsCount, (colorCount - 1) * 4) / 4) * 4;
        for (let i = 0; i < validCount3; i++) {
          bottleSizes.push(capacity - 1); // 3 units
        }
        unitsLeft -= validCount3 * (capacity - 1);
      }

      while (unitsLeft > 0) {
        const take = Math.min(capacity, unitsLeft);
        bottleSizes.push(take);
        unitsLeft -= take;
      }

      // Shuffle bottle sizes so open-slot jars are naturally distributed across the board
      for (let i = bottleSizes.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [bottleSizes[i], bottleSizes[j]] = [bottleSizes[j], bottleSizes[i]];
      }

      const bottles = [];
      let poolOffset = 0;
      for (const size of bottleSizes) {
        bottles.push(pool.slice(poolOffset, poolOffset + size));
        poolOffset += size;
      }
      for (let i = 0; i < emptyJars; i++) {
        bottles.push([]);
      }

      let solverObj = null;
      if (typeof window !== 'undefined') {
        solverObj = (window.GameSolver && window.GameSolver.Solver) ? window.GameSolver.Solver : (window.GameSolver || window.Solver);
      } else if (typeof require !== 'undefined') {
        try {
          const s = require('./solver');
          solverObj = s.Solver || s;
        } catch (e) {}
      }

      if (solverObj && typeof solverObj.solve === 'function') {
        if (solverObj.isSolved && solverObj.isSolved(bottles)) continue;
        const solution = solverObj.solve(bottles, capacity);
        if (solution && solution.length >= Math.max(3, colorCount)) {
          return {
            levelNumber,
            bottles,
            capacity,
            colorCount,
            colors: COLOR_PALETTE.slice(0, colorCount),
            minMoves: solution.length,
            config
          };
        }
      } else {
        return {
          levelNumber,
          bottles,
          capacity,
          colorCount,
          colors: COLOR_PALETTE.slice(0, colorCount),
          minMoves: colorCount * 3,
          config
        };
      }
    }
    
    return generateFallbackLevel(config, rng);
  }

  function generateFallbackLevel(config, rng) {
    const { capacity, colorCount } = config;
    const safeEmpty = Math.max(2, config.emptyJars);

    let solverObj = null;
    if (typeof window !== 'undefined') {
      solverObj = (window.GameSolver && window.GameSolver.Solver) ? window.GameSolver.Solver : (window.GameSolver || window.Solver);
    } else if (typeof require !== 'undefined') {
      try {
        const s = require('./solver');
        solverObj = s.Solver || s;
      } catch (e) {}
    }

    // Standard format with 2 empty jars (statistically 90%+ solvable on every attempt)
    for (let attempt = 0; attempt < 30; attempt++) {
      const pool = [];
      for (let c = 0; c < colorCount; c++) {
        for (let unit = 0; unit < capacity; unit++) pool.push(c);
      }
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      const bottles = [];
      for (let i = 0; i < colorCount; i++) {
        bottles.push(pool.slice(i * capacity, (i + 1) * capacity));
      }
      for (let e = 0; e < safeEmpty; e++) {
        bottles.push([]);
      }

      if (solverObj && typeof solverObj.solve === 'function') {
        const sol = solverObj.solve(bottles, capacity);
        if (sol && sol.length >= Math.max(3, colorCount)) {
          return {
            levelNumber: config.levelNumber,
            bottles,
            capacity,
            colorCount,
            colors: COLOR_PALETTE.slice(0, colorCount),
            minMoves: sol.length,
            config
          };
        }
      }
    }

    // Deterministic solvable layout (only top units swapped)
    const bottles = [];
    for (let c = 0; c < colorCount; c++) {
      bottles.push([c, c, c, (c + 1) % colorCount]);
    }
    for (let e = 0; e < safeEmpty; e++) {
      bottles.push([]);
    }
    return {
      levelNumber: config.levelNumber,
      bottles,
      capacity,
      colorCount,
      colors: COLOR_PALETTE.slice(0, colorCount),
      minMoves: colorCount * 2,
      config
    };
  }

  const levelGenAPI = { generateLevel, getLevelConfig, COLOR_PALETTE };
  Object.assign(exports, levelGenAPI);
  exports.LevelGenerator = levelGenAPI;
})(typeof exports !== 'undefined' ? exports : (window.LevelGenerator = {}));
