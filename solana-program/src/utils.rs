use solana_program::{
    pubkey::Pubkey,
    program_error::ProgramError,
};

pub fn derive_escrow_pda(
    program_id: &Pubkey,
    initializer: &Pubkey,
    freelancer: &Pubkey,
) -> Result<(Pubkey, u8), ProgramError> {

    let seeds: &[&[u8]] = &[
        b"escrow",
        initializer.as_ref(),
        freelancer.as_ref(),
    ];

    Ok(Pubkey::find_program_address(seeds, program_id))
}
