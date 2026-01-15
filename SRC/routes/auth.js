const express = require("express");
const router = express.Router();

const connection = require("../bddSetup"); 

router.post("/register", (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ status: "error", message: "Username o password vacío" });
    }

    const checkSql = "SELECT * FROM Users WHERE username = ?";
    connection.query(checkSql, [username], (err, results) => {
        if (err) return res.status(500).json({ status: "error", message: "Error en DB" });

        if (results.length > 0) {
            return res.json({ status: "error", message: "El usuario ya existe" });
        }

        const insertSql = "INSERT INTO Users (username, password) VALUES (?, ?)";
        connection.query(insertSql, [username, password], (err2, results2) => {
            if (err2) return res.status(500).json({ status: "error", message: "Error al registrar usuario" });

            return res.json({ status: "ok", message: "Usuario registrado correctamente" });
        });
    });
});

router.post("/login", (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ status: "error", message: "Username o password vacío" });
    }

    const sql = "SELECT * FROM Users WHERE username = ? AND password = ?";
    connection.query(sql, [username, password], (err, results) => {
        if (err) return res.status(500).json({ status: "error", message: "Error en DB" });

        if (results.length > 0) {
            return res.json({ status: "ok", message: "Login correcto" });
        } else {
            return res.json({ status: "error", message: "Usuario o contraseña incorrecta" });
        }
    });
});

module.exports = router;
