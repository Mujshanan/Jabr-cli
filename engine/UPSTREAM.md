# Vendored Calcpad Rust source

Jabr vendors the calculation engine and worksheet editor services from CivilKit Calcs as locally maintained source code.

- Upstream repository: https://github.com/civilkit/civilkit-calcs
- Imported revision: `97f4bb698cea3bd6a9a4fae46dbc28b0d3ca5ffc`
- Upstream engine ancestry: CalcpadCE commit `0cf438f`
- Imported crates:
  - `calcpad-core` → local package `jabr-calcpad-core`, library `calcpad_core`
  - `calcpad-wasm` → local package `jabr-calcpad-wasm`
  - `calcpad-highlighter` → local package `jabr-calcpad-highlighter`, library `calcpad_highlighter`
  - `calcpad-highlighter-wasm` → local package `jabr-calcpad-highlighter-wasm`

The Rust source is copied into this repository under `engine/` and maintained here. The local Cargo workspace does not use a Git submodule and the local core/highlighter crates do not call a CivilKit API. Jabr-specific changes should be made directly to these local copies and documented separately from imported upstream code.

## Licensing and attribution

The upstream MIT license and copyright notices are retained in [LICENSE](LICENSE). The upstream provenance and third-party notices are retained in [NOTICE](NOTICE). The highlighter's original license file is also retained in [calcpad-highlighter/LICENSE](calcpad-highlighter/LICENSE).

The core includes a Markdig subset. Its BSD 2-Clause terms and copyright notice are described in [NOTICE](NOTICE). Preserve all these notices when redistributing the source or binaries. Review any new optional crate or imported asset for its own license before adding it.

## Updating the vendored source

When importing a later upstream revision:

1. Compare the upstream changes against the revision above.
2. Review license, copyright and NOTICE changes.
3. Separate upstream changes from Jabr-specific patches.
4. Apply updates deliberately; do not replace local files wholesale if they contain Jabr modifications.
5. Run the full Rust, native, WASM, Python and frontend test suites.
