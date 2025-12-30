// app.js
const express = require("express");
const path = require("path");
const db = require("./db/db");

const indexRouter = require("./routes/index");
const authRoutes = require("./routes/auth.routes");
const sondageRoutes = require("./routes/sondageRoutes");
const voteRoutes = require("./routes/voteRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const userRoutes = require("./routes/userRoutes");

const pollCtrl = require("./controllers/pollController");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));

console.log(
  "MAIL_USER set:",
  !!process.env.MAIL_USER,
  "MAIL_PASS set:",
  !!process.env.MAIL_PASS
);

const allowed = (origin) => {
  if (!origin) return true;
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

app.get("/health", (req, res) => res.status(200).send("ok"));

app.get("/db-test", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT DATABASE() AS db, NOW() AS now");
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.use("/", indexRouter);
app.use("/users", authRoutes);
app.use("/sondage", sondageRoutes);
app.use("/vote", voteRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/user", userRoutes);

// ✅ auto-finish loop
setInterval(async () => {
  try {
    const io = app.get("io");
    const updated = await pollCtrl.runAutoFinish(io);
    if (updated > 0) console.log("✅ auto-finish updated:", updated);
  } catch (e) {
    console.log("❌ auto-finish error:", e.message);
  }
}, 30_000);

module.exports = app;
