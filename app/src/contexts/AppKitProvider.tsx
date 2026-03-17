import { SolanaAdapter } from '@reown/appkit-adapter-solana/react';
import { solanaDevnet } from '@reown/appkit/networks';
import { AppKitProvider } from '@reown/appkit/react';
import { ReactNode } from 'react';

const solanaWeb3JsAdapter = new SolanaAdapter();
const projectId = import.meta.env.VITE_PROJECT_ID as string;

const metadata = {
  name: 'Solana Freelance',
  description: 'Connect, Work, and Get Paid with Crypto',
  url: 'https://sol-marketplace-1.vercel.app', // origin must match your domain & subdomain
  icons: ['https://sol-marketplace-1.vercel.app/sol.png'],
};

export const ReownProvider = ({ children }: { children: ReactNode }) => {
  return (
    <AppKitProvider
      projectId={projectId}
      networks={[solanaDevnet]}
      metadata={metadata}
      adapters={[solanaWeb3JsAdapter]}
    >
      {children}
    </AppKitProvider>
  );
};
