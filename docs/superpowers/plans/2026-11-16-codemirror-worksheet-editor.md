# CodeMirror Worksheet Editor Implementation Plan

**Goal:** Replace the Calcpad engine test page's plain worksheet textarea with a minimal CodeMirror 6 editor that provides core IDE-like text interaction.

**Architecture:** Keep CodeMirror isolated under src/editor/. The engine-test page owns the CodeMirror instance and passes its current source to the existing Calcpad WASM functions; the editor module has no dependency on Calcpad internals.

**Tech Stack:** TypeScript, CodeMirror 6 ESM bundle, Vite, Vitest, Bun and npm.

## Constraints
- Vanilla HTML/CSS + TypeScript + Vite; no frontend framework.
- Keep Bun and npm supported; no lockfile changes for the editor.
- Windows x64 remains required.
- Keep the Mathlex terminal and Calcpad engine adapter unchanged.
- Do not introduce LSP, AST coupling, or an additional syntax parser.
- Do not merge this feature branch without explicit user authorization.

## Completed
- [x] Mount CodeMirror in the existing engine-test page and preserve source read/write behavior.
- [x] Add the basic CodeMirror editing setup: line numbers, bracket/quote closing and matching, indentation, undo/redo, standard key bindings, and completion UI.
- [x] Keep Run and Tokenize reading the latest editor document.
- [x] Add Ctrl/Cmd+Enter to run the current worksheet.
- [x] Keep editor lifecycle isolated behind a small create/destroy adapter.

## Remaining verification
- [ ] Add meaningful tests for the editor adapter, change notifications, keyboard shortcut, and teardown.
- [ ] Verify typecheck and Vite build with Bun and npm.
- [ ] Manually verify editor behavior in the browser and inspect network dependency behavior.
- [ ] Add a small Calcpad completion list after confirming the pinned engine's supported symbols.
