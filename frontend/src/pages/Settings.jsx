import Layout from "../components/Layout";
import "../styles/settings.css";
import { useState, useRef } from "react";
import API from "../services/api";

function Settings() {
  const user = JSON.parse(localStorage.getItem("user"));

  const [activeTab, setActiveTab] = useState("profile");
  
  // Profile form states
  const [username, setUsername] = useState(user?.username || "");
  const [email] = useState(user?.email || "");
  const [avatar, setAvatar] = useState(user?.avatar || "");

  // Security form states
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const fileInputRef = useRef(null);

  const handleProfileSave = async () => {
    if (!username.trim()) {
      alert("Username cannot be empty");
      return;
    }
    try {
      const res = await API.put("/auth/profile", { username });
      // Update local storage user profile
      localStorage.setItem("user", JSON.stringify(res.data.user));
      alert("Profile updated successfully!");
      window.location.reload(); // Refresh the header/sidebar layout
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || "Failed to update profile");
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current.click();
  };

  const handleAvatarChange = async (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const formData = new FormData();
      formData.append("avatar", file);

      try {
        const res = await API.post("/auth/avatar", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
        setAvatar(res.data.avatar);
        localStorage.setItem("user", JSON.stringify(res.data.user));
        alert("Profile picture updated!");
        window.location.reload();
      } catch (error) {
        console.error(error);
        alert(error.response?.data?.message || "Failed to upload avatar");
      }
    }
  };

  const handlePasswordSave = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      alert("Please fill in all password fields.");
      return;
    }
    if (newPassword !== confirmPassword) {
      alert("New passwords do not match.");
      return;
    }
    try {
      await API.put("/auth/password", { oldPassword, newPassword });
      alert("Password updated successfully!");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || "Failed to update password");
    }
  };

  const initials = user?.username?.substring(0, 2).toUpperCase() || "UN";

  return (
    <Layout>
      <h1 className="settings-title">Settings</h1>
      <p className="settings-subtitle">
        Manage your profile, upload an avatar, and secure your account.
      </p>

      <div className="settings-tabs">
        <button
          className={activeTab === "profile" ? "active-tab" : ""}
          onClick={() => setActiveTab("profile")}
        >
          Profile Details
        </button>
        <button
          className={activeTab === "security" ? "active-tab" : ""}
          onClick={() => setActiveTab("security")}
        >
          Security & Password
        </button>
      </div>

      <div className="settings-card">
        {activeTab === "profile" ? (
          <div>
            <div className="profile-section">
              <div
                className="avatar-large"
                onClick={handleAvatarClick}
                style={{
                  cursor: "pointer",
                  overflow: "hidden",
                  position: "relative",
                  border: "2px solid #cbd5e1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                title="Click to change avatar"
              >
                {avatar ? (
                  <img
                    src={avatar}
                    alt="User avatar"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  initials
                )}
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    background: "rgba(0,0,0,0.5)",
                    color: "white",
                    fontSize: "10px",
                    textAlign: "center",
                    padding: "3px 0",
                  }}
                >
                  Edit
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                style={{ display: "none" }}
                onChange={handleAvatarChange}
                accept="image/*"
              />
              <div>
                <h3>Profile photo</h3>
                <p>Click on the circle to upload a custom avatar. PNG or JPG, up to 2 MB.</p>
              </div>
            </div>

            <div className="settings-form" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ width: "100%" }}>
                <label>Full Name</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  style={{ width: "100%", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ width: "100%" }}>
                <label>Email Address</label>
                <input
                  type="email"
                  value={email}
                  readOnly
                  disabled
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    background: "#f1f5f9",
                    color: "#64748b",
                    cursor: "not-allowed",
                  }}
                />
              </div>
            </div>

            <div style={{ overflow: "hidden", marginTop: "20px" }}>
              <button className="save-btn" onClick={handleProfileSave}>
                Save Changes
              </button>
            </div>
          </div>
        ) : (
          <div>
            <h3 style={{ marginBottom: "20px" }}>Change Password</h3>
            <div className="settings-form" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ width: "100%" }}>
                <label>Current Password</label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  style={{ width: "100%", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ width: "100%" }}>
                <label>New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{ width: "100%", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ width: "100%" }}>
                <label>Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{ width: "100%", boxSizing: "border-box" }}
                />
              </div>
            </div>

            <div style={{ overflow: "hidden", marginTop: "20px" }}>
              <button className="save-btn" onClick={handlePasswordSave}>
                Change Password
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default Settings;