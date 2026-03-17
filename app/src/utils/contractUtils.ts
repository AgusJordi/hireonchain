import axios from 'axios';
import { createEscrowAccount, releaseEscrow } from './solana';
import { PublicKey, Transaction } from '@solana/web3.js';

// Set up axios with auth token
const getAuthConfig = () => {
  const token = localStorage.getItem('sol_token');
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
};

interface WalletAdapter {
  publicKey: PublicKey | null;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
}

// Create a new contract
export const createContract = async (
  jobId: string,
  freelancerAddress: string,
  amount: number,
  wallet: WalletAdapter
) => {
  try {
    if (!wallet.publicKey) {
      throw new Error('Missing public key');
    }

    // First, create the escrow account
    const escrowResult = await createEscrowAccount(wallet, freelancerAddress, amount);

    if (!escrowResult.success) {
      return escrowResult;
    }

    // Then, create the contract in our database
    const response = await axios.post(
      '/api/contracts',
      {
        jobId,
        contractAddress: escrowResult.escrowAccount,
      },
      getAuthConfig()
    );

    return { success: true, data: response.data };
  } catch (error) {
    console.error('Error creating contract:', error);
    return {
      success: false,
      error:
        axios.isAxiosError(error) && error.response
          ? error.response.data.message
          : 'Failed to create contract',
    };
  }
};

// Get all contracts for the current user
export const getContracts = async () => {
  try {
    const response = await axios.get('/api/contracts', getAuthConfig());
    return { success: true, data: response.data };
  } catch (error) {
    console.error('Error fetching contracts:', error);
    return {
      success: false,
      error:
        axios.isAxiosError(error) && error.response
          ? error.response.data.message
          : 'Failed to fetch contracts',
    };
  }
};

// Get contract by ID
export const getContractById = async (contractId: string) => {
  try {
    const response = await axios.get(`/api/contracts/${contractId}`, getAuthConfig());
    return { success: true, data: response.data };
  } catch (error) {
    console.error('Error fetching contract:', error);
    return {
      success: false,
      error:
        axios.isAxiosError(error) && error.response
          ? error.response.data.message
          : 'Failed to fetch contract',
    };
  }
};

// Fund a contract using Phantom wallet
export const fundContract = async (wallet: WalletAdapter, contract: any, amount: number) => {
  try {
    // First, make the Solana transaction
    const escrowResult = await createEscrowAccount(wallet, contract.freelancer, amount);

    if (!escrowResult.success) {
      return escrowResult;
    }

    // Then, update the contract status
    const response = await axios.put(
      `/api/contracts/${contract._id}/status`,
      {
        status: 'funded',
        transactionSignature: escrowResult.signature,
        contractAddress: escrowResult.escrowAccount,
      },
      getAuthConfig()
    );

    return { success: true, data: response.data };
  } catch (error) {
    console.error('Error funding contract:', error);
    return {
      success: false,
      error:
        axios.isAxiosError(error) && error.response
          ? error.response.data.message
          : 'Failed to fund contract',
    };
  }
};

// Complete a contract (client only)
export const completeContract = async (
  contractId: string,
  wallet: WalletAdapter,
  contract: any
) => {
  try {
    // First, release the funds from escrow
    const releaseResult = await releaseEscrow(
      wallet,
      contract.contractAddress,
      contract.freelancer
    );

    if (!releaseResult.success) {
      return releaseResult;
    }

    // Then, update the contract status
    const response = await axios.put(
      `/api/contracts/${contractId}/status`,
      {
        status: 'completed',
        transactionSignature: releaseResult.signature,
      },
      getAuthConfig()
    );

    return { success: true, data: response.data };
  } catch (error) {
    console.error('Error completing contract:', error);
    return {
      success: false,
      error:
        axios.isAxiosError(error) && error.response
          ? error.response.data.message
          : 'Failed to complete contract',
    };
  }
};

// Dispute a contract
export const disputeContract = async (contractId: string, disputeReason: string) => {
  try {
    const response = await axios.put(
      `/api/contracts/${contractId}/status`,
      {
        status: 'disputed',
        disputeReason,
      },
      getAuthConfig()
    );
    return { success: true, data: response.data };
  } catch (error) {
    console.error('Error disputing contract:', error);
    return {
      success: false,
      error:
        axios.isAxiosError(error) && error.response
          ? error.response.data.message
          : 'Failed to dispute contract',
    };
  }
};
