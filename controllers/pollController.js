let db = require("../db/db");
exports.getVotedPolls = (req, res) => {
  const userId = req.userId;
  const categorie = req.query.categorie;

  const params = [userId]; 

  let sql = `
    SELECT 
      S.Id_Sondage AS id,
      S.question,
      S.End_time AS end_time,
      S.Etat AS Etat,          
      S.Id_user AS user_id,
      S.categorie AS categorie,
      (SELECT COUNT(*) FROM votes V2 WHERE V2.Id_Sondage = S.Id_Sondage) AS voters
    FROM sondages S
    WHERE S.Id_Sondage IN (
      SELECT Id_Sondage FROM votes WHERE Id_user = ?
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

  let sql = `
    SELECT 
      S.Id_Sondage AS id,
      S.question,
      S.End_time AS end_time,
      S.Etat AS Etat,
      S.Id_user AS user_id,
      S.categorie AS categorie,
      (
        SELECT COUNT(*) 
        FROM votes V 
        WHERE V.Id_Sondage = S.Id_Sondage
      ) AS voters
    FROM sondages S
    WHERE S.Id_Sondage NOT IN (
      SELECT Id_Sondage FROM votes WHERE Id_user = ?
    )
  `;

  const params = [userId];

  if (categorie) {
    sql += ` AND S.categorie = ? `;
    params.push(categorie);
  }

  sql += ` ORDER BY S.Id_Sondage DESC`;

  db.query(sql, params, (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json(err);
    }

    res.status(200).json(result);
  });
};




exports.getPollResults = (req, res) => {
  const { id_sondage } = req.body;
  if (!id_sondage) {
    return res.status(400).json({ message: "Tous les champs sont requis." });
  }
                                                                                                                     
  let sql = `SELECT O.*,S.question,COUNT(V.Id_Option) AS total FROM optionssondage O JOIN sondages S 
            ON S.Id_Sondage = O.Id_Sondage LEFT JOIN votes V ON V.Id_Option = O.Id_Option
            WHERE O.Id_Sondage = ? GROUP BY O.Id_Option, O.option_text, S.question;`;
  db.query(sql, [id_sondage], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json(err);
    }
    return res.status(200).json(result);
  });
};
const { notifyVoters } = require("./notifyVoters");



exports.autoFinishSondages = (req, res) => {
  const selectSql = `
    SELECT Id_Sondage 
    FROM sondages 
    WHERE End_time <= NOW() 
      AND Etat != 'finished'
  `;

  db.query(selectSql, async (err, results) => {
    if (err) {
      console.error("Erreur SQL lors de la sélection :", err);
      return res.status(500).json({ message: "Erreur serveur" });
    }

    if (!results || results.length === 0) {
      return res.json({ message: "Aucun sondage à terminer", updated: 0 });
    }

    try {
      for (const row of results) {
        await notifyVoters(row.Id_Sondage);
      }

      const updateSql = `
        UPDATE sondages
        SET Etat = 'finished'
        WHERE End_time <= NOW() 
          AND Etat != 'finished'
      `;

      db.query(updateSql, (err, result) => {
        if (err) {
          console.error("Erreur SQL lors de la mise à jour :", err);
          return res.status(500).json({ message: "Erreur serveur" });
        }

        res.json({
          message: "Mise à jour automatique effectuée et votants notifiés",
          updated: result.affectedRows,
        });
      });
    } catch (error) {
      console.error("Erreur lors de la notification :", error);
      return res.status(500).json({ message: "Erreur lors de l'envoi des emails" });
    }
  });
};


 exports.getSondageById = (req, res) => {
  const id_sondage = req.params.id_sondage;
  console.log(id_sondage)
  const sql = "SELECT * FROM sondages WHERE Id_Sondage = ?";
  db.query(sql, [id_sondage], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Erreur serveur" });
    }

    if (result.length === 0) {
      return res.status(404).json({ message: "Sondage non trouvé" });
    }

    res.json(result[0]);
  });
};

exports.getSondageWithOptions = (req, res) => {
  const id_sondage = req.params.id_sondage;
console.log(id_sondage)
  // Récupérer le sondage
  const sondageQuery = "SELECT * FROM sondages WHERE Id_Sondage = ?";
  db.query(sondageQuery, [id_sondage], (err, sondageResult) => {
    if (err) return res.status(500).json(err);
    if (sondageResult.length === 0)
      return res.status(404).json({ message: "Sondage non trouvé" });

    const sondage = sondageResult[0];

    // Récupérer les options du sondage
    const optionsQuery = "SELECT Id_Option, option_text FROM optionssondage WHERE Id_Sondage = ?";
    db.query(optionsQuery, [id_sondage], (err, optionsResult) => {
      if (err) return res.status(500).json(err);

      sondage.options = optionsResult.map(opt => ({
        id_option: opt.Id_Option,
        label: opt.option_text
      }));

      res.json(sondage);
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
    if (err) {
      console.error("Erreur récupération catégories :", err);
      return res.status(500).json({ error: "Erreur serveur" });
    }
    res.json(results);
  });
};
