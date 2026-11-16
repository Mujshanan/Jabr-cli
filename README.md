# Jabr CLI

A lightweight, browser-based command interface for an application, built with Vanilla HTML, CSS, TypeScript and a Rust/WebAssembly math parser.

Jabr CLI is a simulated application terminal, **not** an operating-system shell. It executes only commands registered by the host application. It does not execute arbitrary JavaScript or Windows commands.

## Stack

- Vanilla HTML and CSS
- TypeScript and Vite
- Rust with the [Mathlex](https://github.com/ChrisGVE/mathlex) expression parser
- WebAssembly via wasm-bindgen and wasm-pack
- Vitest and Cargo tests

No React or frontend framework is used.

## Requirements

- Node.js 20.19+ or 22.12+
- npm
- Rust toolchain (rustup and Cargo)
- wasm-pack
- WebAssembly target: `rustup target add wasm32-unknown-unknown`
- wasm-pack
- WebAssembly target: `rustup target add wasm32-unknown-unknown`

Install wasm-pack using its [official instructions](https://rustwasm.github.io/wasm-pack/installer/).

## Getting started

```bash
npm install
npm run dev
```

The development server and production build generate the WebAssembly package first. To generate it manually:

```bash
npm run wasm:build
```

## Commands

| Command | Description |
| --- | --- |
| `help` | List available commands |
| `ast "2*x + sin(y)^2"` | Parse a mathematical expression and display its AST |
| `echo <text>` | Print text |
| `clear` | Clear terminal output |
| `version` | Show the Jabr CLI version |
| `about` | Explain what Jabr CLI is |

## Tests and builds

```bash
npm test
npm run typecheck
npm run build
cargo test --manifest-path rust/mathlex-bridge/Cargo.toml
```

## Project structure

```text
.
├── rust/
│   └── mathlex-bridge/  # Rust Mathlex parser exposed to JavaScript through WASM
├── src/
│   ├── engine/          # Command parsing, Mathlex bridge and shared types
│   ├── command/         # Built-in application commands
│   └── interactive/     # Terminal UI and safe HTML AST tree renderer
├── index.html
├── package.json
└── vite.config.ts
```

## AST rendering

The `ast` command sends a plain-text mathematical expression to the Rust Mathlex parser. Rust serializes the resulting AST to JSON; TypeScript renders that structure as a nested HTML tree. The renderer escapes AST keys and values before inserting the generated markup.

Mathlex parses expressions only. It does not evaluate them or implement Jabr's worksheet language, variables, units or execution model.

## Safety boundary

Jabr CLI is an application command interface, not a system shell. Input is dispatched only to registered commands. It does not use `eval()` or run operating-system processes.
