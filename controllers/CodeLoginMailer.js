const nodemailer = require("nodemailer");

const MAIL_USER = process.env.MAIL_USER;
const MAIL_PASS = process.env.MAIL_PASS;

if (!MAIL_USER || !MAIL_PASS) {
  console.warn("⚠️ MAIL_USER/MAIL_PASS manquants dans les variables d'environnement.");
}

// Transport (Gmail)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: MAIL_USER,
    pass: MAIL_PASS,
  },
  // anti-hangs (utile en cloud)
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 20_000,
});

// Template OTP connexion
const otpTemplate = (nom, otp) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #667eea, #764ba2); padding: 30px; text-align: center; color: white; }
    .content { padding: 30px; }
    .code { text-align: center; margin: 30px 0; font-size: 36px; font-weight: bold; color: #667eea; letter-spacing: 5px; }
    .footer { background: #f9f9f9; padding: 20px; text-align: center; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Votify</h1>
      <p>Code de vérification</p>
    </div>
    <div class="content">
      <h2>Bonjour ${nom},</h2>
      <p>Voici votre code de vérification :</p>
      <div class="code">${otp}</div>
      <p>Ce code est valable 5 minutes.</p>
      <p>Ne le partagez avec personne.</p>
    </div>
    <div class="footer">
      © ${new Date().getFullYear()} Votify. Équipe de sécurité.
    </div>
  </div>
</body>
</html>
`;

// Template reset mdp
const resetTemplate = (nom, otp) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #f6d365, #fda085); padding: 30px; text-align: center; color: white; }
    .content { padding: 30px; }
    .code { text-align: center; margin: 30px 0; font-size: 36px; font-weight: bold; color: #fda085; letter-spacing: 5px; }
    .footer { background: #f9f9f9; padding: 20px; text-align: center; color: #666; font-size: 12px; }
    .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Votify</h1>
      <p>Réinitialisation de mot de passe</p>
    </div>
    <div class="content">
      <h2>Bonjour ${nom},</h2>
      <p>Vous avez demandé à réinitialiser votre mot de passe.</p>
      <div class="code">${otp}</div>
      <p>Ce code est valable 10 minutes.</p>
      <div class="warning">
        Si vous n'avez pas fait cette demande, ignorez cet email.
      </div>
    </div>
    <div class="footer">
      © ${new Date().getFullYear()} Votify. Protection des comptes.
    </div>
  </div>
</body>
</html>
`;

const sendEmail = async (to, subject, html) => {
  if (!MAIL_USER || !MAIL_PASS) {
    console.error("❌ MAIL_USER/MAIL_PASS non configurés. Email non envoyé.");
    return false;
  }

  try {
    const info = await transporter.sendMail({
      from: `"Votify" <${MAIL_USER}>`,
      to,
      subject,
      html,
      headers: {
        "X-Priority": "3",
        "X-MSMail-Priority": "Normal",
      },
    });

    console.log(`✅ Email envoyé à ${to} (${info.messageId})`);
    return true;
  } catch (err) {
    console.error(`❌ Erreur d'envoi email à ${to}:`, err.message);
    return false;
  }
};

exports.sendOtpMail = (email, nom, otp) =>
  sendEmail(email, "Code de vérification - Votify", otpTemplate(nom, otp));

exports.sendResetMail = (email, nom, otp) =>
  sendEmail(email, "Réinitialisation de mot de passe - Votify", resetTemplate(nom, otp));
