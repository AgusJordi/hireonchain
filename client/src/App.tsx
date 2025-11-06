import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  TorusWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import JobList from "./pages/JobList";
import JobDetail from "./pages/JobDetail";
import CreateJob from "./pages/CreateJob";
import Profile from "./pages/Profile";
import Navbar from "./components/Navbar";
import PrivateRoute from "./components/PrivateRoute";
import "./App.css";

// Import wallet adapter styles
import "@solana/wallet-adapter-react-ui/styles.css";

function App() {
  // Set up Solana network connection (devnet for testing)
  const network = WalletAdapterNetwork.Devnet;
  const endpoint = clusterApiUrl(network);

  // Initialize wallet adapters
  const wallets = [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
    new TorusWalletAdapter(),
  ];

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <Router>
            <div className="app">
              <Navbar />
              <main className="app-content">
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
              </main>
            </div>
          </Router>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default App;
