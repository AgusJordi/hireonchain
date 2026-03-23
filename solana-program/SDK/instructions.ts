import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import * as borsh from "@coral-xyz/borsh";
import BN from "bn.js";

import {
  InitializePlatformArgs,
  CreateJobArgs,
  CreateMilestoneArgs,
  SubmitMilestoneArgs,
  OpenDisputeArgs,
  SubmitDisputeEvidenceArgs,
  ResolveDisputeArgs,
  SetPlatformFeeArgs,
  WithdrawPlatformFeesArgs,
  DisputeRuling,
} from "./types";

import {
  derivePlatformConfigPda,
  deriveJobPda,
  deriveMilestonePda,
  deriveDisputePda,
  deriveVaultPda,
} from "./pdas";

// Program ID - loaded from environment variable via programId module
import { PROGRAM_ID } from "./programId";
export { PROGRAM_ID };

const DISCRIMINATORS = {
  initialize_platform: Buffer.from([119, 201, 101, 45, 75, 122, 89, 3]),
  create_job: Buffer.from([178, 130, 217, 110, 100, 27, 82, 119]),
  create_milestone: Buffer.from([239, 58, 201, 28, 40, 186, 173, 48]),
  fund_escrow: Buffer.from([155, 18, 218, 141, 182, 213, 69, 201]),
  submit_milestone: Buffer.from([35, 96, 220, 215, 102, 83, 139, 52]),
  approve_milestone: Buffer.from([145, 85, 92, 60, 50, 130, 219, 106]),
  release_milestone: Buffer.from([56, 2, 199, 164, 184, 108, 167, 222]),
  cancel_job: Buffer.from([126, 241, 155, 241, 50, 236, 83, 118]),
  open_dispute: Buffer.from([137, 25, 99, 119, 23, 223, 161, 42]),
  submit_dispute_evidence: Buffer.from([177, 174, 100, 125, 106, 213, 241, 22]),
  resolve_dispute: Buffer.from([231, 6, 202, 6, 96, 103, 12, 230]),
  set_platform_fee: Buffer.from([19, 70, 111, 182, 156, 58, 208, 203]),
  withdraw_platform_fees: Buffer.from([87, 24, 138, 122, 62, 146, 186, 199]),
} as const;

// =============== Borsh Schemas for Instruction Data ===============

// InitializePlatform: fee_bps (u16)
const InitializePlatformSchema = borsh.struct([
  borsh.u16("feeBps"),
]);

// CreateJob: job_id (u64), milestone_amounts (Vec<u64>), milestone_descriptions (Vec<String>)
const CreateJobSchema = borsh.struct([
  borsh.u64("jobId"),
  borsh.vec(borsh.u64(), "milestoneAmounts"),
  borsh.vec(borsh.str(), "milestoneDescriptions"),
]);

// CreateMilestone: milestone_id (u8), amount (u64), description_hash (String)
const CreateMilestoneSchema = borsh.struct([
  borsh.u8("milestoneId"),
  borsh.u64("amount"),
  borsh.str("descriptionHash"),
]);

// SubmitMilestone: submission_hash (String)
const SubmitMilestoneSchema = borsh.struct([
  borsh.str("submissionHash"),
]);

// OpenDispute: milestone_id (u8)
const OpenDisputeSchema = borsh.struct([
  borsh.u8("milestoneId"),
]);

// SubmitDisputeEvidence: evidence_hash (String)
const SubmitDisputeEvidenceSchema = borsh.struct([
  borsh.str("evidenceHash"),
]);

// SetPlatformFee: new_fee_bps (u16)
const SetPlatformFeeSchema = borsh.struct([
  borsh.u16("newFeeBps"),
]);

// WithdrawPlatformFees: amount (u64)
const WithdrawPlatformFeesSchema = borsh.struct([
  borsh.u64("amount"),
]);

// =============== Helper Functions ===============

