# Jabr CLI

Jabr is a lightweight browser-based application terminal built with Vanilla HTML, CSS, TypeScript and Vite. The repository currently contains the original Mathlex expression-parser terminal and a separate minimal test page for the CivilKit Rust calculation engine.

Jabr CLI is a simulated application terminal, **not** an operating-system shell. It executes only commands registered by the host application. It does not execute arbitrary JavaScript or Windows commands.

## Stack

- Vanilla HTML and CSS
- TypeScript and Vite (no React or frontend framework)
- CivilKit Calcs Rust calculation engine, pinned as a Git submodule
- CivilKit's native worksheet CLI for the native build/smoke test
- CivilKit WebAssembly engine via wasm-pack/wasm-bindgen
- Existing Mathlex parser bridge retained temporarily for the original terminal commands
- KaTeX and MathJax for the original terminal's mathematical typesetting
- Vitest and Cargo tests
- Bun (preferred) or npm for JavaScript dependencies

## Requirements

- Git with submodule support
- Bun (recommended), or Node.js 20.19+ / 22.12+ with npm
- Rust toolchain (rustup and Cargo)
- wasm-pack **0.15.1**
- WebAssembly target: `rustup target add wasm32-unknown-unknown`

Install Bun using https://bun.sh/docs/installation. For npm, install Node.js from https://nodejs.org/.

Install the pinned wasm-pack release:

```bash
cargo install wasm-pack --version 0.15.1 --locked
```

The CivilKit source is pinned to commit `97f4bb698cea3bd6a9a4fae46dbc28b0d3ca5ffc` in `vendor/civilkit-calcs`. After cloning the repository, initialize it:

```bash
git submodule update --init --recursive
```

## Build sequence

The full build deliberately follows this order:

1. **Native CLI:** compile CivilKit's native `Cli` binary and run a small worksheet smoke test.
2. **WebAssembly:** compile CivilKit's `calcpad-wasm` crate for `wasm32-unknown-unknown` and generate browser bindings; then build the existing Mathlex compatibility bridge.
3. **Vite:** type-check TypeScript and build both browser pages.

Bun (Bun runtime and package manager):

```bash
bun install
bun run build:bun
bun run dev:bun
```

npm:

```bash
npm ci
npm run build
npm run dev
```

The native and WASM stages can also be run separately. Use `bun run engine:native:bun` and `bun run engine:wasm:bun` with Bun, or `npm run engine:native` and `npm run engine:wasm` with Node/npm.

## Minimal CivilKit test page

Start the development server and open:

```text
http://localhost:5173/engine-test.html
```

The page has only a worksheet editor, Run button, engine status/version, rendered report and calculation messages. It calls CivilKit's existing `convert` API through WebAssembly. The generated report is displayed in a sandboxed iframe; scripts in worksheet output are not enabled.

The existing terminal remains at `/`. It continues to use the Mathlex parser bridge while the CivilKit engine is evaluated separately. This is intentional: the current test harness validates CivilKit before the terminal's parser/execution architecture is migrated.

## Native CLI smoke test

The native build uses CivilKit's own CLI and a tiny fixture. With Bun, run `bun run engine:native:bun`; with npm, run `npm run engine:native`.

The script builds `vendor/civilkit-calcs/calcpad-cli`, runs it against `tests/fixtures/civilkit-smoke.cpd`, and checks that the generated HTML contains the expected result.

## Windows build

After installing the requirements and initializing the submodule, run `build.ps1` from PowerShell or `build.bat` from Command Prompt. Bun is the default. For npm:

```powershell
./build.ps1 -PackageManager npm
```

Or:

```bat
build.bat npm
```

PowerShell may require allowing locally created scripts to run for the current user; if so, use `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` where permitted.

Vite listens on all interfaces so its development server can be opened from GitHub Codespaces. The production build writes both pages to `dist/`.

## Existing terminal commands

```text
help
math "2*x + sin(y)^2"
math-latex "\\frac{1}{2}"
ast "2*x + sin(y)^2"
ast-latex "\\frac{1}{2}"
echo hello
version
about
clear
```

The Mathlex bridge parses expressions and serializes its AST to LaTeX. It does not evaluate worksheets. The CivilKit test page is the first integration of a full calculation engine.

## Tests

Bun:

```bash
bun run test
bun run typecheck:bun
bun run build:bun
```

npm:

```bash
npm test
npm run typecheck
npm run build
npm audit --audit-level=low
```

Rust:

```bash
cargo test --locked --manifest-path vendor/civilkit-calcs/Cargo.toml -p civilkit-calcs-engine
cargo test --locked --manifest-path rust/mathlex-bridge/Cargo.toml
```

CI builds the native CLI on Windows, tests the Rust engines, and builds the WebAssembly/Vite application with both Bun and npm.

## Project structure

```text
.
├── vendor/
│   └── civilkit-calcs/       # Pinned CivilKit source submodule
├── rust/
│   └── mathlex-bridge/       # Temporary parser bridge for the original terminal
├── scripts/
│   ├── build-native.mjs      # Native CLI build and smoke test
│   └── build-wasm.mjs        # CivilKit and Mathlex WebAssembly builds
├── src/
│   ├── engine/               # Terminal engine and generated WASM bindings
│   ├── command/              # Built-in terminal commands
│   └── interactive/          # Terminal UI and minimal engine test UI
├── tests/fixtures/
│   └── civilkit-smoke.cpd
├── index.html                # Existing terminal
└── engine-test.html          # Minimal CivilKit calculation test page
```

## Upstream and licensing

CivilKit Calcs is MIT-licensed and is itself a derivative of the MIT-licensed CalcpadCE project. Its upstream `LICENSE` and `NOTICE` are retained inside the pinned submodule. Preserve those notices in any redistributed build. See https://github.com/civilkit/civilkit-calcs for upstream source and history.

## Safety boundary

Jabr CLI is an application command interface, not a system shell. Input is dispatched only to registered commands. It does not use `eval()` or run operating-system processes.
