# Jabr Math Public Rust API and Kernel Boundary

**Status:** Architecture contract aligned with Jabr Kernel 0.1. The current implementation remains a source-evaluation facade; typed block results, dependency extraction, and the versioned cross-target protocol are follow-up design/implementation work.

## Goals

- Keep the locally maintained Calcpad implementation and upstream-shaped types internal.
- Expose a small Jabr-owned Rust API for native applications and a versioned WASM/browser adapter.
- Make evaluation deterministic over explicit input; Math does not mutate shared worksheet state.
- Reuse Kernel's generic infrastructure types rather than defining parallel cross-repository primitives.
- Keep Kernel independent of Math, Diagram, Table, Engine, and UI.

## Kernel 0.1: shipped public surface

The following is the complete relevant Kernel 0.1 public surface:

| Capability | Public types | Meaning |
| --- | --- | --- |
| Identity | `NodeId`, `NodeIdAllocator`, `IdAllocationError`, `MAX_NODE_ID` | Nonzero JavaScript-safe node IDs. IDs are scoped by the owning document/application namespace. |
| Ports | `Port` | Opaque node/port identity; Engine defines port meaning. |
| Dependency graph | `DependencyGraph<N>`, `GraphError<N>` | Generic graph data structure and deterministic prerequisite-first topological ordering. It does not build worksheet dependencies or schedule work. |
| Source coordinates | `Span`, `SpanError`, `Location`, `LocationError` | UTF-8 byte-based half-open spans; validated one-based line and Unicode-scalar-column locations. |
| Diagnostics | `Diagnostic`, `Severity` | Generic structured diagnostics with owner-defined stable codes and optional source span. |
| Transport envelope | `Envelope<T>`, `ENVELOPE_SCHEMA_VERSION` | Versioned optional result plus diagnostics. Current schema version is 1; deserialization rejects unsupported versions when the Kernel `serde` feature is enabled. |

Kernel 0.1 does **not** ship `Revision`, `Snapshot<T>`, or `ResultStore<V>`. It also does not own variable state, scopes, worksheet state, caching, invalidation, cross-engine graph construction, scheduling, recalculation, or result lifecycle. Do not document or depend on those as Kernel APIs.

## Ownership and shared types

### Diagnostics and spans

Math uses Kernel's `Diagnostic`, `Severity`, and `Span` as its public diagnostic representation. Remove the parallel public `MathDiagnostic` DTO when the facade's API migration is implemented.

- Math owns diagnostic codes (for example, `math.parse.invalid`, `math.evaluate.domain_error`) and their semantics.
- Kernel owns only the generic fields: code, severity, human-readable message, and optional source span.
- A `Span` is a UTF-8 byte range `[start, end)` in the exact source string evaluated. It is not a line/column pair.
- Convert Calcpad's line-oriented diagnostics to a byte span only when the parser can identify the exact source range. Do not fabricate offsets from a line number. Until exact ranges are available, use `span: None` and retain line/output-line metadata only in an internal adapter/debug detail, not a competing public diagnostic shape.
- The UI must use the stable code and span for behavior/highlighting; it must not parse the message.

The Math crate enables Kernel's `serde` feature where serialization is required. The public facade should re-export Kernel diagnostic types or refer to them directly; it must not wrap them in a structurally duplicate Math diagnostic type.

### IDs and ports

Use Kernel `NodeId` for worksheet block/node identity crossing the Math–Engine boundary, and `Port` for generic endpoints when a port is needed. Math must not create a second public numeric node-ID type.

Kernel IDs are document/application namespace-scoped, not globally unique. The owning document layer is responsible for allocating and persisting IDs consistently. Math-local parser symbols, variable names, AST node indices, and language-local scopes are not Kernel node IDs.

Existing external `request_id` and `document_id` strings may remain opaque request/document correlation fields in the current facade. They are not substitutes for a block's `NodeId`. A source revision echoed by the current facade is correlation metadata only; it does not imply a Kernel `Revision` API.

### JSON envelope

Use Kernel `Envelope<T>` as the outer operation result/diagnostics container. Do not introduce a parallel Math envelope with a second schema-version field.

The envelope's `schema_version` is `ENVELOPE_SCHEMA_VERSION` (currently 1). Its `result` contains a Math-owned, explicitly versioned payload DTO; `diagnostics` contains Kernel `Diagnostic` values. The envelope version governs the outer shape; the payload's own `value_schema_version` governs Math value semantics. These are distinct compatibility boundaries.

Enable Kernel's `serde` feature for this use. Serialize IDs as safe JSON integers only within Kernel's JavaScript-safe range. Serialize any full-width `u64` correlation/revision value as a decimal string in the browser protocol; never rely on JavaScript Number to preserve all `u64` values.

## Math and Engine ownership

