const mysql = require("mysql2");

const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "projetnode"
});

db.connect((err) => {
    if (err) {
        console.error("Erreur connexion DB :", err);
    } else {
        console.log("Connexion réussie");
    }
});

module.exports = db;
