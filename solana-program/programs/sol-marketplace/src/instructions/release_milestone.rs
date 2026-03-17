use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::state::{Job, Milestone, PlatformConfig, JobStatus, MilestoneStatus, seeds};
use crate::errors::FreelanceError;
use crate::events::MilestonePaid;

pub fn release_milestone_handler(ctx: Context<ReleaseMilestone>) -> Result<()> {
    // Extract values needed for PDA seeds before mutable borrows
    let job_key = ctx.accounts.job.key();
    let vault_bump = ctx.accounts.job.vault_bump;
    let fee_bps = ctx.accounts.platform_config.fee_bps;

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
        .checked_mul(fee_bps as u64)
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

    // Build vault PDA signer seeds
    let vault_seeds: &[&[u8]] = &[seeds::VAULT, job_key.as_ref(), &[vault_bump]];
    let signer_seeds = &[vault_seeds];

    // Transfer freelancer payment from vault
    system_program::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.freelancer.to_account_info(),
            },
            signer_seeds,
        ),
        freelancer_payment,
    )?;

    // Transfer platform fee from vault to treasury
    if fee > 0 {
        system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.treasury.to_account_info(),
                },
                signer_seeds,
            ),
            fee,
        )?;

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

    if job.milestones_approved > 0 {
        job.milestones_approved = job
            .milestones_approved
            .checked_sub(1)
            .ok_or(FreelanceError::Overflow)?;
    }

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
