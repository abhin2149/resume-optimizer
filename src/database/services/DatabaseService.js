const crypto = require('crypto');
const dbConnection = require('../connection');

class DatabaseService {
  constructor() {
    this.db = dbConnection;
  }

  /**
   * User Management
   */
  async createUser(userData) {
    try {
      const { name, email, subscriptionTier = 'free' } = userData;
      
      const supabase = this.db.getSupabaseClient();
      const { data: user, error } = await supabase
        .from('users')
        .insert([{
          name,
          email,
          subscription_tier: subscriptionTier,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();
      
      if (error) {
        throw new Error(`Failed to create user: ${error.message}`);
      }

      console.log('[DB] ✅ User created:', email);
      
      return {
        success: true,
        user: user
      };
    } catch (error) {
      console.error('[DB] ❌ Error creating user:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getUserByEmail(email) {
    try {
      const supabase = this.db.getSupabaseClient();
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw new Error(`Failed to fetch user: ${error.message}`);
      }
      
      return user || null;
    } catch (error) {
      console.error('[DB] ❌ Error fetching user:', error);
      throw error;
    }
  }

  async updateUserUsageCount(userId) {
    try {
      const supabase = this.db.getSupabaseClient();
      
      // First get current usage count
      const { data: user, error: fetchError } = await supabase
        .from('users')
        .select('usage_count')
        .eq('id', userId)
        .single();

      if (fetchError) {
        throw new Error(`Failed to fetch user: ${fetchError.message}`);
      }

      const newUsageCount = (user.usage_count || 0) + 1;

      // Update usage count and last login
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          usage_count: newUsageCount,
          last_login: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) {
        throw new Error(`Failed to update usage count: ${updateError.message}`);
      }
      
      return newUsageCount;
    } catch (error) {
      console.error('[DB] ❌ Error updating usage count:', error);
      throw error;
    }
  }

  /**
   * Job Description Management
   */
  async createJobDescription(jobData) {
    try {
      const { userId, title, company, originalText, sanitizedText } = jobData;
      
      // Create hash for deduplication
      const hash = crypto.createHash('sha256').update(originalText).digest('hex');
      
      const supabase = this.db.getSupabaseClient();
      
      // Check if job description already exists
      const { data: existingJobs, error: existingError } = await supabase
        .from('job_descriptions')
        .select('id')
        .eq('hash', hash);
      
      if (existingError) {
        throw new Error(`Failed to check existing job descriptions: ${existingError.message}`);
      }
      
      if (existingJobs && existingJobs.length > 0) {
        console.log('[DB] 📋 Job description already exists, returning existing ID');
        return {
          success: true,
          jobDescription: existingJobs[0],
          isExisting: true
        };
      }

      const wordCount = sanitizedText.split(/\s+/).length;
      const charCount = originalText.length;
      
      const { data: jobDescription, error } = await supabase
        .from('job_descriptions')
        .insert([{
          user_id: userId,
          title,
          company,
          original_text: originalText,
          sanitized_text: sanitizedText,
          word_count: wordCount,
          character_count: charCount,
          hash,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();
      
      if (error) {
        throw new Error(`Failed to create job description: ${error.message}`);
      }
      
      console.log('[DB] ✅ Job description created:', jobDescription.id);
      
      return {
        success: true,
        jobDescription: jobDescription,
        isExisting: false
      };
    } catch (error) {
      console.error('[DB] ❌ Error creating job description:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Resume Management
   */
  async createResume(resumeData) {
    try {
      const { userId, name, content, contentType = 'latex', isCustom = false } = resumeData;
      
      const charCount = content.length;
      const wordCount = content.split(/\s+/).length;
      
      const supabase = this.db.getSupabaseClient();
      const { data: resume, error } = await supabase
        .from('resumes')
        .insert([{
          user_id: userId,
          name,
          content,
          content_type: contentType,
          is_custom: isCustom,
          character_count: charCount,
          word_count: wordCount,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();
      
      if (error) {
        throw new Error(`Failed to create resume: ${error.message}`);
      }
      
      console.log('[DB] ✅ Resume created:', resume.id);
      
      return {
        success: true,
        resume: resume
      };
    } catch (error) {
      console.error('[DB] ❌ Error creating resume:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getBaseResume() {
    try {
      const supabase = this.db.getSupabaseClient();
      const { data: resume, error } = await supabase
        .from('resumes')
        .select('*')
        .eq('is_base_template', true)
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw new Error(`Failed to fetch base resume: ${error.message}`);
      }
      
      return resume || null;
    } catch (error) {
      console.error('[DB] ❌ Error fetching base resume:', error);
      throw error;
    }
  }

  /**
   * Get a specific resume by ID with user ownership validation
   */
  async getResume(resumeId, userId) {
    try {
      const supabase = this.db.getSupabaseClient();
      const { data: resume, error } = await supabase
        .from('resumes')
        .select('*')
        .eq('id', resumeId)
        .eq('user_id', userId) // Ensure user owns this resume
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return {
            success: false,
            error: 'Resume not found or access denied'
          };
        }
        throw new Error(`Failed to fetch resume: ${error.message}`);
      }

      console.log('[DB] ✅ Resume fetched:', resumeId);
      
      return {
        success: true,
        resume: resume
      };
    } catch (error) {
      console.error('[DB] ❌ Error fetching resume:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get all resumes for a user
   */
  async getUserResumes(userId, includeBaseTemplate = false) {
    try {
      const supabase = this.db.getSupabaseClient();
      let query = supabase
        .from('resumes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (!includeBaseTemplate) {
        query = query.eq('is_base_template', false);
      }

      const { data: resumes, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch user resumes: ${error.message}`);
      }

      return {
        success: true,
        resumes: resumes || []
      };
    } catch (error) {
      console.error('[DB] ❌ Error fetching user resumes:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Tailoring Session Management
   */
  async createTailoringSession(sessionData) {
    try {
      const {
        sessionId, userId, jobDescriptionId, originalResumeId,
        originalContent, tailoredContent, processingTimeMs,
        aiModel, aiTokens, manualCompanyName, manualJobTitle
      } = sessionData;

      const originalLength = originalContent?.length || 0;
      const tailoredLength = tailoredContent.length;
      const contentDiff = tailoredLength - originalLength;

      const supabase = this.db.getSupabaseClient();
      const { data, error } = await supabase
        .from('tailoring_sessions')
        .insert([{
          session_id: sessionId,
          user_id: userId,
          job_description_id: jobDescriptionId,
          original_resume_id: originalResumeId,
          original_resume_content: originalContent,
          original_content_length: originalLength,
          tailored_content: tailoredContent,
          tailored_content_length: tailoredLength,
          content_difference: contentDiff,
          processing_time_ms: processingTimeMs,
          ai_model_used: aiModel,
          ai_tokens_used: aiTokens,
          manual_company_name: manualCompanyName,
          manual_job_title: manualJobTitle,
          status: 'processing',
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create tailoring session: ${error.message}`);
      }

      console.log('[DB] ✅ Tailoring session created:', sessionId);

      return {
        success: true,
        session: data
      };
    } catch (error) {
      console.error('[DB] ❌ Error creating tailoring session:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async updateTailoringSession(sessionId, updateData) {
    try {
      const {
        status = 'completed',
        latexCompilationSuccess = false,
        latexCompilationError = null,
        latexCompilationTimeMs = null,
        texFilePath = null,
        pdfFilePath = null,
        pdfFileSize = null,
        errorMessage = null
      } = updateData;

      const supabase = this.db.getSupabaseClient();
      const { data, error } = await supabase
        .from('tailoring_sessions')
        .update({
          status: status,
          latex_compilation_success: latexCompilationSuccess,
          latex_compilation_error: latexCompilationError,
          latex_compilation_time_ms: latexCompilationTimeMs,
          tex_file_path: texFilePath,
          pdf_file_path: pdfFilePath,
          pdf_file_size: pdfFileSize,
          error_message: errorMessage,
          completed_at: new Date().toISOString()
        })
        .eq('session_id', sessionId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update tailoring session: ${error.message}`);
      }

      console.log('[DB] ✅ Tailoring session updated:', sessionId, 'Status:', status);

      return {
        success: true,
        session: data
      };
    } catch (error) {
      console.error('[DB] ❌ Error updating tailoring session:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getTailoringSession(sessionId) {
    try {
      const supabase = this.db.getSupabaseClient();
      const { data, error } = await supabase
        .from('tailoring_sessions')
        .select(`
          *,
          job_descriptions(title, company, original_text),
          users(name, email)
        `)
        .eq('session_id', sessionId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw new Error(`Failed to fetch tailoring session: ${error.message}`);
      }

      if (data) {
        // Get extracted keywords for this session
        const { data: keywords, error: keywordsError } = await supabase
          .from('extracted_keywords')
          .select('keyword, keyword_type, confidence_score, added_to_resume')
          .eq('tailoring_session_id', data.id)
          .order('confidence_score', { ascending: false });

        if (keywordsError) {
          console.warn('[DB] ⚠️ Failed to fetch keywords:', keywordsError.message);
        }

        // Get resume modifications for this session
        const { data: modifications, error: modificationsError } = await supabase
          .from('resume_modifications')
          .select('modification_type, section_name, original_text, modified_text, reason, confidence_score')
          .eq('tailoring_session_id', data.id)
          .order('created_at', { ascending: false });

        if (modificationsError) {
          console.warn('[DB] ⚠️ Failed to fetch modifications:', modificationsError.message);
        }

        // Flatten the response to match the original format
        const flattened = {
          ...data,
          // Prioritize manual company/job title over job description extraction
          job_title: data.manual_job_title || data.job_descriptions?.title || 'Job Posting',
          company: data.manual_company_name || data.job_descriptions?.company || 'Unknown Company',
          original_job_description: data.job_descriptions?.original_text,
          user_name: data.users?.name,
          email: data.users?.email,
          // Add analysis data
          extracted_keywords: keywords || [],
          resume_modifications: modifications || []
        };
        delete flattened.job_descriptions;
        delete flattened.users;
        return flattened;
      }

      return null;
    } catch (error) {
      console.error('[DB] ❌ Error fetching tailoring session:', error);
      throw error;
    }
  }

  /**
   * Keywords Management
   */
  async saveExtractedKeywords(keywordsData) {
    try {
      const { jobDescriptionId, tailoringSessionId, keywords } = keywordsData;

      if (!keywords || keywords.length === 0) {
        return { success: true, savedCount: 0 };
      }

      // Prepare data for bulk insert
      const keywordRecords = keywords.map(keyword => ({
        job_description_id: jobDescriptionId,
        tailoring_session_id: tailoringSessionId,
        keyword: keyword,
        keyword_type: this.classifyKeyword(keyword),
        confidence_score: 0.8, // Default confidence
        frequency_in_jd: 1, // Could be enhanced to count actual frequency
        created_at: new Date().toISOString()
      }));

      const supabase = this.db.getSupabaseClient();
      const { data, error } = await supabase
        .from('extracted_keywords')
        .insert(keywordRecords)
        .select();

      if (error) {
        // Try to handle individual keyword insertion errors gracefully
        console.warn('[DB] ⚠️ Bulk insert failed, trying individual inserts:', error.message);
        let savedCount = 0;
        
        for (const keywordRecord of keywordRecords) {
          try {
            const { error: individualError } = await supabase
              .from('extracted_keywords')
              .insert([keywordRecord]);
            
            if (!individualError) {
              savedCount++;
            } else {
              console.warn('[DB] ⚠️ Failed to save keyword:', keywordRecord.keyword, individualError.message);
            }
          } catch (err) {
            console.warn('[DB] ⚠️ Failed to save keyword:', keywordRecord.keyword, err.message);
          }
        }

        console.log('[DB] ✅ Keywords saved:', savedCount, 'out of', keywords.length);
        return {
          success: true,
          savedCount: savedCount
        };
      }

      const savedCount = data?.length || 0;
      console.log('[DB] ✅ Keywords saved:', savedCount, 'out of', keywords.length);

      return {
        success: true,
        savedCount: savedCount
      };
    } catch (error) {
      console.error('[DB] ❌ Error saving keywords:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Simple keyword classification
   */
  classifyKeyword(keyword) {
    const technicalKeywords = [
      'python', 'javascript', 'react', 'node', 'aws', 'docker', 'kubernetes',
      'sql', 'mongodb', 'postgresql', 'git', 'jenkins', 'api', 'rest', 'graphql',
      'tensorflow', 'pytorch', 'azure', 'gcp', 'terraform', 'ansible', 'django',
      'flask', 'spring', 'angular', 'vue', 'redis', 'elasticsearch'
    ];
    
    const softSkills = [
      'leadership', 'communication', 'teamwork', 'problem-solving', 'collaboration',
      'management', 'organization', 'creativity', 'analytical'
    ];

    const toolsFrameworks = [
      'figma', 'adobe', 'jira', 'confluence', 'slack', 'github', 'gitlab',
      'jenkins', 'docker', 'kubernetes'
    ];

    const keywordLower = keyword.toLowerCase();
    
    if (technicalKeywords.some(tech => keywordLower.includes(tech))) {
      return 'technical';
    } else if (softSkills.some(soft => keywordLower.includes(soft))) {
      return 'soft_skill';
    } else if (toolsFrameworks.some(tool => keywordLower.includes(tool))) {
      return 'tool';
    } else if (keyword.length > 15) { // Increased threshold to avoid over-classification
      return 'industry';
    } else {
      return 'general';
    }
  }

  /**
   * Update keyword usage flags to mark which keywords were actually added to the resume
   */
  async updateKeywordUsage(tailoringSessionId, originalContent, tailoredContent) {
    try {
      const supabase = this.db.getSupabaseClient();
      
      // Get all keywords for this session
      const { data: keywords, error: fetchError } = await supabase
        .from('extracted_keywords')
        .select('id, keyword')
        .eq('tailoring_session_id', tailoringSessionId);

      if (fetchError) {
        throw new Error(`Failed to fetch keywords: ${fetchError.message}`);
      }

      if (!keywords || keywords.length === 0) {
        console.log('[DB] 🔍 No keywords to update');
        return;
      }

      // Normalize content for comparison
      const normalizeContent = (content) => {
        return content.toLowerCase()
          .replace(/\\[a-zA-Z]+\{([^}]*)\}/g, '$1') // Extract content from LaTeX commands
          .replace(/\\[a-zA-Z]+/g, '') // Remove LaTeX commands
          .replace(/[{}]/g, '') // Remove braces
          .replace(/[^\w\s]/g, ' ') // Replace non-alphanumeric with spaces
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();
      };

      const originalNorm = normalizeContent(originalContent);
      const tailoredNorm = normalizeContent(tailoredContent);

      // Debug logging
      console.log('[DB] 🔍 Keyword Detection Debug:');
      console.log(`[DB] 📊 Total keywords to check: ${keywords.length}`);
      console.log(`[DB] 📝 Sample keywords: ${keywords.slice(0, 5).map(k => k.keyword).join(', ')}`);
      console.log(`[DB] 📄 Original content length: ${originalNorm.length} chars`);
      console.log(`[DB] 📄 Tailored content length: ${tailoredNorm.length} chars`);

      // Check each keyword to see if it was added
      let updatedCount = 0;
      
      for (const keyword of keywords) {
        const keywordLower = keyword.keyword.toLowerCase().trim();
        const keywordWords = keywordLower.split(/\s+/);
        
        // Improved keyword matching logic
        let isInTailored = false;
        let isInOriginal = false;
        
        // Method 1: Exact phrase match
        if (tailoredNorm.includes(keywordLower)) {
          isInTailored = true;
        }
        if (originalNorm.includes(keywordLower)) {
          isInOriginal = true;
        }
        
        // Method 2: All words present (for multi-word keywords)
        if (!isInTailored && keywordWords.length > 1) {
          isInTailored = keywordWords.every(word => tailoredNorm.includes(word));
        }
        if (!isInOriginal && keywordWords.length > 1) {
          isInOriginal = keywordWords.every(word => originalNorm.includes(word));
        }
        
        // Method 3: Partial keyword matching for common variations
        if (!isInTailored) {
          // Check if any part of the keyword appears in tailored content
          const keywordCore = keywordWords[0]; // First word is usually the core term
          if (keywordCore.length >= 3) {
            isInTailored = tailoredNorm.includes(keywordCore);
          }
        }
        if (!isInOriginal) {
          const keywordCore = keywordWords[0];
          if (keywordCore.length >= 3) {
            isInOriginal = originalNorm.includes(keywordCore);
          }
        }
        
        const wasAdded = isInTailored && !isInOriginal;
        
        // Debug logging for each keyword
        if (wasAdded || (keywordLower === 'java' || keywordLower === 'aws' || keywordWords.includes('java') || keywordWords.includes('aws'))) {
          console.log(`[DB] 🔍 Keyword: "${keyword.keyword}"`);
          console.log(`[DB]   - In tailored: ${isInTailored}`);
          console.log(`[DB]   - In original: ${isInOriginal}`);
          console.log(`[DB]   - Was added: ${wasAdded}`);
        }
        
        if (wasAdded) {
          console.log(`[DB] 🎯 Keyword "${keyword.keyword}" was added to resume`);
          
          // Update the keyword record
          const { error: updateError } = await supabase
            .from('extracted_keywords')
            .update({ added_to_resume: true })
            .eq('id', keyword.id);

          if (!updateError) {
            updatedCount++;
          } else {
            console.warn(`[DB] ⚠️ Failed to update keyword ${keyword.keyword}:`, updateError.message);
          }
        }
      }

      console.log(`[DB] ✅ Updated ${updatedCount} keywords as added to resume`);
      
      return {
        success: true,
        updatedCount: updatedCount,
        totalKeywords: keywords.length
      };
      
    } catch (error) {
      console.error('[DB] ❌ Error updating keyword usage:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Reset all keywords to not added initially (called before AI processing)
   * @param {string} tailoringSessionId - Database tailoring session ID
   * @returns {Promise<Object>} - Result object
   */
  async resetKeywordsAsNotAdded(tailoringSessionId) {
    try {
      const supabase = this.db.getSupabaseClient();
      
      console.log(`[DB] 🔄 Resetting all keywords to not added for session: ${tailoringSessionId}`);
      
      const { error } = await supabase
        .from('extracted_keywords')
        .update({ added_to_resume: false })
        .eq('tailoring_session_id', tailoringSessionId);

      if (error) {
        throw new Error(`Failed to reset keywords: ${error.message}`);
      }

      console.log('[DB] ✅ All keywords reset to not added');
      
      return {
        success: true,
        message: 'Keywords reset successfully'
      };
      
    } catch (error) {
      console.error('[DB] ❌ Error resetting keywords:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Mark specific keywords as added based on actual implementation success
   * @param {string} tailoringSessionId - Database tailoring session ID
   * @param {Array} addedKeywords - Array of keyword strings that were actually added
   * @returns {Promise<Object>} - Result object
   */
  async markKeywordsAsAdded(tailoringSessionId, addedKeywords) {
    try {
      const supabase = this.db.getSupabaseClient();
      
      if (!addedKeywords || addedKeywords.length === 0) {
        console.log('[DB] 🔍 No keywords to mark as added');
        return { success: true, updatedCount: 0 };
      }

      console.log(`[DB] 🎯 Marking ${addedKeywords.length} keywords as added: ${addedKeywords.join(', ')}`);
      
      // Get all keywords for this session
      const { data: keywords, error: fetchError } = await supabase
        .from('extracted_keywords')
        .select('id, keyword')
        .eq('tailoring_session_id', tailoringSessionId);

      if (fetchError) {
        throw new Error(`Failed to fetch keywords: ${fetchError.message}`);
      }

      if (!keywords || keywords.length === 0) {
        console.log('[DB] 🔍 No keywords found in database to update');
        return { success: true, updatedCount: 0 };
      }

      let updatedCount = 0;
      
      // For each added keyword, find matching database keywords and mark them
      for (const addedKeyword of addedKeywords) {
        const addedKeywordLower = addedKeyword.toLowerCase().trim();
        
        // Find matching keywords in the database
        const matchingKeywords = keywords.filter(dbKeyword => {
          const dbKeywordLower = dbKeyword.keyword.toLowerCase().trim();
          
          // Exact match
          if (dbKeywordLower === addedKeywordLower) {
            return true;
          }
          
          // Check if the added keyword is contained in the database keyword
          if (dbKeywordLower.includes(addedKeywordLower)) {
            return true;
          }
          
          // Check if the database keyword is contained in the added keyword
          if (addedKeywordLower.includes(dbKeywordLower)) {
            return true;
          }
          
          // Check for partial matches (for compound keywords)
          const addedWords = addedKeywordLower.split(/\s+/);
          const dbWords = dbKeywordLower.split(/\s+/);
          
          // If any word from the added keyword matches any word from the database keyword
          return addedWords.some(addedWord => 
            dbWords.some(dbWord => 
              (addedWord === dbWord) || 
              (addedWord.length >= 3 && dbWord.includes(addedWord)) ||
              (dbWord.length >= 3 && addedWord.includes(dbWord))
            )
          );
        });
        
        // Update all matching keywords
        for (const matchingKeyword of matchingKeywords) {
          const { error: updateError } = await supabase
            .from('extracted_keywords')
            .update({ added_to_resume: true })
            .eq('id', matchingKeyword.id);

          if (!updateError) {
            updatedCount++;
            console.log(`[DB] 🎯 Marked keyword "${matchingKeyword.keyword}" as added (matched with "${addedKeyword}")`);
          } else {
            console.warn(`[DB] ⚠️ Failed to update keyword ${matchingKeyword.keyword}:`, updateError.message);
          }
        }
        
        if (matchingKeywords.length === 0) {
          console.log(`[DB] 🔍 No database keyword found matching "${addedKeyword}"`);
        }
      }

      console.log(`[DB] ✅ Marked ${updatedCount} keywords as added via actual implementation`);
      
      return {
        success: true,
        updatedCount: updatedCount,
        totalChecked: addedKeywords.length
      };
      
    } catch (error) {
      console.error('[DB] ❌ Error marking keywords as added:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * File Management
   */
  async saveGeneratedFile(fileData) {
    try {
      const { tailoringSessionId, fileType, filePath, fileSize, mimeType } = fileData;

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30 days from now

      const supabase = this.db.getSupabaseClient();
      const { data, error } = await supabase
        .from('generated_files')
        .insert([{
          tailoring_session_id: tailoringSessionId,
          file_type: fileType,
          file_path: filePath,
          file_size: fileSize,
          mime_type: mimeType,
          expires_at: expiresAt.toISOString(),
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to save file record: ${error.message}`);
      }

      console.log('[DB] ✅ File record saved:', fileType, filePath);

      return {
        success: true,
        file: data
      };
    } catch (error) {
      console.error('[DB] ❌ Error saving file record:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Resume Modifications Management
   */
  async saveResumeModifications(modificationsData) {
    try {
      const { tailoringSessionId, modifications } = modificationsData;

      if (!modifications || modifications.length === 0) {
        return { success: true, savedCount: 0 };
      }

      // Prepare data for bulk insert
      const modificationRecords = modifications.map(mod => ({
        tailoring_session_id: tailoringSessionId,
        modification_type: mod.modificationType || 'content_change',
        section_name: mod.sectionName || 'unknown',
        original_text: mod.originalText || '',
        modified_text: mod.modifiedText || '',
        reason: mod.reason || 'Job relevance optimization',
        confidence_score: mod.confidenceScore || 0.8,
        created_at: new Date().toISOString()
      }));

      const supabase = this.db.getSupabaseClient();
      const { data, error } = await supabase
        .from('resume_modifications')
        .insert(modificationRecords)
        .select();

      if (error) {
        // Try to handle individual modification insertion errors gracefully
        console.warn('[DB] ⚠️ Bulk insert failed, trying individual inserts:', error.message);
        let savedCount = 0;
        
        for (const modRecord of modificationRecords) {
          try {
            const { error: individualError } = await supabase
              .from('resume_modifications')
              .insert([modRecord]);
            
            if (!individualError) {
              savedCount++;
            } else {
              console.warn('[DB] ⚠️ Failed to save modification:', individualError.message);
            }
          } catch (err) {
            console.warn('[DB] ⚠️ Failed to save modification:', err.message);
          }
        }

        console.log('[DB] ✅ Resume modifications saved:', savedCount, 'out of', modifications.length);
        return {
          success: true,
          savedCount: savedCount
        };
      }

      const savedCount = data?.length || 0;
      console.log('[DB] ✅ Resume modifications saved:', savedCount, 'out of', modifications.length);

      return {
        success: true,
        savedCount: savedCount
      };
    } catch (error) {
      console.error('[DB] ❌ Error saving resume modifications:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Analyze resume modifications by comparing original and tailored content
   */
  analyzeResumeModifications(originalContent, tailoredContent, extractedKeywords = []) {
    const modifications = [];
    
    try {
      // Extract sections from both resumes
      const originalSections = this.extractLaTeXSections(originalContent);
      const tailoredSections = this.extractLaTeXSections(tailoredContent);
      
      // Compare each section
      Object.keys(tailoredSections).forEach(sectionName => {
        const originalSection = originalSections[sectionName] || '';
        const tailoredSection = tailoredSections[sectionName] || '';
        
        if (originalSection !== tailoredSection) {
          // Determine modification type
          let modificationType = 'content_change';
          if (!originalSection && tailoredSection) {
            modificationType = 'section_addition';
          } else if (originalSection && !tailoredSection) {
            modificationType = 'section_removal';
          } else if (tailoredSection.length > originalSection.length * 1.1) {
            modificationType = 'content_expansion';
          } else if (tailoredSection.length < originalSection.length * 0.9) {
            modificationType = 'content_reduction';
          }

                  // Check for keyword additions with improved matching
        const addedKeywords = extractedKeywords.filter(keyword => {
          const keywordLower = keyword.toLowerCase();
          const tailoredLower = tailoredSection.toLowerCase();
          const originalLower = originalSection.toLowerCase();
          
          // Check for exact matches and partial matches
          const keywordWords = keywordLower.split(/\s+/);
          const isInTailored = keywordWords.every(word => tailoredLower.includes(word)) || tailoredLower.includes(keywordLower);
          const isInOriginal = keywordWords.every(word => originalLower.includes(word)) || originalLower.includes(keywordLower);
          
          const added = isInTailored && !isInOriginal;
          if (added) {
            console.log(`[DB] 🎯 Found added keyword in ${sectionName}: "${keyword}"`);
          }
          
          return added;
        });
        
        console.log(`[DB] 📊 Section: ${sectionName} - Found ${addedKeywords.length} added keywords out of ${extractedKeywords.length} total keywords`);

          if (addedKeywords.length > 0) {
            modificationType = 'keyword_addition';
          }

          modifications.push({
            modificationType,
            sectionName,
            originalText: originalSection.substring(0, 500), // Truncate for storage
            modifiedText: tailoredSection.substring(0, 500),
            reason: this.generateModificationReason(modificationType, addedKeywords),
            confidenceScore: 0.8
          });
        }
      });

      // Add overall content change summary
      const contentDiff = tailoredContent.length - originalContent.length;
      if (Math.abs(contentDiff) > 100) {
        modifications.push({
          modificationType: contentDiff > 0 ? 'overall_expansion' : 'overall_reduction',
          sectionName: 'document',
          originalText: `Length: ${originalContent.length} chars`,
          modifiedText: `Length: ${tailoredContent.length} chars`,
          reason: `Document ${contentDiff > 0 ? 'expanded' : 'condensed'} by ${Math.abs(contentDiff)} characters`,
          confidenceScore: 1.0
        });
      }

    } catch (error) {
      console.error('[DB] ❌ Error analyzing modifications:', error);
      // Add fallback modification record
      modifications.push({
        modificationType: 'analysis_error',
        sectionName: 'unknown',
        originalText: 'Analysis failed',
        modifiedText: 'Content modified',
        reason: 'Unable to analyze specific changes',
        confidenceScore: 0.5
      });
    }

    return modifications;
  }

  /**
   * Extract LaTeX sections from content
   */
  extractLaTeXSections(content) {
    const sections = {};
    const sectionRegex = /\\section\{([^}]+)\}([\s\S]*?)(?=\\section|\\end\{document\}|$)/g;
    
    let match;
    while ((match = sectionRegex.exec(content)) !== null) {
      const sectionName = match[1].trim();
      const sectionContent = match[2].trim();
      sections[sectionName] = sectionContent;
    }

    return sections;
  }

  /**
   * Generate modification reason
   */
  generateModificationReason(modificationType, addedKeywords = []) {
    switch (modificationType) {
      case 'keyword_addition':
        if (addedKeywords.length > 3) {
          return `Added ${addedKeywords.length} job-relevant keywords: ${addedKeywords.slice(0, 3).join(', ')} and ${addedKeywords.length - 3} more`;
        } else if (addedKeywords.length > 0) {
          return `Added job-relevant keywords: ${addedKeywords.join(', ')}`;
        } else {
          return 'Added job-relevant keywords to improve ATS matching';
        }
      case 'content_expansion':
        return 'Expanded content to better match job requirements';
      case 'content_reduction':
        return 'Condensed content for better focus and readability';
      case 'section_addition':
        return 'Added new section for job relevance';
      case 'section_removal':
        return 'Removed irrelevant section';
      case 'overall_expansion':
        return 'Overall document expanded to include more relevant content';
      case 'overall_reduction':
        return 'Overall document condensed for better impact';
      default:
        return 'Content modified to better align with job requirements';
    }
  }

  async incrementFileDownload(sessionId, fileType) {
    try {
      const supabase = this.db.getSupabaseClient();
      
      // First get the tailoring session ID
      const { data: session, error: sessionError } = await supabase
        .from('tailoring_sessions')
        .select('id')
        .eq('session_id', sessionId)
        .single();

      if (sessionError || !session) {
        console.error('[DB] ❌ Error finding session for download increment:', sessionError?.message);
        return 0;
      }

      // Update the download count using RPC function or direct update with increment
      const { data, error } = await supabase.rpc('increment_download_count', {
        p_tailoring_session_id: session.id,
        p_file_type: fileType
      });

      if (error) {
        // Fallback: try direct update if RPC doesn't exist
        console.warn('[DB] ⚠️ RPC increment failed, trying direct update:', error.message);
        
        // Get current count
        const { data: currentFile, error: getError } = await supabase
          .from('generated_files')
          .select('download_count')
          .eq('tailoring_session_id', session.id)
          .eq('file_type', fileType)
          .single();

        if (getError) {
          console.error('[DB] ❌ Error getting current download count:', getError.message);
          return 0;
        }

        const newCount = (currentFile?.download_count || 0) + 1;
        
        const { error: updateError } = await supabase
          .from('generated_files')
          .update({ download_count: newCount })
          .eq('tailoring_session_id', session.id)
          .eq('file_type', fileType);

        if (updateError) {
          console.error('[DB] ❌ Error updating download count:', updateError.message);
          return 0;
        }

        return newCount;
      }

      return data || 1; // Return the new count from RPC or fallback to 1
    } catch (error) {
      console.error('[DB] ❌ Error incrementing download count:', error);
      return 0;
    }
  }

  /**
   * Analytics and Metrics
   */
  async recordSystemMetric(metricName, metricValue, metricUnit, additionalData = {}) {
    try {
      const supabase = this.db.getSupabaseClient();
      const { error } = await supabase
        .from('system_metrics')
        .insert([{
          metric_name: metricName,
          metric_value: metricValue,
          metric_unit: metricUnit,
          additional_data: JSON.stringify(additionalData),
          recorded_at: new Date().toISOString()
        }]);

      if (error) {
        console.error('[DB] ❌ Error recording metric:', error.message);
      }
    } catch (error) {
      console.error('[DB] ❌ Error recording metric:', error);
    }
  }

  async getUserDashboard(userId) {
    try {
      const supabase = this.db.getSupabaseClient();
      const { data: dashboard, error } = await supabase
        .from('user_dashboard')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw new Error(`Failed to fetch user dashboard: ${error.message}`);
      }

      return dashboard || null;
    } catch (error) {
      console.error('[DB] ❌ Error fetching user dashboard:', error);
      throw error;
    }
  }

  async getRecentSessions(limit = 10) {
    try {
      const supabase = this.db.getSupabaseClient();
      const { data: sessions, error } = await supabase
        .from('recent_sessions')
        .select('*')
        .limit(limit);

      if (error) {
        throw new Error(`Failed to fetch recent sessions: ${error.message}`);
      }

      return sessions || [];
    } catch (error) {
      console.error('[DB] ❌ Error fetching recent sessions:', error);
      throw error;
    }
  }

  async getUserRecentSessions(userId, limit = 10) {
    try {
      const supabase = this.db.getSupabaseClient();
      const { data, error } = await supabase
        .from('tailoring_sessions')
        .select(`
          *,
          job_descriptions(title, company, original_text)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error(`Failed to fetch user recent sessions: ${error.message}`);
      }

      // Flatten the response to match the original format
      const flattenedData = (data || []).map(session => ({
        ...session,
        // Prioritize manual company/job title over job description extraction
        job_title: session.manual_job_title || session.job_descriptions?.title || 'Job Posting',
        company: session.manual_company_name || session.job_descriptions?.company || 'Unknown Company',
        original_job_description: session.job_descriptions?.original_text
      }));

      return flattenedData;
    } catch (error) {
      console.error('[DB] ❌ Error fetching user recent sessions:', error);
      throw error;
    }
  }

  async getKeywordAnalytics(limit = 50) {
    try {
      const supabase = this.db.getSupabaseClient();
      const { data: analytics, error } = await supabase
        .from('keyword_analytics')
        .select('*')
        .limit(limit);

      if (error) {
        throw new Error(`Failed to fetch keyword analytics: ${error.message}`);
      }

      return analytics || [];
    } catch (error) {
      console.error('[DB] ❌ Error fetching keyword analytics:', error);
      throw error;
    }
  }

  async getUserKeywordAnalytics(userId, limit = 50) {
    try {
      const supabase = this.db.getSupabaseClient();
      const { data, error } = await supabase
        .from('extracted_keywords')
        .select(`
          keyword, 
          keyword_type, 
          confidence_score,
          frequency_in_jd,
          tailoring_sessions!inner(user_id)
        `)
        .eq('tailoring_sessions.user_id', userId)
        .order('frequency_in_jd', { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error(`Failed to fetch user keyword analytics: ${error.message}`);
      }

      // Group by keyword and aggregate data
      const keywordMap = {};
      (data || []).forEach(row => {
        const keyword = row.keyword;
        if (!keywordMap[keyword]) {
          keywordMap[keyword] = {
            keyword: keyword,
            keyword_type: row.keyword_type,
            total_frequency: 0,
            avg_confidence: 0,
            usage_count: 0,
            confidence_scores: []
          };
        }
        
        keywordMap[keyword].total_frequency += row.frequency_in_jd || 0;
        keywordMap[keyword].confidence_scores.push(row.confidence_score || 0);
        keywordMap[keyword].usage_count += 1;
      });

      // Calculate averages and convert to array
      const keywords = Object.values(keywordMap).map(kw => ({
        ...kw,
        avg_confidence: kw.confidence_scores.length > 0 
          ? kw.confidence_scores.reduce((a, b) => a + b, 0) / kw.confidence_scores.length 
          : 0
      })).sort((a, b) => b.total_frequency - a.total_frequency);

      return keywords;
    } catch (error) {
      console.error('[DB] ❌ Error fetching user keyword analytics:', error);
      throw error;
    }
  }

  /**
   * Cleanup expired files (both database records and physical files)
   */
  async cleanupExpiredFiles() {
    try {
      const supabase = this.db.getSupabaseClient();
      const fs = require('fs-extra');
      const path = require('path');
      const currentDate = new Date().toISOString();
      
      // First, get the expired files
      const { data: expiredFiles, error: selectError } = await supabase
        .from('generated_files')
        .select('*')
        .lt('expires_at', currentDate);

      if (selectError) {
        throw new Error(`Failed to fetch expired files: ${selectError.message}`);
      }

      let deletedPhysicalFiles = 0;
      
      // Delete physical files first
      if (expiredFiles && expiredFiles.length > 0) {
        console.log('[DB] 🗑️ Cleaning up', expiredFiles.length, 'expired files...');
        
        for (const file of expiredFiles) {
          if (file.file_path) {
            try {
              let fullPath = file.file_path;
              
              // Handle relative paths
              if (!path.isAbsolute(file.file_path)) {
                if (file.file_path.startsWith('./')) {
                  fullPath = path.join(process.cwd(), file.file_path.substring(2));
                } else if (file.file_path.startsWith('/output/') || file.file_path.startsWith('output/')) {
                  fullPath = path.join(process.cwd(), file.file_path.replace(/^\//, ''));
                }
              }
              
              if (await fs.pathExists(fullPath)) {
                await fs.remove(fullPath);
                deletedPhysicalFiles++;
                console.log('[DB] 🗑️ Deleted expired file:', fullPath);
              }
            } catch (fileError) {
              console.warn('[DB] ⚠️ Failed to delete expired file:', file.file_path, fileError.message);
            }
          }
        }
        
        // Delete the database records
        const { error: deleteError } = await supabase
          .from('generated_files')
          .delete()
          .lt('expires_at', currentDate);

        if (deleteError) {
          throw new Error(`Failed to delete expired file records: ${deleteError.message}`);
        }

        console.log('[DB] ✅ Cleaned up', expiredFiles.length, 'expired file records and', deletedPhysicalFiles, 'physical files');
      }

      return {
        expiredFiles: expiredFiles || [],
        deletedRecords: expiredFiles?.length || 0,
        deletedPhysicalFiles
      };
    } catch (error) {
      console.error('[DB] ❌ Error cleaning up expired files:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive user analytics
   */
  async getUserAnalytics(userId, startDate) {
    try {
      const supabase = this.db.getSupabaseClient();
      
      // Get session analytics
      const { data: sessions, error: sessionError } = await supabase
        .from('tailoring_sessions')
        .select(`
          *,
          job_descriptions(title, company, original_text)
        `)
        .eq('user_id', userId)
        .gte('created_at', startDate)
        .order('created_at', { ascending: false });

      if (sessionError) {
        throw new Error(`Failed to fetch session analytics: ${sessionError.message}`);
      }

      // Get credit transactions
      const { data: transactions, error: transactionError } = await supabase
        .from('credit_transactions')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', startDate)
        .order('created_at', { ascending: false });

      if (transactionError) {
        throw new Error(`Failed to fetch transaction analytics: ${transactionError.message}`);
      }

      // Calculate analytics
      const analytics = {
        totalSessions: sessions?.length || 0,
        successfulSessions: sessions?.filter(s => s.latex_compilation_success).length || 0,
        failedSessions: sessions?.filter(s => !s.latex_compilation_success).length || 0,
        totalCreditsUsed: Math.abs(transactions?.filter(t => t.transaction_type === 'used').reduce((sum, t) => sum + t.amount, 0)) || 0,
        totalCreditsGranted: transactions?.filter(t => t.transaction_type === 'granted').reduce((sum, t) => sum + t.amount, 0) || 0,
        averageProcessingTime: sessions?.length ? sessions.reduce((sum, s) => sum + (s.processing_time_ms || 0), 0) / sessions.length : 0,
        averageContentLength: sessions?.length ? sessions.reduce((sum, s) => sum + (s.tailored_content_length || 0), 0) / sessions.length : 0,
        topCompanies: this.getTopCompanies(sessions),
        dailyUsage: this.getDailyUsage(sessions),
        successRate: sessions?.length ? (sessions.filter(s => s.latex_compilation_success).length / sessions.length) * 100 : 0
      };

      return analytics;
    } catch (error) {
      console.error('[DB] ❌ Error getting user analytics:', error);
      throw error;
    }
  }

  /**
   * Get user usage analytics over time
   */
  async getUserUsageAnalytics(userId, period, days) {
    try {
      const supabase = this.db.getSupabaseClient();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data: sessions, error } = await supabase
        .from('tailoring_sessions')
        .select('created_at, latex_compilation_success, processing_time_ms, tailored_content_length')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch usage analytics: ${error.message}`);
      }

      // Group by period
      const groupedData = this.groupDataByPeriod(sessions || [], period);
      
      return {
        chartData: groupedData,
        totalSessions: sessions?.length || 0,
        averagePerDay: sessions?.length ? (sessions.length / days).toFixed(1) : 0
      };
    } catch (error) {
      console.error('[DB] ❌ Error getting usage analytics:', error);
      throw error;
    }
  }

  /**
   * Helper: Get top companies from sessions
   */
  getTopCompanies(sessions) {
    if (!sessions || sessions.length === 0) {
      console.log('[DB] 📊 No sessions provided for company analysis');
      return [];
    }
    
    console.log('[DB] 📊 Analyzing companies from', sessions.length, 'sessions');
    
    const companyCount = {};
    const unknownCount = { count: 0, sessions: [] };
    
    sessions.forEach(session => {
      // Prioritize manual company name over job description extraction
      const company = session.manual_company_name || session.job_descriptions?.company || 'Unknown Company';
      
      if (company === 'Unknown Company' || !company || company.trim() === '') {
        unknownCount.count++;
        unknownCount.sessions.push(session.session_id || session.id);
      } else {
        companyCount[company] = (companyCount[company] || 0) + 1;
      }
    });

    // Log debugging information
    console.log('[DB] 📊 Company extraction results:');
    console.log('[DB] - Companies with names:', Object.keys(companyCount).length);
    console.log('[DB] - Sessions with unknown companies:', unknownCount.count);
    
    if (Object.keys(companyCount).length > 0) {
      console.log('[DB] - Company breakdown:', companyCount);
    }
    
    if (unknownCount.count > 0) {
      console.log('[DB] - Sample sessions with unknown companies:', unknownCount.sessions.slice(0, 3));
    }

    const result = Object.entries(companyCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([company, count]) => ({ company, count }));

    // If we have no named companies but have unknown ones, include a placeholder
    if (result.length === 0 && unknownCount.count > 0) {
      result.push({ 
        company: 'Companies with unextracted names', 
        count: unknownCount.count,
        isPlaceholder: true 
      });
    }

    console.log('[DB] 📊 Final top companies result:', result.length, 'entries');
    return result;
  }

  /**
   * Helper: Get daily usage from sessions
   */
  getDailyUsage(sessions) {
    if (!sessions || sessions.length === 0) return [];
    
    const dailyCount = {};
    sessions.forEach(session => {
      const date = new Date(session.created_at).toDateString();
      dailyCount[date] = (dailyCount[date] || 0) + 1;
    });

    return Object.entries(dailyCount)
      .sort(([a], [b]) => new Date(a) - new Date(b))
      .map(([date, count]) => ({ date, count }));
  }

  /**
   * Helper: Group data by time period
   */
  groupDataByPeriod(data, period) {
    const grouped = {};
    
    data.forEach(item => {
      const date = new Date(item.created_at);
      let key;
      
      if (period === 'hourly') {
        key = `${date.toDateString()} ${date.getHours()}:00`;
      } else if (period === 'daily') {
        key = date.toDateString();
      } else if (period === 'weekly') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toDateString();
      } else {
        key = `${date.getFullYear()}-${date.getMonth() + 1}`;
      }
      
      if (!grouped[key]) {
        grouped[key] = {
          period: key,
          sessions: 0,
          successful: 0,
          failed: 0,
          avgProcessingTime: 0,
          totalProcessingTime: 0
        };
      }
      
      grouped[key].sessions++;
      if (item.latex_compilation_success) {
        grouped[key].successful++;
      } else {
        grouped[key].failed++;
      }
      grouped[key].totalProcessingTime += item.processing_time_ms || 0;
      grouped[key].avgProcessingTime = grouped[key].totalProcessingTime / grouped[key].sessions;
    });

    return Object.values(grouped).sort((a, b) => new Date(a.period) - new Date(b.period));
  }

  /**
   * Cleanup orphaned files (files on disk without database records)
   */
  async cleanupOrphanedFiles() {
    try {
      const fs = require('fs-extra');
      const path = require('path');
      const supabase = this.db.getSupabaseClient();
      
      const outputDir = path.join(process.cwd(), 'output');
      
      if (!await fs.pathExists(outputDir)) {
        console.log('[DB] Output directory does not exist, nothing to clean up');
        return { deletedFiles: 0 };
      }
      
      // Get all files in output directory
      const files = await fs.readdir(outputDir);
      const resumeFiles = files.filter(file => file.startsWith('resume_') && (file.endsWith('.tex') || file.endsWith('.pdf')));
      
      if (resumeFiles.length === 0) {
        console.log('[DB] No resume files found in output directory');
        return { deletedFiles: 0 };
      }
      
      console.log('[DB] 🔍 Checking', resumeFiles.length, 'resume files for orphans...');
      
      let deletedFiles = 0;
      
      for (const file of resumeFiles) {
        try {
          // Extract session ID from filename (resume_SESSIONID.ext)
          const match = file.match(/^resume_([^.]+)\.(tex|pdf)$/);
          if (!match) continue;
          
          const sessionId = match[1];
          const fileExt = match[2];
          
          // Check if session exists in database
          const { data: session, error } = await supabase
            .from('tailoring_sessions')
            .select('id')
            .eq('session_id', sessionId)
            .single();
          
          if (error && error.code === 'PGRST116') {
            // Session doesn't exist, this is an orphaned file
            const filePath = path.join(outputDir, file);
            await fs.remove(filePath);
            deletedFiles++;
            console.log('[DB] 🗑️ Deleted orphaned file:', file);
          }
        } catch (fileError) {
          console.warn('[DB] ⚠️ Error checking file:', file, fileError.message);
        }
      }
      
      console.log('[DB] ✅ Cleaned up', deletedFiles, 'orphaned files');
      
      return { deletedFiles };
    } catch (error) {
      console.error('[DB] ❌ Error cleaning up orphaned files:', error);
      return { deletedFiles: 0 };
    }
  }

  /**
   * Delete a tailoring session and all related data
   */
  async deleteTailoringSession(sessionId, userId) {
    try {
      const supabase = this.db.getSupabaseClient();
      const fs = require('fs-extra');
      const path = require('path');
      
      // First verify the session exists and belongs to the user
      const { data: session, error: fetchError } = await supabase
        .from('tailoring_sessions')
        .select('id, user_id, tex_file_path, pdf_file_path')
        .eq('session_id', sessionId)
        .eq('user_id', userId)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          return { success: false, error: 'Session not found or access denied' };
        }
        throw new Error(`Failed to fetch session: ${fetchError.message}`);
      }

      const dbSessionId = session.id;
      
      // Get list of files to delete from generated_files table
      const { data: filesToDelete, error: filesError } = await supabase
        .from('generated_files')
        .select('file_path, file_type')
        .eq('tailoring_session_id', dbSessionId);
      
      if (filesError) {
        console.warn('[DB] ⚠️ Error fetching files to delete:', filesError.message);
      }

      // Clean up physical files first
      const filesToCleanup = [];
      
      // Add files from generated_files table
      if (filesToDelete && filesToDelete.length > 0) {
        filesToDelete.forEach(file => {
          if (file.file_path) {
            filesToCleanup.push(file.file_path);
          }
        });
      }
      
      // Add session-specific files (legacy paths)
      if (session.tex_file_path) {
        filesToCleanup.push(session.tex_file_path);
      }
      if (session.pdf_file_path) {
        filesToCleanup.push(session.pdf_file_path);
      }
      
      // Also try standard paths
      const outputDir = path.join(process.cwd(), 'output');
      filesToCleanup.push(
        path.join(outputDir, `resume_${sessionId}.tex`),
        path.join(outputDir, `resume_${sessionId}.pdf`),
        path.join(outputDir, `resume_${sessionId}.log`),
        path.join(outputDir, `resume_${sessionId}.aux`)
      );
      
      // Delete physical files
      let deletedFiles = 0;
      for (const filePath of filesToCleanup) {
        try {
          let fullPath = filePath;
          // Handle relative paths
          if (!path.isAbsolute(filePath)) {
            if (filePath.startsWith('./')) {
              fullPath = path.join(process.cwd(), filePath.substring(2));
            } else if (filePath.startsWith('/output/') || filePath.startsWith('output/')) {
              fullPath = path.join(process.cwd(), filePath.replace(/^\//, ''));
            }
          }
          
          if (await fs.pathExists(fullPath)) {
            await fs.remove(fullPath);
            deletedFiles++;
            console.log('[DB] 🗑️ Deleted file:', fullPath);
          }
        } catch (fileError) {
          console.warn('[DB] ⚠️ Failed to delete file:', filePath, fileError.message);
        }
      }
      
      console.log('[DB] 🗑️ Deleted', deletedFiles, 'physical files');

      // Delete related data in order (due to foreign key constraints)
      // 1. Delete resume modifications
      await supabase
        .from('resume_modifications')
        .delete()
        .eq('tailoring_session_id', dbSessionId);

      // 2. Delete extracted keywords
      await supabase
        .from('extracted_keywords')
        .delete()
        .eq('tailoring_session_id', dbSessionId);

      // 3. Delete generated files
      await supabase
        .from('generated_files')
        .delete()
        .eq('tailoring_session_id', dbSessionId);

      // 4. Delete credit transactions (optional - may want to keep for audit)
      await supabase
        .from('credit_transactions')
        .delete()
        .eq('tailoring_session_id', dbSessionId);

      // 5. Finally delete the session itself
      const { error: deleteError } = await supabase
        .from('tailoring_sessions')
        .delete()
        .eq('id', dbSessionId);

      if (deleteError) {
        throw new Error(`Failed to delete session: ${deleteError.message}`);
      }

      console.log('[DB] ✅ Tailoring session and related data deleted:', sessionId);
      
      return { success: true };
    } catch (error) {
      console.error('[DB] ❌ Error deleting tailoring session:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete all tailoring sessions for a user
   */
  async deleteAllUserSessions(userId) {
    try {
      const supabase = this.db.getSupabaseClient();
      const fs = require('fs-extra');
      const path = require('path');
      
      // Get all session IDs and file paths for the user
      const { data: sessions, error: fetchError } = await supabase
        .from('tailoring_sessions')
        .select('id, session_id, tex_file_path, pdf_file_path')
        .eq('user_id', userId);

      if (fetchError) {
        throw new Error(`Failed to fetch user sessions: ${fetchError.message}`);
      }

      if (!sessions || sessions.length === 0) {
        return { success: true, deletedCount: 0 };
      }

      const sessionIds = sessions.map(s => s.id);
      const sessionNames = sessions.map(s => s.session_id);
      console.log('[DB] 🗑️ Deleting all data for sessions:', sessionIds.length);
      
      // Get all files to delete from generated_files table
      const { data: filesToDelete, error: filesError } = await supabase
        .from('generated_files')
        .select('file_path, file_type')
        .in('tailoring_session_id', sessionIds);
      
      if (filesError) {
        console.warn('[DB] ⚠️ Error fetching files to delete:', filesError.message);
      }
      
      // Clean up physical files first
      const filesToCleanup = [];
      
      // Add files from generated_files table
      if (filesToDelete && filesToDelete.length > 0) {
        filesToDelete.forEach(file => {
          if (file.file_path) {
            filesToCleanup.push(file.file_path);
          }
        });
      }
      
      // Add session-specific files (legacy paths)
      sessions.forEach(session => {
        if (session.tex_file_path) {
          filesToCleanup.push(session.tex_file_path);
        }
        if (session.pdf_file_path) {
          filesToCleanup.push(session.pdf_file_path);
        }
        
        // Also try standard paths for each session
        const outputDir = path.join(process.cwd(), 'output');
        filesToCleanup.push(
          path.join(outputDir, `resume_${session.session_id}.tex`),
          path.join(outputDir, `resume_${session.session_id}.pdf`),
          path.join(outputDir, `resume_${session.session_id}.log`),
          path.join(outputDir, `resume_${session.session_id}.aux`)
        );
      });
      
      // Delete physical files
      let deletedFiles = 0;
      for (const filePath of filesToCleanup) {
        try {
          let fullPath = filePath;
          // Handle relative paths
          if (!path.isAbsolute(filePath)) {
            if (filePath.startsWith('./')) {
              fullPath = path.join(process.cwd(), filePath.substring(2));
            } else if (filePath.startsWith('/output/') || filePath.startsWith('output/')) {
              fullPath = path.join(process.cwd(), filePath.replace(/^\//, ''));
            }
          }
          
          if (await fs.pathExists(fullPath)) {
            await fs.remove(fullPath);
            deletedFiles++;
          }
        } catch (fileError) {
          console.warn('[DB] ⚠️ Failed to delete file:', filePath, fileError.message);
        }
      }
      
      console.log('[DB] 🗑️ Deleted', deletedFiles, 'physical files for', sessions.length, 'sessions');

      // Delete related data in batches
      const deletePromises = [
        // Delete resume modifications
        supabase
          .from('resume_modifications')
          .delete()
          .in('tailoring_session_id', sessionIds),
        
        // Delete extracted keywords
        supabase
          .from('extracted_keywords')
          .delete()
          .in('tailoring_session_id', sessionIds),
        
        // Delete generated files
        supabase
          .from('generated_files')
          .delete()
          .in('tailoring_session_id', sessionIds),
        
        // Delete credit transactions (optional)
        supabase
          .from('credit_transactions')
          .delete()
          .in('tailoring_session_id', sessionIds)
      ];

      await Promise.all(deletePromises);

      // Finally delete all sessions
      const { error: deleteError } = await supabase
        .from('tailoring_sessions')
        .delete()
        .eq('user_id', userId);

      if (deleteError) {
        throw new Error(`Failed to delete sessions: ${deleteError.message}`);
      }

      console.log('[DB] ✅ All user sessions and related data deleted. Count:', sessions.length);
      
      return { success: true, deletedCount: sessions.length };
    } catch (error) {
      console.error('[DB] ❌ Error deleting all user sessions:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new DatabaseService(); 