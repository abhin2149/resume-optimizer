import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';

import ReactDiffViewer from 'react-diff-viewer-continued';
import { Document, Page, pdfjs } from 'react-pdf';
import { 
  Download, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw,
  ArrowLeft,
  Eye,
  Code,
  Sparkles,
  Monitor,
  GitCompare,
  Briefcase,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Hash,
  BarChart3,
  Copy,
  Plus,
  Minus
} from 'lucide-react';
import { toast } from 'react-toastify';

import api, { downloadPDF, getBaseResume } from '../services/api';
import FilenameModal from '../components/FilenameModal';

// Configure PDF.js worker - use local file to avoid CDN issues
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

const ResultsPage = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [originalResume, setOriginalResume] = useState('');
  const [tailoredResume, setTailoredResume] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [compilationResult, setCompilationResult] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [activeTab, setActiveTab] = useState('summary');
  const [metadata, setMetadata] = useState(null);
  
  // PDF-specific state
  const [originalPdfPages, setOriginalPdfPages] = useState(null);
  const [tailoredPdfPages, setTailoredPdfPages] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfScale, setPdfScale] = useState(1.6);
  const [originalPdfLoading, setOriginalPdfLoading] = useState(false);
  const [tailoredPdfLoading, setTailoredPdfLoading] = useState(false);
  const [originalPdfError, setOriginalPdfError] = useState(null);
  const [tailoredPdfError, setTailoredPdfError] = useState(null);
  const [sessionData, setSessionData] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  
  // Filename modal state
  const [showFilenameModal, setShowFilenameModal] = useState(false);

  useEffect(() => {
    const loadSessionData = async () => {
      // Priority order: navigation state > database > localStorage
      const navigationState = navigate.state;
      
      if (navigationState?.tailoredData) {
        // Direct navigation from tailor page
        const { 
          originalTex, 
          revisedTex, 
          compilationResult: compResult, 
          metadata: meta, 
          jobDescription: jd,
          validationResult: validationRes
        } = navigationState.tailoredData;
        setOriginalResume(originalTex || '');
        setTailoredResume(revisedTex);
        setJobDescription(jd || '');
        // Ensure compilation result has a log for navigation state
        const compilationRes = compResult || {};
        if (!compilationRes.compilationLog) {
          compilationRes.compilationLog = compilationRes.success 
            ? `✅ PDF compilation completed successfully\n✅ LaTeX validation passed\n✅ Output file generated`
            : `❌ PDF compilation failed\n${compilationRes.error || 'Unknown error occurred'}`;
        }
        setCompilationResult(compilationRes);
        setMetadata(meta);
        setValidationResult(validationRes);
        setSessionData(null); // No DB session data available
        return;
      }

      // Try to fetch from database first
      try {
        console.log('[RESULTS] Fetching session data from database:', sessionId);
        const response = await api.get(`/sessions/${sessionId}`);
        
        if (response.data.success) {
          const session = response.data.session;
          console.log('[RESULTS] Database session loaded:', session);
          
          // Store full session data
          setSessionData(session);
          
          // Set basic session data
          setTailoredResume(session.tailored_content || '');
          // Set job description (may be limited to title for historical sessions)
          const jobDesc = session.original_job_description || session.job_description || 
                          (session.job_title ? `Job Title: ${session.job_title}\n\n[Full job description not available for historical sessions]` : 'Job Description');
          setJobDescription(jobDesc);
          // Generate compilation log from available data
          const generateCompilationLog = () => {
            const success = session.latex_compilation_success || false;
            const error = session.latex_compilation_error;
            const timeMs = session.latex_compilation_time_ms;
            
            let log = `LaTeX Compilation Report\n`;
            log += `========================\n`;
            log += `Session ID: ${session.session_id}\n`;
            log += `Timestamp: ${new Date(session.created_at).toLocaleString()}\n`;
            log += `Processing Time: ${timeMs ? timeMs + 'ms' : 'Unknown'}\n`;
            log += `Status: ${success ? 'SUCCESS' : 'FAILED'}\n\n`;
            
            if (success) {
              log += `✅ PDF compilation completed successfully\n`;
              log += `✅ LaTeX validation passed\n`;
              log += `✅ Output file generated\n`;
              if (session.pdf_file_size) {
                log += `✅ PDF size: ${Math.round(session.pdf_file_size / 1024)} KB\n`;
              }
            } else {
              log += `❌ PDF compilation failed\n`;
              if (error) {
                log += `\nError Details:\n`;
                log += `${error}\n`;
              }
              log += `\nTroubleshooting:\n`;
              log += `- Check LaTeX syntax in the source\n`;
              log += `- Verify all required packages are included\n`;
              log += `- Ensure proper escaping of special characters\n`;
            }
            
            return log;
          };

          setCompilationResult({
            success: session.latex_compilation_success || false,
            error: session.latex_compilation_error,
            compilationLog: generateCompilationLog()
          });
          setMetadata({
            timestamp: session.created_at,
            tailoredResumeLength: session.tailored_content_length,
            originalResumeLength: session.original_content_length,
            processingTime: session.processing_time_ms,
            jobDescriptionLength: jobDesc.length
          });
          
          // Load original resume content
          if (session.original_resume_content) {
            // Use content from session if available
            setOriginalResume(session.original_resume_content);
          } else if (session.original_resume_id) {
            // Fetch original resume from database by ID
            try {
              console.log('[RESULTS] Fetching original resume from database:', session.original_resume_id);
              const resumeResponse = await api.get(`/resumes/${session.original_resume_id}`);
              if (resumeResponse.data.success) {
                setOriginalResume(resumeResponse.data.resume.content);
                console.log('[RESULTS] Original resume loaded from database');
              } else {
                console.warn('[RESULTS] Failed to load original resume:', resumeResponse.data.error);
                setOriginalResume(''); // Fallback to empty
              }
            } catch (resumeError) {
              console.warn('[RESULTS] Error fetching original resume:', resumeError.message);
              setOriginalResume(''); // Fallback to empty
            }
          } else {
            // No original resume available
            setOriginalResume('');
          }
          
          return;
        }
      } catch (error) {
        console.warn('[RESULTS] Failed to load from database:', error.message);
      }

      // Fallback to localStorage
      const savedData = localStorage.getItem(`resume_${sessionId}`);
      if (savedData) {
        try {
          console.log('[RESULTS] Loading from localStorage fallback');
          const data = JSON.parse(savedData);
          setOriginalResume(data.originalTex || '');
          setTailoredResume(data.revisedTex);
          setJobDescription(data.jobDescription || '');
          // Ensure compilation result has a log
        const compResult = data.compilationResult || {};
        if (!compResult.compilationLog) {
          compResult.compilationLog = compResult.success 
            ? `✅ PDF compilation completed successfully\n✅ LaTeX validation passed\n✅ Output file generated`
            : `❌ PDF compilation failed\n${compResult.error || 'Unknown error occurred'}`;
        }
        setCompilationResult(compResult);
          setMetadata(data.metadata);
          setValidationResult(data.validationResult);
          setSessionData(null); // No DB session data available
        } catch (error) {
          console.error('Error parsing saved data:', error);
          toast.error('Error loading resume data');
          navigate('/tailor');
        }
      } else {
        toast.warning('No resume data found. Please tailor a resume first.');
        navigate('/tailor');
      }
    };

    loadSessionData();
  }, [sessionId, navigate]);

  // Fallback: If original resume is missing, try to fetch base resume
  useEffect(() => {
    const fetchOriginalResume = async () => {
      if (!originalResume && tailoredResume) {
        console.log('Original resume missing, attempting to fetch base resume...');
        try {
          const baseResumeData = await getBaseResume();
          if (baseResumeData.success && baseResumeData.content) {
            setOriginalResume(baseResumeData.content);
            console.log('Base resume loaded as fallback for comparison');
          }
        } catch (error) {
          console.error('Failed to fetch base resume as fallback:', error);
        }
      }
    };

    fetchOriginalResume();
  }, [originalResume, tailoredResume]);

  // PDF loading handlers
  const onOriginalPdfLoadSuccess = ({ numPages }) => {
    setOriginalPdfPages(numPages);
    setOriginalPdfLoading(false);
    setOriginalPdfError(null);
  };

  const onTailoredPdfLoadSuccess = ({ numPages }) => {
    setTailoredPdfPages(numPages);
    setTailoredPdfLoading(false);
    setTailoredPdfError(null);
  };

  const onOriginalPdfLoadError = (error) => {
    setOriginalPdfLoading(false);
    setOriginalPdfError(`Failed to load original PDF: ${error.message || error}`);
    console.error('Original PDF load error:', error);
    console.error('PDF URL being loaded:', '/api/base-resume-pdf');
  };

  const onTailoredPdfLoadError = (error) => {
    setTailoredPdfLoading(false);
    setTailoredPdfError(`Failed to load tailored PDF: ${error.message || error}`);
    console.error('Tailored PDF load error:', error);
    console.error('PDF URL being loaded:', `/output/resume_${sessionId}.pdf`);
  };

  // PDF navigation helpers
  const goToPreviousPage = () => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  };

  const goToNextPage = () => {
    const maxPages = tailoredPdfPages || 0;
    setCurrentPage(prev => Math.min(maxPages, prev + 1));
  };

  const zoomIn = () => {
    setPdfScale(prev => Math.min(2.0, prev + 0.2));
  };

  const zoomOut = () => {
    setPdfScale(prev => Math.max(0.5, prev - 0.2));
  };

  const resetZoom = () => {
    setPdfScale(1.6);
  };

  const handleDownloadPDF = () => {
    if (!compilationResult?.success) {
      toast.error('PDF is not available. Compilation failed.');
      return;
    }

    // Show filename modal
    setShowFilenameModal(true);
  };

  const handleFilenameConfirm = async (customFilename) => {
    try {
      setIsDownloading(true);
      // Note: Downloads clean PDF compiled from pure LaTeX source
      // No highlighting or UI markup is included in the final PDF
      await downloadPDF(sessionId, customFilename);
      toast.success('PDF downloaded successfully!');
    } catch (error) {
      // Handle authentication errors more gracefully
      if (error.message.includes('Authentication required') || error.message.includes('Authentication failed')) {
        toast.error('Please sign in to download PDFs');
        console.log('Authentication required for download - user should sign in');
      } else {
        toast.error(error.message || 'Failed to download PDF');
      }
      console.error('Download error:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSaveToFile = () => {
    // Note: Downloads clean LaTeX content without any highlighting markup
    // The highlighting is purely visual in the ReactDiffViewer component
    const blob = new Blob([tailoredResume], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tailored_resume_${sessionId}.tex`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('LaTeX file saved!');
  };

  const formatFileSize = (bytes) => {
    if (bytes === null || bytes === undefined || isNaN(bytes)) return 'N/A';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Copy functions for LaTeX and text content
  const handleCopyLatex = async () => {
    if (!tailoredResume) {
      toast.error('No LaTeX source available to copy');
      return;
    }

    try {
      await navigator.clipboard.writeText(tailoredResume);
      toast.success('LaTeX source copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy LaTeX source:', error);
      toast.error('Failed to copy LaTeX source');
    }
  };

  const handleCopyPlainText = async () => {
    if (!tailoredResume) {
      toast.error('No content available to copy');
      return;
    }

    try {
      // Convert LaTeX to plain text by removing commands and formatting
      const extractPlainText = (latexContent) => {
        let plainText = latexContent;
        
        // Remove document class and packages
        plainText = plainText.replace(/\\documentclass\[.*?\]\{.*?\}/g, '');
        plainText = plainText.replace(/\\usepackage(\[.*?\])?\{.*?\}/g, '');
        
        // Remove common LaTeX commands but keep their content
        plainText = plainText.replace(/\\textbf\{([^}]*)\}/g, '$1'); // Bold
        plainText = plainText.replace(/\\textit\{([^}]*)\}/g, '$1'); // Italic
        plainText = plainText.replace(/\\text\{([^}]*)\}/g, '$1'); // Text
        plainText = plainText.replace(/\\emph\{([^}]*)\}/g, '$1'); // Emphasis
        plainText = plainText.replace(/\\underline\{([^}]*)\}/g, '$1'); // Underline
        plainText = plainText.replace(/\\href\{[^}]*\}\{([^}]*)\}/g, '$1'); // Links
        
        // Remove sectioning commands but keep titles
        plainText = plainText.replace(/\\section\{([^}]*)\}/g, '\n\n$1\n');
        plainText = plainText.replace(/\\subsection\{([^}]*)\}/g, '\n$1\n');
        plainText = plainText.replace(/\\subsubsection\{([^}]*)\}/g, '\n$1\n');
        
        // Remove other common commands
        plainText = plainText.replace(/\\[a-zA-Z]+\*?\[[^\]]*\]/g, ''); // Commands with optional parameters
        plainText = plainText.replace(/\\[a-zA-Z]+\*?\{[^}]*\}/g, ''); // Commands with parameters
        plainText = plainText.replace(/\\[a-zA-Z]+\*?/g, ''); // Simple commands
        
        // Remove special characters and formatting
        plainText = plainText.replace(/[{}]/g, ''); // Remove braces
        plainText = plainText.replace(/\\\\/g, '\n'); // Line breaks
        plainText = plainText.replace(/~/g, ' '); // Non-breaking spaces
        plainText = plainText.replace(/\\&/g, '&'); // Escaped ampersands
        plainText = plainText.replace(/\\\$/g, '$'); // Escaped dollar signs
        plainText = plainText.replace(/\\%/g, '%'); // Escaped percent signs
        plainText = plainText.replace(/\\#/g, '#'); // Escaped hash signs
        
        // Clean up whitespace
        plainText = plainText.replace(/\n\s*\n\s*\n/g, '\n\n'); // Multiple empty lines
        plainText = plainText.replace(/[ \t]+/g, ' '); // Multiple spaces/tabs
        plainText = plainText.replace(/^\s+|\s+$/gm, ''); // Leading/trailing whitespace per line
        plainText = plainText.trim();
        
        return plainText;
      };

      const plainText = extractPlainText(tailoredResume);
      await navigator.clipboard.writeText(plainText);
      toast.success('Plain text content copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy plain text:', error);
      toast.error('Failed to copy plain text');
    }
  };

  // Analyze resume changes using database data (preferred method)
  const analyzeResumeChangesFromDatabase = (sessionData) => {
    const { extracted_keywords = [], resume_modifications = [] } = sessionData;
    
    // Extract keywords that were actually added to the resume
    const addedKeywords = extracted_keywords
      .filter(kw => kw.added_to_resume === true) // Only count keywords actually added to resume
      .map(kw => kw.keyword)
      .slice(0, 15); // Limit for display

    // For debugging: log the keyword analysis
    const totalExtracted = extracted_keywords.length;
    const actuallyAdded = addedKeywords.length;
    const highConfidenceNotAdded = extracted_keywords.filter(kw => kw.confidence_score > 0.7 && !kw.added_to_resume).length;
    
    console.log(`[RESULTS] Keyword Analysis:`, {
      totalExtracted,
      actuallyAdded,
      highConfidenceNotAdded,
      addedKeywords
    });

    // Group modifications by type
    const modificationsMap = {
      targeted_replacement: [], // Individual AI-driven replacements
      keyword_addition: [],
      content_expansion: [],
      content_reduction: [],
      section_addition: [],
      phrase_replacement: [],
      content_change: []
    };

    resume_modifications.forEach(mod => {
      const type = mod.modification_type || 'content_change';
      if (modificationsMap[type]) {
        modificationsMap[type].push(mod);
      } else {
        modificationsMap.content_change.push(mod);
      }
    });

    // Create section changes summary with improved counting
    const sectionChanges = [];
    const sectionMap = new Map();
    
    resume_modifications.forEach(mod => {
      const sectionName = mod.section_name || 'unknown';
      if (!sectionMap.has(sectionName)) {
        sectionMap.set(sectionName, {
          section: sectionName,
          modifications: [],
          newKeywords: [],
          changeType: 'modified'
        });
      }
      
      const section = sectionMap.get(sectionName);
      section.modifications.push(mod);
      
      // Extract keywords from modification reason if it's a keyword addition
      if ((mod.modification_type === 'keyword_addition' || mod.modification_type === 'targeted_replacement') && mod.reason) {
        const keywordMatch = mod.reason.match(/keywords?:\s*([^.]+)/i);
        if (keywordMatch) {
          const keywords = keywordMatch[1].split(',').map(k => k.trim());
          section.newKeywords.push(...keywords);
        }
      }
    });

    Array.from(sectionMap.values()).forEach(section => {
      if (section.modifications.length > 0) {
        sectionChanges.push({
          section: section.section,
          subsection: null,
          changeType: section.modifications.some(m => 
            m.modification_type === 'keyword_addition' || 
            m.modification_type === 'targeted_replacement'
          ) ? 'enhanced' : 'modified',
          description: `${section.modifications.length} modification${section.modifications.length > 1 ? 's' : ''} made`,
          newKeywords: [...new Set(section.newKeywords)], // Remove duplicates
          contentChange: 0 // We don't have exact character counts from database
        });
      }
    });

    // Calculate content differences
    const originalLength = originalResume?.length || 0;
    const tailoredLength = tailoredResume?.length || 0;
    const contentDiff = tailoredLength - originalLength;
    const lines = tailoredResume?.split('\n') || [];
    const originalLines = originalResume?.split('\n') || [];
    const linesDiff = lines.length - originalLines.length;

    // Create modifications summary with improved counting
    const modifications = [];
    
    // Count individual targeted replacements
    const targetedReplacements = modificationsMap.targeted_replacement.length;
    if (targetedReplacements > 0) {
      modifications.push(`Applied ${targetedReplacements} targeted text enhancement${targetedReplacements > 1 ? 's' : ''}`);
    }
    
    if (addedKeywords.length > 0) {
      modifications.push(`Incorporated ${addedKeywords.length} job-relevant keywords`);
    }
    
    if (modificationsMap.keyword_addition.length > 0) {
      modifications.push(`Added ${modificationsMap.keyword_addition.length} strategic keywords`);
    }
    
    if (modificationsMap.content_expansion.length > 0) {
      modifications.push(`Expanded ${modificationsMap.content_expansion.length} sections`);
    }
    
    if (modificationsMap.phrase_replacement.length > 0) {
      modifications.push(`Made ${modificationsMap.phrase_replacement.length} phrase improvements`);
    }
    
    // Count total individual modifications
    const totalModifications = resume_modifications.length;
    const sectionsModified = sectionChanges.length;
    
    if (totalModifications > 0) {
      modifications.push(`Total: ${totalModifications} individual change${totalModifications > 1 ? 's' : ''} across ${sectionsModified} section${sectionsModified > 1 ? 's' : ''}`);
    }

    return {
      contentAdded: Math.max(0, contentDiff),
      contentRemoved: Math.max(0, -contentDiff),
      linesAdded: Math.max(0, linesDiff),
      linesRemoved: Math.max(0, -linesDiff),
      newKeywords: addedKeywords,
      phraseReplacements: modificationsMap.phrase_replacement.map(mod => ({
        from: mod.original_text?.substring(0, 50) || 'Original text',
        to: mod.modified_text?.substring(0, 50) || 'Modified text',
        type: 'enhancement'
      })),
      sectionChanges: sectionChanges,
      modifications,
      totalModifications: totalModifications, // Add this for display
      sectionsModified: sectionsModified, // Add this for display
      summary: modifications.length > 0 
        ? `Resume successfully tailored with ${totalModifications} individual modification${totalModifications > 1 ? 's' : ''} across ${sectionsModified} section${sectionsModified > 1 ? 's' : ''}`
        : 'Resume optimized using database-driven analysis'
    };
  };

  // Analyze changes between original and tailored resume
  const analyzeResumeChanges = () => {
    if (!originalResume || !tailoredResume) {
      return {
        contentAdded: 0,
        contentRemoved: 0,
        newKeywords: [],
        phraseReplacements: [],
        modifications: [],
        sectionChanges: [],
        summary: 'Analysis unavailable - missing resume content'
      };
    }

    // Use database analysis if available (preferred)
    if (sessionData && sessionData.extracted_keywords && sessionData.resume_modifications) {
      console.log('[RESULTS] Using database analysis data');
      return analyzeResumeChangesFromDatabase(sessionData);
    }

    // Fallback to client-side analysis
    console.log('[RESULTS] Using client-side analysis (fallback)');

    // Parse resume sections from LaTeX content
    const parseResumeSections = (content) => {
      const sections = [];
      const lines = content.split('\n');
      let currentSection = null;
      let currentSubsection = null;
      let sectionContent = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Match main sections like \section{Experience}
        const sectionMatch = line.match(/\\section\{([^}]+)\}/);
        if (sectionMatch) {
          // Save previous section if exists
          if (currentSection) {
            sections.push({
              type: 'section',
              name: currentSection,
              subsection: currentSubsection,
              content: sectionContent.join('\n'),
              lineStart: i - sectionContent.length,
              lineEnd: i
            });
          }
          currentSection = sectionMatch[1];
          currentSubsection = null;
          sectionContent = [];
          continue;
        }

        // Match subsections like \subsection{Software Engineer}
        const subsectionMatch = line.match(/\\subsection\{([^}]+)\}/);
        if (subsectionMatch) {
          // Save previous subsection if exists
          if (currentSection && currentSubsection) {
            sections.push({
              type: 'subsection',
              name: currentSection,
              subsection: currentSubsection,
              content: sectionContent.join('\n'),
              lineStart: i - sectionContent.length,
              lineEnd: i
            });
          }
          currentSubsection = subsectionMatch[1];
          sectionContent = [];
          continue;
        }

        // Collect content for current section/subsection
        if (currentSection) {
          sectionContent.push(line);
        }
      }

      // Add final section
      if (currentSection) {
        sections.push({
          type: currentSubsection ? 'subsection' : 'section',
          name: currentSection,
          subsection: currentSubsection,
          content: sectionContent.join('\n'),
          lineStart: lines.length - sectionContent.length,
          lineEnd: lines.length
        });
      }

      return sections;
    };

    const originalLines = originalResume.split('\n');
    const tailoredLines = tailoredResume.split('\n');
    
    // Calculate content changes
    const contentAdded = tailoredResume.length - originalResume.length;
    const linesAdded = tailoredLines.length - originalLines.length;

    // Parse sections from both resumes
    const originalSections = parseResumeSections(originalResume);
    const tailoredSections = parseResumeSections(tailoredResume);

    // Enhanced keyword extraction from job description
    const extractJobKeywords = () => {
      if (!jobDescription) return [];
      
      const text = jobDescription.toLowerCase();
      const stopWords = new Set([
        'the', 'and', 'with', 'that', 'this', 'will', 'have', 'from', 'they', 'been', 
        'were', 'your', 'their', 'would', 'could', 'should', 'what', 'when', 'where', 
        'which', 'who', 'how', 'are', 'for', 'you', 'can', 'our', 'we', 'us', 'an', 'as'
      ]);

      // Extract meaningful phrases (2-4 words) and single important words
      const phrases = [];
      
      // Multi-word technical terms and phrases
      const multiWordMatches = text.match(/\b[a-z]+(?:\s+[a-z]+){1,3}\b/g) || [];
      multiWordMatches.forEach(phrase => {
        if (phrase.length > 6 && !stopWords.has(phrase.split(' ')[0])) {
          phrases.push(phrase.trim());
        }
      });

      // Single technical words
      const words = text.split(/\s+/)
        .filter(word => word.length > 4 && !stopWords.has(word))
        .filter(word => /^[a-z]+$/i.test(word)); // Only alphabetic words

      // Prioritize technical terms, tools, and skills
      const technicalIndicators = [
        'platform', 'framework', 'language', 'technology', 'tool', 'system', 
        'database', 'cloud', 'api', 'software', 'development', 'management',
        'analysis', 'design', 'implementation', 'optimization', 'integration'
      ];

      const prioritizedWords = words.filter(word => 
        technicalIndicators.some(indicator => word.includes(indicator) || indicator.includes(word))
      );

      return [...new Set([...phrases, ...prioritizedWords, ...words])].slice(0, 15);
    };

    // Find exact phrase replacements
    const findPhraseReplacements = () => {
      const replacements = [];
      
      // Clean text for comparison (remove LaTeX commands but keep content)
      const cleanText = (text) => {
        return text
          .replace(/\\[a-zA-Z]+\{([^}]*)\}/g, '$1') // Remove LaTeX commands but keep content
          .replace(/\\[a-zA-Z]+/g, '') // Remove standalone LaTeX commands
          .replace(/[{}]/g, '') // Remove remaining braces
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();
      };

      const originalClean = cleanText(originalResume);
      const tailoredClean = cleanText(tailoredResume);
      
      // Common abbreviation expansions
      const abbreviationMap = {
        'gcp': 'google cloud platform',
        'aws': 'amazon web services',
        'ai': 'artificial intelligence',
        'ml': 'machine learning',
        'api': 'application programming interface',
        'ui': 'user interface',
        'ux': 'user experience',
        'ci/cd': 'continuous integration/continuous deployment',
        'seo': 'search engine optimization',
        'crm': 'customer relationship management',
        'erp': 'enterprise resource planning',
        'saas': 'software as a service',
        'sql': 'structured query language',
        'json': 'javascript object notation',
        'rest': 'representational state transfer',
        'gpu': 'graphics processing unit',
        'cpu': 'central processing unit'
      };

      // Find abbreviation expansions
      Object.entries(abbreviationMap).forEach(([abbrev, expansion]) => {
        const abbrevRegex = new RegExp(`\\b${abbrev}\\b`, 'gi');
        const expansionRegex = new RegExp(`\\b${expansion}\\b`, 'gi');
        
        if (abbrevRegex.test(originalClean) && expansionRegex.test(tailoredClean)) {
          replacements.push({
            from: abbrev.toUpperCase(),
            to: expansion.charAt(0).toUpperCase() + expansion.slice(1),
            type: 'expansion'
          });
        }
      });

      // Find word-level substitutions by comparing common phrases
      const findWordSubstitutions = () => {
        const originalWords = originalClean.toLowerCase().split(/\s+/);
        const tailoredWords = tailoredClean.toLowerCase().split(/\s+/);
        
        // Find words that appear in tailored but not original
        const newWords = tailoredWords.filter(word => 
          word.length > 3 && !originalWords.includes(word)
        );
        
        // Find words that appear in original but not tailored
        const removedWords = originalWords.filter(word => 
          word.length > 3 && !tailoredWords.includes(word)
        );

        // Match similar words (likely replacements)
        removedWords.forEach(removed => {
          newWords.forEach(added => {
            // Check if they might be related (similar context or meaning)
            if (Math.abs(removed.length - added.length) <= 3) {
              replacements.push({
                from: removed,
                to: added,
                type: 'substitution'
              });
            }
          });
        });
      };

      findWordSubstitutions();
      return replacements.slice(0, 5); // Limit to most relevant
    };

    // Enhanced keyword detection
    const findNewKeywords = () => {
      const jobKeywords = extractJobKeywords();

      // Clean and normalize text for comparison
      const normalizeText = (text) => {
        return text.toLowerCase()
          .replace(/\\[a-zA-Z]+\{([^}]*)\}/g, '$1') // Extract content from LaTeX commands
          .replace(/\\[a-zA-Z]+/g, '') // Remove LaTeX commands
          .replace(/[{}]/g, '') // Remove braces
          .replace(/[^\w\s]/g, ' ') // Replace non-alphanumeric with spaces
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();
      };

      const originalNorm = normalizeText(originalResume);
      const tailoredNorm = normalizeText(tailoredResume);
      
      // Find job-relevant terms that appear in tailored but not original
      const newKeywords = [];
      
      if (jobKeywords.length > 0) {
        jobKeywords.forEach(keyword => {
          const keywordLower = keyword.toLowerCase();
          const keywordRegex = new RegExp(`\\b${keywordLower.replace(/\s+/g, '\\s+')}\\b`, 'i');
          
          // Check if keyword appears in tailored resume but not in original
          if (keywordRegex.test(tailoredNorm) && !keywordRegex.test(originalNorm)) {
            newKeywords.push(keyword);
          }
        });
      }

      // Comprehensive technical terms detection - much more extensive list
      const technicalTermsRegex = `\\b(?:python|javascript|typescript|react|reactjs|node|nodejs|docker|kubernetes|k8s|tensorflow|pytorch|scikit|sklearn|pandas|numpy|scipy|matplotlib|aws|amazon|gcp|google|azure|microsoft|mongodb|postgresql|postgres|mysql|redis|elasticsearch|cassandra|dynamo|microservices|devops|agile|scrum|kanban|rest|restful|api|apis|json|xml|yaml|html|css|sass|scss|less|webpack|vite|rollup|parcel|babel|git|github|gitlab|bitbucket|jenkins|travis|circleci|jira|confluence|slack|teams|tableau|powerbi|looker|grafana|kibana|apache|nginx|tomcat|jetty|linux|ubuntu|centos|rhel|debian|bash|shell|zsh|powershell|sql|nosql|plsql|tsql|graphql|websocket|oauth|jwt|saml|ldap|ssl|tls|https|http|tcp|udp|ip|dns|load[\\s-]?balancer|content[\\s-]?delivery[\\s-]?network|cdn|machine[\\s-]?learning|artificial[\\s-]?intelligence|deep[\\s-]?learning|data[\\s-]?science|data[\\s-]?engineering|data[\\s-]?warehousing|data[\\s-]?lake|blockchain|cryptocurrency|bitcoin|ethereum|iot|internet[\\s-]?of[\\s-]?things|terraform|ansible|puppet|chef|vagrant|airflow|luigi|prefect|dagster|spark|hadoop|hive|pig|sqoop|kafka|snowflake|redshift|bigquery|databricks|sqlalchemy|orm|hibernate|django|flask|fastapi|spring|springboot|express|nest|laravel|kimball|dimensional|modeling|methodology|etl|elt|ci\\/cd|continuous[\\s-]?integration|continuous[\\s-]?deployment|prometheus|grafana|datadog|newrelic|splunk|elk|logstash|kibana|vault|consul|nomad|istio|envoy|linkerd|helm|kustomize|skaffold|jupyter|notebook|anaconda|conda|r[\\s-]?language|matlab|sas|spss|qlik|cognos|microstrategy|salesforce|hubspot|marketo|jvm|jdk|openjdk|dotnet|csharp|fsharp|go|golang|rust|scala|kotlin|swift|ruby|rails|php|vue|vuejs|angular|angularjs|svelte|xamarin|flutter|ionic|cordova|unity|unreal|godot)\\b`;
      const technicalTermsPattern = new RegExp(technicalTermsRegex, 'gi');

      const technicalTerms = tailoredNorm.match(technicalTermsPattern) || [];
      const originalTechnicalTerms = originalNorm.match(technicalTermsPattern) || [];
      
      const addedTechnicalTerms = technicalTerms.filter(term => 
        !originalTechnicalTerms.map(t => t.toLowerCase()).includes(term.toLowerCase())
      );

      // Also detect capitalized technical terms and proper nouns that might be technologies
      const capitalizedTermsPattern = /\b[A-Z][a-zA-Z]{2,}(?:\s+[A-Z][a-zA-Z]{2,})*\b/g;
      const tailoredCapTerms = tailoredResume.match(capitalizedTermsPattern) || [];
      const originalCapTerms = originalResume.match(capitalizedTermsPattern) || [];
      
      const newCapitalizedTerms = tailoredCapTerms.filter(term => 
        !originalCapTerms.includes(term) && 
        term.length > 3 && // Avoid short words like "The", "And"
        !['The', 'And', 'Or', 'But', 'For', 'With', 'From', 'To', 'At', 'By', 'In', 'On', 'Of'].includes(term)
      );

      // Extract multi-word technical phrases (like "Data Warehousing", "Machine Learning")
      const technicalPhrasesRegex = `\\b(?:data\\s+(?:warehousing|engineering|science|analytics|mining|lake|pipeline|governance|quality)|machine\\s+learning|artificial\\s+intelligence|deep\\s+learning|software\\s+(?:engineering|development|architecture|design)|web\\s+(?:development|application|service|api)|cloud\\s+(?:computing|architecture|migration|native|infrastructure)|database\\s+(?:design|administration|management|optimization)|network\\s+(?:security|administration|engineering|architecture)|system\\s+(?:administration|architecture|design|integration)|business\\s+(?:intelligence|analytics|logic|process)|project\\s+management|(?:agile|kimball|scrum|waterfall|lean)\\s+methodology|scrum\\s+master|version\\s+control|source\\s+control|continuous\\s+(?:integration|deployment|delivery)|test\\s+(?:driven|automation|framework)|user\\s+(?:experience|interface|research)|front[\\s-]?end|back[\\s-]?end|full[\\s-]?stack|rest\\s+api|graphql\\s+api|micro[\\s-]?services|service[\\s-]?oriented|event[\\s-]?driven|message[\\s-]?queue|load\\s+balancing|auto\\s+scaling|container[\\s-]?ization|orchestration|infrastructure\\s+as\\s+code|platform\\s+as\\s+a\\s+service|software\\s+as\\s+a\\s+service)\\b`;
      const technicalPhrasesPattern = new RegExp(technicalPhrasesRegex, 'gi');

      const technicalPhrases = tailoredNorm.match(technicalPhrasesPattern) || [];
      const originalTechnicalPhrases = originalNorm.match(technicalPhrasesPattern) || [];
      
      const newTechnicalPhrases = technicalPhrases.filter(phrase => 
        !originalTechnicalPhrases.map(p => p.toLowerCase()).includes(phrase.toLowerCase())
      );

      // Combine all detected keywords and remove duplicates
      const allNewKeywords = [
        ...newKeywords,
        ...addedTechnicalTerms,
        ...newCapitalizedTerms.slice(0, 3), // Limit capitalized terms
        ...newTechnicalPhrases
      ];

      // Clean up and format the keywords
      const cleanedKeywords = allNewKeywords
        .map(keyword => {
          // Restore original case for better display
          const originalMatch = tailoredResume.match(new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'));
          return originalMatch ? originalMatch[0] : keyword;
        })
        .filter((keyword, index, array) => 
          // Remove duplicates (case-insensitive)
          array.findIndex(k => k.toLowerCase() === keyword.toLowerCase()) === index
        )
        .slice(0, 10); // Limit to top 10 keywords

      return cleanedKeywords;
    };

    // Analyze section-level changes
    const analyzeSectionChanges = () => {
      const sectionChanges = [];
      
      // Create a map of original sections for easy lookup
      const originalSectionMap = new Map();
      originalSections.forEach(section => {
        const key = section.subsection ? 
          `${section.name}::${section.subsection}` : 
          section.name;
        originalSectionMap.set(key, section);
      });

      // Compare each tailored section with its original counterpart
      tailoredSections.forEach(tailoredSection => {
        const key = tailoredSection.subsection ? 
          `${tailoredSection.name}::${tailoredSection.subsection}` : 
          tailoredSection.name;
        
        const originalSection = originalSectionMap.get(key);
        
        if (!originalSection) {
          // Completely new section
          sectionChanges.push({
            section: tailoredSection.name,
            subsection: tailoredSection.subsection,
            changeType: 'new_section',
            description: `New ${tailoredSection.type} added`,
            newKeywords: [],
            contentChange: tailoredSection.content.length
          });
          return;
        }

        // Compare content to find changes
        const originalContent = originalSection.content.toLowerCase();
        const tailoredContent = tailoredSection.content.toLowerCase();
        
        if (originalContent !== tailoredContent) {
          // Find new keywords in this section
          const sectionNewKeywords = [];
          const allNewKeywords = findNewKeywords();
          
          allNewKeywords.forEach(keyword => {
            const keywordLower = keyword.toLowerCase();
            const keywordRegex = new RegExp(`\\b${keywordLower.replace(/\s+/g, '\\s+')}\\b`, 'i');
            
            if (keywordRegex.test(tailoredContent) && !keywordRegex.test(originalContent)) {
              sectionNewKeywords.push(keyword);
            }
          });

          // Calculate content change
          const contentChange = tailoredSection.content.length - originalSection.content.length;
          
          if (sectionNewKeywords.length > 0 || Math.abs(contentChange) > 50) {
            sectionChanges.push({
              section: tailoredSection.name,
              subsection: tailoredSection.subsection,
              changeType: contentChange > 0 ? 'enhanced' : contentChange < 0 ? 'condensed' : 'modified',
              description: sectionNewKeywords.length > 0 ? 
                `Added ${sectionNewKeywords.length} job-relevant terms` :
                `Content ${contentChange > 0 ? 'expanded' : 'optimized'}`,
              newKeywords: sectionNewKeywords,
              contentChange: contentChange
            });
          }
        }
      });

      return sectionChanges;
    };

    const phraseReplacements = findPhraseReplacements();
    const newKeywords = findNewKeywords();
    const sectionChanges = analyzeSectionChanges();

    // Identify section modifications
    const modifications = [];
    
    if (linesAdded > 0) {
      modifications.push(`Added ${linesAdded} lines of content`);
    } else if (linesAdded < 0) {
      modifications.push(`Removed ${Math.abs(linesAdded)} lines of content`);
    }
    
    if (contentAdded > 500) {
      modifications.push('Expanded content significantly');
    } else if (contentAdded < -500) {
      modifications.push('Condensed content for brevity');
    }

    if (newKeywords.length > 0) {
      modifications.push(`Incorporated ${newKeywords.length} job-relevant keywords`);
    }

    if (phraseReplacements.length > 0) {
      modifications.push(`Made ${phraseReplacements.length} strategic phrase replacements`);
    }

    if (sectionChanges.length > 0) {
      modifications.push(`Modified ${sectionChanges.length} resume sections`);
    }

    return {
      contentAdded: Math.abs(contentAdded),
      contentRemoved: contentAdded < 0 ? Math.abs(contentAdded) : 0,
      linesAdded: Math.max(0, linesAdded),
      linesRemoved: Math.max(0, -linesAdded),
      newKeywords: newKeywords,
      phraseReplacements: phraseReplacements,
      sectionChanges: sectionChanges,
      modifications,
      summary: modifications.length > 0 
        ? `Resume successfully tailored with ${modifications.length} key modification${modifications.length > 1 ? 's' : ''}`
        : 'Resume formatting and structure optimized for the target position'
    };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Floating Tab Navigation */}
      <div className="fixed right-0 top-1/2 transform -translate-y-1/2 z-50 group">
        {/* Hover trigger area */}
        <div className="w-3 h-64 bg-gradient-to-l from-blue-500/10 to-transparent hover:from-blue-500/30 transition-all duration-300 cursor-pointer border-l border-blue-500/20"></div>
        
        {/* Floating tab panel */}
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 bg-gray-800/95 backdrop-blur-md border border-gray-700/50 rounded-xl shadow-2xl opacity-0 translate-x-[20px] group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 min-w-[240px]">
          <div className="p-4">
            <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center">
              <Monitor className="h-4 w-4 mr-2" />
              Quick Navigation
            </h3>
            <div className="space-y-2">
              <button
                onClick={() => setActiveTab('summary')}
                className={`w-full flex items-center px-3 py-2.5 rounded-lg transition-all duration-200 text-sm group/item ${
                  activeTab === 'summary'
                    ? 'bg-blue-600/80 text-white shadow-lg shadow-blue-500/25'
                    : 'text-gray-300 hover:bg-gray-700/50 hover:text-white'
                }`}
              >
                <Sparkles className="h-4 w-4 mr-3 group-hover/item:scale-110 transition-transform" />
                <span className="flex-1 text-left">Tailoring Summary</span>
                {activeTab === 'summary' && (
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                )}
              </button>
              
              <button
                onClick={() => setActiveTab('pdf')}
                className={`w-full flex items-center px-3 py-2.5 rounded-lg transition-all duration-200 text-sm group/item ${
                  activeTab === 'pdf'
                    ? 'bg-blue-600/80 text-white shadow-lg shadow-blue-500/25'
                    : 'text-gray-300 hover:bg-gray-700/50 hover:text-white'
                }`}
              >
                <FileText className="h-4 w-4 mr-3 group-hover/item:scale-110 transition-transform" />
                <span className="flex-1 text-left">Tailored PDF</span>
                {activeTab === 'pdf' && (
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                )}
              </button>
              
              <button
                onClick={() => setActiveTab('source')}
                className={`w-full flex items-center px-3 py-2.5 rounded-lg transition-all duration-200 text-sm group/item ${
                  activeTab === 'source'
                    ? 'bg-blue-600/80 text-white shadow-lg shadow-blue-500/25'
                    : 'text-gray-300 hover:bg-gray-700/50 hover:text-white'
                }`}
              >
                <Code className="h-4 w-4 mr-3 group-hover/item:scale-110 transition-transform" />
                <span className="flex-1 text-left">Source Changes</span>
                {activeTab === 'source' && (
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                )}
              </button>
              
              <button
                onClick={() => setActiveTab('log')}
                className={`w-full flex items-center px-3 py-2.5 rounded-lg transition-all duration-200 text-sm group/item ${
                  activeTab === 'log'
                    ? 'bg-blue-600/80 text-white shadow-lg shadow-blue-500/25'
                    : 'text-gray-300 hover:bg-gray-700/50 hover:text-white'
                }`}
              >
                <FileText className="h-4 w-4 mr-3 group-hover/item:scale-110 transition-transform" />
                <span className="flex-1 text-left">Compilation Log</span>
                {activeTab === 'log' && (
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                )}
              </button>
            </div>
            
            {/* Quick actions */}
            <div className="border-t border-gray-700/50 mt-4 pt-3">
              <p className="text-xs text-gray-400 mb-2">Quick Actions</p>
              <div className="space-y-1">
                {compilationResult?.success && (
                  <button
                    onClick={handleDownloadPDF}
                    disabled={isDownloading}
                    className="w-full flex items-center px-3 py-2 text-xs text-green-300 hover:bg-green-900/30 rounded-lg transition-colors group/action"
                  >
                    {isDownloading ? (
                      <RefreshCw className="h-3 w-3 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-3 w-3 mr-2 group-hover/action:scale-110 transition-transform" />
                    )}
                    {isDownloading ? 'Downloading...' : 'Download PDF'}
                  </button>
                )}
                <button
                  onClick={handleSaveToFile}
                  className="w-full flex items-center px-3 py-2 text-xs text-purple-300 hover:bg-purple-900/30 rounded-lg transition-colors group/action"
                >
                  <Code className="h-3 w-3 mr-2 group-hover/action:scale-110 transition-transform" />
                  Save LaTeX
                </button>
                <button
                  onClick={handleCopyLatex}
                  className="w-full flex items-center px-3 py-2 text-xs text-blue-300 hover:bg-blue-900/30 rounded-lg transition-colors group/action"
                >
                  <Code className="h-3 w-3 mr-2 group-hover/action:scale-110 transition-transform" />
                  Copy LaTeX
                </button>
                <button
                  onClick={handleCopyPlainText}
                  className="w-full flex items-center px-3 py-2 text-xs text-cyan-300 hover:bg-cyan-900/30 rounded-lg transition-colors group/action"
                >
                  <Copy className="h-3 w-3 mr-2 group-hover/action:scale-110 transition-transform" />
                  Copy Text
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container-responsive py-12 lg:pl-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/tailor')}
              className="flex items-center text-gray-300 hover:text-white transition-colors duration-300 group"
            >
              <ArrowLeft className="h-5 w-5 mr-2 group-hover:-translate-x-1 transition-transform duration-300" />
              Back to Tailor
            </button>
            <div className="h-6 w-px bg-gray-600" />
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center text-gray-300 hover:text-white transition-colors duration-300 group"
            >
              <BarChart3 className="h-5 w-5 mr-2 group-hover:scale-110 transition-transform duration-300" />
              View Dashboard
            </button>
            <div className="h-6 w-px bg-gray-600" />
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-white">
                  Tailored Resume Results
                </h1>
                {/* Display company name if available */}
                {(() => {
                  const companyName = sessionData?.company || location.state?.tailoredData?.companyName;
                  return companyName && companyName !== 'Unknown Company' ? (
                    <div className="flex items-center space-x-2 mt-2">
                      <Briefcase className="h-4 w-4 text-blue-400" />
                      <p className="text-lg text-blue-300 font-medium">
                        Tailored for {companyName}
                      </p>
                    </div>
                  ) : null;
                })()}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <button
              onClick={handleSaveToFile}
              className="btn-secondary flex items-center group"
            >
              <FileText className="h-4 w-4 mr-2 group-hover:text-blue-400 transition-colors" />
              Save LaTeX
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={!compilationResult?.success || isDownloading}
              className="btn-primary flex items-center"
            >
              {isDownloading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              {isDownloading ? 'Downloading...' : 'Download PDF'}
            </button>
          </div>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {/* Compilation Status */}
          <div className="card spotlight-card">
            <div className="card-body">
              <div className="flex items-center">
                {compilationResult?.success ? (
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                    <CheckCircle className="h-6 w-6 text-white" />
                  </div>
                ) : (
                  <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                    <AlertCircle className="h-6 w-6 text-white" />
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-white mb-1">
                    {compilationResult?.success ? 'Compilation Successful' : 'Compilation Failed'}
                  </h3>
                  <p className="text-sm text-gray-300">
                    {compilationResult?.success 
                      ? 'PDF ready for download' 
                      : 'Check compilation log for errors'
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* File Size */}
          <div className="card spotlight-card">
            <div className="card-body">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                  <FileText className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white mb-1">File Size</h3>
                  <p className="text-sm text-gray-300">
                    {formatFileSize(tailoredResume.length)} LaTeX source
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Session Info */}
          <div className="card spotlight-card">
            <div className="card-body">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                  <Eye className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white mb-1">Session ID</h3>
                  <p className="text-sm text-gray-300 font-mono">
                    {sessionId}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Metadata */}
        {metadata && (
          <div className="card spotlight-card mb-12">
            <div className="card-body">
              <h3 className="text-xl font-bold text-white mb-6 flex items-center">
                <Monitor className="h-6 w-6 mr-3 text-blue-400" />
                Processing Summary
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm mb-6">
                <div className="bg-gray-700/50 p-4 rounded-lg backdrop-blur-sm">
                  <span className="font-medium text-gray-300 block mb-2">Original Length:</span>
                  <p className="text-white font-bold">{formatFileSize(metadata.originalResumeLength)}</p>
                </div>
                <div className="bg-gray-700/50 p-4 rounded-lg backdrop-blur-sm">
                  <span className="font-medium text-gray-300 block mb-2">Tailored Length:</span>
                  <p className="text-white font-bold">{formatFileSize(metadata.tailoredResumeLength || metadata.finalResumeLength)}</p>
                </div>
                <div className="bg-gray-700/50 p-4 rounded-lg backdrop-blur-sm">
                  <span className="font-medium text-gray-300 block mb-2">Job Description:</span>
                  <p className="text-white font-bold">{formatFileSize(metadata.jobDescriptionLength)}</p>
                </div>
                <div className="bg-gray-700/50 p-4 rounded-lg backdrop-blur-sm">
                  <span className="font-medium text-gray-300 block mb-2">Processed:</span>
                  <p className="text-white font-bold">{new Date(metadata.timestamp).toLocaleString()}</p>
                </div>
              </div>
              
              {/* Company Information Section */}
              {(() => {
                const companyName = sessionData?.company || location.state?.tailoredData?.companyName;
                const jobTitle = sessionData?.job_title;
                
                if (companyName && companyName !== 'Unknown Company') {
                  return (
                    <div className="mb-6 p-4 bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-500/30 rounded-xl backdrop-blur-sm">
                      <h4 className="font-bold text-blue-300 mb-3 flex items-center">
                        <Briefcase className="h-5 w-5 mr-2" />
                        Target Position Details
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-gray-700/30 p-3 rounded-lg backdrop-blur-sm">
                          <span className="font-medium text-gray-300 block mb-1">Company:</span>
                          <p className="text-white font-bold text-lg">{companyName}</p>
                        </div>
                        {jobTitle && jobTitle !== 'Job Posting' && (
                          <div className="bg-gray-700/30 p-3 rounded-lg backdrop-blur-sm">
                            <span className="font-medium text-gray-300 block mb-1">Position:</span>
                            <p className="text-white font-bold">{jobTitle}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
              
              {/* LaTeX Validation Summary */}
              {validationResult && (
                <div className="bg-gradient-to-r from-green-900/30 to-blue-900/30 border border-green-500/30 p-4 rounded-xl backdrop-blur-sm">
                  <h4 className="font-bold text-green-300 mb-4 flex items-center">
                    <CheckCircle className="h-5 w-5 mr-2" />
                    LaTeX Validation & Fixes Applied
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="bg-gray-700/30 p-3 rounded-lg backdrop-blur-sm">
                      <span className="font-medium text-gray-300 block mb-1">Issues Found:</span>
                      <p className="text-white font-bold">{validationResult.issuesFound || 0}</p>
                      <p className="text-xs text-gray-400">Syntax problems detected</p>
                    </div>
                    <div className="bg-gray-700/30 p-3 rounded-lg backdrop-blur-sm">
                      <span className="font-medium text-gray-300 block mb-1">Fixes Applied:</span>
                      <p className="text-white font-bold">{validationResult.fixesApplied || 0}</p>
                      <p className="text-xs text-gray-400">Automatic corrections</p>
                    </div>
                    <div className="bg-gray-700/30 p-3 rounded-lg backdrop-blur-sm">
                      <span className="font-medium text-gray-300 block mb-1">Content Modified:</span>
                      <p className="text-white font-bold">{validationResult.contentChanged ? 'Yes' : 'No'}</p>
                      <p className="text-xs text-gray-400">LaTeX structure updated</p>
                    </div>
                    <div className="bg-gray-700/30 p-3 rounded-lg backdrop-blur-sm">
                      <span className="font-medium text-gray-300 block mb-1">Processing Time:</span>
                      <p className="text-white font-bold">{validationResult.processingTimeMs || 0}ms</p>
                      <p className="text-xs text-gray-400">Validation duration</p>
                    </div>
                  </div>
                  
                  {validationResult.fixDetails && validationResult.fixDetails.length > 0 && (
                    <div className="mt-4 p-3 bg-gray-800/50 rounded-lg">
                      <h5 className="font-medium text-green-300 mb-2 text-sm">Applied Fixes:</h5>
                      <ul className="list-disc list-inside text-xs text-gray-300 space-y-1">
                        {validationResult.fixDetails.map((fix, index) => (
                          <li key={index}>{fix}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {validationResult.remainingErrors > 0 ? (
                    <div className="mt-4 p-3 bg-yellow-900/30 border border-yellow-500/30 rounded-lg">
                      <p className="text-yellow-300 text-sm flex items-center">
                        <AlertCircle className="h-4 w-4 mr-2" />
                        <strong>{validationResult.remainingErrors}</strong> unresolved issue(s) detected. Manual review recommended.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-4 p-3 bg-green-900/30 border border-green-500/30 rounded-lg">
                      <p className="text-green-300 text-sm flex items-center">
                        <CheckCircle className="h-4 w-4 mr-2" />
                        All LaTeX syntax issues have been automatically resolved. Your resume is ready for compilation.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}



        {/* Tab Navigation */}
        <div className="card spotlight-card">
                    <div className="border-b border-gray-700/50">
            <nav className="flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('summary')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-all duration-300 flex items-center ${
                  activeTab === 'summary'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Tailoring Summary
              </button>

 
                <button
                  onClick={() => setActiveTab('pdf')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-all duration-300 flex items-center ${
                    activeTab === 'pdf'
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Tailored PDF
                </button>
              <button
                onClick={() => setActiveTab('source')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-all duration-300 flex items-center ${
                  activeTab === 'source'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <Code className="h-4 w-4 mr-2" />
                Source Changes
              </button>
              <button
                onClick={() => setActiveTab('log')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-all duration-300 flex items-center ${
                  activeTab === 'log'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <FileText className="h-4 w-4 mr-2" />
                Compilation Log
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'summary' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-white flex items-center">
                    <Sparkles className="h-6 w-6 mr-3 text-purple-400" />
                    Resume Tailoring Analysis
                  </h3>
                  <div className="flex items-center space-x-4">
                    {jobDescription && (
                      <button
                        onClick={() => {
                          const blob = new Blob([jobDescription], { type: 'text/plain' });
                          const url = URL.createObjectURL(blob);
                          const link = document.createElement('a');
                          link.href = url;
                          link.download = `job_description_${sessionId}.txt`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          URL.revokeObjectURL(url);
                          toast.success('Job description saved!');
                        }}
                        className="text-sm text-blue-400 hover:text-blue-300 transition-colors flex items-center"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Save Job Description
                      </button>
                    )}
                  </div>
                </div>

                {jobDescription && (
                  <div className="mb-6 p-4 bg-gradient-to-r from-blue-900/30 to-blue-800/30 border border-blue-500/30 rounded-xl backdrop-blur-sm">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-bold text-blue-300 flex items-center">
                        <Briefcase className="h-4 w-4 mr-2" />
                        Target Job Description
                      </h4>
                      {(() => {
                        const companyName = sessionData?.company || location.state?.tailoredData?.companyName;
                        return companyName && companyName !== 'Unknown Company' ? (
                          <div className="flex items-center space-x-2 bg-blue-800/30 px-3 py-1 rounded-lg border border-blue-500/30">
                            <Briefcase className="h-3 w-3 text-blue-400" />
                            <span className="text-sm font-medium text-blue-300">{companyName}</span>
                          </div>
                        ) : null;
                      })()}
                    </div>
                    <div className="text-sm text-blue-200 max-h-32 overflow-y-auto bg-blue-900/20 p-3 rounded-lg">
                      {jobDescription}
                    </div>
                  </div>
                )}

                {/* Resume Changes Summary */}
                {originalResume && tailoredResume && (
                  <div>
                    {(() => {
                      const changes = analyzeResumeChanges();
                      return (
                        <div className="space-y-6">
                          {/* Quick Stats */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-gradient-to-r from-green-900/30 to-green-800/30 border border-green-500/30 p-4 rounded-lg backdrop-blur-sm">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-green-200">Keywords Added</span>
                                <Hash className="h-4 w-4 text-green-400" />
                              </div>
                              <div className="text-2xl font-bold text-green-300 mb-1">
                                {changes.newKeywords?.length || 0}
                              </div>
                              <div className="text-xs text-green-200">
                                {sessionData && sessionData.extracted_keywords ? 
                                  `Out of ${sessionData.extracted_keywords.length} analyzed` : 
                                  'Job-relevant terms added'
                                }
                              </div>
                            </div>

                            <div className="bg-gradient-to-r from-blue-900/30 to-blue-800/30 border border-blue-500/30 p-4 rounded-lg backdrop-blur-sm">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-blue-200">Content Changes</span>
                                <FileText className="h-4 w-4 text-blue-400" />
                              </div>
                              <div className="text-2xl font-bold text-blue-300 mb-1">
                                {changes.linesAdded + changes.linesRemoved}
                              </div>
                              <div className="text-xs text-blue-200">Lines modified</div>
                            </div>

                            <div className="bg-gradient-to-r from-purple-900/30 to-purple-800/30 border border-purple-500/30 p-4 rounded-lg backdrop-blur-sm">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-purple-200">Improvements</span>
                                <Sparkles className="h-4 w-4 text-purple-400" />
                              </div>
                              <div className="text-2xl font-bold text-purple-300 mb-1">
                                {changes.totalModifications || changes.modifications.length}
                              </div>
                              <div className="text-xs text-purple-200">Individual changes made</div>
                            </div>
                          </div>

                          {/* Detailed Keyword Analysis */}
                          {((changes.newKeywords && changes.newKeywords.length > 0) || (sessionData && sessionData.extracted_keywords && sessionData.extracted_keywords.length > 0)) && (
                            <div className="bg-gray-800/50 p-6 rounded-xl backdrop-blur-sm">
                              <h4 className="font-bold text-green-300 mb-4 flex items-center">
                                <Hash className="h-5 w-5 mr-2" />
                                Keyword Analysis
                              </h4>
                              
                              {/* Show database keyword analysis if available */}
                              {sessionData && sessionData.extracted_keywords && sessionData.extracted_keywords.length > 0 && (
                                <div className="space-y-4 mb-6">
                                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    <div className="bg-blue-900/20 p-4 rounded-lg border border-blue-500/30">
                                      <h5 className="text-sm font-medium text-blue-300 mb-2 flex items-center">
                                        📊 Keywords Extracted from Job Description
                                      </h5>
                                      <div className="text-2xl font-bold text-blue-200 mb-1">
                                        {sessionData.extracted_keywords.length}
                                      </div>
                                      <p className="text-xs text-blue-200">Total job-relevant terms identified</p>
                                    </div>
                                    
                                    <div className="bg-green-900/20 p-4 rounded-lg border border-green-500/30">
                                      <h5 className="text-sm font-medium text-green-300 mb-2 flex items-center">
                                        ✅ Keywords Actually Added to Resume
                                      </h5>
                                      <div className="text-2xl font-bold text-green-200 mb-1">
                                        {sessionData.extracted_keywords.filter(kw => kw.added_to_resume === true).length}
                                      </div>
                                      <p className="text-xs text-green-200">Terms successfully incorporated</p>
                                    </div>
                                  </div>
                                  
                                  {/* Show actually added keywords */}
                                  {changes.newKeywords && changes.newKeywords.length > 0 && (
                                    <div>
                                      <h5 className="text-sm font-medium text-green-300 mb-3">Keywords Successfully Added:</h5>
                                      <div className="flex flex-wrap gap-2">
                                        {changes.newKeywords.map((keyword, index) => (
                                          <span key={index} className="bg-green-600/40 text-green-200 px-3 py-1 rounded-full text-sm border border-green-500/30 font-medium">
                                            {keyword}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                              
                              {/* Fallback to client-side analysis if no database data */}
                              {(!sessionData || !sessionData.extracted_keywords || sessionData.extracted_keywords.length === 0) && changes.newKeywords && changes.newKeywords.length > 0 && (
                                <div>
                                  <h5 className="text-sm font-medium text-green-300 mb-4">New Keywords & Phrases Added ({changes.newKeywords.length})</h5>
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div>
                                  <h5 className="text-sm font-medium text-gray-300 mb-3">Technical Terms & Skills</h5>
                                  <div className="flex flex-wrap gap-2 mb-4">
                                    {changes.newKeywords.filter(keyword => 
                                      /^[A-Z][a-zA-Z]*$/.test(keyword) || 
                                      keyword.toLowerCase().match(/python|javascript|react|node|aws|docker|sql|api|css|html|java|php|ruby|go|rust|scala|kotlin|swift|typescript|angular|vue|mongodb|postgresql|redis|kubernetes|jenkins|git|linux|windows|macos|azure|gcp|tensorflow|pytorch|scikit|pandas|numpy|matplotlib|tableau|powerbi|excel|jira|confluence|slack|teams/i)
                                    ).slice(0, 8).map((keyword, index) => (
                                      <span key={index} className="bg-green-600/40 text-green-200 px-3 py-1 rounded-full text-sm border border-green-500/30 font-medium">
                                        {keyword}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <h5 className="text-sm font-medium text-gray-300 mb-3">Methodologies & Concepts</h5>
                                  <div className="flex flex-wrap gap-2 mb-4">
                                    {changes.newKeywords.filter(keyword => 
                                      keyword.includes(' ') || 
                                      keyword.toLowerCase().match(/agile|scrum|devops|ci\/cd|microservices|architecture|methodology|framework|platform|system|process|analysis|optimization|integration|automation|testing|deployment|monitoring|security|performance|scalability/i)
                                    ).slice(0, 6).map((keyword, index) => (
                                      <span key={index} className="bg-blue-600/40 text-blue-200 px-3 py-1 rounded-full text-sm border border-blue-500/30 font-medium">
                                        {keyword}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                                  {changes.newKeywords.length > 14 && (
                                    <div className="mt-4 p-3 bg-gray-700/50 rounded-lg">
                                      <p className="text-sm text-gray-300">
                                        <strong>Additional keywords:</strong> {changes.newKeywords.slice(14).join(', ')}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Phrase Replacements */}
                          {changes.phraseReplacements && changes.phraseReplacements.length > 0 && (
                            <div className="bg-gray-800/50 p-6 rounded-xl backdrop-blur-sm">
                              <h4 className="font-bold text-orange-300 mb-4 flex items-center">
                                <GitCompare className="h-5 w-5 mr-2" />
                                Strategic Text Improvements ({changes.phraseReplacements.length})
                              </h4>
                              <div className="space-y-3">
                                {changes.phraseReplacements.map((replacement, index) => (
                                  <div key={index} className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg border border-gray-600/50">
                                    <div className="flex items-center flex-1">
                                      <span className="text-red-300 font-mono bg-red-900/30 px-3 py-1 rounded border border-red-500/30 text-sm">
                                        {replacement.from}
                                      </span>
                                      <span className="mx-3 text-gray-400">→</span>
                                      <span className="text-green-300 font-mono bg-green-900/30 px-3 py-1 rounded border border-green-500/30 text-sm">
                                        {replacement.to}
                                      </span>
                                    </div>
                                    <span className="ml-4 text-xs text-orange-300 bg-orange-900/30 px-2 py-1 rounded border border-orange-500/30 capitalize">
                                      {replacement.type}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Section Changes Analysis */}
                          {changes.sectionChanges && changes.sectionChanges.length > 0 && (
                            <div className="bg-gray-800/50 p-6 rounded-xl backdrop-blur-sm">
                              <h4 className="font-bold text-cyan-300 mb-4 flex items-center">
                                <FileText className="h-5 w-5 mr-2" />
                                Resume Sections Modified ({changes.sectionsModified || changes.sectionChanges.length})
                                {changes.totalModifications && changes.totalModifications !== changes.sectionChanges.length && (
                                  <span className="ml-2 text-sm font-normal text-cyan-200">
                                    ({changes.totalModifications} individual changes)
                                  </span>
                                )}
                              </h4>
                              <div className="space-y-4">
                                {changes.sectionChanges.map((change, index) => (
                                  <div key={index} className="p-4 bg-gray-700/50 rounded-lg border border-gray-600/50">
                                    <div className="flex items-center justify-between mb-3">
                                      <div className="flex-1">
                                        <h5 className="font-medium text-cyan-200 mb-1">
                                          {change.section}
                                          {change.subsection && (
                                            <span className="text-cyan-300 font-normal"> → {change.subsection}</span>
                                          )}
                                        </h5>
                                        <p className="text-sm text-gray-300">{change.description}</p>
                                      </div>
                                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
                                        change.changeType === 'enhanced' 
                                          ? 'bg-green-900/30 text-green-300 border-green-500/30'
                                          : change.changeType === 'new_section'
                                          ? 'bg-blue-900/30 text-blue-300 border-blue-500/30'
                                          : change.changeType === 'condensed'
                                          ? 'bg-yellow-900/30 text-yellow-300 border-yellow-500/30'
                                          : 'bg-purple-900/30 text-purple-300 border-purple-500/30'
                                      }`}>
                                        {change.changeType === 'enhanced' ? 'Enhanced' :
                                         change.changeType === 'new_section' ? 'New Section' :
                                         change.changeType === 'condensed' ? 'Condensed' : 'Modified'}
                                      </span>
                                    </div>

                                    {/* Show specific text modifications */}
                                    {sessionData && sessionData.resume_modifications && sessionData.resume_modifications.length > 0 ? (
                                      <div className="space-y-3">
                                        {(() => {
                                          const sectionMods = sessionData.resume_modifications.filter(mod => mod.section_name === change.section);
                                          return (
                                            <>
                                              {sectionMods.length > 0 && (
                                                <div className="flex items-center space-x-2 mb-3">
                                                  <GitCompare className="h-4 w-4 text-blue-400" />
                                                  <span className="text-sm font-medium text-blue-300">
                                                    {sectionMods.length} specific modification{sectionMods.length > 1 ? 's' : ''} detected:
                                                  </span>
                                                </div>
                                              )}
                                              {sectionMods.map((modification, modIndex) => (
                                            <div key={modIndex} className="bg-gray-800/50 p-3 rounded border border-gray-600/30">
                                              <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                                                  {modification.modification_type?.replace('_', ' ') || 'Text Change'}
                                                </span>
                                                <span className="text-xs text-gray-400">
                                                  Confidence: {Math.round((modification.confidence_score || 0.8) * 100)}%
                                                </span>
                                              </div>
                                              
                                              {/* Before/After Text Display */}
                                              {modification.original_text && modification.modified_text && (
                                                <div className="space-y-2">
                                                  <div className="flex items-start space-x-3">
                                                    <div className="flex items-center space-x-1">
                                                      <Minus className="h-3 w-3 text-red-400" />
                                                      <span className="text-red-300 text-xs font-medium">BEFORE:</span>
                                                    </div>
                                                    <span className="text-red-200 bg-red-900/20 px-2 py-1 rounded text-sm font-mono border border-red-500/30 flex-1">
                                                      {modification.original_text.length > 100 
                                                        ? `${modification.original_text.substring(0, 100)}...` 
                                                        : modification.original_text}
                                                    </span>
                                                  </div>
                                                  <div className="flex items-start space-x-3">
                                                    <div className="flex items-center space-x-1">
                                                      <Plus className="h-3 w-3 text-green-400" />
                                                      <span className="text-green-300 text-xs font-medium">AFTER:</span>
                                                    </div>
                                                    <span className="text-green-200 bg-green-900/20 px-2 py-1 rounded text-sm font-mono border border-green-500/30 flex-1">
                                                      {modification.modified_text.length > 100 
                                                        ? `${modification.modified_text.substring(0, 100)}...` 
                                                        : modification.modified_text}
                                                    </span>
                                                  </div>
                                                </div>
                                              )}
                                              
                                              {/* Reason for change */}
                                              {modification.reason && (
                                                <div className="mt-3 pt-2 border-t border-gray-600/30">
                                                  <p className="text-xs text-orange-300 bg-orange-900/20 px-2 py-1 rounded border border-orange-500/30">
                                                    <strong>Why:</strong> {modification.reason}
                                                  </p>
                                                </div>
                                              )}
                                            </div>
                                               ))}
                                             </>
                                           );
                                         })()}
                                       </div>
                                     ) : (
                                      /* Fallback for sessions without detailed modification data */
                                      <div className="bg-gray-800/50 p-3 rounded border border-gray-600/30">
                                        <div className="flex items-center space-x-2 mb-2">
                                          <span className="text-yellow-300 text-xs font-medium">ℹ️ SUMMARY:</span>
                                          <span className="text-gray-300 text-sm">{change.description}</span>
                                        </div>
                                        <p className="text-xs text-gray-400">
                                          Detailed modification data not available for this session. 
                                          New sessions will show specific before/after text changes.
                                        </p>
                                      </div>
                                    )}
                                    
                                    {change.newKeywords && change.newKeywords.length > 0 && (
                                      <div className="mt-3">
                                        <p className="text-xs text-gray-400 mb-2">Keywords added to this section:</p>
                                        <div className="flex flex-wrap gap-2">
                                          {change.newKeywords.map((keyword, keywordIndex) => (
                                            <span 
                                              key={keywordIndex} 
                                              className="bg-cyan-600/30 text-cyan-200 px-2 py-1 rounded text-xs border border-cyan-500/30"
                                            >
                                              {keyword}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    
                                    {change.contentChange !== 0 && (
                                      <div className="mt-2 text-xs text-gray-400">
                                        Content {change.contentChange > 0 ? 'expanded' : 'reduced'} by {Math.abs(change.contentChange)} characters
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                              
                              <div className="mt-4 p-3 bg-cyan-900/20 rounded-lg border border-cyan-500/30">
                                <p className="text-sm text-cyan-200">
                                  <strong>💡 Tip:</strong> These sections now contain job-specific terminology that will help your resume pass ATS systems and catch recruiter attention.
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Summary Message */}
                          <div className="bg-gradient-to-r from-green-900/30 to-blue-900/30 border border-green-500/30 p-6 rounded-xl backdrop-blur-sm">
                            <h4 className="font-bold text-green-300 mb-3 flex items-center">
                              <CheckCircle className="h-5 w-5 mr-2" />
                              Tailoring Analysis
                            </h4>
                            <p className="text-green-200 mb-4">{changes.summary}</p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                              <div className="flex items-center">
                                <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                                <span className="text-gray-300">
                                  <strong className="text-green-300">{changes.linesAdded}</strong> lines added
                                </span>
                              </div>
                              <div className="flex items-center">
                                <div className="w-2 h-2 bg-red-500 rounded-full mr-3"></div>
                                <span className="text-gray-300">
                                  <strong className="text-red-300">{changes.linesRemoved}</strong> lines removed
                                </span>
                              </div>
                              <div className="flex items-center">
                                <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                                <span className="text-gray-300">
                                  <strong className="text-blue-300">{changes.newKeywords?.length || 0}</strong> keywords incorporated
                                </span>
                              </div>
                              <div className="flex items-center">
                                <div className="w-2 h-2 bg-purple-500 rounded-full mr-3"></div>
                                <span className="text-gray-300">
                                  <strong className="text-purple-300">{changes.phraseReplacements?.length || 0}</strong> strategic replacements
                                </span>
                              </div>
                              <div className="flex items-center">
                                <div className="w-2 h-2 bg-cyan-500 rounded-full mr-3"></div>
                                <span className="text-gray-300">
                                  <strong className="text-cyan-300">{changes.sectionsModified || changes.sectionChanges?.length || 0}</strong> sections modified
                                  {changes.totalModifications && changes.totalModifications > (changes.sectionsModified || changes.sectionChanges?.length || 0) && (
                                    <span className="text-xs text-cyan-200 ml-2">
                                      ({changes.totalModifications} individual changes)
                                    </span>
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                <div className="mt-6 p-4 bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-500/30 rounded-xl backdrop-blur-sm">
                  <h4 className="font-bold text-blue-300 mb-3 flex items-center">
                    <Eye className="h-4 w-4 mr-2" />
                    Next Steps
                  </h4>
                  <div className="text-sm text-blue-200 space-y-2">
                    <div className="flex items-center">
                      <CheckCircle className="h-4 w-4 mr-3 text-green-400" />
                      <span>Review the tailored PDF to see your optimized resume</span>
                    </div>
                    <div className="flex items-center">
                      <CheckCircle className="h-4 w-4 mr-3 text-green-400" />
                      <span>Check the LaTeX source code for detailed changes</span>
                    </div>
                    <div className="flex items-center">
                      <CheckCircle className="h-4 w-4 mr-3 text-green-400" />
                      <span>Download your tailored resume for job applications</span>
                    </div>
                  </div>
                </div>
              </div>
            )}





            {activeTab === 'pdf' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-white flex items-center">
                    <FileText className="h-6 w-6 mr-3 text-blue-400" />
                    Tailored Resume PDF
                  </h3>
                  <div className="flex items-center space-x-4">
                    {/* PDF Controls */}
                    <div className="flex items-center space-x-2 bg-gray-700/50 px-3 py-1 rounded-lg">
                      <button
                        onClick={goToPreviousPage}
                        disabled={currentPage <= 1}
                        className="p-1 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Previous page"
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </button>
                      <span className="text-sm text-gray-300 min-w-[60px] text-center">
                        {currentPage} / {tailoredPdfPages || 0}
                      </span>
                      <button
                        onClick={goToNextPage}
                        disabled={currentPage >= (tailoredPdfPages || 0)}
                        className="p-1 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Next page"
                      >
                        <ArrowLeft className="h-4 w-4 rotate-180" />
                      </button>
                    </div>
                    
                    <div className="flex items-center space-x-2 bg-gray-700/50 px-3 py-1 rounded-lg">
                      <button
                        onClick={zoomOut}
                        disabled={pdfScale <= 0.5}
                        className="p-1 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Zoom out"
                      >
                        <ZoomOut className="h-4 w-4" />
                      </button>
                      <span className="text-sm text-gray-300 min-w-[50px] text-center">
                        {Math.round(pdfScale * 100)}%
                      </span>
                      <button
                        onClick={zoomIn}
                        disabled={pdfScale >= 2.0}
                        className="p-1 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Zoom in"
                      >
                        <ZoomIn className="h-4 w-4" />
                      </button>
                      <button
                        onClick={resetZoom}
                        className="p-1 text-gray-400 hover:text-white"
                        title="Reset zoom"
                      >
                        <RotateCw className="h-4 w-4" />
                      </button>
                    </div>
                    
                    {/* Copy Controls */}
                    <div className="flex items-center space-x-2 bg-gray-700/50 px-3 py-1 rounded-lg">
                      <button
                        onClick={handleCopyLatex}
                        className="p-1 text-gray-400 hover:text-blue-400 transition-colors"
                        title="Copy LaTeX source code"
                      >
                        <Code className="h-4 w-4" />
                      </button>
                      <span className="text-xs text-gray-500">|</span>
                      <button
                        onClick={handleCopyPlainText}
                        className="p-1 text-gray-400 hover:text-green-400 transition-colors"
                        title="Copy as plain text"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Info about PDF view */}
                <div className="mb-6 p-4 bg-gradient-to-r from-blue-900/30 to-blue-800/30 border border-blue-500/30 rounded-xl backdrop-blur-sm">
                  <h4 className="font-bold text-blue-300 mb-2 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-2" />
                    Tailored PDF View
                  </h4>
                  <p className="text-sm text-blue-200">
                    This shows your final tailored resume PDF ready for download. For highlighted changes, use the "Resume Compare" tab above.
                  </p>
                </div>

                {/* Tailored PDF Display */}
                <div className="border border-gray-600 rounded-xl overflow-hidden shadow-2xl bg-white">
                  <div className="bg-gray-800 text-white px-4 py-3 text-center font-medium">
                    Your Tailored Resume PDF
                  </div>
                  <div className="flex items-center justify-center overflow-auto p-8 bg-gray-100" style={{ minHeight: '850px' }}>
                    {compilationResult?.success ? (
                      (() => {
                        // Normalize PDF path - remove ./ prefix if present
                        const rawPath = sessionData?.pdf_file_path || `/output/resume_${sessionId}.pdf`;
                        const normalizedPath = rawPath.startsWith('./') ? rawPath.substring(1) : rawPath;

                        // Debug: Check if PDF exists before loading
                        fetch(normalizedPath, { method: 'HEAD' })
                          .then(response => {
                            console.log(`PDF availability check for ${normalizedPath}:`, response.status, response.statusText);
                            if (!response.ok) {
                              console.error(`PDF not accessible: ${response.status} ${response.statusText}`);
                            }
                          })
                          .catch(err => console.error(`PDF fetch error for ${normalizedPath}:`, err));
                        
                        return (
                      <Document
                        file={normalizedPath}
                        onLoadSuccess={(pdf) => {
                          console.log('Tailored PDF loaded successfully:', pdf.numPages, 'pages');
                          onTailoredPdfLoadSuccess(pdf);
                        }}
                        onLoadError={(error) => {
                          console.error('=== PDF LOADING DEBUG ===');
                          console.error('Session ID:', sessionId);
                          console.error('Raw PDF Path:', sessionData?.pdf_file_path);
                          console.error('Normalized PDF Path:', normalizedPath);
                          console.error('Compilation Success:', compilationResult?.success);
                          console.error('PDF File Size:', sessionData?.pdf_file_size);
                          console.error('Error Details:', error);
                          console.error('=========================');
                          onTailoredPdfLoadError(error);
                        }}
                        loading={
                          <div className="text-gray-600 flex items-center">
                            <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                            Loading tailored PDF...
                          </div>
                        }
                        error={
                          <div className="text-red-600 text-center">
                            <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                            <p>Failed to load tailored PDF</p>
                            <p className="text-sm">
                              {sessionData?.pdf_file_size > 0 
                                ? 'PDF file may have been cleaned up from server storage'
                                : 'PDF compilation may have failed'
                              }
                            </p>
                            <p className="text-xs text-gray-500 mt-2">Path: {normalizedPath}</p>
                            <div className="mt-4 space-y-2">
                              <button
                                onClick={() => window.location.reload()}
                                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                              >
                                Refresh Page
                              </button>
                              <p className="text-xs text-gray-500">
                                Try downloading directly from Dashboard if available
                              </p>
                            </div>
                          </div>
                        }
                      >
                        <Page
                          pageNumber={currentPage}
                          scale={pdfScale}
                          renderTextLayer={false}
                          renderAnnotationLayer={false}
                          loading={
                            <div className="text-gray-600 flex items-center">
                              <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                              Rendering page...
                            </div>
                          }
                                                  />
                        </Document>
                        );
                      })()
                    ) : (
                      <div className="text-red-600 text-center">
                        <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                        <p>PDF compilation failed</p>
                        <p className="text-sm">Check compilation log for details</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-6 p-4 bg-gradient-to-r from-green-900/30 to-green-800/30 border border-green-500/30 rounded-xl backdrop-blur-sm">
                  <h4 className="font-bold text-green-300 mb-3 flex items-center">
                    <FileText className="h-4 w-4 mr-2" />
                    PDF View Controls
                  </h4>
                  <div className="text-sm text-green-200 space-y-2">
                    <div className="flex items-center">
                      <ArrowLeft className="h-4 w-4 mr-3" />
                      <span><strong>Navigation:</strong> Use arrow buttons to navigate between pages</span>
                    </div>
                    <div className="flex items-center">
                      <ZoomIn className="h-4 w-4 mr-3" />
                      <span><strong>Zoom:</strong> Use + and - buttons to zoom in/out for detailed view</span>
                    </div>
                    <div className="flex items-center">
                      <Code className="h-4 w-4 mr-3" />
                      <span><strong>Copy LaTeX:</strong> Copy the complete LaTeX source code to clipboard</span>
                    </div>
                    <div className="flex items-center">
                      <Copy className="h-4 w-4 mr-3" />
                      <span><strong>Copy Text:</strong> Copy resume content as plain text (no formatting)</span>
                    </div>
                    <div className="flex items-center">
                      <Download className="h-4 w-4 mr-3" />
                      <span><strong>Download:</strong> This is your final resume PDF - ready for job applications</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'source' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-white flex items-center">
                    <Code className="h-6 w-6 mr-3 text-blue-400" />
                    LaTeX Source Comparison
                  </h3>
                  <div className="flex items-center space-x-4">
                    <span className="text-sm text-gray-400 bg-gray-700/50 px-3 py-1 rounded-lg">
                      Original vs Tailored Source
                    </span>
                  </div>
                </div>

                {originalResume && tailoredResume ? (
                  <div className="border border-gray-600 rounded-xl overflow-hidden shadow-2xl">
                    <ReactDiffViewer
                      oldValue={originalResume}
                      newValue={tailoredResume}
                      splitView={true}
                      leftTitle="Original LaTeX Source"
                      rightTitle="Tailored LaTeX Source"
                      showDiffOnly={false}
                      hideLineNumbers={false}
                      styles={{
                        variables: {
                          dark: {
                            diffViewerBackground: '#1f2937',
                            diffViewerColor: '#f3f4f6',
                            addedBackground: '#065f46',
                            addedColor: '#d1fae5',
                            removedBackground: '#7f1d1d',
                            removedColor: '#fecaca',
                            wordAddedBackground: '#059669',
                            wordRemovedBackground: '#dc2626',
                            addedGutterBackground: '#047857',
                            removedGutterBackground: '#b91c1c',
                            gutterBackground: '#374151',
                            gutterBackgroundDark: '#1f2937',
                            highlightBackground: '#374151',
                            highlightGutterBackground: '#4b5563',
                            codeFoldGutterBackground: '#374151',
                            codeFoldBackground: '#1f2937',
                            emptyLineBackground: '#1f2937',
                            gutterColor: '#9ca3af',
                            addedGutterColor: '#d1fae5',
                            removedGutterColor: '#fecaca',
                            codeFoldContentColor: '#9ca3af',
                            diffViewerTitleBackground: '#111827',
                            diffViewerTitleColor: '#f3f4f6',
                            diffViewerTitleBorderColor: '#374151'
                          }
                        },
                        diffContainer: {
                          fontSize: '13px',
                          fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace'
                        },
                        splitView: {
                          '&:before': {
                            content: '""',
                            position: 'absolute',
                            top: 0,
                            bottom: 0,
                            left: '50%',
                            width: '1px',
                            background: '#374151',
                            zIndex: 1
                          }
                        }
                      }}
                      useDarkTheme={true}
                    />
                  </div>
                ) : (
                  <div className="bg-gray-800/50 p-8 rounded-xl text-center">
                    <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-400">
                      {originalResume ? 'Tailored resume source not available' : 'Original resume source not available for comparison'}
                    </p>
                  </div>
                )}

                <div className="mt-6 p-4 bg-gradient-to-r from-green-900/30 to-green-800/30 border border-green-500/30 rounded-xl backdrop-blur-sm">
                  <h4 className="font-bold text-green-300 mb-3 flex items-center">
                    <Sparkles className="h-4 w-4 mr-2" />
                    How to Read Source Changes
                  </h4>
                  <div className="text-sm text-green-200 space-y-2">
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-red-600 rounded mr-3"></div>
                      <span><strong>Red sections:</strong> LaTeX code removed from original</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-green-600 rounded mr-3"></div>
                      <span><strong>Green sections:</strong> New LaTeX code added for job relevance</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-gray-600 rounded mr-3"></div>
                      <span><strong>Gray sections:</strong> Unchanged LaTeX code preserved</span>
                    </div>
                    <div className="flex items-center">
                      <GitCompare className="h-4 w-4 mr-3" />
                      <span><strong>Visual Changes:</strong> Switch to "PDF Compare" tab to see rendered differences</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'log' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-white flex items-center">
                    <FileText className="h-6 w-6 mr-3 text-blue-400" />
                    Compilation Log
                  </h3>
                  <span className={`text-sm px-3 py-1 rounded-lg font-medium ${
                    compilationResult?.success ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'
                  }`}>
                    {compilationResult?.success ? 'Success' : 'Failed'}
                  </span>
                </div>
                
                <div className="bg-gray-900/90 text-gray-100 p-6 rounded-xl font-mono text-sm overflow-auto max-h-96 border border-gray-700 backdrop-blur-sm">
                  <pre className="whitespace-pre-wrap">
                    {compilationResult?.compilationLog || 'No compilation log available'}
                  </pre>
                </div>
                
                {compilationResult?.attempts && (
                  <p className="text-sm text-gray-400 mt-4">
                    Compilation completed in {compilationResult.attempts} attempt(s)
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Help Section */}
        <div className="mt-12 bg-gradient-to-r from-blue-900/30 to-blue-800/30 border border-blue-500/30 rounded-xl p-8 backdrop-blur-sm">
          <h3 className="text-xl font-bold text-blue-300 mb-6 flex items-center">
            <Sparkles className="h-6 w-6 mr-3" />
            What's Next?
          </h3>
          <ul className="text-blue-200 space-y-4 mb-6">
            <li className="flex items-center group">
              <CheckCircle className="h-5 w-5 mr-3 text-blue-400 group-hover:text-green-400 transition-colors" />
              Review the tailored LaTeX source code above
            </li>
            <li className="flex items-center group">
              <CheckCircle className="h-5 w-5 mr-3 text-blue-400 group-hover:text-green-400 transition-colors" />
              Download the PDF for immediate use in applications
            </li>
            <li className="flex items-center group">
              <CheckCircle className="h-5 w-5 mr-3 text-blue-400 group-hover:text-green-400 transition-colors" />
              Save the LaTeX source for future customizations
            </li>
            <li className="flex items-center group">
              <CheckCircle className="h-5 w-5 mr-3 text-blue-400 group-hover:text-green-400 transition-colors" />
              Tailor for additional job descriptions as needed
            </li>
          </ul>
          
          <div className="border-t border-blue-500/30 pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-blue-300 mb-2">Track Your Progress</h4>
                <p className="text-blue-200 text-sm">View all your resume optimizations in one place</p>
              </div>
              <button
                onClick={() => navigate('/dashboard')}
                className="btn-primary flex items-center"
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                View Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filename Modal */}
      <FilenameModal
        isOpen={showFilenameModal}
        onClose={() => setShowFilenameModal(false)}
        onConfirm={handleFilenameConfirm}
        sessionId={sessionId}
        defaultFilename={`tailored_resume_${sessionId}`}
      />
    </div>
  );
};

export default ResultsPage; 