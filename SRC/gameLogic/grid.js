// Estoy bastante seguro que hay un error interno en la lógica del juego, 
//la intencion era al hacer input, moverse a través de las teclas WASD, no obstante como JavaScript no me sabe decir que falla...


class Grid {
  constructor(width, height, inactiveType = 0) {
    this.width = width;
    this.height = height;
    this.inactiveType = inactiveType;

    this.activeX = Math.floor(width / 2);
    this.activeY = Math.floor(height / 2);

    this.activeType = 5;
  }

  isValid(x, y) {
    return Number.isInteger(x) &&
      Number.isInteger(y) &&
      x >= 0 && x < this.width &&
      y >= 0 && y < this.height;
  }

  setActiveType(type) {
    if (Number.isInteger(type) && type >= 1 && type <= 7) {
      this.activeType = type;
    }
  }

  /**
   * WASD move. Returns { from: {x,y,type}, to: {x,y,type} } or null.
   */
  move(direction) {
    const dir = String(direction || "").toLowerCase();
    let newX = this.activeX;
    let newY = this.activeY;

    switch (dir) {
      case "w": newY += 1; break;
      case "s": newY -= 1; break;
      case "a": newX -= 1; break;
      case "d": newX += 1; break;
      default: return null;
    }

    if (!this.isValid(newX, newY)) return null;

    const from = { x: this.activeX, y: this.activeY, type: this.inactiveType };
    this.activeX = newX;
    this.activeY = newY;
    const to = { x: this.activeX, y: this.activeY, type: this.activeType };

    return { from, to };
  }

  toFullUpdatedNodes() {
    const updatedNodes = [];
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        updatedNodes.push({
          x,
          y,
          type: (x === this.activeX && y === this.activeY) ? this.activeType : this.inactiveType
        });
      }
    }
    return updatedNodes;
  }
}

module.exports = Grid;