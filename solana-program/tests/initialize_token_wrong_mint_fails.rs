
//This test ensures:
//initializer signs
//BUT the token_mint account passed to the instruction is NOT the real SPL mint used to fund the initializer’s ATA
//therefore the program MUST reject initialization
//NO tokens are transferred
//NO escrow ATA created for PDA
//NO state is written
//Error is InvalidAccountData, InvalidMint, or custom program error
//Initializer keeps all tokens
//This is a realistic attack vector (passing a fake mint account), and your contract must defend against it.
/*
 *
 */

use solana_program_test::*;
use solana_sdk::{
    pubkey::Pubkey,
    signature::Keypair,
    signer::Signer,
    transaction::Transaction,
};
use spl_token::{
    id as token_program_id,
    state::{Mint, Account as TokenAccount},
};
use escrow_program::{
    id,
    utils::derive_escrow_pda,
    instruction::EscrowInstruction,
};
use borsh::BorshDeserialize;
use borsh::BorshSerialize;

#[tokio::test]
async fn test_initialize_token_with_wrong_mint_fails() {
    let program_id = id();

    let mut pt = ProgramTest::new(
        "escrow_program",
        program_id,
        processor!(escrow_program::processor::process),
    );

    // Required SPL Token Program
    pt.add_program("spl_token", token_program_id(), None);

    let (mut banks, payer, recent_blockhash) = pt.start().await;


    // Actors

    let initializer = Keypair::new();
    let freelancer = Keypair::new();

    banks
        .request_airdrop(initializer.pubkey(), 5_000_000_000)
        .await
        .unwrap();

    // Create REAL mint for initializer

    let real_mint = Keypair::new();
    let real_mint_pub = real_mint.pubkey();

    let rent = banks.get_rent().await;
    let mint_rent = rent.minimum_balance(Mint::LEN);

    let create_mint_ix = solana_sdk::system_instruction::create_account(
        &payer.pubkey(),
        &real_mint_pub,
        mint_rent,
        Mint::LEN as u64,
        &token_program_id(),
    );

    let init_mint_ix = spl_token::instruction::initialize_mint(
        &token_program_id(),
        &real_mint_pub,
        &initializer.pubkey(),
        None,
        0,
    )
    .unwrap();

    let tx = Transaction::new_signed_with_payer(
        &[create_mint_ix, init_mint_ix],
        Some(&payer.pubkey()),
        &[&payer, &real_mint],
        recent_blockhash,
    );
    banks.process_transaction(tx).await.unwrap();


    // Create initializer ATA for REAL mint

    let initializer_ata =
        spl_associated_token_account::get_associated_token_address(&initializer.pubkey(), &real_mint_pub);

    let create_ata_ix =
        spl_associated_token_account::instruction::create_associated_token_account(
            &payer.pubkey(),
            &initializer.pubkey(),
            &real_mint_pub,
        );

    let tx = Transaction::new_signed_with_payer(
        &[create_ata_ix],
        Some(&payer.pubkey()),
        &[&payer],
        recent_blockhash,
    );
    banks.process_transaction(tx).await.unwrap();

    // Mint tokens to initializer
    let mint_to_ix = spl_token::instruction::mint_to(
        &token_program_id(),
        &real_mint_pub,
        &initializer_ata,
        &initializer.pubkey(),
        &[],
        200,
    )
    .unwrap();

    let tx = Transaction::new_signed_with_payer(
        &[mint_to_ix],
        Some(&payer.pubkey()),
        &[&payer, &initializer],
        recent_blockhash,
    );
    banks.process_transaction(tx).await.unwrap();

    // Derive PDA + escrow ATA

    let (escrow_pda, _bump) =
        derive_escrow_pda(&program_id, &initializer.pubkey(), &freelancer.pubkey());

    let escrow_ata =
        spl_associated_token_account::get_associated_token_address(&escrow_pda, &real_mint_pub);


    // Create FAKE mint account (invalid / mismatched)

    let fake_mint = Keypair::new();
    let fake_mint_pub = fake_mint.pubkey();

    // Create a dummy account NOT configured as an SPL mint
    let create_fake_mint_ix = solana_sdk::system_instruction::create_account(
        &payer.pubkey(),
        &fake_mint_pub,
        rent.minimum_balance(32),
        32,
        &payer.pubkey(), // WRONG OWNER, NOT token program
    );

    let tx = Transaction::new_signed_with_payer(
        &[create_fake_mint_ix],
        Some(&payer.pubkey()),
        &[&payer, &fake_mint],
        recent_blockhash,
    );
    banks.process_transaction(tx).await.unwrap();

    // Ensure it's not the real mint
    let acc_fake = banks.get_account(fake_mint_pub).await.unwrap().unwrap();
    assert_ne!(acc_fake.owner, token_program_id());


    // Build InitializeToken instruction WITH WRONG MINT

    let ix_data = EscrowInstruction::InitializeToken {
        amount: 100,
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
            // WRONG MINT HERE ↓↓↓
            solana_sdk::instruction::AccountMeta::new_readonly(fake_mint_pub, false),
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

    let result = banks.process_transaction(tx).await;


    // MUST FAIL

    assert!(
        result.is_err(),
        "Initialization with WRONG mint must fail"
    );

    let err = result.unwrap_err().to_string();

    assert!(
        err.contains("InvalidAccountData")
            || err.contains("InvalidMint")
            || err.contains(" custom program error")
            || err.contains("owner mismatch"),
        "Expected mint validation error; got: {}",
        err
    );


    // Escrow ATA MUST NOT exist

    let maybe_escrow_ata = banks.get_account(escrow_ata).await.unwrap();
    assert!(
        maybe_escrow_ata.is_none(),
        "Escrow ATA should NOT be created when mint is invalid"
    );


    // Initializer ATA MUST still hold all tokens

    let ata_acc = banks.get_account(initializer_ata).await.unwrap().unwrap();
    let token_acc: TokenAccount = TokenAccount::unpack(&ata_acc.data).unwrap();

    assert_eq!(
        token_acc.amount, 200,
        "Initializer should not lose tokens when mint is wrong"
    );

    println!("A8: Initialize Token With Wrong Mint — PASSED");
}
