import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './AuthModal.css';

const AuthModal = ({ isOpen, onClose, defaultTab = 'login' }) => {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [oauthConfig, setOauthConfig] = useState(null);

  const { login, register, loginWithGoogle, loginWithGitHub, loading, error, clearError } = useAuth();

  // Fetch OAuth configuration
  useEffect(() => {
    const fetchOAuthConfig = async () => {
      try {
        const response = await fetch('/api/auth/config');
        const data = await response.json();
        if (data.success) {
          setOauthConfig(data.config);
        }
      } catch (error) {
        console.error('Failed to fetch OAuth config:', error);
      }
    };

    if (isOpen) {
      fetchOAuthConfig();
    }
  }, [isOpen]);

  // Clear form and error when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setFormData({ name: '', email: '', password: '', confirmPassword: '' });
      clearError();
    }
  }, [isOpen]); // Removed clearError from dependencies to prevent infinite loop

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (activeTab === 'register') {
      if (formData.password !== formData.confirmPassword) {
        alert('Passwords do not match');
        return;
      }
      if (formData.password.length < 6) {
        alert('Password must be at least 6 characters long');
        return;
      }
    }

    const result = activeTab === 'login' 
      ? await login(formData.email, formData.password)
      : await register(formData.name, formData.email, formData.password);

    if (result.success) {
      onClose();
    }
  };

  const handleGoogleLogin = async () => {
    if (!oauthConfig?.google?.enabled) {
      alert('Google login is not configured');
      return;
    }

    // Initialize Google Sign-In
    if (window.google && window.google.accounts) {
      window.google.accounts.id.initialize({
        client_id: oauthConfig.google.clientId,
        callback: async (response) => {
          const result = await loginWithGoogle(response.credential);
          if (result.success) {
            onClose();
          }
        }
      });

      window.google.accounts.id.renderButton(
        document.getElementById('google-signin-button'),
        { 
          theme: 'outline', 
          size: 'large',
          width: '100%'
        }
      );

      window.google.accounts.id.prompt();
    } else {
      alert('Google Sign-In not loaded. Please refresh the page.');
    }
  };

  const handleGitHubLogin = () => {
    if (!oauthConfig?.github?.enabled) {
      alert('GitHub login is not configured');
      return;
    }

    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${oauthConfig.github.clientId}&scope=user:email&redirect_uri=${encodeURIComponent(oauthConfig.github.redirectUri)}`;
    
    // Store current URL to return to after auth
    localStorage.setItem('authReturnUrl', window.location.href);
    
    window.location.href = githubAuthUrl;
  };

  // Handle GitHub OAuth callback
  useEffect(() => {
    const handleGitHubCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      
      if (code && window.location.pathname.includes('github')) {
        const result = await loginWithGitHub(code);
        if (result.success) {
          // Remove code from URL
          window.history.replaceState({}, document.title, window.location.pathname);
          
          // Return to original URL if stored
          const returnUrl = localStorage.getItem('authReturnUrl');
          if (returnUrl) {
            localStorage.removeItem('authReturnUrl');
            window.location.href = returnUrl;
          } else {
            onClose();
          }
        }
      }
    };

    handleGitHubCallback();
  }, [loginWithGitHub, onClose]);

  if (!isOpen) return null;

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div 
        className="auth-modal" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="auth-modal-header">
          <div className="auth-tabs">
            <button 
              className={`auth-tab ${activeTab === 'login' ? 'active' : ''}`}
              onClick={() => setActiveTab('login')}
            >
              Sign In
            </button>
            <button 
              className={`auth-tab ${activeTab === 'register' ? 'active' : ''}`}
              onClick={() => setActiveTab('register')}
            >
              Sign Up
            </button>
          </div>
          <button className="auth-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="auth-modal-content">
          {error && (
            <div className="auth-error">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            {activeTab === 'register' && (
              <div className="form-group">
                <label htmlFor="name">Full Name</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter your full name"
                />
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                placeholder="Enter your email"
                autoComplete="email"
              />
              <small className="email-hint">
                💡 Use .edu email for 10 credits, others get 5 credits
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="password-input">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter your password"
                  minLength="6"
                  autoComplete={activeTab === 'login' ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            {activeTab === 'register' && (
              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <div className="password-input">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    required
                    placeholder="Confirm your password"
                    minLength="6"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>
            )}

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? 'Processing...' : (activeTab === 'login' ? 'Sign In' : 'Create Account')}
            </button>
          </form>

          {oauthConfig && (
            <>
              <div className="auth-divider">
                <span>or</span>
              </div>

              <div className="oauth-buttons">
                {oauthConfig.google?.enabled && (
                  <div>
                    <div id="google-signin-button" style={{ display: 'none' }}></div>
                    <button 
                      type="button" 
                      className="oauth-btn google-btn"
                      onClick={handleGoogleLogin}
                      disabled={loading}
                    >
                      <svg className="oauth-icon" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      Continue with Google
                    </button>
                  </div>
                )}

                {oauthConfig.github?.enabled && (
                  <button 
                    type="button" 
                    className="oauth-btn github-btn"
                    onClick={handleGitHubLogin}
                    disabled={loading}
                  >
                    <svg className="oauth-icon" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                    Continue with GitHub
                  </button>
                )}
              </div>
            </>
          )}

          {activeTab === 'register' && (
            <div className="auth-footer">
              <p className="credit-info">
                🎁 <strong>Welcome Bonus:</strong><br/>
                .edu emails receive <strong>10 credits</strong><br/>
                Other emails receive <strong>5 credits</strong>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthModal; 