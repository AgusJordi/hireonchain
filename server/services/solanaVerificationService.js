/**
 * Solana On-Chain Verification Service
 *
 * This is the heart of the backend verification layer. It replaces the
 * previous shallow `verifyProgramTransaction()` with strict, multi-step
 * verification that proves what actually happened on-chain before
 * allowing any MongoDB state changes.
 *
 * Verification flow:
 *   1. Fetch full transaction from RPC (confirmed commitment)
 *   2. Verify transaction succeeded
 *   3. Find exactly one marketplace program instruction (reject ambiguous txs)
 *   4. Decode the instruction discriminator → canonical instruction name
 *   5. Verify expected PDAs are present in instruction account keys
 *   6. Verify the signer matches the expected role
 *   7. Read resulting on-chain state and validate account linkage
 *   8. Return a normalized verification result
 *
 * NOTE: Uses 'confirmed' commitment level, NOT 'finalized'. This means
 * there is a small window where a confirmed tx could theoretically be
 * rolled back (extremely rare on Solana mainnet, but possible). For
 * maximum safety in production, upgrade financial operations to 'finalized'.
 */

const { Connection, PublicKey, clusterApiUrl } = require('@solana/web3.js');
const bs58 = require('bs58').default;
const {
  identifyInstruction,
  ACTION_TO_INSTRUCTION,
  INSTRUCTION_TO_ACTION,
} = require('../utils/instructionDiscriminators');
const {
  deriveJobPda,
  deriveMilestonePda,
  deriveDisputePda,
  deriveVaultPda,
  derivePlatformConfigPda,
} = require('../utils/pdaDerivation');
const {
  deserializeJob,
  deserializeMilestone,
  deserializeDispute,
  deserializePlatformConfig,
} = require('../utils/accountDeserializers');

/**
 * Get a Solana connection with appropriate commitment.
 * Currently uses 'confirmed'. See module docstring for commitment note.
 */
function getConnection() {
  const network = process.env.SOLANA_NETWORK || 'devnet';
  const rpcUrl = process.env.SOLANA_RPC_URL || clusterApiUrl(network);
  return new Connection(rpcUrl, 'confirmed');
}

function getProgramId() {
  const id = process.env.SOLANA_PROGRAM_ID;
  if (!id) throw new Error('SOLANA_PROGRAM_ID env var not set');
  return new PublicKey(id);
}

// ────────────────────────────────────────────────────────────────────
// Step 1: Fetch and validate the raw transaction
// ────────────────────────────────────────────────────────────────────

/**
 * Fetch a transaction from the RPC and perform basic validity checks.
 *
 * @param {string} signature - Base58-encoded transaction signature
 * @returns {{ tx, error? }}
 */
async function fetchTransaction(signature) {
  const connection = getConnection();

  let tx;
  try {
    tx = await connection.getTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });
  } catch (err) {
    return { tx: null, error: `RPC error fetching transaction: ${err.message}` };
  }

  if (!tx) {
    return { tx: null, error: 'Transaction not found on-chain' };
  }

  if (tx.meta?.err) {
    return { tx: null, error: `Transaction failed on-chain: ${JSON.stringify(tx.meta.err)}` };
  }

  return { tx };
}

// ────────────────────────────────────────────────────────────────────
// Step 2: Find and decode the marketplace instruction
// ────────────────────────────────────────────────────────────────────

/**
 * Extract all account keys from a transaction (handles both legacy and v0).
 */
function extractAllAccountKeys(tx) {
  const message = tx.transaction.message;

  if (message.staticAccountKeys) {
    // Versioned transaction (v0)
    return [
      ...message.staticAccountKeys.map(k => (typeof k === 'string' ? k : k.toBase58())),
      ...(tx.meta?.loadedAddresses?.writable?.map(k => k.toBase58()) || []),
      ...(tx.meta?.loadedAddresses?.readonly?.map(k => k.toBase58()) || []),
    ];
  } else if (message.accountKeys) {
    // Legacy transaction
    return message.accountKeys.map(k => (typeof k === 'string' ? k : k.toBase58()));
  }
  return null;
}

