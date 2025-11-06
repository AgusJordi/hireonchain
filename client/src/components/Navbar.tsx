import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import WalletConnect from "./WalletConnect";

const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const { connected } = useWallet();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    setIsLoggedIn(!!localStorage.getItem("token"));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userInfo");
    setIsLoggedIn(false);
    navigate("/login");
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <nav className="bg-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex-shrink-0 flex items-center">
              <span className="text-primary-600 font-bold text-xl">
                Solana Freelance
              </span>
            </Link>
          </div>

          {/* Desktop menu */}
          <div className="hidden md:flex md:items-center md:space-x-4">
            <Link
              to="/"
              className="text-secondary-600 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium"
            >
              Home
            </Link>
            <Link
              to="/jobs"
              className="text-secondary-600 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium"
            >
              Jobs
            </Link>

            {isLoggedIn ? (
              <>
                <Link
                  to="/dashboard"
                  className="text-secondary-600 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Dashboard
                </Link>
                <Link
                  to="/profile"
                  className="text-secondary-600 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Profile
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-secondary-600 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-secondary-600 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="text-secondary-600 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Register
                </Link>
              </>
            )}

            <div className="ml-4">
              <WalletConnect />
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={toggleMobileMenu}
              className="inline-flex items-center justify-center p-2 rounded-md text-secondary-400 hover:text-primary-600 hover:bg-secondary-100 focus:outline-none"
            >
              <svg
                className={`${isMobileMenuOpen ? "hidden" : "block"} h-6 w-6`}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
              <svg
                className={`${isMobileMenuOpen ? "block" : "hidden"} h-6 w-6`}
                xmlns="http://www.w3.org/2000/svg"
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
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div className={`${isMobileMenuOpen ? "block" : "hidden"} md:hidden`}>
        <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
          <Link
            to="/"
            className="block text-secondary-600 hover:text-primary-600 px-3 py-2 rounded-md text-base font-medium"
          >
            Home
          </Link>
          <Link
            to="/jobs"
            className="block text-secondary-600 hover:text-primary-600 px-3 py-2 rounded-md text-base font-medium"
          >
            Jobs
          </Link>

          {isLoggedIn ? (
            <>
              <Link
                to="/dashboard"
                className="block text-secondary-600 hover:text-primary-600 px-3 py-2 rounded-md text-base font-medium"
              >
                Dashboard
              </Link>
              <Link
                to="/profile"
                className="block text-secondary-600 hover:text-primary-600 px-3 py-2 rounded-md text-base font-medium"
              >
                Profile
              </Link>
              <button
                onClick={handleLogout}
                className="block w-full text-left text-secondary-600 hover:text-primary-600 px-3 py-2 rounded-md text-base font-medium"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="block text-secondary-600 hover:text-primary-600 px-3 py-2 rounded-md text-base font-medium"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="block text-secondary-600 hover:text-primary-600 px-3 py-2 rounded-md text-base font-medium"
              >
                Register
              </Link>
            </>
          )}

          <div className="mt-4 px-3">
            <WalletConnect />
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
