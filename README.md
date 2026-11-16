# Jabr CLI

A lightweight, browser-based command interface for an application, built with Vanilla HTML, CSS, TypeScript and a Rust/WebAssembly math parser.

Jabr CLI is a simulated application terminal, **not** an operating-system shell. It executes only commands registered by the host application. It does not execute arbitrary JavaScript or Windows commands.

## Stack

- Vanilla HTML and CSS
- TypeScript and Vite
- Rust with the [Mathlex](https://github.com/ChrisGVE/mathlex) expression parser
- WebAssembly via wasm-bindgen and wasm-pack
- Vitest and Cargo tests
- pnpm for JavaScript dependencies

No React or frontend framework is used.

## Requirements

- Node.js 20.19+ or 22.12+ (CI uses Node.js 24)
- pnpm 10.34.5
- Rust toolchain (rustup and Cargo)
- wasm-pack 0.15.1
- cargo-audit (for Rust dependency security checks)
- WebAssembly target: `rustup target add wasm32-unknown-unknown`

Install pnpm using [Corepack](https://pnpm.io/installation#using-corepack):

```bash
corepack enable
corepack prepare pnpm@10.34.5 --activate
```

Install the pinned wasm-pack release with Cargo:

```bash
cargo install wasm-pack --version 0.15.1 --locked
```

Install the Rust dependency auditor:

```bash
cargo install cargo-audit --locked
```

## Getting started

```bash
pnpm install
pnpm dev
```

### Windows production build

After installing the requirements above, run either `build.ps1` from PowerShell or `build.bat` from Command Prompt. Both scripts install the locked JavaScript dependencies, ensure the WebAssembly target is installed, and run the production build. The generated site is written to `dist/`.

PowerShell may require allowing locally created scripts to run for the current user; if so, use `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` in an elevated or appropriately authorized PowerShell session.

Vite listens on all interfaces so its preview can be opened from GitHub Codespaces. Use the patched Vite version in the lockfile whenever exposing this development server to a network.

The development server and production build generate the WebAssembly package first. To generate it manually:

```bash
pnpm wasm:build
```

## Try the AST commands

```text
ast "2*x + sin(y)^2"
ast-latex "\\frac{1}{2}"
```

## Commands

| Command | Description |
| --- | --- |
| `help` | List available commands |
| `ast "2*x + sin(y)^2"` | Parse a plain-text expression and display its AST |
| `ast-latex "\\frac{1}{2}"` | Parse a LaTeX expression and display its AST |
| `echo <text>` | Print text |
| `clear` | Clear terminal output |
| `version` | Show the Jabr CLI version |
| `about` | Explain what Jabr CLI is |

## Tests and builds

```bash
pnpm test
pnpm typecheck
pnpm build
cargo test --locked --manifest-path rust/mathlex-bridge/Cargo.toml
pnpm audit --audit-level=high
cargo audit --file rust/mathlex-bridge/Cargo.lock
```

Both `pnpm-lock.yaml` and `rust/mathlex-bridge/Cargo.lock` are committed. CI enforces frozen/locked dependency resolution and runs JavaScript and Rust security audits.

## Project structure

```text
.
├── rust/
│   └── mathlex-bridge/  # Rust Mathlex parser exposed to JavaScript through WASM
├── src/
│   ├── engine/          # Command parsing, Mathlex bridge and shared types
│   ├── command/         # Built-in application commands
│   └── interactive/     # Terminal UI and HTML AST tree renderer
├── index.html
├── package.json
└── vite.config.ts
```

## Mathlex API boundary

The Rust bridge exposes two independent parser functions:

- `parse_math(input)` parses plain-text mathematical notation using Mathlex's `parse_with_config` API with implicit multiplication enabled.
- `parse_latex(input)` parses LaTeX notation using Mathlex's dedicated `parse_latex` API.

Both return JSON using Mathlex's documented AST wire format: a node has a string `kind`, a `value` payload, and optional `annotations`. The TypeScript API validates the root node before returning it:

- `parseMathExpression(input)`
- `parseLatexExpression(input)`

The `ast` and `ast-latex` terminal commands exercise those respective APIs. Mathlex parses expressions only. It does not evaluate them or implement Jabr's worksheet language, variables, units or execution model.

## Safety boundary

Jabr CLI is an application command interface, not a system shell. Input is dispatched only to registered commands. It does not use `eval()` or run operating-system processes.
