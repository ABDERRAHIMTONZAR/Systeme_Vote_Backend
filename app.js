const express = require("express");
const path = require("path");

// DB (pool mysql2/promise) - dossier db/
const db = require("./db/db");

// routes
const indexRouter = require("./routes/index");
const authRoutes = require("./routes/auth.routes");
const sondageRoutes = require("./routes/sondageRoutes");
const voteRoutes = require("./routes/voteRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const userRoutes = require("./routes/userRoutes");

// controller auto-finish
const pollCtrl = require("./controllers/pollController");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));

/* =========================
   CORS (LOCAL + VERCEL)
   -> pour HTTP (axios/fetch)
========================= */
const allowed = (origin) => {
  if (!origin) return true; // Postman/curl
  if (origin === "http://localhost:3000") return true;
  if (origin === "http://localhost:3002") return true;
  if (/^https:\/\/systeme-vote-frontend-.*\.vercel\.app$/.test(origin)) return true;
  return false;
};

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (allowed(origin)) {
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  }

  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

/* =========================
   HEALTH + DB TEST
========================= */
app.get("/health", (req, res) => res.status(200).send("ok"));

app.get("/db-test", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT 1 AS ok");
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* =========================
   ROUTES
========================= */
app.use("/", indexRouter);
app.use("/users", authRoutes);
app.use("/sondage", sondageRoutes);
app.use("/vote", voteRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/user", userRoutes);

/* =========================
   AUTO-FINISH (toutes 60s)
   -> récupère io via app.get("io")
========================= */
setInterval(async () => {
  try {
    const io = app.get("io"); // ✅ défini dans bin/www
    const updated = await pollCtrl.runAutoFinish(io);
    if (updated > 0) console.log("✅ auto-finish updated:", updated);
  } catch (e) {
    console.log("❌ auto-finish error:", e.message);
  }
}, 60_000);
app.get("/dbtest", async (req, res) => {
  try {
    const [r] = await db.query("SELECT 1 as ok");
    res.json(r[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = app;
