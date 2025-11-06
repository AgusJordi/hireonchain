import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import axios from "axios";

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { connected, publicKey } = useWallet();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [walletMessage, setWalletMessage] = useState("");

  // Check if wallet is connected
  useEffect(() => {
    if (connected && publicKey) {
      setWalletMessage(
        `Wallet connected: ${publicKey.toString().slice(0, 4)}...${publicKey
          .toString()
          .slice(-4)}`
      );
    } else {
      setWalletMessage("");
    }
  }, [connected, publicKey]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!connected) {
      setError("Please connect your wallet before logging in");
      return;
    }

    if (!formData.email || !formData.password) {
      setError("Please fill in all fields");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await axios.post("/api/users/login", formData);

      // Verify if the wallet address matches
      if (publicKey && response.data.walletAddress !== publicKey.toString()) {
        setError(
          "The connected wallet does not match your account wallet. Please connect the correct wallet."
        );
        setIsSubmitting(false);
        return;
      }

      // Save token and user info to localStorage
      localStorage.setItem("token", response.data.token);
      localStorage.setItem("userInfo", JSON.stringify(response.data));

      navigate("/dashboard");
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        setError(
          error.response.data.message || "Login failed. Please try again."
        );
      } else {
        setError("Login failed. Please try again.");
      }
    }

    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-secondary-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-primary-800">
          Login to Your Account
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-card sm:rounded-xl sm:px-10">
          <div className="mb-6">
            <h3 className="text-lg font-medium text-secondary-800 mb-2">
              Connect your Solana wallet
            </h3>
            <p className="text-sm text-secondary-600 mb-4">
              You need to connect your wallet to login
            </p>

            <div className="flex justify-center mb-4">
              <WalletMultiButton className="!bg-primary-600 hover:!bg-primary-700 !rounded-lg !h-12 !text-base !font-medium" />
            </div>

            {walletMessage && (
              <div className="bg-accent-50 border border-accent-200 rounded-lg p-3 text-accent-700 flex items-center">
                <svg
                  className="h-5 w-5 mr-2 text-accent-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                {walletMessage}
              </div>
            )}
          </div>

          <div className="border-t border-secondary-200 pt-6">
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="form-label">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Enter your email"
                  className="input"
                />
              </div>

              <div>
                <label htmlFor="password" className="form-label">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  className="input"
                />
              </div>

              <div>
                <button
                  type="submit"
                  className={`w-full btn ${
                    connected
                      ? "btn-primary"
                      : "bg-secondary-300 text-secondary-500 cursor-not-allowed"
                  }`}
                  disabled={isSubmitting || !connected}
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center">
                      <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
                      Logging in...
                    </span>
                  ) : (
                    "Login"
                  )}
                </button>
              </div>
            </form>

            <div className="mt-6 text-center text-sm">
              <span className="text-secondary-600">Don't have an account?</span>{" "}
              <Link
                to="/register"
                className="font-medium text-primary-600 hover:text-primary-700"
              >
                Register
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
