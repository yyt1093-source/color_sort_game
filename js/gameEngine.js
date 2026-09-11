/**
 * Core Game Engine for Color Sort Mini App
 */
(function (exports) {
  class GameEngine {
    constructor() {
      this.currentLevel = 1;
      this.bottles = [];
      this.capacity = 5;
      this.colors = [];
      this.selectedBottleIndex = null;
      this.history = [];
      this.movesCount = 0;
      this.minMoves = 0;
      this.isAnimating = false;
      this.onStateChange = null;
      this.onBottleVanished = null;
      this.onWin = null;
      this.hintHighlight = null;
      this.revealed = [];
    }

    startLevel(levelData) {
      this.currentLevel = levelData.levelNumber;
      this.bottles = levelData.bottles.map(b => [...b]);
      this.capacity = levelData.capacity || 5;
      this.colors = levelData.colors;
      this.minMoves = levelData.minMoves || 0;
      this.selectedBottleIndex = null;
      this.history = [];
      this.movesCount = 0;
      this.isAnimating = false;
      this.hintHighlight = null;
      this.isWon = false;
      
      // Initialize revealed matrix: If 'all colors' perk is active, reveal everything immediately! Otherwise only single top cell is revealed
      const allActive = (typeof window !== 'undefined' && window.isAllColorsActive && window.isAllColorsActive());
      this.revealed = this.bottles.map(b => {
        if (b.length === 0) return [];
        if (allActive) {
          return new Array(b.length).fill(true);
        }
        const rev = new Array(b.length).fill(false);
        rev[b.length - 1] = true;
        return rev;
      });

      exports.colors = this.colors;
      if (this.onStateChange) this.onStateChange();
    }

    getStarRating() {
      if (this.minMoves <= 0) return 3;
      const ratio = this.movesCount / this.minMoves;
      if (ratio <= 1.3) return 3;
      if (ratio <= 2.0) return 2;
      return 1;
    }

    selectBottle(index) {
      if (this.isAnimating) return false;
      if (index < 0 || index >= this.bottles.length) return false;
      if (this.bottles[index].vanished || this.isBottleCompleted(this.bottles[index])) return false;

      this.hintHighlight = null;

      if (this.selectedBottleIndex === null) {
        if (this.bottles[index].length === 0) {
          if (window.SoundEngine && window.SoundEngine.SoundEngine) window.SoundEngine.SoundEngine.playError();
          if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('error');
          return false;
        }
        this.selectedBottleIndex = index;
        if (window.SoundEngine && window.SoundEngine.SoundEngine) window.SoundEngine.SoundEngine.playClick();
        if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('light');
        if (this.onStateChange) this.onStateChange();
        return true;
      }

      if (this.selectedBottleIndex === index) {
        this.selectedBottleIndex = null;
        if (window.SoundEngine && window.SoundEngine.SoundEngine) window.SoundEngine.SoundEngine.playClick();
        if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('light');
        if (this.onStateChange) this.onStateChange();
        return true;
      }

      const fromIdx = this.selectedBottleIndex;
      const toIdx = index;

      if (!this.canPour(fromIdx, toIdx)) {
        if (this.bottles[toIdx].length > 0 && !this.bottles[toIdx].vanished && !this.isBottleCompleted(this.bottles[toIdx])) {
          this.selectedBottleIndex = toIdx;
          if (window.SoundEngine && window.SoundEngine.SoundEngine) window.SoundEngine.SoundEngine.playClick();
          if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('light');
        } else {
          this.selectedBottleIndex = null;
          if (window.SoundEngine && window.SoundEngine.SoundEngine) window.SoundEngine.SoundEngine.playError();
          if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('error');
        }
        if (this.onStateChange) this.onStateChange();
        return false;
      }

      this.executePour(fromIdx, toIdx);
      return true;
    }

    canPour(fromIdx, toIdx) {
      if (fromIdx === toIdx) return false;
      const bFrom = this.bottles[fromIdx];
      const bTo = this.bottles[toIdx];

      if (!bFrom || bFrom.length === 0 || bFrom.vanished) return false;
      if (!bTo || bTo.vanished || bTo.length >= this.capacity || this.isBottleCompleted(bTo)) return false;

      const topColor = bFrom[bFrom.length - 1];
      if (bTo.length === 0) return true;
      return bTo[bTo.length - 1] === topColor;
    }

    getTransferAmount(fromIdx, toIdx) {
      const bFrom = this.bottles[fromIdx];
      const bTo = this.bottles[toIdx];
      const topColor = bFrom[bFrom.length - 1];
      const allActive = (typeof window !== 'undefined' && window.isAllColorsActive && window.isAllColorsActive());

      let count = 0;
      for (let i = bFrom.length - 1; i >= 0; i--) {
        const isKnown = allActive || !this.revealed || !this.revealed[fromIdx] || this.revealed[fromIdx][i] !== false;
        if (bFrom[i] === topColor && isKnown) count++;
        else break;
      }
      return Math.min(count, this.capacity - bTo.length);
    }

    executePour(fromIdx, toIdx) {
      const amount = this.getTransferAmount(fromIdx, toIdx);
      if (amount <= 0) return;

      this.history.push({
        bottles: this.bottles.map(b => {
          const copy = [...b];
          if (b.vanished) copy.vanished = true;
          return copy;
        }),
        revealed: this.revealed ? this.revealed.map(r => [...r]) : [],
        movesCount: this.movesCount
      });

      this.isAnimating = true;
      const color = this.bottles[fromIdx][this.bottles[fromIdx].length - 1];
      this.selectedBottleIndex = null;
      this.movesCount++;

      if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('medium');

      const applyPourState = () => {
        for (let i = 0; i < amount; i++) {
          this.bottles[fromIdx].pop();
          if (this.revealed && this.revealed[fromIdx]) {
            this.revealed[fromIdx].pop();
          }

          this.bottles[toIdx].push(color);
          // Poured liquid is known to the player!
          if (this.revealed && this.revealed[toIdx]) {
            this.revealed[toIdx].push(true);
          }
        }

        // Uncover ONLY the single newly exposed top layer in the source bottle
        const bFrom = this.bottles[fromIdx];
        if (bFrom.length > 0 && this.revealed && this.revealed[fromIdx]) {
          this.revealed[fromIdx][bFrom.length - 1] = true;
        }

        this.checkBottleCompletion(toIdx);
      };

      if (window.GameRenderer && window.GameRenderer.animatePour) {
        window.GameRenderer.animatePour(fromIdx, toIdx, amount, color, applyPourState);
      } else {
        applyPourState();
      }
    }

    isBottleCompleted(bottle) {
      if (!bottle || bottle.length !== this.capacity) return false;
      const first = bottle[0];
      return bottle.every(c => c === first);
    }

    isLevelWon() {
      if (this.bottles.length === 0) return true;
      return this.bottles.every(b => b.length === 0 || this.isBottleCompleted(b) || b.vanished);
    }

    checkBottleCompletion(bottleIdx) {
      const bottle = this.bottles[bottleIdx];
      const isComplete = this.isBottleCompleted(bottle);

      if (isComplete) {
        bottle.vanished = true;
        if (window.SoundEngine && window.SoundEngine.SoundEngine) window.SoundEngine.SoundEngine.playComplete();
        if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('success');

        if (window.GameRenderer && window.GameRenderer.animateJarVanish) {
          window.GameRenderer.animateJarVanish(bottleIdx, () => {
            if (this.onBottleVanished) this.onBottleVanished(bottleIdx);
            this.postMoveCheck();
          });
        } else {
          if (this.onBottleVanished) this.onBottleVanished(bottleIdx);
          this.postMoveCheck();
        }
      } else {
        if (!window.GameRenderer || !window.GameRenderer.animatePour) {
          if (window.SoundEngine && window.SoundEngine.SoundEngine) window.SoundEngine.SoundEngine.playPour();
        }
        this.postMoveCheck();
      }
    }

    postMoveCheck() {
      this.isAnimating = false;
      const isWin = this.isLevelWon();

      if (isWin && !this.isWon) {
        this.isWon = true;
        if (window.SoundEngine && window.SoundEngine.SoundEngine) window.SoundEngine.SoundEngine.playVictory();
        if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('success');
        if (this.onWin) {
          this.onWin({ 
            levelNumber: this.currentLevel, 
            moves: this.movesCount, 
            stars: this.getStarRating() 
          });
        }
      }

      if (this.onStateChange) this.onStateChange();
    }

    undo() {
      if (this.isAnimating || this.history.length === 0) return false;
      
      const previousState = this.history.pop();
      this.bottles = previousState.bottles.map(b => {
        const copy = [...b];
        if (b.vanished) copy.vanished = true;
        return copy;
      });
      this.revealed = previousState.revealed 
        ? previousState.revealed.map(r => [...r]) 
        : this.bottles.map(b => b.map((_, idx) => idx === b.length - 1));
      this.movesCount = previousState.movesCount;
      this.selectedBottleIndex = null;
      this.hintHighlight = null;

      if (window.SoundEngine && window.SoundEngine.SoundEngine) window.SoundEngine.SoundEngine.playUndo();
      if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('light');

      if (this.onStateChange) this.onStateChange();
      return true;
    }

    addExtraBottle() {
      if (this.isAnimating || this.isWon) return false;
      this.bottles.push([]);
      if (this.revealed) this.revealed.push([]);
      if (this.history && this.history.length > 0) {
        this.history.forEach(state => {
          if (state.bottles) state.bottles.push([]);
          if (state.revealed) state.revealed.push([]);
        });
      }
      if (window.SoundEngine && window.SoundEngine.SoundEngine) window.SoundEngine.SoundEngine.playClick();
      if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('success');
      if (this.onStateChange) this.onStateChange();
      return true;
    }

    getHint() {
      if (this.isAnimating) return null;
      if (window.GameSolver && window.GameSolver.Solver) {
        const hint = window.GameSolver.Solver.getHint(this.bottles, this.capacity);
        if (hint) {
          this.hintHighlight = { from: hint.from, to: hint.to };
          if (window.SoundEngine && window.SoundEngine.SoundEngine) window.SoundEngine.SoundEngine.playClick();
          if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('light');
          if (this.onStateChange) this.onStateChange();
          return hint;
        }
      }
      return null;
    }

    hasHiddenColors() {
      if (typeof window !== 'undefined' && window.isAllColorsActive && window.isAllColorsActive()) return false;
      if (!this.revealed) return false;
      return this.revealed.some(r => r && r.some(isKnown => isKnown === false));
    }

    revealAllColors() {
      if (!this.bottles) return;
      this.revealed = this.bottles.map(b => new Array(b.length).fill(true));
      if (this.onStateChange) this.onStateChange();
    }

    revealRandomBottle() {
      if (!this.revealed || this.isAnimating) return null;
      const candidates = [];
      for (let i = 0; i < this.bottles.length; i++) {
        if (this.bottles[i].length > 0 && this.revealed[i] && this.revealed[i].some(isKnown => isKnown === false)) {
          candidates.push(i);
        }
      }
      if (candidates.length === 0) return null;

      const targetIdx = candidates[Math.floor(Math.random() * candidates.length)];
      this.revealed[targetIdx] = this.revealed[targetIdx].map(() => true);

      if (this.onStateChange) this.onStateChange();
      return { bottleIndex: targetIdx };
    }

    changeOpenColors() {
      if (this.isAnimating) return false;

      const eligibleIndices = [];
      const openColors = [];

      for (let i = 0; i < this.bottles.length; i++) {
        const b = this.bottles[i];
        if (!b || b.length === 0 || b.vanished || this.isBottleCompleted(b)) continue;
        eligibleIndices.push(i);
        openColors.push(b[b.length - 1]);
      }

      if (eligibleIndices.length < 2) return false;

      // Save undo history
      this.history.push({
        bottles: this.bottles.map(b => {
          const copy = [...b];
          if (b.vanished) copy.vanished = true;
          return copy;
        }),
        revealed: this.revealed ? this.revealed.map(r => [...r]) : [],
        movesCount: this.movesCount
      });

      // Permute open colors among eligible bottles
      let shuffled = [...openColors];
      let changed = false;
      for (let attempt = 0; attempt < 30; attempt++) {
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        if (shuffled.some((c, idx) => c !== openColors[idx])) {
          changed = true;
          break;
        }
      }

      if (!changed) {
        shuffled = [...openColors.slice(1), openColors[0]];
      }

      // Apply the shuffled top colors
      eligibleIndices.forEach((bottleIdx, i) => {
        const newColor = shuffled[i];
        const b = this.bottles[bottleIdx];
        b[b.length - 1] = newColor;
        if (this.revealed && this.revealed[bottleIdx]) {
          this.revealed[bottleIdx][b.length - 1] = true;
        }
      });

      this.hintHighlight = null;
      this.selectedBottleIndex = null;
      if (window.SoundEngine && window.SoundEngine.SoundEngine) window.SoundEngine.SoundEngine.playComplete();
      if (window.TelegramApp && window.TelegramApp.TelegramApp) window.TelegramApp.TelegramApp.haptic('success');

      if (window.GameRenderer && window.GameRenderer.spawnSparkles) {
        eligibleIndices.forEach(idx => {
          const el = document.querySelector(`.glass-bottle[data-index="${idx}"]`);
          if (el) {
            const rect = el.getBoundingClientRect();
            window.GameRenderer.spawnSparkles(rect.left + rect.width / 2, rect.top + 20, 10);
          }
        });
      }

      if (this.onStateChange) this.onStateChange();
      return true;
    }
  }

  const engineInstance = new GameEngine();
  exports.Engine = engineInstance;
  exports.GameEngine = GameEngine;
  exports.colors = engineInstance.colors;
})(typeof exports !== 'undefined' ? exports : (window.GameEngine = {}));
