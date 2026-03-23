/**
 * Freelance Marketplace SDK
 *
 * This SDK provides TypeScript/JavaScript bindings for the 
 * Freelance Marketplace Solana program.
 *
 * Usage:
 * ```typescript
 * import { FreelanceClient, PROGRAM_ID } from "./SDK";
 *
 * const client = new FreelanceClient(connection, PROGRAM_ID);
 * await client.createJob(payer, clientPubkey, freelancerPubkey, jobId, amounts, descriptions);
 * ```
 */

// =============== Program ID ===============

export { PROGRAM_ID, ESCROW_PROGRAM_ID, getProgramId } from "./programId";


// =============== Core Client ===============

export { FreelanceClient } from "./client";

/**
 * @deprecated Use FreelanceClient instead
 */
export { EscrowClient } from "./client";


// =============== Instructions ===============

export {
  // Platform instructions
  ixInitializePlatform,
  ixSetPlatformFee,
  ixWithdrawPlatformFees,

  // Job instructions
  ixCreateJob,
  ixCreateMilestone,
  ixFundEscrow,
  ixCancelJob,

  // Milestone instructions
  ixSubmitMilestone,
  ixApproveMilestone,
  ixReleaseMilestone,

  // Dispute instructions
  ixOpenDispute,
  ixSubmitDisputeEvidence,
  ixResolveDispute,
} from "./instructions";


// =============== PDA Derivation ===============

export {
  // New marketplace PDAs
  derivePlatformConfigPda,
  deriveJobPda,
  deriveMilestonePda,
  deriveDisputePda,
  deriveUserStatsPda,
  deriveVaultPda,

  // Legacy (deprecated)
  deriveEscrowPda,
  deriveEscrowTokenAta,
  deriveInitializerTokenAta,
  deriveFreelancerTokenAta,
} from "./pdas";


// =============== Types & Errors ===============

export {
  // Enums
  JobStatus,
  MilestoneStatus,
  DisputeStatus,

  DisputeRulingNone,
  DisputeRulingClientWins,
  DisputeRulingFreelancerWins,
  createDisputeRulingSplit,

  FreelanceErrorCode,
  FreelanceClientError,

  // Legacy enums & classes (deprecated)
  EscrowInstruction,
  EscrowErrorCode,
  EscrowClientError,
} from "./types";

// Type-only exports (erased at runtime — must use `export type`)
export type {
  // Dispute ruling type
  DisputeRuling,

  // Account state types
  PlatformConfigState,
  JobState,
  MilestoneState,
  DisputeState,
  UserStatsState,

  // Instruction argument types
  InitializePlatformArgs,
  CreateJobArgs,
  CreateMilestoneArgs,
  SubmitMilestoneArgs,
  OpenDisputeArgs,
  SubmitDisputeEvidenceArgs,
  ResolveDisputeArgs,
  SetPlatformFeeArgs,
  WithdrawPlatformFeesArgs,

  // Wallet & transaction types
  WalletSigner,
  TransactionStatus,
  OnTransactionStatus,
  FreelanceTxResult,
  FreelanceClientConfig,

  // Legacy types (deprecated)
  EscrowAccountState,
  EscrowTxResult,
  EscrowClientConfig,
} from "./types";


// =============== Utilities ===============

export {
  // Account decoders
  decodePlatformConfig,
  decodeJob,
  decodeMilestone,
  decodeDispute,

  // Fetch helpers
  fetchPlatformConfig,
  fetchJob,
  fetchMilestone,
  fetchDispute,

  // Utility functions
  lamportsToSol,
  solToLamports,
  calculateFee,
  calculateFreelancerPayment,
  formatJobStatus,
  formatMilestoneStatus,
  formatDisputeStatus,

  // Legacy utilities (deprecated)
  fetchEscrowByPda,
  fetchEscrowByParties,
  lamportsToSolDeprecated,
  solToLamportsDeprecated,
} from "./utils";


// =============== Default Export ===============

import { FreelanceClient } from "./client";
import { PROGRAM_ID } from "./programId";

export default {
  FreelanceClient,
  PROGRAM_ID,
};
