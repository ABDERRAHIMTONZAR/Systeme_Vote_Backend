let db = require("../db/db");

exports.insertVote = (req, res) => {
  console.log("insertVote");
  const userId = req.userId;
  const { id_sondage, id_option } = req.body;

  if (!id_sondage || !id_option) {
    return res.status(400).json({ message: "Tous les champs sont requis." });
  }

  const sql = `
    INSERT INTO votes (Id_user, Id_Sondage, Id_Option, date_vote)
    VALUES (?, ?, ?, ?)
  `;

  db.query(sql, [userId, id_sondage, id_option, new Date()], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json(err);
    }

    // ✅ AJOUT: notifier toutes les pages (temps réel)
    const io = req.app.get("io");
    if (io) {
      io.emit("polls:changed");
      console.log("📢 emitted polls:changed (vote)");
    }

    return res.status(200).json(result);
  });
};
