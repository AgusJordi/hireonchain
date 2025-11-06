import React from "react";
import { Navigate } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";

interface PrivateRouteProps {
  children: React.ReactNode;
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children }) => {
  const { connected } = useWallet();
  const token = localStorage.getItem("token");

  // Require both JWT token and wallet connection
  if (!token || !connected) {
    return <Navigate to="/login" />;
  }

  return <>{children}</>;
};

export default PrivateRoute;
