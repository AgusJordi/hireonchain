const express = require('express');
const {
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
} = require('../controllers/jobController');
const { protect, isClient, isFreelancer } = require('../utils/auth');

const router = express.Router();

// Public routes
router.get('/', getJobs);
router.get('/:id', getJobById);

// Protected routes
router.post('/', protect, isClient, createJob);
router.put('/:id', protect, isClient, updateJob);
router.delete('/:id', protect, isClient, deleteJob);
router.post('/:id/proposals', protect, isFreelancer, submitProposal);
router.put('/:id/proposals/:proposalId/accept', protect, isClient, acceptProposal);
router.put('/:id/proposals/:proposalId/reject', protect, isClient, rejectProposal);
router.put('/:id/complete', protect, isClient, completeJob);
router.get('/client/jobs', protect, isClient, getClientJobs);
router.get('/freelancer/jobs', protect, isFreelancer, getFreelancerJobs);
router.put('/:id/contract', protect, updateJobContract);

module.exports = router;
