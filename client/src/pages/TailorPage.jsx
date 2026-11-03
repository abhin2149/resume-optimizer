import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { toast } from 'react-toastify';
import { 
  Upload, 
  FileText, 
  Briefcase, 
  Loader2, 
  AlertCircle,
  CheckCircle,
  Sparkles
} from 'lucide-react';

import { tailorResume, extractKeywords, getBaseResume, uploadResume } from '../services/api';
import CompanyNameModal from '../components/CompanyNameModal';

const TailorPage = () => {
  const navigate = useNavigate();
  const [jobDescription, setJobDescription] = useState('');
  const [customResumeId, setCustomResumeId] = useState(null);
  const [customResumeContent, setCustomResumeContent] = useState('');
  const [customResumeName, setCustomResumeName] = useState('');
  const [useCustomResume, setUseCustomResume] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const [extractedKeywords, setExtractedKeywords] = useState([]);
  const [showKeywords, setShowKeywords] = useState(false);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [companyName, setCompanyName] = useState('');

  // Handle file drop for resume upload
  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file) {
      try {
        setIsLoading(true);
        console.log('[TAILOR] Uploading resume file:', file.name);
        
        const response = await uploadResume(file);
        
        if (response.success) {
          setCustomResumeContent(response.resume.content);
          setCustomResumeId(response.resume.id);
          setCustomResumeName(response.resume.name);
          setUseCustomResume(true);
          toast.success('.tex file uploaded and saved successfully!');
          console.log('[TAILOR] Resume saved with ID:', response.resume.id);
        } else {
          throw new Error(response.error || 'Failed to upload resume');
        }
      } catch (error) {
        toast.error('Error uploading file. Please try again.');
        console.error('File upload error:', error);
      } finally {
        setIsLoading(false);
      }
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.tex'],
      'application/x-latex': ['.tex'],
      'application/x-tex': ['.tex']
    },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024, // 5MB
    validator: (file) => {
      if (!file.name.toLowerCase().endsWith('.tex')) {
        toast.error('Only .tex files are allowed. Please upload a LaTeX resume file.');
        return {
          code: 'file-invalid-type',
          message: 'Only .tex files are allowed. Please upload a LaTeX resume file.'
        };
      }
      return null;
    }
  });

  // Extract keywords from job description
  const handleExtractKeywords = async () => {
    if (!jobDescription.trim()) {
      toast.error('Please enter a job description first');
      return;
    }

    try {
      setIsLoading(true);
      const response = await extractKeywords(jobDescription);
      setExtractedKeywords(response.keywords);
      setShowKeywords(true);
      toast.success(`Extracted ${response.keywords.length} keywords`);
    } catch (error) {
      toast.error('Failed to extract keywords');
      console.error('Keyword extraction error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Show company name modal when tailor button is clicked
  const handleTailorResume = async (e) => {
    e.preventDefault();
    
    if (!jobDescription.trim()) {
      toast.error('Please enter a job description');
      return;
    }

    // Show the company name modal instead of directly tailoring
    setShowCompanyModal(true);
  };

  // Handle company name confirmation and start tailoring
  const handleCompanyNameConfirm = async (enteredCompanyName) => {
    setCompanyName(enteredCompanyName);
    setShowCompanyModal(false);
    
    // Now perform the actual tailoring with the provided company name
    await performTailoring(enteredCompanyName);
  };

  // Main tailoring function (extracted from original handleTailorResume)
  const performTailoring = async (providedCompanyName) => {
    try {
      setIsLoading(true);
      setProgress(0);
      setProgressMessage('Starting resume tailoring...');
      
      // Show timeout warning after 30 seconds
      const timeoutWarning = setTimeout(() => {
        setShowTimeoutWarning(true);
        setProgress(25);
        setProgressMessage('Processing job description and extracting keywords...');
      }, 30000);
      
      // Progress simulation for better UX
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev < 90) {
            return prev + Math.random() * 10;
          }
          return prev;
        });
      }, 2000);
      
      // Show timeout warning toast after 2 minutes
      const timeoutToast = setTimeout(() => {
        toast.info('Resume tailoring is still in progress. This typically takes 2-3 minutes.', {
          duration: 10000, // 10 seconds
          position: 'top-center'
        });
      }, 120000); // 2 minutes
      
      // First, get the original resume content for comparison
      let originalResumeContent = '';
      if (useCustomResume && customResumeContent.trim()) {
        originalResumeContent = customResumeContent.trim();
      } else {
        // Fetch the base resume content before tailoring
        try {
          const baseResumeData = await getBaseResume();
          originalResumeContent = baseResumeData.content || '';
        } catch (error) {
          console.error('Failed to fetch base resume for comparison:', error);
          toast.warning('Could not load original resume for comparison, but tailoring will continue');
        }
      }

      // Prepare the payload for tailoring with manual company name
      const payload = {
        jobDescription: jobDescription.trim(),
        companyName: providedCompanyName, // Add the manually entered company name
      };

      if (useCustomResume && customResumeId) {
        // Only use uploaded resume files (stored in database)
        payload.customResumeId = customResumeId;
        console.log('[TAILOR] Using uploaded resume file with ID:', customResumeId);
      }

      console.log('[TAILOR] Using manual company name:', providedCompanyName);

      // Now perform the tailoring
      const response = await tailorResume(payload);
      
      if (response.success) {
        // Clear timeouts and intervals
        clearTimeout(timeoutWarning);
        clearTimeout(timeoutToast);
        clearInterval(progressInterval);
        setProgress(100);
        setProgressMessage('Resume tailored successfully!');
        
        // Prepare data for immediate navigation (ResultsPage will fetch from DB as backup)
        const resultData = {
          originalTex: originalResumeContent,
          revisedTex: response.revisedTex,
          compilationResult: response.compilationResult,
          validationResult: response.validationResult,
          metadata: response.metadata,
          jobDescription: jobDescription.trim(),
          companyName: providedCompanyName // Include company name in result data
        };
        
        // Note: No longer storing to localStorage since ResultsPage now fetches from database
        // Only store temporarily if the user explicitly wants offline capability
        if (navigator.onLine === false) {
          console.log('[TAILOR] Offline detected, storing to localStorage as backup');
          localStorage.setItem(`resume_${response.sessionId}`, JSON.stringify(resultData));
        }
        
        toast.success(`Resume tailored successfully for ${providedCompanyName}!`);
        navigate(`/results/${response.sessionId}`, {
          state: {
            tailoredData: resultData
          }
        });
      } else {
        toast.error(response.error || 'Failed to tailor resume');
      }
    } catch (error) {
      console.error('Tailoring error:', error);
      
      // Clear timeouts and intervals
      clearTimeout(timeoutWarning);
      clearTimeout(timeoutToast);
      clearInterval(progressInterval);
      
      let errorMessage = 'An error occurred while tailoring the resume';
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    } finally {
      // Clear timeouts and intervals
      clearTimeout(timeoutWarning);
      clearTimeout(timeoutToast);
      clearInterval(progressInterval);
      setIsLoading(false);
      setProgress(0);
      setProgressMessage('');
      setShowTimeoutWarning(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Company Name Modal */}
      <CompanyNameModal
        isOpen={showCompanyModal}
        onClose={() => setShowCompanyModal(false)}
        onConfirm={handleCompanyNameConfirm}
        defaultCompany=""
      />
      
      {/* Timeout Warning Modal */}
      {showTimeoutWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg max-w-md mx-4">
            <h3 className="text-lg font-semibold text-white mb-4">Resume Tailoring in Progress</h3>
            <p className="text-gray-300 mb-4">
              This process typically takes 2-3 minutes. Please don't close this page or refresh while it's running.
            </p>
            <div className="w-full bg-gray-700 rounded-full h-2 mb-4">
              <div 
                className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm text-gray-400 text-center">{progressMessage}</p>
            <button
              onClick={() => setShowTimeoutWarning(false)}
              className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Got it, continue waiting
            </button>
          </div>
        </div>
      )}
      
      <div className="container-responsive py-12">
        <div className="max-w-5xl mx-auto">
          {/* Header Section */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl mb-6 shadow-2xl shadow-blue-500/25">
              <Sparkles className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-5xl font-bold text-white mb-6">
              Tailor Your Resume
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
              Upload a job description and we'll optimize your LaTeX resume 
              with relevant keywords and tailored content using advanced AI.
            </p>
          </div>

          <form onSubmit={handleTailorResume} className="space-y-8">
            {/* Job Description Section */}
            <div className="bg-white rounded-xl shadow-2xl border-2 border-blue-200 backdrop-blur-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600"></div>
              <div className="px-6 py-6">
                <div className="flex items-center mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                    <Briefcase className="h-6 w-6 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-800">
                    Job Description
                  </h2>
                </div>
                
                <div className="space-y-6">
                  <div className="relative">
                    <textarea
                      value={jobDescription}
                      onChange={(e) => setJobDescription(e.target.value)}
                      placeholder="Paste the complete job description here..."
                      className="block w-full px-4 py-3 border-2 border-blue-200 rounded-lg shadow-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-blue-50/50 text-gray-800 backdrop-blur-sm h-64 resize-none"
                      required
                    />
                    <div className="absolute bottom-4 right-4 text-sm text-gray-600 bg-white/90 px-3 py-1 rounded-lg backdrop-blur-sm border border-blue-200">
                      {jobDescription.length} characters
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-4">
                    <button
                      type="button"
                      onClick={handleExtractKeywords}
                      disabled={isLoading || !jobDescription.trim()}
                      className="btn-secondary flex items-center group"
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2 group-hover:text-green-400 transition-colors" />
                      )}
                      Extract Keywords
                    </button>
                  </div>

                  {/* Keywords Display */}
                  {showKeywords && extractedKeywords.length > 0 && (
                    <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-6 rounded-xl border-2 border-blue-200 backdrop-blur-sm">
                      <h3 className="font-bold text-blue-700 mb-4 flex items-center">
                        <Sparkles className="h-5 w-5 mr-2" />
                        Extracted Keywords ({extractedKeywords.length})
                      </h3>
                      <div className="flex flex-wrap gap-3">
                        {extractedKeywords.slice(0, 20).map((keyword, index) => (
                          <span
                            key={index}
                            className="bg-blue-500 text-white px-4 py-2 rounded-full text-sm border border-blue-600 backdrop-blur-sm hover:bg-blue-600 transition-colors duration-300 shadow-sm"
                          >
                            {keyword}
                          </span>
                        ))}
                        {extractedKeywords.length > 20 && (
                          <span className="text-blue-600 text-sm self-center font-medium">
                            +{extractedKeywords.length - 20} more keywords...
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Resume Upload Section */}
            <div className="bg-white rounded-xl shadow-2xl border-2 border-green-200 backdrop-blur-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-400 via-green-500 to-green-600"></div>
              <div className="px-6 py-6">
                <div className="flex items-center mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                    <FileText className="h-6 w-6 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-800">
                    Resume Template
                  </h2>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center space-x-6">
                    <label className="flex items-center space-x-3 cursor-pointer group">
                      <input
                        type="radio"
                        name="resumeOption"
                        checked={!useCustomResume}
                        onChange={() => setUseCustomResume(false)}
                        className="w-4 h-4 text-green-600 border-green-300 bg-white focus:ring-green-500 focus:ring-2"
                      />
                      <span className="text-gray-700 group-hover:text-gray-900 transition-colors font-medium">Use default template</span>
                    </label>
                    <label className="flex items-center space-x-3 cursor-pointer group">
                      <input
                        type="radio"
                        name="resumeOption"
                        checked={useCustomResume}
                        onChange={() => setUseCustomResume(true)}
                        className="w-4 h-4 text-green-600 border-green-300 bg-white focus:ring-green-500 focus:ring-2"
                      />
                      <span className="text-gray-700 group-hover:text-gray-900 transition-colors font-medium">Upload custom resume</span>
                    </label>
                  </div>

                  {useCustomResume && (
                    <div>
                      {/* File Drop Zone */}
                      <div
                        {...getRootProps()}
                        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 backdrop-blur-sm ${
                          isDragActive
                            ? 'border-green-500 bg-green-500/10 shadow-lg shadow-green-500/25'
                            : 'border-green-300 hover:border-green-500 hover:bg-green-50'
                        }`}
                      >
                        <input {...getInputProps()} />
                        <Upload className="h-16 w-16 text-green-400 mx-auto mb-4" />
                        {isDragActive ? (
                          <p className="text-green-600 font-medium text-lg">
                            Drop your .tex file here...
                          </p>
                        ) : (
                          <>
                            <p className="text-gray-700 font-medium mb-2 text-lg">
                              Drag & drop your LaTeX resume file here
                            </p>
                            <p className="text-sm text-gray-600">
                              or click to browse (.tex files only, max 5MB)
                            </p>
                          </>
                        )}
                      </div>



                      {customResumeId && (
                        <div className="mt-6 p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-xl border-2 border-green-200 backdrop-blur-sm">
                          <div className="flex items-center">
                            <CheckCircle className="h-5 w-5 text-green-600 mr-3" />
                            <div>
                              <span className="text-green-700 font-medium">
                                Resume uploaded and saved to database
                                ({customResumeContent.length} characters)
                              </span>
                              {customResumeName && (
                                <p className="text-sm text-green-600 mt-1">
                                  File: {customResumeName}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {!useCustomResume && (
                    <div className="bg-gradient-to-r from-green-50 to-green-100 p-6 rounded-xl border-2 border-green-200 backdrop-blur-sm">
                      <div className="flex items-center">
                        <AlertCircle className="h-5 w-5 text-green-600 mr-3" />
                        <span className="text-gray-700">
                          Using the default resume template. This will be tailored for your job description.
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-center pt-8">
              <button
                type="submit"
                disabled={isLoading || !jobDescription.trim()}
                className="btn-primary text-lg px-12 py-4 flex items-center text-white font-bold shadow-2xl shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-300 transform hover:scale-105"
              >
                {isLoading ? (
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-2">
                      <Loader2 className="h-6 w-6 mr-3 animate-spin" />
                      Processing Magic...
                    </div>
                    {progress > 0 && (
                      <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
                        <div 
                          className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    )}
                    {progressMessage && (
                      <div className="text-sm text-gray-300">{progressMessage}</div>
                    )}
                  </div>
                ) : (
                  <>
                    <Sparkles className="h-6 w-6 mr-3" />
                    Tailor Resume with AI
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Info Cards */}
          <div className="grid md:grid-cols-3 gap-8 mt-20">
            <div className="text-center p-8 bg-gray-800/50 rounded-2xl shadow-xl border border-gray-700/50 backdrop-blur-sm hover:border-blue-500/30 transition-all duration-300 group spotlight-card">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <FileText className="h-8 w-8 text-white" />
              </div>
              <h3 className="font-bold text-white mb-4 text-xl">LaTeX Preservation</h3>
              <p className="text-gray-300 leading-relaxed">
                All formatting, structure, and LaTeX commands are preserved exactly as they are.
              </p>
            </div>

            <div className="text-center p-8 bg-gray-800/50 rounded-2xl shadow-xl border border-gray-700/50 backdrop-blur-sm hover:border-green-500/30 transition-all duration-300 group spotlight-card">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <CheckCircle className="h-8 w-8 text-white" />
              </div>
              <h3 className="font-bold text-white mb-4 text-xl">Keyword Optimization</h3>
              <p className="text-gray-300 leading-relaxed">
                Content is optimized with relevant keywords while maintaining authenticity.
              </p>
            </div>

            <div className="text-center p-8 bg-gray-800/50 rounded-2xl shadow-xl border border-gray-700/50 backdrop-blur-sm hover:border-purple-500/30 transition-all duration-300 group spotlight-card">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <Briefcase className="h-8 w-8 text-white" />
              </div>
              <h3 className="font-bold text-white mb-4 text-xl">Job-Specific</h3>
              <p className="text-gray-300 leading-relaxed">
                Each resume is tailored specifically for the job description provided.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TailorPage; 