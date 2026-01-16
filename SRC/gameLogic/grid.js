class Grid {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    // Initialize 2D array: cells[x][y].;  0 = vacio
    this.cells = Array.from({ length: width }, () => Array(height).fill(0));
  }


  isValid(x, y) {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  isFree(x, y) {
    // A cell is free if it's within bounds and is 0 
    return this.isValid(x, y) && this.cells[x][y] === 0;
  }

  setCell(x, y, value) {
    if (this.isValid(x, y)) {
      this.cells[x][y] = value;
    }
  }

  getCell(x, y) {
    return this.isValid(x, y) ? this.cells[x][y] : null;
  }

  // --- Interaction Logic ---

  // Checks if a piece can exist at a specific location without colliding
  canPlacePiece(piece) {
    const positions = piece.getPositions();
    for (const pos of positions) {
      // Check boundaries
      if (pos.x < 0 || pos.x >= this.width || pos.y < 0) return false;
      
      // Check collision with existing blocks (ignore if y >= height, meaning it's spawning/falling from above)
      if (pos.y < this.height && this.cells[pos.x][pos.y] !== 0) {
        return false;
      }
    }
    return true;
  }

  // Locks a piece into the grid
  placePiece(piece) {
    const positions = piece.getPositions();
    for (const pos of positions) {
      if (pos.y < this.height) {
        this.setCell(pos.x, pos.y, pos.type);
      }
    }
  }

  // --- Physics & Rules (The requested Logic) ---

  // Applies gravity to the entire grid.
  // Jewels fall into empty spaces below them.
  applyGravity() {
    let hasChanged = false;

    for (let x = 0; x < this.width; x++) {
      // 1. Extract all non-zero jewels from this column
      const columnJewels = this.cells[x].filter(val => val !== 0);
      
      // 2. Determine how many empty spaces we need
      const emptyCount = this.height - columnJewels.length;

      // 3. Rebuild the column: Jewels at the bottom, Zeros at the top
      // We fill from index 0 (bottom) up to the number of jewels
      for (let y = 0; y < this.height; y++) {
        const newValue = y < columnJewels.length ? columnJewels[y] : 0;
        
        if (this.cells[x][y] !== newValue) {
          this.cells[x][y] = newValue;
          hasChanged = true;
        }
      }
    }
    return hasChanged;
  }

  // Scans the grid for 3+ consecutive matching colors
  checkMatches() {
    let matchedCells = new Set(); // Use Set to store unique "x,y" strings

    // Helper to add matches
    const addMatch = (x, y) => matchedCells.add(`${x},${y}`);

    // Horizontal Check
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width - 2; x++) {
        const type = this.cells[x][y];
        if (type !== 0 && 
            type === this.cells[x+1][y] && 
            type === this.cells[x+2][y]) {
          addMatch(x, y);
          addMatch(x+1, y);
          addMatch(x+2, y);
        }
      }
    }

    // Vertical Check
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height - 2; y++) {
        const type = this.cells[x][y];
        if (type !== 0 && 
            type === this.cells[x][y+1] && 
            type === this.cells[x][y+2]) {
          addMatch(x, y);
          addMatch(x, y+1);
          addMatch(x, y+2);
        }
      }
    }

    return Array.from(matchedCells).map(str => {
      const [x, y] = str.split(',').map(Number);
      return { x, y };
    });
  }

  clearMatches(matches) {
    matches.forEach(pos => {
      this.setCell(pos.x, pos.y, 0); // 0 = None (Exploded)
    });
  }


  // Returns a list of all non-zero nodes for the Unity client
  getChangedCells() {
    const updates = [];
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        updates.push({ x, y, type: this.cells[x][y] });
      }
    }
    return updates;
  }
}

module.exports = Grid;