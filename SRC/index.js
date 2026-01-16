const express = require("express");
const mysql = require("mysql");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const path = require("path");
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: "miSecretoSuperSecreto",
    resave: false,
    saveUninitialized: true,
  })
);
app.use(express.static(path.join(__dirname, "public")));

const connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "user",
  database: "mydb",
});

connection.connect((err) => {
  if (err) {
    console.error("Error conectando a la base de datos:", err);
    return;
  }
  console.log("Base de datos conectada");
});

// RUTAS HTTP

app.post("/auth/register", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.json({ status: "error", message: "Campos vacíos" });

  const hashedPassword = bcrypt.hashSync(password, 10);

  connection.query(
    "INSERT INTO users (username, password) VALUES (?, ?)",
    [username, hashedPassword],
    (err) => {
      if (err) {
        if (err.code === "ER_DUP_ENTRY")
          return res.json({ status: "error", message: "Usuario ya existe" });
        return res.json({ status: "error", message: "Error en la base de datos" });
      }
      res.json({ status: "ok", message: "Usuario registrado.  Ahora inicia sesión." });
    }
  );
});

app.post("/auth/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.json({ status: "error", message: "Campos vacíos" });

  connection.query("SELECT * FROM users WHERE username = ?", [username], (err, results) => {
    if (err) return res.json({ status: "error", message: "Error en la base de datos" });
    if (results.length === 0)
      return res.json({ status: "error", message: "Usuario no encontrado" });

    const user = results[0];
    const match = bcrypt.compareSync(password, user.password);
    if (match) {
      req.session.userId = user.id;
      res.json({ status: "ok", message: "Login correcto" });
    } else {
      res.json({ status: "error", message: "Contraseña incorrecta" });
    }
  });
});

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public/chat.html")));

// SERVIDOR SOCKET.IO PARA SALAS DE JUEGO

