import { PublicKey, Transaction } from "@solana/web3.js";

/**
 * -----------------------------------------------------
 *  Job Status Enum (mirror of Rust)
 * -----------------------------------------------------
 */
export enum JobStatus {
  Created = "Created",
  Funded = "Funded",
  InProgress = "InProgress",
  Completed = "Completed",
  Disputed = "Disputed",
  Cancelled = "Cancelled",
}

/**
 * -----------------------------------------------------
 *  Milestone Status Enum (mirror of Rust)
 * -----------------------------------------------------
 */
export enum MilestoneStatus {
  Pending = "Pending",
  Submitted = "Submitted",
  Approved = "Approved",
  Paid = "Paid",
}

/**
 * -----------------------------------------------------
 *  Dispute Status Enum (mirror of Rust)
 * -----------------------------------------------------
 */
export enum DisputeStatus {
  Open = "Open",
  Resolved = "Resolved",
}

/**
 * -----------------------------------------------------
 *  Dispute Ruling Enum (mirror of Rust)
 * -----------------------------------------------------
 */
export type DisputeRuling =
  | { __kind: "None" }
  | { __kind: "ClientWins" }
  | { __kind: "FreelancerWins" }
  | { __kind: "Split"; clientBps: number; freelancerBps: number };

export const DisputeRulingNone: DisputeRuling = { __kind: "None" };
export const DisputeRulingClientWins: DisputeRuling = { __kind: "ClientWins" };
export const DisputeRulingFreelancerWins: DisputeRuling = { __kind: "FreelancerWins" };

export function createDisputeRulingSplit(clientBps: number, freelancerBps: number): DisputeRuling {
  return { __kind: "Split", clientBps, freelancerBps };
}


export interface WalletSigner {
  publicKey: PublicKey;
  signTransaction(transaction: Transaction): Promise<Transaction>;
}

export type TransactionStatus =
  | { stage: "signing" }
  | { stage: "submitted"; txId: string }
  | { stage: "confirming"; txId: string }
  | { stage: "confirmed"; txId: string; slot: number }
  | { stage: "finalized"; txId: string; slot: number }
  | { stage: "error"; txId?: string; error: string };

export type OnTransactionStatus = (status: TransactionStatus) => void;

/**
 * -----------------------------------------------------
 *  Platform Config Account (mirror of Rust)
 * -----------------------------------------------------
 *
 * pub struct PlatformConfig {
 *     pub admin: Pubkey,
 *     pub treasury: Pubkey,
 *     pub arbitrator: Pubkey,
 *     pub fee_bps: u16,
 *     pub total_fees_collected: u64,
 *     pub bump: u8,
 * }
 */
export interface PlatformConfigState {
  admin: PublicKey;
  treasury: PublicKey;
  arbitrator: PublicKey;
  feeBps: number;
  totalFeesCollected: bigint;
  bump: number;
}

/**
 * -----------------------------------------------------
 *  Job Account (mirror of Rust)
 * -----------------------------------------------------
 *
 * pub struct Job {
 *     pub job_id: u64,
 *     pub client: Pubkey,
 *     pub freelancer: Pubkey,
 *     pub total_amount: u64,
 *     pub escrow_balance: u64,
 *     pub milestone_count: u8,
 *     pub milestones_paid: u8,
 *     pub milestones_approved: u8,
 *     pub status: JobStatus,
 *     pub token_mint: Pubkey,
 *     pub created_at: i64,
 *     pub bump: u8,
 *     pub vault_bump: u8,
 * }
 */
export interface JobState {
  jobId: bigint;
  client: PublicKey;
  freelancer: PublicKey;
  totalAmount: bigint;
  escrowBalance: bigint;
  milestoneCount: number;
  milestonesPaid: number;
  milestonesApproved: number;
  status: JobStatus;
  tokenMint: PublicKey;
  createdAt: bigint;
  bump: number;
  vaultBump: number;
}

/**
 * -----------------------------------------------------
 *  Milestone Account (mirror of Rust)
 * -----------------------------------------------------
 *
 * pub struct Milestone {
 *     pub job: Pubkey,
 *     pub milestone_id: u8,
 *     pub amount: u64,
 *     pub status: MilestoneStatus,
 *     pub description_hash: String,
 *     pub submission_hash: String,
 *     pub submitted_at: i64,
 *     pub approved_at: i64,
 *     pub paid_at: i64,
 *     pub bump: u8,
 * }
 */
export interface MilestoneState {
  job: PublicKey;
  milestoneId: number;
  amount: bigint;
  status: MilestoneStatus;
  descriptionHash: string;
  submissionHash: string;
  submittedAt: bigint;
  approvedAt: bigint;
  paidAt: bigint;
  bump: number;
}

/**
 * -----------------------------------------------------
 *  Dispute Account (mirror of Rust)
 * -----------------------------------------------------
 *
 * pub struct Dispute {
 *     pub job: Pubkey,
 *     pub opener: Pubkey,
 *     pub milestone_id: u8,
 *     pub status: DisputeStatus,
 *     pub ruling: DisputeRuling,
 *     pub client_evidence: String,
 *     pub freelancer_evidence: String,
 *     pub opened_at: i64,
 *     pub resolved_at: i64,
 *     pub bump: u8,
 * }
 */
export interface DisputeState {
  job: PublicKey;
  opener: PublicKey;
  milestoneId: number;
  status: DisputeStatus;
  ruling: DisputeRuling;
  clientEvidence: string;
  freelancerEvidence: string;
  openedAt: bigint;
  resolvedAt: bigint;
  bump: number;
}

