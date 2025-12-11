const bcrypt = require("bcrypt");
const db = require("../db/db");

exports.getUserById = (req, res) => {
  const userId = req.userId;

  const sql = "SELECT Id_user, Nom, Prenom, Email FROM utilisateur WHERE Id_user = ?";

  db.query(sql, [userId], (err, result) => {
    if (err) return res.status(500).json({ message: "Erreur serveur" });

    if (result.length === 0)
      return res.status(404).json({ message: "Utilisateur introuvable" });

    res.json(result[0]);
  });
};


exports.updateUser = async (req, res) => {
  const userId = req.userId;
  const { nom, prenom, email, password } = req.body;

  let sql, params;

  try {
    // Si l'utilisateur veut changer le mot de passe
    if (password && password.trim() !== "") {
      const hashedPassword = await bcrypt.hash(password, 10);

      sql = `
        UPDATE utilisateur
        SET Nom = ?, Prenom = ?, Email = ?, Password = ?
        WHERE Id_user = ?
      `;
      params = [nom, prenom, email, hashedPassword, userId];

    } else {
      // Mise à jour sans mot de passe
      sql = `
        UPDATE utilisateur
        SET Nom = ?, Prenom = ?, Email = ?
        WHERE Id_user = ?
      `;
      params = [nom, prenom, email, userId];
    }

    db.query(sql, params, (err) => {
      if (err) {
        console.log(err);
        return res.status(500).json({ message: "Erreur lors de la mise à jour" });
      }

      return res.json({ message: "Profil mis à jour avec succès !" });
    });

  } catch (error) {
    return res.status(500).json({ message: "Erreur serveur" });
  }
};
