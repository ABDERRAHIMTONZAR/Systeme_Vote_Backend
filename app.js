const express = require("express");
const path = require("path");
const cors = require("cors");

// routes
const indexRouter = require("./routes/index");
const autroutes = require("./routes/auth.routes");
const sondageRoutes = require("./routes/sondageRoutes");
const voteRoutes = require("./routes/voteRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const userRoutes = require("./routes/userRoutes");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));

// ✅ Autoriser toutes tes URLs Vercel (preview) + local
const allowed = (origin) => {
  if (!origin) return true; // Postman/curl
  if (origin === "http://localhost:3000") return true;
  if (origin === "http://localhost:3002") return true;
  if (/^https:\/\/systeme-vote-frontend-.*\.vercel\.app$/.test(origin)) return true;
  return false;
};

// ✅ CORS + preflight
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

// ✅ Healthcheck
app.get("/health", (req, res) => res.status(200).send("ok"));

// routes
app.use("/", indexRouter);
app.use("/users", autroutes);
app.use("/sondage", sondageRoutes);
app.use("/vote", voteRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/user", userRoutes);

module.exports = app;
