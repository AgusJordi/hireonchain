//Criteria:
  //escrow initialized
  //accepted = true
  //deadline NOT reached
  //initializer signs release attempt
  //release MUST FAIL
  //NO lamports move
  //state unchanged
  //This test is critical:
  //It ensures your escrow behaves like a true time-locked payout system.

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
async fn test_release_sol_before_deadline_fails() {
    let program_id = id();

    let mut pt = ProgramTest::new(
        "escrow_program",
        program_id,
        processor!(escrow_program::processor::process),
    );

    let (mut banks, payer, recent_blockhash) = pt.start().await;


    // Accounts

    let initializer = Keypair::new();
    let freelancer  = Keypair::new();

    // fund both
    banks.request_airdrop(initializer.pubkey(), 5_000_000_000).await.unwrap();
    banks.request_airdrop(freelancer.pubkey(),  1_000_000_000).await.unwrap();

    // PDA
    let (pda, _bump) = derive_escrow_pda(
        &program_id,
        &initializer.pubkey(),
        &freelancer.pubkey(),
    ).unwrap();


    // Step 1 — Initialize escrow with future deadline

    let amount = 1_500_000_000; // 1.5 SOL

    let now = banks.get_clock().await.unwrap().unix_timestamp;
    let future_deadline = now + 10_000; // far in the future → release MUST fail

    let ix_init_data = EscrowInstruction::InitializeSol {
        amount,
        deadline_unix_timestamp: future_deadline,
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


    // Step 2 — Freelancer ACCEPTS escrow

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


    // Snapshot balances BEFORE illegal release attempt

    let freelancer_before = banks.get_account(freelancer.pubkey()).await.unwrap().unwrap().lamports;
    let pda_before        = banks.get_account(pda).await.unwrap().unwrap().lamports;

    // Confirm accepted
    let state_before = EscrowAccount::try_from_slice(
        &banks.get_account(pda).await.unwrap().unwrap().data
    ).unwrap();

    assert!(state_before.is_accepted);
    assert_eq!(state_before.amount, amount);
    assert_eq!(state_before.deadline_unix_timestamp, future_deadline);


    // Step 3 — TRY to Release BEFORE deadline → MUST FAIL

    let ix_release_data = EscrowInstruction::ReleaseSol
        .try_to_vec()
        .unwrap();

    let ix_release = solana_sdk::instruction::Instruction {
        program_id,
        accounts: vec![
            // initializer signs (correct signer!)
            solana_sdk::instruction::AccountMeta::new(initializer.pubkey(), true),
            solana_sdk::instruction::AccountMeta::new(freelancer.pubkey(), false),
            solana_sdk::instruction::AccountMeta::new(pda, false),
            solana_sdk::instruction::AccountMeta::new_readonly(
                solana_program::system_program::id(), false
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

    // EXPECT FAILURE
    let result = banks.process_transaction(tx_release).await;

    assert!(
        result.is_err(),
        "Release must fail if deadline has NOT passed"
    );

    let err = result.unwrap_err().to_string();
    assert!(
        err.contains("DeadlineNotReached")
            || err.contains("custom program error")
            || err.contains("InvalidAccountData"),
        "Expected DeadlineNotReached or similar, got: {}",
        err
    );


    // Verify NO lamports moved

    let freelancer_after = banks.get_account(freelancer.pubkey()).await.unwrap().unwrap().lamports;
    let pda_after        = banks.get_account(pda).await.unwrap().unwrap().lamports;

    assert_eq!(
        freelancer_after, freelancer_before,
        "Freelancer must not receive SOL before deadline"
    );

    assert_eq!(
        pda_after, pda_before,
        "PDA lamports must not change when release fails"
    );


    // Verify state not modified

    let state_after = EscrowAccount::try_from_slice(
        &banks.get_account(pda).await.unwrap().unwrap().data
    ).unwrap();

    assert!(
        state_after.is_accepted,
        "is_accepted should not change on failed release"
    );

    assert_eq!(
        state_after.amount, amount,
        "amount should not be altered on failed release"
    );

    println!("C2: Release SOL Before Deadline Fails — PASSED");
}
