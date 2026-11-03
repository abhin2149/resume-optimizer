import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, 
  Download, 
  Eye, 
  Trash2, 
  Calendar, 
  Briefcase, 
  TrendingUp, 
  Search,
  Filter,
  Archive,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  BarChart3,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Coins,
  User,
  CreditCard,
  PieChart,
  LineChart,
  TrendingDown,
  Hash,
  Target,
  Award,
  Building2,
  Timer,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../services/api';

import { downloadPDF, getUserAnalytics, getKeywordAnalytics, getUsageAnalytics } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import AuthModal from '../components/AuthModal';
import FilenameModal from '../components/FilenameModal';

const DashboardPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user, loading: authLoading } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [filteredSessions, setFilteredSessions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [filterBy, setFilterBy] = useState('all');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [keywordAnalytics, setKeywordAnalytics] = useState([]);
  const [usageAnalytics, setUsageAnalytics] = useState(null);
  const [analyticsTimeRange, setAnalyticsTimeRange] = useState('30d');
  const [showAnalytics, setShowAnalytics] = useState(false);
  
  // Filename modal state
  const [showFilenameModal, setShowFilenameModal] = useState(false);
  const [downloadSessionId, setDownloadSessionId] = useState(null);

  // Check authentication and load dashboard data
  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        setAuthModalOpen(true);
        setIsLoading(false);
        return;
      }
      loadDashboardData();
    }
  }, [isAuthenticated, authLoading]);

  const loadDashboardData = async () => {
    if (!isAuthenticated) return;
    
    setIsLoading(true);
    try {
      // Load dashboard data from backend
      const [dashboardResponse, sessionsResponse, analyticsResponse, keywordResponse, usageResponse] = await Promise.allSettled([
        api.get('/auth/dashboard'),
        api.get('/analytics/recent-sessions?limit=50'),
        getUserAnalytics(analyticsTimeRange),
        getKeywordAnalytics(30),
        getUsageAnalytics('daily', 30)
      ]);

      // Handle dashboard response
      if (dashboardResponse.status === 'fulfilled' && dashboardResponse.value.data.success) {
        setDashboardData(dashboardResponse.value.data.dashboard);
      } else {
        console.warn('[DASHBOARD] Failed to load dashboard data:', dashboardResponse.reason);
      }

      // Load sessions from database (primary source)
      let dbSessions = [];
      if (sessionsResponse.status === 'fulfilled' && sessionsResponse.value.data.success) {
        console.log('[DASHBOARD] Database sessions loaded:', sessionsResponse.value.data.sessions.length);
        console.log('[DASHBOARD] First session sample:', sessionsResponse.value.data.sessions[0]);
        
        dbSessions = sessionsResponse.value.data.sessions.map(session => ({
          sessionId: session.session_id,
          jobDescription: session.job_title || 'Untitled Job',
          compilationResult: {
            success: session.latex_compilation_success || false,
            error: session.latex_compilation_error
          },
          metadata: {
            timestamp: session.created_at,
            tailoredResumeLength: session.tailored_content_length,
            jobDescriptionLength: session.original_content_length,
            originalResumeLength: session.original_content_length
          },
          company: session.company,
          status: session.status,
          source: 'database'
        }));
        
        console.log('[DASHBOARD] Mapped sessions:', dbSessions.length);
      } else {
        console.warn('[DASHBOARD] Failed to load sessions from database:', sessionsResponse.reason || 'Unknown error');
      }

      // Also load localStorage sessions for backward compatibility
      const localSessions = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('resume_')) {
          try {
            const data = JSON.parse(localStorage.getItem(key));
            const sessionId = key.replace('resume_', '');
            // Only include if not already in database sessions
            if (!dbSessions.find(s => s.sessionId === sessionId)) {
              localSessions.push({
                sessionId,
                ...data,
                key,
                source: 'localStorage'
              });
            }
          } catch (error) {
            console.error(`Error parsing session ${key}:`, error);
          }
        }
      }

      // Handle analytics response
      if (analyticsResponse.status === 'fulfilled' && analyticsResponse.value.success) {
        setAnalytics(analyticsResponse.value.analytics);
        console.log('[DASHBOARD] Analytics loaded');
      } else {
        console.warn('[DASHBOARD] Failed to load analytics:', analyticsResponse.reason);
      }

      // Handle keyword analytics response
      if (keywordResponse.status === 'fulfilled' && keywordResponse.value.success) {
        setKeywordAnalytics(keywordResponse.value.keywords);
        console.log('[DASHBOARD] Keyword analytics loaded:', keywordResponse.value.keywords.length);
      } else {
        console.warn('[DASHBOARD] Failed to load keyword analytics:', keywordResponse.reason);
      }

      // Handle usage analytics response
      if (usageResponse.status === 'fulfilled' && usageResponse.value.success) {
        setUsageAnalytics(usageResponse.value.analytics);
        console.log('[DASHBOARD] Usage analytics loaded');
      } else {
        console.warn('[DASHBOARD] Failed to load usage analytics:', usageResponse.reason);
      }

      // Combine database sessions (priority) with localStorage sessions
      const allSessions = [...dbSessions, ...localSessions];
      console.log('[DASHBOARD] Total sessions combined:', {
        database: dbSessions.length,
        localStorage: localSessions.length,
        total: allSessions.length
      });
      setSessions(allSessions);

    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter and search sessions
  useEffect(() => {
    let filtered = [...sessions];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(session => 
        (session.jobDescription && session.jobDescription.toLowerCase().includes(searchTerm.toLowerCase())) ||
        session.sessionId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (session.company && session.company.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (session.metadata?.timestamp && new Date(session.metadata.timestamp).toLocaleDateString().includes(searchTerm))
      );
    }

    // Apply status filter
    if (filterBy !== 'all') {
      filtered = filtered.filter(session => {
        if (filterBy === 'successful') {
          return session.compilationResult?.success === true;
        } else if (filterBy === 'failed') {
          return session.compilationResult?.success === false;
        }
        return true;
      });
    }

    // Apply company filter
    if (companyFilter !== 'all') {
      filtered = filtered.filter(session => {
        if (companyFilter === 'unknown') {
          return !session.company || session.company === 'Unknown Company';
        } else {
          return session.company === companyFilter;
        }
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.metadata?.timestamp || 0) - new Date(a.metadata?.timestamp || 0);
        case 'oldest':
          return new Date(a.metadata?.timestamp || 0) - new Date(b.metadata?.timestamp || 0);
        case 'name':
          return a.sessionId.localeCompare(b.sessionId);
        default:
          return 0;
      }
    });

    setFilteredSessions(filtered);
  }, [sessions, searchTerm, sortBy, filterBy, companyFilter]);

  const handleDeleteSession = async (sessionId) => {
    const confirmDelete = window.confirm('Are you sure you want to delete this resume optimization? This action cannot be undone.');
    
    if (confirmDelete) {
      try {
        // Try to delete from database first (if user is authenticated)
        if (isAuthenticated) {
          try {
            await api.delete(`/sessions/${sessionId}`);
            console.log('[DASHBOARD] Session deleted from database:', sessionId);
          } catch (dbError) {
            console.warn('[DASHBOARD] Failed to delete from database:', dbError.message);
            // Continue with localStorage deletion even if DB deletion fails
          }
        }
        
        // Always clean up localStorage as well
        localStorage.removeItem(`resume_${sessionId}`);
        setSessions(prev => prev.filter(session => session.sessionId !== sessionId));
        toast.success('Session deleted successfully');
      } catch (error) {
        toast.error('Failed to delete session');
        console.error('Delete error:', error);
      }
    }
  };

  const handleDownloadPDF = (sessionId) => {
    setDownloadSessionId(sessionId);
    setShowFilenameModal(true);
  };

  const handleFilenameConfirm = async (customFilename) => {
    try {
      await downloadPDF(downloadSessionId, customFilename);
      toast.success('PDF downloaded successfully!');
    } catch (error) {
      // Handle authentication errors more gracefully
      if (error.message.includes('Authentication required') || error.message.includes('Authentication failed')) {
        toast.error('Please sign in to download PDFs');
        console.log('Authentication required for download - user should sign in');
        // Could trigger auth modal here if needed
      } else {
        toast.error(error.message || 'Failed to download PDF - file may no longer exist on server');
      }
      console.error('Download error:', error);
    }
  };

  const handleViewResults = (sessionId) => {
    navigate(`/results/${sessionId}`);
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown date';
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getJobTitle = (jobDescription) => {
    if (!jobDescription) return 'Unknown Position';
    
    // If it's already a clean title (like from database), return it
    if (jobDescription.length < 100 && !jobDescription.includes('\n')) {
      return jobDescription;
    }
    
    // Try to extract job title from first few lines for localStorage data
    const lines = jobDescription.split('\n').slice(0, 3);
    for (const line of lines) {
      const titleMatch = line.match(/(?:position|role|job|title):\s*([^\n]+)/i) ||
                        line.match(/^([^:]+(?:engineer|developer|manager|analyst|coordinator|specialist|lead|director|senior|junior|intern))/i);
      if (titleMatch) {
        return titleMatch[1].trim().substring(0, 50);
      }
    }
    
    // Fallback: take first meaningful line
    const firstLine = lines.find(line => line.trim().length > 10);
    return firstLine ? firstLine.trim().substring(0, 50) + '...' : 'Position Details';
  };

  const clearAllSessions = async () => {
    const confirmClear = window.confirm('Are you sure you want to delete ALL resume optimizations? This action cannot be undone.');
    
    if (confirmClear) {
      try {
        // Clear database sessions first (if user is authenticated)
        if (isAuthenticated) {
          try {
            await api.delete('/sessions/all');
            console.log('[DASHBOARD] All sessions cleared from database');
          } catch (dbError) {
            console.warn('[DASHBOARD] Failed to clear database sessions:', dbError.message);
            // Continue with localStorage cleanup even if DB cleanup fails
          }
        }
        
        // Remove all resume sessions from localStorage
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('resume_')) {
            keysToRemove.push(key);
          }
        }
        
        keysToRemove.forEach(key => localStorage.removeItem(key));
        setSessions([]);
        toast.success('All sessions cleared successfully');
      } catch (error) {
        toast.error('Failed to clear all sessions');
        console.error('Clear error:', error);
      }
    }
  };

  const getSuccessRate = () => {
    if (sessions.length === 0) return 0;
    const successful = sessions.filter(session => session.compilationResult?.success).length;
    return Math.round((successful / sessions.length) * 100);
  };



  // Handle analytics time range change
  const handleAnalyticsTimeRangeChange = async (newRange) => {
    setAnalyticsTimeRange(newRange);
    setIsLoading(true);
    try {
      const [analyticsResponse, usageResponse] = await Promise.allSettled([
        getUserAnalytics(newRange),
        getUsageAnalytics('daily', newRange === '7d' ? 7 : newRange === '30d' ? 30 : 90)
      ]);

      if (analyticsResponse.status === 'fulfilled' && analyticsResponse.value.success) {
        setAnalytics(analyticsResponse.value.analytics);
      }

      if (usageResponse.status === 'fulfilled' && usageResponse.value.success) {
        setUsageAnalytics(usageResponse.value.analytics);
      }
    } catch (error) {
      console.error('Failed to update analytics:', error);
      toast.error('Failed to update analytics');
    } finally {
      setIsLoading(false);
    }
  };

  // Format processing time
  const formatProcessingTime = (ms) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  // Show auth modal if not authenticated
  if (!authLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <User className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Authentication Required</h2>
          <p className="text-gray-300 mb-6">Please sign in to view your dashboard</p>
          <button
            onClick={() => setAuthModalOpen(true)}
            className="btn-primary"
          >
            Sign In
          </button>
        </div>
        <AuthModal 
          isOpen={authModalOpen} 
          onClose={() => setAuthModalOpen(false)} 
        />
      </div>
    );
  }

  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-12 w-12 text-blue-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-300">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="container-responsive py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white">Resume Dashboard</h1>
              <p className="text-gray-300 mt-1">Manage and track your resume optimizations</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/tailor')}
              className="btn-primary flex items-center"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              New Optimization
            </button>
          </div>
        </div>

        {/* User Profile Card */}
        {isAuthenticated && user && (
          <div className="card spotlight-card mb-8">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  {user.avatarUrl ? (
                    <img 
                      src={user.avatarUrl} 
                      alt="Profile" 
                      className="h-16 w-16 rounded-full border-2 border-gray-600"
                    />
                  ) : (
                    <div className="h-16 w-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                      <User className="h-8 w-8 text-white" />
                    </div>
                  )}
                  <div>
                    <h2 className="text-2xl font-bold text-white">{user.name}</h2>
                    <p className="text-gray-400">{user.email}</p>
                    <div className="flex items-center space-x-4 mt-2">
                      <div className="flex items-center space-x-2">
                        <Coins className="h-4 w-4 text-yellow-400" />
                        <span className="text-yellow-300 font-medium">
                          {user.credits} credits
                        </span>
                      </div>
                      {user.email?.includes('.edu') && (
                        <span className="bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded-full">
                          .edu account
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  <p className="text-sm text-gray-400">Member since</p>
                  <p className="text-white font-medium">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-6 mb-8">
          <div className="card spotlight-card">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-300">Available Credits</p>
                  <p className="text-2xl font-bold text-yellow-300">
                    {user?.credits || 0}
                  </p>
                </div>
                <Coins className="h-8 w-8 text-yellow-400" />
              </div>
            </div>
          </div>

          <div className="card spotlight-card">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-300">Total Sessions</p>
                  <p className="text-2xl font-bold text-white">
                    {dashboardData?.total_sessions || sessions.length}
                  </p>
                </div>
                <Archive className="h-8 w-8 text-blue-400" />
              </div>
            </div>
          </div>

          <div className="card spotlight-card">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-300">Successful</p>
                  <p className="text-2xl font-bold text-white">
                    {dashboardData?.successful_sessions || sessions.filter(s => s.compilationResult?.success).length}
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-400" />
              </div>
            </div>
          </div>

          <div className="card spotlight-card">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-300">This Month</p>
                  <p className="text-2xl font-bold text-white">
                    {dashboardData?.sessions_last_30_days || 0}
                  </p>
                </div>
                <Calendar className="h-8 w-8 text-purple-400" />
              </div>
            </div>
          </div>

          <div className="card spotlight-card">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-300">Credits Used</p>
                  <p className="text-2xl font-bold text-white">
                    {dashboardData?.total_credits_used || 0}
                  </p>
                </div>
                <CreditCard className="h-8 w-8 text-red-400" />
              </div>
            </div>
          </div>

          <div className="card spotlight-card">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-300">Companies</p>
                  <p className="text-2xl font-bold text-white">
                    {(() => {
                      const uniqueCompanies = new Set(
                        sessions
                          .map(session => session.company)
                          .filter(company => company && company !== 'Unknown Company')
                      );
                      return uniqueCompanies.size;
                    })()}
                  </p>
                </div>
                <Building2 className="h-8 w-8 text-cyan-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Analytics Section */}
        <div className="card spotlight-card mb-8">
          <div className="card-body">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white flex items-center">
                <BarChart3 className="h-6 w-6 mr-3" />
                Usage Analytics
              </h3>
              <div className="flex items-center space-x-4">
                <select
                  value={analyticsTimeRange}
                  onChange={(e) => handleAnalyticsTimeRangeChange(e.target.value)}
                  className="input-field text-sm"
                >
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="90d">Last 90 days</option>
                </select>
                <button
                  onClick={() => setShowAnalytics(!showAnalytics)}
                  className="relative group overflow-hidden btn-secondary text-sm flex items-center hover:scale-105 transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/25"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <PieChart className="h-4 w-4 mr-2 relative z-10 group-hover:rotate-12 transition-transform duration-300" />
                  <span className="relative z-10 font-medium">
                    {showAnalytics ? 'Hide Details' : 'Show Details'}
                  </span>
                  {showAnalytics ? 
                    <ChevronUp className="h-4 w-4 ml-2 relative z-10 group-hover:translate-y-[-2px] transition-transform duration-300" /> : 
                    <ChevronDown className="h-4 w-4 ml-2 relative z-10 group-hover:translate-y-[2px] transition-transform duration-300" />
                  }
                  <div className="absolute top-0 left-0 w-0 h-full bg-gradient-to-r from-blue-500 to-purple-500 group-hover:w-full transition-all duration-500 opacity-10"></div>
                </button>
              </div>
            </div>

            {/* Quick Analytics Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Success Rate</p>
                    <p className="text-2xl font-bold text-green-400">
                      {analytics?.successRate ? `${analytics.successRate.toFixed(1)}%` : 'N/A'}
                    </p>
                  </div>
                  <Target className="h-8 w-8 text-green-400" />
                </div>
              </div>
              
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Avg. Processing</p>
                    <p className="text-2xl font-bold text-blue-400">
                      {analytics?.averageProcessingTime ? formatProcessingTime(analytics.averageProcessingTime) : 'N/A'}
                    </p>
                  </div>
                  <Timer className="h-8 w-8 text-blue-400" />
                </div>
              </div>
              
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Avg. Content</p>
                    <p className="text-2xl font-bold text-purple-400">
                      {analytics?.averageContentLength ? `${(analytics.averageContentLength / 1000).toFixed(1)}K` : 'N/A'}
                    </p>
                  </div>
                  <FileText className="h-8 w-8 text-purple-400" />
                </div>
              </div>
              
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Daily Avg.</p>
                    <p className="text-2xl font-bold text-orange-400">
                      {usageAnalytics?.averagePerDay || '0'}
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-orange-400" />
                </div>
              </div>
            </div>

            {/* Detailed Analytics */}
            {showAnalytics && analytics && (
              <div className="space-y-6">
                {/* Usage Chart */}
                {usageAnalytics?.chartData && usageAnalytics.chartData.length > 0 && (
                  <div className="bg-gray-800/30 rounded-lg p-6">
                    <h4 className="text-lg font-bold text-white mb-4 flex items-center">
                      <LineChart className="h-5 w-5 mr-2" />
                      Daily Usage Pattern
                    </h4>
                    <div className="space-y-2">
                      {usageAnalytics.chartData.slice(-14).map((day, index) => (
                        <div key={index} className="flex items-center space-x-4">
                          <div className="w-24 text-sm text-gray-400">
                            {new Date(day.period).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </div>
                          <div className="flex-1 bg-gray-700 rounded-full h-6 relative">
                            <div 
                              className="bg-gradient-to-r from-blue-500 to-purple-500 h-6 rounded-full transition-all duration-300"
                              style={{ width: `${Math.min((day.sessions / Math.max(...usageAnalytics.chartData.map(d => d.sessions))) * 100, 100)}%` }}
                            />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-white text-sm font-medium">{day.sessions}</span>
                            </div>
                          </div>
                          <div className="w-16 text-sm text-gray-400 text-right">
                            {((day.successful / day.sessions) * 100).toFixed(0)}%
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Top Companies */}
                {analytics && (
                  <div className="bg-gray-800/30 rounded-lg p-6">
                    <h4 className="text-lg font-bold text-white mb-4 flex items-center">
                      <Building2 className="h-5 w-5 mr-2" />
                      Top Companies Applied To
                    </h4>
                    
                    {analytics.topCompanies && analytics.topCompanies.length > 0 ? (
                      <>
                        <div className="space-y-3">
                          {analytics.topCompanies.slice(0, 8).map((company, index) => {
                            // Generate company initials for avatar
                            const getCompanyInitials = (name) => {
                              if (!name || name === 'Unknown Company') return '?';
                              if (company.isPlaceholder) return '📊';
                              return name.split(' ')
                                .filter(word => word.length > 0)
                                .slice(0, 2)
                                .map(word => word[0].toUpperCase())
                                .join('');
                            };

                            // Generate consistent color for company
                            const getCompanyColor = (name) => {
                              if (company.isPlaceholder) return 'from-orange-500 to-orange-600';
                              const colors = [
                                'from-blue-500 to-blue-600',
                                'from-green-500 to-green-600', 
                                'from-purple-500 to-purple-600',
                                'from-pink-500 to-pink-600',
                                'from-indigo-500 to-indigo-600',
                                'from-red-500 to-red-600',
                                'from-yellow-500 to-yellow-600',
                                'from-teal-500 to-teal-600'
                              ];
                              const hash = name.split('').reduce((a, b) => {
                                a = ((a << 5) - a) + b.charCodeAt(0);
                                return a & a;
                              }, 0);
                              return colors[Math.abs(hash) % colors.length];
                            };

                            return (
                              <div key={index} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg hover:bg-gray-800/70 transition-all duration-200 group">
                                <div className="flex items-center space-x-4">
                                  {/* Company avatar with initials */}
                                  <div className={`w-12 h-12 bg-gradient-to-br ${getCompanyColor(company.company)} rounded-xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-200`}>
                                    <span className="text-white font-bold text-sm">
                                      {getCompanyInitials(company.company)}
                                    </span>
                                  </div>
                                  
                                  {/* Rank badge */}
                                  <div className="w-6 h-6 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-full flex items-center justify-center">
                                    <span className="text-white font-bold text-xs">#{index + 1}</span>
                                  </div>
                                  
                                  <div className="flex-1 min-w-0">
                                    <p className="text-white font-semibold truncate group-hover:text-blue-300 transition-colors">
                                      {company.company}
                                    </p>
                                    <div className="flex items-center space-x-3 mt-1">
                                      <p className="text-sm text-gray-400">
                                        {company.count} application{company.count !== 1 ? 's' : ''}
                                      </p>
                                      <div className="flex items-center space-x-1">
                                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                                        <span className="text-xs text-green-400">
                                          {((company.count / analytics.topCompanies.reduce((sum, c) => sum + c.count, 0)) * 100).toFixed(1)}% of total
                                        </span>
                                      </div>
                                    </div>
                                    {company.isPlaceholder && (
                                      <p className="text-xs text-orange-300 mt-1">
                                        💡 Company names could not be automatically extracted from job descriptions
                                      </p>
                                    )}
                                  </div>
                                </div>
                                
                                {/* Progress bar */}
                                <div className="w-32 ml-4">
                                  <div className="w-full bg-gray-700 rounded-full h-4 relative overflow-hidden">
                                    <div 
                                      className="bg-gradient-to-r from-green-400 to-blue-500 h-4 rounded-full transition-all duration-500 ease-out group-hover:from-green-300 group-hover:to-blue-400"
                                      style={{ width: `${(company.count / analytics.topCompanies[0].count) * 100}%` }}
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                      <span className="text-white text-xs font-medium">
                                        {company.count}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        
                        {analytics.topCompanies.length > 8 && (
                          <div className="mt-4 text-center">
                            <p className="text-sm text-gray-400">
                              Showing top 8 of {analytics.topCompanies.length} companies
                            </p>
                          </div>
                        )}
                        
                        {/* Summary stats */}
                        <div className="mt-6 p-4 bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-500/30 rounded-lg">
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-center">
                            <div>
                              <p className="text-2xl font-bold text-blue-300">
                                {analytics.topCompanies.filter(c => !c.isPlaceholder).length}
                              </p>
                              <p className="text-sm text-blue-200">Companies Identified</p>
                            </div>
                            <div>
                              <p className="text-2xl font-bold text-green-300">
                                {analytics.topCompanies.reduce((sum, c) => sum + c.count, 0)}
                              </p>
                              <p className="text-sm text-green-200">Total Applications</p>
                            </div>
                            <div className="col-span-2 md:col-span-1">
                              <p className="text-2xl font-bold text-purple-300">
                                {analytics.topCompanies.length > 0 ? (analytics.topCompanies.reduce((sum, c) => sum + c.count, 0) / analytics.topCompanies.filter(c => !c.isPlaceholder).length || 1).toFixed(1) : '0'}
                              </p>
                              <p className="text-sm text-purple-200">Avg. per Company</p>
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-8">
                        <div className="w-16 h-16 bg-gradient-to-br from-gray-600 to-gray-700 rounded-xl flex items-center justify-center mx-auto mb-4">
                          <Building2 className="h-8 w-8 text-gray-400" />
                        </div>
                        <h5 className="text-lg font-semibold text-gray-300 mb-2">No Company Data Available</h5>
                        <p className="text-sm text-gray-400 mb-4">
                          {analytics.totalSessions > 0 
                            ? "Company names couldn't be extracted from your job descriptions. Try including clearer company information in your next applications." 
                            : "Create your first resume application to see company analytics here."}
                        </p>
                        {analytics.totalSessions === 0 && (
                          <button
                            onClick={() => navigate('/tailor')}
                            className="btn-primary text-sm flex items-center mx-auto"
                          >
                            <Sparkles className="h-4 w-4 mr-2" />
                            Create First Application
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Keyword Analytics */}
                {keywordAnalytics.length > 0 && (
                  <div className="bg-gray-800/30 rounded-lg p-6">
                    <h4 className="text-lg font-bold text-white mb-4 flex items-center">
                      <Hash className="h-5 w-5 mr-2" />
                      Popular Keywords in Your Applications
                    </h4>
                    <div className="flex flex-wrap gap-3">
                      {keywordAnalytics.slice(0, 30).map((keyword, index) => (
                        <div key={index} className="relative group">
                          <span className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-300 px-4 py-2 rounded-full text-sm border border-blue-500/30 hover:border-blue-400/50 transition-colors">
                            {keyword.keyword}
                          </span>
                          <div className="absolute bottom-full left-[50%] transform -translate-x-[50%] bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity mb-2 whitespace-nowrap">
                            Used {keyword.frequency} times
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Filters and Search */}
        <div className="card spotlight-card mb-8">
          <div className="card-body">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <div className="flex flex-col sm:flex-row gap-4 flex-1">
                {/* Search */}
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-[50%] transform -translate-y-[50%] h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search sessions, companies, job descriptions..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="input-field pl-10"
                  />
                </div>

                {/* Sort */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="input-field min-w-[120px]"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="name">Session ID</option>
                </select>

                {/* Filter */}
                <select
                  value={filterBy}
                  onChange={(e) => setFilterBy(e.target.value)}
                  className="input-field min-w-[120px]"
                >
                  <option value="all">All Sessions</option>
                  <option value="successful">Successful Only</option>
                  <option value="failed">Failed Only</option>
                </select>

                {/* Company Filter */}
                <select
                  value={companyFilter}
                  onChange={(e) => setCompanyFilter(e.target.value)}
                  className="input-field min-w-[140px]"
                >
                  <option value="all">All Companies</option>
                  <option value="unknown">Unknown Company</option>
                  {/* Generate unique company options */}
                  {Array.from(new Set(
                    sessions
                      .map(session => session.company)
                      .filter(company => company && company !== 'Unknown Company')
                  )).sort().map(company => (
                    <option key={company} value={company}>
                      {company}
                    </option>
                  ))}
                </select>
              </div>

              {/* Clear All */}
              {sessions.length > 0 && (
                <button
                  onClick={clearAllSessions}
                  className="btn-secondary text-red-400 border-red-400 hover:bg-red-400 hover:text-white flex items-center"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear All
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Sessions List */}
        {filteredSessions.length === 0 ? (
          <div className="card spotlight-card">
            <div className="card-body text-center py-12">
              <Archive className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">
                {sessions.length === 0 ? 'No Resume Optimizations Yet' : 'No Sessions Found'}
              </h3>
              <p className="text-gray-400 mb-6">
                {sessions.length === 0 
                  ? 'Start tailoring your resume for different job opportunities to see them here.'
                  : 'Try adjusting your search or filter criteria.'
                }
              </p>
              {sessions.length === 0 && (
                <button
                  onClick={() => navigate('/tailor')}
                  className="btn-primary flex items-center mx-auto"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Create Your First Optimization
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredSessions.map((session) => (
              <div key={session.sessionId} className="card spotlight-card">
                <div className="card-body">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          session.compilationResult?.success 
                            ? 'bg-green-500/20 text-green-400' 
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {session.compilationResult?.success ? (
                            <CheckCircle className="h-5 w-5" />
                          ) : (
                            <AlertCircle className="h-5 w-5" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-white truncate">
                            {getJobTitle(session.jobDescription)}
                          </h3>
                          <p className="text-sm text-gray-400 font-mono">
                            Session: {session.sessionId}
                          </p>
                          {/* Display company name prominently */}
                          {session.company && session.company !== 'Unknown Company' && (
                            <div className="flex items-center space-x-2 mt-1">
                              <Building2 className="h-3 w-3 text-blue-400" />
                              <p className="text-sm text-blue-300 font-medium truncate">
                                {session.company}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-400">Date:</span>
                          <p className="text-white">{formatDate(session.metadata?.timestamp)}</p>
                        </div>
                        <div>
                          <span className="text-gray-400">Resume Size:</span>
                          <p className="text-white">{formatFileSize(session.metadata?.tailoredResumeLength)}</p>
                        </div>
                        <div>
                          <span className="text-gray-400">Job Desc:</span>
                          <p className="text-white">{formatFileSize(session.metadata?.jobDescriptionLength)}</p>
                        </div>
                        <div>
                          <span className="text-gray-400">Status:</span>
                          <p className={session.compilationResult?.success ? 'text-green-400' : 'text-red-400'}>
                            {session.compilationResult?.success ? 'Success' : 'Failed'}
                          </p>
                        </div>
                      </div>

                      {session.jobDescription && (
                        <div className="mt-3 p-3 bg-gray-800/50 rounded-lg">
                          <p className="text-xs text-gray-400 mb-1">Job Description Preview:</p>
                          <p className="text-sm text-gray-300 line-clamp-2">
                            {session.jobDescription.substring(0, 200)}...
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col space-y-2 ml-4">
                      <button
                        onClick={() => handleViewResults(session.sessionId)}
                        className="btn-primary text-sm flex items-center"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </button>
                      
                      {session.compilationResult?.success && (
                        <button
                          onClick={() => handleDownloadPDF(session.sessionId)}
                          className="btn-secondary text-sm flex items-center"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          PDF
                        </button>
                      )}
                      
                      <button
                        onClick={() => handleDeleteSession(session.sessionId)}
                        className="btn-secondary text-red-400 border-red-400 hover:bg-red-400 hover:text-white text-sm flex items-center"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Help Section */}
        <div className="mt-12 bg-gradient-to-r from-blue-900/30 to-blue-800/30 border border-blue-500/30 rounded-xl p-8 backdrop-blur-sm">
          <h3 className="text-xl font-bold text-blue-300 mb-6 flex items-center">
            <Sparkles className="h-6 w-6 mr-3" />
            Dashboard Features
          </h3>
          <ul className="text-blue-200 space-y-4">
            <li className="flex items-center group">
              <CheckCircle className="h-5 w-5 mr-3 text-blue-400 group-hover:text-green-400 transition-colors" />
              Track all your resume optimization sessions in one place
            </li>
            <li className="flex items-center group">
              <CheckCircle className="h-5 w-5 mr-3 text-blue-400 group-hover:text-green-400 transition-colors" />
              Search and filter sessions by job description, date, or status
            </li>
            <li className="flex items-center group">
              <CheckCircle className="h-5 w-5 mr-3 text-blue-400 group-hover:text-green-400 transition-colors" />
              Quickly re-download PDFs or view detailed comparison results
            </li>
            <li className="flex items-center group">
              <CheckCircle className="h-5 w-5 mr-3 text-blue-400 group-hover:text-green-400 transition-colors" />
              Monitor your success rate and manage storage space
            </li>
          </ul>
        </div>
      </div>

      {/* Filename Modal */}
      <FilenameModal
        isOpen={showFilenameModal}
        onClose={() => setShowFilenameModal(false)}
        onConfirm={handleFilenameConfirm}
        sessionId={downloadSessionId}
        defaultFilename={downloadSessionId ? `tailored_resume_${downloadSessionId}` : ''}
      />
    </div>
  );
};

export default DashboardPage; 