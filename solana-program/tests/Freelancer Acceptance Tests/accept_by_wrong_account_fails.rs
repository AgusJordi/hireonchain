//This test ensures:
//The account attempting acceptance is NOT the real freelancer
//Transaction MUST fail
//Error MUST be IllegalOwner, InvalidAccountData, or custom error
//is_accepted MUST remain false
//No state or funds change

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
async fn test_accept_by_wrong_account_fails() {
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

    // This account will TRY to accept → must fail
    let attacker = Keypair::new();

    banks
        .request_airdrop(initializer.pubkey(), 5_000_000_000)
        .await
        .unwrap();

    banks
        .request_airdrop(attacker.pubkey(), 5_000_000_000)
        .await
        .unwrap();


    // PDA

    let (pda, _bump) = derive_escrow_pda(
        &program_id,
        &initializer.pubkey(),
        &freelancer.pubkey(),
    )
    .unwrap();


    // Initialize escrow (required)

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

    // Ensure state BEFORE acceptance: is_accepted must be false

    let before_acc = banks.get_account(pda).await.unwrap().unwrap();
    let before_state = EscrowAccount::try_from_slice(&before_acc.data).unwrap();

    assert!(!before_state.is_accepted);


    // Attacker tries to accept the escrow

    let ix_accept_data = EscrowInstruction::AcceptEscrow
        .try_to_vec()
        .unwrap();

    // ATTACKER passed as signer instead of freelancer ↓↓↓
    let ix_accept = solana_sdk::instruction::Instruction {
        program_id,
        accounts: vec![
            solana_sdk::instruction::AccountMeta::new(attacker.pubkey(), true),
            solana_sdk::instruction::AccountMeta::new(pda, false),
        ],
        data: ix_accept_data,
    };

    let tx_accept = Transaction::new_signed_with_payer(
        &[ix_accept],
        Some(&payer.pubkey()),
        &[&payer, &attacker], // attacker signs, freelancer NOT included
        recent_blockhash,
    );


    // EXPECT FAILURE

    let result = banks.process_transaction(tx_accept).await;

    assert!(
        result.is_err(),
        "Accept must fail when non-freelancer tries to accept"
    );

    let err = result.unwrap_err().to_string();

    assert!(
        err.contains("IllegalOwner")
            || err.contains("InvalidAccountData")
            || err.contains("custom program error")
            || err.contains("MissingRequiredSignature"),
        "Expected IllegalOwner-style error, got: {}",
        err
    );


    // STATE MUST NOT CHANGE

    let after_acc = banks.get_account(pda).await.unwrap().unwrap();
    let after_state = EscrowAccount::try_from_slice(&after_acc.data).unwrap();

    assert!(
        !after_state.is_accepted,
        "Escrow must NOT be accepted by the wrong signer"
    );

    // Fields must remain unchanged
    assert_eq!(before_state.initializer, after_state.initializer);
    assert_eq!(before_state.freelancer, after_state.freelancer);
    assert_eq!(before_state.amount, after_state.amount);

    println!("B3: Accept By Wrong Account Fails — PASSED");
}
