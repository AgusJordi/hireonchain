import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  clusterApiUrl,
  type Cluster,
  TransactionInstruction,
  Keypair,
} from '@solana/web3.js';

interface WalletAdapter {
  publicKey: PublicKey | null;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
}

// Create a connection to the Solana blockchain
export const getSolanaConnection = () => {
  const network = (import.meta.env.VITE_SOLANA_NETWORK || 'devnet') as Cluster;
  return new Connection(clusterApiUrl(network), 'confirmed');
};

// Get the escrow program ID
export const getEscrowProgramId = () => {
  const programId = import.meta.env.VITE_ESCROW_PROGRAM_ID;
  if (!programId) {
    throw new Error('Escrow program ID not found in environment variables');
  }
  return new PublicKey(programId);
};

// Create an escrow account
export const createEscrowAccount = async (
  wallet: WalletAdapter,
  freelancerAddress: string,
  amount: number
) => {
  try {
    if (!wallet.publicKey || !wallet.signTransaction) {
      throw new Error('Wallet not connected');
    }

    const connection = getSolanaConnection();
    const programId = getEscrowProgramId();
    const freelancer = new PublicKey(freelancerAddress);

    // Generate a new keypair for the escrow account
    const escrowAccount = Keypair.generate();

    // Create instruction to initialize escrow
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: freelancer, isSigner: false, isWritable: false },
        { pubkey: escrowAccount.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId,
      data: Buffer.from([0]), // Initialize escrow instruction
    });

    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();

    // Create transaction
    const transaction = new Transaction().add(instruction).add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: escrowAccount.publicKey,
        lamports: amount * LAMPORTS_PER_SOL,
      })
    );

    // Set recent blockhash and fee payer
    transaction.feePayer = wallet.publicKey;
    transaction.recentBlockhash = blockhash;

    // Sign transaction with both the wallet and the escrow account
    const signedTransaction = await wallet.signTransaction(transaction);
    signedTransaction.partialSign(escrowAccount);

    // Send transaction
    const signature = await connection.sendRawTransaction(signedTransaction.serialize());

    // Confirm transaction
    await connection.confirmTransaction(signature, 'confirmed');

    return {
      success: true,
      signature,
      escrowAccount: escrowAccount.publicKey.toString(),
    };
  } catch (error) {
    console.error('Transaction error:', error);
    return { success: false, error: (error as Error).message };
  }
};

// Release funds from escrow
export const releaseEscrow = async (
  wallet: WalletAdapter,
  escrowAccount: string,
  freelancerAddress: string
) => {
  try {
    if (!wallet.publicKey || !wallet.signTransaction) {
      throw new Error('Wallet not connected');
    }

    const connection = getSolanaConnection();
    const programId = getEscrowProgramId();
    const escrow = new PublicKey(escrowAccount);
    const freelancer = new PublicKey(freelancerAddress);

    // Create instruction to release escrow
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: freelancer, isSigner: false, isWritable: true },
        { pubkey: escrow, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId,
      data: Buffer.from([1]), // Release escrow instruction
    });

    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();

    // Create transaction
    const transaction = new Transaction().add(instruction);

    // Set recent blockhash and fee payer
    transaction.feePayer = wallet.publicKey;
    transaction.recentBlockhash = blockhash;

    // Sign transaction
    const signedTransaction = await wallet.signTransaction(transaction);

    // Send transaction
    const signature = await connection.sendRawTransaction(signedTransaction.serialize());

    // Confirm transaction
    await connection.confirmTransaction(signature, 'confirmed');

    return { success: true, signature };
  } catch (error) {
    console.error('Transaction error:', error);
    return { success: false, error: (error as Error).message };
  }
};

// Get SOL balance of an address
export const getBalance = async (address: string) => {
  try {
    const connection = getSolanaConnection();
    const publicKey = new PublicKey(address);
    const balance = await connection.getBalance(publicKey);
    return balance / LAMPORTS_PER_SOL;
  } catch (error) {
    console.error('Error getting balance:', error);
    return 0;
  }
};

// Verify a transaction
export const verifyTransaction = async (signature: string) => {
  try {
    const connection = getSolanaConnection();
    const transaction = await connection.getTransaction(signature);
    return transaction;
  } catch (error) {
    console.error('Error verifying transaction:', error);
    return null;
  }
};
