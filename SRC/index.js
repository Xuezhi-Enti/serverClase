console.log("Hello, World with nodemon");

const express = require("express");

app = express();

require("./SRC/bddSetup");

//settings section
app.set("port", process.env.PORT || 3000);
app.set("json spaces", 2);

//Middlewares

const morgan = require("morgan");
app.use(morgan("dev"));

//express url work set up

app.use(express.urlencoded({extended: false}));
app.use(express.json());

const path = require("path")
app.use(express.static(path.join(__dirname, "public")));


//auxiliar class
const ipHelper = require("ip");

const http = require("http");
const server = http.createServer(app);

const {Server} = require("socket.io");

const io = new Server(server);
app.set("io", io);

app.use(require("./SRC/routes/_routes"));

server.listen(app.get("port"), () => {

    const ip = ipHelper.address();
    const port = app.get("port");

    const url = "http://" + ip + ":" + port + "/";
    console.log("Servidor Arrancado en la url: " + url);
})