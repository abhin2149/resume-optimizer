const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs-extra');
const path = require('path');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const ResumeIngestor = require('./src/modules/ResumeIngestor');
const JobDescriptionProcessor = require('./src/modules/JobDescriptionProcessor');
const TailoringEngine = require('./src/modules/TailoringEngine');
const LaTeXCompiler = require('./src/modules/LaTeXCompiler');
const FileCleanupManager = require('./src/modules/FileCleanupManager');

// Database integration
const dbConnection = require('./src/database/connection');
const DatabaseService = require('./src/database/services/DatabaseService');

// Authentication
const authRoutes = require('./src/routes/auth');
const AuthService = require('./src/services/AuthService');
const { authenticateToken, checkCredits } = require('./src/middleware/auth');

// Rate limiting middleware
const rateLimit = require('express-rate-limit');

// Rate limiters for different endpoints
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const tailoringLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each IP to 10 tailoring requests per hour
  message: 'Too many tailoring requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Timeout middleware for long-running operations
app.use((req, res, next) => {
  // Set timeout for resume tailoring operations (5 minutes)
  if (req.path === '/api/tailor-resume') {
    req.setTimeout(300000); // 5 minutes
    res.setTimeout(300000); // 5 minutes
  } else {
    // Default timeout for other operations (2 minutes)
    req.setTimeout(120000); // 2 minutes
    res.setTimeout(120000); // 2 minutes
  }
  next();
});

