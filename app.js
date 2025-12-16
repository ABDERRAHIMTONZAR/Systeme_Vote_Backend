const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const cors = require("cors");

const app = express();

// ===== Middleware =====
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));

// ===== Routes =====
let indexRouter = require("./routes/index");
let autroutes = require("./routes/auth.routes");
let sondageRoutes = require("./routes/sondageRoutes");
let voteRoutes = require("./routes/voteRoutes");
let dashboardRoutes = require("./routes/dashboardRoutes");
let userRoutes = require("./routes/userRoutes");

app.use("/", indexRouter);
app.use("/users", autroutes);
app.use("/sondage", sondageRoutes);
app.use("/vote", voteRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/user", userRoutes);

// HTTP SERVER + SOCKET.IO 
const server = http.createServer(app);
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3002",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3002",
];
const io = new Server(server, {
  cors: {
    origin: allowedOrigins, // front React
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

app.set("io", io);

// SOCKET EVENTS
io.on("connection", (socket) => {
  console.log("✅ Client connecté :", socket.id);

  socket.on("disconnect", () => {
    console.log("❌ Client déconnecté :", socket.id);
  });
});

server.listen(3001, () => {
  console.log("🚀 API + Socket.IO running on port 3001");
});

module.exports = app;
