// This test ensures:
  //The initializer tries to use an escrow account that already exists
  //That account is owned by the System Program, not your escrow program
  // Initialization MUST fail
  // Error should be InvalidAccountOwner or InvalidAccountData
  //No lamports transferred
  //State NOT written
  // PDA NOT incorrectly reused


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
    utils::derive_escrow_pda,
};
use borsh::BorshSerialize;

#[tokio::test]
async fn test_initialize_with_wrong_program_owner_fails() {
    let program_id = id();

    let mut pt = ProgramTest::new(
        "escrow_program",
        program_id,
        processor!(escrow_program::processor::process)
    );

    let (mut banks, payer, recent_blockhash) = pt.start().await;


    // Actors
    let initializer = Keypair::new();
    let freelancer = Keypair::new();

    // Airdrop SOL to initializer
    banks
        .request_airdrop(initializer.pubkey(), 4_000_000_000)
        .await
        .unwrap();


    // Correct PDA (only used for seed comparison)

    let (pda, _bump) = derive_escrow_pda(
        &program_id,
        &initializer.pubkey(),
        &freelancer.pubkey(),
    )
    .unwrap();


    // Create an account at the EXACT PDA address
    // BUT owned by SystemProgram (wrong owner)

    //
    // This simulates an attacker or client error trying
    // to force initialization into a non-owned account.
    //
    // Your program must reject this.

    let rent = banks.get_rent().await;
    let lamports = rent.minimum_balance(8); // tiny buffer

    let create_wrong_owner_ix = solana_sdk::system_instruction::create_account(
        &payer.pubkey(),
        &pda,
        lamports,
        8,
        &solana_program::system_program::id(), // WRONG OWNER
    );

    let tx = Transaction::new_signed_with_payer(
        &[create_wrong_owner_ix],
        Some(&payer.pubkey()),
        &[&payer],
        recent_blockhash,
    );

    banks.process_transaction(tx).await.unwrap();

    // Double-check owner is wrong
    let acc_before = banks.get_account(pda).await.unwrap().unwrap();
    assert_eq!(
        acc_before.owner,
        solana_program::system_program::id(),
        "Test setup failed: PDA must be owned by system program"
    );

    // Build InitializeSol instruction (should fail)

    let ix_data = EscrowInstruction::InitializeSol {
        amount: 700_000_000,
        deadline_unix_timestamp: 0,
    }
    .try_to_vec()
    .unwrap();

    let ix = solana_sdk::instruction::Instruction {
        program_id,
        accounts: vec![
            solana_sdk::instruction::AccountMeta::new(initializer.pubkey(), true),
            solana_sdk::instruction::AccountMeta::new_readonly(freelancer.pubkey(), false),
            solana_sdk::instruction::AccountMeta::new(pda, false), // WRONG OWNER HERE
            solana_sdk::instruction::AccountMeta::new_readonly(
                solana_program::system_program::id(),
                false
            ),
        ],
        data: ix_data,
    };

    let tx = Transaction::new_signed_with_payer(
        &[ix],
        Some(&payer.pubkey()),
        &[&payer, &initializer],
        recent_blockhash,
    );

    let result = banks.process_transaction(tx).await;

    // EXPECT FAILURE

    assert!(
        result.is_err(),
        "Initialization should fail when escrow account has wrong owner"
    );

    let err = result.unwrap_err().to_string();

    assert!(
        err.contains("InvalidAccountOwner")
            || err.contains("InvalidAccountData")
            || err.contains("custom program error"),
        "Expected InvalidAccountOwner or equivalent, got: {}",
        err
    );

    // PDA must not be overwritten or modified

    let acc_after = banks.get_account(pda).await.unwrap().unwrap();

    assert_eq!(
        acc_after.owner,
        solana_program::system_program::id(),
        "Escrow account owner unexpectedly changed!"
    );

    // No escrow state written into the wrong account
    assert!(
        acc_after.data.len() <= 8,
        "Escrow state should NOT be written into wrong-owned account"
    );


    // Initializer lamports MUST NOT decrease

    let init_after = banks.get_account(initializer.pubkey()).await.unwrap().unwrap();

    assert!(
        init_after.lamports >= 4_000_000_000,
        "Initializer lost lamports even though initialization failed"
    );

    println!("A7: Initialize With Wrong Program Owner Fails — PASSED");
}
