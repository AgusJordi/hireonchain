use anchor_lang::prelude::*;
use crate::state::{Job, Milestone, JobStatus, MilestoneStatus, seeds};
use crate::errors::FreelanceError;
use crate::events::JobCreated;

pub const MAX_MILESTONES: usize = 10;

pub fn create_job_handler(
    ctx: Context<CreateJob>,
    job_id: u64,
    milestone_amounts: Vec<u64>,
    milestone_descriptions: Vec<String>,
) -> Result<()> {
    require!(
        milestone_amounts.len() <= MAX_MILESTONES,
        FreelanceError::MaxMilestonesExceeded
    );
    require!(
        milestone_amounts.len() == milestone_descriptions.len(),
        FreelanceError::InvalidMilestoneId
    );

    let total_amount: u64 = milestone_amounts
        .iter()
        .try_fold(0u64, |acc, &x| acc.checked_add(x))
        .ok_or(FreelanceError::Overflow)?;

    let clock = Clock::get()?;
    let job = &mut ctx.accounts.job;

    job.job_id = job_id;
    job.client = ctx.accounts.client.key();
    job.freelancer = ctx.accounts.freelancer.key();
    job.total_amount = total_amount;
    job.escrow_balance = 0;
    job.milestone_count = milestone_amounts.len() as u8;
    job.milestones_paid = 0;
    job.status = JobStatus::Created;
    job.token_mint = ctx.accounts.token_mint.key();
    job.created_at = clock.unix_timestamp;
    job.bump = ctx.bumps.job;
    job.vault_bump = ctx.bumps.vault;

    emit!(JobCreated {
        job_id,
        client: job.client,
        freelancer: job.freelancer,
        total_amount,
        milestone_count: job.milestone_count,
        token_mint: job.token_mint,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

#[derive(Accounts)]
#[instruction(job_id: u64, milestone_amounts: Vec<u64>, milestone_descriptions: Vec<String>)]
pub struct CreateJob<'info> {
    #[account(mut)]
    pub client: Signer<'info>,

    /// CHECK: Just storing the pubkey
    pub freelancer: UncheckedAccount<'info>,

    #[account(
        init,
        payer = client,
        space = 8 + Job::INIT_SPACE,
        seeds = [seeds::JOB, client.key().as_ref(), &job_id.to_le_bytes()],
        bump
    )]
    pub job: Account<'info, Job>,

    /// CHECK: PDA that will hold SOL
    #[account(
        seeds = [seeds::VAULT, job.key().as_ref()],
        bump
    )]
    pub vault: UncheckedAccount<'info>,

    /// CHECK: Can be any mint or system program for SOL
    pub token_mint: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn create_milestone_handler(
    ctx: Context<CreateMilestone>,
    milestone_id: u8,
    amount: u64,
    description_hash: String,
) -> Result<()> {
    require!(
        milestone_id < ctx.accounts.job.milestone_count,
        FreelanceError::InvalidMilestoneId
    );

    let milestone = &mut ctx.accounts.milestone;

    milestone.job = ctx.accounts.job.key();
    milestone.milestone_id = milestone_id;
    milestone.amount = amount;
    milestone.status = MilestoneStatus::Pending;
    milestone.description_hash = description_hash;
    milestone.submission_hash = String::new();
    milestone.submitted_at = 0;
    milestone.approved_at = 0;
    milestone.paid_at = 0;
    milestone.bump = ctx.bumps.milestone;

    Ok(())
}

#[derive(Accounts)]
#[instruction(milestone_id: u8, amount: u64, description_hash: String)]
pub struct CreateMilestone<'info> {
    #[account(mut)]
    pub client: Signer<'info>,

    #[account(
        constraint = job.client == client.key() @ FreelanceError::UnauthorizedClient,
        constraint = job.status == JobStatus::Created @ FreelanceError::InvalidJobStatus
    )]
    pub job: Account<'info, Job>,

    #[account(
        init,
        payer = client,
        space = 8 + Milestone::INIT_SPACE,
        seeds = [seeds::MILESTONE, job.key().as_ref(), &[milestone_id]],
        bump
    )]
    pub milestone: Account<'info, Milestone>,

    pub system_program: Program<'info, System>,
}
