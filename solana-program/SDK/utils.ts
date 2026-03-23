import { Connection, PublicKey } from "@solana/web3.js";
import * as borsh from "@coral-xyz/borsh";

import {
  PlatformConfigState,
  JobState,
  MilestoneState,
  DisputeState,
  UserStatsState,
  JobStatus,
  MilestoneStatus,
  DisputeStatus,
  DisputeRuling,
} from "./types";

import {
  derivePlatformConfigPda,
  deriveJobPda,
  deriveMilestonePda,
  deriveDisputePda,
  deriveUserStatsPda,
  deriveVaultPda,
} from "./pdas";


const JOB_STATUS_MAP: JobStatus[] = [
  JobStatus.Created,     // 0
  JobStatus.Funded,      // 1
  JobStatus.InProgress,  // 2
  JobStatus.Completed,   // 3
  JobStatus.Disputed,    // 4
  JobStatus.Cancelled,   // 5
];

const MILESTONE_STATUS_MAP: MilestoneStatus[] = [
  MilestoneStatus.Pending,    // 0
  MilestoneStatus.Submitted,  // 1
  MilestoneStatus.Approved,   // 2
  MilestoneStatus.Paid,       // 3
];

const DISPUTE_STATUS_MAP: DisputeStatus[] = [
  DisputeStatus.Open,      // 0
  DisputeStatus.Resolved,  // 1
];

// =============== Account Decoders ===============

function decodeDisputeRuling(data: Buffer, offset: number): { ruling: DisputeRuling; bytesRead: number } {
  const variant = data.readUInt8(offset);
  switch (variant) {
    case 0: return { ruling: { __kind: "None" }, bytesRead: 1 };
    case 1: return { ruling: { __kind: "ClientWins" }, bytesRead: 1 };
    case 2: return { ruling: { __kind: "FreelancerWins" }, bytesRead: 1 };
    case 3: {
      const clientBps = data.readUInt16LE(offset + 1);
      const freelancerBps = data.readUInt16LE(offset + 3);
      return { ruling: { __kind: "Split", clientBps, freelancerBps }, bytesRead: 5 };
    }
    default: return { ruling: { __kind: "None" }, bytesRead: 1 };
  }
}

/**
 * Decode PlatformConfig account data
 */
export function decodePlatformConfig(data: Buffer): PlatformConfigState {
  const buf = data.slice(8);

  const layout = borsh.struct([
    borsh.publicKey("admin"),
    borsh.publicKey("treasury"),
    borsh.publicKey("arbitrator"),
    borsh.u16("feeBps"),
    borsh.u64("totalFeesCollected"),
    borsh.u8("bump"),
  ]);

  const decoded = layout.decode(buf);

  return {
    admin: decoded.admin,
    treasury: decoded.treasury,
    arbitrator: decoded.arbitrator,
    feeBps: decoded.feeBps,
    totalFeesCollected: decoded.totalFeesCollected,
    bump: decoded.bump,
  };
}

/**
 * Decode Job account data
 */
export function decodeJob(data: Buffer): JobState {
  const buf = data.slice(8);

  const layout = borsh.struct([
    borsh.u64("jobId"),
    borsh.publicKey("client"),
    borsh.publicKey("freelancer"),
    borsh.u64("totalAmount"),
    borsh.u64("escrowBalance"),
    borsh.u8("milestoneCount"),
    borsh.u8("milestonesPaid"),
    borsh.u8("milestonesApproved"),
    borsh.u8("status"),
    borsh.publicKey("tokenMint"),
    borsh.i64("createdAt"),
    borsh.u8("bump"),
    borsh.u8("vaultBump"),
  ]);

  const decoded = layout.decode(buf);

  return {
    jobId: decoded.jobId,
    client: decoded.client,
    freelancer: decoded.freelancer,
    totalAmount: decoded.totalAmount,
    escrowBalance: decoded.escrowBalance,
    milestoneCount: decoded.milestoneCount,
    milestonesPaid: decoded.milestonesPaid,
    milestonesApproved: decoded.milestonesApproved,
    status: JOB_STATUS_MAP[decoded.status] ?? JobStatus.Created,
    tokenMint: decoded.tokenMint,
    createdAt: decoded.createdAt,
    bump: decoded.bump,
    vaultBump: decoded.vaultBump,
  };
}

