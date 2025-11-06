import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import api from "../utils/api";
import { createContract } from "../utils/contractUtils";
import axios from "axios";

interface Proposal {
  _id: string;
  freelancer: {
    _id: string;
    username: string;
    walletAddress: string;
    rating: number;
  };
  proposal: string;
  price: number;
  status: string;
  createdAt: string;
}

interface Job {
  _id: string;
  title: string;
  description: string;
  price: number;
  skills: string[];
  status: string;
  createdAt: string;
  deadline: string | null;
  client: {
    _id: string;
    username: string;
    walletAddress: string;
  };
  assignedTo?: {
    _id: string;
    username: string;
    walletAddress: string;
  };
  proposals: Proposal[];
  contractAddress?: string;
}

const JobDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const wallet = useWallet();

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userRole, setUserRole] = useState("");
  const [userId, setUserId] = useState("");

  const [proposalText, setProposalText] = useState("");
  const [proposalPrice, setProposalPrice] = useState("");
  const [submittingProposal, setSubmittingProposal] = useState(false);
  const [proposalError, setProposalError] = useState("");
  const [proposalSuccess, setProposalSuccess] = useState(false);

  // Contract creation state
  const [creatingContract, setCreatingContract] = useState(false);
  const [contractError, setContractError] = useState("");
  const [contractAddress, setContractAddress] = useState("");

  useEffect(() => {
    const fetchJob = async () => {
      try {
        const response = await api.get(`/api/jobs/${id}`);
        setJob(response.data);

        // Get user info
        const userInfoStr = localStorage.getItem("userInfo");
        if (userInfoStr) {
          const userInfo = JSON.parse(userInfoStr);
          setUserRole(userInfo.role);
          setUserId(userInfo._id);

          // Set default proposal price to job price
          setProposalPrice(response.data.price.toString());
        }
      } catch (error) {
        console.error("Error fetching job:", error);
        setError("Failed to load job details");
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchJob();
    }
  }, [id]);

  const handleProposalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!wallet.connected || !wallet.publicKey) {
      setProposalError("Please connect your wallet first");
      return;
    }

    if (!proposalText) {
      setProposalError("Please enter a proposal description");
      return;
    }

    setSubmittingProposal(true);
    setProposalError("");

    try {
      const response = await api.post(`/api/jobs/${id}/proposals`, {
        proposal: proposalText,
        price: parseFloat(proposalPrice),
      });

      setProposalSuccess(true);
      // Refresh job data to show the new proposal
      const updatedJob = await api.get(`/api/jobs/${id}`);
      setJob(updatedJob.data);
    } catch (error: any) {
      console.error("Error submitting proposal:", error);
      if (error.response && error.response.data) {
        setProposalError(
          error.response.data.message || "Failed to submit proposal"
        );
      } else {
        setProposalError("Failed to submit proposal");
      }
    } finally {
      setSubmittingProposal(false);
    }
  };

  const handleAcceptProposal = async (proposalId: string) => {
    try {
      await api.put(`/api/jobs/${id}/proposals/${proposalId}/accept`);

      // Refresh job data
      const updatedJob = await api.get(`/api/jobs/${id}`);
      setJob(updatedJob.data);
    } catch (error) {
      console.error("Error accepting proposal:", error);
      alert("Failed to accept proposal");
    }
  };

  const handleCreateContract = async () => {
    if (!job || !job.assignedTo) {
      alert("Job must be assigned to a freelancer first");
      return;
    }

    if (!contractAddress) {
      setContractError("Please enter a contract address");
      return;
    }

    setCreatingContract(true);
    setContractError("");

    try {
      const result = await createContract(
        job._id,
        contractAddress,
        job.price,
        wallet
      );

      if (result.success) {
        // Refresh job data
        const updatedJob = await api.get(`/api/jobs/${id}`);
        setJob(updatedJob.data);
        alert("Contract created successfully");
      } else {
        setContractError(result.error || "Failed to create contract");
      }
    } catch (error) {
      console.error("Error creating contract:", error);
      setContractError("Failed to create contract");
    } finally {
      setCreatingContract(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading job details...</div>;
  }

  if (error || !job) {
    return <div className="error-message">{error || "Job not found"}</div>;
  }

  const isOwner = userId === job.client._id;
  const isAssigned = job.assignedTo && userId === job.assignedTo._id;
  const hasProposed = job.proposals.some((p) => p.freelancer._id === userId);

  return (
    <div className="job-detail-page">
      <div className="job-header">
        <h1>{job.title}</h1>
        <div className="job-status">
          <span className={`status-badge ${job.status}`}>{job.status}</span>
        </div>
      </div>

      <div className="job-container">
        <div className="job-main">
          <div className="job-info">
            <div className="price-section">
              <h2>Budget</h2>
              <p className="job-price">{job.price} SOL</p>
            </div>

            <div className="description-section">
              <h2>Description</h2>
              <p>{job.description}</p>
            </div>

            <div className="skills-section">
              <h2>Skills Required</h2>
              <div className="skills-list">
                {job.skills.map((skill, index) => (
                  <span key={index} className="skill-tag">
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            {job.deadline && (
              <div className="deadline-section">
                <h2>Deadline</h2>
                <p>{new Date(job.deadline).toLocaleDateString()}</p>
              </div>
            )}
          </div>

          {!wallet.connected && (
            <div className="wallet-connection">
              <p>Connect your wallet to interact with this job</p>
              <WalletMultiButton />
            </div>
          )}

          {/* Contract creation section for assigned jobs */}
          {wallet.connected &&
            job.status === "in_progress" &&
            !job.contractAddress &&
            (isOwner || isAssigned) && (
              <div className="contract-section">
                <h2>Create Contract</h2>
                <p>
                  Create a smart contract to secure the payment for this job.
                </p>

                <div className="contract-form">
                  <div className="form-group">
                    <label htmlFor="contractAddress">Contract Address</label>
                    <input
                      type="text"
                      id="contractAddress"
                      value={contractAddress}
                      onChange={(e) => setContractAddress(e.target.value)}
                      placeholder="Enter Solana contract address"
                    />
                  </div>

                  {contractError && (
                    <div className="error-message">{contractError}</div>
                  )}

                  <button
                    onClick={handleCreateContract}
                    disabled={creatingContract}
                    className="create-contract-btn"
                  >
                    {creatingContract ? "Creating..." : "Create Contract"}
                  </button>
                </div>
              </div>
            )}

          {/* Contract details if exists */}
          {job.contractAddress && (
            <div className="contract-info">
              <h2>Contract Information</h2>
              <p>
                <strong>Contract Address:</strong> {job.contractAddress}
              </p>
              <button
                onClick={() => navigate(`/contracts/${job.contractAddress}`)}
                className="view-contract-btn"
              >
                View Contract Details
              </button>
            </div>
          )}

          {/* Submit proposal form for freelancers */}
          {wallet.connected &&
            userRole === "freelancer" &&
            job.status === "open" &&
            !hasProposed && (
              <div className="proposal-section">
                <h2>Submit a Proposal</h2>

                {proposalSuccess ? (
                  <div className="success-message">
                    Your proposal has been submitted successfully!
                  </div>
                ) : (
                  <form
                    onSubmit={handleProposalSubmit}
                    className="proposal-form"
                  >
                    <div className="form-group">
                      <label htmlFor="proposalText">Your Proposal</label>
                      <textarea
                        id="proposalText"
                        value={proposalText}
                        onChange={(e) => setProposalText(e.target.value)}
                        placeholder="Describe how you can help with this project..."
                        rows={6}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="proposalPrice">Your Price (SOL)</label>
                      <input
                        type="number"
                        id="proposalPrice"
                        value={proposalPrice}
                        onChange={(e) => setProposalPrice(e.target.value)}
                        step="0.01"
                        min="0"
                        required
                      />
                    </div>

                    {proposalError && (
                      <div className="error-message">{proposalError}</div>
                    )}

                    <button
                      type="submit"
                      disabled={submittingProposal}
                      className="submit-proposal-btn"
                    >
                      {submittingProposal ? "Submitting..." : "Submit Proposal"}
                    </button>
                  </form>
                )}
              </div>
            )}
        </div>

        <div className="job-sidebar">
          <div className="client-info">
            <h2>About the Client</h2>
            <p className="client-name">{job.client.username}</p>
            <p className="client-wallet">
              <strong>Wallet:</strong> {job.client.walletAddress.slice(0, 6)}...
              {job.client.walletAddress.slice(-6)}
            </p>
          </div>

          {/* Proposals section for job owner */}
          {isOwner && job.proposals.length > 0 && (
            <div className="proposals-section">
              <h2>Proposals ({job.proposals.length})</h2>
              <div className="proposals-list">
                {job.proposals.map((proposal) => (
                  <div key={proposal._id} className="proposal-card">
                    <div className="proposal-header">
                      <span className="freelancer-name">
                        {proposal.freelancer.username}
                      </span>
                      <span className="proposal-price">
                        {proposal.price} SOL
                      </span>
                    </div>
                    <p className="proposal-text">{proposal.proposal}</p>
                    <div className="proposal-actions">
                      {job.status === "open" &&
                        proposal.status === "pending" && (
                          <button
                            onClick={() => handleAcceptProposal(proposal._id)}
                            className="accept-proposal-btn"
                          >
                            Accept Proposal
                          </button>
                        )}
                      {proposal.status !== "pending" && (
                        <span className={`proposal-status ${proposal.status}`}>
                          {proposal.status.charAt(0).toUpperCase() +
                            proposal.status.slice(1)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Assigned freelancer info */}
          {job.assignedTo && (
            <div className="assigned-freelancer">
              <h2>Assigned Freelancer</h2>
              <p className="freelancer-name">{job.assignedTo.username}</p>
              <p className="freelancer-wallet">
                <strong>Wallet:</strong>{" "}
                {job.assignedTo.walletAddress.slice(0, 6)}...
                {job.assignedTo.walletAddress.slice(-6)}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default JobDetail;
