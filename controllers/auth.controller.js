const bcrypt = require("bcrypt");
const db = require("../db/db");
const jwt = require("jsonwebtoken");
const { sendOtpMail } = require("./CodeLoginMailer");

// ✅ Helper timeout (évite 504 si l’email bloque)
function promiseWithTimeout(promise, ms, errorMsg) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(errorMsg)), ms);
    promise
      .then((v) => {
        clearTimeout(t);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(t);
        reject(e);
      });
  });
}

// ✅ Helper pour récupérer les champs (maj/min)
function normalizeUserRow(user) {
  const userId =
    user.Id_user ?? user.id_user ?? user.id ?? user.ID ?? user.user_id;

  const userEmail = user.email ?? user.Email ?? user.EMAIL;
  const userName = user.nom ?? user.Nom ?? user.name ?? user.Name ?? "";
  const hashedPassword = user.password ?? user.Password ?? user.PASSWORD;

  return { userId, userEmail, userName, hashedPassword };
}

/* =========================================================
   CREATE USER
========================================================= */
exports.createUser = async (req, res) => {
  const { nom, prenom, email, password } = req.body;

  if (!nom || !prenom || !email || !password) {
    return res.status(400).json({ message: "Tous les champs sont requis." });
  }

  try {
    const [exists] = await db.query(
      "SELECT 1 FROM utilisateur WHERE email = ? LIMIT 1",
      [email]
    );

    if (exists.length > 0) {
      return res.status(400).json({ message: "Cet email est déjà utilisé." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.query(
      "INSERT INTO utilisateur(nom, prenom, email, password, date_creation) VALUES (?, ?, ?, ?, NOW())",
      [nom, prenom, email, hashedPassword]
    );

    return res.status(201).json({ message: "Utilisateur créé avec succès" });
  } catch (err) {
    console.error("CREATE USER ERROR:", err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
};

/* =========================================================
   LOGIN USER (OTP + preAuthToken)
========================================================= */
exports.loginUser = async (req, res) => {
  console.log("Login attempt");
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "email et password requis" });
  }

  try {
    const [rows] = await db.query(
      "SELECT * FROM utilisateur WHERE email = ? LIMIT 1",
      [email]
    );

    if (rows.length === 0) {
      return res.status(400).json({ message: "Email introuvable" });
    }

    const user = rows[0];
    const { userId, userEmail, userName, hashedPassword } = normalizeUserRow(user);

    // ✅ Debug utile si ça rebug
    // console.log("USER KEYS:", Object.keys(user));

    if (!userId) {
      console.error("userId introuvable dans row:", user);
      return res.status(500).json({ message: "ID utilisateur manquant en base" });
    }

    if (!userEmail) {
      console.error("userEmail introuvable dans row:", user);
      return res.status(500).json({ message: "Email utilisateur manquant en base" });
    }

    if (!hashedPassword) {
      console.error("password hash introuvable dans row:", user);
      return res.status(500).json({ message: "Mot de passe manquant en base" });
    }

    const correct = await bcrypt.compare(password, hashedPassword);
    if (!correct) {
      return res.status(400).json({ message: "Mot de passe incorrect" });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 5 * 60 * 1000);

    await db.query(
      "INSERT INTO user_otp(user_id, otp, expires_at) VALUES (?, ?, ?)",
      [userId, otp, expires]
    );

    console.log("Envoi OTP à", userEmail);

    // ✅ Envoi mail (avec timeout pour éviter 504)
    await promiseWithTimeout(
      sendOtpMail(userEmail, userName, otp),
      8000,
      "Timeout envoi email"
    );

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

/* =========================================================
   VERIFY 2FA (valide OTP -> token)
========================================================= */
exports.verify2fa = async (req, res) => {
  const { code, preAuthToken } = req.body;

  if (!code || !preAuthToken) {
    return res.status(400).json({ message: "code et preAuthToken requis" });
  }

  try {
    const decoded = jwt.verify(preAuthToken, process.env.JWT_SECRET || "SECRET_KEY");

    const [rows] = await db.query(
      `
      SELECT * FROM user_otp
      WHERE user_id = ? AND otp = ? AND used = 0 AND expires_at > NOW()
      LIMIT 1
      `,
      [decoded.userId, code]
    );

    if (rows.length === 0) {
      return res.status(400).json({ message: "Code invalide ou expiré" });
    }

    await db.query("UPDATE user_otp SET used = 1 WHERE id = ?", [rows[0].id]);

    const token = jwt.sign(
      { id: decoded.userId },
      process.env.JWT_SECRET || "SECRET_KEY",
      { expiresIn: "2h" }
    );

    return res.json({ token });
  } catch (err) {
    console.error("VERIFY 2FA ERROR:", err);
    return res.status(401).json({ message: "Session expirée" });
  }
};

/* =========================================================
   RESEND 2FA
========================================================= */
exports.resend2fa = async (req, res) => {
  const { preAuthToken } = req.body;

  if (!preAuthToken) {
    return res.status(400).json({ message: "preAuthToken requis" });
  }

  try {
    const decoded = jwt.verify(preAuthToken, process.env.JWT_SECRET || "SECRET_KEY");

    const [rows] = await db.query(
      "SELECT * FROM utilisateur WHERE Id_user = ? LIMIT 1",
      [decoded.userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Utilisateur introuvable" });
    }

    const user = rows[0];
    const { userEmail, userName } = normalizeUserRow(user);

    if (!userEmail) {
      console.error("userEmail introuvable dans row:", user);
      return res.status(500).json({ message: "Email utilisateur manquant en base" });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 5 * 60 * 1000);

    await db.query(
      "INSERT INTO user_otp(user_id, otp, expires_at) VALUES (?, ?, ?)",
      [decoded.userId, otp, expires]
    );

    await promiseWithTimeout(
      sendOtpMail(userEmail, userName, otp),
      8000,
      "Timeout envoi email"
    );

    return res.json({ message: "Code renvoyé avec succès" });
  } catch (err) {
    console.error("RESEND 2FA ERROR:", err);
    return res.status(401).json({ message: "Session expirée" });
  }
};
