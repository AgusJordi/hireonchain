import React, { useState, useEffect } from 'react';
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { WalletButton } from '../components/WalletButton';
import { ProfileModal } from '../components/ProfileModal';
import { useAppKitAccount } from '@reown/appkit/react';
import { useFreelanceClient } from '../hooks/useFreelanceClient';

interface Review {
  _id: string;
  reviewer: {
    username: string;
  };
  rating: number;
  comment: string;
  createdAt: string;
}

interface UserProfile {
  _id: string;
  username: string;
  email: string;
  walletAddress: string;
  bio: string;
  skills: string[];
  reviews: Review[];
  role: string;
  rating: number;
  createdAt: string;
}

const Profile: React.FC = () => {
  const { address, isConnected } = useAppKitAccount();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [balance, setBalance] = useState<number>(0);
  const sdkClient = useFreelanceClient();

  const [formData, setFormData] = useState<UserProfile>({
    _id: '',
    username: '',
    email: '',
    walletAddress: '',
    bio: '',
    skills: [],
    reviews: [],
    role: '',
    rating: 0,
    createdAt: '',
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        if (!address) {
          setLoading(false);
          return;
        }

        const { data } = await api.get<UserProfile>('/api/users/profile');
        setFormData({
          ...data,
          bio: data.bio || '',
          rating: data.rating || 0,
          skills: data.skills || [],
          reviews: data.reviews || [],
        });

        // Fetch wallet balance
        try {
          const bal = await sdkClient.connection.getBalance(new PublicKey(address));
          setBalance(bal / LAMPORTS_PER_SOL);
        } catch (balError) {
          console.error('Error fetching balance:', balError);
        }

        setError('');
      } catch (error) {
        console.error('Error fetching profile:', error);
        setError('Failed to load profile');
        toast.error('Error fetching profile');
      } finally {
        setLoading(false);
      }
    };

    if (isConnected && address) {
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, [isConnected, address, sdkClient.connection]);

  const handleEdit = () => {
    setEditMode(true);
  };

  const handleSave = async (updatedData: Partial<UserProfile>) => {
    try {
      await api.put('/api/users/profile', updatedData);
      setFormData(prev => ({ ...prev, ...updatedData }));
      setEditMode(false);
      toast.success('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col items-center justify-center min-h-[50vh]">
        <svg
          className="animate-spin h-10 w-10 text-primary-600 mb-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <p className="text-lg font-medium text-secondary-600">Loading profile...</p>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col items-center justify-center min-h-[50vh]">
        <div className="bg-white rounded-xl shadow-card border border-secondary-100 p-8 text-center max-w-md w-full">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-secondary-900 mb-2">Profile</h1>
          <p className="text-secondary-600 mb-6">Please connect your wallet to view your profile.</p>
          <WalletButton />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col items-center justify-center min-h-[50vh]">
        <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg max-w-md w-full">
          <div className="flex items-center mb-3">
            <svg className="h-6 w-6 mr-2 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium">{error}</span>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="w-full px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors text-sm font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const roleColors: Record<string, string> = {
    client: 'bg-blue-100 text-blue-800 border-blue-200',
    freelancer: 'bg-accent-100 text-accent-800 border-accent-200',
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Profile Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-500 rounded-2xl p-6 sm:p-8 mb-8 text-white">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white/20 rounded-full flex items-center justify-center text-2xl sm:text-3xl font-bold backdrop-blur-sm">
              {formData.username.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">{formData.username}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${roleColors[formData.role] || 'bg-secondary-100 text-secondary-800 border-secondary-200'}`}>
                  {formData.role}
                </span>
                <span className="text-white/70 text-sm">
                  Member since {new Date(formData.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={handleEdit}
            className="px-5 py-2.5 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-lg transition-colors text-sm font-medium flex items-center gap-2 border border-white/20"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit Profile
          </button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Profile Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Wallet & Balance Card */}
          <div className="bg-white rounded-xl shadow-card border border-secondary-100 p-6">
            <h2 className="text-lg font-bold text-secondary-900 mb-4 flex items-center gap-2">
              <svg className="h-5 w-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              Wallet & Balance
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-secondary-50 rounded-lg p-4">
                <p className="text-xs font-medium text-secondary-500 uppercase tracking-wide mb-1">Wallet Address</p>
                <p className="text-sm font-mono text-secondary-900">
                  {formData.walletAddress.slice(0, 6)}...{formData.walletAddress.slice(-6)}
                </p>
              </div>
              <div className="bg-secondary-50 rounded-lg p-4">
                <p className="text-xs font-medium text-secondary-500 uppercase tracking-wide mb-1">Balance</p>
                <p className="text-sm font-semibold text-secondary-900">{balance.toFixed(4)} SOL</p>
              </div>
              <div className="bg-secondary-50 rounded-lg p-4">
                <p className="text-xs font-medium text-secondary-500 uppercase tracking-wide mb-1">Email</p>
                <p className="text-sm text-secondary-900">{formData.email}</p>
              </div>
              <div className="bg-secondary-50 rounded-lg p-4">
                <p className="text-xs font-medium text-secondary-500 uppercase tracking-wide mb-1">Rating</p>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-secondary-900">{formData.rating.toFixed(1)}</span>
                  <span className="text-amber-400 text-sm">
                    {'★'.repeat(Math.round(formData.rating))}
                    {'☆'.repeat(5 - Math.round(formData.rating))}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bio Card */}
          <div className="bg-white rounded-xl shadow-card border border-secondary-100 p-6">
            <h2 className="text-lg font-bold text-secondary-900 mb-3 flex items-center gap-2">
              <svg className="h-5 w-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              About
            </h2>
            <p className="text-secondary-600 leading-relaxed">
              {formData.bio || <span className="italic text-secondary-400">No bio provided</span>}
            </p>
          </div>

          {/* Skills Card */}
          <div className="bg-white rounded-xl shadow-card border border-secondary-100 p-6">
            <h2 className="text-lg font-bold text-secondary-900 mb-4 flex items-center gap-2">
              <svg className="h-5 w-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Skills
            </h2>
            {formData.skills && formData.skills.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {formData.skills.map((skill, index) => (
                  <span
                    key={index}
                    className="px-3 py-1.5 bg-primary-50 text-primary-700 text-sm font-medium rounded-full border border-primary-200"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-secondary-400 italic">No skills listed</p>
            )}
          </div>
        </div>

        {/* Right Column - Reviews & Meta */}
        <div className="space-y-6">
          {/* Reviews Card */}
          <div className="bg-white rounded-xl shadow-card border border-secondary-100 p-6">
            <h2 className="text-lg font-bold text-secondary-900 mb-4 flex items-center gap-2">
              <svg className="h-5 w-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              Reviews
              <span className="ml-auto text-sm font-normal text-secondary-500">
                {formData.reviews?.length || 0}
              </span>
            </h2>

            {formData.reviews && formData.reviews.length > 0 ? (
              <div className="space-y-4">
                {formData.reviews.map(review => (
                  <div
                    key={review._id}
                    className="border border-secondary-100 rounded-lg p-4 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-secondary-900">
                        {review.reviewer?.username || 'Anonymous'}
                      </span>
                      <span className="text-amber-400 text-sm">
                        {'★'.repeat(review.rating)}
                        {'☆'.repeat(5 - review.rating)}
                      </span>
                    </div>
                    <p className="text-sm text-secondary-600 leading-relaxed">{review.comment}</p>
                    <p className="text-xs text-secondary-400 mt-2">
                      {new Date(review.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-secondary-50 rounded-lg p-6 text-center">
                <svg className="mx-auto h-10 w-10 text-secondary-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <p className="text-sm text-secondary-500">No reviews yet</p>
              </div>
            )}
          </div>

          {/* Quick Stats Card */}
          <div className="bg-white rounded-xl shadow-card border border-secondary-100 p-6">
            <h2 className="text-lg font-bold text-secondary-900 mb-4 flex items-center gap-2">
              <svg className="h-5 w-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Quick Stats
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-secondary-100">
                <span className="text-sm text-secondary-600">Reviews</span>
                <span className="text-sm font-semibold text-secondary-900">{formData.reviews?.length || 0}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-secondary-100">
                <span className="text-sm text-secondary-600">Skills</span>
                <span className="text-sm font-semibold text-secondary-900">{formData.skills?.length || 0}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-secondary-600">Rating</span>
                <span className="text-sm font-semibold text-secondary-900">{formData.rating.toFixed(1)} / 5.0</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {editMode && (
        <ProfileModal profile={formData} onClose={() => setEditMode(false)} onSave={handleSave} />
      )}
    </div>
  );
};

export default Profile;
