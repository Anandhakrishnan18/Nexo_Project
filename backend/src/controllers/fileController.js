const File = require("../models/File");
const fs = require("fs");
const Team = require("../models/Team");
const { createNotification } = require("../utils/notifications");

const uploadFile = async (
  req,
  res
) => {
  try {
    const { teamId } = req.body;

    if (!req.file) {
      return res.status(400).json({
        message: "No file uploaded",
      });
    }

    const file = await File.create({
      teamId,
      uploadedBy: req.user.id,
      fileName: req.file.originalname,
      filePath: req.file.path,
    });

    // Notify other team members
    const team = await Team.findById(teamId);
    if (team) {
      team.members.forEach((memberId) => {
        if (memberId.toString() !== req.user.id) {
          createNotification(
            req,
            memberId,
            "New File Shared",
            `${req.user.username} uploaded a new file "${req.file.originalname}" in team "${team.name}"`
          );
        }
      });
    }

    res.status(201).json(file);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const getFiles = async (
  req,
  res
) => {
  try {
    const files =
      await File.find({
        teamId: req.params.teamId,
      })
        .populate(
          "uploadedBy",
          "username email"
        )
        .sort({
          createdAt: -1,
        });

    res.status(200).json(files);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const deleteFile = async (
  req,
  res
) => {
  try {
    const file =
      await File.findById(
        req.params.id
      );

    if (!file) {
      return res.status(404).json({
        message: "File not found",
      });
    }

    // Physically delete file from disk if it exists
    if (file.filePath && fs.existsSync(file.filePath)) {
      try {
        fs.unlinkSync(file.filePath);
      } catch (err) {
        console.error("Failed to delete physical file from disk:", err);
      }
    }

    await file.deleteOne();

    res.status(200).json({
      message:
        "File deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

module.exports = {
  uploadFile,
  getFiles,
  deleteFile,
};