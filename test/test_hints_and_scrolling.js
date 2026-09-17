const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('================================================================');
console.log('🧪 Testing Revealing Hints & Multi-row Scrolling / Layout');
console.log('================================================================');

// 1. Load GameEngine and Solver
const { Solver } = require('../public/js/solver');
const { GameEngine } = require('../public/js/gameEngine');

// ----------------------------------------------------------------------
// TEST 1: Hint ONLY suggests moves that uncover hidden cell ('?')
// ----------------------------------------------------------------------
console.log('\n--- Test 1: Revealing Hint Logic Verification ---');

const engine = new GameEngine();

engine.capacity = 5;
// Case A: Bottle 0 has [0, 1, 1] with count of 1s = 2.
// Bottle 1 has [1, 1, 1, 1] (only room for 1 unit).
// Bottle 2 has [3, 3, 3, 3, 3] (full, cannot pour).
// The only legal move is Bottle 0 -> Bottle 1, moving 1 unit.
// Remaining in Bottle 0: [0, 1]. Top is 1, which was ALREADY revealed!
// Hidden index 0 is NOT exposed.
// Therefore, getHint() MUST return null!
engine.bottles = [
  [0, 1, 1],
  [1, 1, 1, 1],
  [3, 3, 3, 3, 3]
];
engine.revealed = [
  [false, true, true],
  [true, true, true, true],
  [true, true, true, true, true]
];

let hint = engine.getHint();
assert.strictEqual(hint, null, 'Hint must be null because pouring 1 unit does not uncover the hidden cell!');
console.log('✅ Passed: Move that transfers paint without uncovering a hidden cell is correctly REJECTED.');

// Case B: Now add an empty bottle so all 2 units of color 1 can be transferred from Bottle 0!
engine.bottles.push([]);
engine.revealed.push([]);
// Now Bottle 0 -> Bottle 3 (empty):
// Bottle 3 can take up to 5 units. Count of top color 1 is 2.
// amount = 2.
// After pouring 2 units, Bottle 0 has [0] remaining.
// The new top layer in Bottle 0 is index 0.
// Is revealed[0][0] === false? YES!
// This move uncovers the hidden cell at index 0!
hint = engine.getHint();
assert(hint !== null, 'Hint must be found when a move uncovers a hidden cell!');
assert.strictEqual(hint.from, 0, 'Hint source must be bottle 0');
assert.strictEqual(hint.to, 3, 'Hint destination must be empty bottle 3');
console.log(`✅ Passed: Hint correctly identifies move #0 ➔ #${hint.to} which uncovers hidden cell (amount: ${hint.amount})!`);

// Case C: When all hidden cells are already revealed (hasHiddenColors === false)
engine.revealAllColors();
assert.strictEqual(engine.hasHiddenColors(), false, 'hasHiddenColors must be false after revealAllColors()');
hint = engine.getHint();
assert.strictEqual(hint, null, 'Hint must be null when all colors are already revealed on the board!');
console.log('✅ Passed: Hint returns null when all colors on the board are already revealed.');

// ----------------------------------------------------------------------
// TEST 2: Multiple candidate moves prioritize best move
// ----------------------------------------------------------------------
console.log('\n--- Test 2: Priority Ranking for Revealing Hints ---');
const priorityEngine = new GameEngine();
priorityEngine.capacity = 5;
priorityEngine.bottles = [
  [9, 1],
  [1, 1, 1, 1],
  [8, 3],
  [3]
];
priorityEngine.revealed = [
  [false, true],
  [true, true, true, true],
  [false, true],
  [true]
];

const bestHint = priorityEngine.getHint();
assert(bestHint !== null, 'Best hint must be found');
assert.strictEqual(bestHint.from, 0, 'Must choose bottle 0 because it completes bottle 1!');
assert.strictEqual(bestHint.to, 1, 'Must pour to bottle 1 to complete it!');
assert.strictEqual(bestHint.completes, true, 'completes must be true');
console.log(`✅ Passed: Revealing hint prioritizes completing bottle: #0 ➔ #1 (completes: true)`);

// ----------------------------------------------------------------------
// TEST 3: CSS & Layout for Multi-row Scrolling (5, 6, 7 rows)
// ----------------------------------------------------------------------
console.log('\n--- Test 3: CSS Layout & Scrolling Rules ---');
const cssContent = fs.readFileSync(path.join(__dirname, '../public/style.css'), 'utf8');

assert(cssContent.includes('.game-board-wrapper'), 'style.css must have .game-board-wrapper');
assert(cssContent.includes('overflow-y: auto'), 'game-board-wrapper must have overflow-y: auto');
assert(cssContent.includes('padding: 20px 8px 24px 8px'), 'game-board-wrapper must have 20px top padding to stop before info bar');
assert(cssContent.includes('min-height: 0'), 'game-board-wrapper must have min-height: 0 for proper flex shrink');
assert(cssContent.includes('margin: auto 0'), '.game-board must have margin: auto 0 to collapse negative overflow');
assert(cssContent.includes('align-content: flex-start'), 'game-board must align rows from flex-start');
assert(cssContent.includes('.game-board-wrapper::-webkit-scrollbar'), 'Custom scrollbar must be styled for .game-board-wrapper');
assert(cssContent.includes('.game-board-wrapper::-webkit-scrollbar-thumb'), 'Scrollbar thumb must be styled');

console.log('✅ Passed: style.css contains all required layout, spacing (20px) and scrollbar rules.');

// ----------------------------------------------------------------------
// TEST 4: Row 6 to Row 7 Addition on Level 500+ Board
// ----------------------------------------------------------------------
console.log('\n--- Test 4: Level 500+ Board Structure (54 bottles) & Adding Row 7 ---');
const { LevelGenerator } = require('../public/js/levelGenerator');
const level500Data = LevelGenerator.generateLevel(500);

assert.strictEqual(level500Data.bottles.length, 54, 'Level 500 must start with 54 bottles');
const lvlEngine = new GameEngine();
lvlEngine.startLevel(level500Data);

assert.strictEqual(lvlEngine.bottles.length, 54, 'Engine must have 54 bottles');

for (let i = 55; i <= 60; i++) {
  const added = lvlEngine.addExtraBottle();
  assert.strictEqual(added, true, `Must successfully add bottle #${i}`);
  assert.strictEqual(lvlEngine.bottles.length, i, `Bottle count must be ${i}`);
}
console.log(`✅ Filled Row 6: Now at exactly 60 bottles (6 full rows of 10)!`);

const added61 = lvlEngine.addExtraBottle();
assert.strictEqual(added61, true, 'Must successfully add bottle #61');
assert.strictEqual(lvlEngine.bottles.length, 61, 'Bottle count must be 61 (starts row 7)');
assert.strictEqual(lvlEngine.revealed.length, 61, 'Revealed matrix length must be 61');
console.log(`✅ Started Row 7: Bottle #61 added successfully to bottom!`);

console.log('================================================================');
console.log('🎉 ALL HINT & MULTI-ROW SCROLLING TESTS PASSED 100%!');
console.log('================================================================');
