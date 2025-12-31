const bcrypt = require("bcrypt");
const db = require("../db/db");
const jwt = require("jsonwebtoken");
const { sendOtpMail, sendResetMail } = require("./CodeLoginMailer");

const userCache = new Map();
const CACHE_TTL = 30000;

const errorResponse = (res, message, status = 500) => {
  return res.status(status).json({ message });
};

const queryAsync = async (sql, params = []) => {
  const [result] = await db.query(sql, params);
  return result;
};

const generateOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

const cacheEmail = (email) => {
  const key = `email:${email}`;
  userCache.set(key, Date.now());
  setTimeout(() => userCache.delete(key), CACHE_TTL);
};

const isEmailCached = (email) => userCache.has(`email:${email}`);


exports.createUser = async (req, res) => {
  try {
    const { nom, prenom, email, password } = req.body;

    if (!nom || !prenom || !email || !password) {
      return errorResponse(res, "Tous les champs sont requis.", 400);
    }

    if (isEmailCached(email)) {
      return errorResponse(res, "Cet email est déjà utilisé.", 400);
    }

    const checkResult = await queryAsync(
      "SELECT Id_user FROM utilisateur WHERE email = ? LIMIT 1",
      [email]
    );

    if (checkResult.length > 0) {
      cacheEmail(email);
      return errorResponse(res, "Cet email est déjà utilisé.", 400);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await queryAsync(
      "INSERT INTO utilisateur(nom, prenom, email, password, date_creation) VALUES (?, ?, ?, ?, NOW())",
      [nom, prenom, email, hashedPassword]
    );

    return res.status(201).json({
      success: true,
      message: "Utilisateur créé avec succès",
    });
  } catch (error) {
    console.error("Create user error:", error);
    return errorResponse(res, "Erreur serveur", 500);
  }
};


exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return errorResponse(res, "Email et mot de passe requis.", 400);
    }

    const users = await queryAsync(
      "SELECT Id_user, nom, prenom, email, password FROM utilisateur WHERE email = ? LIMIT 1",
      [email]
    );

    if (users.length === 0) {
      return errorResponse(res, "Identifiants incorrects.", 401);
    }

    const user = users[0];

    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) {
      return errorResponse(res, "Identifiants incorrects.", 401);
    }

    const otp = generateOtp();
    const expires = new Date(Date.now() + 5 * 60 * 1000);

    await queryAsync(
      "INSERT INTO user_otp(user_id, otp, expires_at) VALUES (?, ?, ?)",
      [user.Id_user, otp, expires]
    );

    const preAuthToken = jwt.sign(
      { userId: user.Id_user },
      process.env.JWT_SECRET || "SECRET_KEY",
      { expiresIn: "5m" }
    );

    res.json({
      requires2fa: true,
      preAuthToken,
      message: "Code de vérification envoyé",
    });

    setImmediate(() => {
      sendOtpMail(user.email, user.prenom || user.nom, otp).catch((err) =>
        console.error("Email error (non-blocking):", err)
      );
    });
  } catch (error) {
    console.error("Login error:", error);
    return errorResponse(res, "Erreur d'authentification", 500);
  }
};


exports.verify2fa = async (req, res) => {
  try {
    const { code, preAuthToken } = req.body;

    if (!code || !preAuthToken) {
      return errorResponse(res, "Code et token requis.", 400);
    }

    let decoded;
    try {
      decoded = jwt.verify(
        preAuthToken,
        process.env.JWT_SECRET || "SECRET_KEY"
      );
    } catch (jwtError) {
      return errorResponse(
        res,
        jwtError.name === "TokenExpiredError" ? "Session expirée" : "Token invalide",
        401
      );
    }

    const otps = await queryAsync(
      `SELECT id FROM user_otp
       WHERE user_id = ? AND otp = ? AND used = 0 AND expires_at > NOW()
       LIMIT 1`,
      [decoded.userId, code]
    );

    if (otps.length === 0) {
      return errorResponse(res, "Code invalide ou expiré.", 400);
    }

    await queryAsync("UPDATE user_otp SET used = 1 WHERE id = ?", [otps[0].id]);

    setImmediate(() => {
      queryAsync("DELETE FROM user_otp WHERE expires_at <= NOW()").catch((err) =>
        console.error("Cleanup error:", err)
      );
    });

    const token = jwt.sign(
      { id: decoded.userId },
      process.env.JWT_SECRET || "SECRET_KEY",
      { expiresIn: "2h" }
    );

    return res.json({
      token,
      message: "Connexion réussie",
    });
  } catch (error) {
    console.error("2FA verify error:", error);
    return errorResponse(res, "Erreur de vérification", 500);
  }
};