// Apply rate limiting
app.use('/api/', generalLimiter);
app.use('/api/tailor-resume', tailoringLimiter);

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const timestamp = new Date().toISOString();
  
  console.log(`[${timestamp}] ${req.method} ${req.url} - Request started`);
  
  // Log request body for POST requests (excluding file uploads)
  if (req.method === 'POST' && req.body && !req.url.includes('upload')) {
    console.log(`[${timestamp}] Request body:`, JSON.stringify(req.body, null, 2));
  }
  
  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const duration = Date.now() - start;
    console.log(`[${timestamp}] ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
    originalEnd.call(this, chunk, encoding);
  };
  
  next();
});

// Serve static files
app.use('/output', express.static(path.join(__dirname, 'output')));
app.use('/client', express.static(path.join(__dirname, 'client/build')));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads');
    fs.ensureDirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, `${uuidv4()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/plain' || file.originalname.endsWith('.tex')) {
      cb(null, true);
    } else {
      cb(new Error('Only .tex files are allowed'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Initialize modules
const resumeIngestor = new ResumeIngestor();
const jobDescriptionProcessor = new JobDescriptionProcessor();
const tailoringEngine = new TailoringEngine();
const latexCompiler = new LaTeXCompiler();
const fileCleanupManager = new FileCleanupManager();
const LaTeXValidator = require('./src/modules/LaTeXValidator');
const latexValidator = new LaTeXValidator();

// Ensure output directory exists
fs.ensureDirSync(path.join(__dirname, 'output'));

// API Routes

// Authentication routes
app.use('/api/auth', authRoutes);

/**
 * Health check endpoint
 */
app.get('/api/health', async (req, res) => {
  console.log('[HEALTH] 💚 Health check requested');
  
  try {
    // Check database health
    const dbHealth = await dbConnection.healthCheck();
    
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        postgresql: dbHealth.postgresql,
        supabase: dbHealth.supabase
      },
      services: {
        latex: true, // Could add LaTeX check here
        ai: !!process.env.OPENAI_API_KEY
      }
    };
    
    // If database is down, mark as unhealthy
    if (!dbHealth.postgresql) {
      healthStatus.status = 'degraded';
    }
    
    res.json(healthStatus);
  } catch (error) {
    console.error('[HEALTH] ❌ Health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

/**
 * Get the base resume content
 */
app.get('/api/base-resume', async (req, res) => {
  try {
    const baseResumePath = path.join(__dirname, 'base_resume.tex');
    const resumeContent = await resumeIngestor.loadResumeFile(baseResumePath);
    
    res.json({
      success: true,
      content: resumeContent,
      metadata: {
        path: baseResumePath,
        size: resumeContent.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error loading base resume:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load base resume',
      details: error.message
    });
  }
});

/**
 * Serve the base resume PDF for comparison
 */
app.get('/api/base-resume-pdf', (req, res) => {
  const baseResumePdfPath = path.join(__dirname, 'base_resume.pdf');
  
  if (fs.existsSync(baseResumePdfPath)) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="base_resume.pdf"');
    res.sendFile(baseResumePdfPath);
  } else {
    res.status(404).json({
      success: false,
      error: 'Base resume PDF not found'
    });
  }
});



/**
 * Get user's saved resumes
 */
app.get('/api/resumes', authenticateToken, async (req, res) => {
  try {
    console.log('[RESUMES] 📄 Fetching resumes for user:', req.user.email);
    
    const resumesResult = await DatabaseService.getUserResumes(req.user.id);
    
    if (resumesResult.success) {
      console.log('[RESUMES] ✅ Found', resumesResult.resumes.length, 'resumes');
      res.json({
        success: true,
        resumes: resumesResult.resumes
      });
    } else {
      throw new Error(resumesResult.error);
    }
  } catch (error) {
    console.error('[RESUMES] ❌ Error fetching user resumes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch resumes',
      details: error.message
    });
  }
});

/**
 * Get specific resume by ID with user ownership validation
 */
app.get('/api/resumes/:resumeId', authenticateToken, async (req, res) => {
  try {
    const { resumeId } = req.params;
    console.log('[RESUME] 📄 Fetching resume:', resumeId, 'for user:', req.user.email);
    
    const resumeResult = await DatabaseService.getResume(resumeId, req.user.id);
    
    if (resumeResult.success) {
      console.log('[RESUME] ✅ Resume found');
      res.json({
        success: true,
        resume: resumeResult.resume
      });
    } else {
      console.log('[RESUME] ❌ Resume not found or access denied');
      res.status(404).json({
        success: false,
        error: resumeResult.error
      });
    }
  } catch (error) {
    console.error('[RESUME] ❌ Error fetching resume:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch resume',
      details: error.message
    });
  }
});

/**
 * Upload custom resume file and save to database
 */
app.post('/api/upload-resume', authenticateToken, upload.single('resume'), async (req, res) => {
  try {
    console.log('[UPLOAD] 📤 Processing resume upload for user:', req.user.email);
    
    if (!req.file) {
      console.log('[UPLOAD] ❌ No file provided in request');
      return res.status(400).json({
        success: false,
        error: 'No resume file uploaded'
      });
    }

    console.log('[UPLOAD] File received:', req.file.originalname, '(', req.file.size, 'bytes)');
    const resumeContent = await resumeIngestor.loadResumeFile(req.file.path);
    console.log('[UPLOAD] ✅ Resume content loaded (', resumeContent.length, 'characters)');
    
    // Save resume to database
    const resumeData = {
      userId: req.user.id,
      name: req.file.originalname || 'Custom Resume',
      content: resumeContent,
      contentType: 'latex',
      isCustom: true
    };
    
    const createResult = await DatabaseService.createResume(resumeData);
    
    if (!createResult.success) {
      throw new Error(`Failed to save resume to database: ${createResult.error}`);
    }
    
    console.log('[UPLOAD] 💾 Resume saved to database with ID:', createResult.resume.id);
    
    // Clean up uploaded file
    await fs.remove(req.file.path);
    console.log('[UPLOAD] 🗑️ Temporary file cleaned up');
    
    res.json({
      success: true,
      resume: {
        id: createResult.resume.id,
        name: createResult.resume.name,
        content: resumeContent,
        size: resumeContent.length,
        createdAt: createResult.resume.created_at
      },
      metadata: {
        originalName: req.file.originalname,
        size: resumeContent.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[UPLOAD] ❌ Error processing uploaded resume:', error);
    
    // Clean up uploaded file on error
    if (req.file && req.file.path) {
      try {
        await fs.remove(req.file.path);
      } catch (cleanupError) {
        console.error('[UPLOAD] ❌ Error cleaning up file:', cleanupError);
      }
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to process uploaded resume',
      details: error.message
    });
  }
});

/**
 * Extract keywords from job description
 */
app.post('/api/extract-keywords', async (req, res) => {
  try {
    const { jobDescription } = req.body;
    
    console.log('[KEYWORDS] Starting keyword extraction process');
    console.log('[KEYWORDS] Job description length:', jobDescription?.length || 0);
    
    if (!jobDescription || typeof jobDescription !== 'string') {
      console.log('[KEYWORDS] ❌ Invalid job description provided');
      return res.status(400).json({
        success: false,
        error: 'Job description is required and must be a string'
      });
    }

    console.log('[KEYWORDS] 🔍 Sanitizing job description...');
    const sanitizedJD = jobDescriptionProcessor.sanitizeJobDescription(jobDescription);
    console.log('[KEYWORDS] Sanitized length:', sanitizedJD.length);
    
    console.log('[KEYWORDS] 🔑 Extracting keywords...');
    const keywords = await jobDescriptionProcessor.extractKeywords(sanitizedJD);
    console.log('[KEYWORDS] ✅ Extracted', keywords.length, 'keywords');
    
    // Optional: Save keywords to database if we have session context
    // This could be enhanced to link with a user session
    try {
      await DatabaseService.recordSystemMetric(
        'keywords_extracted',
        keywords.length,
        'count',
        {
          originalLength: jobDescription.length,
          sanitizedLength: sanitizedJD.length,
          sampleKeywords: keywords.slice(0, 10) // First 10 keywords as sample
        }
      );
    } catch (dbError) {
      console.warn('[KEYWORDS] ⚠️ Failed to record metrics:', dbError.message);
    }
    
    res.json({
      success: true,
      keywords: keywords,
      sanitizedText: sanitizedJD,
      metadata: {
        originalLength: jobDescription.length,
        sanitizedLength: sanitizedJD.length,
        keywordCount: keywords.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[KEYWORDS] ❌ Error extracting keywords:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to extract keywords',
      details: error.message
    });
  }
});

/**
 * Main endpoint: Tailor resume for job description
 */
app.post('/api/tailor-resume', authenticateToken, checkCredits(1), async (req, res) => {
  const startTime = Date.now();
  let dbJobDescription = null;
  let dbTailoringSession = null;
  
  // Set a timeout for this specific request (5 minutes)
  const timeoutId = setTimeout(() => {
    console.log('[TAILOR] ⏰ Request timeout after 5 minutes');
    if (!res.headersSent) {
      res.status(408).json({
        success: false,
        error: 'Request timeout - resume tailoring took too long',
        details: 'The operation exceeded the 5-minute timeout limit. Please try again.'
      });
    }
  }, 300000); // 5 minutes
  
  try {
    const { jobDescription, companyName } = req.body;
    const sessionId = uuidv4();
    const user = req.user; // From authentication middleware
    
    console.log('\n🚀 [TAILOR] Starting resume tailoring process');
    console.log('[TAILOR] Session ID:', sessionId);
    console.log('[TAILOR] Job description length:', jobDescription?.length || 0);
    console.log('[TAILOR] Manual company name:', companyName || 'Not provided');
    console.log('[TAILOR] Using custom resume ID:', !!req.body.customResumeId);
    console.log('[TAILOR] User:', user.email, 'Credits:', user.credits);
    
    if (!jobDescription || typeof jobDescription !== 'string') {
      console.log('[TAILOR] ❌ Invalid job description provided');
      return res.status(400).json({
        success: false,
        error: 'Job description is required and must be a string'
      });
    }

    // Step 1: Load base resume or use custom resume
    console.log('[TAILOR] 📄 Step 1: Loading resume content...');
    let baseResumeContent;
    let originalResumeId = null;
    
    if (req.body.customResumeId) {
      // Load custom resume from database by ID
      const resumeResult = await DatabaseService.getResume(req.body.customResumeId, user.id);
      if (resumeResult.success) {
        baseResumeContent = resumeResult.resume.content;
        originalResumeId = resumeResult.resume.id;
        console.log('[TAILOR] Using custom resume from database ID:', originalResumeId, '(', baseResumeContent.length, 'characters)');
      } else {
        console.log('[TAILOR] ❌ Failed to load custom resume from database:', resumeResult.error);
        return res.status(400).json({
          success: false,
          error: 'Failed to load custom resume from database',
          details: resumeResult.error
        });
      }
    } else {
      // Use default base resume
      const baseResumePath = path.join(__dirname, 'base_resume.tex');
      baseResumeContent = await resumeIngestor.loadResumeFile(baseResumePath);
      console.log('[TAILOR] Loaded base resume (', baseResumeContent.length, 'characters)');
    }

    // Step 2: Process job description
    console.log('[TAILOR] 🔍 Step 2: Processing job description...');
    const sanitizedJD = jobDescriptionProcessor.sanitizeJobDescription(jobDescription);
    console.log('[TAILOR] Sanitized JD length:', sanitizedJD.length);
    
    // Use manual company name or extract from job description as fallback
    let finalCompanyName = companyName;
    let jobTitle = 'Job Posting';
    
    if (companyName && companyName.trim()) {
      // Use the manually provided company name
      finalCompanyName = companyName.trim();
      console.log('[TAILOR] Using manual company name:', finalCompanyName);
      
      // Still extract job title from job description
      const extractedInfo = jobDescriptionProcessor.extractJobTitleAndCompany(jobDescription);
      jobTitle = extractedInfo.title;
      console.log('[TAILOR] Extracted job title:', jobTitle);
    } else {
      // Fallback to extracting both from job description
      const extractedInfo = jobDescriptionProcessor.extractJobTitleAndCompany(jobDescription);
      finalCompanyName = extractedInfo.company;
      jobTitle = extractedInfo.title;
      console.log('[TAILOR] Fallback extraction - Title:', jobTitle, 'Company:', finalCompanyName);
    }
    
    // Save job description to database
    const jobDescResult = await DatabaseService.createJobDescription({
      userId: user.id,
      title: jobTitle,
      company: finalCompanyName,
      originalText: jobDescription,
      sanitizedText: sanitizedJD
    });
    
    if (jobDescResult.success) {
      dbJobDescription = jobDescResult.jobDescription;
      console.log('[TAILOR] 📋 Job description saved to DB:', dbJobDescription.id);
    }
    
    // Step 3: Extract keywords from job description (do this BEFORE tailoring to avoid duplication)
    console.log('[TAILOR] 🔍 Step 3: Extracting keywords from job description...');
    const extractedKeywords = await jobDescriptionProcessor.extractKeywords(sanitizedJD);
    console.log('[TAILOR] Extracted', extractedKeywords.length, 'keywords');

    // Step 4: Tailor the resume with pre-extracted keywords
    console.log('[TAILOR] 🎯 Step 4: Tailoring resume with AI...');
    const tailoredResult = await tailoringEngine.tailorResume(baseResumeContent, sanitizedJD, extractedKeywords);
    
    if (!tailoredResult.success) {
      console.log('[TAILOR] ❌ Tailoring failed:', tailoredResult.error);
      
      // Record failed session
      if (dbJobDescription) {
        await DatabaseService.createTailoringSession({
          sessionId,
          userId: user.id,
          jobDescriptionId: dbJobDescription.id,
          originalResumeId: null,
          originalContent: baseResumeContent,
          tailoredContent: '',
          processingTimeMs: Date.now() - startTime,
          aiModel: tailoredResult.metadata?.model || 'gpt-5',
          aiTokens: tailoredResult.metadata?.tokensUsed || 0
        });
        
        await DatabaseService.updateTailoringSession(sessionId, {
          status: 'failed',
          errorMessage: tailoredResult.error
        });
      }
      
      return res.status(500).json({
        success: false,
        error: 'Failed to tailor resume',
        details: tailoredResult.error
      });
    }
    
        console.log('[TAILOR] ✅ Tailoring successful (', tailoredResult.revised_tex.length, 'characters)');
    console.log('[TAILOR] 🪙 AI tokens used:', tailoredResult.metadata?.tokensUsed || 0);
    
    // Log keyword analysis results
    if (tailoredResult.keywordAnalysis) {
      console.log('[TAILOR] 🔑 Keyword Analysis Results:');
      console.log(`   - Total job keywords: ${tailoredResult.keywordAnalysis.totalJobKeywords}`);
      console.log(`   - New keywords found: ${tailoredResult.keywordAnalysis.newKeywordsCount}`);
      console.log(`   - Existing keywords: ${tailoredResult.keywordAnalysis.existingKeywordsCount}`);
      console.log(`   - Optimization rate: ${tailoredResult.keywordAnalysis.optimizationRate}%`);
    }



    // Update keywords based on actual implementation success
    if (dbTailoringSession && tailoredResult.appliedReplacements && tailoredResult.appliedReplacements.length > 0) {
      console.log('[TAILOR] 🔄 Updating keywords based on actual implementation...');
      
      // Extract keywords that were actually added from the replacements
      const actuallyAddedKeywords = tailoredResult.appliedReplacements.map(replacement => {
        // Extract the new keyword from the replacement
        const newText = replacement.replacement;
        // Find matching keywords in our extracted keywords
        return extractedKeywords.find(keyword => 
          newText.toLowerCase().includes(keyword.toLowerCase()) ||
          keyword.toLowerCase().includes(newText.toLowerCase())
        );
      }).filter(Boolean); // Remove undefined values
      
              if (actuallyAddedKeywords.length > 0) {
          console.log(`[TAILOR] ✅ Marking ${actuallyAddedKeywords.length} keywords as actually added`);
          await DatabaseService.markKeywordsAsAdded(dbTailoringSession.id, actuallyAddedKeywords);
        } else {
        console.log('[TAILOR] ⚠️ No keywords matched with actual replacements');
      }
    }
    
    // Create tailoring session record
    const processingTime = Date.now() - startTime;
    const sessionResult = await DatabaseService.createTailoringSession({
      sessionId,
      userId: user.id,
      jobDescriptionId: dbJobDescription?.id,
      originalResumeId: originalResumeId, // Link to custom resume if used
      originalContent: baseResumeContent,
      tailoredContent: tailoredResult.revised_tex,
      processingTimeMs: processingTime,
      aiModel: tailoredResult.metadata?.model || 'gpt-5',
      aiTokens: tailoredResult.metadata?.tokensUsed || 0,
      manualCompanyName: finalCompanyName, // Store the manual company name
      manualJobTitle: jobTitle // Store the job title
    });
    
    if (sessionResult.success) {
      dbTailoringSession = sessionResult.session;
      console.log('[TAILOR] 📊 Session record created:', dbTailoringSession.id);
      
      // Save keywords to database AFTER session is created (initially all marked as not added)
      if (extractedKeywords.length > 0) {
        await DatabaseService.saveExtractedKeywords({
          jobDescriptionId: dbJobDescription?.id,
          tailoringSessionId: dbTailoringSession.id,
          keywords: extractedKeywords
        });
        
        // Reset all keywords to not added initially (will be updated after AI processing)
        await DatabaseService.resetKeywordsAsNotAdded(dbTailoringSession.id);
      }
    }

    // Step 5: Validate and fix LaTeX content before saving
    console.log('[TAILOR] 🔍 Step 5: Validating and fixing LaTeX content...');
    const validationStart = Date.now();
    const validationResult = await latexValidator.validateAndFix(tailoredResult.revised_tex);
    const validationTime = Date.now() - validationStart;
    
    console.log('[TAILOR] ✅ Validation completed:', {
      contentChanged: validationResult.contentChanged,
      issuesFound: validationResult.issues.total,
      fixesApplied: validationResult.fixes.applied,
      remainingErrors: validationResult.remainingIssues.length,
      validationTime: `${validationTime}ms`
    });
    
    // Use the fixed content for compilation
    const finalTexContent = validationResult.fixedContent;
    
    // Step 6: Save the validated/fixed resume
    console.log('[TAILOR] 💾 Step 6: Saving validated resume...');
    const outputPath = path.join(__dirname, 'output', `resume_${sessionId}.tex`);
    await fs.writeFile(outputPath, finalTexContent);
    console.log('[TAILOR] Saved to:', outputPath);

    // Save TEX file record to database
    if (dbTailoringSession) {
      const texStats = await fs.stat(outputPath);
      await DatabaseService.saveGeneratedFile({
        tailoringSessionId: dbTailoringSession.id,
        fileType: 'tex',
        filePath: `/output/resume_${sessionId}.tex`,
        fileSize: texStats.size,
        mimeType: 'application/x-tex'
      });
    }

    // Step 7: Compile to PDF with enhanced logging
    console.log('[TAILOR] 📄 Step 7: Compiling LaTeX to PDF...');
    const latexStart = Date.now();
    const compilationResult = await latexCompiler.compileToPDF(outputPath);
    const latexTime = Date.now() - latexStart;
    
    if (compilationResult.success) {
      console.log('[TAILOR] ✅ PDF compilation successful!');
      console.log(`[TAILOR] 📊 Compilation stats: ${compilationResult.attempts} attempts, ${latexTime}ms total, PDF size: ${compilationResult.pdfSize || 'unknown'} bytes`);
    } else {
      console.log('[TAILOR] ❌ PDF compilation failed after', compilationResult.attempts, 'attempts');
      console.log('[TAILOR] 💡 Error details:', compilationResult.error);
      
      if (compilationResult.errorAnalysis) {
        console.log('[TAILOR] 🔍 Error analysis:');
        console.log('   - Error types:', compilationResult.errorAnalysis.errorTypes);
        console.log('   - Suggestions:', compilationResult.errorAnalysis.suggestions);
        if (compilationResult.errorAnalysis.criticalErrors.length > 0) {
          console.log('   - Critical errors:', compilationResult.errorAnalysis.criticalErrors);
        }
      }
      
      // Log a portion of the compilation log for debugging
      if (compilationResult.compilationLog) {
        const logLines = compilationResult.compilationLog.split('\n');
        const relevantLines = logLines.filter(line => 
          line.includes('!') || 
          line.toLowerCase().includes('error') || 
          line.toLowerCase().includes('warning')
        ).slice(0, 5); // Show first 5 relevant lines
        
        if (relevantLines.length > 0) {
          console.log('[TAILOR] 📝 Key log entries:');
          relevantLines.forEach(line => console.log('   ', line.trim()));
        }
      }
    }
    
    // Update session with compilation results
    if (dbTailoringSession) {
      const pdfPath = compilationResult.success ? `/output/resume_${sessionId}.pdf` : null;
      let pdfSize = 0;
      
      if (pdfPath && fs.existsSync(path.join(__dirname, 'output', `resume_${sessionId}.pdf`))) {
        const stats = fs.statSync(path.join(__dirname, 'output', `resume_${sessionId}.pdf`));
        pdfSize = stats.size;
      }
      
      await DatabaseService.updateTailoringSession(sessionId, {
        status: 'completed',
        latexCompilationSuccess: compilationResult.success,
        latexCompilationError: compilationResult.error,
        latexCompilationTimeMs: latexTime,
        texFilePath: `./output/resume_${sessionId}.tex`,
        pdfFilePath: pdfPath,
        pdfFileSize: pdfSize,
        // Add validation metadata
        validationSuccess: validationResult.success,
        validationIssuesFound: validationResult.issues.total,
        validationFixesApplied: validationResult.fixes.applied,
        validationTimeMs: validationTime,
        contentModifiedByValidation: validationResult.contentChanged
      });
      
      // Save file records
      if (dbTailoringSession) {
        // Save TEX file record
        await DatabaseService.saveGeneratedFile({
          tailoringSessionId: dbTailoringSession.id,
          fileType: 'tex',
          filePath: `/output/resume_${sessionId}.tex`,
          fileSize: tailoredResult.revised_tex.length,
          mimeType: 'text/x-tex'
        });
        
        // Save PDF file record if compilation succeeded
        if (compilationResult.success && pdfSize > 0) {
          await DatabaseService.saveGeneratedFile({
            tailoringSessionId: dbTailoringSession.id,
            fileType: 'pdf',
            filePath: `/output/resume_${sessionId}.pdf`,
            fileSize: pdfSize,
            mimeType: 'application/pdf'
          });
        }
      }

      // Analyze and save resume modifications
      if (dbTailoringSession) {
        console.log('[TAILOR] 🔍 Analyzing resume modifications...');
        try {
          let modifications = [];
          
          // First, try to use detailed replacement data from TailoringEngine
          if (tailoredResult.appliedReplacements && tailoredResult.appliedReplacements.length > 0) {
            console.log('[TAILOR] 📝 Using detailed replacement data from TailoringEngine');
            modifications = tailoredResult.appliedReplacements
              .filter(rep => rep.applied) // Only include successful replacements
              .map(rep => ({
                modificationType: 'targeted_replacement',
                sectionName: rep.section || 'unknown',
                originalText: rep.original.substring(0, 500),
                modifiedText: rep.replacement.substring(0, 500),
                reason: rep.reason,
                confidenceScore: 0.9 // High confidence since these are direct AI-generated replacements
              }));
            console.log('[TAILOR] ✅ Created', modifications.length, 'modification records from detailed replacement data');
          } else {
            // Fallback to generic section-level analysis
            console.log('[TAILOR] 📝 Falling back to section-level analysis');
            modifications = DatabaseService.analyzeResumeModifications(
              baseResumeContent, 
              tailoredResult.revised_tex, 
              extractedKeywords
            );
            console.log('[TAILOR] ✅ Created', modifications.length, 'modification records from section analysis');
          }
          
          if (modifications.length > 0) {
            await DatabaseService.saveResumeModifications({
              tailoringSessionId: dbTailoringSession.id,
              modifications: modifications
            });
            console.log('[TAILOR] ✅ Saved', modifications.length, 'resume modifications');
          }

          // Update keywords to mark which ones were actually added
          console.log('[TAILOR] 🔍 Updating keyword usage flags...');
          
          // Enhanced keyword detection using replacement data
          if (tailoredResult.appliedReplacements && tailoredResult.appliedReplacements.length > 0) {
            console.log('[TAILOR] 🎯 Using replacement data to identify added keywords...');
            
            // Extract keywords from replacement data
            const addedKeywordsFromReplacements = new Set();
            
            tailoredResult.appliedReplacements
              .filter(rep => rep.applied)
              .forEach(rep => {
                // Extract new keywords from the replacement text
                const originalWords = rep.original.toLowerCase().split(/[^a-zA-Z0-9]+/).filter(w => w.length > 2);
                const replacementWords = rep.replacement.toLowerCase().split(/[^a-zA-Z0-9]+/).filter(w => w.length > 2);
                
                // Find words that are in replacement but not in original
                replacementWords.forEach(word => {
                  if (!originalWords.includes(word)) {
                    addedKeywordsFromReplacements.add(word);
                    console.log(`[TAILOR] 🎯 Detected added keyword from replacement: "${word}"`);
                  }
                });
              });
            
            // Update the database with these identified keywords
            if (addedKeywordsFromReplacements.size > 0) {
              console.log(`[TAILOR] 🎯 Found ${addedKeywordsFromReplacements.size} keywords from replacement analysis`);
              await DatabaseService.markKeywordsAsAdded(dbTailoringSession.id, Array.from(addedKeywordsFromReplacements));
            }
          }
          
          // Also run the traditional text comparison method
          await DatabaseService.updateKeywordUsage(dbTailoringSession.id, baseResumeContent, tailoredResult.revised_tex);
          
        } catch (modError) {
          console.error('[TAILOR] ⚠️ Failed to analyze/save modifications:', modError);
        }
      }
    }
    
    const response = {
      success: true,
      sessionId: sessionId,
      revisedTex: finalTexContent, // Return the validated/fixed content
      texPath: `/output/resume_${sessionId}.tex`,
      compilationResult: compilationResult,
      validationResult: {
        success: validationResult.success,
        contentChanged: validationResult.contentChanged,
        issuesFound: validationResult.issues.total,
        fixesApplied: validationResult.fixes.applied,
        fixDetails: validationResult.fixes.details,
        remainingErrors: validationResult.remainingIssues.length,
        processingTimeMs: validationTime
      },
      compilationDetails: {
        attempts: compilationResult.attempts || 1,
        processingTime: latexTime,
        pdfSize: compilationResult.pdfSize,
        errorAnalysis: compilationResult.errorAnalysis
      },
      metadata: {
        originalResumeLength: baseResumeContent.length,
        tailoredResumeLength: tailoredResult.revised_tex.length,
        finalResumeLength: finalTexContent.length,
        jobDescriptionLength: sanitizedJD.length,
        companyName: finalCompanyName, // Include the final company name in response
        jobTitle: jobTitle, // Include the job title in response
        timestamp: new Date().toISOString()
      }
    };

    if (compilationResult.success) {
      response.pdfPath = `/output/resume_${sessionId}.pdf`;
    }

    console.log('[TAILOR] 🎉 Process completed successfully!');
    console.log('[TAILOR] 📊 Summary:');
    console.log('[TAILOR]   • Original resume:', baseResumeContent.length, 'chars');
    console.log('[TAILOR]   • Tailored resume:', tailoredResult.revised_tex.length, 'chars');
    console.log('[TAILOR]   • Final validated resume:', finalTexContent.length, 'chars');
    console.log('[TAILOR]   • LaTeX validation fixes applied:', validationResult.fixes.applied);
    console.log('[TAILOR]   • PDF compilation attempts:', compilationResult.attempts || 1);
    console.log('[TAILOR]   • PDF available:', !!compilationResult.success);
    console.log('[TAILOR]   • Company name used:', finalCompanyName);
    console.log('[TAILOR]   • Total processing time:', Date.now() - startTime, 'ms');
    
    // Deduct credits for successful tailoring
    const AuthService = require('./src/services/AuthService');
    const creditDeducted = await AuthService.deductCredits(
      user.id, 
      1, 
      dbTailoringSession?.id, 
      'Resume tailoring'
    );
    
    if (creditDeducted) {
      console.log('[TAILOR] 💳 1 credit deducted from user account');
    } else {
      console.log('[TAILOR] ⚠️ Failed to deduct credits');
    }
    
    // Update user usage count
    if (user) {
      await DatabaseService.updateUserUsageCount(user.id);
    }
    
    // Record system metrics
    await DatabaseService.recordSystemMetric(
      'session_completed', 
      1, 
      'count', 
      {
        sessionId,
        processingTimeMs: Date.now() - startTime,
        pdfGenerated: compilationResult.success,
        originalLength: baseResumeContent.length,
        tailoredLength: tailoredResult.revised_tex.length
      }
    );
    
    // Clear the timeout since we're sending a response
    clearTimeout(timeoutId);
    res.json(response);
    
  } catch (error) {
    console.error('[TAILOR] ❌ Error tailoring resume:', error);
    
    // Clear the timeout since we're handling an error
    clearTimeout(timeoutId);
    
    // Record error in session if possible
    if (dbTailoringSession) {
      try {
        await DatabaseService.updateTailoringSession(sessionId, {
          status: 'failed',
          errorMessage: error.message
        });
      } catch (dbError) {
        console.error('[TAILOR] ❌ Failed to record error in database:', dbError);
      }
    }
    
    // Record error metric
    await DatabaseService.recordSystemMetric(
      'session_failed', 
      1, 
      'count', 
      {
        error: error.message,
        stack: error.stack?.substring(0, 500) // Truncate stack trace
      }
    );
    
    res.status(500).json({
      success: false,
      error: 'Failed to tailor resume',
      details: error.message
    });
  }
});

/**
 * Download compiled PDF - requires authentication and user ownership validation
 */
app.get('/api/download/:sessionId', authenticateToken, async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.user.id;
  
  console.log('[DOWNLOAD] 📥 Download request for session:', sessionId, 'by user:', req.user.email);
  
  try {
    // First, verify that the user owns this session
    const session = await DatabaseService.getTailoringSession(sessionId);
    
    if (!session) {
      console.log('[DOWNLOAD] ❌ Session not found in database:', sessionId);
      // For backward compatibility, check if PDF exists in filesystem even without DB record
      const pdfPath = path.join(__dirname, 'output', `resume_${sessionId}.pdf`);
      
      if (!fs.existsSync(pdfPath)) {
        console.log('[DOWNLOAD] ❌ PDF file not found on disk either');
        return res.status(404).json({
          success: false,
          error: 'Session not found and PDF file not available'
        });
      }
      
      console.log('[DOWNLOAD] ⚠️ PDF exists but session not in database - allowing download for backward compatibility');
    } else if (session.user_id !== userId) {
      console.log('[DOWNLOAD] ❌ Access denied. Session belongs to user:', session.user_id, 'but requested by:', userId);
      return res.status(403).json({
        success: false,
        error: 'Access denied - you can only download your own resume files'
      });
    }
    
    const pdfPath = path.join(__dirname, 'output', `resume_${sessionId}.pdf`);
    console.log('[DOWNLOAD] Looking for PDF at:', pdfPath);
    
    if (fs.existsSync(pdfPath)) {
      const stats = fs.statSync(pdfPath);
      console.log('[DOWNLOAD] ✅ PDF found (', stats.size, 'bytes), access granted, starting download...');
      
      // Track download in database if session exists
      if (session) {
        try {
          await DatabaseService.incrementFileDownload(sessionId, 'pdf');
          await DatabaseService.recordSystemMetric(
            'file_downloaded',
            1,
            'count',
            {
              sessionId,
              userId,
              fileType: 'pdf',
              fileSize: stats.size
            }
          );
        } catch (dbError) {
          console.warn('[DOWNLOAD] ⚠️ Failed to record download:', dbError.message);
        }
      }
      
      // Set proper headers for PDF download with custom filename support
      const customFilename = req.query.filename || `tailored_resume_${sessionId}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${customFilename}"`);
      res.setHeader('Content-Length', stats.size);
      
      // Stream the file
      const fileStream = fs.createReadStream(pdfPath);
      fileStream.pipe(res);
      
      fileStream.on('error', (streamError) => {
        console.error('[DOWNLOAD] ❌ Stream error:', streamError);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: 'Failed to stream PDF file'
          });
        }
      });
      
      fileStream.on('end', () => {
        console.log('[DOWNLOAD] ✅ PDF download completed successfully');
      });
      
    } else {
      console.log('[DOWNLOAD] ❌ PDF file not found on disk');
      res.status(404).json({
        success: false,
        error: 'PDF file not found - it may have been cleaned up or compilation failed'
      });
    }
  } catch (error) {
    console.error('[DOWNLOAD] ❌ Error processing download request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process download request',
      details: error.message
    });
  }
});

/**
 * Analytics and Database API Endpoints
 */

/**
 * Get recent tailoring sessions for authenticated user
 */
app.get('/api/analytics/recent-sessions', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('[ANALYTICS] 📊 Fetching recent sessions for user:', req.user.email);
    const limit = parseInt(req.query.limit) || 10;
    
    // Get user's recent sessions only
    const sessions = await DatabaseService.getUserRecentSessions(userId, limit);
    
    res.json({
      success: true,
      sessions: sessions,
      count: sessions.length
    });
  } catch (error) {
    console.error('[ANALYTICS] ❌ Error fetching recent sessions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recent sessions',
      details: error.message
    });
  }
});

