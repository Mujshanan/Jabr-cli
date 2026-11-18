# Jabr Development Guide

> **Architecture baseline (2026-11-18):** Jabr Math owns mathematical parsing, AST, values, units, and evaluation. Jabr-engine (a planned, not-yet-created repository) owns worksheet graph construction, dependency resolution, scheduling, bindings, and calculation-result lifecycle. Jabr-kernel supplies only generic primitives: NodeId/Port, Revision, Snapshot<T>, ResultStore<V>, generic graph, diagnostics, and spans. Jabr-table stores table structure and authored cell text; Math parses that text. Jabr-UI owns the product UI and authored BlockSuite/Yjs document. This baseline supersedes older references to Kernel-owned variable state or a separate Jabr API owning recalculation.

This guide explains how to build, test, and extend Jabr. Contributor process is documented in [CONTRIBUTING.md](../CONTRIBUTING.md); repository-wide coding-agent rules are in [AGENTS.md](../AGENTS.md).

## 1. What this repository is

Jabr is a standalone laboratory for developing and testing a locally maintained copy of the Calcpad Rust calculation engine. It provides:

- A simulated command terminal for the existing Mathlex experiment.
- A minimal worksheet page for testing the locally vendored Calcpad engine.
- Native and WebAssembly build paths.
- Tokenizer inspection using the locally vendored highlighter.
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
├── Vendored Calcpad Rust source (inside Jabr)
│   ├── copied core parser and evaluator
│   ├── required supporting crates
│   ├── Jabr-owned native/WASM bridge
│   └── optional tokenizer/highlighter source
└── Validation
    ├── Rust tests
    ├── browser/WASM checks
    ├── worksheet fixtures
    └── Python oracle checks
```

### Responsibilities

| Layer | Owns | Must not own |
|---|---|---|
| Vendored Calcpad Rust core | Parsing, calculation semantics, units, evaluation; source is maintained inside Jabr | Jabr UI state |
| Jabr adapter | Stable API, normalization, version/capability contract | Reimplementing parser semantics |
| Highlighter | Tokens, lexical metadata, source formatting | AST structure or evaluation |
| AST inspector | Tree/AST, JSON presentation, source navigation | Inventing AST nodes |
| Terminal | Registered application commands | Arbitrary OS shell execution |
| Python tests | Independent expected values and black-box checks | Runtime calculation engine |

## 3. Toolchain

The repository's current requirements are listed in [README.md](../README.md). Bun is the canonical and sole JavaScript package manager. Commit only `bun.lock`; do not maintain an npm lockfile.

Jabr's target engine setup is a local Cargo workspace. A clean checkout must not need `git submodule update`, network access to CivilKit, or an external engine API. The Calcpad source, required supporting crates, and applicable license/attribution files are vendored in the repository.

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
3. What tokens does the vendored highlighter produce?
4. What structured data, diagnostics, and report output does the engine expose?
5. Do native and WASM results agree?

Do not add complex worksheet-authoring features here unless they are needed to test an engine capability.

## 5. Tokenizer versus AST

The tokenizer identifies lexical units such as numbers, identifiers, operators, comments, and source positions. The AST represents the parser's structural interpretation of those tokens.

These are different outputs and must remain different in code, UI, tests, and documentation.

The vendored highlighter package provides tokenization. The local WASM conversion path does not expose a standalone AST. Because Jabr owns the copied Rust source, the AST inspector should expose the actual internal parser tree through a Jabr-owned Rust DTO; it must not depend on an external CivilKit API. See [the API audit](CIVILKIT-API-AUDIT.md) and [tokenizer/AST design](TOKENIZER-AST-DESIGN.md).

## 6. AST inspector target design

The document model has three explicit node types: **Text**, **Code**, and **Math**. Text owns headings, paragraphs, and inline content; Code owns executable source (JavaScript and/or Calcpad programming syntax, with language identity explicit); Math owns Calcpad mathematical expressions and functions. A node's declared type selects its parser—plain prose must never be sent to the math parser, and an invalid math expression must not be silently reclassified as text. Import/paste may offer classification suggestions, but must not silently change an explicitly selected node type.\n\nThe first AST implementation targets the actual Calcpad math parser/compiler. Calcpad's existing worksheet parser is line-oriented and handles text, headings, expressions, directives, and control flow; its internal `Expr` compiler representation also includes program constructs. Do not claim that the upstream parser already exposes three separate ASTs. The Jabr document model is a layer above that source language.\n\nThe planned inspector has four coordinated views:

- **Tree / AST:** expandable human-readable AST hierarchy.
- **JSON:** complete schema output and selected subtree.
- **Source:** original input with source span highlighting.
- **LaTeX:** mathematical rendering generated from supported AST nodes.

A node-details pane should show the node kind, operator/name/value, children, units or other kind-specific properties, and source span.

### Data flow

```text
Worksheet source
    ↓