/**
 * Find the sol-marketplace instruction within a transaction.
 *
 * FIX #5: Rejects ambiguous transactions that contain more than one
 * marketplace instruction. We require exactly one matching instruction
 * to prevent confusion about which instruction is being verified.
 *
 * @param {object} tx - Full transaction object from RPC
 * @returns {{ instructionName, instructionData, accountKeys, signerKey, error? }}
 */
function parseMarketplaceInstruction(tx) {
  const programId = getProgramId();
  const programIdStr = programId.toBase58();

  const allAccountKeys = extractAllAccountKeys(tx);
  if (!allAccountKeys) {
    return { error: 'Could not parse transaction message format' };
  }

  // Collect ALL instructions targeting our program (top-level + inner)
  const matchingInstructions = [];

  const instructions = tx.transaction.message.compiledInstructions || tx.transaction.message.instructions;
  if (!instructions || instructions.length === 0) {
    return { error: 'Transaction has no instructions' };
  }

  for (const ix of instructions) {
    const progIdx = ix.programIdIndex;
    if (allAccountKeys[progIdx] === programIdStr) {
      matchingInstructions.push(ix);
    }
  }

  // Also check inner instructions (CPI calls)
  if (tx.meta?.innerInstructions) {
    for (const inner of tx.meta.innerInstructions) {
      for (const ix of inner.instructions) {
        const progIdx = ix.programIdIndex;
        if (allAccountKeys[progIdx] === programIdStr) {
          matchingInstructions.push(ix);
        }
      }
    }
  }

  if (matchingInstructions.length === 0) {
    return { error: 'Transaction does not contain a sol-marketplace instruction' };
  }

  if (matchingInstructions.length > 1) {
    return {
      error: `Ambiguous transaction: found ${matchingInstructions.length} marketplace instructions. Expected exactly 1.`,
    };
  }

  const targetIx = matchingInstructions[0];

  // Decode instruction data
  let ixData;
  if (targetIx.data) {
    if (typeof targetIx.data === 'string') {
      ixData = Buffer.from(bs58.decode(targetIx.data));
    } else {
      ixData = Buffer.from(targetIx.data);
    }
  } else {
    return { error: 'Instruction has no data' };
  }

  const instructionName = identifyInstruction(ixData);
  if (!instructionName) {
    return { error: 'Unknown instruction discriminator — does not match any known marketplace instruction' };
  }

  // Extract the account keys used by this instruction
  const ixAccountKeys = (targetIx.accounts || targetIx.accountKeyIndexes || []).map(
    idx => allAccountKeys[idx]
  );

  // The first signer in the transaction is the fee payer / primary signer
  const signerKey = allAccountKeys[0];

  return {
    instructionName,
    instructionData: ixData,
    accountKeys: ixAccountKeys,
    signerKey,
  };
}

// ────────────────────────────────────────────────────────────────────
// PDA binding verification (FIX #1)
// ────────────────────────────────────────────────────────────────────

/**
 * Defines which PDAs must be present in the instruction's account keys
 * for each action type. This binds the tx to a specific contract.
 *
 * Returns an array of { name, pda } objects that must appear in accountKeys.
 */
