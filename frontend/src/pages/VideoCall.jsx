import Layout from "../components/Layout";
import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import socket from "../socket";
import API from "../services/api";
import WhiteboardCanvas from "../components/WhiteboardCanvas";
import "../styles/videocall.css";
import { 
  Mic, MicOff, Video as VideoIcon, VideoOff, MonitorUp, PhoneOff, 
  MessageSquare, Users, Paintbrush, MonitorStop, Send
} from "lucide-react";

const RemoteVideo = ({ stream, peerInfo, peerId }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="video-tile">
      <video ref={videoRef} autoPlay playsInline />
      <div className="video-tile-info">
        <span>{peerInfo?.username || `User (${peerId.substring(0, 4)})`}</span>
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
  const [remoteStreams, setRemoteStreams] = useState({}); // Map of socketId -> MediaStream
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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      return true;
    } catch (error) {
      console.error("[WebRTC] Error accessing camera/mic:", error);
      alert(
        "Could not access camera/microphone. You will join the call with audio/video disabled. " +
        "For LAN access, ensure you use a secure context (HTTPS) or configure your browser flags."
      );
      return false;
    }
  };

  const processQueuedIceCandidates = async (senderId) => {
    const pc = peerConnections.current[senderId];
    const queue = iceCandidateQueues.current[senderId];
    if (pc && queue && queue.length > 0) {
      console.log(`[WebRTC] Processing ${queue.length} queued ICE candidates for ${senderId}`);
      for (const candidate of queue) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error(`[WebRTC] Failed to add queued ICE candidate for ${senderId}:`, err);
        }
      }
      iceCandidateQueues.current[senderId] = [];
    }
  };

  const createPeerConnection = (targetSocketId) => {
    let pc = peerConnections.current[targetSocketId];
    
    // Glare Prevention: Do not recreate if it already exists and is healthy
    if (pc) {
      const state = pc.signalingState;
      if (state !== "closed") {
        console.warn(`[WebRTC] PeerConnection already exists for ${targetSocketId} in state: ${state}. Not recreating.`);
        return pc;
      } else {
        console.log(`[WebRTC] Cleaning up closed PeerConnection for: ${targetSocketId}`);
        delete peerConnections.current[targetSocketId];
      }
    }

    console.log(`[WebRTC] Peer Connection Created for: ${targetSocketId}`);
    pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
      ],
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`[WebRTC] ICE Candidate Sent to ${targetSocketId}`);
        socket.emit("ice-candidate", {
          targetId: targetSocketId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      console.log(`[WebRTC] Remote Track Received from ${targetSocketId}, kind: ${event.track.kind}`);
      setRemoteStreams((prev) => {
        const existingStream = prev[targetSocketId];
        if (existingStream) {
          if (!existingStream.getTracks().some((t) => t.id === event.track.id)) {
            existingStream.addTrack(event.track);
          }
          return { ...prev, [targetSocketId]: existingStream }; // Trigger re-render
        } else {
          const newStream = new MediaStream();
          newStream.addTrack(event.track);
          return { ...prev, [targetSocketId]: newStream };
        }
      });
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection state with ${targetSocketId}: ${pc.connectionState}`);
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
    let isMounted = true;
    let hasJoined = false;

    fetchMeetingDetails();
    fetchChatHistory();

    const initCall = async () => {
      await startCamera();
      
      if (isMounted && !hasJoined) {
        hasJoined = true;
        console.log(`[WebRTC] Joining video room ${id} as ${user._id}`);
        socket.emit("join-video-room", { roomId: id, user });
        socket.emit("join-meeting", id);
      }
    };

    initCall();

    socket.on("all-users", async (activePeers) => {
      console.log("[WebRTC] Received all-users list:", activePeers.map(p => p.socketId));
      setParticipants(activePeers);

      for (const peer of activePeers) {
        try {
          const pc = createPeerConnection(peer.socketId);
          if (pc.signalingState === "stable") {
             const offer = await pc.createOffer();
             await pc.setLocalDescription(offer);
             console.log(`[WebRTC] Offer Sent to existing user: ${peer.socketId}`);
             socket.emit("offer", { targetId: peer.socketId, offer });
          }
        } catch (err) {
          console.error(`[WebRTC] Failed to create offer for ${peer.socketId}:`, err);
        }
      }
    });

    socket.on("offer", async ({ offer, senderId }) => {
      console.log(`[WebRTC] Offer Received from joiner: ${senderId}`);
      const pc = createPeerConnection(senderId);
      try {
        if (pc.signalingState !== "stable") {
           console.warn(`[WebRTC] Ignored offer, signalingState is ${pc.signalingState}`);
           return;
        }
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        console.log(`[WebRTC] Remote Description Set (Offer) for: ${senderId}`);
        
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        console.log(`[WebRTC] Answer Sent to: ${senderId}`);
        socket.emit("answer", { targetId: senderId, answer });
        
        await processQueuedIceCandidates(senderId);
      } catch (err) {
        console.error(`[WebRTC] Failed to handle offer from ${senderId}:`, err);
      }
    });

    socket.on("answer", async ({ answer, senderId }) => {
      console.log(`[WebRTC] Answer Received from: ${senderId}`);
      const pc = peerConnections.current[senderId];
      if (pc) {
        try {
          if (pc.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
            console.log(`[WebRTC] Remote Description Set (Answer) for: ${senderId}`);
            await processQueuedIceCandidates(senderId);
          } else {
             console.warn(`[WebRTC] Ignored answer in state: ${pc.signalingState}`);
          }
        } catch (err) {
          console.error(`[WebRTC] Failed to handle answer from ${senderId}:`, err);
        }
      }
    });

    socket.on("ice-candidate", async ({ candidate, senderId }) => {
      console.log(`[WebRTC] ICE Candidate Received from: ${senderId}`);
      const pc = peerConnections.current[senderId];
      
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error(`[WebRTC] Failed to add ICE candidate for ${senderId}:`, err);
        }
      } else {
        if (!iceCandidateQueues.current[senderId]) {
          iceCandidateQueues.current[senderId] = [];
        }
        iceCandidateQueues.current[senderId].push(candidate);
        console.log(`[WebRTC] Queued ICE candidate for ${senderId}`);
      }
    });

    socket.on("user-joined", (newUser) => {
      console.log(`[WebRTC] User Joined: ${newUser.socketId} (${newUser.username})`);
      setParticipants((prev) => {
        if (prev.some((p) => p.socketId === newUser.socketId)) return prev;
        return [...prev, newUser];
      });
    });

    socket.on("user-left", (socketId) => {
      console.log(`[WebRTC] User presence left: ${socketId}`);
      if (peerConnections.current[socketId]) {
        console.log(`[WebRTC] Peer Connection Closed: ${socketId}`);
        peerConnections.current[socketId].close();
        delete peerConnections.current[socketId];
      }
      if (iceCandidateQueues.current[socketId]) {
        delete iceCandidateQueues.current[socketId];
      }
      setRemoteStreams((prev) => {
        const updated = { ...prev };
        delete updated[socketId];
        return updated;
      });
      setParticipants((prev) => prev.filter((p) => p.socketId !== socketId));
    });

    // Chat / Whiteboard events
    socket.on("receive-meeting-message", (message) => {
      setMessages((prev) => [...prev, message]);
      scrollChatToBottom();
    });
    socket.on("whiteboard-mode-enabled", () => setWorkspaceMode("whiteboard"));
    socket.on("video-mode-enabled", () => setWorkspaceMode("video"));

    return () => {
      isMounted = false;
      
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      Object.keys(peerConnections.current).forEach((socketId) => {
        console.log(`[WebRTC] Peer Connection Closed (Cleanup): ${socketId}`);
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
  }, [id, user._id]);

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
    const total = Object.keys(remoteStreams).length + 1;
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
          <div style={{ color: "var(--text-muted)", fontSize: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Users size={16} /> Connected Participants: {participants.length + 1}
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
                    {!micEnabled && <div className="status-badge"><MicOff size={16} /></div>}
                    {!videoEnabled && <div className="status-badge"><VideoOff size={16} /></div>}
                  </div>
                </div>

                {/* Remote Videos */}
                {Object.keys(remoteStreams).map((socketId) => {
                  const stream = remoteStreams[socketId];
                  const peerInfo = participants.find((p) => p.socketId === socketId);
                  return (
                    <RemoteVideo 
                      key={socketId} 
                      peerId={socketId}
                      stream={stream} 
                      peerInfo={peerInfo} 
                    />
                  );
                })}
              </div>
            ) : (
              <div style={{ flex: 1, padding: "20px", background: "var(--bg-darker)", overflowY: "auto" }}>
                <h3 style={{ color: "var(--text-main)", marginBottom: "15px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Paintbrush size={20} color="var(--primary)" /> Shared Collaborative Whiteboard
                </h3>
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
                <MessageSquare size={16} /> Chat
              </button>
              <button
                className={`panel-tab-btn ${activeTab === "participants" ? "active" : ""}`}
                onClick={() => setActiveTab("participants")}
              >
                <Users size={16} /> Participants
              </button>
            </div>

            {activeTab === "chat" ? (
              <div className="panel-chat-container">
                <div className="panel-chat-messages">
                  {messages.length === 0 ? (
                    <p style={{ color: "var(--text-muted)", textAlign: "center", marginTop: "20px" }}>
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
                  <button onClick={sendChatMessage}><Send size={16} /></button>
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
                        background: "var(--primary)",
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
                    <span style={{ color: "var(--text-main)", fontSize: "14px" }}>
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
                            background: "var(--border)",
                            color: "var(--text-main)",
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
                        <span style={{ color: "var(--text-main)", fontSize: "14px" }}>
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
            {workspaceMode === "video" ? <Paintbrush size={24} /> : <VideoIcon size={24} />}
          </button>

          <button
            onClick={toggleMic}
            className={`control-btn ${!micEnabled ? "active" : ""}`}
            title={micEnabled ? "Mute Microphone" : "Unmute Microphone"}
          >
            {micEnabled ? <Mic size={24} /> : <MicOff size={24} />}
          </button>

          <button
            onClick={toggleVideo}
            className={`control-btn ${!videoEnabled ? "active" : ""}`}
            title={videoEnabled ? "Stop Camera" : "Start Camera"}
          >
            {videoEnabled ? <VideoIcon size={24} /> : <VideoOff size={24} />}
          </button>

          <button
            onClick={screenSharing ? stopScreenShare : startScreenShare}
            className={`control-btn screen-share ${screenSharing ? "sharing" : ""}`}
            title={screenSharing ? "Stop Screen Share" : "Share Screen"}
          >
            {screenSharing ? <MonitorStop size={24} /> : <MonitorUp size={24} />}
          </button>

          <button
            onClick={() => setChatOpen(!chatOpen)}
            className={`control-btn chat-toggle ${chatOpen ? "active" : ""}`}
            title={chatOpen ? "Hide chat panel" : "Show chat panel"}
          >
            <MessageSquare size={24} />
          </button>

          <button onClick={leaveCall} className="control-btn leave-btn" title="Leave Call">
            <PhoneOff size={28} />
          </button>
        </div>
      </div>
    </Layout>
  );
}

export default VideoCall;