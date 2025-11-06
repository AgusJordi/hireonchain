use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    pubkey::Pubkey,
    system_instruction,
    program::invoke,
    rent::Rent,
    sysvar::Sysvar,
};

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub enum EscrowInstruction {
    /// Initialize escrow account
    /// Accounts expected:
    /// 0. `[signer]` The account of the person initializing the escrow
    /// 1. `[]` The freelancer's account
    /// 2. `[writable]` The escrow account
    /// 3. `[]` The system program
    Initialize,
    /// Release funds from escrow
    /// Accounts expected:
    /// 0. `[signer]` The account of the person releasing the escrow
    /// 1. `[writable]` The freelancer's account
    /// 2. `[writable]` The escrow account
    /// 3. `[]` The system program
    Release,
}

entrypoint!(process_instruction);

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let instruction = EscrowInstruction::try_from_slice(instruction_data)?;

    match instruction {
        EscrowInstruction::Initialize => {
            msg!("Instruction: Initialize");
            process_initialize(program_id, accounts)
        }
        EscrowInstruction::Release => {
            msg!("Instruction: Release");
            process_release(program_id, accounts)
        }
    }
}

fn process_initialize(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let initializer = next_account_info(account_info_iter)?;
    let freelancer = next_account_info(account_info_iter)?;
    let escrow_account = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;

    if !initializer.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Create escrow account
    let rent = Rent::get()?;
    let space = 0; // No additional data needed for this simple escrow
    let lamports = rent.minimum_balance(space);

    invoke(
        &system_instruction::create_account(
            initializer.key,
            escrow_account.key,
            lamports,
            space as u64,
            program_id,
        ),
        &[
            initializer.clone(),
            escrow_account.clone(),
            system_program.clone(),
        ],
    )?;

    Ok(())
}

fn process_release(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let releaser = next_account_info(account_info_iter)?;
    let freelancer = next_account_info(account_info_iter)?;
    let escrow_account = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;

    if !releaser.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Transfer all lamports from escrow to freelancer
    let escrow_lamports = escrow_account.lamports();
    **escrow_account.lamports.borrow_mut() = 0;
    **freelancer.lamports.borrow_mut() = freelancer.lamports().checked_add(escrow_lamports)
        .ok_or(ProgramError::ArithmeticOverflow)?;

    Ok(())
}

pub fn add(left: u64, right: u64) -> u64 {
    left + right
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_works() {
        let result = add(2, 2);
        assert_eq!(result, 4);
    }
}
