use solana_program_test::*;
use solana_sdk::{
    account::Account,
    pubkey::Pubkey,
    signature::Keypair,
    signer::Signer,
    transaction::Transaction,
    system_instruction,
};
use escrow_program::{
    id,
    instruction::EscrowInstruction,
    state::EscrowAccount,
};
use borsh::BorshDeserialize;

#[tokio::test]
async fn test_initialize_sol_success() {

    // Setup program test environment

    let program_id = id();

    let mut pt = ProgramTest::new(
        "escrow_program",
        program_id,
        processor!(escrow_program::processor::process)
    );

    let (mut banks, payer, recent_blockhash) = pt.start().await;


    // Create initializer + freelancer

    let initializer = Keypair::new();
    let freelancer = Keypair::new();

    // Airdrop SOL to initializer
    banks
        .request_airdrop(initializer.pubkey(), 5_000_000_000)
        .await
        .unwrap();


    // Derive expected PDA

    let (escrow_pda, _bump) = escrow_program::utils::derive_escrow_pda(
        &program_id,
        &initializer.pubkey(),
        &freelancer.pubkey(),
    )
    .unwrap();


    // Build InitializeSol Instruction

    let ix_data = EscrowInstruction::InitializeSol {
        amount: 1_000_000_000, // 1 SOL
        deadline_unix_timestamp: 0, // not used for simple initialize
    }
    .try_to_vec()
    .unwrap();

    let ix = solana_sdk::instruction::Instruction {
        program_id,
        accounts: vec![
            solana_sdk::instruction::AccountMeta::new(initializer.pubkey(), true),
            solana_sdk::instruction::AccountMeta::new_readonly(freelancer.pubkey(), false),
            solana_sdk::instruction::AccountMeta::new(escrow_pda, false),
            solana_sdk::instruction::AccountMeta::new_readonly(solana_program::system_program::id(), false),
        ],
        data: ix_data,
    };

    // Submit TX
    let tx = Transaction::new_signed_with_payer(
        &[ix],
        Some(&payer.pubkey()),
        &[&payer, &initializer],
        recent_blockhash,
    );

    banks.process_transaction(tx).await.unwrap();


    // Assertions

    // 1. PDA account exists
    let escrow_acc = banks
        .get_account(escrow_pda)
        .await
        .expect("Escrow PDA should exist")
        .expect("Account should be Some");

    // 2. PDA owned by program
    assert_eq!(escrow_acc.owner, program_id, "PDA has wrong owner");

    // 3. Rent exempt
    let rent = banks.get_rent().await;
    assert!(
        escrow_acc.lamports >= rent.minimum_balance(EscrowAccount::LEN),
        "Escrow PDA is not rent exempt"
    );

    // 4. State deserialization
    let state = EscrowAccount::try_from_slice(&escrow_acc.data)
        .expect("Invalid escrow account state");

    assert_eq!(state.initializer, initializer.pubkey());
    assert_eq!(state.freelancer, freelancer.pubkey());
    assert_eq!(state.amount, 1_000_000_000);
    assert_eq!(state.is_initialized, true);
    assert_eq!(state.is_token_escrow, false);
    assert_eq!(state.token_mint, Pubkey::default());
    assert_eq!(state.is_accepted, false);

    // 5. Lamports transferred from initializer → PDA
    let initializer_after = banks
        .get_account(initializer.pubkey())
        .await
        .unwrap()
        .unwrap();

    assert!(
        initializer_after.lamports < 5_000_000_000,
        "Initializer lamports did not decrease"
    );

    println!("A1: SOL Initialize Success — PASSED");
}
