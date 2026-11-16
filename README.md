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
    ├── main.ts
    ├── style.css
    ├── commands/
    │   └── register.ts
    └── engine/
        ├── dispatcher.ts
        ├── parser.ts
        ├── parser.test.ts
        ├── registry.ts
        └── types.ts
```

## Architecture

- **Terminal UI:** HTML, CSS and the DOM code in `src/main.ts`.
- **Parser:** Converts a command line into a command name and arguments. Quoted arguments and escaped spaces are supported.
- **Registry:** Stores explicitly registered commands.
- **Dispatcher:** Finds and runs a registered command and handles parsing/execution errors.
- **Command modules:** Define application actions independently of the terminal UI.

Commands receive a small `TerminalContext` for writing output or clearing the terminal. This keeps command logic separate from DOM rendering and makes it possible to connect application services later.

## Safety boundary

Jabr CLI is an application command interface, not a system shell. Input is dispatched only to registered commands. It does not use `eval()` and does not run operating-system processes.
