const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Generate JWT token
const generateToken = id => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });
};

// Authentication middleware
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from the token
      req.user = await User.findById(decoded.id).select('-password');

      next();
    } catch (error) {
      console.error(error);
      res.status(401).json({ message: 'Not authorized, token failed' });
      return;
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Not authorized, no token' });
    return;
  }
};

// Admin/Client role check
const isClient = (req, res, next) => {
  if (req.user && req.user.role === 'client') {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized as a client' });
    return;
  }
};

// Freelancer role check
const isFreelancer = (req, res, next) => {
  if (req.user && req.user.role === 'freelancer') {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized as a freelancer' });
    return;
  }
};

module.exports = { generateToken, protect, isClient, isFreelancer };
