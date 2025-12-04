//Criteria:
//escrow initialized
//escrow accepted
//deadline passed
//someone who is NOT the initializer signs the release
//release MUST FAIL
//NO lamports move
//NO state mutation

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
async fn test_release_sol_by_wrong_signer_fails() {
    let program_id = id();

    let mut pt = ProgramTest::new(
        "escrow_program",
        program_id,
        processor!(escrow_program::processor::process)
    );

    let (mut banks, payer, recent_blockhash) = pt.start().await;


    // Actors

    let initializer = Keypair::new();
    let freelancer  = Keypair::new();
    let attacker    = Keypair::new(); // will attempt illegal release

    banks.request_airdrop(initializer.pubkey(), 5_000_000_000).await.unwrap();
    banks.request_airdrop(freelancer.pubkey(),  1_000_000_000).await.unwrap();
    banks.request_airdrop(attacker.pubkey(),    1_000_000_000).await.unwrap();

    // PDA
    let (pda, _bump) = derive_escrow_pda(
        &program_id,
        &initializer.pubkey(),
        &freelancer.pubkey(),
    ).unwrap();


    // Step 1 — Initialize escrow

    let amount = 2_000_000_000;

    // already passed deadline
    let now = banks.get_clock().await.unwrap().unix_timestamp;
    let past_deadline = now - 999;

    let ix_init_data = EscrowInstruction::InitializeSol {
        amount,
        deadline_unix_timestamp: past_deadline,
    }.try_to_vec().unwrap();

    let ix_init = solana_sdk::instruction::Instruction {
        program_id,
        accounts: vec![
            solana_sdk::instruction::AccountMeta::new(initializer.pubkey(), true),
            solana_sdk::instruction::AccountMeta::new_readonly(freelancer.pubkey(), false),
            solana_sdk::instruction::AccountMeta::new(pda, false),
            solana_sdk::instruction::AccountMeta::new_readonly(
                solana_program::system_program::id(), false
            )
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


    // Step 2 — Freelancer ACCEPTS escrow

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

    let tx_accept = Transaction::new_signed_with_payer(
        &[ix_accept],
        Some(&payer.pubkey()),
        &[&payer, &freelancer],
        recent_blockhash,
    );

    banks.process_transaction(tx_accept).await.unwrap();

    // Confirm accepted
    let state_before = EscrowAccount::try_from_slice(
        &banks.get_account(pda).await.unwrap().unwrap().data
    ).unwrap();
    assert!(state_before.is_accepted);

    // Balances before illegal release attempt
    let freelancer_before = banks.get_account(freelancer.pubkey()).await.unwrap().unwrap().lamports;
    let pda_before        = banks.get_account(pda).await.unwrap().unwrap().lamports;


    // Step 3 — WRONG SIGNER (attacker) attempts release

    let ix_release_data = EscrowInstruction::ReleaseSol
        .try_to_vec()
        .unwrap();

    let ix_release = solana_sdk::instruction::Instruction {
        program_id,
        accounts: vec![
            // WRONG SIGNER: attacker instead of initializer
            solana_sdk::instruction::AccountMeta::new(attacker.pubkey(), true),
            solana_sdk::instruction::AccountMeta::new(freelancer.pubkey(), false),
            solana_sdk::instruction::AccountMeta::new(pda, false),
            solana_sdk::instruction::AccountMeta::new_readonly(
                solana_program::system_program::id(), false
            )
        ],
        data: ix_release_data,
    };

    let tx_release = Transaction::new_signed_with_payer(
        &[ix_release],
        Some(&payer.pubkey()),
        &[&payer, &attacker], // attacker signs → illegal
        recent_blockhash,
    );

    let result = banks.process_transaction(tx_release).await;


    // MUST FAIL

    assert!(
        result.is_err(),
        "Release must fail when a non-initializer attempts it"
    );

    let err = result.unwrap_err().to_string();
    assert!(
        err.contains("IllegalOwner")
            || err.contains("MissingRequiredSignature")
            || err.contains("custom program error"),
        "Expected IllegalOwner or similar, got: {}", err
    );


    // NO FUNDS MAY MOVE

    let freelancer_after = banks.get_account(freelancer.pubkey()).await.unwrap().unwrap().lamports;
    let pda_after        = banks.get_account(pda).await.unwrap().unwrap().lamports;

    assert_eq!(
        freelancer_after, freelancer_before,
        "Freelancer must not receive funds from illegal release"
    );

    assert_eq!(
        pda_after, pda_before,
        "PDA lamports must not change when release fails"
    );


    // State remains unchanged

    let state_after = EscrowAccount::try_from_slice(
        &banks.get_account(pda).await.unwrap().unwrap().data
    ).unwrap();

    assert!(state_after.is_accepted);
    assert_eq!(state_after.amount, amount);

    println!("C4: Release SOL By Wrong Signer Fails — PASSED");
}
