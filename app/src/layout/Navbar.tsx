import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useWalletAuth } from '../hooks/useWalletAuth';
import { WalletButton } from '../components/WalletButton';

const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isAuthenticated, logout } = useWalletAuth();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <>
      <nav className="hidden md:flex bg-primary-50 shadow-lg mb-12">
        <div className="w-screen px-4 sm:px-6 lg:px-8 flex justify-between h-16">
          <NavLink
            to="/"
            className="text-primary-600 font-bold text-xl shrink-0 flex items-center hover:text-primary-500"
          >
            Solana Freelance
          </NavLink>

          {/* Desktop menu */}
          <div className="hidden md:flex md:items-center md:space-x-4 w-screen justify-end">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `px-3 py-2 rounded-md font-semibold ${
                  isActive
                    ? 'text-primary-600 bg-primary-100'
                    : 'text-secondary-600 hover:text-primary-600'
                }`
              }
            >
              Home
            </NavLink>
            <NavLink
              to="/jobs"
              className={({ isActive }) =>
                `px-3 py-2 rounded-md font-semibold ${
                  isActive
                    ? 'text-primary-600 bg-primary-100'
                    : 'text-secondary-600 hover:text-primary-600'
                }`
              }
            >
              Jobs
            </NavLink>

            {isAuthenticated ? (
              <>
                <NavLink
                  to="/dashboard"
                  className={({ isActive }) =>
                    `px-3 py-2 rounded-md font-semibold ${
                      isActive
                        ? 'text-primary-600 bg-primary-100'
                        : 'text-secondary-600 hover:text-primary-600'
                    }`
                  }
                >
                  Dashboard
                </NavLink>
                <NavLink
                  to="/profile"
                  className={({ isActive }) =>
                    `px-3 py-2 rounded-md font-semibold ${
                      isActive
                        ? 'text-primary-600 bg-primary-100'
                        : 'text-secondary-600 hover:text-primary-600'
                    }`
                  }
                >
                  Profile
                </NavLink>
                <button
                  onClick={handleLogout}
                  className="text-secondary-600 hover:text-primary-600 px-3 py-2 rounded-md font-semibold"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <NavLink
                  to="/login"
                  className={({ isActive }) =>
                    `px-3 py-2 rounded-md font-semibold ${
                      isActive
                        ? 'text-primary-600 bg-primary-100'
                        : 'text-secondary-600 hover:text-primary-600'
                    }`
                  }
                >
                  Login
                </NavLink>
                <NavLink
                  to="/register"
                  className={({ isActive }) =>
                    `px-3 py-2 rounded-md font-semibold ${
                      isActive
                        ? 'text-primary-600 bg-primary-100'
                        : 'text-secondary-600 hover:text-primary-600'
                    }`
                  }
                >
                  Register
                </NavLink>
              </>
            )}

            <WalletButton />
          </div>
        </div>
      </nav>

      {/* Mobile menu */}
      <nav>
        <div className="bg-primary-50 shadow-lg mb-12">
          {/* Mobile Header Bar */}
          <div className="flex items-center justify-between px-4 py-3 md:hidden">
            <NavLink to="/" className="text-primary-600 font-bold text-xl hover:text-primary-500">
              Solana Freelance
            </NavLink>

            {/* Hamburger Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-md text-gray-600 hover:text-primary-600 hover:bg-gray-100 focus:outline-none"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {isMobileMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>

          {/* Mobile Menu Items */}
          <div
            className={`${
              isMobileMenuOpen ? 'block' : 'hidden'
            } md:hidden px-2 pt-2 pb-3 space-y-1 border-t border-gray-200`}
          >
            <NavLink
              to="/"
              className={({ isActive }) =>
                `block px-3 py-2 rounded-md text-base font-semibold ${
                  isActive
                    ? 'text-primary-600 bg-primary-100'
                    : 'text-secondary-600 hover:text-primary-600'
                }`
              }
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Home
            </NavLink>
            <NavLink
              to="/jobs"
              className={({ isActive }) =>
                `block px-3 py-2 rounded-md text-base font-semibold ${
                  isActive
                    ? 'text-primary-600 bg-primary-100'
                    : 'text-secondary-600 hover:text-primary-600'
                }`
              }
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Jobs
            </NavLink>
            {isAuthenticated ? (
              <>
                <NavLink
                  to="/dashboard"
                  className={({ isActive }) =>
                    `block px-3 py-2 rounded-md text-base font-semibold ${
                      isActive
                        ? 'text-primary-600 bg-primary-100'
                        : 'text-secondary-600 hover:text-primary-600'
                    }`
                  }
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Dashboard
                </NavLink>
                <NavLink
                  to="/profile"
                  className={({ isActive }) =>
                    `block px-3 py-2 rounded-md text-base font-semibold ${
                      isActive
                        ? 'text-primary-600 bg-primary-100'
                        : 'text-secondary-600 hover:text-primary-600'
                    }`
                  }
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Profile
                </NavLink>
                <button
                  onClick={() => {
                    handleLogout();
                    setIsMobileMenuOpen(false);
                  }}
                  className="block w-full text-left text-secondary-600 hover:text-primary-600 px-3 py-2 rounded-md text-base font-semibold"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <NavLink
                  to="/login"
                  className={({ isActive }) =>
                    `block px-3 py-2 rounded-md text-base font-semibold ${
                      isActive
                        ? 'text-primary-600 bg-primary-100'
                        : 'text-secondary-600 hover:text-primary-600'
                    }`
                  }
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Login
                </NavLink>
                <NavLink
                  to="/register"
                  className={({ isActive }) =>
                    `block px-3 py-2 rounded-md text-base font-semibold ${
                      isActive
                        ? 'text-primary-600 bg-primary-100'
                        : 'text-secondary-600 hover:text-primary-600'
                    }`
                  }
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Register
                </NavLink>
              </>
            )}
            <div className="pt-4 px-3 border-t border-gray-200 mt-2">
              <WalletButton />
            </div>
          </div>
        </div>
      </nav>
    </>
  );
};

export default Navbar;
