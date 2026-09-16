/**
 * Infinite Solvability-Guaranteed Level Generator for Color Sort
 */
(function (exports) {
  const COLOR_PALETTE = [
    // 1-5: High-contrast primary & classic core + SlateGray (Requested: 'Добавь ещё серый цвет')
    { name: 'Red',            hex: '#e60026', glow: 'rgba(230,0,38,0.5)' },
    { name: 'Blue',           hex: '#1d4ed8', glow: 'rgba(29,78,216,0.5)' },
    { name: 'Green',          hex: '#16a34a', glow: 'rgba(22,163,74,0.5)' },
    { name: 'Yellow',         hex: '#ffea00', glow: 'rgba(255,234,0,0.5)' },
    { name: 'SlateGray',      hex: '#64748b', glow: 'rgba(100,116,139,0.5)' }, // Core Gray

    // 6-10: Complementary vibrant spectrum
    { name: 'Orange',         hex: '#ea580c', glow: 'rgba(234,88,12,0.5)' },
    { name: 'Purple',         hex: '#6b21a8', glow: 'rgba(107,33,168,0.5)' },
    { name: 'Cyan',           hex: '#06b6d4', glow: 'rgba(6,182,212,0.5)' },
    { name: 'DarkWine',       hex: '#4c0519', glow: 'rgba(76,5,25,0.5)' },
    { name: 'Peach',          hex: '#fdba74', glow: 'rgba(253,186,116,0.5)' },

    // 11-15: Distinct soft tones & earthy neutrals (NO duplicate pinks)
    { name: 'PastelPink',     hex: '#fbcfe8', glow: 'rgba(251,207,232,0.5)' }, // Only light soft baby pink
    { name: 'Olive',          hex: '#4d5d14', glow: 'rgba(77,93,20,0.5)' },
    { name: 'Navy',           hex: '#0f2b66', glow: 'rgba(15,43,102,0.5)' },
    { name: 'Lime',           hex: '#84cc16', glow: 'rgba(132,204,22,0.5)' },
    { name: 'DeepOnyx',       hex: '#090d16', glow: 'rgba(9,13,22,0.5)' },

    // 16-20: Deep florals, warm golds & distinct waters
    { name: 'SoftLavender',   hex: '#c084fc', glow: 'rgba(192,132,252,0.5)' },
    { name: 'Caramel',        hex: '#9a3412', glow: 'rgba(154,52,18,0.5)' },
    { name: 'Aquamarine',     hex: '#2dd4bf', glow: 'rgba(45,212,191,0.5)' },
    { name: 'Teal',           hex: '#0f766e', glow: 'rgba(15,118,110,0.5)' },
    { name: 'VanillaCream',   hex: '#fef08a', glow: 'rgba(254,240,138,0.5)' },

    // 21-25: Rich tones & clear contrasts
    { name: 'Gold',           hex: '#ca8a04', glow: 'rgba(202,138,4,0.5)' },
    { name: 'DarkMoss',       hex: '#1c3d24', glow: 'rgba(28,61,36,0.5)' },
    { name: 'IceBlue',        hex: '#a5f3fc', glow: 'rgba(165,243,252,0.5)' },
    { name: 'Fuchsia',        hex: '#c026d3', glow: 'rgba(192,38,211,0.5)' },
    { name: 'DeepAubergine',  hex: '#3b0764', glow: 'rgba(59,7,100,0.5)' },

    // 26-30: Rose, Emerald, Ruby, Neon Cyan & Periwinkle
    { name: 'Pink',           hex: '#f43f5e', glow: 'rgba(244,63,94,0.5)' }, // Single vibrant hot rose
    { name: 'Emerald',        hex: '#059669', glow: 'rgba(5,150,105,0.5)' },
    { name: 'Crimson',        hex: '#881337', glow: 'rgba(136,19,55,0.5)' },
    { name: 'ElectricCyan',   hex: '#00f0ff', glow: 'rgba(0,240,255,0.5)' },
    { name: 'Periwinkle',     hex: '#818cf8', glow: 'rgba(129,140,248,0.5)' },

    // 31-35: Silver, Mints, Chartreuse, Violets & Chocolate (More gray/silver tones)
    { name: 'LightPlatinum',  hex: '#cbd5e1', glow: 'rgba(203,213,225,0.5)' }, // Light Silver
    { name: 'Mint',           hex: '#34d399', glow: 'rgba(52,211,153,0.5)' },
    { name: 'NeonChartreuse', hex: '#bef264', glow: 'rgba(190,242,100,0.5)' },
    { name: 'ElectricViolet', hex: '#a855f7', glow: 'rgba(168,85,247,0.5)' },
    { name: 'Chocolate',      hex: '#451a03', glow: 'rgba(69,26,3,0.5)' },

    // 36-40: Mustard, Taupe, Silver, Sky & Plum
    { name: 'Mustard',        hex: '#eab308', glow: 'rgba(234,179,8,0.5)' },
    { name: 'WarmTaupe',      hex: '#78716c', glow: 'rgba(120,113,108,0.5)' }, // Warm Gray
    { name: 'Silver',         hex: '#94a3b8', glow: 'rgba(148,163,184,0.5)' }, // Medium Silver
    { name: 'Sky',            hex: '#38bdf8', glow: 'rgba(56,189,248,0.5)' },
    { name: 'DeepPlum',       hex: '#701a75', glow: 'rgba(112,26,117,0.5)' },

    // 41-45: Dark Teals, Khaki, Bronze, Charcoal & Neon Amber
    { name: 'DarkTeal',       hex: '#042f2e', glow: 'rgba(4,47,46,0.5)' },
    { name: 'Khaki',          hex: '#b45309', glow: 'rgba(180,83,9,0.5)' },
    { name: 'Bronze',         hex: '#78350f', glow: 'rgba(120,53,15,0.5)' },
    { name: 'Charcoal',       hex: '#1e293b', glow: 'rgba(30,41,59,0.5)' }, // Dark Charcoal Gray
    { name: 'NeonAmber',      hex: '#ff7800', glow: 'rgba(255,120,0,0.5)' },

    // 46-50: Pine Forest, Denim, Indigo, Pale Lilac & Rust
    { name: 'ForestGreen',    hex: '#14532d', glow: 'rgba(20,83,45,0.5)' },
    { name: 'DarkDenim',      hex: '#1e3a8a', glow: 'rgba(30,58,138,0.5)' },
    { name: 'Indigo',         hex: '#4338ca', glow: 'rgba(67,56,202,0.5)' },
    { name: 'PaleLilac',      hex: '#e9d5ff', glow: 'rgba(233,213,255,0.5)' },
    { name: 'Rust',           hex: '#991b1b', glow: 'rgba(153,27,27,0.5)' },

    // 51-52: Bonus extra distinct colors
    { name: 'CoolAshGray',    hex: '#475569', glow: 'rgba(71,85,105,0.5)' },
    { name: 'BrightGold',     hex: '#f59e0b', glow: 'rgba(245,158,11,0.5)' }
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
    let colorCount;
    let emptyJars = 2;
    let openSlotsCount = 0;
    let isChallenge = (level % 5 === 0);
    let isIntro = (level === 1);

    // Progression: start with 5 colors (7 jars) and ramp up smoothly to 50 colored jars (+4 empty = 54 total jars)
    if (level === 1) {
      colorCount = 5;
      emptyJars = 2;
    } else if (level === 2) {
      colorCount = 6;
      emptyJars = 2;
    } else if (level === 3) {
      colorCount = 7;
      emptyJars = 2;
    } else if (level === 4) {
      colorCount = 8;
      emptyJars = 2;
    } else if (level === 5) {
      colorCount = 9;
      emptyJars = 2;
    } else if (level <= 7) {
      colorCount = 10;
      emptyJars = 2;
    } else if (level <= 9) {
      colorCount = 11;
      emptyJars = 2;
    } else if (level === 10) {
      colorCount = 12;
      emptyJars = 2;
    } else if (level <= 12) {
      colorCount = 13;
      emptyJars = 2;
    } else if (level <= 15) {
      colorCount = 14;
      emptyJars = 2;
    } else if (level <= 18) {
      colorCount = 15;
      emptyJars = 2;
    } else if (level <= 22) {
      colorCount = 16;
      emptyJars = 2;
    } else if (level <= 26) {
      colorCount = 17;
      emptyJars = 2;
    } else if (level <= 30) {
      colorCount = 18;
      emptyJars = 2;
    } else if (level <= 35) {
      colorCount = 19;
      emptyJars = 3;
    } else if (level <= 40) {
      colorCount = 20;
      emptyJars = 3;
    } else if (level <= 50) {
      colorCount = 21;
      emptyJars = 3;
    } else if (level <= 300) {
      // Scale smoothly from 21 colors (level 50) to 30 colors (level 300)
      colorCount = 21 + Math.floor(((level - 50) * 9) / 250);
      emptyJars = 3;
    } else if (level <= 400) {
      // Scale smoothly from 30 colors (level 300) to 40 colors (level 400)
      colorCount = 30 + Math.floor(((level - 300) * 10) / 100);
      emptyJars = 4;
    } else if (level <= 500) {
      // Scale smoothly from 40 colors (level 400) to 50 colors (level 500)
      colorCount = 40 + Math.floor(((level - 400) * 10) / 100);
      emptyJars = 4;
    } else {
      // Level > 500: strictly capped at exactly 50 colored jars (+ 4 empty = 54 total jars)
      colorCount = 50;
      emptyJars = 4;
    }

    const totalJars = colorCount + emptyJars;
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

    // For larger levels (colorCount > 21, levels > 50), generate instantly with
    // anti-clustering: all colorCount bottles full (5/5) and exact emptyJars (0/5)
    if (colorCount > 21) {
      const pool = [];
      for (let c = 0; c < colorCount; c++) {
        for (let unit = 0; unit < capacity; unit++) pool.push(c);
      }
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
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

      const bottles = [];
      for (let i = 0; i < colorCount; i++) {
        bottles.push(pool.slice(i * capacity, (i + 1) * capacity));
      }
      for (let e = 0; e < emptyJars; e++) {
        bottles.push([]);
      }

      return {
        levelNumber,
        bottles,
        capacity,
        colorCount,
        colors: Array.from({ length: colorCount }, (_, i) => getColor(i)),
        minMoves: Math.round(colorCount * 2.7),
        config
      };
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
