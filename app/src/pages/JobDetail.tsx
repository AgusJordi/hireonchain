import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { WalletButton } from '../components/WalletButton';
import { useAppKitAccount } from '@reown/appkit/react';
import { useFreelanceClient } from '../hooks/useFreelanceClient';
import { useWalletSigner } from '../hooks/useWalletSigner';
import {
  fetchPlatformConfig,
  fetchJob,
  PROGRAM_ID,
  DisputeRulingClientWins,
  DisputeRulingFreelancerWins,
  DisputeRulingNone,
  createDisputeRulingSplit,
  JobStatus,
  MilestoneStatus,
} from '@sdk/index';
import type { DisputeRuling } from '@sdk/index';

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

interface Milestone {
  amount: string;
  description: string;
}

interface Contract {
  _id: string;
  onChainJobId: number;
  status: string;
  clientWallet: string;
  freelancerWallet: string;
  milestones: {
    milestoneId: number;
    amount: number;
    description: string;
    status: string;
  }[];
  transactions: {
    type: string;
    signature: string;
    timestamp: string;
  }[];
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
  onChainJobId?: number;
}

const proposalSchema = z.object({
  proposalText: z.string().min(1, 'Please enter a proposal description'),
  proposalPrice: z
    .string()
    .min(1, 'Price is required')
    .refine(val => parseFloat(val) > 0, 'Price must be greater than 0'),
});

type ProposalFormData = z.infer<typeof proposalSchema>;

const statusColors: Record<string, string> = {
  open: 'bg-blue-100 text-blue-800 border-blue-200',
  in_progress: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  completed: 'bg-green-100 text-green-800 border-green-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
  funded: 'bg-purple-100 text-purple-800 border-purple-200',
  disputed: 'bg-orange-100 text-orange-800 border-orange-200',
  created: 'bg-secondary-100 text-secondary-800 border-secondary-200',
  pending: 'bg-secondary-100 text-secondary-700 border-secondary-200',
  submitted: 'bg-blue-100 text-blue-800 border-blue-200',
  approved: 'bg-green-100 text-green-800 border-green-200',
  paid: 'bg-accent-100 text-accent-800 border-accent-200',
  accepted: 'bg-green-100 text-green-800 border-green-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
};

const JobDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { address, isConnected } = useAppKitAccount();

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userRole, setUserRole] = useState('');
  const [userId, setUserId] = useState('');

  const [submittingProposal, setSubmittingProposal] = useState(false);
  const [proposalSuccess, setProposalSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError: setFormError,
  } = useForm<ProposalFormData>({
    resolver: zodResolver(proposalSchema),
    defaultValues: {
      proposalText: '',
      proposalPrice: '',
    },
  });

  // On-chain contract creation state
  const sdkClient = useFreelanceClient();
  const walletSigner = useWalletSigner();
  const [creatingContract, setCreatingContract] = useState(false);
  const [contractError, setContractError] = useState('');
  const [contract, setContract] = useState<Contract | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([{ amount: '', description: '' }]);

  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);

  useEffect(() => {
    const fetchJob = async () => {
      try {
        const response = await api.get(`/api/jobs/${id}`);
        setJob(response.data);

        const userInfoStr = localStorage.getItem('userInfo');
        if (userInfoStr) {
          const userInfo = JSON.parse(userInfoStr);
          setUserRole(userInfo.role);
          setUserId(userInfo._id);
        }
      } catch (error) {
        console.error('Error fetching job:', error);
        setError('Failed to load job details');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchJob();
    }
  }, [id]);

  useEffect(() => {
    const fetchContract = async () => {
      if (!job?._id) return;
      try {
        const response = await api.get(`/api/contracts/by-job/${job._id}`);
        setContract(response.data);
      } catch (error: any) {
        if (error.response?.status !== 404) {
          console.error('Error fetching contract:', error);
        }
      }
    };

    fetchContract();
  }, [job?._id]);

  useEffect(() => {
    const fetchBalance = async () => {
      if (!isConnected || !address || !walletSigner) {
        setWalletBalance(null);
        return;
      }

      setLoadingBalance(true);
      try {
        const balance = await sdkClient.connection.getBalance(walletSigner.publicKey);
        setWalletBalance(balance / LAMPORTS_PER_SOL);
      } catch (error) {
        console.error('Error fetching wallet balance:', error);
        setWalletBalance(null);
      } finally {
        setLoadingBalance(false);
      }
    };

    fetchBalance();
  }, [isConnected, address, walletSigner, sdkClient.connection]);

  useEffect(() => {
    const fetchOnChainStatus = async () => {
      if (!contract || !contract.onChainJobId) return;

      setLoadingOnChainStatus(true);
      try {
        const clientPubkey = new PublicKey(contract.clientWallet);
        const jobState = await fetchJob(
          sdkClient.connection,
          PROGRAM_ID,
          clientPubkey,
          BigInt(contract.onChainJobId)
        );
        if (jobState) {
          setOnChainJobState(jobState.status);
        }
      } catch (error) {
        console.error('Error fetching on-chain job status:', error);
      } finally {
        setLoadingOnChainStatus(false);
      }
    };

    fetchOnChainStatus();
  }, [contract, sdkClient.connection]);

  const onProposalSubmit = async (data: ProposalFormData) => {
    if (!isConnected || !address) {
      setFormError('root', {
        type: 'manual',
        message: 'Please connect your wallet first',
      });
      return;
    }

    setSubmittingProposal(true);

    try {
      await api.post(`/api/jobs/${id}/proposals`, {
        proposal: data.proposalText,
        price: parseFloat(data.proposalPrice),
      });

      setProposalSuccess(true);
      const updatedJob = await api.get(`/api/jobs/${id}`);
      setJob(updatedJob.data);
    } catch (error: any) {
      console.error('Error submitting proposal:', error);
      if (error.response && error.response.data) {
        setFormError('root', {
          type: 'manual',
          message: error.response.data.message || 'Failed to submit proposal',
        });
      } else {
        setFormError('root', {
          type: 'manual',
          message: 'Failed to submit proposal',
        });
      }
    } finally {
      setSubmittingProposal(false);
    }
  };

  const handleAcceptProposal = async (proposalId: string) => {
    try {
      await api.put(`/api/jobs/${id}/proposals/${proposalId}/accept`);

      const updatedJob = await api.get(`/api/jobs/${id}`);
      setJob(updatedJob.data);
    } catch (error) {
      console.error('Error accepting proposal:', error);
      alert('Failed to accept proposal');
    }
  };

  const addMilestone = () => {
    setMilestones([...milestones, { amount: '', description: '' }]);
  };

  const removeMilestone = (index: number) => {
    if (milestones.length > 1) {
      setMilestones(milestones.filter((_, i) => i !== index));
    }
  };

  const updateMilestone = (index: number, field: 'amount' | 'description', value: string) => {
    const updated = [...milestones];
    updated[index][field] = value;
    setMilestones(updated);
  };

  const validateMilestones = (): boolean => {
    for (const m of milestones) {
      if (!m.amount || !m.description) {
        showContractError('All milestones must have amount and description');
        return false;
      }
      if (parseFloat(m.amount) <= 0) {
        showContractError('Milestone amounts must be greater than 0');
        return false;
      }
    }
    return true;
  };

  const handleCreateOnchainContract = async () => {
    if (!job || !job.assignedTo || !walletSigner) {
      showContractError('Missing job, freelancer assignment, or wallet connection');
      return;
    }

    if (!validateMilestones()) {
      return;
    }

    setCreatingContract(true);
    setContractError('');

    try {
      const {
        data: { onChainJobId },
      } = await api.get('/api/contracts/next-job-id');

      const amounts = milestones.map(m => BigInt(Math.round(parseFloat(m.amount) * 1_000_000_000)));
      const descriptions = milestones.map(m => m.description);

      const result = await sdkClient.createJob(
        walletSigner,
        new PublicKey(job.client.walletAddress),
        new PublicKey(job.assignedTo.walletAddress),
        BigInt(onChainJobId),
        amounts,
        descriptions
      );

      await api.post('/api/contracts/create-onchain', {
        jobId: job._id,
        onChainJobId,
        milestones: milestones.map(m => ({
          amount: parseFloat(m.amount),
          description: m.description,
        })),
        txSignature: result.txId,
      });

      const [updatedJob, contractRes] = await Promise.all([
        api.get(`/api/jobs/${id}`),
        api.get(`/api/contracts/by-job/${job._id}`),
      ]);
      setJob(updatedJob.data);
      setContract(contractRes.data);
    } catch (error: any) {
      console.error('Create on-chain contract error:', error);
      showContractError(parseOnChainError(error));
    } finally {
      setCreatingContract(false);
    }
  };

  const parseOnChainError = (error: any): string => {
    const errorMsg = error?.message || '';

    if (errorMsg.includes('JobAlreadyFunded') || errorMsg.includes('already funded')) {
      return 'This escrow has already been funded.';
    }
    if (errorMsg.includes('insufficient funds') || errorMsg.includes('InsufficientFunds')) {
      return 'Insufficient SOL balance to fund this escrow. Please add more SOL to your wallet.';
    }
    if (errorMsg.includes('InvalidJob') || errorMsg.includes('AccountNotInitialized')) {
      return 'The on-chain job account was not found. Please recreate the contract.';
    }
    if (errorMsg.includes('NotAuthorized') || errorMsg.includes('owner')) {
      return 'You are not authorized to fund this escrow. Only the client can fund.';
    }
    if (errorMsg.includes('User rejected') || errorMsg.includes('UserRejected')) {
      return 'Transaction was rejected in wallet.';
    }
    if (errorMsg.includes('blockhash')) {
      return 'Transaction expired. Please try again.';
    }
    if (errorMsg.includes('Simulation failed')) {
      return 'Transaction simulation failed. The escrow may already be funded or there was a program error.';
    }
    if (errorMsg.includes('MilestoneNotSubmitted') || errorMsg.includes('not submitted')) {
      return 'This milestone has not been submitted yet.';
    }
    if (errorMsg.includes('MilestoneAlreadySubmitted') || errorMsg.includes('already submitted')) {
      return 'This milestone has already been submitted.';
    }
    if (errorMsg.includes('MilestoneAlreadyApproved') || errorMsg.includes('already approved')) {
      return 'This milestone has already been approved.';
    }
    if (errorMsg.includes('MilestoneNotApproved') || errorMsg.includes('not approved')) {
      return 'This milestone must be approved before payment can be released.';
    }
    if (errorMsg.includes('JobNotFunded') || errorMsg.includes('not funded')) {
      return 'The escrow must be funded before milestone operations.';
    }
    if (errorMsg.includes('DisputeActive') || errorMsg.includes('dispute active')) {
      return 'Cannot perform this action while a dispute is active.';
    }
    if (errorMsg.includes('Platform not initialized')) {
      return 'Platform not initialized. Contact admin.';
    }

    return errorMsg || 'Transaction failed. Please try again.';
  };

  const showContractError = (message: string) => {
    setContractError(message);
    toast.error(message, { id: 'tx-status' });
  };

  const handleFundEscrow = async () => {
    if (!contract || !walletSigner) {
      showContractError('Missing contract or wallet connection');
      return;
    }

    setCreatingContract(true);
    setContractError('');

    try {
      const clientPubkey = new PublicKey(contract.clientWallet);
      const result = await sdkClient.fundEscrow(
        walletSigner,
        clientPubkey,
        clientPubkey,
        BigInt(contract.onChainJobId)
      );

      await api.post(`/api/contracts/${contract._id}/transaction`, {
        type: 'fund',
        signature: result.txId,
      });

      const [contractRes] = await Promise.all([
        api.get(`/api/contracts/by-job/${job?._id}`),
        sdkClient.connection.getBalance(walletSigner.publicKey).then(b => {
          setWalletBalance(b / LAMPORTS_PER_SOL);
        }),
      ]);
      setContract(contractRes.data);
    } catch (error: any) {
      console.error('Fund escrow failed:', error);
      const errorMsg = error?.message || '';

      if (errorMsg.includes('JobAlreadyFunded') || errorMsg.includes('already funded')) {
        try {
          await api.put(`/api/contracts/${contract._id}/status`, { status: 'funded' });
          const contractRes = await api.get(`/api/contracts/by-job/${job?._id}`);
          setContract(contractRes.data);
          toast.success('Escrow is already funded. Status synced.', { id: 'tx-status' });
          return;
        } catch (syncError) {
          console.error('Failed to sync funded status:', syncError);
        }
      }

      showContractError(parseOnChainError(error));
    } finally {
      setCreatingContract(false);
    }
  };

  const [milestoneOperationLoading, setMilestoneOperationLoading] = useState<number | null>(null);
  const [submissionHash, setSubmissionHash] = useState<{ [key: number]: string }>({});
  const [disputeMilestoneId, setDisputeMilestoneId] = useState<number | null>(null);
  const [evidenceHash, setEvidenceHash] = useState<string>('');
  const [resolveRuling, setResolveRuling] = useState<string>('none');

  const [onChainJobState, setOnChainJobState] = useState<JobStatus | null>(null);
  const [loadingOnChainStatus, setLoadingOnChainStatus] = useState(false);

  const handleSubmitMilestone = async (milestoneId: number) => {
    if (!contract || !walletSigner) {
      showContractError('Missing contract or wallet connection');
      return;
    }

    const hash = submissionHash[milestoneId];
    if (!hash || hash.trim() === '') {
      showContractError('Please enter a submission hash (e.g., IPFS CID or work link)');
      return;
    }

    setMilestoneOperationLoading(milestoneId);
    setContractError('');

    try {
      const freelancerPubkey = walletSigner.publicKey;
      const clientPubkey = new PublicKey(contract.clientWallet);

      const result = await sdkClient.submitMilestone(
        walletSigner,
        freelancerPubkey,
        clientPubkey,
        BigInt(contract.onChainJobId),
        milestoneId,
        hash
      );

      await api.post(`/api/contracts/${contract._id}/transaction`, {
        type: 'submit',
        signature: result.txId,
        milestoneId,
      });

      const contractRes = await api.get(`/api/contracts/by-job/${job?._id}`);
      setContract(contractRes.data);

      setSubmissionHash(prev => {
        const updated = { ...prev };
        delete updated[milestoneId];
        return updated;
      });
    } catch (error: any) {
      console.error('Submit milestone failed:', error);
      showContractError(parseOnChainError(error));
    } finally {
      setMilestoneOperationLoading(null);
    }
  };

  const handleApproveMilestone = async (milestoneId: number) => {
    if (!contract || !walletSigner) {
      showContractError('Missing contract or wallet connection');
      return;
    }

    setMilestoneOperationLoading(milestoneId);
    setContractError('');

    try {
      const clientPubkey = new PublicKey(contract.clientWallet);

      const result = await sdkClient.approveMilestone(
        walletSigner,
        clientPubkey,
        clientPubkey,
        BigInt(contract.onChainJobId),
        milestoneId
      );

      await api.post(`/api/contracts/${contract._id}/transaction`, {
        type: 'approve',
        signature: result.txId,
        milestoneId,
      });

      const contractRes = await api.get(`/api/contracts/by-job/${job?._id}`);
      setContract(contractRes.data);
    } catch (error: any) {
      console.error('Approve milestone failed:', error);
      showContractError(parseOnChainError(error));
    } finally {
      setMilestoneOperationLoading(null);
    }
  };

  const handleReleaseMilestone = async (milestoneId: number) => {
    if (!contract || !walletSigner) {
      showContractError('Missing contract or wallet connection');
      return;
    }

    setMilestoneOperationLoading(milestoneId);
    setContractError('');

    try {
      const platformConfig = await fetchPlatformConfig(sdkClient.connection, PROGRAM_ID);
      if (!platformConfig) {
        throw new Error('Platform not initialized. Contact admin.');
      }

      const clientPubkey = new PublicKey(contract.clientWallet);
      const freelancerPubkey = new PublicKey(contract.freelancerWallet);

      const result = await sdkClient.releaseMilestone(
        walletSigner,
        clientPubkey,
        clientPubkey,
        BigInt(contract.onChainJobId),
        milestoneId,
        freelancerPubkey,
        platformConfig.treasury
      );

      await api.post(`/api/contracts/${contract._id}/transaction`, {
        type: 'release',
        signature: result.txId,
        milestoneId,
      });

      const [contractRes] = await Promise.all([
        api.get(`/api/contracts/by-job/${job?._id}`),
        sdkClient.connection.getBalance(walletSigner.publicKey).then(b => {
          setWalletBalance(b / LAMPORTS_PER_SOL);
        }),
      ]);
      setContract(contractRes.data);
    } catch (error: any) {
      console.error('Release milestone failed:', error);
      showContractError(parseOnChainError(error));
    } finally {
      setMilestoneOperationLoading(null);
    }
  };

  const handleCancelJob = async () => {
    if (!contract || !walletSigner) {
      showContractError('Missing contract or wallet connection');
      return;
    }

    if (
      !window.confirm(
        'Are you sure you want to cancel this job? This will refund any remaining escrow and cannot be undone.'
      )
    ) {
      return;
    }

    setMilestoneOperationLoading(-1);
    setContractError('');

    try {
      const clientPubkey = new PublicKey(contract.clientWallet);

      const result = await sdkClient.cancelJob(
        walletSigner,
        clientPubkey,
        clientPubkey,
        BigInt(contract.onChainJobId)
      );

      await api.post(`/api/contracts/${contract._id}/transaction`, {
        type: 'cancel',
        signature: result.txId,
      });

      if (job) {
        await api.put(`/api/jobs/${job._id}`, { status: 'cancelled' });
      }

      const [updatedJob, contractRes] = await Promise.all([
        api.get(`/api/jobs/${id}`),
        api.get(`/api/contracts/by-job/${job?._id}`),
        sdkClient.connection.getBalance(walletSigner.publicKey).then(b => {
          setWalletBalance(b / LAMPORTS_PER_SOL);
        }),
      ]);

      setJob(updatedJob.data);
      setContract(contractRes.data);
    } catch (error: any) {
      console.error('Cancel job failed:', error);
      showContractError(parseOnChainError(error));
    } finally {
      setMilestoneOperationLoading(null);
    }
  };

  const handleOpenDispute = async (milestoneId: number) => {
    if (!contract || !walletSigner) {
      showContractError('Missing contract or wallet connection');
      return;
    }

    if (
      !window.confirm(
        'Are you sure you want to open a dispute for this milestone? This will pause all milestone operations until resolved.'
      )
    ) {
      return;
    }

    setMilestoneOperationLoading(milestoneId);
    setContractError('');

    try {
      const result = await sdkClient.openDispute(
        walletSigner,
        walletSigner.publicKey,
        new PublicKey(contract.clientWallet),
        BigInt(contract.onChainJobId),
        milestoneId
      );

      await api.post(`/api/contracts/${contract._id}/transaction`, {
        type: 'dispute',
        signature: result.txId,
        milestoneId,
      });

      const contractRes = await api.get(`/api/contracts/by-job/${job?._id}`);
      setContract(contractRes.data);
    } catch (error: any) {
      console.error('Open dispute failed:', error);
      showContractError(parseOnChainError(error));
    } finally {
      setMilestoneOperationLoading(null);
    }
  };

  const handleSubmitEvidence = async () => {
    if (!contract || !walletSigner) {
      showContractError('Missing contract or wallet connection');
      return;
    }

    if (!evidenceHash || evidenceHash.trim() === '') {
      showContractError('Please enter an evidence hash (e.g., IPFS CID or document link)');
      return;
    }

    setMilestoneOperationLoading(-2);
    setContractError('');

    try {
      const result = await sdkClient.submitDisputeEvidence(
        walletSigner,
        walletSigner.publicKey,
        new PublicKey(contract.clientWallet),
        BigInt(contract.onChainJobId),
        evidenceHash
      );

      await api.post(`/api/contracts/${contract._id}/transaction`, {
        type: 'evidence',
        signature: result.txId,
        evidence: evidenceHash,
      });

      const contractRes = await api.get(`/api/contracts/by-job/${job?._id}`);
      setContract(contractRes.data);
      setEvidenceHash('');
    } catch (error: any) {
      console.error('Submit evidence failed:', error);
      showContractError(parseOnChainError(error));
    } finally {
      setMilestoneOperationLoading(null);
    }
  };

  const handleResolveDispute = async (milestoneId: number) => {
    if (!contract || !walletSigner) {
      showContractError('Missing contract or wallet connection');
      return;
    }

    if (resolveRuling === 'none') {
      showContractError('Please select a ruling');
      return;
    }

    if (
      !window.confirm(
        `Are you sure you want to resolve this dispute with ruling: ${resolveRuling}? This cannot be undone.`
      )
    ) {
      return;
    }

    setMilestoneOperationLoading(-3);
    setContractError('');

    try {
      let ruling: DisputeRuling;
      switch (resolveRuling) {
        case 'client_wins':
          ruling = DisputeRulingClientWins;
          break;
        case 'freelancer_wins':
          ruling = DisputeRulingFreelancerWins;
          break;
        case 'split':
          ruling = createDisputeRulingSplit(5000, 5000);
          break;
        default:
          ruling = DisputeRulingNone;
      }

      const result = await sdkClient.resolveDispute(
        walletSigner,
        walletSigner.publicKey,
        new PublicKey(contract.clientWallet),
        BigInt(contract.onChainJobId),
        milestoneId,
        ruling,
        new PublicKey(contract.clientWallet),
        new PublicKey(contract.freelancerWallet)
      );

      await api.post(`/api/contracts/${contract._id}/transaction`, {
        type: 'resolve',
        signature: result.txId,
        milestoneId,
        ruling: resolveRuling,
      });

      const [contractRes, updatedJob] = await Promise.all([
        api.get(`/api/contracts/by-job/${job?._id}`),
        api.get(`/api/jobs/${id}`),
      ]);
      setContract(contractRes.data);
      setJob(updatedJob.data);
      setResolveRuling('none');
    } catch (error: any) {
      console.error('Resolve dispute failed:', error);
      showContractError(parseOnChainError(error));
    } finally {
      setMilestoneOperationLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col items-center justify-center min-h-[50vh]">
        <svg
          className="animate-spin h-10 w-10 text-primary-600 mb-4"
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
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <p className="text-lg font-medium text-secondary-600">Loading job details...</p>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col items-center justify-center min-h-[50vh]">
        <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg max-w-md w-full text-center">
          <svg
            className="h-10 w-10 text-red-400 mx-auto mb-3"
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
          <p className="font-medium">{error || 'Job not found'}</p>
          <button
            onClick={() => navigate('/jobs')}
            className="mt-4 text-sm font-medium text-primary-600 hover:text-primary-700"
          >
            Back to Jobs
          </button>
        </div>
      </div>
    );
  }

  const isOwner = userId === job.client._id;
  const isAssigned = job.assignedTo && userId === job.assignedTo._id;
  const hasProposed = job.proposals.some(p => p.freelancer._id === userId);

  const totalMilestoneAmount = milestones.reduce((sum, m) => sum + (parseFloat(m.amount) || 0), 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm font-medium text-secondary-500 hover:text-primary-600 transition-colors mb-6"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      {/* Job Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-500 rounded-2xl p-6 sm:p-8 mb-8 text-white">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColors[job.status] || 'bg-secondary-100 text-secondary-800 border-secondary-200'}`}
              >
                {job.status.replace('_', ' ')}
              </span>
              {contract && (
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColors[contract.status] || 'bg-secondary-100 text-secondary-800 border-secondary-200'}`}
                >
                  Contract: {contract.status}
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold">{job.title}</h1>
            <div className="flex flex-wrap items-center gap-4 mt-3 text-white/70 text-sm">
              <span className="flex items-center gap-1.5">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                Posted{' '}
                {new Date(job.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
              {job.deadline && (
                <span className="flex items-center gap-1.5">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Deadline:{' '}
                  {new Date(job.deadline).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              )}
            </div>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-xl px-6 py-4 text-center border border-white/20">
            <p className="text-white/70 text-xs font-medium uppercase tracking-wide">Budget</p>
            <p className="text-2xl font-bold">{job.price} SOL</p>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <div className="bg-white rounded-xl shadow-card border border-secondary-100 p-6">
            <h2 className="text-lg font-bold text-secondary-900 mb-3 flex items-center gap-2">
              <svg
                className="h-5 w-5 text-primary-600"
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
              Description
            </h2>
            <p className="text-secondary-600 leading-relaxed whitespace-pre-wrap">
              {job.description}
            </p>
          </div>

          {/* Skills */}
          <div className="bg-white rounded-xl shadow-card border border-secondary-100 p-6">
            <h2 className="text-lg font-bold text-secondary-900 mb-4 flex items-center gap-2">
              <svg
                className="h-5 w-5 text-primary-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
              Skills Required
            </h2>
            <div className="flex flex-wrap gap-2">
              {job.skills.map((skill, index) => (
                <span
                  key={index}
                  className="px-3 py-1.5 bg-primary-50 text-primary-700 text-sm font-medium rounded-full border border-primary-200"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>

          {/* Wallet Connection Notice */}
          {!isConnected && (
            <div className="bg-white rounded-xl shadow-card border border-secondary-100 p-6 text-center">
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg
                  className="h-6 w-6 text-primary-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                  />
                </svg>
              </div>
              <p className="text-secondary-600 mb-4">
                Connect your wallet to interact with this job
              </p>
              <WalletButton />
            </div>
          )}

          {/* On-chain Contract Creation */}
          {isConnected && job.status === 'in_progress' && !contract && isOwner && (
            <div className="bg-white rounded-xl shadow-card border border-primary-200 p-6">
              <h2 className="text-lg font-bold text-secondary-900 mb-1 flex items-center gap-2">
                <svg
                  className="h-5 w-5 text-primary-600"
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
                Create On-Chain Contract
              </h2>
              <p className="text-sm text-secondary-500 mb-5">
                Define milestones for this job. Each milestone will be paid out when completed.
              </p>

              <div className="space-y-3 mb-4">
                <h3 className="text-sm font-semibold text-secondary-700">Milestones</h3>
                {milestones.map((milestone, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <span className="w-7 h-7 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-1">
                      {index + 1}
                    </span>
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="number"
                        placeholder="Amount (SOL)"
                        value={milestone.amount}
                        onChange={e => updateMilestone(index, 'amount', e.target.value)}
                        step="0.01"
                        min="0"
                        className="px-3 py-2 border border-secondary-200 rounded-lg text-sm text-secondary-900 placeholder:text-secondary-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                      <input
                        type="text"
                        placeholder="Description (e.g., Initial design mockups)"
                        value={milestone.description}
                        onChange={e => updateMilestone(index, 'description', e.target.value)}
                        className="sm:col-span-2 px-3 py-2 border border-secondary-200 rounded-lg text-sm text-secondary-900 placeholder:text-secondary-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                    {milestones.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeMilestone(index)}
                        className="mt-1 w-7 h-7 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors shrink-0"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addMilestone}
                  className="text-sm font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Add Milestone
                </button>
              </div>

              <div className="bg-secondary-50 rounded-lg p-3 mb-4 flex items-center justify-between">
                <span className="text-sm font-semibold text-secondary-700">
                  Total: {totalMilestoneAmount.toFixed(4)} SOL
                </span>
                {totalMilestoneAmount > job.price && (
                  <span className="text-xs font-medium text-red-600">
                    Exceeds budget of {job.price} SOL
                  </span>
                )}
              </div>

              {contractError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm flex items-start gap-2">
                  <svg
                    className="h-4 w-4 text-red-500 shrink-0 mt-0.5"
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
                  {contractError}
                </div>
              )}

              <button
                onClick={handleCreateOnchainContract}
                disabled={creatingContract || totalMilestoneAmount > job.price}
                className="w-full px-5 py-2.5 bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-colors text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {creatingContract && (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                )}
                {creatingContract ? 'Creating Contract...' : 'Create On-Chain Contract'}
              </button>
            </div>
          )}

          {/* Existing Contract */}
          {contract && (
            <div className="bg-white rounded-xl shadow-card border border-secondary-100 p-6 space-y-6">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-lg font-bold text-secondary-900 flex items-center gap-2">
                    <svg
                      className="h-5 w-5 text-primary-600"
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
                    Contract
                  </h2>
                  <span className="text-xs font-mono text-secondary-400">
                    ID: {contract.onChainJobId}
                  </span>
                </div>
              </div>

              {/* Milestones */}
              <div>
                <h3 className="text-sm font-semibold text-secondary-700 mb-3">Milestones</h3>
                {contractError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm flex items-start gap-2">
                    <svg
                      className="h-4 w-4 text-red-500 shrink-0 mt-0.5"
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
                    {contractError}
                  </div>
                )}
                <div className="space-y-3">
                  {contract.milestones.map((m, i) => (
                    <div
                      key={i}
                      className="border border-secondary-100 rounded-lg p-4 hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-xs font-bold">
                            {i + 1}
                          </span>
                          <span className="text-sm font-semibold text-secondary-900">
                            {(m.amount / 1_000_000_000).toFixed(4)} SOL
                          </span>
                        </div>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors[m.status] || 'bg-secondary-100 text-secondary-800 border-secondary-200'}`}
                        >
                          {m.status}
                        </span>
                      </div>
                      <p className="text-sm text-secondary-600 mb-3">{m.description}</p>

                      {/* Milestone Actions */}
                      {contract.status === 'funded' && walletSigner && (
                        <div className="space-y-2">
                          {/* Freelancer: Submit work */}
                          {isAssigned && m.status === 'pending' && (
                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="Submission hash (IPFS CID or link)"
                                value={submissionHash[i] || ''}
                                onChange={e =>
                                  setSubmissionHash(prev => ({ ...prev, [i]: e.target.value }))
                                }
                                className="flex-1 px-3 py-2 border border-secondary-200 rounded-lg text-sm placeholder:text-secondary-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                              />
                              <button
                                onClick={() => handleSubmitMilestone(i)}
                                disabled={milestoneOperationLoading === i}
                                className="px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 shrink-0"
                              >
                                {milestoneOperationLoading === i ? 'Submitting...' : 'Submit Work'}
                              </button>
                            </div>
                          )}

                          {/* Client: Approve */}
                          {isOwner && m.status === 'submitted' && (
                            <button
                              onClick={() => handleApproveMilestone(i)}
                              disabled={milestoneOperationLoading === i}
                              className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                            >
                              {milestoneOperationLoading === i
                                ? 'Approving...'
                                : 'Approve Milestone'}
                            </button>
                          )}

                          {/* Client: Release payment */}
                          {isOwner && m.status === 'approved' && (
                            <button
                              onClick={() => handleReleaseMilestone(i)}
                              disabled={milestoneOperationLoading === i}
                              className="px-4 py-2 bg-accent-600 hover:bg-accent-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                            >
                              {milestoneOperationLoading === i ? 'Releasing...' : 'Release Payment'}
                            </button>
                          )}

                          {/* Paid notice */}
                          {m.status === 'paid' && (
                            <div className="flex items-center gap-1.5 text-sm text-accent-700 font-medium">
                              <svg
                                className="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              </svg>
                              Payment released
                            </div>
                          )}

                          {/* Dispute button */}
                          {(m.status === 'submitted' || m.status === 'approved') &&
                            (isOwner || isAssigned) && (
                              <button
                                onClick={() => handleOpenDispute(i)}
                                disabled={milestoneOperationLoading === i}
                                className="px-4 py-2 border border-orange-300 text-orange-700 hover:bg-orange-50 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                              >
                                {milestoneOperationLoading === i ? 'Opening...' : 'Open Dispute'}
                              </button>
                            )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Dispute Section */}
              {contract.status === 'disputed' && walletSigner && (
                <div className="border-2 border-orange-200 bg-orange-50 rounded-lg p-5 space-y-4">
                  <h3 className="text-base font-bold text-orange-800 flex items-center gap-2">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                      />
                    </svg>
                    Dispute Active
                  </h3>
                  <p className="text-sm text-orange-700">
                    All milestone operations are paused until the dispute is resolved.
                  </p>

                  {/* Evidence Submission */}
                  <div>
                    <h4 className="text-sm font-semibold text-secondary-700 mb-1">
                      Submit Evidence
                    </h4>
                    <p className="text-xs text-secondary-500 mb-2">
                      Provide a link to your evidence (e.g., IPFS CID, Google Drive link)
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Evidence hash or link"
                        value={evidenceHash}
                        onChange={e => setEvidenceHash(e.target.value)}
                        className="flex-1 px-3 py-2 border border-secondary-200 rounded-lg text-sm placeholder:text-secondary-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                      />
                      <button
                        onClick={handleSubmitEvidence}
                        disabled={milestoneOperationLoading === -2 || !evidenceHash.trim()}
                        className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 shrink-0"
                      >
                        {milestoneOperationLoading === -2 ? 'Submitting...' : 'Submit Evidence'}
                      </button>
                    </div>
                  </div>

                  {/* Resolve Dispute (Admin/Arbitrator) */}
                  {userRole === 'admin' && (
                    <div className="border-t border-orange-200 pt-4">
                      <h4 className="text-sm font-semibold text-secondary-700 mb-2">
                        Resolve Dispute (Arbitrator)
                      </h4>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <select
                          value={resolveRuling}
                          onChange={e => setResolveRuling(e.target.value)}
                          className="flex-1 px-3 py-2 border border-secondary-200 rounded-lg text-sm text-secondary-900 focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                        >
                          <option value="none">-- Select Ruling --</option>
                          <option value="client_wins">Client Wins (Full Refund)</option>
                          <option value="freelancer_wins">Freelancer Wins (Full Payment)</option>
                          <option value="split">Split (50/50)</option>
                        </select>
                        <button
                          onClick={() => {
                            const disputedMilestone = contract.milestones.find(
                              m => m.status === 'disputed'
                            );
                            if (disputedMilestone) {
                              handleResolveDispute(disputedMilestone.milestoneId);
                            }
                          }}
                          disabled={milestoneOperationLoading === -3 || resolveRuling === 'none'}
                          className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 shrink-0"
                        >
                          {milestoneOperationLoading === -3 ? 'Resolving...' : 'Resolve Dispute'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Cancel Job */}
              {contract.status === 'funded' && isOwner && walletSigner && (
                <div className="border-t border-secondary-100 pt-4">
                  <button
                    onClick={handleCancelJob}
                    disabled={milestoneOperationLoading === -1}
                    className="px-4 py-2 border border-red-300 text-red-700 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {milestoneOperationLoading === -1 ? 'Cancelling...' : 'Cancel Job & Refund'}
                  </button>
                  <p className="text-xs text-secondary-400 mt-2">
                    Cancelling will refund remaining escrow balance. This cannot be undone.
                  </p>
                </div>
              )}

              {/* Fund Escrow */}
              {contract.status === 'created' && isOwner && (
                <div className="border-2 border-purple-200 bg-purple-50 rounded-lg p-5 space-y-4">
                  <h3 className="text-base font-bold text-purple-800 flex items-center gap-2">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Fund Escrow
                  </h3>
                  <p className="text-sm text-purple-700">
                    Fund the escrow to enable milestone payments.
                  </p>

                  <div className="bg-white rounded-lg p-3 space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-secondary-600">Total Required</span>
                      <span className="font-semibold text-secondary-900">
                        {(
                          contract.milestones.reduce((sum, m) => sum + m.amount, 0) /
                          LAMPORTS_PER_SOL
                        ).toFixed(4)}{' '}
                        SOL
                      </span>
                    </div>
                    {loadingBalance ? (
                      <div className="flex justify-between">
                        <span className="text-secondary-600">Your Balance</span>
                        <span className="text-secondary-400">Loading...</span>
                      </div>
                    ) : walletBalance !== null ? (
                      <div className="flex justify-between">
                        <span className="text-secondary-600">Your Balance</span>
                        <span
                          className={`font-semibold ${
                            walletBalance <
                            contract.milestones.reduce((sum, m) => sum + m.amount, 0) /
                              LAMPORTS_PER_SOL
                              ? 'text-red-600'
                              : 'text-secondary-900'
                          }`}
                        >
                          {walletBalance.toFixed(4)} SOL
                          {walletBalance <
                            contract.milestones.reduce((sum, m) => sum + m.amount, 0) /
                              LAMPORTS_PER_SOL && (
                            <span className="text-xs font-normal ml-1">(Insufficient)</span>
                          )}
                        </span>
                      </div>
                    ) : null}
                  </div>

                  {!walletSigner && (
                    <div className="text-center">
                      <p className="text-sm text-secondary-600 mb-3">
                        Please connect your wallet to fund the escrow.
                      </p>
                      <WalletButton />
                    </div>
                  )}

                  {contractError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                      {contractError}
                    </div>
                  )}

                  {walletSigner && (
                    <button
                      onClick={handleFundEscrow}
                      disabled={
                        creatingContract ||
                        loadingBalance ||
                        (walletBalance !== null &&
                          walletBalance <
                            contract.milestones.reduce((sum, m) => sum + m.amount, 0) /
                              LAMPORTS_PER_SOL)
                      }
                      className="w-full px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {creatingContract && (
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                      )}
                      {creatingContract ? 'Funding...' : 'Fund Escrow'}
                    </button>
                  )}

                  <p className="text-xs text-purple-600">
                    Funding will transfer the total amount to a secure escrow on Solana. Funds are
                    released as milestones are completed.
                  </p>
                </div>
              )}

              {/* Transaction History */}
              {contract.transactions.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-secondary-700 mb-3">
                    Transaction History
                  </h3>
                  <div className="space-y-2">
                    {contract.transactions.map((tx, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between py-2 border-b border-secondary-50 last:border-0"
                      >
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            tx.type === 'fund'
                              ? 'bg-purple-100 text-purple-700'
                              : tx.type === 'release'
                                ? 'bg-green-100 text-green-700'
                                : tx.type === 'cancel'
                                  ? 'bg-red-100 text-red-700'
                                  : tx.type === 'dispute'
                                    ? 'bg-orange-100 text-orange-700'
                                    : 'bg-secondary-100 text-secondary-700'
                          }`}
                        >
                          {tx.type}
                        </span>
                        <a
                          href={`https://explorer.solana.com/tx/${tx.signature}?cluster=devnet`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-mono text-primary-600 hover:text-primary-700 flex items-center gap-1"
                        >
                          {tx.signature.slice(0, 8)}...{tx.signature.slice(-8)}
                          <svg
                            className="h-3 w-3"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                            />
                          </svg>
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Submit Proposal (Freelancer) */}
          {isConnected && userRole === 'freelancer' && job.status === 'open' && !hasProposed && (
            <div className="bg-white rounded-xl shadow-card border border-secondary-100 p-6">
              <h2 className="text-lg font-bold text-secondary-900 mb-4 flex items-center gap-2">
                <svg
                  className="h-5 w-5 text-primary-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                Submit a Proposal
              </h2>

              {proposalSuccess ? (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Your proposal has been submitted successfully!
                </div>
              ) : (
                <form onSubmit={handleSubmit(onProposalSubmit)} className="space-y-4">
                  <div>
                    <label
                      htmlFor="proposalText"
                      className="block text-sm font-medium text-secondary-700 mb-1.5"
                    >
                      Your Proposal
                    </label>
                    <textarea
                      id="proposalText"
                      placeholder="Describe how you can help with this project..."
                      rows={5}
                      {...register('proposalText')}
                      className="w-full px-4 py-2.5 border border-secondary-200 rounded-lg text-secondary-900 placeholder:text-secondary-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                    />
                    {errors.proposalText && (
                      <p className="text-red-500 text-sm mt-1">{errors.proposalText.message}</p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="proposalPrice"
                      className="block text-sm font-medium text-secondary-700 mb-1.5"
                    >
                      Your Price (SOL)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        id="proposalPrice"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        {...register('proposalPrice')}
                        className="w-full px-4 py-2.5 pr-14 border border-secondary-200 rounded-lg text-secondary-900 placeholder:text-secondary-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-secondary-400">
                        SOL
                      </span>
                    </div>
                    {errors.proposalPrice && (
                      <p className="text-red-500 text-sm mt-1">{errors.proposalPrice.message}</p>
                    )}
                  </div>

                  {errors.root && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                      {errors.root.message}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submittingProposal}
                    className="w-full px-5 py-2.5 bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-colors text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {submittingProposal && (
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                    )}
                    {submittingProposal ? 'Submitting...' : 'Submit Proposal'}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-6">
          {/* Client Info */}
          <div className="bg-white rounded-xl shadow-card border border-secondary-100 p-6">
            <h2 className="text-lg font-bold text-secondary-900 mb-4 flex items-center gap-2">
              <svg
                className="h-5 w-5 text-primary-600"
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
              About the Client
            </h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-sm font-bold text-primary-700">
                  {job.client.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-secondary-900">{job.client.username}</p>
                  <p className="text-xs font-mono text-secondary-400">
                    {job.client.walletAddress.slice(0, 6)}...{job.client.walletAddress.slice(-6)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Assigned Freelancer */}
          {job.assignedTo && (
            <div className="bg-white rounded-xl shadow-card border border-secondary-100 p-6">
              <h2 className="text-lg font-bold text-secondary-900 mb-4 flex items-center gap-2">
                <svg
                  className="h-5 w-5 text-accent-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Assigned Freelancer
              </h2>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-accent-100 rounded-full flex items-center justify-center text-sm font-bold text-accent-700">
                  {job.assignedTo.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-secondary-900">
                    {job.assignedTo.username}
                  </p>
                  <p className="text-xs font-mono text-secondary-400">
                    {job.assignedTo.walletAddress.slice(0, 6)}...
                    {job.assignedTo.walletAddress.slice(-6)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Proposals (Public) */}
          {job.proposals.length > 0 && (
            <div className="bg-white rounded-xl shadow-card border border-secondary-100 p-6">
              <h2 className="text-lg font-bold text-secondary-900 mb-4 flex items-center gap-2">
                <svg
                  className="h-5 w-5 text-primary-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"
                  />
                </svg>
                Proposals
                <span className="ml-auto text-sm font-normal text-secondary-500">
                  {job.proposals.length}
                </span>
              </h2>
              <div className="space-y-4">
                {job.proposals.map(proposal => (
                  <div key={proposal._id} className="border border-secondary-100 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-secondary-900">
                        {proposal.freelancer.username}
                      </span>
                      <span className="text-sm font-bold text-primary-600">
                        {proposal.price} SOL
                      </span>
                    </div>
                    {proposal.freelancer.rating > 0 && (
                      <div className="flex items-center gap-1 mb-2">
                        <span className="text-amber-400 text-xs">
                          {'★'.repeat(Math.round(proposal.freelancer.rating))}
                          {'☆'.repeat(5 - Math.round(proposal.freelancer.rating))}
                        </span>
                        <span className="text-xs text-secondary-400">
                          {proposal.freelancer.rating.toFixed(1)}
                        </span>
                      </div>
                    )}
                    <p className="text-sm text-secondary-600 mb-3 line-clamp-3">
                      {proposal.proposal}
                    </p>
                    <div>
                      {isOwner && job.status === 'open' && proposal.status === 'pending' && (
                        <button
                          onClick={() => handleAcceptProposal(proposal._id)}
                          className="w-full px-4 py-2 bg-accent-600 hover:bg-accent-500 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                          Accept Proposal
                        </button>
                      )}
                      {proposal.status !== 'pending' && (
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColors[proposal.status] || 'bg-secondary-100 text-secondary-800 border-secondary-200'}`}
                        >
                          {proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default JobDetail;
