const db =require("../db/db.js");

// -------------------------
// 1) Dashboard Stats
// -------------------------
exports.getDashboardStats = (req, res) => {
  const userId = req.userId;

  const sql = `
        SELECT 
            (SELECT COUNT(*) FROM sondages WHERE Id_user = ?) AS total_polls,
            (SELECT COUNT(*) FROM sondages WHERE Id_user = ? AND Etat = 'Actif') AS active_polls,
            (SELECT COUNT(*) FROM sondages WHERE Id_user = ? AND Etat = 'finished') AS finished_polls,
            (SELECT COUNT(DISTINCT V.Id_user)
             FROM votes V
             JOIN sondages S ON V.Id_Sondage = S.Id_Sondage
             WHERE S.Id_user = ?) AS total_unique_voters
    `;

  db.query(sql, [userId, userId, userId, userId], (err, results) => {
    if (err) {
      console.error("Erreur SQL :", err);
      return res.status(500).json({ error: "Erreur serveur" });
    }

    const stats = results[0];
    console.log(results)
    return res.status(200).json({
      total_polls: stats.total_polls,
      active_polls: stats.active_polls,
      finished_polls: stats.finished_polls,
      total_unique_voters: stats.total_unique_voters,
    });
  });
};

// -------------------------
// 2) Monthly Stats
// -------------------------
exports.getMonthlyStats = (req, res) => {
  const userId = req.userId;

  const sql = `
        SELECT 
            MONTH(S.date_creation) AS month,
            COUNT(S.Id_Sondage) AS polls,
            (
                SELECT COUNT(DISTINCT V.Id_user)
                FROM votes V
                WHERE V.Id_Sondage IN (
                    SELECT Id_Sondage 
                    FROM sondages 
                    WHERE Id_user = ?
                )
                AND MONTH(V.date_vote) = MONTH(S.date_creation)
            ) AS visitors
        FROM sondages S
        WHERE S.Id_user = ?
        GROUP BY MONTH(S.date_creation)
        ORDER BY MONTH(S.date_creation);
    `;

  db.query(sql, [userId, userId], (err, results) => {
    if (err) return res.status(500).json(err);

    const months = [
      "Jan","Feb","Mar","Apr","May","Jun",
      "Jul","Aug","Sep","Oct","Nov","Dec"
    ];

    const finalData = months.map((m) => ({
      month: m,
      polls: 0,
      visitors: 0,
    }));

    results.forEach((row) => {
      const index = row.month - 1;
      finalData[index].polls = row.polls;
      finalData[index].visitors = row.visitors || 0;
    });

    res.json(finalData);
  });
};

// -------------------------
// 3) Poll Status Distribution
// -------------------------
exports.getPollStatusDistribution = (req, res) => {
  const userId = req.userId;

  const sql = `
        SELECT
            SUM(CASE WHEN Etat = 'Actif' THEN 1 ELSE 0 END) AS active,
            SUM(CASE WHEN Etat = 'finished' THEN 1 ELSE 0 END) AS finished
        FROM sondages
        WHERE Id_user = ?
    `;

  db.query(sql, [userId], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result[0]);
  });
};

// -------------------------
// 4) Voter Engagement
// -------------------------
exports.getVoterEngagementDistribution = (req, res) => {
  const userId = req.userId;

  const sql = `
        SELECT Id_user, COUNT(*) AS votes
        FROM votes
        WHERE Id_Sondage IN (SELECT Id_Sondage FROM sondages WHERE Id_user = ?)
        GROUP BY Id_user
    `;

  db.query(sql, [userId], (err, rows) => {
    if (err) return res.status(500).json(err);

    let low = 0, medium = 0, high = 0;

    rows.forEach((row) => {
      if (row.votes <= 2) low++;
      else if (row.votes <= 10) medium++;
      else high++;
    });

    res.json({ low, medium, high });
  });
};

