use anchor_lang::prelude::*;
use crate::state::{Job, Dispute, PlatformConfig, JobStatus, DisputeStatus, DisputeRuling, seeds};
use crate::errors::FreelanceError;
use crate::events::DisputeResolved;

pub fn resolve_dispute_handler(ctx: Context<ResolveDispute>, ruling: DisputeRuling) -> Result<()> {
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
        DisputeRuling::Split { client_bps, freelancer_bps } => {
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

    if client_amount > 0 {
        **ctx.accounts.vault.try_borrow_mut_lamports()? = ctx
            .accounts
            .vault
            .lamports()
            .checked_sub(client_amount)
            .ok_or(FreelanceError::InsufficientFunds)?;

        **ctx.accounts.client.try_borrow_mut_lamports()? = ctx
            .accounts
            .client
            .lamports()
            .checked_add(client_amount)
            .ok_or(FreelanceError::Overflow)?;
    }

    if freelancer_amount > 0 {
        **ctx.accounts.vault.try_borrow_mut_lamports()? = ctx
            .accounts
            .vault
            .lamports()
            .checked_sub(freelancer_amount)
            .ok_or(FreelanceError::InsufficientFunds)?;

        **ctx.accounts.freelancer.try_borrow_mut_lamports()? = ctx
            .accounts
            .freelancer
            .lamports()
            .checked_add(freelancer_amount)
            .ok_or(FreelanceError::Overflow)?;
    }

    dispute.status = DisputeStatus::Resolved;
    dispute.ruling = ruling.clone();
    dispute.resolved_at = clock.unix_timestamp;

    job.escrow_balance = 0;
    job.status = JobStatus::Completed;

    let ruling_str = match ruling {
        DisputeRuling::ClientWins => "ClientWins".to_string(),
        DisputeRuling::FreelancerWins => "FreelancerWins".to_string(),
        DisputeRuling::Split { client_bps, freelancer_bps } => 
            format!("Split({},{})", client_bps, freelancer_bps),
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
