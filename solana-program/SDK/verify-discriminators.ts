/**
 * Run with: npx ts-node verify-discriminators.ts
 */

import crypto from 'crypto';

const instructions = [
  'initialize_platform',
  'create_job',
  'create_milestone',
  'fund_escrow',
  'submit_milestone',
  'approve_milestone',
  'release_milestone',
  'cancel_job',
  'open_dispute',
  'submit_dispute_evidence',
  'resolve_dispute',
  'set_platform_fee',
  'withdraw_platform_fees',
];

const currentDiscriminators: Record<string, number[]> = {
  initialize_platform: [119, 201, 101, 45, 75, 122, 89, 3],
  create_job: [178, 130, 217, 110, 100, 27, 82, 119],
  create_milestone: [239, 58, 201, 28, 40, 186, 173, 48],
  fund_escrow: [155, 18, 218, 141, 182, 213, 69, 201],
  submit_milestone: [35, 96, 220, 215, 102, 83, 139, 52],
  approve_milestone: [145, 85, 92, 60, 50, 130, 219, 106],
  release_milestone: [56, 2, 199, 164, 184, 108, 167, 222],
  cancel_job: [126, 241, 155, 241, 50, 236, 83, 118],
  open_dispute: [137, 25, 99, 119, 23, 223, 161, 42],
  submit_dispute_evidence: [177, 174, 100, 125, 106, 213, 241, 22],
  resolve_dispute: [231, 6, 202, 6, 96, 103, 12, 230],
  set_platform_fee: [19, 70, 111, 182, 156, 58, 208, 203],
  withdraw_platform_fees: [87, 24, 138, 122, 62, 146, 186, 199],
};

console.log('='.repeat(60));
console.log('Anchor Discriminator Verification');
console.log('='.repeat(60));
console.log();

let allMatch = true;

instructions.forEach(name => {
  const hash = crypto.createHash('sha256')
    .update(`global:${name}`)
    .digest();

  const expected = Array.from(hash.slice(0, 8));
  const current = currentDiscriminators[name];

  const match = JSON.stringify(expected) === JSON.stringify(current);

  if (!match) {
    allMatch = false;
    console.log(` ${name}: MISMATCH`);
    console.log(`   Expected: [${expected.join(', ')}]`);
    console.log(`   Current:  [${current.join(', ')}]`);
    console.log();
  } else {
    console.log(` ${name}: [${expected.join(', ')}]`);
  }
});

console.log();
console.log('='.repeat(60));

if (allMatch) {
  console.log('✓ All discriminators match!');
  console.log();
  console.log('Copy these to instructions.ts if needed:');
  console.log();
  console.log('const DISCRIMINATORS = {');
  instructions.forEach(name => {
    const hash = crypto.createHash('sha256')
      .update(`global:${name}`)
      .digest();
    const values = Array.from(hash.slice(0, 8));
    console.log(`  ${name}: Buffer.from([${values.join(', ')}]),`);
  });
  console.log('} as const;');
  process.exit(0);
} else {
  console.log(' Some discriminators do not match. Update instructions.ts with the expected values.');
  process.exit(1);
}
