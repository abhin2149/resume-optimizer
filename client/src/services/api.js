import axios from 'axios';

// Create axios instance with default config
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 300000, // 5 minute timeout for resume tailoring operations
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for authentication and logging
api.interceptors.request.use(
  (config) => {
    console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
    
    // Add authentication token if available
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log(`[API] Adding auth token to request: ${token.substring(0, 20)}...`);
    } else {
      console.warn(`[API] No auth token found for ${config.url}`);
    }
    
    return config;
  },
  (error) => {
    console.error('[API] Request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    console.log(`[API] Response ${response.status} from ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('[API] Response error:', error);
    
    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response;
      console.error(`[API] Server error ${status}:`, data);
      
      // Handle specific error codes
      switch (status) {
        case 400:
          throw new Error(data.error || 'Bad request');
        case 401:
          // Clear invalid token and redirect to login
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          throw new Error('Session expired - please sign in again');
        case 403:
          throw new Error(data.error || 'Access forbidden - you don\'t have permission to access this resource');
        case 404:
          throw new Error('Resource not found');
        case 500:
          throw new Error(data.error || 'Internal server error');
        default:
          throw new Error(data.error || `Server error: ${status}`);
      }
    } else if (error.request) {
      // Network error
      console.error('[API] Network error:', error.request);
      throw new Error('Network error - please check your connection');
    } else {
      // Other error
      console.error('[API] Error:', error.message);
      throw new Error(error.message || 'An unexpected error occurred');
    }
  }
);

// API Methods

/**
 * Health check endpoint
 */
export const healthCheck = async () => {
  try {
    const response = await api.get('/health');
    return response.data;
  } catch (error) {
    console.error('Health check failed:', error);
    throw error;
  }
};

/**
 * Get base resume content
 */
export const getBaseResume = async () => {
  try {
    const response = await api.get('/base-resume');
    return response.data;
  } catch (error) {
    console.error('Failed to get base resume:', error);
    throw error;
  }
};

/**
 * Upload custom resume file
 */
