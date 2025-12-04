//Criteria:
//escrow initialized
//accepted = true
//deadline passed
//lamports move from PDA → freelancer
//state stays valid until release
//signer must be initializer
//This test simulates the correct, happy-path payout for a SOL escrow.

use solana_program_test::*;
use solana_sdk::{
    pubkey::Pubkey,
    signature::Keypair,
    signer::Signer,
    transaction::Transaction,
};
use escrow_program::{
    id,
    instruction::EscrowInstruction,
    state::EscrowAccount,
    utils::derive_escrow_pda,
};
use borsh::BorshDeserialize;
use borsh::BorshSerialize;

#[tokio::test]
async fn test_release_sol_success_after_deadline() {
    let program_id = id();

    let mut pt = ProgramTest::new(
        "escrow_program",
        program_id,
        processor!(escrow_program::processor::process)
    );

    let (mut banks, payer, recent_blockhash) = pt.start().await;


    // Actors

    let initializer = Keypair::new();
    let freelancer  = Keypair::new();

    // fund initializer and freelancer
    banks.request_airdrop(initializer.pubkey(), 5_000_000_000).await.unwrap();
    banks.request_airdrop(freelancer.pubkey(),  1_000_000_000).await.unwrap();


    // PDA
    let (pda, _bump) = derive_escrow_pda(
        &program_id,
        &initializer.pubkey(),
        &freelancer.pubkey(),
    ).unwrap();


    // Step 1 — Initialize escrow with short deadline

    let amount: u64 = 2_000_000_000; // 2 SOL

    // Force deadline to "already passed"
    let now = banks.get_clock().await.unwrap().unix_timestamp;
    let past_deadline = now - 10; // 10 seconds in the past

    let ix_init_data = EscrowInstruction::InitializeSol {
        amount,
        deadline_unix_timestamp: past_deadline,
    }
    .try_to_vec()
    .unwrap();

    let ix_init = solana_sdk::instruction::Instruction {
        program_id,
        accounts: vec![
            solana_sdk::instruction::AccountMeta::new(initializer.pubkey(), true),
            solana_sdk::instruction::AccountMeta::new_readonly(freelancer.pubkey(), false),
            solana_sdk::instruction::AccountMeta::new(pda, false),
            solana_sdk::instruction::AccountMeta::new_readonly(
                solana_program::system_program::id(),
                false,
            )
        ],
        data: ix_init_data,
    };

    let tx_init = Transaction::new_signed_with_payer(
        &[ix_init],
        Some(&payer.pubkey()),
        &[&payer, &initializer],
        recent_blockhash,
    );

    banks.process_transaction(tx_init).await.unwrap();


    // Step 2 — Freelancer ACCEPTS

    let ix_accept_data = EscrowInstruction::AcceptEscrow
        .try_to_vec()
        .unwrap();

    let ix_accept = solana_sdk::instruction::Instruction {
        program_id,
        accounts: vec![
            solana_sdk::instruction::AccountMeta::new(freelancer.pubkey(), true),
            solana_sdk::instruction::AccountMeta::new(pda, false),
        ],
        data: ix_accept_data,
    };

    let tx_accept = Transaction::new_signed_with_payer(
        &[ix_accept],
        Some(&payer.pubkey()),
        &[&payer, &freelancer],
        recent_blockhash,
    );

    banks.process_transaction(tx_accept).await.unwrap();

    // Confirm accepted
    let before_release_acc = banks.get_account(pda).await.unwrap().unwrap();
    let before_state = EscrowAccount::try_from_slice(&before_release_acc.data).unwrap();

    assert!(before_state.is_accepted);
    assert_eq!(before_state.amount, amount);
    assert_eq!(before_state.deadline_unix_timestamp, past_deadline);

    // Step 3 — Release SOL after deadline

    let freelancer_balance_before = banks.get_account(freelancer.pubkey()).await.unwrap().unwrap().lamports;

    let ix_release_data = EscrowInstruction::ReleaseSol
        .try_to_vec()
        .unwrap();

    let ix_release = solana_sdk::instruction::Instruction {
        program_id,
        accounts: vec![
            // initializer must sign
            solana_sdk::instruction::AccountMeta::new(initializer.pubkey(), true),
            solana_sdk::instruction::AccountMeta::new(freelancer.pubkey(), false),
            solana_sdk::instruction::AccountMeta::new(pda, false),
            solana_sdk::instruction::AccountMeta::new_readonly(
                solana_program::system_program::id(),
                false,
            )
        ],
        data: ix_release_data,
    };

    let tx_release = Transaction::new_signed_with_payer(
        &[ix_release],
        Some(&payer.pubkey()),
        &[&payer, &initializer],
        recent_blockhash,
    );

    banks.process_transaction(tx_release).await.unwrap();


    // Assertions after release


    // 1. Freelancer received SOL
    let freelancer_after = banks.get_account(freelancer.pubkey()).await.unwrap().unwrap();
    assert!(
        freelancer_after.lamports > freelancer_balance_before,
        "Freelancer lamports should increase after release"
    );
    assert!(
        freelancer_after.lamports >= freelancer_balance_before + amount,
        "Freelancer did not receive full escrow amount"
    );

    // 2. PDA lamports should now be zero (or rent-exempt-zeroed state)
    let pda_after = banks.get_account(pda).await.unwrap().unwrap();
    assert!(
        pda_after.lamports <= 10_000, // rent-exempt min or small residue depending on your implementation
        "PDA should be drained after release"
    );

    // 3. State is still readable but irrelevant (or program may choose to mark canceled/released)
    let after_state = EscrowAccount::try_from_slice(&pda_after.data).unwrap();
    assert!(after_state.is_accepted); // still true
    assert_eq!(after_state.amount, amount);

    println!("C1: Release SOL Success After Deadline — PASSED");
}