function getExpectedPDAs(action, contract, milestoneId) {
  const programId = getProgramId();
  const [jobPda] = deriveJobPda(contract.clientWallet, contract.onChainJobId, programId);
  const jobPdaStr = jobPda.toBase58();

  const [vaultPda] = deriveVaultPda(jobPda, programId);
  const vaultPdaStr = vaultPda.toBase58();

  const expected = [];

  switch (action) {
    case 'fund':
      expected.push({ name: 'jobPda', pda: jobPdaStr });
      expected.push({ name: 'vaultPda', pda: vaultPdaStr });
      break;

    case 'submit':
    case 'approve':
    case 'release': {
      expected.push({ name: 'jobPda', pda: jobPdaStr });
      if (milestoneId !== undefined && milestoneId !== null) {
        const [msPda] = deriveMilestonePda(jobPda, milestoneId, programId);
        expected.push({ name: 'milestonePda', pda: msPda.toBase58() });
      }
      if (action === 'release') {
        expected.push({ name: 'vaultPda', pda: vaultPdaStr });
      }
      break;
    }

    case 'cancel':
      expected.push({ name: 'jobPda', pda: jobPdaStr });
      expected.push({ name: 'vaultPda', pda: vaultPdaStr });
      break;

    case 'dispute':
    case 'evidence': {
      expected.push({ name: 'jobPda', pda: jobPdaStr });
      const [disputePda] = deriveDisputePda(jobPda, programId);
      expected.push({ name: 'disputePda', pda: disputePda.toBase58() });
      break;
    }

    case 'resolve': {
      expected.push({ name: 'jobPda', pda: jobPdaStr });
      const [dPda] = deriveDisputePda(jobPda, programId);
      expected.push({ name: 'disputePda', pda: dPda.toBase58() });
      // milestonePda resolved via dispute state later, checked in account linkage
      break;
    }
  }

  return expected;
}

/**
 * Verify that expected PDAs are present in the instruction's account keys.
 */
function verifyPDABinding(expectedPDAs, ixAccountKeys) {
  for (const { name, pda } of expectedPDAs) {
    if (!ixAccountKeys.includes(pda)) {
      return {
        error: `Transaction does not reference the expected ${name} (${pda}). This transaction belongs to a different contract.`,
      };
    }
  }
  return { valid: true };
}

// ────────────────────────────────────────────────────────────────────
// Step 3: Read on-chain account state
// ────────────────────────────────────────────────────────────────────

/**
 * Read and deserialize a Job account from RPC
 */
async function readJobState(clientWallet, onChainJobId) {
  const connection = getConnection();
  const programId = getProgramId();
  const [jobPda] = deriveJobPda(clientWallet, onChainJobId, programId);

  const accountInfo = await connection.getAccountInfo(jobPda);
  if (!accountInfo) return { pda: jobPda.toBase58(), data: null, error: 'Job account not found' };

  const job = deserializeJob(accountInfo.data);
  if (!job) return { pda: jobPda.toBase58(), data: null, error: 'Failed to deserialize Job account' };

  return { pda: jobPda.toBase58(), data: job };
}

/**
 * Read and deserialize a Milestone account from RPC
 */
async function readMilestoneState(clientWallet, onChainJobId, milestoneId) {
  const connection = getConnection();
  const programId = getProgramId();
  const [jobPda] = deriveJobPda(clientWallet, onChainJobId, programId);
  const [milestonePda] = deriveMilestonePda(jobPda, milestoneId, programId);

  const accountInfo = await connection.getAccountInfo(milestonePda);
  if (!accountInfo) return { pda: milestonePda.toBase58(), data: null, error: 'Milestone account not found' };

  const milestone = deserializeMilestone(accountInfo.data);
  if (!milestone) return { pda: milestonePda.toBase58(), data: null, error: 'Failed to deserialize Milestone' };

  return { pda: milestonePda.toBase58(), data: milestone };
}

/**
 * Read and deserialize a Dispute account from RPC
 */
async function readDisputeState(clientWallet, onChainJobId) {
  const connection = getConnection();
  const programId = getProgramId();
  const [jobPda] = deriveJobPda(clientWallet, onChainJobId, programId);
  const [disputePda] = deriveDisputePda(jobPda, programId);

  const accountInfo = await connection.getAccountInfo(disputePda);
  if (!accountInfo) return { pda: disputePda.toBase58(), data: null, error: 'Dispute account not found' };

  const dispute = deserializeDispute(accountInfo.data);
  if (!dispute) return { pda: disputePda.toBase58(), data: null, error: 'Failed to deserialize Dispute' };

  return { pda: disputePda.toBase58(), data: dispute };
}