/**
 * Get keyword analytics for authenticated user's sessions
 */
app.get('/api/analytics/keywords', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('[ANALYTICS] 🔑 Fetching keyword analytics for user:', req.user.email);
    const limit = parseInt(req.query.limit) || 50;
    
    // Get keywords only from user's sessions
    const keywords = await DatabaseService.getUserKeywordAnalytics(userId, limit);
    
    res.json({
      success: true,
      keywords: keywords,
      count: keywords.length
    });
  } catch (error) {
    console.error('[ANALYTICS] ❌ Error fetching keyword analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch keyword analytics',
      details: error.message
    });
  }
});

/**
 * Get comprehensive user analytics
 */
app.get('/api/analytics/user-stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const timeRange = req.query.range || '30d';
    console.log('[ANALYTICS] 📊 Fetching user stats for:', req.user.email, 'Range:', timeRange);
    
    // Calculate date range
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const analytics = await DatabaseService.getUserAnalytics(userId, startDate.toISOString());
    
    res.json({
      success: true,
      analytics: analytics,
      timeRange: timeRange
    });
  } catch (error) {
    console.error('[ANALYTICS] ❌ Error fetching user stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user analytics',
      details: error.message
    });
  }
});

/**
 * Get usage analytics over time
 */
app.get('/api/analytics/usage', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const period = req.query.period || 'daily';
    const days = parseInt(req.query.days) || 30;
    console.log('[ANALYTICS] 📈 Fetching usage analytics for:', req.user.email);
    
    const analytics = await DatabaseService.getUserUsageAnalytics(userId, period, days);
    
    res.json({
      success: true,
      analytics: analytics,
      period: period,
      days: days
    });
  } catch (error) {
    console.error('[ANALYTICS] ❌ Error fetching usage analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch usage analytics',
      details: error.message
    });
  }
});

