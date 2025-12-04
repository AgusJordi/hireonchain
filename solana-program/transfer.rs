use solana_program::{
    account_info::AccountInfo,
    program_error::ProgramError,
    program::invoke,
    system_instruction,
    msg,
    pubkey::Pubkey,
};

/// Performs a safe SOL transfer from the initializer to the escrow PDA.
// This function encapsulates `system_instruction::transfer`.
/// Requirements:
/// - `from` must be writable and signer.
/// - `to` is the escrow PDA.
/// - `amount` is passed in Lamports.
/// - Errors are cleanly propagated upwards.
/// Used in `process_initialize_sol()`.
pub fn transfer_sol_to_escrow(
    from: &AccountInfo,
    to: &AccountInfo,
    amount: u64,
) -> Result<(), ProgramError> {

    if !from.is_signer {
        msg!("ERROR: Initializer has not signed.");
        return Err(ProgramError::MissingRequiredSignature);
    }

    // system_instruction::transfer creates the Instructions
    let ix = system_instruction::transfer(
        from.key,
        to.key,
        amount,
    );

    // invoke executes the instruction
    invoke(
        &ix,
        &[
            from.clone(),
            to.clone(),
        ],
    )?;

    msg!("SOL sucessfully transfered to escrow.");
    Ok(())
}
