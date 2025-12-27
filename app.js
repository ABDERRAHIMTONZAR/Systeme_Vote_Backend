const express = require("express");
const path = require("path");

// routes
const indexRouter = require("./routes/index");
const autroutes = require("./routes/auth.routes");
const sondageRoutes = require("./routes/sondageRoutes");
const voteRoutes = require("./routes/voteRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const userRoutes = require("./routes/userRoutes");

const db = require("./config/db"); // ✅ adapte le chemin vers ton pool mysql2/promise

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));

// ✅ Autoriser local + toutes les previews Vercel (systeme-vote-frontend-xxxx.vercel.app)
const allowed = (origin) => {
  if (!origin) return true; // Postman/curl
  if (origin === "http://localhost:3000") return true;
  if (origin === "http://localhost:3002") return true;

  // Toutes tes previews vercel du projet
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

  // ✅ Preflight
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/health", (req, res) => res.status(200).send("ok"));

app.get("/db-test", async (req, res) => {
  try {
    const [r] = await db.query("SELECT 1 AS ok");
    res.json(r[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// routes
app.use("/", indexRouter);
app.use("/users", autroutes);
app.use("/sondage", sondageRoutes);
app.use("/vote", voteRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/user", userRoutes);

module.exports = app;
