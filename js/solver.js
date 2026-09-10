/**
 * Color Sort Solver Engine (A* with priority queue and state canonicalization)
 */
(function (exports) {
  const CAPACITY = 4;

  class MinHeap {
    constructor(compare) {
      this.data = [];
      this.compare = compare;
    }
    push(val) {
      this.data.push(val);
      this.bubbleUp(this.data.length - 1);
    }
    pop() {
      if (this.data.length === 0) return null;
      const top = this.data[0];
      const bottom = this.data.pop();
      if (this.data.length > 0) {
        this.data[0] = bottom;
        this.sinkDown(0);
      }
      return top;
    }
    bubbleUp(idx) {
      const el = this.data[idx];
      while (idx > 0) {
        let parentIdx = Math.floor((idx - 1) / 2);
        let parent = this.data[parentIdx];
        if (this.compare(el, parent) >= 0) break;
        this.data[parentIdx] = el;
        this.data[idx] = parent;
        idx = parentIdx;
      }
    }
    sinkDown(idx) {
      const len = this.data.length;
      const el = this.data[idx];
      while (true) {
        let leftIdx = 2 * idx + 1;
        let rightIdx = 2 * idx + 2;
        let left, right;
        let swap = null;

        if (leftIdx < len) {
          left = this.data[leftIdx];
          if (this.compare(left, el) < 0) swap = leftIdx;
        }
        if (rightIdx < len) {
          right = this.data[rightIdx];
          if ((swap === null && this.compare(right, el) < 0) ||
              (swap !== null && this.compare(right, left) < 0)) {
            swap = rightIdx;
          }
        }
        if (swap === null) break;
        this.data[idx] = this.data[swap];
        this.data[swap] = el;
        idx = swap;
      }
    }
    get length() {
      return this.data.length;
    }
  }

  function serializeState(bottles) {
    return bottles.map(b => b.join(',')).sort().join('|');
  }

  function isBottleCompleted(bottle, capacity = CAPACITY) {
    if (bottle.length !== capacity) return false;
    const first = bottle[0];
    return bottle.every(c => c === first);
  }

  function isSolved(bottles) {
    if (bottles.length === 0) return true;
    return bottles.every(b => b.length === 0);
  }

  function calculateHeuristic(bottles) {
    let breaks = 0;
    for (const b of bottles) {
      if (b.length === 0) continue;
      for (let i = 1; i < b.length; i++) {
        if (b[i] !== b[i - 1]) breaks++;
      }
    }
    return breaks;
  }

  function getValidMoves(bottles, capacity = CAPACITY, prevMove = null) {
    const moves = [];
    const n = bottles.length;

    for (let from = 0; from < n; from++) {
      const bFrom = bottles[from];
      if (bFrom.length === 0) continue;

      const topColor = bFrom[bFrom.length - 1];
      let count = 0;
      for (let i = bFrom.length - 1; i >= 0; i--) {
        if (bFrom[i] === topColor) count++;
        else break;
      }

      const isHomogenous = bFrom.every(c => c === topColor);

      let firstEmptyIdx = -1;
      for (let i = 0; i < n; i++) {
        if (bottles[i].length === 0) {
          firstEmptyIdx = i;
          break;
        }
      }

      for (let to = 0; to < n; to++) {
        if (from === to) continue;
        const bTo = bottles[to];
        if (bTo.length >= capacity) continue;

        if (prevMove && prevMove.from === to && prevMove.to === from) continue;

        if (bTo.length > 0) {
          if (bTo[bTo.length - 1] !== topColor) continue;
          const actualAmount = Math.min(count, capacity - bTo.length);
          if (actualAmount > 0) {
            moves.push({ from, to, amount: actualAmount, color: topColor });
          }
        } else {
          // Canonical empty jar pruning: only pour into the first empty jar (all empty jars are symmetric)
          if (to !== firstEmptyIdx) continue;
          if (isHomogenous) continue;
          const actualAmount = Math.min(count, capacity);
          if (actualAmount > 0 && actualAmount < bFrom.length) {
            moves.push({ from, to, amount: actualAmount, color: topColor });
          }
        }
      }
    }
    return moves;
  }

  function applyMove(bottles, move, capacity = CAPACITY) {
    let nextBottles = bottles.map(b => [...b]);
    const { from, to, amount } = move;
    
    for (let i = 0; i < amount; i++) {
      const color = nextBottles[from].pop();
      nextBottles[to].push(color);
    }
    
    if (isBottleCompleted(nextBottles[to], capacity)) {
      nextBottles.splice(to, 1);
    }

    return nextBottles;
  }

  function solve(initialBottles, capacity = CAPACITY) {
    if (isSolved(initialBottles)) return [];
    
    let startBottles = initialBottles.map(b => [...b]);
    for (let i = startBottles.length - 1; i >= 0; i--) {
      if (isBottleCompleted(startBottles[i], capacity)) {
        startBottles.splice(i, 1);
      }
    }
    if (isSolved(startBottles)) return [];

    let uniqueColors = new Set();
    startBottles.forEach(b => b.forEach(c => uniqueColors.add(c)));
    const colorCount = uniqueColors.size;
    const limit = Math.min(20000, 5000 * colorCount);

    const compare = (a, b) => (a.cost + a.heuristic) - (b.cost + b.heuristic);
    const pq = new MinHeap(compare);
    
    const startState = { bottles: startBottles, path: [], cost: 0, heuristic: calculateHeuristic(startBottles), prevMove: null };
    pq.push(startState);
    
    const visited = new Set();
    visited.add(serializeState(startBottles));

    let steps = 0;
    while (pq.length > 0 && steps < limit) {
      steps++;
      const current = pq.pop();
      if (isSolved(current.bottles)) return current.path;
      
      const moves = getValidMoves(current.bottles, capacity, current.prevMove);
      for (const m of moves) {
        const nextBottles = applyMove(current.bottles, m, capacity);
        const key = serializeState(nextBottles);
        if (!visited.has(key)) {
          visited.add(key);
          pq.push({
            bottles: nextBottles,
            path: [...current.path, m],
            cost: current.cost + 1,
            heuristic: calculateHeuristic(nextBottles),
            prevMove: m
          });
        }
      }
    }
    return null;
  }

  function getHint(bottles, capacity = CAPACITY) {
    const solution = solve(bottles, capacity);
    if (solution && solution.length > 0) return solution[0];
    return null;
  }

  const solverAPI = {
    solve,
    getHint,
    getValidMoves,
    applyMove,
    isSolved,
    isBottleCompleted
  };
  Object.assign(exports, solverAPI);
  exports.Solver = solverAPI;
})(typeof exports !== 'undefined' ? exports : (window.GameSolver = {}));
