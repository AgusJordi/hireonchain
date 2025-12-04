use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    pubkey::Pubkey,
    system_instruction,
};
use solana_program_test::*;
use solana_sdk::{
    account::Account,
    signature::{Keypair, Signer},
    transaction::Transaction,
};

use escrow_program::{          // <-- put in crate-name here
    instruction::EscrowInstruction,
    state::EscrowAccount,
    utils::derive_escrow_pda,
};




//         HELFER: INITIALIZE SOL ESCROW INSTRUCTION

fn build_initialize_sol_ix(
    program_id: &Pubkey,
    initializer: &Pubkey,
    freelancer: &Pubkey,
    escrow_pda: &Pubkey,
    amount: u64,
) -> solana_sdk::instruction::Instruction {
    let data = EscrowInstruction::InitializeSol { amount }
        .try_to_vec()
        .unwrap();

    solana_sdk::instruction::Instruction {
        program_id: *program_id,
        accounts: vec![
            solana_sdk::instruction::AccountMeta::new(*initializer, true),
            solana_sdk::instruction::AccountMeta::new_readonly(*freelancer, false),
            solana_sdk::instruction::AccountMeta::new(*escrow_pda, false),
            solana_sdk::instruction::AccountMeta::new_readonly(solana_program::system_program::id(), false),
        ],
        data,
    }
}




//        TEST 1: INIT > REINIT-PREVENTION

#[tokio::test]
async fn test_reinit_prevention() {

    let program_id = Pubkey::new_unique();
    let mut test = ProgramTest::new("escrow_program", program_id, None);

    let initializer = Keypair::new();
    let freelancer = Keypair::new();

    let (escrow_pda, _bump) =
        derive_escrow_pda(&program_id, &initializer.pubkey(), &freelancer.pubkey()).unwrap();

    test.add_account(
        initializer.pubkey(),
        Account::new(10_000_000_000, 0, &system_program::id()),
    );

    let mut context = test.start_with_context().await;

    // 1. first Init -> OK
    let ix1 = build_initialize_sol_ix(
        &program_id,
        &initializer.pubkey(),
        &freelancer.pubkey(),
        &escrow_pda,
        1_000_000,
    );

    let tx1 = Transaction::new_signed_with_payer(
        &[ix1],
        Some(&initializer.pubkey()),
        &[&initializer],
        context.last_blockhash,
    );

    assert!(context.banks_client.process_transaction(tx1).await.is_ok());

    // 2. Reinit -> ERROR expected
    let ix2 = build_initialize_sol_ix(
        &program_id,
        &initializer.pubkey(),
        &freelancer.pubkey(),
        &escrow_pda,
        500_000,
    );

    let tx2 = Transaction::new_signed_with_payer(
        &[ix2],
        Some(&initializer.pubkey()),
        &[&initializer],
        context.last_blockhash,
    );

    let result = context.banks_client.process_transaction(tx2).await;
    assert!(result.is_err());          // REINIT-BLOCK WORKED
}




//        TEST 2: RELEASE ONLY FROM INITIALIZER

#[tokio::test]
async fn test_release_only_initializer() {

    let program_id = Pubkey::new_unique();
    let mut test = ProgramTest::new("escrow_program", program_id, None);

    let initializer = Keypair::new();
    let freelancer = Keypair::new();
    let attacker = Keypair::new();

    // lets give 'em some money
    test.add_account(
        initializer.pubkey(),
        Account::new(10000000000, 0, &system_program::id()),
    );
    test.add_account(
        attacker.pubkey(),
        Account::new(10000000000, 0, &system_program::id()),
    );

    let (escrow_pda, _bump) =
        derive_escrow_pda(&program_id, &initializer.pubkey(), &freelancer.pubkey()).unwrap();

    let mut context = test.start_with_context().await;

    // init escrow first
    let ix_init = build_initialize_sol_ix(
        &program_id,
        &initializer.pubkey(),
        &freelancer.pubkey(),
        &escrow_pda,
        3_000_000,
    );

    let tx = Transaction::new_signed_with_payer(
        &[ix_init],
        Some(&initializer.pubkey()),
        &[&initializer],
        context.last_blockhash,
    );
    assert!(context.banks_client.process_transaction(tx).await.is_ok());

    // RELEASE, but from ATTACKER
    let data = EscrowInstruction::ReleaseSol.try_to_vec().unwrap();

    let ix_attack = solana_sdk::instruction::Instruction {
        program_id,
        accounts: vec![
            solana_sdk::instruction::AccountMeta::new(attacker.pubkey(), true), // <-- wrong Signer
            solana_sdk::instruction::AccountMeta::new(freelancer.pubkey(), false),
            solana_sdk::instruction::AccountMeta::new(escrow_pda, false),
            solana_sdk::instruction::AccountMeta::new_readonly(system_program::id(), false),
        ],
        data,
    };

    let tx2 = Transaction::new_signed_with_payer(
        &[ix_attack],
        Some(&attacker.pubkey()),
        &[&attacker],
        context.last_blockhash,
    );

    let result = context.banks_client.process_transaction(tx2).await;
    assert!(result.is_err());     // RELEASE not possible
}




//        TEST 3: INVALID SIGNER ATTACK

#[tokio::test]
async fn test_invalid_signer_attack() {

    let program_id = Pubkey::new_unique();
    let mut test = ProgramTest::new("escrow_program", program_id, None);

    let initializer = Keypair::new();
    let freelancer = Keypair::new();
    let not_signer = Keypair::new();

    test.add_account(
        initializer.pubkey(),
        Account::new(10_000_000_000, 0, &system_program::id()),
    );

    let (escrow_pda, _bump) =
        derive_escrow_pda(&program_id, &initializer.pubkey(), &freelancer.pubkey()).unwrap();

    let mut context = test.start_with_context().await;

    // Attempt: INITIALIZE, but Signer is NOT Initializer
    let ix = build_initialize_sol_ix(
        &program_id,
        &initializer.pubkey(),    // expects signer
        &freelancer.pubkey(),
        &escrow_pda,
        1_000_000,
    );

    let tx = Transaction::new_signed_with_payer(
        &[ix],
        Some(&not_signer.pubkey()),
        &[&not_signer],    // <-- wrong signer
        context.last_blockhash,
    );

    let result = context.banks_client.process_transaction(tx).await;
    assert!(result.is_err());     // Initializer != Signer -> blocked
}




//       TEST 4: INVALID PDA ATTACK

#[tokio::test]
async fn test_invalid_pda_attack() {

    let program_id = Pubkey::new_unique();
    let mut test = ProgramTest::new("escrow_program", program_id, None);

    let initializer = Keypair::new();
    let freelancer = Keypair::new();

    let fake_pda = Pubkey::new_unique();   // <-- NOT the real PDA

    test.add_account(
        initializer.pubkey(),
        Account::new(10_000_000_000, 0, &system_program::id()),
    );

    let mut context = test.start_with_context().await;

    // Test: INITIALIZE with false PDA
    let ix = build_initialize_sol_ix(
        &program_id,
        &initializer.pubkey(),
        &freelancer.pubkey(),
        &fake_pda,
        500_000,
    );

    let tx = Transaction::new_signed_with_payer(
        &[ix],
        Some(&initializer.pubkey()),
        &[&initializer],
        context.last_blockhash,
    );

    let result = context.banks_client.process_transaction(tx).await;
    assert!(result.is_err());     // wrong PDA blocked
}
