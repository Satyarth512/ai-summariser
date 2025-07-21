# Ollama Setup Guide for Website Summarizer

This guide will help you set up Ollama to enable AI-powered summarization in the Website Summarizer extension.

## What is Ollama?

Ollama is a tool that allows you to run large language models locally on your machine. This means your data stays private and you don't need internet connectivity for AI summarization.

## Installation Steps

### 1. Install Ollama

**macOS:**
```bash
# Download and install from https://ollama.ai
# Or use Homebrew:
brew install ollama
```

**Linux:**
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

**Windows:**
Download the installer from https://ollama.ai

### 2. Start Ollama Service

```bash
# Start the Ollama service (runs on localhost:11434)
ollama serve
```

### 3. Download a Model

Choose one of these models (recommended: llama3.2):

```bash
# Recommended - Fast and efficient
ollama pull llama3.2

# Alternative options:
ollama pull llama3.1
ollama pull mistral
ollama pull gemma
```

### 4. Verify Installation

Test that Ollama is working:

```bash
# List installed models
ollama list

# Test the model
ollama run llama3.2 "Summarize: The quick brown fox jumps over the lazy dog."
```

## Extension Configuration

1. **Open Extension Options**:
   - Right-click the extension icon
   - Select "Options"

2. **Configure AI Settings**:
   - Select your preferred model (e.g., llama3.2)
   - Ensure "Prefer AI summarization when available" is checked
   - Save settings

3. **Check Status**:
   - Open the extension popup
   - Look for the status indicator:
     - 🟢 Green dot = AI Ready
     - 🔴 Red dot = AI Offline (will use fallback)

## Usage

1. Navigate to any website with substantial text content
2. Click the extension icon
3. Click "Summarize This Page"
4. The extension will:
   - Try AI summarization first (if Ollama is running)
   - Fall back to extractive summarization if needed

## Summary Lengths

- **Short (20-25 lines)**: Quick overview of main points
- **Medium (30-40 lines)**: Comprehensive summary with key details
- **Long (40-50 lines)**: Detailed summary with context and examples

## Troubleshooting

### Extension shows "AI Offline"
- Ensure Ollama service is running: `ollama serve`
- Check that you have a model installed: `ollama list`
- Verify Ollama is accessible at http://localhost:11434

### Poor summary quality
- Try a different model (llama3.2 is recommended)
- Adjust summary length in extension settings
- Ensure the webpage has substantial text content

### Extension permissions
- The extension needs permission to access localhost:11434
- This should be automatically granted when you install the extension

## Model Recommendations

| Model | Size | Speed | Quality | Best For |
|-------|------|-------|---------|----------|
| llama3.2 | ~2GB | Fast | High | General use (Recommended) |
| llama3.1 | ~4GB | Medium | Very High | Detailed summaries |
| mistral | ~4GB | Fast | High | Technical content |
| gemma | ~2GB | Fast | Good | Quick summaries |

## Privacy Benefits

- **Local Processing**: All AI processing happens on your machine
- **No Data Sharing**: Your content never leaves your device
- **Offline Capable**: Works without internet connection
- **No API Keys**: No need for external AI service accounts

## Performance Tips

- **RAM**: Ensure you have at least 8GB RAM for smooth operation
- **Storage**: Models require 2-8GB of disk space each
- **CPU**: Modern processors will provide better performance
- **Background Running**: Keep Ollama service running for instant summaries

## Support

If you encounter issues:
1. Check the browser console for error messages
2. Verify Ollama installation with `ollama --version`
3. Test model directly with `ollama run [model-name]`
4. Restart the Ollama service if needed

The extension will automatically fall back to extractive summarization if Ollama is not available, so you can always use the basic functionality even without AI setup.
