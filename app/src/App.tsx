import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Temp page and layout components
import { Toaster } from 'react-hot-toast';
import { ScrollToTop } from './components/ScrollToTop';
import { Layout } from './layout';
import { Loading } from './components/Loading';
import { AuthProvider } from './contexts/AuthProvider';
import { ReownProvider } from './contexts/AppKitProvider';
import PrivateRoute from './components/PrivateRoute';
import { createAppKit } from '@reown/appkit/react';
import { solanaDevnet } from '@reown/appkit/networks';
import { SolanaAdapter } from '@reown/appkit-adapter-solana/react';

// Lazy load to optimize
const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const JobList = lazy(() => import('./pages/JobList'));
const JobDetail = lazy(() => import('./pages/JobDetail'));
const CreateJob = lazy(() => import('./pages/CreateJob'));
const Profile = lazy(() => import('./pages/Profile'));

const solanaWeb3JsAdapter = new SolanaAdapter();
const projectId = import.meta.env.VITE_PROJECT_ID as string;

const metadata = {
  name: 'Solana Freelance',
  description: 'Connect, Work, and Get Paid with Crypto',
  url: 'https://sol-marketplace-1.vercel.app', // origin must match your domain & subdomain
  icons: ['https://sol-marketplace-1.vercel.app/sol.png'],
};

createAppKit({
  adapters: [solanaWeb3JsAdapter],
  networks: [solanaDevnet],
  metadata: metadata,
  projectId,
  features: {
    analytics: false,
  },
});

function App() {
  return (
    <ReownProvider>
      <AuthProvider>
        <Router>
          <Layout>
            <Suspense fallback={<Loading />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />

                {/* Private routes that require authentication */}
                <Route
                  path="/dashboard"
                  element={
                    <PrivateRoute>
                      <Dashboard />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <PrivateRoute>
                      <Profile />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/jobs/create"
                  element={
                    <PrivateRoute>
                      <CreateJob />
                    </PrivateRoute>
                  }
                />
                <Route path="/jobs" element={<JobList />} />
                <Route
                  path="/jobs/:id"
                  element={
                    <PrivateRoute>
                      <JobDetail />
                    </PrivateRoute>
                  }
                />

                {/* Fallback route */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
            <ScrollToTop />
          </Layout>
        </Router>
      </AuthProvider>
      <Toaster position="top-center" />
    </ReownProvider>
  );
}

export default App;
