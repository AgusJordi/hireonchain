/**
 *  npx ts-node check-platform.ts
 */

import { Connection, clusterApiUrl } from '@solana/web3.js';
import { PROGRAM_ID } from './instructions';
import { fetchPlatformConfig } from './utils';

async function main() {
  console.log('='.repeat(60));
  console.log('Platform Status Check');
  console.log('='.repeat(60));
  console.log();

  console.log('Program ID:', PROGRAM_ID.toBase58());
  console.log('Network: devnet');
  console.log();

  // Connect to devnet
  const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
  
  try {
    console.log('Fetching platform configuration...');
    const config = await fetchPlatformConfig(connection, PROGRAM_ID);

    if (!config) {
      console.log('\n Platform NOT initialized');
      console.log('\nTo initialize, run: npx ts-node init-platform.ts');
      process.exit(1);
    }

    console.log('\n✓ Platform IS initialized!\n');
    console.log('Configuration:');
    console.log('  Admin:', config.admin.toBase58());
    console.log('  Treasury:', config.treasury.toBase58());
    console.log('  Arbitrator:', config.arbitrator.toBase58());
    console.log('  Fee BPS:', config.feeBps, `(${config.feeBps / 100}%)`);
    console.log('  Total Fees Collected:', config.totalFeesCollected.toString(), 'lamports');
    console.log('  Bump:', config.bump);

  } catch (error: any) {
    console.error('\n Error checking platform status:', error.message);
    process.exit(1);
  }
}

main();
