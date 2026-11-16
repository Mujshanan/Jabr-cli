# CodeMirror Worksheet Editor Implementation Plan

> **For agentic workers:** Use this plan task-by-task with test-driven development. Do not merge the feature branch.

**Goal:** Replace the CivilKit engine test page's plain worksheet textarea with a minimal CodeMirror 6 editor that provides core IDE-like text interaction and basic Calcpad completion.

**Architecture:** Keep CodeMirror isolated under `src/editor/`. The engine-test page owns the CodeMirror instance and passes its current source to the existing CivilKit WASM functions; the editor module has no dependency on CivilKit.

**Tech Stack:** TypeScript, CodeMirror 6, Vite, Vitest, Bun and npm.

**Spec:** `docs/superpowers/specs/2026-11-16-codemirror-editor-design.md`

## Global Constraints
- Vanilla HTML/CSS + TypeScript + Vite; no frontend framework.
- Bun and npm remain supported; no pnpm.
- Windows x64 remains required.
- Keep the Mathlex terminal and CivilKit engine adapter unchanged.
- Do not introduce LSP, AST coupling, or an additional syntax parser.
- Add only focused CodeMirror packages required by implemented features.

## Review Focus
- Initial editor content is preserved and the engine always receives the latest document.
- Bracket/quote closing does not duplicate an existing closer or corrupt selected text.
- Enter indentation remains predictable for blank lines and nested delimiters.
- Completion insertion replaces only the active identifier prefix and preserves cursor position.
- The editor remains usable at narrow/mobile viewport widths and does not break the Run/Tokenize actions.

---

### Task 1: Add the CodeMirror editor foundation

**Files:**
- Modify: `package.json` and lockfiles.
- Create: `src/editor/create-editor.ts`.
- Modify: `engine-test.html`, `src/interactive/engine-test.ts`, and `src/interactive/engine-test.css`.
- Test: editor configuration and mount behavior.

**Interfaces:**
- Produce `createWorksheetEditor(parent: HTMLElement, initialValue: string, onChange?: (value: string) => void)` returning `{ getValue(): string; destroy(): void }`.

- [ ] Write tests for initial content, document reads after edits, change notification, and teardown.
- [ ] Run the tests and verify they fail because the editor module is absent.
- [ ] Add only the CodeMirror state/view packages needed to mount an editor.
- [ ] Implement the editor factory and replace the textarea while preserving the existing page layout.
- [ ] Verify typecheck and Vite build with Bun and npm.

### Task 2: Add core editing behavior

**Files:**
- Modify: `src/editor/create-editor.ts`.
- Create: `src/editor/extensions.ts`.
- Test: extension configuration and keyboard behavior where testable.

**Interfaces:**
- Produce `worksheetEditorExtensions()` containing the selected minimal CodeMirror extensions.

- [ ] Test the configured extension set and key bindings.
- [ ] Enable bracket/quote closing, bracket matching, indentation, history, and standard undo/redo shortcuts.
- [ ] Verify typing paired delimiters, skipping an existing closer, Enter indentation, and undo/redo manually in the browser.
- [ ] Run the full Vitest suite and both package-manager builds.

### Task 3: Add basic Calcpad completion

**Files:**
- Create: `src/editor/completions.ts`.
- Modify: `src/editor/extensions.ts` and `src/editor/create-editor.ts`.
- Test: `src/editor/completions.test.ts`.

**Interfaces:**
- Produce a completion source using CodeMirror's autocomplete API and a small static list of verified mathematical function names and Greek symbols.

- [ ] Test prefix filtering, case behavior, insertion text, and replacement ranges.
- [ ] Enable the completion popup on explicit invocation and appropriate identifier input.
- [ ] Keep units/constants out until verified against the pinned CivilKit version.
- [ ] Verify the complete test suite, typecheck, and Vite builds with Bun and npm.

### Task 4: Documentation and integration verification

**Files:**
- Modify: `docs/ENGINE-LAB-PLAN.md`, `docs/DEVELOPMENT.md`, and `README.md` only if setup instructions change.

- [ ] Document editor boundary, included features, and deferred semantic features.
- [ ] Verify the editor does not alter the terminal or engine adapter.
- [ ] Review dependency and bundle impact; confirm no framework or LSP was introduced.
- [ ] Run all feasible tests and record any environment-blocked verification explicitly.
