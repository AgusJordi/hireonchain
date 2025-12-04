//Criteria:
//freelancer signs
//state.is_accepted becomes true
//PDA matches
//Escrow must already be initialized
//No lamport/token movement occurs

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
async fn test_accept_success() {
    let program_id = id();

    let mut pt = ProgramTest::new(
        "escrow_program",
        program_id,
        processor!(escrow_program::processor::process),
    );

    let (mut banks, payer, recent_blockhash) = pt.start().await;

    // Create initializer + freelancer
    let initializer = Keypair::new();
    let freelancer = Keypair::new();

    // Fund initializer
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


    // FIRST: Initialize Escrow (needed before acceptance)

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

    // Verify escrow is initialized but NOT accepted
    let acc_before = banks.get_account(pda).await.unwrap().unwrap();
    let state_before = EscrowAccount::try_from_slice(&acc_before.data).unwrap();

    assert!(!state_before.is_accepted, "Escrow must not be accepted initially");


    // SECOND: ACCEPT Escrow (freelancer must sign)

    let ix_accept_data = EscrowInstruction::AcceptEscrow
        .try_to_vec()
        .unwrap();

    let ix_accept = solana_sdk::instruction::Instruction {
        program_id,
        accounts: vec![
            // freelancer must sign here
            solana_sdk::instruction::AccountMeta::new(freelancer.pubkey(), true),
            solana_sdk::instruction::AccountMeta::new(pda, false),
        ],
        data: ix_accept_data,
    };

    let tx_accept = Transaction::new_signed_with_payer(
        &[ix_accept],
        Some(&payer.pubkey()),
        &[&payer, &freelancer], // freelancer IS SIGNER
        recent_blockhash,
    );

    banks.process_transaction(tx_accept).await.unwrap();


    // Assertions AFTER acceptance

    let acc_after = banks.get_account(pda).await.unwrap().unwrap();
    let state_after = EscrowAccount::try_from_slice(&acc_after.data).unwrap();

    assert!(
        state_after.is_accepted,
        "Escrow must be marked as accepted after freelancer signs"
    );

    assert_eq!(
        state_after.freelancer, freelancer.pubkey(),
        "Freelancer pubkey must remain unchanged"
    );

    assert_eq!(
        state_after.initializer, initializer.pubkey(),
        "Initializer pubkey must remain unchanged"
    );

    println!("B1: Successful Acceptance — PASSED");
}
