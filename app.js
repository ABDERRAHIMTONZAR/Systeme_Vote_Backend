const express = require("express");
const path = require("path");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

// routes
const indexRouter = require("./routes/index");
const autroutes = require("./routes/auth.routes");
const sondageRoutes = require("./routes/sondageRoutes");
const voteRoutes = require("./routes/voteRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const userRoutes = require("./routes/userRoutes");

// controller timer
const pollCtrl = require("./controllers/pollController");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));

/**
 * ✅ IMPORTANT:
 * - PAS de slash final
 * - même liste pour Express + Socket.IO
 */
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3002",
  "https://systeme-vote-frontend-3flt.vercel.app",
];

// ✅ CORS Express (gère aussi Postman/curl)
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("CORS blocked: " + origin));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ✅ Répondre aux preflight OPTIONS (très important)
app.options("*", cors());

// routes
app.use("/", indexRouter);
app.use("/users", autroutes);
app.use("/sondage", sondageRoutes);
app.use("/vote", voteRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/user", userRoutes);

const server = http.createServer(app);

// ✅ Socket.IO avec la même config CORS
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  },
});

io.on("connection", (socket) => {
  console.log("✅ Socket connecté:", socket.id);
});

app.set("io", io);

// ✅ auto-finish côté serveur (toutes les 60s)
setInterval(async () => {
  try {
    const updated = await pollCtrl.runAutoFinish(io);
    if (updated > 0) console.log("✅ auto-finish updated:", updated);
  } catch (e) {
    console.log("❌ auto-finish error:", e.message);
  }
}, 60_000);

// ✅ PORT dynamique (Koyeb)
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log("🚀 Server listening on port", PORT);
});

module.exports = app;
