# Jabr-Math M2 AST Inspection Implementation Plan

**Goal:** Expose a parse-only, versioned Jabr AST derived from the real Calcpad parser output, preserving syntax distinctions and parser provenance.

**Branch:** `feat/block-analysis-api`  
**Prerequisite:** M1 source provenance is in progress. M2 expression inspection can proceed for source strings passed directly to MathParser; worksheet-block absolute offsets remain gated on completion of the ExpressionParser source-segment mapping.

## Architectural constraints

- Calcpad remains the sole authoritative worksheet-language parser.
- Inspection consumes MathParser's actual RPN output after tokenization, syntax checking, operator ordering, and shunting-yard conversion.
- Do not serialize the evaluation `compiler::Expr` as the syntax AST: that tree constant-folds expressions and may erase source syntax.
- Do not invoke `compile_rpn`, `eval_expr`, worksheet evaluation, HTML rendering, or the highlighter to construct AST nodes.
- RPN tokens are parser output, not the AST DTO. Lower them by consuming their actual operand/arity semantics into a structured tree.
- Keep all Calcpad token, parser, `Rc`, and `RefCell` types behind the Rust adapter.
- Preserve source and derived origins, including non-contiguous fragments. A node's `span` is only a bounding envelope; `origin` retains exact fragments.
- Expression inspection offsets refer to the exact expression argument. Do not claim block-global offsets until M1 maps ExpressionParser transformations and cache/replay.

## Deliverables

1. Versioned Jabr-owned AST DTOs with explicit node origin, UTF-8 byte spans, byte-based line/column coordinates, structured diagnostics, and partial-result status.
2. Parse-only `inspect_expression(source)` entry point using MathParser.parse and its parser-produced RPN.
3. AST lowering for parser-emitted constants, variables, units, inputs, operators, assignments, function families, vectors, matrices, indexing, and solver references where supported.
4. Structured diagnostics for parser errors and explicit unsupported/invalid RPN lowering.
5. Native tests proving syntax is preserved (including constant expressions), assignments distinguish target from RHS reads, function/collection structure is retained, and Unicode spans slice the exact input.
6. Documentation of the expression-level boundary and remaining worksheet-level AST work.

## Implementation tasks

- [x] Audit MathParser.parse, RPN generation, compiler Expr, token kinds, and current AST DTO scaffold.
- [x] Define exact source and derived origin in the Jabr AST DTO.
- [x] Add parse-only RPN-to-AST lowering without calling the evaluation compiler.
- [x] Add a public Rust expression-inspection entry point.
- [x] Add focused native unit tests for syntax preservation, assignment, function calls, errors, and UTF-8 spans.
- [x] Audit RPN operand ordering for operators, assignments, functions, vector rows, and matrices against Calcpad get_rpn.
- [x] Harden vector/matrix arity markers and isolate parser-token metadata extraction.
- [x] Add regression tests for multiline byte coordinates, empty input, function definitions, collection order, assignment arrows, malformed RPN, multi-argument functions, and invalid custom-function indices.
- [ ] Run cargo fmt, focused AST tests, full crate tests, Clippy, and supported target builds.
- [ ] Complete the audit and add fixtures for units, indexing, and control/solver constructs.
- [ ] Complete M1 source-segment mapping before exposing worksheet-block AST with original block-global spans.

## RPN lowering audit notes

Calcpad emits ordinary operands in source order before the operator/function token. Assignment expressions therefore place the LHS before the RHS, and split_off preserves that order. Vector literal markers follow their row elements and carry the element count in index. Each matrix row is emitted as a row marker; the final matrix marker carries row_count * MAX_LENGTH, so lowering divides by MAX_LENGTH to pop the row nodes. The inspector validates that matrix marker before converting it to a row count.

Container::get rejects negative custom-function indices and uses checked vector access, so the inspector retains this lookup and adds invalid-index regression tests rather than duplicating bounds checks.

The public Math SourceSpan uses zero-based line numbers and zero-based UTF-8 byte columns. This differs from Kernel 0.1 Location (one-based lines and Unicode-scalar columns); adapters must convert deliberately.

## Known limitations

- This first M2 slice inspects a single mathematical expression. It does not yet build a worksheet/document AST for Markdown, directives, multi-statement blocks, loops, or conditional blocks.
- A function definition accepted by MathParser but not represented by a single expression RPN currently returns a structured diagnostic.
- Any RPN token type without a defined lowering rule returns an explicit lowering diagnostic; it is not silently skipped.
- Rust verification is pending in a toolchain-enabled environment.