/**
 * Decode Milestone account data
 */
export function decodeMilestone(data: Buffer): MilestoneState {
  const buf = data.slice(8);

  const layout = borsh.struct([
    borsh.publicKey("job"),
    borsh.u8("milestoneId"),
    borsh.u64("amount"),
    borsh.u8("status"),
    borsh.str("descriptionHash"),
    borsh.str("submissionHash"),
    borsh.i64("submittedAt"),
    borsh.i64("approvedAt"),
    borsh.i64("paidAt"),
    borsh.u8("bump"),
  ]);

  const decoded = layout.decode(buf);

  return {
    job: decoded.job,
    milestoneId: decoded.milestoneId,
    amount: decoded.amount,
    status: MILESTONE_STATUS_MAP[decoded.status] ?? MilestoneStatus.Pending,
    descriptionHash: decoded.descriptionHash,
    submissionHash: decoded.submissionHash,
    submittedAt: decoded.submittedAt,
    approvedAt: decoded.approvedAt,
    paidAt: decoded.paidAt,
    bump: decoded.bump,
  };
}

/**
 * Decode Dispute account data
 */
export function decodeDispute(data: Buffer): DisputeState {
  const buf = data.slice(8);

  let offset = 0;

  const job = new PublicKey(buf.slice(offset, offset + 32));
  offset += 32;

  const opener = new PublicKey(buf.slice(offset, offset + 32));
  offset += 32;

  const milestoneId = buf.readUInt8(offset);
  offset += 1;

  const statusByte = buf.readUInt8(offset);
  const status = DISPUTE_STATUS_MAP[statusByte] ?? DisputeStatus.Open;
  offset += 1;

  const { ruling, bytesRead } = decodeDisputeRuling(buf, offset);
  offset += bytesRead;

  const clientEvidenceLen = buf.readUInt32LE(offset);
  offset += 4;
  const clientEvidence = buf.slice(offset, offset + clientEvidenceLen).toString("utf8");
  offset += clientEvidenceLen;

  const freelancerEvidenceLen = buf.readUInt32LE(offset);
  offset += 4;
  const freelancerEvidence = buf.slice(offset, offset + freelancerEvidenceLen).toString("utf8");
  offset += freelancerEvidenceLen;

  const openedAt = buf.readBigInt64LE(offset);
  offset += 8;

  const resolvedAt = buf.readBigInt64LE(offset);
  offset += 8;

  const bump = buf.readUInt8(offset);

  return {
    job,
    opener,
    milestoneId,
    status,
    ruling,
    clientEvidence,
    freelancerEvidence,
    openedAt,
    resolvedAt,
    bump,
  };
}

// =============== Fetch Helpers ===============

/**
 * Fetch and decode PlatformConfig
 */
export async function fetchPlatformConfig(
  connection: Connection,
  programId: PublicKey,
  commitment: "processed" | "confirmed" | "finalized" = "confirmed"
): Promise<PlatformConfigState | null> {
  const { pda } = derivePlatformConfigPda(programId);
  return fetchAccount(connection, pda, decodePlatformConfig, commitment);
}

/**
 * Fetch and decode Job
 */
export async function fetchJob(
  connection: Connection,
  programId: PublicKey,
  client: PublicKey,
  jobId: bigint,
  commitment: "processed" | "confirmed" | "finalized" = "confirmed"
): Promise<JobState | null> {
  const { pda } = deriveJobPda(programId, client, jobId);
  return fetchAccount(connection, pda, decodeJob, commitment);
}

/**
 * Fetch and decode Milestone
 */
export async function fetchMilestone(
  connection: Connection,
  programId: PublicKey,
  job: PublicKey,
  milestoneId: number,
  commitment: "processed" | "confirmed" | "finalized" = "confirmed"
): Promise<MilestoneState | null> {
  const { pda } = deriveMilestonePda(programId, job, milestoneId);
  return fetchAccount(connection, pda, decodeMilestone, commitment);
}

/**
 * Fetch and decode Dispute
 */
