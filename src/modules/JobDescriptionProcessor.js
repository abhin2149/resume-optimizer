const Anthropic = require('@anthropic-ai/sdk');

/**
 * Module responsible for processing job descriptions
 * Handles sanitization, keyword extraction, and skill identification
 */
class JobDescriptionProcessor {
  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    this.model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
    this.temperature = parseFloat(process.env.OPENAI_TEMPERATURE) || 0.3;
    this.maxTokens = parseInt(process.env.OPENAI_MAX_TOKENS) || 4096;
  }

  /**
   * Sanitize job description text
   * Remove HTML tags, normalize whitespace, and clean artifacts
   * @param {string} rawText - Raw job description text
   * @returns {string} - Sanitized text
   */
  sanitizeJobDescription(rawText) {
    if (!rawText || typeof rawText !== 'string') {
      throw new Error('Job description must be a non-empty string');
    }

    let sanitized = rawText;

    // Remove HTML tags
    sanitized = sanitized.replace(/<[^>]*>/g, ' ');
    
    // Remove common PDF extraction artifacts
    sanitized = sanitized.replace(/\f/g, ' '); // Form feed
    sanitized = sanitized.replace(/\r\n/g, '\n'); // Windows line endings
    sanitized = sanitized.replace(/\r/g, '\n'); // Mac line endings
    
    // Remove extra whitespace and normalize
    sanitized = sanitized.replace(/\s+/g, ' ');
    sanitized = sanitized.replace(/\n\s+/g, '\n');
    sanitized = sanitized.replace(/\s+\n/g, '\n');
    sanitized = sanitized.replace(/\n{3,}/g, '\n\n');
    
    // Remove leading/trailing whitespace
    sanitized = sanitized.trim();
    
    // Remove common job board artifacts
    const artifactPatterns = [
      /Apply now|Apply today|Click here/gi,
      /Posted \d+ days? ago/gi,
      /Job ID:?\s*\w+/gi,
      /Reference:?\s*\w+/gi,
      /Share this job/gi,
      /Save this job/gi,
      /Print this job/gi
    ];
    
    for (const pattern of artifactPatterns) {
      sanitized = sanitized.replace(pattern, '');
    }

    // Clean up after artifact removal
    sanitized = sanitized.replace(/\s+/g, ' ').trim();
    
    return sanitized;
  }

  /**
   * Extract keywords and skills from job description using Anthropic Claude
   * @param {string} jobDescription - Sanitized job description
   * @returns {Promise<Array>} - Array of extracted keywords
   */
  async extractKeywords(jobDescription) {
    try {
      const prompt = this.buildKeywordExtractionPrompt(jobDescription);

      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        system: [
          {
            type: 'text',
            text: 'You are an expert keyword extraction specialist for resume optimization. Analyze job descriptions and extract relevant keywords valuable for tailoring resumes. Focus on context-aware extraction, distinguishing required skills from casual mentions. Return ONLY a valid JSON object with a "keywords" array — no markdown, no code blocks, no extra text.',
            cache_control: { type: 'ephemeral' }
          }
        ],
        messages: [
          { role: 'user', content: prompt }
        ]
      });

      let content = response.content[0]?.text;
      if (!content) {
        throw new Error('No response from Anthropic API');
      }

      // Strip markdown code-block wrapper if model included one
      content = content.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

      const parsed = JSON.parse(content);
      const keywords = parsed.keywords || parsed.skills || parsed.terms || [];

      // Validate and clean keywords
      const cleanedKeywords = this.validateAndCleanKeywords(keywords);

      // Deduplicate and rank by relevance
      return this.deduplicateAndRank(cleanedKeywords, jobDescription);

    } catch (error) {
      console.error('Error extracting keywords:', error);
      // Fallback to basic keyword extraction
      return this.extractKeywordsFallback(jobDescription);
    }
  }

  /**
   * Build the keyword extraction prompt
   * @param {string} jobDescription - Job description text
   * @returns {string} - Formatted prompt
   */
  buildKeywordExtractionPrompt(jobDescription) {
    return `
You are an expert keyword extraction specialist for resume optimization. Your task is to analyze job descriptions and extract relevant keywords that would be valuable for tailoring resumes.

ANALYSIS APPROACH:
1. **Context Recognition**: Distinguish between required skills vs. casual mentions
2. **Priority Assessment**: Rank keywords by importance and frequency
3. **Industry Alignment**: Identify domain-specific terminology
4. **Resume Relevance**: Focus on terms that belong in professional resumes

KEYWORD CATEGORIES:
- **Technical Skills**: Programming languages, frameworks, tools, platforms
- **Methodologies**: Development processes, project management approaches
- **Soft Skills**: Interpersonal abilities, leadership qualities
- **Industry Knowledge**: Domain-specific terms, regulations, standards
- **Experience Indicators**: Seniority levels, role types, responsibilities

EXTRACTION GUIDELINES:
- **CRITICAL**: Explicitly required skills ("must have", "required", "proficiency in")
- **IMPORTANT**: Frequently mentioned or emphasized in requirements
- **DESIRABLE**: Mentioned once or in "nice to have" contexts
- **CONTEXTUAL**: Industry-specific terms showing domain expertise

QUALITY FILTERS:
- Must be specific and measurable (avoid "good communication" → prefer "public speaking")
- Should appear in job requirements or qualifications sections
- Must be relevant to the specific role and industry
- Should be terms that would appear in a professional resume
- Avoid company-specific internal terminology

CONTEXT AWARENESS:
- Distinguish programming languages from casual mentions (e.g., "Go" as language vs. "go to website")
- Look for requirement indicators: "experience with", "proficiency in", "knowledge of"
- Prioritize terms in requirements/qualifications over general descriptions
- Consider industry context for technical terms

**Job Description:**
${jobDescription}

**Instructions:**
- Extract 15-25 high-quality keywords/phrases — quality over quantity
- Include both single words and multi-word phrases
- Prioritize must-have requirements; deprioritize nice-to-have
- Focus on actionable, specific terms that belong in a resume skills or experience section
- Return as JSON object with "keywords" array

**Example Output:**
{
  "keywords": [
    "Python",
    "React",
    "Node.js", 
    "full-stack development",
    "agile methodology",
    "team leadership",
    "problem solving",
    "REST APIs",
    "database design",
    "cloud computing"
  ]
}
`;
  }

  /**
   * Validate and clean extracted keywords
   * @param {Array} keywords - Raw keywords from AI
   * @returns {Array} - Cleaned keywords
   */
  validateAndCleanKeywords(keywords) {
    if (!Array.isArray(keywords)) {
      return [];
    }

    return keywords
      .filter(keyword => keyword && typeof keyword === 'string')
      .map(keyword => keyword.trim())
      .filter(keyword => {
        // Filter out very short or very long keywords
        return keyword.length >= 2 && keyword.length <= 100;
      })
      .filter(keyword => {
        // Filter out generic words
        const genericWords = [
          'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
          'work', 'job', 'role', 'position', 'opportunity', 'company', 'team', 'experience'
        ];
        return !genericWords.includes(keyword.toLowerCase());
      });
  }

  /**
   * Deduplicate and rank keywords by relevance
   * @param {Array} keywords - Keywords to process
   * @param {string} jobDescription - Original job description
   * @returns {Array} - Ranked and deduplicated keywords
   */
  deduplicateAndRank(keywords, jobDescription) {
    const keywordMap = new Map();
    const lowerJobDescription = jobDescription.toLowerCase();

    // Count occurrences and calculate relevance scores
    for (const keyword of keywords) {
      const lowerKeyword = keyword.toLowerCase();
      
      if (!keywordMap.has(lowerKeyword)) {
        // Calculate relevance score based on frequency and position
        const frequency = (lowerJobDescription.match(new RegExp(lowerKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
        const isInTitle = lowerJobDescription.substring(0, 200).includes(lowerKeyword);
        const isInRequirements = lowerJobDescription.includes('require') && lowerJobDescription.substring(lowerJobDescription.indexOf('require')).includes(lowerKeyword);
        
        const score = frequency + (isInTitle ? 3 : 0) + (isInRequirements ? 2 : 0);
        
        keywordMap.set(lowerKeyword, {
          original: keyword,
          frequency: frequency,
          score: score
        });
      }
    }

    // Sort by relevance score and return top keywords
    // 20 is enough signal — 50 dilutes the AI's focus on what truly matters
    return Array.from(keywordMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map(item => item.original);
  }

  /**
   * Fallback keyword extraction using basic text processing
   * @param {string} jobDescription - Job description text
   * @returns {Array} - Basic extracted keywords
   */
  extractKeywordsFallback(jobDescription) {
    const commonTechTerms = [
      // Programming Languages
      'JavaScript', 'Python', 'Java', 'C++', 'C#', 'TypeScript', 'Go', 'Rust', 'PHP', 'Ruby', 'Swift', 'Kotlin',
      
      // Frameworks/Libraries
      'React', 'Angular', 'Vue', 'Node.js', 'Express', 'Django', 'Flask', 'Spring', 'Laravel', 'Rails',
      
      // Databases
      'MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'SQLite', 'Oracle', 'SQL Server', 'DynamoDB',
      
      // Cloud Platforms
      'AWS', 'Azure', 'GCP', 'Google Cloud', 'Docker', 'Kubernetes', 'Terraform',
      
      // Methodologies
      'Agile', 'Scrum', 'DevOps', 'CI/CD', 'TDD', 'API', 'REST', 'GraphQL', 'Microservices',
      
      // Skills
      'leadership', 'communication', 'problem solving', 'teamwork', 'project management'
    ];

    const foundKeywords = [];
    const lowerDescription = jobDescription.toLowerCase();

    for (const term of commonTechTerms) {
      if (lowerDescription.includes(term.toLowerCase())) {
        foundKeywords.push(term);
      }
    }

    return foundKeywords;
  }

  /**
   * Analyze job description for specific sections (requirements, responsibilities, etc.)
   * @param {string} jobDescription - Job description text
   * @returns {Object} - Parsed sections
   */
  parseJobSections(jobDescription) {
    const sections = {
      requirements: [],
      responsibilities: [],
      qualifications: [],
      skills: [],
      benefits: []
    };

    const sectionKeywords = {
      requirements: ['require', 'must have', 'essential', 'mandatory'],
      responsibilities: ['responsib', 'duties', 'you will', 'role'],
      qualifications: ['qualif', 'education', 'degree', 'certification'],
      skills: ['skill', 'experience', 'knowledge', 'familiar'],
      benefits: ['benefit', 'offer', 'package', 'perks']
    };

    // Simple section detection based on keywords
    const lines = jobDescription.split('\n');
    let currentSection = null;

    for (const line of lines) {
      const lowerLine = line.toLowerCase().trim();
      
      // Check if line indicates a new section
      for (const [section, keywords] of Object.entries(sectionKeywords)) {
        if (keywords.some(keyword => lowerLine.includes(keyword))) {
          currentSection = section;
          break;
        }
      }

      // Add line to current section if it has content
      if (currentSection && line.trim() && !sectionKeywords[currentSection].some(keyword => lowerLine.includes(keyword))) {
        sections[currentSection].push(line.trim());
      }
    }

    return sections;
  }

  /**
   * Extract job title and company name from job description using enhanced patterns
   * @param {string} jobDescription - Job description text
   * @returns {Object} - Object with title and company fields
   */
  extractJobTitleAndCompany(jobDescription) {
    const extracted = {
      title: 'Job Posting',
      company: 'Unknown Company'
    };

    if (!jobDescription || typeof jobDescription !== 'string') {
      return extracted;
    }

    const lines = jobDescription.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const firstFewLines = lines.slice(0, 15).join(' ');
    const firstThreeLines = lines.slice(0, 3).join(' ');

    // Enhanced patterns for job titles
    const titlePatterns = [
      /job title[:\s]+([^\n\r,]{3,80})/i,
      /position[:\s]+([^\n\r,]{3,80})/i,
      /role[:\s]+([^\n\r,]{3,80})/i,
      /vacancy[:\s]+([^\n\r,]{3,80})/i,
      /opportunity[:\s]+([^\n\r,]{3,80})/i,
      /hiring\s+(?:for\s+)?(?:a\s+)?([^\n\r,]{10,80})/i,
      /opening\s+(?:for\s+)?(?:a\s+)?([^\n\r,]{10,80})/i,
      /seeking\s+(?:a\s+)?([^\n\r,]{10,80})/i,
      /looking\s+for\s+(?:a\s+)?([^\n\r,]{10,80})/i,
      /we\s+need\s+(?:a\s+)?([^\n\r,]{10,80})/i,
      /^([^-\n\r,]{15,80})\s*[-–—]\s*/, // Title - Company pattern
      /^([^|\n\r]{15,80})\s*\|\s*/, // Title | Company pattern
      /^([^@\n\r]{15,80})\s*@\s*/, // Title @ Company pattern
      // Common job title patterns at start of description
      /^(.*?(?:engineer|developer|manager|analyst|coordinator|specialist|lead|director|senior|junior|intern|architect|designer|consultant|administrator|technician|scientist|researcher|supervisor|executive|officer|assistant|representative|sales|marketing|product|software|data|full[\s-]?stack|front[\s-]?end|back[\s-]?end|devops|qa|quality|test|security|cloud|mobile|web|ui|ux|business|project|program|technical|principal|staff).*?)[-–—@|]/i
    ];

    // Enhanced patterns for company names with better coverage
    const companyPatterns = [
      // Direct mentions
      /company[:\s]+([^\n\r,]{2,60})/i,
      /organization[:\s]+([^\n\r,]{2,60})/i,
      /employer[:\s]+([^\n\r,]{2,60})/i,
      /firm[:\s]+([^\n\r,]{2,60})/i,
      /corporation[:\s]+([^\n\r,]{2,60})/i,
      /business[:\s]+([^\n\r,]{2,60})/i,
      
      // Context patterns
      /at\s+([A-Z][a-zA-Z\s&,\.\-\(\)0-9]{2,50})(?:\s+(?:is|are|has|seeks|looking|hiring|offers|provides|specializes))/i,
      /join\s+([A-Z][a-zA-Z\s&,\.\-\(\)0-9]{2,50})(?:\s+(?:as|and|today|now|our|the))/i,
      /work\s+(?:at|for|with)\s+([A-Z][a-zA-Z\s&,\.\-\(\)0-9]{2,50})(?:\s+(?:as|and|today|now|our|the|in))/i,
      /([A-Z][a-zA-Z\s&,\.\-\(\)0-9]{2,50})\s+is\s+(?:hiring|looking|seeking|recruiting|searching)/i,
      /([A-Z][a-zA-Z\s&,\.\-\(\)0-9]{2,50})\s+(?:seeks|needs|wants|requires)\s+(?:a|an|talented|experienced|skilled)/i,
      /([A-Z][a-zA-Z\s&,\.\-\(\)0-9]{2,50})\s+team\s+is\s+(?:growing|expanding|looking)/i,
      
      // Separator patterns (Company - Title, Company | Title, etc.)
      /^([A-Z][a-zA-Z\s&,\.\-\(\)0-9]{2,50})\s*[-–—]\s*[^-\n\r,]{10,}/i,
      /^([A-Z][a-zA-Z\s&,\.\-\(\)0-9]{2,50})\s*\|\s*[^|\n\r]{10,}/i,
      /^([A-Z][a-zA-Z\s&,\.\-\(\)0-9]{2,50})\s*@\s*[^@\n\r]{10,}/i,
      /^([A-Z][a-zA-Z\s&,\.\-\(\)0-9]{2,50})\s*–\s*[^–\n\r]{10,}/i,
      
      // About us / company intro patterns
      /(?:about|join|welcome\s+to)\s+([A-Z][a-zA-Z\s&,\.\-\(\)0-9]{2,50})/i,
      /([A-Z][a-zA-Z\s&,\.\-\(\)0-9]{2,50})(?:\s+Inc\.?|\s+LLC|\s+Ltd\.?|\s+Corp\.?|\s+Company|\s+Group|\s+Solutions|\s+Technologies|\s+Systems|\s+Services|\s+Consulting|\s+Industries)/i,
      
      // "Our company", "The company" patterns
      /our\s+company[,\s]+([A-Z][a-zA-Z\s&,\.\-\(\)0-9]{2,50})/i,
      /the\s+company[,\s]+([A-Z][a-zA-Z\s&,\.\-\(\)0-9]{2,50})/i,
      
      // Fortune 500 / well-known company patterns
      /(?:Fortune\s+500|Fortune\s+1000|global|leading|international|multinational)\s+(?:company\s+)?([A-Z][a-zA-Z\s&,\.\-\(\)0-9]{2,50})/i
    ];

    // Enhanced job title extraction
    for (const pattern of titlePatterns) {
      const match = jobDescription.match(pattern);
      if (match && match[1]) {
        let title = match[1].trim()
          .replace(/[^\w\s&\-]/g, ' ') // Keep alphanumeric, space, &, -
          .replace(/\s+/g, ' ') // Normalize spaces
          .trim();
        
        // Remove common noise words from end
        title = title.replace(/\s+(role|position|job|opportunity|opening|vacancy)$/i, '');
        
        if (title.length >= 5 && title.length <= 80) {
          extracted.title = title.substring(0, 80);
          break;
        }
      }
    }

    // Enhanced company name extraction
    for (const pattern of companyPatterns) {
      const match = jobDescription.match(pattern);
      if (match && match[1]) {
        let company = match[1].trim()
          .replace(/[^\w\s&,\.\-\(\)0-9]/g, ' ') // Keep reasonable company name characters
          .replace(/\s+/g, ' ') // Normalize spaces
          .trim();
        
        // Remove common noise words
        const noiseWords = /\b(the|a|an|and|or|of|in|at|to|for|with|by|from|about|into|through|during|before|after|above|below|up|down|out|off|over|under|again|further|then|once|here|there|when|where|why|how|all|any|both|each|few|more|most|other|some|such|only|own|same|so|than|too|very|will|just|should|could|would|may|might|can|shall|must|ought|need|want|seem|appear|become|get|give|go|come|take|make|do|have|be|say|see|know|think|feel|look|use|find|work|call|try|ask|turn|move|live|believe|hold|bring|happen|write|provide|sit|stand|lose|pay|meet|include|continue|set|learn|change|lead|understand|watch|follow|stop|create|speak|read|allow|add|spend|grow|open|walk|win|offer|remember|love|consider|appear|buy|wait|serve|die|send|expect|build|stay|fall|cut|reach|kill|remain|suggest|raise|pass|sell|require|report|decide|pull|break|pick|wear|paper|system|program|question|work|government|company|group|part|place|case|week|hand|eye|good|first|last|long|great|little|own|other|old|right|big|high|different|small|large|next|early|young|important|few|public|bad|same|able|local|sure|united|real|left|least|human|far|open|possible|head|business|service|market|member|power|end|fact|every|school|level|idea|social|interest|body|information|nothing|money|story|lot|point|water|family|state|example|matter|people|time|way|day|man|thing|woman|life|child|world|country|area|development|week|case|team|student|result|management|home|research|party|company)/gi;
        company = company.replace(noiseWords, ' ').replace(/\s+/g, ' ').trim();
        
        // Validate company name
        if (company.length >= 2 && company.length <= 60 && 
            !company.toLowerCase().includes('description') &&
            !company.toLowerCase().includes('requirements') &&
            !/^\d+$/.test(company)) { // Not just numbers
          extracted.company = company.substring(0, 60);
          break;
        }
      }
    }

    // Fallback: Use first line as title if it looks like a job title
    if (extracted.title === 'Job Posting' && lines.length > 0) {
      const firstLine = lines[0];
      const jobIndicators = /engineer|developer|manager|analyst|coordinator|specialist|lead|director|senior|junior|intern|architect|designer|consultant|administrator|technician|scientist|researcher|supervisor|executive|officer|assistant|representative|sales|marketing|product|software|data|full[\s-]?stack|front[\s-]?end|back[\s-]?end|devops|qa|quality|test|security|cloud|mobile|web|ui|ux|business|project|program|technical|principal|staff/i;
      
      if (firstLine.length >= 10 && firstLine.length <= 100 && 
          jobIndicators.test(firstLine) &&
          !firstLine.toLowerCase().includes('company') && 
          !firstLine.toLowerCase().includes('about us')) {
        extracted.title = firstLine.substring(0, 80);
      }
    }

    // Enhanced fallback for company names using structured data patterns
    if (extracted.company === 'Unknown Company') {
      // Look for common business entity suffixes
      const entitySuffixes = /\b([A-Z][a-zA-Z\s&\.\-0-9]{1,50})\s+(Inc\.?|LLC|Ltd\.?|Corp\.?|Corporation|Company|Group|Solutions|Technologies|Systems|Services|Consulting|Industries|Associates|Partners|Enterprises|International|Global|Holdings|Ventures|Investments|Capital|Management|Development|Research|Labs|Laboratories|Studios|Agency|Firm|Foundation|Institute|Center|Centre|Organization|Organisation)\b/gi;
      const entityMatch = firstThreeLines.match(entitySuffixes);
      
      if (entityMatch && entityMatch.length > 0) {
        const fullMatch = entityMatch[0];
        const companyName = fullMatch.trim();
        if (companyName.length >= 5 && companyName.length <= 60) {
          extracted.company = companyName;
        }
      } else {
        // Last resort: Look for capitalized sequences that might be company names
        const capitalizedPattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}\b/g;
        const matches = firstThreeLines.match(capitalizedPattern);
        
        if (matches && matches.length > 0) {
          // Filter out common words that aren't company names
          const excludeWords = ['Job', 'Position', 'Role', 'Candidate', 'Experience', 'Requirements', 'Qualifications', 'About', 'Description', 'Apply', 'Today', 'Now', 'Here', 'This', 'That', 'What', 'When', 'Where', 'How', 'Why', 'Who', 'All', 'New', 'Old', 'Good', 'Best', 'Top', 'High', 'Low', 'First', 'Last', 'Next', 'Previous', 'Current', 'Recent', 'Latest', 'Future', 'Past', 'Present'];
          const potentialCompanies = matches.filter(match => 
            !excludeWords.some(word => match.toLowerCase().includes(word.toLowerCase())) &&
            match.length >= 3 && match.length <= 50 &&
            !/^\d+$/.test(match) // Not just numbers
          );
          
          if (potentialCompanies.length > 0) {
            // Take the first reasonable match
            extracted.company = potentialCompanies[0];
          }
        }
      }
    }

    // Final cleanup
    if (extracted.title.length > 80) {
      extracted.title = extracted.title.substring(0, 80).trim();
    }
    if (extracted.company.length > 60) {
      extracted.company = extracted.company.substring(0, 60).trim();
    }

    return extracted;
  }
}

module.exports = JobDescriptionProcessor; 