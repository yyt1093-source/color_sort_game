const { Solver } = require('../public/js/solver');
const { LevelGenerator } = require('../public/js/levelGenerator');

console.log('====================================================');
console.log('🧪 Testing Color Sort Level Generator & Solver Engine');
console.log('====================================================');

let totalLevelsTested = 0;
let totalSolvable = 0;

for (let lvl = 1; lvl <= 50; lvl++) {
  totalLevelsTested++;
  const levelData = LevelGenerator.generateLevel(lvl);
  const solution = Solver.solve(levelData.bottles, levelData.capacity);
  const hint = Solver.getHint(levelData.bottles, levelData.capacity);

  if (solution && hint && typeof hint.from === 'number' && typeof hint.to === 'number') {
    totalSolvable++;
    console.log(`✅ Level ${lvl}: Solvable in ${solution.length} moves! (Colors: ${levelData.colorCount}, Jars: ${levelData.bottles.length}, Hint: #${hint.from} ➔ #${hint.to})`);
  } else {
    console.error(`❌ Level ${lvl}: FAILED to find solution or hint!`);
  }
}

console.log('----------------------------------------------------');
console.log(`Results: ${totalSolvable}/${totalLevelsTested} levels tested are 100% solvable!`);
if (totalSolvable === totalLevelsTested) {
  console.log('🎉 ALL TESTS PASSED! Generator guarantee verified.');
  process.exit(0);
} else {
  console.error('⚠️ Some levels failed solver test!');
  process.exit(1);
}
