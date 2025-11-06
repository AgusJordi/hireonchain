import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import api from "../utils/api";

interface Job {
  _id: string;
  title: string;
  description: string;
  price: number;
  skills: string[];
  status: string;
  createdAt: string;
  client: {
    username: string;
    walletAddress: string;
  };
  proposals: any[];
}

const JobList: React.FC = () => {
  const { connected } = useWallet();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({
    minPrice: "",
    maxPrice: "",
    status: "open",
  });

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const response = await api.get("/api/jobs");
        setJobs(response.data);
        // Initially show only open jobs
        setFilteredJobs(
          response.data.filter((job: Job) => job.status === "open")
        );
      } catch (error) {
        console.error("Error fetching jobs:", error);
        setError("Failed to load jobs");
      } finally {
        setLoading(false);
      }
    };

    fetchJobs();
  }, []);

  useEffect(() => {
    // Apply filters and search
    let result = jobs;

    // Filter by status
    if (filters.status !== "all") {
      result = result.filter((job) => job.status === filters.status);
    }

    // Filter by price range
    if (filters.minPrice) {
      result = result.filter(
        (job) => job.price >= parseFloat(filters.minPrice)
      );
    }
    if (filters.maxPrice) {
      result = result.filter(
        (job) => job.price <= parseFloat(filters.maxPrice)
      );
    }

    // Apply search term to title, description, and skills
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (job) =>
          job.title.toLowerCase().includes(term) ||
          job.description.toLowerCase().includes(term) ||
          job.skills.some((skill) => skill.toLowerCase().includes(term))
      );
    }

    setFilteredJobs(result);
  }, [jobs, filters, searchTerm]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleFilterChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFilters({
      ...filters,
      [name]: value,
    });
  };

  if (loading) {
    return <div className="loading">Loading jobs...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  return (
    <div className="job-list-page">
      <div className="job-list-header">
        <h1>Available Jobs</h1>

        {!connected && (
          <div className="wallet-connection-message">
            <p>Connect your wallet to apply for jobs</p>
            <WalletMultiButton />
          </div>
        )}
      </div>

      <div className="filters-container">
        <div className="search-container">
          <input
            type="text"
            placeholder="Search by title, description, or skills"
            value={searchTerm}
            onChange={handleSearchChange}
            className="search-input"
          />
        </div>

        <div className="filters">
          <div className="filter-group">
            <label htmlFor="status">Status:</label>
            <select
              id="status"
              name="status"
              value={filters.status}
              onChange={handleFilterChange}
            >
              <option value="all">All Jobs</option>
              <option value="open">Open Jobs</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="minPrice">Min Price (SOL):</label>
            <input
              type="number"
              id="minPrice"
              name="minPrice"
              value={filters.minPrice}
              onChange={handleFilterChange}
              min="0"
              step="0.1"
            />
          </div>

          <div className="filter-group">
            <label htmlFor="maxPrice">Max Price (SOL):</label>
            <input
              type="number"
              id="maxPrice"
              name="maxPrice"
              value={filters.maxPrice}
              onChange={handleFilterChange}
              min="0"
              step="0.1"
            />
          </div>
        </div>
      </div>

      {filteredJobs.length === 0 ? (
        <div className="no-jobs">
          <p>No jobs found matching your criteria</p>
        </div>
      ) : (
        <div className="jobs-grid">
          {filteredJobs.map((job) => (
            <div key={job._id} className="job-card">
              <h2 className="job-title">{job.title}</h2>

              <div className="job-meta">
                <span className="job-price">{job.price} SOL</span>
                <span className={`job-status status-${job.status}`}>
                  {job.status}
                </span>
              </div>

              <p className="job-description">
                {job.description.length > 150
                  ? `${job.description.substring(0, 150)}...`
                  : job.description}
              </p>

              <div className="job-skills">
                {job.skills.map((skill, index) => (
                  <span key={index} className="skill-tag">
                    {skill}
                  </span>
                ))}
              </div>

              <div className="job-footer">
                <span className="job-client">
                  Posted by: {job.client.username}
                </span>
                <span className="job-proposals">
                  Proposals: {job.proposals.length}
                </span>
              </div>

              <Link to={`/jobs/${job._id}`} className="view-job-btn">
                View Details
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default JobList;