/**
 * Read vault balance from RPC
 */
async function readVaultBalance(clientWallet, onChainJobId) {
  const connection = getConnection();
  const programId = getProgramId();
  const [jobPda] = deriveJobPda(clientWallet, onChainJobId, programId);
  const [vaultPda] = deriveVaultPda(jobPda, programId);

  const balance = await connection.getBalance(vaultPda);
  return { pda: vaultPda.toBase58(), lamports: balance };
}

/**
 * Read PlatformConfig (for arbitrator verification)
 * FIX #2: Needed to verify resolve signer against on-chain arbitrator.
 */
async function readPlatformConfig() {
  const connection = getConnection();
  const programId = getProgramId();
  const [configPda] = derivePlatformConfigPda(programId);

  const accountInfo = await connection.getAccountInfo(configPda);
  if (!accountInfo) return { pda: configPda.toBase58(), data: null, error: 'PlatformConfig not found' };

  const config = deserializePlatformConfig(accountInfo.data);
  if (!config) return { pda: configPda.toBase58(), data: null, error: 'Failed to deserialize PlatformConfig' };

  return { pda: configPda.toBase58(), data: config };
}

// ────────────────────────────────────────────────────────────────────
// Account linkage verification (FIX #4)
// ────────────────────────────────────────────────────────────────────

/**
 * Verify that deserialized on-chain accounts are actually linked to
 * the expected contract context. PDA derivation gives us the right
 * address, but we also verify the data inside the account to catch
 * any inconsistency.
 */
function verifyAccountLinkage(action, contract, states) {
  const { jobState, milestoneState, disputeState } = states;
  const programId = getProgramId();
  const [expectedJobPda] = deriveJobPda(contract.clientWallet, contract.onChainJobId, programId);
  const expectedJobPdaStr = expectedJobPda.toBase58();

  // Verify job.client and job.freelancer match contract wallets
  if (jobState?.data) {
    const jobClient = jobState.data.client.toBase58();
    const jobFreelancer = jobState.data.freelancer.toBase58();

    if (jobClient !== contract.clientWallet) {
      return { error: `Job PDA client (${jobClient}) does not match contract client wallet (${contract.clientWallet})` };
    }
    if (jobFreelancer !== contract.freelancerWallet) {
      return { error: `Job PDA freelancer (${jobFreelancer}) does not match contract freelancer wallet (${contract.freelancerWallet})` };
    }
  }

  // Verify milestone.job points to expected job PDA
  if (milestoneState?.data) {
    const msJobPda = milestoneState.data.job.toBase58();
    if (msJobPda !== expectedJobPdaStr) {
      return { error: `Milestone PDA references job ${msJobPda}, expected ${expectedJobPdaStr}` };
    }
  }

  // Verify dispute.job points to expected job PDA
  if (disputeState?.data) {
    const dispJobPda = disputeState.data.job.toBase58();
    if (dispJobPda !== expectedJobPdaStr) {
      return { error: `Dispute PDA references job ${dispJobPda}, expected ${expectedJobPdaStr}` };
    }
  }

  return { valid: true };
}

// ────────────────────────────────────────────────────────────────────
// Ruling normalization (FIX #6)
// ────────────────────────────────────────────────────────────────────

/**
 * Normalize ruling values from on-chain deserialization to match
 * the MongoDB schema enum: 'none', 'client_wins', 'freelancer_wins', 'split'.
 * The deserializer already returns these values, but this is a safety net.
 */
const VALID_RULINGS = new Set(['none', 'client_wins', 'freelancer_wins', 'split']);

function normalizeRuling(ruling) {
  if (VALID_RULINGS.has(ruling)) return ruling;

  // Handle any potential casing mismatches
  const lower = String(ruling).toLowerCase();
  const mapping = {
    clientwins: 'client_wins',
    freelancerwins: 'freelancer_wins',
  };
  return mapping[lower] || 'none';
}

