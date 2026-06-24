const express = require("express");

const router = express.Router();

const {
  registerUser,
  loginUser,
  getProfile,
  updateProfile,
  updatePassword,
  uploadAvatar,
} = require("../controllers/authController");

const protect = require("../middleware/authMiddleware");
const upload = require("../config/multer");

router.post("/register", registerUser);

router.post("/login", loginUser);

router.get("/profile", protect, getProfile);

router.put("/profile", protect, updateProfile);

router.put("/password", protect, updatePassword);

router.post("/avatar", protect, upload.single("avatar"), uploadAvatar);

module.exports = router;