const db = require("../db/db");
const { notifyVoters } = require("./notifyVoters");

const baseSelect = `
  SELECT
    S.Id_Sondage AS id,
    S.question,
    S.End_time AS end_time,
    S.Etat AS Etat,
    S.Id_user AS user_id,
    S.Categorie AS categorie,
    (SELECT COUNT(*) FROM votes V2 WHERE V2.Id_Sondage = S.Id_Sondage) AS voters
  FROM sondages S
`;


exports.getVotedPolls = async (req, res) => {
  const userId = req.userId;
  const categorie = req.query.categorie;

  const params = [userId];
  let sql = `
    ${baseSelect}
    WHERE EXISTS (
      SELECT 1 FROM votes V
      WHERE V.Id_Sondage = S.Id_Sondage AND V.Id_user = ?
    )
  `;

  if (categorie && categorie !== "All") {
    sql += ` AND S.Categorie = ?`;
    params.push(categorie);
  }

  sql += ` ORDER BY S.Id_Sondage DESC`;

  try {
    const [rows] = await db.query(sql, params);
    return res.status(200).json(rows);
  } catch (err) {
    console.error("getVotedPolls ERROR:", err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
};


exports.getUnvotedPolls = async (req, res) => {
  const userId = req.userId;
  const categorie = req.query.categorie;

  const params = [userId];
  let sql = `
    ${baseSelect}
    WHERE NOT EXISTS (
      SELECT 1 FROM votes V
      WHERE V.Id_Sondage = S.Id_Sondage AND V.Id_user = ?
    )
  `;

  if (categorie && categorie !== "All") {
    sql += ` AND S.Categorie = ?`;
    params.push(categorie);
  }

  sql += ` ORDER BY S.Id_Sondage DESC`;

  try {
    const [rows] = await db.query(sql, params);
    return res.status(200).json(rows);
  } catch (err) {
    console.error("getUnvotedPolls ERROR:", err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
};


exports.getPollResults = async (req, res) => {
  const { id_sondage } = req.body;

  if (!id_sondage) {
    return res.status(400).json({ message: "id_sondage requis." });
  }


  const sql = `
    SELECT
      O.Id_Option,
      O.option_text,
      S.question,
      COUNT(V.Id_Option) AS total
    FROM optionssondage O
    JOIN sondages S ON S.Id_Sondage = O.Id_Sondage
    LEFT JOIN votes V ON V.Id_Option = O.Id_Option
    WHERE O.Id_Sondage = ?
    GROUP BY O.Id_Option, O.option_text, S.question
  `;

  try {
    const [rows] = await db.query(sql, [id_sondage]);
    return res.status(200).json(rows);
  } catch (err) {
    console.error("getPollResults ERROR:", err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
};




exports.runAutoFinish = async (io) => {
  try {
    // Debug temps DB
    const [t] = await db.query("SELECT NOW() AS now, UTC_TIMESTAMP() AS utc, @@session.time_zone AS tz");
    console.log("DB time:", t[0]);

    const [pollsToFinish] = await db.query(`
        SELECT Id_Sondage
    FROM sondages
    WHERE DATE_SUB(End_time, INTERVAL 1 HOUR) <= UTC_TIMESTAMP()
      AND Etat <> 'finished';
    `);

    console.log("pollsToFinish:", pollsToFinish.length);

    if (!pollsToFinish || pollsToFinish.length === 0) return 0;

    let updatedTotal = 0;

    for (const row of pollsToFinish) {
      const pollId = row.Id_Sondage;

      // ✅ finish poll par poll
      const [u] = await db.query(
        `UPDATE sondages
         SET Etat = 'finished'
         WHERE Id_Sondage = ?
           AND Etat != 'finished'`,
        [pollId]
      );

      if ((u.affectedRows || 0) > 0) {
        updatedTotal += u.affectedRows;

        // sockets
        if (io) {
          io.emit("polls:changed");
          io.emit("poll:finished", { pollId });
        }

        // mails
        const r = await notifyVoters(pollId);
        console.log("notifyVoters result:", pollId, r);
      }
    }

    return updatedTotal;
  } catch (err) {
    console.error("runAutoFinish ERROR:", err);
    throw err;
  }
};

/* =========================================================
   AUTO-FINISH ROUTE (debug/manual)
========================================================= */
exports.autoFinishSondages = async (req, res) => {
  try {
    const io = req.app.get("io");
    const updated = await exports.runAutoFinish(io);
    return res.json({ message: "ok", updated });
  } catch (e) {
    console.error("autoFinishSondages ERROR:", e);
    return res.status(500).json({ message: "Erreur serveur", error: e.message });
  }
};


/* =========================================================
   GET SONDAGE BY ID
========================================================= */
exports.getSondageById = async (req, res) => {
  const id_sondage = req.params.id_sondage;

  try {
    const [rows] = await db.query(
      "SELECT * FROM sondages WHERE Id_Sondage = ? LIMIT 1",
      [id_sondage]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: "Sondage non trouvé" });
    }

    return res.json(rows[0]);
  } catch (err) {
    console.error("getSondageById ERROR:", err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
};

/* =========================================================
   GET SONDAGE WITH OPTIONS
========================================================= */
exports.getSondageWithOptions = async (req, res) => {
  const id_sondage = req.params.id_sondage;

  try {
    const [sondageRows] = await db.query(
      "SELECT * FROM sondages WHERE Id_Sondage = ? LIMIT 1",
      [id_sondage]
    );

    if (!sondageRows || sondageRows.length === 0) {
      return res.status(404).json({ message: "Sondage non trouvé" });
    }

    const sondage = sondageRows[0];

    const [optionsRows] = await db.query(
      "SELECT Id_Option, option_text FROM optionssondage WHERE Id_Sondage = ?",
      [id_sondage]
    );

    sondage.options = (optionsRows || []).map((opt) => ({
      id_option: opt.Id_Option,
      label: opt.option_text,
    }));

    return res.json(sondage);
  } catch (err) {
    console.error("getSondageWithOptions ERROR:", err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
};

/* =========================================================
   GET CATEGORIES
========================================================= */
exports.getCategories = async (req, res) => {
  const sql = `
    SELECT DISTINCT Categorie
    FROM sondages
    WHERE Categorie IS NOT NULL AND Categorie <> ''
    ORDER BY Categorie ASC
  `;

  try {
    const [rows] = await db.query(sql);
    return res.json(rows);
  } catch (err) {
    console.error("getCategories ERROR:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};
