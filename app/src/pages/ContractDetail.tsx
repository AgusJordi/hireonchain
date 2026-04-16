import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../utils/api';
import toast from 'react-hot-toast';

type ContractStatus =
  | 'pending'
  | 'created'
  | 'funded'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'disputed';

interface ContractApiMilestone {
  milestoneId: number;
  amount: number; // lamports
  description: string;
  status: string;
}

interface ContractApiResponse {
  _id: string;
  jobId: { _id: string; title?: string } | string;
  onChainJobId?: number;
  status: ContractStatus | string;
  clientWallet?: string;
  freelancerWallet?: string;
  totalAmount?: number; // lamports
  milestones: ContractApiMilestone[];
  transactions?: { type: string; signature: string; timestamp?: string }[];
  createdAt?: string;
}

const statusBadge: Record<string, string> = {
  pending: 'bg-secondary-100 text-secondary-800 border-secondary-200',
  created: 'bg-secondary-100 text-secondary-700 border-secondary-200',
  funded: 'bg-purple-100 text-purple-800 border-purple-200',
  in_progress: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  completed: 'bg-green-100 text-green-800 border-green-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
  disputed: 'bg-orange-100 text-orange-800 border-orange-200',
};

function shortPk(value?: string) {
  if (!value) return 'N/A';
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-6)}`;
}

export default function ContractDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [contract, setContract] = useState<ContractApiResponse | null>(null);
  const [error, setError] = useState<string>('');

  const jobId = useMemo(() => {
    if (!contract) return null;
    return typeof contract.jobId === 'string' ? contract.jobId : contract.jobId._id;
  }, [contract]);

  useEffect(() => {
    const run = async () => {
      if (!id) return;
      setLoading(true);
      setError('');
      try {
        const res = await api.get<ContractApiResponse>(`/api/contracts/${id}`);
        setContract(res.data);
      } catch (e) {
        console.error(e);
        setContract(null);
        setError('No se pudo cargar el contrato. Revisá que estés logueado y que el contrato exista.');
        toast.error('No se pudo cargar el contrato');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="bg-white rounded-xl shadow-card border border-secondary-100 p-6">
          <p className="text-secondary-600 text-sm">Cargando contrato...</p>
        </div>
      </div>
    );
  }

  if (!contract || error) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg">
          <p className="font-semibold">Error</p>
          <p className="mt-1 text-sm">{error || 'Contrato no encontrado'}</p>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-500"
              onClick={() => navigate('/dashboard')}
            >
              Volver al dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const totalSol = (contract.totalAmount ?? 0) / 1_000_000_000;
  const jobTitle = typeof contract.jobId === 'string' ? 'Job' : contract.jobId.title || 'Job';
  const badge = statusBadge[String(contract.status)] || statusBadge.pending;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Manage Contract</h1>
          <p className="text-sm text-secondary-500 mt-1">
            {jobId ? (
              <>
                Job:{' '}
                <Link className="text-primary-600 hover:text-primary-700 font-medium" to={`/jobs/${jobId}`}>
                  {jobTitle}
                </Link>
              </>
            ) : (
              <>Job: {jobTitle}</>
            )}
          </p>
        </div>
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${badge}`}>
          {String(contract.status).replace('_', ' ')}
        </span>
      </div>

      <div className="bg-white rounded-xl shadow-card border border-secondary-100 p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wide">Contract ID</p>
            <p className="mt-1 text-sm font-mono text-secondary-800">{contract._id}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wide">On-chain Job ID</p>
            <p className="mt-1 text-sm text-secondary-800">{contract.onChainJobId ?? 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wide">Total</p>
            <p className="mt-1 text-sm font-semibold text-secondary-900">{totalSol.toFixed(4)} SOL</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-lg border border-secondary-100 p-4">
            <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wide">Client wallet</p>
            <p className="mt-1 text-sm font-mono text-secondary-800">{shortPk(contract.clientWallet)}</p>
          </div>
          <div className="rounded-lg border border-secondary-100 p-4">
            <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wide">Freelancer wallet</p>
            <p className="mt-1 text-sm font-mono text-secondary-800">{shortPk(contract.freelancerWallet)}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-card border border-secondary-100 p-6">
        <h2 className="text-lg font-bold text-secondary-900">Milestones</h2>
        <div className="mt-4 space-y-3">
          {contract.milestones?.length ? (
            contract.milestones.map((m) => (
              <div key={m.milestoneId} className="border border-secondary-100 rounded-lg p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-xs font-bold">
                      {m.milestoneId + 1}
                    </span>
                    <span className="text-sm font-semibold text-secondary-900">
                      {(m.amount / 1_000_000_000).toFixed(4)} SOL
                    </span>
                  </div>
                  <span className="text-xs font-medium text-secondary-600">{m.status}</span>
                </div>
                <p className="mt-2 text-sm text-secondary-600">{m.description}</p>
              </div>
            ))
          ) : (
            <div className="bg-secondary-50 border border-secondary-100 rounded-lg p-4">
              <p className="text-sm text-secondary-600">No hay milestones cargados en este contrato.</p>
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {jobId && (
            <Link
              to={`/jobs/${jobId}`}
              className="px-4 py-2 rounded-lg border border-secondary-200 text-secondary-800 text-sm font-semibold hover:bg-secondary-50"
            >
              Ver Job
            </Link>
          )}
          <Link
            to="/dashboard"
            className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-500"
          >
            Volver
          </Link>
        </div>
      </div>
    </div>
  );
}

