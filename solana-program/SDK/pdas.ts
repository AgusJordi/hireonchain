import { PublicKey } from "@solana/web3.js";

/**
 * MARKETPLACE PDA DERIVATION
 *
 * These must match the Rust program exactly:
 *
 * Seeds:
 * - PLATFORM_CONFIG: [b"platform_config"]
 * - JOB: [b"job", client.as_ref(), job_id.to_le_bytes()]
 * - MILESTONE: [b"milestone", job.key().as_ref(), milestone_id]
 * - DISPUTE: [b"dispute", job.key().as_ref()]
 * - USER_STATS: [b"user_stats", user.as_ref()]
 * - VAULT: [b"vault", job.key().as_ref()]
 */

// Seeds as bytes
const PLATFORM_CONFIG_SEED = Buffer.from("platform_config");
const JOB_SEED = Buffer.from("job");
const MILESTONE_SEED = Buffer.from("milestone");
const DISPUTE_SEED = Buffer.from("dispute");
const USER_STATS_SEED = Buffer.from("user_stats");
const VAULT_SEED = Buffer.from("vault");

/**
 * Derive Platform Config PDA
 * seeds = [b"platform_config"]
 */
export function derivePlatformConfigPda(
  programId: PublicKey
): { pda: PublicKey; bump: number } {
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [PLATFORM_CONFIG_SEED],
    programId
  );
  return { pda, bump };
}

/**
 * Derive Job PDA
 * seeds = [b"job", client.as_ref(), job_id.to_le_bytes()]
 */
export function deriveJobPda(
  programId: PublicKey,
  client: PublicKey,
  jobId: bigint
): { pda: PublicKey; bump: number } {
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [JOB_SEED, client.toBuffer(), toLeBytes(jobId, 8)],
    programId
  );
  return { pda, bump };
}

/**
 * Derive Milestone PDA
 * seeds = [b"milestone", job.key().as_ref(), milestone_id]
 */
export function deriveMilestonePda(
  programId: PublicKey,
  job: PublicKey,
  milestoneId: number
): { pda: PublicKey; bump: number } {
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [MILESTONE_SEED, job.toBuffer(), Buffer.from([milestoneId])],
    programId
  );
  return { pda, bump };
}

/**
 * Derive Dispute PDA
 * seeds = [b"dispute", job.key().as_ref()]
 */
export function deriveDisputePda(
  programId: PublicKey,
  job: PublicKey
): { pda: PublicKey; bump: number } {
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [DISPUTE_SEED, job.toBuffer()],
    programId
  );
  return { pda, bump };
}

/**
 * Derive User Stats PDA
 * seeds = [b"user_stats", user.as_ref()]
 */
export function deriveUserStatsPda(
  programId: PublicKey,
  user: PublicKey
): { pda: PublicKey; bump: number } {
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [USER_STATS_SEED, user.toBuffer()],
    programId
  );
  return { pda, bump };
}

/**
 * Derive Vault PDA (holds escrow funds for a job)
 * seeds = [b"vault", job.key().as_ref()]
 */
export function deriveVaultPda(
  programId: PublicKey,
  job: PublicKey
): { pda: PublicKey; bump: number } {
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [VAULT_SEED, job.toBuffer()],
    programId
  );
  return { pda, bump };
}

/**
 * Helper: convert number to little-endian bytes
 */
function toLeBytes(num: bigint, bytes: number): Buffer {
  const buffer = Buffer.alloc(bytes);
  let n = num;
  for (let i = 0; i < bytes; i++) {
    buffer[i] = Number(n & 0xffn);
    n >>= 8n;
  }
  return buffer;
}

/**
 * OLD ESCROW PDAs (kept for backward compatibility)
 * These are from the old escrow program - no longer used
 */
export function deriveEscrowPda(
  programId: PublicKey,
  initializer: PublicKey,
  freelancer: PublicKey
): { pda: PublicKey; bump: number } {
  const seed1 = Buffer.from("escrow");
  const seed2 = initializer.toBuffer();
  const seed3 = freelancer.toBuffer();

  const [pda, bump] = PublicKey.findProgramAddressSync(
    [seed1, seed2, seed3],
    programId
  );

  return { pda, bump };
}

export function deriveEscrowTokenAta(
  escrowPda: PublicKey,
  tokenMint: PublicKey
): PublicKey {
  // This was for the old token escrow - not used in marketplace
  // Kept for backward compatibility
  throw new Error("Deprecated: use deriveVaultPda for marketplace");
}

export function deriveInitializerTokenAta(
  initializer: PublicKey,
  tokenMint: PublicKey
): PublicKey {
  throw new Error("Deprecated: use deriveVaultPda for marketplace");
}

export function deriveFreelancerTokenAta(
  freelancer: PublicKey,
  tokenMint: PublicKey
): PublicKey {
  throw new Error("Deprecated: use deriveVaultPda for marketplace");
}
