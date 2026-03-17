import { createContext, useReducer, useCallback, useEffect, ReactNode } from 'react';
import api from '../utils/api';
import { authReducer, initialAuthState, AuthState } from './AuthReducter';
import { useAppKitAccount } from '@reown/appkit/react';
import { useAppKitProvider, useDisconnect } from '@reown/appkit/react';
import type { Provider } from '@reown/appkit-adapter-solana';
import toast from 'react-hot-toast';
import bs58 from 'bs58';

interface ChallengeResponse {
  message: string;
  nonce: string;
  publicKey: string;
}

interface VerifyResponse {
  success: boolean;
  publicKey: string;
  message: string;
}

interface AuthContextType extends AuthState {
  // ensure the context exposes the same error shape as the reducer
  error: string | null;
  authenticateWallet: () => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { address, isConnected } = useAppKitAccount();
  const { disconnect } = useDisconnect();
  const { walletProvider } = useAppKitProvider<Provider>('solana');
  const [state, dispatch] = useReducer(authReducer, initialAuthState);

  // Check for existing session on mount
  useEffect(() => {
    const walletVerified = localStorage.getItem('wallet_verified');

    if (walletVerified === 'true' && isConnected && address) {
      dispatch({
        type: 'AUTH_SUCCESS',
        payload: { publicKey: address },
      });
    }
  }, [isConnected, address]);

  const authenticateWallet = useCallback(async (): Promise<boolean> => {
    try {
      if (!walletProvider || !address) {
        throw new Error('user is disconnected');
      }

      const challengeResponse = await api.post<ChallengeResponse>('/api/auth/challenge', {
        publicKey: address,
      });

      const { nonce, message } = challengeResponse.data;

      const encodedMessage = new TextEncoder().encode(message);
      const signature = await walletProvider.signMessage(encodedMessage);

      const signatureBase58 = bs58.encode(signature);

      const { data } = await api.post<VerifyResponse>('/api/auth/sign', {
        publicKey: address,
        signature: signatureBase58,
        nonce,
      });

      if (data.success) {
        // Persist auth state
        localStorage.setItem('wallet_verified', 'true');

        dispatch({
          type: 'AUTH_SUCCESS',
          payload: { publicKey: address },
        });

        toast.success('Verification successful');

        return true;
      }

      dispatch({
        type: 'AUTH_FAILURE',
        payload: 'Verification failed',
      });

      toast.error('verification failed');

      return false;
    } catch (err) {
      toast.error('Verification failed');
      console.log(err);
      return false;
    }
  }, [walletProvider, address]);

  const handleLogout = useCallback(async () => {
    localStorage.clear();

    dispatch({ type: 'AUTH_LOGOUT' });
    if (isConnected) {
      await disconnect();
    }
  }, [isConnected, disconnect]);

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  const value: AuthContextType = {
    ...state,
    authenticateWallet,
    logout: handleLogout,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
