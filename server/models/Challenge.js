// models/Challenge.js
const mongoose = require('mongoose');

const challengeSchema = new mongoose.Schema(
  {
    publicKey: {
      type: String,
      required: true,
      unique: true, // Ensures only one challenge per wallet
      index: true,
    },
    nonce: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

challengeSchema.index({ createdAt: 1 }, { expireAfterSeconds: 300 });

module.exports = mongoose.model('Challenge', challengeSchema);
