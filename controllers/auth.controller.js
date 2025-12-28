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

exports.loginUser = async (req, res) => {
  console.log("Login attempt");
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "email et password requis" });
  }

  try {
    // 1) user
    const [rows] = await db.promise().query(
      "SELECT * FROM utilisateur WHERE email = ? LIMIT 1",
      [email]
    );

    if (rows.length === 0) {
      return res.status(400).json({ message: "Email introuvable" });
    }

    const user = rows[0];

    // ⚠️ adapte ces champs selon ta DB
    const hashedPassword = user.password;
    const userEmail = user.email;      // PAS user.Email
    const userName = user.nom || user.Nom;
    const userId = user.Id_user || user.id_user || user.id;

    // 2) bcrypt
    const correct = await bcrypt.compare(password, hashedPassword);
    if (!correct) {
      return res.status(400).json({ message: "Mot de passe incorrect" });
    }

    // 3) otp
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 5 * 60 * 1000);

    await db.promise().query(
      "INSERT INTO user_otp(user_id, otp, expires_at) VALUES (?, ?, ?)",
      [userId, otp, expires]
    );

    console.log("Envoi OTP à", userEmail);

    // 4) email (protégé: si SMTP bloque, on ne timeout pas toute la route)
    await promiseWithTimeout(
      sendOtpMail(userEmail, userName, otp),
      8000, // 8s
      "Timeout envoi email"
    );

    // 5) token
    const preAuthToken = jwt.sign(
      { userId },
      process.env.JWT_SECRET || "SECRET_KEY",
      { expiresIn: "5m" }
    );

    return res.json({ requires2fa: true, preAuthToken });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
};

// helper timeout
function promiseWithTimeout(promise, ms, errorMsg) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(errorMsg)), ms);
    promise
      .then((v) => { clearTimeout(t); resolve(v); })
      .catch((e) => { clearTimeout(t); reject(e); });
  });
}
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
