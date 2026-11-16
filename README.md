# Jabr CLI

A lightweight, browser-based command interface for an application, built with Vanilla HTML, CSS, TypeScript and a Rust/WebAssembly math parser.

Jabr CLI is a simulated application terminal, **not** an operating-system shell. It executes only commands registered by the host application. It does not execute arbitrary JavaScript or Windows commands.

## Stack

- Vanilla HTML and CSS
- TypeScript and Vite
- Rust with the [Mathlex](https://github.com/ChrisGVE/mathlex) expression parser
- WebAssembly via wasm-bindgen and wasm-pack
- KaTeX and MathJax for browser-side mathematical typesetting
- Vitest and Cargo tests
- Bun (preferred) or npm for JavaScript dependencies

No React or frontend framework is used.

## Requirements

- Bun (recommended), or Node.js 20.19+ / 22.12+ with npm

Install Bun using the official instructions at https://bun.sh/docs/installation. For the npm workflow, install Node.js from https://nodejs.org/; npm is included.
- Rust toolchain (rustup and Cargo)
- wasm-pack 0.15.1
- cargo-audit (for Rust dependency security checks)
- WebAssembly target: `rustup target add wasm32-unknown-unknown`

Install the pinned wasm-pack release with Cargo:

```bash
cargo install wasm-pack --version 0.15.1 --locked
```

Install the Rust dependency auditor:

```bash
cargo install cargo-audit --locked
```

## Getting started

Bun (recommended):

```bash
bun install
bun run dev
```

Or use npm:

```bash
npm install
npm run dev
```

### Windows production build

After installing the requirements above, run `build.ps1` from PowerShell or `build.bat` from Command Prompt. Bun is the default. To use npm, run `./build.ps1 -PackageManager npm` in PowerShell or `build.bat npm` in Command Prompt. Both scripts install dependencies from the matching lockfile, ensure the WebAssembly target is installed, and build the site into `dist/`.

PowerShell may require allowing locally created scripts to run for the current user; if so, use `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` in an elevated or appropriately authorized PowerShell session.

Vite listens on all interfaces so its preview can be opened from GitHub Codespaces. Use the patched Vite version in the lockfile whenever exposing this development server to a network.

The development server and production build generate the WebAssembly package first. To generate it manually:

```bash
bun run wasm:build
# or
npm run wasm:build
```

## Try the AST commands

```text
ast "2*x + sin(y)^2"
ast-latex "\\frac{1}{2}"
```


## Mathematical output

Jabr uses Mathlex to parse expressions and serialize its AST back to LaTeX. It then sends that LaTeX to a browser renderer. Parsing, serialization and rendering remain separate responsibilities.

```text
math "2*x + sin(y)^2"
math-latex "\\frac{1}{2}"
```

Each mathematical output block has a renderer switch:

- **KaTeX** is the default, fast synchronous renderer.
- **MathJax** is available when broader TeX support is needed; its typesetting is asynchronous.

The LaTeX source is available under each rendered expression. Both renderers are loaded from pinned jsDelivr CDN URLs in index.html, so this first version requires an internet connection to load their scripts, CSS and fonts. The parser and Rust/WASM engine remain local. A later packaging step can vendor the renderer assets for fully offline use.

## Commands

| Command | Description |
| --- | --- |
| `help` | List available commands |
| `math "2*x + sin(y)^2"` | Parse plain-text notation and render the expression |
| `math-latex "LaTeX expression"` | Parse LaTeX and render the expression |
| `ast "2*x + sin(y)^2"` | Parse a plain-text expression and display its AST |
| `ast-latex "\\frac{1}{2}"` | Parse a LaTeX expression and display its AST |
| `echo <text>` | Print text |
| `clear` | Clear terminal output |
| `version` | Show the Jabr CLI version |
| `about` | Explain what Jabr CLI is |

## Tests and builds

Bun:

```bash
bun run test
bun run typecheck
bun run build
```

npm:

```bash
npm test
npm run typecheck
npm run build
npm audit --audit-level=low
```

Both `bun.lock` and `package-lock.json` are committed. Use the lockfile corresponding to your package manager. CI installs dependencies and runs tests/builds with both Bun and npm, and also checks the Rust dependency lockfile and security audit.

## Project structure

```text
.
├── rust/
│   └── mathlex-bridge/  # Rust Mathlex parser exposed to JavaScript through WASM
├── src/
│   ├── engine/          # Command parsing, Mathlex bridge and shared types
│   ├── command/         # Built-in application commands
│   └── interactive/     # Terminal UI, AST tree and math output renderers
├── index.html
├── package.json
└── vite.config.ts
```

## Mathlex API boundary

The Rust bridge exposes two independent parser functions:

- `parse_math(input)` parses plain-text mathematical notation using Mathlex's `parse_with_config` API with implicit multiplication enabled.
- `parse_latex(input)` parses LaTeX notation using Mathlex's dedicated `parse_latex` API.
- `math_to_latex(input)` parses plain text and serializes the AST using Mathlex's `ToLatex` trait.
- `latex_to_latex(input)` parses LaTeX and serializes the AST back to normalized LaTeX.

Both parser functions return JSON using Mathlex's documented AST wire format: a node has a string `kind`, a `value` payload, and optional `annotations`. The TypeScript API validates the root node before returning it:

- `parseMathExpression(input)`
- `parseLatexExpression(input)`

The `ast` and `ast-latex` commands exercise the parser APIs. The `math` and `math-latex` commands use the serializer APIs before rendering the resulting LaTeX. Mathlex parses expressions only. It does not evaluate them or implement Jabr's worksheet language, variables, units or execution model.

## Safety boundary

Jabr CLI is an application command interface, not a system shell. Input is dispatched only to registered commands. It does not use `eval()` or run operating-system processes.
