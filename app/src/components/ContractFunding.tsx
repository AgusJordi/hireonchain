import React, { FC, useState, useEffect } from 'react';
import { useAppKitAccount } from '@reown/appkit/react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useFreelanceClient } from '../hooks/useFreelanceClient';
import { useWalletSigner } from '../hooks/useWalletSigner';
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';

interface ContractFundingProps {
  contract: any;
  amount: number;
  onSuccess: () => void;
}

const ContractFunding: FC<ContractFundingProps> = ({ contract, amount, onSuccess }) => {
  const { address, isConnected } = useAppKitAccount();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [balance, setBalance] = useState<number | null>(null);
  const [success, setSuccess] = useState(false);

  const sdkClient = useFreelanceClient();
  const walletSigner = useWalletSigner();

  // Get wallet balance when connected
  useEffect(() => {
    const checkBalance = async () => {
      if (isConnected && address && walletSigner) {
        try {
          const userBalance = await sdkClient.connection.getBalance(walletSigner.publicKey);
          setBalance(userBalance / LAMPORTS_PER_SOL);
        } catch (error) {
          console.error('Error fetching balance:', error);
        }
      }
    };

    checkBalance();
  }, [isConnected, address, walletSigner]);

  const handleFund = async () => {
    if (!isConnected || !address) {
      const msg = 'Please connect your wallet first';
      setError(msg);
      toast.error(msg);
      return;
    }

    if (balance === null || balance < amount) {
      const msg = 'Insufficient funds in your wallet';
      setError(msg);
      toast.error(msg);
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (!walletSigner) {
        throw new Error('Wallet signer not available');
      }

      const result = await sdkClient.fundEscrow(
        walletSigner,
        new PublicKey(contract.clientWallet),
        new PublicKey(contract.clientWallet),
        BigInt(contract.onChainJobId)
      );

      await api.post(`/api/contracts/${contract._id}/transaction`, {
        type: 'fund',
        signature: result.txId,
      });

      setSuccess(true);
      onSuccess();
    } catch (err) {
      const msg = 'An error occurred while funding the contract';
      setError(msg);
      toast.error(msg, { id: 'tx-status' });
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="contract-funding">
      <h3>Fund Contract</h3>

      {!isConnected ? (
        <div className="wallet-connection">
          <p>Please connect your wallet to fund this contract</p>
          <button onClick={() => window.open('', '_blank')} className="connect-wallet-btn">
            Connect Wallet
          </button>
        </div>
      ) : (
        <div className="funding-info">
          <p>
            <strong>Contract Amount:</strong> {amount} SOL
          </p>

          {balance !== null && (
            <p>
              <strong>Your Balance:</strong> {balance.toFixed(4)} SOL
              {balance < amount && <span className="warning">(Insufficient funds)</span>}
            </p>
          )}

          {error && <div className="error-message">{error}</div>}

          {success ? (
            <div className="success-message">
              Contract funded successfully! Funds are now in escrow.
            </div>
          ) : (
            <button
              className="fund-button"
              onClick={handleFund}
              disabled={loading || balance === null || balance < amount}
            >
              {loading ? 'Processing...' : 'Fund Contract'}
            </button>
          )}

          <div className="funding-note">
            <p>
              <strong>Note:</strong> Funding this contract will transfer {amount} SOL from your
              wallet to an escrow account. The funds will be released to the freelancer when
              milestones are completed and approved.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContractFunding;
