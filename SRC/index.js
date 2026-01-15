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

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public/chat.html"));
});

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

app.get("/entraste.html", (req, res, next) => {
    if (!req.session.userId) return res.redirect("/chat.html");
    next();
}, (req, res) => {
    res.sendFile(path.join(__dirname, "public/entraste.html"));
});

app.get("/users", (req, res) => {
    connection.query("SELECT id, username, created_at FROM users", (err, results) => {
        if (err) return res.json({ status: "error", message: "Error en la base de datos" });
        res.json(results);
    });
});

let PORT = 3000;

function startServer(port) {
    const server = app.listen(port, () => {
        console.log(`Servidor corriendo en http://localhost:${port}`);
    });

    server.on("error", (err) => {
        if (err.code === "EADDRINUSE") {
            console.log(`Puerto ${port} en uso, intentando con ${port + 1}...`);
            PORT = port + 1;
            startServer(PORT);
        } else {
            console.error(err);
        }
    });
}

startServer(PORT);
