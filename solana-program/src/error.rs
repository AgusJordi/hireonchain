use solana_program::program_error::ProgramError;
use thiserror::Error;

#[derive(Error, Debug, Copy, Clone)]
pub enum EscrowError {
    #[error("Deadline ist noch nicht erreicht.")]
    DeadlineNotReached = 0,

    #[error("Deadline ist bereits erreicht – Cancel nicht mehr möglich.")]
    DeadlinePassed = 1,

    #[error("Freelancer hat den Escrow noch nicht akzeptiert.")]
    NotAccepted = 2,
}

impl From<EscrowError> for ProgramError {
    fn from(e: EscrowError) -> Self {
        ProgramError::Custom(e as u32)
    }
}
