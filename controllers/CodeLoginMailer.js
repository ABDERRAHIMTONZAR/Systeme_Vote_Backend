
const nodemailer = require("nodemailer");

// Pool de connexions email pour performances
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "belaoualiali1@gmail.com",
    pass: "jnvb whlb lmao ifwl",
  },
});


// Template OTP de connexion
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

// Template réinitialisation mot de passe
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

// Fonction générique d'envoi d'email
const sendEmail = async (to, subject, html) => {
  try {
    const mailOptions = {
      from: `"Votify" <${process.env.EMAIL_USER || "belaoualiali1@gmail.com"}>`,
      to,
      subject,
      html,
      // Options de performance
      headers: {
        'X-Priority': '3',
        'X-MSMail-Priority': 'Normal',
      }
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`Email envoyé à ${to}`, info.messageId);
    return true;
  } catch (err) {
    console.error("Erreur d'envoi email à", to, err.message);
    return false;
  }
};

// Export des fonctions
exports.sendOtpMail = async (email, nom, otp) => {
  return sendEmail(
    email,
    "Code de vérification - Votify",
    otpTemplate(nom, otp)
  );
};

exports.sendResetMail = async (email, nom, otp) => {
  return sendEmail(
    email,
    "Réinitialisation de mot de passe - Votify",
    resetTemplate(nom, otp)
  );
};
