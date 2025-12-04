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
async fn test_initialize_sol_with_deadline_success() {
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

    // Fund initializer
    banks
        .request_airdrop(initializer.pubkey(), 5_000_000_000)
        .await
        .unwrap();

    // Derived PDA
    let (escrow_pda, _bump) = derive_escrow_pda(
        &program_id,
        &initializer.pubkey(),
        &freelancer.pubkey(),
    ).unwrap();

    // Deadline = now + 3600
    let deadline: i64 = (banks.get_clock().await.unwrap().unix_timestamp + 3600);

    // Build instruction
    let ix_data = EscrowInstruction::InitializeSolWithDeadline {
        amount: 1_500_000_000, // 1.5 SOL
        deadline_unix_timestamp: deadline,
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

    // Send tx
    let tx = Transaction::new_signed_with_payer(
        &[ix],
        Some(&payer.pubkey()),
        &[&payer, &initializer],
        recent_blockhash,
    );

    banks.process_transaction(tx).await.unwrap();

    // Fetch escrow PDA
    let escrow_acc = banks
        .get_account(escrow_pda)
        .await
        .unwrap()
        .unwrap();

    // Deserialize state
    let state = EscrowAccount::try_from_slice(&escrow_acc.data).unwrap();

    // Assertions
    assert_eq!(state.initializer, initializer.pubkey());
    assert_eq!(state.freelancer, freelancer.pubkey());
    assert_eq!(state.amount, 1_500_000_000);
    assert_eq!(state.is_initialized, true);
    assert_eq!(state.deadline_unix_timestamp, deadline);
    assert_eq!(state.is_token_escrow, false);

    println!("A2: SOL Initialize + Deadline — PASSED");
}
