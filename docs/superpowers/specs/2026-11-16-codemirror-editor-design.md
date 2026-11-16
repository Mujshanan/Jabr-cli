# CodeMirror Worksheet Editor — Design

## Intent
Give the Calcpad engine test page a small, dependable code-editor input surface so worksheet text can be entered with IDE-like editing behavior. This is a developer-facing engine-test tool, not a general-purpose worksheet IDE.

## Goals
- Replace only the engine test page's worksheet textarea with CodeMirror 6.
- Support CodeMirror's standard bracket/quote closing, bracket matching, sensible indentation, undo/redo, and default completion interaction.
- Keep the editor visually minimal and retain the current Run, Tokenize, engine status, report, and diagnostics behavior.
- Keep the editor isolated from Calcpad WASM internals and from the existing Mathlex terminal.
- Keep Bun and npm workflows supported without adding package-manager dependencies for the editor.

## Implementation decisions
- Load the version-pinned CodeMirror 6 codemirror@6.0.2 ESM bundle from esm.sh. This keeps dependency manifests and lockfiles unchanged and avoids a framework or multi-package dependency list.
- Use the upstream basicSetup extension for line numbers, active-line display, selection, bracket matching/closing, indentation, undo/redo, and the standard completion UI.
- Put editor construction and the small host adapter in src/editor/create-editor.ts.
- The engine-test page owns the CodeMirror instance and passes its current source to the existing Calcpad WASM functions; the editor module has no dependency on the engine.
- Keep completion suggestions language-agnostic in this first integration. A Calcpad-specific symbol list will be added only after checking the pinned engine's actual function catalogue.

## Constraints
- Existing Vanilla HTML/CSS + TypeScript + Vite application.
- No React, Vue, Monaco, LSP, language server, syntax parser, or additional editor package dependencies.
- Windows x64 remains a required target.
- No merge without explicit user authorization.

## Runtime note
The editor ESM bundle is fetched from esm.sh when the engine-test page loads, so this page requires network access for CodeMirror in this initial version. The editor source and engine remain independent; a later packaging pass can vendor the bundle for offline use.
