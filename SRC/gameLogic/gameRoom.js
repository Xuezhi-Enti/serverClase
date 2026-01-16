const Grid = require('./Grid');
const Piece = require('./Piece');

class GameRoom {
  constructor(roomId, roomName, roomDesc = "") {
    this.roomId = roomId;
    this.roomName = roomName;
    this.roomDesc = roomDesc;
    
    // Players and Viewers
    this.players = {}; 
    this.viewers = [];
    
    // Game State
    this.status = 'waiting';
    this.gameLoop = null;
    this.tickRate = 500; // 500ms fall speed
    
    // Core Logic (SOLID: Dependency Injection-ish)
    this.grids = {
      1: new Grid(6, 12),
      2: new Grid(6, 12)
    };
    
    this.activePieces = {
      1: null,
      2: null
    };

    // Replay system
    this.replayFrames = [];
    this.gameStartTime = null;
  }

  // ... (Keep existing addPlayer, removePlayer, addViewer, saveReplay methods) ...
  
  startGame() {
    if (this.viewers.length === 0) {
      this.pauseGame();
      return;
    }
    
    this.status = 'playing';
    this.gameStartTime = Date.now();
    
    // Send Setup to Unity
    [1, 2].forEach(id => {
       const setup = { 
           playerId: id, 
           playerName: this.players[id]?.name || `Player ${id}`,
           sizeX: 6, sizeY: 12 
       };
       this.broadcastToAll('gridSetup', setup);
    });

    this.broadcastToAll('gameStarted', { roomId: this.roomId });

    // Start Logic Loop
    if (this.gameLoop) clearInterval(this.gameLoop);
    this.gameLoop = setInterval(() => this.gameTick(), this.tickRate);
  }

  gameTick() {
    // Update logic for both players independenty
    [1, 2].forEach(playerId => {
      this.updatePlayerLogic(playerId);
    });
  }

  updatePlayerLogic(playerId) {
    const grid = this.grids[playerId];
    let piece = this.activePieces[playerId];

    // 1. Spawn Phase
    if (!piece) {
      // Spawn at X=2, Y=11 (Top of 12-high grid)
      piece = new Piece(2, 9); 
      this.activePieces[playerId] = piece;

      // GAME OVER CHECK: If new piece collides immediately
      if (!grid.canPlacePiece(piece)) {
        this.endGame(playerId === 1 ? 2 : 1); // Other player wins
        return;
      }
      
      this.sendGridUpdate(playerId);
      return; // Don't move down on the same tick it spawned
    }

    // 2. Physics Phase (Gravity)
    piece.moveDown();

    // 3. Collision Phase
    if (!grid.canPlacePiece(piece)) {
      // Undo move (it hit floor or another block)
      piece.moveUp();
      
      // Lock it into the grid
      grid.placePiece(piece);
      this.activePieces[playerId] = null; // Piece is gone, now part of grid
      
      // 4. Resolution Phase (Gravity -> Match -> Repeat)
      this.resolveGridState(playerId, grid);
    }

    // 5. Send state to Unity
    this.sendGridUpdate(playerId);
  }

  // Handles the chain reaction of Gravity and Matches
  resolveGridState(playerId, grid) {
    let stabilizationLoop = 0;
    let somethingChanged = true;

    // Keep applying gravity and checking matches until grid is stable
    while (somethingChanged && stabilizationLoop < 10) {
      somethingChanged = false;

      // A. Apply Gravity (Jewels fall into gaps)
      if (grid.applyGravity()) {
        somethingChanged = true;
      }

      // B. Check Matches
      const matches = grid.checkMatches();
      if (matches.length > 0) {
        grid.clearMatches(matches);
        somethingChanged = true;
        // Note: Gravity will run again in next loop iteration
      }
      
      stabilizationLoop++;
    }
  }

