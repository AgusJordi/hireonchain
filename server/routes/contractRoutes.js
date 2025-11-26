const express = require("express");
const router = express.Router();

const {
  createContract,
  getContracts,
  getContractById,
  updateContractStatus,
  disputeContract,
} = require("../controllers/contractController");

const { protect } = require("../middleware/authMiddleware");

// Create a new contract
router.post("/", protect, createContract);

// Get all contracts for the current user
router.get("/", protect, getContracts);

// Get contract by ID
router.get("/:id", protect, getContractById);

// Update contract status
router.put("/:id/status", protect, updateContractStatus);

// Dispute a contract
router.post("/:id/dispute", protect, disputeContract);

module.exports = router;
