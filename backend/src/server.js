const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const teamChatSocket = require(
  "./socket/teamChatSocket"
);
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");

const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const teamRoutes = require("./routes/teamRoutes");
const teamMessageRoutes = require(
  "./routes/teamMessageRoutes"
);
const meetingRoutes = require(
  "./routes/meetingRoutes"
);
const meetingMessageRoutes =
  require(
    "./routes/meetingMessageRoutes"
  );

const meetingChatSocket =
  require(
    "./socket/meetingChatSocket"
  );

const webrtcSocket =
  require(
    "./socket/webrtcSocket"
  );

const fileRoutes =
  require("./routes/fileRoutes");

const whiteboardSocket =
  require(
    "./socket/whiteboardSocket"
  );

const notificationRoutes =
  require(
    "./routes/notificationRoutes"
  );

dotenv.config();

connectDB();

const app = express();

app.use(cors());

app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/teams", teamRoutes);
app.use(
  "/api/team-messages",
  teamMessageRoutes
);
app.use(
  "/api/meetings",
  meetingRoutes
);
app.use(
  "/api/meeting-messages",
  meetingMessageRoutes
);

app.use("/api/files", fileRoutes);

app.use(
  "/uploads",
  express.static(
    path.join(__dirname, "../uploads")
  )
);

app.use(
  "/api/notifications",
  notificationRoutes
);

app.get("/", (req, res) => {
  res.send("NeXo API Running");
});

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// Attach io to app to access in controllers
app.set("io", io);

io.on("connection", (socket) => {
  socket.on("join-notifications", (userId) => {
    socket.join(`user-${userId}`);
    console.log(`User socket ${socket.id} joined notification room: user-${userId}`);
  });
});

teamChatSocket(io);
meetingChatSocket(io);
webrtcSocket(io);
whiteboardSocket(io);

server.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Server running on port ${PORT}`
  );
});