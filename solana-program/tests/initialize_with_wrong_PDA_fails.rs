//This test ensures the program refuses initialization when the provided escrow account is NOT the correct PDA derived from:
//````css
//["escrow", initializer, freelancer]
//````
//This is crucial to prevent unauthorized accounts from being used as escrow accounts.
// It should fail with:
   // InvalidSeeds (or the equivalent error message)
   // No account created
   // No lamports moved
   // No state written

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
async fn test_initialize_with_wrong_pda_fails() {
    let program_id = id();

    let mut pt = ProgramTest::new(
        "escrow_program",
        program_id,
        processor!(escrow_program::processor::process)
    );

    let (mut banks, payer, recent_blockhash) = pt.start().await;


    // Setup initializer & freelancer

    let initializer = Keypair::new();
    let freelancer = Keypair::new();

    // Airdrop to initializer
    banks
        .request_airdrop(initializer.pubkey(), 4_000_000_000)
        .await
        .unwrap();


    // Derive the CORRECT PDA – but we will NOT use it

    let (correct_pda, _bump) = derive_escrow_pda(
        &program_id,
        &initializer.pubkey(),
        &freelancer.pubkey(),
    )
    .unwrap();


    // Create a FAKE PDA manually (not derived correctly)

    let fake_pda = Keypair::new().pubkey();

    assert_ne!(correct_pda, fake_pda, "Fake PDA must differ from real PDA");


    // Build InitializeSol instruction WITH WRONG PDA

    let ix_data = EscrowInstruction::InitializeSol {
        amount: 500_000_000,
        deadline_unix_timestamp: 0,
    }
    .try_to_vec()
    .unwrap();

    let ix = solana_sdk::instruction::Instruction {
        program_id,
        accounts: vec![
            solana_sdk::instruction::AccountMeta::new(initializer.pubkey(), true),
            solana_sdk::instruction::AccountMeta::new_readonly(freelancer.pubkey(), false),
            // WRONG PDA passed here ↓↓↓↓
            solana_sdk::instruction::AccountMeta::new(fake_pda, false),
            solana_sdk::instruction::AccountMeta::new_readonly(
                solana_program::system_program::id(),
                false,
            ),
        ],
        data: ix_data,
    };


    // Submit transaction (signed correctly, but with wrong PDA)

    let tx = Transaction::new_signed_with_payer(
        &[ix],
        Some(&payer.pubkey()),
        &[&payer, &initializer],
        recent_blockhash,
    );

    let result = banks.process_transaction(tx).await;

    // It MUST fail
    assert!(
        result.is_err(),
        "Initialize should fail when PDA does not match expected seeds"
    );

    let err = result.unwrap_err().to_string();

    assert!(
        err.contains("InvalidSeeds")
            || err.contains("InvalidAccountData")
            || err.contains("custom program error"),
        "Expected InvalidSeeds or equivalent error, got: {}",
        err
    );


    // Fake PDA must NOT exist after the failed transaction

    let maybe_fake_pda = banks.get_account(fake_pda).await.unwrap();
    assert!(
        maybe_fake_pda.is_none(),
        "Fake PDA should NOT be created on failed initialization"
    );


    // Initializer lamports MUST NOT decrease

    let initializer_acc = banks.get_account(initializer.pubkey()).await.unwrap().unwrap();
    assert!(
        initializer_acc.lamports >= 4_000_000_000,
        "Initializer lamports should not decrease when wrong PDA is used"
    );

    println!("A6: Initialize With Wrong PDA Fails — PASSED");
}
