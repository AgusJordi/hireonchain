/**
 * On-Chain Account Deserializers for sol-marketplace
 *
 * Manually deserializes Anchor account data using Borsh-compatible
 * parsing. This avoids pulling in the full @coral-xyz/anchor dependency
 * on the backend while still being able to read on-chain state.
 *
 * Layout reference: solana-program/programs/sol-marketplace/src/state.rs
 *
 * All Anchor accounts start with an 8-byte discriminator, followed by
 * the struct fields in declaration order.
 */

const { PublicKey } = require('@solana/web3.js');

// Anchor account discriminators (SHA256("account:<AccountName>")[0..8])
// These are different from instruction discriminators!
const ACCOUNT_DISCRIMINATORS = {
  Job: Buffer.from([
    // SHA256("account:Job")[0..8]
    // We compute these at require-time to guarantee correctness
  ]),
  Milestone: Buffer.from([]),
  Dispute: Buffer.from([]),
  PlatformConfig: Buffer.from([]),
};

// Pre-compute account discriminators using the same algorithm as Anchor
const crypto = require('crypto');
function accountDiscriminator(name) {
  const hash = crypto.createHash('sha256').update(`account:${name}`).digest();
  return hash.subarray(0, 8);
}

ACCOUNT_DISCRIMINATORS.Job = accountDiscriminator('Job');
ACCOUNT_DISCRIMINATORS.Milestone = accountDiscriminator('Milestone');
ACCOUNT_DISCRIMINATORS.Dispute = accountDiscriminator('Dispute');
ACCOUNT_DISCRIMINATORS.PlatformConfig = accountDiscriminator('PlatformConfig');

/**
 * Borsh reader helper — reads sequentially from a buffer
 */
class BorshReader {
  constructor(buffer) {
    this.buf = buffer;
    this.offset = 0;
  }

  readU8() {
    const val = this.buf.readUInt8(this.offset);
    this.offset += 1;
    return val;
  }

  readU16LE() {
    const val = this.buf.readUInt16LE(this.offset);
    this.offset += 2;
    return val;
  }

  readU64LE() {
    const lo = this.buf.readUInt32LE(this.offset);
    const hi = this.buf.readUInt32LE(this.offset + 4);
    this.offset += 8;
    // Return as Number for amounts < Number.MAX_SAFE_INTEGER, else BigInt
    const val = BigInt(hi) * 0x100000000n + BigInt(lo);
    return Number(val);
  }

  readI64LE() {
    const lo = this.buf.readUInt32LE(this.offset);
    const hi = this.buf.readInt32LE(this.offset + 4);
    this.offset += 8;
    return Number(BigInt(hi) * 0x100000000n + BigInt(lo));
  }

  readPubkey() {
    const bytes = this.buf.subarray(this.offset, this.offset + 32);
    this.offset += 32;
    return new PublicKey(bytes);
  }

  readString(maxLen) {
    // Borsh strings: 4-byte LE length prefix, then UTF-8 bytes
    const len = this.buf.readUInt32LE(this.offset);
    this.offset += 4;
    const str = this.buf.subarray(this.offset, this.offset + len).toString('utf8');
    this.offset += len;
    return str;
  }

  readBool() {
    return this.readU8() !== 0;
  }

  skipDiscriminator() {
    this.offset += 8;
    return this;
  }
}

/**
 * JobStatus enum (matches Rust ordering)
 */
const JOB_STATUS = ['created', 'funded', 'in_progress', 'completed', 'disputed', 'cancelled'];

/**
 * MilestoneStatus enum (matches Rust ordering)
 */
const MILESTONE_STATUS = ['pending', 'submitted', 'approved', 'paid'];

/**
 * DisputeStatus enum
 */
const DISPUTE_STATUS = ['open', 'resolved'];

/**
 * DisputeRuling enum
 */
const DISPUTE_RULING = ['none', 'client_wins', 'freelancer_wins', 'split'];

/**
 * Deserialize a Job account
 *
 * Rust struct layout:
 *   pub job_id: u64,
 *   pub client: Pubkey,
 *   pub freelancer: Pubkey,
 *   pub total_amount: u64,
 *   pub escrow_balance: u64,
 *   pub milestone_count: u8,
 *   pub milestones_paid: u8,
 *   pub milestones_approved: u8,
 *   pub status: JobStatus,       // u8 enum
 *   pub token_mint: Pubkey,
 *   pub created_at: i64,
 *   pub bump: u8,
 *   pub vault_bump: u8,
 */
