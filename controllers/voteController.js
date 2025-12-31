const db = require("../db/db");

exports.insertVote = async (req, res) => {
  console.log("insertVote");

  const userId = req.userId;
  const { id_sondage, id_option } = req.body;

  if (!id_sondage || !id_option) {
    return res.status(400).json({ message: "Tous les champs sont requis." });
  }

  try {
    // ✅ empêcher un user de voter 2 fois sur le même sondage
    const [already] = await db.query(
      "SELECT 1 FROM votes WHERE Id_user = ? AND Id_Sondage = ? LIMIT 1",
      [userId, id_sondage]
    );

    if (already.length > 0) {
      return res.status(409).json({ message: "Vous avez déjà voté pour ce sondage." });
    }

    const sql = `
      INSERT INTO votes (Id_user, Id_Sondage, Id_Option, date_vote)
      VALUES (?, ?, ?, NOW())
    `;

    const [result] = await db.query(sql, [userId, id_sondage, id_option]);

    const io = req.app.get("io");
    if (io) {
      io.emit("polls:changed");
      console.log("📢 emitted polls:changed (vote)");
    }

    return res.status(201).json({ message: "Vote enregistré", insertId: result.insertId });
  } catch (err) {
    console.error("insertVote ERROR:", err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
};