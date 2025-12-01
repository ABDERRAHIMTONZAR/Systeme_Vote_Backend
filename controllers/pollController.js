let db = require("../db/db");
exports.getVotedPolls = (req, res) => {
  const userId = req.userId;
  console.log(userId);
    const sql = `
    SELECT 
      S.Id_Sondage AS id,
      S.question,
      S.End_time AS end_time,
      S.Etat AS state,
      S.Id_user AS user_id,
      (
        SELECT COUNT(*) 
        FROM votes V2 
        WHERE V2.Id_Sondage = S.Id_Sondage
      ) AS voters
    FROM sondages S
    JOIN votes V ON S.Id_Sondage = V.Id_Sondage
    WHERE V.Id_user = ?
    GROUP BY S.Id_Sondage;
  `;

  db.query(sql, [userId], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json(err);
    }
    return res.status(200).json(result);
  });
};


exports.getUnvotedPolls = (req, res) => {
  const userId = req.userId;
  console.log(userId);

  const sql = `
    SELECT 
      S.Id_Sondage AS id,
      S.question,
      S.End_time AS end_time,
      S.Etat as Etat,
      S.Id_user AS user_id,
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

  db.query(sql, [userId], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json(err);
    }

    return res.status(200).json(result);
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


exports.autoFinishSondages = (req, res) => {
  const sql = `
    UPDATE sondages
    SET Etat = 'finished'
    WHERE End_time <= NOW()
    AND Etat != 'finished'
  `;

  db.query(sql, (err, result) => {
    if (err) {
      console.error("Erreur SQL :", err);
      return res.status(500).json({ message: "Erreur serveur" });
    }

    res.json({
      message: "Mise à jour automatique effectuée",
      updated: result.affectedRows
    });
  });
 };