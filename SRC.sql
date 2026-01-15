CREATE DATABASE IF NOT EXISTS mydb CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE mydb;
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO users (username, password) 
VALUES ('testuser', '$2a$10$uB5A5yGf4q7Cjl0pzXKpeOwlmM1hR.z3VpCviM2sZk4xo6t5r6LQK');

SELECT id, username, created_at FROM users;

CREATE TABLE games (
    id INT AUTO_INCREMENT PRIMARY KEY,
    room_name VARCHAR(100) NOT NULL,
    player1_id INT NOT NULL,
    player1_name VARCHAR(50) NOT NULL,
    player2_id INT,
    player2_name VARCHAR(50),
    status ENUM('waiting', 'playing', 'finished') DEFAULT 'waiting',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player1_id) REFERENCES users(id)
);