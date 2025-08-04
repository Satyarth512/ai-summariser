document.addEventListener('DOMContentLoaded', function() {
  const defaultLengthSelect = document.getElementById('defaultLength');
  const autoHighlightCheckbox = document.getElementById('autoHighlight');
  const saveHistoryCheckbox = document.getElementById('saveHistory');
  const openaiApiKeyInput = document.getElementById('openaiApiKey');
  const preferAICheckbox = document.getElementById('preferAI');
  const saveSettingsBtn = document.getElementById('saveSettings');
  const clearHistoryBtn = document.getElementById('clearHistory');
  const statusMessage = document.getElementById('statusMessage');
  const historyContainer = document.getElementById('historyContainer');
  
  // Load current settings
  loadSettings();
  loadHistory();
  
  // Removed model selection logic

  // Save settings
  saveSettingsBtn.addEventListener('click', function() {
    const apiKey = openaiApiKeyInput.value.trim();
    
    // Validate API key format
    if (apiKey && !apiKey.startsWith('sk-')) {
      showStatusMessage('Invalid API key format. OpenAI API keys start with "sk-"', 'error');
      return;
    }
    
    const settings = {
      summaryLength: defaultLengthSelect.value,
      autoHighlight: autoHighlightCheckbox.checked,
      saveHistory: saveHistoryCheckbox.checked,
      openaiApiKey: apiKey,
      preferAI: preferAICheckbox.checked
    };
    
    chrome.storage.sync.set(settings, function() {
      showStatusMessage('Settings saved successfully!', 'success');
    });
  });
  
  // Clear history
  clearHistoryBtn.addEventListener('click', function() {
    if (confirm('Are you sure you want to clear all summary history? This cannot be undone.')) {
      chrome.runtime.sendMessage({ action: 'clearHistory' }, function(response) {
        if (response.success) {
          showStatusMessage('History cleared successfully!', 'success');
          loadHistory(); // Refresh the history display
        } else {
          showStatusMessage('Error clearing history: ' + response.error, 'error');
        }
      });
    }
  });
  
  function loadSettings() {
    chrome.storage.sync.get({
      summaryLength: 'medium',
      autoHighlight: false,
      saveHistory: true,
      openaiApiKey: '',
      preferAI: true
    }, function(items) {
      defaultLengthSelect.value = items.summaryLength;
      autoHighlightCheckbox.checked = items.autoHighlight;
      saveHistoryCheckbox.checked = items.saveHistory;
      openaiApiKeyInput.value = items.openaiApiKey;
      preferAICheckbox.checked = items.preferAI;
    });
  }
  
  function loadHistory() {
    chrome.runtime.sendMessage({ action: 'getSummaryHistory' }, function(response) {
      if (response.success) {
        displayHistory(response.history);
      } else {
        historyContainer.innerHTML = '<p>Error loading history: ' + response.error + '</p>';
      }
    });
  }
  
  function displayHistory(history) {
    if (!history || history.length === 0) {
      historyContainer.innerHTML = '<p>No summaries in history yet.</p>';
      return;
    }
    
    let historyHTML = '';
    history.forEach(function(item) {
      const date = new Date(item.timestamp).toLocaleString();
      const domain = new URL(item.url).hostname;
      
      historyHTML += `
        <div class="history-item">
          <h4>${escapeHtml(item.title)}</h4>
          <div class="meta">
            ${domain} • ${date} • ${item.wordCount} words
          </div>
          <div class="summary">
            ${escapeHtml(item.summary)}
          </div>
        </div>
      `;
    });
    
    historyContainer.innerHTML = historyHTML;
  }
  
  function showStatusMessage(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    statusMessage.style.display = 'block';
    
    setTimeout(function() {
      statusMessage.style.display = 'none';
    }, 3000);
  }
  
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
});
