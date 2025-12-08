const express = require("express");
const {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  getUserById,
  getFreelancers,
  addUserReview,
} = require("../controllers/userController");
const { protect } = require("../middleware/authMiddleware"); // KORRIGIERTER PFAD

const router = express.Router();

// Public routes
router.post("/", registerUser);
router.post("/login", loginUser);
router.get("/freelancers", getFreelancers);

// Protected routes
router.get("/profile", protect, getUserProfile);
router.put("/profile", protect, updateUserProfile);
router.get("/:id", protect, getUserById);
router.post("/:id/reviews", protect, addUserReview);

module.exports = router;