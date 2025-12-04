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
    state::EscrowAccount,
};
use borsh::BorshDeserialize;

#[tokio::test]
async fn test_initialize_without_signer_fails() {
    let program_id = id();

    let mut pt = ProgramTest::new(
        "escrow_program",
        program_id,
        processor!(escrow_program::processor::process),
    );

    let (mut banks, payer, recent_blockhash) = pt.start().await;


    // Create initializer and freelancer

    let initializer = Keypair::new();
    let freelancer = Keypair::new();

    // Fund initializer
    banks
        .request_airdrop(initializer.pubkey(), 3_000_000_000)
        .await
        .unwrap();

    // Expected PDA
    let (escrow_pda, _bump) = derive_escrow_pda(
        &program_id,
        &initializer.pubkey(),
        &freelancer.pubkey(),
    )
    .unwrap();


    // Build InitializeSol instruction — BUT DO NOT SIGN initializer

    let ix_data = EscrowInstruction::InitializeSol {
        amount: 500_000_000,
        deadline_unix_timestamp: 0,
    }
    .try_to_vec()
    .unwrap();

    let ix = solana_sdk::instruction::Instruction {
        program_id,
        accounts: vec![
            // <-- initializer must be a signer, but isSigner=false → should fail
            solana_sdk::instruction::AccountMeta::new(initializer.pubkey(), false),
            solana_sdk::instruction::AccountMeta::new_readonly(freelancer.pubkey(), false),
            solana_sdk::instruction::AccountMeta::new(escrow_pda, false),
            solana_sdk::instruction::AccountMeta::new_readonly(
                solana_program::system_program::id(),
                false,
            ),
        ],
        data: ix_data,
    };

    // Create a TX signed ONLY by payer, NOT initializer → should fail
    let tx = Transaction::new_signed_with_payer(
        &[ix],
        Some(&payer.pubkey()),
        &[&payer], // <-- initializer NOT included
        recent_blockhash,
    );


    // The transaction MUST fail with missing signature

    let result = banks.process_transaction(tx).await;
    assert!(
        result.is_err(),
        "Initialize should fail when initializer is not a signer"
    );

    let err = result.unwrap_err().to_string();
    assert!(
        err.contains("MissingRequiredSignature"),
        "Expected MissingRequiredSignature, got: {}",
        err
    );


    // Account MUST NOT be created

    let maybe_escrow_acc = banks.get_account(escrow_pda).await.unwrap();
    assert!(
        maybe_escrow_acc.is_none(),
        "Escrow PDA should NOT exist when initializer is not signer"
    );


    // Initializer lamports MUST remain unchanged

    let init_acc = banks.get_account(initializer.pubkey()).await.unwrap().unwrap();
    assert!(
        init_acc.lamports >= 3_000_000_000,
        "Initializer lost lamports even though transaction failed"
    );

    println!("A5: Initialize Without Signer Fails — PASSED");
}
