const fs = require('fs-extra');
const path = require('path');

/**
 * LaTeX Validation and Fixing Module
 * Detects and automatically fixes common LaTeX syntax issues before compilation
 */
class LaTeXValidator {
  constructor() {
    this.validationRules = this.initializeValidationRules();
    this.fixingRules = this.initializeFixingRules();
  }

  /**
   * Validate and fix LaTeX content before compilation
   * @param {string} texContent - LaTeX content to validate and fix
   * @returns {Object} - Validation and fixing result
   */
  async validateAndFix(texContent) {
    try {
      const startTime = Date.now();
      let currentContent = texContent;
      const issues = [];
      const fixes = [];
      
      console.log('[LATEX-VALIDATOR] 🔍 Starting LaTeX validation and fixing...');
      
      // Step 1: Run all validation checks
      const validationResults = this.runValidationChecks(currentContent);
      issues.push(...validationResults);
      
      // Step 2: Apply automatic fixes
      const fixingResult = this.applyAutomaticFixes(currentContent);
      currentContent = fixingResult.fixedContent;
      fixes.push(...fixingResult.appliedFixes);
      
      // Step 3: Re-validate after fixes
      const postFixValidation = this.runValidationChecks(currentContent);
      const remainingIssues = postFixValidation.filter(issue => issue.severity === 'error');
      
      const processingTime = Date.now() - startTime;
      
      const result = {
        success: remainingIssues.length === 0,
        originalContent: texContent,
        fixedContent: currentContent,
        contentChanged: texContent !== currentContent,
        issues: {
          total: issues.length,
          errors: issues.filter(i => i.severity === 'error').length,
          warnings: issues.filter(i => i.severity === 'warning').length,
          details: issues
        },
        fixes: {
          applied: fixes.length,
          details: fixes
        },
        remainingIssues: remainingIssues,
        processingTimeMs: processingTime,
        timestamp: new Date().toISOString()
      };
      
      console.log('[LATEX-VALIDATOR] ✅ Validation completed:', {
        contentChanged: result.contentChanged,
        issuesFound: result.issues.total,
        fixesApplied: result.fixes.applied,
        remainingErrors: remainingIssues.length,
        processingTime: processingTime + 'ms'
      });
      
      return result;
      
    } catch (error) {
      console.error('[LATEX-VALIDATOR] ❌ Validation failed:', error);
      return {
        success: false,
        error: error.message,
        originalContent: texContent,
        fixedContent: texContent,
        contentChanged: false,
        issues: { total: 0, errors: 1, warnings: 0, details: [{ 
          type: 'validation_error', 
          severity: 'error', 
          message: error.message 
        }] },
        fixes: { applied: 0, details: [] },
        remainingIssues: [],
        processingTimeMs: 0,
        timestamp: new Date().toISOString()
      };
    }
  }

  initializeValidationRules() {
    return [
      this.checkUnescapedDollarSigns.bind(this),
      this.checkUnmatchedBraces.bind(this),
      this.checkUnmatchedEnvironments.bind(this),
      this.checkMissingDocumentStructure.bind(this)
    ];
  }

  initializeFixingRules() {
    return [
      this.fixUnescapedDollarSigns.bind(this),
      this.fixCommonTypos.bind(this),
      this.fixSpacingIssues.bind(this),
      this.fixEncodingIssues.bind(this)
    ];
  }

  runValidationChecks(content) {
    const issues = [];
    
    for (const rule of this.validationRules) {
      try {
        const ruleIssues = rule(content);
        issues.push(...ruleIssues);
      } catch (error) {
        console.warn('[LATEX-VALIDATOR] Warning: Validation rule failed:', error.message);
      }
    }
    
    return issues;
  }

  applyAutomaticFixes(content) {
    let currentContent = content;
    const appliedFixes = [];
    
    for (const fixRule of this.fixingRules) {
      try {
        const fixResult = fixRule(currentContent);
        if (fixResult.changed) {
          currentContent = fixResult.content;
          appliedFixes.push(fixResult.description);
        }
      } catch (error) {
        console.warn('[LATEX-VALIDATOR] Warning: Fix rule failed:', error.message);
      }
    }
    
    return {
      fixedContent: currentContent,
      appliedFixes: appliedFixes
    };
  }

  checkUnescapedDollarSigns(content) {
    const issues = [];
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Look for unescaped $ not in math mode context
      const dollarMatches = [...line.matchAll(/(?<!\\)\$/g)];
      
      if (dollarMatches.length % 2 !== 0) {
        issues.push({
          type: 'unescaped_dollar',
          severity: 'error',
          line: i + 1,
          message: 'Unmatched dollar sign found on line ' + (i + 1) + '. This will cause LaTeX compilation to fail.',
          context: line.trim(),
          suggestion: 'Escape dollar signs with \\$ or ensure proper math mode pairing'
        });
      }
    }
    
