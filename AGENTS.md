# Agent Instructions

These instructions apply to the entire Jabr CLI repository.

## Project identity and scope

Jabr is a small browser-based engine laboratory for evaluating the CivilKit/Calcpad Rust calculation engine. It is not the separate notes application that may eventually embed the engine through a custom calculation block.

Keep the existing terminal and the CivilKit engine test page as developer tools. Do not turn this repository into the notes application, a full worksheet editor, or a general-purpose operating-system shell.

## Non-negotiable project decisions

- Keep the frontend on the existing Vanilla HTML/CSS + TypeScript + Vite stack. Do not introduce React, Vue, Nuxt, or another framework solely to implement a feature.
- Keep Bun and npm supported. Do not introduce pnpm.
- Keep Windows x64 as a required development and CI target.
- Keep CivilKit isolated behind a documented adapter. Do not let UI code depend directly on Rust internals or upstream-specific DTOs.
- Keep tokenizer output, AST inspection, evaluation results, LaTeX, diagnostics, and HTML report output as distinct concepts.
- Never fabricate an AST from tokens or reverse-engineer it from generated HTML.
- Preserve the upstream CivilKit submodule pin, license, NOTICE files, and attribution. Do not silently change the upstream revision.
- Use Python as an independent test oracle where useful; do not make Python a runtime dependency of the browser app or Rust engine.
- Do not merge pull requests, close PRs, retarget PRs, or change protected architectural decisions unless the user explicitly authorizes that action.

## Before making changes

1. Read `README.md`, `docs/ENGINE-LAB-PLAN.md`, and the relevant design/audit documents.
2. Inspect the current branch, working tree, recent commits, and existing implementation before editing.
3. Check existing dependencies and APIs before adding packages or duplicating functionality.
4. Confirm whether a task concerns the CivilKit engine, the Jabr adapter, the terminal, or the engine-test UI.
5. If a required upstream API is private or unavailable, document the limitation and propose the smallest maintainable extension. Do not bypass the boundary with fragile parsing.

## Architecture boundaries

- **CivilKit Rust engine:** parsing, calculation semantics, units, evaluation, and native/WASM engine behavior.
- **Jabr engine adapter:** stable, versioned interface; initialization; inspection; evaluation; normalized diagnostics; version/capability reporting.
- **Tokenizer/highlighter:** lexical tokenization and source highlighting only. It is not the AST.
- **AST inspector:** presentation of the real parser AST. The UI may format and navigate the tree but must not invent parser semantics.
- **Terminal:** simulated application command interface. It dispatches only registered commands.
- **Python checks:** independent black-box validation of native CLI output.

## AST and output rules

- Expose AST through a deliberate Rust-side inspection DTO with a schema version.
- Preserve node kind, child order, operators, names, literal text, units, diagnostics, and source spans where available.
- Document source-span units and conversions. Rust byte offsets and JavaScript UTF-16 offsets are not interchangeable.
- Keep expression AST separate from worksheet-level constructs when the upstream parser models them separately.
- Generate ATS labels from the structured AST using a frontend formatter.
- Generate LaTeX from AST nodes for explicitly supported constructs. Report unsupported constructs instead of silently emitting misleading output.
- Keep inspection and evaluation as separate operations.

## Implementation workflow

1. Make the smallest coherent change on the task's existing feature branch.
2. Follow current naming, formatting, and module conventions.
3. Add or update tests and fixtures with behavior changes.
4. Run the narrowest relevant tests first, then typecheck/build and broader tests where feasible.
5. Inspect the final diff for unrelated changes, generated files, accidental submodule changes, and license/NOTICE loss.
6. Update relevant documentation and the development plan when architecture or project status changes.
7. Report exactly what changed, what was tested, what was not tested, and any remaining limitations.

## Git and pull-request rules

- Do not commit directly to the default branch.
- Do not merge without explicit user authorization.
- Do not force-push, rewrite history, or discard user changes.
- Do not update the CivilKit submodule pointer unless the task explicitly requires it and the reason is documented.
- Keep PRs focused and explain prerequisites, test evidence, known limitations, and follow-up work.
- If CI is still running, say so. Never report a successful build or test without observing its result.

## Dependency policy

Before adding a dependency:

1. Check whether the repository already has a suitable package or native implementation.
2. Confirm that it works with the existing Vite/TypeScript setup and Bun/npm.
3. Review its maintenance status, license, browser compatibility, bundle impact, and transitive dependencies.
4. Prefer a small focused library over a complete application or framework.
5. Record why the dependency is needed and what alternatives were considered.

Do not copy AGPL-licensed AST Explorer source into this repository. Its interaction model may be studied and independently implemented.

## Security and safety

- Jabr is not a shell. Never add arbitrary command execution, `eval()`, or unrestricted execution of worksheet-generated JavaScript.
- Keep generated report content sandboxed; do not enable scripts in report iframes without a reviewed security design.
- Treat worksheet input, generated HTML, imported files, and upstream output as untrusted data.
- Do not commit credentials, access tokens, private data, or local machine-specific paths.

## Definition of done

A change is complete only when:

- The implementation matches the agreed scope and architecture.
- Relevant tests pass, or failures and environment limitations are documented.
- Documentation and fixtures reflect the actual behavior.
- No unrequested merge or architectural migration occurred.
- The final report distinguishes implemented work from planned work.
