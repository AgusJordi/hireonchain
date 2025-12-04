use solana_program::{
    account_info::AccountInfo,
    pubkey::Pubkey,
    program_error::ProgramError,
    msg,
};

/// tests if the account is owned by the expected program
pub fn assert_account_owner(
    account: &AccountInfo,
    expected_owner: &Pubkey,
) -> Result<(), ProgramError> {
    if account.owner != expected_owner {
        msg!("ERROR: Account gehört nicht dem Programm.");
        return Err(ProgramError::IllegalOwner);
    }
    Ok(())
}

/// tests if the initializer is the expected one and has signed
pub fn assert_initializer_authority(
    initializer: &AccountInfo,
    expected_initializer: &Pubkey,
) -> Result<(), ProgramError> {
    if !initializer.is_signer {
        msg!("ERROR: Initializer hat nicht signiert.");
        return Err(ProgramError::MissingRequiredSignature);
    }
    if initializer.key != expected_initializer {
        msg!("ERROR: Falscher Initializer.");
        return Err(ProgramError::IllegalOwner);
    }
    Ok(())
}
