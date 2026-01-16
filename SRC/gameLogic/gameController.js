const Grid = require("./grid");

class GameController {
  constructor(width = 6, height = 12) {
    this.grid = new Grid(width, height, 0);
    this.onGridUpdate = null; // (payload) => void
  }

  setUpdateCallback(callback) {
    this.onGridUpdate = callback;
  }

  handleInput(input) {
    const direction = String(input || "").toLowerCase();
    if (!["w", "a", "s", "d"].includes(direction)) return false;

    const diff = this.grid.move(direction);
    if (!diff) return false;

    if (this.onGridUpdate) {
      this.onGridUpdate({
        updatedNodes: [diff.from, diff.to],
      });
    }

    return true;
  }

  getFullState() {
    return {
      updatedNodes: this.grid.toFullUpdatedNodes(),
    };
  }

  reset() {
    this.grid = new Grid(this.grid.width, this.grid.height, 0);
    if (this.onGridUpdate) {
      this.onGridUpdate(this.getFullState());
    }
  }
}

module.exports = GameController;