/**
 * Get user dashboard data - users can only access their own dashboard
 */
app.get('/api/analytics/user/:email', authenticateToken, async (req, res) => {
  try {
    const { email } = req.params;
    const authenticatedUserId = req.user.id;
    const authenticatedUserEmail = req.user.email;
    
    console.log('[ANALYTICS] 👤 Dashboard request for:', email, 'by authenticated user:', authenticatedUserEmail);
    
    // Users can only access their own dashboard data
    if (email !== authenticatedUserEmail) {
      console.log('[ANALYTICS] ❌ Access denied. User', authenticatedUserEmail, 'tried to access dashboard for', email);
      return res.status(403).json({
        success: false,
        error: 'Access denied - you can only view your own dashboard data'
      });
    }
    
    const dashboard = await DatabaseService.getUserDashboard(authenticatedUserId);
    
    console.log('[ANALYTICS] ✅ Dashboard access granted for user:', email);
    res.json({
      success: true,
      dashboard: dashboard
    });
  } catch (error) {
    console.error('[ANALYTICS] ❌ Error fetching user dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user dashboard',
      details: error.message
    });
  }
});

/**
 * Get system metrics - ADMIN ONLY endpoint
 * TODO: Implement proper admin role checking
 * For now, this endpoint is disabled for security
 */
