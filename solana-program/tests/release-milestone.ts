import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Keypair, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { SolMarketplace } from "../target/types/sol_marketplace";
import { assert } from "chai";
import { derivePDAs, airdrop } from "./helpers/utils";

describe("Release Milestone", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.SolMarketplace as Program<SolMarketplace>;

  const admin = provider.wallet;
  const client = Keypair.generate();
  const freelancer = Keypair.generate();
  const arbitrator = Keypair.generate();

  const jobId = new BN(100);
  const milestoneId = 0;
  const amount = new BN(LAMPORTS_PER_SOL);
  const feeBps = 250;

  const pdas = derivePDAs(program.programId, client.publicKey, jobId, milestoneId);

  before(async () => {
    await airdrop(provider.connection, client.publicKey, 10 * LAMPORTS_PER_SOL);
    await airdrop(provider.connection, freelancer.publicKey, 2 * LAMPORTS_PER_SOL);

    const existing = await provider.connection.getAccountInfo(pdas.platformConfig);
    if (!existing) {
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
    }

    await program.methods
      .createJob(jobId, [amount], ["Test milestone"])
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

    await program.methods
      .createMilestone(milestoneId, amount, "Test milestone")
      .accounts({
        client: client.publicKey,
        job: pdas.job,
        milestone: pdas.milestone,
        systemProgram: SystemProgram.programId,
      })
      .signers([client])
      .rpc();

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

    await program.methods
      .submitMilestone("QmTestHash")
      .accounts({
        freelancer: freelancer.publicKey,
        job: pdas.job,
        milestone: pdas.milestone,
      })
      .signers([freelancer])
      .rpc();

    await program.methods
      .approveMilestone()
      .accounts({
        client: client.publicKey,
        job: pdas.job,
        milestone: pdas.milestone,
      })
      .signers([client])
      .rpc();
  });

  it("transfers SOL from vault via invoke_signed", async () => {
    const vaultBefore = await provider.connection.getBalance(pdas.vault);
    const freelancerBefore = await provider.connection.getBalance(freelancer.publicKey);
    const treasuryBefore = await provider.connection.getBalance(admin.publicKey);

    assert.equal(vaultBefore, LAMPORTS_PER_SOL);

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

    const vaultAfter = await provider.connection.getBalance(pdas.vault);
    const freelancerAfter = await provider.connection.getBalance(freelancer.publicKey);
    const treasuryAfter = await provider.connection.getBalance(admin.publicKey);

    const expectedFee = amount.toNumber() * feeBps / 10000;
    const expectedPayment = amount.toNumber() - expectedFee;

    assert.equal(vaultAfter, 0);
    assert.equal(freelancerAfter - freelancerBefore, expectedPayment);
    assert.isBelow(Math.abs((treasuryAfter - treasuryBefore) - expectedFee), 10000);
  });

  it("sets milestone status to Paid", async () => {
    const milestone = await program.account.milestone.fetch(pdas.milestone);
    assert.deepEqual(milestone.status, { paid: {} });
    assert.isAbove(milestone.paidAt.toNumber(), 0);
  });

  it("sets job status to Completed", async () => {
    const job = await program.account.job.fetch(pdas.job);
    assert.deepEqual(job.status, { completed: {} });
    assert.equal(job.milestonesPaid, 1);
    assert.equal(job.escrowBalance.toNumber(), 0);
  });
});
