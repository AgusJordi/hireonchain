import { useAppKitAccount, useWalletInfo } from '@reown/appkit/react';
import { FC, useEffect, useState } from 'react';
import { WalletButton } from './WalletButton';

interface WalletRegistrationProps {
  onWalletisConnected: (walletAddress: string) => void;
}

const WalletRegistration: FC<WalletRegistrationProps> = ({ onWalletisConnected }) => {
  const { address, isConnected } = useAppKitAccount();
  const { walletInfo } = useWalletInfo();
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (isConnected && address) {
      setError('');
      onWalletisConnected(address);
    }
  }, [isConnected, address, onWalletisConnected]);

  // Add listener for wallet connection errors
  useEffect(() => {
    const handleError = (error: any) => {
      console.error('Phantom connection error:', error);
      setError('Failed to connect wallet. Make sure Phantom is installed and enabled.');
    };

    window.addEventListener('phantom_connect_error', handleError);
    return () => {
      window.removeEventListener('phantom_connect_error', handleError);
    };
  }, []);

  return (
    <div className="wallet-registration">
      <h3>Connect your Solana wallet</h3>
      <p>You need to connect a Solana wallet to use this platform</p>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="wallet-connect-container">
        <WalletButton />
      </div>

      {isConnected && address && (
        <div className="wallet-status isConnected">
          <p>
            <span className="success-icon">✓</span> Wallet isConnected: {address.slice(0, 4)}
            ...
            {address.slice(-4)}
          </p>
          <p className="text-sm text-gray-600">{walletInfo && walletInfo.name}</p>
        </div>
      )}

      {!isConnected && (
        <div className="wallet-status not-isConnected">
          <p>
            <span className="warning-icon">!</span> Please connect your wallet to continue
          </p>
        </div>
      )}
    </div>
  );
};

export default WalletRegistration;
