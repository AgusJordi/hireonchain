import React, { FC, useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { fundContract } from "../utils/contractUtils";
import { getBalance } from "../utils/solana";

interface ContractFundingProps {
  contract: any;
  onSuccess: () => void;
}

const ContractFunding: FC<ContractFundingProps> = ({ contract, onSuccess }) => {
  const { publicKey, connected } = useWallet();
  const wallet = useWallet();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [success, setSuccess] = useState(false);

  // Amount to be funded is the contract amount
  const amount = contract?.amount || 0;

  // Get wallet balance when connected
  useEffect(() => {
    const checkBalance = async () => {
      if (connected && publicKey) {
        const userBalance = await getBalance(publicKey.toString());
        setBalance(userBalance);
      }
    };

    checkBalance();
  }, [connected, publicKey]);

  const handleFund = async () => {
    if (!connected || !publicKey) {
      setError("Please connect your wallet first");
      return;
    }

    if (balance === null || balance < amount) {
      setError("Insufficient funds in your wallet");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await fundContract(wallet, contract, amount);

      if (result.success) {
        setSuccess(true);
        onSuccess();
      } else {
        setError(result.error || "Failed to fund contract");
      }
    } catch (err) {
      setError("An error occurred while funding the contract");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="contract-funding">
      <h3>Fund Contract</h3>

      {!connected ? (
        <div className="wallet-connection">
          <p>Please connect your wallet to fund this contract</p>
          <WalletMultiButton />
        </div>
      ) : (
        <div className="funding-info">
          <p>
            <strong>Contract Amount:</strong> {amount} SOL
          </p>

          {balance !== null && (
            <p>
              <strong>Your Balance:</strong> {balance.toFixed(4)} SOL
              {balance < amount && (
                <span className="balance-warning">(Insufficient funds)</span>
              )}
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
              {loading ? "Processing..." : "Fund Contract"}
            </button>
          )}

          <div className="funding-note">
            <p>
              <strong>Note:</strong> Funding this contract will transfer{" "}
              {amount} SOL from your wallet to an escrow account. The funds will
              be released to the freelancer when you mark the job as completed.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContractFunding;
