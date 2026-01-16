const express = require("express");
const mysql = require("mysql");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const path = require("path");
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: "miSecretoSuperSecreto",
    resave:  false,
    saveUninitialized: true
}));
app.use(express.static(path.join(__dirname, "public")));

const connection = mysql.createConnection({
    host: "localhost",
    user: "root",
    password:  "user",
    database: "mydb"
});

connection.connect(err => {
    if (err) {
        console.error("Error conectando a la base de datos:", err);
        return;
    }
    console.log("Base de datos conectada");
});

// HTTP ROUTES

app.post("/auth/register", (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.json({ status: "error", message: "Campos vacíos" });

    const hashedPassword = bcrypt.hashSync(password, 10);

    connection.query(
        "INSERT INTO users (username, password) VALUES (?, ?)",
        [username, hashedPassword],
        (err) => {
            if (err) {
                if (err.code === "ER_DUP_ENTRY") return res.json({ status: "error", message: "Usuario ya existe" });
                return res.json({ status: "error", message: "Error en la base de datos" });
            }
            res.json({ status: "ok", message: "Usuario registrado.  Ahora inicia sesión." });
        }
    );
});

app.post("/auth/login", (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.json({ status: "error", message: "Campos vacíos" });

    connection.query(
        "SELECT * FROM users WHERE username = ?",
        [username],
        (err, results) => {
            if (err) return res.json({ status: "error", message: "Error en la base de datos" });
            if (results.length === 0) return res.json({ status: "error", message: "Usuario no encontrado" });

            const user = results[0];
            const match = bcrypt.compareSync(password, user.password);
            if (match) {
                req.session.userId = user.id;
                res.json({ status: "ok", message: "Login correcto" });
            } else {
                res.json({ status: "error", message: "Contraseña incorrecta" });
            }
        }
    );
});

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public/chat.html")));

// SOCKET.IO SERVER FOR GAME ROOMS

