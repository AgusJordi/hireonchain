use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{AccountInfo, next_account_info},
    entrypoint::ProgramResult,
    msg,
    program::{invoke, invoke_signed},
    program_error::ProgramError,
    pubkey::Pubkey,
    sysvar::{rent::Rent, Sysvar, clock::Clock},
    system_instruction,
};

use crate::{
    error::EscrowError,
    instruction::EscrowInstruction,
    owner_check::{assert_account_owner, assert_initializer_authority},
    rent::{minimum_rent_exemption, verify_new_state_account_rent_exempt},
    state::EscrowAccount,
    transfer::transfer_sol_to_escrow,
    utils::derive_escrow_pda,
};

use spl_token::instruction as token_instruction;


// ============================================================
//                        PROCESS DISPATCHER
// ============================================================
pub fn process(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
) -> ProgramResult {

    let instruction = EscrowInstruction::try_from_slice(data)?;

    match instruction {
        EscrowInstruction::InitializeSol { amount } =>
            process_initialize_sol(program_id, accounts, amount, 0),

        EscrowInstruction::InitializeSolWithDeadline {
            amount,
            deadline_unix_timestamp,
        } =>
            process_initialize_sol(program_id, accounts, amount, deadline_unix_timestamp),

        EscrowInstruction::InitializeToken { amount } =>
            process_initialize_token(program_id, accounts, amount, 0),

        EscrowInstruction::InitializeTokenWithDeadline {
            amount,
            deadline_unix_timestamp,
        } =>
            process_initialize_token(program_id, accounts, amount, deadline_unix_timestamp),

        EscrowInstruction::Accept =>
            process_accept(program_id, accounts),

        EscrowInstruction::ReleaseSol =>
            process_release_sol(program_id, accounts),

        EscrowInstruction::ReleaseToken =>
            process_release_token(program_id, accounts),

        EscrowInstruction::Cancel =>
            process_cancel(program_id, accounts),
    }
}



// ============================================================
//                       INITIALIZE SOL ESCROW
// ============================================================
fn process_initialize_sol(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    amount: u64,
    deadline: i64,
) -> ProgramResult {

    let acc_iter = &mut accounts.iter();

    let initializer = next_account_info(acc_iter)?;
    let freelancer = next_account_info(acc_iter)?;
    let escrow_account = next_account_info(acc_iter)?;
    let system_program = next_account_info(acc_iter)?;

    // Must be initializer
    assert_initializer_authority(initializer, initializer.key)?;

    // Derive PDA
    let (escrow_pda, _bump) =
        derive_escrow_pda(program_id, initializer.key, freelancer.key)?;

    if escrow_pda != *escrow_account.key {
        return Err(ProgramError::InvalidSeeds);
    }

    // Rent-exempt account creation
    let space = EscrowAccount::LEN;
    let rent_required = minimum_rent_exemption(space)?;

    invoke(
        &system_instruction::create_account(
            initializer.key,
            escrow_account.key,
            rent_required,
            space as u64,
            program_id,
        ),
        &[
            initializer.clone(),
            escrow_account.clone(),
            system_program.clone(),
        ],
    )?;

    verify_new_state_account_rent_exempt(escrow_account, space)?;
    assert_account_owner(escrow_account, program_id)?;

    // Transfer SOL into escrow PDA
    transfer_sol_to_escrow(initializer, escrow_account, amount)?;

    // Save state
    let state = EscrowAccount {
        initializer: *initializer.key,
        freelancer: *freelancer.key,
        token_mint: Pubkey::default(),
        amount,
        is_token_escrow: false,
        is_initialized: true,
        is_accepted: false, // NEW
        deadline_unix_timestamp: deadline,
    };

    state.serialize(&mut &mut escrow_account.data.borrow_mut()[..])?;

    msg!("SOL escrow initialized.");
    Ok(())
}



