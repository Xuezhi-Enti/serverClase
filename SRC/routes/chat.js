var mysql = require('mysql');
var io = require('socket.io')(3000);


var con = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "user",
  database: "ChatBddTutorial"
});

con.connect(function(err) {
  if (err) {
    console.log("Error al conectar a MySQL:", err);
    return;
  }
  console.log("Connected to MySQL!");
});

io.on("connection", (socket) => {
  console.log("Cliente conectado");

  socket.on("loginRequest", (loginData) => {
    const sql = "SELECT * FROM Login WHERE username = ? AND password = ?";
    con.query(sql, [loginData.username, loginData.password], (err, results) => {
      if (err) {
        socket.emit("LoginResponse", { status: "error", messageContainer: "Error en la base de datos" });
      } else if (results.length > 0) {
        socket.emit("LoginResponse", { status: "ok", messageContainer: "" });
      } else {
        socket.emit("LoginResponse", { status: "error", messageContainer: "Usuario o contraseña incorrecta" });
      }
    });
  });

});
