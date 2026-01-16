class Piece {
  constructor(startX = 2, startY = 11) {
    // A piece consists of 3 jewels. 
    // jewels[0] is bottom, jewels[1] is middle, jewels[2] is top.
    this.jewels = [
      this.getRandomJewel(),
      this.getRandomJewel(),
      this.getRandomJewel()
    ];
    
    // Position (x,y) represents the position of the BOTTOM jewel
    this.x = startX;
    this.y = startY; 
  }
  
  getRandomJewel() {
    return Math.floor(Math.random() * 7) + 1; 
  }
  
  moveLeft() { this.x -= 1; }
  moveRight() { this.x += 1; }
  moveDown() { this.y -= 1; }
  moveUp() { this.y += 1; } // Used for rollback on collision

  // [A, B, C] -> [B, C, A]
  rotate() {
    const bottom = this.jewels.shift();
    this.jewels.push(bottom);
  }
  
  // Returns the coordinate and type of each jewel in the piece
  getPositions() {
    return [
      { x: this.x, y: this.y,     type: this.jewels[0] }, // Bottom
      { x: this.x, y: this.y + 1, type: this.jewels[1] }, // Middle
      { x: this.x, y: this.y + 2, type: this.jewels[2] }  // Top
    ];
  }
}

module.exports = Piece;