function toBN(value: bigint): BN {
  return new BN(value.toString());
}

function encodeWithDiscriminator<T>(
  discriminator: Buffer,
  schema: any,
  data: T
): Buffer {
  const argsBuf = Buffer.alloc(1000);
  const len = schema.encode(data, argsBuf);
  return Buffer.concat([discriminator, argsBuf.slice(0, len)]);
}


function encodeDisputeRuling(ruling: DisputeRuling): Buffer {
  if (ruling.__kind === "None") {
    return Buffer.from([0]);
  }
  if (ruling.__kind === "ClientWins") {
    return Buffer.from([1]);
  }
  if (ruling.__kind === "FreelancerWins") {
    return Buffer.from([2]);
  }
  if (ruling.__kind === "Split") {
    const buf = Buffer.alloc(5);
    buf.writeUInt8(3, 0);
    buf.writeUInt16LE(ruling.clientBps, 1);
    buf.writeUInt16LE(ruling.freelancerBps, 3);
    return buf;
  }
  return Buffer.from([0]);
}

// =============== Instruction Builders ===============

/**
 * Initialize Platform
 * 
 * Accounts:
 * - admin (signer, mutable)
 * - platform_config (PDA, mutable)
 * - treasury (unchecked)
 * - arbitrator (unchecked)
 * - system_program
 */
export function ixInitializePlatform(
  admin: PublicKey,
  treasury: PublicKey,
  arbitrator: PublicKey,
  feeBps: number,
  programId: PublicKey = PROGRAM_ID
): TransactionInstruction {
  const { pda: platformConfigPda } = derivePlatformConfigPda(programId);

  const data = encodeWithDiscriminator(DISCRIMINATORS.initialize_platform, InitializePlatformSchema, { feeBps });

  const keys = [
    { pubkey: admin, isSigner: true, isWritable: true },
    { pubkey: platformConfigPda, isSigner: false, isWritable: true },
    { pubkey: treasury, isSigner: false, isWritable: false },
    { pubkey: arbitrator, isSigner: false, isWritable: false },
    { pubkey: PublicKey.default, isSigner: false, isWritable: false }, // system_program
  ];

  return new TransactionInstruction({
    programId,
    keys,
    data,
  });
}

/**
 * Create Job
 * 
 * Accounts:
 * - client (signer, mutable)
 * - freelancer (unchecked)
 * - job (PDA, mutable)
 * - vault (PDA)
 * - token_mint (unchecked)
 * - system_program
 */
export function ixCreateJob(
  client: PublicKey,
  freelancer: PublicKey,
  jobId: bigint,
  milestoneAmounts: bigint[],
  milestoneDescriptions: string[],
  tokenMint: PublicKey,
  programId: PublicKey = PROGRAM_ID
): TransactionInstruction {
  const { pda: jobPda } = deriveJobPda(programId, client, jobId);
  const { pda: vaultPda } = deriveVaultPda(programId, jobPda);

  const data = encodeWithDiscriminator(DISCRIMINATORS.create_job, CreateJobSchema, {
    jobId: toBN(jobId),
    milestoneAmounts: milestoneAmounts.map(toBN),
    milestoneDescriptions,
  });

  const keys = [
    { pubkey: client, isSigner: true, isWritable: true },
    { pubkey: freelancer, isSigner: false, isWritable: false },
    { pubkey: jobPda, isSigner: false, isWritable: true },
    { pubkey: vaultPda, isSigner: false, isWritable: true },
    { pubkey: tokenMint, isSigner: false, isWritable: false },
    { pubkey: PublicKey.default, isSigner: false, isWritable: false }, // system_program
  ];

  return new TransactionInstruction({
    programId,
    keys,
    data,
  });
}

/**
 * Create Milestone
 * 
 * Accounts:
 * - client (signer, mutable)
 * - job (mutable, constraint: job.client == client)
 * - milestone (PDA, mutable)
 * - system_program
 */
