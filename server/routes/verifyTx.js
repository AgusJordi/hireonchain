const express = require('express');
const router = express.Router();
const { verifyTx } = require('../controllers/verifyTxController');
const { protect } = require('../middleware/authMiddleware');

/**
 * POST /api/verify-tx
 *
 * Accepts a Solana transaction signature and verifies it on-chain.
 * Requires a valid JWT token (Bearer <token>).
 *
 * Body:
 *   signature      {string}  Base58-encoded Solana tx signature (required)
 *   expectedWallet {string}  Wallet address that must appear in the tx (optional)
 *
 * Response:
 *   { verified, signature, network, status, slot, blockTime, fee, accounts, walletVerified? }
 */
router.post('/', protect, verifyTx);

module.exports = router;
