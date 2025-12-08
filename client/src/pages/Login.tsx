import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import api from "../utils/api";
import axios from "axios";

interface FormErrors {
  email?: string;
  password?: string;
  general?: string;
}

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { connected, publicKey } = useWallet();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [walletMessage, setWalletMessage] = useState("");
  const [apiError, setApiError] = useState("");

  // Check if wallet is connected
  useEffect(() => {
    if (connected && publicKey) {
      const shortAddress = `${publicKey.toString().slice(0, 4)}...${publicKey
        .toString()
        .slice(-4)}`;
      setWalletMessage(`Wallet connected: ${shortAddress}`);
      setErrors((prev) => ({ ...prev, general: "" }));
    } else {
      setWalletMessage("");
    }
  }, [connected, publicKey]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
      if (errors[name as keyof FormErrors]) {
        setErrors((prev) => ({
          ...prev,
          [name]: undefined,
        }));
      }
    },
    [errors]
  );

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setApiError("");
    setErrors({});

    // Check wallet connection first
    if (!connected || !publicKey) {
      setErrors({
        general: "Please connect your Solana wallet before logging in",
      });
      return;
    }

    // validate before submission
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await api.post("/api/users/login", {
        email: formData.email.toLowerCase().trim(),
        password: formData.password,
      });

      // Validate response structure
      if (!response.data.token || !response.data.walletAddress) {
        setApiError("Invalid response from server. Please try again.");
        return;
      }

      // Verify if the wallet address matches
      const connectedWallet = publicKey.toString();
      if (response.data.walletAddress !== connectedWallet) {
        setApiError(
          "The connected wallet does not match your account wallet. Please disconnect and connect the correct wallet."
        );
        return;
      }

      // Save authentication data
      localStorage.setItem("token", response.data.token);
      localStorage.setItem("userInfo", JSON.stringify(response.data));

      // Dispatch auth change event for Navbar update
      window.dispatchEvent(new Event("auth-change"));

      // Navigate to dashboard
      navigate("/dashboard", { replace: true });
    } catch (error) {
      console.error("Login error:", error);

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          setApiError("Invalid email or password");
        } else if (error.response?.status === 404) {
          setApiError("User not found. Please register first.");
        } else if (error.response?.status === 500) {
          setApiError("Server error. Please try again later.");
        } else {
          setApiError(
            error.response?.data?.message ||
              "Login failed. Please try again."
          );
        }
      } else if (error instanceof Error) {
        setApiError(error.message || "An unexpected error occurred");
      } else {
        setApiError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-secondary-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-primary-800">
          Login to Your Account
        </h2>
        <p className="mt-2 text-center text-sm text-secondary-600">
          Connect your wallet and sign in to continue
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-card sm:rounded-xl sm:px-10">
          {/* Wallet Connection Section */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-secondary-800 mb-2">
              Connect Your Solana Wallet
            </h3>
            <p className="text-sm text-secondary-600 mb-4">
              You need to connect your wallet to log in
            </p>

            <div className="flex justify-center mb-4">
              <WalletMultiButton className="!bg-primary-600 hover:!bg-primary-700 !rounded-lg !h-12 !text-base !font-medium" />
            </div>

            {walletMessage && (
              <div className="bg-accent-50 border border-accent-200 rounded-lg p-3 text-accent-700 flex items-center">
                <svg
                  className="h-5 w-5 mr-2 text-accent-500 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span className="text-sm font-medium">{walletMessage}</span>
              </div>
            )}
          </div>

          <div className="border-t border-secondary-200 pt-6">
            {/* General Error Message */}
            {(apiError || errors.general) && (
              <div
                className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start"
                role="alert"
              >
                <svg
                  className="h-5 w-5 mr-2 text-red-500 flex-shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>{apiError || errors.general}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-secondary-700 mb-1"
                >
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  disabled={isSubmitting}
                  className={`w-full px-3 py-2 border rounded-lg shadow-sm placeholder-secondary-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 disabled:bg-secondary-50 disabled:text-secondary-500 disabled:cursor-not-allowed ${
                    errors.email
                      ? "border-red-300 text-red-900"
                      : "border-secondary-300"
                  }`}
                  autoComplete="email"
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-secondary-700 mb-1"
                >
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  disabled={isSubmitting}
                  className={`w-full px-3 py-2 border rounded-lg shadow-sm placeholder-secondary-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 disabled:bg-secondary-50 disabled:text-secondary-500 disabled:cursor-not-allowed ${
                    errors.password
                      ? "border-red-300 text-red-900"
                      : "border-secondary-300"
                  }`}
                  autoComplete="current-password"
                />
                {errors.password && (
                  <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !connected}
                className={`w-full py-2 px-4 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center ${
                  connected && !isSubmitting
                    ? "bg-primary-600 text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                    : "bg-secondary-300 text-secondary-500 cursor-not-allowed"
                }`}
                aria-busy={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
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
                    <span>Logging in...</span>
                  </>
                ) : (
                  <span>Login</span>
                )}
              </button>
            </form>

            <div className="mt-6 text-center text-sm">
              <span className="text-secondary-600">Don't have an account?</span>{" "}
              <Link
                to="/register"
                className="font-medium text-primary-600 hover:text-primary-700 focus:outline-none focus:underline"
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