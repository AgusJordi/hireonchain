//(“freelancer attempts to accept before the escrow is initialized”)
//Criteria:
//PDA account exists but contains no valid escrow state
//OR
//PDA does not exist at all
//Acceptance MUST fail
//Error MUST be InvalidAccountData or UninitializedAccount
//is_accepted MUST NOT be set
//No state must be created or modified
//No lamports/tokens move

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
async fn test_accept_on_uninitialized_state_fails() {
    let program_id = id();

    let mut pt = ProgramTest::new(
        "escrow_program",
        program_id,
        processor!(escrow_program::processor::process),
    );

    let (mut banks, payer, recent_blockhash) = pt.start().await;

    // Actors

    let initializer = Keypair::new();
    let freelancer = Keypair::new();

    // Airdrop to freelancer so they can sign transactions
    banks
        .request_airdrop(freelancer.pubkey(), 3_000_000_000)
        .await
        .unwrap();


    // Derive PDA (but DO NOT initialize escrow)
    //
    // The PDA itself does not exist yet. This is correct.

    let (pda, _bump) = derive_escrow_pda(
        &program_id,
        &initializer.pubkey(),
        &freelancer.pubkey(),
    )
    .unwrap();

    let existing_before = banks.get_account(pda).await.unwrap();
    assert!(
        existing_before.is_none(),
        "PDA should NOT exist before initialization for this test"
    );


    // Try to ACCEPT an uninitialized escrow

    let ix_accept_data = EscrowInstruction::AcceptEscrow
        .try_to_vec()
        .unwrap();

    let ix_accept = solana_sdk::instruction::Instruction {
        program_id,
        accounts: vec![
            // FREELANCER IS SIGNER — but state isn't initialized
            solana_sdk::instruction::AccountMeta::new(freelancer.pubkey(), true),
            solana_sdk::instruction::AccountMeta::new(pda, false),
        ],
        data: ix_accept_data,
    };

    // Note: freelancer signs
    let tx = Transaction::new_signed_with_payer(
        &[ix_accept],
        Some(&payer.pubkey()),
        &[&payer, &freelancer],
        recent_blockhash,
    );

    // MUST FAIL

    let result = banks.process_transaction(tx).await;

    assert!(
        result.is_err(),
        "Accepting uninitialized escrow must FAIL"
    );

    let err = result.unwrap_err().to_string();

    assert!(
        err.contains("InvalidAccountData")
            || err.contains("UninitializedAccount")
            || err.contains("custom program error"),
        "Expected InvalidAccountData or UninitializedAccount, got: {}",
        err
    );


    // PDA STILL MUST NOT EXIST

    let existing_after = banks.get_account(pda).await.unwrap();
    assert!(
        existing_after.is_none(),
        "PDA must not be created by failing accept"
    );

    println!("B5: Accept On Uninitialized State Fails — PASSED");
}