const http = require("http").createServer(app);
const { Server } = require("socket.io");
const io = new Server(http, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const Grid = require("./gameLogic/grid");

const activeRooms = new Map();

// Replays (no implemantado)
const replays = new Map();

// Sala de juego: gestiona jugadores, espectadores y el bucle del juego
class GameRoom {
  constructor(roomId, roomName, roomDesc = "") {
    this.roomId = roomId;
    this.roomName = roomName;
    this.roomDesc = roomDesc;

    // Jugadores indexados por id (1 y 2)
    this.players = {};

    // Lista de sockets conectados como espectadores
    this.viewers = [];

    // Estado de la sala: waiting, playing, paused, finished
    this.status = "waiting";

    this.replayFrames = [];
    this.gameStartTime = null;

    this.sizeX = 6;
    this.sizeY = 12;

    // Grids por jugador: {1: Grid, 2: Grid}
    this.grids = {};

    //ultimo input recibido por jugador (para evitar flooding)
    this.pendingInputs = {};

    this.loopHandle = null;
    this.tickMs = 100;
  }

  addViewer(socketId) {
    if (!this.viewers.includes(socketId)) {
      this.viewers.push(socketId);
      console.log(
        `Viewer ${socketId} joined room ${this.roomId}.  Total viewers: ${this.viewers.length}`
      );
    }
  }

  removeViewer(socketId) {
    this.viewers = this.viewers.filter((id) => id !== socketId);
    console.log(
      `Viewer ${socketId} left room ${this.roomId}. Total viewers: ${this.viewers.length}`
    );

    // Pausa la partida si no quedan espectadores
    if (this.viewers.length === 0 && this.status === "playing") {
      this.pauseGame();
    }
  }

  addPlayer(playerId, playerData) {
    this.players[playerId] = playerData;
    console.log(`Player ${playerId} (${playerData.name}) joined room ${this.roomId}`);

    // Notifica a todos que se unio un jugador
    this.broadcastToAll("playerJoined", {
      playerId: playerId,
      playerName: playerData.name,
      playerCount: Object.keys(this.players).length,
    });

    //inicia la partida cuando hay 2 jugadores
    if (Object.keys(this.players).length === 2) {
      this.startGame();
    }
  }

  removePlayer(playerId) {
    const playerName = (this.players[playerId] && this.players[playerId].name) || "Unknown";
    delete this.players[playerId];
    console.log(`Player ${playerId} (${playerName}) left room ${this.roomId}`);

    //Notifica a todos que se fue un jugador
    this.broadcastToAll("playerLeft", {
      playerId: playerId,
      playerName: playerName,
      playerCount: Object.keys(this.players).length,
    });

    //ausa si la partida estaba en curso y quedan menos de 2 jugadores
    if (this.status === "playing" && Object.keys(this.players).length < 2) {
      this.pauseGame();
    }
  }

  startLoop() {
    if (this.loopHandle) return;
    this.loopHandle = setInterval(() => this.tick(), this.tickMs);
    console.log(`Loop started in room ${this.roomId}`);
  }

  stopLoop() {
    if (!this.loopHandle) return;
    clearInterval(this.loopHandle);
    this.loopHandle = null;
    console.log(`Loop stopped in room ${this.roomId}`);
  }

  //Tick del servidor: procesa un input por jugador en cada intervalo
  tick() {
    if (this.status !== "playing") return;

    [1, 2].forEach((playerId) => {
      const input = this.pendingInputs[playerId];
      if (!input) return;

      this.pendingInputs[playerId] = null;

      const grid = this.grids[playerId];
      if (!grid) return;

      const diff = grid.move(input);
      if (!diff) return;

      const playerName =
        (this.players[playerId] && this.players[playerId].name) || `Player ${playerId}`;

      const gridUpdate = {
        playerId,
        playerName,
        updatedNodes: [diff.from, diff.to],
      };

      this.broadcastToViewers("gridUpdate", gridUpdate);
    });
  }

  //Guarda el último input válido (w/a/s/d) para que se procese en el tick
  handleInput(playerId, key) {
    if (this.status !== "playing") return false;
    if (!this.players[playerId]) return false;

    const k = String(key || "").toLowerCase();
    if (!["w", "a", "s", "d"].includes(k)) return false;

    this.pendingInputs[playerId] = k;
    return true;
  }

  //Inicializa los grids de ambos jugadores y envía el estado completo a espectadores
  initializeSingleActiveGrids() {
    this.grids[1] = new Grid(this.sizeX, this.sizeY, 0);
    this.grids[2] = new Grid(this.sizeX, this.sizeY, 0);

    // Activo = naranja
    this.grids[1].setActiveType(5);
    this.grids[2].setActiveType(5);

    [1, 2].forEach((playerId) => {
      const playerName =
        (this.players[playerId] && this.players[playerId].name) || `Player ${playerId}`;
      const full = {
        playerId,
        playerName,
        updatedNodes: this.grids[playerId].toFullUpdatedNodes(),
      };
      this.recordFrame(playerId, full);
      this.broadcastToViewers("gridUpdate", full);
    });
  }

  startGame() {
    if (this.status === "playing") return;

    this.status = "playing";
    this.gameStartTime = Date.now();
    console.log(`Game started in room ${this.roomId}`);

    const p1 = this.players[1];
    const p2 = this.players[2];

    const gridSetup1 = {
      playerId: 1,
      playerName: (p1 && p1.name) || "Player 1",
      sizeX: this.sizeX,
      sizeY: this.sizeY,
    };

    const gridSetup2 = {
      playerId: 2,
      playerName: (p2 && p2.name) || "Player 2",
      sizeX: this.sizeX,
      sizeY: this.sizeY,
    };

    this.broadcastToViewers("gridSetup", gridSetup1);
    this.broadcastToViewers("gridSetup", gridSetup2);

    this.broadcastToPlayers("gameStarted", {
      roomId: this.roomId,
      player1: gridSetup1,
      player2: gridSetup2,
    });

    this.initializeSingleActiveGrids();
    this.startLoop();
  }

  pauseGame() {
    this.status = "paused";
    console.log(`Game paused in room ${this.roomId}`);

    this.stopLoop();
    this.broadcastToAll("gamePaused", { reason: "Not enough players or no viewers" });
  }

  resumeGame() {
    if (this.viewers.length > 0 && Object.keys(this.players).length === 2) {
      this.status = "playing";
      console.log(`Game resumed in room ${this.roomId}`);

      this.startLoop();
      this.broadcastToAll("gameResumed", {});
    }
  }

  recordFrame(playerId, gridUpdate) {
    const timestamp = (Date.now() - this.gameStartTime) / 1000;
    this.replayFrames.push({
      timestamp: timestamp,
      playerId: playerId,
      gridUpdate: gridUpdate,
    });
  }

  saveReplay() {
    const replayId = `replay-${this.roomId}-${Date.now()}`;
    const replayData = {
      replayId: replayId,
      roomName: this.roomName,
      date: new Date().toISOString(),
      player1Name: (this.players[1] && this.players[1].name) || "Player 1",
      player2Name: (this.players[2] && this.players[2].name) || "Player 2",
      frames: this.replayFrames,
    };
    replays.set(replayId, replayData);
    console.log(`Saved replay: ${replayId}`);
    return replayId;
  }

  //envia a todos los espectadores de esta sala
  broadcastToViewers(event, data) {
    this.viewers.forEach((socketId) => {
      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit(event, data);
      }
    });
  }

  //encvia a jugadores de sala
  broadcastToPlayers(event, data) {
    Object.values(this.players).forEach((player) => {
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
      id: this.roomId,
      name: this.roomName,
      desc: this.roomDesc || "",
      users: Object.keys(this.players).length,
      maxUsers: 2,
      status: this.status,
    };
  }
}

// Construye un array consistente con la lista de salas para los clientes web
function buildRoomList() {
  return Array.from(activeRooms.values()).map((room) => room.getRoomInfo());
}

// API HTTP usada por fetchRooms() en entraste.html
app.get("/api/rooms", (req, res) => {
  res.json(buildRoomList());
});

// EVENTOS SOCKET.IO

function emitRoomUsers(roomId) {
  const room = activeRooms.get(roomId);
  if (!room) return;
  const users = Object.keys(room.players).length;
  io.to(roomId).emit("updateUsers", users);
}

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.emit("connected", { message: "Connected to server! ", socketId: socket.id });

  // Solicita lista de salas
  socket.on("getRoomList", () => {
    const roomList = buildRoomList();
    console.log(`Sending room list to ${socket.id}:`, roomList);
    socket.emit("updateRooms", roomList);
  });

  // Crea una nueva sala
  socket.on("createRoom", (data) => {
    const { roomName, roomDesc } = data || {};
    const roomId = `room-${Date.now()}`;

    const newRoom = new GameRoom(
      roomId,
      (roomName && String(roomName).trim()) || `Room ${activeRooms.size + 1}`,
      (roomDesc && String(roomDesc).trim()) || ""
    );

    activeRooms.set(roomId, newRoom);

    console.log(`Room created: ${roomId} - ${newRoom.roomName}`);

    // Notifica a todos la lista de salas actualizada
    io.emit("updateRooms", buildRoomList());

    socket.emit("roomCreated", { roomId: roomId, roomName: newRoom.roomName });
  });


  // Entra a una sala como espectador (cliente Unity)
  socket.on("joinRoomAsViewer", (roomId) => {
    console.log(`Socket ${socket.id} wants to join room ${roomId} as viewer`);

    const room = activeRooms.get(roomId);
    if (!room) {
      socket.emit("error", { message: "Room not found" });
      return;
    }

    // Une el socket a la sala de Socket.IO
    socket.join(roomId);
    socket.currentRoomId = roomId;

    // Registra el espectador en la sala
    room.addViewer(socket.id);

    socket.emit("joinedRoom", {
      roomId: roomId,
      roomName: room.roomName,
      status: room.status,
    });

    //si la partida no esta en curso, envía el setup inicial
    if (room.status === "playing") {
      const p1 = room.players[1];
      const p2 = room.players[2];

      if (p1) {
        socket.emit("gridSetup", {
          playerId: 1,
          playerName: p1.name || "Player 1",
          sizeX: 6,
          sizeY: 12,
        });
      }

      if (p2) {
        socket.emit("gridSetup", {
          playerId: 2,
          playerName: p2.name || "Player 2",
          sizeX: 6,
          sizeY: 12,
        });
      }
    }

    //Si estaba pausada y hay 2 jugadores, reanuda
    if (room.status === "paused" && Object.keys(room.players).length === 2) {
      room.resumeGame();
    }

    console.log(`Socket ${socket.id} joined room ${roomId} successfully`);
  });

  // Envía el estado completo del grid ( en caso de unirse en mitad de partida)
  socket.on("requestGridState", () => {
    const roomId = socket.currentRoomId;
    if (!roomId) return;

    const room = activeRooms.get(roomId);
    if (!room || room.status !== "playing") return;

    [1, 2].forEach((playerId) => {
      const grid = room.grids[playerId];
      if (!grid) return;

      const playerName =
        (room.players[playerId] && room.players[playerId].name) || `Player ${playerId}`;
      socket.emit("gridUpdate", {
        playerId,
        playerName,
        updatedNodes: grid.toFullUpdatedNodes(),
      });
    });
  });

  //Enviar input
  socket.on("gameInput", (data) => {
    console.log("[gameInput]", {
      from: socket.id,
      data,
      socketPlayerId: socket.playerId,
      room: socket.currentRoomId,
    });

    const roomId = (data && data.roomId) || socket.currentRoomId;
    const room = activeRooms.get(roomId);
    if (!room) return;

    const playerId = socket.playerId || (data && data.playerId);
    const key = (data && (data.tecla || data.action || data.key)) || "";

    room.handleInput(Number(playerId), key);
  });

  //Entra a una sala como jugador (cliente web)
  socket.on("joinRoomAsPlayer", (data) => {
    const { roomId, playerName } = data;
    console.log(`Socket ${socket.id} wants to join room ${roomId} as player: ${playerName}`);

    const room = activeRooms.get(roomId);
    if (!room) {
      socket.emit("error", { message: "Room not found" });
      return;
    }

    if (Object.keys(room.players).length >= 2) {
      socket.emit("error", { message: "Room is full" });
      return;
    }

    const playerId = Object.keys(room.players).length === 0 ? 1 : 2;

    socket.join(roomId);
    socket.currentRoomId = roomId;
    socket.playerId = playerId;

    room.addPlayer(playerId, {
      id: playerId,
      name: playerName,
      socket: socket,
    });

    socket.emit("playerAssigned", {
      playerId,
      playerName,
      roomId,
      roomName: room.roomName,
    });

    io.emit("updateRooms", buildRoomList());
    emitRoomUsers(roomId);
  });

  socket.on("leaveRoom", () => {
    const roomId = socket.currentRoomId;
    if (!roomId) return;

    const room = activeRooms.get(roomId);
    if (room) {
      room.removeViewer(socket.id);
      if (socket.playerId) room.removePlayer(socket.playerId);

      io.emit("updateRooms", buildRoomList());
      emitRoomUsers(roomId);
    }

    socket.leave(roomId);
    delete socket.currentRoomId;
    delete socket.playerId;
  });

  socket.on("disconnect", () => {
    const roomId = socket.currentRoomId;
    if (roomId) {
      const room = activeRooms.get(roomId);
      if (room) {
        room.removeViewer(socket.id);
        if (socket.playerId) room.removePlayer(socket.playerId);

        io.emit("updateRooms", buildRoomList());
        emitRoomUsers(roomId);
      }
    }
  });
});

let PORT = 3000;
http.listen(PORT, "0.0.0.0", () => {
  console.log(`===========================================`);
  console.log(`Server running   on http://0.0.0.0:${PORT}`);
  console.log(`Accessible from host at http://IP:${PORT}`);
  console.log(`Socket.IO ready for connections`);
  console.log(`===========================================`);
});