import {
    PublicKey,
TransactionInstruction,
SystemProgram,
AccountMeta,
} from "@solana/web3.js";

import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import * as borsh from "@coral-xyz/borsh";

import {
EscrowInstruction,
} from "./types";

import {
deriveEscrowPda,
deriveEscrowTokenAta,
} from "./pdas";


// -------------------------------------------------------------
// Borsh Layouts for Instruction Encoding (MUST MATCH RUST)
// -------------------------------------------------------------
const InitializeSolSchema = borsh.struct([borsh.u64("amount")]);
const InitializeSolWithDeadlineSchema = borsh.struct([
borsh.u64("amount"),
  borsh.i64("deadline_unix_timestamp"),
]);

const InitializeTokenSchema = borsh.struct([borsh.u64("amount")]);
const InitializeTokenWithDeadlineSchema = borsh.struct([
  borsh.u64("amount"),
  borsh.i64("deadline_unix_timestamp"),
]);


// =============== Helper for Borsh Serialization ===============
function encode<T>(schema: borsh.StructType<T>, data: T): Buffer {
  const buffer = Buffer.alloc(1000); // borsh requires a buffer
  const len = schema.encode(data, buffer);
  return buffer.slice(0, len);
}


// =============================================================
//                      INSTRUCTION BUILDERS
// =============================================================

