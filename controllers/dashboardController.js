let db = require("../db/db");

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
        return res.status(200).json({
            total_polls: stats.total_polls,
            active_polls: stats.active_polls,
            finished_polls: stats.finished_polls,
            total_unique_voters: stats.total_unique_voters
        });
    });
};



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

        const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

        const finalData = months.map((m, i) => ({
            month: m,
            polls: 0,
            visitors: 0
        }));

        results.forEach(row => {
            const index = row.month - 1;
            finalData[index].polls = row.polls;
            finalData[index].visitors = row.visitors || 0;
        });

        res.json(finalData);
    });
};


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

        rows.forEach(row => {
            if (row.votes <= 2) low++;
            else if (row.votes <= 10) medium++;
            else high++;
        });

        res.json({ low, medium, high });
    });
};
