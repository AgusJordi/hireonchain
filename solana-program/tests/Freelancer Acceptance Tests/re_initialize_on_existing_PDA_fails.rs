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
async fn test_reinitialize_on_existing_pda_fails() {
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

    banks
        .request_airdrop(initializer.pubkey(), 5_000_000_000)
        .await
        .unwrap();

    // Derive PDA
    let (pda, _bump) = derive_escrow_pda(
        &program_id,
        &initializer.pubkey(),
        &freelancer.pubkey(),
    )
    .unwrap();


    // FIRST INITIALIZATION - should work

    let ix1_data = EscrowInstruction::InitializeSol {
        amount: 1_000_000_000,
        deadline_unix_timestamp: 0,
    }
    .try_to_vec()
    .unwrap();

    let ix1 = solana_sdk::instruction::Instruction {
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
        data: ix1_data,
    };

    let tx1 = Transaction::new_signed_with_payer(
        &[ix1],
        Some(&payer.pubkey()),
        &[&payer, &initializer],
        recent_blockhash,
    );

    banks.process_transaction(tx1).await.unwrap();

    // Ensure PDA now exists
    let escrow_acc_before = banks.get_account(pda).await.unwrap().unwrap();
    assert_eq!(escrow_acc_before.owner, program_id);

    let state_before =
        EscrowAccount::try_from_slice(&escrow_acc_before.data).unwrap();
    assert!(state_before.is_initialized);


    // SECOND INITIALIZATION (same PDA) - MUST FAIL

    let ix2_data = EscrowInstruction::InitializeSol {
        amount: 2_000_000_000,
        deadline_unix_timestamp: 0,
    }
    .try_to_vec()
    .unwrap();

    let ix2 = solana_sdk::instruction::Instruction {
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
        data: ix2_data,
    };

    let tx2 = Transaction::new_signed_with_payer(
        &[ix2],
        Some(&payer.pubkey()),
        &[&payer, &initializer],
        recent_blockhash,
    );

    // MUST FAIL
    let result = banks.process_transaction(tx2).await;
    assert!(
        result.is_err(),
        "Re-initializing an existing PDA must fail"
    );

    let err = result.unwrap_err().to_string();

    assert!(
        err.contains("AccountAlreadyInitialized")
            || err.contains("InvalidAccountData")
            || err.contains("custom program error"),
        "Expected account already initialized, got: {}",
        err
    );


    // STATE MUST REMAIN UNCHANGED

    let escrow_acc_after = banks.get_account(pda).await.unwrap().unwrap();
    let state_after =
        EscrowAccount::try_from_slice(&escrow_acc_after.data).unwrap();

    assert_eq!(
        state_before.amount, state_after.amount,
        "Re-init attempt should NOT modify escrow amount"
    );

    assert_eq!(
        state_before.initializer, state_after.initializer,
        "Re-init attempt should NOT overwrite initializer"
    );

    assert_eq!(
        state_before.freelancer, state_after.freelancer,
        "Re-init attempt should NOT overwrite freelancer"
    );

    assert!(
        state_after.is_initialized,
        "Escrow should remain initialized"
    );

    println!("A9: Re-Initialize on Existing PDA Fails — PASSED");
}
