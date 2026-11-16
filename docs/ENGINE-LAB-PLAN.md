# Jabr CivilKit Engine Lab — Development Plan

## Purpose

Jabr is an isolated laboratory for evaluating the CivilKit/Calcpad Rust calculation engine before it is integrated into the separate notes application through a future custom block. Jabr's UI remains deliberately small: enter a worksheet, execute it, and inspect every useful representation returned by the engine.

The notes application must not depend on CivilKit internals. It will eventually consume a stable, documented engine adapter contract.

## Design principles

1. Keep the upstream CivilKit source pinned and reproducible. Preserve its upstream history, MIT license, and NOTICE files.
2. Treat CivilKit as the system under test, not as the final notes application.
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
├── CivilKit Rust engine (pinned upstream)
│   ├── parser and evaluator
│   ├── units, vectors, matrices, solvers
│   ├── Calcpad worksheet formatter / HTML report
│   └── highlighter / prettifier (separate upstream component)
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

The AST and LaTeX work must begin with an API audit of the pinned source. Prefer adding a narrow Jabr-facing Rust adapter around public/reusable CivilKit APIs. Avoid modifying upstream internals unless the audit proves that no clean adapter is possible. If a required API is private, record that limitation and propose the smallest upstream-facing extension.

## Phases

### Phase 0 — Reproducible baseline (in progress)

- Pin CivilKit as a submodule at a known commit.
- Build and smoke-test the native CLI.
- Build the WASM package and run the minimal browser test page.
- Record upstream version, commit, build prerequisites, and known limitations.
- Add a Python test runner that invokes the native CLI and checks deterministic fixture outputs against independently calculated expected values.

**Exit criteria:** a clean checkout can initialize the submodule, build native and WASM targets, and run the baseline smoke checks.

### Phase 1 — Output observability and AST/API audit

- Inspect `calcpad-core`, `calcpad-wasm`, and `calcpad-highlighter` public APIs at the pinned commit.
- Trace how source text becomes parsed expressions, evaluated values, and formatted HTML.
- Identify whether the internal expression representation can be serialized without changing calculation semantics.
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

## AST inspector UI milestone

The AST inspector is a first-class developer tool inside Jabr's existing TypeScript/Vite application. It should borrow the interaction model of AST Explorer (source-to-tree synchronization and hierarchical inspection), but it must not import or copy AST Explorer application code. Keep Jabr's existing framework and review any third-party component licenses before adding dependencies.

### Inspector experience

The inspector should provide four coordinated views over the same selected AST node:

- **Tree / ATS:** expandable, human-readable hierarchy with descriptive node labels. This is the default view.
- **JSON:** complete serialized AST and selected-node subtree, with copyable structured output.
- **Source:** original worksheet source with the selected node's source span highlighted.
- **LaTeX:** rendered mathematical representation of the selected expression where supported. LaTeX is a formatter output, not a substitute for the AST.

A node-details pane should show the selected node's kind, operator/name/literal, arguments, children, units or other kind-specific properties, and source location. Selecting a tree node highlights its source span; selecting source text should resolve to the narrowest corresponding AST node where possible. Tree expansion state should remain independent of selection.

### Frontend implementation boundary

Keep the inspector independent of the terminal and engine-test page so it can be reused later or adapted for the notes application's custom calculation block.

Suggested modules (adapt names to the current repository conventions):

- `src/ast/types.ts`: versioned Jabr-facing AST and diagnostic types.
- `src/ast/adapter.ts`: normalize CivilKit DTOs without discarding engine semantics.
- `src/ast/formatter.ts`: human-readable ATS labels and tree formatting.
- `src/ast/source-map.ts`: map Rust source spans to editor positions.
- `src/ast/latex.ts`: AST-to-LaTeX formatting for supported expression nodes.
- `src/components/ast-inspector/`: tree, node details, JSON, and source-highlight views.

Use the repository's existing TypeScript/Vite stack. Prefer a lightweight accessible tree component or a small purpose-built renderer over importing a complete AST Explorer clone. Monaco decorations may be used if Monaco is already the editor; otherwise integrate with the existing editor API. Keep KaTeX as the rendering layer if it is already available or selected for Jabr. Do not introduce Vue/Nuxt or React solely for the inspector.

### Delivery order

1. Expose the real CivilKit AST through a versioned Rust inspection DTO; do not synthesize an AST from tokenizer output or report HTML.
2. Normalize the DTO in the Jabr adapter and preserve node kinds, child order, literals, units, diagnostics, and source spans.
3. Implement the expandable ATS tree and node-details pane.
4. Add bidirectional tree/source selection and source highlighting.
5. Add the JSON view and copyable full/subtree output.
6. Add AST-to-LaTeX formatting and KaTeX rendering for explicitly supported node kinds; report unsupported constructs clearly.
7. Add fixtures and tests for tree labels, selection/source mapping, schema compatibility, Unicode offsets, and malformed input.

**Acceptance criteria:** a real CivilKit parse result can be inspected as a readable tree and JSON; selecting a node highlights the corresponding source; source selection can identify its AST node where unambiguous; LaTeX is generated from the AST (not scraped from HTML); unsupported or partial results are explicit. The inspector remains separate from evaluation and does not change terminal behavior.

## Tokenizer and AST milestone

The browser test page now builds and loads CivilKit's separate `calcpad-highlighter-wasm` package and displays actual upstream token records (type, type ID, source text, line, UTF-16 column, and length). The AST panel is present but intentionally reports the current engine API limitation; it does not fabricate a tree from tokenizer output.

The AST DTO and source-span contract are documented in [TOKENIZER-AST-DESIGN.md](TOKENIZER-AST-DESIGN.md). The next implementation dependency is a small Rust-side extension in a maintained CivilKit patch/fork because the current RPN-to-`Expr` methods are crate-private.

## Initial audit result

The source-level audit is recorded in [CIVILKIT-API-AUDIT.md](CIVILKIT-API-AUDIT.md). The important finding is that `MathParser` has public parse/evaluate/value APIs, but the internal RPN and the methods that compile it into the public `compiler::Expr` tree are crate-private. The existing WASM conversion endpoint exposes Calcpad HTML and diagnostics, not a standalone AST or LaTeX response. The separate highlighter crate does expose source prettification and tokenization.

This means the next technical step is a small, controlled upstream API extension or a maintained patch exposing a versioned AST inspection DTO. Do not duplicate the private parser implementation in Jabr and do not reverse-engineer AST or LaTeX from HTML.

## Immediate implementation scope

Phase 0 now includes the Python black-box regression runner and the first source-level API audit. CI has been configured to run the Python checks after building the native CLI. The AST DTO and standalone LaTeX formatter remain the next implementation milestone, after the CI baseline is green.
