# Jabr Math Public Rust API and Kernel Boundary

**Status:** Initial facade proposal aligned with the Jabr Kernel 0.1 contract. The branch implements a source-evaluation facade; variable-context transport and Engine integration remain future work.

## Goals

- Keep the locally maintained Calcpad implementation and its upstream-shaped types internal.
- Expose a small Jabr-owned Rust API for native applications and a future versioned WASM adapter.
- Make each evaluation a deterministic operation over explicit source input; never mutate shared worksheet state from Math.
- Keep Kernel independent of Math, Diagram, Table, AFFiNE, BlockSuite and UI frameworks.
- Preserve the current Vanilla TypeScript/Vite workbench and all existing native/WASM entry points.

## Public API boundary

The initial facade exposes only capabilities the implementation can currently provide:

- `EngineInfo`: API version and engine version.
- `EvaluateRequest`: request ID, document ID, source revision and authored source text.
- `EvaluateResponse`: matching request/document/source revision, evaluation outcome, normalized diagnostics and the supported report output.
- `Diagnostic`: stable code/severity/message and source location when the engine can provide it.

Do not expose `MathParser`, `VarRef`, `Rc<RefCell<_>>`, parser token internals, Calcpad DTOs or generated WASM classes as public application contracts.

Structured mathematical values, AST, LaTeX, unit metadata, and an explicit variable/evaluation context are future capabilities. Add them only when the underlying engine can provide them directly and their DTOs have compile-time and serialization tests. Never infer structured values by scraping report HTML.

### Rust shape (illustrative current facade)

```rust
pub struct EngineInfo {
    pub api_version: u32,
    pub engine_version: String,
}

pub struct EvaluateRequest {
    pub request_id: String,
    pub document_id: String,
    pub source_revision: u64,
    pub source: String,
}

pub struct EvaluateResponse {
    pub request_id: String,
    pub document_id: String,
    pub source_revision: u64,
    pub outcome: EvaluationOutcome,
    pub diagnostics: Vec<Diagnostic>,
    pub report: String,
}
```

The final names, serialization and method signatures must be proven by public API tests before being treated as stable. The current Rust facade is not yet a versioned browser wire protocol. When serialized to JavaScript, 64-bit revisions must use decimal strings, not JSON numbers, to preserve the full `u64` range.

## Evaluation semantics

1. The caller supplies authored source and its source revision.
2. Math evaluates the supplied source using its own parser, evaluator, language symbols and mathematical semantics.
3. The current facade returns report output and normalized diagnostics. It does not yet accept an Engine-owned variable snapshot or return structured assignment changes.
4. Math must not mutate Kernel or Engine state. Any future assignment/result proposal is returned as data; Engine decides how it participates in worksheet state and recalculation.
5. Every response echoes the exact request ID, document ID and source revision used for evaluation.
6. Engine/UI discard responses whose source or input revisions are stale.
7. Language-local variables, functions and solver state follow Math language semantics; cross-block worksheet bindings and scheduling belong to Engine.

## Kernel and Engine integration contract

Kernel 0.1 provides generic infrastructure only:

- `NodeId` and `Port` identity primitives.
- Checked `Revision`.
- Generic `Snapshot<T>`.
- Opaque `ResultStore<V>` keyed by `NodeId`.
- Generic dependency-graph primitives and deterministic topological ordering.
- Renderer-neutral `Diagnostic`, validated `Span` and versioned `Envelope<T>`.

Kernel does not own Math values, language symbols, variable scopes, worksheet bindings, assignment transactions, calculation scheduling or evaluation. Its generic payloads are opaque to Kernel.

Jabr Math owns mathematical values, quantities, units, parsing, AST, language-level scopes, expression dependencies and evaluation. Jabr-engine (planned; no repository yet) owns worksheet node/port mapping, cross-block bindings, graph construction, scheduling/recalculation orchestration and calculation-result lifecycle. Engine composes the generic Kernel primitives with Math-owned values without making Kernel depend on Math.

A future cross-boundary value DTO may use an opaque tagged envelope:

- `type_id`: stable, namespaced Math value type.
- `schema_version`: version of the payload schema.
- `payload`: deterministic JSON-compatible or binary payload with exact numeric encodings preserved.

This envelope is a transport/domain-adapter contract, not a Kernel-owned value model. Unknown type IDs remain opaque to generic infrastructure and are interpreted only by the owning domain adapter.

## Package ownership

| Package / layer | Responsibility | Must not own |
|---|---|---|
| `jabr-math-core` (current vendored engine, internal) | Calcpad parser/evaluator and calculation semantics | Studio UI, worksheet-wide scheduling or shared state lifecycle |
| Jabr Math public facade | Stable Jabr-owned Rust DTOs and evaluation operations | Upstream internals in its public API |
| Math WASM/native adapters | Transport, target-specific initialization and panic containment | Worksheet graph construction or calculation semantics outside Math |
| Jabr-engine (planned) | Worksheet graph, cross-block bindings, scheduling and result lifecycle | Parsing/evaluation semantics or UI presentation |
| Vanilla workbench (current) | Engine development/demo UI | Jabr Studio production blocks |
| Optional React package | Reusable React presentation only if justified | Parser/evaluator or BlockSuite lifecycle |

Do not create a React package as part of this work. Do not replace the Vanilla workbench. Jabr Studio remains owned by Jabr-UI and consumes typed Engine/Math adapters.

## Compatibility and errors

- Version the public API separately from the vendored engine version.
- Additive optional fields may be introduced within a compatible protocol version.
- Breaking DTO or semantic changes require a protocol major version.
- Return structured errors; do not leak panic text or Rust internals to the UI.
- Include request ID and source/document revisions in every response.
- Native and WASM adapters must pass the same golden contract fixtures.
- Keep the Rust API and browser wire protocol distinct; wire serialization must preserve exact integers and decimal/rational values.
- Stale responses are discarded by Engine/UI, not applied to newer documents.

## Required acceptance tests

For the current facade:

1. API version and engine-info construction.
2. Empty and non-empty worksheet evaluation.
3. Invalid source and normalized diagnostics.
4. Request/document/source-revision preservation.
5. No public API type leaks `Rc`, `RefCell`, parser internals or upstream DTOs.

Before adding variable/evaluation context or browser transport, separately test:

1. Engine-owned input snapshot construction and revision preservation.
2. Exact value serialization and round-trip, including full-width revisions.
3. Explicit proposed assignment/result output without mutating Engine state.
4. Unknown type/version behavior at the adapter boundary.
5. Native/WASM parity for the same golden fixtures.
6. Stale response rejection by Engine/UI.

## Migration sequence

1. Keep the facade additive over the existing Calcpad core; do not rewrite the core.
2. Compile-test the current public API and its supported evaluation/diagnostic behavior.
3. Define the Engine-owned input-context and result-lifecycle contract before exposing variable snapshots.
4. Add native and WASM adapters against the same versioned DTOs.
5. Migrate Jabr-UI behind its existing engine adapter.
6. Keep Kernel generic; do not add Math-specific state, scope, value or transaction APIs to it.
