const { createClient } = require('@supabase/supabase-js');

class DatabaseConnection {
  constructor() {
    this.supabaseClient = null;
    this.isConnected = false;
  }

  /**
   * Initialize Supabase connection
   */
  async initializeSupabase() {
    try {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase URL and Key must be provided in environment variables');
      }

      this.supabaseClient = createClient(supabaseUrl, supabaseKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: false // Server-side usage
        },
        db: {
          schema: 'public'
        }
      });

      console.log('✅ Supabase client initialized successfully');
      return this.supabaseClient;
    } catch (error) {
      console.error('❌ Failed to initialize Supabase:', error);
      throw error;
    }
  }

  /**
   * Initialize direct PostgreSQL connection for advanced queries
   * @deprecated - Use Supabase client for all database operations
   */
  async initializePostgreSQL() {
    console.log('ℹ️ PostgreSQL direct connection deprecated - using Supabase client only');
    return null;
  }

  /**
   * Initialize both Supabase and PostgreSQL connections
   */
  async initialize() {
    try {
      console.log('🔌 Initializing database connections...');
      
      // Try to initialize Supabase first (preferred method)
      let supabaseSuccess = false;
      try {
        await this.initializeSupabase();
        supabaseSuccess = true;
        console.log('✅ Using Supabase client for database operations');
      } catch (error) {
        console.warn('⚠️ Supabase initialization failed:', error.message);
      }
      
      // Ensure Supabase connection works
      if (!supabaseSuccess) {
        throw new Error('Failed to initialize Supabase connection. Please check your SUPABASE_URL and SUPABASE_ANON_KEY configuration.');
      }
      
      console.log('🎉 Database connections initialized successfully');
      return {
        supabase: this.supabaseClient,
        pg: this.pgPool
      };
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      throw error;
    }
  }

  /**
   * Get Supabase client
   */
  getSupabaseClient() {
    if (!this.supabaseClient) {
      throw new Error('Supabase client not initialized. Call initialize() first.');
    }
    return this.supabaseClient;
  }

  /**
   * Get PostgreSQL pool
   * @deprecated - Use getSupabaseClient() instead
   */
  getPostgreSQLPool() {
    throw new Error('PostgreSQL pool is deprecated. Use getSupabaseClient() instead.');
  }

  /**
   * Execute a raw SQL query
   * @deprecated - Use getSupabaseClient() and Supabase methods instead
   */
  async query(text, params = []) {
    throw new Error('Raw SQL queries are deprecated. Use getSupabaseClient() and Supabase client methods instead.');
  }

  /**
   * Get Supabase table reference for ORM-style operations
   */
  table(tableName) {
    if (!this.supabaseClient) {
      throw new Error('Supabase client not available. Please configure SUPABASE_URL and SUPABASE_ANON_KEY.');
    }
    return this.supabaseClient.from(tableName);
  }

  /**
   * Execute a transaction
   * @deprecated - Use Supabase client methods instead
   */
  async transaction(callback) {
    throw new Error('PostgreSQL transactions are deprecated. Use Supabase client methods instead.');
  }

  /**
   * Health check for database connections
   */
  async healthCheck() {
    const health = {
      supabase: false,
      postgresql: false, // Deprecated but kept for compatibility
      timestamp: new Date().toISOString()
    };

    try {
      // Test Supabase connection
      if (this.supabaseClient) {
        // Simple query to test connection - try to access a known table
        const { data, error } = await this.supabaseClient
          .from('users')
          .select('id')
          .limit(1);
        
        if (!error) {
          health.supabase = true;
          // Set postgresql to true for backward compatibility since we're using Supabase
          health.postgresql = true;
        }
      }
    } catch (error) {
      console.warn('Supabase health check failed:', error.message);
    }

    return health;
  }

  /**
   * Close all database connections
   */
  async close() {
    try {
      // Supabase client doesn't need explicit closing
      this.isConnected = false;
      console.log('Database connections closed');
    } catch (error) {
      console.error('Error closing database connections:', error);
    }
  }
}

// Create singleton instance
const dbConnection = new DatabaseConnection();

module.exports = dbConnection; 