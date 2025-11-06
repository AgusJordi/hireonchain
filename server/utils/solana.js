const { Connection, PublicKey, clusterApiUrl } = require("@solana/web3.js");

// Get Solana connection based on network configuration
const getSolanaConnection = () => {
  const network = process.env.SOLANA_NETWORK || "devnet";
  return new Connection(clusterApiUrl(network), "confirmed");
};

// Validate a Solana wallet address
const isValidSolanaAddress = (address) => {
  try {
    new PublicKey(address);
    return true;
  } catch (error) {
    return false;
  }
};

// Get account information
const getAccountInfo = async (address) => {
  try {
    const connection = getSolanaConnection();
    const pubkey = new PublicKey(address);
    const accountInfo = await connection.getAccountInfo(pubkey);
    return accountInfo;
  } catch (error) {
    console.error("Error getting account info:", error);
    return null;
  }
};

// Get account balance
const getBalance = async (address) => {
  try {
    const connection = getSolanaConnection();
    const pubkey = new PublicKey(address);
    const balance = await connection.getBalance(pubkey);
    return balance / 1000000000; // Convert lamports to SOL
  } catch (error) {
    console.error("Error getting balance:", error);
    return 0;
  }
};

// Verify transaction
const verifyTransaction = async (signature) => {
  try {
    const connection = getSolanaConnection();
    const transaction = await connection.getTransaction(signature);
    return transaction;
  } catch (error) {
    console.error("Error verifying transaction:", error);
    return null;
  }
};

module.exports = {
  getSolanaConnection,
  isValidSolanaAddress,
  getAccountInfo,
  getBalance,
  verifyTransaction,
};