| Package / layer | Owns | Does not own |
| --- | --- | --- |
| Kernel | Generic IDs, ports, graph primitives, spans/locations, diagnostics, versioned envelope | Math values, worksheet state, dependency meaning, scheduling, result storage |
| Jabr Math | Mathematical values/quantities, units, expression syntax, parsing, AST, mathematical semantics, evaluation, per-block definitions/reads, typed calculation outputs | Worksheet-wide graph, cross-block binding, scheduling, persistent result store, recalculation policy |
| Jabr Engine (planned) | Worksheet state, cross-block binding, graph construction, scheduling, recalculation, result storage, revisions/snapshots and result lifecycle | Parsing, AST semantics, mathematical evaluation |
| Jabr UI | Document experience, presentation, interaction, diagnostic rendering | Math evaluation or worksheet scheduling |

Math, Table, and Diagram remain independently developable/testable domain components. Engine composes their output. Kernel remains domain-neutral and must not depend on Math.

## Evaluation contract (current)

1. Caller supplies authored source and correlation metadata.
2. Math evaluates using its own parser, evaluator, symbols, and mathematical semantics.
3. The current facade returns report HTML and diagnostics. HTML is presentation output, not a machine-readable calculation result.
4. Math does not mutate Engine or Kernel state. Any future block values, definitions, reads, or proposed assignment outputs are returned as data; Engine decides whether and when to commit them.
5. Every response echoes request/document/source correlation metadata.
6. Engine rejects results produced for stale source or stale inputs.
7. Language-local variables/functions/solver state follow Math semantics; cross-block bindings and execution order belong to Engine.

## Typed results and dependency extraction (required next contracts)

HTML must remain a display artifact only. Before Engine implementation, Math must define stable structured per-block output and dependency metadata.

A typed block result must be capable of representing at least:
- a real number with an exactness/approximation representation;
- a complex number;
- a quantity with a numeric value and structured unit/dimension data;
- vector and matrix values (including shape and typed elements);
- a typed evaluation error/diagnostic reference;
- the symbols/values defined by the block and the symbols read by the block.

Do not expose Calcpad `Value`, `RealValue`, `Unit`, `Rc`, `RefCell`, parser, AST, or WASM implementation types as the stable public DTO. The Math facade owns a serializable Jabr value model and converts from the vendored core at its boundary. Preserve exact integers/decimals/rationals where the core provides them; mark floating-point values as approximate rather than claiming exactness.

For every independently evaluable block, Math reports definitions and reads using normalized, case/Unicode-aware symbol identities consistent with Math's own language rules. Engine maps cross-block definitions to consumers and constructs the worksheet dependency graph. Math does not choose worksheet execution order.

The detailed value schema and dependency extraction rules must be specified and tested before the Engine repository starts. This section states the boundary, not a claim that these features are already implemented.

## Wire compatibility

Native and WASM adapters implement one versioned protocol over the same Jabr-owned DTOs. The outer result uses Kernel `Envelope<T>`; payload DTOs remain Math-owned. Both targets must pass identical golden JSON fixtures, including success, diagnostics, typed values, dependency metadata, Unicode spans, unknown/unsupported versions, and large integer encodings.

Do not treat generated wasm-bindgen classes, HTML, or the current Rust struct layout as the browser wire contract. Browser-facing functions should accept/return the agreed serialized envelope and keep target-specific initialization and panic containment inside the adapter.

## Vendored implementation and attribution

The vendored Rust core is isolated under `engine/` and is not the public API. Its provenance is tracked in [engine/UPSTREAM.md](../../engine/UPSTREAM.md). The imported CivilKit Calcs revision is `97f4bb698cea3bd6a9a4fae46dbc28b0d3ca5ffc`; its CalcpadCE engine ancestry is commit `0cf438f`.

Retain [engine/LICENSE](../../engine/LICENSE), [engine/NOTICE](../../engine/NOTICE), and the highlighter's license file with redistributed source/binaries. The vendored core includes a Markdig subset under BSD 2-Clause terms; preserve the copyright, conditions, and disclaimer in the NOTICE. Review and record licenses for any future imported dependency or asset. Keep upstream updates separate from Jabr-specific patches and update the recorded upstream revision on every deliberate import.

## Required acceptance tests

1. Public API tests prove that facade diagnostics use Kernel `Diagnostic` and `Span`, and that no parallel public `MathDiagnostic` remains.
2. Identity tests prove Kernel `NodeId`/ `Port` are used for cross-boundary block identity and endpoints.
3. Envelope tests prove schema version 1 round-trips and unsupported versions fail closed.
4. Typed-value tests cover numeric exactness, approximate values, units, complex values, vectors/matrices, and typed errors.
5. Dependency tests cover definitions, reads, forward references, unresolved names, local symbols, and deterministic normalization.
6. Native and WASM adapters pass the exact same golden protocol fixtures.
7. No public API type leaks Calcpad parser/AST/value internals, `Rc`, `RefCell`, or generated WASM classes.

## Migration sequence

1. Align this document with Kernel 0.1 (completed by this documentation change).
2. Migrate the facade's diagnostics, spans, IDs, and envelope to Kernel types.
3. Specify and implement typed results and dependency extraction in Math.
4. Freeze the shared versioned payload/envelope schema and run the same golden fixtures on native and WASM.
5. Keep the Engine contract and implementation in the separate Jabr Engine repository; do not add worksheet scheduling or persistent result storage to Math.
