import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../utils/api';
import { WalletButton } from '../components/WalletButton';
import { useAppKitAccount } from '@reown/appkit/react';

const createJobSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  price: z
    .string()
    .min(1, 'Price is required')
    .refine(val => parseFloat(val) > 0, 'Price must be greater than 0'),
  skills: z.string().min(1, 'At least one skill is required'),
  deadline: z.string().optional(),
});

type CreateJobFormData = z.infer<typeof createJobSchema>;

const CreateJob: React.FC = () => {
  const navigate = useNavigate();
  const { address, isConnected } = useAppKitAccount();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [userRole, setUserRole] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateJobFormData>({
    resolver: zodResolver(createJobSchema),
    defaultValues: {
      title: '',
      description: '',
      price: '',
      skills: '',
      deadline: '',
    },
  });

  useEffect(() => {
    const userInfoStr = localStorage.getItem('userInfo');
    if (userInfoStr) {
      const userInfo = JSON.parse(userInfoStr);
      setUserRole(userInfo.role);

      if (userInfo.role !== 'client') {
        alert('Only clients can post jobs');
        navigate('/dashboard');
      }
    }
  }, [navigate]);

  const onSubmit = async (data: CreateJobFormData) => {
    if (!isConnected || !address) {
      setSubmitError('Please connect your wallet first');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const jobData = {
        title: data.title,
        description: data.description,
        price: parseFloat(data.price),
        skills: data.skills.split(',').map(skill => skill.trim()),
        deadline: data.deadline ? new Date(data.deadline).toISOString() : null,
      };

      const response = await api.post('/api/jobs', jobData);

      navigate(`/jobs/${response.data._id}`);
    } catch (error) {
      console.error('Error creating job:', error);
      if (error instanceof Error) {
        setSubmitError(error.message || 'Failed to create job. Please try again.');
      } else {
        setSubmitError('Failed to create job. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (userRole !== 'client') {
    return null;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm font-medium text-secondary-500 hover:text-primary-600 transition-colors mb-4"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <h1 className="text-2xl sm:text-3xl font-bold text-secondary-900">Post a New Job</h1>
        <p className="mt-1 text-secondary-500">Describe the work you need done and set your budget.</p>
      </div>

      {!isConnected ? (
        <div className="bg-white rounded-xl shadow-card border border-secondary-100 p-8 text-center">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
          <p className="text-secondary-600 mb-6">Please connect your wallet to post a job</p>
          <WalletButton />
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-card border border-secondary-100 p-6 sm:p-8">
          {submitError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 flex items-start gap-2">
              <svg className="h-5 w-5 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm">{submitError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-secondary-700 mb-1.5">
                Job Title
              </label>
              <input
                type="text"
                id="title"
                placeholder="E.g. Develop a DeFi App on Solana"
                {...register('title')}
                className="w-full px-4 py-2.5 border border-secondary-200 rounded-lg text-secondary-900 placeholder:text-secondary-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-shadow"
              />
              {errors.title && (
                <p className="text-red-500 text-sm mt-1.5 flex items-center gap-1">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01" />
                  </svg>
                  {errors.title.message}
                </p>
              )}
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-secondary-700 mb-1.5">
                Job Description
              </label>
              <textarea
                id="description"
                placeholder="Provide a detailed description of the job requirements..."
                rows={6}
                {...register('description')}
                className="w-full px-4 py-2.5 border border-secondary-200 rounded-lg text-secondary-900 placeholder:text-secondary-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-shadow resize-none"
              />
              {errors.description && (
                <p className="text-red-500 text-sm mt-1.5 flex items-center gap-1">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01" />
                  </svg>
                  {errors.description.message}
                </p>
              )}
            </div>

            {/* Price & Deadline Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label htmlFor="price" className="block text-sm font-medium text-secondary-700 mb-1.5">
                  Budget (SOL)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    id="price"
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    {...register('price')}
                    className="w-full px-4 py-2.5 pr-14 border border-secondary-200 rounded-lg text-secondary-900 placeholder:text-secondary-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-shadow"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-secondary-400">
                    SOL
                  </span>
                </div>
                {errors.price && (
                  <p className="text-red-500 text-sm mt-1.5 flex items-center gap-1">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01" />
                    </svg>
                    {errors.price.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="deadline" className="block text-sm font-medium text-secondary-700 mb-1.5">
                  Deadline
                  <span className="text-secondary-400 font-normal ml-1">(optional)</span>
                </label>
                <input
                  type="date"
                  id="deadline"
                  min={new Date().toISOString().split('T')[0]}
                  {...register('deadline')}
                  className="w-full px-4 py-2.5 border border-secondary-200 rounded-lg text-secondary-900 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-shadow"
                />
                {errors.deadline && (
                  <p className="text-red-500 text-sm mt-1.5 flex items-center gap-1">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01" />
                    </svg>
                    {errors.deadline.message}
                  </p>
                )}
              </div>
            </div>

            {/* Skills */}
            <div>
              <label htmlFor="skills" className="block text-sm font-medium text-secondary-700 mb-1.5">
                Required Skills
                <span className="text-secondary-400 font-normal ml-1">(comma-separated)</span>
              </label>
              <input
                type="text"
                id="skills"
                placeholder="E.g. React, Solana, Rust"
                {...register('skills')}
                className="w-full px-4 py-2.5 border border-secondary-200 rounded-lg text-secondary-900 placeholder:text-secondary-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-shadow"
              />
              {errors.skills && (
                <p className="text-red-500 text-sm mt-1.5 flex items-center gap-1">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01" />
                  </svg>
                  {errors.skills.message}
                </p>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-secondary-100" />

            {/* Wallet Info */}
            <div className="bg-secondary-50 rounded-lg p-4 flex items-start gap-3">
              <svg className="h-5 w-5 text-secondary-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              <div>
                <p className="text-sm text-secondary-700">
                  <span className="font-medium">Connected Wallet:</span>{' '}
                  <span className="font-mono">
                    {address
                      ? `${address.toString().slice(0, 6)}...${address.toString().slice(-4)}`
                      : ''}
                  </span>
                </p>
                <p className="text-xs text-secondary-500 mt-0.5">
                  This wallet will be associated with your job posting.
                </p>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full px-6 py-3 bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-colors text-sm font-semibold shadow-button disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Creating Job...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Post Job
                </>
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default CreateJob;