// ============================================================
//                       INITIALIZE TOKEN ESCROW
// ============================================================
fn process_initialize_token(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    amount: u64,
    deadline: i64,
) -> ProgramResult {

    let acc_iter = &mut accounts.iter();

    let initializer = next_account_info(acc_iter)?;
    let freelancer = next_account_info(acc_iter)?;
    let escrow_account = next_account_info(acc_iter)?;
    let escrow_token_ata = next_account_info(acc_iter)?;
    let token_mint = next_account_info(acc_iter)?;
    let initializer_token_ata = next_account_info(acc_iter)?;
    let token_program = next_account_info(acc_iter)?;
    let system_program = next_account_info(acc_iter)?;
    let _rent_sysvar = next_account_info(acc_iter)?;

    assert_initializer_authority(initializer, initializer.key)?;

    // Derive PDA
    let (escrow_pda, _bump) =
        derive_escrow_pda(program_id, initializer.key, freelancer.key)?;

    if *escrow_account.key != escrow_pda {
        return Err(ProgramError::InvalidSeeds);
    }

    // Create escrow state account
    let space = EscrowAccount::LEN;
    let rent_required = minimum_rent_exemption(space)?;

    invoke(
        &system_instruction::create_account(
            initializer.key,
            escrow_account.key,
            rent_required,
            space as u64,
            program_id,
        ),
        &[
            initializer.clone(),
            escrow_account.clone(),
            system_program.clone(),
        ],
    )?;

    verify_new_state_account_rent_exempt(escrow_account, space)?;
    assert_account_owner(escrow_account, program_id)?;

    // Move tokens into escrow ATA
    invoke(
        &token_instruction::transfer(
            token_program.key,
            initializer_token_ata.key,
            escrow_token_ata.key,
            initializer.key,
            &[],
            amount,
        )?,
        &[
            initializer_token_ata.clone(),
            escrow_token_ata.clone(),
            initializer.clone(),
            token_program.clone(),
        ],
    )?;

    // Save state
    let state = EscrowAccount {
        initializer: *initializer.key,
        freelancer: *freelancer.key,
        token_mint: *token_mint.key,
        amount,
        is_token_escrow: true,
        is_initialized: true,
        is_accepted: false, // NEW
        deadline_unix_timestamp: deadline,
    };

    state.serialize(&mut &mut escrow_account.data.borrow_mut()[..])?;
    msg!("Token escrow initialized.");

    Ok(())
}



