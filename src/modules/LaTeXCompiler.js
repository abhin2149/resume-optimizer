const fs = require('fs-extra');
const path = require('path');
const { spawn } = require('child_process');

/**
 * Module responsible for compiling LaTeX files to PDF
 * Handles pdflatex execution and error reporting
 */
class LaTeXCompiler {
  constructor() {
    this.latexCommand = process.env.LATEX_COMMAND || 'pdflatex';
    this.timeout = parseInt(process.env.LATEX_TIMEOUT) || 45000; // 45 seconds - increased timeout
    this.maxAttempts = 3; // Number of compilation attempts
    this.maxPasses = 2; // LaTeX passes for references/cross-refs
    this.retryDelay = 1500; // Delay between retries (increased)
    this.fileCheckTimeout = 5000; // Time to wait for file operations
  }

  /**
   * Compile LaTeX file to PDF with enhanced error handling and multi-pass compilation
   * @param {string} texFilePath - Path to the .tex file
   * @returns {Promise<Object>} - Compilation result
   */
  async compileToPDF(texFilePath) {
    const startTime = Date.now();
    console.log('[LATEX-COMPILER] 🔧 Starting enhanced PDF compilation...');
    
    try {
      // Validate input and wait for file to be fully written
      await this.validateAndWaitForFile(texFilePath);

      const directory = path.dirname(texFilePath);
      const filename = path.basename(texFilePath, '.tex');
      const pdfPath = path.join(directory, `${filename}.pdf`);

      console.log('[LATEX-COMPILER] 📁 Working directory:', directory);
      console.log('[LATEX-COMPILER] 📄 Compiling:', filename);

      // Clean up any existing files from previous compilations
      await this.cleanupAllFiles(directory, filename);

      let lastError = null;
      let compilationLog = '';
      let bestResult = null;

      // Attempt compilation multiple times with progressive strategy
      for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
        console.log(`[LATEX-COMPILER] 🔄 Attempt ${attempt}/${this.maxAttempts}`);
        
        try {
          const attemptResult = await this.performCompilationAttempt(
            texFilePath, 
            directory, 
            filename, 
            pdfPath, 
            attempt
          );
          
          compilationLog += attemptResult.log;

          if (attemptResult.success) {
            console.log(`[LATEX-COMPILER] ✅ Compilation successful on attempt ${attempt}`);
            
            // Verify PDF quality
            const pdfInfo = await this.getPdfInfo(pdfPath);
            if (pdfInfo.exists && pdfInfo.size > 1000) { // Minimum reasonable PDF size
              
              // Clean up auxiliary files but keep the PDF
              await this.cleanupAuxFiles(directory, filename);
              
              return {
                success: true,
                pdfPath: pdfPath,
                compilationLog: compilationLog,
                attempts: attempt,
                processingTime: Date.now() - startTime,
                pdfSize: pdfInfo.size,
                timestamp: new Date().toISOString()
              };
            } else {
              console.log('[LATEX-COMPILER] ⚠️ PDF generated but appears corrupted or too small');
              lastError = 'Generated PDF appears corrupted or incomplete';
            }
          } else {
            lastError = attemptResult.error;
            
            // Store the best result so far (for progressive improvement)
            if (!bestResult || attemptResult.exitCode < bestResult.exitCode) {
              bestResult = attemptResult;
            }
          }
        } catch (error) {
          lastError = error.message;
          compilationLog += `[Attempt ${attempt}] Exception: ${error.message}\n`;
          console.log(`[LATEX-COMPILER] ❌ Attempt ${attempt} failed with exception:`, error.message);
        }

        // Progressive delay between retries (exponential backoff)
        if (attempt < this.maxAttempts) {
          const delay = this.retryDelay * attempt; // Increasing delay
          console.log(`[LATEX-COMPILER] ⏱️ Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      // All attempts failed - provide detailed error analysis
      console.log('[LATEX-COMPILER] ❌ All compilation attempts failed');
      
      // Clean up everything
      await this.cleanupAllFiles(directory, filename);
      
      // Analyze the compilation log for better error reporting
      const errorAnalysis = this.analyzeCompilationErrors(compilationLog);
      
      return {
        success: false,
        error: this.generateEnhancedErrorMessage(lastError, errorAnalysis),
        compilationLog: compilationLog,
        attempts: this.maxAttempts,
        processingTime: Date.now() - startTime,
        errorAnalysis: errorAnalysis,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.log('[LATEX-COMPILER] ❌ Critical error:', error.message);
      
      return {
        success: false,
        error: `Critical compilation error: ${error.message}`,
        compilationLog: `Critical Error: ${error.message}`,
        attempts: 0,
        processingTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Validate input file and wait for it to be fully written
   * @param {string} texFilePath - Path to the .tex file
   */
  async validateAndWaitForFile(texFilePath) {
    if (!await fs.pathExists(texFilePath)) {
      throw new Error(`LaTeX file not found: ${texFilePath}`);
    }

    // Wait for file to be fully written (check file size stability)
    let previousSize = 0;
    let stableCount = 0;
    const maxWait = this.fileCheckTimeout;
    const checkInterval = 200;
    let waited = 0;

    while (waited < maxWait) {
      const stats = await fs.stat(texFilePath);
      const currentSize = stats.size;

      if (currentSize === previousSize) {
        stableCount++;
        if (stableCount >= 3) { // File size stable for 3 checks
          break;
        }
      } else {
        stableCount = 0;
        previousSize = currentSize;
      }

      await new Promise(resolve => setTimeout(resolve, checkInterval));
      waited += checkInterval;
    }

    console.log('[LATEX-COMPILER] 📝 File validated and ready for compilation');
  }

  /**
   * Perform a complete compilation attempt with multi-pass strategy
   * @param {string} texFilePath - Path to .tex file
   * @param {string} directory - Working directory
   * @param {string} filename - Base filename
   * @param {string} pdfPath - Expected PDF output path
   * @param {number} attempt - Current attempt number
   * @returns {Promise<Object>} - Compilation attempt result
   */
  async performCompilationAttempt(texFilePath, directory, filename, pdfPath, attempt) {
    let fullLog = '';
    let lastResult = null;

    // Multi-pass compilation (LaTeX often needs multiple passes for references)
    for (let pass = 1; pass <= this.maxPasses; pass++) {
      console.log(`[LATEX-COMPILER] 🔄 Pass ${pass}/${this.maxPasses} (Attempt ${attempt})`);
      
      const result = await this.runPdfLatex(texFilePath, directory);
      fullLog += `=== Pass ${pass} ===\n${result.stdout}\n${result.stderr}\n\n`;
      lastResult = result;

      // Check if PDF was generated successfully
      if (result.success && await fs.pathExists(pdfPath)) {
        const pdfStats = await fs.stat(pdfPath);
        if (pdfStats.size > 0) {
          console.log(`[LATEX-COMPILER] ✅ PDF generated successfully (${pdfStats.size} bytes)`);
          return {
            success: true,
            log: fullLog,
            exitCode: result.exitCode,
            pdfSize: pdfStats.size
          };
        }
      }

      // If this is not the last pass and we had errors, continue to next pass
      if (pass < this.maxPasses && !result.success) {
        console.log(`[LATEX-COMPILER] ⚠️ Pass ${pass} failed, trying pass ${pass + 1}...`);
        await new Promise(resolve => setTimeout(resolve, 500)); // Brief pause between passes
      }
    }

    // All passes completed but no success
    return {
      success: false,
      log: fullLog,
      exitCode: lastResult?.exitCode || -1,
      error: lastResult?.stderr || 'All compilation passes failed'
    };
  }

  /**
   * Clean up all files including auxiliary files and PDFs
   * @param {string} directory - Directory containing files
   * @param {string} filename - Base filename (without extension)
   */
  async cleanupAllFiles(directory, filename) {
    const allExtensions = ['.aux', '.log', '.out', '.toc', '.nav', '.snm', '.vrb', '.fls', '.fdb_latexmk', '.pdf'];
    
    for (const ext of allExtensions) {
      const file = path.join(directory, filename + ext);
      try {
        await fs.remove(file);
      } catch (error) {
        // Ignore errors when cleaning up (file might not exist)
      }
    }
  }

  /**
   * Analyze compilation errors to provide better error messages
   * @param {string} compilationLog - Full compilation log
   * @returns {Object} - Error analysis
   */
  analyzeCompilationErrors(compilationLog) {
    const analysis = {
      hasErrors: false,
      errorTypes: [],
      suggestions: [],
      criticalErrors: [],
      warnings: []
    };

    const lines = compilationLog.toLowerCase().split('\n');

    // Check for common error patterns
    for (const line of lines) {
      if (line.includes('! ') || line.includes('error:')) {
        analysis.hasErrors = true;
        
        // Categorize specific error types
        if (line.includes('undefined control sequence')) {
          analysis.errorTypes.push('undefined_command');
          analysis.suggestions.push('Check for typos in LaTeX commands or missing packages');
        } else if (line.includes('missing $') || line.includes('math mode')) {
          analysis.errorTypes.push('math_mode_error');
          analysis.suggestions.push('Check math mode syntax (missing $ or $$ delimiters)');
        } else if (line.includes('package') && line.includes('not found')) {
          analysis.errorTypes.push('missing_package');
          analysis.suggestions.push('Install missing LaTeX packages');
        } else if (line.includes('runaway argument') || line.includes('paragraph ended')) {
          analysis.errorTypes.push('syntax_error');
          analysis.suggestions.push('Check for missing closing braces or incorrect syntax');
        } else if (line.includes('emergency stop')) {
          analysis.criticalErrors.push('Emergency stop - critical LaTeX error');
        }
      }

      if (line.includes('warning:')) {
        analysis.warnings.push(line.trim());
      }
    }

    return analysis;
  }

  /**
   * Generate enhanced error message based on error analysis
   * @param {string} originalError - Original error message
   * @param {Object} errorAnalysis - Error analysis result
   * @returns {string} - Enhanced error message
   */
  generateEnhancedErrorMessage(originalError, errorAnalysis) {
    let message = originalError || 'PDF compilation failed';

    if (errorAnalysis.hasErrors && errorAnalysis.suggestions.length > 0) {
      message += '\n\nSuggested fixes:\n';
      errorAnalysis.suggestions.forEach((suggestion, index) => {
        message += `${index + 1}. ${suggestion}\n`;
      });
    }

    if (errorAnalysis.criticalErrors.length > 0) {
      message += '\n\nCritical errors detected:\n';
      errorAnalysis.criticalErrors.forEach(error => {
        message += `• ${error}\n`;
      });
    }

    return message;
  }

  /**
   * Run pdflatex command on a file
   * @param {string} texFilePath - Path to .tex file
   * @param {string} directory - Working directory
   * @returns {Promise<Object>} - Command execution result
   */
  async runPdfLatex(texFilePath, directory) {
    return new Promise((resolve, reject) => {
      const filename = path.basename(texFilePath);
      
      // Enhanced pdflatex arguments for better compilation
      const args = [
        '-interaction=nonstopmode',     // Don't stop for errors
        '-file-line-error',             // Show file and line for errors
        '-synctex=1',                   // Enable SyncTeX for better debugging
        '-output-directory=' + directory,
        filename
      ];

      console.log(`[LATEX-COMPILER] 🔧 Running: ${this.latexCommand} ${args.join(' ')}`);

      const childProcess = spawn(this.latexCommand, args, {
        cwd: directory,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, TEXMFOUTPUT: directory }, // Ensure output goes to right directory
        timeout: this.timeout
      });

      let stdout = '';
      let stderr = '';
      let isTimedOut = false;

      // Set up timeout handling
      const timeoutHandle = setTimeout(() => {
        isTimedOut = true;
        if (!childProcess.killed) {
          console.log('[LATEX-COMPILER] ⏰ Process timed out, killing...');
          childProcess.kill('SIGKILL'); // Force kill after timeout
        }
      }, this.timeout);

      childProcess.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        // Log progress indicators
        if (output.includes('Output written on')) {
          console.log('[LATEX-COMPILER] 📄 PDF output detected');
        }
      });

      childProcess.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        // Log critical errors immediately
        if (output.toLowerCase().includes('emergency stop')) {
          console.log('[LATEX-COMPILER] 🚨 Emergency stop detected');
        }
      });

      childProcess.on('close', (code, signal) => {
        clearTimeout(timeoutHandle);
        
        if (isTimedOut) {
          reject(new Error(`pdflatex compilation timed out after ${this.timeout}ms`));
          return;
        }

        if (signal) {
          reject(new Error(`pdflatex process killed by signal: ${signal}`));
          return;
        }

        const success = code === 0;
        console.log(`[LATEX-COMPILER] 🏁 Process completed with exit code: ${code}`);
        
        resolve({
          success: success,
          exitCode: code,
          stdout: stdout,
          stderr: stderr,
          hasOutput: stdout.includes('Output written on') || stdout.includes('.pdf'),
          hasErrors: stderr.length > 0 || stdout.toLowerCase().includes('error') || stdout.includes('!')
        });
      });

      childProcess.on('error', (error) => {
        clearTimeout(timeoutHandle);
        console.log('[LATEX-COMPILER] ❌ Process error:', error.message);
        reject(new Error(`Failed to start pdflatex: ${error.message}`));
      });

      // Handle process spawn failure
      childProcess.on('spawn', () => {
        console.log('[LATEX-COMPILER] 🚀 Process spawned successfully');
      });
    });
  }

  /**
   * Clean up auxiliary files created by LaTeX compilation
   * @param {string} directory - Directory containing files
   * @param {string} filename - Base filename (without extension)
   */
  async cleanupAuxFiles(directory, filename) {
    const auxExtensions = ['.aux', '.log', '.out', '.toc', '.nav', '.snm', '.vrb', '.fls', '.fdb_latexmk'];
    
    for (const ext of auxExtensions) {
      const auxFile = path.join(directory, filename + ext);
      try {
        await fs.remove(auxFile);
      } catch (error) {
        // Ignore errors when cleaning up (file might not exist)
      }
    }
  }

  /**
   * Validate LaTeX installation and check if pdflatex is available
   * @returns {Promise<Object>} - Validation result
   */
  async validateLatexInstallation() {
    try {
      const result = await this.runLatexCommand(['--version']);
      
      return {
        available: true,
        version: result.stdout.split('\n')[0] || 'Unknown version',
        command: this.latexCommand,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        available: false,
        error: error.message,
        command: this.latexCommand,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Run a LaTeX command with arguments
   * @param {Array} args - Command arguments
   * @returns {Promise<Object>} - Command result
   */
  async runLatexCommand(args) {
    return new Promise((resolve, reject) => {
      const childProcess = spawn(this.latexCommand, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 5000 // Short timeout for version check
      });

      let stdout = '';
      let stderr = '';

      childProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      childProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      childProcess.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Command failed with exit code ${code}: ${stderr}`));
        }
      });

      childProcess.on('error', (error) => {
        reject(new Error(`Failed to execute command: ${error.message}`));
      });
    });
  }

  /**
   * Parse LaTeX log file for errors and warnings
   * @param {string} logContent - Content of the .log file
   * @returns {Object} - Parsed errors and warnings
   */
  parseLatexLog(logContent) {
    const errors = [];
    const warnings = [];
    const lines = logContent.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Check for errors
      if (line.includes('! ') || line.includes('Error:')) {
        errors.push({
          type: 'error',
          line: i + 1,
          message: line,
          context: lines.slice(Math.max(0, i - 1), i + 3).join('\n')
        });
      }

      // Check for warnings
      if (line.includes('Warning:') || line.includes('warning')) {
        warnings.push({
          type: 'warning',
          line: i + 1,
          message: line,
          context: lines.slice(Math.max(0, i - 1), i + 2).join('\n')
        });
      }
    }

    return {
      errors: errors,
      warnings: warnings,
      errorCount: errors.length,
      warningCount: warnings.length
    };
  }

  /**
   * Get PDF file information
   * @param {string} pdfPath - Path to PDF file
   * @returns {Promise<Object>} - PDF file information
   */
  async getPdfInfo(pdfPath) {
    try {
      if (!await fs.pathExists(pdfPath)) {
        throw new Error('PDF file not found');
      }

      const stats = await fs.stat(pdfPath);
      
      return {
        exists: true,
        path: pdfPath,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        readable: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        exists: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Create a test LaTeX document and compile it
   * @param {string} outputDir - Directory for test files
   * @returns {Promise<Object>} - Test result
   */
  async testCompilation(outputDir) {
    const testContent = `\\documentclass{article}
\\begin{document}
\\title{Test Document}
\\author{Resume Builder}
\\date{\\today}
\\maketitle

This is a test document to verify LaTeX compilation is working.

\\section{Test Section}
This section contains some test content with \\textbf{bold text} and \\textit{italic text}.

\\end{document}`;

    try {
      await fs.ensureDir(outputDir);
      const testTexPath = path.join(outputDir, 'test.tex');
      await fs.writeFile(testTexPath, testContent);

      const result = await this.compileToPDF(testTexPath);
      
      // Clean up test files
      await fs.remove(testTexPath);
      if (result.success && result.pdfPath) {
        await fs.remove(result.pdfPath);
      }

      return {
        success: result.success,
        compilationTime: result.timestamp,
        error: result.error,
        testContent: testContent.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        testContent: testContent.length
      };
    }
  }
}

module.exports = LaTeXCompiler; 