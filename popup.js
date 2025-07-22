document.addEventListener('DOMContentLoaded', function() {
  const summarizeBtn = document.getElementById('summarizeBtn');
  const exportPdfBtn = document.getElementById('exportPdfBtn');
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
  
  // Check Ollama status on load
  checkOllamaStatus();
  
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

// Generate a summary of the provided text using Ollama
async function generateAISummary(text, length) {
  // Always use llama3.2:latest
  const model = 'llama3.2:latest';
  
  // Get saved settings
  const settings = await new Promise(resolve => {
    chrome.storage.sync.get(['preferAI'], resolve);
  });
  
  console.log('Extension settings:', settings);
  
  let selectedModel = model;
  const preferAI = settings.preferAI !== false;
  
  console.log('Selected model:', selectedModel);
  console.log('Prefer AI:', preferAI);
  
  if (!preferAI) {  
    console.log('AI summarization disabled in settings - using fallback');
    throw new Error('AI summarization disabled in settings');
  }
  
  console.log('Attempting to use AI summarization with Ollama...');
  
  // Add :latest tag if not present
  if (!selectedModel.includes(':')) {
    selectedModel = selectedModel + ':latest';
  }
  
  // Create comprehensive prompt with more data
  const maxLength = 8000; // Increase from 2000 to 8000 characters
  const textToSummarize = text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  
  console.log(`Using ${textToSummarize.length} characters for summarization (original: ${text.length})`);
  
  // Advanced prompt engineering with professional tone and HTML formatting
  let prompt;
  if (length === 'short') {
    prompt = `You are an expert content analyst and professional communicator. Your task is to create a concise, insightful summary that transforms complex information into clear, actionable insights.

CRITICAL FORMATTING RULES:
- Use <strong>HTML strong tags</strong> around ALL key terms, important concepts, numbers, names, and critical points
- Write in a professional, conversational tone that engages the reader
- Focus on WHY information matters, not just WHAT it says
- Create a narrative flow that tells a compelling story

OUTPUT FORMAT:
- Exactly 3-4 sentences that build upon each other
- Each sentence should reveal new insight or context
- Use <strong> tags extensively to highlight important elements
- End with the key takeaway or implication

EXAMPLE OUTPUT STYLE:
"The study reveals that <strong>artificial intelligence adoption</strong> has increased by <strong>340% in enterprise environments</strong> over the past two years. This dramatic surge is primarily driven by <strong>cost reduction needs</strong> and <strong>competitive pressure</strong> rather than innovation goals. Most significantly, companies implementing AI report <strong>average productivity gains of 25-40%</strong> within the first six months. The data suggests that <strong>early AI adoption</strong> is becoming a critical factor for maintaining market competitiveness."

Now analyze this text:
${textToSummarize}`;
  } else if (length === 'medium') {
    prompt = `You are a senior business analyst and expert communicator. Transform this content into a comprehensive, professional summary that executives and decision-makers would find valuable.

CRITICAL FORMATTING REQUIREMENTS:
- Use <strong>HTML strong tags</strong> extensively around key terms, metrics, names, concepts, and insights
- Write in an authoritative yet accessible professional tone
- Focus on implications, significance, and actionable insights
- Structure with proper HTML formatting

MANDATORY OUTPUT STRUCTURE:
<p>[Opening paragraph that sets context and explains why this matters]</p>
<ul>
<li><strong>[Key insight 1]</strong>: [Explanation with <strong>important details</strong>]</li>
<li><strong>[Key insight 2]</strong>: [Explanation with <strong>important details</strong>]</li>
<li><strong>[Key insight 3]</strong>: [Explanation with <strong>important details</strong>]</li>
</ul>
<p>[Closing paragraph with implications and key takeaways]</p>

EXAMPLE OUTPUT:
<p>This analysis reveals <strong>significant market disruption</strong> in the <strong>enterprise software sector</strong>, with implications for both <strong>technology adoption strategies</strong> and <strong>competitive positioning</strong>.</p>
<ul>
<li><strong>Market Growth Acceleration</strong>: The sector experienced <strong>67% year-over-year growth</strong>, primarily driven by <strong>remote work demands</strong> and <strong>digital transformation initiatives</strong>.</li>
<li><strong>Competitive Landscape Shift</strong>: <strong>Three major players</strong> now control <strong>78% of market share</strong>, indicating rapid <strong>industry consolidation</strong>.</li>
<li><strong>Investment Patterns</strong>: <strong>Venture capital funding</strong> increased by <strong>$2.3 billion</strong>, with <strong>AI-powered solutions</strong> receiving the largest allocation.</li>
</ul>
<p>These trends suggest that <strong>early adoption</strong> and <strong>strategic partnerships</strong> will be critical for companies seeking to maintain <strong>competitive advantage</strong> in this rapidly evolving landscape.</p>

Now analyze this text:
${textToSummarize}`;
  } else {
    prompt = `You are a distinguished research analyst and strategic advisor. Create a comprehensive, executive-level analysis that transforms complex information into strategic insights and actionable intelligence.

CRITICAL FORMATTING REQUIREMENTS:
- Use <strong>HTML strong tags</strong> extensively throughout for ALL key terms, metrics, names, dates, concepts, insights, and conclusions
- Write in an authoritative, sophisticated tone that demonstrates deep expertise
- Focus on strategic implications, root causes, and interconnected relationships
- Provide analysis that enables informed decision-making

MANDATORY OUTPUT STRUCTURE:
<p><strong>Executive Overview:</strong> [Context and strategic significance]</p>
<p><strong>Background Context:</strong> [Essential background with <strong>key details</strong>]</p>
<ul>
<li><strong>[Primary Finding 1]</strong>: [Detailed analysis with <strong>supporting evidence</strong> and <strong>implications</strong>]</li>
<li><strong>[Primary Finding 2]</strong>: [Detailed analysis with <strong>supporting evidence</strong> and <strong>implications</strong>]</li>
<li><strong>[Primary Finding 3]</strong>: [Detailed analysis with <strong>supporting evidence</strong> and <strong>implications</strong>]</li>
<li><strong>[Primary Finding 4]</strong>: [Detailed analysis with <strong>supporting evidence</strong> and <strong>implications</strong>]</li>
</ul>
<p><strong>Strategic Analysis:</strong> [How findings interconnect and what they mean for stakeholders]</p>
<p><strong>Key Takeaways:</strong> [Critical insights and recommended actions with <strong>priority levels</strong>]</p>

EXAMPLE OUTPUT:
<p><strong>Executive Overview:</strong> This comprehensive market analysis reveals <strong>fundamental shifts</strong> in the <strong>global technology landscape</strong>, with <strong>artificial intelligence adoption</strong> reaching a <strong>critical inflection point</strong> that will reshape <strong>competitive dynamics</strong> across multiple industries.</p>
<p><strong>Background Context:</strong> The study examined <strong>2,847 enterprises</strong> across <strong>23 countries</strong> over an <strong>18-month period</strong>, focusing on <strong>AI implementation strategies</strong> and their <strong>measurable business outcomes</strong>.</p>
<ul>
<li><strong>Adoption Acceleration</strong>: <strong>Enterprise AI adoption</strong> increased by <strong>340% year-over-year</strong>, with <strong>manufacturing</strong> and <strong>financial services</strong> leading implementation at <strong>78% and 71% respectively</strong>. This surge is driven by <strong>cost pressures</strong> and <strong>competitive necessity</strong> rather than innovation curiosity.</li>
<li><strong>Performance Impact</strong>: Organizations with <strong>mature AI implementations</strong> report <strong>average productivity gains of 35-50%</strong> and <strong>cost reductions of 20-30%</strong>. Most significantly, <strong>customer satisfaction scores</strong> improved by <strong>23% on average</strong>.</li>
<li><strong>Investment Patterns</strong>: <strong>Global AI investment</strong> reached <strong>$67.9 billion</strong> in the past year, with <strong>60% allocated to infrastructure</strong> and <strong>40% to talent acquisition</strong>. <strong>Return on investment</strong> typically materializes within <strong>6-12 months</strong>.</li>
<li><strong>Competitive Implications</strong>: Companies with <strong>early AI adoption</strong> are establishing <strong>sustainable competitive advantages</strong>, with <strong>market share gains averaging 15-25%</strong> in their respective sectors.</li>
</ul>
<p><strong>Strategic Analysis:</strong> The data indicates that <strong>AI adoption</strong> has moved beyond experimental phases into <strong>mission-critical operations</strong>. Organizations that delay implementation risk <strong>permanent competitive disadvantage</strong>, while <strong>first-movers</strong> are creating <strong>defensible market positions</strong>.</p>
<p><strong>Key Takeaways:</strong> <strong>Immediate action</strong> is required for organizations to remain competitive. Priority should be given to <strong>infrastructure development</strong>, <strong>talent acquisition</strong>, and <strong>strategic partnerships</strong> with <strong>AI technology providers</strong>. The <strong>window for competitive AI adoption</strong> is rapidly closing.</p>

Now analyze this text:
${textToSummarize}`;
  }
  
  // Send request to background script
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      action: 'ollamaRequest',
      model: selectedModel,
      prompt: prompt
    }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      
      if (response.error) {
        console.error('Ollama API error:', response.error);
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

// Check if Ollama is running and update status
async function checkOllamaStatus() {
  console.log('Popup: Starting checkOllamaStatus...');
  try {
    // Send request to background script to check Ollama status
    console.log('Popup: Sending checkOllamaStatus message to background script');
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'checkOllamaStatus'
      }, (response) => {
        console.log('Popup: Received response from background script:', response);
        if (chrome.runtime.lastError) {
          console.error('Popup: Chrome runtime error:', chrome.runtime.lastError.message);
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(response);
      });
    });
    
    if (response.success && response.models) {
      const models = response.models;
      statusDot.className = 'status-dot online';
      
      if (models.length > 0) {
        const modelNames = models.map(m => {
          const name = m.name || m.model || 'unknown';
          return name.split(':')[0];
        }).slice(0, 2);
        statusText.textContent = `AI Ready (${modelNames.join(', ')})`;
        console.log('Available Ollama models:', models.map(m => m.name || m.model));
      } else {
        statusText.textContent = 'AI Ready (No models found)';
      }
    } else {
      throw new Error(response.error || 'Ollama not responding');
    }
  } catch (error) {
    statusDot.className = 'status-dot offline';
    statusText.textContent = 'AI Offline - Using fallback';
    console.log('Ollama status check failed:', error.message);
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
