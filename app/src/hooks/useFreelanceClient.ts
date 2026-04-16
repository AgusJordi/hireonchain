import { useMemo } from 'react';
import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
import { FreelanceClient } from '@sdk/client';
import { useTransactionToast } from './useTransactionToast';

export function useFreelanceClient() {
  const onStatus = useTransactionToast();

  return useMemo(() => {
    const network = (import.meta.env.VITE_SOLANA_NETWORK || 'devnet') as 'devnet' | 'mainnet-beta';
    const rpc = import.meta.env.VITE_RPC_ENDPOINT || clusterApiUrl(network);
    const connection = new Connection(rpc, 'confirmed');
    const programIdEnv = import.meta.env.VITE_SOLANA_PROGRAM_ID;
    if (!programIdEnv) {
      // Throwing here is intentional: without a program id, the SDK cannot derive PDAs safely.
      // This error will show in the Vite overlay / console for quick diagnosis.
      throw new Error('VITE_SOLANA_PROGRAM_ID is not set');
    }
    const programId = new PublicKey(programIdEnv);

    return new FreelanceClient(connection, programId, {
      commitment: 'confirmed',
      preflight: 'confirmed',
      onStatus,
    });
  }, [onStatus]);
}
