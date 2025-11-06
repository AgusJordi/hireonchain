const Job = require("../models/Job");
const User = require("../models/User");

// @desc    Create a new job
// @route   POST /api/jobs
// @access  Private/Client
const createJob = async (req, res) => {
  try {
    const { title, description, price, skills, deadline } = req.body;

    const job = await Job.create({
      title,
      description,
      price,
      client: req.user._id,
      skills: skills || [],
      deadline: deadline || null,
    });

    res.status(201).json(job);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Get all jobs
// @route   GET /api/jobs
// @access  Public
const getJobs = async (req, res) => {
  try {
    const jobs = await Job.find({})
      .populate("client", "username email walletAddress")
      .populate("assignedTo", "username email walletAddress")
      .sort({ createdAt: -1 });
    res.json(jobs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Get job by ID
// @route   GET /api/jobs/:id
// @access  Public
const getJobById = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate("client", "username email walletAddress")
      .populate("assignedTo", "username email walletAddress")
      .populate(
        "proposals.freelancer",
        "username email walletAddress skills rating"
      );

    if (job) {
      res.json(job);
    } else {
      res.status(404).json({ message: "Job not found" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Update job
// @route   PUT /api/jobs/:id
// @access  Private/Client
const updateJob = async (req, res) => {
  try {
    const { title, description, price, skills, deadline, status } = req.body;

    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    // Check if user is the job owner
    if (job.client.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Don't allow updating if job is already in progress or completed
    if (job.status !== "open" && status === "open") {
      return res
        .status(400)
        .json({
          message:
            "Cannot update a job that is already in progress or completed",
        });
    }

    job.title = title || job.title;
    job.description = description || job.description;
    job.price = price || job.price;
    job.skills = skills || job.skills;
    job.deadline = deadline || job.deadline;
    job.status = status || job.status;

    const updatedJob = await job.save();
    res.json(updatedJob);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Delete job
// @route   DELETE /api/jobs/:id
// @access  Private/Client
const deleteJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    // Check if user is the job owner
    if (job.client.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Don't allow deleting if job is already in progress
    if (job.status === "in_progress") {
      return res
        .status(400)
        .json({ message: "Cannot delete a job that is in progress" });
    }

    await job.remove();
    res.json({ message: "Job removed" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Submit a proposal for a job
// @route   POST /api/jobs/:id/proposals
// @access  Private/Freelancer
const submitProposal = async (req, res) => {
  try {
    const { proposal, price } = req.body;

    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    // Check if job is open
    if (job.status !== "open") {
      return res.status(400).json({ message: "Job is not open for proposals" });
    }

    // Check if user has already submitted a proposal
    const alreadySubmitted = job.proposals.find(
      (p) => p.freelancer.toString() === req.user._id.toString()
    );

    if (alreadySubmitted) {
      return res
        .status(400)
        .json({
          message: "You have already submitted a proposal for this job",
        });
    }

    // Add proposal
    job.proposals.push({
      freelancer: req.user._id,
      proposal,
      price: price || job.price,
    });

    await job.save();
    res.status(201).json({ message: "Proposal submitted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Accept a proposal
// @route   PUT /api/jobs/:id/proposals/:proposalId/accept
// @access  Private/Client
const acceptProposal = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    // Check if user is the job owner
    if (job.client.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Find the proposal
    const proposal = job.proposals.id(req.params.proposalId);

    if (!proposal) {
      return res.status(404).json({ message: "Proposal not found" });
    }

    // Update proposal status
    proposal.status = "accepted";

    // Update job status and assignedTo
    job.status = "in_progress";
    job.assignedTo = proposal.freelancer;

    await job.save();
    res.json({ message: "Proposal accepted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Reject a proposal
// @route   PUT /api/jobs/:id/proposals/:proposalId/reject
// @access  Private/Client
const rejectProposal = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    // Check if user is the job owner
    if (job.client.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Find the proposal
    const proposal = job.proposals.id(req.params.proposalId);

    if (!proposal) {
      return res.status(404).json({ message: "Proposal not found" });
    }

    // Update proposal status
    proposal.status = "rejected";

    await job.save();
    res.json({ message: "Proposal rejected" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Mark job as completed
// @route   PUT /api/jobs/:id/complete
// @access  Private/Client
const completeJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    // Check if user is the job owner
    if (job.client.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Check if job is in progress
    if (job.status !== "in_progress") {
      return res.status(400).json({ message: "Job is not in progress" });
    }

    // Update job status
    job.status = "completed";

    await job.save();
    res.json({ message: "Job marked as completed" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Get jobs by client
// @route   GET /api/jobs/client
// @access  Private/Client
const getClientJobs = async (req, res) => {
  try {
    const jobs = await Job.find({ client: req.user._id })
      .populate("assignedTo", "username email walletAddress")
      .sort({ createdAt: -1 });
    res.json(jobs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Get jobs by freelancer
// @route   GET /api/jobs/freelancer
// @access  Private/Freelancer
const getFreelancerJobs = async (req, res) => {
  try {
    const jobs = await Job.find({ assignedTo: req.user._id })
      .populate("client", "username email walletAddress")
      .sort({ createdAt: -1 });
    res.json(jobs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Update contract address for a job
// @route   PUT /api/jobs/:id/contract
// @access  Private
const updateJobContract = async (req, res) => {
  try {
    const { contractAddress } = req.body;

    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    // Only allow client or assigned freelancer to update contract address
    if (
      job.client.toString() !== req.user._id.toString() &&
      job.assignedTo.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: "Not authorized" });
    }

    job.contractAddress = contractAddress;

    const updatedJob = await job.save();
    res.json(updatedJob);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  createJob,
  getJobs,
  getJobById,
  updateJob,
  deleteJob,
  submitProposal,
  acceptProposal,
  rejectProposal,
  completeJob,
  getClientJobs,
  getFreelancerJobs,
  updateJobContract,
};