// -------------------------------------------------------------
// 1. INITIALIZE SOL (no deadline)
// -------------------------------------------------------------
export function ixInitializeSol(
  programId: PublicKey,
  initializer: PublicKey,
  freelancer: PublicKey,
  amount: bigint
): TransactionInstruction {
  const { pda: escrowPda } = deriveEscrowPda(programId, initializer, freelancer);

  const data = encode(InitializeSolSchema, { amount });

  const keys: AccountMeta[] = [
    { pubkey: initializer, isSigner: true, isWritable: true },
    { pubkey: freelancer, isSigner: false, isWritable: false },
    { pubkey: escrowPda, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({
    programId,
    keys,
    data,
  });
}


// -------------------------------------------------------------
// 2. INITIALIZE SOL (with deadline)
// -------------------------------------------------------------
export function ixInitializeSolWithDeadline(
  programId: PublicKey,
  initializer: PublicKey,
  freelancer: PublicKey,
  amount: bigint,
  deadlineUnixTimestamp: bigint
): TransactionInstruction {
  const { pda: escrowPda } = deriveEscrowPda(programId, initializer, freelancer);

  const data = encode(InitializeSolWithDeadlineSchema, {
    amount,
    deadline_unix_timestamp: deadlineUnixTimestamp,
  });

  const keys: AccountMeta[] = [
    { pubkey: initializer, isSigner: true, isWritable: true },
    { pubkey: freelancer, isSigner: false, isWritable: false },
    { pubkey: escrowPda, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({
    programId,
    keys,
    data,
  });
}


// -------------------------------------------------------------
// 3. INITIALIZE TOKEN (no deadline)
// -------------------------------------------------------------
export function ixInitializeToken(
  programId: PublicKey,
  initializer: PublicKey,
  freelancer: PublicKey,
  tokenMint: PublicKey,
  initTokenAta: PublicKey,
  amount: bigint
): TransactionInstruction {
  const { pda: escrowPda } = deriveEscrowPda(programId, initializer, freelancer);
  const escrowTokenAta = deriveEscrowTokenAta(escrowPda, tokenMint);

  const data = encode(InitializeTokenSchema, { amount });

  const keys: AccountMeta[] = [
    { pubkey: initializer, isSigner: true, isWritable: true },
    { pubkey: freelancer, isSigner: false, isWritable: false },
    { pubkey: escrowPda, isSigner: false, isWritable: true },
    { pubkey: escrowTokenAta, isSigner: false, isWritable: true },
    { pubkey: tokenMint, isSigner: false, isWritable: false },
    { pubkey: initTokenAta, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: PublicKey.default, isSigner: false, isWritable: false }, // Rent sysvar
  ];

  return new TransactionInstruction({
    programId,
    keys,
    data,
  });
}


// -------------------------------------------------------------
// 4. INITIALIZE TOKEN (with deadline)
// -------------------------------------------------------------
export function ixInitializeTokenWithDeadline(
  programId: PublicKey,
  initializer: PublicKey,
  freelancer: PublicKey,
  tokenMint: PublicKey,
  initTokenAta: PublicKey,
  amount: bigint,
  deadlineUnixTimestamp: bigint
): TransactionInstruction {
  const { pda: escrowPda } = deriveEscrowPda(programId, initializer, freelancer);
  const escrowTokenAta = deriveEscrowTokenAta(escrowPda, tokenMint);

  const data = encode(InitializeTokenWithDeadlineSchema, {
    amount,
    deadline_unix_timestamp: deadlineUnixTimestamp,
  });

  const keys: AccountMeta[] = [
    { pubkey: initializer, isSigner: true, isWritable: true },
    { pubkey: freelancer, isSigner: false, isWritable: false },
    { pubkey: escrowPda, isSigner: false, isWritable: true },
    { pubkey: escrowTokenAta, isSigner: false, isWritable: true },
    { pubkey: tokenMint, isSigner: false, isWritable: false },
    { pubkey: initTokenAta, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: PublicKey.default, isSigner: false, isWritable: false }, // Rent sysvar
  ];

  return new TransactionInstruction({
    programId,
    keys,
    data,
  });
}


// -------------------------------------------------------------
// 5. FREELANCER ACCEPT
// -------------------------------------------------------------
export function ixAccept(
  programId: PublicKey,
  freelancer: PublicKey,
  initializer: PublicKey
): TransactionInstruction {
  const { pda: escrowPda } = deriveEscrowPda(programId, initializer, freelancer);

  const data = Buffer.from([EscrowInstruction.Accept.length]); // Borsh enum marker not needed – handled by encode

  const keys: AccountMeta[] = [
    { pubkey: freelancer, isSigner: true, isWritable: false },
    { pubkey: escrowPda, isSigner: false, isWritable: true },
  ];

  return new TransactionInstruction({
    programId,
    keys,
    data,
  });
}


// -------------------------------------------------------------
// 6. RELEASE SOL
// -------------------------------------------------------------
export function ixReleaseSol(
  programId: PublicKey,
  initializer: PublicKey,
  freelancer: PublicKey
): TransactionInstruction {
  const { pda: escrowPda } = deriveEscrowPda(programId, initializer, freelancer);

  const data = Buffer.from([EscrowInstruction.ReleaseSol.length]);

  const keys: AccountMeta[] = [
    { pubkey: initializer, isSigner: true, isWritable: true },
    { pubkey: freelancer, isSigner: false, isWritable: true },
    { pubkey: escrowPda, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({
    programId,
    keys,
    data,
  });
}



// 7. RELEASE TOKEN

export function ixReleaseToken(
  programId: PublicKey,
  initializer: PublicKey,
  freelancer: PublicKey,
  tokenMint: PublicKey,
  freelancerTokenAta: PublicKey
): TransactionInstruction {
  const { pda: escrowPda } = deriveEscrowPda(programId, initializer, freelancer);
  const escrowTokenAta = deriveEscrowTokenAta(escrowPda, tokenMint);

  const data = Buffer.from([EscrowInstruction.ReleaseToken.length]);

  const keys: AccountMeta[] = [
    { pubkey: initializer, isSigner: true, isWritable: true },
    { pubkey: freelancer, isSigner: false, isWritable: false },
    { pubkey: escrowPda, isSigner: false, isWritable: true },
    { pubkey: escrowTokenAta, isSigner: false, isWritable: true },
    { pubkey: freelancerTokenAta, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({
    programId,
    keys,
    data,
  });
}



// 8. CANCEL (SOL or TOKEN)

export function ixCancel(
  programId: PublicKey,
  initializer: PublicKey,
  freelancer: PublicKey,
  maybeTokenMint?: PublicKey,
  maybeInitializerTokenAta?: PublicKey
): TransactionInstruction {
  const { pda: escrowPda } = deriveEscrowPda(programId, initializer, freelancer);

  const keys: AccountMeta[] = [
    { pubkey: initializer, isSigner: true, isWritable: true },
    { pubkey: escrowPda, isSigner: false, isWritable: true },
    { pubkey: initializer, isSigner: false, isWritable: true }, // destination lamports / tokens
  ];

  // token cancel (optional)
  if (maybeTokenMint && maybeInitializerTokenAta) {
    const escrowTokenAta = deriveEscrowTokenAta(escrowPda, maybeTokenMint);

    keys.push(
      { pubkey: escrowTokenAta, isSigner: false, isWritable: true },
      { pubkey: maybeInitializerTokenAta, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    );
  }

  const data = Buffer.from([EscrowInstruction.Cancel.length]);

  return new TransactionInstruction({
    programId,
    keys,
    data,
  });
}
