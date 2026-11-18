# Jabr Calcpad Engine Lab — Development Plan

> **Jabr ecosystem ownership update (2026-11-18):** This repository is the Math implementation/workbench, not the worksheet orchestrator. Math owns expression syntax, parsing, AST, values, quantities, units, dimensional semantics, and evaluation. Jabr-engine (planned; repository not yet created) owns graph construction, node/port mapping, dependency resolution, scheduling, and result lifecycle. Kernel owns only generic primitives including Revision, Snapshot<T>, ResultStore<V> keyed by NodeId, graph primitives, diagnostics and spans. Table stores authored cell text and structure; Math parses cell text. UI owns BlockSuite/Yjs authored document state and presentation. The Math facade may expose evaluation requests/results but must not mutate Kernel state or orchestrate the worksheet graph. This ownership note is authoritative over earlier API/architecture wording below.

> **Binary naming clarification:** the local `jabr-engine` executable under `engine/calcpad-core` is only this repository's native Calcpad smoke-test runner. It is not the separate Jabr-engine orchestration subsystem/repository planned by the ecosystem architecture.

## Purpose

Jabr is an isolated laboratory for developing and testing a locally maintained copy of the Calcpad Rust calculation engine before it is integrated into the separate notes application through a future custom block. The required engine source must live inside Jabr's repository; Jabr must not require the CivilKit API or a Git submodule at build or runtime. Jabr's UI remains deliberately small: enter a worksheet, execute it, and inspect every useful representation returned by the engine.

The notes application must not depend on CivilKit internals. It will eventually consume a stable, documented engine adapter contract.

## Design principles

1. Copy the required Calcpad Rust core source into Jabr and maintain it as a first-party vendored fork. Record the exact upstream repository/revision and preserve all applicable licenses, copyright notices, and attribution files.
2. Keep the vendored engine buildable from a clean Jabr checkout without initializing a submodule or calling an external CivilKit API.
3. Treat upstream Calcpad as the source of the engine, not as a runtime/service dependency or the final notes application.
3. Keep the browser UI minimal. The terminal and engine test page are developer tools.
4. Separate engine execution from presentation. HTML report output is one output format, not the canonical data model.
5. Do not claim AST or standalone LaTeX support until those outputs are exposed and tested directly.
6. Use Python as an independent oracle/test runner. Python must not become a runtime dependency of the Rust engine or browser application.
7. Keep all test inputs reproducible and compare native and WASM behavior against the same fixtures.

## Target architecture

```text
Jabr Engine Lab
├── UI
│   ├── minimal worksheet editor
│   ├── run / reset
│   └── output inspector
├── adapter
│   ├── initialize / version
│   ├── parse / inspect
│   ├── evaluate
│   └── normalize diagnostics and outputs
├── Jabr vendored Calcpad Rust engine (locally maintained fork)
│   ├── copied core parser and evaluator source
│   ├── units, vectors, matrices, solvers
│   ├── worksheet formatter / HTML report
│   ├── required supporting crates and assets
│   └── Jabr-owned AST / inspection / WASM bridge
└── independent tests
    ├── Rust unit and integration tests
    ├── browser/WASM tests
    ├── golden worksheet fixtures
    └── Python oracle checks
```

## Output contract to investigate and expose

For each worksheet, Jabr should be able to inspect these outputs independently:

| Output | Meaning | Current status |
|---|---|---|
| Source | Exact user-entered worksheet text | Available |
| AST | Structured syntax tree, preferably with source spans and node kinds | Investigation required; not currently exposed by the WASM `convert` response |
| LaTeX | Standalone mathematical representation for independent renderers | Investigation required; do not infer it from report HTML |
| Evaluation | Values, units, precision, and evaluation diagnostics | Available indirectly through the engine's worksheet/report output; a structured API is required |
| Calcpad HTML | Original formatter/report output | Available through the existing WASM `convert` API |
| Diagnostics | Source line, output line, category, message | Available through the existing WASM `convert` API |
| Highlighter data | Tokens, lint, prettification | Available in the separate CivilKit highlighter component; API integration to be evaluated |

