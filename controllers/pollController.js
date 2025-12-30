const db = require("../db/db");
const { notifyVoters } = require("./notifyVoters");

// ⚠️ IMPORTANT : dans ta DB tu utilises parfois Categorie et parfois categorie
// Ici je suppose que la colonne est "Categorie" (comme dans plusieurs de tes autres queries).
// Si ta colonne est réellement "categorie", change S.Categorie -> S.categorie et dans getCategories aussi.
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

/* =========================================================
   GET VOTED POLLS
========================================================= */
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

/* =========================================================
   GET UNVOTED POLLS
========================================================= */
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

/* =========================================================
   GET POLL RESULTS
   ⚠️ mieux: id en params, mais je garde ton body
========================================================= */
exports.getPollResults = async (req, res) => {
  const { id_sondage } = req.body;

  if (!id_sondage) {
    return res.status(400).json({ message: "id_sondage requis." });
  }

  // ⚠️ Ici ton schema est incohérent : optionssondage a parfois Id_Sondage parfois id_sondage
  // Je mets Id_Sondage partout pour être cohérent avec tes autres queries (JOIN, etc.)
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



/* =========================================================
   AUTO-FINISH (reusable)
========================================================= */
exports.runAutoFinish = async (io) => {
  try {
    const selectSql = `
      SELECT Id_Sondage
      FROM sondages
      WHERE End_time <= NOW()
        AND Etat != 'finished'
    `;

    const [pollsToFinish] = await db.query(selectSql);

    console.log("pollsToFinish:", pollsToFinish.length);
    console.log("notifyVoters typeof:", typeof notifyVoters);

    if (!pollsToFinish || pollsToFinish.length === 0) return 0;

    const updateSql = `
      UPDATE sondages
      SET Etat = 'finished'
      WHERE End_time <= NOW()
        AND Etat != 'finished'
    `;

    const [updateResult] = await db.query(updateSql);

    if (io) io.emit("polls:changed");

    const results = await Promise.all(
      pollsToFinish.map((s) => notifyVoters(s.Id_Sondage))
    );
    console.log("notify results:", results);

    return updateResult.affectedRows || 0;
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
