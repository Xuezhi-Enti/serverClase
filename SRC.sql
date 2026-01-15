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
