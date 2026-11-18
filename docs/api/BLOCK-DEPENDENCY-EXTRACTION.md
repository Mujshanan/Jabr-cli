# Jabr Math Block Dependency Extraction — Design v1

**Status:** Proposed contract for review; not implemented. Required before Jabr Engine repository implementation.

## 1. Purpose and ownership

Math reports, for each independently evaluable source block, the mathematical symbols it defines and reads. Engine consumes this metadata to resolve worksheet bindings and construct the cross-block dependency graph that Kernel's topological sort can order.

Math owns lexical/syntactic symbol recognition, language name resolution, local-scope rules, and the distinction between definitions and reads. Engine owns block identity mapping, cross-block binding resolution, dependency graph construction, scheduling, and recalculation.

Do not extract dependencies with regular expressions over source or by scraping report HTML. Use the real Math parser/AST and evaluator symbol-resolution paths.

## 2. Per-block contract

Every block analysis/evaluation result includes a dependency summary:

```rust
pub struct BlockDependencies {
    pub block_id: NodeId,
    pub definitions: Vec<SymbolDefinition>,
    pub reads: Vec<SymbolRead>,
    pub analysis_complete: bool,
    pub diagnostics: Vec<Diagnostic>,
}

pub struct SymbolDefinition {
    pub symbol: SymbolId,
    pub display_name: String,
    pub kind: DefinitionKind,
    pub certainty: DefinitionCertainty,
    pub span: Option<Span>,
    pub event_index: u32,
}

pub struct SymbolRead {
    pub symbol: SymbolId,
    pub display_name: String,
    pub kind: ReadKind,
    pub certainty: ReadCertainty,
    pub span: Option<Span>,
    pub event_index: u32,
}
```

Illustrative types only; the JSON DTO is frozen with the shared wire protocol. `SymbolId` is Math-owned and canonical according to Math's language rules. It is not a Kernel `NodeId`. The containing block is identified by Kernel `NodeId`.

## 3. Symbol identity and name resolution

- Math defines canonical symbol identity using the same case sensitivity, Unicode normalization, identifier grammar, aliases, and unit/function namespaces used by evaluation.
- Return both canonical `symbol` and authored `display_name`.
- Engine compares canonical symbol keys only. It must not independently lowercase, trim, or normalize names.
- Built-in constants, built-in functions, built-in units, and language keywords are not worksheet reads unless the language permits them to be shadowed and the current scope actually resolves them to a worksheet binding.
- Function parameters, loop indices, condition-local bindings, and other local symbols are not cross-block reads.
- A custom function or custom unit definition is a definition of its own symbol. Its body may read other symbols; report those reads with the scope and evaluation timing defined by Math.
- Names that cannot be resolved statically (for example dynamic symbol lookup) set `analysis_complete = false` and produce a diagnostic. Engine must use conservative sequential evaluation for that block; it must not assume the dependency set is empty.

## 4. Definition and read semantics

Report actual symbol references, not just token occurrences:

- `x = expr`: defines `x`; reads every external symbol referenced by `expr`.
- `x := expr` or equivalent declaration syntax: define according to the Math language's actual assignment semantics.
- `x += expr` and other compound updates: read the prior `x` and define/reassign `x`.
- `x = x + 1`: reads the previous binding of `x` and defines the next value.
- A pure expression `x + y`: reads `x` and `y`; defines nothing.
- Multiple assignments in one block are reported in source/evaluation order with monotonically increasing `event_index`.
- Reassignments remain distinct definition events; do not collapse them to one final symbol set. The typed result may contain the final value, but Engine needs the event sequence to preserve sequential semantics.

### Conditional and iterative constructs

Reads in a condition are unconditional when the construct itself is reached. Reads inside a branch or loop body are conditional. Report them as `may_read` rather than dropping them.

Definitions inside a branch or loop are marked `conditional` unless Math can prove the assignment occurs on every execution path. Do not mark a possibly skipped assignment as definitely available to later blocks.

For loops, report reads of loop bounds/conditions and distinguish the loop-local index from external symbols. For custom functions, report the function symbol definition and its body dependencies, but do not eagerly bind function-body reads as worksheet execution dependencies if Math semantics resolve them only when called. The call site must report the function symbol as a read; Math must define the exact function dependency expansion rule.

If a construct has dynamic or data-dependent name resolution that cannot be represented safely, mark the analysis incomplete and force Engine's conservative path.