app.get('/api/analytics/metrics', authenticateToken, async (req, res) => {
  try {
    // TODO: Add proper admin role checking here
    // For now, we'll restrict this endpoint entirely for security
    console.log('[ANALYTICS] ⚠️ System metrics access attempted by:', req.user.email);
    
    res.status(403).json({
      success: false,
      error: 'Access denied - system metrics require admin privileges',
      message: 'This endpoint is restricted for security. Contact administrator if you need access.'
    });
    
    /* DISABLED FOR SECURITY - Admin implementation needed
    console.log('[ANALYTICS] 📈 Fetching system metrics...');
    
    const supabase = dbConnection.getSupabaseClient();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data: metrics, error } = await supabase
      .from('system_metrics')
      .select('metric_name, metric_value, recorded_at')
      .gte('recorded_at', thirtyDaysAgo);
    
    if (error) {
      throw new Error(`Failed to fetch system metrics: ${error.message}`);
    }
    
    // Aggregate the metrics (since Supabase doesn't support GROUP BY with SUM/AVG in the same way)
    const aggregatedMetrics = {};
    (metrics || []).forEach(metric => {
      if (!aggregatedMetrics[metric.metric_name]) {
        aggregatedMetrics[metric.metric_name] = {
          metric_name: metric.metric_name,
          total_value: 0,
          record_count: 0,
          sum_for_avg: 0,
          last_recorded: metric.recorded_at
        };
      }
      
      const agg = aggregatedMetrics[metric.metric_name];
      agg.total_value += metric.metric_value || 0;
      agg.record_count += 1;
      agg.sum_for_avg += metric.metric_value || 0;
      if (metric.recorded_at > agg.last_recorded) {
        agg.last_recorded = metric.recorded_at;
      }
    });
    
    // Convert to final format and calculate averages
    const finalMetrics = Object.values(aggregatedMetrics).map(agg => ({
      metric_name: agg.metric_name,
      total_value: agg.total_value,
      record_count: agg.record_count,
      avg_value: agg.record_count > 0 ? agg.sum_for_avg / agg.record_count : 0,
      last_recorded: agg.last_recorded
    })).sort((a, b) => b.total_value - a.total_value);
    
    res.json({
      success: true,
      metrics: finalMetrics,
      period: '30 days'
    });
    */
  } catch (error) {
    console.error('[ANALYTICS] ❌ Error fetching system metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch system metrics',
      details: error.message
    });
  }
});

