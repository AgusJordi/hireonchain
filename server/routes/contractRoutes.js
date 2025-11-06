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

// All routes are protected
router.use(protect);

// Create a new contract
router.post("/", createContract);

// Get all contracts for the current user
router.get("/", getContracts);

// Get contract by ID
router.get("/:id", getContractById);

// Update contract status
router.put("/:id/status", updateContractStatus);

// Dispute a contract
router.post("/:id/dispute", disputeContract);

module.exports = router;
