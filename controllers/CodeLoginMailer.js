const nodemailer = require("nodemailer");
const db = require("../db/db.js");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "belaoualiali1@gmail.com",
    pass: "jnvb whlb lmao ifwl", // mot de passe application
  },
});

/**
 * Envoi du code OTP par email
 */
exports.sendOtpMail = async (email, nom, otp) => {
  try {
    await transporter.sendMail({
      from: `"Votify App" <belaoualiali1@gmail.com>`,
      to: email,
      subject: "Code de vérification - Votify",
      text: `Bonjour ${nom},

Votre code de vérification est : ${otp}

⏰ Ce code est valable 5 minutes.
⚠️ Ne le partagez avec personne.

Cordialement,
L'équipe Votify`,
    });

    console.log("OTP envoyé à", email);
  } catch (err) {
    console.error("Erreur envoi OTP :", err);
    throw err;
  }
};
