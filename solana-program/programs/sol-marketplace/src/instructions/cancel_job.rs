use crate::errors::FreelanceError;
use crate::events::JobCancelled;
use crate::state::{seeds, Job, JobStatus};
use anchor_lang::prelude::*;
use anchor_lang::system_program;

pub fn cancel_job_handler(ctx: Context<CancelJob>) -> Result<()> {
    let job_key = ctx.accounts.job.key();
    let vault_bump = ctx.accounts.job.vault_bump;

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
        let vault_seeds: &[&[u8]] = &[seeds::VAULT, job_key.as_ref(), &[vault_bump]];
        let signer_seeds = &[vault_seeds];

        system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.client.to_account_info(),
                },
                signer_seeds,
            ),
            refund_amount,
        )?;
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
