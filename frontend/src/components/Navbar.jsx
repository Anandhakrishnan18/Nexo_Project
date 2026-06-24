import {
  Bell,
  ChevronDown
} from "lucide-react";

function Navbar() {
  const user = JSON.parse(
    localStorage.getItem("user")
  );

  const initials =
    user?.username
      ?.substring(0, 2)
      ?.toUpperCase() || "UN";

  return (
    <div className="navbar">

      <input
        type="text"
        placeholder="Search meetings, teams, files..."
        className="search-box"
      />

      <div className="navbar-right">

        <div className="notification-icon">
          <Bell size={20} />
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
            <h4>
              {user?.username || "Guest"}
            </h4>

            <small>
              {user?.email}
            </small>
          </div>

          <ChevronDown size={18} />

        </div>

      </div>

    </div>
  );
}

export default Navbar;