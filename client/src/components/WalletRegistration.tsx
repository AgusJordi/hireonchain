import React, { FC, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

interface WalletRegistrationProps {
  onWalletConnected: (walletAddress: string) => void;
}

const WalletRegistration: FC<WalletRegistrationProps> = ({
  onWalletConnected,
}) => {
  const { publicKey, connected, wallet } = useWallet();
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (connected && publicKey) {
      const address = publicKey.toString();
      setWalletAddress(address);
      setError("");
      onWalletConnected(address);
    }
  }, [connected, publicKey, onWalletConnected]);

  // Add listener for wallet connection errors
  useEffect(() => {
    const handleError = (error: any) => {
      console.error("Phantom connection error:", error);
      setError("Failed to connect wallet. Make sure Phantom is installed and enabled.");
    };

    window.addEventListener("phantom_connect_error", handleError);
    return () => {
      window.removeEventListener("phantom_connect_error", handleError);
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
        <WalletMultiButton />
      </div>

      {connected && wallet && (
        <div className="wallet-status connected">
          <p>
            <span className="success-icon">✓</span> Wallet connected:{" "}
            {walletAddress.slice(0, 4)}...{walletAddress.slice(-4)}
          </p>
          <p className="text-sm text-gray-600">Using: {wallet.adapter.name}</p>
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