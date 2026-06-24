const generateInviteCode = () => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  let code = "NEXO-";

  for (let i = 0; i < 6; i++) {
    code += chars.charAt(
      Math.floor(Math.random() * chars.length)
    );
  }

  return code;
};


const Team = require("../models/Team");
const { createNotification } = require("../utils/notifications");

const createTeam = async (req, res) => {
  try {
    const { name, description, visibility } = req.body;

    const team = await Team.create({
      name,
      description,
      visibility,
      inviteCode:
        visibility === "private"
          ? generateInviteCode()
          : null,
      owner: req.user.id,
      members: [req.user.id],
      roles: { [req.user.id]: "owner" }
    });

    res.status(201).json(team);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const getTeams = async (req, res) => {
  try {
    const teams = await Team.find()
      .populate("owner", "username email")
      .populate("members", "username email");

    res.status(200).json(teams);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const getTeamById = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id)
      .populate("owner", "username email")
      .populate("members", "username email");

    if (!team) {
      return res.status(404).json({
        message: "Team not found",
      });
    }

    res.status(200).json(team);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const joinTeam = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({
        message: "Team not found",
      });
    }

    if (team.visibility !== "public") {
      return res.status(400).json({
        message: "Use invite code",
      });
    }

    if (
      team.members.includes(req.user.id)
    ) {
      return res.status(400).json({
        message: "Already a member",
      });
    }

    team.members.push(req.user.id);
    team.roles.set(req.user.id, "member");

    await team.save();

    // Notify team owner
    if (team.owner && team.owner.toString() !== req.user.id) {
      createNotification(
        req,
        team.owner,
        "New Team Member",
        `${req.user.username} has joined your team "${team.name}"`
      );
    }

    res.status(200).json({
      message: "Joined team successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const joinPrivateTeam = async (req, res) => {
  try {
    const { inviteCode } = req.body;

    const team = await Team.findOne({
      inviteCode,
    });

    if (!team) {
      return res.status(404).json({
        message: "Invalid invite code",
      });
    }

    if (
      team.members.includes(req.user.id)
    ) {
      return res.status(400).json({
        message: "Already a member",
      });
    }

    team.members.push(req.user.id);
    team.roles.set(req.user.id, "member");

    await team.save();

    // Notify team owner
    if (team.owner && team.owner.toString() !== req.user.id) {
      createNotification(
        req,
        team.owner,
        "New Team Member (Code)",
        `${req.user.username} joined private team "${team.name}" using invite code`
      );
    }

    res.status(200).json({
      message: "Joined private team",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const leaveTeam = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({
        message: "Team not found",
      });
    }

    team.members = team.members.filter(
      (member) =>
        member.toString() !== req.user.id
    );
    if (team.roles) {
      team.roles.delete(req.user.id);
    }

    await team.save();

    res.status(200).json({
      message: "Left team successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const updateTeamSettings = async (req, res) => {
  try {
    const { name, description, visibility } = req.body;
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ message: "Team not found" });

    const userRole = team.roles?.get(req.user.id) || (team.owner.toString() === req.user.id ? "owner" : "member");
    if (userRole !== "owner" && userRole !== "admin") {
      return res.status(403).json({ message: "Access denied. Owners and Admins only." });
    }

    team.name = name || team.name;
    team.description = description || team.description;
    if (visibility && visibility !== team.visibility) {
      team.visibility = visibility;
      team.inviteCode = visibility === "private" ? generateInviteCode() : null;
    }

    await team.save();
    res.status(200).json(team);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const removeMember = async (req, res) => {
  try {
    const { userId } = req.body;
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ message: "Team not found" });

    const userRole = team.roles?.get(req.user.id) || (team.owner.toString() === req.user.id ? "owner" : "member");
    if (userRole !== "owner" && userRole !== "admin") {
      return res.status(403).json({ message: "Access denied." });
    }

    if (userId === team.owner.toString()) {
      return res.status(400).json({ message: "Cannot remove the team owner." });
    }

    const targetRole = team.roles?.get(userId);
    if (userRole === "admin" && targetRole === "admin") {
      return res.status(403).json({ message: "Admins cannot remove other Admins." });
    }

    team.members = team.members.filter((m) => m.toString() !== userId);
    if (team.roles) {
      team.roles.delete(userId);
    }

    await team.save();
    res.status(200).json({ message: "Member removed successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateMemberRole = async (req, res) => {
  try {
    const { userId, role } = req.body;
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ message: "Team not found" });

    if (team.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: "Only the team owner can modify roles." });
    }

    if (userId === team.owner.toString()) {
      return res.status(400).json({ message: "Cannot modify the owner's role." });
    }

    if (!["admin", "member"].includes(role)) {
      return res.status(400).json({ message: "Invalid role. Choose admin or member." });
    }

    if (team.roles) {
      team.roles.set(userId, role);
    }
    await team.save();
    res.status(200).json({ message: "Member role updated successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteTeam = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ message: "Team not found" });

    if (team.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: "Only the owner can delete the team." });
    }

    await team.deleteOne();
    res.status(200).json({ message: "Team deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
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
};