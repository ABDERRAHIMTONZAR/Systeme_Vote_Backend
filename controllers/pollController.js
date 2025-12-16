const db = require("../db/db");
const { notifyVoters } = require("./notifyVoters");

// ✅ Utilitaire pour éviter NOT IN (problèmes si NULL) => on utilise NOT EXISTS
const baseSelect = `
  SELECT
    S.Id_Sondage AS id,
    S.question,
    S.End_time AS end_time,
    S.Etat AS Etat,
    S.Id_user AS user_id,
    S.categorie AS categorie,
    (SELECT COUNT(*) FROM votes V2 WHERE V2.Id_Sondage = S.Id_Sondage) AS voters
  FROM sondages S
`;

exports.getVotedPolls = (req, res) => {
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

  if (categorie) {
    sql += ` AND S.categorie = ?`;
    params.push(categorie);
  }

  sql += ` ORDER BY S.Id_Sondage DESC`;

  db.query(sql, params, (err, result) => {
    if (err) return res.status(500).json(err);
    return res.status(200).json(result);
  });
};

exports.getUnvotedPolls = (req, res) => {
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

  if (categorie) {
    sql += ` AND S.categorie = ?`;
    params.push(categorie);
  }

  sql += ` ORDER BY S.Id_Sondage DESC`;

  db.query(sql, params, (err, result) => {
    if (err) return res.status(500).json(err);
    return res.status(200).json(result);
  });
};

exports.getPollResults = (req, res) => {
  const { id_sondage } = req.body;
  if (!id_sondage) {
    return res.status(400).json({ message: "Tous les champs sont requis." });
  }

  const sql = `
    SELECT
      O.*,
      S.question,
      COUNT(V.Id_Option) AS total
    FROM optionssondage O
    JOIN sondages S ON S.Id_Sondage = O.Id_Sondage
    LEFT JOIN votes V ON V.Id_Option = O.Id_Option
    WHERE O.Id_Sondage = ?
    GROUP BY O.Id_Option, O.option_text, S.question
  `;

  db.query(sql, [id_sondage], (err, result) => {
    if (err) return res.status(500).json(err);
    return res.status(200).json(result);
  });
};

// ✅ IMPORTANT: cette route doit être appelée régulièrement (front ou cron)
exports.autoFinishSondages = (req, res) => {
  const selectSql = `
    SELECT Id_Sondage
    FROM sondages
    WHERE End_time <= NOW()
      AND Etat != 'finished'
  `;

  db.query(selectSql, async (err, results) => {
    if (err) return res.status(500).json({ message: "Erreur serveur" });

    if (!results || results.length === 0) {
      return res.json({ message: "Aucun sondage à terminer", updated: 0 });
    }

    try {
      // notifier avant update
      for (const row of results) {
        await notifyVoters(row.Id_Sondage);
      }

      const updateSql = `
        UPDATE sondages
        SET Etat = 'finished'
        WHERE End_time <= NOW()
          AND Etat != 'finished'
      `;

      db.query(updateSql, (err2, result2) => {
        if (err2) return res.status(500).json({ message: "Erreur serveur" });

        return res.json({
          message: "Mise à jour automatique effectuée et votants notifiés",
          updated: result2.affectedRows,
        });
      });
    } catch (error) {
      return res.status(500).json({ message: "Erreur lors de l'envoi des emails" });
    }
  });
};

exports.getSondageById = (req, res) => {
  const id_sondage = req.params.id_sondage;
  const sql = "SELECT * FROM sondages WHERE Id_Sondage = ?";

  db.query(sql, [id_sondage], (err, result) => {
    if (err) return res.status(500).json({ message: "Erreur serveur" });
    if (!result || result.length === 0) {
      return res.status(404).json({ message: "Sondage non trouvé" });
    }
    return res.json(result[0]);
  });
};

exports.getSondageWithOptions = (req, res) => {
  const id_sondage = req.params.id_sondage;

  const sondageQuery = "SELECT * FROM sondages WHERE Id_Sondage = ?";
  db.query(sondageQuery, [id_sondage], (err, sondageResult) => {
    if (err) return res.status(500).json(err);
    if (!sondageResult || sondageResult.length === 0) {
      return res.status(404).json({ message: "Sondage non trouvé" });
    }

    const sondage = sondageResult[0];

    const optionsQuery =
      "SELECT Id_Option, option_text FROM optionssondage WHERE Id_Sondage = ?";
    db.query(optionsQuery, [id_sondage], (err2, optionsResult) => {
      if (err2) return res.status(500).json(err2);

      sondage.options = optionsResult.map((opt) => ({
        id_option: opt.Id_Option,
        label: opt.option_text,
      }));

      return res.json(sondage);
    });
  });
};

exports.getCategories = (req, res) => {
  const sql = `
    SELECT DISTINCT Categorie
    FROM sondages
    WHERE Categorie IS NOT NULL AND Categorie <> ''
    ORDER BY Categorie ASC
  `;

  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: "Erreur serveur" });
    return res.json(results);
  });
};
