use anchor_lang::prelude::*;
use crate::state::{PlatformConfig, seeds};
use crate::errors::FreelanceError;
use crate::events::FeesWithdrawn;

pub fn withdraw_platform_fees_handler(ctx: Context<WithdrawPlatformFees>, amount: u64) -> Result<()> {
    require!(
        amount <= ctx.accounts.treasury.lamports(),
        FreelanceError::InsufficientFunds
    );

    **ctx.accounts.treasury.try_borrow_mut_lamports()? = ctx
        .accounts
        .treasury
        .lamports()
        .checked_sub(amount)
        .ok_or(FreelanceError::InsufficientFunds)?;

    **ctx.accounts.recipient.try_borrow_mut_lamports()? = ctx
        .accounts
        .recipient
        .lamports()
        .checked_add(amount)
        .ok_or(FreelanceError::Overflow)?;

    emit!(FeesWithdrawn {
        amount,
        recipient: ctx.accounts.recipient.key(),
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(()) 
}

#[derive(Accounts)]
pub struct WithdrawPlatformFees<'info> {
    pub admin: Signer<'info>,

    #[account(
        seeds = [seeds::PLATFORM_CONFIG],
        bump = platform_config.bump,
        constraint = platform_config.admin == admin.key() @ FreelanceError::UnauthorizedAdmin
    )]
    pub platform_config: Account<'info, PlatformConfig>,

    /// CHECK: Validated through platform_config.treasury
    #[account(
        mut,
        constraint = treasury.key() == platform_config.treasury @ FreelanceError::UnauthorizedAdmin
    )]
    pub treasury: UncheckedAccount<'info>,

    /// CHECK: Can be any account
    #[account(mut)]
    pub recipient: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}
