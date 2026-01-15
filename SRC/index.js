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

let rooms = [
    { id: 1, name: "Sala General", desc: "Sala por defecto", users: 0 }
];

app.get("/api/rooms", (req, res) => res.json(rooms));

app.post("/api/rooms", (req, res) => {
    const { name, desc } = req.body;
    if (!name) return res.status(400).send("Nombre requerido");

    const existing = rooms.find(r => r.name === name);
    if (existing) return res.sendStatus(200);

    rooms.push({ id: Date.now(), name, desc, users: 0 });
    res.sendStatus(200);
});

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public/chat.html")));

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

app.get("/entraste.html", (req, res) => res.sendFile(path.join(__dirname, "public/entraste.html")));

app.get("/users", (req, res) => {
    connection.query("SELECT id, username, created_at FROM users", (err, results) => {
        if (err) return res.json({ status: "error", message: "Error en la base de datos" });
        res.json(results);
    });
});

const http = require("http").createServer(app);
const { Server } = require("socket.io");
const io = new Server(http);

io.on("connection", socket => {
    socket.on("joinRoom", roomId => {
        const room = rooms.find(r => r.id == roomId);
        if (!room) return;

        socket.join(roomId);
        room.users++;
        io.to(roomId).emit("updateUsers", room.users);
        io.emit("updateRooms", rooms);

        socket.on("disconnect", () => {
            room.users--;
            io.to(roomId).emit("updateUsers", room.users);
            io.emit("updateRooms", rooms);
        });
    });
});

let PORT = 3000;
http.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));


//SOKETS


const GameRoom = require('./gameLogic/GameRoom');

// Store active rooms
const activeRooms = new Map(); // roomId -> GameRoom instance

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Unity viewer events
  socket.on('getRoomList', () => {
    const roomList = Array.from(activeRooms. values()).map(room => ({
      roomId: room.roomId,
      roomName: room.roomName,
      playerCount: Object.keys(room.players).length,
      maxPlayers: 2,
      status: room.status
    }));
    socket.emit('roomList', roomList);
  });
  
  socket.on('joinRoomAsViewer', (roomId) => {
    const room = activeRooms.get(roomId);
    if (!room) {
      socket.emit('error', 'Room not found');
      return;
    }
    
    socket.join(roomId);
    room.addViewer(socket. id);
    
    // Send grid setup for both players
    Object.entries(room.grids).forEach(([playerId, grid]) => {
      socket.emit('gridSetup', {
        playerId: parseInt(playerId),
        playerName: room.players[playerId]?.name || 'Waiting.. .',
        sizeX: grid.width,
        sizeY: grid.height
      });
      
      // Send current state
      socket.emit('gridUpdate', {
        playerId:  parseInt(playerId),
        playerName: room.players[playerId]?.name || '',
        updatedNodes: grid. getFullState()
      });
    });
    
    // Resume game if it was paused
    if (room.status === 'paused' && room.viewers.length > 0) {
      room.resumeGame();
    }
  });
  
  socket.on('leaveRoom', () => {
    // Find room this socket is in
    activeRooms.forEach(room => {
      room.removeViewer(socket.id);
      
      // Pause game if no viewers
      if (room.viewers.length === 0 && room.status === 'playing') {
        room.pauseGame();
      }
    });
  });
  
  // Web player events
  socket.on('createRoom', (data) => {
    const roomId = Date.now().toString();
    const room = new GameRoom(roomId, data.roomName);
    activeRooms.set(roomId, room);
    
    // Broadcast updated room list
    io.emit('roomList', getRoomList());
    socket.emit('roomCreated', { roomId });
  });
  
  socket.on('joinRoom', (data) => {
    const room = activeRooms.get(data.roomId);
    if (!room) return;
    
    const playerId = Object.keys(room.players).length === 0 ? 1 : 2;
    room.addPlayer(playerId, {
      id: playerId,
      name: data. playerName,
      socket: socket
    });
    
    socket.join(data.roomId);
    socket.emit('playerAssigned', { playerId });
    
    // Notify viewers
    io.to(data.roomId).emit('playerJoined', {
      playerId,
      playerName: data.playerName
    });
    
    // Start game if 2 players
    if (Object.keys(room.players).length === 2) {
      room.startGame();
    }
  });
  
  socket.on('gameInput', (data) => {
    const room = activeRooms.get(data. roomId);
    if (!room) return;
    
    room.handleInput(data.playerId, data.action);
  });
  
  socket.on('disconnect', () => {
    // Handle player/viewer disconnect
    activeRooms.forEach((room, roomId) => {
      // Remove as viewer
      room.removeViewer(socket.id);
      
      // Remove as player
      Object.entries(room.players).forEach(([playerId, player]) => {
        if (player.socket. id === socket.id) {
          room.removePlayer(playerId);
          io.to(roomId).emit('playerLeft', { playerId });
          
          // End game if player leaves
          if (room.status === 'playing') {
            room.endGame();
          }
        }
      });
      
      // Delete empty rooms
      if (Object.keys(room.players).length === 0 && room.viewers.length === 0) {
        activeRooms.delete(roomId);
      }
    });
  });
});
