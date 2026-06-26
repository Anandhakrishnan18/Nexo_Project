import Layout from "../components/Layout";
import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import API from "../services/api";
import socket from "../socket";
import { Video, CalendarDays, Activity, Key, User, Users } from "lucide-react";
import "../styles/meetings.css";

function MeetingDetails() {
  const { id } = useParams();
  const [meeting, setMeeting] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchMeeting();
    socket.emit("join-meeting", id);
    return () => {
      socket.emit("leave-meeting", id);
    };
  }, [id]);

  const fetchMeeting = async () => {
    try {
      const res = await API.get(`/meetings/${id}`);
      setMeeting(res.data);
    } catch (error) {
      console.log(error);
    }
  };

  if (!meeting) {
    return (
      <Layout>
        <div className="meeting-details-container" style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "400px" }}>
          <p style={{ color: "var(--text-muted)", fontSize: "18px" }}>Loading meeting details...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="meeting-details-container">
        <div className="meeting-details-header">
          <div className="meeting-details-info">
            <h1>{meeting.title}</h1>
            <p>{meeting.description || "No description provided."}</p>
          </div>

          <button
            className="primary-btn"
            onClick={() => navigate(`/video-call/${id}`)}
            style={{ fontSize: "16px", padding: "14px 28px" }}
          >
            <Video size={20} />
            Join Video Call
          </button>
        </div>

        <div className="meeting-meta-grid">
          <div className="meta-item">
            <span className="meta-label">Type</span>
            <div className="meta-value" style={{ display: "flex", alignItems: "center", gap: "8px", textTransform: "capitalize" }}>
              <CalendarDays size={18} color="var(--primary)" />
              {meeting.type}
            </div>
          </div>

          <div className="meta-item">
            <span className="meta-label">Status</span>
            <div className="meta-value" style={{ display: "flex", alignItems: "center", gap: "8px", textTransform: "capitalize" }}>
              <Activity size={18} color="var(--success)" />
              {meeting.status}
            </div>
          </div>

          <div className="meta-item">
            <span className="meta-label">Meeting Code</span>
            <div className="meta-value" style={{ display: "flex", alignItems: "center", gap: "8px", letterSpacing: "1px" }}>
              <Key size={18} color="var(--warning)" />
              {meeting.meetingCode}
            </div>
          </div>

          <div className="meta-item">
            <span className="meta-label">Created By</span>
            <div className="meta-value" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <User size={18} color="var(--accent)" />
              {meeting.createdBy?.username}
            </div>
          </div>
        </div>

        <div className="participants-section">
          <h2><Users size={20} /> Participants ({meeting.participants?.length || 0})</h2>
          
          <div className="participants-grid">
            {meeting.participants?.map((participant) => (
              <div key={participant._id} className="participant-chip">
                <div className="participant-avatar">
                  {participant.username?.charAt(0).toUpperCase()}
                </div>
                {participant.username}
              </div>
            ))}

            {(!meeting.participants || meeting.participants.length === 0) && (
              <p style={{ color: "var(--text-muted)" }}>No participants have joined this meeting yet.</p>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default MeetingDetails;