// ============================================================
//                       FREELANCER ACCEPTANCE
// ============================================================
fn process_accept(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {

    /*
        Accounts:
        0. [signer] freelancer
        1. [writable] escrow_account
    */

    let acc_iter = &mut accounts.iter();

    let freelancer = next_account_info(acc_iter)?;
    let escrow_account = next_account_info(acc_iter)?;

    if !freelancer.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    assert_account_owner(escrow_account, program_id)?;

    let mut state =
        EscrowAccount::try_from_slice(&escrow_account.data.borrow())?;

    if state.freelancer != *freelancer.key {
        return Err(ProgramError::IllegalOwner);
    }

    if !state.is_initialized {
        return Err(ProgramError::UninitializedAccount);
    }

    state.is_accepted = true;

    state.serialize(&mut &mut escrow_account.data.borrow_mut()[..])?;
    msg!("Freelancer accepted the escrow.");

    Ok(())
}



// ============================================================
//                       RELEASE SOL
// ============================================================
fn process_release_sol(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {

    let acc_iter = &mut accounts.iter();

    let initializer = next_account_info(acc_iter)?;
    let freelancer = next_account_info(acc_iter)?;
    let escrow_account = next_account_info(acc_iter)?;
    let _system_program = next_account_info(acc_iter)?;

    assert_initializer_authority(initializer, initializer.key)?;
    assert_account_owner(escrow_account, program_id)?;

    let state =
        EscrowAccount::try_from_slice(&escrow_account.data.borrow())?;

    if state.is_token_escrow {
        return Err(ProgramError::InvalidAccountData);
    }

    // NEW: must be accepted
    if !state.is_accepted {
        return Err(EscrowError::NotAccepted.into());
    }

    // Deadline check
    let now = Clock::get()?.unix_timestamp;
    if now < state.deadline_unix_timestamp {
        return Err(EscrowError::DeadlineNotReached.into());
    }

    let lamports = escrow_account.lamports();

    **escrow_account.lamports.borrow_mut() = 0;
    **freelancer.lamports.borrow_mut() += lamports;

    msg!("SOL released.");
    Ok(())
}



// ============================================================
//                       RELEASE TOKEN
// ============================================================
fn process_release_token(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {

    let acc_iter = &mut accounts.iter();

    let initializer = next_account_info(acc_iter)?;
    let freelancer = next_account_info(acc_iter)?;
    let escrow_account = next_account_info(acc_iter)?;
    let escrow_token_ata = next_account_info(acc_iter)?;
    let freelancer_token_ata = next_account_info(acc_iter)?;
    let token_program = next_account_info(acc_iter)?;

    assert_initializer_authority(initializer, initializer.key)?;
    assert_account_owner(escrow_account, program_id)?;

    let state =
        EscrowAccount::try_from_slice(&escrow_account.data.borrow())?;

    if !state.is_token_escrow {
        return Err(ProgramError::InvalidAccountData);
    }

    // NEW: must be accepted
    if !state.is_accepted {
        return Err(EscrowError::NotAccepted.into());
    }

    // Deadline
    let now = Clock::get()?.unix_timestamp;

    if now < state.deadline_unix_timestamp {
        return Err(EscrowError::DeadlineNotReached.into());
    }

    // Derive PDA
    let (escrow_pda, bump) =
        derive_escrow_pda(program_id, &state.initializer, &state.freelancer)?;

    let seeds: &[&[u8]] = &[
        b"escrow",
        state.initializer.as_ref(),
        state.freelancer.as_ref(),
        &[bump],
    ];

    // PDA-signed transfer
    invoke_signed(
        &token_instruction::transfer(
            token_program.key,
            escrow_token_ata.key,
            freelancer_token_ata.key,
            &escrow_pda,
            &[],
            state.amount,
        )?,
        &[
            escrow_token_ata.clone(),
            freelancer_token_ata.clone(),
            token_program.clone(),
            escrow_account.clone(),
        ],
        &[seeds],
    )?;

    msg!("Token released.");
    Ok(())
}



// ============================================================
//                       CANCEL ESCROW
// ============================================================
fn process_cancel(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {

    /*
        0. [signer] initializer
        1. [writable] escrow_account
        2. [writable] initializer_destination
        3. optionally escrow_token_ata
        4. optionally initializer_token_ata
        5. optionally token_program
    */

    let acc_iter = &mut accounts.iter();

    let initializer = next_account_info(acc_iter)?;
    let escrow_account = next_account_info(acc_iter)?;
    let initializer_destination = next_account_info(acc_iter)?;

    let maybe_escrow_token_ata = acc_iter.next();
    let maybe_initializer_token_ata = acc_iter.next();
    let maybe_token_program = acc_iter.next();

    assert_initializer_authority(initializer, initializer.key)?;
    assert_account_owner(escrow_account, program_id)?;

    let state =
        EscrowAccount::try_from_slice(&escrow_account.data.borrow())?;

    if !state.is_initialized {
        return Err(ProgramError::UninitializedAccount);
    }

    // Deadline check — Cancel only BEFORE deadline
    let now = Clock::get()?.unix_timestamp;

    if now >= state.deadline_unix_timestamp {
        return Err(EscrowError::DeadlinePassed.into());
    }

    // SOL Cancel
    if !state.is_token_escrow {
        let lamports = escrow_account.lamports();

        **escrow_account.lamports.borrow_mut() = 0;
        **initializer_destination.lamports.borrow_mut() += lamports;

    } else {
        // TOKEN Cancel
        let escrow_token_ata = maybe_escrow_token_ata.unwrap();
        let initializer_token_ata = maybe_initializer_token_ata.unwrap();
        let token_program = maybe_token_program.unwrap();

        let (escrow_pda, bump) =
            derive_escrow_pda(program_id, &state.initializer, &state.freelancer)?;

        let seeds: &[&[u8]] = &[
            b"escrow",
            state.initializer.as_ref(),
            state.freelancer.as_ref(),
            &[bump],
        ];

        invoke_signed(
            &token_instruction::transfer(
                token_program.key,
                escrow_token_ata.key,
                initializer_token_ata.key,
                &escrow_pda,
                &[],
                state.amount,
            )?,
            &[
                escrow_token_ata.clone(),
                initializer_token_ata.clone(),
                token_program.clone(),
                escrow_account.clone(),
            ],
            &[seeds],
        )?;
    }

    // Invalidate state
    let mut cleared = state;
    cleared.is_initialized = false;
    cleared.is_accepted = false;

    cleared.serialize(&mut &mut escrow_account.data.borrow_mut()[..])?;

    msg!("Escrow cancelled.");
    Ok(())
}