export function ixCreateMilestone(
  client: PublicKey,
  jobClient: PublicKey,
  jobId: bigint,
  milestoneId: number,
  amount: bigint,
  descriptionHash: string,
  programId: PublicKey = PROGRAM_ID
): TransactionInstruction {
  const { pda: jobPda } = deriveJobPda(programId, jobClient, jobId);
  const { pda: milestonePda } = deriveMilestonePda(programId, jobPda, milestoneId);

  const data = encodeWithDiscriminator(DISCRIMINATORS.create_milestone, CreateMilestoneSchema, {
    milestoneId,
    amount: toBN(amount),
    descriptionHash,
  });

  const keys = [
    { pubkey: client, isSigner: true, isWritable: true },
    { pubkey: jobPda, isSigner: false, isWritable: true },
    { pubkey: milestonePda, isSigner: false, isWritable: true },
    { pubkey: PublicKey.default, isSigner: false, isWritable: false }, // system_program
  ];

  return new TransactionInstruction({
    programId,
    keys,
    data,
  });
}

/**
 * Fund Escrow
 * 
 * Accounts:
 * - client (signer, mutable)
 * - job (mutable)
 * - vault (PDA, mutable)
 * - system_program
 */
export function ixFundEscrow(
  client: PublicKey,
  jobClient: PublicKey,
  jobId: bigint,
  programId: PublicKey = PROGRAM_ID
): TransactionInstruction {
  const { pda: jobPda } = deriveJobPda(programId, jobClient, jobId);
  const { pda: vaultPda } = deriveVaultPda(programId, jobPda);

  // FundEscrow has no args, just the 8-byte discriminator
  const data = DISCRIMINATORS.fund_escrow;

  const keys = [
    { pubkey: client, isSigner: true, isWritable: true },
    { pubkey: jobPda, isSigner: false, isWritable: true },
    { pubkey: vaultPda, isSigner: false, isWritable: true },
    { pubkey: PublicKey.default, isSigner: false, isWritable: false }, // system_program
  ];

  return new TransactionInstruction({
    programId,
    keys,
    data,
  });
}

/**
 * Submit Milestone
 * 
 * Accounts:
 * - freelancer (signer)
 * - job (mutable)
 * - milestone (mutable)
 */
export function ixSubmitMilestone(
  freelancer: PublicKey,
  jobClient: PublicKey,
  jobId: bigint,
  milestoneId: number,
  submissionHash: string,
  programId: PublicKey = PROGRAM_ID
): TransactionInstruction {
  const { pda: jobPda } = deriveJobPda(programId, jobClient, jobId);
  const { pda: milestonePda } = deriveMilestonePda(programId, jobPda, milestoneId);

  const data = encodeWithDiscriminator(DISCRIMINATORS.submit_milestone, SubmitMilestoneSchema, { submissionHash });

  const keys = [
    { pubkey: freelancer, isSigner: true, isWritable: false },
    { pubkey: jobPda, isSigner: false, isWritable: true },
    { pubkey: milestonePda, isSigner: false, isWritable: true },
  ];

  return new TransactionInstruction({
    programId,
    keys,
    data,
  });
}

/**
 * Approve Milestone
 * 
 * Accounts:
 * - client (signer)
 * - job (mutable)
 * - milestone (mutable)
 */
export function ixApproveMilestone(
  client: PublicKey,
  jobClient: PublicKey,
  jobId: bigint,
  milestoneId: number,
  programId: PublicKey = PROGRAM_ID
): TransactionInstruction {
  const { pda: jobPda } = deriveJobPda(programId, jobClient, jobId);
  const { pda: milestonePda } = deriveMilestonePda(programId, jobPda, milestoneId);

  // ApproveMilestone has no args, just the 8-byte discriminator
  const data = DISCRIMINATORS.approve_milestone;

  const keys = [
    { pubkey: client, isSigner: true, isWritable: false },
    { pubkey: jobPda, isSigner: false, isWritable: true },
    { pubkey: milestonePda, isSigner: false, isWritable: true },
  ];

  return new TransactionInstruction({
    programId,
    keys,
    data,
  });
}

