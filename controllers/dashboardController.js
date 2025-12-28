const db = require("../db/db.js");

/* =========================================================
   DASHBOARD STATS
========================================================= */
exports.getDashboardStats = async (req, res) => {
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

  try {
    const [results] = await db.query(sql, [userId, userId, userId, userId]);
    const stats = results[0] || {};

    return res.status(200).json({
      total_polls: stats.total_polls || 0,
      active_polls: stats.active_polls || 0,
      finished_polls: stats.finished_polls || 0,
      total_unique_voters: stats.total_unique_voters || 0,
    });
  } catch (err) {
    console.error("Erreur SQL getDashboardStats:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};

/* =========================================================
   MONTHLY STATS
========================================================= */
exports.getMonthlyStats = async (req, res) => {
  const userId = req.userId;

  // ✅ 1 seule requête, sans sous-requête corrélée
  // visitors = nombre de votants uniques par mois (sur les sondages du user)
  const sql = `
    SELECT
      MONTH(S.date_creation) AS month,
      COUNT(DISTINCT S.Id_Sondage) AS polls,
      COUNT(DISTINCT V.Id_user) AS visitors
    FROM sondages S
    LEFT JOIN votes V ON V.Id_Sondage = S.Id_Sondage
    WHERE S.Id_user = ?
    GROUP BY MONTH(S.date_creation)
    ORDER BY MONTH(S.date_creation);
  `;

  try {
    const [results] = await db.query(sql, [userId]);

    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const finalData = months.map((m) => ({ month: m, polls: 0, visitors: 0 }));

    results.forEach((row) => {
      const index = Number(row.month) - 1;
      if (index >= 0 && index < 12) {
        finalData[index].polls = Number(row.polls || 0);
        finalData[index].visitors = Number(row.visitors || 0);
      }
    });

    return res.json(finalData);
  } catch (err) {
    console.error("Erreur SQL getMonthlyStats:", err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
};


/* =========================================================
   POLL STATUS DISTRIBUTION
========================================================= */
exports.getPollStatusDistribution = async (req, res) => {
  const userId = req.userId;

  const sql = `
    SELECT
      SUM(CASE WHEN Etat = 'Actif' THEN 1 ELSE 0 END) AS active,
      SUM(CASE WHEN Etat = 'finished' THEN 1 ELSE 0 END) AS finished
    FROM sondages
    WHERE Id_user = ?
  `;

  try {
    const [rows] = await db.query(sql, [userId]);
    return res.json(rows[0] || { active: 0, finished: 0 });
  } catch (err) {
    console.error("Erreur SQL getPollStatusDistribution:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};

/* =========================================================
   VOTER ENGAGEMENT DISTRIBUTION
========================================================= */
exports.getVoterEngagementDistribution = async (req, res) => {
  const userId = req.userId;

  const sql = `
    SELECT Id_user, COUNT(*) AS votes
    FROM votes
    WHERE Id_Sondage IN (SELECT Id_Sondage FROM sondages WHERE Id_user = ?)
    GROUP BY Id_user
  `;

  try {
    const [rows] = await db.query(sql, [userId]);

    let low = 0, medium = 0, high = 0;

    rows.forEach((row) => {
      const v = Number(row.votes || 0);
      if (v <= 2) low++;
      else if (v <= 10) medium++;
      else high++;
    });

    return res.json({ low, medium, high });
  } catch (err) {
    console.error("Erreur SQL getVoterEngagementDistribution:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};

/* =========================================================
   CREATE POLL (transaction + bulk insert)
========================================================= */
exports.createPoll = async (req, res) => {
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

  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    const [pollResult] = await conn.query(
      `INSERT INTO sondages (question, End_time, Etat, Id_user, Categorie)
       VALUES (?, ?, 'Actif', ?, ?)`,
      [question, endTime, userId, categorie]
    );

    const pollId = pollResult.insertId;

    const values = options.map((opt) => [opt, pollId]);

    // ⚠️ selon ton schéma, la colonne c’est id_sondage ou Id_Sondage
    await conn.query(
      `INSERT INTO optionssondage (option_text, id_sondage) VALUES ?`,
      [values]
    );

    await conn.commit();

    // ✅ SOCKET : informer les clients que la liste des polls a changé
    const io = req.app.get("io");
    if (io) io.emit("polls:changed");

    return res.status(201).json({ message: "Poll créé avec succès", pollId });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("Erreur createPoll :", err);
    return res.status(500).json({ message: "Erreur serveur." });
  } finally {
    if (conn) conn.release();
  }
};

/* =========================================================
   GET ALL POLLS
========================================================= */
exports.getAllPolls = async (req, res) => {
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

  try {
    const [results] = await db.query(sql, [userId]);

    const formatted = results.map((poll) => {
      const now = new Date();
      const end = new Date(poll.End_time);
      const created = new Date(poll.date_creation);

      return {
        id: poll.Id_Sondage,
        question: poll.question,
        category: poll.Categorie,
        createdOn: created.toISOString().split("T")[0],
        endsOn: end.toISOString().split("T")[0],
        status: end > now ? "Active" : "Ended",
        etat: poll.Etat,
      };
    });

    return res.json(formatted);
  } catch (err) {
    console.error("Erreur getAllPolls:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};

/* =========================================================
   UPDATE POLL
========================================================= */
exports.updatePoll = async (req, res) => {
  const { question, Categorie, End_time } = req.body;
  const id = req.params.id;

  if (!question || !Categorie || !End_time) {
    return res.status(400).json({ message: "Champs manquants." });
  }

  try {
    const [rows] = await db.query(
      `SELECT End_time FROM sondages WHERE Id_Sondage = ? LIMIT 1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Sondage introuvable." });
    }

    const now = new Date();
    const end = new Date(rows[0].End_time);

    if (end < now) {
      return res.status(403).json({ message: "Impossible de modifier un sondage terminé." });
    }

    await db.query(
      `UPDATE sondages SET question = ?, Categorie = ?, End_time = ? WHERE Id_Sondage = ?`,
      [question, Categorie, End_time, id]
    );

    const io = req.app.get("io");
    if (io) io.emit("polls:changed");

    return res.json({ message: "Sondage mis à jour avec succès !" });
  } catch (err) {
    console.error("Erreur updatePoll:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};

/* =========================================================
   DELETE POLL (transaction)
========================================================= */
exports.deletePoll = async (req, res) => {
  const pollId = req.params.id;
  const userId = req.userId;

  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    const [rows] = await conn.query(
      "SELECT 1 FROM sondages WHERE Id_Sondage = ? AND Id_user = ? LIMIT 1",
      [pollId, userId]
    );

    if (rows.length === 0) {
      await conn.rollback();
      return res.status(403).json({ message: "Vous ne pouvez pas supprimer ce sondage." });
    }

    await conn.query("DELETE FROM votes WHERE Id_Sondage = ?", [pollId]);

    // ⚠️ Dans ton code tu avais Id_Sondage ici, mais dans createPoll tu utilises id_sondage
    // Choisis UNE SEULE convention dans la DB (recommandé: Id_Sondage partout)
    await conn.query("DELETE FROM optionssondage WHERE id_sondage = ?", [pollId]);

    await conn.query("DELETE FROM sondages WHERE Id_Sondage = ?", [pollId]);

    await conn.commit();

    const io = req.app.get("io");
    if (io) io.emit("polls:changed");

    return res.json({ message: "Sondage supprimé avec succès." });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("Erreur deletePoll:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  } finally {
    if (conn) conn.release();
  }
};
