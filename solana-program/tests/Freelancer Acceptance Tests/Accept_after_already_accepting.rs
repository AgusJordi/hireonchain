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
use borsh::BorshSerialize;

#[tokio::test]
async fn test_accept_after_already_accepting() {
    let program_id = id();

    let mut pt = ProgramTest::new(
        "escrow_program",
        program_id,
        processor!(escrow_program::processor::process),
    );

    let (mut banks, payer, recent_blockhash) = pt.start().await;


    // Setup: initializer + freelancer

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


    // Step 1: Initialize Escrow

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


    // Step 2: FIRST Acceptance (must succeed)

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

    let tx_accept_1 = Transaction::new_signed_with_payer(
        &[ix_accept.clone()],
        Some(&payer.pubkey()),
        &[&payer, &freelancer],
        recent_blockhash,
    );

    banks.process_transaction(tx_accept_1).await.unwrap();

    // Verify accepted
    let state_after_first = EscrowAccount::try_from_slice(
        &banks.get_account(pda).await.unwrap().unwrap().data,
    )
    .unwrap();

    assert!(state_after_first.is_accepted);

    // Step 3: SECOND Acceptance (must FAIL)

    let tx_accept_2 = Transaction::new_signed_with_payer(
        &[ix_accept],
        Some(&payer.pubkey()),
        &[&payer, &freelancer],
        recent_blockhash,
    );

    let result = banks.process_transaction(tx_accept_2).await;

    assert!(
        result.is_err(),
        "Second acceptance must fail (reinit prevention)"
    );

    let err = result.unwrap_err().to_string();

    assert!(
        err.contains("AlreadyAccepted")
            || err.contains("InvalidAccountData")
            || err.contains("custom program error"),
        "Expected AlreadyAccepted or equivalent error, got: {}",
        err
    );


    // State MUST remain accepted and unchanged

    let state_after_second = EscrowAccount::try_from_slice(
        &banks.get_account(pda).await.unwrap().unwrap().data,
    )
    .unwrap();

    assert!(
        state_after_second.is_accepted,
        "is_accepted must remain true after failed second accept"
    );

    assert_eq!(
        state_after_second.initializer, initializer.pubkey(),
        "initializer changed unexpectedly"
    );

    assert_eq!(
        state_after_second.freelancer, freelancer.pubkey(),
        "freelancer changed unexpectedly"
    );

    println!("B4: Accept After Already Accepting — PASSED");
}