/**
 * Database cleanup endpoint
 */
app.post('/api/admin/cleanup', async (req, res) => {
  try {
    console.log('[ADMIN] 🧹 Starting comprehensive database cleanup...');
    
    const expiredFilesResult = await DatabaseService.cleanupExpiredFiles();
    const orphanedFilesResult = await DatabaseService.cleanupOrphanedFiles();
    
    // Additional cleanup could be added here
    // - Remove old sessions
    // - Archive old metrics
    // - Clean up temporary files
    
    res.json({
      success: true,
      cleaned: {
        expiredFiles: {
          deletedRecords: expiredFilesResult.deletedRecords || 0,
          deletedPhysicalFiles: expiredFilesResult.deletedPhysicalFiles || 0
        },
        orphanedFiles: {
          deletedFiles: orphanedFilesResult.deletedFiles || 0
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[ADMIN] ❌ Error during cleanup:', error);
    res.status(500).json({
      success: false,
      error: 'Cleanup failed',
      details: error.message
    });
  }
});

/**
 * Get file cleanup statistics
 */
app.get('/api/admin/cleanup/stats', authenticateToken, async (req, res) => {
  try {
    console.log('[ADMIN] 📊 Fetching cleanup statistics for user:', req.user.email);
    
    const stats = await fileCleanupManager.getCleanupStats();
    
    res.json({
      success: true,
      stats: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[ADMIN] ❌ Error fetching cleanup stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cleanup statistics',
      details: error.message
    });
  }
});

/**
 * Manual cleanup trigger (authenticated users only)
 */
app.post('/api/admin/cleanup/manual', authenticateToken, async (req, res) => {
  try {
    console.log('[ADMIN] 🧹 Manual cleanup triggered by user:', req.user.email);
    
    await fileCleanupManager.performCleanup();
    
    res.json({
      success: true,
      message: 'Manual cleanup completed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[ADMIN] ❌ Error during manual cleanup:', error);
    res.status(500).json({
      success: false,
      error: 'Manual cleanup failed',
      details: error.message
    });
  }
});

/**
 * Get session details by ID - with authentication and user ownership validation
 */
app.get('/api/sessions/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;
    
    console.log('[SESSION] 🔍 Fetching session details:', sessionId, 'for user:', req.user.email);
    
    const session = await DatabaseService.getTailoringSession(sessionId);
    
    if (!session) {
      console.log('[SESSION] ❌ Session not found:', sessionId);
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }
    
    // Verify user owns this session
    if (session.user_id !== userId) {
      console.log('[SESSION] ❌ Access denied. Session belongs to user:', session.user_id, 'but requested by:', userId);
      return res.status(403).json({
        success: false,
        error: 'Access denied - you can only view your own sessions'
      });
    }
    
    console.log('[SESSION] ✅ Access granted, returning session details');
    res.json({
      success: true,
      session: session
    });
  } catch (error) {
    console.error('[SESSION] ❌ Error fetching session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch session details',
      details: error.message
    });
  }
});

/**
 * Delete session by ID - with authentication and user ownership validation
 */
app.delete('/api/sessions/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;
    
    console.log('[SESSION] 🗑️ Delete request for session:', sessionId, 'by user:', req.user.email);
    
    const session = await DatabaseService.getTailoringSession(sessionId);
    
    if (!session) {
      console.log('[SESSION] ❌ Session not found:', sessionId);
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }
    
    // Verify user owns this session
    if (session.user_id !== userId) {
      console.log('[SESSION] ❌ Access denied. Session belongs to user:', session.user_id, 'but requested by:', userId);
      return res.status(403).json({
        success: false,
        error: 'Access denied - you can only delete your own sessions'
      });
    }
    
    // Delete the session and related data
    const deleteResult = await DatabaseService.deleteTailoringSession(sessionId, userId);
    
    if (deleteResult.success) {
      console.log('[SESSION] ✅ Session deleted successfully:', sessionId);
      res.json({
        success: true,
        message: 'Session deleted successfully'
      });
    } else {
      console.log('[SESSION] ❌ Failed to delete session:', deleteResult.error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete session',
        details: deleteResult.error
      });
    }
  } catch (error) {
    console.error('[SESSION] ❌ Error deleting session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete session',
      details: error.message
    });
  }
});

