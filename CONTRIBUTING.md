# Contributing to Jabr CLI

Thank you for helping improve Jabr. This repository is an engine-testing laboratory for CivilKit/Calcpad, with a minimal browser terminal and a separate engine test page. The selected Calcpad source crates are vendored under `engine/`; no Git submodule is required.

## Project scope

Contributions should improve one or more of these areas:

- CivilKit native and WebAssembly build/test integration.
- The Jabr engine adapter and its documented contract.
- Tokenizer inspection and source mapping.
- Real AST inspection and readable ATS formatting.
- LaTeX formatting from structured AST data.
- Independent regression fixtures and Python oracle checks.
- Developer documentation, build reliability, and Windows support.

Jabr is not the separate notes application. Features belonging exclusively to that application should be developed there, with Jabr providing a stable engine contract and reproducible test fixtures.

## Before opening an issue or pull request

1. Search existing issues, pull requests, and documentation for related work.
2. Check `docs/ENGINE-LAB-PLAN.md` for agreed architecture and sequencing.
3. For a substantial change, open an issue or describe the proposal before implementation.
4. Explain the problem, intended behavior, alternatives considered, and compatibility impact.
5. Do not assume that a proposal authorizes a merge or a change to an established architectural decision.

## Development setup

### Requirements

- Git.
- Bun (preferred) or supported Node.js with npm.
- Rust toolchain and Cargo.
- wasm-pack 0.15.1.
- `wasm32-unknown-unknown` Rust target.
- Python 3.10+ for independent CLI checks.

Install JavaScript dependencies using one package manager:

```bash
bun install
# or
npm ci
```

See [README.md](README.md) for the full toolchain installation and Windows build instructions.

## Branch and commit conventions

- Create a focused feature or fix branch from the appropriate current base.
- Do not commit directly to the default branch.
- Keep pull requests small enough to review.
- Use descriptive commit messages, for example:
  - `feat(ast): expose versioned inspection DTO`
  - `fix(wasm): normalize source spans`
  - `test(engine): add matrix regression fixtures`
  - `docs: clarify native and WASM development workflow`
- Avoid mixing formatting-only changes with functional changes.
- Do not include generated WASM bindings, build output, local caches, or unrelated submodule pointer changes unless required and explained.

## Coding guidelines

### TypeScript and frontend

- Use the existing TypeScript + Vite setup and current project conventions.
- Keep modules small and responsibilities explicit.
- Prefer typed interfaces and discriminated unions for AST node kinds.
- Keep engine-specific normalization in the adapter layer.
- Do not add a frontend framework just for a single feature.
- Keep UI state and rendering separate from parsing/evaluation logic.

### Rust and vendored Calcpad

- Preserve the vendored source and its calculation semantics. Keep Jabr-specific changes narrow and documented.
- Preserve calculation semantics and upstream behavior.
- Keep public API additions deliberate and test them at the Rust boundary.
- Preserve upstream license and NOTICE files.
- Explain any upstream source update or change to the vendored revision in the pull request.

### AST and tokenizer

- Tokenizer output is lexical information, not an AST.
- AST output must originate from the actual parser.
- Preserve source locations and document offset units.
- Keep AST inspection separate from evaluation.
- Do not derive AST or standalone LaTeX by scraping report HTML.
- ATS is a readable rendering of the AST; it must not change its semantics.

### Tests and fixtures

- Add a fixture for every new parser or engine behavior where practical.
- Prefer deterministic expected results.
- Compare native and WASM outputs when both support the feature.
- Use explicit numeric tolerances and test units/diagnostics separately.
- Keep Python checks independent of the engine implementation.
- Do not update golden outputs merely to make a failing test pass; explain why the expected behavior changed.

## Validation checklist

Run the relevant checks for your change. A broad local validation can include:

```bash
# JavaScript tests
bun run test
# or
npm test

# TypeScript and web build
bun run typecheck:bun
bun run build:web
# or
npm run typecheck
npm run build:web

# Native engine build and smoke test
bun run engine:native:bun
# or
npm run engine:native

# Independent Python checks (after native build)
python tests/python/run_civilkit_checks.py

# Rust engine tests
cargo test --manifest-path engine/Cargo.toml -p jabr-calcpad-core
```

Use the repository's Windows scripts and CI for Windows-specific validation. If a command cannot be run, state why and identify the check that remains outstanding.

## Pull request checklist

A good pull request should include:

- [ ] A clear problem statement and scope.
- [ ] A concise explanation of the implementation.
- [ ] Tests and fixtures for changed behavior.
- [ ] Build/test results, including any skipped checks.
- [ ] Documentation updates where needed.
- [ ] Dependency and license review for new packages.
- [ ] No unrelated generated files or accidental submodule changes.
- [ ] Known limitations and follow-up work.
- [ ] Confirmation that no merge or release was performed without authorization.

## Review expectations

Reviewers should focus on correctness, parser/evaluator semantics, API stability, source-span accuracy, security, test quality, Windows compatibility, and unnecessary dependencies.

A passing UI demo is not sufficient evidence that the calculation engine is correct. Engine behavior must be covered by reproducible tests.

## Licensing

Do not assume that every referenced project has a compatible license. Review the exact license of each dependency and preserve all required notices. In particular, do not copy AGPL-licensed AST Explorer application code into Jabr; independently implementing a similar inspection workflow is acceptable.

## Questions

For architectural questions, consult [the development guide](docs/DEVELOPMENT.md) and [the engine-lab plan](docs/ENGINE-LAB-PLAN.md) before proposing a change.
