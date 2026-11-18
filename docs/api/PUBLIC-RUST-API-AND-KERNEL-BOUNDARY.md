# Jabr Math Public Rust API and Kernel Boundary

**Status:** Contract proposal for review. This document does not claim that a stable facade or Kernel implementation already exists.

## Goals

- Keep the locally maintained Calcpad implementation and its upstream-shaped types internal.
- Expose a small Jabr-owned Rust API that can be consumed by native applications and a versioned WASM adapter.
- Make calculation requests immutable snapshots. A later assignment must never mutate an earlier result.
- Keep Kernel independent of Math, Diagram, Table, AFFiNE, BlockSuite and UI frameworks.
- Preserve the current Vanilla TypeScript/Vite workbench and all existing native/WASM entry points.

## Public API boundary

The first stable facade should expose only these concepts:

- `EngineInfo`: engine name, semantic version, API/protocol version and capability set.
- `EvaluateRequest`: request ID, document ID, source revision, source text and an immutable variable snapshot.
- `EvaluateResponse`: matching request/revision identifiers, result status, structured diagnostics and explicitly supported output artifacts.
- `Diagnostic`: stable code, severity, message and optional source span.
- `ValueEnvelope`: tagged, schema-versioned value representation for transport. Exact numeric forms must not be silently converted to binary floating point.
- `VariableSnapshot`: immutable set of names/IDs, values and the Kernel revision from which the snapshot was taken.

The facade must not expose `MathParser`, `VarRef`, `Rc<RefCell<_>>`, parser token internals, Calcpad DTOs or generated WASM classes as public application contracts.

### Rust shape (illustrative contract, not an implementation claim)

```rust
pub struct EngineInfo {
    pub api_version: u32,
    pub engine_version: String,
    pub capabilities: Vec<String>,
}

pub struct EvaluateRequest {
    pub request_id: String,
    pub document_id: String,
    pub source_revision: u64,
    pub source: String,
    pub variables: VariableSnapshot,
}

pub struct EvaluateResponse {
    pub request_id: String,
    pub document_id: String,
    pub source_revision: u64,
    pub variable_revision: u64,
    pub outcome: EvaluationOutcome,
    pub diagnostics: Vec<Diagnostic>,
}
```

The final types, serialization and method names must be proven by compile-time API tests before being treated as stable. Keep the initial API deliberately small: engine info/capabilities, validation/inspection where supported, and worksheet evaluation. Do not promise AST, LaTeX, units metadata or structured values unless the implementation can provide them without scraping report HTML.

## Evaluation and variable semantics

1. The caller supplies an immutable snapshot and a source revision.
2. The engine evaluates against that snapshot; it does not mutate the caller's Kernel store.
3. Assignments produced by the worksheet are returned as explicit state changes with stable symbol identity and a base revision.
4. The caller applies those changes through the Kernel transaction API. A revision conflict is explicit; never overwrite a newer value silently.
5. A response is associated with the exact source and variable revisions used to compute it.
6. A prior response and its value snapshot remain immutable after subsequent assignments.
7. Local variables/functions/solver state remain evaluation-local unless the language explicitly defines a persistent assignment.

This separates calculation semantics (Math) from shared assignment state (Kernel).

## Kernel integration contract

Kernel owns generic identity, namespaces/scopes, revisioning, immutable snapshots and atomic state-change application. Math owns parsing, expression evaluation, units, numeric semantics and the mapping between language symbols and Kernel identities.

The Kernel must not depend on Math's `Value`, `Unit`, parser, AST or evaluator. The cross-repository value boundary is an opaque tagged envelope:

- `type_id`: stable namespaced value type.
- `schema_version`: version of that type's payload.
- `payload`: deterministic JSON-compatible or binary payload, with exact numeric encodings preserved.
- Unknown type IDs remain opaque to Kernel and can be rejected by a domain adapter.

Kernel state operations should include:

- read a value by stable variable ID and scope;
- create a snapshot at a monotonically increasing revision;
- submit a transaction with an expected base revision;
- atomically accept or reject the transaction;
- return the new revision and a list of changed variable IDs;
- retain historical snapshots/results by value, not by mutable pointer.

A transaction must be all-or-nothing. Duplicate IDs, invalid scope references, unsupported envelope versions and revision conflicts must produce typed errors.

## Package ownership

| Package | Responsibility | Must not own |
|---|---|---|
| `jabr-math-core` (current vendored engine, internal) | Calcpad parser/evaluator and calculation semantics | Studio UI or Kernel storage |
| Jabr Math public facade (to be implemented) | Stable Rust DTOs and operations | Upstream internals in its public API |
| Math WASM/native adapters | Transport, target-specific initialization and panic containment | Calculation semantics |
| Vanilla workbench (current) | Engine development/demo UI | Jabr Studio production blocks |
| Optional React package | Reusable React presentation only if justified | Parser/evaluator or BlockSuite lifecycle |

Do not create a React package as part of this work. Do not replace the Vanilla workbench. Jabr Studio remains owned by Jabr-UI and consumes the typed adapter.

## Compatibility and errors

- Version the public API separately from the vendored engine version.
- Additive optional fields may be introduced within a compatible protocol version.
- Breaking DTO/semantic changes require a protocol major version.
- Return structured errors; do not leak panic text or Rust internals to the UI.
- Include request ID and source/variable revisions in every response.
- Native and WASM adapters must pass the same golden contract fixtures.
- Stale responses are discarded by the caller, not applied to newer documents.

## Required acceptance tests

Before calling the facade stable, test:

1. API version and capability handshake.
2. Empty and non-empty worksheet evaluation.
3. Invalid source and structured diagnostics.
4. Snapshot isolation after a later assignment.
5. Revision conflict and atomic rejection.
6. Exact decimal/rational transport round-trip.
7. Unknown value type/version behavior.
8. Native/WASM parity for the same golden fixtures.
9. No public API type leaks `Rc`, `RefCell`, parser internals or upstream DTOs.

## Migration sequence

1. Freeze this contract and add compile-time/public-API tests.
2. Implement the facade as an additive layer over the existing core; do not rewrite the core.
3. Add the Kernel adapter and snapshot/transaction tests.
4. Add native and WASM adapters against the same DTOs.
5. Migrate Jabr-UI behind its existing engine adapter boundary.
6. Consider extracting a separately versioned crate only after the facade has real consumers and compatibility tests.

No vendored source, workbench files, lockfiles, CI workflows or Studio blocks are moved by this contract-only step.
