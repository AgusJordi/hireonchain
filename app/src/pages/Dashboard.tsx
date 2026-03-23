import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { useAppKitAccount } from '@reown/appkit/react';

interface Job {
  _id: string;
  title: string;
  description: string;
  price: number;
  status: string;
  createdAt: string;
  client: {
    username: string;
  };
  assignedTo?: {
    username: string;
  };
}

interface Contract {
  _id: string;
  status: string;
  amount: number;
  contractAddress: string;
  job: {
    title: string;
  };
  client: {
    username: string;
  };
  freelancer: {
    username: string;
  };
}

const statusColors: Record<string, string> = {
  open: 'bg-blue-100 text-blue-800 border-blue-200',
  in_progress: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  completed: 'bg-green-100 text-green-800 border-green-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
  funded: 'bg-purple-100 text-purple-800 border-purple-200',
  disputed: 'bg-orange-100 text-orange-800 border-orange-200',
};

const Dashboard: React.FC = () => {
  const { address } = useAppKitAccount();
  const [userRole, setUserRole] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const userInfoStr = localStorage.getItem('userInfo');
        if (userInfoStr) {
          const userInfo = JSON.parse(userInfoStr);
          setUserRole(userInfo.role);
          setUsername(userInfo.username || '');

          // Fetch appropriate jobs based on role
          let jobsResponse;
          if (userInfo.role === 'client') {
            jobsResponse = await api.get('/api/jobs/client/jobs');
          } else {
            jobsResponse = await api.get('/api/jobs/freelancer/jobs');
          }
          setJobs(jobsResponse.data);

          // Fetch contracts
          const contractsResponse = await api.get('/api/contracts');
          setContracts(contractsResponse.data);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const stats = useMemo(() => {
    const activeJobs = jobs.filter(j => j.status === 'open' || j.status === 'in_progress').length;
    const completedJobs = jobs.filter(j => j.status === 'completed').length;
    const activeContracts = contracts.filter(c => c.status !== 'completed' && c.status !== 'cancelled').length;
    const totalValue = contracts.reduce((sum, c) => sum + (c.amount || 0), 0);
    return { activeJobs, completedJobs, activeContracts, totalValue };
  }, [jobs, contracts]);

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
        <p className="text-lg font-medium text-secondary-600">Loading dashboard...</p>
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-500 rounded-2xl p-6 sm:p-8 mb-8 text-white">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">
              {username ? `Welcome back, ${username}` : 'Dashboard'}
            </h1>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                userRole === 'client'
                  ? 'bg-blue-100 text-blue-800 border border-blue-200'
                  : 'bg-accent-100 text-accent-800 border border-accent-200'
              }`}>
                {userRole}
              </span>
              {address && (
                <span className="text-white/70 text-sm font-mono">
                  {address.toString().slice(0, 6)}...{address.toString().slice(-4)}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            {userRole === 'client' && (
              <Link
                to="/jobs/create"
                className="px-5 py-2.5 bg-white text-primary-600 hover:bg-primary-50 rounded-lg transition-colors text-sm font-semibold flex items-center gap-2"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                Post a New Job
              </Link>
            )}
            <Link
              to="/jobs"
              className="px-5 py-2.5 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-lg transition-colors text-sm font-medium flex items-center gap-2 border border-white/20"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Browse All Jobs
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-card border border-secondary-100 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-secondary-900">{stats.activeJobs}</p>
              <p className="text-xs text-secondary-500 font-medium">Active Jobs</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-card border border-secondary-100 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-secondary-900">{stats.completedJobs}</p>
              <p className="text-xs text-secondary-500 font-medium">Completed</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-card border border-secondary-100 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-secondary-900">{stats.activeContracts}</p>
              <p className="text-xs text-secondary-500 font-medium">Active Contracts</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-card border border-secondary-100 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
              <svg className="h-5 w-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-secondary-900">{stats.totalValue.toFixed(1)}</p>
              <p className="text-xs text-secondary-500 font-medium">Total SOL</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Jobs Section */}
        <div className="bg-white rounded-xl shadow-card border border-secondary-100 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-secondary-900 flex items-center gap-2">
              <svg className="h-5 w-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              {userRole === 'client' ? 'Your Posted Jobs' : 'Your Jobs'}
            </h2>
            <span className="text-xs font-medium text-secondary-500 bg-secondary-100 px-2.5 py-1 rounded-full">
              {jobs.length} total
            </span>
          </div>

          {jobs.length === 0 ? (
            <div className="bg-secondary-50 rounded-lg p-8 text-center">
              <svg className="mx-auto h-12 w-12 text-secondary-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <p className="text-secondary-500 mb-1 font-medium">No jobs yet</p>
              <p className="text-sm text-secondary-400">
                {userRole === 'client'
                  ? 'Post your first job to get started'
                  : 'Browse available jobs to find work'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.map(job => (
                <Link
                  key={job._id}
                  to={`/jobs/${job._id}`}
                  className="block border border-secondary-100 rounded-lg p-4 hover:shadow-md hover:border-primary-200 transition-all group"
                >
                  <div className="flex justify-between items-start gap-3">
                    <h3 className="text-sm font-semibold text-secondary-900 group-hover:text-primary-600 transition-colors line-clamp-1">
                      {job.title}
                    </h3>
                    <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                      statusColors[job.status] || 'bg-secondary-100 text-secondary-800 border-secondary-200'
                    }`}>
                      {job.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="mt-2.5 flex items-center gap-4 text-xs text-secondary-500">
                    <span className="flex items-center gap-1">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <strong className="text-secondary-700">{job.price} SOL</strong>
                    </span>

                    {job.assignedTo && (
                      <span className="flex items-center gap-1">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        {job.assignedTo.username}
                      </span>
                    )}

                    <span className="flex items-center gap-1">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {new Date(job.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center text-xs font-medium text-primary-600 group-hover:text-primary-700 transition-colors">
                    View Details
                    <svg className="ml-1 h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Contracts Section */}
        <div className="bg-white rounded-xl shadow-card border border-secondary-100 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-secondary-900 flex items-center gap-2">
              <svg className="h-5 w-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Your Contracts
            </h2>
            <span className="text-xs font-medium text-secondary-500 bg-secondary-100 px-2.5 py-1 rounded-full">
              {contracts.length} total
            </span>
          </div>

          {contracts.length === 0 ? (
            <div className="bg-secondary-50 rounded-lg p-8 text-center">
              <svg className="mx-auto h-12 w-12 text-secondary-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-secondary-500 mb-1 font-medium">No contracts yet</p>
              <p className="text-sm text-secondary-400">Contracts will appear here once a job is accepted</p>
            </div>
          ) : (
            <div className="space-y-3">
              {contracts.map(contract => (
                <Link
                  key={contract._id}
                  to={`/contracts/${contract._id}`}
                  className="block border border-secondary-100 rounded-lg p-4 hover:shadow-md hover:border-primary-200 transition-all group"
                >
                  <div className="flex justify-between items-start gap-3">
                    <h3 className="text-sm font-semibold text-secondary-900 group-hover:text-primary-600 transition-colors line-clamp-1">
                      {contract.job?.title || 'Untitled Job'}
                    </h3>
                    <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                      statusColors[contract.status] || 'bg-secondary-100 text-secondary-800 border-secondary-200'
                    }`}>
                      {contract.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-secondary-500">
                    <span className="flex items-center gap-1">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <strong className="text-secondary-700">{contract.amount} SOL</strong>
                    </span>

                    <span className="flex items-center gap-1">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      {userRole === 'client' ? contract.freelancer?.username : contract.client?.username}
                    </span>

                    <span className="flex items-center gap-1 font-mono">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      {contract.contractAddress ? `${contract.contractAddress.slice(0, 8)}...` : 'N/A'}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center text-xs font-medium text-primary-600 group-hover:text-primary-700 transition-colors">
                    Manage Contract
                    <svg className="ml-1 h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
