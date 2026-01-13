# PolliDev

<div align="center">
  <img src="./pollydev-logo-3d.png" alt="PolliDev Logo" width="200"/>
  
  **AI-Powered Development Environment with Native Pollinations Integration**
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![Version](https://img.shields.io/badge/version-1.96.0-blue.svg)](https://github.com/FabioArieiraBaia/pollidev)
  [![Pollinations](https://img.shields.io/badge/Powered%20by-Pollinations-purple.svg)](https://pollinations.ai)
  
  [Features](#-features) • [Installation](#-installation) • [Usage](#-usage) • [Contributing](#-contributing) • [License](#-license)
</div>

---

## 🌟 Overview

**PolliDev** is an advanced, AI-powered integrated development environment built on Visual Studio Code architecture with **native Pollinations.ai API integration**. It provides developers with seamless access to multiple AI models for code generation, completion, debugging, and creative assistance—all within a familiar and powerful IDE.

### Why PolliDev?

- 🎨 **Native Pollinations Integration**: Direct access to Pollinations' text and image generation APIs
- 🚀 **Enhanced Productivity**: AI-powered code completion and generation
- 🔧 **Built on VS Code**: All the power and extensions of VS Code
- 🎯 **Developer-Focused**: Designed specifically for development workflows
- 🌐 **Multi-Model Support**: Access to various AI models through Pollinations
- 💡 **Intelligent Assistance**: Context-aware code suggestions and debugging help

---

## ✨ Features

### Core Features

- **🤖 AI Code Completion**: Intelligent code suggestions powered by Pollinations AI models
- **📝 Code Generation**: Generate code from natural language descriptions
- **🐛 Smart Debugging**: AI-assisted debugging and error resolution
- **🎨 Image Generation**: Create images directly from the IDE using Pollinations' image API
- **💬 AI Chat Integration**: Interactive AI assistant for coding questions
- **🔄 Real-time Collaboration**: Share and collaborate on AI-generated code

### Pollinations Integration

- ✅ Direct API access to Pollinations services
- ✅ Support for multiple AI models (GPT, Claude, Llama, etc.)
- ✅ Image generation with customizable parameters
- ✅ Text generation with streaming support
- ✅ Built-in API key management
- ✅ Rate limiting and quota management

### IDE Features

- 📁 Full VS Code compatibility
- 🎨 Customizable themes and layouts
- 🔌 Extension marketplace access
- 🖥️ Integrated terminal
- 🔍 Advanced search and replace
- 📊 Git integration
- 🌍 Multi-language support

---

## 🚀 Installation

### Prerequisites

- **Operating System**: Windows, macOS, or Linux
- **Node.js**: Version 18.x or higher
- **Git**: For cloning the repository
- **Pollinations API Key**: (Optional, for enhanced features)

### Download

#### Option 1: Pre-built Binaries (Recommended)

Download the latest release for your platform:

- **Windows**: [PolliDev-Setup-1.96.0.exe](https://github.com/FabioArieiraBaia/pollidev/releases)
- **macOS**: [PolliDev-1.96.0.dmg](https://github.com/FabioArieiraBaia/pollidev/releases)
- **Linux**: [PolliDev-1.96.0.AppImage](https://github.com/FabioArieiraBaia/pollidev/releases)

#### Option 2: Build from Source

```bash
# Clone the repository
git clone https://github.com/FabioArieiraBaia/pollidev.git
cd pollidev

# Install dependencies
npm install

# Build the application
npm run build

# Run PolliDev
npm start
```

---

## 🎯 Usage

### Quick Start

1. **Launch PolliDev**: Open the application after installation
2. **Configure Pollinations**: Go to Settings → Pollinations API
3. **Start Coding**: Create a new file and start using AI features

### Using Pollinations Features

#### Text Generation

```javascript
// Press Ctrl+Shift+P (or Cmd+Shift+P on macOS)
// Type "Pollinations: Generate Code"
// Enter your prompt

// Example prompt:
"Create a React component for a user profile card"
```

#### Image Generation

```javascript
// Press Ctrl+Shift+P
// Type "Pollinations: Generate Image"
// Enter your image description

// Example:
"A futuristic cyberpunk cityscape at night"
```

#### AI Chat

```javascript
// Open AI Chat panel: Ctrl+Shift+A
// Ask questions about your code
// Get debugging help
// Request code explanations
```

### Configuration

Edit your `settings.json`:

```json
{
  "pollinations.apiUrl": "https://text.pollinations.ai",
  "pollinations.imageUrl": "https://image.pollinations.ai",
  "pollinations.defaultModel": "openai",
  "pollinations.temperature": 0.7,
  "pollinations.maxTokens": 2000,
  "pollinations.streaming": true
}
```

---

## 🔧 API Integration

### Text Generation Example

```javascript
const response = await fetch('https://text.pollinations.ai', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    messages: [
      { role: 'system', content: 'You are a helpful coding assistant' },
      { role: 'user', content: 'Write a Python function to sort a list' }
    ],
    model: 'openai'
  })
});
```

### Image Generation Example

```javascript
// Simple GET request
const imageUrl = 'https://image.pollinations.ai/prompt/cyberpunk%20city?width=1024&height=768';

// Or use the SDK
import { generateImage } from 'pollidev-sdk';

const image = await generateImage({
  prompt: 'A beautiful sunset over mountains',
  width: 1024,
  height: 768,
  model: 'flux'
});
```

---

## 📚 Documentation

- **[User Guide](./docs/user-guide.md)**: Complete user documentation
- **[API Reference](./docs/api-reference.md)**: Pollinations API integration details
- **[Developer Guide](./docs/developer-guide.md)**: Contributing and extending PolliDev
- **[Keyboard Shortcuts](./docs/shortcuts.md)**: Productivity tips and shortcuts
- **[Troubleshooting](./docs/troubleshooting.md)**: Common issues and solutions

---

## 🤝 Contributing

We welcome contributions from the community! Whether it's bug fixes, new features, documentation improvements, or feedback, we appreciate your help.

### How to Contribute

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Commit your changes**: `git commit -m 'Add amazing feature'`
4. **Push to the branch**: `git push origin feature/amazing-feature`
5. **Open a Pull Request**

### Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/pollidev.git
cd pollidev

# Install dependencies
npm install

# Run in development mode
npm run watch

# Run tests
npm test

# Build for production
npm run build
```

### Code Style

- Follow the existing code style
- Use ESLint and Prettier (configured in the project)
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed

---

## 🌐 Community

- **GitHub**: [github.com/FabioArieiraBaia/pollidev](https://github.com/FabioArieiraBaia/pollidev)
- **Issues**: [Report bugs or request features](https://github.com/FabioArieiraBaia/pollidev/issues)
- **Discussions**: [Join the conversation](https://github.com/FabioArieiraBaia/pollidev/discussions)
- **Pollinations**: [pollinations.ai](https://pollinations.ai)

---

## 📊 Project Status

### Current Version: 1.96.0

**Status**: Active Development 🚀

### Roadmap

- [x] Native Pollinations API integration
- [x] Multi-model AI support
- [x] Image generation features
- [x] AI chat integration
- [ ] Plugin marketplace
- [ ] Cloud synchronization
- [ ] Team collaboration features
- [ ] Mobile companion app
- [ ] Enhanced debugging tools

---

## 🏆 Acknowledgments

- **[Pollinations.ai](https://pollinations.ai)**: For providing the amazing AI infrastructure
- **[Visual Studio Code](https://code.visualstudio.com/)**: For the incredible editor foundation
- **[Electron](https://www.electronjs.org/)**: For the cross-platform framework
- **Community Contributors**: Thank you for your support and contributions!

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2024 Fabio Arieira Baia

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
```

---

## 🔒 Privacy & Security

- **No Data Collection**: PolliDev doesn't collect or store your personal data
- **API Security**: All API calls to Pollinations are encrypted
- **Local Processing**: Code analysis happens locally on your machine
- **Open Source**: Full transparency - audit the code yourself

---

## 🚨 Support

### Need Help?

- 📖 Check the [Documentation](./docs)
- 💬 Open a [Discussion](https://github.com/FabioArieiraBaia/pollidev/discussions)
- 🐛 Report a [Bug](https://github.com/FabioArieiraBaia/pollidev/issues)
- 📧 Contact: [fabio@arieirabaia.com](mailto:fabio@arieirabaia.com)

### Frequently Asked Questions

**Q: Is PolliDev free?**  
A: Yes! PolliDev is free and open-source under the MIT license.

**Q: Do I need a Pollinations API key?**  
A: Pollinations APIs are free to use without authentication for basic usage.

**Q: Can I use PolliDev offline?**  
A: Yes, the core IDE works offline. AI features require internet connection.

**Q: Is my code secure?**  
A: Yes, all code is processed locally. Only prompts you send to AI are transmitted.

---

## 🌟 Star History

If you find PolliDev useful, please consider giving it a ⭐️ on GitHub!

[![Star History Chart](https://api.star-history.com/svg?repos=FabioArieiraBaia/pollidev&type=Date)](https://star-history.com/#FabioArieiraBaia/pollidev&Date)

---

<div align="center">
  
  **Made with ❤️ by [Fabio Arieira Baia](https://github.com/FabioArieiraBaia)**
  
  **Powered by [Pollinations.ai](https://pollinations.ai)** 🌸
  
</div>
