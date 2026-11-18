# CivilKit API Audit

**Audited revision:** `civilkit/civilkit-calcs` commit `97f4bb698cea3bd6a9a4fae46dbc28b0d3ca5ffc`  
**Purpose:** determine which engine outputs can be consumed by an external Jabr adapter without patching CivilKit internals.

## Findings

### 1. Calculation and value access are public

The `calcpad-core` crate exports `MathParser` from `parsers::math_parser`. Its public API includes:

- `MathParser::new`
- `MathParser::parse(expression, allow_assignment)`
- `MathParser::calculate(is_visible, cache_id)`
- `MathParser::calculate_real()`
- `MathParser::result_value()`
- `MathParser::real()` and `imaginary()`
- `MathParser::units()`
- `MathParser::get_variable(name)` and `set_variable(name, value)`

This is a useful basis for a native scalar-expression probe. The worksheet-level `ExpressionParser` remains the relevant entry point for full Calcpad syntax, directives, loops, local/global scope, worksheet formatting, and diagnostics.

### 2. An expression-tree type exists, but the normal route to it is crate-private

The engine defines a public `compiler::Expr` enum. Its variants include constants, variables, unary/binary operators, functions, conditionals, assignments, blocks, loops, vector/matrix literals, and indexing operations.

However, the key path to that tree is not externally callable:

- `MathParser.rpn` is `pub(crate)`.
- `MathParser::compile_rpn` is `pub(crate)`.
- `MathParser::rpn_to_expression_tree` is `pub(crate)`.

Consequently, an external crate cannot simply call `parse()` and retrieve the internal `Expr` tree. The public enum alone does not make AST extraction available.

**Implication:** AST inspection requires either (a) a small upstream API addition that returns a stable inspection representation, or (b) a maintained Jabr patch/fork exposing a deliberately versioned inspection method. Avoid copying private parser internals into Jabr.

### 3. Calcpad output formatting is not a standalone LaTeX API

The core has a dedicated output subsystem and writers for its supported output formats. The worksheet conversion API returns the complete Calcpad HTML report. It can format equations in the Calcpad report, including fraction-style equation formatting, but the audited public WASM API does not expose a standalone LaTeX string for each parsed expression.

Do not extract equation markup from the report and label it LaTeX. Those are different output contracts.

**Implication:** treat LaTeX as a separate feature to investigate. If no native writer exists, a formatter can be added at the AST/inspection boundary after AST access is solved. The AST must remain the semantic source; do not generate LaTeX by reverse-parsing HTML.

### 4. The highlighter/prettifier is a separate reusable component

The `calcpad-highlighter` crate exposes API functions for:

- token highlighting,
- lint diagnostics,
- symbol definitions and references,
- symbol-at-position lookup,
- source prettification,
- snippets,
- unwrapped listing tokenization.

The `calcpad-highlighter-wasm` crate exports corresponding WASM functions, including `prettify` and `tokenize_listing`.

This component should be considered separately from the calculation engine. It provides source/editor services, not the evaluated mathematical AST or result values.

### 5. Existing WASM conversion contract

The `calcpad-wasm::convert(request_json, unwrap)` function accepts a Calcpad worksheet request and returns JSON containing:

- `html`: formatted report,
- `errors`: source/output line, message, source category, and optional message code,
- `files`: files produced by worksheet operations,
- optional export-related data when requested,
- optional `needsHighlighter` when report listing highlighting needs the separate highlighter.

It does **not** currently return a standalone AST or LaTeX field.

## Recommended implementation decision

1. Keep using the pinned upstream `convert` API for whole-worksheet evaluation and the Calcpad HTML report.
2. Build a small native probe around the public `MathParser` API for scalar parse/evaluate/value/unit experiments.
3. In parallel, propose the smallest upstream extension needed to expose an AST inspection DTO. Prefer a serializable DTO over exposing internal RPN/token references directly.
4. Once the DTO is available, build LaTeX rendering from that DTO as a separate formatter.
5. Add the same inspection DTO to WASM only after its native shape and semantics are tested.
6. Use the highlighter WASM independently for source tokenization/prettification; do not conflate its tokens with the expression AST.

## Risks and boundaries

- `MathParser` is stateful; tests must make variable scope and assignment order explicit.
- A scalar expression parser probe is not a substitute for full worksheet execution.
- AST node names and serialized shapes must be versioned. Do not expose Rust enum debug strings as a permanent public contract.
- Numerical equivalence tests need declared tolerances and explicit unit handling.
- Preserve CivilKit/Calcpad licensing and notices if maintaining a fork becomes necessary.