// ────────────────────────────────────────────────────────────────────
// Step 4: Per-action verification rules
// ────────────────────────────────────────────────────────────────────

/**
 * Action-specific verification. Each action has its own set of
 * post-conditions that must be true on-chain for the DB update to proceed.
 *
 * FIX #1: Every verifier now receives accountKeys and checks PDA binding.
 * FIX #2: resolve verifier checks on-chain arbitrator.
 * FIX #4: Every verifier validates account linkage.
 */
const ACTION_VERIFIERS = {
  /**
   * fund: client funds the escrow
   */
  async fund(ctx) {
    const { contract, signerKey } = ctx;

    if (signerKey !== contract.clientWallet) {
      return { error: `Signer ${signerKey} does not match client wallet ${contract.clientWallet}` };
    }

    const jobState = await readJobState(contract.clientWallet, contract.onChainJobId);
    if (!jobState.data) return { error: `Cannot read Job PDA: ${jobState.error}` };

    // FIX #4: account linkage
    const linkage = verifyAccountLinkage('fund', contract, { jobState });
    if (linkage.error) return linkage;

    if (jobState.data.status !== 'in_progress') {
      return { error: `Expected job status 'in_progress' after funding, got '${jobState.data.status}'` };
    }

    const vault = await readVaultBalance(contract.clientWallet, contract.onChainJobId);
    if (vault.lamports === 0) {
      return { error: 'Vault balance is 0 after fund — escrow was not funded' };
    }

    return {
      verified: true,
      onChainState: {
        jobStatus: jobState.data.status,
        escrowBalance: jobState.data.escrowBalance,
        vaultLamports: vault.lamports,
      },
    };
  },

  /**
   * submit: freelancer submits milestone work
   */
  async submit(ctx) {
    const { contract, signerKey, milestoneId } = ctx;

    if (signerKey !== contract.freelancerWallet) {
      return { error: `Signer ${signerKey} does not match freelancer wallet ${contract.freelancerWallet}` };
    }

    if (milestoneId === undefined || milestoneId === null) {
      return { error: 'milestoneId is required for submit action' };
    }

    const jobState = await readJobState(contract.clientWallet, contract.onChainJobId);
    if (!jobState.data) return { error: `Cannot read Job PDA: ${jobState.error}` };

    const msState = await readMilestoneState(contract.clientWallet, contract.onChainJobId, milestoneId);
    if (!msState.data) return { error: `Cannot read Milestone PDA: ${msState.error}` };

    // FIX #4: account linkage
    const linkage = verifyAccountLinkage('submit', contract, { jobState, milestoneState: msState });
    if (linkage.error) return linkage;

    if (msState.data.status !== 'submitted') {
      return { error: `Expected milestone status 'submitted', got '${msState.data.status}'` };
    }

    return {
      verified: true,
      milestoneId: msState.data.milestoneId,
      onChainState: {
        milestoneStatus: msState.data.status,
        submissionHash: msState.data.submissionHash,
      },
    };
  },

  /**
   * approve: client approves a submitted milestone
   */
  async approve(ctx) {
    const { contract, signerKey, milestoneId } = ctx;

    if (signerKey !== contract.clientWallet) {
      return { error: `Signer ${signerKey} does not match client wallet ${contract.clientWallet}` };
    }

    if (milestoneId === undefined || milestoneId === null) {
      return { error: 'milestoneId is required for approve action' };
    }

    const jobState = await readJobState(contract.clientWallet, contract.onChainJobId);
    if (!jobState.data) return { error: `Cannot read Job PDA: ${jobState.error}` };

    const msState = await readMilestoneState(contract.clientWallet, contract.onChainJobId, milestoneId);
    if (!msState.data) return { error: `Cannot read Milestone PDA: ${msState.error}` };

    // FIX #4: account linkage
    const linkage = verifyAccountLinkage('approve', contract, { jobState, milestoneState: msState });
    if (linkage.error) return linkage;

    if (msState.data.status !== 'approved') {
      return { error: `Expected milestone status 'approved', got '${msState.data.status}'` };
    }

    return {
      verified: true,
      milestoneId: msState.data.milestoneId,
      onChainState: { milestoneStatus: msState.data.status },
    };
  },

  /**
   * release: client releases payment for approved milestone
   */
  async release(ctx) {
    const { contract, signerKey, milestoneId } = ctx;

    if (signerKey !== contract.clientWallet) {
      return { error: `Signer ${signerKey} does not match client wallet ${contract.clientWallet}` };
    }

    if (milestoneId === undefined || milestoneId === null) {
      return { error: 'milestoneId is required for release action' };
    }

    const jobState = await readJobState(contract.clientWallet, contract.onChainJobId);
    if (!jobState.data) return { error: `Cannot read Job PDA: ${jobState.error}` };

    const msState = await readMilestoneState(contract.clientWallet, contract.onChainJobId, milestoneId);
    if (!msState.data) return { error: `Cannot read Milestone PDA: ${msState.error}` };

    // FIX #4: account linkage
    const linkage = verifyAccountLinkage('release', contract, { jobState, milestoneState: msState });
    if (linkage.error) return linkage;

    if (msState.data.status !== 'paid') {
      return { error: `Expected milestone status 'paid', got '${msState.data.status}'` };
    }

    return {
      verified: true,
      milestoneId: msState.data.milestoneId,
      onChainState: {
        milestoneStatus: msState.data.status,
        jobStatus: jobState.data.status,
        milestonesPaid: jobState.data.milestonesPaid,
        escrowBalance: jobState.data.escrowBalance,
      },
    };
  },

  /**
   * cancel: client cancels the job
   */
  async cancel(ctx) {
    const { contract, signerKey } = ctx;

    if (signerKey !== contract.clientWallet) {
      return { error: `Signer ${signerKey} does not match client wallet ${contract.clientWallet}` };
    }

    const jobState = await readJobState(contract.clientWallet, contract.onChainJobId);
    if (!jobState.data) return { error: `Cannot read Job PDA: ${jobState.error}` };

    // FIX #4: account linkage
    const linkage = verifyAccountLinkage('cancel', contract, { jobState });
    if (linkage.error) return linkage;

    if (jobState.data.status !== 'cancelled') {
      return { error: `Expected job status 'cancelled', got '${jobState.data.status}'` };
    }

    return {
      verified: true,
      onChainState: {
        jobStatus: jobState.data.status,
        escrowBalance: jobState.data.escrowBalance,
      },
    };
  },

  /**
   * dispute: open a dispute on a milestone
   */
  async dispute(ctx) {
    const { contract, signerKey } = ctx;

    const isClient = signerKey === contract.clientWallet;
    const isFreelancer = signerKey === contract.freelancerWallet;
    if (!isClient && !isFreelancer) {
      return { error: `Signer ${signerKey} is neither the client nor freelancer` };
    }

    const jobState = await readJobState(contract.clientWallet, contract.onChainJobId);
    if (!jobState.data) return { error: `Cannot read Job PDA: ${jobState.error}` };

    const disputeState = await readDisputeState(contract.clientWallet, contract.onChainJobId);
    if (!disputeState.data) return { error: `Cannot read Dispute PDA: ${disputeState.error}` };

    // FIX #4: account linkage
    const linkage = verifyAccountLinkage('dispute', contract, { jobState, disputeState });
    if (linkage.error) return linkage;

    if (disputeState.data.status !== 'open') {
      return { error: `Expected dispute status 'open', got '${disputeState.data.status}'` };
    }

    if (jobState.data.status !== 'disputed') {
      return { error: `Expected job status 'disputed', got '${jobState.data.status}'` };
    }

    return {
      verified: true,
      milestoneId: disputeState.data.milestoneId,
      onChainState: {
        disputeStatus: disputeState.data.status,
        disputeOpener: disputeState.data.opener.toBase58(),
        jobStatus: jobState.data.status,
      },
    };
  },

  /**
   * evidence: submit dispute evidence
   */
  async evidence(ctx) {
    const { contract, signerKey } = ctx;

    const isClient = signerKey === contract.clientWallet;
    const isFreelancer = signerKey === contract.freelancerWallet;
    if (!isClient && !isFreelancer) {
      return { error: `Signer ${signerKey} is neither the client nor freelancer` };
    }

    const jobState = await readJobState(contract.clientWallet, contract.onChainJobId);
    if (!jobState.data) return { error: `Cannot read Job PDA: ${jobState.error}` };

    const disputeState = await readDisputeState(contract.clientWallet, contract.onChainJobId);
    if (!disputeState.data) return { error: `Cannot read Dispute PDA: ${disputeState.error}` };

    // FIX #4: account linkage
    const linkage = verifyAccountLinkage('evidence', contract, { jobState, disputeState });
    if (linkage.error) return linkage;

    if (disputeState.data.status !== 'open') {
      return { error: `Expected dispute status 'open' for evidence submission, got '${disputeState.data.status}'` };
    }

    const evidenceField = isClient ? 'clientEvidence' : 'freelancerEvidence';
    if (!disputeState.data[evidenceField]) {
      return { error: `${isClient ? 'Client' : 'Freelancer'} evidence not found on-chain after tx` };
    }

    return {
      verified: true,
      onChainState: {
        disputeStatus: disputeState.data.status,
        clientEvidence: disputeState.data.clientEvidence,
        freelancerEvidence: disputeState.data.freelancerEvidence,
      },
    };
  },

  /**
   * resolve: arbitrator resolves the dispute
   * FIX #2: Verifies signer against on-chain PlatformConfig arbitrator
   */
  async resolve(ctx) {
    const { contract, signerKey } = ctx;

    // FIX #2: Read PlatformConfig and verify arbitrator signer
    const platformConfig = await readPlatformConfig();
    if (!platformConfig.data) {
      return { error: `Cannot read PlatformConfig PDA: ${platformConfig.error}` };
    }

    const onChainArbitrator = platformConfig.data.arbitrator.toBase58();
    if (signerKey !== onChainArbitrator) {
      return {
        error: `Signer ${signerKey} does not match on-chain arbitrator ${onChainArbitrator}`,
      };
    }

    const jobState = await readJobState(contract.clientWallet, contract.onChainJobId);
    if (!jobState.data) return { error: `Cannot read Job PDA: ${jobState.error}` };

    const disputeState = await readDisputeState(contract.clientWallet, contract.onChainJobId);
    if (!disputeState.data) return { error: `Cannot read Dispute PDA: ${disputeState.error}` };

    // FIX #4: account linkage
    const linkage = verifyAccountLinkage('resolve', contract, { jobState, disputeState });
    if (linkage.error) return linkage;

    if (disputeState.data.status !== 'resolved') {
      return { error: `Expected dispute status 'resolved', got '${disputeState.data.status}'` };
    }

    // FIX #6: Normalize ruling
    const ruling = normalizeRuling(disputeState.data.ruling);
    if (ruling === 'none') {
      return { error: 'Dispute was resolved but ruling is "none"' };
    }

    // Verify dispute milestone linkage
    const msState = await readMilestoneState(
      contract.clientWallet,
      contract.onChainJobId,
      disputeState.data.milestoneId
    );

    if (msState.data) {
      const msLinkage = verifyAccountLinkage('resolve', contract, {
        jobState,
        disputeState,
        milestoneState: msState,
      });
      if (msLinkage.error) return msLinkage;
    }

    return {
      verified: true,
      milestoneId: disputeState.data.milestoneId,
      onChainState: {
        disputeStatus: disputeState.data.status,
        ruling,
        splitClientBps: disputeState.data.splitClientBps,
        splitFreelancerBps: disputeState.data.splitFreelancerBps,
        jobStatus: jobState.data.status,
        milestoneStatus: msState.data?.status || 'unknown',
      },
    };
  },
};

