// const db = require("db")
// const nodemailer = require("nodemailer")

// const transporter = nodemailer.createTransport({
//   service: "gmail",
//   auth: {
//     user: "belaoualiali1@gmail.com",
//     pass: "jnvb whlb lmao ifwl", // pas ton vrai mdp
//   },
// });

// module.exports notifyVoters = async (Id_Sondage) => {
//   try {
//     // IMPORTANT → utiliser db.promise()
//     const [voters] = await db.promise().query(
//       `SELECT u.Email, u.Nom 
//        FROM votes v 
//        JOIN utilisateur u ON v.Id_user = u.Id_user 
//        WHERE v.Id_Sondage = ?`,
//       [Id_Sondage]
//     );


//     if (voters.length === 0) return;

//     for (const voter of voters) {
//       await transporter.sendMail({
//         from: `"Votify App" <belaoualiali1@gmail.com>`,
//         to: voter.Email,
//         subject: "Sondage terminé",
//         text: `Bonjour ${voter.Nom},

// Le sondage auquel vous avez participé est terminé.
// Venez consulter les résultats sur votre tableau de bord.

// Merci !`,
//       });
//     }

//     console.log("Emails envoyés ✔");

//   } catch (err) {
//     console.error("Erreur lors de l'envoi des emails :", err);
//   }
// };

const db = require("../db/db");
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "belaoualiali1@gmail.com",
    pass: "jnvb whlb lmao ifwl",
  },
});

// CORRECTION ICI : Utiliser = après module.exports
module.exports.notifyVoters = async (Id_Sondage) => {
  try {
    const [voters] = await db.promise().query(
      `SELECT u.Email, u.Nom 
       FROM votes v 
       JOIN utilisateur u ON v.Id_user = u.Id_user 
       WHERE v.Id_Sondage = ?`,
      [Id_Sondage]
    );

    if (voters.length === 0) return;

    for (const voter of voters) {
      await transporter.sendMail({
        from: `"Votify App" <belaoualiali1@gmail.com>`,
        to: voter.Email,
        subject: "Sondage terminé",
        text: `Bonjour ${voter.Nom},

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