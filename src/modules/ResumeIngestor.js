const fs = require('fs-extra');
const path = require('path');

/**
 * Module responsible for ingesting and validating LaTeX resume files
 * Handles file loading, UTF-8 validation, and basic LaTeX structure validation
 */
class ResumeIngestor {
  constructor() {
    this.supportedExtensions = ['.tex'];
    this.maxFileSize = 5 * 1024 * 1024; // 5MB
  }

  /**
   * Load and validate a LaTeX resume file
   * @param {string} filePath - Path to the resume file
   * @returns {Promise<string>} - Raw LaTeX content
   */
  async loadResumeFile(filePath) {
    try {
      // Check if file exists
      if (!await fs.pathExists(filePath)) {
        throw new Error(`Resume file not found: ${filePath}`);
      }

      // Check file extension
      const ext = path.extname(filePath).toLowerCase();
      if (!this.supportedExtensions.includes(ext)) {
        throw new Error(`Unsupported file extension: ${ext}. Supported extensions: ${this.supportedExtensions.join(', ')}`);
      }

      // Check file size
      const stats = await fs.stat(filePath);
      if (stats.size > this.maxFileSize) {
        throw new Error(`File too large: ${stats.size} bytes. Maximum allowed: ${this.maxFileSize} bytes`);
      }

      // Read file content
      const content = await fs.readFile(filePath, 'utf8');
      
      // Validate UTF-8 encoding and basic LaTeX structure
      this.validateLaTeXContent(content);
      
      return content;
    } catch (error) {
      throw new Error(`Failed to load resume file: ${error.message}`);
    }
  }

  /**
   * Validate LaTeX content structure and encoding
   * @param {string} content - LaTeX file content
   */
  validateLaTeXContent(content) {
    if (!content || typeof content !== 'string') {
      throw new Error('Invalid content: must be a non-empty string');
    }

    // Check for required LaTeX elements
    const requiredElements = [
      '\\documentclass',
      '\\begin{document}',
      '\\end{document}'
    ];

    for (const element of requiredElements) {
      if (!content.includes(element)) {
        throw new Error(`Missing required LaTeX element: ${element}`);
      }
    }

    // Check for UTF-8 compatibility
    try {
      // Attempt to encode as UTF-8 buffer and decode back
      const buffer = Buffer.from(content, 'utf8');
      const decoded = buffer.toString('utf8');
      if (decoded !== content) {
        throw new Error('Content is not valid UTF-8');
      }
    } catch (error) {
      throw new Error(`UTF-8 validation failed: ${error.message}`);
    }

    // Validate document structure balance
    this.validateBraceBalance(content);
    this.validateEnvironmentBalance(content);
  }

  /**
   * Validate that braces are properly balanced in LaTeX content
   * @param {string} content - LaTeX content
   */
  validateBraceBalance(content) {
    let braceCount = 0;
    let inComment = false;
    
    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      const prevChar = i > 0 ? content[i - 1] : '';
      
      // Handle comments
      if (char === '%' && prevChar !== '\\') {
        inComment = true;
        continue;
      }
      
      if (char === '\n') {
        inComment = false;
        continue;
      }
      
      if (inComment) continue;
      
      // Count unescaped braces
      if (char === '{' && prevChar !== '\\') {
        braceCount++;
      } else if (char === '}' && prevChar !== '\\') {
        braceCount--;
      }
      
      // Check for negative balance
      if (braceCount < 0) {
        throw new Error('Unbalanced braces: closing brace without matching opening brace');
      }
    }
    
    if (braceCount !== 0) {
      throw new Error(`Unbalanced braces: ${braceCount} unmatched opening braces`);
    }
  }

  /**
   * Validate that LaTeX environments are properly balanced
   * @param {string} content - LaTeX content
   */
  validateEnvironmentBalance(content) {
    const environmentStack = [];
    const beginRegex = /\\begin\{([^}]+)\}/g;
    const endRegex = /\\end\{([^}]+)\}/g;
    
    let match;
    const commands = [];
    
    // Collect all begin/end commands with positions
    while ((match = beginRegex.exec(content)) !== null) {
      commands.push({
        type: 'begin',
        environment: match[1],
        position: match.index
      });
    }
    
    while ((match = endRegex.exec(content)) !== null) {
      commands.push({
        type: 'end',
        environment: match[1],
        position: match.index
      });
    }
    
    // Sort by position
    commands.sort((a, b) => a.position - b.position);
    
    // Validate balance
    for (const command of commands) {
      if (command.type === 'begin') {
        environmentStack.push(command.environment);
      } else {
        if (environmentStack.length === 0) {
          throw new Error(`Unbalanced environments: \\end{${command.environment}} without matching \\begin{${command.environment}}`);
        }
        
        const lastEnv = environmentStack.pop();
        if (lastEnv !== command.environment) {
          throw new Error(`Mismatched environments: expected \\end{${lastEnv}} but found \\end{${command.environment}}`);
        }
      }
    }
    
    if (environmentStack.length > 0) {
      throw new Error(`Unbalanced environments: unmatched \\begin{${environmentStack.join(', ')}}`);
    }
  }

  /**
   * Extract metadata from LaTeX resume
   * @param {string} content - LaTeX content
   * @returns {Object} - Metadata object
   */
  extractMetadata(content) {
    const metadata = {
      documentClass: null,
      packages: [],
      customCommands: [],
      sections: [],
      estimatedTokens: Math.ceil(content.length / 4) // Rough estimate
    };

    // Extract document class
    const docClassMatch = content.match(/\\documentclass(?:\[[^\]]*\])?\{([^}]+)\}/);
    if (docClassMatch) {
      metadata.documentClass = docClassMatch[1];
    }

    // Extract packages
    const packageMatches = content.matchAll(/\\usepackage(?:\[[^\]]*\])?\{([^}]+)\}/g);
    for (const match of packageMatches) {
      metadata.packages.push(match[1]);
    }

    // Extract custom commands
    const commandMatches = content.matchAll(/\\newcommand\{([^}]+)\}/g);
    for (const match of commandMatches) {
      metadata.customCommands.push(match[1]);
    }

    // Extract sections
    const sectionMatches = content.matchAll(/\\section\{([^}]+)\}/g);
    for (const match of sectionMatches) {
      metadata.sections.push(match[1]);
    }

    return metadata;
  }

  /**
   * Get file info for uploaded files
   * @param {string} filePath - Path to file
   * @returns {Promise<Object>} - File information
   */
  async getFileInfo(filePath) {
    try {
      const stats = await fs.stat(filePath);
      const content = await this.loadResumeFile(filePath);
      const metadata = this.extractMetadata(content);
      
      return {
        path: filePath,
        size: stats.size,
        modified: stats.mtime,
        created: stats.birthtime,
        extension: path.extname(filePath),
        encoding: 'utf8',
        metadata: metadata,
        valid: true
      };
    } catch (error) {
      return {
        path: filePath,
        valid: false,
        error: error.message
      };
    }
  }
}

module.exports = ResumeIngestor; 