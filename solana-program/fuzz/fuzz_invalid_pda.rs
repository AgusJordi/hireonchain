use anchor_fuzz::fuzz;
use escrow_program::{instruction::EscrowInstruction};
use solana_program_test::*;
use solana_sdk::{
    signature::Keypair, signer::Signer,
    transaction::Transaction,
    system_program, instruction::AccountMeta,
    pubkey::Pubkey,
};

fuzz!(|random_bytes: [u8; 32]| {

    let program_id = Pubkey::new_unique();
    let mut pt = ProgramTest::new("escrow_program", program_id, None);

    let initializer = Keypair::new();
    let freelancer = Keypair::new();

    let fake_pda = Pubkey::new_from_array(random_bytes); // fuzzed PDA!

    pt.add_account(
        initializer.pubkey(),
        Account::new(10_000_000_000, 0, &system_program::id()),
    );

    let mut ctx = pt.start_with_context().unwrap();

    let ix_data = EscrowInstruction::InitializeSol { amount: 1_000_000 }
        .try_to_vec()
        .unwrap();

    let ix = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(initializer.pubkey(), true),
            AccountMeta::new_readonly(freelancer.pubkey(), false),
            AccountMeta::new(fake_pda, false),    // fuzzed invalid PDA
            AccountMeta::new_readonly(system_program::id(), false),
        ],
        data: ix_data,
    };

    let tx = Transaction::new_signed_with_payer(
        &[ix],
        Some(&initializer.pubkey()),
        &[&initializer],
        ctx.last_blockhash,
    );

    let result = ctx.banks_client.process_transaction(tx);

    // invalid PDA MUST fail
    assert!(result.is_err());
});
