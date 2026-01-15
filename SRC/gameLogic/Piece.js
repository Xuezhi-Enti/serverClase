class Piece {
  constructor() {
    this.jewels = [
      getRandomJewel(),
      getRandomJewel(),
      getRandomJewel()
    ];
    this.x = 2; // Center of 6-wide grid
    this.y = 9; // Top of 12-high grid
  }
  
  moveLeft() {}
  moveRight() {}
  moveDown() {}
  rotate() {} // Cycle jewels [0,1,2] -> [2,0,1]
  
  getPositions() {
    return [
      {x: this. x, y: this.y, type: this.jewels[0]},
      {x: this.x, y: this.y+1, type: this.jewels[1]},
      {x: this.x, y: this.y+2, type: this.jewels[2]}
    ];
  }
}

function getRandomJewel() {
  return Math.floor(Math. random() * 6) + 1; // 1-6 (Red-Purple)
}