# OneMind

A Multi-AI Roleplay Sandbox built with React and the Vercel AI SDK. Create characters, design locations, and run AI-powered roleplay conversations with multiple AI providers.

![React](https://img.shields.io/badge/React-19-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)
![License](https://img.shields.io/badge/License-MIT-green)

## Preview

![OneMind Preview](OneMind%20Preview.jpeg)

## Architecture

![OneMind AI Architecture](OneMind%20AI%20Architecture.svg)

## Features

- **Multi-Character Conversations**: Create and manage multiple AI characters with distinct personalities
- **Location-Based Scenes**: Organize characters into group chats representing different locations
- **Multiple AI Providers**: Support for OpenAI, Anthropic, Google, Together.ai, OpenRouter, and xAI
- **Director Mode**: Guide scenes with director notes to steer the narrative
- **Character Tools**: Characters can speak, move between locations, and take notes
- **Smart Context Management**: Automatic summarization of older messages to manage token costs
- **World Import/Export**: Save and share your worlds as JSON files
- **Local Persistence**: All data saved to localStorage automatically

## Getting Started

### Prerequisites

- Node.js 18+ 
- An API key from one of the supported providers
- A model that supports **tool calling** (function calling) - required for character actions and worldbuilding

### Installation

```bash
# Clone the repository
git clone https://github.com/TheEpGuy/OneMind.git
cd OneMind

# Install dependencies
npm install

# Start the development server
npm run dev
```

### Configuration

1. Open the app and click the menu button (☰)
2. Go to the **Settings** tab
3. Select your AI provider and enter your API key
4. Configure the model name and optionally generation parameters

## Usage

### Creating a World

1. **Create Locations**: Go to the Chats tab and add group chats (these represent locations)
2. **Create Characters**: Go to the Characters tab and create characters, assigning them to locations
3. **Set the Scene**: Add exposition to locations to establish the setting

### Running a Conversation

1. Select a location from the main view
2. Choose who speaks next:
   - **You**: Type your own messages
   - **Director**: Add out-of-character directions to guide the scene
   - **Character Name**: That specific character responds using AI

### Import/Export

- **Export**: Settings → World tab → "Export Current World"
- **Import**: Settings → World tab → "Import World from File"

## Supported AI Providers

| Provider | Models |
|----------|--------|
| OpenAI | GPT Family |
| Anthropic | Claude Family |
| Google | Gemini & Gemma Family |
| xAI | Grok Family |
| Together.ai & OpenRouter | Various model families & providers |

## Development

```bash
npm run dev      # Start dev server
npm run build    # Build for production
npm run lint     # Run ESLint
npm run preview  # Preview production build
```

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **UI**: Tailwind CSS, shadcn/ui, Framer Motion
- **AI**: Vercel AI SDK
- **State**: React hooks with localStorage persistence

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

This is an early release. Issues and pull requests are welcome!