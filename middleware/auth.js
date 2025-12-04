const jwt = require("jsonwebtoken");

exports.auth = (req, res, next) => {
    const header = req.headers.authorization;

    if (!header) return res.status(401).send("Token manquant");

    const token = header.split(" ")[1];

    jwt.verify(token, "SECRET_KEY", (err, decoded) => {
        if (err) return res.status(401).send("Token invalide");
console.log("TOKEN RECU =", token);
console.log("SECRET KEY =", "SECRET_KEY");
        req.userId = decoded.id; 
        next();
    });
};