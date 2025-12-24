use anchor_lang::prelude::*;

#[error_code]
pub enum FreelanceError {
    #[msg("Unauthorized: Not the job client")]
    UnauthorizedClient,

    #[msg("Unauthorized: Not the job freelancer")]
    UnauthorizedFreelancer,

    #[msg("Unauthorized: Not the platform admin")]
    UnauthorizedAdmin,

    #[msg("Unauthorized: Not the platform arbitrator")]
    UnauthorizedArbitrator,

    #[msg("Invalid job status for this operation")]
    InvalidJobStatus,

    #[msg("Invalid milestone status for this operation")]
    InvalidMilestoneStatus,

    #[msg("Invalid milestone ID")]
    InvalidMilestoneId,

    #[msg("Job has already been funded")]
    JobAlreadyFunded,

    #[msg("Job is not in disputed state")]
    JobNotDisputed,

    #[msg("Dispute has already been resolved")]
    DisputeAlreadyResolved,

    #[msg("An active dispute already exists for this job")]
    ActiveDisputeExists,

    #[msg("Cannot cancel job with active dispute")]
    CannotCancelWithActiveDispute,

    #[msg("Cannot cancel job with approved milestones")]
    CannotCancelWithApprovedMilestones,

    #[msg("Insufficient funds in escrow")]
    InsufficientFunds,

    #[msg("Arithmetic overflow")]
    Overflow,

    #[msg("Maximum milestones exceeded")]
    MaxMilestonesExceeded,

    #[msg("Fee exceeds maximum allowed")]
    FeeExceedsMaximum,

    #[msg("Invalid split percentages - must sum to 10000 bps")]
    InvalidSplitPercentages,
}
