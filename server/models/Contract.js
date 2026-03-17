const mongoose = require('mongoose');

const contractSchema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    freelancerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'funded', 'in_progress', 'completed', 'disputed'],
      default: 'pending',
    },
    amount: {
      type: Number,
      required: true,
    },
    contractAddress: {
      type: String,
      required: true,
    },
    transactionSignature: {
      type: String,
    },
    disputeReason: {
      type: String,
    },
    escrowAccount: {
      type: String,
      required: true,
    },
    releaseTransaction: {
      type: String,
    },
  },
  { timestamps: true }
);

// Update the updatedAt timestamp
contractSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Contract', contractSchema);
