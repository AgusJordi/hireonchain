import React, { useState, useEffect } from 'react';
import { getBalance } from '../utils/solana';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { WalletButton } from '../components/WalletButton';
import { ProfileModal } from '../components/ProfileModal';
import { useAppKitAccount } from '@reown/appkit/react';

export interface UserProfile {
  _id: string;
  username: string;
  email: string;
  walletAddress: string;
  role: string | null;
  skills: string[] | null;
  bio: string;
  rating: number;
  reviews:
    | {
        from: {
          _id: string;
          username: string;
        };
        content: string;
        rating: number;
        createdAt: string;
      }[]
    | null;
}

const Profile: React.FC = () => {
  const { address, isConnected } = useAppKitAccount();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [balance, setBalance] = useState<number>(0);
  const [formData, setFormData] = useState<UserProfile>({
    _id: '',
    username: '',
    email: '',
    walletAddress: '',
    bio: '',
    skills: null,
    reviews: null,
    role: null,
    rating: 0,
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        if (!address) {
          toast.error('Error fetching profile');
          return;
        }

        const { data } = await api.get<UserProfile>('/api/users/profile');
        const profile = data;

        setFormData({
          ...profile,
          username: profile.username,
          email: profile.email,
          bio: profile.bio || '',
          rating: profile.rating || 0,
          skills: profile.skills ? profile.skills.map(skill => `${skill}, `) : [],
        });
      } catch (error) {
        console.log(error);
        toast.error('Error fetching profile');
        setError('Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    if (loading || !editMode) {
      fetchProfile();
    }
  }, [loading, address, editMode]);

  useEffect(() => {
    const fetchBalance = async () => {
      if (isConnected && address) {
        try {
          const solBalance = await getBalance(address.toString());
          setBalance(solBalance);
        } catch (error) {
          console.error('Error fetching balance:', error);
        }
      }
    };

    fetchBalance();
  }, [isConnected, address]);

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-secondary-950 via-secondary-900 to-primary-950 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent mb-4"></div>
          <p className="text-secondary-600 font-semibold text-lg">Loading formData...</p>
        </div>
      </div>
    );
  }

  if (error && !loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-secondary-950 via-secondary-900 to-primary-950 flex items-center justify-center">
        <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-6 max-w-md">
          <p className="text-red-400 text-center">{error || 'Failed to load profile'}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-primary-600 mb-4">Your Profile</h1>

          {!isConnected && (
            <div className="bg-primary-500/20 border border-primary-500/30 rounded-xl p-4 flex items-center justify-between">
              <p className="text-primary-200">Connect your wallet to view your balance</p>
              <WalletButton />
            </div>
          )}
        </div>

        <div className="flex flex-row flex-around gap-6">
          {/* Sidebar */}
          <div className="flex w-lg max-w-2xl flex-col space-y-6">
            {/* Wallet Information */}
            {isConnected && formData.walletAddress && (
              <div className="flex flex-col border-2 border-primary-100 rounded-xl p-6 shadow-xl">
                <h2 className="text-xl font-semibold text-primary-600 mb-4">Wallet Information</h2>

                <div className="space-y-3">
                  <div>
                    <label className="text-secondary-600 font-bold block">Address</label>
                    <code className="text-primary-400 font-mono text-lg break-all block">
                      {formData.walletAddress.slice(0, 8)}...{formData.walletAddress.slice(-8)}
                    </code>
                  </div>

                  <div className="font-">
                    {address === formData.walletAddress ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent-500/20 text-accent-600 font-semibold text-sm">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Wallet isConnected
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-yellow-500/20 text-yellow-400 text-sm">
                        ⚠️ isConnected wallet doesn't match profile
                      </span>
                    )}
                  </div>

                  {balance !== 0 && (
                    <div>
                      <label className=" text-secondary-900 block font-semibold">Balance</label>
                      <div className="text-xl text-primary-400 font-semibold">
                        {balance.toFixed(4)} <span className="text-primary-400">SOL</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Account Type */}
            <div className="flex w-lg max-w-2xl flex-col space-y-6"></div>
            <div className="border-2 border-primary-100 rounded-xl p-6 shadow-xl">
              <h2 className="text-xl font-semibold text-primary-600 mb-4">Account Type</h2>
              <div className="inline-flex items-center px-4 py-2 rounded-lg border-primary-600 border-2">
                <span className="text-lg text-primary-600 font-semibold">
                  {formData.role === 'client' ? 'Client' : 'Freelancer'}
                </span>
              </div>

              {formData.rating >= 0 && (
                <div className="mt-4">
                  <h3 className="text-sm text-secondary-600 font-semibold mb-2">Rating</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-yellow-400 text-xl">
                      {'★'.repeat(Math.round(formData.rating))}
                      {'☆'.repeat(5 - Math.round(formData.rating))}
                    </span>
                    <span className="text-primary-400 font-semibold">
                      ({formData.rating.toFixed(1)})
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Main Content */}
          <div className="flex w-lg max-w-2xl flex-col space-y-6">
            {!editMode && (
              // Profile Display
              <>
                <div className="flex w-lg max-w-2xl flex-col space-y-6">
                  <div className="border-2 border-primary-100 rounded-xl p-6 shadow-xl">
                    <h2 className="text-xl font-semibold text-primary-600 mb-4">
                      Personal Information
                    </h2>

                    <div className="space-x-6 flex justify-between mb-2">
                      <div>
                        <span className="text-secondary-600 font-semibold block mb-1">
                          Username
                        </span>
                        <span className="text-lg text-primary-400">{formData.username}</span>
                      </div>

                      <div>
                        <span className="text-secondary-600 font-semibold block mb-1">Email</span>
                        <span className="text-lg text-primary-400">{formData.email}</span>
                      </div>
                    </div>

                    <div className="space-x-6 flex justify-between full wrap-break-word">
                      {formData.bio && (
                        <div>
                          <span className="text-sm text-secondary-600 font-semibold block mb-1">
                            Bio
                          </span>
                          <p className="text-primary-400 font-semibold leading-relaxed">
                            {formData.bio}
                          </p>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => setEditMode(true)}
                      className="mt-6 font-semibold px-4 py-2 border-2 border-primary-600 hover:border-primary-500 bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-colors w-1/2"
                    >
                      Edit Profile
                    </button>
                  </div>
                </div>

                {/* Skills Section */}
                {formData.role === 'freelancer' && Array.isArray(formData.skills) && (
                  <div className="flex w-lg max-w-2xl flex-col space-y-6">
                    <div className="border-2 border-primary-100 rounded-xl p-6 shadow-xl">
                      <h2 className="text-xl font-semibold text-primary-600 mb-4">Skills</h2>
                      <div className="flex flex-wrap gap-2">
                        {formData.skills.map((skill, index) => (
                          <span
                            key={index}
                            className="px-3 py-1.5 bg-primary-500/20 border border-primary-500/30 rounded-lg text-primary-300 text-sm font-medium"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Reviews Section */}
                {formData.role === 'freelancer' && formData.reviews && (
                  <div className="flex w-lg max-w-2xl flex-col space-y-6">
                    <div className="border-2 border-primary-100 rounded-xl p-6 shadow-xl">
                      <h2 className="text-xl font-semibold text-primary-600 mb-4">
                        Reviews ({formData.reviews.length})
                      </h2>
                      <div className="space-y-4">
                        {formData.reviews.map((review, index) => (
                          <div
                            key={index}
                            className="bg-secondary-900/50 rounded-lg p-4 border border-secondary-700/30"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-semibold text-primary-400vvvvvvvvvvvvvvvvvv">
                                {review.from.username}
                              </span>
                              <span className="text-yellow-400">
                                {'★'.repeat(review.rating)}
                                {'☆'.repeat(5 - review.rating)}
                              </span>
                            </div>
                            <p className="text-secondary-300 mb-2">{review.content}</p>
                            <span className="text-xs text-secondary-500">
                              {new Date(review.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {editMode && formData.role && (
              // Edit Form
              <ProfileModal
                formData={formData}
                setFormData={setFormData}
                setEditMode={setEditMode}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Profile;
