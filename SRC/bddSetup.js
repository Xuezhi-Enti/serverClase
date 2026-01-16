const mysql = require("mysql");

const connection = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "user",
    database: "mydb"
});

connection.connect((error) => {
    if(error) {
        console.error("Error conectando a la base de datos:", error);
        throw error;
    }

    console.log("BDD connected!");

    connection.query("SELECT * FROM users", (err, result, fields) => {
        if (err) {
            console.log("Error en query inicial:", err);
        } else {
            console.log("Usuarios en la base de datos:");
            console.log(result);
        }
    });
});

module.exports = connection;