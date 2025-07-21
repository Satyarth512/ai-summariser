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
      ollamaModel: 'llama3.2:latest'
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
  
  if (request.action === 'ollamaRequest') {
    console.log('Background script received ollamaRequest:', { model: request.model, promptLength: request.prompt.length });
    handleOllamaRequest(request.model, request.prompt)
      .then(data => {
        console.log('Ollama request successful, response length:', data.length);
        sendResponse({ success: true, data: data });
      })
      .catch(error => {
        console.error('Ollama request failed:', error.message);
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

// Handle Ollama API requests using fetch API via proxy server (bypasses CORS)
async function handleOllamaRequest(model, prompt) {
  const ollamaUrl = 'http://localhost:8080/api/generate';
  
  const requestBody = {
    model: model,
    prompt: prompt,
    stream: false
  };
  
  console.log('Sending Ollama request with payload:', requestBody);
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    
    const response = await fetch(ollamaUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    console.log('Ollama fetch response status:', response.status);
    console.log('Ollama fetch response ok:', response.ok);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Ollama API error details:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      throw new Error(`Ollama API error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const data = await response.json();
    
    if (!data.response) {
      throw new Error('No response from Ollama');
    }
    
    console.log('Ollama request successful, response length:', data.response.length);
    return data.response.trim();
    
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Ollama request timed out after 60 seconds');
    }
    console.error('Ollama request error:', error.message);
    throw error;
  }
}

// Check Ollama status using fetch API via proxy server
async function checkOllamaStatus() {
  console.log('Checking Ollama status...');
  
  try {
    // Simple check to see if Ollama is running
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
    
    // Try to connect via proxy - check if proxy and Ollama are working
    const response = await fetch('http://localhost:8080/api/tags', {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Accept': 'application/json'
      }
    });
    
    clearTimeout(timeoutId);
    
    // If we get here without an error, Ollama is probably running
    console.log('Ollama status check: Connected to Ollama');
    
    if (response.ok) {
      const data = await response.json();
      return data.models || [{ name: 'llama3.2:latest' }];
    } else {
      console.log('Ollama responded with status:', response.status);
      // Even with an error status, if we got a response, Ollama is running
      return [{ name: 'llama3.2:latest' }];
    }
  } catch (error) {
    console.error('Ollama status check failed:', error.message);
    
    // If it's a CORS error, Ollama might still be running
    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      console.log('Network error, but this might be CORS - assuming Ollama is available');
      return [{ name: 'llama3.2:latest' }];
    }
    
    // If we reach this point, Ollama is likely not running
    throw error;
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
