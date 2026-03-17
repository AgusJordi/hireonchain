import toast from 'react-hot-toast';
import { UserProfile } from '../pages/Profile';
import api from '../utils/api';
import { useState } from 'react';

interface ProfileProps {
  formData: UserProfile;
  setFormData: React.Dispatch<React.SetStateAction<UserProfile>>;
  setEditMode: React.Dispatch<React.SetStateAction<boolean>>;
}

export const ProfileModal = ({ formData, setFormData, setEditMode }: ProfileProps) => {
  const [wordCount, setWordCount] = useState(formData.bio?.length ?? 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (wordCount >= 300) {
      toast.error('Bios must be under 300 characters');
      return;
    }

    if (formData.bio.length === 0) {
      toast.error('Bios are required');
      return;
    }

    try {
      const updateData = {
        ...formData,
        username: formData.username,
        email: formData.email,
        bio: formData.bio ?? '',
        skills: formData.skills ? formData.skills.map(skill => skill.trim()) : [],
      };

      const { data } = await api.put('/api/users/profile', updateData);
      setFormData(data);
      setEditMode(false);

      localStorage.setItem(
        'userInfo',
        data.username
          ? JSON.stringify({
              ...updateData,
              username: data.username,
              email: data.email,
            })
          : '{}'
      );

      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    if (name === 'bio') {
      setWordCount(value.length);
      if (value.length >= 300) {
        toast.error('Bios must be under 300 characters');
      }
    }

    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 min-h-screen w-screen">
      <form onSubmit={handleSubmit} className="bg-white rounded-lg p-6 max-w-md w-full">
        <div className="items-center mx-auto justify-between flex mb-12">
          <h2 className="text-3xl font-bold text-center text-primary-600">Edit Profile</h2>
          <button
            onClick={() => setEditMode(false)}
            className="text-secondary-600 hover:text-primary-600 text-2xl"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-secondary-900 mb-1">
              Username
            </label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              className={`w-full px-3 py-2 border rounded-lg shadow-sm placeholder-secondary-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 disabled:bg-secondary-50 disabled:text-secondary-500 disabled:cursor-not-allowed ${'border-secondary-300'}`}
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-secondary-900 mb-1">
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className={`w-full px-3 py-2 border rounded-lg shadow-sm placeholder-secondary-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 disabled:bg-secondary-50 disabled:text-secondary-500 disabled:cursor-not-allowed ${'border-secondary-300'}`}
            />
          </div>

          <div>
            <label htmlFor="bio" className="block text-sm font-medium text-secondary-900 mb-1">
              Bio
            </label>
            <textarea
              id="bio"
              name="bio"
              value={formData.bio}
              onChange={handleChange}
              rows={4}
              className={`w-full px-3 py-2 border rounded-lg shadow-sm placeholder-secondary-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 disabled:bg-secondary-50 disabled:text-secondary-500 disabled:cursor-not-allowed ${'border-secondary-300'}`}
            />
          </div>

          <div>
            <label
              className={`block text-sm font-medium mb-1 ${wordCount >= 300 ? 'text-red-500' : 'text-secondary-900'}`}
            >
              <span className="text-primary-600 underline">Characters:</span>
              {` ${wordCount} / 300`}
            </label>
          </div>

          {formData.role === 'freelancer' && (
            <div>
              <label
                htmlFor="skills"
                className="block text-sm text-secondary-600 font-semibold mb-1"
              >
                Skills (comma-separated)
              </label>
              <input
                type="text"
                id="skills"
                name="skills"
                value={formData.skills || ''}
                onChange={handleChange}
                placeholder="React, TypeScript, Node.js"
                className="w-full bg-secondary-900/50 border border-secondary-600 rounded-lg px-4 py-2.5 text-primary-400 font-semibold focus:outline-none focus:border-primary-500 transition-colors"
              />
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            type="submit"
            className="font-semibold x-4 py-2 border-2 border-primary-600 hover:border-primary-500 bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-colors w-1/2"
          >
            Save Changes
          </button>
          <button
            type="button"
            onClick={() => setEditMode(false)}
            className="font-semibold px-4 py-2 border-2 border-primary-600 hover:border-primary-400 text-primary-600 hover:text-primary-500 rounded-lg transition-colors w-1/2"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};
