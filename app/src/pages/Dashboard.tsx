import React, { useState, useEffect } from 'react';
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

const Dashboard: React.FC = () => {
  const { address } = useAppKitAccount();
  const [userRole, setUserRole] = useState<string>('');
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

  if (loading) {
    return (
      <div className="flex items-center space-x-2">
        <svg
          className="animate-spin h-8 w-8 text-primary-600"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
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
        <span className="text-lg font-medium text-secondary-700">Loading dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg max-w-md">
        <div className="flex items-center">
          <svg
            className="h-6 w-6 mr-2 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="font-medium">{error}</span>
        </div>
      </div>
    );
  }

  // Status badge colors mapping
  const statusColors = {
    open: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-secondary-900">Dashboard</h1>
          {address && (
            <div className="mt-2 text-sm text-secondary-600">
              Connected wallet:{' '}
              <span className="font-medium">
                {address.toString().slice(0, 4)}...
                {address.toString().slice(-4)}
              </span>
            </div>
          )}
        </div>

        <div className="mt-4 sm:mt-0 flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
          {userRole === 'client' && (
            <Link to="/create-job" className="btn-primary">
              Post a New Job
            </Link>
          )}
          <Link to="/jobs" className="btn-secondary">
            Browse All Jobs
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Jobs Section */}
        <div className="card">
          <h2 className="text-xl font-bold text-secondary-900 mb-4">
            {userRole === 'client' ? 'Your Posted Jobs' : 'Your Jobs'}
          </h2>

          {jobs.length === 0 ? (
            <div className="bg-secondary-50 rounded-lg p-6 text-center">
              <svg
                className="mx-auto h-12 w-12 text-secondary-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              <p className="mt-2 text-secondary-600">No jobs found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {jobs.map(job => (
                <div
                  key={job._id}
                  className="border border-secondary-200 rounded-lg overflow-hidden bg-white hover:shadow-md transition-shadow"
                >
                  <div className="p-4">
                    <div className="flex justify-between items-start">
                      <h3 className="text-lg font-semibold text-secondary-900">{job.title}</h3>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          statusColors[job.status as keyof typeof statusColors] ||
                          'bg-secondary-100 text-secondary-800'
                        }`}
                      >
                        {job.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="mt-3 space-y-1 text-sm text-secondary-600">
                      <p className="flex items-center">
                        <svg
                          className="h-4 w-4 mr-1.5 text-secondary-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <span>
                          <strong>{job.price} SOL</strong>
                        </span>
                      </p>

                      {job.assignedTo && (
                        <p className="flex items-center">
                          <svg
                            className="h-4 w-4 mr-1.5 text-secondary-500"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                            />
                          </svg>
                          <span>
                            <strong>Freelancer:</strong> {job.assignedTo.username}
                          </span>
                        </p>
                      )}
                    </div>

                    <div className="mt-4">
                      <Link
                        to={`/jobs/${job._id}`}
                        className="text-sm font-medium text-primary-600 hover:text-primary-700 flex items-center"
                      >
                        View Details
                        <svg
                          className="ml-1 h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Contracts Section */}
        <div className="card">
          <h2 className="text-xl font-bold text-secondary-900 mb-4">Your Contracts</h2>

          {contracts.length === 0 ? (
            <div className="bg-secondary-50 rounded-lg p-6 text-center">
              <svg
                className="mx-auto h-12 w-12 text-secondary-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p className="mt-2 text-secondary-600">No contracts found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {contracts.map(contract => (
                <div
                  key={contract._id}
                  className="border border-secondary-200 rounded-lg overflow-hidden bg-white hover:shadow-md transition-shadow"
                >
                  <div className="p-4">
                    <div className="flex justify-between items-start">
                      <h3 className="text-lg font-semibold text-secondary-900">
                        {contract.job.title}
                      </h3>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          statusColors[contract.status as keyof typeof statusColors] ||
                          'bg-secondary-100 text-secondary-800'
                        }`}
                      >
                        {contract.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="mt-3 space-y-1 text-sm text-secondary-600">
                      <p className="flex items-center">
                        <svg
                          className="h-4 w-4 mr-1.5 text-secondary-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <span>
                          <strong>{contract.amount} SOL</strong>
                        </span>
                      </p>

                      <p className="flex items-center">
                        <svg
                          className="h-4 w-4 mr-1.5 text-secondary-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                          />
                        </svg>
                        <span>
                          <strong>{userRole === 'client' ? 'Freelancer' : 'Client'}:</strong>{' '}
                          {userRole === 'client'
                            ? contract.freelancer.username
                            : contract.client.username}
                        </span>
                      </p>

                      <p className="flex items-center break-all">
                        <svg
                          className="h-4 w-4 mr-1.5 text-secondary-500 shrink-0"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                          />
                        </svg>
                        <span className="text-xs truncate">
                          <strong>Contract:</strong> {contract.contractAddress.slice(0, 12)}...
                        </span>
                      </p>
                    </div>

                    <div className="mt-4">
                      <Link
                        to={`/contracts/${contract._id}`}
                        className="text-sm font-medium text-primary-600 hover:text-primary-700 flex items-center"
                      >
                        Manage Contract
                        <svg
                          className="ml-1 h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
