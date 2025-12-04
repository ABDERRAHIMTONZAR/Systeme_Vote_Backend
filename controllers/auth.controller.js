const bcrypt = require('bcrypt');
const db = require('../db/db');
const jwt = require('jsonwebtoken');


exports.createUser = async (req, res) => {
    const { nom, prenom, email, password } = req.body;

    if (!nom || !prenom || !email || !password) {
        return res.status(400).json({ message: "Tous les champs sont requis." });
    }

    const checkSql = "SELECT * FROM utilisateur WHERE email = ?";
    db.query(checkSql, [email], async (err, rows) => {
        if (err) return res.status(500).json({ message: "Erreur serveur" });

        if (rows.length > 0) {
            return res.status(400).json({ message: "Cet email est déjà utilisé." });
        }
        const hashedPassword = await bcrypt.hash(password, 10);

        const sql = ` INSERT INTO utilisateur(nom, prenom, email, password, date_creation) VALUES (?, ?, ?, ?, NOW())
        `;

        db.query(sql, [nom, prenom, email, hashedPassword], (err) => {
            if (err) return res.status(500).json({ message: "Erreur serveur" });

            return res.status(201).json({ message: "Utilisateur créé avec succès" });
        });
    });
};


exports.loginUser = (req, res) => {
    const { email, password } = req.body;
console.log("CODE LOGIN OK", req.body);
    if (!email || !password) {
        console.log("Les champs sont vides");
        return res.status(400).json({ message: "Les champs sont vides" });
    } 

    const sql = "SELECT * FROM utilisateur WHERE email = ?";

    db.query(sql, [email], async (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: "Erreur serveur", error: err });
        }

        if (result.length === 0) {
            console.log("Email introuvable");
            return res.status(400).json({ message: "Email introuvable" });
        }

        const user = result[0]; 
 console.log("USER FROM DB =", user);
       const correct = await bcrypt.compare(password, user.password);
        if (!correct) {
            console.log("Mot de passe incorrect");
            return res.status(400).json({ message: "Mot de passe incorrect" });
        }

        const token = jwt.sign(
            {
                id: user.Id_user,
                nom: user.Nom,
                prenom: user.Prenom
            },
            "SECRET_KEY",
            { expiresIn: "2h" }
        );
        console.log("TOKEN =", token);
        return res.status(200).json({
            message: "Authentification réussie",
            token: token
        }); 
    });  
};