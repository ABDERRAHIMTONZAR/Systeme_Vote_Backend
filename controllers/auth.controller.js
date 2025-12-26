const bcrypt = require('bcrypt');
const db = require('../db/db');
const jwt = require('jsonwebtoken');


exports.createUser = async (req, res) => {
    const { nom, prenom, email, password } = req.body;

    if (!nom || !prenom || !email || !password) {
        return res.status(400).json({ message: "Tous les champs sont requis." });
    }

    const checkSql = "SELECT * FROM utilisateur WHERE email = ?";
    db.query(checkSql, [email], async (err, rows) => {
        if (err) return res.status(500).json({ message: "Erreur serveur" });

        if (rows.length > 0) {
            return res.status(400).json({ message: "Cet email est déjà utilisé." });
        }
        const hashedPassword = await bcrypt.hash(password, 10);

        const sql = ` INSERT INTO utilisateur(nom, prenom, email, password, date_creation) VALUES (?, ?, ?, ?, NOW())
        `;

        db.query(sql, [nom, prenom, email, hashedPassword], (err) => {
            if (err) return res.status(500).json({ message: "Erreur serveur" });

            return res.status(201).json({ message: "Utilisateur créé avec succès" });
        });
    });
};



const { sendOtpMail } = require("./CodeLoginMailer");

exports.loginUser = (req, res) => {
  const { email, password } = req.body;

  const sql = "SELECT * FROM utilisateur WHERE email = ?";
  db.query(sql, [email], async (err, result) => {
    if (err) return res.status(500).json({ message: "Erreur serveur" });
    if (result.length === 0)
      return res.status(400).json({ message: "Email introuvable" });

    const user = result[0];
    const correct = await bcrypt.compare(password, user.password);
    if (!correct)
      return res.status(400).json({ message: "Mot de passe incorrect" });

    // 🔢 Génération OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 5 * 60 * 1000);

    await db.promise().query(
      "INSERT INTO user_otp(user_id, otp, expires_at) VALUES (?, ?, ?)",
      [user.Id_user, otp, expires]
    );

    // ✉️ Envoi email
    await sendOtpMail(user.Email, user.Nom, otp);

    // 🔑 Token temporaire
    const preAuthToken = jwt.sign(
      { userId: user.Id_user },
      "SECRET_KEY",
      { expiresIn: "5m" }
    );

    return res.json({
      requires2fa: true,
      preAuthToken,
    });
  });
};
exports.verify2fa = (req, res) => {
  const { code, preAuthToken } = req.body;

  try {
    const decoded = jwt.verify(preAuthToken, "SECRET_KEY");

    const sql = `
      SELECT * FROM user_otp
      WHERE user_id = ? AND otp = ? AND used = 0 AND expires_at > NOW()
    `;

    db.query(sql, [decoded.userId, code], (err, rows) => {
      if (err) return res.status(500).json({ message: "Erreur serveur" });
      if (rows.length === 0)
        return res.status(400).json({ message: "Code invalide ou expiré" });

      db.query("UPDATE user_otp SET used = 1 WHERE id = ?", [rows[0].id]);

      const token = jwt.sign(
        { id: decoded.userId },
        "SECRET_KEY",
        { expiresIn: "2h" }
      );

      res.json({ token });
    });
  } catch {
    res.status(401).json({ message: "Session expirée" });
  }
};
exports.resend2fa = async (req, res) => {
  const { preAuthToken } = req.body;

  try {
    const decoded = jwt.verify(preAuthToken, "SECRET_KEY");

    const [user] = await db.promise().query(
      "SELECT Email, Nom FROM utilisateur WHERE Id_user = ?",
      [decoded.userId]
    );

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 5 * 60000);

    await db.promise().query(
      "INSERT INTO user_otp(user_id, otp, expires_at) VALUES (?, ?, ?)",
      [decoded.userId, otp, expires]
    );

    await sendOtpMail(user[0].Email, user[0].Nom, otp);

    res.json({ message: "Code renvoyé avec succès" });
  } catch {
    res.status(401).json({ message: "Session expirée" });
  }
};