// ────────────────────────────────────────────────────────────────────
// Main verification entry point
// ────────────────────────────────────────────────────────────────────

/**
 * Verify a transaction and return a normalized verification result.
 *
 * @param {string} signature - Transaction signature
 * @param {string} claimedAction - Action type claimed by the frontend
 * @param {object} contract - MongoDB contract document
 * @param {object} opts - { milestoneId }
 * @returns {Promise<VerificationResult>}
 */
async function verifyAndReconcile(signature, claimedAction, contract, opts = {}) {
  // ── Step 1: Fetch transaction ───────────────────────────────
  const { tx, error: fetchError } = await fetchTransaction(signature);
  if (fetchError) {
    return { verified: false, error: fetchError };
  }

  // ── Step 2: Find and decode the marketplace instruction ─────
  // FIX #5: rejects ambiguous txs with multiple marketplace instructions
  const parsed = parseMarketplaceInstruction(tx);
  if (parsed.error) {
    return { verified: false, error: parsed.error };
  }

  const { instructionName, signerKey } = parsed;

  // ── Step 3: Verify instruction matches claimed action ───────
  const expectedInstruction = ACTION_TO_INSTRUCTION[claimedAction];
  if (!expectedInstruction) {
    return { verified: false, error: `Unknown action type: '${claimedAction}'` };
  }

  if (instructionName !== expectedInstruction) {
    const actualAction = INSTRUCTION_TO_ACTION[instructionName] || instructionName;
    return {
      verified: false,
      error: `Instruction mismatch: frontend claimed '${claimedAction}' (expects ${expectedInstruction}), but transaction executed '${instructionName}' (${actualAction})`,
    };
  }

  const canonicalAction = INSTRUCTION_TO_ACTION[instructionName] || claimedAction;

  // ── Step 4: Validate contract context ───────────────────────
  if (!contract.clientWallet || !contract.freelancerWallet) {
    return { verified: false, error: 'Contract is missing wallet addresses' };
  }

  if (contract.onChainJobId === undefined || contract.onChainJobId === null) {
    return { verified: false, error: 'Contract is missing onChainJobId' };
  }

  // ── Step 5: Verify PDA binding (FIX #1) ─────────────────────
  const expectedPDAs = getExpectedPDAs(canonicalAction, contract, opts.milestoneId);
  const pdaCheck = verifyPDABinding(expectedPDAs, parsed.accountKeys);
  if (pdaCheck.error) {
    return { verified: false, error: pdaCheck.error };
  }

  // ── Step 6: Run action-specific verification ────────────────
  const verifier = ACTION_VERIFIERS[canonicalAction];
  if (!verifier) {
    return { verified: false, error: `No verification logic for action: '${canonicalAction}'` };
  }

  const verificationCtx = {
    contract,
    signerKey,
    milestoneId: opts.milestoneId,
    instructionData: parsed.instructionData,
    accountKeys: parsed.accountKeys,
  };

  try {
    const result = await verifier(verificationCtx);
    if (result.error) {
      return { verified: false, error: result.error };
    }

    return {
      verified: true,
      canonicalAction,
      signerWallet: signerKey,
      milestoneId: result.milestoneId !== undefined ? result.milestoneId : opts.milestoneId,
      onChainState: result.onChainState,
      slot: tx.slot,
    };
  } catch (err) {
    console.error(`Verification error for action '${canonicalAction}':`, err);
    return { verified: false, error: `Verification failed: ${err.message}` };
  }
}

module.exports = {
  verifyAndReconcile,
  fetchTransaction,
  parseMarketplaceInstruction,
  getExpectedPDAs,
  verifyPDABinding,
  verifyAccountLinkage,
  normalizeRuling,
  readJobState,
  readMilestoneState,
  readDisputeState,
  readVaultBalance,
  readPlatformConfig,
  ACTION_VERIFIERS,
};
