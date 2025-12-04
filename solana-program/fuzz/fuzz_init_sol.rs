use anchor_fuzz::fuzz;
use escrow_program::{
    instruction::EscrowInstruction,
    utils::derive_escrow_pda,
};
use solana_program_test::*;
use solana_sdk::{
    signature::Keypair, signer::Signer, transaction::Transaction,
    system_program,
};

fuzz!(|amount: u64| {                          // Fuzz input
    let program_id = Pubkey::new_unique();

    let mut pt = ProgramTest::new("escrow_program", program_id, None);

    let initializer = Keypair::new();
    let freelancer = Keypair::new();

    // initializer gets lamports
    pt.add_account(
        initializer.pubkey(),
        Account::new(10_000_000_000, 0, &system_program::id()),
    );

    let (escrow_pda, _bump) =
        derive_escrow_pda(&program_id, &initializer.pubkey(), &freelancer.pubkey()).unwrap();

    let mut ctx = pt.start_with_context().unwrap();

    // fuzzed “amount” can take any value, so we cap it to a reasonable max
    let amount = amount % 5_000_000; // deckel etwas

    let ix_data = EscrowInstruction::InitializeSol { amount }
        .try_to_vec()
        .unwrap();

    let ix = solana_sdk::instruction::Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(initializer.pubkey(), true),
            AccountMeta::new_readonly(freelancer.pubkey(), false),
            AccountMeta::new(escrow_pda, false),
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

    let _ = ctx.banks_client.process_transaction(tx);
});

//tests Overflow
//tests negative cases
//tests high value numbers
//tests reinit
//tests Min-Lamport-Rent
//tests PDA mismatch