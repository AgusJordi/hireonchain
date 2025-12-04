//This test ensures:
//escrow initialized
//NOT accepted
//deadline can be passed or not — doesn’t matter
//initializer signs release attempt
//release MUST FAIL
//no lamports move
//state remains unchanged

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

#[tokio::test]
async fn test_release_sol_without_acceptance_fails() {
    let program_id = id();

    let mut pt = ProgramTest::new(
        "escrow_program",
        program_id,
        processor!(escrow_program::processor::process),
    );

    let (mut banks, payer, recent_blockhash) = pt.start().await;


    // Actors

    let initializer = Keypair::new();
    let freelancer  = Keypair::new();

    banks.request_airdrop(initializer.pubkey(), 5_000_000_000).await.unwrap();
    banks.request_airdrop(freelancer.pubkey(),  1_000_000_000).await.unwrap();

    // PDA
    let (pda, _bump) = derive_escrow_pda(
        &program_id,
        &initializer.pubkey(),
        &freelancer.pubkey(),
    ).unwrap();


    // Step 1 — Initialize escrow WITHOUT acceptance

    let amount = 1_000_000_000; // 1 SOL

    // deadline already passed (technically irrelevant because acceptance is missing)
    let now = banks.get_clock().await.unwrap().unix_timestamp;
    let past_deadline = now - 100;

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
            ),
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


    // Verify escrow is initialized BUT NOT accepted

    let escrow_before_acc = banks.get_account(pda).await.unwrap().unwrap();
    let state_before = EscrowAccount::try_from_slice(&escrow_before_acc.data).unwrap();

    assert!(
        !state_before.is_accepted,
        "Escrow MUST NOT be accepted initially"
    );

    // snapshot balances
    let freelancer_before = banks.get_account(freelancer.pubkey()).await.unwrap().unwrap().lamports;
    let pda_before        = escrow_before_acc.lamports;


    // Step 2 — Attempt RELEASE (must FAIL because not accepted)

    let ix_release_data = EscrowInstruction::ReleaseSol
        .try_to_vec()
        .unwrap();

    let ix_release = solana_sdk::instruction::Instruction {
        program_id,
        accounts: vec![
            // initializer signs correctly
            solana_sdk::instruction::AccountMeta::new(initializer.pubkey(), true),
            solana_sdk::instruction::AccountMeta::new(freelancer.pubkey(), false),
            solana_sdk::instruction::AccountMeta::new(pda, false),
            solana_sdk::instruction::AccountMeta::new_readonly(
                solana_program::system_program::id(),
                false,
            ),
        ],
        data: ix_release_data,
    };

    let tx_release = Transaction::new_signed_with_payer(
        &[ix_release],
        Some(&payer.pubkey()),
        &[&payer, &initializer],
        recent_blockhash,
    );

    let result = banks.process_transaction(tx_release).await;

    assert!(
        result.is_err(),
        "Release must FAIL when escrow is not accepted"
    );

    let err = result.unwrap_err().to_string();
    assert!(
        err.contains("NotAccepted")
            || err.contains("InvalidAccountData")
            || err.contains("custom program error"),
        "Expected NotAccepted or similar error, got: {}",
        err
    );


    // Step 3 — Funds must NOT move

    let freelancer_after = banks.get_account(freelancer.pubkey()).await.unwrap().unwrap().lamports;
    let pda_after        = banks.get_account(pda).await.unwrap().unwrap().lamports;

    assert_eq!(
        freelancer_after, freelancer_before,
        "Freelancer MUST NOT receive funds if not accepted"
    );

    assert_eq!(
        pda_after, pda_before,
        "PDA lamports MUST remain unchanged when release fails"
    );


    // Step 4 — State must NOT be modified

    let state_after = EscrowAccount::try_from_slice(
        &banks.get_account(pda).await.unwrap().unwrap().data
    ).unwrap();

    assert!(
        !state_after.is_accepted,
        "is_accepted MUST remain false after failed release"
    );

    assert_eq!(
        state_after.amount, amount,
        "amount MUST remain unchanged"
    );

    println!("C3: Release SOL Without Acceptance Fails — PASSED");
}
