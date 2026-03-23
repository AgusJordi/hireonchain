import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SendOptions,
  Commitment,
} from "@solana/web3.js";

import {
  ixInitializePlatform,
  ixCreateJob,
  ixCreateMilestone,
  ixFundEscrow,
  ixSubmitMilestone,
  ixApproveMilestone,
  ixReleaseMilestone,
  ixCancelJob,
  ixOpenDispute,
  ixSubmitDisputeEvidence,
  ixResolveDispute,
  ixSetPlatformFee,
  ixWithdrawPlatformFees,
  PROGRAM_ID,
} from "./instructions";

import {
  derivePlatformConfigPda,
  deriveJobPda,
  deriveMilestonePda,
  deriveDisputePda,
  deriveVaultPda,
} from "./pdas";

import {
  FreelanceClientConfig,
  FreelanceTxResult,
  DisputeRuling,
  WalletSigner,
  OnTransactionStatus,
} from "./types";


/**
 * FreelanceClient
 *
 * High-level SDK wrapper for the Freelance Marketplace program.
 * Handles:
 *   - Instruction building
 *   - Transaction sending
 *   - Confirmation
 *   - Returning slot + signature
 */
export class FreelanceClient {
  readonly connection: Connection;
  readonly programId: PublicKey;
  readonly commitment: Commitment;
  readonly preflight: Commitment;
  readonly onStatus?: OnTransactionStatus;
  readonly waitForFinalization: boolean;

  constructor(
    connection: Connection,
    programId: PublicKey = PROGRAM_ID,
    config?: FreelanceClientConfig
  ) {
    this.connection = connection;
    this.programId = programId;

    this.commitment = config?.commitment ?? "confirmed";
    this.preflight = config?.preflight ?? "confirmed";
    this.onStatus = config?.onStatus;
    this.waitForFinalization = config?.waitForFinalization ?? false;
  }

  // =============== Send + Confirm Helper ===============

  private async send(
    wallet: WalletSigner,
    instructions: TransactionInstruction[]
  ): Promise<FreelanceTxResult> {
    this.onStatus?.({ stage: "signing" });

    const tx = new Transaction().add(...instructions);
    tx.feePayer = wallet.publicKey;

    const { blockhash, lastValidBlockHeight } =
      await this.connection.getLatestBlockhash(this.commitment);
    tx.recentBlockhash = blockhash;

    const signed = await wallet.signTransaction(tx);

    const txId = await this.connection.sendRawTransaction(
      signed.serialize(),
      {
        skipPreflight: false,
        preflightCommitment: this.preflight,
      }
    );

    this.onStatus?.({ stage: "submitted", txId });
    this.onStatus?.({ stage: "confirming", txId });

    const confirmation = await this.connection.confirmTransaction(
      {
        signature: txId,
        blockhash,
        lastValidBlockHeight,
      },
      this.commitment
    );

    if (confirmation.value.err) {
      const errorMsg = `Transaction failed on-chain: ${JSON.stringify(confirmation.value.err)}`;
      this.onStatus?.({ stage: "error", txId, error: errorMsg });
      throw new Error(errorMsg);
    }

    const slot = confirmation.context.slot;
    this.onStatus?.({ stage: "confirmed", txId, slot });

    if (this.waitForFinalization) {
      await this.awaitFinalization(txId);
    }

    return { txId, slot };
  }

