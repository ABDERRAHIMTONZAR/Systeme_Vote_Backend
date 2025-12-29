const bcrypt = require('bcrypt');
const db = require('../db/db');
const jwt = require('jsonwebtoken');
const { sendOtpMail, sendResetMail } = require("./CodeLoginMailer");

// Cache pour éviter les requêtes répétées
const userCache = new Map();
const CACHE_TTL = 30000; // 30 secondes

// Fonction utilitaire pour les réponses d'erreur
const errorResponse = (res, message, status = 500) => {
  return res.status(status).json({ message });
};

// Fonction utilitaire pour les requêtes DB
const queryAsync = (sql, params) => {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
};

// Fonction de génération OTP
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

// Création utilisateur
exports.createUser = async (req, res) => {
  try {
    const { nom, prenom, email, password } = req.body;
    
    // Validation basique
    if (!nom || !prenom || !email || !password) {
      return errorResponse(res, "Tous les champs sont requis.", 400);
    }
    
    // Vérification email unique avec cache
    const cacheKey = `email:${email}`;
    if (userCache.has(cacheKey)) {
      return errorResponse(res, "Cet email est déjà utilisé.", 400);
    }
    
    const checkResult = await queryAsync(
      "SELECT Id_user FROM utilisateur WHERE email = ? LIMIT 1",
      [email]
    );
    
    if (checkResult.length > 0) {
      userCache.set(cacheKey, true, CACHE_TTL);
      return errorResponse(res, "Cet email est déjà utilisé.", 400);
    }
    
    // Hash du mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Insertion utilisateur
    await queryAsync(
      "INSERT INTO utilisateur(nom, prenom, email, password, date_creation) VALUES (?, ?, ?, ?, NOW())",
      [nom, prenom, email, hashedPassword]
    );
    
    res.status(201).json({ 
      success: true,
      message: "Utilisateur créé avec succès" 
    });
    
  } catch (error) {
    console.error('Create user error:', error);
    errorResponse(res, "Erreur serveur");
  }
};

// Connexion utilisateur
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Vérification rapide
    if (!email || !password) {
      return errorResponse(res, "Email et mot de passe requis.", 400);
    }
    
    // Récupération utilisateur
    const users = await queryAsync(
      "SELECT Id_user, nom, prenom, email, password FROM utilisateur WHERE email = ? LIMIT 1",
      [email]
    );
    
    if (users.length === 0) {
      return errorResponse(res, "Identifiants incorrects.", 401);
    }
    
    const user = users[0];
    
    // Vérification mot de passe
    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) {
      return errorResponse(res, "Identifiants incorrects.", 401);
    }
    
    // Génération OTP
    const otp = generateOtp();
    const expires = new Date(Date.now() + 5 * 60 * 1000);
    
    // Insertion OTP
    await queryAsync(
      "INSERT INTO user_otp(user_id, otp, expires_at) VALUES (?, ?, ?)",
      [user.Id_user, otp, expires]
    );
    
    // Envoi email OTP (asynchrone)
    sendOtpMail(user.email, user.prenom || user.nom, otp)
      .catch(err => console.error('Email error (non-blocking):', err));
    
    // Token temporaire
    const preAuthToken = jwt.sign(
      { userId: user.Id_user },
      process.env.JWT_SECRET || "SECRET_KEY",
      { expiresIn: "5m" }
    );
    
    res.json({
      requires2fa: true,
      preAuthToken,
      message: "Code de vérification envoyé"
    });
    
  } catch (error) {
    console.error('Login error:', error);
    errorResponse(res, "Erreur d'authentification");
  }
};

