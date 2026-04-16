import { ReactNode } from 'react';

// createAppKit() is already initialized in App.tsx at module level.
// This provider just wraps children to keep the import structure intact.
export const ReownProvider = ({ children }: { children: ReactNode }) => {
  return <>{children}</>;
};
