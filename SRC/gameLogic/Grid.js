class Grid {
  constructor(width, height) {
    this.width = width;
    this. height = height;
    this. cells = Array(width).fill(null)
      .map(() => Array(height).fill(0)); // 0 = empty
  }
  
  setCell(x, y, jewelType) {}
  getCell(x, y) {}
  
  canPlacePiece(piece, x, y) {}
  placePiece(piece) {}
  
  checkMatches() {
    // Return array of matched cells
  }
  
  clearMatches(matches) {}
  applyGravity() {}
  
  getFullState() {
    // Returns all non-empty cells for initial sync
  }
  
  getChangedCells() {
    // Returns only changed cells for updates
  }
}