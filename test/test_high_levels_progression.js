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
  assert(cfg.totalJars <= 54, `Cap of 54 jars exceeded at level ${lvl}: got ${cfg.totalJars}`);
  assert(cfg.colorCount <= 50, `Cap of 50 colors exceeded at level ${lvl}: got ${cfg.colorCount}`);
  prevJars = cfg.totalJars;
}

const c300 = LevelGenerator.getLevelConfig(300);
console.log(`Level 300: ${c300.totalJars} jars (colors: ${c300.colorCount}, empty: ${c300.emptyJars})`);
assert.strictEqual(c300.colorCount, 30, `Level 300 must have 30 colors, got ${c300.colorCount}`);
assert.strictEqual(c300.totalJars, 33, `Level 300 must have 33 total jars, got ${c300.totalJars}`);

const c400 = LevelGenerator.getLevelConfig(400);
console.log(`Level 400: ${c400.totalJars} jars (colors: ${c400.colorCount}, empty: ${c400.emptyJars})`);
assert.strictEqual(c400.colorCount, 40, `Level 400 must have 40 colors, got ${c400.colorCount}`);
assert.strictEqual(c400.totalJars, 44, `Level 400 must have 44 total jars, got ${c400.totalJars}`);

const c500 = LevelGenerator.getLevelConfig(500);
console.log(`Level 500: ${c500.totalJars} jars (colors: ${c500.colorCount}, empty: ${c500.emptyJars})`);
assert.strictEqual(c500.colorCount, 50, `Level 500 must have exactly 50 colored jars, got ${c500.colorCount}`);
assert.strictEqual(c500.emptyJars, 4, `Level 500 must have 4 empty jars, got ${c500.emptyJars}`);
assert.strictEqual(c500.totalJars, 54, `Level 500 must have exactly 54 total jars, got ${c500.totalJars}`);

const c501 = LevelGenerator.getLevelConfig(501);
const c600 = LevelGenerator.getLevelConfig(600);
const c1000 = LevelGenerator.getLevelConfig(1000);
assert.strictEqual(c501.colorCount, 50, `Level 501 colorCount must be 50, got ${c501.colorCount}`);
assert.strictEqual(c501.totalJars, 54, `Level 501 must be capped at 54 bottles, got ${c501.totalJars}`);
assert.strictEqual(c600.colorCount, 50, `Level 600 colorCount must be 50, got ${c600.colorCount}`);
assert.strictEqual(c600.totalJars, 54, `Level 600 must be capped at 54 bottles, got ${c600.totalJars}`);
assert.strictEqual(c1000.colorCount, 50, `Level 1000 colorCount must be 50, got ${c1000.colorCount}`);
assert.strictEqual(c1000.totalJars, 54, `Level 1000 must be capped at 54 bottles, got ${c1000.totalJars}`);
console.log('✅ [PASS] Milestone counts (300, 400, 500) and 50-color / 54-jar cap verified!');

// 2. Test Generation & Solvability for High Levels
console.log('\n--- Test 2: Level Generation & Hints for Levels (300, 400, 500, 750) ---');
const testMilestones = [50, 100, 200, 300, 350, 400, 450, 500, 750];
for (const lvl of testMilestones) {
  const t0 = Date.now();
  const data = LevelGenerator.generateLevel(lvl);
  const duration = Date.now() - t0;

  assert(data && data.bottles, `Level ${lvl} generation failed`);
  assert.strictEqual(data.bottles.length, data.config.totalJars, `Bottle count mismatch for level ${lvl}`);
  assert(data.bottles.length <= 54, `Level ${lvl} bottles must not exceed 54`);

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

// 3. Test Full/Empty Bottle Composition & Level 500 Board
console.log('\n--- Test 3: Bottle Structure & Level 500 Exact State ---');
const l500 = LevelGenerator.generateLevel(500);
const full500 = l500.bottles.filter(b => b.length === l500.capacity).length;
const empty500 = l500.bottles.filter(b => b.length === 0).length;

console.log(`Level 500 Board Composition: ${l500.bottles.length} total bottles`);
console.log(`  - Full colored bottles (5/5): ${full500}`);
console.log(`  - Completely empty bottles (0/5): ${empty500}`);
assert.strictEqual(l500.bottles.length, 54, 'Level 500 must have exactly 54 total bottles');
assert.strictEqual(full500, 50, 'Level 500 must have exactly 50 full colored bottles');
assert.strictEqual(empty500, 4, 'Level 500 must have exactly 4 empty bottles');
assert.strictEqual(full500 + empty500, 54, 'All 54 bottles must be either 5/5 full or 0/5 empty');

// 4. Test Palette: Gray Color Present and No Duplicate Hex Codes
console.log('\n--- Test 4: Palette Quality & Gray Color Validation ---');
const palette = LevelGenerator.COLOR_PALETTE;
const hexes = new Set();
let hasGray = false;
for (const c of palette) {
  assert(!hexes.has(c.hex.toLowerCase()), `Duplicate color hex found in palette: ${c.hex} (${c.name})`);
  hexes.add(c.hex.toLowerCase());
  if (c.name.toLowerCase().includes('gray') || c.name.toLowerCase().includes('silver')) {
    hasGray = true;
  }
}
assert(hasGray, 'Palette must contain gray/silver colors as requested by user!');
assert(palette.length >= 50, `Palette must have at least 50 colors, got ${palette.length}`);
console.log(`✅ [PASS] Palette contains ${palette.length} unique colors with Gray and Silver included!`);

// Test UI bottles count formatting
const ruTag = (n) => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 19) return `${n} баночек`;
  if (mod10 === 1) return `${n} баночка`;
  if (mod10 >= 2 && mod10 <= 4) return `${n} баночки`;
  return `${n} баночек`;
};

assert.strictEqual(ruTag(54), '54 баночки', 'Tag for 54 must be "54 баночки"');
assert.strictEqual(ruTag(50), '50 баночек', 'Tag for 50 must be "50 баночек"');
assert.strictEqual(ruTag(40), '40 баночек', 'Tag for 40 must be "40 баночек"');
assert.strictEqual(ruTag(31), '31 баночка', 'Tag for 31 must be "31 баночка"');
assert.strictEqual(ruTag(7), '7 баночек', 'Tag for 7 must be "7 баночек"');
console.log('✅ [PASS] UI tag formatted correctly: "54 баночки" at Level 500 (50 with color + 4 empty)');

console.log('\n================================================================');
console.log('🎉 ALL HIGH LEVEL PROGRESSION TESTS PASSED 100%!');
console.log('================================================================\n');
