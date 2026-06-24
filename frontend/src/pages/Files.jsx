import Layout from "../components/Layout";
import "../styles/files.css";
import { useEffect, useState, useRef } from "react";
import API from "../services/api";

function Files() {
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState("");
  const [files, setFiles] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchTeams();
  }, []);

  useEffect(() => {
    if (selectedTeam) {
      fetchFiles(selectedTeam);
    } else {
      setFiles([]);
    }
  }, [selectedTeam]);

  const fetchTeams = async () => {
    try {
      const res = await API.get("/teams");
      setTeams(res.data);
      if (res.data.length > 0) {
        setSelectedTeam(res.data[0]._id);
      }
    } catch (err) {
      console.error("Error fetching teams:", err);
    }
  };

  const fetchFiles = async (teamId) => {
    try {
      const res = await API.get(`/files/${teamId}`);
      setFiles(res.data);
    } catch (err) {
      console.error("Error fetching files:", err);
    }
  };

  const handleFileUpload = async (file) => {
    if (!file || !selectedTeam) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("teamId", selectedTeam);

    try {
      await API.post("/files/upload", formData);
      fetchFiles(selectedTeam);
    } catch (err) {
      console.error("Error uploading file:", err);
      alert("Failed to upload file.");
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleDelete = async (fileId) => {
    if (window.confirm("Are you sure you want to delete this file? This will remove it from the server.")) {
      try {
        await API.delete(`/files/${fileId}`);
        fetchFiles(selectedTeam);
      } catch (err) {
        console.error("Error deleting file:", err);
        alert("Failed to delete file.");
      }
    }
  };

  const onButtonClick = () => {
    fileInputRef.current.click();
  };

  const getFileIcon = (fileName) => {
    const ext = fileName.split(".").pop().toLowerCase();
    switch (ext) {
      case "pdf": return "📕";
      case "doc":
      case "docx": return "📘";
      case "xls":
      case "xlsx": return "📊";
      case "png":
      case "jpg":
      case "jpeg":
      case "gif": return "🖼️";
      case "txt": return "📝";
      case "zip":
      case "rar": return "📦";
      default: return "📄";
    }
  };

  const getDownloadUrl = (filePath) => {
    const filename = filePath.split(/[/\\]/).pop();
    return `http://localhost:5000/uploads/${filename}`;
  };

  const filteredFiles = files.filter((f) =>
    f.fileName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const canPreview = (fileName) => {
    const ext = fileName.split(".").pop().toLowerCase();
    return ["png", "jpg", "jpeg", "gif", "pdf"].includes(ext);
  };

  return (
    <Layout>
      <div className="files-header">
        <div>
          <h1>Files</h1>
          <p>Share, organize, and preview assets across your teams.</p>
        </div>
      </div>

      <div className="team-selector-container">
        <span style={{ fontWeight: "600", color: "#475569" }}>Select Workspace:</span>
        <select
          className="team-selector"
          value={selectedTeam}
          onChange={(e) => setSelectedTeam(e.target.value)}
        >
          {teams.map((team) => (
            <option key={team._id} value={team._id}>
              {team.name}
            </option>
          ))}
        </select>
      </div>

      {selectedTeam ? (
        <div>
          {/* Drag & Drop Upload Zone */}
          <div
            className={`drag-drop-zone ${dragActive ? "active" : ""}`}
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={onButtonClick}
          >
            <input
              ref={fileInputRef}
              type="file"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
            <span style={{ fontSize: "40px" }}>📤</span>
            <h3>Drag & Drop File Here</h3>
            <p>or click to browse from your device</p>
          </div>

          <div style={{ marginBottom: "25px", display: "flex", justifyContent: "flex-end" }}>
            <input
              className="file-search"
              placeholder="Search files in this team..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {filteredFiles.length === 0 ? (
            <div className="files-empty">
              <span>📂</span>
              <h3>No files found</h3>
              <p>Upload a file using the dropzone above to get started.</p>
            </div>
          ) : (
            <div className="files-grid">
              {filteredFiles.map((file) => (
                <div key={file._id} className="file-card">
                  <div className="file-info-main">
                    <div className="file-icon">{getFileIcon(file.fileName)}</div>
                    <div className="file-details">
                      <h3 title={file.fileName}>{file.fileName}</h3>
                      <p>By: {file.uploadedBy?.username || "Unknown"}</p>
                      <p>{new Date(file.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <div className="file-actions">
                    {canPreview(file.fileName) && (
                      <button
                        className="file-btn"
                        onClick={() => setPreviewFile(file)}
                      >
                        👁️ Preview
                      </button>
                    )}
                    <a
                      href={getDownloadUrl(file.filePath)}
                      download={file.fileName}
                      className="file-btn download-btn"
                      style={{ textDecoration: "none" }}
                    >
                      📥 Download
                    </a>
                    <button
                      className="file-btn delete-btn"
                      onClick={() => handleDelete(file._id)}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="files-empty">
          <span>👥</span>
          <h3>No teams available</h3>
          <p>Please create or join a team first to manage files.</p>
        </div>
      )}

      {/* File Preview Modal */}
      {previewFile && (
        <div className="preview-modal-overlay" onClick={() => setPreviewFile(null)}>
          <div className="preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="preview-modal-header">
              <h2>{previewFile.fileName}</h2>
              <button
                className="close-modal-btn"
                onClick={() => setPreviewFile(null)}
              >
                ✕
              </button>
            </div>
            <div className="preview-modal-content">
              {previewFile.fileName.split(".").pop().toLowerCase() === "pdf" ? (
                <iframe
                  src={getDownloadUrl(previewFile.filePath)}
                  title="PDF Preview"
                />
              ) : (
                <img
                  src={getDownloadUrl(previewFile.filePath)}
                  alt={previewFile.fileName}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

export default Files;