The AST and LaTeX work must use the copied engine internals directly. Jabr may modify parser/compiler visibility and add its own serializable AST DTO where required; it must not reconstruct AST from tokens or report HTML, nor constrain itself to the upstream public API.

## Phases

### Phase 0 — Vendor the Calcpad Rust core and establish a reproducible baseline

- Identify the exact upstream Calcpad source revision currently used by the project and record its repository URL, revision, license, and attribution.
- Copy the Calcpad core parser/evaluator and supporting source into `engine/calcpad-core`; preserve the upstream MIT license and NOTICE.
- Copy the worksheet tokenizer/highlighter and its local WASM wrapper into `engine/calcpad-highlighter` and `engine/calcpad-highlighter-wasm` so the existing token inspector no longer requires the submodule.
- Copy the existing Calcpad WASM adapter into `engine/calcpad-wasm` and bind it to Jabr's local core package.
- Rename local Cargo packages where appropriate, add the local Cargo workspace, remove `.gitmodules`, and replace submodule-based build scripts/CI with local paths.
- Add a minimal native `jabr-engine` runner and point the Python black-box tests at it.
- Record the upstream repository/revision and license provenance in `engine/UPSTREAM.md`.
- Run native, Rust, WASM, and Python checks; fix any integration issues before declaring the milestone complete.

**Current progress:** source files, local manifests, native runner, local WASM wrappers, build scripts, CI configuration, and provenance files have been added. The environment used for this edit did not provide a local Rust toolchain/build, so compilation and smoke-test verification are still pending.

**Exit criteria:** a clean clone of Jabr builds the copied core and highlighter and runs native/WASM smoke checks without initializing a submodule or depending on an external CivilKit API.

### Phase 1 — Output observability and direct AST exposure

- Trace how the copied core engine turns source text into parsed expressions, evaluated values, and formatted HTML.
- Identify the internal expression representation and expose it through a Jabr-owned, versioned serialization DTO without changing calculation semantics.
- Define a versioned JSON inspection schema for AST nodes, source spans, LaTeX, values, units, and diagnostics.
- Add a native probe first; then expose the same contract to WASM.
- Keep HTML report generation as a separate formatter output.

**Exit criteria:** a fixture can return source, structured AST, LaTeX (or an explicit unsupported result), evaluation data, diagnostics, and HTML as distinct fields.

### Phase 2 — Golden tests and independent Python oracle

- Store representative worksheets as fixtures.
- Add Python standard-library tests for deterministic scalar results and report structure.
- Add optional SymPy comparisons for supported symbolic expressions.
- Add optional NumPy comparisons for supported vector/matrix operations.
- Compare numeric values with explicit tolerances; compare units and diagnostics separately.
- Save normalized JSON outputs for review; do not compare unstable HTML whitespace blindly.

**Exit criteria:** the same fixtures have repeatable expected outputs, and Python checks can detect a deliberate incorrect result.

### Phase 3 — Native/WASM parity

- Run the same fixture corpus through native and WASM adapters.
- Normalize platform-specific metadata and compare AST, values, units, diagnostics, and formatter output.
- Document intentional differences.
- Add CI jobs for Python oracle tests and native/WASM parity where practical.

**Exit criteria:** supported outputs agree across native and WASM within declared numeric tolerances.

### Phase 4 — Stable engine adapter

- Finalize a small TypeScript API independent of CivilKit-specific types.
- Keep initialization, execution, inspection, cancellation/disposal, version reporting, and errors explicit.
- Version the adapter contract.
- Add compatibility tests so a future engine replacement does not require changing the notes custom block.

**Exit criteria:** the notes application can consume the adapter without importing CivilKit packages or depending on the Jabr test UI.

### Phase 5 — Custom-block integration handoff

- Publish the adapter contract and WASM packaging instructions.
- Provide fixtures and expected outputs for the notes application's integration tests.
- Keep Jabr as a standalone engine lab after integration.

**Exit criteria:** the notes application can embed a calculation block while Jabr remains independently buildable and testable.

