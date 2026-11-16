# Jabr CLI

Jabr is a lightweight browser-based application terminal and Rust calculation-engine laboratory built with Vanilla HTML, CSS, TypeScript and Vite. The repository contains the original Mathlex expression-parser terminal and a separate test page for a locally maintained Calcpad Rust engine.

Jabr vendors the required Calcpad Rust calculation core and worksheet highlighter directly in this repository. The source is maintained as a local fork under `engine/`; the build does not require a CivilKit Git submodule or an external CivilKit API. Jabr is not the separate notes application that may eventually embed the engine through a custom calculation block.

Jabr CLI is a simulated application terminal, **not** an operating-system shell. It executes only commands registered by the host application.

## Project documentation

- [Development guide](docs/DEVELOPMENT.md)
- [Agent instructions](AGENTS.md)
- [Contributing guide](CONTRIBUTING.md)
- [Engine-lab development plan](docs/ENGINE-LAB-PLAN.md)
- [Upstream API audit](docs/CIVILKIT-API-AUDIT.md)
- [Tokenizer and AST design](docs/TOKENIZER-AST-DESIGN.md)

## Stack

- Vanilla HTML/CSS, TypeScript and Vite
- Vendored Calcpad Rust core in `engine/calcpad-core`
- Vendored worksheet tokenizer/highlighter in `engine/calcpad-highlighter`
- Local WebAssembly wrappers in `engine/calcpad-wasm` and `engine/calcpad-highlighter-wasm`
- Existing Mathlex compatibility bridge, retained for the original terminal prototype
- Vitest and Cargo tests
- Python standard-library black-box regression checks
- Bun (preferred) or npm

## Requirements

- Git
- Bun (recommended), or Node.js 20.19+ / 22.12+ with npm
- Rust toolchain (rustup and Cargo)
- wasm-pack **0.15.1**
- WebAssembly target: `rustup target add wasm32-unknown-unknown`
- Python 3.10+ for independent native regression checks

Install Bun from https://bun.sh/docs/installation. For npm, install Node.js from https://nodejs.org/.

Install wasm-pack:

```bash
cargo install wasm-pack --version 0.15.1 --locked
```

**No submodule initialization is required.** The Calcpad core and highlighter sources, their local Cargo manifests, and upstream license notices are included in this repository. Provenance and source revision are recorded in [engine/UPSTREAM.md](engine/UPSTREAM.md).

## Build

Bun:

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

The full build compiles the local native runner, both local Calcpad WebAssembly crates, the existing Mathlex bridge, and the Vite application. Native and WASM builds can also be run separately using the `engine:native` and `engine:wasm` scripts.

## Engine test page

Open `http://localhost:5173/engine-test.html` after starting the development server.

The page provides a minimal worksheet editor, Run, tokenizer inspection, engine status/version, report preview and calculation messages. The calculation and tokenizer WASM wrappers are built from the vendored local Rust crates. The generated report is displayed in a sandboxed iframe; worksheet scripts are not enabled.

The original terminal remains at `/` and continues to use the Mathlex bridge. It is deliberately separate from the Calcpad engine laboratory.

## Native regression checks

The native build creates `jabr-engine` from the local core crate and runs `tests/fixtures/civilkit-smoke.cpd`. After building, run:

```bash
python tests/python/run_civilkit_checks.py
```

The standard-library Python runner checks scalar arithmetic, variable evaluation, operator precedence and HTML report generation against independently calculated expected values.

## Rust tests

```bash
cargo test --manifest-path engine/Cargo.toml -p jabr-calcpad-core
cargo test --manifest-path engine/Cargo.toml -p jabr-calcpad-highlighter
cargo test --manifest-path rust/mathlex-bridge/Cargo.toml
```

CI builds the native engine on Windows, runs independent Python checks, tests the local Rust crates, and builds WebAssembly/Vite with both Bun and npm.

## Project structure

```text
.
├── engine/
│   ├── calcpad-core/             # Vendored Calcpad calculation engine
│   ├── calcpad-wasm/             # Jabr WASM wrapper for the core
│   ├── calcpad-highlighter/      # Vendored tokenizer/editor services
│   ├── calcpad-highlighter-wasm/ # Jabr WASM wrapper for the highlighter
│   ├── Cargo.toml                # Local Rust workspace
│   ├── LICENSE
│   ├── NOTICE
│   └── UPSTREAM.md               # Source revision and attribution
├── rust/mathlex-bridge/          # Temporary bridge for the original terminal
├── scripts/                      # Native and WASM build scripts
├── src/                           # TypeScript application and generated WASM
├── tests/                         # Fixtures and Python regression checks
├── index.html                     # Existing terminal
└── engine-test.html               # Minimal Calcpad test page
```

## Upstream and licensing

The vendored source originates from [CivilKit Calcs](https://github.com/civilkit/civilkit-calcs), which is a Rust port of [CalcpadCE](https://github.com/imartincei/CalcpadCE). The imported revision and engine ancestry are recorded in `engine/UPSTREAM.md`. Preserve the upstream MIT license, copyright notices and the Markdig BSD-2-Clause notice in `engine/NOTICE` when redistributing or modifying the vendored source.

## Safety boundary

Jabr is an application command interface, not a shell. It does not execute arbitrary JavaScript or Windows commands. Treat worksheet input and generated HTML as untrusted data.
