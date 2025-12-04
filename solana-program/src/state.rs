use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::pubkey::Pubkey;

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct EscrowAccount {
    pub initializer: Pubkey,
    pub freelancer: Pubkey,
    pub token_mint: Pubkey,
    pub amount: u64,
    pub is_token_escrow: bool,
    pub is_initialized: bool,
    pub is_accepted: bool,           // NEW
    pub deadline_unix_timestamp: i64,
}

impl EscrowAccount {
    pub const LEN: usize =
        32 + // initializer
        32 + // freelancer
        32 + // token_mint
        8  + // amount
        1  + // is_token_escrow
        1  + // is_initialized
        1  + // is_accepted
        8;   // deadline
}
