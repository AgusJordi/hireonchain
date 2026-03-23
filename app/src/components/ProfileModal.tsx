import toast from 'react-hot-toast';
import api from '../utils/api';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

interface UserProfile {
  _id: string;
  username: string;
  email: string;
  walletAddress: string;
  bio: string;
  skills: string[];
  reviews: {
    _id: string;
    reviewer: { username: string };
    rating: number;
    comment: string;
    createdAt: string;
  }[];
  role: string;
  rating: number;
  createdAt: string;
}

interface ProfileProps {
  profile: UserProfile;
  onClose: () => void;
  onSave: (updatedData: Partial<UserProfile>) => Promise<void>;
}

const profileSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  email: z.string().min(1, 'Email is required').email('Please enter a valid email'),
  bio: z.string().min(1, 'Bio is required').max(300, 'Bio must be under 300 characters'),
  skills: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export const ProfileModal = ({ profile, onClose, onSave }: ProfileProps) => {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      username: profile.username,
      email: profile.email,
      bio: profile.bio ?? '',
      skills: Array.isArray(profile.skills) ? profile.skills.join(', ') : '',
    },
  });

  const bioValue = watch('bio', '');
  const bioLength = bioValue?.length || 0;

  useEffect(() => {
    reset({
      username: profile.username,
      email: profile.email,
      bio: profile.bio ?? '',
      skills: Array.isArray(profile.skills) ? profile.skills.join(', ') : '',
    });
  }, [profile, reset]);

  const handleFormSubmit = async (data: ProfileFormData) => {
    try {
      const skillsArray =
        typeof data.skills === 'string'
          ? data.skills.split(',').map((s: string) => s.trim()).filter(Boolean)
          : [];

      await onSave({
        username: data.username,
        email: data.email,
        bio: data.bio,
        skills: skillsArray,
      });
    } catch (error) {
      console.error('Failed to update profile:', error);
      toast.error('Failed to update profile');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-primary-600">Edit Profile</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-400 text-xl"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="form-group">
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <input
              id="username"
              type="text"
              {...register('username')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            {errors.username && (
              <p className="text-red-500 text-sm mt-1">{errors.username.message}</p>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              {...register('email')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            {errors.email && (
              <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-1">
              Bio ({bioLength}/300)
            </label>
            <textarea
              id="bio"
              rows={4}
              {...register('bio')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            />
            {errors.bio && (
              <p className="text-red-500 text-sm mt-1">{errors.bio.message}</p>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="skills" className="block text-sm font-medium text-gray-700 mb-1">
              Skills (comma-separated)
            </label>
            <input
              id="skills"
              type="text"
              placeholder="React, Solana, TypeScript"
              {...register('skills')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 font-semibold px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 font-semibold px-4 py-2 border-2 border-primary-600 hover:border-primary-400 text-primary-600 hover:text-primary-500 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
