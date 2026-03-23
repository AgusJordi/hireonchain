// @desc    Get user profile
// @route   GET /api/users/profile

const User = require('../models/User');
const { generateToken } = require('../utils/auth');
const { isValidSolanaAddress } = require('../utils/solana');

// @access  Private
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');

    if (!user) return res.status(404).json({ message: 'User not found' });

    return res.json(user);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) return res.status(404).json({ message: 'User not found' });

    user.username = req.body.username || user.username;
    user.email = req.body.email || user.email;
    user.bio = req.body.bio || user.bio;
    user.skills = req.body.skills || user.skills;

    // Change password
    if (req.body.password) {
      user.password = req.body.password;
    }

    // Change wallet
    if (req.body.walletAddress) {
      if (!isValidSolanaAddress(req.body.walletAddress)) {
        return res.status(400).json({ message: 'Invalid Solana wallet address' });
      }
      user.walletAddress = req.body.walletAddress;
    }

    const updatedUser = await user.save();

    return res.json({
      _id: updatedUser._id,
      username: updatedUser.username,
      email: updatedUser.email,
      walletAddress: updatedUser.walletAddress,
      role: updatedUser.role,
      skills: updatedUser.skills,
      bio: updatedUser.bio,
      token: generateToken(updatedUser._id),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) return res.status(404).json({ message: 'User not found' });

    return res.json(user);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get freelancers
// @route   GET /api/users/freelancers
// @access  Public
const getFreelancers = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [freelancers, total] = await Promise.all([
      User.find({ role: 'freelancer' })
        .select('-password')
        .skip(skip)
        .limit(limit),
      User.countDocuments({ role: 'freelancer' }),
    ]);
    return res.json({ freelancers, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Add a review to a user
// @route   POST /api/users/:id/reviews
// @access  Private
const addUserReview = async (req, res) => {
  try {
    const { rating, content } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        message: 'Please provide a rating between 1 and 5',
      });
    }

    // Prevent self-reviews
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot review yourself' });
    }

    const user = await User.findById(req.params.id);

    if (!user) return res.status(404).json({ message: 'User not found' });

    const alreadyReviewed = user.reviews.find(r => r.from.toString() === req.user._id.toString());

    if (alreadyReviewed) {
      return res.status(400).json({ message: 'User already reviewed' });
    }

    const review = {
      from: req.user._id,
      rating: Number(rating),
      content,
    };

    user.reviews.push(review);

    // Recalculate rating
    const totalRatings = user.reviews.reduce((acc, item) => acc + item.rating, 0);
    user.rating = totalRatings / user.reviews.length;

    await user.save();

    return res.status(201).json({ message: 'Review added' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getUserProfile,
  updateUserProfile,
  getUserById,
  getFreelancers,
  addUserReview,
};
