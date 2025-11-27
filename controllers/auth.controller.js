let bcrypt=require('bcrypt')
let db = require('../db/db'); 
 let jwt=require('jsonwebtoken')
 
 
exports.createUser=async (req, res, next)=> {
    const {name,prenom, email, password} = req.body;
    if(!name || !email || !password || !prenom){
       console.error("Les champs sont  vides")
      return res.status(400).send("Les champs sont vides")
    }
    let passwordCrypte=await bcrypt.hash(password,10)
    let sql="insert into utilisateur(nom,prenom,email,password,date_creation) values(?, ?, ?, ?, ?)";
    db.query(sql,[name,prenom, email, passwordCrypte,new Date()],(err, result)=> {
       if(err){
        console.error(err)
        return res.status(400).send(err)
       }
       return res.status(200).send("L'utilisateur est crée avec succes")
    })
};


exports.loginUser = async (req, res) => {
    const { email, password } = req.body;
    console.log(email, password)
    if (!email || !password) {
        return res.status(400).json({ message: "Les champs sont vides" });
    }

    let sql = "SELECT * FROM utilisateur WHERE email = ?";
    
    db.query(sql, [email], async (err, result) => { 
        if (err) { 
            return res.status(500).json({ message: "Erreur serveur", error: err });
        }

        if (result.length === 0) {
            return res.status(400).json({ message: "Email introuvable" });
        }

        const user = result[0];

        const correct = await bcrypt.compare(password, user.Password);

        if (!correct) {
            return res.status(400).json({ message: "Mot de passe incorrect" });
        }

        const token = jwt.sign({
                id: user.Id_user,
                nom: user.nom,
                prenom: user.prenom
            },
            "SECRET_KEY",
            { expiresIn: "1h" }
        );

        return res.status(200).json({
            message: "Authentification réussie",
            token: token,
        });
    });
};
