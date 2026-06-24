import Layout from "../components/Layout";
import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import socket from "../socket";
import API from "../services/api";
import WhiteboardCanvas from "../components/WhiteboardCanvas";
import "../styles/videocall.css";

const RemoteVideo = ({ peer, peerInfo }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && peer.stream) {
      videoRef.current.srcObject = peer.stream;
    }
  }, [peer.stream]);

  return (
    <div className="video-tile">
      <video ref={videoRef} autoPlay playsInline />
      <div className="video-tile-info">
        <span>{peerInfo?.username || `User (${peer.id.substring(0, 4)})`}</span>
      </div>
    </div>
  );
};

function VideoCall() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user"));

  const localVideoRef = useRef(null);
  const peerConnections = useRef({}); // Map of socketId -> RTCPeerConnection
  const iceCandidateQueues = useRef({}); // Map of socketId -> Array of RTCIceCandidateInit
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const originalVideoTrackRef = useRef(null);

  // States
  const [meeting, setMeeting] = useState(null);
  const [peers, setPeers] = useState([]); // List of { id: socketId, stream }
  const [participants, setParticipants] = useState([]); // List of active users details
  const [micEnabled, setMicEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);

  // Redesign Layout States
  const [workspaceMode, setWorkspaceMode] = useState("video"); // 'video' or 'whiteboard'
  const [chatOpen, setChatOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("chat"); // 'chat' or 'participants'
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");

  const startCamera = async () => {
    console.log("=== WEBRTC DIAGNOSTICS ===");
    console.log("User Agent:", navigator.userAgent);
    console.log("Is Secure Context:", window.isSecureContext);
    console.log("typeof navigator.mediaDevices:", typeof navigator.mediaDevices);
    console.log("navigator.mediaDevices:", navigator.mediaDevices);
    console.log("==========================");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error("Error accessing camera/mic:", error);
      alert(
        "Could not access camera/microphone. You will join the call with audio/video disabled. " +
        "For LAN access, ensure you use a secure context (HTTPS) or configure your browser flags."
      );
    } finally {
      // Join the video call channel and supply user metadata - ALWAYS run even if camera fails!
      socket.emit("join-video-room", { roomId: id, user });
      socket.emit("join-meeting", id);
    }
  };

  const processQueuedIceCandidates = async (senderId) => {
    const pc = peerConnections.current[senderId];
    const queue = iceCandidateQueues.current[senderId];
    if (pc && queue && queue.length > 0) {
      console.log(`Processing ${queue.length} queued ICE candidates for ${senderId}`);
      for (const candidate of queue) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error("Failed to add queued ICE candidate:", err);
        }
      }
      iceCandidateQueues.current[senderId] = [];
    }
  };

  const createPeerConnection = (targetSocketId) => {
    if (peerConnections.current[targetSocketId]) {
      console.log(`Cleaning up existing PeerConnection for: ${targetSocketId}`);
      peerConnections.current[targetSocketId].close();
      delete peerConnections.current[targetSocketId];
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
      ],
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", {
          targetId: targetSocketId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      console.log(`Received track from: ${targetSocketId}, kind: ${event.track.kind}`);
      setPeers((prev) => {
        const existingPeer = prev.find((p) => p.id === targetSocketId);
        if (existingPeer) {
          const stream = existingPeer.stream;
          if (!stream.getTracks().some((t) => t.id === event.track.id)) {
            stream.addTrack(event.track);
          }
          // Do not clone the stream. This keeps the media reference stable.
          // We return a new array to trigger a React re-render.
          return [...prev];
        } else {
          const newStream = new MediaStream();
          newStream.addTrack(event.track);
          return [...prev, { id: targetSocketId, stream: newStream }];
        }
      });
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    peerConnections.current[targetSocketId] = pc;
    return pc;
  };

  useEffect(() => {
    fetchMeetingDetails();
    fetchChatHistory();
    startCamera();

    // 1. Receives list of existing users details
    socket.on("all-users", async (activePeers) => {
      console.log("Existing users in room:", activePeers);
      setParticipants(activePeers);

      for (const peer of activePeers) {
        const pc = createPeerConnection(peer.socketId);
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("offer", { targetId: peer.socketId, offer });
        } catch (err) {
          console.error("Failed to create offer:", err);
        }
      }
    });

    // 2. Received offer from joiner
    socket.on("offer", async ({ offer, senderId }) => {
      console.log("Received offer from:", senderId);
      const pc = createPeerConnection(senderId);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("answer", { targetId: senderId, answer });
        
        // Process queued ICE candidates
        await processQueuedIceCandidates(senderId);
      } catch (err) {
        console.error("Failed to handle offer:", err);
      }
    });

    // 3. Received answer
    socket.on("answer", async ({ answer, senderId }) => {
      console.log("Received answer from:", senderId);
      const pc = peerConnections.current[senderId];
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          // Process queued ICE candidates
          await processQueuedIceCandidates(senderId);
        } catch (err) {
          console.error("Failed to handle answer:", err);
        }
      }
    });

    // 4. Received ICE candidate
    socket.on("ice-candidate", async ({ candidate, senderId }) => {
      const pc = peerConnections.current[senderId];
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error("Failed to add ICE candidate directly:", err);
        }
      } else {
        // Queue it
        if (!iceCandidateQueues.current[senderId]) {
          iceCandidateQueues.current[senderId] = [];
        }
        iceCandidateQueues.current[senderId].push(candidate);
        console.log(`Queued ICE candidate from ${senderId}`);
      }
    });

    // 5. User joined - update presence metadata
    socket.on("user-joined", (newUser) => {
      console.log("User presence joined:", newUser);
      setParticipants((prev) => {
        if (prev.some((p) => p.socketId === newUser.socketId)) return prev;
        return [...prev, newUser];
      });
    });

    // 6. User left
    socket.on("user-left", (socketId) => {
      console.log("User presence left:", socketId);
      if (peerConnections.current[socketId]) {
        peerConnections.current[socketId].close();
        delete peerConnections.current[socketId];
      }
      if (iceCandidateQueues.current[socketId]) {
        delete iceCandidateQueues.current[socketId];
      }
      setPeers((prev) => prev.filter((p) => p.id !== socketId));
      setParticipants((prev) => prev.filter((p) => p.socketId !== socketId));
    });

    // 7. Meeting Chat Messages Sync
    socket.on("receive-meeting-message", (message) => {
      setMessages((prev) => [...prev, message]);
      scrollChatToBottom();
    });

    // 8. Workspace View Modes Sync
    socket.on("whiteboard-mode-enabled", () => {
      setWorkspaceMode("whiteboard");
    });

    socket.on("video-mode-enabled", () => {
      setWorkspaceMode("video");
    });

    return () => {
      // Cleanups
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      Object.keys(peerConnections.current).forEach((socketId) => {
        peerConnections.current[socketId].close();
      });
      peerConnections.current = {};
      iceCandidateQueues.current = {};

      socket.emit("leave-video-room", id);
      socket.emit("leave-meeting", id);

      socket.off("all-users");
      socket.off("offer");
      socket.off("answer");
      socket.off("ice-candidate");
      socket.off("user-joined");
      socket.off("user-left");
      socket.off("receive-meeting-message");
      socket.off("whiteboard-mode-enabled");
      socket.off("video-mode-enabled");
    };
  }, [id]);

  const fetchMeetingDetails = async () => {
    try {
      const res = await API.get(`/meetings/${id}`);
      setMeeting(res.data);
    } catch (err) {
      console.error("Failed to fetch meeting details:", err);
    }
  };

  const fetchChatHistory = async () => {
    try {
      const res = await API.get(`/meeting-messages/${id}`);
      setMessages(res.data);
      setTimeout(scrollChatToBottom, 100);
    } catch (err) {
      console.error("Failed to fetch chat logs:", err);
    }
  };

  const sendChatMessage = () => {
    if (!newMessage.trim()) return;

    socket.emit("send-meeting-message", {
      meetingId: id,
      senderId: user._id,
      content: newMessage,
    });
    setNewMessage("");
  };

  const scrollChatToBottom = () => {
    const chatContainer = document.querySelector(".panel-chat-messages");
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  };

  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicEnabled(audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const startScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
      screenStreamRef.current = screenStream;
      const screenTrack = screenStream.getVideoTracks()[0];

      originalVideoTrackRef.current = localStreamRef.current.getVideoTracks()[0];

      Object.values(peerConnections.current).forEach((pc) => {
        const senders = pc.getSenders();
        const videoSender = senders.find(
          (s) => s.track && s.track.kind === "video"
        );
        if (videoSender) {
          videoSender.replaceTrack(screenTrack);
        }
      });

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = screenStream;
      }

      setScreenSharing(true);

      screenTrack.onended = () => {
        stopScreenShare();
      };
    } catch (error) {
      console.error("Error screen sharing:", error);
    }
  };

  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }

    const originalTrack = originalVideoTrackRef.current;
    if (originalTrack) {
      Object.values(peerConnections.current).forEach((pc) => {
        const senders = pc.getSenders();
        const videoSender = senders.find(
          (s) => s.track && s.track.kind === "video"
        );
        if (videoSender) {
          videoSender.replaceTrack(originalTrack);
        }
      });
    }

    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }

    setScreenSharing(false);
  };

  // Sync mode triggers across the room
  const toggleWorkspaceMode = (mode) => {
    setWorkspaceMode(mode);
    if (mode === "whiteboard") {
      socket.emit("enable-whiteboard-mode", id);
    } else {
      socket.emit("enable-video-mode", id);
    }
  };

  const leaveCall = () => {
    navigate(`/meetings/${id}`);
  };

  const getGridLayoutClass = () => {
    const total = peers.length + 1;
    if (total === 1) return "video-grid single";
    if (total === 2) return "video-grid double";
    return "video-grid";
  };

  const initials = user?.username?.substring(0, 2).toUpperCase() || "UN";

  return (
    <Layout>
      <div className="video-call-container">
        <div className="video-call-header">
          <div>
            <h1>{meeting?.title || "Workspace meeting"}</h1>
            <p>Meeting Room Code: {meeting?.meetingCode || id}</p>
          </div>
          <div style={{ color: "#94a3b8", fontSize: "14px" }}>
            Connected Participants: {participants.length + 1}
          </div>
        </div>

        <div className="video-call-content-wrapper">
          {/* Main Content Area */}
          <div className="workspace-main">
            {workspaceMode === "video" ? (
              <div className={getGridLayoutClass()}>
                {/* Local Video */}
                <div className="video-tile">
                  <video ref={localVideoRef} autoPlay playsInline muted />
                  <div className="video-tile-info">
                    <span>You (Local)</span>
                  </div>
                  <div className="video-status-overlay">
                    {!micEnabled && <div className="status-badge">🔇</div>}
                    {!videoEnabled && <div className="status-badge">📷</div>}
                  </div>
                </div>

                {/* Remote Videos */}
                {peers.map((peer) => {
                  const peerInfo = participants.find((p) => p.socketId === peer.id);
                  return <RemoteVideo key={peer.id} peer={peer} peerInfo={peerInfo} />;
                })}
              </div>
            ) : (
              <div style={{ flex: 1, padding: "20px", background: "#0b0f19", overflowY: "auto" }}>
                <h3 style={{ color: "#f8fafc", marginBottom: "15px" }}>Shared Collaborative Whiteboard</h3>
                <WhiteboardCanvas meetingId={id} />
              </div>
            )}
          </div>

          {/* Right Collapsible Panel */}
          <div className={`workspace-side-panel ${!chatOpen ? "collapsed" : ""}`}>
            <div className="panel-tabs">
              <button
                className={`panel-tab-btn ${activeTab === "chat" ? "active" : ""}`}
                onClick={() => setActiveTab("chat")}
              >
                💬 Chat
              </button>
              <button
                className={`panel-tab-btn ${activeTab === "participants" ? "active" : ""}`}
                onClick={() => setActiveTab("participants")}
              >
                👥 Participants ({participants.length + 1})
              </button>
            </div>

            {activeTab === "chat" ? (
              <div className="panel-chat-container">
                <div className="panel-chat-messages">
                  {messages.length === 0 ? (
                    <p style={{ color: "#94a3b8", textAlign: "center", marginTop: "20px" }}>
                      No messages in this call.
                    </p>
                  ) : (
                    messages.map((msg, index) => (
                      <div key={msg._id || index} className="panel-chat-bubble">
                        <strong>{msg.sender?.username}</strong>
                        <p>{msg.content}</p>
                      </div>
                    ))
                  )}
                </div>
                <div className="panel-chat-input-bar">
                  <input
                    type="text"
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") sendChatMessage();
                    }}
                  />
                  <button onClick={sendChatMessage}>Send</button>
                </div>
              </div>
            ) : (
              <div className="panel-participants-container">
                {/* Local User */}
                <div className="participant-row">
                  <div className="participant-avatar-container">
                    <div
                      className="avatar"
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "50%",
                        background: "#3b82f6",
                        color: "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "12px",
                        fontWeight: "bold",
                        overflow: "hidden",
                      }}
                    >
                      {user?.avatar ? (
                        <img
                          src={user.avatar}
                          alt="avatar"
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        initials
                      )}
                    </div>
                    <span style={{ color: "#f8fafc", fontSize: "14px" }}>
                      {user?.username} (You)
                    </span>
                  </div>
                  <div className="participant-badge" />
                </div>

                {/* Remote Users */}
                {participants.map((p) => {
                  const pInitials = p.username?.substring(0, 2).toUpperCase() || "PE";
                  return (
                    <div key={p.socketId} className="participant-row">
                      <div className="participant-avatar-container">
                        <div
                          className="avatar"
                          style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "50%",
                            background: "#64748b",
                            color: "white",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "12px",
                            fontWeight: "bold",
                            overflow: "hidden",
                          }}
                        >
                          {p.avatar ? (
                            <img
                              src={p.avatar}
                              alt="avatar"
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                          ) : (
                            pInitials
                          )}
                        </div>
                        <span style={{ color: "#f8fafc", fontSize: "14px" }}>
                          {p.username}
                        </span>
                      </div>
                      <div className="participant-badge" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Floating Toolbar Controls */}
        <div className="call-controls-bar">
          <button
            onClick={() => toggleWorkspaceMode(workspaceMode === "video" ? "whiteboard" : "video")}
            className={`control-btn whiteboard-toggle ${workspaceMode === "whiteboard" ? "active" : ""}`}
            title={workspaceMode === "video" ? "Switch to Whiteboard Workspace" : "Switch back to Video call"}
          >
            {workspaceMode === "video" ? "🎨" : "📹"}
          </button>

          <button
            onClick={toggleMic}
            className={`control-btn ${!micEnabled ? "active" : ""}`}
            title={micEnabled ? "Mute Microphone" : "Unmute Microphone"}
          >
            {micEnabled ? "🎙️" : "🔇"}
          </button>

          <button
            onClick={toggleVideo}
            className={`control-btn ${!videoEnabled ? "active" : ""}`}
            title={videoEnabled ? "Stop Camera" : "Start Camera"}
          >
            {videoEnabled ? "📹" : "📷"}
          </button>

          <button
            onClick={screenSharing ? stopScreenShare : startScreenShare}
            className={`control-btn screen-share ${screenSharing ? "sharing" : ""}`}
            title={screenSharing ? "Stop Screen Share" : "Share Screen"}
          >
            🖥️
          </button>

          <button
            onClick={() => setChatOpen(!chatOpen)}
            className="control-btn"
            style={{ background: chatOpen ? "#3b82f6" : "#334155" }}
            title={chatOpen ? "Hide chat panel" : "Show chat panel"}
          >
            💬
          </button>

          <button onClick={leaveCall} className="control-btn leave-btn" title="Leave Call">
            ❌
          </button>
        </div>
      </div>
    </Layout>
  );
}

export default VideoCall;