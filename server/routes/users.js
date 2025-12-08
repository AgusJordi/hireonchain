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
const { protect } = require("../utils/auth");
const { rateLimiter } = require("../midleware/rateLimiter");
const { validateRegister, validateLogin } = require("../midleware/auth.validation");

const router = express.Router();

// Public routes
router.post("/",rateLimiter, validateRegister, registerUser);
router.post("/login",rateLimiter,validateLogin, loginUser);
router.get("/freelancers", getFreelancers);

// Protected routes
router.get("/profile", protect, getUserProfile);
router.put("/profile", protect, updateUserProfile);
router.get("/:id", protect, getUserById);
router.post("/:id/reviews", protect, addUserReview);

module.exports = router;
