USE mydb;

DELIMITER //
CREATE PROCEDURE sp_register_user(IN p_username VARCHAR(255), IN p_password VARCHAR(255))
BEGIN
    INSERT INTO users (username, password) VALUES (p_username, p_password);
END //

CREATE PROCEDURE sp_login_user(IN p_username VARCHAR(255))
BEGIN
    SELECT * FROM users WHERE username = p_username;
END //

DELIMITER ;