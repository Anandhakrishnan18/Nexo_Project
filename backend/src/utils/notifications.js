const Notification = require("../models/Notification");

/**
 * Creates a notification in the database and broadcasts it in real-time to the target user.
 * @param {Object} req - Express request object to retrieve the socket.io instance.
 * @param {String} userId - ID of the target user.
 * @param {String} title - Notification title.
 * @param {String} message - Notification text.
 */
const createNotification = async (req, userId, title, message) => {
  try {
    const notification = await Notification.create({
      userId,
      title,
      message,
    });

    const io = req.app.get("io");
    if (io) {
      io.to(`user-${userId}`).emit("new-notification", notification);
      console.log(`Dispatched real-time notification to user-${userId}: ${title}`);
    }

    return notification;
  } catch (error) {
    console.error("Error creating/dispatching notification:", error);
  }
};

module.exports = {
  createNotification,
};
