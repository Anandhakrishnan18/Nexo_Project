const webrtcSocket = (io) => {
  io.on("connection", (socket) => {
    console.log(`WebRTC User Connected: ${socket.id}`);

    // Join Video Room with user metadata
    socket.on("join-video-room", ({ roomId, user }) => {
      socket.join(roomId);
      socket.user = user; // Attach user metadata to socket instance
      console.log(`${socket.id} (User: ${user?.username}) joined video room ${roomId}`);

      // Fetch all other clients details currently in the room
      const clients = io.sockets.adapter.rooms.get(roomId);
      const activePeers = [];
      
      if (clients) {
        clients.forEach((socketId) => {
          if (socketId !== socket.id) {
            const clientSocket = io.sockets.sockets.get(socketId);
            if (clientSocket && clientSocket.user) {
              activePeers.push({
                socketId,
                _id: clientSocket.user._id,
                username: clientSocket.user.username,
                email: clientSocket.user.email,
                avatar: clientSocket.user.avatar,
              });
            } else {
              activePeers.push({ socketId });
            }
          }
        });
      }

      // Send the list of existing active users with details to the joiner
      socket.emit("all-users", activePeers);

      // Broadcast user details to other users in the room
      socket.to(roomId).emit("user-joined", {
        socketId: socket.id,
        _id: user?._id,
        username: user?.username,
        email: user?.email,
        avatar: user?.avatar,
      });
    });

    // Targeted WebRTC Offer (Sender -> Target Client)
    socket.on("offer", ({ targetId, offer }) => {
      io.to(targetId).emit("offer", {
        offer,
        senderId: socket.id,
      });
    });

    // Targeted WebRTC Answer (Sender -> Target Client)
    socket.on("answer", ({ targetId, answer }) => {
      io.to(targetId).emit("answer", {
        answer,
        senderId: socket.id,
      });
    });

    // Targeted ICE Candidate (Sender -> Target Client)
    socket.on("ice-candidate", ({ targetId, candidate }) => {
      io.to(targetId).emit("ice-candidate", {
        candidate,
        senderId: socket.id,
      });
    });

    // Mode Sync Events
    socket.on("enable-whiteboard-mode", (roomId) => {
      socket.to(roomId).emit("whiteboard-mode-enabled");
      console.log(`Whiteboard mode enabled in room ${roomId}`);
    });

    socket.on("enable-video-mode", (roomId) => {
      socket.to(roomId).emit("video-mode-enabled");
      console.log(`Video mode enabled in room ${roomId}`);
    });

    // Leave Room explicitly
    socket.on("leave-video-room", (roomId) => {
      socket.leave(roomId);
      socket.to(roomId).emit("user-left", socket.id);
      console.log(`${socket.id} left video room ${roomId}`);
    });

    // Clean up when connection is lost or tab closed
    socket.on("disconnecting", () => {
      socket.rooms.forEach((room) => {
        if (room !== socket.id) {
          socket.to(room).emit("user-left", socket.id);
        }
      });
    });

    socket.on("disconnect", () => {
      console.log(`WebRTC User Disconnected: ${socket.id}`);
    });
  });
};

module.exports = webrtcSocket;