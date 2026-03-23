const Contract = require('../models/Contract');
const Job = require('../models/Job');
const { getNextSequence } = require('../utils/counter');
const { verifyProgramTransaction } = require('../utils/solana');

const CLIENT_ONLY_TYPES = ['fund', 'approve', 'release', 'cancel'];

const FREELANCER_ONLY_TYPES = ['submit'];

const EITHER_TYPES = ['dispute', 'evidence'];

const ON_CHAIN_TYPES = [
  'fund',
  'submit',
  'approve',
  'release',
  'cancel',
  'dispute',
  'evidence',
  'resolve',
];

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
    console.error('Create contract error:', error);
    res.status(500).json({ message: 'Server error' });
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
      .populate('jobId', 'title')
      .populate('clientId', 'username email')
      .populate('freelancerId', 'username email');

    const mapped = contracts.map(c => {
      const obj = c.toObject();
      return {
        ...obj,
        job: obj.jobId,
        client: obj.clientId,
        freelancer: obj.freelancerId,
        amount: obj.totalAmount / 1_000_000_000,
      };
    });

    res.json(mapped);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
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

    if (
      contract.clientId._id.toString() !== req.user._id.toString() &&
      contract.freelancerId._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    res.json(contract);
  } catch (error) {
    console.error('Get contract by ID error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update contract status
// @route   PUT /api/contracts/:id/status
// @access  Private
const VALID_STATUS_TRANSITIONS = {
  pending: ['created'],
  created: ['funded', 'cancelled'],
  funded: ['in_progress', 'cancelled', 'disputed'],
  in_progress: ['completed', 'disputed', 'cancelled'],
  disputed: ['funded', 'in_progress', 'completed'],
};

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

    const allowedTransitions = VALID_STATUS_TRANSITIONS[contract.status];
    if (!allowedTransitions || !allowedTransitions.includes(status)) {
      return res.status(400).json({
        message: `Invalid status transition from '${contract.status}' to '${status}'`,
      });
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
    console.error('Update contract status error:', error);
    res.status(500).json({ message: 'Server error' });
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
      job.assignedTo &&
      job.assignedTo.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const contracts = await Contract.find({ jobId })
      .populate('clientId', 'username email walletAddress')
      .populate('freelancerId', 'username email walletAddress')
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

    if (!['funded', 'in_progress'].includes(contract.status)) {
      return res.status(400).json({
        message: `Cannot dispute a contract with status '${contract.status}'`,
      });
    }

    contract.status = 'disputed';
    contract.disputeReason = disputeReason;
    await contract.save();

    res.json(contract);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get next on-chain job ID
// @route   GET /api/contracts/next-job-id
// @access  Private
const getNextJobId = async (req, res) => {
  try {
    const nextId = await getNextSequence('onchain_job_id');
    res.json({ onChainJobId: nextId });
  } catch (error) {
    console.error('Get next job ID error:', error);
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Create on-chain contract after successful blockchain transaction
// @route   POST /api/contracts/create-onchain
// @access  Private
const createOnchainContract = async (req, res) => {
  try {
    const { jobId, milestones, txSignature, onChainJobId } = req.body;

    if (onChainJobId === undefined || onChainJobId === null) {
      return res.status(400).json({ message: 'onChainJobId is required' });
    }

    const job = await Job.findById(jobId)
      .populate('client', 'walletAddress')
      .populate('assignedTo', 'walletAddress');

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    if (job.client._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (!job.assignedTo) {
      return res.status(400).json({ message: 'No freelancer assigned' });
    }

    if (!Array.isArray(milestones) || milestones.length === 0) {
      return res.status(400).json({ message: 'At least one milestone is required' });
    }
    if (milestones.length > 10) {
      return res.status(400).json({ message: 'Maximum 10 milestones allowed' });
    }
    for (const m of milestones) {
      const amount = parseFloat(m.amount);
      if (
        !m.description ||
        typeof m.description !== 'string' ||
        m.description.trim().length === 0
      ) {
        return res.status(400).json({ message: 'Each milestone must have a description' });
      }
      if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({ message: 'Milestone amounts must be positive numbers' });
      }
    }

    const totalAmount = milestones.reduce(
      (sum, m) => sum + parseFloat(m.amount) * 1_000_000_000,
      0
    );

    const contract = await Contract.create({
      jobId: job._id,
      clientId: job.client._id,
      freelancerId: job.assignedTo._id,
      onChainJobId,
      clientWallet: job.client.walletAddress,
      freelancerWallet: job.assignedTo.walletAddress,
      totalAmount,
      status: 'created',
      milestones: milestones.map((m, i) => ({
        milestoneId: i,
        amount: parseFloat(m.amount) * 1_000_000_000,
        description: m.description,
        status: 'pending',
      })),
      transactions: [{ type: 'create', signature: txSignature }],
    });

    job.onChainJobId = onChainJobId;
    await job.save();

    res.status(201).json({ contract, onChainJobId });
  } catch (error) {
    console.error('Create on-chain contract error:', error);
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Record a transaction and update contract/milestone status
// @route   POST /api/contracts/:id/transaction
// @access  Private
const recordTransaction = async (req, res) => {
  try {
    const { type, signature, milestoneId, evidence, ruling } = req.body;
    const contract = await Contract.findById(req.params.id);

    if (!contract) {
      return res.status(404).json({ message: 'Contract not found' });
    }

    const isClient = contract.clientId.toString() === req.user._id.toString();
    const isFreelancer = contract.freelancerId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (type === 'resolve') {
      if (!isAdmin) {
        return res.status(403).json({ message: 'Only the arbitrator can resolve disputes' });
      }
    } else if (!isClient && !isFreelancer) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (CLIENT_ONLY_TYPES.includes(type) && !isClient) {
      return res.status(403).json({ message: 'Only the client can perform this action' });
    }

    if (FREELANCER_ONLY_TYPES.includes(type) && !isFreelancer) {
      return res.status(403).json({ message: 'Only the freelancer can perform this action' });
    }

    if (ON_CHAIN_TYPES.includes(type)) {
      if (!signature) {
        return res.status(400).json({ message: 'Transaction signature is required' });
      }

      const verification = await verifyProgramTransaction(signature);

      if (!verification.valid) {
        console.error('Transaction verification failed:', verification.error);
        return res.status(400).json({
          message: 'Transaction verification failed',
          error: verification.error,
        });
      }

      const existingTx = contract.transactions.find(tx => tx.signature === signature);
      if (existingTx) {
        return res.status(400).json({ message: 'Transaction already recorded' });
      }
    }

    contract.transactions.push({ type, signature, milestoneId });

    if (type === 'dispute') {
      contract.status = 'disputed';
      if (!contract.dispute) {
        contract.dispute = {};
      }
      contract.dispute.status = 'open';
      contract.dispute.milestoneId = milestoneId;
      contract.dispute.opener = isClient ? contract.clientWallet : contract.freelancerWallet;
      contract.dispute.openedAt = new Date();
    }

    if (type === 'evidence') {
      if (!contract.dispute || contract.dispute.status !== 'open') {
        return res.status(400).json({ message: 'No open dispute found' });
      }
      if (!evidence) {
        return res.status(400).json({ message: 'Evidence hash is required' });
      }
      if (isClient) {
        contract.dispute.clientEvidence = evidence;
      } else {
        contract.dispute.freelancerEvidence = evidence;
      }
    }

    // Handle dispute resolution
    if (type === 'resolve') {
      if (!contract.dispute || contract.dispute.status !== 'open') {
        return res.status(400).json({ message: 'No open dispute found' });
      }
      if (!ruling) {
        return res.status(400).json({ message: 'Ruling is required' });
      }
      contract.dispute.status = 'resolved';
      contract.dispute.ruling = ruling;
      contract.dispute.resolvedAt = new Date();

      if (ruling === 'client_wins') {
        if (milestoneId !== undefined && contract.milestones[milestoneId]) {
          contract.milestones[milestoneId].status = 'cancelled';
        }
      } else if (ruling === 'freelancer_wins') {
        if (milestoneId !== undefined && contract.milestones[milestoneId]) {
          contract.milestones[milestoneId].status = 'paid';
        }
      } else if (ruling === 'split') {
        if (milestoneId !== undefined && contract.milestones[milestoneId]) {
          contract.milestones[milestoneId].status = 'split';
        }
      }

      const allTerminal = contract.milestones.every(m =>
        ['paid', 'cancelled', 'split'].includes(m.status)
      );
      if (allTerminal) {
        contract.status = 'completed';
      } else {
        contract.status = 'funded';
      }
    }

    const contractStatusMap = {
      fund: 'funded',
      cancel: 'cancelled',
    };
    if (contractStatusMap[type]) {
      contract.status = contractStatusMap[type];
    }

    if (milestoneId !== undefined && contract.milestones[milestoneId]) {
      const milestoneStatusMap = {
        submit: 'submitted',
        approve: 'approved',
        release: 'paid',
      };
      if (milestoneStatusMap[type]) {
        contract.milestones[milestoneId].status = milestoneStatusMap[type];
      }
    }

    if (type === 'release') {
      const allPaid = contract.milestones.every(m => m.status === 'paid');
      if (allPaid) {
        contract.status = 'completed';
      }
    }

    await contract.save();
    res.json(contract);
  } catch (error) {
    console.error('Record transaction error:', error);
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get contract by job ID
// @route   GET /api/contracts/by-job/:jobId
// @access  Private
const getContractByJob = async (req, res) => {
  try {
    const contract = await Contract.findOne({ jobId: req.params.jobId })
      .populate('clientId', 'username walletAddress')
      .populate('freelancerId', 'username walletAddress');

    if (!contract) {
      return res.status(404).json({ message: 'No contract for this job' });
    }

    // Verify authorization
    if (
      contract.clientId._id.toString() !== req.user._id.toString() &&
      contract.freelancerId._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    res.json(contract);
  } catch (error) {
    console.error('Get contract by job error:', error);
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createContract,
  getContracts,
  getContractById,
  updateContractStatus,
  getContractsByJob,
  disputeContract,
  getNextJobId,
  createOnchainContract,
  recordTransaction,
  getContractByJob,
};
