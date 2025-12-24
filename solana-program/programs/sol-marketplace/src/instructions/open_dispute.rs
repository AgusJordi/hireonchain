use anchor_lang::prelude::*;
use crate::state::{Job, Dispute, PlatformConfig, JobStatus, DisputeStatus, DisputeRuling, seeds};
use crate::errors::FreelanceError;
use crate::events::DisputeOpened;

pub fn open_dispute_handler(ctx: Context<OpenDispute>, milestone_id: u8) -> Result<()> {
    let job = &mut ctx.accounts.job;
    let dispute = &mut ctx.accounts.dispute;

    require!(
        job.status == JobStatus::InProgress,
        FreelanceError::InvalidJobStatus
    );

    let clock = Clock::get()?;

    dispute.job = job.key();
    dispute.opener = ctx.accounts.opener.key();
    dispute.milestone_id = milestone_id;
    dispute.status = DisputeStatus::Open;
    dispute.ruling = DisputeRuling::None;
    dispute.client_evidence = String::new();
    dispute.freelancer_evidence = String::new();
    dispute.opened_at = clock.unix_timestamp;
    dispute.resolved_at = 0;
    dispute.bump = ctx.bumps.dispute;

    job.status = JobStatus::Disputed;

    emit!(DisputeOpened {
        job_id: job.job_id,
        opener: dispute.opener,
        milestone_id,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

#[derive(Accounts)]
#[instruction(milestone_id: u8)]
pub struct OpenDispute<'info> {
    #[account(mut)]
    pub opener: Signer<'info>,

    #[account(
        seeds = [seeds::PLATFORM_CONFIG],
        bump = platform_config.bump
    )]
    pub platform_config: Account<'info, PlatformConfig>,

    #[account(
        mut,
        constraint = (job.client == opener.key() || job.freelancer == opener.key()) @ FreelanceError::UnauthorizedClient,
        constraint = job.status != JobStatus::Disputed @ FreelanceError::ActiveDisputeExists,
        seeds = [seeds::JOB, job.client.as_ref(), &job.job_id.to_le_bytes()],
        bump = job.bump
    )]
    pub job: Account<'info, Job>,

    #[account(
        init,
        payer = opener,
        space = 8 + Dispute::INIT_SPACE,
        seeds = [seeds::DISPUTE, job.key().as_ref()],
        bump
    )]
    pub dispute: Account<'info, Dispute>,

    pub system_program: Program<'info, System>,
}
