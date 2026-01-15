// chat.js
var mysql = require('mysql');

var con = mysql.createConnection({
  host: "localhost",        // Usamos el puerto por defecto
  user: "root",
  password: "user", // <-- pon aquí tu contraseña real
  database: "ChatBddTutorial"
});

con.connect(function(err) {
  if (err) {
    console.log("Error al conectar a MySQL:");
    console.log(err);
    return;
  }

  console.log("Connected!");

  con.query("SELECT * FROM Users", function (err, result, fields) {
    if (err) {
      console.log("Error en la consulta:");
      console.log(err);
    } else {
      console.log("Resultado de la tabla Users:");
      console.log(result);
    }

    // Cerramos la conexión
    con.end();
  });
});
