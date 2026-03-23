use crate::errors::FreelanceError;
use crate::events::DisputeResolved;
use crate::state::{
    seeds, Dispute, DisputeRuling, DisputeStatus, Job, JobStatus, Milestone, MilestoneStatus,
    PlatformConfig,
};
use anchor_lang::prelude::*;
use anchor_lang::system_program;

pub fn resolve_dispute_handler(ctx: Context<ResolveDispute>, ruling: DisputeRuling) -> Result<()> {
    let job_key = ctx.accounts.job.key();
    let vault_bump = ctx.accounts.job.vault_bump;

    let job = &mut ctx.accounts.job;
    let dispute = &mut ctx.accounts.dispute;

    require!(
        dispute.status == DisputeStatus::Open,
        FreelanceError::DisputeAlreadyResolved
    );

    let clock = Clock::get()?;
    let escrow_balance = job.escrow_balance;

    let (client_amount, freelancer_amount) = match ruling {
        DisputeRuling::ClientWins => (escrow_balance, 0u64),
        DisputeRuling::FreelancerWins => (0u64, escrow_balance),
        DisputeRuling::Split {
            client_bps,
            freelancer_bps,
        } => {
            require!(
                client_bps.checked_add(freelancer_bps) == Some(10000),
                FreelanceError::InvalidSplitPercentages
            );
            let client_amt = escrow_balance
                .checked_mul(client_bps as u64)
                .ok_or(FreelanceError::Overflow)?
                .checked_div(10000)
                .ok_or(FreelanceError::Overflow)?;
            let freelancer_amt = escrow_balance
                .checked_sub(client_amt)
                .ok_or(FreelanceError::Overflow)?;
            (client_amt, freelancer_amt)
        }
        DisputeRuling::None => return Err(FreelanceError::InvalidJobStatus.into()),
    };

    let vault_seeds: &[&[u8]] = &[seeds::VAULT, job_key.as_ref(), &[vault_bump]];
    let signer_seeds = &[vault_seeds];

    if client_amount > 0 {
        system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.client.to_account_info(),
                },
                signer_seeds,
            ),
            client_amount,
        )?;
    }

    if freelancer_amount > 0 {
        system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.freelancer.to_account_info(),
                },
                signer_seeds,
            ),
            freelancer_amount,
        )?;
    }

    dispute.status = DisputeStatus::Resolved;
    dispute.ruling = ruling.clone();
    dispute.resolved_at = clock.unix_timestamp;

    job.escrow_balance = 0;

    // Update disputed milestone status and job counters
    let milestone = &mut ctx.accounts.milestone;
    match ruling {
        DisputeRuling::FreelancerWins | DisputeRuling::Split { .. } => {
            milestone.status = MilestoneStatus::Paid;
            milestone.paid_at = clock.unix_timestamp;
            job.milestones_paid = job
                .milestones_paid
                .checked_add(1)
                .ok_or(FreelanceError::Overflow)?;
        }
        DisputeRuling::ClientWins => {
            milestone.status = MilestoneStatus::Pending;
            if job.milestones_approved > 0 {
                job.milestones_approved = job
                    .milestones_approved
                    .checked_sub(1)
                    .ok_or(FreelanceError::Overflow)?;
            }
        }
        DisputeRuling::None => unreachable!(),
    }

    if job.milestones_paid == job.milestone_count {
        job.status = JobStatus::Completed;
    } else {
        job.status = JobStatus::InProgress;
    }

    let ruling_str = match ruling {
        DisputeRuling::ClientWins => "ClientWins".to_string(),
        DisputeRuling::FreelancerWins => "FreelancerWins".to_string(),
        DisputeRuling::Split {
            client_bps,
            freelancer_bps,
        } => format!("Split({},{})", client_bps, freelancer_bps),
        DisputeRuling::None => "None".to_string(),
    };

    emit!(DisputeResolved {
        job_id: job.job_id,
        ruling: ruling_str,
        client_amount,
        freelancer_amount,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct ResolveDispute<'info> {
    pub arbitrator: Signer<'info>,

    #[account(
        seeds = [seeds::PLATFORM_CONFIG],
        bump = platform_config.bump,
        constraint = platform_config.arbitrator == arbitrator.key() @ FreelanceError::UnauthorizedArbitrator
    )]
    pub platform_config: Account<'info, PlatformConfig>,

    #[account(
        mut,
        constraint = job.status == JobStatus::Disputed @ FreelanceError::JobNotDisputed,
        seeds = [seeds::JOB, job.client.as_ref(), &job.job_id.to_le_bytes()],
        bump = job.bump
    )]
    pub job: Account<'info, Job>,

    #[account(
        mut,
        constraint = dispute.job == job.key() @ FreelanceError::InvalidJobStatus,
        seeds = [seeds::DISPUTE, job.key().as_ref()],
        bump = dispute.bump
    )]
    pub dispute: Account<'info, Dispute>,

    #[account(
        mut,
        constraint = milestone.job == job.key() @ FreelanceError::InvalidMilestoneId,
        constraint = milestone.milestone_id == dispute.milestone_id @ FreelanceError::InvalidMilestoneId,
        seeds = [seeds::MILESTONE, job.key().as_ref(), &[dispute.milestone_id]],
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

    /// CHECK: Validated through job.client
    #[account(
        mut,
        constraint = client.key() == job.client @ FreelanceError::UnauthorizedClient
    )]
    pub client: UncheckedAccount<'info>,

    /// CHECK: Validated through job.freelancer
    #[account(
        mut,
        constraint = freelancer.key() == job.freelancer @ FreelanceError::UnauthorizedFreelancer
    )]
    pub freelancer: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}