  handleInput(data) {
    const { playerId, action } = data;
    const piece = this.activePieces[playerId];
    const grid = this.grids[playerId];

    if (!piece || this.status !== 'playing') return;

    // Movement Logic
    switch(action) {
      case 'a': // Left
      case 'left':
        piece.moveLeft();
        if (!grid.canPlacePiece(piece)) piece.moveRight(); // Undo
        break;
        
      case 'd': // Right
      case 'right':
        piece.moveRight();
        if (!grid.canPlacePiece(piece)) piece.moveLeft(); // Undo
        break;
        
      case 'w': // Rotate
      case 'up':
      case 'rotate':
        piece.rotate(); 
        // If rotation causes collision (e.g. against wall), simple fix: undo rotation
        // A better wall-kick system could be added here
        if (!grid.canPlacePiece(piece)) {
            piece.rotate(); piece.rotate(); // Rotate 2 more times to return to original (total 3)
        }
        break;
        
      case 's': // Soft Drop
      case 'down':
        // Move down immediately. Logic tick handles locking if it hits bottom.
        piece.moveDown();
        if (!grid.canPlacePiece(piece)) piece.moveUp();
        break;
    }

    // Send immediate visual update on input
    this.sendGridUpdate(playerId);
  }

  sendGridUpdate(playerId) {
    const grid = this.grids[playerId];
    const piece = this.activePieces[playerId];

    // Combine Grid State + Active Piece for visualization
    let visualNodes = grid.getChangedCells();
    
    if (piece) {
      visualNodes.push(...piece.getPositions());
    }
    

    const updatePayload = {
      playerId: playerId,
      updatedNodes: visualNodes
    };

    // Broadcast to Unity and Web
    this.broadcastToAll('gridUpdate', updatePayload);
    
    // Save for replay
    this.recordFrame(playerId, updatePayload);
  }

  // ... (Keep existing helpers: pauseGame, resumeGame, broadcastToAll, etc.) ...
  
  // Necessary stubs to ensure code works with previous file:
  pauseGame() { this.status = 'paused'; clearInterval(this.gameLoop); this.broadcastToAll('gamePaused', {}); }
  endGame(winnerId) {
     this.status = 'finished';
     clearInterval(this.gameLoop);
     this.broadcastToAll('gameEnded', { winnerId });
     this.saveReplay();
  }
  // Implement addPlayer/removePlayer/addViewer exactly as they were in the previous file
  // but ensure they call this.grids[id] = new Grid(6,12) if needed or reset logic.
  
    // CHANGED: Now accepts the full socket object, not just ID
    addViewer(socket) {
        // Ensure we don't add the same socket twice
        const found = this.viewers.find(v => v.id === socket.id);
        if (!found) {
            this.viewers.push({ id: socket.id, socket: socket });
        }
        
        // If we have 2 players and were waiting for a viewer, start now
        if (Object.keys(this.players).length === 2 && this.status !== 'playing') {
            this.startGame();
        }
    }

    // CHANGED: Updates to handle array of objects
    removeViewer(socketId) {
        this.viewers = this.viewers.filter(v => v.id !== socketId);
        // If no viewers left, pause execution to save resources
        if (this.viewers.length === 0 && this.status === 'playing') this.pauseGame();
    }

    addPlayer(playerId, playerData) {
        this.players[playerId] = playerData;
        // Attempt to start if 2 players are present (startGame will check for listeners)
        if (Object.keys(this.players).length === 2) this.startGame();
    }

    removePlayer(playerId) {
        delete this.players[playerId];
        if (this.status === 'playing') this.endGame(playerId === 1 ? 2 : 1);
    }

    broadcastToAll(event, data) {
        // 1. Send to Viewers (using stored socket references)
        this.viewers.forEach(v => {
            if (v.socket && v.socket.connected) {
                v.socket.emit(event, data);
            }
        });

        // 2. Send to Players
        Object.values(this.players).forEach(p => {
            if (p.socket && p.socket.connected) {
                p.socket.emit(event, data);
            }
        });

        // 3. Fallback/Redundancy: if global.io is set up, this might catch external listeners
        if (global.io) {
            // global.io.to(this.roomId).emit(event, data); 
            // Commented out to avoid double-sending if manual emission above works
        }
    }
    
    recordFrame(playerId, update) { /* ... implementation from original file ... */ }
    saveReplay() { /* ... implementation from original file ... */ }
}

module.exports = GameRoom;