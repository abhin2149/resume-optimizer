import React, { useMemo, useEffect, useRef, useState } from 'react';

const LaTeXResumeViewer = ({ originalContent, tailoredContent, showDiff = false, phraseReplacements = [] }) => {
  const [originalData, setOriginalData] = useState(null);
  const [tailoredData, setTailoredData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Parse LaTeX content into structured data
  const parseLatexResume = (content) => {
    if (!content || typeof content !== 'string') return null;

    // Extract content between \begin{document} and \end{document}
    const beginDoc = content.indexOf('\\begin{document}');
    const endDoc = content.lastIndexOf('\\end{document}');
    
    if (beginDoc === -1 || endDoc === -1) return null;
    
    const documentContent = content.substring(beginDoc + '\\begin{document}'.length, endDoc);
    
    // Parse header (name and contact info)
    const headerMatch = documentContent.match(/\\begin{center}([\s\S]*?)\\end{center}/);
    let header = null;
    if (headerMatch) {
      const headerContent = headerMatch[1].trim();
      const nameMatch = headerContent.match(/\\textbf\{\\Huge \\scshape ([^}]+)\}/);
      const contactLines = headerContent.split('\\\\').filter(line => line.trim() && !line.includes('textbf') && !line.includes('raggedright'));
      const contact = contactLines.length > 0 ? contactLines[0].replace(/\\small\s*/, '').trim() : '';
      
      // Look for description - handle \raggedright \vspace{5pt}{...} pattern
      const descMatch = headerContent.match(/\\raggedright[^{]*\{([^}]+)\}/) || 
                       headerContent.match(/\\raggedright\s+\\vspace\{[^}]+\}\s*\{([^}]+)\}/);
      
      header = {
        name: nameMatch ? nameMatch[1] : '',
        contact: cleanLatexText(contact),
        description: descMatch ? cleanLatexText(descMatch[1]) : ''
      };
    }

    // Parse sections
    const sections = [];
    const sectionMatches = [...documentContent.matchAll(/\\section\{([^}]+)\}([\s\S]*?)(?=\\section\{|$)/g)];
    
    sectionMatches.forEach(match => {
      const title = match[1];
      const content = match[2].trim();
      
      const section = {
        title,
        type: getSectionType(title),
        items: parseSectionContent(content, title)
      };
      
      sections.push(section);
    });

    return { header, sections };
  };

  // Determine section type for styling
  const getSectionType = (title) => {
    if (!title || typeof title !== 'string') return 'other';
    
    const titleLower = title.toLowerCase();
    if (titleLower.includes('education')) return 'education';
    if (titleLower.includes('experience') || titleLower.includes('work')) return 'experience';
    if (titleLower.includes('project')) return 'projects';
    if (titleLower.includes('skill')) return 'skills';
    return 'other';
  };

  // Parse section content based on type
  const parseSectionContent = (content, sectionTitle) => {
    const items = [];
    
    if (!content || typeof content !== 'string') return items;
    if (!sectionTitle || typeof sectionTitle !== 'string') return items;
    
    if (sectionTitle.toLowerCase().includes('skill')) {
      // Handle skills section - parse the itemize block
      const itemizeMatch = content.match(/\\begin\{itemize\}([\s\S]*?)\\end\{itemize\}/);
      if (itemizeMatch) {
        const itemContent = itemizeMatch[1];
        
        // Look for the pattern: \textbf{Category}{: content} \\ 
        const skillMatches = [...itemContent.matchAll(/\\textbf\{([^}]+)\}\s*\{:\s*([^}]+)\}\s*\\\\/g)];
        skillMatches.forEach(match => {
          items.push({
            type: 'skill',
            category: match[1],
            skills: match[2]
          });
        });
        
        // If no matches found with the above pattern, try a simpler approach
        if (skillMatches.length === 0) {
          // Look for lines that contain \textbf{...}{...}
          const lines = itemContent.split('\\\\');
          lines.forEach(line => {
            const simpleMatch = line.match(/\\textbf\{([^}]+)\}\s*\{:\s*([^}]+)\}/);
            if (simpleMatch) {
              items.push({
                type: 'skill',
                category: simpleMatch[1],
                skills: simpleMatch[2]
              });
            }
          });
        }
      }
    } else {
      // Handle other sections with resumeSubheading, resumeWorkHeading, etc.
      // First, let's extract the content between resumeSubHeadingListStart and resumeSubHeadingListEnd
      const listMatch = content.match(/\\resumeSubHeadingListStart([\s\S]*?)\\resumeSubHeadingListEnd/);
      const contentToParse = listMatch ? listMatch[1] : content;
      
      // Split by major heading patterns to identify separate items
      const itemSeparators = [
        /\\resumeSubheading/,
        /\\resumeProjectHeading/,
        /\\resumeSubSubheading/,
        /\\resumeWorkHeading/
      ];
      
      // Find all matches and their positions
      const matches = [];
      itemSeparators.forEach(separator => {
        const regex = new RegExp(separator.source, 'g');
        let match;
        while ((match = regex.exec(contentToParse)) !== null) {
          matches.push({
            index: match.index,
            type: separator.source.replace(/\\\\/g, '\\'),
            match: match
          });
        }
      });
      
      // Sort matches by position
      matches.sort((a, b) => a.index - b.index);
      
      // Parse each section
      for (let i = 0; i < matches.length; i++) {
        const currentMatch = matches[i];
        const nextMatch = matches[i + 1];
        const sectionEnd = nextMatch ? nextMatch.index : contentToParse.length;
        const sectionContent = contentToParse.substring(currentMatch.index, sectionEnd);
        
        const parsedItem = parseIndividualItem(sectionContent, sectionTitle);
        if (parsedItem) {
          items.push(parsedItem);
        }
      }
    }
    
    return items;
  };

  // Helper function to parse individual items
  const parseIndividualItem = (sectionContent, sectionTitle) => {
    // Check for resumeSubheading (education)
    const subheadingMatch = sectionContent.match(/\\resumeSubheading\s*\{([^}]+)\}\s*\{([^}]+)\}\s*\{([^}]+)\}\s*\{([^}]+)\}/);
    if (subheadingMatch) {
      const item = {
        type: 'education',
        institution: subheadingMatch[1],
        location: subheadingMatch[2],
        degree: subheadingMatch[3],
        date: subheadingMatch[4],
        details: []
      };
      
      // Look for textWithLine items (like GPA, coursework)
      const textWithLineMatches = [...sectionContent.matchAll(/\\textWithLine\{([^}]+)\}/g)];
      textWithLineMatches.forEach(match => {
        item.details.push(cleanLatexText(match[1]));
      });
      
      return item;
    }

    // Check for resumeProjectHeading
    const projectHeadingMatch = sectionContent.match(/\\resumeProjectHeading\s*\{([^}]+)\}\s*\{([^}]+)\}/);
    if (projectHeadingMatch) {
      const item = {
        type: 'project',
        title: projectHeadingMatch[1],
        date: projectHeadingMatch[2],
        details: []
      };
      
      // Look for resumeItem items within resumeItemListStart/End
      // Use a more flexible approach to find the next resumeItemListStart after this project heading
      const projectStartIndex = sectionContent.indexOf('\\resumeProjectHeading');
      const remainingContent = sectionContent.substring(projectStartIndex);
      
      const itemListMatch = remainingContent.match(/\\resumeItemListStart([\s\S]*?)\\resumeItemListEnd/);
      if (itemListMatch) {
        const itemContent = itemListMatch[1];
        const itemMatches = [...itemContent.matchAll(/\\resumeItem\{([^}]+)\}/g)];
        itemMatches.forEach(match => {
          item.details.push(cleanLatexText(match[1]));
        });
      }
      
      return item;
    }

    // Check for resumeSubSubheading (work position)
    const subSubheadingMatch = sectionContent.match(/\\resumeSubSubheading\{([^}]+)\}\{([^}]+)\}/);
    if (subSubheadingMatch) {
      const item = {
        type: 'work',
        position: subSubheadingMatch[1],
        date: subSubheadingMatch[2],
        company: '',
        location: '',
        details: []
      };
      
      // Look for following resumeWorkHeading
      const workHeadingMatch = sectionContent.match(/\\resumeWorkHeading\s*\{([^}]+)\}\s*\{([^}]+)\}\s*\{([^}]+)\}\s*\{([^}]+)\}/);
      if (workHeadingMatch) {
        item.position = workHeadingMatch[1];
        item.date = workHeadingMatch[2];
        item.company = workHeadingMatch[3];
        item.location = workHeadingMatch[4];
      }
      
      // Look for resumeItem items
      const itemListMatch = sectionContent.match(/\\resumeItemListStart([\s\S]*?)\\resumeItemListEnd/);
      if (itemListMatch) {
        const itemContent = itemListMatch[1];
        const itemMatches = [...itemContent.matchAll(/\\resumeItem\{([^}]+)\}/g)];
        itemMatches.forEach(match => {
          item.details.push(cleanLatexText(match[1]));
        });
      }
      
      return item;
    }

    // Check for standalone resumeWorkHeading
    const workHeadingMatch = sectionContent.match(/\\resumeWorkHeading\s*\{([^}]+)\}\s*\{([^}]+)\}\s*\{([^}]+)\}\s*\{([^}]+)\}/);
    if (workHeadingMatch) {
      const item = {
        type: 'work',
        position: workHeadingMatch[1],
        date: workHeadingMatch[2],
        company: workHeadingMatch[3],
        location: workHeadingMatch[4],
        details: []
      };
      
      // Look for resumeItem items
      const itemListMatch = sectionContent.match(/\\resumeItemListStart([\s\S]*?)\\resumeItemListEnd/);
      if (itemListMatch) {
        const itemContent = itemListMatch[1];
        const itemMatches = [...itemContent.matchAll(/\\resumeItem\{([^}]+)\}/g)];
        itemMatches.forEach(match => {
          item.details.push(cleanLatexText(match[1]));
        });
      }
      
      return item;
    }

    return null;
  };



  // Clean LaTeX formatting from text and apply highlighting
  const cleanLatexText = (text) => {
    if (!text) return '';
    
    const cleanedText = text
      .replace(/\\textbf\{([^}]+)\}/g, '<strong>$1</strong>')
      .replace(/\\emph\{([^}]+)\}/g, '<em>$1</em>')
      .replace(/\\href\{([^}]+)\}\{([^}]+)\}/g, '<a href="$1" target="_blank" class="text-blue-600 hover:underline">$2</a>')
      .replace(/\\\$/g, '$')
      .replace(/\\\|/g, '|')
      .replace(/~/g, ' ')
      .trim();
    
    // Apply text improvement highlighting if in diff mode
    return highlightTextImprovements(cleanedText);
  };

  // Highlight text improvements in content
  const highlightTextImprovements = (text) => {
    if (!showDiff || !phraseReplacements || phraseReplacements.length === 0) {
      return text;
    }

    let highlightedText = text;
    
    phraseReplacements.forEach(replacement => {
      // Create case-insensitive regex for the replacement
      const fromRegex = new RegExp(`\\b${replacement.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      
      // Replace with highlighted version
      highlightedText = highlightedText.replace(fromRegex, 
        `<span class="bg-blue-200 border-b-2 border-blue-500 px-1 rounded font-medium text-blue-900" title="Improved: ${replacement.from} → ${replacement.to}">${replacement.to}</span>`
      );
    });

    return highlightedText;
  };

  // Process content when it changes
  useEffect(() => {
    const processContent = async () => {
      setLoading(true);
      setError(null);
      
      try {
        if (originalContent) {
          const originalParsed = parseLatexResume(originalContent);
          setOriginalData(originalParsed);
        }
        
        if (tailoredContent) {
          const tailoredParsed = parseLatexResume(tailoredContent);
          setTailoredData(tailoredParsed);
        }
      } catch (err) {
        console.error('Error processing LaTeX:', err);
        setError('Failed to process LaTeX content');
      } finally {
        setLoading(false);
      }
    };

    processContent();
  }, [originalContent, tailoredContent]);

  // Render resume header
  const renderHeader = (header) => {
    if (!header) return null;
    
    return (
      <div className="text-center mb-8 pb-6 border-b border-gray-200">
        <h1 className="text-4xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'serif' }}>
          {header.name}
        </h1>
        {header.contact && (
          <div className="text-sm text-gray-600 mb-3" dangerouslySetInnerHTML={{ __html: cleanLatexText(header.contact) }} />
        )}
        {header.description && (
          <div className="text-sm text-gray-700 max-w-4xl mx-auto leading-relaxed" dangerouslySetInnerHTML={{ __html: cleanLatexText(header.description) }} />
        )}
      </div>
    );
  };

  // Render individual resume item
  const renderResumeItem = (item, index) => {
    if (item.type === 'education') {
      return (
        <div key={`${item.institution}-${item.degree}-${index}`} className="mb-6">
          <div className="flex justify-between items-start mb-2">
            <div className="flex-1">
              <h4 className="text-lg font-semibold text-gray-900" dangerouslySetInnerHTML={{ __html: highlightTextImprovements(item.institution) }} />
              <p className="text-gray-700 italic" dangerouslySetInnerHTML={{ __html: highlightTextImprovements(item.degree) }} />
            </div>
            <div className="text-right text-gray-600 text-sm">
              <div dangerouslySetInnerHTML={{ __html: highlightTextImprovements(item.location) }} />
              <div dangerouslySetInnerHTML={{ __html: highlightTextImprovements(item.date) }} />
            </div>
          </div>
          {item.details && item.details.length > 0 && (
            <div className="ml-6 mt-2 space-y-1">
              {item.details.map((detail, idx) => (
                <div key={idx} className="text-gray-700 text-sm" dangerouslySetInnerHTML={{ __html: detail }} />
              ))}
            </div>
          )}
        </div>
      );
    }

    if (item.type === 'work') {
      return (
        <div key={`${item.company}-${item.position}-${index}`} className="mb-6">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-gray-600 text-sm" dangerouslySetInnerHTML={{ __html: highlightTextImprovements(item.position) }} />
              <h4 className="text-lg font-semibold text-gray-900" dangerouslySetInnerHTML={{ __html: highlightTextImprovements(item.company) }} />
            </div>
            <div className="text-right text-gray-600 text-sm">
              <div dangerouslySetInnerHTML={{ __html: highlightTextImprovements(item.date) }} />
              <div dangerouslySetInnerHTML={{ __html: highlightTextImprovements(item.location) }} />
            </div>
          </div>
          {item.details && item.details.length > 0 && (
            <ul className="list-disc ml-6 mt-3 space-y-1">
              {item.details.map((detail, idx) => (
                <li key={idx} className="text-gray-700 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: detail }} />
              ))}
            </ul>
          )}
        </div>
      );
    }

    if (item.type === 'project') {
      return (
        <div key={`${item.title}-${item.date}-${index}`} className="mb-6">
          <div className="flex justify-between items-start mb-2">
            <div className="flex-1">
              <h4 className="text-lg font-medium text-gray-900" dangerouslySetInnerHTML={{ __html: highlightTextImprovements(item.title) }} />
            </div>
            <div className="text-gray-600 text-sm" dangerouslySetInnerHTML={{ __html: highlightTextImprovements(item.date) }} />
          </div>
          {item.details && item.details.length > 0 && (
            <ul className="list-disc ml-6 mt-3 space-y-1">
              {item.details.map((detail, idx) => (
                <li key={idx} className="text-gray-700 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: detail }} />
              ))}
            </ul>
          )}
        </div>
      );
    }

    if (item.type === 'skill') {
      return (
        <div key={`${item.category}-${index}`} className="mb-3">
          <span className="font-semibold text-gray-900" dangerouslySetInnerHTML={{ __html: highlightTextImprovements(item.category) }} />:
          <span className="ml-2 text-gray-700" dangerouslySetInnerHTML={{ __html: cleanLatexText(item.skills) }} />
        </div>
      );
    }

    return null;
  };

  // Render section
  const renderSection = (section, index) => {
    return (
      <div key={section.title} className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 pb-2 mb-6 border-b-2 border-gray-300" style={{ fontFamily: 'serif' }}>
          <span dangerouslySetInnerHTML={{ __html: highlightTextImprovements(section.title) }} />
        </h2>
        <div className="space-y-4">
          {section.items.map((item, idx) => 
            renderResumeItem(item, idx)
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="animate-spin text-blue-500 mb-2">⟳</div>
          <p className="text-gray-500">Processing LaTeX content...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 bg-red-50 rounded-lg">
        <div className="text-center">
          <div className="text-red-400 mb-2">⚠</div>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  // Determine which data to display
  const dataToRender = tailoredData || originalData;
  
  if (!dataToRender) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="text-gray-400 mb-2">📄</div>
          <p className="text-gray-500">No resume content available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg" style={{ minHeight: '800px' }}>
      {/* Resume Content */}
      <div className="p-8 max-w-4xl mx-auto bg-white" style={{ 
        fontSize: '14px', 
        lineHeight: '1.6',
        fontFamily: 'Georgia, "Times New Roman", Times, serif',
        color: '#1f2937'
      }}>
        {/* Header Section */}
        {renderHeader(dataToRender.header)}

        {/* Sections */}
        <div className="space-y-8">
          {dataToRender.sections.map((section, index) => 
            renderSection(section, index)
          )}
        </div>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-gray-200 text-center text-gray-500 text-xs">
          {showDiff && phraseReplacements && phraseReplacements.length > 0 ? 
            `Resume with ${phraseReplacements.length} text improvement${phraseReplacements.length > 1 ? 's' : ''} highlighted` :
            'Resume rendered with professional LaTeX styling'
          }
        </div>
      </div>
    </div>
  );
};

export default LaTeXResumeViewer; 