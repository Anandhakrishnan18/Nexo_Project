import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import "../styles/login.css";
import { Hexagon } from "lucide-react";

function Register() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleRegister = async (e) => {
    e.preventDefault();

    try {
      await axios.post("http://localhost:5000/api/auth/register", {
        username,
        email,
        password,
      });

      navigate("/login");
    } catch (error) {
      alert(error.response?.data?.message || "Registration Failed");
    }
  };

  return (
    <div className="login-container">
      <div className="login-left">
        <div className="logo-header">
          <div className="logo-icon">
            <Hexagon size={24} />
          </div>
          <h2>NeXo</h2>
        </div>

        <div className="hero">
          <h1>
            Start collaborating
            <br />
            with your team
          </h1>
          <p>
            Create your NeXo account and start managing meetings, teams, files, and collaboration all in one secure platform.
          </p>
        </div>

        <div className="copyright">© 2026 NeXo Inc.</div>
      </div>

      <div className="login-right">
        <div className="login-card">
          <form onSubmit={handleRegister}>
            <h2>Create Account</h2>
            <p>Enter your details below to get started.</p>

            <label>Username</label>
            <input
              type="text"
              placeholder="johndoe"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />

            <label>Email Address</label>
            <input
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <label>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <button type="submit">Create Account</button>

            <p className="register-link">
              Already have an account?{" "}
              <Link to="/login">Sign In</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Register;