Jabr's local Calcpad parser and AST inspection API
    ↓
Versioned Rust DTO
    ↓
Jabr TypeScript adapter
    ├── AST tree formatter
    ├── JSON view
    ├── source-span mapper
    └── AST-to-LaTeX formatter
```

The AST inspector should be a reusable frontend module, not coupled to terminal commands. The adapter must preserve Calcpad engine semantics and source locations. The initial DOM-based AST explorer is implemented in `src/interactive/ast-renderer.ts` and currently renders the Mathlex AST used by the terminal commands. It includes a tree, JSON/details panes, and a source panel. The source panel supports optional zero-based UTF-16 spans with end-exclusive offsets: selecting a tree node highlights its source range, and selecting highlighted source text selects the narrowest covering node. The current Mathlex AST does not include source positions, so live Mathlex results display source text without navigation. Do not infer AST spans from highlighter tokens. The future Rust DTO should retain UTF-8 byte offsets and the TypeScript adapter must convert them to UTF-16 before calling the explorer.

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

### Mathlex WebAssembly integration test

The ordinary TypeScript suite intentionally excludes the real-WASM integration test so it can run without a generated WASM package. Build the WASM package first, then run the integration test separately. The test reads the generated `.wasm` bytes and passes them to the wasm-bindgen initializer; it does not mock the parser.

With Bun:

```bash
bun run test
bun run engine:wasm:bun
bun run test:wasm
```

With npm:

```bash
npm test
npm run engine:wasm
npm run test:wasm
```

CI builds the WASM packages before running both test suites.

## 9. Development plan

The authoritative milestone and acceptance-criteria list is [ENGINE-LAB-PLAN.md](ENGINE-LAB-PLAN.md).

Current high-level sequence:

1. Vendor the Calcpad core, highlighter, and local WASM wrappers; remove submodule/API build dependencies. (source import and build-script migration implemented; verification pending)
2. Establish a reproducible native/WASM baseline from the vendored source.
3. Expose structured inspection outputs directly from the copied parser.
4. Add golden tests and independent Python comparisons.
5. Establish native/WASM parity.
6. Stabilize the engine adapter contract.
7. Hand off the adapter for integration into the separate notes application.
8. Continue the AST inspector UI prototype against Mathlex, then connect it to the real Calcpad AST API when source spans are available.

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

The Calcpad engine test page will use a minimal CodeMirror 6 editor for worksheet input. Keep the editor implementation isolated under `src/editor/`; the page reads the current document through a small editor API and remains responsible for invoking the Jabr's local Calcpad WASM engine. Do not couple CodeMirror to engine internals, AST DTOs, or the separate Mathlex terminal.

The initial feature set is automatic bracket/quote closing, bracket matching, indentation, undo/redo, and a compact completion popup for verified static mathematical names and Greek symbols. Worksheet-variable completion, units/constants catalogue generation, hover documentation, LSP, and AST-aware diagnostics are deferred. Keep package additions focused and maintain both Bun and npm lockfiles.


## Repository structure

The audited current tree, ownership boundaries, target package layout, and safe migration sequence are documented in [REPOSITORY-STRUCTURE.md](REPOSITORY-STRUCTURE.md). That document is additive: it does not authorize moving vendored Calcpad source, changing the Vanilla TypeScript/Vite workbench, or altering existing CI policy.
