// program test module must include
// use spl_token::state::Account as TokenAccount;
// and must register spl_token program in ProgramTest
// pt.add_program("spl_token", spl_token::id(), None);
// Most users forget this - but I included it for you :)

use solana_program_test::*;
use solana_sdk::{
    pubkey::Pubkey,
    signature::Keypair,
    signer::Signer,
    transaction::Transaction,
};
use spl_token::{
    id as token_program_id,
    state::Mint,
    state::Account as TokenAccount,
};
use escrow_program::{
    id,
    utils::derive_escrow_pda,
    instruction::EscrowInstruction,
    state::EscrowAccount,
};
use borsh::BorshDeserialize;

#[tokio::test]
async fn test_initialize_token_success() {
    let program_id = id();

    let mut pt = ProgramTest::new(
        "escrow_program",
        program_id,
        processor!(escrow_program::processor::process)
    );

    // Add SPL Token Program
    pt.add_program("spl_token", token_program_id(), None);

    let (mut banks, payer, recent_blockhash) = pt.start().await;

    // Actors
    let initializer = Keypair::new();
    let freelancer = Keypair::new();

    // Airdrop to initializer
    banks.request_airdrop(initializer.pubkey(), 5_000_000_000).await.unwrap();


    // Create Mint

    let mint = Keypair::new();
    let mint_pub = mint.pubkey();

    // Create Mint Account
    let rent = banks.get_rent().await;
    let mint_rent = rent.minimum_balance(Mint::LEN);

    let create_mint_ix = solana_sdk::system_instruction::create_account(
        &payer.pubkey(),
        &mint_pub,
        mint_rent,
        Mint::LEN as u64,
        &token_program_id(),
    );

    let init_mint_ix = spl_token::instruction::initialize_mint(
        &token_program_id(),
        &mint_pub,
        &initializer.pubkey(),
        None,
        0, // decimals
    ).unwrap();

    let tx = Transaction::new_signed_with_payer(
        &[create_mint_ix, init_mint_ix],
        Some(&payer.pubkey()),
        &[&payer, &mint],
        recent_blockhash,
    );

    banks.process_transaction(tx).await.unwrap();

    // Create initializer token ATA

    let initializer_ata = spl_associated_token_account::get_associated_token_address(
        &initializer.pubkey(),
        &mint_pub,
    );

    let ix_create_ata =
        spl_associated_token_account::instruction::create_associated_token_account(
            &payer.pubkey(),
            &initializer.pubkey(),
            &mint_pub,
        );

    let tx = Transaction::new_signed_with_payer(
        &[ix_create_ata],
        Some(&payer.pubkey()),
        &[&payer],
        recent_blockhash,
    );

    banks.process_transaction(tx).await.unwrap();

    // Mint 100 tokens to initializer
    let mint_to_ix = spl_token::instruction::mint_to(
        &token_program_id(),
        &mint_pub,
        &initializer_ata,
        &initializer.pubkey(),
        &[],
        100,
    ).unwrap();

    let tx = Transaction::new_signed_with_payer(
        &[mint_to_ix],
        Some(&payer.pubkey()),
        &[&payer, &initializer],
        recent_blockhash,
    );
    banks.process_transaction(tx).await.unwrap();


    // Derive PDA & Escrow ATA

    let (escrow_pda, _bump) = derive_escrow_pda(&program_id, &initializer.pubkey(), &freelancer.pubkey());
    let escrow_ata = spl_associated_token_account::get_associated_token_address(&escrow_pda, &mint_pub);


    // Build InitializeToken instruction

    let ix_data = EscrowInstruction::InitializeToken {
        amount: 50,
        deadline_unix_timestamp: 0,
    }
    .try_to_vec()
    .unwrap();

    let ix = solana_sdk::instruction::Instruction {
        program_id,
        accounts: vec![
            solana_sdk::instruction::AccountMeta::new(initializer.pubkey(), true),
            solana_sdk::instruction::AccountMeta::new_readonly(freelancer.pubkey(), false),
            solana_sdk::instruction::AccountMeta::new(escrow_pda, false),
            solana_sdk::instruction::AccountMeta::new(escrow_ata, false),
            solana_sdk::instruction::AccountMeta::new_readonly(mint_pub, false),
            solana_sdk::instruction::AccountMeta::new(initializer_ata, false),
            solana_sdk::instruction::AccountMeta::new_readonly(token_program_id(), false),
            solana_sdk::instruction::AccountMeta::new_readonly(solana_program::system_program::id(), false),
            solana_sdk::instruction::AccountMeta::new_readonly(solana_program::sysvar::rent::id(), false),
        ],
        data: ix_data,
    };

    let tx = Transaction::new_signed_with_payer(
        &[ix],
        Some(&payer.pubkey()),
        &[&payer, &initializer],
        recent_blockhash,
    );

    banks.process_transaction(tx).await.unwrap();


    // Assertions


    // 1. Escrow PDA exists
    let escrow_acc = banks.get_account(escrow_pda).await.unwrap().unwrap();

    // 2. SPL escrow ATA exists and holds tokens
    let escrow_ata_acc = banks.get_account(escrow_ata).await.unwrap().unwrap();
    let escrow_token: TokenAccount = TokenAccount::unpack(&escrow_ata_acc.data).unwrap();
    assert_eq!(escrow_token.amount, 50);

    // 3. Escrow state is correct
    let state = EscrowAccount::try_from_slice(&escrow_acc.data).unwrap();

    assert_eq!(state.initializer, initializer.pubkey());
    assert_eq!(state.freelancer, freelancer.pubkey());
    assert_eq!(state.token_mint, mint_pub);
    assert_eq!(state.amount, 50);
    assert_eq!(state.is_token_escrow, true);
    assert!(state.is_initialized);

    println!("A3: SPL Initialize Success — PASSED");
}


//note to myself: make sure this one is complete!!!!!!!!!!!!!!1