function deserializeJob(data) {
  if (!data || data.length < 8) return null;

  const disc = data.subarray(0, 8);
  if (!disc.equals(ACCOUNT_DISCRIMINATORS.Job)) return null;

  const r = new BorshReader(data);
  r.skipDiscriminator();

  return {
    jobId: r.readU64LE(),
    client: r.readPubkey(),
    freelancer: r.readPubkey(),
    totalAmount: r.readU64LE(),
    escrowBalance: r.readU64LE(),
    milestoneCount: r.readU8(),
    milestonesPaid: r.readU8(),
    milestonesApproved: r.readU8(),
    status: JOB_STATUS[r.readU8()] || 'unknown',
    tokenMint: r.readPubkey(),
    createdAt: r.readI64LE(),
    bump: r.readU8(),
    vaultBump: r.readU8(),
  };
}

/**
 * Deserialize a Milestone account
 *
 * Rust struct layout:
 *   pub job: Pubkey,
 *   pub milestone_id: u8,
 *   pub amount: u64,
 *   pub status: MilestoneStatus,  // u8 enum
 *   pub description_hash: String, // max_len 64
 *   pub submission_hash: String,  // max_len 64
 *   pub submitted_at: i64,
 *   pub approved_at: i64,
 *   pub paid_at: i64,
 *   pub bump: u8,
 */
function deserializeMilestone(data) {
  if (!data || data.length < 8) return null;

  const disc = data.subarray(0, 8);
  if (!disc.equals(ACCOUNT_DISCRIMINATORS.Milestone)) return null;

  const r = new BorshReader(data);
  r.skipDiscriminator();

  return {
    job: r.readPubkey(),
    milestoneId: r.readU8(),
    amount: r.readU64LE(),
    status: MILESTONE_STATUS[r.readU8()] || 'unknown',
    descriptionHash: r.readString(),
    submissionHash: r.readString(),
    submittedAt: r.readI64LE(),
    approvedAt: r.readI64LE(),
    paidAt: r.readI64LE(),
    bump: r.readU8(),
  };
}

/**
 * Deserialize a Dispute account
 *
 * Rust struct layout:
 *   pub job: Pubkey,
 *   pub opener: Pubkey,
 *   pub milestone_id: u8,
 *   pub status: DisputeStatus,  // u8 enum
 *   pub ruling: DisputeRuling,  // Borsh enum (variant + optional fields)
 *   pub client_evidence: String,
 *   pub freelancer_evidence: String,
 *   pub opened_at: i64,
 *   pub resolved_at: i64,
 *   pub bump: u8,
 */
function deserializeDispute(data) {
  if (!data || data.length < 8) return null;

  const disc = data.subarray(0, 8);
  if (!disc.equals(ACCOUNT_DISCRIMINATORS.Dispute)) return null;

  const r = new BorshReader(data);
  r.skipDiscriminator();

  const job = r.readPubkey();
  const opener = r.readPubkey();
  const milestoneId = r.readU8();
  const statusIdx = r.readU8();

  // DisputeRuling is a Borsh enum: variant index, then optional fields
  const rulingVariant = r.readU8();
  let ruling = DISPUTE_RULING[rulingVariant] || 'none';
  let splitClientBps = 0;
  let splitFreelancerBps = 0;
  if (rulingVariant === 3) {
    // Split variant has two u16 fields
    splitClientBps = r.readU16LE();
    splitFreelancerBps = r.readU16LE();
  }

  return {
    job,
    opener,
    milestoneId,
    status: DISPUTE_STATUS[statusIdx] || 'unknown',
    ruling,
    splitClientBps,
    splitFreelancerBps,
    clientEvidence: r.readString(),
    freelancerEvidence: r.readString(),
    openedAt: r.readI64LE(),
    resolvedAt: r.readI64LE(),
    bump: r.readU8(),
  };
}

/**
 * Deserialize a PlatformConfig account
 *
 * Rust struct layout:
 *   pub admin: Pubkey,
 *   pub treasury: Pubkey,
 *   pub arbitrator: Pubkey,
 *   pub fee_bps: u16,
 *   pub total_fees_collected: u64,
 *   pub bump: u8,
 */
function deserializePlatformConfig(data) {
  if (!data || data.length < 8) return null;

  const disc = data.subarray(0, 8);
  if (!disc.equals(ACCOUNT_DISCRIMINATORS.PlatformConfig)) return null;

  const r = new BorshReader(data);
  r.skipDiscriminator();

  return {
    admin: r.readPubkey(),
    treasury: r.readPubkey(),
    arbitrator: r.readPubkey(),
    feeBps: r.readU16LE(),
    totalFeesCollected: r.readU64LE(),
    bump: r.readU8(),
  };
}

module.exports = {
  ACCOUNT_DISCRIMINATORS,
  JOB_STATUS,
  MILESTONE_STATUS,
  DISPUTE_STATUS,
  DISPUTE_RULING,
  deserializeJob,
  deserializeMilestone,
  deserializeDispute,
  deserializePlatformConfig,
  BorshReader,
};
