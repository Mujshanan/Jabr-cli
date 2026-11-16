# CodeMirror Worksheet Editor — Design

## Intent
Give the existing CivilKit engine test page a small, dependable code-editor input surface so worksheet text can be entered with IDE-like editing behavior. This is a developer-facing engine-test tool, not a general-purpose worksheet IDE.

## Goals
- Replace only the engine test page's worksheet textarea with CodeMirror 6.
- Support automatic bracket/quote closing, bracket matching, sensible indentation, undo/redo, and a compact Calcpad completion popup.
- Keep the editor visually minimal and retain the current Run, Tokenize, engine status, report, and diagnostics behavior.
- Keep the editor isolated from CivilKit WASM internals and from the existing Mathlex terminal.
- Keep Bun and npm workflows supported.

## Non-goals
- No React, Vue, Monaco, LSP, language server, AST-dependent features, hover documentation, rename, or full syntax parser.
- No editor replacement in the existing terminal.
- No worksheet semantic completion until the available CivilKit symbol catalogue is verified.

## Approaches considered
1. Native textarea plus custom handlers: smallest dependency footprint, but limited editing behavior and poor extensibility.
2. CodeMirror 6 with only focused packages: selected because the user explicitly chose CodeMirror and it provides the requested interaction without a framework.
3. Monaco: rejected as unnecessarily large for this engine-lab input surface.

## Design decisions
- Use CodeMirror 6's state/view, commands, language, autocomplete, and close-brackets packages only where required by the chosen extensions.
- Put editor construction and completion metadata in a small `src/editor/` module.
- Mount the editor in the existing worksheet editor container and expose a small API to read the current document; the engine test page remains responsible for running and tokenizing source.
- Keep completion entries conservative and explicitly authored. Start with common mathematical function names and Greek symbols; add units/constants only after checking the pinned CivilKit catalogue.
- Do not introduce a syntax parser merely to enable bracket matching or completion.
- Preserve the current worksheet source on initial load and avoid losing editor content when running or tokenizing.

## Constraints
- Existing Vanilla HTML/CSS + TypeScript + Vite application.
- Bun and npm remain supported.
- Windows x64 remains a required target.
- No merge without explicit user authorization.
