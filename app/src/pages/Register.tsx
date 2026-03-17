import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../utils/api';
import axios from 'axios';
import { WalletButton } from '../components/WalletButton';
import { useAppKitAccount } from '@reown/appkit/react';
import { useWalletAuth } from '../hooks/useWalletAuth';

interface RegisterForm {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  walletAddress: string;
  role: string;
  skills: string[] | string;
  bio: string;
}

const Register: React.FC = () => {
  const navigate = useNavigate();
  const { isConnected, address } = useAppKitAccount();

  const [formData, setFormData] = useState<RegisterForm>({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    walletAddress: '',
    role: 'client',
    skills: [],
    bio: '',
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');
  const [walletMessage, setWalletMessage] = useState('');
  const { authenticateWallet } = useWalletAuth();

  // Check if wallet is isConnected
  useEffect(() => {
    if (address && isConnected) {
      const shortAddress = `${address.toString().slice(0, 4)}...${address.toString().slice(-4)}`;
      setWalletMessage(`Wallet isConnected: ${shortAddress}`);
      setErrors(prev => ({ ...prev, general: '' }));
    } else {
      setWalletMessage('');
    }
  }, [isConnected, address]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    const skills = [...formData.skills];

    if (name === 'skills') {
      const skill = value.replace(',', '').trim();

      skills.push(skill);

      setFormData(prevData => ({
        ...prevData,
        skills,
      }));

      return;
    }

    setFormData(prevData => ({
      ...prevData,
      [name]: value,
    }));

    if (errors[name]) {
      setErrors(prevErrors => {
        const newErrors = { ...prevErrors };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (formData.role === 'freelancer' && formData.skills.length < 1) {
      newErrors.skills = 'Skills are required for freelancers';
    }

    if (address) {
      setFormData(prevData => ({ ...prevData, walletAddress: address }));
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.dir(formData);

    console.log('1');
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setApiError('');

    try {
      const response = await api.post('/api/auth/register', {
        ...formData,
        walletAddress: address,
      });
      localStorage.setItem('sol_token', response.data.token);
      localStorage.setItem('userInfo', JSON.stringify(response.data));
      window.dispatchEvent(new Event('auth-change'));

      const success = await authenticateWallet();

      if (!success) {
        setApiError('Invalid wallet signature. Please try again.');

        return;
      }

      navigate('/dashboard');
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        setApiError(error.response.data.message || 'Registration failed. Please try again.');
      } else {
        setApiError('Registration failed. Please try again.');
      }
    }

    setIsSubmitting(false);

    navigate('/dashboard', { replace: true });
  };

  return (
    <>
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-primary-600">
          Create a new account
        </h2>
        <p className="mt-2 text-center text-sm text-secondary-600">
          Connect your wallet and register to continue
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
              {(apiError || errors.general) && (
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
                  <span>{apiError || errors.general}</span>
                </div>
              )}

              <form className="space-y-6" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                    Username
                  </label>
                  <div className="mt-1">
                    <input
                      id="username"
                      name="username"
                      type="text"
                      value={formData.username}
                      onChange={handleChange}
                      className={`appearance-none block w-full px-3 py-2 border ${
                        errors.username ? 'border-red-300' : 'border-gray-300'
                      } rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}
                      placeholder="Enter your username"
                    />
                    {errors.username && (
                      <p className="mt-1 text-sm text-red-600">{errors.username}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email address
                  </label>
                  <div className="mt-1">
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      value={formData.email}
                      onChange={handleChange}
                      className={`appearance-none block w-full px-3 py-2 border ${
                        errors.email ? 'border-red-300' : 'border-gray-300'
                      } rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}
                      placeholder="Enter your email"
                    />
                    {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Password
                  </label>
                  <div className="mt-1">
                    <input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      value={formData.password}
                      onChange={handleChange}
                      className={`appearance-none block w-full px-3 py-2 border ${
                        errors.password ? 'border-red-300' : 'border-gray-300'
                      } rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}
                      placeholder="Enter your password"
                    />
                    {errors.password && (
                      <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Confirm Password
                  </label>
                  <div className="mt-1">
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className={`appearance-none block w-full px-3 py-2 border ${
                        errors.confirmPassword ? 'border-red-300' : 'border-gray-300'
                      } rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}
                      placeholder="Confirm your password"
                    />
                    {errors.confirmPassword && (
                      <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                    Role
                  </label>
                  <div className="mt-1">
                    <select
                      id="role"
                      name="role"
                      value={formData.role}
                      onChange={handleChange}
                      className="appearance-none block w-full px-3 py-2 border border-gray-300
                       rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    >
                      <option value="client">Client</option>
                      <option value="freelancer">Freelancer</option>
                    </select>
                  </div>
                </div>

                {formData.role === 'freelancer' && (
                  <>
                    <div>
                      <label htmlFor="skills" className="block text-sm font-medium text-gray-700">
                        Skills (comma-separated)
                      </label>
                      <div className="mt-1">
                        <input
                          id="skills"
                          name="skills"
                          type="text"
                          value={formData.skills}
                          onChange={handleChange}
                          className={`appearance-none block w-full px-3 py-2 border ${
                            errors.skills ? 'border-red-300' : 'border-gray-300'
                          } rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}
                          placeholder="E.g. React, Node.js, Solana"
                        />
                        {errors.skills && (
                          <p className="mt-1 text-sm text-red-600">{errors.skills}</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label htmlFor="bio" className="block text-sm font-medium text-gray-700">
                        Bio
                      </label>
                      <div className="mt-1">
                        <textarea
                          id="bio"
                          name="bio"
                          rows={4}
                          value={formData.bio}
                          onChange={handleChange}
                          className={`appearance-none block w-full px-3 py-2 border ${
                            errors.bio ? 'border-red-300' : 'border-gray-300'
                          } rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}
                          placeholder="Tell us about yourself and your expertise"
                        />
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <button
                    type="submit"
                    className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                      isSubmitting || !isConnected
                        ? 'bg-indigo-300 cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                    }`}
                  >
                    {isSubmitting ? 'Registering...' : 'Register'}
                  </button>
                </div>
              </form>

              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">Already have an account?</span>
                  </div>
                </div>
                <div className="mt-6 text-center">
                  <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
                    Sign in to your account
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

export default Register;
