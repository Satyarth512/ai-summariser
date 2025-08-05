// Background service worker for Website Summarizer extension

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Website Summarizer extension installed');
    
    // Set default settings
    chrome.storage.sync.set({
      summaryLength: 'medium',
      autoHighlight: false,
      saveHistory: true,
      preferAI: true,
      openaiApiKey: ''
    });
  }
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'saveSummary') {
    saveSummaryToHistory(request.data)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep message channel open
  }
  
  if (request.action === 'getSummaryHistory') {
    getSummaryHistory()
      .then(history => sendResponse({ success: true, history: history }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.action === 'clearHistory') {
    clearSummaryHistory()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.action === 'openaiRequest') {
    console.log('Background script received openaiRequest:', { promptLength: request.prompt.length });
    handleOpenAIRequest(request.prompt)
      .then(data => {
        console.log('OpenAI request successful, response length:', data.length);
        sendResponse({ success: true, data: data });
      })
      .catch(error => {
        console.error('OpenAI request failed:', error.message);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  if (request.action === 'getPageContent') {
    console.log('Background: Received getPageContent request for tab', request.tabId);
    
    // Use a completely different approach that doesn't touch the page DOM
    try {
      // Use tabs.executeScript with { code: ... } instead of { function: ... }
      // This executes a minimal content extraction without DOM cloning
      chrome.scripting.executeScript({
        target: { tabId: request.tabId },
        // This simple string script just gets text content without DOM manipulation
        func: () => {
          // Get text directly from the body, no DOM manipulation
          return document.body.innerText || document.body.textContent || '';
        }
      }).then(results => {
        if (results && results[0] && results[0].result) {
          console.log('Background: Content extracted successfully, length:', results[0].result.length);
          sendResponse({
            success: true,
            content: results[0].result
          });
        } else {
          console.error('Background: Content extraction failed');
          sendResponse({
            success: false,
            error: 'Could not extract content'
          });
        }
      }).catch(error => {
        console.error('Background: Content extraction error:', error);
        sendResponse({
          success: false,
          error: error.message
        });
      });
    } catch (error) {
      console.error('Background: getPageContent error:', error);
      sendResponse({
        success: false,
        error: error.message
      });
    }
    return true;
  }
  
  if (request.action === 'checkOllamaStatus') {
    console.log('Background: Received checkOllamaStatus request');
    checkOllamaStatus()
      .then(models => {
        console.log('Background: checkOllamaStatus succeeded with models:', models);
        sendResponse({ success: true, models: models });
      })
      .catch(error => {
        console.error('Background: checkOllamaStatus failed with error:', error.message);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
});

// Handle OpenAI API requests
async function handleOpenAIRequest(prompt) {
  // Get API key from storage
  const settings = await new Promise(resolve => {
    chrome.storage.sync.get(['openaiApiKey'], resolve);
  });
  
  const apiKey = settings.openaiApiKey;
  if (!apiKey) {
    throw new Error('OpenAI API key not found. Please set your API key in the extension settings.');
  }
  
  const openaiUrl = 'https://api.openai.com/v1/chat/completions';
  
  const requestBody = {
    model: 'gpt-4.1-mini',
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ],
    max_tokens: 1000,
    temperature: 0.7
  };
  
  console.log('Sending OpenAI request with payload:', { ...requestBody, messages: [{ role: 'user', content: `[${prompt.length} chars]` }] });
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    
    const response = await fetch(openaiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    console.log('OpenAI fetch response status:', response.status);
    console.log('OpenAI fetch response ok:', response.ok);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error details:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      
      if (response.status === 401) {
        throw new Error('Invalid OpenAI API key. Please check your API key in the extension settings.');
      } else if (response.status === 429) {
        throw new Error('OpenAI API rate limit exceeded. Please try again later.');
      } else {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }
    }
    
    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('No response from OpenAI API');
    }
    
    const responseText = data.choices[0].message.content.trim();
    console.log('OpenAI request successful, response length:', responseText.length);
    return responseText;
    
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('OpenAI request timed out after 60 seconds');
    }
    console.error('OpenAI request error:', error.message);
    throw error;
  }
}

// Check OpenAI API key status
async function checkOpenAIStatus() {
  console.log('Checking OpenAI API key status...');
  
  try {
    // Get API key from storage
    const settings = await new Promise(resolve => {
      chrome.storage.sync.get(['openaiApiKey'], resolve);
    });
    
    const apiKey = settings.openaiApiKey;
    if (!apiKey) {
      return { available: false, error: 'No API key configured' };
    }
    
    if (!apiKey.startsWith('sk-')) {
      return { available: false, error: 'Invalid API key format' };
    }
    
    // API key exists and has correct format
    return { available: true, error: null };
    
  } catch (error) {
    console.error('OpenAI status check failed:', error.message);
    return { available: false, error: error.message };
  }
}

// Save summary to local storage history
async function saveSummaryToHistory(summaryData) {
  try {
    const result = await chrome.storage.local.get(['summaryHistory']);
    let history = result.summaryHistory || [];
    
    // Add new summary with timestamp
    const newEntry = {
      ...summaryData,
      timestamp: Date.now(),
      id: generateId()
    };
    
    history.unshift(newEntry);
    
    // Keep only last 50 summaries
    if (history.length > 50) {
      history = history.slice(0, 50);
    }
    
    await chrome.storage.local.set({ summaryHistory: history });
    console.log('Summary saved to history');
  } catch (error) {
    console.error('Error saving summary to history:', error);
    throw error;
  }
}

// Get summary history
async function getSummaryHistory() {
  try {
    const result = await chrome.storage.local.get(['summaryHistory']);
    return result.summaryHistory || [];
  } catch (error) {
    console.error('Error getting summary history:', error);
    throw error;
  }
}

// Clear summary history
async function clearSummaryHistory() {
  try {
    await chrome.storage.local.remove(['summaryHistory']);
    console.log('Summary history cleared');
  } catch (error) {
    console.error('Error clearing summary history:', error);
    throw error;
  }
}

// Generate unique ID for summary entries
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Handle context menu (optional feature for future enhancement)
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'summarizeSelection',
    title: 'Summarize selected text',
    contexts: ['selection']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'summarizeSelection') {
    // Send message to content script to handle selected text summarization
    chrome.tabs.sendMessage(tab.id, {
      action: 'summarizeSelection',
      selectedText: info.selectionText
    });
  }
});

// Monitor tab updates to refresh content script if needed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Inject content script if not already present
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    }).catch(() => {
      // Ignore errors - content script might already be injected
    });
  }
});

console.log('Website Summarizer background script loaded');
