import React, { FC, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

interface WalletRegistrationProps {
  onWalletConnected: (walletAddress: string) => void;
}

const WalletRegistration: FC<WalletRegistrationProps> = ({
  onWalletConnected,
}) => {
  const { publicKey, connected } = useWallet();
  const [walletAddress, setWalletAddress] = useState<string>("");

  useEffect(() => {
    if (connected && publicKey) {
      const address = publicKey.toString();
      setWalletAddress(address);
      onWalletConnected(address);
    }
  }, [connected, publicKey, onWalletConnected]);

  return (
    <div className="wallet-registration">
      <h3>Connect your Solana wallet</h3>
      <p>You need to connect a Solana wallet to use this platform</p>

      <div className="wallet-connect-container">
        <WalletMultiButton />
      </div>

      {connected && (
        <div className="wallet-status connected">
          <p>
            <span className="success-icon">✓</span> Wallet connected:{" "}
            {walletAddress.slice(0, 4)}...{walletAddress.slice(-4)}
          </p>
        </div>
      )}

      {!connected && (
        <div className="wallet-status not-connected">
          <p>
            <span className="warning-icon">!</span> Please connect your wallet
            to continue
          </p>
        </div>
      )}
    </div>
  );
};

export default WalletRegistration;
