import { useNavigate } from 'react-router-dom';
import { useAppKit, useAppKitAccount } from '@reown/appkit/react';
import toast from 'react-hot-toast';
import { useState } from 'react';
import { getBalance } from '../utils/solana';
import { useWalletAuth } from '../hooks/useWalletAuth';

export function WalletButton() {
  const navigate = useNavigate();
  const { open } = useAppKit();
  const { address, isConnected, status } = useAppKitAccount();
  const [showDetails, setShowDetails] = useState(false);
  const [balance, setBalance] = useState(0);
  const { logout } = useWalletAuth();

  const handleDisconnect = () => {
    setShowDetails(false);
    logout();
    navigate('/');
  };

  const handleWalletClick = async () => {
    try {
      if (!isConnected) {
        await open({ view: 'Connect', namespace: 'solana' });
        toast.success('Wallet connected!');

        return;
      }
    } catch (error) {
      console.error('Error connecting wallet:', error);
    }
  };

  const toggleDetails = async () => {
    if (address) {
      const sol = await getBalance(address);
      setBalance(sol);
    }

    setShowDetails(!showDetails);
  };

  return (
    <>
      {!isConnected && (
        <button
          onClick={handleWalletClick}
          disabled={status === 'connecting'}
          className="px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
        >
          {status === 'connecting' ? 'Connecting...' : 'Connect Wallet'}
        </button>
      )}

      <div className="relative">
        {isConnected && address && (
          <>
            {' '}
            <button
              onClick={toggleDetails}
              className="flex items-center gap-2 px-4 py-2 bg-primary-50 hover:bg-primary-100 border border-primary-200 rounded-lg transition-colors group"
            >
              {/* Wallet Icon */}
              <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                  />
                </svg>
              </div>

              {/* Address */}
              <span className="text-sm font-medium text-gray-900">
                {isConnected && '✓ '}
                {address.slice(0, 4)}...{address.slice(-4)}
              </span>

              {/* Balance Badge */}
              {/* <span className="px-2 py-1 bg-white border border-gray-200 rounded-md text-xs font-semibold text-gray-700">
              {formattedBalance} SOL
            </span> */}

              {/* Chevron */}
              <svg
                className={`h-4 w-4 text-gray-500 transition-transform ${showDetails ? 'rotate-180' : ''}`}
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </>
        )}

        {showDetails && (
          <div className="absolute right-0 top-full mt-2 w-72 origin-top-right rounded-xl bg-white shadow-xl ring-1 ring-gray-900 ring-opacity-5 focus:outline-none z-10">
            <div className="p-4 space-y-4">
              {/* Wallet Address Section */}
              <div>
                <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Wallet Address
                </span>
                <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <span className="text-sm font-mono text-gray-900 truncate mr-2" title={address}>
                    {address?.slice(0, 16)}...{address?.slice(-12)}
                  </span>
                  <button
                    onClick={() => {
                      if (address) {
                        navigator.clipboard.writeText(address);
                        toast.success('Address copied to clipboard!');
                      } else {
                        toast.success('Error copying to clipboard!');
                      }
                    }}
                    className="p-2 text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-md transition-colors shrink-0"
                    title="Copy address"
                  >
                    <svg
                      className="h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Balance Section */}
              <div>
                <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Balance
                </span>
                <div className="bg-primary-50 rounded-lg p-3 border border-primary-200">
                  <span className="text-lg font-bold text-primary-900">
                    {address && balance} SOL
                  </span>
                </div>
              </div>

              {/* Disconnect Button */}
              <button
                type="button"
                onClick={handleDisconnect}
                className="w-full bg-red-50 hover:bg-red-100 text-red-700 font-medium rounded-lg px-4 py-2.5 text-sm border border-red-200 transition-colors"
              >
                Disconnect Wallet
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
