# Website Summarizer Browser Extension

A powerful browser extension that uses AI-powered text summarization to quickly extract key information from any website.

## Features

- **Smart Content Extraction**: Automatically identifies and extracts the main content from web pages
- **Intelligent Summarization**: Uses extractive summarization algorithms to create concise summaries
- **Customizable Length**: Choose between short (2-3 sentences), medium (1 paragraph), or long (2-3 paragraphs) summaries
- **Beautiful UI**: Modern, gradient-based interface with smooth animations
- **Summary History**: Automatically saves your summaries for later reference
- **Settings Page**: Customize your summarization preferences
- **Content Highlighting**: Option to highlight summarized sentences on the original page
- **Context Menu**: Right-click to summarize selected text (future feature)

## Installation

### For Development/Testing:

1. Clone or download this repository
2. Open Chrome/Edge and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension folder
5. The extension icon should appear in your browser toolbar

### For Production:

The extension can be packaged and submitted to the Chrome Web Store or Edge Add-ons store.

## CORS Proxy Setup (Required for AI Features)

**Important**: Due to browser CORS restrictions, the extension cannot directly connect to Ollama. You need to run a local proxy server to enable AI-powered summarization.

### Quick Setup:

1. **Start the Proxy Server**:
   ```bash
   node ollama-proxy.js
   ```
   
   The proxy will start on `http://localhost:8080` and forward requests to Ollama at `http://localhost:11434`.

2. **Verify Setup**:
   - Ensure Ollama is running: `ollama serve`
   - Ensure the proxy is running: You should see "Ollama proxy server running on http://localhost:8080"
   - The extension will automatically detect the proxy and enable AI features

### Troubleshooting CORS Issues:

- **Extension shows "AI Unavailable"**: Make sure both Ollama and the proxy server are running
- **Connection errors**: Verify that:
  - Ollama is running on port 11434: `curl http://localhost:11434/api/tags`
  - Proxy is running on port 8080: `curl http://localhost:8080/api/tags`
- **Port conflicts**: If port 8080 is in use, edit `ollama-proxy.js` and change the `PORT` variable

### How the Proxy Works:

The `ollama-proxy.js` file creates a simple HTTP proxy that:
- Runs on `localhost:8080`
- Forwards all requests to Ollama at `localhost:11434`
- Adds proper CORS headers to allow browser extension access
- Handles preflight OPTIONS requests

This solution keeps everything local and private while bypassing browser security restrictions.

## How to Use

1. **Basic Summarization**:
   - Navigate to any website with substantial text content
   - Click the extension icon in your browser toolbar
   - Click "Summarize This Page"
   - Wait for the AI to process and generate a summary

2. **Customize Settings**:
   - Right-click the extension icon and select "Options"
   - Adjust summary length preferences
   - Enable/disable automatic highlighting
   - Manage summary history

3. **View History**:
   - Access your previous summaries through the Options page
   - Summaries are saved locally in your browser

## Technical Details

### Architecture

- **Manifest V3**: Uses the latest Chrome extension architecture
- **Content Scripts**: Extract content from web pages
- **Background Service Worker**: Handles data persistence and messaging
- **Popup Interface**: Main user interaction point
- **Options Page**: Settings and history management

### Summarization Algorithm

The extension uses an extractive summarization approach:

1. **Content Extraction**: Identifies main content areas using semantic selectors
2. **Text Processing**: Cleans and normalizes extracted text
3. **Sentence Scoring**: Scores sentences based on:
   - Word frequency analysis
   - Position in document
   - Sentence length and structure
4. **Selection**: Chooses top-scoring sentences while maintaining original order
5. **Output**: Combines selected sentences into a coherent summary

### Privacy & Security

- **Local Processing**: All summarization happens locally in your browser
- **No External APIs**: No data is sent to external servers
- **Local Storage**: Summaries are stored locally using Chrome's storage API
- **Minimal Permissions**: Only requests necessary permissions (activeTab, storage)

## File Structure

```
summariser/
├── manifest.json          # Extension configuration
├── popup.html            # Main popup interface
├── popup.js              # Popup functionality
├── content.js            # Content extraction script
├── background.js         # Background service worker
├── options.html          # Settings page
├── options.js            # Settings functionality
├── icons/                # Extension icons
└── README.md            # This file
```

## Browser Compatibility

- **Chrome**: Version 88+ (Manifest V3 support)
- **Edge**: Version 88+ (Chromium-based)
- **Firefox**: Requires adaptation for Manifest V2
- **Safari**: Requires conversion to Safari Web Extension format

## Development

### Prerequisites

- Modern web browser with extension development support
- Basic knowledge of HTML, CSS, and JavaScript
- Understanding of browser extension APIs

### Local Development

1. Make changes to the source files
2. Reload the extension in `chrome://extensions/`
3. Test functionality on various websites
4. Check browser console for any errors

### Adding New Features

The extension is designed to be modular and extensible:

- **New Summarization Algorithms**: Modify the `generateSummary()` function in `popup.js`
- **Additional Content Sources**: Extend the content extraction logic in `content.js`
- **UI Enhancements**: Update the popup interface in `popup.html` and `popup.css`
- **External APIs**: Add API integration in the background script

## Troubleshooting

### Common Issues

1. **No Content Found**: Some websites use dynamic loading or have complex layouts
   - Solution: The extension includes fallback content extraction methods

2. **Poor Summary Quality**: Depends on the source content structure
   - Solution: Adjust summary length or try on different content types

3. **Extension Not Working**: Check browser compatibility and permissions
   - Solution: Ensure you're using a supported browser version

### Debug Mode

Enable debug logging by opening browser developer tools and checking the console for extension-related messages.

## Future Enhancements

- Integration with external AI APIs (OpenAI, Hugging Face)
- Support for PDF and document summarization
- Multi-language support
- Export summaries to various formats
- Social sharing features
- Advanced filtering and categorization

## Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues for bugs and feature requests.

## License

This project is open source and available under the MIT License.