// -------------------------
// 5) CREATE POLL (VERSION CALLBACKS)
// -------------------------
exports.createPoll = (req, res) => {
  console.log("BODY REÇU :", req.body);

  const { question, categorie, endDateTime, options } = req.body;

  if (!question || !categorie || !endDateTime || !options || options.length < 2) {
    return res.status(400).json({ message: "Champs manquants." });
  }

  const userId = req.userId;

  const endTime = new Date(endDateTime);

  if (isNaN(endTime.getTime())) {
    return res.status(400).json({ message: "Date de fin invalide." });
  }

  const pollSQL = `
    INSERT INTO sondages (question, End_time, Etat, Id_user, Categorie)
    VALUES (?, ?, 'Actif', ?, ?)
  `;

  db.query(pollSQL, [question, endTime, userId, categorie], (err, pollResult) => {
    if (err) {
      console.error("Erreur sondage :", err);
      return res.status(500).json({ message: "Erreur serveur." });
    }

    const pollId = pollResult.insertId;

    const values = options.map(opt => [opt, pollId]);

    const optionSQL = `
      INSERT INTO optionssondage (option_text, id_sondage)
      VALUES ?
    `;

    db.query(optionSQL, [values], (err2) => {
      if (err2) {
        console.error("Erreur options :", err2);
        return res.status(500).json({ message: "Erreur serveur." });
      }

      res.status(201).json({
        message: "Poll créé avec succès",
        pollId
      });
    });
  });
};



exports.getAllPolls = (req, res) => {
  const userId = req.userId;

  const sql = `
SELECT 
  Id_Sondage,
  question,
  Categorie,
  Etat,
  date_creation,
  End_time
FROM sondages
WHERE Id_user = ?
ORDER BY date_creation DESC
  `;

  db.query(sql, [userId], (err, results) => {
    if (err) return res.status(500).json(err);

    const formatted = results.map(poll => {
      const now = new Date();
      const end = new Date(poll.End_time);
      const created = new Date(poll.date_creation);

      return {
        id: poll.Id_Sondage,
        question: poll.question,
        category: poll.Categorie,  
        createdOn: created.toISOString().split("T")[0],
        endsOn: end.toISOString().split("T")[0],
        status: end > now ? "Active" : "Ended"
      };
    });

    res.json(formatted);
  });
};

exports.updatePoll = (req, res) => {
  const { question, Categorie, End_time } = req.body;
  const id = req.params.id;

  if (!question || !Categorie || !End_time) {
    return res.status(400).json({ message: "Champs manquants." });
  }

  const checkSQL = `SELECT End_time FROM sondages WHERE Id_Sondage = ?`;

  db.query(checkSQL, [id], (err, rows) => {
    if (err) return res.status(500).json(err);
    if (rows.length === 0) return res.status(404).json({ message: "Sondage introuvable." });

    const now = new Date();
    const end = new Date(rows[0].End_time);

    if (end < now) {
      return res.status(403).json({ message: "Impossible de modifier un sondage terminé." });
    }

    const sql = `
      UPDATE sondages 
      SET question = ?, Categorie = ?, End_time = ?
      WHERE Id_Sondage = ?
    `;

    db.query(sql, [question, Categorie, End_time, id], (err2) => {
      if (err2) return res.status(500).json(err2);

      res.json({ message: "Sondage mis à jour avec succès !" });
    });
  });
};

exports.deletePoll = (req, res) => {
  const pollId = req.params.id;
  const userId = req.userId;

  const checkSQL = "SELECT * FROM sondages WHERE Id_Sondage = ? AND Id_user = ?";
  db.query(checkSQL, [pollId, userId], (err, rows) => {
    if (err) return res.status(500).json(err);

    if (rows.length === 0) {
      return res.status(403).json({ message: "Vous ne pouvez pas supprimer ce sondage." });
    }

    const deleteVotesSQL = "DELETE FROM votes WHERE Id_Sondage = ?";
    db.query(deleteVotesSQL, [pollId], (err2) => {
      if (err2) return res.status(500).json(err2);

      const deleteOptionsSQL = "DELETE FROM optionssondage WHERE Id_Sondage = ?";
      db.query(deleteOptionsSQL, [pollId], (err3) => {
        if (err3) return res.status(500).json(err3);

        const deletePollSQL = "DELETE FROM sondages WHERE Id_Sondage = ?";
        db.query(deletePollSQL, [pollId], (err4) => {
          if (err4) return res.status(500).json(err4);

          res.json({ message: "Sondage supprimé avec succès." });
        });
      });
    });
  });
};


