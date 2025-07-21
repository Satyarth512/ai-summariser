# Installation Guide - Website Summarizer Extension

## Quick Start

1. **Load the Extension**:
   - Open Chrome or Edge browser
   - Navigate to `chrome://extensions/` (or `edge://extensions/`)
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select this folder (`summariser`)

2. **Test the Extension**:
   - Navigate to any news article or blog post
   - Click the extension icon in your browser toolbar
   - Click "Summarize This Page"
   - Wait for the summary to appear

## Features Overview

- **Smart Summarization**: Extracts key sentences from web content
- **Customizable Length**: Short, medium, or long summaries
- **Beautiful UI**: Modern gradient interface
- **History Tracking**: Saves your summaries locally
- **Settings Page**: Right-click extension icon → Options

## Icon Note

The extension currently uses placeholder icons. For production use, replace the files in the `icons/` folder with proper PNG images:
- `icon16.png` (16x16 pixels)
- `icon48.png` (48x48 pixels) 
- `icon128.png` (128x128 pixels)

## Troubleshooting

- **Extension not loading**: Make sure Developer mode is enabled
- **No summary generated**: Try on pages with substantial text content
- **Permissions error**: The extension only needs activeTab and storage permissions

## Next Steps

- Test on various websites (news, blogs, articles)
- Customize settings via the Options page
- Check the summary history feature
- Provide feedback for improvements