/**
 * Release Milestone
 * 
 * Accounts:
 * - client (signer)
 * - platform_config (mutable)
 * - job (mutable)
 * - milestone (mutable)
 * - vault (PDA, mutable)
 * - freelancer (unchecked, mutable)
 * - treasury (unchecked, mutable)
 * - system_program
 */
export function ixReleaseMilestone(
  client: PublicKey,
  jobClient: PublicKey,
  jobId: bigint,
  milestoneId: number,
  freelancer: PublicKey,
  treasury: PublicKey,
  programId: PublicKey = PROGRAM_ID
): TransactionInstruction {
  const { pda: jobPda } = deriveJobPda(programId, jobClient, jobId);
  const { pda: milestonePda } = deriveMilestonePda(programId, jobPda, milestoneId);
  const { pda: vaultPda } = deriveVaultPda(programId, jobPda);
  const { pda: platformConfigPda } = derivePlatformConfigPda(programId);

  // ReleaseMilestone has no args, just the 8-byte discriminator
  const data = DISCRIMINATORS.release_milestone;

  const keys = [
    { pubkey: client, isSigner: true, isWritable: false },
    { pubkey: platformConfigPda, isSigner: false, isWritable: true },
    { pubkey: jobPda, isSigner: false, isWritable: true },
    { pubkey: milestonePda, isSigner: false, isWritable: true },
    { pubkey: vaultPda, isSigner: false, isWritable: true },
    { pubkey: freelancer, isSigner: false, isWritable: true },
    { pubkey: treasury, isSigner: false, isWritable: true },
    { pubkey: PublicKey.default, isSigner: false, isWritable: false }, // system_program
  ];

  return new TransactionInstruction({
    programId,
    keys,
    data,
  });
}

/**
 * Cancel Job
 * 
 * Accounts:
 * - client (signer, mutable)
 * - job (mutable)
 * - vault (PDA, mutable)
 * - system_program
 */
export function ixCancelJob(
  client: PublicKey,
  jobClient: PublicKey,
  jobId: bigint,
  programId: PublicKey = PROGRAM_ID
): TransactionInstruction {
  const { pda: jobPda } = deriveJobPda(programId, jobClient, jobId);
  const { pda: vaultPda } = deriveVaultPda(programId, jobPda);

  // CancelJob has no args, just the 8-byte discriminator
  const data = DISCRIMINATORS.cancel_job;

  const keys = [
    { pubkey: client, isSigner: true, isWritable: true },
    { pubkey: jobPda, isSigner: false, isWritable: true },
    { pubkey: vaultPda, isSigner: false, isWritable: true },
    { pubkey: PublicKey.default, isSigner: false, isWritable: false }, // system_program
  ];

  return new TransactionInstruction({
    programId,
    keys,
    data,
  });
}

/**
 * Open Dispute
 * 
 * Accounts:
 * - opener (signer, mutable)
 * - platform_config
 * - job (mutable)
 * - dispute (PDA, mutable)
 * - system_program
 */
export function ixOpenDispute(
  opener: PublicKey,
  jobClient: PublicKey,
  jobId: bigint,
  milestoneId: number,
  programId: PublicKey = PROGRAM_ID
): TransactionInstruction {
  const { pda: jobPda } = deriveJobPda(programId, jobClient, jobId);
  const { pda: disputePda } = deriveDisputePda(programId, jobPda);
  const { pda: platformConfigPda } = derivePlatformConfigPda(programId);

  const data = encodeWithDiscriminator(DISCRIMINATORS.open_dispute, OpenDisputeSchema, { milestoneId });

  const keys = [
    { pubkey: opener, isSigner: true, isWritable: true },
    { pubkey: platformConfigPda, isSigner: false, isWritable: false },
    { pubkey: jobPda, isSigner: false, isWritable: true },
    { pubkey: disputePda, isSigner: false, isWritable: true },
    { pubkey: PublicKey.default, isSigner: false, isWritable: false }, // system_program
  ];

  return new TransactionInstruction({
    programId,
    keys,
    data,
  });
}

