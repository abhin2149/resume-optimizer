import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FileText, Home, Info, Briefcase, BarChart3, User, LogOut, Coins } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import AuthModal from '../AuthModal';

const Header = () => {
  const location = useLocation();
  const { isAuthenticated, user, logout, loading } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const isActive = (path) => {
    return location.pathname === path;
  };

  const navItems = [
    { path: '/', icon: Home, label: 'Home' },
    { path: '/tailor', icon: Briefcase, label: 'Tailor Resume' },
    { path: '/dashboard', icon: BarChart3, label: 'Dashboard' },
    { path: '/about', icon: Info, label: 'About' },
  ];

  const handleLogout = async () => {
    await logout();
    setUserDropdownOpen(false);
  };

  return (
    <header className="bg-gray-900/95 backdrop-blur-lg shadow-2xl border-b border-gray-700/50 sticky top-0 z-50">
      <div className="container-responsive">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-blue-500/25 transition-all duration-300 group-hover:scale-105">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors duration-300">
              Resume Builder
            </span>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-2">
            {navItems.map(({ path, icon: Icon, label }) => (
              <Link
                key={path}
                to={path}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 relative overflow-hidden group ${
                  isActive(path)
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800/50'
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600/0 via-blue-600/10 to-blue-600/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <Icon className="h-4 w-4 relative z-10" />
                <span className="relative z-10">{label}</span>
              </Link>
            ))}
          </nav>

          {/* Auth Section */}
          <div className="flex items-center space-x-4">
            {!loading && (
              <>
                {isAuthenticated ? (
                  <div className="flex items-center space-x-4">
                    {/* Credits Display */}
                    <div className="hidden sm:flex items-center space-x-2 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 px-3 py-1.5 rounded-lg border border-yellow-500/30">
                      <Coins className="h-4 w-4 text-yellow-400" />
                      <span className="text-yellow-300 font-medium text-sm">
                        {user?.credits || 0} credits
                      </span>
                    </div>

                    {/* User Dropdown */}
                    <div className="relative">
                      <button
                        onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                        className="flex items-center space-x-2 p-2 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800/50 transition-all duration-300"
                      >
                        {user?.avatarUrl ? (
                          <img 
                            src={user.avatarUrl} 
                            alt="Profile" 
                            className="h-8 w-8 rounded-full border-2 border-gray-600"
                          />
                        ) : (
                          <div className="h-8 w-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                            <User className="h-4 w-4 text-white" />
                          </div>
                        )}
                        <span className="hidden md:block text-sm font-medium">
                          {user?.name || 'User'}
                        </span>
                      </button>

                      {/* Dropdown Menu */}
                      {userDropdownOpen && (
                        <div className="absolute right-0 mt-2 w-64 bg-gray-800 rounded-lg shadow-xl border border-gray-700 z-50">
                          <div className="p-4 border-b border-gray-700">
                            <div className="flex items-center space-x-3">
                              {user?.avatarUrl ? (
                                <img 
                                  src={user.avatarUrl} 
                                  alt="Profile" 
                                  className="h-10 w-10 rounded-full"
                                />
                              ) : (
                                <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                                  <User className="h-5 w-5 text-white" />
                                </div>
                              )}
                              <div>
                                <p className="text-white font-medium">{user?.name}</p>
                                <p className="text-gray-400 text-sm">{user?.email}</p>
                              </div>
                            </div>
                            <div className="mt-3 flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <Coins className="h-4 w-4 text-yellow-400" />
                                <span className="text-yellow-300 font-medium">
                                  {user?.credits || 0} credits
                                </span>
                              </div>
                              {user?.email?.includes('.edu') && (
                                <span className="bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded-full">
                                  .edu
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="p-2">
                            <Link
                              to="/dashboard"
                              className="flex items-center space-x-2 w-full px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-700/50 rounded-md transition-all duration-200"
                              onClick={() => setUserDropdownOpen(false)}
                            >
                              <BarChart3 className="h-4 w-4" />
                              <span>Dashboard</span>
                            </Link>
                            <button
                              onClick={handleLogout}
                              className="flex items-center space-x-2 w-full px-3 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-md transition-all duration-200"
                            >
                              <LogOut className="h-4 w-4" />
                              <span>Sign Out</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => setAuthModalOpen(true)}
                      className="text-gray-300 hover:text-white text-sm font-medium transition-all duration-300"
                    >
                      Sign In
                    </button>
                    <button
                      onClick={() => setAuthModalOpen(true)}
                      className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-blue-500/25"
                    >
                      Get Started
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Mobile navigation */}
        <div className="md:hidden border-t border-gray-700/50 py-4">
          <nav className="flex flex-col space-y-2">
            {navItems.map(({ path, icon: Icon, label }) => (
              <Link
                key={path}
                to={path}
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-300 ${
                  isActive(path)
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800/50'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {/* Auth Modal */}
      <AuthModal 
        isOpen={authModalOpen} 
        onClose={() => setAuthModalOpen(false)} 
      />

      {/* Click outside to close dropdown */}
      {userDropdownOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setUserDropdownOpen(false)}
        />
      )}
    </header>
  );
};

export default Header; 