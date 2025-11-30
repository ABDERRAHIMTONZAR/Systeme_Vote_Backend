let db = require('../db/db'); 
let auth=require('../middleware/auth')
exports.getVotedPolls = (req, res) => {
    const userId = req.user.id;
    const sql = `SELECT S.* FROM sondages S JOIN votes V ON S.Id_Sondage = V.Id_Sondage WHERE V.Id_user = ?`;
    db.query(sql, [userId], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json(err);
        }

        return res.status(200).json(result);
    });
};  

exports.getUnvotedPolls = (req, res) => {
  const userId =  req.user.id

  const sql = `SELECT * FROM sondages WHERE Id_Sondage NOT IN ( SELECT Id_Sondage FROM votes WHERE id_user = ?
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