/**
 * Submit Dispute Evidence
 * 
 * Accounts:
 * - submitter (signer)
 * - job
 * - dispute (mutable)
 */
export function ixSubmitDisputeEvidence(
  submitter: PublicKey,
  jobClient: PublicKey,
  jobId: bigint,
  evidenceHash: string,
  programId: PublicKey = PROGRAM_ID
): TransactionInstruction {
  const { pda: jobPda } = deriveJobPda(programId, jobClient, jobId);
  const { pda: disputePda } = deriveDisputePda(programId, jobPda);

  const data = encodeWithDiscriminator(DISCRIMINATORS.submit_dispute_evidence, SubmitDisputeEvidenceSchema, { evidenceHash });

  const keys = [
    { pubkey: submitter, isSigner: true, isWritable: false },
    { pubkey: jobPda, isSigner: false, isWritable: false },
    { pubkey: disputePda, isSigner: false, isWritable: true },
  ];

  return new TransactionInstruction({
    programId,
    keys,
    data,
  });
}

/**
 * Resolve Dispute
 * 
 * Accounts:
 * - arbitrator (signer)
 * - platform_config
 * - job (mutable)
 * - dispute (mutable)
 * - milestone (mutable)
 * - vault (PDA, mutable)
 * - client (unchecked, mutable)
 * - freelancer (unchecked, mutable)
 * - system_program
 */
export function ixResolveDispute(
  arbitrator: PublicKey,
  jobClient: PublicKey,
  jobId: bigint,
  milestoneId: number,
  ruling: DisputeRuling,
  client: PublicKey,
  freelancer: PublicKey,
  programId: PublicKey = PROGRAM_ID
): TransactionInstruction {
  const { pda: jobPda } = deriveJobPda(programId, jobClient, jobId);
  const { pda: milestonePda } = deriveMilestonePda(programId, jobPda, milestoneId);
  const { pda: disputePda } = deriveDisputePda(programId, jobPda);
  const { pda: vaultPda } = deriveVaultPda(programId, jobPda);
  const { pda: platformConfigPda } = derivePlatformConfigPda(programId);

  // Encode ruling as proper Borsh enum (variant index + optional fields)
  const data = Buffer.concat([
    DISCRIMINATORS.resolve_dispute,
    encodeDisputeRuling(ruling),
  ]);

  const keys = [
    { pubkey: arbitrator, isSigner: true, isWritable: false },
    { pubkey: platformConfigPda, isSigner: false, isWritable: false },
    { pubkey: jobPda, isSigner: false, isWritable: true },
    { pubkey: disputePda, isSigner: false, isWritable: true },
    { pubkey: milestonePda, isSigner: false, isWritable: true },
    { pubkey: vaultPda, isSigner: false, isWritable: true },
    { pubkey: client, isSigner: false, isWritable: true },
    { pubkey: freelancer, isSigner: false, isWritable: true },
    { pubkey: PublicKey.default, isSigner: false, isWritable: false }, // system_program
  ];

  return new TransactionInstruction({
    programId,
    keys,
    data,
  });
}

/**
 * Set Platform Fee
 * 
 * Accounts:
 * - admin (signer)
 * - platform_config (mutable)
 */
export function ixSetPlatformFee(
  admin: PublicKey,
  newFeeBps: number,
  programId: PublicKey = PROGRAM_ID
): TransactionInstruction {
  const { pda: platformConfigPda } = derivePlatformConfigPda(programId);

  const data = encodeWithDiscriminator(DISCRIMINATORS.set_platform_fee, SetPlatformFeeSchema, { newFeeBps });

  const keys = [
    { pubkey: admin, isSigner: true, isWritable: false },
    { pubkey: platformConfigPda, isSigner: false, isWritable: true },
  ];

  return new TransactionInstruction({
    programId,
    keys,
    data,
  });
}

