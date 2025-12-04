import {
    Connection,
PublicKey,
Transaction,
TransactionInstruction,
SendOptions,
Commitment,
Signer,
} from "@solana/web3.js";

import {
ixInitializeSol,
ixInitializeSolWithDeadline,
ixInitializeToken,
ixInitializeTokenWithDeadline,
ixAccept,
ixReleaseSol,
ixReleaseToken,
ixCancel,
} from "./instructions";

import { deriveEscrowPda, deriveEscrowTokenAta } from "./pdas";
import { EscrowClientConfig, EscrowTxResult } from "./types";



/**

*                            EscrowClient

*
* This is your high-level SDK wrapper.
* Handles:
*   - instruction building
*   - TX sending
*   - confirmation
*   - returning slot + signature
*/

export class EscrowClient {
readonly connection: Connection;
readonly programId: PublicKey;
readonly commitment: Commitment;
readonly preflight: SendOptions["preflightCommitment"];

constructor(
    connection: Connection,
    programId: PublicKey,
    config?: EscrowClientConfig
  ) {
    this.connection = connection;
    this.programId = programId;

    this.commitment = config?.commitment ?? "confirmed";
    this.preflight = config?.preflight ?? "simple";
  }


  // SEND + CONFIRM HELPER

  private async send(
    payer: Signer,
    instructions: TransactionInstruction[]
  ): Promise<EscrowTxResult> {
    const tx = new Transaction().add(...instructions);
    tx.feePayer = payer.publicKey;

    const latest = await this.connection.getLatestBlockhash(this.commitment);

    tx.recentBlockhash = latest.blockhash;

    const signed = await payer.signTransaction(tx);
    const sig = await this.connection.sendRawTransaction(
      signed.serialize(),
      {
        skipPreflight: false,
        preflightCommitment: this.preflight,
      }
    );

    const confirmation = await this.connection.confirmTransaction(
      {
        signature: sig,
        blockhash: latest.blockhash,
        lastValidBlockHeight: latest.lastValidBlockHeight,
      },
      this.commitment
    );

    return {
      txId: sig,
      slot: confirmation.context.slot,
    };
  }




  //                           HIGH-LEVEL METHODS



  // 1. INITIALIZE SOL

  async initializeSol(
    payer: Signer,
    initializer: PublicKey,
    freelancer: PublicKey,
    amount: bigint
  ) {
    const ix = ixInitializeSol(
      this.programId,
      initializer,
      freelancer,
      amount
    );
    return this.send(payer, [ix]);
  }


  // 2. INITIALIZE SOL WITH DEADLINE

  async initializeSolWithDeadline(
    payer: Signer,
    initializer: PublicKey,
    freelancer: PublicKey,
    amount: bigint,
    deadlineUnixTimestamp: bigint
  ) {
    const ix = ixInitializeSolWithDeadline(
      this.programId,
      initializer,
      freelancer,
      amount,
      deadlineUnixTimestamp
    );
    return this.send(payer, [ix]);
  }


  // 3. INITIALIZE SPL TOKEN

  async initializeToken(
    payer: Signer,
    initializer: PublicKey,
    freelancer: PublicKey,
    tokenMint: PublicKey,
    initializerTokenAta: PublicKey,
    amount: bigint
  ) {
    const ix = ixInitializeToken(
      this.programId,
      initializer,
      freelancer,
      tokenMint,
      initializerTokenAta,
      amount
    );
    return this.send(payer, [ix]);
  }


  // 4. INITIALIZE SPL TOKEN WITH DEADLINE

  async initializeTokenWithDeadline(
    payer: Signer,
    initializer: PublicKey,
    freelancer: PublicKey,
    tokenMint: PublicKey,
    initializerTokenAta: PublicKey,
    amount: bigint,
    deadlineUnixTimestamp: bigint
  ) {
    const ix = ixInitializeTokenWithDeadline(
      this.programId,
      initializer,
      freelancer,
      tokenMint,
      initializerTokenAta,
      amount,
      deadlineUnixTimestamp
    );
    return this.send(payer, [ix]);
  }


  // 5. ACCEPT ESCROW (Freelancer signs)

  async accept(
    payer: Signer,
    freelancer: PublicKey,
    initializer: PublicKey
  ) {
    const ix = ixAccept(
      this.programId,
      freelancer,
      initializer
    );
    return this.send(payer, [ix]);
  }


  // 6. RELEASE SOL (Initializer signs)

  async releaseSol(
    payer: Signer,
    initializer: PublicKey,
    freelancer: PublicKey
  ) {
    const ix = ixReleaseSol(
      this.programId,
      initializer,
      freelancer
    );
    return this.send(payer, [ix]);
  }


  // 7. RELEASE TOKEN (Initializer signs)

  async releaseToken(
    payer: Signer,
    initializer: PublicKey,
    freelancer: PublicKey,
    tokenMint: PublicKey,
    freelancerTokenAta: PublicKey
  ) {
    const ix = ixReleaseToken(
      this.programId,
      initializer,
      freelancer,
      tokenMint,
      freelancerTokenAta
    );
    return this.send(payer, [ix]);
  }


  // 8. CANCEL (Initializer signs)

  async cancel(
    payer: Signer,
    initializer: PublicKey,
    freelancer: PublicKey,
    maybeTokenMint?: PublicKey,
    maybeInitializerTokenAta?: PublicKey
  ) {
    const ix = ixCancel(
      this.programId,
      initializer,
      freelancer,
      maybeTokenMint,
      maybeInitializerTokenAta
    );
    return this.send(payer, [ix]);
  }
}
