# Jabr Math Structured Block Results — Design v1

**Status:** Proposed contract for review; not implemented. This design is a prerequisite for Jabr Engine and must be validated against the vendored Calcpad value model before implementation.

## 1. Purpose and boundary

The current facade returns report HTML and line-oriented diagnostics. HTML is presentation-only and must never be scraped to recover calculation values.

Math must return typed, deterministic data for each evaluated block. Math computes mathematical values and reports block metadata. Engine owns worksheet state, cross-block bindings, execution order, result persistence, revisions/snapshots, and recalculation lifecycle. Math never commits results to a shared worksheet store.

## 2. Result envelope

The Math operation result is a Math-owned payload carried inside Kernel `Envelope<T>`:

```rust
pub struct EvaluateBlocksResult {
    pub document_id: String,
    pub request_id: String,
    pub source_revision: String,
    pub blocks: Vec<BlockResult>,
}

pub struct BlockResult {
    pub block_id: NodeId,
    pub status: BlockStatus,
    pub value: Option<MathValue>,
    pub definitions: Vec<DefinitionResult>,
    pub reads: Vec<SymbolRead>,
    pub analysis_complete: bool,
    pub diagnostics: Vec<Diagnostic>,
}

pub struct DefinitionResult {
    pub symbol: SymbolId,
    pub display_name: String,
    pub kind: DefinitionKind,
    pub certainty: DefinitionCertainty,
    pub span: Option<Span>,
    pub event_index: u32,
    pub value: MathValue,
    pub assignment: AssignmentKind,
}

pub enum BlockStatus {
    Completed,
    CompletedWithDiagnostics,
    Failed,
    Skipped,
}
```

The analysis_complete field defaults to true when omitted by older v1 payloads; new Math implementations must always emit it explicitly and set it to false whenever dependency extraction is incomplete.

This is an illustrative Rust shape, not a frozen ABI. The dependency metadata types and their symbol-resolution rules are specified in the dependency contract in PR #22; the JSON representation is specified in the versioned wire contract in PR #23. The outer Kernel envelope carries operation-level diagnostics; block-local diagnostics are attached to the block result so Engine can associate failures with the responsible node. Avoid duplicating the same diagnostic at both levels unless the operation itself also failed.

A block may produce a primary expression value, zero or more named definition results, and a dependency summary. A text/diagram/table block may legitimately have no Math value and should not be sent through Math evaluation.

## 3. MathValue tagged union

Use a Jabr-owned tagged union. Do not expose Calcpad `Value`, `RealValue`, `ComplexValue`, `Unit`, `Vector`, or `Matrix` directly.

| Variant | Payload | Notes |
| --- | --- | --- |
| `real` | `NumericValue` plus optional `UnitValue` | Scalar real value |
| `complex` | real and imaginary `NumericValue` components plus optional `UnitValue` | Preserve complex values, not just the real component |
| `vector` | shape/length and ordered `MathValue` elements | Element types and units remain explicit |
| `matrix` | rows, columns, and row-major ordered `MathValue` elements | Shape must agree with element count |
| `boolean` | boolean | Used only if Math semantics can distinguish logical from numeric values |
| `text` | string | Only for an explicitly supported mathematical string value; not report HTML |

### NumericValue

The current Calcpad scalar implementation uses IEEE-754 `f64`. It does not provide exact decimal/rational provenance for every calculation. The DTO must not label a binary floating-point result as exact.

```json
{ "kind": "finite", "encoding": "f64", "value": "12.5" }
{ "kind": "nan" }
{ "kind": "positive_infinity" }
{ "kind": "negative_infinity" }
```

Finite `f64` values are encoded as decimal strings using Rust's shortest round-trip representation. This preserves the exact binary64 value through JSON and avoids JSON's inability to represent NaN and infinities. A future exact integer/decimal/rational variant can be added without misrepresenting current values.

### UnitValue

A unit is not just its display symbol. The Math-owned DTO must carry:

- canonical display symbol/text;
- normalized dimension powers (the current core has up to nine base dimensions);
- conversion scale to the chosen canonical base;
- temperature/affine-unit semantics where applicable;
- an explicit dimensionless representation.

The conversion must preserve the value represented by the original Calcpad `RealValue`/unit pair. Display text alone is insufficient for dimensional analysis or conversion. Unit serialization must be independent of Calcpad's internal `Rc<Unit>`, pointer identity, mutable caches, and private arrays.

