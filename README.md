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

## OpenAI API Setup (Required for AI Features)

**Important**: This extension uses OpenAI's API for AI-powered summarization. You need to provide your own OpenAI API key to enable AI features.

### Quick Setup:

1. **Get an OpenAI API Key**:
   - Visit [OpenAI's API platform](https://platform.openai.com/api-keys)
   - Create an account or sign in
   - Generate a new API key (starts with `sk-`)
   - Copy the API key securely

2. **Configure the Extension**:
   - Click the extension icon in your browser
   - Click the "Settings" button
   - Paste your OpenAI API key in the "OpenAI API Key" field
   - Click "Save Settings"
   - The extension will automatically detect the API key and enable AI features

### Security & Privacy:

- Your API key is stored securely in your browser's local storage
- The API key is never shared or transmitted to any third parties
- All API calls go directly from your browser to OpenAI's servers
### Troubleshooting:

- **Extension shows "No API Key"**: Make sure you've entered your OpenAI API key in the settings
- **Extension shows "Invalid API Key"**: Verify your API key starts with `sk-` and is correctly copied
- **API rate limits**: If you see rate limit errors, wait a few minutes before trying again
- **Network errors**: Check your internet connection and ensure OpenAI's API is accessible

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
