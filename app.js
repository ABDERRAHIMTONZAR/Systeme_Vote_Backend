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

// ✅ CORS (adapte selon ton port front)
app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:3002",
        "https://systeme-vote-frontend-3fmu.vercel.app",],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// routes
app.use("/", indexRouter);
app.use("/users", autroutes);
app.use("/sondage", sondageRoutes);
app.use("/vote", voteRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/user", userRoutes);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:3002",
      "https://systeme-vote-frontend.vercel.app/"
    ],
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
    if (updated > 0) {
      console.log("✅ auto-finish updated:", updated);
    }
  } catch (e) {
    console.log("❌ auto-finish error:", e.message);
  }
}, 60_000);
 
server.listen(3001, () => {
  console.log("🚀 Server listening on port 3001");
});

module.exports = app;