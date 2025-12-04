//What this test covers
//Escrow is initialized
//Escrow is accepted
//Deadline is passed
//Initializer signs release
//BUT a wrong/unrelated freelancer account is passed
//→ Release MUST FAIL
//→ No lamports move
//→ State MUST remain unchanged
//This prevents an attacker from hijacking escrow funds by passing their own wallet as “freelancer”.

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
async fn test_release_sol_to_wrong_freelancer_fails() {
    let program_id = id();

    let mut pt = ProgramTest::new(
        "escrow_program",
        program_id,
        processor!(escrow_program::processor::process)
    );

    let (mut banks, payer, recent_blockhash) = pt.start().await;


    // Actors

    let initializer   = Keypair::new();
    let freelancer    = Keypair::new(); // real freelancer
    let wrong_account = Keypair::new(); // attacker trying to receive funds

    banks.request_airdrop(initializer.pubkey(),   5_000_000_000).await.unwrap();
    banks.request_airdrop(freelancer.pubkey(),    1_000_000_000).await.unwrap();
    banks.request_airdrop(wrong_account.pubkey(), 1_000_000_000).await.unwrap();


    // PDA

    let (pda, _bump) = derive_escrow_pda(
        &program_id,
        &initializer.pubkey(),
        &freelancer.pubkey(),
    ).unwrap();


    // Step 1 — Initialize Escrow

    let amount = 1_500_000_000;

    // Passed deadline
    let now = banks.get_clock().await.unwrap().unix_timestamp;
    let past_deadline = now - 500;

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
                solana_program::system_program::id(), false
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

    // Check acceptance
    let state_before = EscrowAccount::try_from_slice(
        &banks.get_account(pda).await.unwrap().unwrap().data
    ).unwrap();
    assert!(state_before.is_accepted);


    // Snapshot balances BEFORE the illegal release

    let wrong_before = banks.get_account(wrong_account.pubkey()).await.unwrap().unwrap().lamports;
    let pda_before   = banks.get_account(pda).await.unwrap().unwrap().lamports;


    // Step 3 — Attempt RELEASE to a WRONG freelancer account

    let ix_release_data = EscrowInstruction::ReleaseSol
        .try_to_vec()
        .unwrap();

    let ix_release_wrong = solana_sdk::instruction::Instruction {
        program_id,
        accounts: vec![
            // initializer signs correctly
            solana_sdk::instruction::AccountMeta::new(initializer.pubkey(), true),

            // wrong recipient
            solana_sdk::instruction::AccountMeta::new(wrong_account.pubkey(), false),

            // correct escrow PDA
            solana_sdk::instruction::AccountMeta::new(pda, false),

            solana_sdk::instruction::AccountMeta::new_readonly(
                solana_program::system_program::id(),
                false
            ),
        ],
        data: ix_release_data,
    };

    let tx_release = Transaction::new_signed_with_payer(
        &[ix_release_wrong],
        Some(&payer.pubkey()),
        &[&payer, &initializer],
        recent_blockhash,
    );

    let result = banks.process_transaction(tx_release).await;


    // MUST FAIL

    assert!(
        result.is_err(),
        "Release must FAIL when wrong freelancer account is supplied"
    );

    let err = result.unwrap_err().to_string();
    assert!(
        err.contains("InvalidAccountData")
            || err.contains("IllegalOwner")
            || err.contains("custom program error"),
        "Expected InvalidAccountData or IllegalOwner. Got: {}", err
    );


    // Balances must NOT change

    let wrong_after = banks.get_account(wrong_account.pubkey()).await.unwrap().unwrap().lamports;
    let pda_after   = banks.get_account(pda).await.unwrap().unwrap().lamports;

    assert_eq!(
        wrong_after, wrong_before,
        "Wrong freelancer MUST NOT receive any lamports"
    );

    assert_eq!(
        pda_after, pda_before,
        "PDA lamports MUST remain untouched when release fails"
    );


    // State must remain unchanged

    let state_after = EscrowAccount::try_from_slice(
        &banks.get_account(pda).await.unwrap().unwrap().data
    ).unwrap();

    assert!(state_after.is_accepted);
    assert_eq!(state_after.amount, amount);

    println!("C6: Release To Wrong Freelancer Account Fails — PASSED");
}
