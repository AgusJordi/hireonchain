const {
  generateChallenge,
  verifySignature,
  registerUser,
  loginUser,
} = require('../controllers/authController');
const express = require('express');
const router = express.Router();

router.post('/challenge', generateChallenge);
router.post('/sign', verifySignature);
router.post('/register', registerUser);
router.post('/login', loginUser);

module.exports = router;
