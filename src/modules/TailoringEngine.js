const Anthropic = require('@anthropic-ai/sdk');

class TailoringEngine {
  constructor() {
    this.model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
    this.temperature = parseFloat(process.env.OPENAI_TEMPERATURE) || 0.3;
    this.maxTokens = parseInt(process.env.OPENAI_MAX_TOKENS) || 16000;

    console.log(`[TAILOR] 🔧 TailoringEngine initialized with model: ${this.model}`);
    console.log(`[TAILOR] 🔧 Max Tokens: ${this.maxTokens}, Temperature: ${this.temperature}`);

    // Initialize Anthropic client
    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY
      });
      console.log('[TAILOR] 🔑 Anthropic API Key configured: true');
    } else {
      console.warn('[TAILOR] ⚠️ Anthropic API Key not configured');
    }
  }

  /**
   * Main method to tailor resume content using AI
   * @param {string} baseResumeContent - Original LaTeX resume content
   * @param {string} jobDescription - Target job description
   * @param {Array<string>} preExtractedKeywords - Optional pre-extracted keywords from server (prevents duplicate extraction)
   * @returns {Promise<Object>} - Result object with revised_tex and compile_log
   */
  async tailorResume(baseResumeContent, jobDescription, preExtractedKeywords = null) {
    try {
      // Validate inputs
      this.validateInputs(baseResumeContent, jobDescription);
      
      console.log('[TAILOR] 🎯 Starting resume tailoring process...');
      
      // Step 1: Extract existing keywords from resume
      console.log('[TAILOR] 🔍 Step 1: Analyzing existing resume keywords...');
      const existingResumeKeywords = this.extractResumeKeywords(baseResumeContent);
      
      // Step 2: Use pre-extracted keywords or extract if not provided
      let jobKeywords;
      if (preExtractedKeywords && Array.isArray(preExtractedKeywords)) {
        console.log('[TAILOR] 🔍 Step 2: Using pre-extracted keywords from server...');
        jobKeywords = preExtractedKeywords;
        console.log(`[TAILOR] ✅ Using ${jobKeywords.length} pre-extracted keywords`);
      } else {
        console.log('[TAILOR] 🔍 Step 2: Extracting job description keywords (fallback)...');
        jobKeywords = await this.extractJobDescriptionKeywords(jobDescription);
        console.log(`[TAILOR] ⚠️ Fallback extraction: ${jobKeywords.length} keywords`);
      }
      
      // Step 3: Filter keywords to find only new ones
      console.log('[TAILOR] 🔍 Step 3: Filtering keywords for optimization...');
      const keywordAnalysis = this.filterNewKeywords(existingResumeKeywords, jobKeywords);
      
      // Step 4: Create AI prompt for targeted replacements
      console.log('[TAILOR] 🤖 Step 4: Creating AI prompt for targeted replacements...');
      const prompt = this.createTailoringPrompt(baseResumeContent, jobDescription, keywordAnalysis);
      
      // Step 5: Call Anthropic API
      console.log('[TAILOR] 🤖 Step 5: Calling Anthropic API...');
      const result = await this.callAnthropic(prompt);

      if (!result.success) {
        throw new Error(`Anthropic API call failed: ${result.error}`);
      }

      // Default to original content; overwritten below if replacements are applied
      result.revised_tex = baseResumeContent;

      // Step 6: Apply targeted replacements with line character validation
      console.log('[TAILOR] 🎯 Step 6: Applying targeted replacements with line character validation...');
      let appliedReplacements = [];
      if (result.replacements && Array.isArray(result.replacements)) {
        const { enhancedContent, appliedReplacements: applied } = this.applyTargetedReplacementsWithDetails(baseResumeContent, result.replacements);
        result.revised_tex = enhancedContent;
        appliedReplacements = applied;
      }

      // Validate the result
      this.validateTailoredResult(result, baseResumeContent);
      
      // Calculate tokens used
      const tokensUsed = result.usage || null;
      
      console.log('[TAILOR] ✅ Resume tailoring completed successfully!');
      
      return {
        success: true,
        revised_tex: result.revised_tex,
        compile_log: result.compile_log || 'No compilation log available',
        keywordAnalysis: keywordAnalysis,
        appliedReplacements: appliedReplacements,
        metadata: {
          originalLength: baseResumeContent.length,
          tailoredLength: result.revised_tex.length,
          timestamp: new Date().toISOString(),
          model: this.model,
          tokensUsed: tokensUsed?.totalTokens || 0,
          replacementsAttempted: result.replacements?.length || 0,
          replacementsApplied: appliedReplacements.length,
          keywordsAnalyzed: keywordAnalysis ? keywordAnalysis.totalJobKeywords : 0,
          newKeywordsFound: keywordAnalysis ? keywordAnalysis.newKeywordsCount : 0,
          existingKeywordsFound: keywordAnalysis ? keywordAnalysis.existingKeywordsCount : 0,
          optimizationRate: keywordAnalysis ? keywordAnalysis.optimizationRate : '0.0'
        }
      };
      
    } catch (error) {
      console.error('[TAILOR] ❌ Error tailoring resume:', error.message);
      
      return {
        success: false,
        error: error.message,
        revised_tex: baseResumeContent, // Return original content on error
        compile_log: `Error: ${error.message}`,
        metadata: {
          originalLength: baseResumeContent.length,
          tailoredLength: baseResumeContent.length,
          timestamp: new Date().toISOString(),
          model: this.model,
          tokensUsed: 0,
          keywordsAnalyzed: 0,
          newKeywordsFound: 0,
          existingKeywordsFound: 0,
          optimizationRate: '0.0'
        }
      };
    }
  }

  /**
   * Parse LaTeX content into individual resumeItem lines with character limits
   * @param {string} content - LaTeX content
   * @returns {Array} - Array of line objects with metadata
   */
  parseResumeItemLines(content) {
    try {
      const bulletRegex = /\\resumeItem\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
      const lines = [];
      let match;
      let lineIndex = 0;

      while ((match = bulletRegex.exec(content)) !== null) {
        const fullCommand = match[0];
        const lineContent = match[1];
        const lineLength = lineContent.length;
        
        // Get character limit based on actual line length
        const maxLength = this.getLineCharacterLimit(lineContent);
        
        lines.push({
          index: lineIndex++,
          fullCommand: fullCommand,
          content: lineContent,
          length: lineLength,
          maxLength: maxLength,
          withinLimit: lineLength <= maxLength,
          availableSpace: Math.max(0, maxLength - lineLength)
        });
      }

      console.log(`[TAILOR] 📏 Parsed ${lines.length} resumeItem lines with strict character count limits`);
      return lines;
    } catch (error) {
      console.error('[TAILOR] ❌ Error parsing resumeItem lines:', error);
      return [];
    }
  }

  /**
   * Parse all keyword-rich LaTeX content from resume
   * @param {string} content - LaTeX content to parse
   * @returns {Array} - Array of parsed content objects
   */
  parseResumeContent(content) {
    try {
      const lines = [];
      let lineIndex = 0;

      // 1. Parse \resumeItem lines (bullet points)
      const resumeItemRegex = /\\resumeItem\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
      let match;
      while ((match = resumeItemRegex.exec(content)) !== null) {
        const fullCommand = match[0];
        const lineContent = match[1];
        const lineLength = lineContent.length;
        const maxLength = this.getLineCharacterLimit(lineContent);
        
        lines.push({
          index: lineIndex++,
          type: 'resumeItem',
          fullCommand: fullCommand,
          content: lineContent,
          length: lineLength,
          maxLength: maxLength,
          withinLimit: lineLength <= maxLength,
          availableSpace: Math.max(0, maxLength - lineLength)
        });
      }

      // 2. Parse \textbf{} skill categories and content (multiple formats)
      // Format 1: \textbf{Category}{: content}
      const textbfFormat1Regex = /\\textbf\{([^}]+)\}\s*\{:\s*([^}]+)\}/g;
      while ((match = textbfFormat1Regex.exec(content)) !== null) {
        const fullCommand = match[0];
        const category = match[1];
        const skills = match[2];
        const lineContent = `${category}: ${skills}`;
        const lineLength = lineContent.length;
        const maxLength = this.getLineCharacterLimit(lineContent);
        
        lines.push({
          index: lineIndex++,
          type: 'skillCategory',
          fullCommand: fullCommand,
          content: lineContent,
          category: category,
          skills: skills,
          length: lineLength,
          maxLength: maxLength,
          withinLimit: lineLength <= maxLength,
          availableSpace: Math.max(0, maxLength - lineLength)
        });
      }
      
      // Format 2: \textbf{Category:} content (like in base_resume.tex)
      const textbfFormat2Regex = /\\textbf\{([^}]+):\s*([^}]+?)(?=\\\\|$)/g;
      while ((match = textbfFormat2Regex.exec(content)) !== null) {
        const fullCommand = match[0];
        const category = match[1];
        const skills = match[2];
        const lineContent = `${category}: ${skills}`;
        const lineLength = lineContent.length;
        const maxLength = this.getLineCharacterLimit(lineContent);
        
        lines.push({
          index: lineIndex++,
          type: 'skillCategory',
          fullCommand: fullCommand,
          content: lineContent,
          category: category,
          skills: skills,
          length: lineLength,
          maxLength: maxLength,
          withinLimit: lineLength <= maxLength,
          availableSpace: Math.max(0, maxLength - lineLength)
        });
      }

      // 3. Parse \textWithLine{} content (additional details) - EXCLUDING education sections
      const textWithLineRegex = /\\textWithLine\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
      while ((match = textWithLineRegex.exec(content)) !== null) {
        const fullCommand = match[0];
        const lineContent = match[1];
        
        // Skip if this appears to be education-related content
        if (this.isEducationContent(lineContent)) {
          continue;
        }
        
        const lineLength = lineContent.length;
        const maxLength = this.getLineCharacterLimit(lineContent);
        
        lines.push({
          index: lineIndex++,
          type: 'textWithLine',
          fullCommand: fullCommand,
          content: lineContent,
          length: lineLength,
          maxLength: maxLength,
          withinLimit: lineLength <= maxLength,
          availableSpace: Math.max(0, maxLength - lineLength)
        });
      }

      // 4. Parse \newlineText{} content (paragraph-style content) - EXCLUDING education sections
      const newlineTextRegex = /\\newlineText\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
      while ((match = newlineTextRegex.exec(content)) !== null) {
        const fullCommand = match[0];
        const lineContent = match[1];
        
        // Skip if this appears to be education-related content
        if (this.isEducationContent(lineContent)) {
          continue;
        }
        
        const lineLength = lineContent.length;
        const maxLength = this.getLineCharacterLimit(lineContent);
        
        lines.push({
          index: lineIndex++,
          type: 'newlineText',
          fullCommand: fullCommand,
          content: lineContent,
          length: lineLength,
          maxLength: maxLength,
          withinLimit: lineLength <= maxLength,
          availableSpace: Math.max(0, maxLength - lineLength)
        });
      }

      // 5. Parse \parbox{} content (summary/description sections)
      const parboxRegex = /\\parbox\{\\textwidth\}\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
      while ((match = parboxRegex.exec(content)) !== null) {
        const fullCommand = match[0];
        const lineContent = match[1];
        
        // Skip if this appears to be education-related content
        if (this.isEducationContent(lineContent)) {
          continue;
        }
        
        const lineLength = lineContent.length;
        const maxLength = this.getLineCharacterLimit(lineContent);
        
        lines.push({
          index: lineIndex++,
          type: 'summary',
          fullCommand: fullCommand,
          content: lineContent,
          length: lineLength,
          maxLength: maxLength,
          withinLimit: lineLength <= maxLength,
          availableSpace: Math.max(0, maxLength - lineLength)
        });
      }

      // 6. Parse skills content inside itemize environments
      const itemizeRegex = /\\begin\{itemize\}.*?\\end\{itemize\}/gs;
      const itemizeMatches = content.match(itemizeRegex);
      if (itemizeMatches) {
        itemizeMatches.forEach(itemizeBlock => {
          // Look for \textbf{Category:} content patterns inside itemize
          // Handle the format: \textbf{Category:} content \\
          const skillRegex = /\\textbf\{([^}]+):\s*([^}]+?)\s*\\\\/g;
          let skillMatch;
          while ((skillMatch = skillRegex.exec(itemizeBlock)) !== null) {
            const category = skillMatch[1];
            const skills = skillMatch[2];
            const lineContent = `${category}: ${skills}`;
            const lineLength = lineContent.length;
            const maxLength = this.getLineCharacterLimit(lineContent);
            
            lines.push({
              index: lineIndex++,
              type: 'skillCategory',
              fullCommand: skillMatch[0],
              content: lineContent,
              category: category,
              skills: skills,
              length: lineLength,
              maxLength: maxLength,
              withinLimit: lineLength <= maxLength,
              availableSpace: Math.max(0, maxLength - lineLength)
            });
          }
          
          // Also look for the alternative format: \textbf{Category}{: content}
          const skillRegex2 = /\\textbf\{([^}]+)\}\s*\{:\s*([^}]+)\}/g;
          while ((skillMatch = skillRegex2.exec(itemizeBlock)) !== null) {
            const category = skillMatch[1];
            const skills = skillMatch[2];
            const lineContent = `${category}: ${skills}`;
            const lineLength = lineContent.length;
            const maxLength = this.getLineCharacterLimit(lineContent);
            
            lines.push({
              index: lineIndex++,
              type: 'skillCategory',
              fullCommand: skillMatch[0],
              content: lineContent,
              category: category,
              skills: skills,
              length: lineLength,
              maxLength: maxLength,
              withinLimit: lineLength <= maxLength,
              availableSpace: Math.max(0, maxLength - lineLength)
            });
          }
          
          // Handle the case where all skills are on one line (like in base_resume.tex)
          const allSkillsRegex = /\\textbf\{([^}]+):\s*([^}]+?)(?=\\\\|\s*\\textbf\{|$)/g;
          while ((skillMatch = allSkillsRegex.exec(itemizeBlock)) !== null) {
            const category = skillMatch[1];
            const skills = skillMatch[2];
            const lineContent = `${category}: ${skills}`;
            const lineLength = lineContent.length;
            const maxLength = this.getLineCharacterLimit(lineContent);
            
            lines.push({
              index: lineIndex++,
              type: 'skillCategory',
              fullCommand: skillMatch[0],
              content: lineContent,
              category: category,
              skills: skills,
              length: lineLength,
              maxLength: maxLength,
              withinLimit: lineLength <= maxLength,
              availableSpace: Math.max(0, maxLength - lineLength)
            });
          }
        });
      }

      // 7. Parse skills content directly (fallback for skills not in itemize)
      // This handles the format: \textbf{Category:} content \\
      const directSkillsRegex = /\\textbf\{([^}]+):\s*([^}]+?)\s*\\\\/g;
      while ((match = directSkillsRegex.exec(content)) !== null) {
        const fullCommand = match[0];
        const category = match[1];
        const skills = match[2];
        const lineContent = `${category}: ${skills}`;
        const lineLength = lineContent.length;
        const maxLength = this.getLineCharacterLimit(lineContent);
        
        lines.push({
          index: lineIndex++,
          type: 'skillCategory',
          fullCommand: fullCommand,
          content: lineContent,
          category: category,
          skills: skills,
          length: lineLength,
          maxLength: maxLength,
          withinLimit: lineLength <= maxLength,
          availableSpace: Math.max(0, maxLength - lineLength)
        });
      }

      // 8. Parse skills with a simple, direct approach
      // Look for \textbf{Category:} content patterns anywhere in the content
      const simpleSkillsRegex = /\\textbf\{([^}]+):\s*([^}]+?)(?=\\\\|\s*\\textbf\{|$)/g;
      while ((match = simpleSkillsRegex.exec(content)) !== null) {
        const fullCommand = match[0];
        const category = match[1];
        const skills = match[2];
        const lineContent = `${category}: ${skills}`;
        const lineLength = lineContent.length;
        const maxLength = this.getLineCharacterLimit(lineContent);
        
        lines.push({
          index: lineIndex++,
          type: 'skillCategory',
          fullCommand: fullCommand,
          content: lineContent,
          category: category,
          skills: skills,
          length: lineLength,
          maxLength: maxLength,
          withinLimit: lineLength <= maxLength,
          availableSpace: Math.max(0, maxLength - lineLength)
        });
      }

      // 9. Parse skills with a very basic approach - just find \textbf{Category:}
      const basicSkillsRegex = /\\textbf\{([^}]+):/g;
      while ((match = basicSkillsRegex.exec(content)) !== null) {
        const category = match[1];
        
        // Find the content after the category until the next \\ or \textbf{ or end
        const startPos = match.index + match[0].length;
        const nextTextbf = content.indexOf('\\textbf{', startPos);
        const nextDoubleSlash = content.indexOf('\\\\', startPos);
        
        let endPos = content.length;
        if (nextTextbf !== -1 && (nextDoubleSlash === -1 || nextTextbf < nextDoubleSlash)) {
          endPos = nextTextbf;
        } else if (nextDoubleSlash !== -1) {
          endPos = nextDoubleSlash;
        }
        
        const skills = content.substring(startPos, endPos).trim();
        if (skills) {
          // Clean up the skills content by removing trailing } and extra whitespace
          const cleanSkills = skills.replace(/^\s*\}\s*/, '').trim();
          const lineContent = `${category}: ${cleanSkills}`;
          const lineLength = lineContent.length;
          const maxLength = this.getLineCharacterLimit(lineContent);
          
          lines.push({
            index: lineIndex++,
            type: 'skillCategory',
            fullCommand: `\\textbf{${category}:} ${cleanSkills}`,
            content: lineContent,
            category: category,
            skills: cleanSkills,
            length: lineLength,
            maxLength: maxLength,
            withinLimit: lineLength <= maxLength,
            availableSpace: Math.max(0, maxLength - lineLength)
          });
        }
      }

      // Note: \resumeSubheading content (education details) is EXCLUDED from parsing
      // to prevent modifications to educational sections

      // The 8+ skill-category parsers above overlap and can produce duplicate entries
      // for the same LaTeX fragment. Deduplicate by fullCommand so each source fragment
      // is only targeted once during replacement.
      const seenCommands = new Set();
      const deduped = lines.filter(line => {
        if (seenCommands.has(line.fullCommand)) return false;
        seenCommands.add(line.fullCommand);
        return true;
      });

      console.log(`[TAILOR] 📏 Parsed ${deduped.length} unique content lines (${lines.length - deduped.length} duplicates removed)`);
      console.log(`[TAILOR] 📊 Content breakdown:`);
      const typeCounts = {};
      deduped.forEach(line => {
        typeCounts[line.type] = (typeCounts[line.type] || 0) + 1;
      });
      Object.entries(typeCounts).forEach(([type, count]) => {
        console.log(`[TAILOR]   - ${type}: ${count} lines`);
      });

      return deduped;
    } catch (error) {
      console.error('[TAILOR] ❌ Error parsing resume content:', error);
      return [];
    }
  }

  /**
   * Strip LaTeX commands and return the approximate visible printed character count.
   * Used to estimate whether a replacement will cause a line to wrap on the page.
   * @param {string} latexContent - Raw LaTeX fragment (e.g. \resumeItem content)
   * @returns {number}
   */
  getVisibleTextLength(latexContent) {
    let text = latexContent;
    // Unwrap common formatting commands — keep the displayed text
    text = text.replace(/\\textbf\{([^}]*)\}/g, '$1');
    text = text.replace(/\\textit\{([^}]*)\}/g, '$1');
    text = text.replace(/\\emph\{([^}]*)\}/g, '$1');
    text = text.replace(/\\text\{([^}]*)\}/g, '$1');
    text = text.replace(/\\href\{[^}]*\}\{([^}]*)\}/g, '$1');
    // Drop any remaining LaTeX commands and braces
    text = text.replace(/\\[a-zA-Z]+\*?\{[^}]*\}/g, '');
    text = text.replace(/\\[a-zA-Z]+\*?/g, '');
    text = text.replace(/[{}\\]/g, '');
    return text.replace(/\s+/g, ' ').trim().length;
  }

  /**
   * Return the maximum source-string length allowed for a line after replacement.
   * Based on visible-text budget for letterpaper 11pt with 0.3in margins (~90 visible
   * chars per printed line). Lines already at or beyond the budget cannot grow;
   * lines with space are granted an additional source-char budget equal to the gap.
   * @param {string} lineContent - Current line content
   * @returns {number} - Max source characters after replacement
   */
  getLineCharacterLimit(lineContent) {
    const SINGLE_LINE_VISIBLE_BUDGET = 90;
    const currentVisible = this.getVisibleTextLength(lineContent);
    if (currentVisible >= SINGLE_LINE_VISIBLE_BUDGET) {
      return lineContent.length; // already wrapping — no growth
    }
    // Allow growth up to the remaining visible budget
    return lineContent.length + (SINGLE_LINE_VISIBLE_BUDGET - currentVisible);
  }

  /**
   * Check if content appears to be education-related (to exclude from parsing)
   * @param {string} content - Content to check
   * @returns {boolean} - True if education-related content
   */
  isEducationContent(content) {
    if (!content || typeof content !== 'string') return false;
    
    const contentLower = content.toLowerCase();
    
    // Education-related keywords that indicate this content should be skipped
    const educationKeywords = [
      'gpa', 'grade point average', 'university', 'college', 'school',
      'degree', 'bachelor', 'master', 'phd', 'doctorate', 'graduated',
      'coursework', 'courses', 'thesis', 'dissertation', 'academic',
      'scholarship', 'honors', 'dean\'s list', 'cum laude', 'magna cum laude',
      'summa cum laude', 'valedictorian', 'salutatorian'
    ];
    
    // Check if any education keywords are present
    return educationKeywords.some(keyword => contentLower.includes(keyword));
  }

  /**
   * Validate if a replacement keeps the line within character limits (<= original length)
   * @param {string} originalLine - Original line content
   * @param {string} replacementText - Text to replace
   * @param {string} newText - New text to add
   * @param {number} maxLength - Maximum allowed length (original line length)
   * @returns {Object} - Validation result with details
   */
  validateLineReplacement(originalLine, replacementText, newText, maxLength) {
    try {
      // Calculate the new line length after replacement
      const newLineContent = originalLine.replace(replacementText, newText);
      const newLength = newLineContent.length;
      const originalLength = originalLine.length;
      const lengthDifference = newLength - originalLength;
      
      // Check if replacement keeps line within limits
      const withinLimit = newLength <= maxLength;
      const availableSpace = Math.max(0, maxLength - newLength);
      
      // Calculate character count preservation
      const exactLengthMatch = newLength === originalLength;
      
      return {
        valid: withinLimit,
        originalLength: originalLength,
        newLength: newLength,
        lengthDifference: lengthDifference,
        withinLimit: withinLimit,
        availableSpace: availableSpace,
        exactLengthMatch: exactLengthMatch,
        newLineContent: newLineContent,
        reason: exactLengthMatch ? 'Exact character count match' : 
                withinLimit ? 'Within character limit' : 'Exceeds character limit'
      };
    } catch (error) {
      console.error('[TAILOR] ❌ Error validating line replacement:', error);
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Find optimal replacement that maintains character count and stays within limits
   * @param {string} originalLine - Original line content
   * @param {string} targetKeyword - Keyword to replace
   * @param {Array} availableReplacements - Array of possible replacements with scores
   * @param {number} maxLength - Maximum allowed length for this line type
   * @returns {Object|null} - Best replacement option or null if none suitable
   */
  findOptimalReplacement(originalLine, targetKeyword, availableReplacements, maxLength) {
    try {
      const validReplacements = [];
      
      // Test each replacement option
      for (const replacement of availableReplacements) {
        const validation = this.validateLineReplacement(
          originalLine, 
          targetKeyword, 
          replacement.keyword, 
          maxLength
        );
        
        if (validation.valid) {
          validReplacements.push({
            ...replacement,
            validation: validation,
            priority: replacement.score
          });
        }
      }
      
      if (validReplacements.length === 0) {
        return null; // No valid replacements found
      }
      
      // Sort by priority (highest score first) and prefer shorter replacements
      validReplacements.sort((a, b) => {
        // First priority: shortest length (prefer shorter to create buffer space)
        if (a.validation.lengthDifference !== b.validation.lengthDifference) {
          return a.validation.lengthDifference - b.validation.lengthDifference;
        }
        
        // Second priority: highest score
        return b.priority - a.priority;
      });
6      
      const bestReplacement = validReplacements[0];
      const lengthStatus = bestReplacement.validation.lengthDifference === 0 ? 'exact' : 
                           bestReplacement.validation.lengthDifference < 0 ? 'shorter' : 'longer';
      console.log(`[TAILOR] 🎯 Found optimal replacement: "${targetKeyword}" → "${bestReplacement.keyword}" (score: ${bestReplacement.priority}, length: ${bestReplacement.validation.lengthDifference}, status: ${lengthStatus})`);
      
      return bestReplacement;
      
    } catch (error) {
      console.error('[TAILOR] ❌ Error finding optimal replacement:', error);
      return null;
    }
  }

  /**
   * Find replacements that could apply to a specific line
   * @param {Object} line - Line object with content and metadata
   * @param {Array} replacements - Array of all available replacements
   * @returns {Array} - Array of applicable replacements for this line
   */
  findApplicableReplacementsForLine(line, replacements) {
    try {
      const applicable = [];
      
      for (const replacement of replacements) {
        const { original, replacement: newText } = replacement;
        
        // Check if this replacement could apply to this line
        if (line.content.includes(original)) {
          // Add to applicable replacements
          applicable.push({
            ...replacement,
            score: replacement.score || 1
          });
        }
      }
      
      return applicable;
      
    } catch (error) {
      console.error('[TAILOR] ❌ Error finding applicable replacements for line:', error);
      return [];
    }
  }

  /**
   * Apply targeted replacements with detailed tracking and validation
   * @param {string} baseContent - Original LaTeX content
   * @param {Array} replacements - Array of replacement objects
   * @returns {Object} - Result with enhanced content and applied replacements
   */
  applyTargetedReplacementsWithDetails(baseContent, replacements) {
    let enhancedContent = baseContent;
    const appliedReplacements = [];
    
    console.log(`[TAILOR] 🎯 Applying ${replacements.length} targeted replacements with line character validation...`);
    
    // Parse all resume content lines to understand structure and limits
    const resumeLines = this.parseResumeContent(baseContent);
    console.log(`[TAILOR] 📏 Found ${resumeLines.length} content lines to validate`);
    
    // Track used keywords to prevent duplicates
    const usedKeywords = new Set();
    const usedReplacements = new Set();
    
    // Sort lines by priority (skills first, then experience, then projects)
    const priorityOrder = ['skillCategory', 'summary', 'resumeItem'];
    resumeLines.sort((a, b) => {
      const aPriority = priorityOrder.indexOf(a.type);
      const bPriority = priorityOrder.indexOf(b.type);
      return aPriority - bPriority;
    });
    
    console.log(`[TAILOR] 📊 Processing lines in priority order: ${priorityOrder.join(' → ')}`);
    
    // Process each line individually to ensure character count compliance
    for (const line of resumeLines) {
      console.log(`[TAILOR] 📏 Processing line ${line.index + 1} (${line.type}): ${line.content.substring(0, 50)}...`);
      console.log(`[TAILOR] 📏 Line length: ${line.length}/${line.maxLength} characters`);
      
      // Find replacements that could apply to this line
      const applicableReplacements = this.findApplicableReplacementsForLine(line, replacements);
      
      if (applicableReplacements.length === 0) {
        console.log(`[TAILOR] 📏 No applicable replacements for line ${line.index + 1}`);
        continue;
      }
      
      // Filter out replacements that have already been used
      const availableReplacements = applicableReplacements.filter(replacement => {
        const replacementKey = `${replacement.original}→${replacement.replacement}`;
        if (usedReplacements.has(replacementKey)) {
          console.log(`[TAILOR] ⚠️ Skipping already used replacement: "${replacement.original}" → "${replacement.replacement}"`);
          return false;
        }
        return true;
      });
      
      if (availableReplacements.length === 0) {
        console.log(`[TAILOR] 📏 No available replacements for line ${line.index + 1} (all used)`);
        continue;
      }
      
      // Sort replacements by priority (highest score first)
      availableReplacements.sort((a, b) => (b.score || 0) - (a.score || 0));
      
      // Try to apply the best replacement that maintains character count
      let replacementApplied = false;
      for (const replacement of availableReplacements) {
        const optimalReplacement = this.findOptimalReplacement(
          line.content,
          replacement.original,
          [{ keyword: replacement.replacement, score: replacement.score || 1 }],
          line.maxLength
        );
        
        if (optimalReplacement && optimalReplacement.validation.valid) {
          // Apply the replacement to the specific line
          const newLineContent = line.content.replace(replacement.original, optimalReplacement.keyword);
          
          // Replace the original text within the full command (not the parsed content)
          const newFullCommand = line.fullCommand.replace(replacement.original, optimalReplacement.keyword);
          
          // Update the enhanced content
          enhancedContent = enhancedContent.replace(line.fullCommand, newFullCommand);
          
          // Track the applied replacement
        appliedReplacements.push({
            original: replacement.original,
            replacement: optimalReplacement.keyword,
            reason: replacement.reason,
            section: replacement.section || line.type,
            applied: true,
            lineIndex: line.index,
            lineType: line.type,
            originalLength: line.length,
            newLength: optimalReplacement.validation.newLength,
            lengthDifference: optimalReplacement.validation.lengthDifference,
            exactLengthMatch: optimalReplacement.validation.exactLengthMatch
          });
          
          // Mark this replacement as used
          const replacementKey = `${replacement.original}→${replacement.replacement}`;
          usedReplacements.add(replacementKey);
          usedKeywords.add(replacement.replacement.toLowerCase());
          
          console.log(`[TAILOR] ✅ Applied replacement in line ${line.index + 1} (${line.type}): "${replacement.original}" → "${optimalReplacement.keyword}"`);
          console.log(`[TAILOR] 📏 Line length: ${line.length} → ${optimalReplacement.validation.newLength} characters`);
          console.log(`[TAILOR] 📝 Reason: ${replacement.reason}`);
          
          replacementApplied = true;
          break; // Move to next line
      } else {
          console.log(`[TAILOR] ⚠️ Replacement "${replacement.original}" → "${replacement.replacement}" not suitable for line ${line.index + 1} (${optimalReplacement ? 'exceeds limit' : 'validation failed'})`);
        }
      }
      
      if (!replacementApplied) {
        console.log(`[TAILOR] 📏 No suitable replacement found for line ${line.index + 1}`);
      }
    }
    
    console.log(`[TAILOR] 🎯 Successfully applied ${appliedReplacements.length}/${replacements.length} replacements with line character validation`);
    console.log(`[TAILOR] 📊 Used replacements: ${Array.from(usedReplacements).join(', ')}`);
    
    // Log detailed replacement summary
    console.log(`[TAILOR] 📋 Replacement Summary:`);
    appliedReplacements.forEach((replacement, index) => {
      console.log(`  ${index + 1}. Line ${replacement.lineIndex + 1} (${replacement.lineType}): "${replacement.original}" → "${replacement.replacement}"`);
      console.log(`     Section: ${replacement.section} | Length: ${replacement.originalLength} → ${replacement.newLength}`);
    });
    
    return { enhancedContent: enhancedContent, appliedReplacements: appliedReplacements };
  }

  /**
   * Create AI prompt for targeted content replacement.
   * Parses the resume to determine per-line available space and passes that
   * context to the model so it targets lines with genuine room to grow.
   * @param {string} baseResumeContent - Original resume content
   * @param {string} jobDescription - Job description
   * @param {Object} keywordAnalysis - Keyword analysis results
   * @returns {string} - Formatted prompt for Anthropic
   */
  createTailoringPrompt(baseResumeContent, jobDescription, keywordAnalysis = null) {
    // Build per-line budget context so the AI targets lines that actually have space
    const resumeLines = this.parseResumeContent(baseResumeContent);
    const linesWithBudget = resumeLines
      .filter(l => l.availableSpace > 5)
      .sort((a, b) => b.availableSpace - a.availableSpace)
      .slice(0, 12)
      .map(l => {
        const preview = l.content.length > 90 ? l.content.substring(0, 90) + '...' : l.content;
        return `  [${l.type}, +${l.availableSpace}ch free]: "${preview}"`;
      });

    const budgetSection = linesWithBudget.length > 0
      ? `\nLINES WITH AVAILABLE SPACE (best targets, sorted by free chars):\n${linesWithBudget.join('\n')}`
      : '';

    const keywordContext = (keywordAnalysis?.newKeywords?.length > 0)
      ? `\nMISSING KEYWORDS (in JD but not yet in resume): ${keywordAnalysis.newKeywords.join(', ')}`
      : '';

    return `JOB DESCRIPTION:
${jobDescription}
${keywordContext}
${budgetSection}

MISSION: Produce 3-7 surgical "find → replace" operations that add the missing job-relevant keywords to the resume while keeping every line within its page-width budget.

CONSTRAINTS (hard rules — never break these):
1. NEVER change factual content: keep all numbers, company names, dates, and achievements exactly as-is.
2. NEVER modify education sections (GPA, degree, university names, coursework).
3. NEVER add or remove LaTeX commands — only swap plain-text tokens inside existing commands.
4. NEVER make a line longer than its available space allows (see LINES WITH AVAILABLE SPACE above).
5. Each "original" string must appear verbatim in the resume — if unsure, skip it.
6. Each keyword may be used in at most one replacement.

STRATEGY (priority order):
1. Skills lines (\\textbf{} categories) — swap or append a comma-separated term; ideal for single-word tech additions.
2. Professional summary (\\newlineText, \\parbox) — insert a missing domain term in a semantically natural spot.
3. Experience bullets (\\resumeItem) — only if a near-equivalent phrase swap adds a high-value keyword without changing the meaning.

GOOD replacement examples:
- "Android, Flutter" → "Android, Flutter, React Native"   (appends a framework)
- "GCP, Docker" → "GCP, Azure, Docker"                    (inserts a cloud platform)
- "microservices" → "distributed microservices"            (enhances with a keyword)

BAD replacement examples:
- Changing "\$100M+" to "\$100M" (removes a fact)
- Replacing "Python" with "Java" (unrelated swap)
- Adding 50+ chars to a line that only has 10 chars free (overflows the page)

OUTPUT: Return valid JSON with a "replacements" array. Each element must have:
  "original"    — exact verbatim text from the resume to find
  "replacement" — the new text to substitute in its place
  "reason"      — one sentence explaining the keyword being added and why it fits
  "section"     — one of: skillCategory | summary | resumeItem

Also include a "summary" string (one sentence describing what was optimized).

RESUME TO ANALYZE:
${baseResumeContent}`;
  }

  /**
   * Call Anthropic API with the tailored prompt
   * Uses prompt caching on the system prompt and static instruction block.
   * @param {string} prompt - Formatted prompt
   * @returns {Promise<Object>} - Result from Anthropic API
   */
  async callAnthropic(prompt) {
    try {
      if (!this.anthropic) {
        throw new Error('Anthropic client not initialized');
      }

      console.log(`[TAILOR] 🤖 Calling Anthropic API with model: ${this.model}`);
      console.log(`[TAILOR] 📝 Prompt length: ${prompt.length} characters`);

      // Split prompt at the resume boundary so static instructions are cached
      // and only the dynamic resume content is sent fresh each request.
      const resumeMarker = 'RESUME TO ANALYZE:';
      const markerIndex = prompt.indexOf(resumeMarker);

      let messageContent;
      if (markerIndex !== -1) {
        messageContent = [
          {
            type: 'text',
            text: prompt.substring(0, markerIndex + resumeMarker.length),
            cache_control: { type: 'ephemeral' }
          },
          {
            type: 'text',
            text: prompt.substring(markerIndex + resumeMarker.length)
          }
        ];
      } else {
        messageContent = prompt;
      }

      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        system: [
          {
            type: 'text',
            text: 'You are an expert resume optimization AI. You provide precise, targeted keyword replacements that maintain LaTeX structure and respect character limits (<= original length, shorter preferred). Always respond with valid JSON only — no markdown, no code blocks, no extra text.',
            cache_control: { type: 'ephemeral' }
          }
        ],
        messages: [
          { role: 'user', content: messageContent }
        ]
      });

      const usage = response.usage;
      console.log('[TAILOR] 📡 Anthropic API Response received:', {
        hasContent: !!response.content,
        contentBlocks: response.content?.length,
        model: response.model,
        stopReason: response.stop_reason,
        inputTokens: usage?.input_tokens,
        outputTokens: usage?.output_tokens,
        cacheReadTokens: usage?.cache_read_input_tokens || 0,
        cacheCreationTokens: usage?.cache_creation_input_tokens || 0
      });

      if (!response.content || response.content.length === 0) {
        throw new Error('No response content from Anthropic API');
      }

      // Strip markdown code-block wrapper if model included one
      let content = response.content[0].text;
      content = content.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

      try {
        const result = JSON.parse(content);
        return {
          success: true,
          ...result,
          usage: {
            totalTokens: (usage?.input_tokens || 0) + (usage?.output_tokens || 0),
            inputTokens: usage?.input_tokens || 0,
            outputTokens: usage?.output_tokens || 0,
            cacheReadTokens: usage?.cache_read_input_tokens || 0,
            cacheCreationTokens: usage?.cache_creation_input_tokens || 0
          }
        };
      } catch (parseError) {
        console.error('[TAILOR] ❌ Failed to parse Anthropic response as JSON:', parseError);
        throw new Error(`Invalid JSON response from Anthropic: ${parseError.message}`);
      }

    } catch (error) {
      console.error('[TAILOR] ❌ Anthropic API call failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Extract keywords from resume content
   * @param {string} content - Resume content
   * @returns {Array} - Array of extracted keywords
   */
  extractResumeKeywords(content) {
    try {
      console.log('[TAILOR] 🔍 Extracting existing keywords from resume...');
      
      let plainText = content;
      
      // Remove LaTeX document structure
      plainText = plainText.replace(/\\documentclass\[.*?\]\{.*?\}/g, '');
      plainText = plainText.replace(/\\usepackage(\[.*?\])?\{.*?\}/g, '');
      plainText = plainText.replace(/\\begin\{document\}/g, '');
      plainText = plainText.replace(/\\end\{document\}/g, '');
      
      // Extract content from LaTeX commands
      plainText = plainText.replace(/\\textbf\{([^}]*)\}/g, '$1'); // Bold
      plainText = plainText.replace(/\\textit\{([^}]*)\}/g, '$1'); // Italic
      plainText = plainText.replace(/\\text\{([^}]*)\}/g, '$1'); // Text
      plainText = plainText.replace(/\\emph\{([^}]*)\}/g, '$1'); // Emphasis
      plainText = plainText.replace(/\\underline\{([^}]*)\}/g, '$1'); // Underline
      plainText = plainText.replace(/\\href\{[^}]*\}\{([^}]*)\}/g, '$1'); // Links
      
      // Extract section and subsection content
      plainText = plainText.replace(/\\section\{([^}]*)\}/g, '$1');
      plainText = plainText.replace(/\\subsection\{([^}]*)\}/g, '$1');
      plainText = plainText.replace(/\\subsubsection\{([^}]*)\}/g, '$1');
      
      // Extract custom resume commands
      plainText = plainText.replace(/\\resumeItem\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g, '$1');
      plainText = plainText.replace(/\\resumeSubheading\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g, '$1');
      plainText = plainText.replace(/\\resumeWorkHeading\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g, '$1');
      plainText = plainText.replace(/\\resumeSubSubheading\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g, '$1');
      plainText = plainText.replace(/\\resumeProjectHeading\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g, '$1');
      
      // Remove other LaTeX commands
      plainText = plainText.replace(/\\[a-zA-Z]+\*?\[[^\]]*\]/g, ''); // Commands with optional parameters
      plainText = plainText.replace(/\\[a-zA-Z]+\*?\{[^}]*\}/g, ''); // Commands with parameters
      plainText = plainText.replace(/\\[a-zA-Z]+\*?/g, ''); // Simple commands
      
      // Clean up formatting
      plainText = plainText.replace(/[{}]/g, ''); // Remove braces
      plainText = plainText.replace(/\\\\/g, ' '); // Line breaks
      plainText = plainText.replace(/~/g, ' '); // Non-breaking spaces
      plainText = plainText.replace(/\\&/g, '&'); // Escaped ampersands
      plainText = plainText.replace(/\\\$/g, '$'); // Escaped dollar signs
      plainText = plainText.replace(/\\%/g, '%'); // Escaped percent signs
      plainText = plainText.replace(/\\#/g, '#'); // Escaped hash signs
      
      // Normalize whitespace
      plainText = plainText.replace(/\n\s*\n\s*\n/g, '\n\n'); // Multiple empty lines
      plainText = plainText.replace(/[ \t]+/g, ' '); // Multiple spaces/tabs
      plainText = plainText.replace(/^\s+|\s+$/gm, ''); // Leading/trailing whitespace per line
      plainText = plainText.trim();
      
      // Extract keywords from plain text
      const keywords = this.extractKeywordsFromText(plainText);
      
      console.log(`[TAILOR] ✅ Extracted ${keywords.length} existing keywords from resume`);
      return keywords;
      
    } catch (error) {
      console.error('[TAILOR] ❌ Error extracting resume keywords:', error);
      return [];
    }
  }

  /**
   * Extract keywords from plain text content
   * @param {string} text - Plain text content
   * @returns {Array} - Array of extracted keywords
   */
  extractKeywordsFromText(text) {
    // Split text into words and phrases
    const words = text.split(/\s+/);
    const keywords = new Set();
    
    // Common technical terms and patterns to look for
    const technicalPatterns = [
      // Programming languages
      /\b(Python|Java|JavaScript|TypeScript|C\+\+|C#|Go|Rust|PHP|Ruby|Swift|Kotlin|Scala|R|MATLAB|Perl|Haskell|Clojure|Elixir|F#|Dart)\b/gi,
      
      // Frameworks and libraries
      /\b(React|Angular|Vue|Node\.js|Express|Django|Flask|Spring|Laravel|ASP\.NET|jQuery|Bootstrap|Tailwind|Material-UI|Ant Design)\b/gi,
      
      // Databases
      /\b(MySQL|PostgreSQL|MongoDB|Redis|SQLite|Oracle|SQL Server|MariaDB|Cassandra|DynamoDB|Firebase|Supabase)\b/gi,
      
      // Cloud platforms
      /\b(AWS|Azure|GCP|Google Cloud|Amazon Web Services|Microsoft Azure|Heroku|DigitalOcean|Vercel|Netlify|Cloudflare)\b/gi,
      
      // DevOps and tools
      /\b(Docker|Kubernetes|Jenkins|GitLab|GitHub|Bitbucket|CI\/CD|Terraform|Ansible|Puppet|Chef|Vagrant)\b/gi,
      
      // Methodologies
      /\b(Agile|Scrum|Kanban|Waterfall|DevOps|TDD|BDD|DDD|Microservices|REST|GraphQL|SOA)\b/gi
    ];
    
    // Extract keywords using patterns
    for (const pattern of technicalPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => keywords.add(match));
      }
    }
    
    // Extract individual words that might be keywords
    for (const word of words) {
      const cleanWord = word.replace(/[^\w]/g, '').toLowerCase();
      if (cleanWord.length >= 3 && cleanWord.length <= 20) {
        // Check if it's a technical term
        if (this.isTechnicalTerm(cleanWord)) {
          keywords.add(word);
        }
      }
    }
    
    return Array.from(keywords);
  }

  /**
   * Check if a word is a technical term
   * @param {string} word - Word to check
   * @returns {boolean} - True if technical term
   */
  isTechnicalTerm(word) {
    const technicalTerms = [
      'api', 'ui', 'ux', 'db', 'ml', 'ai', 'nlp', 'cv', 'sql', 'nosql', 'json', 'xml', 'html', 'css',
      'http', 'https', 'ssl', 'tls', 'ssh', 'ftp', 'sftp', 'tcp', 'udp', 'ip', 'dns', 'cdn', 'vpn',
      'jwt', 'oauth', 'ldap', 'saml', 'oauth2', 'openid', 'jwt', 'bcrypt', 'sha', 'md5', 'aes', 'rsa',
      'ec2', 's3', 'lambda', 'ecs', 'eks', 'rds', 'dynamodb', 'cloudfront', 'route53', 'vpc', 'subnet',
      'kubernetes', 'docker', 'helm', 'istio', 'linkerd', 'prometheus', 'grafana', 'jaeger', 'zipkin',
      'elasticsearch', 'kibana', 'logstash', 'beats', 'kafka', 'rabbitmq', 'redis', 'memcached',
      'nginx', 'apache', 'tomcat', 'jetty', 'undertow', 'netty', 'vertx', 'quarkus', 'micronaut'
    ];
    
    return technicalTerms.includes(word.toLowerCase());
  }

  /**
   * Identify job keywords not already present in the resume.
   * Priority-replacement suggestions have been removed — the AI is better at choosing
   * semantically valid swaps when it sees the full resume context.
   * @param {Array} existingKeywords - Keywords extracted from resume
   * @param {Array} jobKeywords - Keywords extracted from job description
   * @returns {Object} - Keyword analysis results
   */
  filterNewKeywords(existingKeywords, jobKeywords) {
    try {
      console.log('[TAILOR] 🔍 Filtering keywords to find new ones...');
      console.log(`Job keywords: ${jobKeywords.length}, Resume keywords: ${existingKeywords.length}`);

      const existingLower = existingKeywords.map(k => k.toLowerCase());

      const newKeywords = jobKeywords.filter(jobKw =>
        !existingLower.some(resumeKw =>
          this.areKeywordsSimilar(jobKw.toLowerCase(), resumeKw)
        )
      );

      const optimizationRate = jobKeywords.length > 0
        ? (newKeywords.length / jobKeywords.length * 100).toFixed(1)
        : '0.0';

      console.log('[TAILOR] ✅ Keyword filtering completed:');
      console.log(`   - New keywords to add: ${newKeywords.length}`);
      console.log(`   - Already present: ${jobKeywords.length - newKeywords.length}`);
      console.log(`   - Optimization rate: ${optimizationRate}%`);

      return {
        totalJobKeywords: jobKeywords.length,
        newKeywordsCount: newKeywords.length,
        newKeywords,
        existingKeywordsCount: existingKeywords.length,
        priorityReplacements: [], // kept for schema compat, intentionally empty
        optimizationRate
      };

    } catch (error) {
      console.error('[TAILOR] ❌ Error filtering keywords:', error);
      return {
        totalJobKeywords: 0,
        newKeywordsCount: 0,
        newKeywords: [],
        existingKeywordsCount: 0,
        priorityReplacements: [],
        optimizationRate: '0.0'
      };
    }
  }

  /**
   * Check if two keywords are similar (variations, abbreviations, etc.)
   * @param {string} keyword1 - First keyword
   * @param {string} keyword2 - Second keyword
   * @returns {boolean} - True if keywords are similar
   */
  areKeywordsSimilar(keyword1, keyword2) {
    if (keyword1 === keyword2) return true;
    
    // Normalize keywords for comparison
    const normalize = (kw) => kw.toLowerCase().replace(/[^\w\s]/g, '').trim();
    const normalized1 = normalize(keyword1);
    const normalized2 = normalize(keyword2);
    
    if (normalized1 === normalized2) return true;
    
    // Check for common variations
    const variations = [
      { base: 'javascript', variants: ['js', 'ecmascript'] },
      { base: 'typescript', variants: ['ts'] },
      { base: 'python', variants: ['py'] },
      { base: 'java', variants: ['jvm', 'java/ee', 'j2ee'] },
      { base: 'c++', variants: ['cpp', 'cplusplus'] },
      { base: 'c#', variants: ['csharp', 'dotnet'] },
      { base: 'postgresql', variants: ['postgres', 'pgsql'] },
      { base: 'mongodb', variants: ['mongo'] },
      { base: 'sql server', variants: ['mssql', 'sqlserver'] },
      { base: 'aws', variants: ['amazon web services', 'amazon'] },
      { base: 'gcp', variants: ['google cloud platform', 'google cloud'] },
      { base: 'azure', variants: ['microsoft azure'] },
      { base: 'agile', variants: ['agile methodology', 'agile development'] },
      { base: 'scrum', variants: ['scrum methodology', 'scrum development'] },
      { base: 'devops', variants: ['dev ops', 'development operations'] },
      { base: 'ci/cd', variants: ['continuous integration', 'continuous deployment', 'cicd'] },
      { base: 'rest', variants: ['restful', 'rest api', 'restful api'] },
      { base: 'api', variants: ['apis', 'application programming interface'] }
    ];
    
    // Check variations
    for (const variation of variations) {
      if (normalized1 === variation.base || normalized2 === variation.base) {
        const other = normalized1 === variation.base ? normalized2 : normalized1;
        if (variation.variants.includes(other)) {
          return true;
        }
      }
    }
    
    // Check for partial matches (e.g., "Java" vs "Java/EE")
    if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
      return true;
    }
    
      return false;
    }
    
  /**
   * Check if a replacement would be good
   * @param {string} original - Original keyword
   * @param {string} replacement - Replacement keyword
   * @returns {boolean} - True if good replacement
   */
  isGoodReplacement(original, replacement) {
    // Simple heuristic: prefer longer, more specific terms
    if (replacement.length > original.length) {
    return true;
    }
    
    // Check if replacement is more technical
    const technicalTerms = ['api', 'framework', 'library', 'platform', 'engine', 'system'];
    if (technicalTerms.some(term => replacement.toLowerCase().includes(term))) {
      return true;
    }
    
    return false;
  }

  /**
   * Extract keywords from job description (basic implementation)
   * In production, this should use JobDescriptionProcessor
   * @param {string} jobDescription - Job description text
   * @returns {Promise<Array>} - Array of extracted keywords
   */
  async extractJobDescriptionKeywords(jobDescription) {
    try {
      // Use AI-powered keyword extraction via JobDescriptionProcessor
      const JobDescriptionProcessor = require('./JobDescriptionProcessor');
      const processor = new JobDescriptionProcessor();
      
      // Sanitize the job description first
      const sanitizedDescription = processor.sanitizeJobDescription(jobDescription);
      
      // Extract keywords using AI
      const extractedKeywords = await processor.extractKeywords(sanitizedDescription);
      
      console.log(`[TAILOR] ✅ Extracted ${extractedKeywords.length} keywords from job description using AI`);
      return extractedKeywords;
      
    } catch (error) {
      console.error('[TAILOR] ❌ Error extracting job description keywords:', error);
      return [];
    }
  }

  /**
   * Validate inputs before processing
   * @param {string} baseResumeContent - Resume content
   * @param {string} jobDescription - Job description
   */
  validateInputs(baseResumeContent, jobDescription) {
    if (!baseResumeContent || typeof baseResumeContent !== 'string') {
      throw new Error('Base resume content must be a non-empty string');
    }

    if (!jobDescription || typeof jobDescription !== 'string') {
      throw new Error('Job description must be a non-empty string');
    }

    // Check for essential LaTeX elements
    const requiredElements = ['\\documentclass', '\\begin{document}', '\\end{document}'];
    for (const element of requiredElements) {
      if (!baseResumeContent.includes(element)) {
        throw new Error(`Missing required LaTeX element: ${element}`);
      }
    }

    // Check minimum content length
    if (baseResumeContent.length < 500) {
      throw new Error('Base resume content seems too short to be a valid resume');
    }

    if (jobDescription.length < 50) {
      throw new Error('Job description seems too short to extract meaningful keywords');
    }
  }

  /**
   * Validate the tailored result from Anthropic
   * @param {Object} result - Result from Anthropic
   * @param {string} originalContent - Original resume content
   */
  validateTailoredResult(result, originalContent) {
    if (!result || typeof result !== 'object') {
      throw new Error('Invalid result format from Anthropic');
    }

    if (!result.revised_tex || typeof result.revised_tex !== 'string') {
      throw new Error('Missing or invalid revised_tex in result');
    }

    // Check that essential structure is preserved
    const originalSections = this.extractSections(originalContent);
    const revisedSections = this.extractSections(result.revised_tex);

    if (originalSections.length !== revisedSections.length) {
      throw new Error(`Section count mismatch: original has ${originalSections.length}, revised has ${revisedSections.length}`);
    }
  }

  /**
   * Extract sections from LaTeX content
   * @param {string} content - LaTeX content
   * @returns {Array} - Array of section names
   */
  extractSections(content) {
    const sectionRegex = /\\section\*?\{([^}]+)\}/g;
    const sections = [];
    let match;

    while ((match = sectionRegex.exec(content)) !== null) {
      sections.push(match[1]);
    }

    return sections;
  }

  /**
   * Extract bullet points from LaTeX content for analysis
   * @param {string} content - LaTeX content
   * @returns {Array} - Array of bullet points
   */
  extractBulletPoints(content) {
    const bulletRegex = /\\resumeItem\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
    const bullets = [];
    let match;

    while ((match = bulletRegex.exec(content)) !== null) {
      bullets.push(match[1]);
    }

    return bullets;
  }
}

module.exports = TailoringEngine; 