// Vérification 2FA
exports.verify2fa = async (req, res) => {
  try {
    const { code, preAuthToken } = req.body;
    
    if (!code || !preAuthToken) {
      return errorResponse(res, "Code et token requis.", 400);
    }
    
    // Vérification token
    let decoded;
    try {
      decoded = jwt.verify(preAuthToken, process.env.JWT_SECRET || "SECRET_KEY");
    } catch (jwtError) {
      return errorResponse(res, 
        jwtError.name === 'TokenExpiredError' ? "Session expirée" : "Token invalide", 
        401
      );
    }
    
    // Vérification OTP
    const otps = await queryAsync(
      `SELECT id FROM user_otp 
       WHERE user_id = ? AND otp = ? AND used = 0 AND expires_at > NOW() 
       LIMIT 1`,
      [decoded.userId, code]
    );
    
    if (otps.length === 0) {
      return errorResponse(res, "Code invalide ou expiré.", 400);
    }
    
    // Marquer OTP comme utilisé
    await queryAsync("UPDATE user_otp SET used = 1 WHERE id = ?", [otps[0].id]);
    
    // Nettoyage des OTP expirés (asynchrone)
    queryAsync("DELETE FROM user_otp WHERE expires_at <= NOW()")
      .catch(err => console.error('Cleanup error:', err));
    
    // Token final
    const token = jwt.sign(
      { 
        id: decoded.userId,
      },
      process.env.JWT_SECRET || "SECRET_KEY",
      { expiresIn: "2h" }
    );
    
    res.json({ 
      token,
      message: "Connexion réussie" 
    });
    
  } catch (error) {
    console.error('2FA verify error:', error);
    errorResponse(res, "Erreur de vérification");
  }
};

// Renvoi OTP
exports.resend2fa = async (req, res) => {
  try {
    const { preAuthToken } = req.body;
    
    if (!preAuthToken) {
      return errorResponse(res, "Token requis.", 400);
    }
    
    // Vérification token
    let decoded;
    try {
      decoded = jwt.verify(preAuthToken, process.env.JWT_SECRET || "SECRET_KEY");
    } catch (jwtError) {
      return errorResponse(res, 
        jwtError.name === 'TokenExpiredError' ? "Session expirée" : "Token invalide", 
        401
      );
    }
    
    // Récupération utilisateur
    const users = await queryAsync(
      "SELECT email, prenom, nom FROM utilisateur WHERE Id_user = ? LIMIT 1",
      [decoded.userId]
    );
    
    if (users.length === 0) {
      return errorResponse(res, "Utilisateur non trouvé.", 404);
    }
    
    const user = users[0];
    
    // Nouvel OTP
    const otp = generateOtp();
    const expires = new Date(Date.now() + 5 * 60 * 1000);
    
    // Insertion nouveau OTP
    await queryAsync(
      "INSERT INTO user_otp(user_id, otp, expires_at) VALUES (?, ?, ?)",
      [decoded.userId, otp, expires]
    );
    
    // Envoi email (asynchrone)
    sendOtpMail(user.email, user.prenom || user.nom, otp)
      .catch(err => console.error('Email error:', err));
    
    res.json({ 
      message: "Code renvoyé avec succès" 
    });
    
  } catch (error) {
    console.error('Resend OTP error:', error);
    errorResponse(res, "Erreur lors du renvoi du code");
  }
};

// MOT DE PASSE OUBLIÉ - Demande
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return errorResponse(res, "Email requis.", 400);
    }
    
    // Vérification utilisateur
    const users = await queryAsync(
      "SELECT Id_user, email, prenom, nom FROM utilisateur WHERE email = ? LIMIT 1",
      [email]
    );
    
    // Pour la sécurité, même réponse si utilisateur existe ou non
    const response = {
      message: "Si cet email existe, un code de réinitialisation vous a été envoyé",
      preAuthToken: null
    };
    
    if (users.length === 0) {
      return res.json(response);
    }
    
    const user = users[0];
    
    // Génération OTP
    const otp = generateOtp();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    
    // Token temporaire
    const preAuthToken = jwt.sign(
      { 
        userId: user.Id_user,
        email: user.email,
      },
      process.env.JWT_SECRET || "SECRET_KEY",
      { expiresIn: '10m' }
    );
    
    // Insertion OTP
    await queryAsync(
      "INSERT INTO user_otp(user_id, otp, expires_at) VALUES (?, ?, ?)",
      [user.Id_user, otp, expires]
    );
    
    // Envoi email (asynchrone)
    sendResetMail(user.email, user.prenom || user.nom, otp)
      .catch(err => console.error('Reset email error:', err));
    
    response.preAuthToken = preAuthToken;
    res.json(response);
    
  } catch (error) {
    console.error('Forgot password error:', error);
    errorResponse(res, "Erreur lors de la demande de réinitialisation");
  }
};

