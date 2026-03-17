const crypto = require('crypto');
const nacl = require('tweetnacl');
const bs58 = require('bs58').default;
const Challenge = require('../models/Challenge');
const User = require('../models/User');
const { PublicKey } = require('@solana/web3.js');
const { generateToken } = require('../utils/auth');
const { isValidSolanaAddress } = require('../utils/solana');

// @desc    Generate authentication challenge
// @route   POST /api/auth/challenge
// @access  Public
const generateChallenge = async (req, res) => {
  const { publicKey } = req.body;

  if (!publicKey) {
    return res.status(400).json({ error: 'Public key is required' });
  }

  try {
    // Generate random nonce
    const nonce = crypto.randomBytes(32).toString('hex');

    // Create or update challenge for this wallet
    const challenge = await Challenge.findOneAndUpdate(
      { publicKey },
      {
        publicKey,
        nonce,
        createdAt: new Date(),
      },
      { upsert: true, new: true }
    );

    return res.json({
      message: `Please authenticate your wallet: ${nonce}`,
      nonce: challenge.nonce,
      publicKey: challenge.publicKey,
    });
  } catch (error) {
    console.error('Challenge generation error:', error);
    return res.status(500).json({ error: 'Failed to generate challenge' });
  }
};

// @desc    Verify wallet signature
// @route   POST /api/auth/sign
// @access  Public
const verifySignature = async (req, res) => {
  const { publicKey, signature, nonce } = req.body;

  console.dir(req.body);

  if (!publicKey || !signature || !nonce) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Find challenge for this wallet
    const challenge = await Challenge.findOne({ publicKey });

    if (!challenge) {
      return res.status(404).json({ error: 'No challenge found for this wallet' });
    }

    // Check if nonce matches
    if (challenge.nonce !== nonce) {
      return res.status(401).json({ error: 'Invalid or expired nonce' });
    }

    const message = `Please authenticate your wallet: ${nonce}`;
    const messageBytes = new TextEncoder().encode(message);

    // Handle signature - comes as Buffer object from frontend
    const signatureBytes =
      signature.type === 'Buffer' ? new Uint8Array(signature.data) : bs58.decode(signature);

    const publicKeyBytes = new PublicKey(publicKey).toBytes();

    // Verify signature
    const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Delete used challenge
    await Challenge.deleteOne({ publicKey });

    return res.json({
      success: true,
      publicKey,
      message: 'Wallet verified successfully',
    });
  } catch (error) {
    console.error('Verification error:', error);
    return res.status(500).json({ error: 'Verification failed' });
  }
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  try {
    const { username, email, password, walletAddress, role, skills, bio } = req.body;

    // Wallet validation
    if (!isValidSolanaAddress(walletAddress)) {
      return res.status(400).json({ message: 'Invalid Solana wallet address' });
    }

    // Check duplicates
    const userExists = await User.findOne({
      $or: [{ email }, { username }, { walletAddress }],
    });

    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create user
    const user = await User.create({
      username,
      email,
      password,
      walletAddress,
      role,
      skills: skills || [],
      bio: bio || '',
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
    console.error('REGISTER ERROR:', error);
    return res.status(500).json({
      message: 'Server error',
      error: error.message,
      stack: error.stack,
    });
  }
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user & include password
    const user = await User.findOne({ email }).select('+password');

    // If no user in DB → send generic auth error
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Compare passwords
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
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
    console.error('LOGIN ERROR:', error);
    return res.status(500).json({
      message: 'Server error',
      error: error.message,
      stack: error.stack,
    });
  }
};

module.exports = {
  generateChallenge,
  verifySignature,
  registerUser,
  loginUser,
};