## Document node model and AST implementation milestone\n\nJabr uses three explicit document node types: **Text**, **Code**, and **Math**. The node type is authoritative and selects the relevant parser/renderer. Text supports headings, paragraphs, and inline content (including inline math where enabled); Code carries an explicit language identity for JavaScript and/or Calcpad programming syntax; Math carries Calcpad mathematical expressions, equations, and functions. Do not classify content by a simplistic letters-versus-numbers heuristic, silently retype a node, or send prose to the math parser. Import/paste may offer suggestions without changing the user's chosen type.\n\nThis is Jabr's document model, not a claim that Calcpad's existing parser already has three separate ASTs. The current Calcpad worksheet parser is line-oriented and processes headings/text, expression lines, directives, and control flow. Its internal compiler `Expr` tree includes both mathematical and programming constructs. The first AST delivery focuses on the real Calcpad math parser/compiler, then adds worksheet/document structure without fabricating nodes from highlighter tokens or rendered HTML. JavaScript AST support is a separate parser integration and must not be implied by Calcpad.\n\n### AST DTO foundation — started\n\n- Added `engine/calcpad-core/src/ast.rs` and exported it from the core crate.\n- Defined schema version 1, `Text`/`Code`/`Math` document-node discriminator, stable node IDs/kinds, ordered children, kind-specific attributes, optional source spans, diagnostics, and explicit partial-result status.\n- Source offsets are UTF-8 byte offsets in the Rust DTO; the TypeScript adapter must convert them to CodeMirror UTF-16 positions.\n- Added initial Rust unit tests for JSON shape and text nodes without a fabricated math AST.\n- **Not yet complete:** the Calcpad parser/compiler does not populate this DTO; source spans are not yet propagated; no WASM inspection endpoint or inspector UI exists.\n\n### Delivery sequence\n\n1. Wire the DTO to the actual Calcpad parser/compiler tree; preserve operator/function/variable/literal distinctions and child order.\n2. Trace and expose worksheet-level text, heading, code/control-flow, and math boundaries without changing Calcpad evaluation semantics.\n3. Propagate source spans from source parsing through the AST; define deterministic node IDs and UTF-8 byte coordinate rules.\n4. Add parse-only native `inspect` API with diagnostics and explicit partial/error behavior; inspection must not execute calculations.\n5. Expose the same versioned contract through WASM and TypeScript.\n6. Build the lightweight inspector UI (tree, JSON, details, source highlighting, token comparison).\n7. Add fixtures for plain text, headings, arithmetic, assignments, functions, units, Unicode, malformed expressions, and Calcpad control flow; verify native/WASM parity.\n\n**Acceptance criteria:** AST data comes from the copied Calcpad parser/compiler; Text/Code/Math are explicit document node types; parse-only inspection does not run calculations; every supported node has a stable kind and ordered children; source spans map correctly through Unicode; text is never misreported as a math parse; invalid math produces diagnostics rather than silent reclassification; native and WASM responses match the versioned schema.\n\n## AST inspector UI milestone

The AST inspector is a first-class developer tool inside Jabr's existing TypeScript/Vite application. It should borrow the interaction model of AST Explorer (source-to-tree synchronization and hierarchical inspection), but it must not import or copy AST Explorer application code. Keep Jabr's existing framework and review any third-party component licenses before adding dependencies.

### Inspector experience

The inspector should provide four coordinated views over the same selected AST node:

- **Tree / AST:** expandable, human-readable hierarchy with descriptive node labels. This is the default view.
- **JSON:** complete serialized AST and selected-node subtree, with copyable structured output.
- **Source:** original worksheet source with the selected node's source span highlighted.
- **LaTeX:** rendered mathematical representation of the selected expression where supported. LaTeX is a formatter output, not a substitute for the AST.

A node-details pane should show the selected node's kind, operator/name/literal, arguments, children, units or other kind-specific properties, and source location. Selecting a tree node highlights its source span; selecting source text should resolve to the narrowest corresponding AST node where possible. Tree expansion state should remain independent of selection.

### Frontend implementation boundary

