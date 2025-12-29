const nodemailer = require("nodemailer");
const db = require("../db/db.js");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS, // mot de passe d’application gmail
  },
});

function normalizeEmail(row) {
  return row.email ?? row.Email ?? row.EMAIL;
}

function normalizeName(row) {
  return row.nom ?? row.Nom ?? row.name ?? row.Name ?? "";
}

exports.notifyVoters = async (Id_Sondage) => {
  try {
    const [voters] = await db.query(
      `SELECT u.email, u.nom
       FROM votes v
       JOIN utilisateur u ON v.Id_user = u.Id_user
       WHERE v.Id_Sondage = ?`,
      [Id_Sondage]
    );

    if (!voters || voters.length === 0) return;

    for (const v of voters) {
      const to = normalizeEmail(v);
      const name = normalizeName(v);

      if (!to) {
        console.warn("notifyVoters: email manquant pour voter:", v);
        continue;
      }

      await transporter.sendMail({
        from: `"Votify App" <${process.env.MAIL_USER}>`,
        to,
        subject: "Sondage terminé",
        text: `Bonjour ${name},

Le sondage auquel vous avez participé est terminé.
Venez consulter les résultats sur votre tableau de bord.

Merci !`,
      });
    }

    console.log("Emails envoyés ✔");
  } catch (err) {
    console.error("Erreur lors de l'envoi des emails :", err);
  }
};