/**
 * Withdraw Platform Fees
 * 
 * Accounts:
 * - admin (signer)
 * - platform_config
 * - treasury (unchecked, mutable)
 * - recipient (unchecked, mutable)
 * - system_program
 */
export function ixWithdrawPlatformFees(
  admin: PublicKey,
  amount: bigint,
  recipient: PublicKey,
  treasury: PublicKey,
  programId: PublicKey = PROGRAM_ID
): TransactionInstruction {
  const { pda: platformConfigPda } = derivePlatformConfigPda(programId);

  const data = encodeWithDiscriminator(DISCRIMINATORS.withdraw_platform_fees, WithdrawPlatformFeesSchema, { amount: toBN(amount) });

  const keys = [
    { pubkey: admin, isSigner: true, isWritable: false },
    { pubkey: platformConfigPda, isSigner: false, isWritable: false },
    { pubkey: treasury, isSigner: false, isWritable: true },
    { pubkey: recipient, isSigner: false, isWritable: true },
    { pubkey: PublicKey.default, isSigner: false, isWritable: false }, // system_program
  ];

  return new TransactionInstruction({
    programId,
    keys,
    data,
  });
}

// =============== DEPRECATED ESCROW INSTRUCTIONS ===============
// These are kept for backward compatibility but should not be used

export function ixInitializeSol(
  programId: PublicKey,
  initializer: PublicKey,
  freelancer: PublicKey,
  amount: bigint
): TransactionInstruction {
  throw new Error("Deprecated: Use ixCreateJob for marketplace");
}

export function ixInitializeSolWithDeadline(
  programId: PublicKey,
  initializer: PublicKey,
  freelancer: PublicKey,
  amount: bigint,
  deadlineUnixTimestamp: bigint
): TransactionInstruction {
  throw new Error("Deprecated: Use ixCreateJob for marketplace");
}

export function ixInitializeToken(
  programId: PublicKey,
  initializer: PublicKey,
  freelancer: PublicKey,
  tokenMint: PublicKey,
  initTokenAta: PublicKey,
  amount: bigint
): TransactionInstruction {
  throw new Error("Deprecated: Use ixCreateJob for marketplace");
}

export function ixInitializeTokenWithDeadline(
  programId: PublicKey,
  initializer: PublicKey,
  freelancer: PublicKey,
  tokenMint: PublicKey,
  initTokenAta: PublicKey,
  amount: bigint,
  deadlineUnixTimestamp: bigint
): TransactionInstruction {
  throw new Error("Deprecated: Use ixCreateJob for marketplace");
}

export function ixAccept(
  programId: PublicKey,
  freelancer: PublicKey,
  initializer: PublicKey
): TransactionInstruction {
  throw new Error("Deprecated: Not used in marketplace");
}

export function ixReleaseSol(
  programId: PublicKey,
  initializer: PublicKey,
  freelancer: PublicKey
): TransactionInstruction {
  throw new Error("Deprecated: Use ixReleaseMilestone for marketplace");
}

export function ixReleaseToken(
  programId: PublicKey,
  initializer: PublicKey,
  freelancer: PublicKey,
  tokenMint: PublicKey,
  freelancerTokenAta: PublicKey
): TransactionInstruction {
  throw new Error("Deprecated: Use ixReleaseMilestone for marketplace");
}

export function ixCancel(
  programId: PublicKey,
  initializer: PublicKey,
  freelancer: PublicKey,
  maybeTokenMint?: PublicKey,
  maybeInitializerTokenAta?: PublicKey
): TransactionInstruction {
  throw new Error("Deprecated: Use ixCancelJob for marketplace");
}
