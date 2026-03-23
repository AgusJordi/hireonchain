const { Connection, PublicKey, clusterApiUrl } = require('@solana/web3.js');

// Get Solana connection based on network configuration
const getSolanaConnection = () => {
  const network = process.env.SOLANA_NETWORK || 'devnet';
  return new Connection(clusterApiUrl(network), 'confirmed');
};

// Validate a Solana wallet address
const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const isValidSolanaAddress = address => {
  if (!address || !SOLANA_ADDRESS_REGEX.test(address)) return false;
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
};

// Get account information
const getAccountInfo = async address => {
  try {
    const connection = getSolanaConnection();
    const pubkey = new PublicKey(address);
    const accountInfo = await connection.getAccountInfo(pubkey);
    return accountInfo;
  } catch (error) {
    console.error('Error getting account info:', error);
    return null;
  }
};

// Get account balance
const getBalance = async address => {
  try {
    const connection = getSolanaConnection();
    const pubkey = new PublicKey(address);
    const balance = await connection.getBalance(pubkey);
    return balance / 1000000000; // Convert lamports to SOL
  } catch (error) {
    console.error('Error getting balance:', error);
    return 0;
  }
};

// Verify transaction exists and was successful
const verifyTransaction = async signature => {
  try {
    const connection = getSolanaConnection();
    const transaction = await connection.getTransaction(signature, {
      commitment: 'confirmed',
    });

    if (!transaction) {
      return { valid: false, error: 'Transaction not found' };
    }

    if (transaction.meta?.err) {
      return { valid: false, error: 'Transaction failed on-chain', details: transaction.meta.err };
    }

    return { valid: true, transaction };
  } catch (error) {
    console.error('Error verifying transaction:', error);
    return { valid: false, error: error.message };
  }
};

const verifyProgramTransaction = async (signature, expectedProgramId) => {
  const result = await verifyTransaction(signature);

  if (!result.valid) {
    return result;
  }

  const { transaction } = result;

  const programId = process.env.SOLANA_PROGRAM_ID;
  if (!programId) {
    return { valid: false, error: 'SOLANA_PROGRAM_ID not configured in environment variables' };
  }

  const involvesProgram = transaction.transaction.message.accountKeys.some(
    key => key.toString() === programId
  );

  if (!involvesProgram) {
    return { valid: false, error: 'Transaction does not involve our program' };
  }

  return { valid: true, transaction };
};

module.exports = {
  getSolanaConnection,
  isValidSolanaAddress,
  getAccountInfo,
  getBalance,
  verifyTransaction,
  verifyProgramTransaction,
};