exports.resend2fa = async (req, res) => {
  try {
    const { preAuthToken } = req.body;

    if (!preAuthToken) {
      return errorResponse(res, "Token requis.", 400);
    }

    let decoded;
    try {
      decoded = jwt.verify(
        preAuthToken,
        process.env.JWT_SECRET || "SECRET_KEY"
      );
    } catch (jwtError) {
      return errorResponse(
        res,
        jwtError.name === "TokenExpiredError" ? "Session expirée" : "Token invalide",
        401
      );
    }

    const users = await queryAsync(
      "SELECT email, prenom, nom FROM utilisateur WHERE Id_user = ? LIMIT 1",
      [decoded.userId]
    );

    if (users.length === 0) {
      return errorResponse(res, "Utilisateur non trouvé.", 404);
    }

    const user = users[0];

    const otp = generateOtp();
    const expires = new Date(Date.now() + 5 * 60 * 1000);

    await queryAsync(
      "INSERT INTO user_otp(user_id, otp, expires_at) VALUES (?, ?, ?)",
      [decoded.userId, otp, expires]
    );

    res.json({ message: "Code renvoyé avec succès" });

    setImmediate(() => {
      sendOtpMail(user.email, user.prenom || user.nom, otp).catch((err) =>
        console.error("Email error:", err)
      );
    });
  } catch (error) {
    console.error("Resend OTP error:", error);
    return errorResponse(res, "Erreur lors du renvoi du code", 500);
  }
};


exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return errorResponse(res, "Email requis.", 400);
    }

    const users = await queryAsync(
      "SELECT Id_user, email, prenom, nom FROM utilisateur WHERE email = ? LIMIT 1",
      [email]
    );

    const response = {
      message:
        "Si cet email existe, un code de réinitialisation vous a été envoyé",
      preAuthToken: null,
    };

    if (users.length === 0) {
      return res.json(response);
    }

    const user = users[0];
    const otp = generateOtp();
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    const preAuthToken = jwt.sign(
      { userId: user.Id_user, email: user.email },
      process.env.JWT_SECRET || "SECRET_KEY",
      { expiresIn: "10m" }
    );

    await queryAsync(
      "INSERT INTO user_otp(user_id, otp, expires_at) VALUES (?, ?, ?)",
      [user.Id_user, otp, expires]
    );

    response.preAuthToken = preAuthToken;
    res.json(response);

    setImmediate(() => {
      sendResetMail(user.email, user.prenom || user.nom, otp).catch((err) =>
        console.error("Reset email error:", err)
      );
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return errorResponse(res, "Erreur lors de la demande de réinitialisation", 500);
  }
};


exports.verifyResetCode = async (req, res) => {
  try {
    const { code, preAuthToken } = req.body;

    if (!code || !preAuthToken) {
      return errorResponse(res, "Code et token requis.", 400);
    }

    let decoded;
    try {
      decoded = jwt.verify(
        preAuthToken,
        process.env.JWT_SECRET || "SECRET_KEY"
      );
    } catch (jwtError) {
      return errorResponse(
        res,
        jwtError.name === "TokenExpiredError" ? "Session expirée" : "Token invalide",
        401
      );
    }

    const otps = await queryAsync(
      `SELECT id FROM user_otp
       WHERE user_id = ? AND otp = ? AND used = 0 AND expires_at > NOW()
       LIMIT 1`,
      [decoded.userId, code]
    );

    if (otps.length === 0) {
      return errorResponse(res, "Code invalide ou expiré.", 400);
    }

    await queryAsync("UPDATE user_otp SET used = 1 WHERE id = ?", [otps[0].id]);

    const resetToken = jwt.sign(
      { userId: decoded.userId, email: decoded.email },
      process.env.JWT_SECRET || "SECRET_KEY",
      { expiresIn: "15m" }
    );

    return res.json({
      message: "Code vérifié avec succès",
      resetToken,
      email: decoded.email,
    });
  } catch (error) {
    console.error("Verify reset code error:", error);
    return errorResponse(res, "Erreur de vérification", 500);
  }
};


exports.resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      return errorResponse(res, "Token et nouveau mot de passe requis.", 400);
    }

    let decoded;
    try {
      decoded = jwt.verify(
        resetToken,
        process.env.JWT_SECRET || "SECRET_KEY"
      );
    } catch (jwtError) {
      return errorResponse(
        res,
        jwtError.name === "TokenExpiredError" ? "Session expirée" : "Token invalide",
        401
      );
    }

    if (newPassword.length < 8) {
      return errorResponse(
        res,
        "Le mot de passe doit contenir au moins 8 caractères.",
        400
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const result = await queryAsync(
      "UPDATE utilisateur SET password = ? WHERE Id_user = ?",
      [hashedPassword, decoded.userId]
    );

    if (!result || result.affectedRows === 0) {
      return errorResponse(res, "Utilisateur non trouvé.", 404);
    }

    await queryAsync("DELETE FROM user_otp WHERE user_id = ?", [decoded.userId]);

    return res.json({
      success: true,
      message: "Mot de passe réinitialisé avec succès",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return errorResponse(res, "Erreur lors de la réinitialisation", 500);
  }
};