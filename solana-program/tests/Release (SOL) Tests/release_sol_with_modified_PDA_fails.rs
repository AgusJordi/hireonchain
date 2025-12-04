//Criteria:
//Escrow initialized
//Escrow accepted
//Deadline passed
//Initializer signs the release (correct signer!)
//BUT the PDA account passed in the instruction is NOT the real PDA
//Therefore release MUST FAIL
//NO lamports move
//State remains unchanged
//This test ensures the program is resistant to PDA spoofing attacks, where an attacker tries to feed the program a fake PDA to misdirect or bypass the escrow.

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
async fn test_release_sol_with_modified_pda_fails() {
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

    banks.request_airdrop(initializer.pubkey(), 5_000_000_000).await.unwrap();
    banks.request_airdrop(freelancer.pubkey(),  1_000_000_000).await.unwrap();

    // REAL PDA
    let (real_pda, _bump) = derive_escrow_pda(
        &program_id,
        &initializer.pubkey(),
        &freelancer.pubkey(),
    ).unwrap();

    // FAKE PDA (attacker supplies this instead)
    let fake_pda = Keypair::new().pubkey();

    // Step 1 — Initialize escrow (with real PDA)

    let amount = 1_500_000_000;

    let now = banks.get_clock().await.unwrap().unix_timestamp;
    let past_deadline = now - 999; // deadline already passed → release allowed

    let ix_init_data = EscrowInstruction::InitializeSol {
        amount,
        deadline_unix_timestamp: past_deadline,
    }
    .try_to_vec()
    .unwrap();

    let ix_init = solana_sdk::instruction::Instruction {
        program_id,
        accounts: vec![
            solana_sdk::instruction::AccountMeta::new(initializer.pubkey(), true),
            solana_sdk::instruction::AccountMeta::new_readonly(freelancer.pubkey(), false),
            solana_sdk::instruction::AccountMeta::new(real_pda, false), // REAL PDA
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

    let ix_accept_data = EscrowInstruction::AcceptEscrow.try_to_vec().unwrap();

    let ix_accept = solana_sdk::instruction::Instruction {
        program_id,
        accounts: vec![
            solana_sdk::instruction::AccountMeta::new(freelancer.pubkey(), true),
            solana_sdk::instruction::AccountMeta::new(real_pda, false),
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

    // Verify acceptance
    let state_before = EscrowAccount::try_from_slice(
        &banks.get_account(real_pda).await.unwrap().unwrap().data
    ).unwrap();

    assert!(state_before.is_accepted);


    // Snapshot balances BEFORE illegal release

    let freelancer_before = banks.get_account(freelancer.pubkey()).await.unwrap().unwrap().lamports;
    let pda_before        = banks.get_account(real_pda).await.unwrap().unwrap().lamports;


    // Step 3 — Attempt to release using a **MODIFIED PDA**

    let ix_release_data = EscrowInstruction::ReleaseSol.try_to_vec().unwrap();

    let ix_release = solana_sdk::instruction::Instruction {
        program_id,
        accounts: vec![
            // Correct signer
            solana_sdk::instruction::AccountMeta::new(initializer.pubkey(), true),

            // Correct freelancer
            solana_sdk::instruction::AccountMeta::new(freelancer.pubkey(), false),

            //  WRONG PDA → attacker tries to bypass escrow
            solana_sdk::instruction::AccountMeta::new(fake_pda, false),

            solana_sdk::instruction::AccountMeta::new_readonly(
                solana_program::system_program::id(), false
            )
        ],
        data: ix_release_data,
    };

    let tx_release = Transaction::new_signed_with_payer(
        &[ix_release],
        Some(&payer.pubkey()),
        &[&payer, &initializer], // attacker cannot fake signature here
        recent_blockhash,
    );

    let result = banks.process_transaction(tx_release).await;


    // MUST FAIL

    assert!(
        result.is_err(),
        "Release must FAIL when PDA is modified/fake"
    );

    let err = result.unwrap_err().to_string();
    assert!(
        err.contains("InvalidAccountData")
            || err.contains("IllegalOwner")
            || err.contains("custom program error")
            || err.contains("AccountNotInitialized"),
        "Expected invalid PDA error, got: {}", err
    );


    // No lamports may move

    let freelancer_after = banks.get_account(freelancer.pubkey()).await.unwrap().unwrap().lamports;
    let pda_after        = banks.get_account(real_pda).await.unwrap().unwrap().lamports;

    assert_eq!(
        freelancer_after, freelancer_before,
        "Freelancer MUST NOT receive funds when PDA is wrong"
    );

    assert_eq!(
        pda_after, pda_before,
        "PDA lamports MUST not change when release fails"
    );


    // State remains unchanged

    let state_after = EscrowAccount::try_from_slice(
        &banks.get_account(real_pda).await.unwrap().unwrap().data
    ).unwrap();

    assert!(state_after.is_accepted);
    assert_eq!(state_after.amount, amount);

    println!("C5: Release SOL With Modified PDA Fails — PASSED");
}