  private async awaitFinalization(txId: string): Promise<void> {
    const maxAttempts = 60;

    for (let i = 0; i < maxAttempts; i++) {
      const { value } = await this.connection.getSignatureStatuses([txId]);
      const status = value[0];

      if (status?.confirmationStatus === "finalized") {
        this.onStatus?.({ stage: "finalized", txId, slot: status.slot });
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    console.warn(`Transaction ${txId} confirmed but finalization timed out`);
  }

  // =============== Platform Operations ===============

  /**
   * Initialize the platform (admin only, one-time)
   */
  async initializePlatform(
    wallet: WalletSigner,
    admin: PublicKey,
    treasury: PublicKey,
    arbitrator: PublicKey,
    feeBps: number
  ): Promise<FreelanceTxResult> {
    const ix = ixInitializePlatform(
      admin,
      treasury,
      arbitrator,
      feeBps,
      this.programId
    );
    return this.send(wallet, [ix]);
  }

  /**
   * Set platform fee (admin only)
   */
  async setPlatformFee(
    wallet: WalletSigner,
    admin: PublicKey,
    newFeeBps: number
  ): Promise<FreelanceTxResult> {
    const ix = ixSetPlatformFee(admin, newFeeBps, this.programId);
    return this.send(wallet, [ix]);
  }

  /**
   * Withdraw platform fees (admin only)
   * @param treasury 
   */
  async withdrawPlatformFees(
    wallet: WalletSigner,
    admin: PublicKey,
    amount: bigint,
    recipient: PublicKey,
    treasury: PublicKey
  ): Promise<FreelanceTxResult> {
    const ix = ixWithdrawPlatformFees(
      admin,
      amount,
      recipient,
      treasury,
      this.programId
    );
    return this.send(wallet, [ix]);
  }

  // =============== Job Operations ===============

  /**
   * Create a new job with milestones
   */
  async createJob(
    wallet: WalletSigner,
    client: PublicKey,
    freelancer: PublicKey,
    jobId: bigint,
    milestoneAmounts: bigint[],
    milestoneDescriptions: string[],
    tokenMint: PublicKey = PublicKey.default // Use SOL by default
  ): Promise<FreelanceTxResult> {
    const ix = ixCreateJob(
      client,
      freelancer,
      jobId,
      milestoneAmounts,
      milestoneDescriptions,
      tokenMint,
      this.programId
    );
    return this.send(wallet, [ix]);
  }

  /**
   * Add a milestone to an existing job
   */
  async createMilestone(
    wallet: WalletSigner,
    client: PublicKey,
    jobClient: PublicKey,
    jobId: bigint,
    milestoneId: number,
    amount: bigint,
    descriptionHash: string
  ): Promise<FreelanceTxResult> {
    const ix = ixCreateMilestone(
      client,
      jobClient,
      jobId,
      milestoneId,
      amount,
      descriptionHash,
      this.programId
    );
    return this.send(wallet, [ix]);
  }

  /**
   * Fund escrow for a job (client deposits funds)
   */
  async fundEscrow(
    wallet: WalletSigner,
    client: PublicKey,
    jobClient: PublicKey,
    jobId: bigint
  ): Promise<FreelanceTxResult> {
    const ix = ixFundEscrow(
      client,
      jobClient,
      jobId,
      this.programId
    );
    return this.send(wallet, [ix]);
  }

  /**
   * Cancel a job and get refund
   */
  async cancelJob(
    wallet: WalletSigner,
    client: PublicKey,
    jobClient: PublicKey,
    jobId: bigint
  ): Promise<FreelanceTxResult> {
    const ix = ixCancelJob(
      client,
      jobClient,
      jobId,
      this.programId
    );
    return this.send(wallet, [ix]);
  }

  // =============== Milestone Operations ===============

  /**
   * Submit a milestone for review (freelancer)
   */
  async submitMilestone(
    wallet: WalletSigner,
    freelancer: PublicKey,
    jobClient: PublicKey,
    jobId: bigint,
    milestoneId: number,
    submissionHash: string
  ): Promise<FreelanceTxResult> {
    const ix = ixSubmitMilestone(
      freelancer,
      jobClient,
      jobId,
      milestoneId,
      submissionHash,
      this.programId
    );
    return this.send(wallet, [ix]);
  }

  /**
   * Approve a milestone (client)
   */
  async approveMilestone(
    wallet: WalletSigner,
    client: PublicKey,
    jobClient: PublicKey,
    jobId: bigint,
    milestoneId: number
  ): Promise<FreelanceTxResult> {
    const ix = ixApproveMilestone(
      client,
      jobClient,
      jobId,
      milestoneId,
      this.programId
    );
    return this.send(wallet, [ix]);
  }

  /**
   * Release payment for an approved milestone (client)
   */
  async releaseMilestone(
    wallet: WalletSigner,
    client: PublicKey,
    jobClient: PublicKey,
    jobId: bigint,
    milestoneId: number,
    freelancer: PublicKey,
    treasury: PublicKey
  ): Promise<FreelanceTxResult> {
    const ix = ixReleaseMilestone(
      client,
      jobClient,
      jobId,
      milestoneId,
      freelancer,
      treasury,
      this.programId
    );
    return this.send(wallet, [ix]);
  }

  // =============== Dispute Operations ===============

  /**
   * Open a dispute for a job (client or freelancer)
   */
  async openDispute(
    wallet: WalletSigner,
    opener: PublicKey,
    jobClient: PublicKey,
    jobId: bigint,
    milestoneId: number
  ): Promise<FreelanceTxResult> {
    const ix = ixOpenDispute(
      opener,
      jobClient,
      jobId,
      milestoneId,
      this.programId
    );
    return this.send(wallet, [ix]);
  }

  /**
   * Submit evidence for an open dispute (client or freelancer)
   */
  async submitDisputeEvidence(
    wallet: WalletSigner,
    submitter: PublicKey,
    jobClient: PublicKey,
    jobId: bigint,
    evidenceHash: string
  ): Promise<FreelanceTxResult> {
    const ix = ixSubmitDisputeEvidence(
      submitter,
      jobClient,
      jobId,
      evidenceHash,
      this.programId
    );
    return this.send(wallet, [ix]);
  }

  /**
   * Resolve a dispute (arbitrator)
   */
  async resolveDispute(
    wallet: WalletSigner,
    arbitrator: PublicKey,
    jobClient: PublicKey,
    jobId: bigint,
    milestoneId: number,
    ruling: DisputeRuling,
    client: PublicKey,
    freelancer: PublicKey
  ): Promise<FreelanceTxResult> {
    const ix = ixResolveDispute(
      arbitrator,
      jobClient,
      jobId,
      milestoneId,
      ruling,
      client,
      freelancer,
      this.programId
    );
    return this.send(wallet, [ix]);
  }

  // =============== PDA Derivation Helpers ===============

  /**
   * Get platform config PDA
   */
  getPlatformConfigPda(): PublicKey {
    return derivePlatformConfigPda(this.programId).pda;
  }

  /**
   * Get job PDA
   */
  getJobPda(client: PublicKey, jobId: bigint): PublicKey {
    return deriveJobPda(this.programId, client, jobId).pda;
  }

  /**
   * Get milestone PDA
   */
  getMilestonePda(job: PublicKey, milestoneId: number): PublicKey {
    return deriveMilestonePda(this.programId, job, milestoneId).pda;
  }

  /**
   * Get dispute PDA
   */
  getDisputePda(job: PublicKey): PublicKey {
    return deriveDisputePda(this.programId, job).pda;
  }

  /**
   * Get vault PDA for a job
   */
  getVaultPda(job: PublicKey): PublicKey {
    return deriveVaultPda(this.programId, job).pda;
  }
}

/**
 * @deprecated Use FreelanceClient instead
 */
export class EscrowClient {
  readonly connection: Connection;
  readonly programId: PublicKey;
  readonly commitment: Commitment;
  readonly preflight: SendOptions["preflightCommitment"];

  constructor(
    connection: Connection,
    programId: PublicKey,
    config?: FreelanceClientConfig
  ) {
    console.warn("EscrowClient is deprecated. Use FreelanceClient instead.");
    this.connection = connection;
    this.programId = programId;
    this.commitment = config?.commitment ?? "confirmed";
    this.preflight = config?.preflight ?? "confirmed";
  }

  // These methods throw errors - they're just placeholders
  async initializeSol() { throw new Error("Deprecated: Use FreelanceClient"); }
  async initializeSolWithDeadline() { throw new Error("Deprecated: Use FreelanceClient"); }
  async initializeToken() { throw new Error("Deprecated: Use FreelanceClient"); }
  async initializeTokenWithDeadline() { throw new Error("Deprecated: Use FreelanceClient"); }
  async accept() { throw new Error("Deprecated: Use FreelanceClient"); }
  async releaseSol() { throw new Error("Deprecated: Use FreelanceClient"); }
  async releaseToken() { throw new Error("Deprecated: Use FreelanceClient"); }
  async cancel() { throw new Error("Deprecated: Use FreelanceClient"); }
}
