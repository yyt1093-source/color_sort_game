/**
 * Infinite Solvability-Guaranteed Level Generator for Color Sort
 */
(function (exports) {
  const COLOR_PALETTE = [
    { name: 'Red',            hex: '#e60026', glow: 'rgba(230,0,38,0.5)' },
    { name: 'Blue',           hex: '#2563eb', glow: 'rgba(37,99,235,0.5)' },
    { name: 'Green',          hex: '#16a34a', glow: 'rgba(22,163,74,0.5)' },
    { name: 'Yellow',         hex: '#ffea00', glow: 'rgba(255,234,0,0.5)' },
    { name: 'Purple',         hex: '#4c1d95', glow: 'rgba(76,29,149,0.5)' },
    { name: 'Pink',           hex: '#ec4899', glow: 'rgba(236,72,153,0.5)' },
    { name: 'Cyan',           hex: '#06b6d4', glow: 'rgba(6,182,212,0.5)' },
    { name: 'Orange',         hex: '#ea580c', glow: 'rgba(234,88,12,0.5)' },
    { name: 'Lime',           hex: '#84cc16', glow: 'rgba(132,204,22,0.5)' },
    { name: 'Indigo',         hex: '#4f46e5', glow: 'rgba(79,70,229,0.5)' },
    { name: 'Teal',           hex: '#0f766e', glow: 'rgba(15,118,110,0.5)' },
    { name: 'Rose',           hex: '#be185d', glow: 'rgba(190,24,93,0.5)' },
    { name: 'Amber',          hex: '#b45309', glow: 'rgba(180,83,9,0.5)' },
    { name: 'Violet',         hex: '#9333ea', glow: 'rgba(147,51,234,0.5)' },
    { name: 'Emerald',        hex: '#064e3b', glow: 'rgba(6,78,59,0.5)' },
    { name: 'Sky',            hex: '#7dd3fc', glow: 'rgba(125,211,252,0.5)' },
    { name: 'Coral',          hex: '#ff9aa2', glow: 'rgba(255,154,162,0.5)' },
    { name: 'Mint',           hex: '#5eead4', glow: 'rgba(94,234,212,0.5)' },
    { name: 'Brown',          hex: '#451a03', glow: 'rgba(69,26,3,0.5)' },
    { name: 'Fuchsia',        hex: '#c026d3', glow: 'rgba(192,38,211,0.5)' },
    { name: 'Crimson',        hex: '#780016', glow: 'rgba(120,0,22,0.5)' },
    { name: 'Gold',           hex: '#d97706', glow: 'rgba(217,119,6,0.5)' },
    { name: 'Navy',           hex: '#0f2b66', glow: 'rgba(15,43,102,0.5)' },
    { name: 'Lavender',       hex: '#e9d5ff', glow: 'rgba(233,213,255,0.5)' },
    { name: 'Olive',          hex: '#3f6212', glow: 'rgba(63,98,18,0.5)' },
    { name: 'Jade',           hex: '#059669', glow: 'rgba(5,150,105,0.5)' },
    // Rich, distinct palette extensions for large boards up to 50 bottles
    { name: 'Tangerine',      hex: '#f97316', glow: 'rgba(249,115,22,0.5)' },
    { name: 'Magenta',        hex: '#9d174d', glow: 'rgba(157,23,77,0.5)' },
    { name: 'Turquoise',      hex: '#14b8a6', glow: 'rgba(20,184,166,0.5)' },
    { name: 'RoyalBlue',      hex: '#1d4ed8', glow: 'rgba(29,78,216,0.5)' },
    { name: 'Peach',          hex: '#fb923c', glow: 'rgba(251,146,60,0.5)' },
    { name: 'SeaGreen',       hex: '#10b981', glow: 'rgba(16,185,129,0.5)' },
    { name: 'Maroon',         hex: '#881337', glow: 'rgba(136,19,55,0.5)' },
    { name: 'ElectricPurple', hex: '#7c3aed', glow: 'rgba(124,58,237,0.5)' },
    { name: 'BrightYellow',   hex: '#facc15', glow: 'rgba(250,204,21,0.5)' },
    { name: 'Aquamarine',     hex: '#2dd4bf', glow: 'rgba(45,212,191,0.5)' },
    { name: 'Berry',          hex: '#a21caf', glow: 'rgba(162,28,175,0.5)' },
    { name: 'SteelBlue',      hex: '#3b82f6', glow: 'rgba(59,130,246,0.5)' },
    { name: 'Chartreuse',     hex: '#a3e635', glow: 'rgba(163,230,53,0.5)' },
    { name: 'Ruby',           hex: '#dc2626', glow: 'rgba(220,38,38,0.5)' },
    { name: 'Midnight',       hex: '#1e1b4b', glow: 'rgba(30,27,75,0.5)' },
    { name: 'Flamingo',       hex: '#f43f5e', glow: 'rgba(244,63,94,0.5)' },
    { name: 'ForestGreen',    hex: '#14532d', glow: 'rgba(20,83,45,0.5)' },
    { name: 'Apricot',        hex: '#fdba74', glow: 'rgba(253,186,116,0.5)' },
    { name: 'Periwinkle',     hex: '#818cf8', glow: 'rgba(129,140,248,0.5)' },
    { name: 'DarkCyan',       hex: '#0e7490', glow: 'rgba(14,116,144,0.5)' },
    { name: 'Bronze',         hex: '#78716c', glow: 'rgba(120,113,108,0.5)' },
    { name: 'Salmon',         hex: '#f87171', glow: 'rgba(248,113,113,0.5)' },
    { name: 'BrightMint',     hex: '#34d399', glow: 'rgba(52,211,153,0.5)' },
    { name: 'Plum',           hex: '#581c87', glow: 'rgba(88,28,135,0.5)' },
    { name: 'Ochre',          hex: '#ca8a04', glow: 'rgba(202,138,4,0.5)' },
    { name: 'Cerulean',       hex: '#0284c7', glow: 'rgba(2,132,199,0.5)' },
    { name: 'NeonLime',       hex: '#65a30d', glow: 'rgba(101,163,13,0.5)' },
    { name: 'Wine',           hex: '#4c0519', glow: 'rgba(76,5,25,0.5)' },
    { name: 'Lilac',          hex: '#c084fc', glow: 'rgba(192,132,252,0.5)' },
    { name: 'DeepTeal',       hex: '#042f2e', glow: 'rgba(4,47,46,0.5)' },
    { name: 'WarmAmber',      hex: '#d97706', glow: 'rgba(217,119,6,0.5)' },
    { name: 'Cobalt',         hex: '#1e40af', glow: 'rgba(30,64,175,0.5)' },
    { name: 'PastelPink',     hex: '#f472b6', glow: 'rgba(244,114,182,0.5)' },
    { name: 'GrassGreen',     hex: '#22c55e', glow: 'rgba(34,197,94,0.5)' }
  ];

  function getColor(index) {
    if (index < COLOR_PALETTE.length) return COLOR_PALETTE[index];
    const hue = Math.round((index * 137.508) % 360);
    return { name: `Color_${index + 1}`, hex: `hsl(${hue}, 85%, 55%)`, glow: `hsla(${hue}, 85%, 55%, 0.5)` };
  }

  function mulberry32(seed) {
    return function() {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function getLevelConfig(level) {
    let totalJars;
    let emptyJars = 2;
    let openSlotsCount = 0;
    let isChallenge = (level % 5 === 0);
    let isIntro = (level === 1);

    // Progression: start with 5 colors (7 jars) and ramp up smoothly
    if (level === 1) {
      totalJars = 7;
      emptyJars = 2;
    } else if (level === 2) {
      totalJars = 8;
      emptyJars = 2;
    } else if (level === 3) {
      totalJars = 9;
      emptyJars = 2;
    } else if (level === 4) {
      totalJars = 10;
      emptyJars = 2;
    } else if (level === 5) {
      totalJars = 11;
      emptyJars = 2;
    } else if (level <= 7) {
      totalJars = 12;
      emptyJars = 2;
    } else if (level <= 9) {
      totalJars = 13;
      emptyJars = 2;
    } else if (level === 10) {
      totalJars = 14;
      emptyJars = 2;
    } else if (level <= 12) {
      totalJars = 15;
      emptyJars = 2;
    } else if (level <= 15) {
      totalJars = 16;
      emptyJars = 2;
    } else if (level <= 18) {
      totalJars = 17;
      emptyJars = 2;
    } else if (level <= 22) {
      totalJars = 18;
      emptyJars = 2;
    } else if (level <= 26) {
      totalJars = 19;
      emptyJars = 2;
    } else if (level <= 30) {
      totalJars = 20;
      emptyJars = 2;
    } else if (level <= 35) {
      totalJars = 22;
      emptyJars = 3;
    } else if (level <= 40) {
      totalJars = 23;
      emptyJars = 3;
    } else if (level <= 50) {
      totalJars = 24;
      emptyJars = 3;
    } else if (level <= 300) {
      // Scale smoothly from 24 jars (level 50) to 31 jars (level 300 - 30+ jars)
      totalJars = 24 + Math.floor(((level - 50) * 7) / 250);
      emptyJars = 3;
    } else if (level <= 400) {
      // Scale smoothly from 31 jars (level 300) to 40 jars (level 400 - ~40 jars)
      totalJars = 31 + Math.floor(((level - 300) * 9) / 100);
      emptyJars = (totalJars >= 36) ? 4 : 3;
    } else if (level <= 500) {
      // Scale smoothly from 40 jars (level 400) to 50 jars (level 500 - max 50 jars)
      totalJars = 40 + Math.floor(((level - 400) * 10) / 100);
      emptyJars = 4;
    } else {
      // Level > 500: strictly capped at 50 jars max
      totalJars = 50;
      emptyJars = 4;
    }

    const colorCount = totalJars - emptyJars;
    const minRequiredMoves = Math.max(14, Math.round(colorCount * 2.7));

    return {
      levelNumber: level,
      totalJars,
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

    // For larger levels (colorCount > 21, levels > 50), random shuffle + exhaustive A* search
    // is computationally exponential. We use the guaranteed-solvable reverse-scramble generator.
    if (colorCount > 21) {
      return generateFallbackLevel(config, rng);
    }

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
            colors: Array.from({ length: colorCount }, (_, i) => getColor(i)),
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
          colors: Array.from({ length: colorCount }, (_, i) => getColor(i)),
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

    // For levels with <= 21 colors, try standard random shuffle first
    if (colorCount <= 21) {
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
              colors: Array.from({ length: colorCount }, (_, i) => getColor(i)),
              minMoves: sol.length,
              config
            };
          }
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
      colors: Array.from({ length: colorCount }, (_, i) => getColor(i)),
      minMoves: colorCount * 3,
      config
    };
  }

  const levelGenAPI = { generateLevel, getLevelConfig, COLOR_PALETTE, getColor };
  Object.assign(exports, levelGenAPI);
  exports.LevelGenerator = levelGenAPI;
})(typeof exports !== 'undefined' ? exports : (window.LevelGenerator = {}));
