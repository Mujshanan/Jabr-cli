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
