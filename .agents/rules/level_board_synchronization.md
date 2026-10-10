# Level and Board Synchronization Rule

## Summary
In Color Sort Mini App, the displayed level in the header (`currentUser.maxLevel` / `currentUser.currentLevel`) and the game board bottles (`engine.currentLevel` / `engine.bottles` / `currentLevelData`) must ALWAYS be 100% strictly synchronized.

## Enforcement
1. The game must NEVER show a high level (e.g., Level 50) in the header while displaying Level 1 bottles (7 bottles) on the board.
2. The Level Guardian in `updateHeaderUI` and `handleStart` automatically detects and repairs any level mismatch immediately.
3. When `engine.currentLevel` changes, the renderer must perform a full DOM rebuild (`boardContainer.innerHTML = ''`), never reusing bottles from another level.
