use anchor_lang::prelude::*;
use crate::state::{Job, Dispute, DisputeStatus, seeds};
use crate::errors::FreelanceError;

pub fn submit_dispute_evidence_handler(ctx: Context<SubmitDisputeEvidence>, evidence_hash: String) -> Result<()> {
    let job = &ctx.accounts.job;
    let dispute = &mut ctx.accounts.dispute;

    require!(
        dispute.status == DisputeStatus::Open,
        FreelanceError::DisputeAlreadyResolved
    );

    let submitter = ctx.accounts.submitter.key();
    
    if submitter == job.client {
        dispute.client_evidence = evidence_hash;
    } else if submitter == job.freelancer {
        dispute.freelancer_evidence = evidence_hash;
    } else {
        return Err(FreelanceError::UnauthorizedClient.into());
    }

    Ok(())
}

#[derive(Accounts)]
pub struct SubmitDisputeEvidence<'info> {
    pub submitter: Signer<'info>,

    #[account(
        constraint = job.client == submitter.key() || job.freelancer == submitter.key() @ FreelanceError::UnauthorizedClient,
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
}
