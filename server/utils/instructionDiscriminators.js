/**
 * Anchor Instruction Discriminators for sol-marketplace
 *
 * These are the first 8 bytes of each instruction's data payload.
 * They are derived from SHA256("global:<instruction_name>")[0..8].
 * Values taken directly from SDK/instructions.ts (ground truth).
 *
 * The backend uses these to identify which on-chain instruction
 * was actually executed in a given transaction, rather than
 * trusting the frontend-claimed action type.
 */

const DISCRIMINATORS = {
  initialize_platform:      Buffer.from([119, 201, 101, 45, 75, 122, 89, 3]),
  create_job:               Buffer.from([178, 130, 217, 110, 100, 27, 82, 119]),
  create_milestone:         Buffer.from([239, 58, 201, 28, 40, 186, 173, 48]),
  fund_escrow:              Buffer.from([155, 18, 218, 141, 182, 213, 69, 201]),
  submit_milestone:         Buffer.from([35, 96, 220, 215, 102, 83, 139, 52]),
  approve_milestone:        Buffer.from([145, 85, 92, 60, 50, 130, 219, 106]),
  release_milestone:        Buffer.from([56, 2, 199, 164, 184, 108, 167, 222]),
  cancel_job:               Buffer.from([126, 241, 155, 241, 50, 236, 83, 118]),
  open_dispute:             Buffer.from([137, 25, 99, 119, 23, 223, 161, 42]),
  submit_dispute_evidence:  Buffer.from([177, 174, 100, 125, 106, 213, 241, 22]),
  resolve_dispute:          Buffer.from([231, 6, 202, 6, 96, 103, 12, 230]),
  set_platform_fee:         Buffer.from([19, 70, 111, 182, 156, 58, 208, 203]),
  withdraw_platform_fees:   Buffer.from([87, 24, 138, 122, 62, 146, 186, 199]),
};

/**
 * Maps frontend action types (from recordTransaction) to expected
 * on-chain instruction names. This is the canonical mapping between
 * what the frontend *claims* happened and what the program *actually* does.
 */
const ACTION_TO_INSTRUCTION = {
  fund:     'fund_escrow',
  submit:   'submit_milestone',
  approve:  'approve_milestone',
  release:  'release_milestone',
  cancel:   'cancel_job',
  dispute:  'open_dispute',
  evidence: 'submit_dispute_evidence',
  resolve:  'resolve_dispute',
};

/**
 * Reverse map: instruction name → frontend action type
 */
const INSTRUCTION_TO_ACTION = Object.fromEntries(
  Object.entries(ACTION_TO_INSTRUCTION).map(([action, ix]) => [ix, action])
);

/**
 * Identify instruction name from raw instruction data buffer.
 * Returns the canonical Anchor instruction name, or null if unknown.
 */
function identifyInstruction(instructionData) {
  if (!instructionData || instructionData.length < 8) return null;

  const disc = Buffer.isBuffer(instructionData)
    ? instructionData.subarray(0, 8)
    : Buffer.from(instructionData).subarray(0, 8);

  for (const [name, expected] of Object.entries(DISCRIMINATORS)) {
    if (disc.equals(expected)) return name;
  }
  return null;
}

module.exports = {
  DISCRIMINATORS,
  ACTION_TO_INSTRUCTION,
  INSTRUCTION_TO_ACTION,
  identifyInstruction,
};
