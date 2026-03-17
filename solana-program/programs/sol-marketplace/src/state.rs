use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum JobStatus {
    Created,
    Funded,
    InProgress,
    Completed,
    Disputed,
    Cancelled,
}

impl Default for JobStatus {
    fn default() -> Self {
        JobStatus::Created
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum MilestoneStatus {
    Pending,
    Submitted,
    Approved,
    Paid,
}

impl Default for MilestoneStatus {
    fn default() -> Self {
        MilestoneStatus::Pending
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum DisputeStatus {
    Open,
    Resolved,
}

impl Default for DisputeStatus {
    fn default() -> Self {
        DisputeStatus::Open
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum DisputeRuling {
    None,
    ClientWins,
    FreelancerWins,
    Split { client_bps: u16, freelancer_bps: u16 },
}

impl Default for DisputeRuling {
    fn default() -> Self {
        DisputeRuling::None
    }
}

#[account]
#[derive(InitSpace)]
pub struct PlatformConfig {
    pub admin: Pubkey,
    pub treasury: Pubkey,
    pub arbitrator: Pubkey,
    pub fee_bps: u16,
    pub total_fees_collected: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Job {
    pub job_id: u64,
    pub client: Pubkey,
    pub freelancer: Pubkey,
    pub total_amount: u64,
    pub escrow_balance: u64,
    pub milestone_count: u8,
    pub milestones_paid: u8,
    pub milestones_approved: u8,
    pub status: JobStatus,
    pub token_mint: Pubkey,
    pub created_at: i64,
    pub bump: u8,
    pub vault_bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Milestone {
    pub job: Pubkey,
    pub milestone_id: u8,
    pub amount: u64,
    pub status: MilestoneStatus,
    #[max_len(64)]
    pub description_hash: String,
    #[max_len(64)]
    pub submission_hash: String,
    pub submitted_at: i64,
    pub approved_at: i64,
    pub paid_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Dispute {
    pub job: Pubkey,
    pub opener: Pubkey,
    pub milestone_id: u8,
    pub status: DisputeStatus,
    pub ruling: DisputeRuling,
    #[max_len(64)]
    pub client_evidence: String,
    #[max_len(64)]
    pub freelancer_evidence: String,
    pub opened_at: i64,
    pub resolved_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct UserStats {
    pub user: Pubkey,
    pub jobs_as_client: u32,
    pub jobs_as_freelancer: u32,
    pub total_earned: u64,
    pub total_spent: u64,
    pub disputes_opened: u32,
    pub disputes_won: u32,
    pub bump: u8,
}

pub mod seeds {
    pub const PLATFORM_CONFIG: &[u8] = b"platform_config";
    pub const JOB: &[u8] = b"job";
    pub const MILESTONE: &[u8] = b"milestone";
    pub const DISPUTE: &[u8] = b"dispute";
    pub const USER_STATS: &[u8] = b"user_stats";
    pub const VAULT: &[u8] = b"vault";
}
