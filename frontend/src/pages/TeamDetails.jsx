import Layout from "../components/Layout";
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../services/api";
import socket from "../socket";

function TeamDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user"));

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
    if (!newMessage.trim()) {
      return;
    }

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
      alert("Settings updated successfully!");
      fetchTeam();
      setIsEditingSettings(false);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to update settings");
    }
  };

  const handleDeleteTeam = async () => {
    if (
      window.confirm(
        "CRITICAL: Are you sure you want to permanently delete this team? All chat logs and files will be removed."
      )
    ) {
      try {
        await API.delete(`/teams/${id}`);
        navigate("/teams");
      } catch (err) {
        console.error(err);
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
      alert("Role updated!");
      fetchTeam();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to update role");
    }
  };

  const handleKickMember = async (targetUserId) => {
    if (window.confirm("Are you sure you want to remove this member from the team?")) {
      try {
        await API.post(`/teams/${id}/members/remove`, { userId: targetUserId });
        alert("Member removed!");
        fetchTeam();
      } catch (err) {
        console.error(err);
        alert(err.response?.data?.message || "Failed to remove member");
      }
    }
  };

  if (!team) {
    return (
      <Layout>
        <h2>Loading...</h2>
      </Layout>
    );
  }

  // Role Checks
  const currentUserRole = team.roles?.[user._id] || (team.owner?._id === user._id ? "owner" : "member");
  const isOwner = team.owner?._id === user._id || currentUserRole === "owner";
  const isAdmin = currentUserRole === "admin";
  const hasControl = isOwner || isAdmin;

  return (
    <Layout>
      <div
        style={{
          background: "white",
          padding: "30px",
          borderRadius: "20px",
          boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <h1>{team.name}</h1>
            <p style={{ color: "#64748b", marginTop: "10px" }}>
              {team.description}
            </p>
          </div>

          {hasControl && (
            <button
              onClick={() => setIsEditingSettings(!isEditingSettings)}
              style={{
                background: isEditingSettings ? "#64748b" : "#2563eb",
                color: "white",
                border: "none",
                padding: "10px 20px",
                borderRadius: "10px",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "14px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              ⚙️ {isEditingSettings ? "Close Settings" : "Team Settings"}
            </button>
          )}
        </div>

        {/* Editing settings form panel */}
        {isEditingSettings && (
          <div
            style={{
              marginTop: "20px",
              padding: "20px",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
            }}
          >
            <h3>Edit Workspace Details</h3>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                marginTop: "15px",
              }}
            >
              <input
                type="text"
                placeholder="Team Name"
                value={settingsName}
                onChange={(e) => setSettingsName(e.target.value)}
                style={{
                  padding: "10px",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                }}
              />
              <input
                type="text"
                placeholder="Description"
                value={settingsDesc}
                onChange={(e) => setSettingsDesc(e.target.value)}
                style={{
                  padding: "10px",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                }}
              />
              <select
                value={settingsVis}
                onChange={(e) => setSettingsVis(e.target.value)}
                style={{
                  padding: "10px",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                }}
              >
                <option value="public">Public (Anyone can join)</option>
                <option value="private">Private (Requires invite code)</option>
              </select>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: "10px",
                }}
              >
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    className="primary-btn"
                    onClick={handleUpdateSettings}
                    style={{ padding: "8px 16px", fontSize: "13px" }}
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={() => setIsEditingSettings(false)}
                    style={{
                      background: "white",
                      border: "1px solid #cbd5e1",
                      borderRadius: "10px",
                      padding: "8px 16px",
                      cursor: "pointer",
                      fontSize: "13px",
                    }}
                  >
                    Cancel
                  </button>
                </div>

                {isOwner && (
                  <button
                    onClick={handleDeleteTeam}
                    style={{
                      background: "#ef4444",
                      color: "white",
                      border: "none",
                      borderRadius: "10px",
                      padding: "8px 16px",
                      cursor: "pointer",
                      fontWeight: "600",
                      fontSize: "13px",
                    }}
                  >
                    🚨 Delete Team
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <br />

        <div style={{ display: "flex", flexWrap: "wrap", gap: "25px", fontSize: "14px", color: "#475569" }}>
          <div><strong>Visibility:</strong> {team.visibility}</div>
          <div><strong>Members:</strong> {team.members?.length}</div>
          <div><strong>Owner:</strong> {team.owner?.username}</div>
        </div>

        <hr style={{ margin: "25px 0", border: "0", borderTop: "1px solid #e2e8f0" }} />

        <h2>Members</h2>

        <div style={{ marginTop: "15px" }}>
          {team.members?.map((member) => {
            const memberRole = team.roles?.[member._id] || (team.owner?._id === member._id ? "owner" : "member");
            const isSelf = member._id === user._id;

            return (
              <div
                key={member._id}
                style={{
                  padding: "15px 0",
                  borderBottom: "1px solid #e5e7eb",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <strong>
                    {member.username} {isSelf && "(You)"}
                  </strong>
                  <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                    {member.email} • <span style={{ textTransform: "capitalize", fontWeight: "600" }}>{memberRole}</span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  {/* Role Assignment: Only team owner can change roles for others */}
                  {isOwner && !isSelf && memberRole !== "owner" && (
                    <select
                      value={memberRole}
                      onChange={(e) => handleRoleChange(member._id, e.target.value)}
                      style={{
                        padding: "6px 12px",
                        border: "1px solid #cbd5e1",
                        borderRadius: "8px",
                        fontSize: "12px",
                        outline: "none",
                        cursor: "pointer",
                      }}
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  )}

                  {/* Kick Button: Owner can kick anyone. Admin can kick members (not owner, not other admins). */}
                  {hasControl && !isSelf && memberRole !== "owner" && !(isAdmin && memberRole === "admin") && (
                    <button
                      onClick={() => handleKickMember(member._id)}
                      style={{
                        background: "#fee2e2",
                        color: "#ef4444",
                        border: "1px solid #fca5a5",
                        borderRadius: "8px",
                        padding: "6px 12px",
                        fontSize: "12px",
                        cursor: "pointer",
                        fontWeight: "600",
                        transition: "all 0.15s",
                      }}
                      onMouseOver={(e) => (e.target.style.background = "#fca5a5")}
                      onMouseOut={(e) => (e.target.style.background = "#fee2e2")}
                    >
                      Kick member
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {team.inviteCode && (
          <div
            style={{
              marginTop: "25px",
              padding: "15px",
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              borderRadius: "12px",
              display: "inline-block",
            }}
          >
            <h4 style={{ color: "#1e3a8a", margin: 0 }}>Invite Code</h4>
            <p
              style={{
                fontSize: "18px",
                fontWeight: "700",
                color: "#1d4ed8",
                letterSpacing: "1px",
                margin: "8px 0 0 0",
              }}
            >
              {team.inviteCode}
            </p>
          </div>
        )}

        <hr style={{ margin: "35px 0", border: "0", borderTop: "1px solid #e2e8f0" }} />

        <h2>Team Chat</h2>

        <div
          style={{
            marginTop: "20px",
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            padding: "20px",
            minHeight: "300px",
            background: "#ffffff",
          }}
        >
          <div className="messages-list">
            {messages.length === 0 ? (
              <p>No messages yet</p>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg._id}
                  style={{
                    marginBottom: "15px",
                    padding: "12px",
                    background: "#f8fafc",
                    borderRadius: "10px",
                  }}
                >
                  <strong>{msg.sender?.username}</strong>
                  <p style={{ marginTop: "5px" }}>{msg.content}</p>
                </div>
              ))
            )}
          </div>

          <div
            style={{
              display: "flex",
              gap: "10px",
              marginTop: "20px",
            }}
          >
            <input
              type="text"
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              style={{
                flex: 1,
                padding: "12px",
                border: "1px solid #d1d5db",
                borderRadius: "10px",
              }}
            />
            <button
              onClick={sendMessage}
              style={{
                background: "#3b82f6",
                color: "white",
                border: "none",
                padding: "12px 20px",
                borderRadius: "10px",
                cursor: "pointer",
              }}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default TeamDetails;