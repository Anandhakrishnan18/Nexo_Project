import Layout from "../components/Layout";
import "../styles/notifications.css";
import { useEffect, useState } from "react";
import API from "../services/api";
import socket from "../socket";
import { Bell, Check, CheckCircle2, Circle } from "lucide-react";

function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const user = JSON.parse(localStorage.getItem("user"));

  useEffect(() => {
    fetchNotifications();

    if (user && user._id) {
      // Join private user notifications channel
      socket.emit("join-notifications", user._id);

      // Listen for real-time notification push
      socket.on("new-notification", (notification) => {
        setNotifications((prev) => [notification, ...prev]);
      });
    }

    return () => {
      socket.off("new-notification");
    };
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await API.get("/notifications");
      setNotifications(res.data);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  };

  const markOneAsRead = async (id) => {
    try {
      await API.put(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await API.put("/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  };

  return (
    <Layout>
      <div className="notifications-header">
        <div>
          <h1>Notifications</h1>
          <p>Stay on top of files shared, team joins, and meetings scheduled.</p>
        </div>
        {notifications.some((n) => !n.isRead) && (
          <button className="mark-read-btn" onClick={markAllAsRead}>
            <CheckCircle2 size={18} /> Mark all read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="notifications-card">
          <div className="notification-empty">
            <Bell size={64} className="bell-icon" />
            <h3>You're all caught up</h3>
            <p>We'll notify you when actions occur across your workspaces.</p>
          </div>
        </div>
      ) : (
        <div className="notifications-list-container">
          {notifications.map((n) => (
            <div
              key={n._id}
              className={`notification-item ${!n.isRead ? "unread" : ""}`}
            >
              <div className="notification-content">
                <h3>
                  {!n.isRead && <Circle size={10} fill="var(--primary)" color="var(--primary)" />}
                  {n.title}
                </h3>
                <p>{n.message}</p>
                <small>{new Date(n.createdAt).toLocaleString()}</small>
              </div>

              {!n.isRead && (
                <div className="notification-item-actions">
                  <button
                    className="read-action-btn"
                    onClick={() => markOneAsRead(n._id)}
                  >
                    <Check size={16} /> Mark Read
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}

export default Notifications;