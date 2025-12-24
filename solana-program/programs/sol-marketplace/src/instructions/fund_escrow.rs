use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::state::{Job, JobStatus, seeds};
use crate::errors::FreelanceError;
use crate::events::JobFunded;

pub fn fund_escrow_handler(ctx: Context<FundEscrow>) -> Result<()> {
    let job = &mut ctx.accounts.job;

    require!(
        job.status == JobStatus::Created,
        FreelanceError::JobAlreadyFunded
    );

    let cpi_context = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        system_program::Transfer {
            from: ctx.accounts.client.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
        },
    );
    system_program::transfer(cpi_context, job.total_amount)?;

    job.escrow_balance = job.total_amount;
    job.status = JobStatus::InProgress;

    emit!(JobFunded {
        job_id: job.job_id,
        amount: job.total_amount,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct FundEscrow<'info> {
    #[account(mut)]
    pub client: Signer<'info>,

    #[account(
        mut,
        constraint = job.client == client.key() @ FreelanceError::UnauthorizedClient,
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
