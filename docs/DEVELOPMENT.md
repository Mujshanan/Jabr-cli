# Jabr Development Guide

This guide explains how to build, test, and extend Jabr. Contributor process is documented in [CONTRIBUTING.md](../CONTRIBUTING.md); repository-wide coding-agent rules are in [AGENTS.md](../AGENTS.md).

## 1. What this repository is

Jabr is a standalone laboratory for testing the CivilKit/Calcpad calculation engine. It provides:

- A simulated command terminal for the existing Mathlex experiment.
- A minimal worksheet page for testing CivilKit.
- Native and WebAssembly build paths.
- Tokenizer inspection using CivilKit's highlighter.
- Independent Python regression checks.
- A planned real-AST inspector.

The eventual notes application is a separate project. It should consume a stable engine adapter contract rather than import Jabr's terminal or depend on CivilKit internals.

## 2. Architecture and boundaries

```text
Jabr
├── Browser UI
│   ├── existing terminal
│   └── engine test page
├── TypeScript adapter
│   ├── initialization and version
│   ├── inspect / parse
│   ├── evaluate
│   └── normalized diagnostics and results
├── CivilKit Rust submodule
│   ├── calcpad-core
│   ├── worksheet CLI
│   ├── WASM wrapper
│   └── tokenizer/highlighter
└── Validation
    ├── Rust tests
    ├── browser/WASM checks
    ├── worksheet fixtures
    └── Python oracle checks
```

### Responsibilities

| Layer | Owns | Must not own |
|---|---|---|
| CivilKit Rust | Parsing, calculation semantics, units, evaluation | Jabr UI state |
| Jabr adapter | Stable API, normalization, version/capability contract | Reimplementing parser semantics |
| Highlighter | Tokens, lexical metadata, source formatting | AST structure or evaluation |
| AST inspector | Tree/ATS, JSON presentation, source navigation | Inventing AST nodes |
| Terminal | Registered application commands | Arbitrary OS shell execution |
| Python tests | Independent expected values and black-box checks | Runtime calculation engine |

## 3. Toolchain

The repository's current requirements are listed in [README.md](../README.md). The supported JavaScript package managers are Bun and npm. Keep their lockfiles and scripts consistent when changing dependencies.

Initialize the CivilKit submodule:

```bash
git submodule update --init --recursive
```

Build with Bun:

```bash
bun install
bun run build:bun
bun run dev:bun
```

Build with npm:

```bash
npm ci
npm run build
npm run dev
```

Windows helper scripts are available:

```powershell
./build.ps1
./build.ps1 -PackageManager npm
```

Or from Command Prompt:

```bat
build.bat
build.bat npm
```

## 4. Working on the engine test page

Run the development server and open `http://localhost:5173/engine-test.html`.

The engine test page is deliberately minimal. It should help answer these questions:

1. Does the native engine build and execute the worksheet?
2. Does the WASM engine accept the same worksheet?
3. What tokens does the upstream highlighter produce?
4. What structured data, diagnostics, and report output does the engine expose?
5. Do native and WASM results agree?

Do not add complex worksheet-authoring features here unless they are needed to test an engine capability.

## 5. Tokenizer versus AST

The tokenizer identifies lexical units such as numbers, identifiers, operators, comments, and source positions. The AST represents the parser's structural interpretation of those tokens.

These are different outputs and must remain different in code, UI, tests, and documentation.

The current highlighter WASM package provides tokenization. The current CivilKit WASM `convert` endpoint does not expose a standalone AST. The AST inspector must wait for a Rust-side API that returns the actual parser tree. See [the API audit](CIVILKIT-API-AUDIT.md) and [tokenizer/AST design](TOKENIZER-AST-DESIGN.md).

## 6. AST inspector target design

The planned inspector has four coordinated views:

- **Tree / ATS:** expandable human-readable AST hierarchy.
- **JSON:** complete schema output and selected subtree.
- **Source:** original input with source span highlighting.
- **LaTeX:** mathematical rendering generated from supported AST nodes.

A node-details pane should show the node kind, operator/name/value, children, units or other kind-specific properties, and source span.