/**
 * Delete all sessions for authenticated user
 */
app.delete('/api/sessions/all', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log('[SESSION] 🗑️ Delete all sessions request by user:', req.user.email);
    
    const deleteResult = await DatabaseService.deleteAllUserSessions(userId);
    
    if (deleteResult.success) {
      console.log('[SESSION] ✅ All sessions deleted for user:', req.user.email, 'Count:', deleteResult.deletedCount);
      res.json({
        success: true,
        message: `${deleteResult.deletedCount} sessions deleted successfully`,
        deletedCount: deleteResult.deletedCount
      });
    } else {
      console.log('[SESSION] ❌ Failed to delete all sessions:', deleteResult.error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete sessions',
        details: deleteResult.error
      });
    }
  } catch (error) {
    console.error('[SESSION] ❌ Error deleting all sessions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete all sessions',
      details: error.message
    });
  }
});

/**
 * Serve the frontend for all other routes
 */
app.get('*', (req, res) => {
  const clientBuildPath = path.join(__dirname, 'client/build/index.html');
  if (fs.existsSync(clientBuildPath)) {
    res.sendFile(clientBuildPath);
  } else {
    res.status(404).json({
      success: false,
      error: 'Frontend not built. Run npm run build:client first.'
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    details: error.message
  });
});

// Initialize database and start server
async function startServer() {
  try {
    // Initialize database connections
    console.log('🔌 Initializing database connections...');
    await dbConnection.initialize();
    console.log('✅ Database connections established');

    // Start file cleanup manager
    console.log('🧹 Starting file cleanup manager...');
    fileCleanupManager.startAutomaticCleanup();
    console.log('✅ File cleanup manager started');
    
    // Start database file cleanup scheduler
    console.log('🗄️ Starting database file cleanup scheduler...');
    setInterval(async () => {
      try {
        console.log('[DB-CLEANUP] 🧹 Running periodic database file cleanup...');
        
        // Cleanup expired files
        const expiredResult = await DatabaseService.cleanupExpiredFiles();
        console.log('[DB-CLEANUP] ✅ Expired files cleanup:', expiredResult);
        
        // Cleanup orphaned files
        const orphanedResult = await DatabaseService.cleanupOrphanedFiles();
        console.log('[DB-CLEANUP] ✅ Orphaned files cleanup:', orphanedResult);
        
      } catch (error) {
        console.error('[DB-CLEANUP] ❌ Error during database file cleanup:', error);
      }
    }, 4 * 60 * 60 * 1000); // 4 hours in milliseconds
    console.log('✅ Database file cleanup scheduler started (every 4 hours)');

    // Start the server
    app.listen(PORT, () => {
      console.log(`🚀 Resume Builder Server running on port ${PORT}`);
      console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
      console.log(`📊 Database: Connected to PostgreSQL`);
      console.log(`🧹 File cleanup: Running every 24 hours`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server...');
  try {
    // Stop file cleanup manager
    fileCleanupManager.stopAutomaticCleanup();
    
    await dbConnection.close();
    console.log('✅ Database connections closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Server termination requested...');
  try {
    // Stop file cleanup manager
    fileCleanupManager.stopAutomaticCleanup();
    
    await dbConnection.close();
    console.log('✅ Database connections closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

// Start the server
startServer();

module.exports = app; 