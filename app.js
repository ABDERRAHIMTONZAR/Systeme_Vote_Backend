const express = require("express");
const path = require("path");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

// ✅ DB (dans dossier db/)
const db = require("./db/db");

// routes
const indexRouter = require("./routes/index");
const authRoutes = require("./routes/auth.routes");
const sondageRoutes = require("./routes/sondageRoutes");
const voteRoutes = require("./routes/voteRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const userRoutes = require("./routes/userRoutes");

// controller
const pollCtrl = require("./controllers/pollController");

const app = express();

/* =========================
   Middleware de base
========================= */
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));

/* =========================
   CORS (LOCAL + VERCEL)
========================= */
const allowed = (origin) => {
  if (!origin) return true; // Postman / curl
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
   ROUTES
========================= */
app.use("/", indexRouter);
app.use("/users", authRoutes);
app.use("/sondage", sondageRoutes);
app.use("/vote", voteRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/user", userRoutes);

/* =========================
   HEALTH CHECK (KOYEB)
========================= */
app.get("/health", (req, res) => res.status(200).send("ok"));

/* =========================
   DB TEST
========================= */
app.get("/db-test", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT 1 AS ok");
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* =========================
   SERVER + SOCKET.IO
========================= */
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: allowed,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  },
});

io.on("connection", (socket) => {
  console.log("✅ Socket connecté:", socket.id);
});

app.set("io", io);

/* =========================
   AUTO-FINISH (CRON)
========================= */
setInterval(async () => {
  try {
    const updated = await pollCtrl.runAutoFinish(io);
    if (updated > 0) {
      console.log("✅ auto-finish updated:", updated);
    }
  } catch (e) {
    console.log("❌ auto-finish error:", e.message);
  }
}, 60_000);

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log("🚀 Server listening on port", PORT);
});

module.exports = app;