// MOT DE PASSE OUBLIÉ - Vérification code
exports.verifyResetCode = async (req, res) => {
  try {
    const { code, preAuthToken } = req.body;
    
    if (!code || !preAuthToken) {
      return errorResponse(res, "Code et token requis.", 400);
    }
    
    // Vérification token
    let decoded;
    try {
      decoded = jwt.verify(preAuthToken, process.env.JWT_SECRET || "SECRET_KEY");
    } catch (jwtError) {
      return errorResponse(res, 
        jwtError.name === 'TokenExpiredError' ? "Session expirée" : "Token invalide", 
        401
      );
    }
    

    
    // Vérification OTP
    const otps = await queryAsync(
      `SELECT id FROM user_otp 
       WHERE user_id = ? AND otp = ?  AND used = 0 AND expires_at > NOW() 
       LIMIT 1`,
      [decoded.userId, code]
    );
    
    if (otps.length === 0) {
      return errorResponse(res, "Code invalide ou expiré.", 400);
    }
    
    // Marquer OTP comme utilisé
    await queryAsync("UPDATE user_otp SET used = 1 WHERE id = ?", [otps[0].id]);
    
    // Token pour réinitialisation
    const resetToken = jwt.sign(
      { 
        userId: decoded.userId,
        email: decoded.email,
      },
      process.env.JWT_SECRET || "SECRET_KEY",
      { expiresIn: '15m' }
    );
    
    res.json({ 
      message: "Code vérifié avec succès",
      resetToken,
      email: decoded.email
    });
    
  } catch (error) {
    console.error('Verify reset code error:', error);
    errorResponse(res, "Erreur de vérification");
  }
};

// MOT DE PASSE OUBLIÉ - Réinitialisation finale
exports.resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;
    
    if (!resetToken || !newPassword) {
      return errorResponse(res, "Token et nouveau mot de passe requis.", 400);
    }
    
    // Vérification token
    let decoded;
    try {
      decoded = jwt.verify(resetToken, process.env.JWT_SECRET || "SECRET_KEY");
    } catch (jwtError) {
      return errorResponse(res, 
        jwtError.name === 'TokenExpiredError' ? "Session expirée" : "Token invalide", 
        401
      );
    }
    

    // Validation mot de passe
    if (newPassword.length < 8) {
      return errorResponse(res, "Le mot de passe doit contenir au moins 8 caractères.", 400);
    }
    
    // Hash nouveau mot de passe
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Mise à jour mot de passe
    const result = await queryAsync(
      "UPDATE utilisateur SET password = ? WHERE Id_user = ?",
      [hashedPassword, decoded.userId]
    );
    
    if (result.affectedRows === 0) {
      return errorResponse(res, "Utilisateur non trouvé.", 404);
    }
    
    // Nettoyage des OTP de réinitialisation
    await queryAsync(
      "DELETE FROM user_otp WHERE user_id = ?",
      [decoded.userId]
    );
    
    res.json({ 
      success: true,
      message: "Mot de passe réinitialisé avec succès" 
    });
    
  } catch (error) {
    console.error('Reset password error:', error);
    errorResponse(res, "Erreur lors de la réinitialisation");
  }
};