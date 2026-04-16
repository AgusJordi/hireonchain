const Joi = require('joi');
const { getSolanaConnection, isValidSolanaAddress } = require('../utils/solana');

// ---------------------------------------------------------------------------
// Input schema
// Solana signatures are 64 bytes base58-encoded → typically 87-88 characters.
// ---------------------------------------------------------------------------
const schema = Joi.object({
  signature: Joi.string()
    .pattern(/^[1-9A-HJ-NP-Za-km-z]{80,100}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid Solana transaction signature format',
    }),
  // Optional: if provided, the tx must include this wallet in its account keys
  expectedWallet: Joi.string().optional(),
});

/**
 * POST /api/verify-tx
 *
 * Verifies a Solana transaction on Devnet (or configured network).
 * Runs three checks in sequence:
 *   1. Transaction exists on-chain
 *   2. Transaction status is successful  (meta.err === null)
 *   3. expectedWallet is present in the account keys  (only if provided)
 *
 * @returns {object} JSON with { verified, signature, network, status, ... }
 */
const verifyTx = async (req, res) => {
  // --- 1. Validate input ---
  const { error, value } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      verified: false,
      error: error.details[0].message,
    });
  }

  const { signature, expectedWallet } = value;

  if (expectedWallet && !isValidSolanaAddress(expectedWallet)) {
    return res.status(400).json({
      verified: false,
      error: 'Invalid expectedWallet address',
    });
  }

  // Reuse the shared connection (reads SOLANA_NETWORK from env)
  const connection = getSolanaConnection();
  const network = process.env.SOLANA_NETWORK || 'devnet';

  try {
    // --- 2. Fetch transaction ---
    const tx = await connection.getTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0, // handles both legacy and v0 txs
    });

    // Check 1 — transaction exists
    if (!tx) {
      return res.status(404).json({
        verified: false,
        signature,
        network,
        error: 'Transaction not found',
      });
    }

    // Check 2 — transaction was successful
    if (tx.meta?.err) {
      return res.status(200).json({
        verified: false,
        signature,
        network,
        status: 'failed',
        error: 'Transaction failed on-chain',
        details: tx.meta.err,
      });
    }

    // --- 3. Extract account keys ---
    // Legacy messages expose .accountKeys; versioned (v0) expose .staticAccountKeys
    const message = tx.transaction.message;
    const rawKeys = message.staticAccountKeys ?? message.accountKeys ?? [];
    const accountKeys = rawKeys.map(k => k.toString());

    // Check 3 — expected wallet is involved (optional check)
    let walletVerified = null;
    if (expectedWallet) {
      walletVerified = accountKeys.includes(expectedWallet);
      if (!walletVerified) {
        return res.status(200).json({
          verified: false,
          signature,
          network,
          status: 'success',
          error: 'Expected wallet address not found in transaction accounts',
          walletVerified: false,
          accounts: accountKeys,
        });
      }
    }

    // --- All checks passed ---
    return res.status(200).json({
      verified: true,
      signature,
      network,
      status: 'success',
      slot: tx.slot,
      blockTime: tx.blockTime,
      fee: tx.meta?.fee ?? null,
      accounts: accountKeys,
      ...(walletVerified !== null && { walletVerified }),
    });
  } catch (err) {
    console.error('[verify-tx] Unexpected error:', err);
    return res.status(500).json({
      verified: false,
      signature,
      network,
      error: 'Internal server error',
    });
  }
};

module.exports = { verifyTx };
