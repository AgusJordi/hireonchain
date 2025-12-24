use anchor_lang::prelude::*;
use crate::state::{PlatformConfig, seeds};
use crate::errors::FreelanceError;
use crate::events::PlatformConfigUpdated;
use crate::constants::MAX_FEE_BPS;

pub fn initialize_platform_handler(
    ctx: Context<InitializePlatform>,
    fee_bps: u16,
) -> Result<()> {
    require!(
        fee_bps <= MAX_FEE_BPS,
        FreelanceError::FeeExceedsMaximum
    );

    let config = &mut ctx.accounts.platform_config;
    
    config.admin = ctx.accounts.admin.key();
    config.treasury = ctx.accounts.treasury.key();
    config.arbitrator = ctx.accounts.arbitrator.key();
    config.fee_bps = fee_bps;
    config.total_fees_collected = 0;
    config.bump = ctx.bumps.platform_config;

    emit!(PlatformConfigUpdated {
        admin: config.admin,
        fee_bps: config.fee_bps,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct InitializePlatform<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = 8 + PlatformConfig::INIT_SPACE,
        seeds = [seeds::PLATFORM_CONFIG],
        bump
    )]
    pub platform_config: Account<'info, PlatformConfig>,

    /// CHECK: Safe - recipient address only
    pub treasury: UncheckedAccount<'info>,

    /// CHECK: This is just a pubkey for authorization
    pub arbitrator: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}
