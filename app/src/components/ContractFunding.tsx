import { FC, useState, useEffect } from 'react';
import { fundContract } from '../utils/contractUtils';
import { getBalance } from '../utils/solana';
import { useAppKitAccount, useAppKitProvider } from '@reown/appkit/react';
import { walletAdapter } from '../utils/adapter';
import { WalletButton } from './WalletButton';

interface ContractFundingProps {
  contract: any;
  onSuccess: () => void;
}

const ContractFunding: FC<ContractFundingProps> = ({ contract, onSuccess }) => {
  const { address, isConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider('solana');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [balance, setBalance] = useState<number | null>(null);
  const [success, setSuccess] = useState(false);

  // Amount to be funded is the contract amount
  const amount = contract?.amount || 0;

  // Get wallet balance when isConnected
  useEffect(() => {
    const checkBalance = async () => {
      if (isConnected && address) {
        const userBalance = await getBalance(address.toString());
        setBalance(userBalance);
      }
    };

    checkBalance();
  }, [isConnected, address]);

  const handleFund = async () => {
    if (!isConnected || !address) {
      setError('Please connect your wallet first');
      return;
    }

    if (balance === null || balance < amount) {
      setError('Insufficient funds in your wallet');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const adapter = walletAdapter(walletProvider, address);

      if (!adapter || !adapter.publicKey) {
        throw new Error('Missing public key');
      }

      const result = await fundContract(adapter, contract, amount);

      if (result.success) {
        setSuccess(true);
        onSuccess();
      } else {
        setError(result.error || 'Failed to fund contract');
      }
    } catch (err) {
      setError('An error occurred while funding the contract');
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
          <WalletButton />
        </div>
      ) : (
        <div className="funding-info">
          <p>
            <strong>Contract Amount:</strong> {amount} SOL
          </p>

          {balance !== null && (
            <p>
              <strong>Your Balance:</strong> {balance.toFixed(4)} SOL
              {balance < amount && <span className="balance-warning">(Insufficient funds)</span>}
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
              wallet to an escrow account. The funds will be released to the freelancer when you
              mark the job as completed.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContractFunding;
