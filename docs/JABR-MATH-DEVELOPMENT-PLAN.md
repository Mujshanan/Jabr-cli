# Jabr-Math Development Plan

> **Status:** Active development plan for the Jabr-Math parser and block-analysis API.
> **Language engine decision (2026-11-19):** Calcpad remains the authoritative worksheet parser/compiler. Mathlex is not introduced as a second parser for worksheet source.

## Ownership and boundaries

- **Calcpad** is the authoritative parser and language engine for worksheet statements, assignments, formulas, functions, units, and calculation semantics.
- **Jabr-Math** owns the stable public facade and lowers real Calcpad parser/compiler output into Jabr-owned DTOs.
- **Jabr-Engine** consumes Math analysis results and owns cross-block dependency resolution, worksheet scheduling, and execution lifecycle.
- **Kernel** owns shared state, revisions, snapshots, identity, and generic graph primitives.
- Public DTOs must not expose Calcpad types, references, lifetimes, or Rc/RefCell ownership.

## Delivery sequence

| Milestone | Focus | Deliverable | Status |
|---|---|---|---|
| **M1** | Source-span preservation | Reliable original-source provenance through parsing and transformations, including Unicode and error locations | In progress |
| **M2** | AST inspection | Real Calcpad parser/compiler AST lowered into Jabr-owned versioned DTOs | Pending |
| **M3** | Name analysis | Ordered, occurrence-level definitions and references derived from the AST | Pending |
| **M4** | Public facade | Stable parse-only analyze_block API, diagnostics, source hash and length metadata | Pending |
| **M5** | Release | Fixtures, documentation, compatibility checks, versioning, and Engine integration handoff | Pending |

## M1 — Source-span preservation

### Objective

Preserve exact source provenance from the original authored string through the Calcpad tokenizer/parser transformations. Later milestones must consume these preserved locations; they must not reconstruct offsets from token text, rendered HTML, RPN order, or compiler output.

### Coordinate contract

- Offsets are zero-based UTF-8 byte offsets into the exact original source string.
- Ranges are half-open: [start_byte, end_byte).
- Both endpoints must be within the source and on UTF-8 character boundaries.
- Character-indexed parser internals must convert to UTF-8 byte offsets at the point where the source range is known.
- Empty spans are allowed only for explicit insertion/diagnostic anchors.
- Source length and content hash are recorded by the later block-analysis envelope; M1 provides the source-coordinate primitives and provenance.

### Provenance model

Internal parser tokens carry provenance that is not part of the public API:

- Source(span) for a token corresponding directly to authored source.
- Derived(spans) for a token synthesized from one or more source constructs (for example implicit multiplication or vector/matrix RPN nodes).
- Synthetic { anchor_byte } for generated content with no authored source text.
- Missing provenance remains explicit; it must never be replaced with a guessed span.

Operator ordering and RPN conversion must preserve provenance when they reorder or reuse tokens. Generated tokens must retain a documented derived or synthetic origin.

### M1 work items

1. Add UTF-8-safe byte-span primitives and character-index conversion helpers.
2. Instrument Calcpad tokenization so identifiers, literals, units, operators, input fields, solver blocks, and delimiters retain original-source locations.
3. Preserve provenance through implicit multiplication, array/vector/matrix token creation, operator ordering, and RPN conversion.
4. Trace compiler transformations and identify which constructs need one source span versus multiple origin spans; do not flatten multiple origins without a documented policy.
5. Attach source locations to parser and compiler diagnostics wherever the failing source construct is known. An unavailable location must be explicit.
6. Add tests for ASCII, multibyte Unicode, combining characters, empty/end spans, CRLF/LF, implicit multiplication, functions, units, arrays/matrices, malformed tokens, and transformed/generated tokens.

### M1 exit criteria

- All source-backed spans are valid UTF-8 byte ranges into the original source.
- Unicode before and inside a token does not shift locations incorrectly.
- Reordering and token transformations retain origin metadata.
- Generated tokens are marked derived or synthetic, never assigned invented source ranges.
- Error paths preserve the best exact source location available, or explicitly report that no location is available.
- Rust unit and integration tests pass on the supported toolchain.
- M1 does not expose Calcpad internals as public Jabr DTOs and does not implement AST/name analysis.

## M2 — AST inspection

- Expose the real Calcpad parser/compiler tree through a parse-only inspection path.
- Lower parser/compiler constructs into Jabr-owned AstInspection and AstNode DTOs.
- Carry M1 provenance into AST nodes; do not reconstruct spans.
- Keep AST inspection separate from evaluation.
- Preserve operator, function, variable, literal, assignment, collection, and control-flow distinctions supported by the actual parser.

**Exit criteria:** native inspection returns a versioned Jabr DTO populated from the real Calcpad parse/compiler representation, with preserved source locations and explicit diagnostics/partial-result status.

## M3 — Name analysis

- Derive definitions and references from the real AST.
- Preserve source occurrence order by SourceSpan.start.
- Emit one record per occurrence; do not deduplicate repeated references or definitions.
- Distinguish assignment targets from reads, including read-modify-write expressions such as x = x + 1.
- Do not invent exports when parsing fails.

**Exit criteria:** fixtures verify definitions and references, occurrence spans, ordering, assignment semantics, and Unicode offsets.

## M4 — Public analysis facade

Expose a stable parse-only block analysis operation with Jabr-owned DTOs:

- AstInspection
- NameDefinition
- NameReference
- SourceSpan
- MathDiagnostic
- BlockAnalysis source metadata including source_len_utf8 and source_content_hash

The public contract must be versioned and independent of Calcpad internal types and ownership.

**Exit criteria:** downstream Engine can consume the facade without importing parser/compiler internals or reparsing source.

## M5 — Release and integration handoff

- Complete native tests and supported target builds.
- Publish the facade schema and compatibility/versioning policy.
- Provide fixtures and expected analysis outputs for Jabr-Engine.
- Pin the Jabr-Math dependency in Engine only after the public API is ready.
- Do not merge or publish a release without explicit authorization.

## Current M1 implementation notes

- engine/calcpad-core/src/ast.rs remains an existing DTO scaffold; M1 does not populate or expose it.
- engine/calcpad-core/src/source_span.rs contains UTF-8 byte-range validation, character-boundary mapping, a precomputed SourceMap for O(1) character-to-byte lookup, and SourceOrigin variants for direct, derived, and synthetic provenance.
- MathParser tokens carry internal provenance. Tokenizer instrumentation covers identifiers, literals, units, operators, input fields, solver blocks, and array references.
- Implicit multiplication records both operand origins. RPN vector/matrix nodes retain their opening and closing delimiter origins; operator ordering and RPN token movement preserve provenance by retaining the original token references.
- MathParserException carries an internal optional source span. Tokenizer failures attach source ranges where the failing construct is known, and compiler failures inherit the current token's origin.
- Focused tests were added for Unicode character-to-byte mapping, empty/end spans, invalid ranges, token spans, RPN reordering, and an invalid-character diagnostic.
- **Verification is currently blocked:** this session has no Rust toolchain, cannot reach GitHub from the container, and the GitHub commit-workflow lookup returned no runs. The Rust tests, formatting, Clippy, and build have not been executed. Do not mark M1 complete until they run successfully and the remaining token/error paths are audited.
