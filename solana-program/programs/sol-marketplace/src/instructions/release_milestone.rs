use anchor_lang::prelude::*;
use crate::state::{Job, Milestone, PlatformConfig, JobStatus, MilestoneStatus, seeds};
use crate::errors::FreelanceError;
use crate::events::MilestonePaid;

pub fn release_milestone_handler(ctx: Context<ReleaseMilestone>) -> Result<()> {
    let job = &mut ctx.accounts.job;
    let milestone = &mut ctx.accounts.milestone;
    let platform_config = &mut ctx.accounts.platform_config;

    require!(
        job.status == JobStatus::InProgress,
        FreelanceError::InvalidJobStatus
    );
    require!(
        milestone.status == MilestoneStatus::Approved,
        FreelanceError::InvalidMilestoneStatus
    );

    let clock = Clock::get()?;
    let milestone_amount = milestone.amount;

    let fee = milestone_amount
        .checked_mul(platform_config.fee_bps as u64)
        .ok_or(FreelanceError::Overflow)?
        .checked_div(10000)
        .ok_or(FreelanceError::Overflow)?;

    let freelancer_payment = milestone_amount
        .checked_sub(fee)
        .ok_or(FreelanceError::Overflow)?;

    require!(
        job.escrow_balance >= milestone_amount,
        FreelanceError::InsufficientFunds
    );

    **ctx.accounts.vault.try_borrow_mut_lamports()? = ctx
        .accounts
        .vault
        .lamports()
        .checked_sub(milestone_amount)
        .ok_or(FreelanceError::InsufficientFunds)?;

    **ctx.accounts.freelancer.try_borrow_mut_lamports()? = ctx
        .accounts
        .freelancer
        .lamports()
        .checked_add(freelancer_payment)
        .ok_or(FreelanceError::Overflow)?;

    if fee > 0 {
        **ctx.accounts.treasury.try_borrow_mut_lamports()? = ctx
            .accounts
            .treasury
            .lamports()
            .checked_add(fee)
            .ok_or(FreelanceError::Overflow)?;

        platform_config.total_fees_collected = platform_config
            .total_fees_collected
            .checked_add(fee)
            .ok_or(FreelanceError::Overflow)?;
    }

    job.escrow_balance = job
        .escrow_balance
        .checked_sub(milestone_amount)
        .ok_or(FreelanceError::InsufficientFunds)?;

    milestone.status = MilestoneStatus::Paid;
    milestone.paid_at = clock.unix_timestamp;

    job.milestones_paid = job
        .milestones_paid
        .checked_add(1)
        .ok_or(FreelanceError::Overflow)?;

    if job.milestones_paid == job.milestone_count {
        job.status = JobStatus::Completed;
    }

    emit!(MilestonePaid {
        job_id: job.job_id,
        milestone_id: milestone.milestone_id,
        amount: freelancer_payment,
        fee,
        freelancer: ctx.accounts.freelancer.key(),
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct ReleaseMilestone<'info> {
    pub client: Signer<'info>,

    #[account(
        mut,
        seeds = [seeds::PLATFORM_CONFIG],
        bump = platform_config.bump
    )]
    pub platform_config: Account<'info, PlatformConfig>,

    #[account(
        mut,
        constraint = job.client == client.key() @ FreelanceError::UnauthorizedClient,
        constraint = job.status == JobStatus::InProgress @ FreelanceError::InvalidJobStatus,
        seeds = [seeds::JOB, job.client.as_ref(), &job.job_id.to_le_bytes()],
        bump = job.bump
    )]
    pub job: Account<'info, Job>,

    #[account(
        mut,
        constraint = milestone.job == job.key() @ FreelanceError::InvalidMilestoneId,
        constraint = milestone.status == MilestoneStatus::Approved @ FreelanceError::InvalidMilestoneStatus,
        seeds = [seeds::MILESTONE, job.key().as_ref(), &[milestone.milestone_id]],
        bump = milestone.bump
    )]
    pub milestone: Account<'info, Milestone>,

    /// CHECK: PDA validated by seeds
    #[account(
        mut,
        seeds = [seeds::VAULT, job.key().as_ref()],
        bump = job.vault_bump
    )]
    pub vault: UncheckedAccount<'info>,

    /// CHECK: Validated through job.freelancer
    #[account(
        mut,
        constraint = freelancer.key() == job.freelancer @ FreelanceError::UnauthorizedFreelancer
    )]
    pub freelancer: UncheckedAccount<'info>,

    /// CHECK: Validated through platform_config.treasury
    #[account(
        mut,
        constraint = treasury.key() == platform_config.treasury @ FreelanceError::UnauthorizedAdmin
    )]
    pub treasury: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}
