import Layout from "../components/Layout";
import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../services/api";
import socket from "../socket";
import { 
  Settings, Users, ShieldAlert, X, UserMinus, Shield, Send
} from "lucide-react";

function TeamDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user"));
  const chatEndRef = useRef(null);

  const [team, setTeam] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");

  // Settings states
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [settingsName, setSettingsName] = useState("");
  const [settingsDesc, setSettingsDesc] = useState("");
  const [settingsVis, setSettingsVis] = useState("public");

  useEffect(() => {
    fetchTeam();
    fetchMessages();

    socket.emit("join-team", id);

    socket.on("receive-message", (message) => {
      setMessages((prev) => [...prev, message]);
    });

    return () => {
      socket.emit("leave-team", id);
      socket.off("receive-message");
    };
  }, [id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchTeam = async () => {
    try {
      const res = await API.get(`/teams/${id}`);
      setTeam(res.data);
      setSettingsName(res.data.name);
      setSettingsDesc(res.data.description || "");
      setSettingsVis(res.data.visibility || "public");
    } catch (error) {
      console.log(error);
    }
  };

  const fetchMessages = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await API.get(`/team-messages/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setMessages(res.data);
    } catch (error) {
      console.log(error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    socket.emit("send-message", {
      teamId: id,
      senderId: user._id,
      content: newMessage,
    });

    setNewMessage("");
  };

  const handleUpdateSettings = async () => {
    try {
      await API.put(`/teams/${id}/settings`, {
        name: settingsName,
        description: settingsDesc,
        visibility: settingsVis,
      });
      fetchTeam();
      setIsEditingSettings(false);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update settings");
    }
  };

  const handleDeleteTeam = async () => {
    if (window.confirm("CRITICAL: Are you sure you want to permanently delete this team? All chat logs and files will be removed.")) {
      try {
        await API.delete(`/teams/${id}`);
        navigate("/teams");
      } catch (err) {
        alert(err.response?.data?.message || "Failed to delete team");
      }
    }
  };

  const handleRoleChange = async (targetUserId, newRole) => {
    try {
      await API.put(`/teams/${id}/members/role`, {
        userId: targetUserId,
        role: newRole,
      });
      fetchTeam();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update role");
    }
  };

  const handleKickMember = async (targetUserId) => {
    if (window.confirm("Are you sure you want to remove this member?")) {
      try {
        await API.post(`/teams/${id}/members/remove`, { userId: targetUserId });
        fetchTeam();
      } catch (err) {
        alert(err.response?.data?.message || "Failed to remove member");
      }
    }
  };

  if (!team) {
    return (
      <Layout>
        <div className="team-details-container" style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "400px" }}>
          <p style={{ color: "var(--text-muted)", fontSize: "18px" }}>Loading workspace...</p>
        </div>
      </Layout>
    );
  }

  const currentUserRole = team.roles?.[user._id] || (team.owner?._id === user._id ? "owner" : "member");
  const isOwner = team.owner?._id === user._id || currentUserRole === "owner";
  const isAdmin = currentUserRole === "admin";
  const hasControl = isOwner || isAdmin;

  return (
    <Layout>
      <div className="team-details-container">
        <div className="team-details-header">
          <div>
            <h1>{team.name}</h1>
            <p>{team.description}</p>
            <div className="team-info" style={{ border: "none", paddingTop: "12px", paddingLeft: "0" }}>
              <span>Visibility: <strong style={{color:"var(--text-main)", textTransform:"capitalize"}}>{team.visibility}</strong></span>
              <span>Owner: <strong style={{color:"var(--text-main)"}}>{team.owner?.username}</strong></span>
              {team.inviteCode && (
                <span>Code: <strong style={{color:"var(--primary)", letterSpacing:"1px"}}>{team.inviteCode}</strong></span>
              )}
            </div>
          </div>

          {hasControl && (
            <button
              className="secondary-btn"
              onClick={() => setIsEditingSettings(!isEditingSettings)}
            >
              {isEditingSettings ? <><X size={16} /> Close Settings</> : <><Settings size={16} /> Team Settings</>}
            </button>
          )}
        </div>

        {isEditingSettings && (
          <div className="settings-panel">
            <h3>Workspace Details</h3>
            <input
              type="text"
              placeholder="Team Name"
              value={settingsName}
              onChange={(e) => setSettingsName(e.target.value)}
            />
            <input
              type="text"
              placeholder="Description"
              value={settingsDesc}
              onChange={(e) => setSettingsDesc(e.target.value)}
            />
            <select value={settingsVis} onChange={(e) => setSettingsVis(e.target.value)}>
              <option value="public">Public (Anyone can join)</option>
              <option value="private">Private (Requires invite code)</option>
            </select>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px" }}>
              <div style={{ display: "flex", gap: "12px" }}>
                <button className="primary-btn" onClick={handleUpdateSettings}>Save Changes</button>
                <button className="secondary-btn" onClick={() => setIsEditingSettings(false)}>Cancel</button>
              </div>

              {isOwner && (
                <button
                  className="primary-btn"
                  onClick={handleDeleteTeam}
                  style={{ background: "rgba(239, 68, 68, 0.1)", color: "var(--danger)", border: "1px solid rgba(239, 68, 68, 0.3)" }}
                >
                  <ShieldAlert size={16} /> Delete Team
                </button>
              )}
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "32px", marginTop: "32px" }}>
          
          {/* Members Sidebar */}
          <div>
            <h3 style={{ color: "var(--text-main)", display: "flex", alignItems: "center", gap: "8px" }}>
              <Users size={18} /> Members ({team.members?.length})
            </h3>
            <div className="members-list">
              {team.members?.map((member) => {
                const memberRole = team.roles?.[member._id] || (team.owner?._id === member._id ? "owner" : "member");
                const isSelf = member._id === user._id;

                return (
                  <div key={member._id} className="member-item">
                    <div className="member-info">
                      <strong>{member.username} {isSelf && "(You)"}</strong>
                      {memberRole !== "member" && <span className="role-badge">{memberRole}</span>}
                      <div>{member.email}</div>
                    </div>

                    <div style={{ display: "flex", gap: "8px" }}>
                      {isOwner && !isSelf && memberRole !== "owner" && (
                        <select
                          value={memberRole}
                          onChange={(e) => handleRoleChange(member._id, e.target.value)}
                          style={{
                            background: "var(--bg-dark)", border: "1px solid var(--border)",
                            color: "var(--text-main)", borderRadius: "6px", padding: "4px 8px", fontSize: "12px"
                          }}
                        >
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                        </select>
                      )}

                      {hasControl && !isSelf && memberRole !== "owner" && !(isAdmin && memberRole === "admin") && (
                        <button
                          onClick={() => handleKickMember(member._id)}
                          style={{
                            background: "rgba(239, 68, 68, 0.1)", color: "var(--danger)",
                            border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "6px",
                            padding: "6px", cursor: "pointer"
                          }}
                          title="Kick Member"
                        >
                          <UserMinus size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chat Section */}
          <div>
            <h3 style={{ color: "var(--text-main)" }}>Team Chat</h3>
            <div className="chat-container">
              <div className="chat-messages">
                {messages.length === 0 ? (
                  <div style={{ margin: "auto", color: "var(--text-muted)", textAlign: "center" }}>
                    <Shield size={32} style={{ margin: "0 auto 12px", opacity: 0.5 }} />
                    <p>No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  messages.map((msg, i) => {
                    const isSelf = msg.sender?._id === user._id;
                    const showSender = i === 0 || messages[i-1].sender?._id !== msg.sender?._id;

                    return (
                      <div key={msg._id} className={`chat-message ${isSelf ? "self" : "other"}`}>
                        {showSender && <div className="message-sender">{isSelf ? "You" : msg.sender?.username}</div>}
                        <div className="message-bubble">{msg.content}</div>
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="chat-input-area">
                <input
                  type="text"
                  className="chat-input"
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                />
                <button className="chat-send-btn" onClick={sendMessage}>
                  <Send size={18} style={{ marginLeft: "2px" }} />
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </Layout>
  );
}

export default TeamDetails;