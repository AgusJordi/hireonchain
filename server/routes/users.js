const express = require('express');
const {
  getUserProfile,
  updateUserProfile,
  getUserById,
  getFreelancers,
  addUserReview,
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware'); // KORRIGIERTER PFAD

const router = express.Router();

// Public routes
router.get('/freelancers', getFreelancers);

// Protected routes
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, updateUserProfile);
router.get('/:id', protect, getUserById);
router.post('/:id/reviews', protect, addUserReview);

module.exports = router;
