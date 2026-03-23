/**
 *   npx ts-node init-platform.ts
 */

import { Connection, Keypair, clusterApiUrl } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { FreelanceClient } from './client';
import { PROGRAM_ID } from './instructions';
import { fetchPlatformConfig } from './utils';

// Configuration
const FEE_BPS = 250; // 2.5% platform fee

// Check for custom keypair path from environment variable
const CUSTOM_KEYPAIR_PATH = process.env.KEYPAIR_PATH;

async function main() {
  console.log('='.repeat(60));
  console.log('Platform Initialization Script');
  console.log('='.repeat(60));
  console.log();

  // Connect to devnet
  const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
  console.log('Connected to devnet');

  // Create SDK client
  const client = new FreelanceClient(connection, PROGRAM_ID, {
    commitment: 'confirmed',
    preflight: 'confirmed',
    onStatus: (status) => {
      console.log('Transaction status:', status);
    },
  });

  // Check if platform is already initialized
  console.log('\nChecking if platform is already initialized...');
  const existingConfig = await fetchPlatformConfig(connection, PROGRAM_ID);

  if (existingConfig) {
    console.log('\n✓ Platform is ALREADY initialized!');
    console.log('\nCurrent Platform Configuration:');
    console.log('  Admin:', existingConfig.admin.toBase58());
    console.log('  Treasury:', existingConfig.treasury.toBase58());
    console.log('  Arbitrator:', existingConfig.arbitrator.toBase58());
    console.log('  Fee BPS:', existingConfig.feeBps);
    console.log('  Total Fees Collected:', existingConfig.totalFeesCollected.toString());
    console.log('\nNo action needed.');
    return;
  }

  console.log('Platform NOT initialized. Proceeding with initialization...\n');

  // Determine keypair path - check env var first, then standard locations
  let keypairPath: string | null = null;
  const homeDir = os.homedir();

  const possiblePaths = [
    CUSTOM_KEYPAIR_PATH,  // Custom path from env
    path.join(homeDir, '.config', 'solana', 'id.json'),  // Linux/WSL standard
    path.join(homeDir, '.solana', 'id.json'),  // Alternative location
  ].filter(Boolean) as string[];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      keypairPath = p;
      break;
    }
  }

  if (!keypairPath) {
    console.error('\n❌ ERROR: Keypair not found!');
    console.error('Checked paths:');
    possiblePaths.forEach(p => console.error(`  - ${p}`));
    console.error('\nOptions:');
    console.error('  1. Run from WSL where Solana CLI is configured');
    console.error('  2. Set KEYPAIR_PATH env var: KEYPAIR_PATH=/path/to/keypair.json npx ts-node init-platform.ts');
    console.error('  3. Generate a new keypair: solana-keygen new');
    console.error('  4. Airdrop SOL: solana airdrop 2 <address> --url devnet');
    process.exit(1);
  }

  console.log('Loading keypair from:', keypairPath);
  const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, 'utf-8')));
  const adminKeypair = Keypair.fromSecretKey(secretKey);
  console.log('Admin public key:', adminKeypair.publicKey.toBase58());

  // Check balance
  const balance = await connection.getBalance(adminKeypair.publicKey);
  console.log('Balance:', balance / 1_000_000_000, 'SOL');

  if (balance < 0.1 * 1_000_000_000) {
    console.error('\n❌ ERROR: Insufficient balance. Need at least 0.1 SOL.');
    console.error('Run: solana airdrop 2', adminKeypair.publicKey.toBase58(), '--url devnet');
    process.exit(1);
  }

  // Create wallet adapter for SDK
  const wallet = {
    publicKey: adminKeypair.publicKey,
    signTransaction: async (tx: any) => {
      tx.partialSign(adminKeypair);
      return tx;
    },
  };

  // For devnet testing, use admin as treasury and arbitrator
  // In production, these would be different addresses
  const treasury = adminKeypair.publicKey;
  const arbitrator = adminKeypair.publicKey;

  console.log('\nInitialization Parameters:');
  console.log('  Admin:', adminKeypair.publicKey.toBase58());
  console.log('  Treasury:', treasury.toBase58());
  console.log('  Arbitrator:', arbitrator.toBase58());
  console.log('  Fee BPS:', FEE_BPS, `(${FEE_BPS / 100}%)`);
  console.log();

  try {
    console.log('Sending initialization transaction...');
    const result = await client.initializePlatform(
      wallet,
      adminKeypair.publicKey,
      treasury,
      arbitrator,
      FEE_BPS
    );

    console.log('\n✓ Platform initialized successfully!');
    console.log('  Transaction ID:', result.txId);
    console.log('  Slot:', result.slot);
    console.log('  Explorer:', `https://explorer.solana.com/tx/${result.txId}?cluster=devnet`);

    // Verify the config was created
    console.log('\nVerifying platform configuration...');
    const newConfig = await fetchPlatformConfig(connection, PROGRAM_ID);

    if (newConfig) {
      console.log('\n✓ Platform Configuration Verified:');
      console.log('  Admin:', newConfig.admin.toBase58());
      console.log('  Treasury:', newConfig.treasury.toBase58());
      console.log('  Arbitrator:', newConfig.arbitrator.toBase58());
      console.log('  Fee BPS:', newConfig.feeBps);
      console.log('  Bump:', newConfig.bump);
    } else {
      console.error('\n❌ ERROR: Could not fetch platform config after initialization.');
    }

  } catch (error: any) {
    console.error('\n❌ ERROR: Failed to initialize platform');
    console.error(error.message);

    if (error.message.includes('already in use') || error.message.includes('already exists')) {
      console.log('\nThe platform may already be initialized. Try fetching the config directly.');
    }

    process.exit(1);
  }
}

main().catch(console.error);
