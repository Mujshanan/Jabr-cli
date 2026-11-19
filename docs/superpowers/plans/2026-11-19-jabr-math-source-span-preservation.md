# M1 Source-Span Preservation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Preserve exact original-source provenance through the existing Calcpad parser and token transformations, including Unicode and error cases.

**Architecture:** Keep Calcpad as the sole worksheet-language parser. Add internal UTF-8 byte-span and origin metadata to parser tokens, preserve it through operator ordering/RPN transformations, and later lower it into Jabr-owned DTOs. Do not create a second parser or expose Calcpad internals publicly.

**Tech Stack:** Rust 2021, vendored jabr-calcpad-core, existing Rust unit/integration tests.

**Spec:** docs/JABR-MATH-DEVELOPMENT-PLAN.md — M1.

## Global Constraints

- Source offsets are zero-based UTF-8 byte offsets and end-exclusive.
- Both endpoints must be valid UTF-8 character boundaries.
- Spans always refer to the exact original source.
- Parser/compiler transformations preserve source provenance; no text matching or HTML-based reconstruction.
- Synthetic/generated nodes are explicitly marked and do not receive fabricated source ranges.
- Calcpad remains the authoritative parser/language engine.
- Public Jabr DTOs remain isolated from Calcpad types, lifetimes, and Rc/RefCell.
- No merge or release without explicit user authorization.

## Review Focus

- Multibyte Unicode before/inside tokens: verify byte offsets, not character indices.
- Empty spans and end-of-source positions: validate without slicing panics.
- Implicit multiplication and unit attachment: retain both operand origins.
- RPN reordering and vector/matrix synthesis: preserve or explicitly derive origins.
- Malformed expressions: retain the narrowest known original-source location or explicitly mark it unavailable.

---

### Task 1: UTF-8 source-span primitives

**Files:**
- Create: engine/calcpad-core/src/source_span.rs
- Modify: engine/calcpad-core/src/lib.rs

**Interfaces:**
- SourceSpan::from_byte_range(source, start, end) -> Option<SourceSpan>
- SourceSpan::from_char_range(source, start_char, end_char) -> Option<SourceSpan>
- SourceSpan::slice(source) -> Option<&str>
- Internal SourceOrigin::{Source, Derived, Synthetic}

- [ ] Add unit tests for Unicode character-to-byte conversion, valid empty end spans, invalid ranges, and merged provenance.
- [ ] Run the focused Rust test and verify it fails before implementation.
- [ ] Implement the primitives with boundary validation.
- [ ] Run the focused test and full core crate test suite.

### Task 2: Token provenance

**Files:**
- Modify: engine/calcpad-core/src/parsers/math_parser/tokens.rs
- Modify: engine/calcpad-core/src/parsers/math_parser/input.rs

**Interfaces:**
- Each internal Token carries Option<SourceOrigin>.
- Source-backed token creation converts the parser's character indexes to original UTF-8 byte spans.
- Token provenance remains internal to the parser crate.

- [ ] Add tests for identifiers, numbers, units, operators, input fields, and solver blocks with Unicode prefixes.
- [ ] Run tests to verify missing provenance is detected.
- [ ] Instrument every source-backed token creation path in get_input.
- [ ] Verify all token spans slice the expected original source text.
- [ ] Run core crate tests.

### Task 3: Transformation provenance

**Files:**
- Modify: engine/calcpad-core/src/parsers/math_parser/input.rs
- Modify: engine/calcpad-core/src/parsers/math_parser/compiler.rs only where required by the audit.

- [ ] Add tests for implicit multiplication, unit attachment, array indexes, vector/matrix RPN nodes, and operator reordering.
- [ ] Verify tests fail when transformation provenance is absent.
- [ ] Preserve source origins when tokens are reordered or reused.
- [ ] Mark generated tokens as derived from their input spans or synthetic at a validated anchor.
- [ ] Document multi-origin provenance where one token combines source constructs.
- [ ] Run core crate tests.

### Task 4: Error-location preservation

**Files:**
- Modify: engine/calcpad-core/src/parsers/math_parser/input.rs
- Modify: engine/calcpad-core/src/parsers/math_parser/mod.rs
- Modify: engine/calcpad-core/src/parsers/expression_parser/mod.rs only where required.

- [ ] Add malformed-input tests for invalid characters, invalid identifiers, unterminated solver/input constructs, and compiler failures.
- [ ] Verify tests detect missing or incorrect locations.
- [ ] Preserve exact spans at the point errors are raised when possible.
- [ ] Represent unavailable locations explicitly; do not infer them from error messages.
- [ ] Run the full core crate test suite.

### Task 5: M1 audit and completion gate

**Files:**
- Modify: docs/JABR-MATH-DEVELOPMENT-PLAN.md
- Modify: docs/ENGINE-LAB-PLAN.md if the existing phase descriptions conflict with the new milestone sequence.

- [ ] Audit every Token::new, Token::variable, Token::value, and generated RPN token path.
- [ ] Audit operator ordering and compiler transformations for provenance retention.
- [ ] Run formatting, Clippy, and the complete Rust workspace tests on the supported toolchain.
- [ ] Record any unsupported construct and its explicit provenance behavior.
- [ ] Mark M1 complete only when all exit criteria have passing verification evidence.

## Execution notes

- Work is isolated on branch feat/block-analysis-api; main is unchanged.
- Added the internal UTF-8 SourceSpan/SourceMap and provenance model, token instrumentation, RPN collection-node provenance, parser/compiler error-span propagation, and focused unit tests.
- The GitHub connector is the write path for this session. This environment has no rustc/cargo, cannot resolve github.com from the container, and the commit-workflow lookup returned no runs. Therefore the tests, formatter, Clippy, and build remain unverified. Continue the M1 audit and run the complete Rust suite in a toolchain-enabled environment before declaring the milestone complete.
