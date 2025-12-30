// controllers/notifyVoters.js
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
  return row?.email ?? row?.Email ?? row?.EMAIL ?? null;
}
function normalizeName(row) {
  return row?.nom ?? row?.Nom ?? row?.name ?? row?.Name ?? "";
}
function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function runWithLimit(items, limit, worker) {
  const results = new Array(items.length);
  let i = 0;

  const runners = Array.from({ length: limit }, async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await worker(items[idx]);
    }
  });

  await Promise.all(runners);
  return results;
}

exports.notifyVoters = async function notifyVoters(Id_Sondage) {
  try {
    if (!MAIL_USER || !MAIL_PASS) {
      return { sent: 0, failed: 0, skipped: 0, reason: "MAIL_ENV_MISSING" };
    }

    // ✅ votants
    const [voters] = await db.query(
      `SELECT DISTINCT u.email, u.nom
       FROM votes v
       JOIN utilisateur u ON v.Id_user = u.Id_user
       WHERE v.Id_Sondage = ?`,
      [Id_Sondage]
    );

    // ✅ créateur (pour envoyer même si 0 votants)
    const [creatorRows] = await db.query(
      `SELECT u.email, u.nom
       FROM sondages s
       JOIN utilisateur u ON s.Id_user = u.Id_user
       WHERE s.Id_Sondage = ?
       LIMIT 1`,
      [Id_Sondage]
    );

    const unique = new Map(); // email -> name

    for (const v of voters || []) {
      const to = normalizeEmail(v);
      const name = normalizeName(v);
      if (isValidEmail(to)) unique.set(to, name);
    }

    const creator = creatorRows?.[0];
    if (creator) {
      const to = normalizeEmail(creator);
      const name = normalizeName(creator) || " ";
      if (isValidEmail(to)) unique.set(to, name);
    }

    const entries = Array.from(unique.entries()); // [email, name]
    if (entries.length === 0) {
      return { sent: 0, failed: 0, skipped: (voters?.length || 0), reason: "NO_VALID_EMAILS" };
    }

    const subject = "Sondage terminé";
    const from = `"Votify App" <${MAIL_USER}>`;

    const results = await runWithLimit(entries, 3, async ([to, name]) => {
      try {
        const info = await transporter.sendMail({
          from,
          to,
          subject,
          text: `Bonjour ${name || ""},

Le sondage auquel vous avez participé est terminé.
Venez consulter les résultats sur votre tableau de bord.

Merci !`,
        });

        return { ok: true, to, id: info.messageId };
      } catch (err) {
        console.error("❌ notifyVoters sendMail error:", to, err.message);
        return { ok: false, to, error: err.message };
      }
    });

    const sent = results.filter((r) => r?.ok).length;
    const failed = results.filter((r) => r && !r.ok).length;

    console.log(`✅ notifyVoters (poll ${Id_Sondage}): ${sent} envoyés, ${failed} échecs.`);
    return { sent, failed, skipped: 0 };
  } catch (err) {
    console.error("❌ Erreur notifyVoters :", err);
    return { sent: 0, failed: 0, skipped: 0, error: err.message };
  }
};
