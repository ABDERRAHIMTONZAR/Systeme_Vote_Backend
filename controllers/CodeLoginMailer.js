const nodemailer = require("nodemailer");

// ⚠️ AUCUN mot de passe dans le code
// Tout vient des variables d’environnement (Koyeb / Vercel)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS, // App Password Gmail
  },
  connectionTimeout: 8000,
  greetingTimeout: 8000,
  socketTimeout: 8000,
});

/**
 * Envoi du code OTP par email
 */
exports.sendOtpMail = async (email, nom, otp) => {
  if (!email) {
    throw new Error("Email destinataire manquant (sendOtpMail)");
  }

  const displayName = nom || "Utilisateur";

  try {
    await transporter.sendMail({
      from: `"Votify App" <${process.env.MAIL_USER}>`,
      to: email,
      subject: "🔐 Code de vérification - Votify",
      text: `Bonjour ${displayName},

Votre code de vérification est : ${otp}

⏰ Ce code est valable 5 minutes.
⚠️ Ne le partagez avec personne.

Cordialement,
L'équipe Votify`,
    });

    console.log("✅ OTP envoyé à", email);
  } catch (err) {
    console.error("❌ Erreur envoi OTP :", err.message);
    throw err; // important pour que le controller sache que l’email a échoué
  }
};
