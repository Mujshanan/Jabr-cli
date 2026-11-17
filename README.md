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

## Command automation

Jabr supports command sequences and user-selected `.jabr` scripts. The terminal accepts:

```text
echo "Starting"; math "2*x + 3" && ast "2*x + 3"
```

- `;` runs the next command regardless of the previous command's result.
- `&&` runs the next command only when the previous command succeeds.
- Quoted separators are treated as ordinary argument text.
- Load a `.jabr` file with the **Load .jabr** button. Scripts run sequentially, ignore blank lines and `#` comments, and stop at the first failed command.
- Script files are limited to 1 MiB and are read only after the user selects them.

Example `examples/parser-check.jabr`:

```text
# Basic parser smoke test
echo "Checking Mathlex"
ast "2*x + sin(y)^2"
math "2*x + sin(y)^2"
echo "Finished"
```

## AI integration (MCP)

Jabr includes a separate local MCP server in `mcp-server/`. MCP-compatible AI hosts can call Jabr's parser without embedding an AI provider or exposing the browser terminal as a shell.

Available tools:

- `jabr_parse_math`
- `jabr_parse_latex`
- `jabr_math_to_latex`
- `jabr_latex_to_latex`
- `jabr_capabilities`

See [mcp-server/README.md](mcp-server/README.md) for build instructions and host configuration. The server uses stdio transport and writes diagnostics to stderr only.

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

Run the full local verification sequence:

```bash
pnpm verify
```

It runs TypeScript tests and typechecking, Rust tests, the production build, then installs and tests the MCP server and its Node-compatible WebAssembly build.

For individual checks:

```bash
pnpm test
pnpm typecheck
pnpm build
cargo test --locked --manifest-path rust/mathlex-bridge/Cargo.toml
pnpm mcp:verify
pnpm verify:security
```

On Windows, use `./verify.ps1` from PowerShell.

Both `pnpm-lock.yaml` and `rust/mathlex-bridge/Cargo.lock` are committed. CI enforces frozen/locked dependency resolution and runs JavaScript and Rust security audits.

## Project structure

```text
.
├── rust/
│   └── mathlex-bridge/  # Rust Mathlex parser exposed to JavaScript through WASM
├── mcp-server/         # Local MCP server for AI tool access
├── src/
│   ├── engine/          # Command parsing, sequences, Mathlex bridge and shared types
│   ├── command/         # Built-in application commands
│   └── interactive/     # Terminal UI, AST tree and math output renderers
├── verify.ps1           # Windows full verification entry point
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

Jabr CLI is an application command interface, not a system shell. Input is dispatched only to registered commands. It does not use `eval()` or run operating-system processes. User-selected `.jabr` files contain only registered Jabr commands. The MCP server exposes explicit parser operations only and does not expose arbitrary shell execution.
