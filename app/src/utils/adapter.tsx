import { PublicKey } from '@solana/web3.js';

export type SimpleWalletAdapter = {
  publicKey: PublicKey | null;
  signTransaction: (tx: any) => Promise<any>;
};

export const walletAdapter = (
  walletProvider: any,
  address?: string
): SimpleWalletAdapter | undefined => {
  if (!address) return undefined;

  return {
    publicKey: new PublicKey(address),
    signTransaction: async (tx: any) => {
      if (!walletProvider?.signTransaction) throw new Error('Wallet cannot sign transactions');
      return walletProvider.signTransaction(tx);
    },
  };
};
