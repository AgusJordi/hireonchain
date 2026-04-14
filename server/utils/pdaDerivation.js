const { PublicKey } = require('@solana/web3.js');

/**
 * PDA Derivation Utilities for sol-marketplace
 *
 * Seeds match the Rust program exactly (state.rs → seeds module):
 *   PLATFORM_CONFIG: [b"platform_config"]
 *   JOB:             [b"job", client.as_ref(), job_id.to_le_bytes()]
 *   MILESTONE:       [b"milestone", job.key().as_ref(), &[milestone_id]]
 *   DISPUTE:         [b"dispute", job.key().as_ref()]
 *   VAULT:           [b"vault", job.key().as_ref()]
 *   USER_STATS:      [b"user_stats", user.as_ref()]
 */

const SEEDS = {
  PLATFORM_CONFIG: Buffer.from('platform_config'),
  JOB: Buffer.from('job'),
  MILESTONE: Buffer.from('milestone'),
  DISPUTE: Buffer.from('dispute'),
  VAULT: Buffer.from('vault'),
  USER_STATS: Buffer.from('user_stats'),
};

/**
 * Convert a number to little-endian bytes (matches Rust's to_le_bytes for u64)
 */
function toLEBytes(num, byteLength = 8) {
  const buf = Buffer.alloc(byteLength);
  let n = BigInt(num);
  for (let i = 0; i < byteLength; i++) {
    buf[i] = Number(n & 0xffn);
    n >>= 8n;
  }
  return buf;
}

function getProgramId() {
  const id = process.env.SOLANA_PROGRAM_ID;
  if (!id) throw new Error('SOLANA_PROGRAM_ID not set in environment');
  return new PublicKey(id);
}

function derivePlatformConfigPda(programId) {
  const pid = programId || getProgramId();
  return PublicKey.findProgramAddressSync([SEEDS.PLATFORM_CONFIG], pid);
}

function deriveJobPda(clientPubkey, jobId, programId) {
  const pid = programId || getProgramId();
  const client = clientPubkey instanceof PublicKey ? clientPubkey : new PublicKey(clientPubkey);
  return PublicKey.findProgramAddressSync(
    [SEEDS.JOB, client.toBuffer(), toLEBytes(jobId, 8)],
    pid
  );
}

function deriveMilestonePda(jobPda, milestoneId, programId) {
  const pid = programId || getProgramId();
  const job = jobPda instanceof PublicKey ? jobPda : new PublicKey(jobPda);
  return PublicKey.findProgramAddressSync(
    [SEEDS.MILESTONE, job.toBuffer(), Buffer.from([milestoneId])],
    pid
  );
}

function deriveDisputePda(jobPda, programId) {
  const pid = programId || getProgramId();
  const job = jobPda instanceof PublicKey ? jobPda : new PublicKey(jobPda);
  return PublicKey.findProgramAddressSync([SEEDS.DISPUTE, job.toBuffer()], pid);
}

function deriveVaultPda(jobPda, programId) {
  const pid = programId || getProgramId();
  const job = jobPda instanceof PublicKey ? jobPda : new PublicKey(jobPda);
  return PublicKey.findProgramAddressSync([SEEDS.VAULT, job.toBuffer()], pid);
}

module.exports = {
  SEEDS,
  toLEBytes,
  getProgramId,
  derivePlatformConfigPda,
  deriveJobPda,
  deriveMilestonePda,
  deriveDisputePda,
  deriveVaultPda,
};
