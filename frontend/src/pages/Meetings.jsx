import "../styles/meetings.css";
import Layout from "../components/Layout";
import { Video, CalendarPlus, Clock, Users, CalendarDays, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import API from "../services/api";
import { useNavigate } from "react-router-dom";

function Meetings() {
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("instant");
  const [scheduledTime, setScheduledTime] = useState("");

  useEffect(() => {
    fetchMeetings();
  }, []);

  const fetchMeetings = async () => {
    try {
      const res = await API.get("/meetings");
      setMeetings(res.data);
    } catch (error) {
      console.log(error);
    }
  };

  const createMeeting = async () => {
    try {
      await API.post("/meetings", {
        title,
        description,
        type,
        scheduledTime: type === "scheduled" ? scheduledTime : null,
      });
      fetchMeetings();
      setShowModal(false);
      setTitle("");
      setDescription("");
      setType("instant");
      setScheduledTime("");
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <Layout>
      <div className="meetings-header">
        <div>
          <h1>Meetings</h1>
          <p>Start instant video calls or schedule them for later.</p>
        </div>

        <div className="meetings-actions">
          <button className="primary-btn" onClick={() => setShowModal(true)}>
            <CalendarPlus size={18} />
            Schedule Meeting
          </button>
        </div>
      </div>

      <div className="meeting-tabs">
        <button className="active-tab">All</button>
        <button>Instant</button>
        <button>Scheduled</button>
      </div>

      <div className="meeting-grid">
        {meetings.map((meeting) => (
          <div key={meeting._id} className="meeting-card">
            <div className="meeting-icon">
              <Video size={24} />
            </div>

            <div className={`meeting-status ${meeting.status === "active" ? "status-active" : "status-upcoming"}`}>
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "currentColor" }}></div>
              {meeting.status}
            </div>

            <h3>{meeting.title}</h3>
            <p>{meeting.description || "No description provided."}</p>

            <span>
              <Clock size={16} />
              {meeting.type === "scheduled" && meeting.scheduledTime
                ? new Date(meeting.scheduledTime).toLocaleString()
                : "Instant Meeting"}
            </span>

            <button onClick={() => navigate(`/meetings/${meeting._id}`)}>
              View Details <ExternalLink size={16} />
            </button>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Create Meeting</h2>
            <p>Setup a new video conferencing session.</p>

            <input
              type="text"
              placeholder="Meeting Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <textarea
              placeholder="Description (Optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{
                background: "var(--bg-dark)", border: "1px solid var(--border)",
                color: "var(--text-main)", borderRadius: "12px", padding: "16px",
                fontFamily: "inherit", minHeight: "100px", resize: "none"
              }}
            />

            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="instant">Instant (Start Now)</option>
              <option value="scheduled">Scheduled (Plan for Later)</option>
            </select>

            {type === "scheduled" && (
              <input
                type="datetime-local"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
              />
            )}

            <div className="modal-buttons">
              <button className="secondary-btn" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="primary-btn" onClick={createMeeting}>Create Meeting</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

export default Meetings;