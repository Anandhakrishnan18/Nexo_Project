const Meeting = require("../models/Meeting");
const User = require("../models/User");
const { createNotification } = require("../utils/notifications");

const generateMeetingCode = () => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  let code = "MEET-";

  for (let i = 0; i < 6; i++) {
    code += chars.charAt(
      Math.floor(Math.random() * chars.length)
    );
  }

  return code;
};

const createMeeting = async (req, res) => {
  try {
    const {
      title,
      description,
      type,
      scheduledTime,
    } = req.body;

    const meeting = await Meeting.create({
      title,
      description,
      type,
      meetingCode: generateMeetingCode(),
      createdBy: req.user.id,
      participants: [req.user.id],
      scheduledTime:
        type === "scheduled"
          ? scheduledTime
          : null,
      status:
        type === "scheduled"
          ? "upcoming"
          : "active",
    });

    // Notify other users of the newly scheduled meeting
    if (type === "scheduled") {
      try {
        const otherUsers = await User.find({ _id: { $ne: req.user.id } });
        otherUsers.forEach((u) => {
          createNotification(
            req,
            u._id,
            "New Scheduled Meeting",
            `${req.user.username} scheduled a new meeting "${title}" for ${new Date(scheduledTime).toLocaleString()}`
          );
        });
      } catch (err) {
        console.error("Failed to send meeting scheduled notifications:", err);
      }
    }

    res.status(201).json(meeting);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const getMeetings = async (req, res) => {
  try {
    const meetings = await Meeting.find()
      .populate(
        "createdBy",
        "username email"
      )
      .populate(
        "participants",
        "username email"
      );

    res.status(200).json(meetings);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const getMeetingById = async (
  req,
  res
) => {
  try {
    const meeting =
      await Meeting.findById(
        req.params.id
      )
        .populate(
          "createdBy",
          "username email"
        )
        .populate(
          "participants",
          "username email"
        );

    if (!meeting) {
      return res.status(404).json({
        message: "Meeting not found",
      });
    }

    res.status(200).json(meeting);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const joinMeeting = async (
  req,
  res
) => {
  try {
    const meeting =
      await Meeting.findById(
        req.params.id
      );

    if (!meeting) {
      return res.status(404).json({
        message: "Meeting not found",
      });
    }

    if (
      meeting.participants.includes(
        req.user.id
      )
    ) {
      return res.status(400).json({
        message:
          "Already joined meeting",
      });
    }

    meeting.participants.push(
      req.user.id
    );

    await meeting.save();

    res.status(200).json({
      message:
        "Joined meeting successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

module.exports = {
  createMeeting,
  getMeetings,
  getMeetingById,
  joinMeeting,
};