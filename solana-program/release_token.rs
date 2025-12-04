use solana_program::{
    account_info::{AccountInfo},
    program_error::ProgramError,
    program::invoke_signed,
    msg,
    pubkey::Pubkey,
};

use spl_token::instruction as token_instruction;

use crate::{
    state::EscrowAccount,
    owner_check::{assert_account_owner, assert_initializer_authority},
    utils::derive_escrow_pda,
};


/// Executes a secure token release from the escrow PDA.
// Uses invoke_signed with the correct seeds.
///
/// Accounts:
/// 0. [signer] initializer
/// 1. [] freelancer
/// 2. [writable] escrow_pda
/// 3. [writable] escrow_token_ata
/// 4. [writable] freelancer_token_ata
/// 5. [] token_program
pub fn release_token_from_escrow(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> Result<(), ProgramError> {

    let mut iter = accounts.iter();

    let initializer = iter.next().unwrap();
    let freelancer = iter.next().unwrap();
    let escrow_pda_account = iter.next().unwrap();
    let escrow_token_ata = iter.next().unwrap();
    let freelancer_token_ata = iter.next().unwrap();
    let token_program = iter.next().unwrap();

    // 1. Signature + Initializer check
    assert_initializer_authority(initializer, initializer.key)?;

    // 2. PDA belongs to the Program
    assert_account_owner(escrow_pda_account, program_id)?;

    // 3. load Escrow-Data
    let escrow_state =
        EscrowAccount::try_from_slice(&escrow_pda_account.data.borrow())?;

    if !escrow_state.is_initialized || !escrow_state.is_token_escrow {
        msg!("ERROR: Escrow is not initialized or wrong typ.");
        return Err(ProgramError::InvalidAccountData);
    }

    // 4. Initializer must be correct
    if escrow_state.initializer != *initializer.key {
        msg!("ERROR: Wrong Initializer at Release.");
        return Err(ProgramError::IllegalOwner);
    }

    // 5. derive PDA
    let (escrow_pda, bump) = derive_escrow_pda(
        program_id,
        &escrow_state.initializer,
        &escrow_state.freelancer,
    )?;

    if escrow_pda != *escrow_pda_account.key {
        msg!("ERROR: gave wrong PDA.");
        return Err(ProgramError::InvalidSeeds);
    }

    // 6. prepare Seeds for invoke_signed
    let seeds: &[&[u8]] = &[
        b"escrow",
        escrow_state.initializer.as_ref(),
        escrow_state.freelancer.as_ref(),
        &[bump],
    ];

    // 7. Token transfer via PDA -> Freelancer
    let ix = token_instruction::transfer(
        token_program.key,
        escrow_token_ata.key,
        freelancer_token_ata.key,
        &escrow_pda,    // PDA acting as authority
        &[],
        escrow_state.amount,
    )?;

    invoke_signed(
        &ix,
        &[
            escrow_token_ata.clone(),
            freelancer_token_ata.clone(),
            token_program.clone(),
            escrow_pda_account.clone(),
        ],
        &[seeds],
    )?;

    msg!("Token successfully via invoke_signed from Escrow enabled.");

    Ok(())
}
