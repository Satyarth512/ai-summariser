// Content script for the Website Summarizer extension
// This script runs on all web pages and can interact with page content

// Listen for messages from the popup or background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractContent') {
    try {
      const content = extractPageContent();
      sendResponse({ success: true, content: content });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }
  
  if (request.action === 'highlightSummary') {
    try {
      highlightSummaryContent(request.sentences);
      sendResponse({ success: true });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }
  
  return true; // Keep the message channel open for async response
});

// Extract meaningful content from the page without cloning the DOM
function extractPageContent() {
  let content = '';
  
  // Priority order for content extraction
  const contentSelectors = [
    'main article',
    'main',
    'article',
    '[role="main"]',
    '.post-content',
    '.entry-content',
    '.article-content',
    '.content-body',
    '.post-body',
    '#content',
    '.main-content',
    '.page-content'
  ];
  
  // Try to find the main content area using non-invasive selectors
  // instead of cloning and modifying the DOM
  for (const selector of contentSelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.trim().length > 200) {
      // Use textContent instead of innerText for better performance
      content = element.textContent;
      break;
    }
  }
  
  // Fallback to specific sections if no main content area found
  if (!content || content.trim().length < 200) {
    // Gather text from paragraphs, headings, and other content elements
    const textElements = Array.from(document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, td, div > text'));
    content = textElements
      .map(el => el.textContent)
      .filter(text => text.trim().length > 0)
      .join(' ');
  }
  
  // Final fallback to body content
  if (!content || content.trim().length < 200) {
    content = document.body.textContent;
  }
  
  // Clean and process the content
  content = cleanContent(content);
  
  // Get page metadata
  const metadata = getPageMetadata();
  
  return {
    content: content,
    title: metadata.title,
    url: metadata.url,
    wordCount: content.split(/\s+/).length
  };
}

// Clean and normalize extracted content
function cleanContent(content) {
  return content
    // Remove extra whitespace
    .replace(/\s+/g, ' ')
    // Remove multiple newlines
    .replace(/\n+/g, ' ')
    // Remove special characters that might interfere
    .replace(/[^\w\s\.,!?;:()\-"']/g, ' ')
    // Trim and limit length
    .trim()
    .substring(0, 10000); // Limit to prevent memory issues
}

// Extract page metadata
function getPageMetadata() {
  const title = document.title || 
                document.querySelector('h1')?.innerText || 
                'Untitled Page';
  
  const description = document.querySelector('meta[name="description"]')?.content ||
                     document.querySelector('meta[property="og:description"]')?.content ||
                     '';
  
  const author = document.querySelector('meta[name="author"]')?.content ||
                document.querySelector('[rel="author"]')?.innerText ||
                '';
  
  return {
    title: title.trim(),
    url: window.location.href,
    description: description.trim(),
    author: author.trim(),
    domain: window.location.hostname
  };
}

// Highlight sentences in the summary on the original page - disabled to prevent page CSS distortion
function highlightSummaryContent(sentences) {
  console.log('Highlighting disabled to prevent page distortion');
  // No-op function that doesn't modify the page
  return;
}

// Remove existing highlights
function removeExistingHighlights() {
  const highlights = document.querySelectorAll('[class*="summary-highlight"]');
  highlights.forEach(highlight => {
    const parent = highlight.parentNode;
    parent.replaceChild(document.createTextNode(highlight.textContent), highlight);
    parent.normalize();
  });
}

// Highlight text within an element
function highlightTextInElement(element, regex, className) {
  if (element.nodeType === Node.TEXT_NODE) {
    const text = element.textContent;
    if (regex.test(text)) {
      const highlightedHTML = text.replace(regex, match => 
        `<span class="${className}" style="background-color: yellow; padding: 2px; border-radius: 3px;">${match}</span>`
      );
      
      const wrapper = document.createElement('div');
      wrapper.innerHTML = highlightedHTML;
      
      while (wrapper.firstChild) {
        element.parentNode.insertBefore(wrapper.firstChild, element);
      }
      element.parentNode.removeChild(element);
    }
  } else if (element.nodeType === Node.ELEMENT_NODE) {
    // Skip script and style elements
    if (element.tagName === 'SCRIPT' || element.tagName === 'STYLE') {
      return;
    }
    
    // Process child nodes
    const children = Array.from(element.childNodes);
    children.forEach(child => highlightTextInElement(child, regex, className));
  }
}

// Notify that content script is ready
console.log('Website Summarizer content script loaded');
