# Elsa-Discord

A feature-rich Discord bot built with TypeScript, Discord.js, and TypeORM. Combines utility management, gaming features, and entertainment commands in a single bot.

## Features

- **Modular command architecture** - Easy to extend with new commands
- **Database integration** - SQLite with TypeORM for persistent data
- **Hot reload support** - Update commands without restarting the bot
- **Permission-based access** - Maintainer and whitelist based authorization
- **Custom commands** - Users can create custom commands dynamically
- **AI chat** - Switchable bot personalities, per channel conversation context, Gemini and Mistral models
- **Multiple integrations** - Pokemon, Valorant, translation, and more

## Setup

### Prerequisites

- Node.js 16.x - 17.x
- npm or yarn
- A Discord bot token

### Installation

1. Rename `.env.example` to `.env` and fill in the required values:

| Variable | Description |
| --- | --- |
| DISCORD_TOKEN | The Discord bot token from [Discord Developer Portal](https://discord.com/developers/applications) |
| TRIGGER | The prefix for bot commands (e.g., `!`, `$`) |
| MAINTAINER | Your Discord user ID for maintainer-only commands |
| WHITELIST | Discord user IDs allowed to use the restricted commands (semicolon-separated) |
| LOG_DB | Set to `true` to log every database query |
| GEMINI_API_KEY | [Google AI Studio](https://aistudio.google.com/apikey) key, for the Gemini models |
| MISTRAL_API_KEY | [Mistral](https://console.mistral.ai/) key, for the Mistral models |

2. Install dependencies:
```bash
npm install
```

3. Build and run:
```bash
npm run build && npm start
```

## Commands

### 🛠️ Dev Commands
Maintainer-only utilities for bot management.

| Command | Description |
| --- | --- |
| `command-list` | Lists all available commands |
| `hot-reload` | Reloads the bot without restart |
| `info` | Shows information about the bot |
| `kill` | Terminates the bot process |
| `ping` | Responds with latency stats |
| `tts` | Sends a message as text-to-speech |
| `uptime` | Displays bot uptime |

### 🎮 Discord Management
Server and role administration commands.

| Command | Description |
| --- | --- |
| `clean-channel [channel], [user]` | Delete messages from a channel, optionally only one user's |
| `clean-stop [channel]` | Abort a running `clean-channel` |
| `create-role [role name]` | Create a new Discord role |
| `remove-roles [userID]` | Remove roles from a user |
| `snapchat [toggle]` | Enable/disable "Snapchat mode" - messages auto-delete after 1 minute |

### 🎲 Misc Commands
Fun and utility commands for entertainment.

| Command | Description | Aliases |
| --- | --- | --- |
| `bad-translate [text]` | Translates text through 10 random languages | `translate10`, `chaos-translate`, `pot9`, `melting-pot9` |
| `bible [verse]` | Fetches Bible verses | — |
| `quran [verse]` | Fetches Quranic verses | — |
| `wiki [query]` | Wikipedia search | — |
| `urban-dictionary [term]` | Urban Dictionary lookup | — |
| `poll [question]` | Creates a reaction poll | — |
| `timer [duration]` | Sets a timer | — |
| `elections [country]` | Bogus election | — |
| `lagrange-squares [number]` | Lagrange's four-square calculation | — |

### 🎮 Pokémon Commands
Interact with Pokémon data and competitive gaming.

| Command | Description |
| --- | --- |
| `data [pokemon]` | Shows detailed stats, types, and abilities of a Pokémon |
| `rand-poke` | Displays a random Pokémon |
| `bdsp-sets` | Pokémon Brilliant Diamond/Shining Pearl competitive sets |
| `bdsp-tower` | Battle Tower data for BDSP |
| `bdsp-trainers` | Battle Tower trainer information |
| `ladder [player]` | Pokémon Showdown ladder stats for a player |

### 🎯 Valorant Commands
Competitive gaming integrations.

| Command | Description |
| --- | --- |
| `valorant-rank [player]` | Display player rank and stats |

### 🤖 AI Commands
Chat with the AI, and shape the personality it answers with.

| Command | Description | Aliases |
| --- | --- | --- |
| `ai [message]` | Ask the AI, keeping the context of the channel. Also works as a reply to a message | `ask`, `chat` |
| `reset-ai` | Clear the conversation context of the channel | `ai-reset`, `clear-ai`, `forget` |
| `ai-status` | Show the active chat bot, its model and the size of the context | `ai-info`, `current-chat-bot` |
| `list-chat-bots` | List the chat bot personalities, `>` marks the active one | `list-chatbots`, `chat-bots` |
| `ai-models` | List the models a chat bot can use | `models`, `list-models` |
| `create-chat-bot [id], [model], [prompt]` | Create a personality (whitelist) | `create-chatbot`, `add-chat-bot` |
| `edit-chat-bot [id], [model], [prompt]` | Edit one, `-` keeps the current value (whitelist) | `update-chat-bot` |
| `delete-chat-bot [id]` | Delete a personality (whitelist) | `delete-chatbot`, `remove-chat-bot` |
| `switch-chat-bot [id]` | Switch the personality of the server, `default` goes back (whitelist) | `switch-chatbot`, `set-chat-bot` |
| `factoid [subject]` | Generate an unusual fact about a subject or a replied-to message | `fact`, `random-fact` |

The conversation context lives in memory, per channel: the last 24 messages, dropped after two hours
of silence, and wiped by `reset-ai`. The system prompt and the server context are rebuilt on every
request, so switching personality or model takes effect on the next message.

Models are referenced by a stable id (`gemini-flash`, `mistral-large`, ...) that points at the
current version of that model, so personalities keep working when a model is bumped.

### 📝 Custom Commands
Create and manage server-specific commands.

| Command | Description |
| --- | --- |
| `add-custom-command [name], [content]` | Create a new custom command |
| `delete-custom-command [name]` | Remove a custom command |
| `list-custom-commands` | View all custom commands on the server |

## Project Structure

```
src/
├── bot.ts              # Main bot class and event handlers
├── command.ts          # Base Command class
├── listener.ts         # Event listener interface
├── context.ts          # Command execution context
├── command-loader.ts   # Dynamic command/listener loading
├── http-client.ts      # HTTP utilities for API calls
├── ai/                 # AI providers, model registry, personalities, chat context
├── commands/           # Command implementations
│   ├── ai-chat/        # AI chat and chat bot management commands
│   ├── dev/            # Developer commands
│   ├── discord/        # Discord management commands
│   ├── misc/           # Miscellaneous commands
│   ├── pokemon/        # Pokémon-related commands
│   ├── valorant/       # Valorant-related commands
│   └── custom-commands/# Custom command management
├── database/           # TypeORM database configuration
├── utils/              # Helper utilities
└── listeners/          # Event listeners
```

## Architecture

The bot follows a modular command pattern:
- Each command implements the `Command` interface
- Commands are dynamically loaded from the `commands/` directory
- Listeners handle Discord events and can respond to commands
- Database operations are centralized through the `BotRepository`
- Permission checks are performed per command, against the maintainer and the whitelist
- AI commands go through `src/ai`: a provider per API, a registry of models, and a chat
  service that assembles the personality, the server context and the channel history

## Development

### Build
```bash
npm run build
```

### Run
```bash
npm start
```

### Clean build artifacts
```bash
npm run clean
```

## License

ISC
