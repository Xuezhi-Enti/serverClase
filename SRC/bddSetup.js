const mysql = require("mysql");
const { connect } = require("./routes/characters");

const connection = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "user",
    database: "mydb"
})

connection.connect((error) => {

    if(error) throw error;

    console.log("BDD connected!");

    app.set("bdd", connection);


    connection.query("select * from Users", (err, result, fields) => {
        if (err)
            console.log(err)
        else
        {
            console.log("Results:");
            console.log(result);
            console.log(fields);
        }
    })

})