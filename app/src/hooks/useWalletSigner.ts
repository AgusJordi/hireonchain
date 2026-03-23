import { useMemo } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useAppKitAccount, useAppKitProvider } from '@reown/appkit/react';
import type { Provider } from '@reown/appkit-adapter-solana';
import type { WalletSigner } from '@sdk/types';

export function useWalletSigner(): WalletSigner | null {
  const { address, isConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider<Provider>('solana');

  return useMemo(() => {
    if (!isConnected || !address || !walletProvider) return null;
    return {
      publicKey: new PublicKey(address),
      signTransaction: async (tx: any) => {
        if (!walletProvider.signTransaction) throw new Error('Wallet cannot sign');
        return walletProvider.signTransaction(tx);
      },
    };
  }, [isConnected, address, walletProvider]);
}
