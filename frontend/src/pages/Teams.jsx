import Layout from "../components/Layout";
import "../styles/teams.css";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import { Plus, Link as LinkIcon, Users, Lock, Globe, Copy } from "lucide-react";

function Teams() {
  const navigate = useNavigate();
  const [teams, setTeams] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [createdInviteCode, setCreatedInviteCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState("public");

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      const res = await API.get("/teams");
      setTeams(res.data);
    } catch (error) {
      console.log(error);
    }
  };

  const createTeam = async () => {
    try {
      const res = await API.post("/teams", {
        name,
        description,
        visibility,
      });

      if (res.data.visibility === "private") {
        setCreatedInviteCode(res.data.inviteCode);
      }

      setShowModal(false);
      setName("");
      setDescription("");
      setVisibility("public");
      fetchTeams();
    } catch (error) {
      console.log(error);
    }
  };

  const joinPrivateTeam = async () => {
    try {
      await API.post("/teams/join-private", { inviteCode });
      setShowJoinModal(false);
      setInviteCode("");
      fetchTeams();
    } catch (error) {
      alert(error.response?.data?.message || "Failed to Join Team");
    }
  };

  return (
    <Layout>
      <div className="teams-header">
        <div>
          <h1>Teams</h1>
          <p>Organize your work into focused team workspaces.</p>
        </div>

        <div className="teams-actions">
          <button className="secondary-btn" onClick={() => setShowJoinModal(true)}>
            <LinkIcon size={18} />
            Join with code
          </button>

          <button className="primary-btn" onClick={() => setShowModal(true)}>
            <Plus size={18} />
            Create Team
          </button>
        </div>
      </div>

      <div className="team-tabs">
        <button className="active-tab">My Teams</button>
        <button>Public Teams</button>
      </div>

      <div className="teams-grid">
        {teams.map((team) => (
          <div key={team._id} className="team-card" onClick={() => navigate(`/teams/${team._id}`)}>
            <div className="team-avatar">
              {team.name?.charAt(0)}
            </div>

            <h3>{team.name}</h3>
            <p>{team.description}</p>

            <div className="team-info">
              <span>
                <Users size={14} />
                {team.members?.length} members
              </span>
              <span style={{ textTransform: "capitalize" }}>
                {team.visibility === "private" ? <Lock size={14} /> : <Globe size={14} />}
                {team.visibility}
              </span>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Create Team</h2>
            <p>Setup a new workspace for your team.</p>

            <input
              type="text"
              placeholder="Team Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <input
              type="text"
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />

            <select value={visibility} onChange={(e) => setVisibility(e.target.value)}>
              <option value="public">Public Workspace</option>
              <option value="private">Private (Invite Only)</option>
            </select>

            <div className="modal-buttons">
              <button className="secondary-btn" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="primary-btn" onClick={createTeam}>Create Workspace</button>
            </div>
          </div>
        </div>
      )}

      {showJoinModal && (
        <div className="modal-overlay" onClick={() => setShowJoinModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Join Private Team</h2>
            <p>Enter the invite code provided by your team admin.</p>

            <input
              type="text"
              placeholder="e.g. 5x8Yh9"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
            />

            <div className="modal-buttons">
              <button className="secondary-btn" onClick={() => setShowJoinModal(false)}>Cancel</button>
              <button className="primary-btn" onClick={joinPrivateTeam}>Join Team</button>
            </div>
          </div>
        </div>
      )}

      {createdInviteCode && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Team Created 🎉</h2>
            <p>Share this invite code with your teammates securely.</p>

            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <input value={createdInviteCode} readOnly style={{ width: "100%", paddingRight: "40px" }} />
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(createdInviteCode);
                }}
                style={{ position: "absolute", right: "12px", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
              >
                <Copy size={18} />
              </button>
            </div>

            <div className="modal-buttons" style={{ marginTop: "16px" }}>
              <button className="primary-btn" onClick={() => setCreatedInviteCode("")}>Done</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

export default Teams;