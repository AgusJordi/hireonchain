import { Connection, PublicKey } from "@solana/web3.js";
import * as borsh from "@coral-xyz/borsh";

import { EscrowAccountState } from "./types";
import { deriveEscrowPda } from "./pdas";

/**
*  Borsh layout for EscrowAccount (MUST MATCH RUST)
*
* Rust:
*  pub struct EscrowAccount {
*      pub initializer: Pubkey,
*      pub freelancer: Pubkey,
*      pub token_mint: Pubkey,
*      pub amount: u64,
*      pub is_token_escrow: bool,
*      pub is_initialized: bool,
*      pub is_accepted: bool,
*      pub deadline_unix_timestamp: i64,
*  }
*/

const ESCROW_ACCOUNT_LAYOUT = borsh.struct([
borsh.publicKey("initializer"),
  borsh.publicKey("freelancer"),
  borsh.publicKey("token_mint"),
  borsh.u64("amount"),
  borsh.bool("is_token_escrow"),
  borsh.bool("is_initialized"),
  borsh.bool("is_accepted"),
  borsh.i64("deadline_unix_timestamp"),
]);

type EscrowAccountRaw = {
  initializer: PublicKey;
  freelancer: PublicKey;
  token_mint: PublicKey;
  amount: bigint;
  is_token_escrow: boolean;
  is_initialized: boolean;
  is_accepted: boolean;
  deadline_unix_timestamp: bigint;
};

/**
 * Decode raw account data buffer into EscrowAccountState.
 */
export function decodeEscrowAccount(data: Buffer): EscrowAccountState {
  const raw = ESCROW_ACCOUNT_LAYOUT.decode(data) as EscrowAccountRaw;

  return {
    initializer: raw.initializer,
    freelancer: raw.freelancer,
    tokenMint: raw.token_mint,
    amount: raw.amount,
    isTokenEscrow: raw.is_token_escrow,
    isInitialized: raw.is_initialized,
    isAccepted: raw.is_accepted,
    deadlineUnixTimestamp: raw.deadline_unix_timestamp,
  };
}

/**
 * Fetch escrow account by PDA and decode it.
 *
 * Returns:
 *  - EscrowAccountState if account exists & has data
 *  - null if no account exists at that address
 */
export async function fetchEscrowByPda(
  connection: Connection,
  escrowPda: PublicKey,
  commitment: "processed" | "confirmed" | "finalized" = "confirmed",
): Promise<EscrowAccountState | null> {
  const accountInfo = await connection.getAccountInfo(escrowPda, commitment);
  if (!accountInfo || !accountInfo.data || accountInfo.data.length === 0) {
    return null;
  }

  return decodeEscrowAccount(accountInfo.data as Buffer);
}

/**
 * Convenience: derive PDA from initializer + freelancer and fetch.
 */
export async function fetchEscrowByParties(
  connection: Connection,
  programId: PublicKey,
  initializer: PublicKey,
  freelancer: PublicKey,
  commitment: "processed" | "confirmed" | "finalized" = "confirmed",
): Promise<{ pda: PublicKey; state: EscrowAccountState | null }> {
  const { pda } = deriveEscrowPda(programId, initializer, freelancer);
  const state = await fetchEscrowByPda(connection, pda, commitment);
  return { pda, state };
}

/**
 * Utility: convert lamports (bigint) → SOL (number)
 * NOTE: for UI only, do not use `number` for financial logic with huge values.
 */
export function lamportsToSol(lamports: bigint): number {
  const LAMPORTS_PER_SOL = 1_000_000_000n;
  return Number(lamports) / Number(LAMPORTS_PER_SOL);
}

/**
 * Utility: convert SOL (number) → lamports (bigint)
 */
export function solToLamports(sol: number): bigint {
  const LAMPORTS_PER_SOL = 1_000_000_000n;
  return BigInt(Math.round(sol * 1_000_000_000)) / 1n * LAMPORTS_PER_SOL / 1_000_000_000n;
}
