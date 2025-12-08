const User = require("../models/User");
const { generateToken } = require("../utils/auth");
const { isValidSolanaAddress } = require("../utils/solana");

// @desc    Register a new user
// @route   POST /api/users
// @access  Public
 const registerUser = async (req, res) => {
  try {
    const { username, email, password, walletAddress, role, skills, bio } =
      req.body;

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();
    // Validate Solana address
    if (!isValidSolanaAddress(walletAddress)) {
      return res.status(400).json({ message: "Invalid Solana wallet address" });
    }

    // Check if user already exists
    const userExists = await User.findOne({
      $or: [
        { email: normalizedEmail },
        { username: username.toLowerCase() },
        { walletAddress: walletAddress },
      ],
    });

    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Create user
    const user = await User.create({
      username: username.toLowerCase(),
      email: normalizedEmail,
      password,
      walletAddress: walletAddress,
      role,
      skills: skills || [],
      bio: bio || "",
    });

    if (user) {

      return res.status(201).json({
        _id: user._id,
        username: user.username,
        email: user.email,
        walletAddress: user.walletAddress,
        role: user.role,
        skills: user.skills,
        bio: user.bio,
        token: generateToken(user._id),
      });
    } else {
      return res.status(400).json({ message: "Invalid user data" });
    }
  } catch (error) {

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors)
        .map((e) => e.message)
        .join(", ");
      return res.status(400).json({ message: messages });
    }

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ message: `User already exists` });
    }

    return res.status(500).json({ message: "Server error" });
  }
};

// @desc    Auth user & get token
// @route   POST /api/users/login
// @access  Public
 const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Normalize email
    const normalizedEmail =  email.toLowerCase().trim();

    // Check for user email
    const user = await User.findOne({ email: normalizedEmail }).select(
      "+password"
    );

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Check if account is locked
    if (user.lockUntil && user.lockUntil > new Date()) {
      return res.status(429).json({
        message:
          "Account temporarily locked. Please try again after 15 minutes.",
      });
    }

    // Check password
    const passwordMatch = await user.matchPassword(password);

    if (!passwordMatch) {

      // Increment failed login attempts
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;

      // Lock account after 5 failed attempts
      if (user.failedLoginAttempts >= 5) {
        user.lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
   
      }

      await user.save();
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Reset failed attempts on successful login
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    user.lastLogin = new Date();
    await user.save();


    return res.json({
      _id: user._id,
      username: user.username,
      email: user.email,
      walletAddress: user.walletAddress,
      role: user.role,
      skills: user.skills,
      bio: user.bio,
      token: generateToken(user._id),
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      res.json({
        _id: user._id,
        username: user.username,
        email: user.email,
        walletAddress: user.walletAddress,
        role: user.role,
        skills: user.skills,
        bio: user.bio,
        rating: user.rating,
        reviews: user.reviews,
      });
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      user.username = req.body.username || user.username;
      user.email = req.body.email || user.email;
      user.bio = req.body.bio || user.bio;
      user.skills = req.body.skills || user.skills;

      if (req.body.password) {
        user.password = req.body.password;
      }

      if (req.body.walletAddress) {
        if (!isValidSolanaAddress(req.body.walletAddress)) {
          return res
            .status(400)
            .json({ message: "Invalid Solana wallet address" });
        }
        user.walletAddress = req.body.walletAddress;
      }

      const updatedUser = await user.save();

      res.json({
        _id: updatedUser._id,
        username: updatedUser.username,
        email: updatedUser.email,
        walletAddress: updatedUser.walletAddress,
        role: updatedUser.role,
        skills: updatedUser.skills,
        bio: updatedUser.bio,
        token: generateToken(updatedUser._id),
      });
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");

    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Get freelancers
// @route   GET /api/users/freelancers
// @access  Public
const getFreelancers = async (req, res) => {
  try {
    const freelancers = await User.find({ role: "freelancer" }).select(
      "-password"
    );
    res.json(freelancers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Add a review to a user
// @route   POST /api/users/:id/reviews
// @access  Private
const addUserReview = async (req, res) => {
  try {
    const { rating, content } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res
        .status(400)
        .json({ message: "Please provide a rating between 1 and 5" });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if user has already reviewed this freelancer
    const alreadyReviewed = user.reviews.find(
      (r) => r.from.toString() === req.user._id.toString()
    );

    if (alreadyReviewed) {
      return res.status(400).json({ message: "User already reviewed" });
    }

    const review = {
      from: req.user._id,
      rating: Number(rating),
      content,
    };

    user.reviews.push(review);

    // Calculate average rating
    const totalRatings = user.reviews.reduce(
      (acc, item) => acc + item.rating,
      0
    );
    user.rating = totalRatings / user.reviews.length;

    await user.save();

    res.status(201).json({ message: "Review added" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  getUserById,
  getFreelancers,
  addUserReview,
};