### Containers

Vectors and matrices must preserve shape, ordering, and typed elements. Do not flatten them to formatted strings. If a core result cannot be converted losslessly to the DTO, return a typed unsupported-value diagnostic rather than silently stringifying or dropping it.

## 4. Definitions and outputs

Each named assignment captured from a block becomes a DefinitionResult. It combines the dependency definition metadata with the typed value and assignment operation, so definitions are not duplicated in a nested dependency object:

```rust
pub struct DefinitionResult {
    pub symbol: SymbolId,
    pub value: MathValue,
    pub assignment: AssignmentKind,
    pub event_index: u32,
}

pub enum AssignmentKind {
    Define,
    Reassign,
    CompoundUpdate,
}
```

`SymbolId` is a Math-owned canonical symbol key (not a Kernel NodeId). Engine uses the display name only for UI and the canonical symbol key for matching. The symbol key must follow the exact case, Unicode normalization, and identifier rules of the Math language; do not lowercase or normalize independently in Engine.

The block's primary `value` represents the value of an output expression when one exists. A definition result represents the value assigned to a name and is also the definition record consumed by Engine. The separate dependency-extraction operation returns the same definition metadata without a value when only analysis is requested. The same assignment should not be duplicated as a separate primary output unless the source explicitly emits it as an output expression.

The current vendored `CapturedValue` captures each variable in first-assignment order with its last value for Excel export. It does not yet provide a per-source-block result stream or assignment event history. The adapter must not pretend this global capture vector already satisfies the block-result contract. Add a narrow capture hook at the parser/evaluator boundary that emits an assignment event with source-block identity and typed value.

## 5. Errors and partial results

- A failed expression has `status: failed`, no primary value, and one or more structured diagnostics.
- A block that completed but emitted warnings/notes uses `completed_with_diagnostics`.
- A block skipped by a language condition or unavailable prerequisite uses `skipped`; Engine decides the scheduling reason and must not convert it to a mathematical error.
- Earlier successful assignments within a multi-statement block must be represented explicitly if the parser can produce partial output. Engine decides whether the block is atomic and whether any definitions are committed. Math must never mutate persistent state.
- Unsupported value conversion is a typed diagnostic with a stable `math.value.unsupported`-style code; do not silently omit the value.

## 6. Source association

Every block result carries the caller's Kernel `NodeId`. Every diagnostic uses Kernel `Diagnostic` and optional Kernel `Span`. A span is a UTF-8 byte range into the exact source string supplied for that evaluation. If the vendored parser only supplies a line number and cannot recover an exact byte range, leave the span absent; do not guess offsets.

## 7. Engine interaction

Math accepts an explicit read-only input environment supplied by Engine and returns typed outputs. Math must not own or persist that environment. The first implementation can retain isolated parser instances, but the contract must make input values explicit before Engine integration.

Engine:
1. resolves each read to an available worksheet binding;
2. passes the resolved input environment to Math;
3. invokes Math and receives block results;
4. decides whether outputs are accepted/committed;
5. stores accepted results and their provenance;
6. invalidates/recalculates affected blocks according to worksheet policy.

The Math API must not introduce Kernel `Revision`, `Snapshot`, or `ResultStore` because Kernel 0.1 does not ship them.

## 8. Acceptance tests

- Real finite f64 round-trip preserves exact binary64 value.
- NaN and both infinities round-trip as tagged variants.
- Complex values preserve both components.
- Unit-bearing values preserve dimensions, scale, and display symbol.
- Vector/matrix shape and element order survive round-trip.
- Unsupported core values produce a diagnostic, not a string fallback.
- A block can return multiple named definitions and an independent primary value.
- Failed blocks return diagnostics without fabricated values.
- Every result is associated with the input block NodeId and source revision.
- No public DTO contains Calcpad types, `Rc`, `RefCell`, or parser implementation objects.

## 9. Implementation sequence

1. Add a focused conversion module from Calcpad core values to the Jabr Math DTO.
2. Add typed-value serialization and golden tests before changing the evaluation response.
3. Add parser/evaluator assignment-event capture to associate definitions with source blocks.
4. Add explicit input-environment support without shared-state mutation.
5. Add native/WASM parity fixtures once the common envelope protocol is frozen.
6. Only then expose typed block results for Engine consumption.
