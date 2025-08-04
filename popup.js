document.addEventListener('DOMContentLoaded', function() {
  const summarizeBtn = document.getElementById('summarizeBtn');
  const exportPdfBtn = document.getElementById('exportPdfBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const loading = document.getElementById('loading');
  const summaryDiv = document.getElementById('summary');
  const errorDiv = document.getElementById('error');
  const wordCountDiv = document.getElementById('wordCount');
  const summaryLengthSelect = document.getElementById('summaryLength');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  
  // Variables to store current page and summary data for PDF export
  let currentPageTitle = '';
  let currentPageUrl = '';
  
  // Check OpenAI status on load
  checkOpenAIStatus();
  
  // Load saved settings
  chrome.storage.sync.get(['summaryLength'], function(result) {
    if (result.summaryLength) {
      summaryLengthSelect.value = result.summaryLength;
    }
  });
  
  // Save settings when changed
  summaryLengthSelect.addEventListener('change', function() {
    chrome.storage.sync.set({
      summaryLength: summaryLengthSelect.value
    });
  });
  
  // Export summary as PDF when the export button is clicked
  exportPdfBtn.addEventListener('click', function() {
    if (!summaryDiv.style.display || summaryDiv.style.display === 'none') {
      return; // No summary to export
    }
    
    exportPdfBtn.disabled = true;
    exportPdfBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14h2v-4h3l-4-4-4 4h3v4z" fill="currentColor"/>
      </svg>
      Exporting...
    `;
    
    exportSummaryAsPdf();
  });
  
  // Open settings page when settings button is clicked
  settingsBtn.addEventListener('click', function() {
    chrome.runtime.openOptionsPage();
  });
  
  summarizeBtn.addEventListener('click', async function() {
    try {
      // Hide previous results
      summaryDiv.style.display = 'none';
      errorDiv.style.display = 'none';
      wordCountDiv.style.display = 'none';
      
      // Disable export button while summarizing
      exportPdfBtn.disabled = true;
      
      // Show loading
      loading.style.display = 'block';
      summarizeBtn.disabled = true;
      summarizeBtn.textContent = 'Summarizing...';
      
      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Get page title for context and store for PDF export
      currentPageTitle = tab.title;
      currentPageUrl = tab.url;
      
      // Request page content directly from the background script
      // This avoids running any DOM manipulation in the page context
      const response = await chrome.runtime.sendMessage({
        action: 'getPageContent',
        tabId: tab.id,
        url: tab.url
      });
      
      if (!response || !response.content) {
        throw new Error('Could not extract content from this page');
      }
      
      const pageContent = response.content;
      
      if (!pageContent || pageContent.trim().length < 100) {
        throw new Error('Not enough content found on this page to summarize.');
      }
      
      // Get summary length preference
      const summaryLength = summaryLengthSelect.value;
      
      // Generate summary using a local summarization approach
      const result = await generateSummary(pageContent, summaryLength);
      
      // Display results
      loading.style.display = 'none';
      summaryDiv.style.display = 'block';
      
      // Create summary header with method indicator
      const summaryHeaderDiv = document.createElement('div');
      summaryHeaderDiv.className = 'summary-header';
      
      // Method indicator
      const methodSpan = document.createElement('span');
      methodSpan.className = 'summary-method';
      methodSpan.textContent = result.method;
      summaryHeaderDiv.appendChild(methodSpan);
      
      // Create content div for the actual summary
      const contentDiv = document.createElement('div');
      contentDiv.className = 'summary-content';
      contentDiv.innerHTML = result.summary;
      
      // Clear previous content and append new elements
      summaryDiv.innerHTML = '';
      summaryDiv.appendChild(summaryHeaderDiv);
      summaryDiv.appendChild(contentDiv);
      
      // Show word count
      const wordCount = result.summary.split(' ').length;
      wordCountDiv.textContent = `Summary: ${wordCount} words | Original: ~${Math.round(pageContent.split(' ').length)} words`;
      wordCountDiv.style.display = 'block';
      
      // Enable the PDF export button
      exportPdfBtn.disabled = false;
      
    } catch (error) {
      console.error('Summarization error:', error);
      loading.style.display = 'none';
      errorDiv.style.display = 'block';
      errorDiv.textContent = `Error: ${error.message}`;
    } finally {
      summarizeBtn.disabled = false;
      summarizeBtn.textContent = 'Summarize This Page';
    }
  });
});

// Function to extract content from the current page
function extractPageContent() {
  // Remove script and style elements
  const scripts = document.querySelectorAll('script, style, nav, header, footer, aside');
  scripts.forEach(el => el.remove());
  
  // Try to find main content areas
  let content = '';
  
  // Look for common content containers
  const contentSelectors = [
    'main',
    'article',
    '[role="main"]',
    '.content',
    '.post-content',
    '.entry-content',
    '.article-content',
    '#content',
    '.main-content'
  ];
  
  for (const selector of contentSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      content = element.innerText;
      break;
    }
  }
  
  // Fallback to body content if no specific content area found
  if (!content) {
    content = document.body.innerText;
  }
  
  // Clean up the content
  content = content
    .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
    .replace(/\n+/g, ' ') // Replace newlines with spaces
    .trim();
  
  // Limit content length to avoid API limits
  if (content.length > 8000) {
    content = content.substring(0, 8000) + '...';
  }
  
  return content;
}

// AI-powered summarization using Ollama
async function generateSummary(text, length) {
  try {
    // First try Ollama API
    const ollamaSummary = await generateAISummary(text, length);
    if (ollamaSummary) {
      return {
        summary: ollamaSummary,
        method: 'AI Summary'
      };
    }
  } catch (error) {
    console.log('Ollama not available, falling back to extractive summarization:', error.message);
  }
  
  // Fallback to extractive summarization
  const extractiveSummary = generateExtractiveSummary(text, length);
  return {
    summary: extractiveSummary,
    method: 'Data Extraction'
  };
}

// Generate a summary of the provided text using OpenAI
async function generateAISummary(text, length) {
  // Get saved settings
  const settings = await new Promise(resolve => {
    chrome.storage.sync.get(['preferAI', 'openaiApiKey'], resolve);
  });
  
  console.log('Extension settings:', { preferAI: settings.preferAI, hasApiKey: !!settings.openaiApiKey });
  
  const preferAI = settings.preferAI !== false;
  const apiKey = settings.openaiApiKey;
  
  if (!preferAI) {  
    console.log('AI summarization disabled in settings - using fallback');
    throw new Error('AI summarization disabled in settings');
  }
  
  if (!apiKey) {
    console.log('No OpenAI API key found - using fallback');
    throw new Error('OpenAI API key not configured. Please set your API key in the extension settings.');
  }
  
  console.log('Attempting to use AI summarization with OpenAI...');
  
  // Create comprehensive prompt with more data
  const maxLength = 8000; // Increase from 2000 to 8000 characters
  const textToSummarize = text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  
  console.log(`Using ${textToSummarize.length} characters for summarization (original: ${text.length})`);
  
  // Advanced prompt engineering with professional tone and HTML formatting
  let prompt;
  if (length === 'short') {
    prompt = `You are an intelligent content analyst. First, identify the content type (tech/programming, business, news, tutorial, research, etc.), then create a contextually appropriate summary.

INTELLIGENT ADAPTATION RULES:
- **Tech/Programming**: Focus on implementation details, technologies used, code concepts, technical benefits
- **Business**: Emphasize metrics, market impact, strategic implications, ROI
- **News**: Highlight key facts, timeline, who/what/when/where, impact
- **Tutorial/How-to**: Summarize steps, requirements, tools needed, expected outcomes
- **Research**: Focus on methodology, findings, data, conclusions
- **General**: Provide clear, accessible main points and significance

FORMATTING REQUIREMENTS:
- Use contextually appropriate headers with emojis
- Use <strong> tags for key terms, metrics, technologies, names
- Adapt tone to match content type (technical for tech, accessible for general)

OUTPUT STRUCTURE:
<h2>[Appropriate emoji] [Context-aware title]</h2>
<p>[Opening with main point and <strong>key details</strong>]</p>
<h3>[Appropriate emoji] [Context-aware subtitle]</h3>
<p>[Core insight with <strong>important specifics</strong> and relevance]</p>

EXAMPLES:
For Tech: <h2>💻 Tech Overview</h2> / <h3>⚙️ Implementation</h3>
For Business: <h2>📊 Business Impact</h2> / <h3>📈 Key Metrics</h3>
For Tutorial: <h2>🛠️ How-To Guide</h2> / <h3>✅ What You'll Learn</h3>

Now analyze this text and adapt accordingly:
${textToSummarize}`;
  } else if (length === 'medium') {
    prompt = `You are an intelligent content analyst. First, identify the content type, then create a contextually appropriate medium-length summary.

INTELLIGENT ADAPTATION BY CONTENT TYPE:
- **Tech/Programming**: Cover technologies, implementation approach, benefits, use cases, technical requirements
- **Business**: Focus on market impact, financial metrics, competitive advantages, strategic implications
- **News**: Present facts, timeline, key players, consequences, broader context
- **Tutorial**: Outline process, prerequisites, main steps, tools, expected results
- **Research**: Methodology, key findings, data insights, limitations, implications
- **Product Reviews**: Features, pros/cons, performance, comparison, recommendation

ADAPTIVE FORMATTING:
- Use contextually relevant headers and emojis
- Technical content: Focus on specs, implementation, performance
- Business content: Emphasize ROI, market impact, strategic value
- Educational content: Structure as learning points and outcomes

OUTPUT STRUCTURE:
<h2>[Context emoji] [Adaptive title]</h2>
<p>[Context-setting opening with <strong>key points</strong>]</p>
<h3>[Section emoji] [Adaptive section title]</h3>
<ul>
<li><strong>[Point 1]</strong>: [Context-appropriate detail with <strong>specifics</strong>]</li>
<li><strong>[Point 2]</strong>: [Context-appropriate detail with <strong>specifics</strong>]</li>
<li><strong>[Point 3]</strong>: [Context-appropriate detail with <strong>specifics</strong>]</li>
</ul>
<h3>[Conclusion emoji] [Adaptive conclusion title]</h3>
<p>[Context-appropriate conclusion and implications]</p>

EXAMPLE OUTPUT:
<h2>📋 Executive Summary</h2>
<p>This analysis reveals <strong>significant market disruption</strong> in the <strong>enterprise software sector</strong>, with implications for both <strong>technology adoption strategies</strong> and <strong>competitive positioning</strong>.</p>
<h3>🔍 Key Findings</h3>
<ul>
<li><strong>Market Growth Acceleration</strong>: The sector experienced <strong>67% year-over-year growth</strong>, primarily driven by <strong>remote work demands</strong> and <strong>digital transformation initiatives</strong>.</li>
<li><strong>Competitive Landscape Shift</strong>: <strong>Three major players</strong> now control <strong>78% of market share</strong>, indicating rapid <strong>industry consolidation</strong>.</li>
<li><strong>Investment Patterns</strong>: <strong>Venture capital funding</strong> increased by <strong>$2.3 billion</strong>, with <strong>AI-powered solutions</strong> receiving the largest allocation.</li>
</ul>
<h3>💡 Bottom Line</h3>
<p>These trends suggest that <strong>early adoption</strong> and <strong>strategic partnerships</strong> will be critical for companies seeking to maintain <strong>competitive advantage</strong> in this rapidly evolving landscape.</p>

Now analyze this text:
${textToSummarize}`;
  } else {
    prompt = `You are an intelligent content analyst with deep expertise across domains. First, identify the content type and domain, then create a comprehensive, contextually optimized summary.

INTELLIGENT DOMAIN ADAPTATION:
- **Tech/Programming**: Deep dive into architecture, implementation details, performance, scalability, code examples, best practices
- **Business/Finance**: Market analysis, financial impact, competitive landscape, strategic implications, ROI, growth metrics
- **Science/Research**: Methodology, experimental design, data analysis, statistical significance, limitations, future research
- **News/Current Events**: Timeline, key stakeholders, political/social impact, broader implications, expert opinions
- **Tutorial/Education**: Learning objectives, prerequisites, step-by-step breakdown, troubleshooting, practical applications
- **Product/Technology Reviews**: Detailed specs, performance benchmarks, comparison matrix, use cases, recommendations

CONTEXT-AWARE FORMATTING:
- Use domain-specific terminology and concepts
- Adapt depth and technical level to content type
- Include relevant metrics, data points, and specifics
- Structure information flow logically for the domain

ADAPTIVE OUTPUT STRUCTURE:
<h2>[Domain emoji] [Context-specific title]</h2>
<p>[Domain-appropriate opening with <strong>key insights</strong> and relevance]</p>
<h3>[Scope emoji] [Context-specific scope title]</h3>
<p>[Domain-appropriate scope description with <strong>main themes</strong>]</p>
<h3>[Content emoji] [Context-specific content title]</h3>
<ul>
<li><strong>[Domain Point 1]</strong>: [Deep, context-appropriate analysis with <strong>specifics</strong>]</li>
<li><strong>[Domain Point 2]</strong>: [Deep, context-appropriate analysis with <strong>specifics</strong>]</li>
<li><strong>[Domain Point 3]</strong>: [Deep, context-appropriate analysis with <strong>specifics</strong>]</li>
<li><strong>[Domain Point 4]</strong>: [Deep, context-appropriate analysis with <strong>specifics</strong>]</li>
</ul>
<h3>[Impact emoji] [Context-specific impact title]</h3>
<p>[Domain-appropriate significance and broader implications]</p>
<h3>[Conclusion emoji] [Context-specific conclusion title]</h3>
<p>[Domain-appropriate conclusions and <strong>actionable insights</strong>]</p>

EXAMPLE OUTPUT:
<h2>📝 Article Summary</h2>
<p>This comprehensive analysis reveals <strong>fundamental shifts</strong> in the <strong>global technology landscape</strong>, with <strong>artificial intelligence adoption</strong> reaching a <strong>critical inflection point</strong> that will reshape how businesses operate across multiple industries.</p>
<h3>📄 What This Covers</h3>
<p>The article examines <strong>AI implementation trends</strong> across <strong>2,847 enterprises</strong> in <strong>23 countries</strong> over an <strong>18-month period</strong>, focusing on <strong>adoption strategies</strong> and their <strong>measurable business outcomes</strong>.</p>
<h3>🔑 Key Points</h3>
<ul>
<li><strong>Rapid Growth</strong>: <strong>Enterprise AI adoption</strong> increased by <strong>340% year-over-year</strong>, with <strong>manufacturing</strong> and <strong>financial services</strong> leading implementation at <strong>78% and 71% respectively</strong>. This surge is driven by <strong>cost pressures</strong> and <strong>competitive necessity</strong>.</li>
<li><strong>Performance Benefits</strong>: Organizations with <strong>mature AI implementations</strong> report <strong>average productivity gains of 35-50%</strong> and <strong>cost reductions of 20-30%</strong>. Most significantly, <strong>customer satisfaction scores</strong> improved by <strong>23% on average</strong>.</li>
<li><strong>Investment Trends</strong>: <strong>Global AI investment</strong> reached <strong>$67.9 billion</strong> in the past year, with <strong>60% allocated to infrastructure</strong> and <strong>40% to talent acquisition</strong>. <strong>Return on investment</strong> typically materializes within <strong>6-12 months</strong>.</li>
<li><strong>Competitive Advantage</strong>: Companies with <strong>early AI adoption</strong> are establishing <strong>sustainable competitive advantages</strong>, with <strong>market share gains averaging 15-25%</strong> in their respective sectors.</li>
</ul>
<h3>💡 Why This Matters</h3>
<p>The data indicates that <strong>AI adoption</strong> has moved beyond experimental phases into <strong>mission-critical operations</strong>. Organizations that delay implementation risk <strong>permanent competitive disadvantage</strong>, while <strong>first-movers</strong> are creating <strong>defensible market positions</strong>.</p>
<h3>🎯 Bottom Line</h3>
<p><strong>Immediate action</strong> is required for organizations to remain competitive. Priority should be given to <strong>infrastructure development</strong>, <strong>talent acquisition</strong>, and <strong>strategic partnerships</strong> with <strong>AI technology providers</strong>. The <strong>window for competitive AI adoption</strong> is rapidly closing.</p>

Now analyze this text:
${textToSummarize}`;
  }
  
  // Send request to background script
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      action: 'openaiRequest',
      prompt: prompt
    }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      
      if (response.error) {
        console.error('OpenAI API error:', response.error);
        reject(new Error(response.error));
        return;
      }
      
      if (response.success) {
        console.log('AI Summary generated successfully!');
        resolve(response.data);
      } else {
        reject(new Error('Unknown error from background script'));
      }
    });
  });
}

// Fallback extractive summarization function
function generateExtractiveSummary(text, length) {
  // Split text into sentences
  const sentences = text.match(/[^\.!?]+[\.!?]+/g) || [];
  
  if (sentences.length === 0) {
    throw new Error('Could not parse content into sentences.');
  }
  
  // Score sentences based on word frequency, position, and information density
  const wordFreq = getWordFrequency(text);
  const scoredSentences = sentences.map((sentence, index) => {
    const words = sentence.toLowerCase().match(/\b\w+\b/g) || [];
    const baseScore = words.reduce((sum, word) => sum + (wordFreq[word] || 0), 0) / words.length;
    
    // Position scoring - favor beginning and end
    let positionScore = 1;
    if (sentences.length > 5) {
      if (index < 3) positionScore = 1.3; // Beginning boost
      else if (index > sentences.length - 4) positionScore = 1.2; // End boost
      else positionScore = 0.9;
    }
    
    // Information density scoring
    const hasNumbers = /\d/.test(sentence);
    const hasCapitals = (sentence.match(/[A-Z][a-z]+/g) || []).length > 2;
    const hasKeywords = /\b(important|significant|key|main|primary|essential|critical|major|research|study|data|result|conclusion|finding)\b/i.test(sentence);
    
    let densityScore = 1;
    if (hasNumbers) densityScore += 0.2;
    if (hasCapitals) densityScore += 0.1;
    if (hasKeywords) densityScore += 0.3;
    if (sentence.length > 100 && sentence.length < 200) densityScore += 0.1; // Prefer medium-length sentences
    
    return {
      sentence: sentence.trim(),
      score: baseScore * positionScore * densityScore,
      index: index
    };
  });
  
  // Sort by score and select top sentences
  scoredSentences.sort((a, b) => b.score - a.score);
  
  let numSentences;
  switch (length) {
    case 'short':
      numSentences = Math.min(8, scoredSentences.length);
      break;
    case 'medium':
      numSentences = Math.min(12, scoredSentences.length);
      break;
    case 'long':
      numSentences = Math.min(20, scoredSentences.length);
      break;
    default:
      numSentences = Math.min(12, scoredSentences.length);
  }
  
  // Get top sentences and sort by original order
  const selectedSentences = scoredSentences
    .slice(0, numSentences)
    .sort((a, b) => a.index - b.index)
    .map(item => item.sentence);
  
  return selectedSentences.join(' ');
}

// Calculate word frequency for scoring
function getWordFrequency(text) {
  const words = text.toLowerCase().match(/\b\w+\b/g) || [];
  const freq = {};
  
  // Common stop words to ignore
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
    'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does',
    'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this',
    'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him',
    'her', 'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their'
  ]);
  
  words.forEach(word => {
    if (!stopWords.has(word) && word.length > 2) {
      freq[word] = (freq[word] || 0) + 1;
    }
  });
  
  return freq;
}

// Check if OpenAI API key is configured and update status
async function checkOpenAIStatus() {
  try {
    // Get OpenAI API key from storage
    chrome.storage.sync.get(['openaiApiKey', 'preferAI'], (result) => {
      const apiKey = result.openaiApiKey;
      const preferAI = result.preferAI !== false;
      
      if (!preferAI) {
        updateStatusIndicator(false, 'AI Disabled');
        return;
      }
      
      if (!apiKey) {
        updateStatusIndicator(false, 'No API Key');
        return;
      }
      
      if (!apiKey.startsWith('sk-')) {
        updateStatusIndicator(false, 'Invalid API Key');
        return;
      }
      
      updateStatusIndicator(true, 'AI Ready');
    });
  } catch (error) {
    console.error('Error in checkOpenAIStatus:', error);
    updateStatusIndicator(false, 'Error checking status');
  }
  
  function updateStatusIndicator(isAvailable, statusText) {
    if (statusDot && statusText) {
      statusDot.className = isAvailable ? 'status-dot online' : 'status-dot offline';
      statusText.textContent = statusText;
    }
  }
}

// Function to export the summary as PDF
function exportSummaryAsPdf() {
  try {
    // Make sure jsPDF is loaded
    if (!window.jspdf) {
      throw new Error('PDF library not loaded');
    }
    
    // Create a new PDF document
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    // Set font and styling
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(20);
    
    // Add page title
    doc.text('Website Summary', 15, 20);
    
    // Add page info
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(`Page: ${currentPageTitle}`, 15, 30);
    
    // Add URL with truncation if too long
    let displayUrl = currentPageUrl;
    if (displayUrl.length > 80) {
      displayUrl = displayUrl.substring(0, 77) + '...';
    }
    doc.text(`URL: ${displayUrl}`, 15, 37);
    
    // Add date
    const currentDate = new Date().toLocaleDateString();
    doc.text(`Generated: ${currentDate}`, 15, 44);
    
    // Add divider
    doc.setDrawColor(200, 200, 200);
    doc.line(15, 48, 195, 48);
    
    // Get the summary content
    const summaryContent = document.querySelector('.summary-content').innerText;
    
    // Format the summary text
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    
    // Split text into lines that fit the page width
    const textLines = doc.splitTextToSize(summaryContent, 180);
    doc.text(textLines, 15, 55);
    
    // Add footer with branding
    const pageCount = doc.internal.getNumberOfPages();
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text('Generated by Website Summarizer Extension', 15, 285);
    
    // Save PDF with filename based on page title
    let filename = 'summary-' + currentPageTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    if (filename.length > 50) filename = filename.substring(0, 50);
    doc.save(`${filename}.pdf`);
    
    // Reset button state
    setTimeout(() => {
      exportPdfBtn.disabled = false;
      exportPdfBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" fill="currentColor"/>
        </svg>
        PDF
      `;
    }, 1500);
    
  } catch (error) {
    console.error('PDF export error:', error);
    alert('Failed to export PDF. ' + error.message);
    
    // Reset button state
    exportPdfBtn.disabled = false;
    exportPdfBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" fill="currentColor"/>
      </svg>
      PDF
    `;
  }
}
