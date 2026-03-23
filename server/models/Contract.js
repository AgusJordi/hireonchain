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
    onChainJobId: {
      type: Number,
      unique: true,
      sparse: true,
    },
    jobPda: {
      type: String,
    },
    vaultPda: {
      type: String,
    },
    disputePda: {
      type: String,
    },
    clientWallet: {
      type: String,
    },
    freelancerWallet: {
      type: String,
    },
    totalAmount: {
      type: Number,
      default: 0,
    },
    escrowBalance: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'created', 'funded', 'in_progress', 'completed', 'disputed', 'cancelled'],
      default: 'pending',
    },
    milestones: [
      {
        milestoneId: {
          type: Number,
          required: true,
        },
        amount: {
          type: Number,
          required: true,
        },
        description: {
          type: String,
          required: true,
        },
        descriptionHash: {
          type: String,
        },
        status: {
          type: String,
          enum: ['pending', 'submitted', 'approved', 'paid', 'disputed', 'cancelled', 'split'],
          default: 'pending',
        },
        submissionHash: {
          type: String,
        },
        milestonePda: {
          type: String,
        },
      },
    ],
    transactions: [
      {
        type: {
          type: String,
          enum: [
            'create',
            'fund',
            'submit',
            'approve',
            'release',
            'cancel',
            'dispute',
            'evidence',
            'resolve',
          ],
          required: true,
        },
        signature: {
          type: String,
          required: true,
        },
        milestoneId: {
          type: Number,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    contractAddress: {
      type: String,
    },
    transactionSignature: {
      type: String,
    },
    disputeReason: {
      type: String,
    },
    dispute: {
      milestoneId: {
        type: Number,
      },
      opener: {
        type: String,
      },
      status: {
        type: String,
        enum: ['none', 'open', 'resolved'],
        default: 'none',
      },
      ruling: {
        type: String,
        enum: ['none', 'client_wins', 'freelancer_wins', 'split'],
        default: 'none',
      },
      splitClientBps: {
        type: Number,
        default: 0,
      },
      splitFreelancerBps: {
        type: Number,
        default: 0,
      },
      clientEvidence: {
        type: String,
      },
      freelancerEvidence: {
        type: String,
      },
      openedAt: {
        type: Date,
      },
      resolvedAt: {
        type: Date,
      },
    },
    escrowAccount: {
      type: String,
    },
    releaseTransaction: {
      type: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Contract', contractSchema);
