const express = require("express");
const {
  createContract,
  getContracts,
  getContractById,
  updateContractStatus,
  getContractsByJob,
} = require("../controllers/contractController");
const { protect } = require("../utils/auth");

const router = express.Router();

// All contract routes are protected
router.post("/", protect, createContract);
router.get("/", protect, getContracts);
router.get("/:id", protect, getContractById);
router.put("/:id/status", protect, updateContractStatus);
router.get("/job/:jobId", protect, getContractsByJob);

module.exports = router;
