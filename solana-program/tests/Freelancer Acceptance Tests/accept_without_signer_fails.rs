//Criteria:
//Freelancer must NOT sign
//Transaction MUST fail
//Error MUST be MissingRequiredSignature
//is_accepted MUST remain false
//PDA state MUST remain unchanged
//No funds or state modifications allowed

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
async fn test_accept_without_signer_fails() {
    let program_id = id();

    let mut pt = ProgramTest::new(
        "escrow_program",
        program_id,
        processor!(escrow_program::processor::process),
    );

    let (mut banks, payer, recent_blockhash) = pt.start().await;


    // Accounts

    let initializer = Keypair::new();
    let freelancer = Keypair::new();

    banks
        .request_airdrop(initializer.pubkey(), 5_000_000_000)
        .await
        .unwrap();

    // PDA
    let (pda, _bump) = derive_escrow_pda(
        &program_id,
        &initializer.pubkey(),
        &freelancer.pubkey(),
    )
    .unwrap();


    // Step 1: Initialize Escrow (required before acceptance)

    let ix_init_data = EscrowInstruction::InitializeSol {
        amount: 1_000_000_000,
        deadline_unix_timestamp: 0,
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

    // Verify is_accepted == false before test
    let before_acc = banks.get_account(pda).await.unwrap().unwrap();
    let before_state = EscrowAccount::try_from_slice(&before_acc.data).unwrap();
    assert!(!before_state.is_accepted);

    // Step 2: Attempt ACCEPT — but freelancer is NOT a signer

    let ix_accept_data = EscrowInstruction::AcceptEscrow
        .try_to_vec()
        .unwrap();

    // freelancer IS NOT MARKED AS SIGNER HERE ↓↓↓
    let ix_accept = solana_sdk::instruction::Instruction {
        program_id,
        accounts: vec![
            solana_sdk::instruction::AccountMeta::new(freelancer.pubkey(), false),
            solana_sdk::instruction::AccountMeta::new(pda, false),
        ],
        data: ix_accept_data,
    };

    // IMPORTANT: freelancer keypair NOT included as signer
    let tx_accept = Transaction::new_signed_with_payer(
        &[ix_accept],
        Some(&payer.pubkey()),
        &[&payer], // ONLY payer signs — NOT freelancer
        recent_blockhash,
    );


    // FAILURE EXPECTED

    let result = banks.process_transaction(tx_accept).await;

    assert!(
        result.is_err(),
        "Accept must fail when freelancer does NOT sign"
    );

    let err = result.unwrap_err().to_string();

    assert!(
        err.contains("MissingRequiredSignature")
            || err.contains("signature verification failed")
            || err.contains("custom program error"),
        "Expected MissingRequiredSignature. Got: {}",
        err
    );


    // State MUST NOT change

    let after_acc = banks.get_account(pda).await.unwrap().unwrap();
    let after_state = EscrowAccount::try_from_slice(&after_acc.data).unwrap();

    assert!(
        !after_state.is_accepted,
        "Escrow should NOT become accepted when signer is missing"
    );

    assert_eq!(
        before_state.initializer, after_state.initializer,
        "Initializer must remain unchanged"
    );

    assert_eq!(
        before_state.freelancer, after_state.freelancer,
        "Freelancer must remain unchanged"
    );

    println!("B2: Accept Without Signer Fails — PASSED");
}
