import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../utils/api';
import axios from 'axios';

import { WalletButton } from '../components/WalletButton';
import { useWalletAuth } from '../hooks/useWalletAuth';
import { useAppKitAccount } from '@reown/appkit/react';

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Please enter a valid email address'),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { isConnected, address } = useAppKitAccount();

  const [walletMessage, setWalletMessage] = useState('');
  const [apiError, setApiError] = useState('');
  const { authenticateWallet, isAuthenticating } = useWalletAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  useEffect(() => {
    if (isConnected && address) {
      const shortAddress = `${address.toString().slice(0, 4)}...${address.toString().slice(-4)}`;
      setWalletMessage(`Wallet isConnected: ${shortAddress}`);
      setApiError('');
    } else {
      setWalletMessage('');
    }
  }, [isConnected, address]);

  const onSubmit = async (data: LoginFormData) => {
    setApiError('');

    if (!isConnected || !address) {
      setError('root', {
        type: 'manual',
        message: 'Please connect your Solana wallet before logging in',
      });
      return;
    }

    try {
      const response = await api.post('/api/auth/login', {
        email: data.email.toLowerCase().trim(),
        password: data.password,
      });

      if (!response.data.token || !response.data.walletAddress) {
        setApiError('Invalid response from server. Please try again.');
        return;
      }

      const isConnectedWallet = address.toString();
      if (response.data.walletAddress !== isConnectedWallet) {
        setApiError(
          'The isConnected wallet does not match your account wallet. Please disconnect and connect the correct wallet.'
        );
        return;
      }

      const success = await authenticateWallet();

      if (!success) {
        setApiError('Invalid wallet signature. Please try again.');
        return;
      }

      localStorage.setItem('sol_token', response.data.token);
      localStorage.setItem('userInfo', JSON.stringify(response.data));
      window.dispatchEvent(new Event('auth-change'));

      navigate('/dashboard');
    } catch (error) {
      console.error('Login error:', error);

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          setApiError('Invalid email or password');
        } else if (error.response?.status === 404) {
          setApiError('User not found. Please register first.');
        } else if (error.response?.status === 500) {
          setApiError('Server error. Please try again later.');
        } else {
          setApiError(error.response?.data?.message || 'Login failed. Please try again.');
        }
      } else if (error instanceof Error) {
        setApiError(error.message || 'An unexpected error occurred');
      } else {
        setApiError('An unexpected error occurred. Please try again.');
      }
    }
  };

  return (
    <>
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-primary-600">
          Login to your account
        </h2>
        <p className="mt-2 text-center text-sm text-secondary-600">
          Connect your wallet and login to continue
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="border-2 border-primary-100 rounded-xl p-6 shadow-xl py-8 px-4 sm:px-10">
          {/* Wallet Connection Section */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-secondary-900 mb-2">
              Connect Your Solana Wallet
            </h3>
            <p className="text-sm text-secondary-600 mb-4">
              You need to connect your wallet to log in
            </p>

            <div className="flex justify-center mb-4">
              {!isConnected && <WalletButton />}

              {walletMessage && (
                <div className="bg-accent-50 border border-accent-200 rounded-lg p-3 text-accent-700 flex items-center">
                  <svg
                    className="h-5 w-5 mr-2 text-accent-500 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span className="text-sm font-medium">{walletMessage}</span>
                </div>
              )}
            </div>

            <div className="border-t border-secondary-200 pt-6">
              {/* General Error Message */}
              {(apiError || errors.root) && (
                <div
                  className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start"
                  role="alert"
                >
                  <svg
                    className="h-5 w-5 mr-2 text-red-500 shrink-0 mt-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span>{apiError || errors.root?.message}</span>
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-secondary-700 mb-1"
                  >
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    placeholder="you@example.com"
                    disabled={isAuthenticating}
                    className={`w-full px-3 py-2 border rounded-lg shadow-sm placeholder-secondary-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 disabled:bg-secondary-50 disabled:text-secondary-500 disabled:cursor-not-allowed ${
                      errors.email ? 'border-red-300 text-red-900' : 'border-secondary-300'
                    }`}
                    autoComplete="email"
                    {...register('email')}
                  />
                  {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-secondary-700 mb-1"
                  >
                    Password
                  </label>
                  <input
                    type="password"
                    id="password"
                    placeholder="Enter your password"
                    disabled={isAuthenticating}
                    className={`w-full px-3 py-2 border rounded-lg shadow-sm placeholder-secondary-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 disabled:bg-secondary-50 disabled:text-secondary-500 disabled:cursor-not-allowed ${
                      errors.password ? 'border-red-300 text-red-900' : 'border-secondary-300'
                    }`}
                    autoComplete="current-password"
                    {...register('password')}
                  />
                  {errors.password && (
                    <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isAuthenticating || !isConnected}
                  className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                    isAuthenticating || !isConnected
                      ? 'bg-indigo-300 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                  }`}
                  aria-busy={isAuthenticating}
                >
                  {isAuthenticating ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <span>Login</span>
                  )}
                </button>
              </form>

              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">Don't have an account?</span>
                  </div>
                </div>
                <div className="mt-6 text-center">
                  <Link
                    to="/register"
                    className="font-medium text-indigo-600 hover:text-indigo-500"
                  >
                    Create a new account
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Login;
