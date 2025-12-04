use solana_program::{
    account_info::AccountInfo,
    program_error::ProgramError,
    sysvar::{rent::Rent, Sysvar},
    msg,
};


///Calculates the minimum number of Lamports required
///for an account to be rent-exempt.
///Pass:
///`space`: Number of bytes in the account data field
///Return:
///Minimum Lamports required for rent exemption
pub fn minimum_rent_exemption(space: usize) -> Result<u64, ProgramError> {
    let rent = Rent::get()?;
    Ok(rent.minimum_balance(space))
}


/// Checks if an account is actually rent-exempt.
/// Note:
/// - Very important for Solana programs
/// - Many attacks are based on accounts that are NOT rent-exempt.
///
/// Query:
/// - `account`: The account to be checked
/// - `space`: Size of the account data
pub fn assert_is_rent_exempt(
    account: &AccountInfo,
    space: usize,
) -> Result<(), ProgramError> {
    let rent = Rent::get()?;

    if !rent.is_exempt(account.lamports(), space) {
        msg!("ERROR: Account is NOT rent-exempt.");
        return Err(ProgramError::InsufficientFunds);
    }

    Ok(())
}


/// Creates the formal "rent-exempt check" for state accounts.
/// Executed after the `create_account` instruction:
/// - prevents erroneous accounts from being converted.
/// - protects against underfunded accounts.
///
pub fn verify_new_state_account_rent_exempt(
    account: &AccountInfo,
    space: usize,
) -> Result<(), ProgramError> {

    let required = minimum_rent_exemption(space)?;
    let current = account.lamports();

    if current < required {
        msg!(
            "ERROR: Rent-Exemption failed. lamports={} required={}",
            current,
            required
        );
        return Err(ProgramError::InsufficientFunds);
    }

    assert_is_rent_exempt(account, space)?;
    Ok(())
}
