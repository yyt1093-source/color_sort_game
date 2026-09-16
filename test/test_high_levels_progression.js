const assert = require('assert');
const { LevelGenerator } = require('../public/js/levelGenerator');
const { Solver } = require('../public/js/solver');

console.log('================================================================');
console.log('🧪 Testing Color Sort High Levels Progression (300, 400, 500+)');
console.log('================================================================');

// 1. Monotonicity & progression curve verification
console.log('\n--- Test 1: Monotonicity & Exact Milestone Bottle Counts ---');
let prevJars = 0;
for (let lvl = 1; lvl <= 1000; lvl++) {
  const cfg = LevelGenerator.getLevelConfig(lvl);
  assert(cfg.totalJars >= prevJars, `Monotonicity violated at level ${lvl}: ${cfg.totalJars} < ${prevJars}`);
  assert(cfg.totalJars <= 50, `Cap of 50 jars exceeded at level ${lvl}: got ${cfg.totalJars}`);
  prevJars = cfg.totalJars;
}

const c300 = LevelGenerator.getLevelConfig(300);
console.log(`Level 300: ${c300.totalJars} jars (colors: ${c300.colorCount}, empty: ${c300.emptyJars})`);
assert(c300.totalJars >= 30, `Level 300 must have 30 or more bottles, got ${c300.totalJars}`);

const c400 = LevelGenerator.getLevelConfig(400);
console.log(`Level 400: ${c400.totalJars} jars (colors: ${c400.colorCount}, empty: ${c400.emptyJars})`);
assert(c400.totalJars >= 38 && c400.totalJars <= 42, `Level 400 should have ~40 bottles, got ${c400.totalJars}`);

const c500 = LevelGenerator.getLevelConfig(500);
console.log(`Level 500: ${c500.totalJars} jars (colors: ${c500.colorCount}, empty: ${c500.emptyJars})`);
assert.strictEqual(c500.totalJars, 50, `Level 500 must have exactly 50 bottles, got ${c500.totalJars}`);

const c501 = LevelGenerator.getLevelConfig(501);
const c600 = LevelGenerator.getLevelConfig(600);
const c1000 = LevelGenerator.getLevelConfig(1000);
assert.strictEqual(c501.totalJars, 50, `Level 501 must be capped at 50 bottles, got ${c501.totalJars}`);
assert.strictEqual(c600.totalJars, 50, `Level 600 must be capped at 50 bottles, got ${c600.totalJars}`);
assert.strictEqual(c1000.totalJars, 50, `Level 1000 must be capped at 50 bottles, got ${c1000.totalJars}`);
console.log('✅ [PASS] Milestone counts and 50-bottle cap verified!');

// 2. Test Generation & Solvability for High Levels
console.log('\n--- Test 2: Level Generation & Hints for Levels (300, 400, 500, 750) ---');
const testMilestones = [50, 100, 200, 300, 350, 400, 450, 500, 750];
for (const lvl of testMilestones) {
  const t0 = Date.now();
  const data = LevelGenerator.generateLevel(lvl);
  const duration = Date.now() - t0;

  assert(data && data.bottles, `Level ${lvl} generation failed`);
  assert.strictEqual(data.bottles.length, data.config.totalJars, `Bottle count mismatch for level ${lvl}`);
  assert(data.bottles.length <= 50, `Level ${lvl} bottles must not exceed 50`);

  // Verify all colors are valid
  assert.strictEqual(data.colors.length, data.colorCount, `Colors length mismatch for level ${lvl}`);
  for (const c of data.colors) {
    assert(c && c.hex && c.glow, `Invalid color object in level ${lvl}`);
  }

  // Verify hint generation
  const hint = Solver.getHint(data.bottles, data.capacity);
  assert(hint && typeof hint.from === 'number' && typeof hint.to === 'number', `Hint failed for level ${lvl}`);

  console.log(`  ✅ Level ${lvl}: ${data.bottles.length} jars (${data.colorCount} colors, ${data.config.emptyJars} empty) in ${duration}ms, Hint: #${hint.from} ➔ #${hint.to}`);
}

console.log('\n================================================================');
console.log('🎉 ALL HIGH LEVEL PROGRESSION TESTS PASSED 100%!');
console.log('================================================================\n');
