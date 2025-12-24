use anchor_lang::prelude::*;
use crate::state::{Job, Milestone, JobStatus, MilestoneStatus, seeds};
use crate::errors::FreelanceError;
use crate::events::MilestoneSubmitted;

pub fn submit_milestone_handler(ctx: Context<SubmitMilestone>, submission_hash: String) -> Result<()> {
    let job = &ctx.accounts.job;
    let milestone = &mut ctx.accounts.milestone;

    require!(
        job.status == JobStatus::InProgress,
        FreelanceError::InvalidJobStatus
    );
    require!(
        milestone.status == MilestoneStatus::Pending,
        FreelanceError::InvalidMilestoneStatus
    );

    let clock = Clock::get()?;

    milestone.submission_hash = submission_hash.clone();
    milestone.status = MilestoneStatus::Submitted;
    milestone.submitted_at = clock.unix_timestamp;

    emit!(MilestoneSubmitted {
        job_id: job.job_id,
        milestone_id: milestone.milestone_id,
        submission_hash,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct SubmitMilestone<'info> {
    pub freelancer: Signer<'info>,

    #[account(
        mut,
        constraint = job.freelancer == freelancer.key() @ FreelanceError::UnauthorizedFreelancer,
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
