import React, { FC, useMemo, useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { LAMPORTS_PER_SOL, Connection, clusterApiUrl } from "@solana/web3.js";

const WalletConnect: FC = () => {
  const { publicKey, wallet, disconnect, connected } = useWallet();
  const [balance, setBalance] = useState<number | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Get wallet balance
  useEffect(() => {
    const getWalletBalance = async () => {
      if (publicKey) {
        try {
          const connection = new Connection(clusterApiUrl("devnet"));
          const walletBalance = await connection.getBalance(publicKey);
          setBalance(walletBalance);
        } catch (error) {
          console.error("Error fetching balance:", error);
          setBalance(null);
        }
      } else {
        setBalance(null);
      }
    };

    if (connected && publicKey) {
      getWalletBalance();
    }
  }, [publicKey, connected]);

  const walletAddress = useMemo(() => {
    if (!publicKey) return "";
    return publicKey.toBase58();
  }, [publicKey]);

  const formattedBalance = useMemo(() => {
    if (balance === null) return "0";
    return (balance / LAMPORTS_PER_SOL).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    });
  }, [balance]);

  const displayAddress = useMemo(() => {
    if (!walletAddress) return "";
    return `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`;
  }, [walletAddress]);

  const toggleDetails = () => {
    setShowDetails(!showDetails);
  };

  return (
    <div className="relative">
      {/* Custom styling for the WalletMultiButton */}
      <div className="wallet-adapter-button-wrapper">
        <WalletMultiButton className="!bg-primary-600 hover:!bg-primary-700 !rounded-lg !h-10 !text-sm !font-medium" />
      </div>

      {connected && (
        <div className="relative mt-2">
          <button
            onClick={toggleDetails}
            className="flex items-center text-sm font-medium text-primary-600 hover:text-primary-700 focus:outline-none"
          >
            <span>{displayAddress}</span>
            <svg
              className={`ml-1 h-4 w-4 transition-transform ${
                showDetails ? "rotate-180" : ""
              }`}
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          {showDetails && (
            <div className="absolute right-0 z-10 mt-2 w-64 origin-top-right rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
              <div className="p-4">
                <div className="mb-3">
                  <span className="block text-xs font-medium text-secondary-500">
                    Wallet Address
                  </span>
                  <div className="flex items-center justify-between">
                    <span
                      className="block text-sm text-secondary-900 truncate"
                      title={walletAddress}
                    >
                      {walletAddress.slice(0, 12)}...{walletAddress.slice(-8)}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(walletAddress);
                        alert("Address copied to clipboard!");
                      }}
                      className="ml-2 p-1 text-primary-600 hover:text-primary-700 hover:bg-secondary-100 rounded-md focus:outline-none"
                    >
                      <svg
                        className="h-4 w-4"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="mb-3">
                  <span className="block text-xs font-medium text-secondary-500">
                    Balance
                  </span>
                  <span className="block text-sm text-secondary-900">
                    {formattedBalance} SOL
                  </span>
                </div>

                <button
                  onClick={() => disconnect?.()}
                  className="w-full bg-secondary-200 hover:bg-secondary-300 text-secondary-800 rounded-md px-3 py-1.5 text-sm font-medium focus:outline-none"
                >
                  Disconnect
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WalletConnect;
