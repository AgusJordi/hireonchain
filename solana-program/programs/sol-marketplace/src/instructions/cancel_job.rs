use anchor_lang::prelude::*;
use crate::state::{Job, JobStatus, seeds};
use crate::errors::FreelanceError;
use crate::events::JobCancelled;

pub fn cancel_job_handler(ctx: Context<CancelJob>) -> Result<()> {
    let job = &mut ctx.accounts.job;

    require!(
        job.status == JobStatus::Created
            || job.status == JobStatus::Funded
            || job.status == JobStatus::InProgress,
        FreelanceError::InvalidJobStatus
    );
    require!(
        job.milestones_approved == 0,
        FreelanceError::CannotCancelWithApprovedMilestones
    );

    let clock = Clock::get()?;
    let refund_amount = job.escrow_balance;

    if refund_amount > 0 {
        **ctx.accounts.vault.try_borrow_mut_lamports()? = ctx
            .accounts
            .vault
            .lamports()
            .checked_sub(refund_amount)
            .ok_or(FreelanceError::InsufficientFunds)?;

        **ctx.accounts.client.try_borrow_mut_lamports()? = ctx
            .accounts
            .client
            .lamports()
            .checked_add(refund_amount)
            .ok_or(FreelanceError::Overflow)?;
    }

    job.escrow_balance = 0;
    job.status = JobStatus::Cancelled;

    emit!(JobCancelled {
        job_id: job.job_id,
        refund_amount,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct CancelJob<'info> {
    #[account(mut)]
    pub client: Signer<'info>,

    #[account(
        mut,
        constraint = job.client == client.key() @ FreelanceError::UnauthorizedClient,
        constraint = job.status != JobStatus::Disputed @ FreelanceError::CannotCancelWithActiveDispute,
        constraint = job.milestones_approved == 0 @ FreelanceError::CannotCancelWithApprovedMilestones,
        seeds = [seeds::JOB, job.client.as_ref(), &job.job_id.to_le_bytes()],
        bump = job.bump
    )]
    pub job: Account<'info, Job>,

    /// CHECK: PDA validated by seeds
    #[account(
        mut,
        seeds = [seeds::VAULT, job.key().as_ref()],
        bump = job.vault_bump
    )]
    pub vault: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}