## 5. Cross-block binding is not Math's job

Math reports names; it does not decide which worksheet block supplies a name.

Engine receives the worksheet blocks in visual reading order (top to bottom; blocks on the same row left to right). Given the accepted sequential worksheet semantics, Engine resolves each read against the latest preceding definition of that canonical symbol:

1. A definition becomes available only after its defining block/event executes successfully.
2. A read binds to the latest earlier available definition.
3. A later definition never retroactively satisfies an earlier read (no forward references).
4. If no earlier definition exists, Engine resolves the name from the explicit external input environment or reports an unresolved worksheet input.
5. A reassignment depends on the prior definition and becomes the latest binding only after successful execution.
6. A conditional definition is not guaranteed to exist. Engine must model the conditional availability or reject a downstream required read when the branch did not execute; it must not silently use a stale earlier value.

This resolution produces the graph edges. Engine uses Kernel's generic graph and topological sort only after binding has been resolved. The sort does not define language semantics and must not reorder blocks in a way that violates the accepted sequential availability rules.

## 6. Intra-block dependencies and cycles

Math handles statement-level ordering and local dependencies within a block. Engine's graph contains cross-block edges. A self-reference in an assignment (for example `x = x + 1`) is a read of the prior binding, not a self-edge to the new definition. A true recursive definition/function cycle is diagnosed according to Math language semantics; Engine must not erase it by treating all same-block definitions as already available.

For a block that defines several symbols and reads symbols defined earlier in the same block, Math's ordered events establish the local execution semantics. Engine treats the block as one scheduling node unless a future contract explicitly promotes statements to separately addressable nodes.

## 7. Incremental recalculation metadata

Dependency extraction should be deterministic for the same source, language settings, and explicit symbol environment. Return a stable ordered list (first occurrence in source/evaluation order) and deduplicate repeated reads only when their spans/event indices are retained.

A dependency summary is associated with the exact source revision supplied by the caller. Engine may cache it by block identity + source revision + relevant Math settings. Math does not own invalidation or cache lifecycle.

Changes to a block's definitions or reads cause Engine to rebuild the affected binding edges. A value-only change with unchanged dependency metadata may only require downstream invalidation/recalculation; that policy belongs to Engine.

## 8. Integration with typed results

The `BlockResult` described in [STRUCTURED-BLOCK-RESULTS.md](STRUCTURED-BLOCK-RESULTS.md) carries a `BlockDependencies` summary plus typed `AssignmentResult` values. Each assignment result correlates with its `SymbolDefinition` by canonical symbol and event_index; this avoids maintaining two competing definition schemas. The dependency summary is available even when evaluation fails, if parsing/analysis reached the relevant statements. Do not infer definitions or reads from the final value list alone.

A successful assignment event must include its symbol, event order, assignment kind, and typed value. A failed or skipped assignment must not be reported as an available definition.

## 9. Acceptance tests

- Assignment reports a definition and only the symbols read by its right-hand side.
- Reassignment and compound update report the prior-symbol read and a new definition event.
- Multiple assignments preserve event order and distinct values.
- Built-ins and local function/loop variables do not become false worksheet dependencies.
- Custom function definition and call-site dependencies follow the documented lazy/eager semantics.
- Conditional reads/definitions are marked correctly.
- Dynamic/unanalysable symbol lookup sets `analysis_complete = false`.
- Unicode/case-sensitive identifiers produce the same canonical identity as evaluation.
- Source spans are valid UTF-8 byte ranges or absent; never guessed from line numbers.
- Engine resolution selects the latest preceding definition and does not bind forward references.
- A read without a preceding definition is identified as an external/unresolved input, not silently ignored.
- Same-block self-update reads the prior value and does not create a false graph self-cycle.
- Results are deterministic across repeated native and WASM analysis for the same fixtures.

## 10. Implementation sequence

1. Trace Math's real parser/evaluator symbol-table reads and writes; document the exact name-resolution semantics.
2. Add a narrow instrumentation interface at the parser/evaluator boundary for definition/read events and source spans.
3. Add tests for assignment, reassignment, compound update, branches, loops, local scopes, custom functions, and Unicode identifiers.
4. Expose the Jabr-owned dependency DTO in the public facade.
5. Add shared native/WASM fixtures for every dependency case.
6. Hand the immutable per-block summary to Engine; do not add worksheet graph construction or scheduling to Math.
