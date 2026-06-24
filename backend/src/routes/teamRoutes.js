const express = require("express");

const router = express.Router();

const protect = require("../middleware/authMiddleware");

const {
  createTeam,
  getTeams,
  getTeamById,
  joinTeam,
  joinPrivateTeam,
  leaveTeam,
  updateTeamSettings,
  removeMember,
  updateMemberRole,
  deleteTeam,
} = require("../controllers/teamController");

router.post("/", protect, createTeam);

router.get("/", protect, getTeams);

router.get("/:id", protect, getTeamById);

router.put("/:id/settings", protect, updateTeamSettings);

router.delete("/:id", protect, deleteTeam);

router.post("/:id/members/remove", protect, removeMember);

router.put("/:id/members/role", protect, updateMemberRole);

router.post("/:id/join", protect, joinTeam);

router.post("/join-private", protect, joinPrivateTeam);

router.post("/:id/leave", protect, leaveTeam);

module.exports = router;