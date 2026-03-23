const {
  generateChallenge,
  verifySignature,
  registerUser,
  loginUser,
} = require('../controllers/authController');
const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// Stricter limiter for login/register
const strictAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later.' },
});

router.post('/challenge', authLimiter, generateChallenge);
router.post('/sign', authLimiter, verifySignature);
router.post('/register', strictAuthLimiter, registerUser);
router.post('/login', strictAuthLimiter, loginUser);

module.exports = router;
