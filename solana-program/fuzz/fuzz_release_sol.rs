use anchor_fuzz::fuzz;
use escrow_program::{instruction::EscrowInstruction, utils::derive_escrow_pda};
use solana_program_test::*;
use solana_sdk::{
    signature::Keypair, signer::Signer, transaction::Transaction,
    system_program, instruction::AccountMeta,
};

fuzz!(|signer_is_initializer: bool| {

    let program_id = Pubkey::new_unique();
    let mut pt = ProgramTest::new("escrow_program", program_id, None);

    let initializer = Keypair::new();
    let freelancer = Keypair::new();
    let attacker = Keypair::new();

    pt.add_account(
        initializer.pubkey(),
        Account::new(5_000_000_000, 0, &system_program::id()),
    );

    let (escrow_pda, bump) =
        derive_escrow_pda(&program_id, &initializer.pubkey(), &freelancer.pubkey()).unwrap();

    let mut ctx = pt.start_with_context().unwrap();

    // Mock Init
    {
        let init_ix = EscrowInstruction::InitializeSol { amount: 1_000_000 }
            .try_to_vec()
            .unwrap();

        let ix = Instruction {
            program_id,
            accounts: vec![
                AccountMeta::new(initializer.pubkey(), true),
                AccountMeta::new_readonly(freelancer.pubkey(), false),
                AccountMeta::new(escrow_pda, false),
                AccountMeta::new(system_program::id(), false),
            ],
            data: init_ix,
        };

        let tx = Transaction::new_signed_with_payer(
            &[ix],
            Some(&initializer.pubkey()),
            &[&initializer],
            ctx.last_blockhash,
        );

        let _ = ctx.banks_client.process_transaction(tx);
    }

    // FUZZER decides, whos the signer
    let signer = if signer_is_initializer {
        &initializer
    } else {
        &attacker
    };

    let release_ix_data = EscrowInstruction::ReleaseSol.try_to_vec().unwrap();

    let ix = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(signer.pubkey(), true),
            AccountMeta::new(freelancer.pubkey(), false),
            AccountMeta::new(escrow_pda, false),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
        data: release_ix_data,
    };

    let tx = Transaction::new_signed_with_payer(
        &[ix],
        Some(&signer.pubkey()),
        &[signer],
        ctx.last_blockhash,
    );

    // if initializer ≠ signer -> MUST!!!!!! fail
    let result = ctx.banks_client.process_transaction(tx);

    if !signer_is_initializer {
        assert!(result.is_err());
    } else {
        let _ = result; // non-fuzz: may succeed
    }
});
