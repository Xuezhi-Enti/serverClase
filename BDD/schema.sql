CREATE DATABASE IF NOT EXISTS mydb;
USE mydb;

-- Tabla de usuarios usada en /auth/register y /auth/login
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL
);

-- NOt implemented
CREATE TABLE IF NOT EXISTS replays (
    replayId VARCHAR(255) PRIMARY KEY,
    roomName VARCHAR(255),
    date DATETIME,
    player1Name VARCHAR(255),
    player2Name VARCHAR(255),
    frames JSON
);