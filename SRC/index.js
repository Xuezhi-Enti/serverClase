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
    resave: false,
    saveUninitialized: true
}));
app.use(express.static(path.join(__dirname, "public")));

const connection = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "user",
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
            res.json({ status: "ok", message: "Usuario registrado. Ahora inicia sesión." });
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

// Simple Room class for testing
class SimpleGameRoom {
    constructor(roomId, roomName) {
        this.roomId = roomId;
        this.roomName = roomName;
        this.players = {}; // { 1: {id, name, socket}, 2: {id, name, socket} }
        this.viewers = []; // Array of socket IDs
        this.status = 'waiting'; // 'waiting', 'playing', 'paused', 'finished'
        this.replayFrames = []; // Store frames for replay
        this.gameStartTime = null;
    }

    addViewer(socketId) {
        if (!this.viewers.includes(socketId)) {
            this.viewers.push(socketId);
            console.log(`Viewer ${socketId} joined room ${this.roomId}. Total viewers: ${this.viewers.length}`);
        }
    }

    removeViewer(socketId) {
        this.viewers = this.viewers.filter(id => id !== socketId);
        console.log(`Viewer ${socketId} left room ${this.roomId}. Total viewers: ${this.viewers.length}`);

        // Pause game if no viewers
        if (this.viewers.length === 0 && this.status === 'playing') {
            this.pauseGame();
        }
    }

    addPlayer(playerId, playerData) {
        this.players[playerId] = playerData;
        console.log(`Player ${playerId} joined room ${this.roomId}`);

        // Start game if we have 2 players and at least 1 viewer
        if (Object.keys(this.players).length === 2 && this.viewers.length > 0) {
            this.startGame();
        }
    }

    startGame() {
        this.status = 'playing';
        this.gameStartTime = Date.now();
        console.log(`Game started in room ${this.roomId}`);

        // Send grid setup to all viewers for player 1
        const p1 = this.players[1];
        const gridSetup1 = {
            playerId: 1,
            playerName: (p1 && p1.name) || 'Player 1',
            sizeX: 6,
            sizeY: 12
        };
        this.broadcastToViewers('gridSetup', gridSetup1);

        // Send grid setup for player 2 if exists
        const p2 = this.players[2];
        if (p2) {
            const gridSetup2 = {
                playerId: 2,
                playerName: p2.name || 'Player 2',
                sizeX: 6,
                sizeY: 12
            };
            this.broadcastToViewers('gridSetup', gridSetup2);
        }

        // Send test grid update after 2 seconds
        setTimeout(() => {
            this.sendTestGridUpdate();
        }, 2000);
    }

    pauseGame() {
        this.status = 'paused';
        console.log(`Game paused in room ${this.roomId}`);
        this.broadcastToAll('gamePaused', { reason: 'No viewers connected' });
    }

    resumeGame() {
        if (this.viewers.length > 0) {
            this.status = 'playing';
            console.log(`Game resumed in room ${this.roomId}`);
            this.broadcastToAll('gameResumed', {});
        }
    }

    sendTestGridUpdate() {
        if (this.status !== 'playing') return;

        const gridUpdate = {
            playerId: 1,
            playerName: (this.players[1] && this.players[1].name) || 'Player 1',
            updatedNodes: [
                { x: 0, y: 0, type: 1 },
                { x: 1, y: 0, type: 2 },
                { x: 2, y: 0, type: 3 },
                { x: 0, y: 1, type: 4 },
                { x: 1, y: 1, type: 5 },
                { x: 2, y: 1, type: 6 },
                { x: 3, y: 2, type: 1 },
                { x: 4, y: 2, type: 2 },
                { x: 5, y: 2, type: 3 }
            ]
        };

        // Record frame for replay
        this.recordFrame(1, gridUpdate);

        console.log(`Sending test grid update to room ${this.roomId}`);
        this.broadcastToViewers('gridUpdate', gridUpdate);

        // Send another update in 3 seconds
        setTimeout(() => {
            this.sendAnotherTestUpdate();
        }, 3000);
    }

    sendAnotherTestUpdate() {
        if (this.status !== 'playing') return;

        const gridUpdate = {
            playerId: 1,
            playerName: (this.players[1] && this.players[1].name) || 'Player 1',
            updatedNodes: [
                { x: 0, y: 5, type: 2 },
                { x: 1, y: 5, type: 2 },
                { x: 2, y: 5, type: 2 },
                { x: 3, y: 6, type: 5 },
                { x: 4, y: 6, type: 5 },
                { x: 5, y: 6, type: 5 }
            ]
        };

        // Record frame for replay
        this.recordFrame(1, gridUpdate);

        console.log(`Sending second test update to room ${this.roomId}`);
        this.broadcastToViewers('gridUpdate', gridUpdate);
    }

