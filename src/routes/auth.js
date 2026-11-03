const express = require('express');
const router = express.Router();
const AuthService = require('../services/AuthService');
const { authenticateToken, extractClientInfo, rateLimit } = require('../middleware/auth');

// Apply client info extraction to all auth routes
router.use(extractClientInfo);

/**
 * @route POST /auth/register
 * @desc Register new user with email/password
 */
router.post('/register', rateLimit(5, 15 * 60 * 1000), async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Name, email, and password are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long'
      });
    }

    // Register user
    const user = await AuthService.registerUser({ name, email, password });

    // Create session
    const sessionData = await AuthService.createSession(
      user.id, 
      req.clientIP, 
      req.userAgent
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        credits: user.credits,
        emailVerified: user.email_verified,
        createdAt: user.created_at
      },
      ...sessionData
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /auth/login
 * @desc Login with email/password
 */
router.post('/login', rateLimit(10, 15 * 60 * 1000), async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    const result = await AuthService.loginUser(
      email, 
      password, 
      req.clientIP, 
      req.userAgent
    );

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        credits: result.user.credits,
        avatarUrl: result.user.avatar_url,
        emailVerified: result.user.email_verified,
        lastLogin: result.user.last_login
      },
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresAt: result.expiresAt
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /auth/google
 * @desc Google OAuth login
 */
router.post('/google', rateLimit(10, 15 * 60 * 1000), async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({
        success: false,
        error: 'Google ID token is required'
      });
    }

    const result = await AuthService.loginWithGoogle(
      idToken, 
      req.clientIP, 
      req.userAgent
    );

    res.json({
      success: true,
      message: 'Google login successful',
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        credits: result.user.credits,
        avatarUrl: result.user.avatar_url,
        emailVerified: result.user.email_verified,
        oauthProvider: result.user.oauth_provider
      },
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresAt: result.expiresAt
    });
  } catch (error) {
    console.error('Google OAuth error:', error);
    res.status(401).json({
      success: false,
      error: 'Google authentication failed'
    });
  }
});

/**
 * @route POST /auth/github
 * @desc GitHub OAuth login
 */
router.post('/github', rateLimit(10, 15 * 60 * 1000), async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'GitHub authorization code is required'
      });
    }

    const result = await AuthService.loginWithGitHub(
      code, 
      req.clientIP, 
      req.userAgent
    );

    res.json({
      success: true,
      message: 'GitHub login successful',
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        credits: result.user.credits,
        avatarUrl: result.user.avatar_url,
        emailVerified: result.user.email_verified,
        oauthProvider: result.user.oauth_provider
      },
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresAt: result.expiresAt
    });
  } catch (error) {
    console.error('GitHub OAuth error:', error);
    res.status(401).json({
      success: false,
      error: 'GitHub authentication failed'
    });
  }
});

/**
 * @route POST /auth/refresh
 * @desc Refresh access token
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token is required'
      });
    }

    const result = await AuthService.refreshAccessToken(refreshToken);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      success: false,
      error: 'Invalid refresh token'
    });
  }
});

/**
 * @route POST /auth/logout
 * @desc Logout user
 */
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    await AuthService.logout(req.token);

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Logout failed'
    });
  }
});

/**
 * @route GET /auth/me
 * @desc Get current user info
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const dashboard = await AuthService.getUserDashboard(req.user.id);

    res.json({
      success: true,
      user: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        credits: req.user.credits,
        avatarUrl: req.user.avatar_url,
        emailVerified: req.user.email_verified,
        oauthProvider: req.user.oauth_provider,
        subscriptionTier: req.user.subscription_tier,
        createdAt: req.user.created_at,
        lastLogin: req.user.last_login
      },
      dashboard
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user information'
    });
  }
});

/**
 * @route GET /auth/dashboard
 * @desc Get user dashboard data
 */
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const dashboard = await AuthService.getUserDashboard(req.user.id);
    const transactions = await AuthService.getCreditTransactions(req.user.id, 20);

    res.json({
      success: true,
      dashboard,
      recentTransactions: transactions
    });
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get dashboard data'
    });
  }
});

/**
 * @route GET /auth/transactions
 * @desc Get user's credit transaction history with pagination
 */
router.get('/transactions', authenticateToken, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = parseInt(req.query.offset) || 0;
    const transactions = await AuthService.getCreditTransactions(req.user.id, limit, offset);

    res.json({
      success: true,
      transactions,
      count: transactions.length,
      offset: offset,
      limit: limit
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get transaction history'
    });
  }
});

/**
 * @route POST /auth/grant-credits
 * @desc Grant credits to user (admin only - for testing)
 */
router.post('/grant-credits', authenticateToken, async (req, res) => {
  try {
    const { amount, reason } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid amount is required'
      });
    }

    // For now, allow any user to grant themselves credits for testing
    // In production, this should be admin-only
    const success = await AuthService.grantCredits(
      req.user.id, 
      amount, 
      reason || 'Manual credit grant'
    );

    if (success) {
      // Get updated user info
      const dashboard = await AuthService.getUserDashboard(req.user.id);
      
      res.json({
        success: true,
        message: `${amount} credits granted successfully`,
        newBalance: dashboard.credits
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to grant credits'
      });
    }
  } catch (error) {
    console.error('Grant credits error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to grant credits'
    });
  }
});

/**
 * @route GET /auth/config
 * @desc Get OAuth configuration for frontend
 */
router.get('/config', (req, res) => {
  res.json({
    success: true,
    config: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        enabled: !!process.env.GOOGLE_CLIENT_ID
      },
      github: {
        clientId: process.env.GITHUB_CLIENT_ID,
        enabled: !!process.env.GITHUB_CLIENT_ID,
        redirectUri: process.env.GITHUB_REDIRECT_URI || `${req.protocol}://${req.get('host')}/auth/github/callback`
      }
    }
  });
});

module.exports = router; 