import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

/**
*  ESCROW PDA DERIVATION
*
* Must match Rust exactly:
*
* seeds = [
*   b"escrow",
*   initializer.key.as_ref(),
*   freelancer.key.as_ref(),
* ]
*
* Pubkey::find_program_address(...)
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

/**

 *  ESCROW TOKEN ACCOUNT (ATA) FOR PDA
 *
 * Used when escrow holds SPL tokens:
 *   escrow_token_ata = ATA(escrow_pda, mint)
 *
 * Works with PDA owners (program-owned).
 */
export function deriveEscrowTokenAta(
  escrowPda: PublicKey,
  tokenMint: PublicKey
): PublicKey {
  return getAssociatedTokenAddressSync(
    tokenMint,
    escrowPda,
    true // allowOwnerOffCurve (PDA is off-curve)
  );
}

/**

 *  INITIALIZER TOKEN ATA (for convenience)

 */
export function deriveInitializerTokenAta(
  initializer: PublicKey,
  tokenMint: PublicKey
): PublicKey {
  return getAssociatedTokenAddressSync(tokenMint, initializer);
}

/**

 *  FREELANCER TOKEN ATA (for convenience)

 */
export function deriveFreelancerTokenAta(
  freelancer: PublicKey,
  tokenMint: PublicKey
): PublicKey {
  return getAssociatedTokenAddressSync(tokenMint, freelancer);
}
