use anchor_lang::prelude::*;

pub mod state;
pub mod errors;
pub mod events;
pub mod constants;
pub mod instructions;

use instructions::*;
use state::DisputeRuling;

declare_id!("7Aeyy6HZa97qQxvChJB3xW9Tp3phD9ZDSEUqoMJSsbui");

#[program]
pub mod sol_marketplace {
    use super::*;

    pub fn initialize_platform(
        ctx: Context<InitializePlatform>,
        fee_bps: u16,
    ) -> Result<()> {
        initialize_platform::initialize_platform_handler(ctx, fee_bps)
    }

    pub fn create_job(
        ctx: Context<CreateJob>,
        job_id: u64, 
        milestone_amounts: Vec<u64>,
        milestone_descriptions: Vec<String>,
    ) -> Result<()> {
        create_job::create_job_handler(ctx, job_id, milestone_amounts, milestone_descriptions)
    }

    pub fn create_milestone(
        ctx: Context<CreateMilestone>,
        milestone_id: u8,
        amount: u64,
        description_hash: String,
    ) -> Result<()> {
        create_job::create_milestone_handler(ctx, milestone_id, amount, description_hash)
    }

    pub fn fund_escrow(ctx: Context<FundEscrow>) -> Result<()> {
        fund_escrow::fund_escrow_handler(ctx)
    }

    pub fn submit_milestone(
        ctx: Context<SubmitMilestone>,
        submission_hash: String,
    ) -> Result<()> {
        submit_milestone::submit_milestone_handler(ctx, submission_hash)
    }

    pub fn approve_milestone(ctx: Context<ApproveMilestone>) -> Result<()> {
        approve_milestone::approve_milestone_handler(ctx)
    }

    pub fn release_milestone(ctx: Context<ReleaseMilestone>) -> Result<()> {
        release_milestone::release_milestone_handler(ctx)
    }

    pub fn cancel_job(ctx: Context<CancelJob>) -> Result<()> {
        cancel_job::cancel_job_handler(ctx)
    }

    pub fn open_dispute(ctx: Context<OpenDispute>, milestone_id: u8) -> Result<()> {
        open_dispute::open_dispute_handler(ctx, milestone_id)
    }

    pub fn submit_dispute_evidence(
        ctx: Context<SubmitDisputeEvidence>,
        evidence_hash: String,
    ) -> Result<()> {
        submit_dispute_evidence::submit_dispute_evidence_handler(ctx, evidence_hash)
    }

    pub fn resolve_dispute(ctx: Context<ResolveDispute>, ruling: DisputeRuling) -> Result<()> {
        resolve_dispute::resolve_dispute_handler(ctx, ruling)
    }

    pub fn set_platform_fee(ctx: Context<SetPlatformFee>, new_fee_bps: u16) -> Result<()> {
        set_platform_fee::set_platform_fee_handler(ctx, new_fee_bps)
    }

    pub fn withdraw_platform_fees(
        ctx: Context<WithdrawPlatformFees>,
        amount: u64,
    ) -> Result<()> {
        withdraw_platform_fees::withdraw_platform_fees_handler(ctx, amount)
    }
}