### Data flow

```text
Worksheet source
    ↓
CivilKit parser and AST inspection API
    ↓
Versioned Rust DTO
    ↓
Jabr TypeScript adapter
    ├── ATS tree formatter
    ├── JSON view
    ├── source-span mapper
    └── AST-to-LaTeX formatter
```

The AST inspector should be a reusable frontend module, not coupled to terminal commands. The adapter must preserve engine semantics and source locations. Define offset units explicitly and convert Rust UTF-8 byte offsets to JavaScript UTF-16 positions before editor highlighting.

Do not copy AST Explorer application code; use its source/tree synchronization as an interaction reference. Keep the current frontend stack and review licenses before adding any tree or JSON-view dependency.

## 7. Inspection and evaluation are separate

The long-term adapter should expose distinct operations:

- `inspect(source)`: tokens if requested, AST, parser diagnostics, source mapping metadata.
- `evaluate(source, options)`: values, units, evaluation diagnostics, and report output.

An inspection request should not silently execute calculations. An evaluation request should not require the UI to parse generated HTML to recover values.

LaTeX is a formatting operation over supported AST nodes. It is not a substitute for the AST or evaluation output.

## 8. Testing strategy

Use multiple independent levels:

1. **Rust unit tests:** parser, AST DTO, serialization, and evaluator semantics.
2. **Native CLI tests:** real worksheet execution and deterministic report checks.
3. **WASM tests:** browser bindings, initialization, inspection/evaluation contract, and diagnostics.
4. **Golden fixtures:** representative scalar, unit, function, conditional, vector, and matrix worksheets as those features become supported.
5. **Python oracle:** independently calculate known values and compare them with native CLI output.
6. **Parity tests:** compare normalized native and WASM results.

Avoid brittle comparisons of generated HTML whitespace. Prefer structured output and semantic assertions.

## 9. Development plan

The authoritative milestone and acceptance-criteria list is [ENGINE-LAB-PLAN.md](ENGINE-LAB-PLAN.md).

Current high-level sequence:

1. Reproducible native/WASM baseline.
2. Complete API audit and expose structured inspection outputs.
3. Add golden tests and independent Python comparisons.
4. Establish native/WASM parity.
5. Stabilize the engine adapter contract.
6. Hand off the adapter for integration into the separate notes application.
7. Implement the AST inspector UI on top of the real AST API.

Do not mark planned work complete until its acceptance criteria and tests are satisfied.

## 10. Security and scope

Jabr is a simulated application terminal, not a shell. Commands must be explicitly registered. Do not add `eval()`, arbitrary JavaScript execution, or unrestricted OS command execution.

Treat worksheet input and generated HTML as untrusted. Keep generated report output sandboxed. Never enable scripts in generated report iframes without a documented security review.

## 11. Keeping documentation accurate

When a change affects architecture, toolchain, commands, API behavior, limitations, or milestone status:

- Update this guide if the development workflow changes.
- Update [ENGINE-LAB-PLAN.md](ENGINE-LAB-PLAN.md) when milestones or acceptance criteria change.
- Update [README.md](../README.md) for user-facing setup or command changes.
- Update [CONTRIBUTING.md](../CONTRIBUTING.md) for contribution workflow changes.
- Update [AGENTS.md](../AGENTS.md) if repository-wide agent constraints change.

Always distinguish implemented behavior from planned work and known limitations.

## 12. Worksheet editor

The CivilKit engine test page will use a minimal CodeMirror 6 editor for worksheet input. Keep the editor implementation isolated under `src/editor/`; the page reads the current document through a small editor API and remains responsible for invoking the CivilKit WASM engine. Do not couple CodeMirror to engine internals, AST DTOs, or the separate Mathlex terminal.

The initial feature set is automatic bracket/quote closing, bracket matching, indentation, undo/redo, and a compact completion popup for verified static mathematical names and Greek symbols. Worksheet-variable completion, units/constants catalogue generation, hover documentation, LSP, and AST-aware diagnostics are deferred. Keep package additions focused and maintain both Bun and npm lockfiles.
