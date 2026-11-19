# Tokenizer and AST Inspection Design

## Scope

This milestone exposes the actual CivilKit/Calcpad tokenizer in Jabr and establishes the AST inspection contract. The tokenizer is supplied by the pinned `calcpad-highlighter` crate. The AST must come from CivilKit's calculation parser/compiler, not from a second parser implemented in TypeScript.

## Tokenizer implementation

Jabr builds the upstream `calcpad-highlighter-wasm` crate as a separate WebAssembly package. The engine test page calls its `highlight` endpoint with `includeText: true`.

Each token is displayed with:

- `line`: zero-based source line
- `column`: UTF-16 code-unit offset within the line
- `length`: UTF-16 code-unit length
- `type`: named Calcpad token category
- `typeId`: upstream numeric token identifier
- `text`: source text (requested explicitly)

The source positions follow the highlighter API's UTF-16 boundary contract. Do not reinterpret these offsets as UTF-8 byte indices or Unicode scalar counts.

The highlighter is an editor/tokenization component. Its tokens are not the calculation AST and should not be treated as parser nodes.

## AST access finding

The pinned CivilKit engine contains a public `compiler::Expr` enum. Its internal compiler constructs that tree from the parser's RPN representation, but `MathParser.rpn`, `MathParser::compile_rpn`, and `MathParser::rpn_to_expression_tree` are crate-private.

Jabr therefore cannot safely extract the authoritative AST through the current public API. The required next step is a small Rust API extension within the engine crate. This should be maintained as a narrowly scoped CivilKit patch/fork, not recreated as a TypeScript parser.

## Proposed inspection API

The Rust API should expose a stable, serializable DTO rather than the internal `Expr` enum or Rust `Debug` strings.

Proposed response envelope:

```json
{
  "schemaVersion": 1,
  "source": "2 + 3 * 4",
  "tokens": [],
  "ast": {
    "kind": "binary",
    "operator": "add",
    "children": [
      { "kind": "number", "value": "2" },
      {
        "kind": "binary",
        "operator": "multiply",
        "children": [
          { "kind": "number", "value": "3" },
          { "kind": "number", "value": "4" }
        ]
      }
    ]
  },
  "diagnostics": []
}
```

This is an illustrative contract, not the exact current CivilKit internal tree. The actual DTO must preserve semantic distinctions and must not flatten constructs merely to fit this example.

### Required node metadata

Each AST node should carry:

- `kind`: stable schema node kind
- `span`: source start/end offsets and line/column
- `children`: ordered child nodes, when applicable
- `operator`, `name`, `literal`, or `arguments`: kind-specific data

The schema should cover the engine's actual expression families, including constants, variables, unary/binary operators, functions, conditionals, assignments, vectors, matrices, indexing, and custom functions. Worksheet-level control blocks (if/while/repeat/solve) may need a separate worksheet AST layer; they should not be falsely represented as ordinary mathematical expressions.

### Source spans

Offsets should be explicitly defined as UTF-8 byte offsets in the Rust DTO or as UTF-16 code units at the TypeScript boundary. The preferred internal representation is UTF-8 byte offsets because Rust slices use byte offsets. Conversion to editor UTF-16 positions belongs in the adapter.

### Error behavior

Malformed expressions should return diagnostics with stable error codes and source spans. The API must not return a partial AST as valid unless the response explicitly marks it partial.

### AST and evaluation separation

AST inspection must not implicitly execute a worksheet. Parsing/inspection and evaluation are separate operations:

- `inspect(source)` → tokens, AST, diagnostics
- `evaluate(source)` → values, units, diagnostics, report output

This allows Python/SymPy/NumPy checks to compare parsing and evaluation independently.

## Immediate next steps

1. Validate the new highlighter WASM build in CI.
2. Add tokenizer fixtures for arithmetic, identifiers, functions, units, comments, Unicode identifiers, and malformed input.
3. Create a minimal Rust-side API extension in a maintained CivilKit fork/patch to return the AST DTO.
4. Add native tests for the DTO before exposing it through WASM.
5. Add the AST panel to the Jabr inspector when the engine endpoint is available.


## AST explorer UI — current implementation

The first frontend implementation lives in \`src/interactive/ast-renderer.ts\` and is deliberately parser-neutral. It normalizes parser JSON into a stable, path-keyed view model and renders a DOM tree, selected-node details, and full JSON without introducing a UI framework or a parser-specific tree dependency.

The source panel accepts optional per-node spans using this browser-facing shape:

\`\`\`json
{
  "span": {
    "start": 0,
    "end": 5,
    "unit": "utf16"
  }
}
\`\`\`

Offsets are zero-based UTF-16 code units and the end offset is exclusive. This is the UI boundary contract because CodeMirror and JavaScript string slicing use UTF-16 code-unit offsets. The Rust inspection DTO should continue to use UTF-8 byte offsets; the TypeScript adapter must convert those offsets before passing nodes to the explorer.

When valid spans are present:
- Selecting a tree node highlights its complete source range.
- Selecting a highlighted source segment selects the narrowest AST node covering that segment.
- The details pane reports the selected node's source range.

When spans are absent, the source is displayed as read-only reference text with an explicit unavailable status. The UI must not guess spans from node values, tokenize-and-match text, or fabricate a source mapping.

### Current parser limitation

The terminal's existing \`ast\` and \`ast-latex\` commands still use the separately integrated Mathlex 0.4.2 parser. Its serialized expression nodes contain \`kind\` and \`annotations\`; the public AST type does not carry source positions. Consequently, the new source-navigation UI is implemented and testable against source-aware fixtures, but live Mathlex output currently displays the source without node highlighting.

The vendored Calcpad highlighter exposes token positions, not AST node positions. Those token spans must not be assigned to AST nodes. Live bidirectional navigation becomes available only after the actual Calcpad parser emits source spans and the Jabr adapter maps them to this UI contract.

### Frontend tests

\`src/interactive/ast-renderer.test.ts\` covers stable node paths, arbitrary node kinds, nesting limits, valid UTF-16 span metadata, and rejection of invalid spans. Browser interaction tests should be added when the test environment includes a DOM; the current Vitest environment is Node.



## M2 implementation update — parse-only expression AST

The first native expression-inspection path is now implemented on `feat/block-analysis-api`.

- `inspect_expression(source)` invokes `MathParser::parse`, then lowers the parser-produced RPN into Jabr-owned AST DTOs.
- It does not call `compile_rpn`, `eval_expr`, worksheet evaluation, HTML rendering, or the highlighter.
- This avoids the existing compiler `Expr` constant-folding behavior, which would otherwise erase syntax such as the operator tree in `2 + 3 * 4`.
- AST nodes retain parser token categories, operator/function identity, operand order, and source/derived provenance. Derived origins retain their individual fragments; the node span is only their bounding envelope.
- Parser errors are returned as structured AST diagnostics.
- The API is expression-level. It does not yet expose worksheet directives, multi-line blocks, loop/conditional document nodes, or function-definition bodies.
- The expression source itself is the coordinate authority. Original block-global offsets remain gated on M1's ExpressionParser source-segment and cache/replay mapping.

Implementation plan: [M2 AST inspection](superpowers/plans/2026-11-19-jabr-math-ast-inspection.md).

Native Rust tests have been added for precedence-preserving AST shape, assignment target/RHS separation, function calls, parser diagnostics, and UTF-8 token spans. They have not yet been executed because this environment has no Rust toolchain. The RPN token-family audit and broader fixtures remain open.
