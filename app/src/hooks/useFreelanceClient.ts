import { useMemo } from 'react';
import { Connection, clusterApiUrl } from '@solana/web3.js';
import { FreelanceClient } from '@sdk/client';
import { PROGRAM_ID } from '@sdk/instructions';
import { useTransactionToast } from './useTransactionToast';

export function useFreelanceClient() {
  const onStatus = useTransactionToast();

  return useMemo(() => {
    const network = (import.meta.env.VITE_SOLANA_NETWORK || 'devnet') as 'devnet' | 'mainnet-beta';
    const rpc = import.meta.env.VITE_RPC_ENDPOINT || clusterApiUrl(network);
    const connection = new Connection(rpc, 'confirmed');

    return new FreelanceClient(connection, PROGRAM_ID, {
      commitment: 'confirmed',
      preflight: 'confirmed',
      onStatus,
    });
  }, [onStatus]);
}
