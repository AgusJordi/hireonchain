use anchor_lang::prelude::*;

#[event]
pub struct JobCreated {
    pub job_id: u64,
    pub client: Pubkey,
    pub freelancer: Pubkey,
    pub total_amount: u64,
    pub milestone_count: u8,
    pub token_mint: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct JobFunded { 
    pub job_id: u64,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct MilestoneSubmitted {
    pub job_id: u64,
    pub milestone_id: u8,
    pub submission_hash: String,
    pub timestamp: i64,
}

#[event]
pub struct MilestoneApproved {
    pub job_id: u64,
    pub milestone_id: u8,
    pub timestamp: i64,
}

#[event]
pub struct MilestonePaid {
    pub job_id: u64,
    pub milestone_id: u8,
    pub amount: u64,
    pub fee: u64,
    pub freelancer: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct DisputeOpened {
    pub job_id: u64,
    pub opener: Pubkey,
    pub milestone_id: u8,
    pub timestamp: i64,
}

#[event]
pub struct DisputeResolved {
    pub job_id: u64,
    pub ruling: String,
    pub client_amount: u64,
    pub freelancer_amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct JobCancelled {
    pub job_id: u64,
    pub refund_amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct FeesWithdrawn {
    pub amount: u64,
    pub recipient: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct PlatformConfigUpdated {
    pub admin: Pubkey,
    pub fee_bps: u16,
    pub timestamp: i64,
}
