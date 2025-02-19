# My Cascade - AI Coding Assistant for VSCode

My Cascade is a powerful AI-powered coding assistant VSCode extension that leverages Google's Gemini Pro and OpenAI's GPT models to assist with code writing, analysis, and refactoring.

## Key Features

- 💡 **Real-time Code Completion**: Context-aware code suggestions
- 🔍 **Code Analysis**: Detailed explanations and improvement suggestions for selected code
- 🛠 **Refactoring Support**: Specific refactoring suggestions for code quality improvement
- 📝 **Natural Language Processing**: Natural conversational coding support in both English and Korean
- 📎 **File Attachment**: Attach code files for more accurate context understanding

## Installation

1. Search for "My Cascade" in VSCode Marketplace
2. Or install the `.vsix` file directly:
   ```bash
   code --install-extension my-cascade-[version].vsix
   ```

## Usage

1. API Key Setup
   - Configure OpenAI API key or Google AI API key
   - Set `my-cascade.apiKey` or `my-cascade.geminiApiKey` in VSCode settings

2. Basic Usage
   - Open command palette with `Cmd/Ctrl + Shift + P`
   - Select "Start Cascade Session"
   - Start chatting with AI in the chat panel

3. Keyboard Shortcuts
   - Start session: `Cmd/Ctrl + Shift + C`
   - Code analysis: Select code and press `Alt + A`
   - Switch AI provider: Click AI icon in status bar

## Development Setup

```bash
# Install dependencies
npm install

# Run in development mode
npm run watch

# Debug in VS Code (F5)
```

## Tech Stack

- TypeScript
- VS Code Extension API
- Google AI (Gemini Pro)
- OpenAI GPT
- Node.js

## License

MIT License - See [LICENSE](LICENSE) file for details.

## Contributing

Bug reports, feature suggestions, and pull requests are welcome. 
Please see [CONTRIBUTING.md](CONTRIBUTING.md) for detailed contribution guidelines. 