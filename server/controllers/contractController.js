const Contract = require('../models/Contract');
const Job = require('../models/Job');
const { isValidSolanaAddress, verifyTransaction } = require('../utils/solana');

// @desc    Create a new contract
// @route   POST /api/contracts
// @access  Private
const createContract = async (req, res) => {
  try {
    const { jobId, contractAddress, escrowAccount } = req.body;
    const job = await Job.findById(jobId);

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    const contract = new Contract({
      jobId,
      clientId: req.user._id,
      freelancerId: job.freelancer,
      amount: job.budget,
      contractAddress,
      escrowAccount,
      status: 'pending',
    });

    await contract.save();
    res.status(201).json(contract);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all contracts
// @route   GET /api/contracts
// @access  Private
const getContracts = async (req, res) => {
  try {
    const contracts = await Contract.find({
      $or: [{ clientId: req.user._id }, { freelancerId: req.user._id }],
    })
      .populate('jobId')
      .populate('clientId', 'name email')
      .populate('freelancerId', 'name email');
    res.json(contracts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get contract by ID
// @route   GET /api/contracts/:id
// @access  Private
const getContractById = async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id)
      .populate('jobId')
      .populate('clientId', 'name email')
      .populate('freelancerId', 'name email');

    if (!contract) {
      return res.status(404).json({ message: 'Contract not found' });
    }

    res.json(contract);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update contract status
// @route   PUT /api/contracts/:id/status
// @access  Private
const updateContractStatus = async (req, res) => {
  try {
    const { status, transactionSignature, releaseTransaction } = req.body;
    const contract = await Contract.findById(req.params.id);

    if (!contract) {
      return res.status(404).json({ message: 'Contract not found' });
    }

    // Only allow status updates by the client or freelancer
    if (
      contract.clientId.toString() !== req.user._id.toString() &&
      contract.freelancerId.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    contract.status = status;
    if (transactionSignature) {
      contract.transactionSignature = transactionSignature;
    }
    if (releaseTransaction) {
      contract.releaseTransaction = releaseTransaction;
    }

    await contract.save();
    res.json(contract);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get contracts by job
// @route   GET /api/contracts/job/:jobId
// @access  Private
const getContractsByJob = async (req, res) => {
  try {
    const { jobId } = req.params;

    // Check if job exists
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    // Only allow client or assigned freelancer to view the contracts
    if (
      job.client.toString() !== req.user._id.toString() &&
      job.assignedTo.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const contracts = await Contract.find({ job: jobId })
      .populate('client', 'username email walletAddress')
      .populate('freelancer', 'username email walletAddress')
      .sort({ createdAt: -1 });

    res.json(contracts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Dispute a contract
// @route   POST /api/contracts/:id/dispute
// @access  Private
const disputeContract = async (req, res) => {
  try {
    const { disputeReason } = req.body;
    const contract = await Contract.findById(req.params.id);

    if (!contract) {
      return res.status(404).json({ message: 'Contract not found' });
    }

    // Only allow disputes by the client or freelancer
    if (
      contract.clientId.toString() !== req.user._id.toString() &&
      contract.freelancerId.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    contract.status = 'disputed';
    contract.disputeReason = disputeReason;
    await contract.save();

    res.json(contract);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createContract,
  getContracts,
  getContractById,
  updateContractStatus,
  getContractsByJob,
  disputeContract,
};