    return issues;
  }

  checkUnmatchedBraces(content) {
    const issues = [];
    let braceCount = 0;
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      for (const char of line) {
        if (char === '{') braceCount++;
        if (char === '}') braceCount--;
        
        if (braceCount < 0) {
          issues.push({
            type: 'unmatched_brace',
            severity: 'error',
            line: i + 1,
            message: 'Extra closing brace on line ' + (i + 1),
            context: line.trim()
          });
          braceCount = 0;
        }
      }
    }
    
    if (braceCount > 0) {
      issues.push({
        type: 'unmatched_brace',
        severity: 'error',
        line: lines.length,
        message: braceCount + ' unclosed brace(s) in document',
        context: 'Document end'
      });
    }
    
    return issues;
  }

  checkUnmatchedEnvironments(content) {
    const issues = [];
    const envStack = [];
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check for \begin{environment}
      const beginMatch = line.match(/\\begin\{([^}]+)\}/);
      if (beginMatch) {
        envStack.push({ name: beginMatch[1], line: i + 1 });
      }
      
      // Check for \end{environment}
      const endMatch = line.match(/\\end\{([^}]+)\}/);
      if (endMatch) {
        const expectedEnv = envStack.pop();
        if (!expectedEnv) {
          issues.push({
            type: 'unmatched_environment',
            severity: 'error',
            line: i + 1,
            message: '\\end{' + endMatch[1] + '} without corresponding \\begin',
            context: line.trim()
          });
        } else if (expectedEnv.name !== endMatch[1]) {
          issues.push({
            type: 'unmatched_environment',
            severity: 'error',
            line: i + 1,
            message: 'Environment mismatch: \\begin{' + expectedEnv.name + '} on line ' + expectedEnv.line + ' ended with \\end{' + endMatch[1] + '}',
            context: line.trim()
          });
        }
      }
    }
    
    // Check for unclosed environments
    for (const env of envStack) {
      issues.push({
        type: 'unmatched_environment',
        severity: 'error',
        line: env.line,
        message: 'Unclosed environment: \\begin{' + env.name + '} on line ' + env.line,
        context: 'Missing \\end{' + env.name + '}'
      });
    }
    
    return issues;
  }

  checkMissingDocumentStructure(content) {
    const issues = [];
    const requiredElements = [
      { element: '\\documentclass', message: 'Missing \\documentclass declaration' },
      { element: '\\begin{document}', message: 'Missing \\begin{document}' },
      { element: '\\end{document}', message: 'Missing \\end{document}' }
    ];
    
    for (const { element, message } of requiredElements) {
      if (!content.includes(element)) {
        issues.push({
          type: 'missing_structure',
          severity: 'error',
          message: message,
          suggestion: 'Add ' + element + ' to document'
        });
      }
    }
    
    return issues;
  }

  fixUnescapedDollarSigns(content) {
    let fixedContent = content;
    let changeCount = 0;
    
    // Find standalone dollar signs (not already escaped, not in math mode pairs)
    const lines = fixedContent.split('\n');
    const fixedLines = [];
    
    for (let line of lines) {
      let fixedLine = line;
      
      // Look for patterns like "$100M" or "cost $50" and escape them
      const dollarAmountPattern = /(?<!\\)\$(\d+[KMB]?(?:\.\d+)?[KMB]?)/g;
      const replacements = fixedLine.match(dollarAmountPattern);
      
      if (replacements) {
        fixedLine = fixedLine.replace(dollarAmountPattern, '\\$$1');
        changeCount += replacements.length;
      }
      
      fixedLines.push(fixedLine);
    }
    
    fixedContent = fixedLines.join('\n');
    
    return {
      content: fixedContent,
      changed: changeCount > 0,
      description: 'Fixed ' + changeCount + ' unescaped dollar sign(s)'
    };
  }

  fixCommonTypos(content) {
    let fixedContent = content;
    let changeCount = 0;
    
    const typoFixes = [
      { pattern: /\\beginn\{/g, replacement: '\\begin{' },
      { pattern: /\\endd\{/g, replacement: '\\end{' },
      { pattern: /\\textttbf\{/g, replacement: '\\textbf{' },
      { pattern: /\\empph\{/g, replacement: '\\emph{' }
    ];
    
    for (const { pattern, replacement } of typoFixes) {
      const matches = fixedContent.match(pattern);
      if (matches) {
        fixedContent = fixedContent.replace(pattern, replacement);
        changeCount += matches.length;
      }
    }
    
    return {
      content: fixedContent,
      changed: changeCount > 0,
      description: 'Fixed ' + changeCount + ' common typo(s)'
    };
  }

  fixSpacingIssues(content) {
    let fixedContent = content;
    let changeCount = 0;
    
    // Fix multiple spaces in commands
    const originalLength = fixedContent.length;
    fixedContent = fixedContent.replace(/\{\s{2,}/g, '{');
    fixedContent = fixedContent.replace(/\s{2,}\}/g, '}');
    
    const newLength = fixedContent.length;
    if (newLength !== originalLength) {
      changeCount = 1;
    }
    
    return {
      content: fixedContent,
      changed: changeCount > 0,
      description: 'Fixed spacing issues in LaTeX commands'
    };
  }

  fixEncodingIssues(content) {
    let fixedContent = content;
    let changeCount = 0;
    
    // Fix common encoding issues
    const encodingFixes = [
      { pattern: /'/g, replacement: "'" },
      { pattern: /'/g, replacement: "'" },
      { pattern: /"/g, replacement: '"' },
      { pattern: /"/g, replacement: '"' },
      { pattern: /–/g, replacement: '--' },
      { pattern: /—/g, replacement: '---' }
    ];
    
    for (const { pattern, replacement } of encodingFixes) {
      const matches = fixedContent.match(pattern);
      if (matches) {
        fixedContent = fixedContent.replace(pattern, replacement);
        changeCount += matches.length;
      }
    }
    
    return {
      content: fixedContent,
      changed: changeCount > 0,
      description: 'Fixed ' + changeCount + ' encoding issue(s)'
    };
  }

  async saveValidationReport(validationResult, outputPath) {
    const report = {
      timestamp: validationResult.timestamp,
      summary: {
        success: validationResult.success,
        contentChanged: validationResult.contentChanged,
        processingTimeMs: validationResult.processingTimeMs
      },
      issues: validationResult.issues,
      fixes: validationResult.fixes,
      remainingIssues: validationResult.remainingIssues
    };
    
    await fs.writeFile(outputPath, JSON.stringify(report, null, 2));
    console.log('[LATEX-VALIDATOR] 📄 Validation report saved to:', outputPath);
  }
}

module.exports = LaTeXValidator;
