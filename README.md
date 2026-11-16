# Jabr CLI

A lightweight, browser-based command interface for an application, built with Vanilla HTML, CSS, and TypeScript.

Jabr CLI is a simulated application terminal, **not** an operating-system shell. It executes only commands registered by the host application. It does not execute arbitrary JavaScript or Windows commands.

## Stack

- Vanilla HTML and CSS
- TypeScript
- Vite for local development and production builds
- Vitest for unit tests

No React or frontend framework is used.

## Requirements

- Node.js 20.19+ or 22.12+
- npm

## Getting started

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Available commands

| Command | Description |
| --- | --- |
| `help` | List registered commands |
| `echo <text>` | Print text |
| `clear` | Clear terminal output |
| `version` | Show the Jabr CLI version |
| `about` | Explain what Jabr CLI is |

## Scripts

```bash
npm run dev        # Start the Vite development server
npm run typecheck  # Check TypeScript types
npm test           # Run unit tests once
npm run test:watch # Run tests in watch mode
npm run build      # Type-check and create the production build
npm run preview    # Preview the production build
```

## Project structure

```text
.
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
└── src/
    ├── engine/       # Parsing, command registry, dispatch and shared types
    ├── command/      # Built-in and application command definitions
    └── interactive/  # Terminal UI, DOM event handling and styles
        ├── main.ts
        └── style.css
```

## Architecture

- **Engine:** Parses command input, stores registered commands, dispatches execution and defines shared interfaces. It is independent of the DOM.
- **Command:** Defines application actions independently of the terminal UI.
- **Interactive:** Handles the terminal display, DOM events, input history and styling.

Commands receive a small `TerminalContext` for writing output or clearing the terminal. This keeps command logic separate from DOM rendering and makes it possible to connect application services later.

## Safety boundary

Jabr CLI is an application command interface, not a system shell. Input is dispatched only to registered commands. It does not use `eval()` and does not run operating-system processes.