/**
 * -----------------------------------------------------
 *  User Stats Account (mirror of Rust)
 * -----------------------------------------------------
 *
 * pub struct UserStats {
 *     pub user: Pubkey,
 *     pub jobs_as_client: u32,
 *     pub jobs_as_freelancer: u32,
 *     pub total_earned: u64,
 *     pub total_spent: u64,
 *     pub disputes_opened: u32,
 *     pub disputes_won: u32,
 *     pub bump: u8,
 * }
 */
export interface UserStatsState {
  user: PublicKey;
  jobsAsClient: number;
  jobsAsFreelancer: number;
  totalEarned: bigint;
  totalSpent: bigint;
  disputesOpened: number;
  disputesWon: number;
  bump: number;
}

/**
 * -----------------------------------------------------
 *  Instruction Arguments (for building TXs)
 * -----------------------------------------------------
 */

export interface InitializePlatformArgs {
  feeBps: number;
}

export interface CreateJobArgs {
  jobId: bigint;
  milestoneAmounts: bigint[];
  milestoneDescriptions: string[];
}

export interface CreateMilestoneArgs {
  milestoneId: number;
  amount: bigint;
  descriptionHash: string;
}

export interface SubmitMilestoneArgs {
  submissionHash: string;
}

export interface OpenDisputeArgs {
  milestoneId: number;
}

export interface SubmitDisputeEvidenceArgs {
  evidenceHash: string;
}

export interface ResolveDisputeArgs {
  ruling: DisputeRuling;
}

export interface SetPlatformFeeArgs {
  newFeeBps: number;
}

export interface WithdrawPlatformFeesArgs {
  amount: bigint;
}

/**
 * -----------------------------------------------------
 *  Error Codes (mirror of Rust FreelanceError)
 * -----------------------------------------------------
 */
export enum FreelanceErrorCode {
  UnauthorizedClient = "UnauthorizedClient",
  UnauthorizedFreelancer = "UnauthorizedFreelancer",
  UnauthorizedAdmin = "UnauthorizedAdmin",
  UnauthorizedArbitrator = "UnauthorizedArbitrator",
  InvalidJobStatus = "InvalidJobStatus",
  InvalidMilestoneStatus = "InvalidMilestoneStatus",
  InvalidMilestoneId = "InvalidMilestoneId",
  JobAlreadyFunded = "JobAlreadyFunded",
  JobNotDisputed = "JobNotDisputed",
  DisputeAlreadyResolved = "DisputeAlreadyResolved",
  ActiveDisputeExists = "ActiveDisputeExists",
  CannotCancelWithActiveDispute = "CannotCancelWithActiveDispute",
  CannotCancelWithApprovedMilestones = "CannotCancelWithApprovedMilestones",
  InsufficientFunds = "InsufficientFunds",
  Overflow = "Overflow",
  MaxMilestonesExceeded = "MaxMilestonesExceeded",
  FeeExceedsMaximum = "FeeExceedsMaximum",
  InvalidSplitPercentages = "InvalidSplitPercentages",
}

/**
 * Friendly runtime error used by the client SDK
 */
export class FreelanceClientError extends Error {
  constructor(
    readonly code: FreelanceErrorCode,
    readonly logs?: string[]
  ) {
    super(`Freelance Market Error: ${code}`);
  }
}

/**
 * -----------------------------------------------------
 *  Transaction Result
 * -----------------------------------------------------
 */
export interface FreelanceTxResult {
  txId: string;
  slot: number;
}

/**
 * -----------------------------------------------------
 *  Client Configuration
 * -----------------------------------------------------
 */
export interface FreelanceClientConfig {
  programId?: PublicKey;
  commitment?: "processed" | "confirmed" | "finalized";
  preflight?: "processed" | "confirmed" | "finalized";
  onStatus?: OnTransactionStatus;
  waitForFinalization?: boolean;
}

/**
 * -----------------------------------------------------
 *  OLD ESCROW TYPES (kept for backward compatibility)
 * -----------------------------------------------------
 */
export enum EscrowInstruction {
  InitializeSol = "InitializeSol",
  InitializeSolWithDeadline = "InitializeSolWithDeadline",
  InitializeToken = "InitializeToken",
  InitializeTokenWithDeadline = "InitializeTokenWithDeadline",
  Accept = "Accept",
  ReleaseSol = "ReleaseSol",
  ReleaseToken = "ReleaseToken",
  Cancel = "Cancel",
}

export interface EscrowAccountState {
  initializer: PublicKey;
  freelancer: PublicKey;
  tokenMint: PublicKey;
  amount: bigint;
  isTokenEscrow: boolean;
  isInitialized: boolean;
  isAccepted: boolean;
  deadlineUnixTimestamp: bigint;
}

export enum EscrowErrorCode {
  DeadlineNotReached = 0,
  DeadlinePassed = 1,
  NotAccepted = 2,
}

export class EscrowClientError extends Error {
  constructor(
    readonly code: EscrowErrorCode,
    readonly logs?: string[]
  ) {
    super(`Escrow Program Error: ${EscrowErrorCode[code]} (${code})`);
  }
}

export interface EscrowTxResult {
  txId: string;
  slot: number;
}

export interface EscrowClientConfig {
  programId?: PublicKey;
  commitment?: "processed" | "confirmed" | "finalized";
  preflight?: "processed" | "confirmed" | "finalized";
}
