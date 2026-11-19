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
| **M2** | AST inspection | Real Calcpad parser output lowered into Jabr-owned versioned AST DTOs; expression-level parse-only inspector started | In progress |
| **M3** | Name analysis | Ordered, occurrence-level definitions and references derived from the AST | In progress |
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
2. Instrument Calcpad tokenization so identifiers, literals, units, operators, input fields, solver blocks, and delimiters retain original-source locations; preserve the mapping through ExpressionParser line slicing, trimming, and line continuations so spans are absolute to the original block.
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

### Objective

Expose a syntax-preserving, parse-only expression AST derived from the authoritative Calcpad parser output. Keep AST inspection independent from evaluation.

### Design decisions

- MathParser.parse performs tokenization, syntax validation, operator ordering, and RPN generation without calling the evaluation compiler.
- The current compiler Expr is not a safe syntax-AST source by itself because its compilation path constant-folds expressions and can erase authored operator structure.
- The first inspection slice lowers actual parser-produced RPN into Jabr-owned AST nodes using the token type, operator/function arity, literal content, and original token provenance.
- The inspection path must not call compile_rpn, eval_expr, worksheet evaluation, HTML rendering, or the highlighter.
- Public AST origins distinguish direct source spans, derived non-contiguous fragments, and synthetic anchors. Node span is a navigation envelope, not a replacement for exact fragment provenance.
- The first API is expression-level. Worksheet-level document nodes, directives, loops, conditions, and multi-line block structure remain separate follow-up work.

### M2 work items

1. Audit actual MathParser RPN token types and compiler semantics; do not infer grammar from the highlighter.
2. Lower constants, variables, units, inputs, unary/binary operators, assignments, function families, vector/matrix literals, indexing, and solver references into structured AST nodes.
3. Preserve operand/argument order and distinguish assignment targets from RHS expressions.
4. Carry source and derived provenance into the AST DTO without reconstructing spans.
5. Return structured diagnostics for parse failures and unsupported lowering cases.
6. Add native fixtures for arithmetic precedence, assignments, functions, collections, indexing, units, malformed input, and Unicode offsets.
7. Extend to worksheet/document AST only after M1 source-segment mapping is complete.

### M2 exit criteria

- Native inspection returns a versioned Jabr DTO populated from the actual Calcpad parser output.
- Inspection preserves syntax and does not evaluate or constant-fold the expression.
- Supported parser token families have explicit lowering rules; unsupported token families produce diagnostics.
- Node children preserve parser operand order and semantic distinctions.
- Source spans use UTF-8 bytes and exact source provenance; multi-origin nodes retain their fragments.
- Tests pass on the supported toolchain.

## M3 — Name analysis

### Objective

Derive ordered, occurrence-level definitions and references from the Jabr-owned AST. This pass consumes an existing AstInspection; it does not reparse source, evaluate expressions, or resolve worksheet-wide bindings.

### Current implementation slice

- Added Jabr-owned NameDefinition, NameReference, and NameAnalysis DTOs with JSON serialization.
- Added analyze_names(&AstInspection), preserving one record per variable occurrence and a shared source-order ordinal across definitions and references.
- Assignment LHS variables are definitions; RHS variables remain reads, including read-modify-write expressions such as x = x + 1.
- Indexed vector/matrix assignment targets define the base collection name and treat index expressions as reads.
- Parser diagnostics are carried forward. Failed parses do not produce speculative name occurrences.
- The API is exported from the calcpad-core crate and Jabr facade.

### Current limitations

- This first slice analyzes one expression AST. It does not implement worksheet/block scope, sequential visibility, forward-reference diagnostics, or cross-block binding; those belong to Jabr-Engine.
- Source locations are only as reliable as the supplied AST. Until M1 is complete, expression-local spans must not be represented as original multi-line worksheet offsets.
- Unsupported assignment-target shapes produce an explicit diagnostic rather than silently inventing a definition.

**Exit criteria:** fixtures verify definitions and references, occurrence spans, source ordering, assignment/read-modify-write semantics, parser-error behavior, and Unicode byte offsets. Full acceptance also requires the M1 original-source provenance path and Rust validation to pass.

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

- engine/calcpad-core/src/ast.rs contains Jabr-owned AST DTOs with a versioned JSON representation.
- engine/calcpad-core/src/source_span.rs contains UTF-8 byte-range validation, character-boundary mapping, a precomputed SourceMap for O(1) character-to-byte lookup, and SourceOrigin variants for direct, derived, and synthetic provenance.
- MathParser tokens carry internal provenance. Tokenizer instrumentation covers identifiers, literals, units, operators, input fields, solver blocks, and array references.
- Implicit multiplication records both operand origins. RPN vector/matrix nodes retain their opening and closing delimiter origins; operator ordering and RPN token movement preserve provenance by retaining the original token references.
- MathParserException carries an internal optional source span. Tokenizer failures attach source ranges where the failing construct is known, and compiler failures inherit the current token's origin.
- **M1 remains in progress:** current spans are relative to the exact expression passed into MathParser. ExpressionParser line slicing, trimming, continuation mapping, cached LineInfo, and loop replay still need original-block provenance.
- **Verification is pending:** this environment has no Rust toolchain. Do not claim tests, formatting, Clippy, or builds passed until run in a toolchain-enabled environment.
