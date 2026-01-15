const Grid = require('./Grid');
const Piece = require('./Piece');

class GameRoom {
  constructor(roomId, roomName) {
    this.roomId = roomId;
    this.roomName = roomName;
    this.players = {};
    this. viewers = [];
    this.grids = {
      1: new Grid(6, 12),
      2: new Grid(6, 12)
    };
    this.activePieces = {
      1: null,
      2: null
    };
    this.status = 'waiting';
    this.gameLoop = null;
    this.tickRate = 500; // ms per tick
  }
  
  startGame() {
    if (this.viewers.length === 0) {
      this.status = 'paused';
      this.broadcastToPlayers('gamePaused', { reason: 'no_viewers' });
      return;
    }
    
    this.status = 'playing';
    
    // Spawn initial pieces
    this.activePieces[1] = new Piece();
    this.activePieces[2] = new Piece();
    
    // Start game loop
    this.gameLoop = setInterval(() => this.tick(), this.tickRate);
    
    this.broadcastToAll('gameStarted', { roomId: this.roomId });
  }
  
  pauseGame() {
    this.status = 'paused';
    if (this.gameLoop) {
      clearInterval(this.gameLoop);
      this.gameLoop = null;
    }
    this.broadcastToAll('gamePaused', { reason: 'no_viewers' });
  }
  
  resumeGame() {
    if (this.viewers.length > 0) {
      this.status = 'playing';
      this.gameLoop = setInterval(() => this.tick(), this.tickRate);
      this.broadcastToAll('gameResumed', {});
    }
  }
  
  tick() {
    [1, 2].forEach(playerId => {
      const piece = this.activePieces[playerId];
      const grid = this.grids[playerId];
      
      if (! piece) {
        // Spawn new piece
        this.activePieces[playerId] = new Piece();
        this.sendGridUpdate(playerId);
        return;
      }
      
      // Try to move piece down
      piece.moveDown();
      
      if (! grid.canPlacePiece(piece)) {
        // Lock piece
        piece.moveUp(); // Undo last move
        grid.placePiece(piece);
        
        // Check for matches
        const matches = grid.checkMatches();
        if (matches.length > 0) {
          grid.clearMatches(matches);
          grid.applyGravity();
        }
        
        // Spawn new piece
        this.activePieces[playerId] = new Piece();
        
        // Check game over
        if (! grid.canPlacePiece(this.activePieces[playerId])) {
          this.endGame(playerId === 1 ? 2 : 1); // Other player wins
          return;
        }
      }
      
      this.sendGridUpdate(playerId);
    });
  }
  
  handleInput(playerId, action) {
    const piece = this.activePieces[playerId];
    const grid = this.grids[playerId];
    
    if (! piece) return;
    
    switch(action) {
      case 'left':
        piece.moveLeft();
        if (! grid.canPlacePiece(piece)) piece.moveRight();
        break;
      case 'right': 
        piece.moveRight();
        if (!grid.canPlacePiece(piece)) piece.moveLeft();
        break;
      case 'down':
        this.tickRate = 100; // Speed up temporarily
        break;
      case 'rotate': 
        piece.rotate();
        break;
    }
    
    this.sendGridUpdate(playerId);
  }
  
  sendGridUpdate(playerId) {
    const grid = this.grids[playerId];
    const piece = this.activePieces[playerId];
    
    const updatedNodes = [
      ... grid.getChangedCells(),
      ...(piece ?  piece.getPositions() : [])
    ];
    
    this.broadcastToViewers('gridUpdate', {
      playerId,
      playerName: this.players[playerId]?.name || '',
      updatedNodes
    });
  }
  
  endGame(winnerId) {
    this.status = 'finished';
    if (this.gameLoop) {
      clearInterval(this.gameLoop);
    }
    
    this.broadcastToAll('gameEnded', {
      roomId: this.roomId,
      winner: this.players[winnerId]?.name || ''
    });
  }
  
  addViewer(socketId) {
    this.viewers.push(socketId);
  }
  
  removeViewer(socketId) {
    this.viewers = this. viewers.filter(id => id !== socketId);
  }
  
  addPlayer(playerId, playerData) {
    this.players[playerId] = playerData;
  }
  
  removePlayer(playerId) {
    delete this.players[playerId];
  }
  
  broadcastToViewers(event, data) {
    this.viewers. forEach(socketId => {
      const socket = global.io.sockets.sockets.get(socketId);
      if (socket) socket.emit(event, data);
    });
  }
  
  broadcastToPlayers(event, data) {
    Object.values(this.players).forEach(player => {
      player.socket.emit(event, data);
    });
  }
  
  broadcastToAll(event, data) {
    this.broadcastToViewers(event, data);
    this.broadcastToPlayers(event, data);
  }
}

module.exports = GameRoom;