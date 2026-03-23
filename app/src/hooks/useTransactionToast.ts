import { useCallback } from "react";
import toast from "react-hot-toast";

export type TransactionStatus =
  | { stage: "signing" }
  | { stage: "submitted"; txId: string }
  | { stage: "confirming"; txId: string }
  | { stage: "confirmed"; txId: string; slot: number }
  | { stage: "finalized"; txId: string; slot: number }
  | { stage: "error"; txId?: string; error: string };

export type OnTransactionStatus = (status: TransactionStatus) => void;


function getExplorerUrl(txId: string): string {
  const cluster = import.meta.env.VITE_SOLANA_NETWORK || "devnet";
  const params = cluster === "mainnet-beta" ? "" : `?cluster=${cluster}`;
  return `https://explorer.solana.com/tx/${txId}${params}`;
}

export function useTransactionToast(): OnTransactionStatus {
  return useCallback((status: TransactionStatus) => {
    switch (status.stage) {
      case "signing":
        toast.loading("Approve the transaction in your wallet...", {
          id: "tx-status",
        });
        break;

      case "submitted":
        toast.loading("Transaction submitted, waiting for confirmation...", {
          id: "tx-status",
        });
        break;

      case "confirming":
        break;

      case "confirmed":
        toast.success(
          `Transaction confirmed! View on Explorer:\n${getExplorerUrl(status.txId)}`,
          { id: "tx-status", duration: 6000 }
        );
        break;

      case "finalized":
        toast.success(
          `Transaction finalized! View on Explorer:\n${getExplorerUrl(status.txId)}`,
          { id: "tx-status", duration: 6000 }
        );
        break;

      case "error":
        toast.error(status.error, { id: "tx-status", duration: 8000 });
        break;
    }
  }, []);
}
