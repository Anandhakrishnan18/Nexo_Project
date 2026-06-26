import {
  Bell,
  ChevronDown,
  Search
} from "lucide-react";
import { useState, useEffect } from "react";
import API from "../services/api";

function Navbar() {
  const [unreadCount, setUnreadCount] = useState(0);
  const user = JSON.parse(localStorage.getItem("user"));

  const initials =
    user?.username
      ?.substring(0, 2)
      ?.toUpperCase() || "UN";

  useEffect(() => {
    fetchUnreadNotifications();
  }, []);

  const fetchUnreadNotifications = async () => {
    try {
      const res = await API.get("/notifications");
      const unread = res.data.filter(n => !n.isRead).length;
      setUnreadCount(unread);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="navbar">
      <div className="search-container">
        <Search className="search-icon" size={18} />
        <input
          type="text"
          placeholder="Search meetings, teams, files..."
          className="search-box"
        />
      </div>

      <div className="navbar-right">
        <div className="notification-icon">
          <Bell size={20} />
          {unreadCount > 0 && <span className="notification-badge"></span>}
        </div>

        <div className="profile-box">
          <div className="avatar" style={{ overflow: "hidden" }}>
            {user?.avatar ? (
              <img src={user.avatar} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              initials
            )}
          </div>

          <div className="profile-info">
            <h4>{user?.username || "Guest"}</h4>
            <small>{user?.email}</small>
          </div>

          <ChevronDown size={18} color="var(--text-muted)" />
        </div>
      </div>
    </div>
  );
}

export default Navbar;