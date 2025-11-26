/* const User = require("../models/User");
const { generateToken } = require("../utils/auth");
const { isValidSolanaAddress } = require("../utils/solana");

// @desc    Register a new user
// @route   POST /api/users
// @access  Public
const registerUser = async (req, res) => {
  try {
    const { username, email, password, walletAddress, role, skills, bio } =
      req.body;

    // Check if wallet address is valid
    if (!isValidSolanaAddress(walletAddress)) {
      return res.status(400).json({ message: "Invalid Solana wallet address" });
    }

    // Check if user already exists
    const userExists = await User.findOne({
      $or: [{ email }, { username }, { walletAddress }],
    });

    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Create user
    const user = await User.create({
      username,
      email,
      password,
      walletAddress,
      role,
      skills: skills || [],
      bio: bio || "",
    });

    if (user) {
      res.status(201).json({
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
      res.status(400).json({ message: "Invalid user data" });
    }
  } catch (error) {
    console.error("LOGIN ERROR:", error);
    res.status(500).json({ message: error.message, stack: error.stack });
  }

};

// @desc    Auth user & get token
// @route   POST /api/users/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check for user email
    const user = await User.findOne({ email }).select("+password");

    if (user && (await user.matchPassword(password))) {
      res.json({
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
      res.status(401).json({ message: "Invalid email or password" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
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
*/

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

    // Wallet validation
    if (!isValidSolanaAddress(walletAddress)) {
      return res.status(400).json({ message: "Invalid Solana wallet address" });
    }

    // Check duplicates
    const userExists = await User.findOne({
      $or: [{ email }, { username }, { walletAddress }],
    });

    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Create user
    const user = await User.create({
      username,
      email,
      password,
      walletAddress,
      role,
      skills: skills || [],
      bio: bio || "",
    });

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

  } catch (error) {
    console.error("REGISTER ERROR:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
      stack: error.stack,
    });
  }
};

// @desc    Auth user & get token
// @route   POST /api/users/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user & include password
    const user = await User.findOne({ email }).select("+password");

    // If no user in DB → send generic auth error
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Compare passwords
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

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
    console.error("LOGIN ERROR:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
      stack: error.stack,
    });
  }
};

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) return res.status(404).json({ message: "User not found" });

    return res.json({
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

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) return res.status(404).json({ message: "User not found" });

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
        return res.status(400).json({ message: "Invalid Solana wallet address" });
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
    return res.status(500).json({ message: "Server error" });
  }
};

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");

    if (!user) return res.status(404).json({ message: "User not found" });

    return res.json(user);

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
};

// @desc    Get freelancers
// @route   GET /api/users/freelancers
// @access  Public
const getFreelancers = async (req, res) => {
  try {
    const freelancers = await User.find({ role: "freelancer" }).select("-password");
    return res.json(freelancers);

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
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
        message: "Please provide a rating between 1 and 5",
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) return res.status(404).json({ message: "User not found" });

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

    // Recalculate rating
    const totalRatings = user.reviews.reduce(
      (acc, item) => acc + item.rating,
      0
    );
    user.rating = totalRatings / user.reviews.length;

    await user.save();

    return res.status(201).json({ message: "Review added" });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
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
