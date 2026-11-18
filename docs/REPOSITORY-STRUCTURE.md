# Jabr Math Repository Structure

**Audit baseline:** `main` at `80069188f7ab58f6ad4ef59f418fb69d1a785cb2`  
**Purpose:** Preserve the existing engine laboratory while defining a safe path toward independently reusable Rust libraries and UI packages.

## 1. Current audited structure

### Ecosystem ownership correction (2026-11-18)

This repository is Jabr Math. It owns mathematical language and calculation semantics: parser, AST, mathematical values/quantities, units, dimensional rules and evaluation. It does not own worksheet graph construction, dependency scheduling or the result lifecycle; those belong to the planned Jabr-engine repository (not yet created). Kernel provides only generic infrastructure, including NodeId/Port, Revision, Snapshot<T>, ResultStore<V> and generic graph/diagnostic primitives. Table stores authored cell text and structure; Math parses that text. Jabr-UI owns the complete product UI and authored BlockSuite/Yjs state.


The default branch contains 434 Git tree entries (including directories) and the following major areas:

```text
Jabr-math/
├── .github/workflows/test.yml
├── docs/
│   ├── DEVELOPMENT.md
│   ├── ENGINE-LAB-PLAN.md
│   ├── CIVILKIT-API-AUDIT.md
│   ├── TOKENIZER-AST-DESIGN.md
│   └── superpowers/
├── engine/
│   ├── Cargo.toml                 # Rust workspace
│   ├── calcpad-core/
│   ├── calcpad-highlighter/
│   ├── calcpad-wasm/
│   └── calcpad-highlighter-wasm/
├── rust/mathlex-bridge/
├── scripts/
├── src/
│   ├── command/
│   ├── editor/
│   ├── engine/
│   └── interactive/
├── tests/
│   ├── fixtures/
│   └── python/
├── engine-test.html
├── index.html
├── package.json
├── bun.lock
├── rust-toolchain.toml
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts
```

The vendored Rust workspace currently has four members: `calcpad-core`, `calcpad-wasm`, `calcpad-highlighter`, and `calcpad-highlighter-wasm`. The core package exposes a library and the `jabr-engine` native binary. A separate locked Rust project exists at `rust/mathlex-bridge/`.

The frontend is intentionally Vanilla HTML/CSS + TypeScript + Vite. Bun is canonical, npm remains supported, and Python is an independent test oracle rather than a runtime dependency.

## 2. Existing ownership boundaries to preserve

- **Vendored Calcpad Rust source (`engine/`):** parsing, calculation, units, evaluation, report generation, highlighter/tokenizer and native/WASM behavior. Preserve upstream license, NOTICE and provenance.
- **Jabr adapters:** stable Jabr-owned interfaces around vendored/upstream-specific APIs. Do not expose internal Rust types directly to UI.
- **Mathlex compatibility bridge (`rust/mathlex-bridge/`):** separate compatibility path; do not conflate it with the Calcpad engine.
- **Workbench UI (`src/`, `index.html`, `engine-test.html`):** developer terminal and engine test harness only. It is not the Jabr Studio product UI.
- **Tests and fixtures:** Rust semantic tests, TypeScript tests, WASM integration tests, native smoke tests, and independent Python checks remain distinct.

The current `AGENTS.md` explicitly requires preserving the Vanilla TypeScript/Vite stack and forbids introducing React solely to implement a feature. This standardization change does not override that constraint.

## 3. Target package boundaries (incremental; not created by this change)

The long-term Math subsystem may expose these logical packages:

| Logical package | Intended responsibility | Current status |
|---|---|---|
| Math engine | Parser, AST, evaluator, values, units and calculation semantics | Existing vendored Rust core; Jabr-owned facade in progress |
| Math library | Stable application-independent Rust API and Kernel integration | Not yet a separate crate |
| Math WASM adapter | Versioned browser bridge | Existing vendored WASM crates; Jabr contract remains in progress |
| Math React components | Reusable React presentation, if/when a React package is justified | Not present; do not replace the current Vanilla workbench |
| Workbench | Minimal terminal and engine test UI | Existing TypeScript/Vite application |

Do not rename, move, split or wrap the vendored Calcpad crates merely to make directory names match this conceptual table. First stabilize the Jabr-owned API and prove the boundary with tests.

## 4. Standard repository conventions

Use these shared conventions where they add real value:

- `README.md`: project identity, quick start, current capabilities and links to canonical docs.
- `AGENTS.md`: repository-wide agent constraints.
- `CONTRIBUTING.md`: contribution workflow and validation.
- `docs/DEVELOPMENT.md`: detailed setup, architecture, build and test workflow.
- `docs/REPOSITORY-STRUCTURE.md`: this ownership map and package layout.
- `docs/architecture/`: accepted architecture decisions and diagrams.
- `docs/api/`: stable public API and serialization contracts.
- `docs/decisions/`: concise architecture decision records.
- `examples/`: runnable, maintained examples only.
- `tests/`: fixtures and tests organized by boundary.
- `.github/workflows/`: independent CI for native Windows, Rust, WASM and TypeScript paths.

Do not create empty directories or placeholder packages. Add a directory when it contains a maintained artifact.

## 5. CI and validation ownership

Preserve the existing independent jobs in `.github/workflows/test.yml`:

1. Windows native engine build and Python smoke checks.
2. Rust tests for vendored core, highlighter and Mathlex bridge.
3. WASM build, TypeScript tests and Vite build using Bun.
4. Rust dependency audit.

A documentation or directory-standardization PR must not weaken these jobs, change the required Windows target, change package-manager policy, or commit generated WASM/build output.

## 6. Safe migration sequence

1. Keep the vendored source and existing harness in place.
2. Define and test a Jabr-owned engine API/DTO contract.
3. Integrate the generic Kernel primitives through a Math/Engine adapter; Math remains responsible for parsing and evaluating expressions, while Engine owns graph construction, scheduling and result storage.
4. Extract a stable Rust library only when its public API and dependency boundary are clear.
5. Keep WASM bindings as a target-specific adapter over the same core API.
6. Consider React components as a separate package only after a concrete consumer and ownership boundary are demonstrated.
7. Retain the current workbench as an independent development and regression tool.

## 7. Non-goals of this standardization

- No Calcpad source rewrite or wholesale upstream refresh.
- No moving or renaming existing Rust crates.
- No replacement of the Vanilla workbench with React.
- No change to Bun/npm support or Windows CI.
- No change to MathLive or Jabr Studio ownership.
- No merging or retargeting of existing pull requests.
- No claim that the future Math Library or React package already exists.

This document records the audited structure and an incremental target. Implementation changes require their own focused pull requests and test evidence.