    recordFrame(playerId, gridUpdate) {
        const timestamp = (Date.now() - this.gameStartTime) / 1000; // seconds since game start
        this.replayFrames.push({
            timestamp: timestamp,
            playerId: playerId,
            gridUpdate: gridUpdate
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
            if (player.socket) {
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
            roomId: this.roomId,
            roomName: this.roomName,
            playerCount: Object.keys(this.players).length,
            maxPlayers: 2,
            status: this.status
        };
    }
}

// Create test rooms on startup
function createTestRooms() {
    const testRoom1 = new SimpleGameRoom('room-1', 'Test Room 1');
    const testRoom2 = new SimpleGameRoom('room-2', 'Test Room 2');
    const testRoom3 = new SimpleGameRoom('room-3', 'Test Room 3');

    // Add fake players to room 1
    testRoom1.addPlayer(1, { id: 1, name: 'Player 1', socket: null });

    activeRooms.set('room-1', testRoom1);
    activeRooms.set('room-2', testRoom2);
    activeRooms.set('room-3', testRoom3);

    // Create sample replays
    createSampleReplays();

    console.log('Created 3 test rooms');
}

function createSampleReplays() {
    const sampleReplay = {
        replayId: 'replay-sample-1',
        roomName: 'Sample Game',
        date: new Date().toISOString(),
        player1Name: 'Alice',
        player2Name: 'Bob',
        frames: [
            {
                timestamp: 0.0,
                playerId: 1,
                gridUpdate: {
                    playerId: 1,
                    playerName: 'Alice',
                    updatedNodes: [
                        { x: 0, y: 0, type: 1 },
                        { x: 1, y: 0, type: 2 }
                    ]
                }
            },
            {
                timestamp: 1.5,
                playerId: 1,
                gridUpdate: {
                    playerId: 1,
                    playerName: 'Alice',
                    updatedNodes: [
                        { x: 2, y: 0, type: 3 },
                        { x: 3, y: 0, type: 4 }
                    ]
                }
            }
        ]
    };
    replays.set('replay-sample-1', sampleReplay);
}

createTestRooms();

// ============================================
// SOCKET.IO EVENT HANDLERS
// ============================================

io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Send welcome message
    socket.emit('connected', { message: 'Connected to server!', socketId: socket.id });

    // Get room list
    socket.on('getRoomList', () => {
        const roomList = Array.from(activeRooms.values()).map(room => room.getRoomInfo());
        console.log(`Sending room list to ${socket.id}:`, roomList);
        socket.emit('roomList', roomList);
    });

    // Get replay list
    socket.on('getReplayList', () => {
        const replayList = Array.from(replays.values()).map(replay => ({
            replayId: replay.replayId,
            roomName: replay.roomName,
            date: replay.date,
            player1Name: replay.player1Name,
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

        // Join the socket.io room
        socket.join(roomId);
        socket.currentRoomId = roomId;

        // Add to room's viewer list
        room.addViewer(socket.id);

        // Send confirmation
        socket.emit('joinedRoom', {
            roomId: roomId,
            roomName: room.roomName,
            status: room.status
        });

        // If game is already playing, send grid setup
        if (room.status === 'playing' || Object.keys(room.players).length > 0) {
            const p1 = room.players[1];
            socket.emit('gridSetup', {
                playerId: 1,
                playerName: (p1 && p1.name) || 'Player 1',
                sizeX: 6,
                sizeY: 12
            });

            const p2 = room.players[2];
            if (p2) {
                socket.emit('gridSetup', {
                    playerId: 2,
                    playerName: p2.name || 'Player 2',
                    sizeX: 6,
                    sizeY: 12
                });
            }
        }

        // Resume game if it was paused
        if (room.status === 'paused') {
            room.resumeGame();
        }

        console.log(`Socket ${socket.id} joined room ${roomId} successfully`);
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

        // Determine player ID
        const playerId = Object.keys(room.players).length === 0 ? 1 : 2;

        if (playerId > 2) {
            socket.emit('error', { message: 'Room is full' });
            return;
        }

        // Join the socket.io room
        socket.join(roomId);
        socket.currentRoomId = roomId;
        socket.playerId = playerId;

        // Add to room's player list
        room.addPlayer(playerId, {
            id: playerId,
            name: playerName,
            socket: socket
        });

        // Send confirmation
        socket.emit('playerAssigned', { playerId, playerName });

        // Broadcast to room
        io.to(roomId).emit('playerJoined', {
            playerId,
            playerName
        });

        console.log(`Player ${playerName} joined room ${roomId} as Player ${playerId}`);
    });

    // Leave room
    socket.on('leaveRoom', () => {
        const roomId = socket.currentRoomId;
        if (!roomId) return;

        console.log(`Socket ${socket.id} leaving room ${roomId}`);

        const room = activeRooms.get(roomId);
        if (room) {
            // Remove from viewers
            room.removeViewer(socket.id);

            // Remove from players if applicable
            if (socket.playerId) {
                delete room.players[socket.playerId];
                io.to(roomId).emit('playerLeft', { playerId: socket.playerId });
            }
        }

        socket.leave(roomId);
        delete socket.currentRoomId;
        delete socket.playerId;
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);

        const roomId = socket.currentRoomId;
        if (roomId) {
            const room = activeRooms.get(roomId);
            if (room) {
                room.removeViewer(socket.id);

                if (socket.playerId) {
                    delete room.players[socket.playerId];
                    io.to(roomId).emit('playerLeft', { playerId: socket.playerId });
                }
            }
        }
    });

    // Handle game input (from web players)
    socket.on('gameInput', (data) => {
        const { roomId, playerId, action } = data;
        console.log(`Player ${playerId} in room ${roomId} pressed: ${action}`);

        // For now, just log it
        // Later this will be handled by GameRoom logic
    });
});

let PORT = 3000;
http.listen(PORT, () => {
    console.log(`===========================================`);
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Socket.IO ready for connections`);
    console.log(`Test rooms created: room-1, room-2, room-3`);
    console.log(`===========================================`);
});