export async function fetchDispute(
  connection: Connection,
  programId: PublicKey,
  job: PublicKey,
  commitment: "processed" | "confirmed" | "finalized" = "confirmed"
): Promise<DisputeState | null> {
  const { pda } = deriveDisputePda(programId, job);
  return fetchAccount(connection, pda, decodeDispute, commitment);
}

/**
 * Generic account fetch helper
 */
async function fetchAccount<T>(
  connection: Connection,
  address: PublicKey,
  decoder: (data: Buffer) => T,
  commitment: "processed" | "confirmed" | "finalized"
): Promise<T | null> {
  const accountInfo = await connection.getAccountInfo(address, commitment);
  if (!accountInfo || !accountInfo.data || accountInfo.data.length === 0) {
    return null;
  }
  return decoder(accountInfo.data as Buffer);
}

// =============== Utility Functions ===============

/**
 * Convert lamports (bigint) → SOL (number)
 * NOTE: for UI only, do not use `number` for financial logic with huge values.
 */
export function lamportsToSol(lamports: bigint): number {
  const LAMPORTS_PER_SOL = 1_000_000_000n;
  return Number(lamports) / Number(LAMPORTS_PER_SOL);
}

/**
 * Convert SOL (number) → lamports (bigint)
 */
export function solToLamports(sol: number): bigint {
  const LAMPORTS_PER_SOL = 1_000_000_000n;
  return BigInt(Math.round(sol * 1_000_000_000));
}

/**
 * Calculate platform fee amount
 */
export function calculateFee(amount: bigint, feeBps: number): bigint {
  return (amount * BigInt(feeBps)) / 10000n;
}

/**
 * Calculate freelancer payment after fee
 */
export function calculateFreelancerPayment(amount: bigint, feeBps: number): bigint {
  const fee = calculateFee(amount, feeBps);
  return amount - fee;
}

/**
 * Format job status for display
 */
export function formatJobStatus(status: JobStatus): string {
  const statusLabels: Record<JobStatus, string> = {
    [JobStatus.Created]: "Created",
    [JobStatus.Funded]: "Funded",
    [JobStatus.InProgress]: "In Progress",
    [JobStatus.Completed]: "Completed",
    [JobStatus.Disputed]: "Disputed",
    [JobStatus.Cancelled]: "Cancelled",
  };
  return statusLabels[status] || status;
}

/**
 * Format milestone status for display
 */
export function formatMilestoneStatus(status: MilestoneStatus): string {
  const statusLabels: Record<MilestoneStatus, string> = {
    [MilestoneStatus.Pending]: "Pending",
    [MilestoneStatus.Submitted]: "Submitted for Review",
    [MilestoneStatus.Approved]: "Approved",
    [MilestoneStatus.Paid]: "Paid",
  };
  return statusLabels[status] || status;
}

/**
 * Format dispute status for display
 */
export function formatDisputeStatus(status: DisputeStatus): string {
  const statusLabels: Record<DisputeStatus, string> = {
    [DisputeStatus.Open]: "Open",
    [DisputeStatus.Resolved]: "Resolved",
  };
  return statusLabels[status] || status;
}

// =============== DEPRECATED UTILITIES ===============

/**
 * @deprecated Use fetchPlatformConfig instead
 */
export async function fetchEscrowByPda(
  connection: Connection,
  escrowPda: PublicKey,
  commitment: "processed" | "confirmed" | "finalized" = "confirmed"
): Promise<null> {
  throw new Error("Deprecated: Use fetchPlatformConfig or fetchJob for marketplace");
}

/**
 * @deprecated Use deriveJobPda instead
 */
export async function fetchEscrowByParties(
  connection: Connection,
  programId: PublicKey,
  initializer: PublicKey,
  freelancer: PublicKey,
  commitment: "processed" | "confirmed" | "finalized" = "confirmed"
): Promise<{ pda: PublicKey; state: null }> {
  throw new Error("Deprecated: Use deriveJobPda and fetchJob for marketplace");
}

/**
 * @deprecated Use lamportsToSol instead
 */
export function lamportsToSolDeprecated(lamports: bigint): number {
  return lamportsToSol(lamports);
}

/**
 * @deprecated Use solToLamports instead
 */
export function solToLamportsDeprecated(sol: number): bigint {
  return solToLamports(sol);
}