export const uploadResume = async (file) => {
  try {
    const formData = new FormData();
    formData.append('resume', file);
    
    const response = await api.post('/upload-resume', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  } catch (error) {
    console.error('Failed to upload resume:', error);
    throw error;
  }
};



/**
 * Get user's saved resumes
 */
export const getUserResumes = async () => {
  try {
    const response = await api.get('/resumes');
    return response.data;
  } catch (error) {
    console.error('Failed to get user resumes:', error);
    throw error;
  }
};

/**
 * Get user analytics data
 */
export const getUserAnalytics = async (timeRange = '30d') => {
  try {
    const response = await api.get(`/analytics/user-stats?range=${timeRange}`);
    return response.data;
  } catch (error) {
    console.error('Failed to get user analytics:', error);
    throw error;
  }
};

/**
 * Get keyword analytics for user
 */
export const getKeywordAnalytics = async (limit = 50) => {
  try {
    const response = await api.get(`/analytics/keywords?limit=${limit}`);
    return response.data;
  } catch (error) {
    console.error('Failed to get keyword analytics:', error);
    throw error;
  }
};

/**
 * Get detailed credit transactions
 */
export const getCreditTransactions = async (limit = 50, offset = 0) => {
  try {
    const response = await api.get(`/auth/transactions?limit=${limit}&offset=${offset}`);
    return response.data;
  } catch (error) {
    console.error('Failed to get credit transactions:', error);
    throw error;
  }
};

/**
 * Get usage analytics over time
 */
export const getUsageAnalytics = async (period = 'daily', days = 30) => {
  try {
    const response = await api.get(`/analytics/usage?period=${period}&days=${days}`);
    return response.data;
  } catch (error) {
    console.error('Failed to get usage analytics:', error);
    throw error;
  }
};

/**
 * Extract keywords from job description
 */
export const extractKeywords = async (jobDescription) => {
  try {
    const response = await api.post('/extract-keywords', {
      jobDescription: jobDescription
    });
    
    return response.data;
  } catch (error) {
    console.error('Failed to extract keywords:', error);
    throw error;
  }
};

/**
 * Tailor resume for job description
 */
export const tailorResume = async (payload) => {
  try {
    const response = await api.post('/tailor-resume', payload);
    return response.data;
  } catch (error) {
    console.error('Failed to tailor resume:', error);
    throw error;
  }
};

/**
 * Get tailoring results
 */
export const getTailoringResults = async (sessionId) => {
  try {
    // Since results are returned immediately from tailor-resume,
    // this might be used for fetching cached results or status
    const response = await api.get(`/results/${sessionId}`);
    return response.data;
  } catch (error) {
    console.error('Failed to get results:', error);
    throw error;
  }
};

/**
 * Download PDF file with custom filename
 */
export const downloadPDF = async (sessionId, customFilename = null) => {
  try {
    // Check if user is authenticated
    const token = localStorage.getItem('accessToken');
    if (!token) {
      throw new Error('Authentication required - please sign in to download PDFs');
    }
    
    // Build URL with filename parameter if provided
    let downloadUrl = `/download/${sessionId}`;
    if (customFilename) {
      downloadUrl += `?filename=${encodeURIComponent(customFilename)}`;
    }
    
    console.log('[DOWNLOAD] Requesting PDF download for session:', sessionId);
    console.log('[DOWNLOAD] Using auth token:', token.substring(0, 20) + '...');
    
    const response = await api.get(downloadUrl, {
      responseType: 'blob'
    });
    
    // Create blob URL for download
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    
    // Use custom filename or default
    const filename = customFilename || `tailored_resume_${sessionId}.pdf`;
    
    // Create download link
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    window.URL.revokeObjectURL(url);
    document.body.removeChild(link);
    
    console.log('[DOWNLOAD] PDF downloaded successfully:', filename);
    return { success: true };
  } catch (error) {
    console.error('[DOWNLOAD] Failed to download PDF:', error);
    
    // Provide more specific error messages
    if (error.message.includes('401')) {
      throw new Error('Authentication failed - please sign in again to download PDFs');
    } else if (error.message.includes('403')) {
      throw new Error('Access denied - you can only download your own resume files');
    } else if (error.message.includes('404')) {
      throw new Error('PDF file not found - it may have been cleaned up or the session does not exist');
    } else if (error.message.includes('Authentication required')) {
      throw error; // Re-throw the auth required message as-is
    } else {
      throw new Error(`Download failed: ${error.message || 'Unknown error occurred'}`);
    }
  }
};

/**
 * Get file content from server (for viewing)
 */
export const getFileContent = async (filePath) => {
  try {
    const response = await api.get(filePath, {
      responseType: 'text'
    });
    return response.data;
  } catch (error) {
    console.error('Failed to get file content:', error);
    throw error;
  }
};

/**
 * Validate server connection and LaTeX installation
 */
export const validateSystem = async () => {
  try {
    const [healthResponse] = await Promise.all([
      healthCheck(),
      // Add more validation calls as needed
    ]);
    
    return {
      serverHealth: healthResponse,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('System validation failed:', error);
    throw error;
  }
};

/**
 * Get server statistics (if implemented)
 */
export const getServerStats = async () => {
  try {
    const response = await api.get('/stats');
    return response.data;
  } catch (error) {
    console.error('Failed to get server stats:', error);
    // Don't throw error for optional stats
    return null;
  }
};

/**
 * Debug function to check authentication state
 * Call window.debugAuth() in browser console to check auth status
 */
export const debugAuth = () => {
  const accessToken = localStorage.getItem('accessToken');
  const refreshToken = localStorage.getItem('refreshToken');
  
  console.log('=== Authentication Debug Info ===');
  console.log('Access Token:', accessToken ? `${accessToken.substring(0, 20)}...` : 'NOT FOUND');
  console.log('Refresh Token:', refreshToken ? `${refreshToken.substring(0, 20)}...` : 'NOT FOUND');
  console.log('Full Access Token:', accessToken);
  
  if (accessToken) {
    try {
      const payload = JSON.parse(atob(accessToken.split('.')[1]));
      console.log('Token Payload:', payload);
      console.log('Token Expires:', new Date(payload.exp * 1000));
      console.log('Token Valid:', payload.exp * 1000 > Date.now());
    } catch (error) {
      console.error('Error parsing token:', error);
    }
  }
  
  return {
    hasAccessToken: !!accessToken,
    hasRefreshToken: !!refreshToken,
    accessToken: accessToken?.substring(0, 20),
    refreshToken: refreshToken?.substring(0, 20)
  };
};

/**
 * Test function to verify authentication is working
 * Call window.testAuth() in browser console to test API calls
 */
export const testAuth = async () => {
  console.log('=== Testing Authentication ===');
  
  const authInfo = debugAuth();
  console.log('Auth Info:', authInfo);
  
  if (!authInfo.hasAccessToken) {
    console.error('❌ No access token found. Please log in first.');
    return;
  }
  
  try {
    // Test authenticated endpoint
    console.log('🧪 Testing authenticated API call...');
    const response = await api.get('/auth/me');
    console.log('✅ API call successful:', response.data);
    return { success: true, data: response.data };
  } catch (error) {
    console.error('❌ API call failed:', error.message);
    return { success: false, error: error.message };
  }
};

// Make debug functions available globally for debugging
if (typeof window !== 'undefined') {
  window.debugAuth = debugAuth;
  window.testAuth = testAuth;
}

export default api; 