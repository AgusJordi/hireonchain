import { PublicKey } from "@solana/web3.js";

/**
* -----------------------------------------------------
*  On-chain Instruction Enum (mirror of Rust Borsh enum)
* -----------------------------------------------------
*
* These values are NOT numeric discriminants like in Anchor.
* They are Borsh-encoded enums, matching your Rust definition.
*
* We create instruction wrappers in `instructions.ts` so you
* don't need to care about low-level encoding when using the SDK.
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

/**
* -----------------------------------------------------
*  Escrow Account State (mirror of Rust struct)
* -----------------------------------------------------
*
* This structure matches EXACTLY the Borsh layout in:
*
*    pub struct EscrowAccount {
*        pub initializer: Pubkey,
*        pub freelancer: Pubkey,
*        pub token_mint: Pubkey,
*        pub amount: u64,
*        pub is_token_escrow: bool,
*        pub is_initialized: bool,
*        pub is_accepted: bool,
*        pub deadline_unix_timestamp: i64,
*    }
*
* Used when deserializing PDA state accounts for:
*   - UIs
*   - dashboards
*   - bots
*   - backend services
*/
export interface EscrowAccountState {
initializer: PublicKey;
freelancer: PublicKey;
tokenMint: PublicKey;
amount: bigint; // u64
isTokenEscrow: boolean;
isInitialized: boolean;
isAccepted: boolean;
deadlineUnixTimestamp: bigint; // i64
}

/**
* -----------------------------------------------------
*  High-level Error Codes (for developer ergonomics)
* -----------------------------------------------------
*
* These correspond to your Rust EscrowError:
*
*   DeadlineNotReached = 0
*   DeadlinePassed = 1
*   NotAccepted = 2
*/
export enum EscrowErrorCode {
DeadlineNotReached = 0,
DeadlinePassed = 1,
NotAccepted = 2,
}

/**
* Friendly runtime error used by the client SDK
*/
export class EscrowClientError extends Error {
constructor(
    readonly code: EscrowErrorCode,
    readonly logs?: string[]
  ) {
    super(`Escrow Program Error: ${EscrowErrorCode[code]} (${code})`);
  }
}

/**

 *  Shared interface for transaction builder responses

 */
export interface EscrowTxResult {
  txId: string;
  slot: number;
}

/**

 *  Optional: Configuration for the EscrowClient class

 */
export interface EscrowClientConfig {
  programId?: PublicKey;            // default set in sdk/index.ts
  commitment?: "processed" | "confirmed" | "finalized";
  preflight?: "none" | "simple" | "full";
}