Keep the inspector independent of the terminal and engine-test page so it can be reused later or adapted for the notes application's custom calculation block.

Suggested modules (adapt names to the current repository conventions):

- `src/ast/types.ts`: versioned Jabr-facing AST and diagnostic types.
- `src/ast/adapter.ts`: normalize Jabr AST DTOs without discarding engine semantics.
- `src/ast/formatter.ts`: human-readable ATS labels and tree formatting.
- `src/ast/source-map.ts`: map Rust source spans to editor positions.
- `src/ast/latex.ts`: AST-to-LaTeX formatting for supported expression nodes.
- `src/components/ast-inspector/`: tree, node details, JSON, and source-highlight views.

Use the repository's existing TypeScript/Vite stack. Prefer a lightweight accessible tree component or a small purpose-built renderer over importing a complete AST Explorer clone. Monaco decorations may be used if Monaco is already the editor; otherwise integrate with the existing editor API. Keep KaTeX as the rendering layer if it is already available or selected for Jabr. Do not introduce Vue/Nuxt or React solely for the inspector.

### Current implementation status

- The parser-neutral DOM explorer is implemented in `src/interactive/ast-renderer.ts` and mounted in the existing Mathlex terminal commands. It provides the expandable tree, selected-node details, full JSON, and copy actions.
- The source pane and bidirectional source/tree selection are implemented for nodes that carry valid spans. The UI boundary uses zero-based UTF-16 code-unit offsets with an end-exclusive end position.
- The current Mathlex AST does not provide source spans, so live Mathlex output shows source text without highlighting. The Calcpad highlighter's token spans are not substituted for AST spans.
- The next parser-side requirement is a genuine Calcpad AST with source spans, emitted by the local Rust parser and converted from UTF-8 byte offsets to UTF-16 in the TypeScript adapter.
- Tests cover normalized tree structure, stable node IDs, depth limits, and source-span validation. DOM interaction tests remain pending because the current Vitest environment is Node-only.

### Delivery order

1. Expose the real AST from Jabr's vendored parser through a versioned Rust inspection DTO; do not synthesize an AST from tokenizer output or report HTML.
2. Normalize the DTO in the Jabr adapter and preserve node kinds, child order, literals, units, diagnostics, and source spans.
3. Connect the existing tree/details/JSON/source explorer to the Calcpad DTO and add DOM interaction tests.
4. Add AST-to-LaTeX formatting and KaTeX rendering for explicitly supported node kinds; report unsupported constructs clearly.
5. Add fixtures and tests for tree labels, selection/source mapping, schema compatibility, Unicode offsets, and malformed input.

**Acceptance criteria:** a real Jabr/Calcpad parse result can be inspected as a readable tree and JSON; selecting a node highlights the corresponding source; source selection can identify its AST node where unambiguous; LaTeX is generated from the AST (not scraped from HTML); unsupported or partial results are explicit. The inspector remains separate from evaluation and does not change terminal behavior.

## Tokenizer and AST milestone

The browser test page is configured to build and load Jabr's vendored `calcpad-highlighter-wasm` package and display the actual tokenizer records (type, type ID, source text, line, UTF-16 column, and length). The AST panel is present but intentionally reports the current engine API limitation; it does not fabricate a tree from tokenizer output.

The AST DTO and source-span contract are documented in [TOKENIZER-AST-DESIGN.md](TOKENIZER-AST-DESIGN.md). The first Jabr-owned DTO scaffold now exists in `engine/calcpad-core/src/ast.rs`. The next implementation step is to populate it from a parse-only API in Jabr's local fork; the current RPN-to-`Expr` methods are crate-private and the compiler tree does not yet retain source spans.

## Initial audit result

The source-level audit is recorded in [CIVILKIT-API-AUDIT.md](CIVILKIT-API-AUDIT.md). The audit found that `MathParser` exposes public parse/evaluate/value APIs, while internal RPN and AST-construction methods are crate-private. Because Jabr owns a copy of the Rust source, the implementation can expose the existing internal expression tree directly through a Jabr-owned versioned DTO. Do not duplicate the parser or reverse-engineer AST/LaTeX from HTML.

