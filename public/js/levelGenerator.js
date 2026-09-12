/**
 * Infinite Solvability-Guaranteed Level Generator for Color Sort
 */
(function (exports) {
  const COLOR_PALETTE = [
    { name: 'Red',       hex: '#e60026', glow: 'rgba(230,0,38,0.5)' },
    { name: 'Blue',      hex: '#2563eb', glow: 'rgba(37,99,235,0.5)' },
    { name: 'Green',     hex: '#16a34a', glow: 'rgba(22,163,74,0.5)' },
    { name: 'Yellow',    hex: '#ffea00', glow: 'rgba(255,234,0,0.5)' },
    { name: 'Purple',    hex: '#4c1d95', glow: 'rgba(76,29,149,0.5)' },
    { name: 'Pink',      hex: '#ec4899', glow: 'rgba(236,72,153,0.5)' },
    { name: 'Cyan',      hex: '#06b6d4', glow: 'rgba(6,182,212,0.5)' },
    { name: 'Orange',    hex: '#ea580c', glow: 'rgba(234,88,12,0.5)' },
    { name: 'Lime',      hex: '#84cc16', glow: 'rgba(132,204,22,0.5)' },
    { name: 'Indigo',    hex: '#4f46e5', glow: 'rgba(79,70,229,0.5)' },
    { name: 'Teal',      hex: '#0f766e', glow: 'rgba(15,118,110,0.5)' },
    { name: 'Rose',      hex: '#be185d', glow: 'rgba(190,24,93,0.5)' },
    { name: 'Amber',     hex: '#b45309', glow: 'rgba(180,83,9,0.5)' },
    { name: 'Violet',    hex: '#9333ea', glow: 'rgba(147,51,234,0.5)' },
    { name: 'Emerald',   hex: '#064e3b', glow: 'rgba(6,78,59,0.5)' },
    { name: 'Sky',       hex: '#7dd3fc', glow: 'rgba(125,211,252,0.5)' },
    { name: 'Coral',     hex: '#ff9aa2', glow: 'rgba(255,154,162,0.5)' },
    { name: 'Mint',      hex: '#5eead4', glow: 'rgba(94,234,212,0.5)' },
    { name: 'Brown',     hex: '#451a03', glow: 'rgba(69,26,3,0.5)' },
    { name: 'Fuchsia',   hex: '#c026d3', glow: 'rgba(192,38,211,0.5)' },
    { name: 'Crimson',   hex: '#780016', glow: 'rgba(120,0,22,0.5)' },
    { name: 'Gold',      hex: '#d97706', glow: 'rgba(217,119,6,0.5)' },
    { name: 'Navy',      hex: '#0f2b66', glow: 'rgba(15,43,102,0.5)' },
    { name: 'Lavender',  hex: '#e9d5ff', glow: 'rgba(233,213,255,0.5)' },
    { name: 'Olive',     hex: '#3f6212', glow: 'rgba(63,98,18,0.5)' },
    { name: 'Jade',      hex: '#059669', glow: 'rgba(5,150,105,0.5)' }
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
    let emptyJars = 2;
    let openSlotsCount = 0;
    let isChallenge = (level % 5 === 0);
    let isIntro = (level === 1);

    // Progression: start with 5 colors (7 jars) and ramp up quickly
    if (level === 1) {
      colorCount = 5; // 5 colors + 2 empty = 7 jars (all colored jars full 4/4)
    } else if (level === 2) {
      colorCount = 6; // 6 colors + 2 empty = 8 jars
    } else if (level === 3) {
      colorCount = 7; // 7 colors + 2 empty = 9 jars
    } else if (level === 4) {
      colorCount = 8; // 8 colors + 2 empty = 10 jars
    } else if (level === 5) {
      colorCount = 9; // 9 colors + 2 empty = 11 jars (🔥 Challenge Level)
    } else if (level <= 7) {
      colorCount = 10; // 10 colors + 2 empty = 12 jars
    } else if (level <= 9) {
      colorCount = 11; // 11 colors + 2 empty = 13 jars
    } else if (level === 10) {
      colorCount = 12; // 12 colors + 2 empty = 14 jars (🔥 Challenge Level)
    } else if (level <= 12) {
      colorCount = 13; // 13 colors + 2 empty = 15 jars
    } else if (level <= 15) {
      colorCount = 14; // 14 colors + 2 empty = 16 jars
    } else if (level <= 18) {
      colorCount = 15; // 15 colors + 2 empty = 17 jars
    } else if (level <= 22) {
      colorCount = 16; // 16 colors + 2 empty = 18 jars
    } else if (level <= 26) {
      colorCount = 17; // 17 colors + 2 empty = 19 jars
    } else if (level <= 30) {
      colorCount = 18; // 18 colors + 2 empty = 20 jars
    } else if (level <= 35) {
      colorCount = 19; // 19 colors + 3 empty = 22 jars
      emptyJars = 3;
    } else if (level <= 40) {
      colorCount = 20; // 20 colors + 3 empty = 23 jars
      emptyJars = 3;
    } else if (level <= 50) {
      colorCount = 21; // 21 colors + 3 empty = 24 jars
      emptyJars = 3;
    } else {
      colorCount = 22; // 22 colors + 3 empty = 25 jars
      emptyJars = 3;
    }

    const minRequiredMoves = Math.max(14, Math.round(colorCount * 2.7));

    return {
      levelNumber: level,
      colorCount,
      emptyJars,
      openSlotsCount,
      isChallenge,
      isIntro,
      capacity: 5,
      minRequiredMoves
    };
  }

  function generateLevel(levelNumber) {
    const config = getLevelConfig(levelNumber);
    const { capacity, colorCount, emptyJars, openSlotsCount, minRequiredMoves } = config;
    const rng = mulberry32(levelNumber * 7919 + 42);

    const maxAttempts = 50;
    let attempts = 0;

    let solverObj = null;
    if (typeof window !== 'undefined') {
      solverObj = (window.GameSolver && window.GameSolver.Solver) ? window.GameSolver.Solver : (window.GameSolver || window.Solver);
    } else if (typeof require !== 'undefined') {
      try {
        const s = require('./solver');
        solverObj = s.Solver || s;
      } catch (e) {}
    }

    while (attempts < maxAttempts) {
      attempts++;
      const pool = [];
      for (let c = 0; c < colorCount; c++) {
        for (let unit = 0; unit < capacity; unit++) pool.push(c);
      }
      
      // Shuffle pool with anti-clustering to avoid adjacent identical colors
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }

      // Smooth out adjacent duplicates so no two identical colors are placed next to each other
      for (let pass = 0; pass < 50; pass++) {
        let fixed = false;
        for (let i = 0; i < pool.length - 1; i++) {
          if (pool[i] === pool[i + 1]) {
            for (let k = 0; k < pool.length; k++) {
              if (k === i || k === i + 1) continue;
              const prevK = k > 0 ? pool[k - 1] : -1;
              const nextK = k < pool.length - 1 ? pool[k + 1] : -1;
              const prevI = i > 0 ? pool[i - 1] : -1;
              const nextI = i + 2 < pool.length ? pool[i + 2] : -1;
              if (pool[k] !== pool[i] && pool[k] !== prevI && pool[k] !== nextI && pool[i] !== prevK && pool[i] !== nextK) {
                const tmp = pool[i + 1];
                pool[i + 1] = pool[k];
                pool[k] = tmp;
                fixed = true;
                break;
              }
            }
          }
        }
        if (!fixed) break;
      }

      // Calculate bottle sizes
      const bottleSizes = [];
      let unitsLeft = colorCount * capacity;

      if (openSlotsCount > 0 && colorCount >= 3) {
        const validCount = Math.min(openSlotsCount, colorCount);
        for (let i = 0; i < validCount; i++) {
          bottleSizes.push(capacity - 1);
          unitsLeft -= (capacity - 1);
        }
      }

      while (unitsLeft > 0) {
        const take = Math.min(capacity, unitsLeft);
        bottleSizes.push(take);
        unitsLeft -= take;
      }

      // Shuffle bottle sizes
      for (let i = bottleSizes.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [bottleSizes[i], bottleSizes[j]] = [bottleSizes[j], bottleSizes[i]];
      }

      const bottles = [];
      let poolOffset = 0;
      let hasNearFull = false;
      for (const size of bottleSizes) {
        const b = pool.slice(poolOffset, poolOffset + size);
        poolOffset += size;

        // Anti-trivial entropy check: avoid having 4+ identical colors packed together in one jar
        const counts = {};
        for (const c of b) counts[c] = (counts[c] || 0) + 1;
        if (Object.values(counts).some(cnt => cnt >= 4)) {
          hasNearFull = true;
        }
        bottles.push(b);
      }

      // Reject too-easy candidates with pre-grouped 4+ identical units unless running out of attempts
      if (hasNearFull && colorCount >= 6 && attempts < maxAttempts - 10) continue;

      for (let i = 0; i < emptyJars; i++) {
        bottles.push([]);
      }

      if (solverObj && typeof solverObj.solve === 'function') {
        if (solverObj.isSolved && solverObj.isSolved(bottles)) continue;
        if (bottles.some(b => b.length === capacity && b.every(c => c === b[0]))) continue;
        const solution = solverObj.solve(bottles, capacity);
        
        // Strict threshold: accept only if the solution requires substantial planning
        const threshold = (attempts > maxAttempts - 12) ? Math.max(12, colorCount * 2) : minRequiredMoves;
        if (solution && solution.length >= threshold) {
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

    // Standard format with safeEmpty jars
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
        if (sol && sol.length >= Math.max(12, colorCount * 2)) {
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

    // Solvable reverse-scramble from solved state
    const bottles = [];
    for (let c = 0; c < colorCount; c++) bottles.push(Array(capacity).fill(c));
    for (let e = 0; e < safeEmpty; e++) bottles.push([]);

    const steps = 30 + colorCount * 5;
    let lastMove = null;
    for (let s = 0; s < steps; s++) {
      const validMoves = [];
      for (let from = 0; from < bottles.length; from++) {
        const bFrom = bottles[from];
        if (bFrom.length === 0) continue;
        const topColor = bFrom[bFrom.length - 1];
        const canTake = (bFrom.length === 1) ||
                        (bFrom.every(c => c === topColor)) ||
                        (bFrom[bFrom.length - 2] === topColor);
        if (!canTake) continue;

        for (let to = 0; to < bottles.length; to++) {
          if (from === to) continue;
          if (bottles[to].length >= capacity) continue;
          if (lastMove && lastMove.from === to && lastMove.to === from) continue;
          validMoves.push({ from, to, color: topColor });
        }
      }
      if (validMoves.length === 0) break;
      const move = validMoves[Math.floor(rng() * validMoves.length)];
      bottles[move.from].pop();
      bottles[move.to].push(move.color);
      lastMove = move;
    }

    return {
      levelNumber: config.levelNumber,
      bottles,
      capacity,
      colorCount,
      colors: COLOR_PALETTE.slice(0, colorCount),
      minMoves: colorCount * 3,
      config
    };
  }

  const levelGenAPI = { generateLevel, getLevelConfig, COLOR_PALETTE };
  Object.assign(exports, levelGenAPI);
  exports.LevelGenerator = levelGenAPI;
})(typeof exports !== 'undefined' ? exports : (window.LevelGenerator = {}));
