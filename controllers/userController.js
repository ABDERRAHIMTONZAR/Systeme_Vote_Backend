const bcrypt = require("bcrypt");
const db = require("../db/db");

// helpers: supporte Nom/nom, Email/email, Password/password...
function pick(row, keys) {
  for (const k of keys) {
    if (row && row[k] !== undefined && row[k] !== null) return row[k];
  }
  return undefined;
}

exports.getUserById = async (req, res) => {
  const userId = req.userId;

  try {
    const [rows] = await db.query(
      "SELECT * FROM utilisateur WHERE Id_user = ? LIMIT 1",
      [userId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: "Utilisateur introuvable" });
    }

    const u = rows[0];

    // renvoyer un format stable au frontend
    return res.json({
      Id_user: pick(u, ["Id_user", "id_user", "id"]),
      Nom: pick(u, ["Nom", "nom"]),
      Prenom: pick(u, ["Prenom", "prenom"]),
      Email: pick(u, ["Email", "email"]),
    });
  } catch (err) {
    console.error("getUserById ERROR:", err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
};

exports.updateUser = async (req, res) => {
  const userId = req.userId;
  const { nom, prenom, email, password } = req.body;

  if (!nom || !prenom || !email) {
    return res.status(400).json({ message: "nom, prenom, email requis" });
  }

  try {
    // 1) vérifier que user existe
    const [exists] = await db.query(
      "SELECT 1 FROM utilisateur WHERE Id_user = ? LIMIT 1",
      [userId]
    );

    if (!exists || exists.length === 0) {
      return res.status(404).json({ message: "Utilisateur introuvable" });
    }

    // 2) update
    if (password && password.trim() !== "") {
      const hashedPassword = await bcrypt.hash(password, 10);

      // ⚠️ IMPORTANT: dans ton projet tu utilises souvent colonnes en minuscule
      // Je mets une version "minuscule" (recommandé). Si ta DB est en Majuscule, dis-moi et je l’adapte.
      await db.query(
        `UPDATE utilisateur
         SET nom = ?, prenom = ?, email = ?, password = ?
         WHERE Id_user = ?`,
        [nom, prenom, email, hashedPassword, userId]
      );
    } else {
      await db.query(
        `UPDATE utilisateur
         SET nom = ?, prenom = ?, email = ?
         WHERE Id_user = ?`,
        [nom, prenom, email, userId]
      );
    }

    return res.json({ message: "Profil mis à jour avec succès !" });
  } catch (err) {
    console.error("updateUser ERROR:", err);
    return res.status(500).json({ message: "Erreur lors de la mise à jour" });
  }
};

