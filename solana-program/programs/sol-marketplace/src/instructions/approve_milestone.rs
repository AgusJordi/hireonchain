use anchor_lang::prelude::*;
use crate::state::{Job, Milestone, JobStatus, MilestoneStatus, seeds};
use crate::errors::FreelanceError;
use crate::events::MilestoneApproved;

pub fn approve_milestone_handler(ctx: Context<ApproveMilestone>) -> Result<()> {
    let job = &ctx.accounts.job;
    let milestone = &mut ctx.accounts.milestone;

    require!(
        job.status == JobStatus::InProgress,
        FreelanceError::InvalidJobStatus
    );
    require!(
        milestone.status == MilestoneStatus::Submitted,
        FreelanceError::InvalidMilestoneStatus
    );

    let clock = Clock::get()?;

    milestone.status = MilestoneStatus::Approved;
    milestone.approved_at = clock.unix_timestamp;

    emit!(MilestoneApproved {
        job_id: job.job_id,
        milestone_id: milestone.milestone_id,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct ApproveMilestone<'info> {
    pub client: Signer<'info>,

    #[account(
        constraint = job.client == client.key() @ FreelanceError::UnauthorizedClient,
        constraint = job.status == JobStatus::InProgress @ FreelanceError::InvalidJobStatus,
        seeds = [seeds::JOB, job.client.as_ref(), &job.job_id.to_le_bytes()],
        bump = job.bump
    )]
    pub job: Account<'info, Job>,

    #[account(
        mut,
        constraint = milestone.job == job.key() @ FreelanceError::InvalidMilestoneId,
        seeds = [seeds::MILESTONE, job.key().as_ref(), &[milestone.milestone_id]],
        bump = milestone.bump
    )]
    pub milestone: Account<'info, Milestone>,
}
