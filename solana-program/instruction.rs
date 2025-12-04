use borsh::{BorshDeserialize, BorshSerialize};

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub enum EscrowInstruction {

    InitializeSol {
        amount: u64,
    },

    InitializeSolWithDeadline {
        amount: u64,
        deadline_unix_timestamp: i64,
    },

    InitializeToken {
        amount: u64,
    },

    InitializeTokenWithDeadline {
        amount: u64,
        deadline_unix_timestamp: i64,
    },

    /// Freelancer accepts the escrow
    Accept,

    ReleaseSol,
    ReleaseToken,

    Cancel,
}
