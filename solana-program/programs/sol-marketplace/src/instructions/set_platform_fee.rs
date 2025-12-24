use anchor_lang::prelude::*;
use crate::state::{PlatformConfig, seeds};
use crate::errors::FreelanceError;
use crate::events::PlatformConfigUpdated;
use crate::constants::MAX_FEE_BPS;

pub fn set_platform_fee_handler(ctx: Context<SetPlatformFee>, new_fee_bps: u16) -> Result<()> {
    require!(
        new_fee_bps <= MAX_FEE_BPS,
        FreelanceError::FeeExceedsMaximum
    );

    let config = &mut ctx.accounts.platform_config;
    config.fee_bps = new_fee_bps;

    emit!(PlatformConfigUpdated {
        admin: config.admin,
        fee_bps: new_fee_bps,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct SetPlatformFee<'info> {
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [seeds::PLATFORM_CONFIG],
        bump = platform_config.bump,
        constraint = platform_config.admin == admin.key() @ FreelanceError::UnauthorizedAdmin
    )]
    pub platform_config: Account<'info, PlatformConfig>,
}
