import Layout from "../components/Layout";
import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import API from "../services/api";
import socket from "../socket";
import { useNavigate } from "react-router-dom";

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
        <h2>Loading...</h2>
      </Layout>
    );
  }

  return (
    <Layout>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >
        <button
          className="primary-btn"
          onClick={() => navigate(`/video-call/${id}`)}
        >
          📹 Join Video Call
        </button>
      </div>

      <div
        style={{
          background: "white",
          padding: "30px",
          borderRadius: "20px",
          boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)",
        }}
      >
        <h1>{meeting.title}</h1>
        <p style={{ marginTop: "10px", color: "#64748b" }}>
          {meeting.description}
        </p>

        <br />
        <h3>Type : {meeting.type}</h3>
        <h3>Status : {meeting.status}</h3>
        <h3>Participants : {meeting.participants?.length}</h3>
        <h3>Meeting Code : {meeting.meetingCode}</h3>
        <h3>Created By : {meeting.createdBy?.username}</h3>

        <hr style={{ margin: "25px 0" }} />

        <h2>Participants</h2>
        <div
          style={{
            marginTop: "15px",
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          {meeting.participants?.map((participant) => (
            <div
              key={participant._id}
              style={{
                padding: "8px 16px",
                background: "#f1f5f9",
                borderRadius: "20px",
                border: "1px solid #e2e8f0",
              }}
            >
              <strong>{participant.username}</strong>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}

export default MeetingDetails;