const http = require("http").createServer(app);
const { Server } = require("socket.io");
const io = new Server(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Store active game rooms
const activeRooms = new Map();

// Store replays
const replays = new Map();

// Room class
class GameRoom {
    constructor(roomId, roomName, roomDesc = "") {
        this.roomId = roomId;
        this.roomName = roomName;
        this.roomDesc = roomDesc;
        this.players = {}; // { 1: {id, name, socket}, 2: {id, name, socket} }
        this.viewers = []; // Array of socket IDs
        this.status = 'waiting'; // 'waiting', 'playing', 'paused', 'finished'
        this.replayFrames = []; // Store frames for replay
        this.gameStartTime = null;
    }

    addViewer(socketId) {
        if (! this.viewers.includes(socketId)) {
            this.viewers. push(socketId);
            console.log(`Viewer ${socketId} joined room ${this.roomId}.  Total viewers: ${this.viewers. length}`);
        }
    }

    removeViewer(socketId) {
        this.viewers = this.viewers.filter(id => id !== socketId);
        console.log(`Viewer ${socketId} left room ${this.roomId}. Total viewers: ${this. viewers.length}`);

        // Pause game if no viewers
        if (this.viewers.length === 0 && this.status === 'playing') {
            this.pauseGame();
        }
    }

    addPlayer(playerId, playerData) {
        this.players[playerId] = playerData;
        console.log(`Player ${playerId} (${playerData.name}) joined room ${this.roomId}`);

        // Broadcast to all that a player joined
        this.broadcastToAll('playerJoined', {
            playerId: playerId,
            playerName: playerData. name,
            playerCount: Object.keys(this.players).length
        });

        // Start game if we have 2 players
        if (Object.keys(this.players).length === 2) {
            this.startGame();
        }
    }

    removePlayer(playerId) {
        const playerName = (this.players[playerId] && this.players[playerId].name) || 'Unknown';
        delete this.players[playerId];
        console.log(`Player ${playerId} (${playerName}) left room ${this.roomId}`);

        // Broadcast to all that a player left
        this.broadcastToAll('playerLeft', {
            playerId: playerId,
            playerName: playerName,
            playerCount: Object.keys(this.players).length
        });

        // Stop game if less than 2 players
        if (this.status === 'playing' && Object.keys(this.players).length < 2) {
            this.pauseGame();
        }
    }

    startGame() {
        if (this.status === 'playing') return;

        this.status = 'playing';
        this.gameStartTime = Date.now();
        console.log(`Game started in room ${this.roomId}`);

        // Send grid setup to all viewers for both players
        const p1 = this.players[1];
        const p2 = this.players[2];

        const gridSetup1 = {
            playerId:  1,
            playerName:  (p1 && p1.name) || 'Player 1',
            sizeX: 6,
            sizeY: 12
        };

        const gridSetup2 = {
            playerId: 2,
            playerName: (p2 && p2.name) || 'Player 2',
            sizeX:  6,
            sizeY: 12
        };

        this.broadcastToViewers('gridSetup', gridSetup1);
        this.broadcastToViewers('gridSetup', gridSetup2);

        // Send game started to players
        this.broadcastToPlayers('gameStarted', {
            roomId: this.roomId,
            player1: gridSetup1,
            player2: gridSetup2
        });

        // Initialize full grid of orange jewels for both players
        this.initializeOrangeGrid();
    }

    initializeOrangeGrid() {
        // Create full grid of orange jewels (type 5) for both players
        const updatedNodes = [];
        
        for (let x = 0; x < 6; x++) {
            for (let y = 0; y < 12; y++) {
                updatedNodes.push({ x: x, y: y, type: 5 }); // 5 = Orange
            }
        }

        // Send to both players
        const gridUpdate1 = {
            playerId: 1,
            playerName: (this.players[1] && this.players[1].name) || 'Player 1',
            updatedNodes: updatedNodes
        };

        const gridUpdate2 = {
            playerId: 2,
            playerName: (this.players[2] && this.players[2].name) || 'Player 2',
            updatedNodes: updatedNodes
        };

        this.recordFrame(1, gridUpdate1);
        this.recordFrame(2, gridUpdate2);

        this.broadcastToViewers('gridUpdate', gridUpdate1);
        this.broadcastToViewers('gridUpdate', gridUpdate2);

        console.log(`Initialized orange grid for room ${this.roomId}`);
    }

    pauseGame() {
        this.status = 'paused';
        console.log(`Game paused in room ${this.roomId}`);
        this.broadcastToAll('gamePaused', { reason: 'Not enough players or no viewers' });
    }

    resumeGame() {
        if (this.viewers.length > 0 && Object.keys(this.players).length === 2) {
            this. status = 'playing';
            console.log(`Game resumed in room ${this.roomId}`);
            this.broadcastToAll('gameResumed', {});
        }
    }

    recordFrame(playerId, gridUpdate) {
        const timestamp = (Date.now() - this.gameStartTime) / 1000; // seconds since game start
        this.replayFrames.push({
            timestamp: timestamp,
            playerId:  playerId,
            gridUpdate:  gridUpdate
        });
    }

    saveReplay() {
        const replayId = `replay-${this.roomId}-${Date.now()}`;
        const replayData = {
            replayId: replayId,
            roomName: this.roomName,
            date: new Date().toISOString(),
            player1Name: (this.players[1] && this.players[1].name) || 'Player 1',
            player2Name: (this.players[2] && this.players[2].name) || 'Player 2',
            frames: this.replayFrames
        };
        replays.set(replayId, replayData);
        console.log(`Saved replay: ${replayId}`);
        return replayId;
    }

    broadcastToViewers(event, data) {
        this.viewers.forEach(socketId => {
            const socket = io.sockets.sockets.get(socketId);
            if (socket) {
                socket.emit(event, data);
            }
        });
    }

    broadcastToPlayers(event, data) {
        Object.values(this.players).forEach(player => {
            if (player. socket) {
                player.socket.emit(event, data);
            }
        });
    }

    broadcastToAll(event, data) {
        this.broadcastToViewers(event, data);
        this.broadcastToPlayers(event, data);
    }

    getRoomInfo() {
        return {
            id: this.roomId,
            name: this.roomName,
            desc: this.roomDesc || "",
            users: Object.keys(this.players).length,
            maxUsers: 2,
            status: this.status
        };
    }
}

// Helper to build a consistent room list payload for web clients
function buildRoomList() {
    return Array.from(activeRooms.values()).map(room => room.getRoomInfo());
}

// HTTP API used by fetchRooms() in entraste.html
app.get("/api/rooms", (req, res) => {
    res.json(buildRoomList());
});

// ============================================
// SOCKET.IO EVENT HANDLERS
// ============================================

function emitRoomUsers(roomId) {
    const room = activeRooms.get(roomId);
    if (!room) return;
    const users = Object.keys(room.players).length;
    io.to(roomId).emit("updateUsers", users);
}

io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.emit('connected', { message: 'Connected to server! ', socketId: socket.id });

    // Get room list
    socket.on('getRoomList', () => {
        const roomList = buildRoomList();
        console.log(`Sending room list to ${socket.id}:`, roomList);
        socket.emit('updateRooms', roomList);
    });

    // Create new room
    socket.on('createRoom', (data) => {
        const { roomName, roomDesc } = data || {};
        const roomId = `room-${Date.now()}`;

        const newRoom = new GameRoom(
            roomId,
            (roomName && String(roomName).trim()) || `Room ${activeRooms.size + 1}`,
            (roomDesc && String(roomDesc).trim()) || ""
        );

        activeRooms.set(roomId, newRoom);

        console.log(`Room created: ${roomId} - ${newRoom.roomName}`);

        // Broadcast updated room list to all clients (THIS is what your HTML should listen to)
        io.emit('updateRooms', buildRoomList());

        socket.emit('roomCreated', { roomId: roomId, roomName: newRoom.roomName });
    });

    // Get replay list
    socket.on('getReplayList', () => {
        const replayList = Array.from(replays.values()).map(replay => ({
            replayId: replay.replayId,
            roomName: replay. roomName,
            date: replay.date,
            player1Name: replay. player1Name,
            player2Name: replay.player2Name
        }));
        console.log(`Sending replay list to ${socket.id}:`, replayList);
        socket.emit('replayList', replayList);
    });

    // Get specific replay data
    socket.on('getReplay', (replayId) => {
        console.log(`Socket ${socket.id} requesting replay: ${replayId}`);
        const replay = replays.get(replayId);
        if (replay) {
            socket.emit('replayData', replay);
        } else {
            socket.emit('error', { message: 'Replay not found' });
        }
    });

    // Join room as viewer (Unity client)
    socket.on('joinRoomAsViewer', (roomId) => {
        console.log(`Socket ${socket.id} wants to join room ${roomId} as viewer`);

        const room = activeRooms.get(roomId);
        if (!room) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }

        // Join the socket. io room
        socket.join(roomId);
        socket.currentRoomId = roomId;

        // Add to room's viewer list
        room.addViewer(socket.id);

        // Send confirmation
        socket.emit('joinedRoom', {
            roomId:  roomId,
            roomName:  room.roomName,
            status: room.status
        });

        // If game is already playing, send grid setup and current state
        if (room.status === 'playing') {
            const p1 = room.players[1];
            const p2 = room.players[2];

            if (p1) {
                socket.emit('gridSetup', {
                    playerId: 1,
                    playerName: p1.name || 'Player 1',
                    sizeX: 6,
                    sizeY: 12
                });
            }

            if (p2) {
                socket.emit('gridSetup', {
                    playerId:  2,
                    playerName: p2.name || 'Player 2',
                    sizeX: 6,
                    sizeY: 12
                });
            }
        }

        // Resume game if it was paused
        if (room.status === 'paused' && Object.keys(room.players).length === 2) {
            room.resumeGame();
        }

        console.log(`Socket ${socket.id} joined room ${roomId} successfully`);
    });

    // Request current grid state (for viewers joining mid-game)
    socket.on('requestGridState', () => {
        const roomId = socket.currentRoomId;
        if (!roomId) return;

        const room = activeRooms.get(roomId);
        if (!room || room.status !== 'playing') return;

        // Send the last recorded frames for each player
        const lastFrames = {};
        room.replayFrames.forEach(frame => {
            lastFrames[frame.playerId] = frame.gridUpdate;
        });

        Object.values(lastFrames).forEach(gridUpdate => {
            if (gridUpdate) {
                socket.emit('gridUpdate', gridUpdate);
            }
        });

        console.log(`Sent current grid state to viewer ${socket.id}`);
    });

    // Join room as player (Web client)
    socket.on('joinRoomAsPlayer', (data) => {
        const { roomId, playerName } = data;
        console.log(`Socket ${socket.id} wants to join room ${roomId} as player: ${playerName}`);

        const room = activeRooms.get(roomId);
        if (!room) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }

        if (Object.keys(room.players).length >= 2) {
            socket.emit('error', { message: 'Room is full' });
            return;
        }

        const playerId = Object.keys(room.players).length === 0 ? 1 : 2;

        socket.join(roomId);
        socket.currentRoomId = roomId;
        socket.playerId = playerId;

        room.addPlayer(playerId, {
            id: playerId,
            name: playerName,
            socket: socket
        });

        socket.emit('playerAssigned', { 
            playerId,
            playerName,
            roomId,
            roomName: room.roomName
        });

        // Update everyone
        io.emit('updateRooms', buildRoomList());
        emitRoomUsers(roomId);
    });

    socket.on('gameInput', (data) => {
    // data = { roomId, playerId, tecla: a,s,w,d }
    const room = activeRooms.get(data.roomId);
    if (room) {
        room.handleInput(data);
    }
  });


    socket.on('leaveRoom', () => {
        const roomId = socket.currentRoomId;
        if (!roomId) return;

        const room = activeRooms.get(roomId);
        if (room) {
            room.removeViewer(socket.id);
            if (socket.playerId) room.removePlayer(socket.playerId);

            io.emit('updateRooms', buildRoomList());
            emitRoomUsers(roomId);
        }

        socket.leave(roomId);
        delete socket.currentRoomId;
        delete socket.playerId;
    });

    socket.on('disconnect', () => {
        const roomId = socket.currentRoomId;
        if (roomId) {
            const room = activeRooms.get(roomId);
            if (room) {
                room.removeViewer(socket.id);
                if (socket.playerId) room.removePlayer(socket.playerId);

                io.emit('updateRooms', buildRoomList());
                emitRoomUsers(roomId);
            }
        }
    });

    // Handle game input (from web players) - placeholder for future implementation
    socket.on('gameInput', (data) => {
        const { roomId, playerId, action } = data;
        console.log(`Player ${playerId} in room ${roomId} pressed:  ${action}`);
        // Future implementation will handle game logic here
    });
});

let PORT = 3000;
http.listen(PORT, '0.0.0.0', () => {
    console.log(`===========================================`);
    console.log(`Server running   on http://0.0.0.0:${PORT}`);
    console.log(`Accessible from host at http://IP:${PORT}`);
    console.log(`Socket.IO ready for connections`);
    console.log(`===========================================`);
});