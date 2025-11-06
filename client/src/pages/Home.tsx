import React from "react";
import { Link } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

const Home: React.FC = () => {
  const { connected } = useWallet();

  return (
    <div className="bg-gradient-to-b from-secondary-50 to-white">
      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-primary-800 mb-4">
            Solana Freelance Platform
          </h1>
          <h2 className="text-2xl md:text-3xl font-medium text-secondary-700 mb-6">
            Connect, Work, and Get Paid with Crypto
          </h2>

          <p className="text-lg text-secondary-600 mb-10 leading-relaxed">
            A decentralized freelance marketplace powered by Solana blockchain.
            Find work, hire talent, and make secure payments with SOL.
          </p>

          <div className="mt-10 flex flex-col items-center">
            {!connected ? (
              <div className="bg-white rounded-xl p-6 shadow-lg max-w-sm mx-auto w-full">
                <p className="text-secondary-600 mb-4 text-center">
                  Connect your wallet to get started
                </p>
                <div className="flex justify-center">
                  <WalletMultiButton className="!bg-primary-600 hover:!bg-primary-700 !rounded-lg !h-12 !text-base !font-medium" />
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/jobs" className="btn-primary py-3 px-8 text-base">
                  Browse Jobs
                </Link>
                <Link
                  to="/register"
                  className="btn-secondary py-3 px-8 text-base"
                >
                  Create Account
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-secondary-900 mb-12">
            Why Choose Our Platform?
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="card hover:shadow-lg transition-shadow">
              <div className="h-12 w-12 bg-primary-100 rounded-full flex items-center justify-center mb-4">
                <svg
                  className="h-6 w-6 text-primary-600"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M12 17V17.01"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M12 14C11.9816 13.5216 12.1344 13.0523 12.4373 12.6837C12.7401 12.3152 13.1725 12.0788 13.64 12C14.0814 11.9458 14.4835 11.748 14.7817 11.4438C15.0799 11.1396 15.2571 10.7484 15.28 10.33C15.2679 9.96289 15.1518 9.60736 14.9448 9.30527C14.7379 9.00318 14.4494 8.76631 14.112 8.622C13.7746 8.47769 13.4033 8.43267 13.0435 8.49265C12.6837 8.55262 12.352 8.7147 12.09 8.96"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-secondary-900 mb-2">
                Secure Payments
              </h3>
              <p className="text-secondary-600">
                All payments are secured through Solana blockchain escrow
                contracts, ensuring freelancers get paid and clients get quality
                work.
              </p>
            </div>

            <div className="card hover:shadow-lg transition-shadow">
              <div className="h-12 w-12 bg-primary-100 rounded-full flex items-center justify-center mb-4">
                <svg
                  className="h-6 w-6 text-primary-600"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12 1V23"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M17 5H9.5C8.57174 5 7.6815 5.36875 7.02513 6.02513C6.36875 6.6815 6 7.57174 6 8.5C6 9.42826 6.36875 10.3185 7.02513 10.9749C7.6815 11.6313 8.57174 12 9.5 12H14.5C15.4283 12 16.3185 12.3687 16.9749 13.0251C17.6313 13.6815 18 14.5717 18 15.5C18 16.4283 17.6313 17.3185 16.9749 17.9749C16.3185 18.6313 15.4283 19 14.5 19H6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-secondary-900 mb-2">
                Low Fees
              </h3>
              <p className="text-secondary-600">
                Benefit from Solana's ultra-low transaction fees, saving money
                on every payment compared to traditional platforms.
              </p>
            </div>

            <div className="card hover:shadow-lg transition-shadow">
              <div className="h-12 w-12 bg-primary-100 rounded-full flex items-center justify-center mb-4">
                <svg
                  className="h-6 w-6 text-primary-600"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M13 2L3 14H12L11 22L21 10H12L13 2Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-secondary-900 mb-2">
                Fast Transactions
              </h3>
              <p className="text-secondary-600">
                Solana's high-speed blockchain ensures payments are processed
                within seconds, not days like traditional payment methods.
              </p>
            </div>

            <div className="card hover:shadow-lg transition-shadow">
              <div className="h-12 w-12 bg-primary-100 rounded-full flex items-center justify-center mb-4">
                <svg
                  className="h-6 w-6 text-primary-600"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M2 12H22"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M12 2C14.5013 4.73835 15.9228 8.29203 16 12C15.9228 15.708 14.5013 19.2616 12 22C9.49872 19.2616 8.07725 15.708 8 12C8.07725 8.29203 9.49872 4.73835 12 2Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-secondary-900 mb-2">
                Global Access
              </h3>
              <p className="text-secondary-600">
                Work with clients and freelancers from around the world without
                currency conversion or international transfer fees.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* How It Works Section */}
      <div className="py-16 bg-secondary-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-secondary-900 mb-12">
            How It Works
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="flex flex-col items-center text-center">
              <div className="h-12 w-12 bg-primary-600 rounded-full flex items-center justify-center mb-4 text-white font-bold text-xl">
                1
              </div>
              <h3 className="text-xl font-semibold text-secondary-900 mb-2">
                Connect Wallet
              </h3>
              <p className="text-secondary-600">
                Connect your Phantom wallet to access the platform
              </p>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="h-12 w-12 bg-primary-600 rounded-full flex items-center justify-center mb-4 text-white font-bold text-xl">
                2
              </div>
              <h3 className="text-xl font-semibold text-secondary-900 mb-2">
                Create Profile
              </h3>
              <p className="text-secondary-600">
                Register as a client or freelancer with your skills
              </p>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="h-12 w-12 bg-primary-600 rounded-full flex items-center justify-center mb-4 text-white font-bold text-xl">
                3
              </div>
              <h3 className="text-xl font-semibold text-secondary-900 mb-2">
                Post or Find Jobs
              </h3>
              <p className="text-secondary-600">
                Post new projects or browse available jobs
              </p>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="h-12 w-12 bg-primary-600 rounded-full flex items-center justify-center mb-4 text-white font-bold text-xl">
                4
              </div>
              <h3 className="text-xl font-semibold text-secondary-900 mb-2">
                Secure Payments
              </h3>
              <p className="text-secondary-600">
                Fund contracts with escrow and release payment on completion
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
