import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Keypair, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { SolMarketplace } from "../target/types/sol_marketplace";
import { assert } from "chai";
import { derivePDAs, airdrop } from "./helpers/utils";

describe("Sol Marketplace - Full Flow", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.SolMarketplace as Program<SolMarketplace>;

  const admin = provider.wallet;
  const client = Keypair.generate();
  const freelancer = Keypair.generate();
  const arbitrator = Keypair.generate();

  const jobId = new BN(1);
  const milestoneId = 0;
  const amount = new BN(LAMPORTS_PER_SOL);
  const feeBps = 250;

  const pdas = derivePDAs(program.programId, client.publicKey, jobId, milestoneId);

  before(async () => {
    await airdrop(provider.connection, client.publicKey, 10 * LAMPORTS_PER_SOL);
    await airdrop(provider.connection, freelancer.publicKey, 2 * LAMPORTS_PER_SOL);
  });

  it("initializes platform", async () => {
    const existing = await provider.connection.getAccountInfo(pdas.platformConfig);
    if (existing) return;

    await program.methods
      .initializePlatform(feeBps)
      .accounts({
        admin: admin.publicKey,
        platformConfig: pdas.platformConfig,
        treasury: admin.publicKey,
        arbitrator: arbitrator.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const config = await program.account.platformConfig.fetch(pdas.platformConfig);
    assert.equal(config.feeBps, feeBps);
  });

  it("creates job", async () => {
    await program.methods
      .createJob(jobId, [amount], ["Initial deliverable"])
      .accounts({
        client: client.publicKey,
        freelancer: freelancer.publicKey,
        job: pdas.job,
        vault: pdas.vault,
        tokenMint: SystemProgram.programId,
        systemProgram: SystemProgram.programId,
      })
      .signers([client])
      .rpc();

    const job = await program.account.job.fetch(pdas.job);
    assert.equal(job.jobId.toNumber(), jobId.toNumber());
    assert.equal(job.client.toBase58(), client.publicKey.toBase58());
    assert.equal(job.freelancer.toBase58(), freelancer.publicKey.toBase58());
  });

  it("creates milestone", async () => {
    await program.methods
      .createMilestone(milestoneId, amount, "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco")
      .accounts({
        client: client.publicKey,
        job: pdas.job,
        milestone: pdas.milestone,
        systemProgram: SystemProgram.programId,
      })
      .signers([client])
      .rpc();

    const milestone = await program.account.milestone.fetch(pdas.milestone);
    assert.equal(milestone.milestoneId, milestoneId);
    assert.equal(milestone.amount.toNumber(), amount.toNumber());
  });

  it("funds escrow", async () => {
    await program.methods
      .fundEscrow()
      .accounts({
        client: client.publicKey,
        job: pdas.job,
        vault: pdas.vault,
        systemProgram: SystemProgram.programId,
      })
      .signers([client])
      .rpc();

    const vaultBalance = await provider.connection.getBalance(pdas.vault);
    const job = await program.account.job.fetch(pdas.job);

    assert.equal(vaultBalance, amount.toNumber());
    assert.deepEqual(job.status, { inProgress: {} });
  });

  it("submits milestone", async () => {
    const hash = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";

    await program.methods
      .submitMilestone(hash)
      .accounts({
        freelancer: freelancer.publicKey,
        job: pdas.job,
        milestone: pdas.milestone,
      })
      .signers([freelancer])
      .rpc();

    const milestone = await program.account.milestone.fetch(pdas.milestone);
    assert.deepEqual(milestone.status, { submitted: {} });
    assert.equal(milestone.submissionHash, hash);
  });

  it("approves milestone", async () => {
    await program.methods
      .approveMilestone()
      .accounts({
        client: client.publicKey,
        job: pdas.job,
        milestone: pdas.milestone,
      })
      .signers([client])
      .rpc();

    const milestone = await program.account.milestone.fetch(pdas.milestone);
    assert.deepEqual(milestone.status, { approved: {} });
  });

  it("releases payment", async () => {
    const freelancerBefore = await provider.connection.getBalance(freelancer.publicKey);
    const treasuryBefore = await provider.connection.getBalance(admin.publicKey);

    await program.methods
      .releaseMilestone()
      .accounts({
        client: client.publicKey,
        platformConfig: pdas.platformConfig,
        job: pdas.job,
        milestone: pdas.milestone,
        vault: pdas.vault,
        freelancer: freelancer.publicKey,
        treasury: admin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([client])
      .rpc();

    const freelancerAfter = await provider.connection.getBalance(freelancer.publicKey);
    const treasuryAfter = await provider.connection.getBalance(admin.publicKey);
    const vaultAfter = await provider.connection.getBalance(pdas.vault);

    const expectedFee = amount.toNumber() * feeBps / 10000;
    const expectedPayment = amount.toNumber() - expectedFee;

    const milestone = await program.account.milestone.fetch(pdas.milestone);
    const job = await program.account.job.fetch(pdas.job);

    assert.deepEqual(milestone.status, { paid: {} });
    assert.deepEqual(job.status, { completed: {} });
    assert.equal(vaultAfter, 0);
    assert.equal(freelancerAfter - freelancerBefore, expectedPayment);
    assert.isBelow(Math.abs((treasuryAfter - treasuryBefore) - expectedFee), 10000);
  });
});
