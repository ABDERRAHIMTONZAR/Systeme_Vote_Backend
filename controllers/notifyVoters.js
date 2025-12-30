const nodemailer = require("nodemailer");
const db = require("../db/db.js");

const MAIL_USER = process.env.MAIL_USER;
const MAIL_PASS = process.env.MAIL_PASS;

if (!MAIL_USER || !MAIL_PASS) {
  console.warn("⚠️ MAIL_USER/MAIL_PASS manquants. notifyVoters ne pourra pas envoyer d'emails.");
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: MAIL_USER, pass: MAIL_PASS },
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 20_000,
});

function normalizeEmail(row) {
  return row.email ?? row.Email ?? row.EMAIL ?? null;
}
function normalizeName(row) {
  return row.nom ?? row.Nom ?? row.name ?? row.Name ?? "";
}
function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function runWithLimit(items, limit, worker) {
  const results = [];
  let i = 0;

  const runners = Array.from({ length: limit }, async () => {
    while (i < items.length) {
      const currentIndex = i++;
      results[currentIndex] = await worker(items[currentIndex]);
    }
  });

  await Promise.all(runners);
  return results;
}

exports.notifyVoters = async function notifyVoters(Id_Sondage) {
  try {
    if (!MAIL_USER || !MAIL_PASS) {
      return { sent: 0, skipped: 0, reason: "MAIL_ENV_MISSING" };
    }

    const [voters] = await db.query(
      `SELECT u.email, u.nom
       FROM votes v
       JOIN utilisateur u ON v.Id_user = u.Id_user
       WHERE v.Id_Sondage = ?`,
      [Id_Sondage]
    );

    if (!voters || voters.length === 0) return { sent: 0, skipped: 0, reason: "NO_VOTERS" };

    const uniqueEmails = new Map();
    for (const v of voters) {
      const to = normalizeEmail(v);
      const name = normalizeName(v);

      if (!to || !isValidEmail(to)) continue;
      if (!uniqueEmails.has(to)) uniqueEmails.set(to, name);
    }

    const entries = Array.from(uniqueEmails.entries()); // [email, name]
    let sent = 0;
    let skipped = voters.length - entries.length;

    const subject = "Sondage terminé";
    const from = `"Votify App" <${MAIL_USER}>`;

    await runWithLimit(entries, 3, async ([to, name]) => {
      try {
        await transporter.sendMail({
          from,
          to,
          subject,
          text: `Bonjour ${name},

Le sondage auquel vous avez participé est terminé.
Venez consulter les résultats sur votre tableau de bord.

Merci !`,
        });
        sent++;
        return true;
      } catch (err) {
        console.error("notifyVoters sendMail error:", to, err.message);
        return false;
      }
    });

    console.log(`✅ notifyVoters (poll ${Id_Sondage}): ${sent} emails envoyés, ${skipped} ignorés.`);
    return { sent, skipped };
  } catch (err) {
    console.error("❌ Erreur notifyVoters :", err);
    return { sent: 0, skipped: 0, error: err.message };
  }
}