## Immediate implementation scope

Phase 0 previously established the Python black-box regression runner and source-level API audit against the submodule snapshot. The Calcpad core, highlighter, and WASM wrapper sources have been imported into Jabr and the submodule reference removed. Native/WASM build and CI verification are the remaining Phase 0 exit criteria; do not mark vendoring complete until those checks pass from a clean checkout.


## Worksheet editor milestone (CodeMirror 6)

The CivilKit engine test page will use a minimal CodeMirror 6 editor instead of a plain textarea. This is an input/editor improvement only: the existing Mathlex terminal and CivilKit WASM adapter remain separate and unchanged.

### Scope

- Core editor state/view and a small TypeScript mount/dispose API.
- Automatic closing of brackets and quotes, bracket matching, indentation, undo/redo, and standard keyboard commands.
- A compact completion popup for a conservative set of verified mathematical function names and Greek symbols.
- Preserve the current worksheet content and keep Run/Tokenize reading the latest editor document.

### Constraints and exclusions

- Keep Vanilla HTML/CSS + TypeScript + Vite; no React/Vue, Monaco, LSP, language server, or additional parser.
- Add only focused CodeMirror packages required by the selected extensions.
- Do not couple the editor to CivilKit WASM or the future AST DTO. Semantic completion for worksheet variables, units, and constants is deferred until the relevant symbol catalogue/API is verified.
- Keep the editor UI compact and preserve the current engine status, report, tokenizer, and diagnostics panels.

### Delivery sequence

1. Mount CodeMirror in the existing engine-test page and preserve source read/write behavior.
2. Add bracket/quote closing, matching, indentation, history, and keyboard commands.
3. Add static completion for verified functions and Greek symbols.
4. Add tests, document the boundary, and verify Bun/npm builds and the Windows CI path.

**Acceptance criteria:** the engine-test page uses CodeMirror; core editing interactions work; completion inserts the selected item at the correct cursor range; Run and Tokenize consume the latest document; the existing terminal and engine behavior remain unchanged; no unnecessary framework or language-server dependencies are introduced.


## Unit system specification and implementation roadmap

The normative design target is documented in [Jabr Unit System Specification](specs/jabr-unit-system-spec.md).

Jabr Math owns the runtime unit registry, dimensions, unit-expression parser, quantities, dimensional arithmetic, conversion, temperature semantics, and display formatting. Kernel and Engine must treat Math quantity payloads as opaque domain values.

Implementation phases:

- **U0:** numeric precision and dimension foundation.
- **U1:** seven SI base dimensions and units.
- **U2:** derived SI units and complete prefixes.
- **U3:** runtime compound-unit grammar and normalization.
- **U4:** conventional metric, US customary, Imperial, and engineering unit registry.
- **U5:** dimensional arithmetic and diagnostics.
- **U6:** conversion and display formatting.
- **U7:** affine temperature and angle semantics.
- **U8:** custom units, deferred until the built-in registry is stable.

Do not start U0 until the unit-system specification and numeric representation contract are reviewed. Evaluate `uom` through a focused proof of concept; do not expose third-party unit types in the public Jabr Math API or add the dependency before checking runtime parsing, exact numeric compatibility, affine conversions, WASM support, and build cost.

### CLI and repository naming

- **Jabr-math** is the canonical repository and library owner for mathematical syntax, parsing, values, quantities, units, and evaluation.
- The existing terminal/workbench is a developer tool, not the production worksheet UI.
- The local `jabr-engine` executable under `engine/calcpad-core` is a native smoke-test runner only; it is not the planned Jabr Engine orchestration subsystem.
- The long-term command-line role is a headless developer/test runner for fixtures, validation, and reproducible calculations. The Rust Math library/facade remains the reusable integration surface.
- Use actual repository names in new documentation: `Jabr-kernel`, `Jabr-math`, `Jabr-table`, `Jabr-diagram`, and `Jabr-UI`. Treat “Jabr-cli” and “Jabr-draw” as legacy/logical labels, not current repository names.
