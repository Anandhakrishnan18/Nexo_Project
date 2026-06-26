import Layout from "../components/Layout";
import "../styles/dashboard.css";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "../services/api";
import {
  Calendar,
  Video,
  Users,
  Bell,
  Plus,
  PhoneForwarded,
  FolderUp,
  UserCog,
  CalendarCheck
} from "lucide-react";

function Dashboard() {
  const [stats, setStats] = useState({
    meetings: 0,
    teams: 0,
    unreadAlerts: 0
  });

  const navigate = useNavigate();

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [meetingsRes, teamsRes, alertsRes] = await Promise.all([
        API.get("/meetings"),
        API.get("/teams"),
        API.get("/notifications")
      ]);

      const unreadCount = alertsRes.data.filter(n => !n.isRead).length;

      setStats({
        meetings: meetingsRes.data.length,
        teams: teamsRes.data.length,
        unreadAlerts: unreadCount
      });
    } catch (err) {
      console.error("Failed to load dashboard stats", err);
    }
  };

  return (
    <Layout>
      <div className="dashboard-header">
        <div>
          <h1>Welcome back!</h1>
          <p>Here's what's happening across your workspace today.</p>
        </div>

        <div className="dashboard-actions">
          <button className="primary-btn" onClick={() => navigate("/meetings")}>
            <Plus size={18} />
            Create Meeting
          </button>

          <button className="secondary-btn" onClick={() => navigate("/meetings")}>
            <PhoneForwarded size={18} />
            Join Meeting
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stats-icon blue-bg">
            <Calendar size={22} />
          </div>
          <h3>Total Meetings</h3>
          <p>{stats.meetings}</p>
        </div>

        <div className="stat-card">
          <div className="stats-icon green-bg">
            <Video size={22} />
          </div>
          <h3>Active Rooms</h3>
          <p>{Math.floor(stats.meetings / 2) || 0}</p>
        </div>

        <div className="stat-card">
          <div className="stats-icon blue-bg">
            <Users size={22} />
          </div>
          <h3>Your Teams</h3>
          <p>{stats.teams}</p>
        </div>

        <div className="stat-card">
          <div className="stats-icon yellow-bg">
            <Bell size={22} />
          </div>
          <h3>Unread Alerts</h3>
          <p>{stats.unreadAlerts}</p>
        </div>
      </div>

      <div className="bottom-grid">
        <div className="meeting-box">
          <div className="box-header">
            <h2>Upcoming Meetings</h2>
            <Link to="/meetings" className="view-all">View all</Link>
          </div>

          <div className="empty-box">
            <CalendarCheck size={32} opacity={0.5} />
            <span>Your upcoming meetings will appear here.</span>
          </div>
        </div>

        <div className="quick-box">
          <div className="box-header">
            <h2>Quick Actions</h2>
          </div>

          <div className="quick-actions">
            <button className="quick-btn" onClick={() => navigate("/teams")}>
              <Users size={20} />
              Create a team workspace
            </button>

            <button className="quick-btn" onClick={() => navigate("/files")}>
              <FolderUp size={20} />
              Upload a shared file
            </button>

            <button className="quick-btn" onClick={() => navigate("/settings")}>
              <UserCog size={20} />
              Update your profile
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default Dashboard;