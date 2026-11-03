const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const axios = require('axios');
const dbConnection = require('../database/connection');

class AuthService {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'your-jwt-secret-key';
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';
    this.refreshTokenExpiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN || '30d';
    
    // OAuth clients
    this.googleClient = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
  }

  /**
   * Generate JWT access token
   */
  generateAccessToken(userId, email) {
    return jwt.sign(
      { 
        userId, 
        email,
        type: 'access'
      },
      this.jwtSecret,
      { expiresIn: this.jwtExpiresIn }
    );
  }

  /**
   * Generate refresh token
   */
  generateRefreshToken() {
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * Verify JWT token
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  /**
   * Create user session in database
   */
  async createSession(userId, ipAddress, userAgent) {
    try {
      const accessToken = this.generateAccessToken(userId);
      const refreshToken = this.generateRefreshToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const supabase = dbConnection.getSupabaseClient();
      const { data: session, error } = await supabase
        .from('user_sessions')
        .insert([{
          user_id: userId,
          session_token: accessToken,
          refresh_token: refreshToken,
          expires_at: expiresAt.toISOString(),
          ip_address: ipAddress,
          user_agent: userAgent
        }])
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create session: ${error.message}`);
      }

      return {
        accessToken,
        refreshToken,
        expiresAt,
        session
      };
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  }

  /**
   * Get user by session token
   */
  async getUserBySessionToken(token) {
    try {
      const decoded = this.verifyToken(token);
      
      const supabase = dbConnection.getSupabaseClient();
      const { data: sessions, error } = await supabase
        .from('user_sessions')
        .select(`
          *,
          users (*)
        `)
        .eq('session_token', token)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error) {
        console.error('Error getting user by session token:', error);
        return null;
      }

      if (!sessions) {
        return null;
      }

      // Return user with session expiry info
      return {
        ...sessions.users,
        expires_at: sessions.expires_at
      };
    } catch (error) {
      console.error('Error getting user by session token:', error);
      return null;
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken) {
    try {
      const supabase = dbConnection.getSupabaseClient();
      const { data: sessions, error } = await supabase
        .from('user_sessions')
        .select(`
          *,
          users (id, email)
        `)
        .eq('refresh_token', refreshToken)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error || !sessions) {
        throw new Error('Invalid refresh token');
      }

      const newAccessToken = this.generateAccessToken(sessions.user_id, sessions.users.email);

      // Update session with new access token
      const { error: updateError } = await supabase
        .from('user_sessions')
        .update({ 
          session_token: newAccessToken, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', sessions.id);

      if (updateError) {
        throw new Error(`Failed to update session: ${updateError.message}`);
      }

      return {
        accessToken: newAccessToken,
        refreshToken: refreshToken // Keep the same refresh token
      };
    } catch (error) {
      console.error('Error refreshing token:', error);
      throw error;
    }
  }

  /**
   * Logout - invalidate session
   */
  async logout(sessionToken) {
    try {
      const supabase = dbConnection.getSupabaseClient();
      const { error } = await supabase
        .from('user_sessions')
        .update({ is_active: false })
        .eq('session_token', sessionToken);

      if (error) {
        console.error('Error logging out:', error.message);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error logging out:', error);
      return false;
    }
  }

  /**
   * Register new user with email/password
   */
  async registerUser(userData) {
    try {
      const { name, email, password } = userData;
      
      // Check if user already exists using Supabase
      const supabase = dbConnection.getSupabaseClient();
      const { data: existingUsers, error: checkError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email);

      if (checkError) {
        throw new Error(`Database query error: ${checkError.message}`);
      }

      if (existingUsers && existingUsers.length > 0) {
        throw new Error('User already exists with this email');
      }

      // Hash password (you might want to use bcrypt for production)
      const passwordHash = crypto.createHash('sha256').update(password).digest('hex');

      // Create user using Supabase (credits will be automatically granted by trigger)
      const { data: user, error: insertError } = await supabase
        .from('users')
        .insert([{
          name,
          email,
          password_hash: passwordHash,
          email_verified: false
        }])
        .select()
        .single();

      if (insertError) {
        throw new Error(`Failed to create user: ${insertError.message}`);
      }

      console.log(`✅ User registered: ${email} with ID ${user.id}`);
      return user;
    } catch (error) {
      console.error('Error registering user:', error);
      throw error;
    }
  }

  /**
   * Login with email/password
   */
  async loginUser(email, password, ipAddress, userAgent) {
    try {
      const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
      
      const supabase = dbConnection.getSupabaseClient();
      const { data: users, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('password_hash', passwordHash)
        .eq('is_active', true);

      if (error) {
        throw new Error(`Database query error: ${error.message}`);
      }
      
      if (!users || users.length === 0) {
        throw new Error('Invalid email or password');
      }

      const user = users[0];

      // Update last login
      const { error: updateError } = await supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', user.id);

      if (updateError) {
        console.warn('Failed to update last login:', updateError.message);
      }

      // Create session
      const sessionData = await this.createSession(user.id, ipAddress, userAgent);

      return {
        user,
        ...sessionData
      };
    } catch (error) {
      console.error('Error logging in user:', error);
      throw error;
    }
  }

  /**
   * Google OAuth login
   */
  async loginWithGoogle(idToken, ipAddress, userAgent) {
    try {
      // Verify Google ID token
      const ticket = await this.googleClient.verifyIdToken({
        idToken: idToken,
        audience: process.env.GOOGLE_CLIENT_ID
      });

      const payload = ticket.getPayload();
      const { sub: googleId, email, name, picture, email_verified } = payload;

      let user = await this.findOrCreateOAuthUser({
        provider: 'google',
        providerId: googleId,
        email,
        name,
        avatarUrl: picture,
        emailVerified: email_verified
      });

      // Create session
      const sessionData = await this.createSession(user.id, ipAddress, userAgent);

      return {
        user,
        ...sessionData
      };
    } catch (error) {
      console.error('Error with Google OAuth:', error);
      throw error;
    }
  }

  /**
   * GitHub OAuth login
   */
  async loginWithGitHub(code, ipAddress, userAgent) {
    try {
      // Exchange code for access token
      const tokenResponse = await axios.post('https://github.com/login/oauth/access_token', {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code: code
      }, {
        headers: {
          'Accept': 'application/json'
        }
      });

      const { access_token } = tokenResponse.data;

      // Get user info from GitHub
      const userResponse = await axios.get('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${access_token}`,
          'User-Agent': 'Resume-Builder-App'
        }
      });

      const githubUser = userResponse.data;

      // Get user's primary email
      const emailResponse = await axios.get('https://api.github.com/user/emails', {
        headers: {
          'Authorization': `token ${access_token}`,
          'User-Agent': 'Resume-Builder-App'
        }
      });

      const primaryEmail = emailResponse.data.find(email => email.primary);

      let user = await this.findOrCreateOAuthUser({
        provider: 'github',
        providerId: githubUser.id.toString(),
        email: primaryEmail?.email || githubUser.email,
        name: githubUser.name || githubUser.login,
        avatarUrl: githubUser.avatar_url,
        emailVerified: primaryEmail?.verified || false,
        accessToken: access_token
      });

      // Create session
      const sessionData = await this.createSession(user.id, ipAddress, userAgent);

      return {
        user,
        ...sessionData
      };
    } catch (error) {
      console.error('Error with GitHub OAuth:', error);
      throw error;
    }
  }

  /**
   * Find or create OAuth user
   */
  async findOrCreateOAuthUser(oauthData) {
    const { provider, providerId, email, name, avatarUrl, emailVerified, accessToken } = oauthData;

    try {
      const supabase = dbConnection.getSupabaseClient();
      
      // First, try to find existing user by OAuth provider
      const { data: oauthAccounts, error: oauthError } = await supabase
        .from('oauth_accounts')
        .select(`
          *,
          users (*)
        `)
        .eq('provider', provider)
        .eq('provider_account_id', providerId);

      if (oauthError) {
        console.error('Error checking OAuth accounts:', oauthError);
      }

      if (oauthAccounts && oauthAccounts.length > 0) {
        // User exists, update last login and return
        const user = oauthAccounts[0].users;
        const { error: updateError } = await supabase
          .from('users')
          .update({ last_login: new Date().toISOString() })
          .eq('id', user.id);

        if (updateError) {
          console.warn('Failed to update last login:', updateError.message);
        }

        return user;
      }

      // Try to find user by email
      const { data: existingUsers, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email);

      if (userError) {
        throw new Error(`Error checking existing users: ${userError.message}`);
      }

      let user;
      if (existingUsers && existingUsers.length > 0) {
        // User exists with this email, link OAuth account
        user = existingUsers[0];
      } else {
        // Create new user (credits will be automatically granted by trigger)
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert([{
            name,
            email,
            oauth_provider: provider,
            oauth_id: providerId,
            avatar_url: avatarUrl,
            email_verified: emailVerified,
            last_login: new Date().toISOString()
          }])
          .select()
          .single();

        if (createError) {
          throw new Error(`Failed to create OAuth user: ${createError.message}`);
        }

        user = newUser;
        console.log(`✅ New OAuth user created: ${email} with ID ${user.id}`);
      }

      // Create or update OAuth account record
      const { error: oauthUpsertError } = await supabase
        .from('oauth_accounts')
        .upsert([{
          user_id: user.id,
          provider,
          provider_account_id: providerId,
          access_token: accessToken,
          provider_data: JSON.stringify({ name, email, avatarUrl, emailVerified })
        }]);

      if (oauthUpsertError) {
        console.error('Error upserting OAuth account:', oauthUpsertError);
      }

      return user;
    } catch (error) {
      console.error('Error finding/creating OAuth user:', error);
      throw error;
    }
  }

  /**
   * Get user dashboard data
   */
  async getUserDashboard(userId) {
    try {
      const supabase = dbConnection.getSupabaseClient();
      const { data: dashboard, error } = await supabase
        .from('user_dashboard')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw new Error(`Failed to get user dashboard: ${error.message}`);
      }

      return dashboard || null;
    } catch (error) {
      console.error('Error getting user dashboard:', error);
      throw error;
    }
  }

  /**
   * Get user's credit transaction history with pagination
   */
  async getCreditTransactions(userId, limit = 50, offset = 0) {
    try {
      const supabase = dbConnection.getSupabaseClient();
      const { data: transactions, error } = await supabase
        .from('credit_transactions')
        .select(`
          *,
          tailoring_sessions (
            session_id,
            job_descriptions (
              title,
              company
            )
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw new Error(`Failed to get credit transactions: ${error.message}`);
      }

      // Transform the nested data to match the original structure
      return (transactions || []).map(transaction => ({
        ...transaction,
        session_id: transaction.tailoring_sessions?.session_id,
        job_title: transaction.tailoring_sessions?.job_descriptions?.title,
        company: transaction.tailoring_sessions?.job_descriptions?.company
      }));
    } catch (error) {
      console.error('Error getting credit transactions:', error);
      throw error;
    }
  }

  /**
   * Deduct credits for a session
   */
  async deductCredits(userId, amount, sessionId, reason = 'Resume tailoring') {
    try {
      const supabase = dbConnection.getSupabaseClient();
      
      // Start a transaction-like operation
      // First, get current user credits
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('credits')
        .eq('id', userId)
        .single();

      if (userError) {
        console.error('Error fetching user credits:', userError);
        return false;
      }

      if (!user || user.credits < amount) {
        console.warn('Insufficient credits for user:', userId);
        return false;
      }

      // Deduct credits from user
      const { error: updateError } = await supabase
        .from('users')
        .update({ credits: user.credits - amount })
        .eq('id', userId);

      if (updateError) {
        console.error('Error updating user credits:', updateError);
        return false;
      }

      // Record credit transaction
      const { error: transactionError } = await supabase
        .from('credit_transactions')
        .insert([{
          user_id: userId,
          amount: -amount, // Negative for deduction
          transaction_type: 'used',
          reason: reason,
          tailoring_session_id: sessionId
        }]);

      if (transactionError) {
        console.error('Error recording credit transaction:', transactionError);
        // Don't return false here as the credit was already deducted
      }

      console.log(`✅ Deducted ${amount} credits from user ${userId}`);
      return true;
    } catch (error) {
      console.error('Error deducting credits:', error);
      return false;
    }
  }

  /**
   * Grant credits to user
   */
  async grantCredits(userId, amount, reason = 'Credit grant') {
    try {
      const supabase = dbConnection.getSupabaseClient();
      
      // Get current user credits
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('credits')
        .eq('id', userId)
        .single();

      if (userError) {
        console.error('Error fetching user credits:', userError);
        return false;
      }

      if (!user) {
        console.error('User not found:', userId);
        return false;
      }

      const newBalance = (user.credits || 0) + amount;

      // Add credits to user
      const { error: updateError } = await supabase
        .from('users')
        .update({ credits: newBalance })
        .eq('id', userId);

      if (updateError) {
        console.error('Error updating user credits:', updateError);
        return false;
      }

      // Record credit transaction
      const { error: transactionError } = await supabase
        .from('credit_transactions')
        .insert([{
          user_id: userId,
          amount: amount, // Positive for grant
          transaction_type: 'granted',
          reason: reason
        }]);

      if (transactionError) {
        console.error('Error recording credit transaction:', transactionError);
        // Don't return false here as the credit was already granted
      }

      console.log(`✅ Granted ${amount} credits to user ${userId}`);
      return true;
    } catch (error) {
      console.error('Error granting credits:', error);
      return false;
    }
  }
}

module.exports = new AuthService(); 